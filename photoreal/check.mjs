// The measured gates, run on an encoded film: before the full render on the draft, and on the
// finished film before the critic's final review.
//   node photoreal/check.mjs --song ../genesis9 --label draft     (reads out/film-draft.mp4)
//   node photoreal/check.mjs --song ../genesis9 --label final     (reads out/film.mp4)
//   options: --video <file>  --no-ocr (motion and cut gates only)
// Gates (thresholds can be overridden in film.json under "gates"):
//   contrast      every lyric word at least 4.5:1 against what is actually behind it, once sung
//   collision     no words run together, overlap or crowd each other; no lines on top of each other
//   still         no stretch longer than 0.5 s with nothing visibly moving
//   dead-stop     no fast move that slams into a dead stop
//   settle        no word moving before it has sat still for 8 frames
//   cut-beat      every cut on the beat or up to 2 frames before it (a scene can set "offBeat": "why")
// Writes out/review/check-<label>.json, which the full render and the critic read.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEFAULTS, luminance, wordContrast, stillStretches, deadStops, cutsOffBeat, wordChecks, findWord, collisions, sceneAt, summarize } from './lib/measure.mjs';
import { makeKeys } from './lib/keys.mjs';
import { fmtTime } from './lib/storyboard.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const SONG = path.resolve(opt('song', '.'));
const label = opt('label', 'final');
const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(SONG, f), 'utf8')); } catch { return null; } };
const film = read('film.json'), lyrics = read('data/lyrics.json') ?? { lines: [], words: [] }, audio = read('data/audio.json');
const G = { ...DEFAULTS, ...(film?.gates ?? {}) };
const video = path.resolve(SONG, opt('video', label === 'draft' ? 'out/film-draft.mp4' : 'out/film.mp4'));
if (!fs.existsSync(video)) { console.error(`no film at ${video}`); process.exit(1); }
const REVIEW = path.join(SONG, 'out', 'review');
const work = path.join(SONG, 'out', 'work', `check-${label}`);
fs.rmSync(work, { recursive: true, force: true }); fs.mkdirSync(work, { recursive: true }); fs.mkdirSync(REVIEW, { recursive: true });

const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=r_frame_rate,nb_read_packets,width,height:format=duration', '-of', 'json', video], { encoding: 'utf8' }));
const [fn, fd] = probe.streams[0].r_frame_rate.split('/').map(Number);
const fps = fn / fd, W = probe.streams[0].width, H = probe.streams[0].height;
const duration = +probe.format.duration, nFrames = +probe.streams[0].nb_read_packets;
const scenes = film?.scenes ?? [];
const problems = [];
const at = (frame) => ({ time: fmtTime(frame / fps), frame, scene: sceneAt(scenes, frame / fps) ?? null });
const add = (gate, severity, frame, detail, fix) => problems.push({ gate, severity, ...at(frame), detail, fix });

// ---------- motion: one pass over a small grey proxy ----------
console.log(`motion: decoding ${nFrames} frames`);
const PW = 96, PH = 54, N = PW * PH;
const mad = await new Promise((resolve, reject) => {
  const out = []; let prev = null, carry = Buffer.alloc(0);
  const p = spawn('ffmpeg', ['-loglevel', 'error', '-i', video, '-vf', `scale=${PW}:${PH}:flags=area,format=gray`, '-f', 'rawvideo', '-']);
  p.stdout.on('data', (d) => {
    carry = Buffer.concat([carry, d]);
    while (carry.length >= N) {
      const f = carry.subarray(0, N);
      if (!prev) out.push(Infinity);
      else { let s = 0; for (let i = 0; i < N; i++) s += Math.abs(f[i] - prev[i]); out.push(s / N); }
      prev = Buffer.from(f); carry = carry.subarray(N);
    }
  });
  p.on('close', (c) => (c === 0 ? resolve(out) : reject(Error('ffmpeg motion pass failed'))));
});
const cutFrames = scenes.slice(1).map((s) => Math.round(s.from * fps));
for (const s of stillStretches(mad, fps, G)) add('still', 'fail', s.startFrame, `nothing visibly moves for ${s.seconds} s (${fmtTime(s.from)} to ${fmtTime(s.to)})`, 'keep something alive through the hold: a slow push, drifting light or breathing type');
for (const s of deadStops(mad, fps, { ...G, cutFrames })) add('dead-stop', 'fail', s.frame, `a fast move (${s.before} mean change per frame) stops dead within 2 frames (${s.after})`, 'ease the move into its landing over at least 0.3 s instead of stopping it');

// ---------- cuts against the measured beats ----------
if (audio?.beats?.length && scenes.length > 1) {
  for (const c of cutsOffBeat(scenes, audio.beats, fps, G)) add('cut-beat', 'fail', Math.round(c.cut * fps), `the cut into scene ${c.id} is ${Math.abs(c.offFrames)} frame${Math.abs(c.offFrames) === 1 ? '' : 's'} ${c.offFrames > 0 ? 'after' : 'before'} the beat at ${fmtTime(c.beat)}`, `move the cut to ${c.target.toFixed(3)} s (the beat) or up to ${G.cutEarlyFrames} frames earlier, or give the scene "offBeat": "<reason>" if it follows the voice on purpose`);
}

// ---------- lyric words: contrast, collisions, settling ----------
if (!argv.includes('--no-ocr') && lyrics.words?.length) {
  const swift = path.join(HERE, 'lib', 'ocr-words.swift');
  const bin = path.join(SONG, 'out', 'work', `ocr-words-${crypto.createHash('sha256').update(fs.readFileSync(swift)).digest('hex').slice(0, 12)}`);
  if (!fs.existsSync(bin)) execFileSync('swiftc', ['-O', swift, '-o', bin, '-framework', 'Vision', '-framework', 'ImageIO'], { stdio: 'inherit' });
  const { createCanvas, loadImage } = await import('@napi-rs/canvas');
  const checks = wordChecks(lyrics, fps, duration, G).filter((c) => c.f1 < nFrames);
  const wanted = [...new Set(checks.flatMap((c) => [c.f1, c.f2]))].filter((f) => f < nFrames).sort((a, b) => a - b);
  console.log(`words: ${checks.length} words, ${wanted.length} frames to read`);
  const ocr = new Map();   // frame -> recognised frame
  const pixels = new Map();
  const BATCH = 60;
  for (let b = 0; b < wanted.length; b += BATCH) {
    const fr = wanted.slice(b, b + BATCH), a = fr[0];
    const dir = path.join(work, `b${b}`); fs.mkdirSync(dir);
    const sel = fr.map((f) => `eq(n\\,${f - a})`).join('+');
    const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-ss', String(a / fps), '-i', video, '-t', String((fr.at(-1) - a + 2) / fps), '-vf', `select='${sel}'`, '-fps_mode', 'passthrough', path.join(dir, '%04d.png')]);
    if (r.status !== 0) throw Error('frame extraction failed');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort().map((f) => path.join(dir, f));
    fs.writeFileSync(path.join(dir, 'in.json'), JSON.stringify(files));
    const res = JSON.parse(execFileSync(bin, [path.join(dir, 'in.json')], { maxBuffer: 256 << 20 }));
    for (let i = 0; i < files.length && i < fr.length; i++) {
      ocr.set(fr[i], res[i]);
      // luminance of the frame, kept only for frames a contrast check needs
      if (checks.some((c) => c.f1 === fr[i])) {
        const img = await loadImage(files[i]);
        const cv = createCanvas(img.width, img.height), cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
        const d = cx.getImageData(0, 0, img.width, img.height).data;
        const L = new Float32Array(img.width * img.height);
        for (let p = 0, q = 0; p < L.length; p++, q += 4) L[p] = luminance(d[q], d[q + 1], d[q + 2]);
        pixels.set(fr[i], L);
      }
    }
    fs.rmSync(dir, { recursive: true, force: true });
    // judge the words whose frames are all read, then drop their pixels
    for (const c of checks.filter((c) => !c.done && ocr.has(c.f1) && (ocr.has(c.f2) || c.f2 >= nFrames))) {
      c.done = true;
      const o1 = ocr.get(c.f1), hit = findWord(o1, c.word);
      if (!hit) { add('contrast', 'fail', c.f1, `"${c.word}" cannot be read ${((c.f1 / fps) - c.end).toFixed(2)} s after it is sung (missing, too faint or broken up)`, 'check the word is on screen by then; if it is, raise its contrast or size'); continue; }
      const bx = hit.box, L = pixels.get(c.f1);
      if (L) {
        const pad = 0.12 * bx.h;
        const x0 = Math.max(0, Math.floor((bx.x - pad) * W)), x1 = Math.min(W, Math.ceil((bx.x + bx.w + pad) * W));
        const y0 = Math.max(0, Math.floor((bx.y - pad) * H)), y1 = Math.min(H, Math.ceil((bx.y + bx.h + pad) * H));
        const vals = []; const step = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 20000)));
        for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) vals.push(L[y * W + x]);
        const cr = wordContrast(vals);
        if (cr.ratio < G.minContrast) add('contrast', 'fail', c.f1, `"${c.word}" is ${cr.ratio.toFixed(2)}:1 against what is behind it (${cr.ink} ink); needs ${G.minContrast}:1`, cr.ink === 'light' ? 'darken or blur what passes behind the word, strengthen its shade, or move it onto a quieter part of the frame' : 'lighten what is behind the word or switch to light ink here');
      }
      for (const k of collisions(o1, c.onScreen, G)) {
        const key = `${c.f1}:${k.kind}:${k.text}`;
        if (problems.some((p) => p.key === key)) continue;
        add('collision', k.kind === 'tight' ? 'warn' : 'fail', c.f1, k.kind === 'run-together' ? `"${k.text}" reads as one word` : k.kind === 'overlap' ? `"${k.text}" overlap each other` : k.kind === 'tight' ? `"${k.text}" are crowded (gap ${k.gap} of the letter height)` : `two lines sit on top of each other: ${k.text}`, 'open the word spacing or move the lines apart');
        problems.at(-1).key = key;
      }
      if (c.f2 < nFrames) {
        const hit2 = findWord(ocr.get(c.f2), c.word, bx);
        if (hit2) {
          const dx = (hit2.box.x + hit2.box.w / 2 - (bx.x + bx.w / 2)) * W, dy = (hit2.box.y + hit2.box.h / 2 - (bx.y + bx.h / 2)) * H;
          const moved = Math.hypot(dx, dy) / (bx.h * H);
          if (moved > G.moveTolerance) add('settle', 'fail', c.f1, `"${c.word}" moves ${moved.toFixed(2)}× its own height within ${G.settleFrames} frames of arriving`, `hold it still for at least ${G.settleFrames} frames before it moves`);
        }
      }
    }
    for (const f of [...pixels.keys()]) if (!checks.some((c) => !c.done && c.f1 === f)) pixels.delete(f);
  }
}

problems.sort((a, b) => a.frame - b.frame);
for (const p of problems) delete p.key;
const summary = summarize(problems);
const keys = makeKeys(SONG);
const h = crypto.createHash('sha256'); { const fdv = fs.openSync(video, 'r'); const buf = Buffer.alloc(1 << 22); let n; while ((n = fs.readSync(fdv, buf, 0, buf.length)) > 0) h.update(buf.subarray(0, n)); fs.closeSync(fdv); }
const report = {
  label, video: path.relative(SONG, video), videoSha: h.digest('hex'), at: new Date().toISOString(), fps, frames: nFrames, duration,
  // what the film was made from (written by film.mjs when it joined it), so the full render can tell
  // whether this check still describes the current scenes
  thresholds: G, content: read(path.relative(SONG, video.replace(/\.mp4$/, '') + '.content.json')) ?? Object.fromEntries(scenes.map((s) => [s.id, keys.content(s, film.fps ?? 60)])),
  summary, problems,
};
const outFile = path.join(REVIEW, `check-${label}.json`);
fs.writeFileSync(outFile, JSON.stringify(report, null, 1) + '\n');
fs.rmSync(work, { recursive: true, force: true });
console.log(`\n${summary.passed ? 'PASSED' : 'FAILED'}: ${summary.fails} failures, ${summary.warns} warnings (${outFile})`);
for (const [g, n] of Object.entries(summary.byGate)) console.log(`  ${g}: ${n.fail} fail, ${n.warn} warn`);
for (const p of problems.filter((p) => p.severity === 'fail').slice(0, 15)) console.log(`  ${p.time} [${p.scene ?? '-'}] ${p.gate}: ${p.detail}`);
process.exit(summary.passed ? 0 : 1);
