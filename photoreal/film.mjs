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
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeKeys } from './lib/keys.mjs';
import { runWithWatchdog } from './lib/watchdog.mjs';
import { Progress, writeStatus, fmtDuration } from './lib/progress.mjs';
import { pickKeyStills } from './lib/stills.mjs';
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
    fs.renameSync(path.join(tmp, fs.readdirSync(tmp)[0]), f);
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
    tasks.push({ id: s.id, part: 'plate', scene: s.scene, frames: s.frames, out: s.plateOut, key: s.plateKey,
      args: [RENDER, 'video', ...common, '--samples', s.samples, '--noaudio', '--preset', draft ? 'veryfast' : 'slow', '--crf', opt('crf', '18'), '--out', s.plateOut] });
  }
  if (s.layered && !cached(s.layerOut, s.layerKey)) {
    any = true;
    tasks.push({ id: s.id, part: 'layer', scene: s.scene, frames: s.frames, out: s.layerOut, key: s.layerKey, light: true,
      args: [RENDER, 'layer', ...common, '--samples', draft ? '2' : '8', '--out', s.layerOut] });
  }
  if (!any && !(s.layered && !cached(s.out, s.key))) { console.log(`segment ${s.id} cached`); cachedCount++; }
}

// ---------- test render: timing and parallelism ----------
let jobs = +opt('jobs', 0) || 1, speedup = 1;
const est = new Map();   // task id -> estimated ms per frame
const plates = tasks.filter((t) => t.part === 'plate');
if (plates.length) {
  const pr = draft || flag('no-test') ? [] : probe(plates.map((t) => segs.find((s) => s.id === t.id)));
  for (const p of pr) { const s = segs.find((x) => x.id === p.id); est.set(p.id, p.fixedMs + p.perSampleMs * +s.samples); }
  if (pr.length) {
    const order = [...plates].filter((t) => est.has(t.id)).sort((a, b) => est.get(b.id) - est.get(a.id));
    const slow = order[0], s = segs.find((x) => x.id === slow.id);
    const testRun = (seg, at, tag) => {
      const hb = path.join(workDir, `test-${tag}.json`);
      const from = Math.max(seg.from, Math.min(seg.to - 1, at));
      return runWithWatchdog({ cmd: 'node', heartbeat: hb, stallSec, retries: 0, log: (m) => console.log(`test ${seg.id}: ${m}`),
        args: [RENDER, 'video', '--song', SONG, '--scene', seg.scene, '--params', paramsOf(seg), '--from', String(from), '--to', String(from + 1), '--samples', seg.samples, '--noaudio', '--preset', 'veryfast', '--out', path.join(workDir, `test-${tag}.mp4`), '--heartbeat', hb] });
    };
    console.log(`test render: 1 s of the slowest scene, ${slow.id} (${slow.scene}), estimated ${Math.round(est.get(slow.id))} ms/frame`);
    const t0 = Date.now();
    const solo = await testRun(s, (s.from + s.to) / 2 - 0.5, 'a');
    const soloSec = (Date.now() - t0) / 1000;
    if (!solo.ok) notes.push(`The test render of scene ${slow.id} failed (${solo.reason}); the full run will retry it under the watchdog.`);
    else {
      // the heartbeat holds the worker's own ms/frame, without Chrome start-up
      const hb = readJson(path.join(workDir, 'test-a.json'));
      const k = (hb?.msPerFrame ?? (soloSec * 1000) / fps) / est.get(slow.id);
      for (const [id, v] of est) est.set(id, v * k);
      console.log(`measured ${hb?.msPerFrame} ms/frame (${k.toFixed(2)}× the estimate)`);
      if (!+opt('jobs', 0) && plates.length > 1) {
        const second = segs.find((x) => x.id === (order[1] ?? slow).id);
        const t1 = Date.now();
        const pair = await Promise.all([testRun(s, (s.from + s.to) / 2 - 0.5, 'b'), testRun(second, (second.from + second.to) / 2 - 0.5, 'c')]);
        const pairSec = (Date.now() - t1) / 1000;
        const soloRate = fps / soloSec, pairRate = (2 * fps) / pairSec;
        speedup = pair.every((r) => r.ok) ? pairRate / soloRate : 1;
        jobs = speedup >= 1.3 ? 2 : 1;
        console.log(`two workers at once: ${speedup.toFixed(2)}× the throughput of one, so ${jobs} worker${jobs > 1 ? 's' : ''}`);
      }
    }
    fs.writeFileSync(path.join(OUT, 'test-render.json'), JSON.stringify({ at: new Date().toISOString(), slowest: slow.id, jobs, speedup: +speedup.toFixed(2), estMsPerFrame: Object.fromEntries([...est].map(([k, v]) => [k, Math.round(v)])) }, null, 1) + '\n');
  }
  if (jobs === 1) speedup = 1;
  const totalMs = plates.reduce((a, t) => a + t.frames * (est.get(t.id) ?? 0), 0) / speedup;
  if (est.size) console.log(`${plates.length} scenes to render, about ${fmtDuration(totalMs / 1000)} with ${jobs} worker${jobs > 1 ? 's' : ''}; finishing around ${new Date(Date.now() + totalMs).toLocaleTimeString()}`);
}

// ---------- render under the watchdog ----------
const progress = new Progress({
  file: path.join(OUT, 'progress.json'), total: segs.filter((s) => s.selected).length, cached: cachedCount, speedup,
  jobs: tasks.map((t) => ({ id: `${t.id}${t.part === 'layer' ? '-lyric' : ''}`, scene: t.scene, frames: t.frames, estMsPerFrame: t.part === 'plate' ? est.get(t.id) : (est.size ? 5 : undefined) })),
});
const failed = new Set();
async function runTask(t) {
  const pid = `${t.id}${t.part === 'layer' ? '-lyric' : ''}`;
  const hb = path.join(workDir, `hb-${pid}.json`);
  console.log(`segment ${pid} (${t.scene}): ${t.frames} frames`);
  progress.start(pid);
  const r = await runWithWatchdog({
    cmd: 'node', args: [...t.args, '--heartbeat', hb], heartbeat: hb, stallSec, retries,
    onFrame: (b) => progress.frame(pid, b.frame),
    log: (m) => { console.log(`segment ${pid}: ${m}`); progress.log(pid, m); if (/^retry/.test(m)) progress.start(pid); },
  });
  if (r.ok) fs.writeFileSync(t.out + '.key', t.key);
  else { failed.add(t.id); progress.log(pid, `failed after ${r.attempts.length} attempts: ${r.reason}`); }
  progress.finish(pid, r.ok, r.reason);
}
// heavy scenes through the worker pool, lyric layers after them (they are light)
const queue = [...tasks.filter((t) => !t.light), ...tasks.filter((t) => t.light)];
await Promise.all(Array.from({ length: Math.min(jobs, queue.length) || 0 }, async () => { while (queue.length) await runTask(queue.shift()); }));

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
