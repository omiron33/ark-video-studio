// The I/O half of story mode (see story.mjs for the film.json format): decoding audio, the local
// speech models, and building the mix the film is joined with.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { storyConfig, speechSpans, duckGain, pcmArgs, tokens, diffWords, narrationLyrics, resolveEvents, combineHearing, takesPlan, scriptLines } from './story.mjs';

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MODELS = process.env.ARK_MODELS ?? '/Volumes/DATA/AI/Models';
export const RATE = 48000;

export function python() {
  if (process.env.ARK_PYTHON) return process.env.ARK_PYTHON;
  const known = '/opt/homebrew/Cellar/openai-whisper/20250625_3/libexec/bin/python';
  return fs.existsSync(known) ? known : 'python3';
}
// Listening uses two Whisper models by default (ARK_STORY_HEAR=small.en,medium.en): a word counts as
// read right only when both hear the script. In testing, small.en alone heard "Thank you" in a
// silent tail and medium.en did not; a real misreading ("abouteth", "lose" for "Loose") both heard.
export const models = () => ({
  whisper: process.env.ARK_STORY_WHISPER ?? `${MODELS}/Whisper/small.en.pt`,
  hear: (process.env.ARK_STORY_HEAR ?? 'small.en,medium.en').split(',').map((m) => (m.includes('/') ? m : `${MODELS}/Whisper/${m}.pt`)).filter((m) => fs.existsSync(m)),
  ctc: process.env.ARK_STORY_CTC ?? `${MODELS}/TorchAudio/wav2vec2_fairseq_large_lv60k_asr_ls960.pth`,
});

export function decode(file, { rate = RATE, start, duration } = {}) {
  const r = spawnSync('ffmpeg', pcmArgs(file, rate, { start, duration }), { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw Error(`could not decode ${file}: ${r.stderr}`);
  const b = r.stdout;
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
}
export function decodeStereo(file, rate = RATE) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '2', '-ar', String(rate), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw Error(`could not decode ${file}: ${r.stderr}`);
  return new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.length));
}
export function writeWav(file, samples, channels, rate = RATE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'f32le', '-ar', String(rate), '-ac', String(channels), '-i', '-', '-c:a', 'pcm_s24le', file], { input: Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength) });
  if (r.status !== 0) throw Error(`could not write ${file}: ${r.stderr}`);
}
export const duration = (file) => +spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout.trim();
const shaFile = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

// Run engine/align.py: 'transcribe' (Whisper, what was actually said) or 'force-align' (wav2vec2
// CTC, where each word of the exact script falls). Returns its JSON.
export function speech(task, audio, { script, work }) {
  fs.mkdirSync(work, { recursive: true });
  const out = path.join(work, `${task}-${crypto.randomBytes(4).toString('hex')}.json`);
  const m = models();
  const args = [path.join(ENGINE, 'engine', 'align.py'), '--audio', audio, '--output', out, '--task', task, '--language', 'en'];
  if (task === 'force-align') { const lyr = path.join(work, 'script-flat.txt'); fs.writeFileSync(lyr, script); args.push('--backend', 'torchaudio-ctc', '--model', m.ctc, '--lyrics', lyr); }
  else args.push('--backend', 'openai-whisper', '--model', m.whisper);
  const r = spawnSync(python(), args, { encoding: 'utf8', maxBuffer: 64 << 20, timeout: 20 * 60000 });
  if (r.status !== 0 || !fs.existsSync(out)) throw Error(`${task} failed: ${(r.stderr || r.stdout || '').slice(-1500)}`);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  fs.rmSync(out, { force: true });
  return j;
}

// What a recording actually says, against the script (lib/hear.py: plain Whisper text, so no word
// timing is needed or trusted). Returns combineHearing()'s verdict over every listening model;
// `start` / `end` (seconds) listen to part of the file.
export function hear(audio, scriptText, { work, start, end } = {}) {
  fs.mkdirSync(work, { recursive: true });
  const ms = models().hear;
  if (!ms.length) throw Error('no local Whisper model to listen with (set ARK_STORY_HEAR or ARK_MODELS)');
  const out = path.join(work, `hear-${crypto.randomBytes(4).toString('hex')}.json`);
  const args = [path.join(ENGINE, 'photoreal', 'lib', 'hear.py'), audio, out, ...ms, ...(start != null ? ['--start', String(start)] : []), ...(end != null ? ['--end', String(end)] : [])];
  const r = spawnSync(python(), args, { encoding: 'utf8', maxBuffer: 64 << 20, timeout: 30 * 60000 });
  if (r.status !== 0 || !fs.existsSync(out)) throw Error(`transcription failed: ${(r.stderr || '').slice(-1500)}`);
  const t = JSON.parse(fs.readFileSync(out, 'utf8'));
  fs.rmSync(out, { force: true });
  return combineHearing(scriptText, t.results.map((x) => ({ model: path.basename(x.model, '.pt'), transcript: x.transcript })));
}

// One narration from separate line takes (story.takes; see takesPlan): each take slowed or sped by its
// tempo, trimmed of its own leading and trailing silence, set to its loudness, faded in and out over
// 12 ms and followed by its pause. Unless hearIt is false, every take is first heard against its own
// script line and a take that is not exact stops the assembly. Writes story.narration and, beside
// it, <name>.plan.json with each line's place in the narration.
export function assemble(song, film, { log = console.log, hearIt = true } = {}) {
  const cfg = storyConfig(film);
  const scriptText = fs.readFileSync(path.join(song, cfg.script), 'utf8');
  const { errors, plan } = takesPlan(cfg.takes, scriptText);
  if (errors.length) throw Error(errors.join('; '));
  const work = path.join(song, 'out', 'work', 'story');
  if (hearIt) for (const p of plan) {
    const h = hear(path.join(song, p.file), p.text, { work });
    log(`line ${p.line} (${p.file}): ${h.exact ? 'exact' : h.diffs.map((d) => `${d.op} ${d.expected ?? ''}${d.heard ? ` heard "${d.heard}"` : ''} [${d.models.join(', ')}]`).join('; ')}`);
    if (!h.exact) throw Error(`the take for line ${p.line} does not read "${p.text}" exactly; choose or record another`);
  }
  // integrated loudness: the summary's I (the last one ebur128 prints; the per-frame lines come first)
  const lufsOf = (f) => +([...spawnSync('ffmpeg', ['-v', 'info', '-i', f, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' }).stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1)?.[1] ?? NaN);
  const parts = [new Float32Array(Math.round(0.25 * RATE))], out = [];
  let t = 0.25;
  for (const p of plan) {
    const src = path.join(song, p.file);
    const trim = 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.06,areverse';
    const r = spawnSync('ffmpeg', ['-v', 'error', '-i', src, '-af', `${p.tempo !== 1 ? `atempo=${p.tempo},` : ''}${trim}`, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
    if (r.status !== 0) throw Error(`could not read ${p.file}: ${r.stderr}`);
    const x = new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.length));
    const level = lufsOf(src), g = Number.isFinite(level) ? 10 ** ((p.lufs - level) / 20) : 1;
    const fade = Math.round(0.012 * RATE);
    for (let i = 0; i < x.length; i++) x[i] *= g * Math.min(1, i / fade, (x.length - 1 - i) / fade);
    out.push({ line: p.line, file: p.file, start: +t.toFixed(3), end: +(t + x.length / RATE).toFixed(3), gainDb: +(20 * Math.log10(g)).toFixed(2), tempo: p.tempo });
    parts.push(x, new Float32Array(Math.round(p.pause * RATE)));
    t += x.length / RATE + p.pause;
  }
  parts.push(new Float32Array(Math.round(0.4 * RATE)));
  const y = new Float32Array(parts.reduce((n, a) => n + a.length, 0));
  let o = 0, peak = 0;
  for (const a of parts) { y.set(a, o); o += a.length; }
  for (const v of y) peak = Math.max(peak, Math.abs(v));
  if (peak > 0.95) for (let i = 0; i < y.length; i++) y[i] *= 0.95 / peak;
  const dst = path.join(song, cfg.narration);
  writeWav(dst, y, 1);
  fs.writeFileSync(dst.replace(/\.[^.]+$/, '') + '.plan.json', JSON.stringify({ duration: +(y.length / RATE).toFixed(3), lines: out, peakTrimDb: peak > 0.95 ? +(20 * Math.log10(0.95 / peak)).toFixed(2) : 0 }, null, 1) + '\n');
  log(`wrote ${cfg.narration}: ${(y.length / RATE).toFixed(2)} s from ${plan.length} takes`);
  return { file: dst, duration: y.length / RATE, lines: out };
}

// Align the narration to the script and write data/lyrics.json, data/audio.json and data/story.json.
export function prepare(song, film, { log = console.log } = {}) {
  const cfg = storyConfig(film);
  if (cfg.errors.length) throw Error(cfg.errors.join('; '));
  const script = fs.readFileSync(path.join(song, cfg.script), 'utf8');
  const narration = path.join(song, cfg.narration);
  const work = path.join(song, 'out', 'work', 'story');
  log('aligning the narration to the script (local wav2vec2 CTC)');
  const fa = speech('force-align', narration, { script: script.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join('\n'), work });
  const lyrics = narrationLyrics(script, fa.words, { at: cfg.narrationAt, source: `force-aligned to ${cfg.narration} (torchaudio CTC, wav2vec2 large) at film time +${cfg.narrationAt}s; machine estimate` });
  const end = cfg.end ?? +(cfg.narrationAt + duration(narration) + cfg.tail).toFixed(3);
  const { events, problems } = resolveEvents(cfg.events, lyrics);
  fs.mkdirSync(path.join(song, 'data'), { recursive: true });
  fs.writeFileSync(path.join(song, 'data', 'lyrics.json'), JSON.stringify(lyrics, null, 1) + '\n');
  // no musical beats: story cuts follow the voice (check.mjs measures cuts against words instead)
  fs.writeFileSync(path.join(song, 'data', 'audio.json'), JSON.stringify({ version: 1, mode: 'story', source: cfg.narration, duration: end, beats: [], narrationSha: shaFile(narration) }, null, 1) + '\n');
  fs.writeFileSync(path.join(song, 'data', 'story.json'), JSON.stringify({ end, narrationAt: cfg.narrationAt, events, problems }, null, 1) + '\n');
  return { lyrics, events, problems, end };
}

// The inputs the mix is made from, so a stale mix is rebuilt.
export function mixKey(song, film) {
  const cfg = storyConfig(film);
  const h = crypto.createHash('sha256').update('story-mix-1');
  for (const f of [cfg.narration, cfg.music, 'data/lyrics.json', 'data/story.json'].filter(Boolean)) h.update(f).update(fs.existsSync(path.join(song, f)) ? fs.readFileSync(path.join(song, f)) : '');
  const { script, events, onScreen, errors, ...levels } = cfg;
  return h.update(JSON.stringify(levels)).digest('hex');
}
export const mixPaths = (song) => { const d = path.join(song, 'out', 'audio'); return { dir: d, voice: path.join(d, 'voice.wav'), music: path.join(d, 'music.wav'), mix: path.join(d, 'mix.wav'), key: path.join(d, 'mix.key') }; };

// The voice at its place in the film, the music ducked under it, and their sum. Gains come from the
// measured words, so the music is down before each phrase starts and the voice is never touched.
export function buildMix(song, film, { log = console.log, force = false } = {}) {
  const cfg = storyConfig(film);
  const P = mixPaths(song), key = mixKey(song, film);
  if (!force && fs.existsSync(P.mix) && fs.existsSync(P.key) && fs.readFileSync(P.key, 'utf8') === key) return { ...P, cached: true };
  const lyrics = JSON.parse(fs.readFileSync(path.join(song, 'data', 'lyrics.json'), 'utf8'));
  const story = JSON.parse(fs.readFileSync(path.join(song, 'data', 'story.json'), 'utf8'));
  const end = film.scenes?.at(-1)?.to ?? story.end;
  const N = Math.round(end * RATE);
  const v = decode(path.join(song, cfg.narration));
  const voice = new Float32Array(N);
  const at = Math.round(cfg.narrationAt * RATE);
  for (let i = 0; i < v.length && at + i < N; i++) if (at + i >= 0) voice[at + i] = v[i] * 10 ** ((cfg.narrationGainDb ?? 0) / 20);
  const music = new Float32Array(N * 2);
  if (cfg.music) {
    const m = decodeStereo(path.join(song, cfg.music));
    const spans = speechSpans(lyrics.words, cfg.speechJoin);
    const opts = { ...cfg, fadeOutFrom: end - cfg.musicFadeOut, end };
    const mAt = Math.round((cfg.musicAt ?? 0) * RATE);
    for (let i = 0; i < N; i++) {
      const j = i - mAt;
      if (j < 0 || 2 * j + 1 >= m.length) continue;
      const g = duckGain(i / RATE, spans, opts);
      music[2 * i] = m[2 * j] * g; music[2 * i + 1] = m[2 * j + 1] * g;
    }
  }
  const mix = new Float32Array(N * 2);
  let peak = 0;
  for (let i = 0; i < N; i++) for (let c = 0; c < 2; c++) { const x = voice[i] + music[2 * i + c]; mix[2 * i + c] = x; peak = Math.max(peak, Math.abs(x)); }
  // one fixed gain if anything would clip; the balance between voice and music never changes
  const trim = peak > 0.97 ? 0.97 / peak : 1;
  if (trim < 1) { for (let i = 0; i < mix.length; i++) mix[i] *= trim; for (let i = 0; i < N; i++) voice[i] *= trim; for (let i = 0; i < music.length; i++) music[i] *= trim; }
  writeWav(P.voice, voice, 1); writeWav(P.music, music, 2); writeWav(P.mix, mix, 2);
  fs.writeFileSync(P.key, key);
  log(`mix: ${end.toFixed(2)} s, voice from ${cfg.narrationAt} s${cfg.music ? `, music ${cfg.musicGainDb} dB ducking ${cfg.duckDb} dB under speech` : ', no music'}${trim < 1 ? `, trimmed ${(20 * Math.log10(trim)).toFixed(1)} dB to avoid clipping` : ''}`);
  return { ...P, cached: false, trimDb: trim < 1 ? 20 * Math.log10(trim) : 0 };
}
