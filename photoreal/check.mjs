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
//   shake         no shaking frame unless the scene opts in with "shake": "<the violent moment>"
//                 (read from the scene source; see lib/shake.mjs)
//   in-scene      lyrics are drawn in the scene, not laid over it: a scene with a lyric layer needs
//                 "overlay": "<why>" (fails at premium, warns at other tiers; see lib/inscene.mjs)
//   shot-length   a shot over 8 s warns unless its scene gives "hold": "<why>" (a long camera move
//                 through one world is allowed; set gates.maxShotSeconds to make it fail)
//   live          no stretch over 1.5 s where only the camera moves (a still pushed, panned or
//                 breathing): something in the world must move on its own, or show parallax; a
//                 scene can give "cameraOnly": "<why>" (see lib/live.mjs)
//   rest-to-rest  warns when a shot's camera starts and ends at a standstill, so the cut joins two
//                 stopped cameras; a scene can give "rest": "<why>" (read from the scene's camera)
// A narrated story film ("mode": "story") is judged on its voice instead of a beat and a lyric:
//   spoken-text   the encoded film's audio, transcribed locally, says the script exactly
//   audio-sync    the encoded audio lines up with the narration mix it was made from
//   voice-music   during every spoken word the voice sits well above the music
//   events        every story beat happens inside the scene that claims it, in story order
//   cut-word      no cut lands in the middle of a spoken word (a scene can set "midWord": "why")
//   and the text gates (contrast, collision, settle) only for the phrases in story.onScreen
// Writes out/review/check-<label>.json, which the full render and the critic read.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { shots, DEFAULTS, luminance, wordContrast, stillStretches, deadStops, cutsOffBeat, wordChecks, findWord, collisions, sceneAt, summarize } from './lib/measure.mjs';
import { makeKeys } from './lib/keys.mjs';
import { LIVE_DEFAULTS, liveResidual, cameraOnlyStretches, restToRest } from './lib/live.mjs';
import { fmtTime } from './lib/storyboard.mjs';
import { shakeReview } from './lib/shake.mjs';
import { inSceneReview } from './lib/inscene.mjs';
import { resolveTier } from './lib/tier.mjs';
import { isStory, storyConfig, STORY_GATES, onScreenLyrics, cutsInsideWords, eventProblems, voiceOverMusic, bestLag } from './lib/story.mjs';
import { hear, decode, mixPaths, mixKey, RATE } from './lib/story-audio.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const SONG = path.resolve(opt('song', '.'));
const label = opt('label', 'final');
const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(SONG, f), 'utf8')); } catch { return null; } };
const film = read('film.json'), lyrics = read('data/lyrics.json') ?? { lines: [], words: [] }, audio = read('data/audio.json');
// premium and ultra (the default) let words sit close in a designed layout; every word must still read
const tier = resolveTier(SONG, film, opt('tier')).tier;
const story = isStory(film);
const G = { ...DEFAULTS, ...LIVE_DEFAULTS, ...(story ? STORY_GATES : {}), maxShotSeconds: Infinity, longShotWarn: 8, ...(film?.gates ?? {}) };
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
let syncReport = null, balanceReport = null, spokenReport = null;
const at = (frame) => ({ time: fmtTime(frame / fps), frame, scene: sceneAt(scenes, frame / fps) ?? null });
const add = (gate, severity, frame, detail, fix) => problems.push({ gate, severity, ...at(frame), detail, fix });

// ---------- motion: one pass over a small grey proxy ----------
console.log(`motion: decoding ${nFrames} frames`);
const PW = 96, PH = 54, N = PW * PH, TX = 8, TY = 6, LAG = Math.max(1, Math.round(fps / 4));
// mad[i]: mean change from the previous frame, for dead stops. motion[i]: the largest change in any
// of 8x6 tiles over the last quarter second, for stills: slow drift and a single word arriving both
// count as movement, film grain does not.
const { mad, motion } = await new Promise((resolve, reject) => {
  const mad = [], motion = [], ring = []; let carry = Buffer.alloc(0);
  const p = spawn('ffmpeg', ['-loglevel', 'error', '-i', video, '-vf', `scale=${PW}:${PH}:flags=area,format=gray`, '-f', 'rawvideo', '-']);
  p.stdout.on('data', (d) => {
    carry = Buffer.concat([carry, d]);
    while (carry.length >= N) {
      const f = Buffer.from(carry.subarray(0, N)); carry = carry.subarray(N);
      const prev = ring[ring.length - 1], old = ring.length >= LAG ? ring[ring.length - LAG] : null;
      if (!prev) mad.push(Infinity);
      else { let s = 0; for (let i = 0; i < N; i++) s += Math.abs(f[i] - prev[i]); mad.push(s / N); }
      if (!old) motion.push(Infinity);
      else {
        const t = new Float64Array(TX * TY);
        for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) t[Math.floor(y * TY / PH) * TX + Math.floor(x * TX / PW)] += Math.abs(f[y * PW + x] - old[y * PW + x]);
        motion.push(Math.max(...t) / (N / (TX * TY)));
      }
      ring.push(f); if (ring.length > LAG) ring.shift();
    }
  });
  p.on('close', (c) => (c === 0 ? resolve({ mad, motion }) : reject(Error('ffmpeg motion pass failed'))));
});
const cutFrames = scenes.slice(1).map((s) => Math.round(s.from * fps));
// shot lengths: a shot over longShotWarn warns, and one over maxShotSeconds (off unless film.json
// sets it) fails, unless its scene says why it holds ("hold": "reason" in film.json)
const shotList = shots(mad, fps, scenes.slice(1).map((sc) => Math.round(sc.from * fps)));
for (const sh of shotList) {
  const sc = scenes.find((x) => sh.from + 1e-6 >= x.from && sh.from < x.to);
  if (sh.seconds > G.maxShotSeconds && !sc?.hold) add('shot-length', 'fail', sh.startFrame, `one shot holds ${sh.seconds} s`, `break it with a cut, a new angle or a new idea every 1.5 to 4 s, or give scene ${sc?.id ?? '?'} "hold": "<why>"`);
  else if (sh.seconds > G.longShotWarn && !sc?.hold) add('shot-length', 'warn', sh.startFrame, `one shot holds ${sh.seconds} s`, 'keep the shot alive: move the camera through the world, let the words change it, or cut on a beat');
}
for (const s of stillStretches(motion, fps, G)) add('still', 'fail', s.startFrame, `nothing visibly moves for ${s.seconds} s (${fmtTime(s.from)} to ${fmtTime(s.to)})`, 'keep something alive through the hold: a slow push, drifting light or breathing type');
for (const s of deadStops(mad, fps, { ...G, stillThreshold: G.stopThreshold, cutFrames })) add('dead-stop', 'fail', s.frame, `a fast move (${s.before} mean change per frame) stops dead within 2 frames (${s.after})`, 'ease the move into its landing over at least 0.3 s instead of stopping it');

// ---------- live: something in the world moves, not only the camera ----------
// small grey frames 0.1 s apart, each pair with the frame-wide move (and light change) taken out;
// pairs across a cut aren't compared
{
  console.log('live: measuring motion of the world apart from the camera');
  const LW = G.liveWidth, LH = G.liveHeight, LN = LW * LH;
  const lag = Math.max(1, Math.round(G.liveLagSeconds * fps)), step = Math.max(1, Math.round(fps / 30));
  const cutSet = new Set(cutFrames);
  const crosses = (i) => { for (let k = i - lag + 1; k <= i; k++) if (cutSet.has(k)) return true; return false; };
  const scores = await new Promise((resolve, reject) => {
    const out = [], ring = []; let carry = Buffer.alloc(0), i = 0;
    const p = spawn('ffmpeg', ['-loglevel', 'error', '-i', video, '-vf', `scale=${LW}:${LH}:flags=area,format=gray`, '-f', 'rawvideo', '-']);
    p.stdout.on('data', (d) => {
      carry = Buffer.concat([carry, d]);
      while (carry.length >= LN) {
        const f = Buffer.from(carry.subarray(0, LN)); carry = carry.subarray(LN);
        ring.push(f); if (ring.length > lag + 1) ring.shift();
        out.push(i >= lag && i % step === 0 && !crosses(i) ? liveResidual(ring[0], f, LW, LH).score : NaN);
        i++;
      }
    });
    p.on('close', (c) => (c === 0 ? resolve(out) : reject(Error('ffmpeg live pass failed'))));
  });
  for (const st of cameraOnlyStretches(scores, fps, G)) {
    const sc = scenes.find((x) => st.from + 1e-6 >= x.from && st.from < x.to);
    if (sc?.cameraOnly) continue;
    add('live', 'fail', st.startFrame, `only the camera moves for ${st.seconds} s (${fmtTime(st.from)} to ${fmtTime(st.to)}): nothing in the world moves on its own`, `give the world a life of its own (the kit's dust, embers, wind, haze or flame in /kit/life.js, water, cloth, a figure) or parallax from a real move through depth, or give scene ${sc?.id ?? '?'} "cameraOnly": "<why>"`);
  }
}

// ---------- rest-to-rest: shots whose camera starts and ends at a standstill ----------
if (scenes.length) {
  const list = scenes.map((s) => ({ id: s.id, scene: s.scene, params: s.params, from: s.from, to: s.to }));
  const r = spawnSync('node', [path.join(HERE, 'render.mjs'), 'camera', '--song', SONG, '--scenes64', Buffer.from(JSON.stringify(list)).toString('base64')], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const tracks = (r.stdout ?? '').split('\n').filter((l) => l.startsWith('CAMERA ')).map((l) => JSON.parse(l.slice(7)));
  if (r.status !== 0 || !tracks.length) add('rest-to-rest', 'warn', 0, 'the scenes\' cameras could not be read, so shots were not checked for starting and ending at rest', 'run node photoreal/render.mjs camera --song S --scenes \'[...]\' to see why');
  for (const tr of tracks.filter((x) => x.error)) add('rest-to-rest', 'warn', Math.round((scenes.find((s) => s.id === tr.id)?.from ?? 0) * fps), `the camera of scene ${tr.id} could not be read: ${tr.error}`, 'check the scene module builds outside the renderer');
  for (const p of restToRest(tracks.filter((x) => !x.error), scenes, G)) add('rest-to-rest', 'warn', Math.round(p.from * fps), `scene ${p.id}'s camera starts and ends at a standstill (${Math.round(p.head * 100)}% and ${Math.round(p.tail * 100)}% of its top speed), so its cuts join stopped cameras`, `let the shot enter or leave moving: rig() from /kit/motion.js with enter or exit 'moving' (the default), or give scene ${p.id} "rest": "<why>"`);
}

// ---------- cuts against the measured beats ----------
if (!story && audio?.beats?.length && scenes.length > 1) {
  for (const c of cutsOffBeat(scenes, audio.beats, fps, G)) add('cut-beat', 'fail', Math.round(c.cut * fps), `the cut into scene ${c.id} is ${Math.abs(c.offFrames)} frame${Math.abs(c.offFrames) === 1 ? '' : 's'} ${c.offFrames > 0 ? 'after' : 'before'} the beat at ${fmtTime(c.beat)}`, `move the cut to ${c.target.toFixed(3)} s (the beat) or up to ${G.cutEarlyFrames} frames earlier, or give the scene "offBeat": "<reason>" if it follows the voice on purpose`);
}

// ---------- shake: only where a scene opted in for a violent moment ----------
for (const p of shakeReview(SONG, scenes, G)) add('shake', p.severity, p.scene ? Math.round(p.scene.from * fps) : 0, p.detail, p.fix);

// ---------- in-scene: words in the world, not over it ----------
for (const p of inSceneReview(SONG, scenes, tier)) add('in-scene', p.severity, Math.round(p.scene.from * fps), p.detail, p.fix);

// ---------- story: the voice, the mix, the beats ----------
// the text gates below then read only the phrases a story film puts on screen
let shown = lyrics;
if (story) {
  const cfg = storyConfig(film);
  const storyData = read('data/story.json');
  const scriptText = fs.readFileSync(path.join(SONG, cfg.script), 'utf8');
  const os = onScreenLyrics(cfg.onScreen, lyrics);
  for (const m of os.missing) add('events', 'fail', 0, `the on-screen phrase "${m}" is not in the narration`, 'use the script\'s exact words in story.onScreen');
  shown = { lines: os.lines, words: os.words };
  // events
  if (!storyData) add('events', 'fail', 0, 'no data/story.json', 'run node photoreal/story.mjs prepare');
  else {
    for (const p of storyData.problems ?? []) add('events', 'fail', 0, p.detail, 'fix the cue to match the script, then run story.mjs prepare again');
    for (const p of eventProblems(storyData.events ?? [], scenes)) add('events', 'fail', Math.round(p.time * fps), p.detail, 'move the scene boundary or give the event to the scene that shows it');
  }
  for (const c of cutsInsideWords(scenes, lyrics.words ?? [], G)) add('cut-word', 'fail', Math.round(c.cut * fps), `the cut into scene ${c.id} lands inside the spoken word "${c.word}" (${c.start.toFixed(2)}-${c.end.toFixed(2)} s)`, `move the cut to ${c.start.toFixed(3)} s or ${c.end.toFixed(3)} s, or give the scene "midWord": "<why>"`);
  // the encoded audio against the mix it was made from
  const P = mixPaths(SONG);
  if (!fs.existsSync(P.mix) || !fs.existsSync(P.key) || fs.readFileSync(P.key, 'utf8') !== mixKey(SONG, film)) add('audio-sync', 'fail', 0, 'the narration mix is missing or older than its inputs', 'run node photoreal/story.mjs mix and join the film again');
  else {
    console.log('story: comparing the encoded audio with the mix');
    const enc = decode(video, { rate: 16000 }), ref = decode(P.mix, { rate: 16000 });
    const s = bestLag(ref, enc, 16000);
    const durDiff = Math.abs(enc.length - ref.length) / 16000;
    if (Math.abs(s.lagMs) > G.maxSyncLagMs || s.correlation < G.minSyncCorrelation) add('audio-sync', 'fail', 0, `the film's audio is ${s.lagMs} ms off the narration mix (match ${s.correlation})`, 'join the film again from the current mix (film.mjs)');
    if (durDiff > 2 / fps) add('audio-sync', 'fail', nFrames - 1, `the film's audio runs ${durDiff.toFixed(2)} s ${enc.length > ref.length ? 'longer' : 'shorter'} than the mix`, 'join the film again from the current mix');
    syncReport = { ...s, durationDiff: +durDiff.toFixed(3) };
    // voice over music, from the stems the mix was summed from
    const voice = decode(P.voice, { rate: 16000 }), music = decode(P.music, { rate: 16000 });
    const vm = voiceOverMusic(voice, music, 16000, lyrics.words ?? [], G.minVoiceOverMusicDb);
    balanceReport = { worstDb: vm.worstDb, wordsUnder: vm.low.length };
    for (const w of vm.low) add('voice-music', 'fail', Math.round(w.start * fps), `the music is only ${w.marginDb} dB under the voice on "${w.word}"`, `lower story.musicGainDb or raise story.duckDb (needs ${G.minVoiceOverMusicDb} dB)`);
  }
  // what the finished film actually says
  if (!argv.includes('--no-asr')) {
    console.log('story: transcribing the encoded film (local Whisper)');
    const wav = path.join(work, 'film-audio.wav');
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', video, '-vn', '-ac', '1', '-ar', '16000', wav]);
    // only the narrated stretch: a music-only tail can make a model imagine words ("Thank you")
    const ws = lyrics.words ?? [];
    const h = hear(wav, scriptText, { work, start: Math.max(0, (ws[0]?.start ?? 0) - 0.5), end: (ws.at(-1)?.end ?? duration) + 0.8 });
    spokenReport = { model: h.model, byModel: h.byModel, exact: h.exact, diffs: h.diffs };
    for (const d of h.diffs) {
      const w = lyrics.words?.[Math.min(d.index, (lyrics.words?.length ?? 1) - 1)];
      add('spoken-text', 'fail', Math.round((w?.start ?? 0) * fps), `${d.op === 'missing' ? `"${d.expected}" is not heard in the film` : d.op === 'extra' ? `"${d.heard}" is heard but is not in the script` : `"${d.expected}" is heard as "${d.heard}"`} (${d.models.join(', ')})`, 'record or choose a take that reads the script exactly, or lower the music where it masks the word');
    }
  }
}

// ---------- lyric words: contrast, collisions, settling ----------
if (!argv.includes('--no-ocr') && shown.words?.length) {
  const swift = path.join(HERE, 'lib', 'ocr-words.swift');
  const bin = path.join(SONG, 'out', 'work', `ocr-words-${crypto.createHash('sha256').update(fs.readFileSync(swift)).digest('hex').slice(0, 12)}`);
  if (!fs.existsSync(bin)) execFileSync('swiftc', ['-O', swift, '-o', bin, '-framework', 'Vision', '-framework', 'ImageIO'], { stdio: 'inherit' });
  const { createCanvas, loadImage } = await import('@napi-rs/canvas');
  const checks = wordChecks(shown, fps, duration, G).filter((c) => c.f1 < nFrames);
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
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png') && !f.startsWith('.')).sort().map((f) => path.join(dir, f));
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
        if (cr.ratio < G.minContrast) add('contrast', 'fail', c.f1, `"${c.word}" is ${cr.ratio.toFixed(2)}:1 against what is behind it (${cr.ink} ink); needs ${G.minContrast}:1`, cr.ink === 'light' ? 'light the word or the surface it is on, darken or blur what passes behind it, or put it on a quieter part of the world (a dark hull, a shadowed ridge)' : 'lighten what is behind the word or switch to light ink here');
      }
      for (const k of collisions(o1, c.onScreen, G).filter((k) => (tier !== 'premium' && tier !== 'ultra') || k.kind !== 'tight')) {
        const key = `${sceneAt(scenes, c.f1 / fps)}:${k.kind}:${k.text}`;   // once per scene
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
const summary = { ...summarize(problems), tier, shots: shotList.length, shotsPerMinute: +(shotList.length / (duration / 60)).toFixed(1), medianShotSeconds: shotList.length ? [...shotList].sort((a, b) => a.seconds - b.seconds)[Math.floor(shotList.length / 2)].seconds : null };
const keys = makeKeys(SONG);
const h = crypto.createHash('sha256'); { const fdv = fs.openSync(video, 'r'); const buf = Buffer.alloc(1 << 22); let n; while ((n = fs.readSync(fdv, buf, 0, buf.length)) > 0) h.update(buf.subarray(0, n)); fs.closeSync(fdv); }
const report = {
  label, video: path.relative(SONG, video), videoSha: h.digest('hex'), at: new Date().toISOString(), fps, frames: nFrames, duration,
  // what the film was made from (written by film.mjs when it joined it), so the full render can tell
  // whether this check still describes the current scenes
  thresholds: G, content: read(path.relative(SONG, video.replace(/\.mp4$/, '') + '.content.json')) ?? Object.fromEntries(scenes.map((s) => [s.id, keys.content(s, film.fps ?? 60)])),
  summary, problems,
  ...(story ? { story: { sync: syncReport, voiceOverMusic: balanceReport, spoken: spokenReport } } : {}),
};
const outFile = path.join(REVIEW, `check-${label}.json`);
fs.writeFileSync(outFile, JSON.stringify(report, null, 1) + '\n');
fs.rmSync(work, { recursive: true, force: true });
console.log(`\n${summary.passed ? 'PASSED' : 'FAILED'}: ${summary.fails} failures, ${summary.warns} warnings (${outFile})`);
for (const [g, n] of Object.entries(summary.byGate)) console.log(`  ${g}: ${n.fail} fail, ${n.warn} warn`);
for (const p of problems.filter((p) => p.severity === 'fail').slice(0, 15)) console.log(`  ${p.time} [${p.scene ?? '-'}] ${p.gate}: ${p.detail}`);
process.exit(summary.passed ? 0 : 1);
