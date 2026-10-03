// Render a whole film from a song's film.json, one cached segment per scene, then join them and
// lay the song under the picture.
//   node photoreal/film.mjs --song ../genesis8-the-dove --draft          fast draft for the pre-render check
//   node photoreal/film.mjs --song ../genesis8-the-dove --stills         the five key stills, for review
//   node photoreal/film.mjs --song ../genesis8-the-dove                  the full film
//   options: [--only 01,02] [--samples 12] [--jobs N] [--stall 180] [--retries 2] [--no-test] [--out film.mp4]
//            [--skip-storyboard] [--skip-stills] [--skip-check]   (each is written into STATUS.md)
//            [--legacy-web <old engine's photoreal/web>]   carry over pictures cached by an engine checked out elsewhere
// film.json: { "fps": 60, "samples": 12, "scenes": [{ "id": "01", "scene": "sea", "from": 0, "to": 15.5, "params": {}, "samples"?: 16, "offBeat"?: "why" }] }
// A narrated story film adds "mode": "story" and a "story" block (lib/story.mjs); it is joined with
// out/audio/mix.wav (the narration with music ducked under it) instead of media/song.wav.
//
// Scene windows must tile the song with no gaps. A segment is re-rendered only when something it
// uses changes (see lib/keys.mjs). A scene with scenes/<name>.lyric.js keeps its words in their own
// layer, so a typography change re-renders only that cheap layer and the composite.
//
// A full render first times every scene cheaply, renders a one-second test of the slowest, and uses
// that to pick how many workers to run and to give an honest finish time. Every worker runs under a
// watchdog: no new frame for --stall seconds and it is killed, logged and retried (twice by
// default); a scene that still fails is marked failed and the others carry on. out/progress.json is
// kept current throughout, and out/STATUS.md is written when the run finishes or gets blocked.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeKeys } from './lib/keys.mjs';
import { runWithWatchdog } from './lib/watchdog.mjs';
import { Progress, writeStatus, fmtDuration } from './lib/progress.mjs';
import { pickKeyStills } from './lib/stills.mjs';
import { loadMachines } from './lib/machines.mjs';
import { Worker, pickTask, slotSeconds, plateArgs, probeOn, simulate, chooseParallel } from './lib/farm.mjs';
import { storyboardPath } from './lib/storyboard.mjs';
import { isStory, storyConfig } from './lib/story.mjs';
import { buildMix } from './lib/story-audio.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RENDER = path.join(HERE, 'render.mjs');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes('--' + k);
const SONG = path.resolve(opt('song', '.'));
const film = JSON.parse(fs.readFileSync(path.join(SONG, 'film.json'), 'utf8'));
const draft = flag('draft');
// Render tiers (--tier, or "tier" in film.json; standard when neither says):
//   fast      30 fps, 2 sub-frames, quick encode, no review gates: a watchable film in a couple of hours
//   standard  the film's own fps and samples: what every film rendered before tiers existed
//   premium   60 fps, at least twice the sub-frames (32 for lens-heavy premium scenes), richer lyric
//             layers, the slowest encode, every gate: the all-out photoreal render
// A request for a photorealistic film means premium.
// ultra: the highest quality the engine draws: 4K (unless film.json says otherwise), four times the
//   film's sub-frames (at least 64; every sub-frame is jittered inside the pixel, so this is the
//   engine's supersampling as well as its motion blur), the film's own frame rate, CRF 12, every gate.
const TIERS = ['fast', 'standard', 'premium', 'ultra'];
const tier = opt('tier', film.tier ?? 'standard');
if (!TIERS.includes(tier)) throw Error(`--tier must be one of ${TIERS.join(', ')}`);
const fps = tier === 'fast' ? 30 : tier === 'premium' ? Math.max(60, film.fps ?? 60) : film.fps ?? 60;
const baseSamples = film.samples ?? 12;
const samples = opt('samples', draft ? '2' : tier === 'fast' ? '2' : tier === 'premium' ? String(Math.max(16, baseSamples * 2)) : tier === 'ultra' ? String(Math.max(64, baseSamples * 4)) : String(baseSamples));
const layerSamples = draft || tier === 'fast' ? 2 : tier === 'premium' || tier === 'ultra' ? 16 : 8;
const encode = { preset: draft || tier === 'fast' ? 'veryfast' : 'slow', crf: opt('crf', tier === 'fast' ? '20' : tier === 'premium' ? '16' : tier === 'ultra' ? '12' : '18') };
const only = opt('only')?.split(',');
// output size: "resolution": "3840x2160" in film.json or --res (drafts and the fast tier stay 1920x1080)
const res = draft || tier === 'fast' ? '1920x1080' : opt('res', film.resolution ?? (tier === 'ultra' ? '3840x2160' : '1920x1080'));
if (!/^\d+x\d+$/.test(res)) throw Error('resolution must look like 3840x2160');
const OUT = path.join(SONG, 'out');
const REVIEW = path.join(OUT, 'review');
const segDir = path.join(OUT, draft ? 'segments-draft' : tier === 'standard' ? 'segments' : `segments-${tier}`);
const workDir = path.join(OUT, 'work');
for (const d of [segDir, REVIEW, workDir]) fs.mkdirSync(d, { recursive: true });
const stallSec = +opt('stall', 180), retries = +opt('retries', 2);
const started = Date.now();
const notes = [];

// tiling check
const scenes = film.scenes;
for (let i = 1; i < scenes.length; i++) {
  if (Math.abs(scenes[i].from - scenes[i - 1].to) > 1e-6) throw Error(`gap or overlap between ${scenes[i - 1].id} and ${scenes[i].id}`);
}

// a narrated story film ("mode": "story") is joined with its narration mix instead of a song
const story = isStory(film);
if (story) {
  const errs = storyConfig(film).errors;
  if (errs.length) throw Error(`film.json story: ${errs.join('; ')}`);
  if (!fs.existsSync(path.join(SONG, 'data', 'story.json'))) throw Error('run node photoreal/story.mjs prepare first: the narration has not been aligned');
}

const keys = makeKeys(SONG, { legacyWeb: opt('legacy-web') });
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const cached = (file, key) => key && fs.existsSync(file) && fs.existsSync(file + '.key') && fs.readFileSync(file + '.key', 'utf8') === key;
const paramsOf = (s) => JSON.stringify({ ...(s.params ?? {}), id: s.id, from: s.from, to: s.to });

// transitions: a scene with "transition": { "type", "duration" } blends in from the one before over
// the cut; both are rendered half the duration past the cut (handles) and joined with that blend
const handlesOf = (i) => {
  const into = scenes[i].transition, out = scenes[i + 1]?.transition;
  const pre = into ? (into.duration ?? 0.5) / 2 : 0, post = out ? (out.duration ?? 0.5) / 2 : 0;
  return pre || post ? [pre, post] : null;
};
const segs = scenes.map((s0, i) => {
  const handles = handlesOf(i);
  const s = { ...(handles ? { ...s0, handles } : s0), ...(res !== '1920x1080' ? { res } : {}) };
  const f0 = Math.round((s.from - (handles?.[0] ?? 0)) * fps), f1 = Math.round((s.to + (handles?.[1] ?? 0)) * fps);
  // A scene can be raised to premium on its own ("tier": "premium" on the scene), so a few scenes
  // can be rebuilt all-out and stitched into a film otherwise rendered at standard; it renders at the
  // film's frame rate. The fast tier renders everything fast.
  const st = tier === 'fast' ? 'fast' : s.tier === 'premium' ? 'premium' : tier;
  const base = st === tier ? +samples : st === 'premium' ? Math.max(16, baseSamples * 2) : baseSamples;
  // a scene may ask for more sub-frames (fast wings); premium gives lens-heavy premium scenes 32
  const own = s.samples != null ? String(st === 'premium' ? Math.max(+s.samples, base) : st === 'fast' ? Math.min(+s.samples, base) : s.samples) : String(base);
  const sSamples = draft ? samples : st === 'premium' && keys.isPremium(s.scene) ? String(Math.max(32, +own)) : own;
  const sLayerSamples = st === 'premium' && !draft ? 16 : layerSamples;
  const sDir = st === tier || draft ? segDir : path.join(OUT, `segments-${st}`);
  fs.mkdirSync(sDir, { recursive: true });
  const layered = keys.hasLayer(s.scene);
  const out = path.join(sDir, `${s.id}.mp4`);
  const seg = { ...s, f0, f1, frames: f1 - f0, samples: sSamples, layered, out, content: keys.content(s, fps), sceneTier: st, crf: st === 'premium' && tier !== 'premium' ? '16' : encode.crf };
  // people rendered in Blender as their own layer (scenes/<name>.people.json)
  if (keys.hasPeople(s.scene)) {
    seg.peopleOut = path.join(sDir, `${s.id}.people.mkv`);
    seg.peopleSamples = draft ? 16 : (film.people?.samples ?? 64);
    seg.peopleKey = keys.people(s, fps, seg.peopleSamples);
  }
  if (layered || seg.peopleOut) {
    seg.plateOut = path.join(sDir, `${s.id}.plate.mp4`);
    seg.layerOut = path.join(sDir, `${s.id}.lyric.mkv`);
    seg.plateKey = keys.plate(s, fps, sSamples);
    seg.layerKey = layered ? keys.layer(s, fps, sLayerSamples) : '';
    seg.key = sha(seg.plateKey + seg.layerKey + (seg.peopleKey ?? ''));
  } else {
    seg.plateOut = out;
    seg.plateKey = keys.plate(s, fps, sSamples);
    seg.key = seg.plateKey;
  }
  seg.selected = !only || only.includes(s.id);
  return seg;
});

function blocked(reason) {
  writeStatus(path.join(OUT, 'STATUS.md'), { song: SONG, state: 'blocked', notes: [reason, ...notes], elapsed: (Date.now() - started) / 1000 });
  console.error(reason);
  process.exit(2);
}

function probe(list) {
  if (!list.length) return [];
  const r = spawnSync('node', [RENDER, 'probe', '--song', SONG, '--scenes', JSON.stringify(list.map((s) => ({ id: s.id, scene: s.scene, params: s.params, from: s.from, to: s.to })))],
    { encoding: 'utf8', timeout: 60000 * (5 + list.length), stdio: ['ignore', 'pipe', 'inherit'] });
  const lines = (r.stdout ?? '').split('\n').filter((l) => l.startsWith('PROBE ')).map((l) => JSON.parse(l.slice(6)));
  if (r.status !== 0 || lines.length !== list.length) console.log(`probe finished ${lines.length} of ${list.length} scenes${r.error ? ': ' + r.error.message : ''}`);
  return lines;
}

// ---------- key stills ----------
if (flag('stills')) {
  const pr = probe(segs);
  const lyrics = readJson(path.join(SONG, 'data', 'lyrics.json')) ?? { lines: [], words: [] };
  const picks = pickKeyStills(scenes, lyrics, pr, fps);
  // a story film also shows each story beat it must carry, just after it lands
  if (story) for (const e of readJson(path.join(SONG, 'data', 'story.json'))?.events ?? []) {
    if (e.time == null) continue;
    const t = Math.min(scenes.at(-1).to - 1 / fps, Math.round((e.time + 0.6) * fps) / fps);
    picks.push({ name: `6-event-${e.id}`, time: t, sceneId: scenes.find((s) => t >= s.from && t < s.to)?.id ?? scenes.at(-1).id, why: `story beat "${e.id}": ${e.what ?? e.cue ?? ''}` });
  }
  const dir = path.join(OUT, 'keystills');
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const shots = [];
  for (const p of picks) {
    const s = segs.find((x) => x.id === p.sceneId);
    const tmp = path.join(workDir, 'stills');
    fs.rmSync(tmp, { recursive: true, force: true });
    const r = spawnSync('node', [RENDER, 'stills', '--song', SONG, '--scene', s.scene, '--params', paramsOf(s), '--t', String(p.time), '--samples', s.samples, '--out', tmp, ...(s.res ? ['--res', s.res] : [])], { stdio: 'inherit' });
    if (r.status !== 0) { notes.push(`Key still ${p.name} (${s.id}) failed to render.`); continue; }
    const f = path.join(dir, `${p.name}.png`);
    fs.renameSync(path.join(tmp, fs.readdirSync(tmp).find((f) => f.endsWith('.png') && !f.startsWith('.'))), f);
    shots.push({ ...p, file: path.relative(SONG, f), content: s.content });
  }
  fs.writeFileSync(path.join(dir, 'stills.json'), JSON.stringify({ fps, stills: shots }, null, 1) + '\n');
  console.log(`wrote ${shots.length} key stills to ${dir}\nNext: node photoreal/critic.mjs stills --song ${path.relative(process.cwd(), SONG)} --agent claude|codex`);
  process.exit(shots.length === picks.length ? 0 : 1);
}

// ---------- gates before a full render ----------
// the fast tier is for a quick look, so it doesn't wait on the review gates (STATUS.md says so)
const full = !draft && !only && tier !== 'fast';
if (tier === 'fast' && !draft && !only) notes.push('Fast tier: rendered at 30 fps with 2 sub-frames, without waiting for the storyboard, key-stills or pre-render check gates.');
if (full) {
  const sb = storyboardPath(SONG), sbReview = readJson(path.join(REVIEW, 'storyboard-review.json'));
  if (flag('skip-storyboard')) notes.push('The storyboard gate was skipped with --skip-storyboard.');
  else if (!fs.existsSync(sb)) blocked(`No storyboard. Write ${path.relative(SONG, sb)} (node photoreal/storyboard.mjs draft) and have the critic check it before the full render.`);
  else if (sbReview?.verdict !== 'ship' || sbReview.storyboardSha !== sha(fs.readFileSync(sb))) blocked('The storyboard has no passing critic review for its current text. Run node photoreal/critic.mjs storyboard.');

  const stills = readJson(path.join(OUT, 'keystills', 'stills.json')), stReview = readJson(path.join(REVIEW, 'stills-review.json'));
  if (flag('skip-stills')) notes.push('The key-stills gate was skipped with --skip-stills.');
  else if (!stills) blocked('No key stills. Run node photoreal/film.mjs --stills, then node photoreal/critic.mjs stills.');
  else if (stills.stills.some((p) => segs.find((s) => s.id === p.sceneId)?.content !== p.content)) blocked('The key stills are out of date with the scenes. Render them again with --stills and review them.');
  else if (stReview?.verdict !== 'ship' || stReview.stillsSha !== sha(JSON.stringify(stills))) blocked('The key stills have no passing critic review. Run node photoreal/critic.mjs stills.');

  const chk = readJson(path.join(REVIEW, 'check-draft.json'));
  if (flag('skip-check')) notes.push('The pre-render check was skipped with --skip-check.');
  else if (!chk) blocked('No pre-render check. Render --draft and run node photoreal/check.mjs --label draft.');
  else if (segs.some((s) => chk.content?.[s.id] !== s.content)) blocked('The pre-render check was run on an older draft. Render --draft again and re-run node photoreal/check.mjs --label draft.');
  else if (!chk.summary?.passed) blocked(`The pre-render check failed (${chk.summary.fails} problems). See out/review/check-draft.json.`);
}

// ---------- plan the work ----------
const tasks = [];
let cachedCount = 0;
for (const s of segs) {
  if (!s.selected) continue;
  const common = ['--song', SONG, '--scene', s.scene, '--params', paramsOf(s), '--from', String(s.f0 / fps), '--to', String(s.f1 / fps)];
  let any = false;
  // a picture cached under the older, location-dependent key carries over instead of re-rendering
  if (!cached(s.plateOut, s.plateKey) && fs.existsSync(s.plateOut) && fs.existsSync(s.plateOut + '.key')
      && fs.readFileSync(s.plateOut + '.key', 'utf8') === keys.legacyPlate(s, fps, s.samples)) {
    fs.writeFileSync(s.plateOut + '.key', s.plateKey);
    console.log(`segment ${s.id}: cached picture carried over to the new key`);
  }
  if (!cached(s.plateOut, s.plateKey)) {
    any = true;
    tasks.push({ id: s.id, job: s.id, part: 'plate', scene: s.scene, frames: s.frames, out: s.plateOut, key: s.plateKey,
      renderArgs: plateArgs(s, fps, { draft: encode.preset === 'veryfast', crf: s.crf, params: paramsOf(s) }) });
  }
  if (s.layered && !cached(s.layerOut, s.layerKey)) {
    any = true;
    // lyric layers are light; they go wherever they finish soonest like any other job
    tasks.push({ id: s.id, job: `${s.id}-lyric`, part: 'layer', scene: s.scene, frames: s.frames, out: s.layerOut, key: s.layerKey, light: true,
      renderArgs: ['layer', '--scene', s.scene, '--params64', Buffer.from(paramsOf(s)).toString('base64'), '--from', String(s.f0 / fps), '--to', String(s.f1 / fps), '--samples', String(s.sceneTier === 'premium' && !draft ? 16 : layerSamples), ...(s.res ? ['--res', s.res] : []), ...(fps !== 60 ? ['--fps', String(fps)] : [])] });
  }
  if (s.peopleOut && !cached(s.peopleOut, s.peopleKey)) {
    any = true;
    // Blender runs on this Mac (its people builder and assets live in the song folder here)
    tasks.push({ id: s.id, job: `${s.id}-people`, part: 'people', scene: s.scene, frames: s.frames, out: s.peopleOut, key: s.peopleKey, localOnly: true,
      renderArgs: ['people', '--scene', s.scene, '--params64', Buffer.from(paramsOf(s)).toString('base64'), '--from', String(s.f0 / fps), '--to', String(s.f1 / fps), '--fps', String(fps), '--samples', String(s.peopleSamples), ...(s.res ? ['--res', s.res] : [])] });
  }
  if (!any && !((s.layered || s.peopleOut) && !cached(s.out, s.key))) { console.log(`segment ${s.id} cached`); cachedCount++; }
}
const plates = tasks.filter((t) => t.part === 'plate');

// ---------- machines ----------
// Every reachable machine with a GPU renders; --local keeps it to this Mac, --machines a,b picks.
const ENGINE = path.join(HERE, '..');
const workers = [];
const stoppedOn = [];
// whatever happens, stopped services come back before this process ends
async function restoreAll() {
  for (const m of stoppedOn.splice(0)) for (const r of await m.restoreServices((x) => console.log(`${m.name}: ${x}`))) notes.push(r.ok ? `${r.name} on ${m.name} was stopped for the render and is running again.` : `${r.name} on ${m.name} was stopped for the render and did NOT come back; start it again by hand.`);
}
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(sig, async () => { await restoreAll(); process.exit(130); });
for (const m of loadMachines({ only: flag('local') ? ['mac'] : opt('machines')?.split(',') })) {
  if (m.remote && !tasks.length) continue;
  let ok = await m.available();
  // services that may give up the GPU for a render (ComfyUI on OmiPC) are stopped first, so the
  // worker count is sized to the memory that frees, and restored when the film is done
  if (ok && m.remote && m.services?.length && !draft) {
    await m.stopServices((x) => { console.log(`${m.name}: ${x}`); });
    if (m.stopped.length) { stoppedOn.push(m); ok = await m.available(); }
  }
  if (!ok) { console.log(`${m.name}: not used, ${m.why}`); if (m.remote) notes.push(`${m.name} was not used: ${m.why}. The film rendered on this Mac alone.`); continue; }
  const w = new Worker({ machine: m, engineRoot: ENGINE, song: SONG, render: RENDER, workDir });
  if (m.remote) {
    try { console.log(`${m.name}: sending the engine and song`); w.dirs = m.prepare(ENGINE, SONG); }
    catch (e) { console.log(`${m.name}: not used, ${e.message}`); notes.push(`${m.name} was not used: ${e.message}`); continue; }
  }
  m.parallel = 1; m.slotFactor = 1; m.est = new Map(); m.msPerFrame = (t) => m.est.get(t.id) ?? m.est.get('*') ?? 1000;
  workers.push(w);
}
if (!workers.length) { await restoreAll(); blocked('No machine could be used for rendering.'); }

// One still per scene on this Mac and on the other machine, compared (PSNR). A scene the other
// machine draws differently, or loses its GPU context on (black frames), stays off that machine.
async function pictureCheck(w, list) {
  const m = w.machine, dir = path.join(workDir, `check-${m.name}`);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(path.join(dir, 'mac'), { recursive: true }); fs.mkdirSync(path.join(dir, m.name), { recursive: true });
  const items = list.map((sg) => ({ id: sg.id, scene: sg.scene, params: sg.params, from: sg.from, to: sg.to, t: Math.round((sg.from + sg.to) / 2 * fps) / fps }));
  const scenes64 = Buffer.from(JSON.stringify(items)).toString('base64');
  const remoteDir = `${m.root}/out/check-${w.tag}`;
  const c = m.command(w.dirs, `check-${w.tag}`, ['checkstills', '--scenes64', scenes64, '--samples', '2', '--out', remoteDir]);
  const run = (cmd, args) => new Promise((res) => { const p = spawn(cmd, args); let stdout = ''; p.stdout.on('data', (d) => { stdout += d; }); p.stderr.on('data', () => {}); p.on('close', (status) => res({ status, stdout })); });
  // both machines draw at the same time
  const [, theirs] = await Promise.all([run('node', [RENDER, 'checkstills', '--song', SONG, '--scenes64', scenes64, '--samples', '2', '--out', path.join(dir, 'mac')]), run(c.cmd, c.args)]);
  const lostThere = new Set((theirs.stdout ?? '').split('\n').filter((l) => l.startsWith('CHECK ')).map((l) => JSON.parse(l.slice(6))).filter((x) => x.lost).map((x) => x.id));
  const out = {};
  for (const it of items) {
    const a = path.join(dir, 'mac', `${it.id}.png`), b = path.join(dir, m.name, `${it.id}.png`);
    if (!fs.existsSync(a)) { out[it.id] = { ok: true, why: 'no reference on this Mac' }; continue; }
    try { m.fetch(`${remoteDir}/${it.id}.png`, b); } catch { out[it.id] = { ok: false, why: 'no picture came back' }; continue; }
    if (lostThere.has(it.id)) { out[it.id] = { ok: false, why: 'GPU context lost (black frames)' }; continue; }
    const cmp = spawnSync('ffmpeg', ['-hide_banner', '-i', a, '-i', b, '-lavfi', 'psnr', '-f', 'null', '-'], { encoding: 'utf8' });
    const raw = /average:(\S+)/.exec(cmp.stderr)?.[1];
    const psnr = raw === 'inf' ? 99 : +raw || 0;
    out[it.id] = psnr >= 30 ? { ok: true, psnr } : { ok: false, psnr, why: `draws it differently (PSNR ${psnr.toFixed(1)} dB)` };
  }
  return out;
}

// ---------- test render: each machine's speed and how many workers it takes ----------
const testReport = { at: new Date().toISOString(), machines: {} };
if (plates.length && !draft && !flag('no-test')) {
  const bySeg = (t) => segs.find((s) => s.id === t.id);
  const localM = workers.find((x) => !x.machine.remote)?.machine;
  // this Mac first: the other machines are measured against it
  for (const w of [...workers].sort((a, b) => a.machine.remote - b.machine.remote)) await (async () => {
    const m = w.machine;
    // GPU timings from the probe are only trusted on this Mac (ANGLE on OpenGL returns before the
    // GPU finishes); other machines are scaled from their own test render against this Mac's estimate
    const pr = m.remote && localM?.est.size ? plates.map((t) => ({ id: t.id, remote: true })) : probeOn(w, plates.map(bySeg));
    for (const p of pr) if (!p.remote) m.est.set(p.id, p.fixedMs + p.perSampleMs * +bySeg(p).samples); else m.est.set(p.id, localM.est.get(p.id));
    m.probe = new Map(pr.filter((p) => !p.remote).map((p) => [p.id, p]));   // GPU cost per frame and per sub-frame, for --estimate
    if (m.remote && !localM) notes.push(`${m.name}'s pictures were not checked against this Mac, which was left out of the render.`);
    if (m.remote && localM) {
      const check = await pictureCheck(w, plates.map(bySeg));
      const bad = Object.entries(check).filter(([, v]) => !v.ok);
      for (const t of plates) if (!check[t.id]?.ok) (t.avoid ??= []).push(m.name);
      testReport.machines[m.name] = { gpu: m.gpu, pictureCheck: check };
      if (bad.length) { console.log(`${m.name}: keeps off ${bad.map(([id, v]) => `${id} (${v.why})`).join(', ')}`); notes.push(`${m.name} did not render scene${bad.length > 1 ? 's' : ''} ${bad.map(([id]) => id).join(', ')}: ${[...new Set(bad.map(([, v]) => v.why))].join('; ')}.`); }
      else console.log(`${m.name}: draws every scene the same as this Mac`);
    }
    if (!pr.length) { console.log(`${m.name}: the probe returned nothing`); return; }
    const order = plates.filter((t) => m.est.has(t.id) && !t.avoid?.includes(m.name)).sort((a, b) => m.est.get(b.id) - m.est.get(a.id));
    if (!order.length) { m.dead = true; notes.push(`${m.name} could not draw any of the scenes to render.`); return; }
    const slowSeg = bySeg(order[0]);
    // one second from the middle of the slowest scene, k at a time
    const test = async (k, tag) => {
      const rs = await Promise.all(Array.from({ length: k }, (_, i) => {
        const at = Math.max(slowSeg.from, Math.min(slowSeg.to - 1, (slowSeg.from + slowSeg.to) / 2 - 0.5 - i * 0.25));
        const seg = { ...slowSeg, f0: Math.round(at * fps), f1: Math.round(at * fps) + fps };
        return w.run({ job: `test-${m.name}-${tag}${i}`, renderArgs: plateArgs(seg, fps, { draft: true, params: paramsOf(slowSeg) }), out: path.join(workDir, `test-${m.name}-${tag}${i}.mp4`), frames: fps, stallSec, retries: 0, log: (x) => console.log(`test on ${m.name}: ${x}`) });
      }));
      if (!rs.every((r) => r.ok)) return null;
      const ms = Array.from({ length: k }, (_, i) => readJson(path.join(workDir, `hb-test-${m.name}-${tag}${i}.json`))?.msPerFrame).filter(Boolean);
      return ms.length === k ? ms.reduce((a, b) => a + b, 0) / k : null;
    };
    console.log(`${m.name}: test render of the slowest scene, ${slowSeg.id} (${slowSeg.scene})`);
    const solo = await test(1, 'a');
    if (!solo) { notes.push(`The test render on ${m.name} failed; it was left out.`); m.dead = true; return; }
    // the probe times the GPU alone: on this Mac the read-back and encoding cost is added per frame;
    // another machine is scaled from this Mac's estimate by its measured speed on the same scene
    const overhead = Math.max(0, solo - m.est.get(slowSeg.id));
    m.overhead = overhead; m.scale = m.remote && localM?.est.size ? solo / m.est.get(slowSeg.id) : 1;
    if (m.remote && localM?.est.size) { const k = solo / m.est.get(slowSeg.id); for (const [id, v] of m.est) m.est.set(id, v * k); }
    else for (const [id, v] of m.est) m.est.set(id, v + overhead);
    const rates = [1000 / solo];
    const jobsOpt = +opt('jobs', 0);
    if (!m.remote && jobsOpt) { m.parallel = jobsOpt; m.slotFactor = 1; }
    else if (plates.length > 1) {
      const maxK = m.remote && m.freeVramMB ? Math.max(1, Math.floor(m.freeVramMB / 1200)) : 3;
      for (let k = 2; k <= Math.min(3, maxK); k++) {
        const ms = await test(k, `k${k}`);
        if (!ms) break;
        rates.push((k * 1000) / ms);
        if (rates[k - 1] < rates[k - 2] * 1.25) break;
      }
      const c = chooseParallel(rates);
      m.parallel = c.parallel; m.slotFactor = c.parallel / c.speedup;
    }
    testReport.machines[m.name] = { ...testReport.machines[m.name], gpu: m.gpu ?? 'this Mac', slowest: slowSeg.id, msPerFrame: Math.round(solo), readBackMs: Math.round(overhead), throughputByWorkers: rates.map((r) => +r.toFixed(2)), workers: m.parallel };
    console.log(`${m.name}: ${Math.round(solo)} ms/frame on the slowest scene; ${rates.map((r, i) => `${i + 1} worker${i ? 's' : ''} ${r.toFixed(2)} frames/s`).join(', ')}; using ${m.parallel}`);
  })();
  for (let i = workers.length - 1; i >= 0; i--) if (workers[i].machine.dead && workers[i].machine.remote) workers.splice(i, 1);
  if (!workers.length) { await restoreAll(); blocked('No machine passed its test render.'); }
  fs.writeFileSync(path.join(OUT, 'test-render.json'), JSON.stringify(testReport, null, 1) + '\n');
} else {
  // no test render (a draft, --no-test, or only lyric layers to do): lyric layers are light, so
  // each machine takes two at once (three on a GPU with room to spare)
  const jobsOpt = +opt('jobs', 0), layersOnly = !plates.length;
  for (const w of workers) {
    const m = w.machine;
    if (!m.remote) m.parallel = jobsOpt || (layersOnly ? 2 : 1);
    else if (layersOnly) m.parallel = m.freeVramMB && m.freeVramMB > 6000 ? 3 : 2;
  }
}

// --estimate: what each tier would cost on the machines just measured, then stop
if (flag('estimate')) {
  const mac = workers.find((w) => !w.machine.remote)?.machine;
  if (!mac?.probe?.size) blocked('--estimate needs this Mac in the render and the test render (not --draft, --no-test or --local-free runs).');
  const rows = [];
  for (const tr of TIERS) {
    const tfps = tr === 'fast' ? 30 : tr === 'premium' ? Math.max(60, film.fps ?? 60) : film.fps ?? 60;
    const tSamples = (sc) => {
      const base = tr === 'fast' ? 2 : tr === 'premium' ? Math.max(16, baseSamples * 2) : tr === 'ultra' ? Math.max(64, baseSamples * 4) : baseSamples;
      const own = sc.samples != null ? (tr === 'premium' ? Math.max(sc.samples, base) : tr === 'fast' ? Math.min(sc.samples, base) : sc.samples) : base;
      return tr === 'premium' && keys.isPremium(sc.scene) ? Math.max(32, own) : own;
    };
    const ttasks = scenes.map((sc, i) => {
      const h = handlesOf(i);
      return { id: sc.id, frames: Math.round((sc.to - sc.from + (h ? h[0] + h[1] : 0)) * tfps), weight: 0, smp: tSamples(sc) };
    });
    const perFrame = (m, t) => { const p = mac.probe.get(t.id) ?? [...mac.probe.values()][0]; return (p.fixedMs + p.perSampleMs * t.smp + (mac.overhead ?? 0)) * (m.scale ?? 1); };
    for (const t of ttasks) t.weight = t.frames * perFrame(mac, t);
    const tslots = workers.flatMap((w) => Array.from({ length: w.machine.parallel }, () => ({ machine: { ...w.machine, remote: w.machine.remote, slotFactor: w.machine.slotFactor ?? 1, msPerFrame: (t) => perFrame(w.machine, t) }, freeAt: 0 })));
    const secs = simulate(ttasks, tslots);
    rows.push({ tier: tr, fps: tfps, samples: [...new Set(ttasks.map((t) => t.smp))].join('/'), hours: +(secs / 3600).toFixed(2), seconds: Math.round(secs) });
  }
  console.log(`\nEstimated render time for the whole film on ${workers.map((w) => `${w.machine.name} x${w.machine.parallel}`).join(' + ')} (pictures only; joins and checks add minutes):`);
  for (const r of rows) console.log(`  ${r.tier.padEnd(9)} ${String(r.fps).padStart(3)} fps, ${r.samples} sub-frames: about ${fmtDuration(r.seconds)}`);
  fs.writeFileSync(path.join(OUT, 'tier-estimate.json'), JSON.stringify({ at: new Date().toISOString(), machines: testReport.machines, tiers: rows }, null, 1) + '\n');
  await restoreAll();
  process.exit(0);
}

// worker slots: each machine as many times as it takes workers
const slots = workers.flatMap((w) => Array.from({ length: w.machine.parallel }, (_, i) => ({ worker: w, machine: w.machine, name: `${w.machine.name}${w.machine.parallel > 1 ? '#' + (i + 1) : ''}`, freeAt: 0 })));
for (const t of tasks) t.weight = t.frames * ((workers.find((w) => !w.machine.remote) ?? workers[0]).machine.msPerFrame(t)) * (t.light ? 0.01 : 1);
const lightMs = 300;   // a lyric layer frame on this Mac, roughly
for (const t of tasks) if (t.light) t.est = lightMs;
const now = () => Date.now() / 1000;
const planned = simulate(tasks, slots);
if (plates.length && Number.isFinite(planned) && testReport.machines && Object.keys(testReport.machines).length)
  console.log(`${plates.length} scenes to render on ${slots.map((s) => s.name).join(', ')}: about ${fmtDuration(planned)}, finishing around ${new Date(Date.now() + planned * 1000).toLocaleTimeString()}`);

// ---------- render under the watchdog ----------
const progress = new Progress({
  file: path.join(OUT, 'progress.json'), total: segs.filter((s) => s.selected).length, cached: cachedCount,
  jobs: tasks.map((t) => ({ id: t.job, scene: t.scene, frames: t.frames, estMsPerFrame: t.light ? lightMs : workers[0].machine.msPerFrame(t) })),
  machines: Object.fromEntries(workers.map((w) => [w.machine.name, { workers: w.machine.parallel, gpu: w.machine.gpu ?? 'this Mac' }])),
  remaining: () => simulate(pending.filter((t) => !t.light), slots.map((s) => ({ ...s, freeAt: Math.max(now(), s.freeAt) })), now()),
});
const failed = new Set();
const pending = [...tasks];
let inflight = 0;
const waiters = [];
const changed = () => new Promise((r) => waiters.push(r));
const wake = () => { for (const r of waiters.splice(0)) r(); };

async function runTask(slot, t) {
  const m = slot.machine;
  console.log(`segment ${t.job} (${t.scene}) on ${slot.name}: ${t.frames} frames`);
  progress.start(t.job, slot.name);
  let dash = null, lastDash = 0;
  // a remote machine whose dashboard says hold off (paused, stopped, or a priority job running) gives
  // the scene back to be done elsewhere
  if (m.remote) {
    const hold = await m.yieldReason();
    if (hold) { progress.log(t.job, `${m.name}: ${hold}; leaving it to another machine`); m.heldUntil = Date.now() + 120000; pending.push(t); progress.requeue(t.job); if (!m.holdNoted) { notes.push(`${m.name} stepped aside while ${hold}.`); m.holdNoted = true; } return; }
  }
  if (m.remote) dash = await m.announce('start', { agent: 'Claude', origin_machine: 'mac-mini', tool: 'ark photoreal', description: `${path.basename(SONG)} scene ${t.id} (${t.scene})`, project: path.basename(SONG), expected_minutes: +(slotSeconds(slot, t) / 60).toFixed(1) });
  const log = (x) => { console.log(`segment ${t.job} on ${slot.name}: ${x}`); progress.log(t.job, `${slot.name}: ${x}`); if (/^retry/.test(x)) progress.start(t.job, slot.name); };
  const onFrame = (b) => {
    progress.frame(t.job, b.frame);
    if (dash?.id && Date.now() - lastDash > 30000) { lastDash = Date.now(); m.announce('progress', { id: dash.id, percent: +(100 * b.frame / t.frames).toFixed(1) }); }
  };
  const r = await slot.worker.run({ job: t.job, renderArgs: t.renderArgs, out: t.out, frames: t.frames, stallSec, retries, onFrame, log });
  if (dash?.id) m.announce('end', { id: dash.id, status: r.ok ? 'done' : 'failed', note: r.ok ? '' : r.reason });
  if (r.ok) { fs.writeFileSync(t.out + '.key', t.key); t.renderedOn = m.name; progress.finish(t.job, true); return; }
  // a scene that fails on another machine comes back to this Mac instead of failing the film
  if (m.remote && !t.movedHome) {
    progress.log(t.job, `failed on ${m.name} (${r.reason}); moving it to this Mac`);
    t.movedHome = true; t.localOnly = true; pending.push(t); progress.requeue(t.job);
    if (!(await m.available())) { m.dead = true; notes.push(`${m.name} dropped out during the render (${m.why}); its scenes moved to this Mac.`); }
    return;
  }
  failed.add(t.id); progress.log(t.job, `failed after ${r.attempts?.length ?? 1} attempts: ${r.reason}`);
  progress.finish(t.job, false, r.reason);
}

const slotLoop = async (slot) => {
  for (;;) {
    if (slot.machine.dead) return;
    if (slot.machine.heldUntil > Date.now()) { if (!pending.length && !inflight) return; await new Promise((r) => setTimeout(r, 15000)); continue; }
    const allowed = pending.filter((x) => !(x.localOnly && slot.machine.remote));
    let t = pickTask(slot, allowed, slots.filter((s) => !s.machine.dead && !(s.machine.heldUntil > Date.now())), now());
    if (!t) {
      if (!pending.length && !inflight) { wake(); return; }
      // nothing this slot should take while others work: wait for a scene to finish or come back;
      // with nothing running at all, take the biggest scene it may rather than leave it undone
      if (inflight) { await changed(); continue; }
      t = allowed.sort((a, b) => b.weight - a.weight)[0];
      if (!t) return;
    }
    pending.splice(pending.indexOf(t), 1);
    slot.freeAt = now() + slotSeconds(slot, t);
    inflight++;
    try { await runTask(slot, t); } finally { inflight--; slot.freeAt = now(); wake(); }
  }
};
const loops = slots.map(slotLoop);

// --add-local-when-free: a render started on other machines while this Mac's GPU is busy (another
// film rendering) brings this Mac in as soon as that finishes. On joining it measures itself, then
// checks the other machines' pictures against its own; a scene that doesn't match is rendered again
// here, even if it was already done.
if (flag('add-local-when-free') && !workers.some((w) => !w.machine.remote) && plates.length) loops.push((async () => {
  // another film or render on this Mac: a node (or caffeinate) process running film.mjs or
  // render.mjs that isn't this run or one of its ancestors
  const ancestors = new Set([process.pid]);
  for (let p = process.ppid; p > 1 && !ancestors.has(p);) { ancestors.add(p); p = +spawnSync('ps', ['-o', 'ppid=', '-p', String(p)], { encoding: 'utf8' }).stdout.trim() || 1; }
  const busy = () => (spawnSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' }).stdout ?? '').split('\n')
    .map((l) => l.trim().match(/^(\d+)\s+(\S*node|caffeinate)\b.*photoreal\/(film|render)\.mjs/)).filter(Boolean).some((m) => !ancestors.has(+m[1]));
  for (;;) {
    for (let i = 0; i < 12 && (pending.length || inflight); i++) await new Promise((r) => setTimeout(r, 5000));
    if (!pending.some((t) => !t.light) && !inflight) return;
    if (busy()) continue;
    const [mac] = loadMachines({ only: ['mac'] });
    const w = new Worker({ machine: mac, engineRoot: ENGINE, song: SONG, render: RENDER, workDir });
    mac.est = new Map(); mac.msPerFrame = (t) => mac.est.get(t.id) ?? 2000;
    const todo = plates.filter((t) => pending.includes(t));
    const bySeg = (t) => segs.find((x) => x.id === t.id);
    for (const p of probeOn(w, todo.map(bySeg))) mac.est.set(p.id, p.fixedMs + p.perSampleMs * +bySeg(p).samples);
    const slow = [...todo].sort((x, y) => (mac.est.get(y.id) ?? 0) - (mac.est.get(x.id) ?? 0))[0];
    if (slow) {
      const sg = bySeg(slow), at = Math.max(sg.from, (sg.from + sg.to) / 2 - 0.5);
      const r = await w.run({ job: 'join-test', renderArgs: plateArgs({ ...sg, f0: Math.round(at * fps), f1: Math.round(at * fps) + fps }, fps, { draft: true, params: paramsOf(sg) }), out: path.join(workDir, 'join-test.mp4'), frames: fps, stallSec, retries: 0, log: (x) => console.log(`mac joining: ${x}`) });
      const ms = readJson(path.join(workDir, 'hb-join-test.json'))?.msPerFrame;
      if (r.ok && ms) { const over = Math.max(0, ms - (mac.est.get(slow.id) ?? 0)); for (const [id, v] of mac.est) mac.est.set(id, v + over); }
    }
    // two workers: measured tonight on this Mac at 1.74x the throughput of one
    mac.parallel = +opt('jobs', 0) || 2; mac.slotFactor = mac.parallel === 2 ? 2 / 1.74 : 1;
    // picture check of the other machines against this Mac, now that it can draw references
    for (const rw of workers.filter((x) => x.machine.remote && !x.machine.dead)) {
      const check = await pictureCheck(rw, plates.map(bySeg));
      testReport.machines[rw.machine.name] = { ...testReport.machines[rw.machine.name], pictureCheck: check };
      for (const t of plates) {
        if (check[t.id]?.ok) continue;
        (t.avoid ??= []).push(rw.machine.name);
        if (t.renderedOn === rw.machine.name) {
          fs.rmSync(t.out + '.key', { force: true });
          t.renderedOn = null; pending.push(t); progress.requeue(t.job);
          notes.push(`Scene ${t.id} came out differently on ${rw.machine.name} (${check[t.id].why}) and was rendered again on this Mac.`);
        }
      }
    }
    fs.writeFileSync(path.join(OUT, 'test-render.json'), JSON.stringify(testReport, null, 1) + '\n');
    workers.push(w);
    const added = Array.from({ length: mac.parallel }, (_, i) => ({ worker: w, machine: mac, name: `mac${mac.parallel > 1 ? '#' + (i + 1) : ''}`, freeAt: now() }));
    slots.push(...added);
    if (progress.machines) progress.machines.mac = { workers: mac.parallel, gpu: 'this Mac' };
    console.log(`this Mac joined the render with ${mac.parallel} worker${mac.parallel > 1 ? 's' : ''}`);
    notes.push(`This Mac joined the render when its GPU came free.`);
    loops.push(...added.map(slotLoop));
    wake();
    return;
  }
})());
// new workers can join while this runs: wait until no more have
for (let n = -1; n !== loops.length;) { n = loops.length; await Promise.all(loops); }
for (const t of pending) { failed.add(t.id); progress.finish(t.job, false, 'no machine left to render it'); }

// the other machines' part is done: bring back anything stopped for it before finishing up here
await restoreAll();

// ---------- composite lyric layers over their pictures ----------
for (const s of segs) {
  if (!s.selected || !(s.layered || s.peopleOut) || failed.has(s.id) || cached(s.out, s.key)) continue;
  console.log(`composite ${s.id}: ${[s.peopleOut && 'people', s.layered && 'lyric layer'].filter(Boolean).join(' and ')} over the picture`);
  // picture, then the people, then the words
  const ins = [s.plateOut, ...(s.peopleOut ? [s.peopleOut] : []), ...(s.layered ? [s.layerOut] : [])];
  const chain = ['[0:v]scale=in_color_matrix=bt709:in_range=tv,format=gbrp[c0]'];
  ins.slice(1).forEach((_, i) => { chain.push(`[${i + 1}:v]format=gbrap[l${i}]`, `[c${i}][l${i}]overlay=format=gbrp:alpha=straight[c${i + 1}]`); });
  const graph = chain.join(';') + `;[c${ins.length - 1}]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p`;
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...ins.flatMap((f) => ['-i', f]), '-filter_complex',
    graph,
    '-c:v', 'libx264', '-preset', encode.preset, '-crf', encode.crf, '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', s.out], { stdio: 'inherit' });
  if (r.status !== 0) { failed.add(s.id); progress.log(s.id, 'composite failed'); continue; }
  fs.writeFileSync(s.out + '.key', s.key);
}

// ---------- join ----------
const elapsed = () => (Date.now() - started) / 1000;
const snap = progress.snapshot();
if (failed.size) {
  writeStatus(path.join(OUT, 'STATUS.md'), { song: SONG, state: 'blocked', snapshot: snap, notes, elapsed: elapsed() });
  console.error(`blocked: ${[...failed].join(', ')} failed; see ${path.join(OUT, 'STATUS.md')}`);
  process.exit(1);
}
if (only) {
  writeStatus(path.join(OUT, 'STATUS.md'), { song: SONG, state: 'done', snapshot: snap, notes: [`Only scenes ${only.join(', ')} were rendered; the film was not joined.`, ...notes], elapsed: elapsed() });
  process.exit(0);
}
const out = path.resolve(opt('out', path.join(OUT, draft ? 'film-draft.mp4' : tier === 'fast' ? 'film-fast.mp4' : 'film.mp4')));
const end = scenes[scenes.length - 1].to;
const audioIn = story ? buildMix(SONG, film).mix : path.join(SONG, 'media', 'song.wav');
let r;
if (!scenes.some((s) => s.transition)) {
  // plain cuts: the segments join without re-encoding
  const list = path.join(segDir, 'concat.txt');
  fs.writeFileSync(list, segs.map((s) => `file '${s.out.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-i', audioIn,
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-t', String(end), '-movflags', '+faststart', out], { stdio: 'inherit' });
} else {
  // transitions: each blend is centred on its cut, over the handles both scenes rendered past it
  const graph = [];
  let cur = '[v0]', len = segs[0].frames / fps;
  segs.forEach((s, i) => graph.push(`[${i}:v]settb=AVTB,setpts=PTS-STARTPTS,fps=${fps}[v${i}]`));
  for (let i = 1; i < segs.length; i++) {
    const tr = scenes[i].transition, next = `[j${i}]`;
    if (tr) {
      const d = tr.duration ?? 0.5;
      graph.push(`${cur}[v${i}]xfade=transition=${tr.type ?? 'fade'}:duration=${d}:offset=${(len - d).toFixed(6)}${next}`);
      len += segs[i].frames / fps - d;
    } else {
      graph.push(`${cur}[v${i}]concat=n=2:v=1:a=0${next}`);
      len += segs[i].frames / fps;
    }
    cur = next;
  }
  r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...segs.flatMap((s) => ['-i', s.out]), '-i', audioIn,
    '-filter_complex', graph.join(';'), '-map', cur, '-map', `${segs.length}:a`, '-c:v', 'libx264', '-preset', encode.preset, '-crf', encode.crf, '-pix_fmt', 'yuv420p',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-c:a', 'aac', '-b:a', '320k', '-t', String(end), '-movflags', '+faststart', out], { stdio: 'inherit' });
}
if (r.status !== 0) {
  writeStatus(path.join(OUT, 'STATUS.md'), { song: SONG, state: 'blocked', snapshot: snap, notes: ['Every scene rendered, but joining them into the film failed.', ...notes], elapsed: elapsed() });
  throw Error('join failed');
}
// what the film was made from, so reviews can tell whether they are looking at the current film
fs.writeFileSync(out.replace(/\.mp4$/, '') + '.content.json', JSON.stringify(Object.fromEntries(segs.map((s) => [s.id, s.content])), null, 1) + '\n');
writeStatus(path.join(OUT, 'STATUS.md'), { song: SONG, state: 'done', output: out, snapshot: snap, notes: [draft ? 'This is the draft. Next: node photoreal/check.mjs --label draft.' : 'Next: node photoreal/check.mjs --label final, then node photoreal/critic.mjs film.', ...notes], elapsed: elapsed() });
console.log('wrote', out);
