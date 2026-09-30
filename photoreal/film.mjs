// Render a whole film from a song's film.json, one cached segment per scene, then join them and
// lay the song under the picture.
//   node photoreal/film.mjs --song ../genesis8-the-dove --draft          fast draft for the pre-render check
//   node photoreal/film.mjs --song ../genesis8-the-dove --stills         the five key stills, for review
//   node photoreal/film.mjs --song ../genesis8-the-dove                  the full film
//   options: [--only 01,02] [--samples 12] [--jobs N] [--stall 180] [--retries 2] [--no-test] [--out film.mp4]
//            [--skip-storyboard] [--skip-stills] [--skip-check]   (each is written into STATUS.md)
// film.json: { "fps": 60, "samples": 12, "scenes": [{ "id": "01", "scene": "sea", "from": 0, "to": 15.5, "params": {}, "samples"?: 16, "offBeat"?: "why" }] }
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

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RENDER = path.join(HERE, 'render.mjs');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes('--' + k);
const SONG = path.resolve(opt('song', '.'));
const film = JSON.parse(fs.readFileSync(path.join(SONG, 'film.json'), 'utf8'));
const fps = film.fps ?? 60;
const draft = flag('draft');
const samples = opt('samples', draft ? '2' : String(film.samples ?? 12));
const only = opt('only')?.split(',');
const OUT = path.join(SONG, 'out');
const REVIEW = path.join(OUT, 'review');
const segDir = path.join(OUT, draft ? 'segments-draft' : 'segments');
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

const keys = makeKeys(SONG);
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const cached = (file, key) => key && fs.existsSync(file) && fs.existsSync(file + '.key') && fs.readFileSync(file + '.key', 'utf8') === key;
const paramsOf = (s) => JSON.stringify({ ...(s.params ?? {}), id: s.id, from: s.from, to: s.to });

const segs = scenes.map((s) => {
  const f0 = Math.round(s.from * fps), f1 = Math.round(s.to * fps);
  const sSamples = draft ? samples : String(s.samples ?? samples);   // a scene may ask for more sub-frames (fast wings)
  const layered = keys.hasLayer(s.scene);
  const out = path.join(segDir, `${s.id}.mp4`);
  const seg = { ...s, f0, f1, frames: f1 - f0, samples: sSamples, layered, out, content: keys.content(s, fps) };
  if (layered) {
    seg.plateOut = path.join(segDir, `${s.id}.plate.mp4`);
    seg.layerOut = path.join(segDir, `${s.id}.lyric.mkv`);
    seg.plateKey = keys.plate(s, fps, sSamples);
    seg.layerKey = keys.layer(s, fps, draft ? 2 : 8);
    seg.key = sha(seg.plateKey + seg.layerKey);
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
  const dir = path.join(OUT, 'keystills');
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const shots = [];
  for (const p of picks) {
    const s = segs.find((x) => x.id === p.sceneId);
    const tmp = path.join(workDir, 'stills');
    fs.rmSync(tmp, { recursive: true, force: true });
    const r = spawnSync('node', [RENDER, 'stills', '--song', SONG, '--scene', s.scene, '--params', paramsOf(s), '--t', String(p.time), '--samples', s.samples, '--out', tmp], { stdio: 'inherit' });
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
const full = !draft && !only;
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
  if (!cached(s.plateOut, s.plateKey)) {
    any = true;
    tasks.push({ id: s.id, job: s.id, part: 'plate', scene: s.scene, frames: s.frames, out: s.plateOut, key: s.plateKey,
      renderArgs: plateArgs(s, fps, { draft, crf: opt('crf', '18'), params: paramsOf(s) }) });
  }
  if (s.layered && !cached(s.layerOut, s.layerKey)) {
    any = true;
    // lyric layers are light and stay on this Mac
    tasks.push({ id: s.id, job: `${s.id}-lyric`, part: 'layer', scene: s.scene, frames: s.frames, out: s.layerOut, key: s.layerKey, light: true, localOnly: true,
      args: [RENDER, 'layer', ...common, '--samples', draft ? '2' : '8', '--out', s.layerOut] });
  }
  if (!any && !(s.layered && !cached(s.out, s.key))) { console.log(`segment ${s.id} cached`); cachedCount++; }
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
  if (m.remote && !plates.length) continue;
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
if (!workers.some((w) => !w.machine.remote) && tasks.some((t) => t.localOnly)) { await restoreAll(); blocked('Lyric layers render on this Mac, which was left out (--machines).'); }

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
  const jobsOpt = +opt('jobs', 0);
  for (const w of workers) if (!w.machine.remote) w.machine.parallel = jobsOpt || 1;
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
  if (m.remote) dash = await m.announce('start', { agent: 'Claude', origin_machine: 'mac-mini', tool: 'ark photoreal', description: `${path.basename(SONG)} scene ${t.id} (${t.scene})`, project: path.basename(SONG), expected_minutes: +(slotSeconds(slot, t) / 60).toFixed(1) });
  const log = (x) => { console.log(`segment ${t.job} on ${slot.name}: ${x}`); progress.log(t.job, `${slot.name}: ${x}`); if (/^retry/.test(x)) progress.start(t.job, slot.name); };
  const onFrame = (b) => {
    progress.frame(t.job, b.frame);
    if (dash?.id && Date.now() - lastDash > 30000) { lastDash = Date.now(); m.announce('progress', { id: dash.id, percent: +(100 * b.frame / t.frames).toFixed(1) }); }
  };
  const r = t.light
    ? await runWithWatchdog({ cmd: 'node', args: [...t.args, '--heartbeat', path.join(workDir, `hb-${t.job}.json`)], heartbeat: path.join(workDir, `hb-${t.job}.json`), stallSec, retries, onFrame, log })
    : await slot.worker.run({ job: t.job, renderArgs: t.renderArgs, out: t.out, frames: t.frames, stallSec, retries, onFrame, log });
  if (dash?.id) m.announce('end', { id: dash.id, status: r.ok ? 'done' : 'failed', note: r.ok ? '' : r.reason });
  if (r.ok) { fs.writeFileSync(t.out + '.key', t.key); progress.finish(t.job, true); return; }
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

await Promise.all(slots.map(async (slot) => {
  for (;;) {
    if (slot.machine.dead) return;
    const allowed = pending.filter((x) => !(x.localOnly && slot.machine.remote));
    let t = pickTask(slot, allowed, slots.filter((s) => !s.machine.dead), now());
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
}));
for (const t of pending) { failed.add(t.id); progress.finish(t.job, false, 'no machine left to render it'); }

// the other machines' part is done: bring back anything stopped for it before finishing up here
await restoreAll();

// ---------- composite lyric layers over their pictures ----------
for (const s of segs) {
  if (!s.selected || !s.layered || failed.has(s.id) || cached(s.out, s.key)) continue;
  console.log(`composite ${s.id}: lyric layer over the picture`);
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', s.plateOut, '-i', s.layerOut, '-filter_complex',
    '[0:v]scale=in_color_matrix=bt709:in_range=tv,format=gbrp[p];[1:v]format=gbrap[l];[p][l]overlay=format=gbrp:alpha=straight,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', draft ? 'veryfast' : 'slow', '-crf', opt('crf', '18'), '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', s.out], { stdio: 'inherit' });
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
const list = path.join(segDir, 'concat.txt');
fs.writeFileSync(list, segs.map((s) => `file '${s.out.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
const out = path.resolve(opt('out', path.join(OUT, draft ? 'film-draft.mp4' : 'film.mp4')));
const end = scenes[scenes.length - 1].to;
const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-i', path.join(SONG, 'media', 'song.wav'),
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-t', String(end), '-movflags', '+faststart', out], { stdio: 'inherit' });
if (r.status !== 0) {
  writeStatus(path.join(OUT, 'STATUS.md'), { song: SONG, state: 'blocked', snapshot: snap, notes: ['Every scene rendered, but joining them into the film failed.', ...notes], elapsed: elapsed() });
  throw Error('join failed');
}
// what the film was made from, so reviews can tell whether they are looking at the current film
fs.writeFileSync(out.replace(/\.mp4$/, '') + '.content.json', JSON.stringify(Object.fromEntries(segs.map((s) => [s.id, s.content])), null, 1) + '\n');
writeStatus(path.join(OUT, 'STATUS.md'), { song: SONG, state: 'done', output: out, snapshot: snap, notes: [draft ? 'This is the draft. Next: node photoreal/check.mjs --label draft.' : 'Next: node photoreal/check.mjs --label final, then node photoreal/critic.mjs film.', ...notes], elapsed: elapsed() });
console.log('wrote', out);
