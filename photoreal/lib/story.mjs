// Narrated story films: a film that follows a spoken script instead of a song. It is the same
// photoreal pipeline (scenes, segments, layers, checks, critic) switched on by "mode": "story" in
// film.json; a film without it is a lyric film and nothing here touches it.
//
// film.json:
//   "mode": "story",
//   "story": {
//     "script": "data/script.txt",          exact text, one spoken line per line of the file
//     "narration": "media/narration.wav",   the voice; its timing is authoritative
//     "narrationAt": 1.5,                   film time the narration starts (default 0)
//     "music": "media/score.wav",           optional; sits under the voice and yields to it
//     "musicGainDb": -14, "duckDb": 12, "duckAttack": 0.12, "duckRelease": 0.6, "musicFadeOut": 3,
//     "end": 64,                            film length (default: narration end + 3 s)
//     "onScreen": ["Lazarus, come forth"],  script phrases also shown as type (the rest are only heard)
//     "events": [{ "id": "stone", "cue": "took away the stone", "scene": "02", "what": "the stone is rolled back" }]
//   }
// An event is a story beat the picture must show. "cue" is a phrase of the script; its first spoken
// word is the event's time (plus "offset" seconds, for a beat that lands just after the words). An
// event with "at" (film seconds) is a silent beat. "scene" is the film.json scene that shows it.
//
// node photoreal/story.mjs prepare writes data/lyrics.json (the narration's measured words, in film
// time, so scenes anchor to the voice exactly as lyric scenes anchor to singing), data/audio.json and
// data/story.json (events with their times), and out/audio/ (voice, ducked music and the mix that
// the film is joined with).

export const isStory = (film) => film?.mode === 'story';

export const STORY_DEFAULTS = {
  narrationAt: 0, musicGainDb: -14, duckDb: 12, duckAttack: 0.12, duckRelease: 0.6, musicFadeOut: 3, tail: 3,
  speechJoin: 0.35,   // words closer than this belong to one stretch of speech, for ducking
};

// Gate thresholds added for story films (overridable under "gates" in film.json like the others).
export const STORY_GATES = {
  minVoiceOverMusicDb: 12,   // during every spoken word the voice stays this far above the music
  maxSyncLagMs: 20,          // the encoded film's audio sits within this of the mix it was made from
  minSyncCorrelation: 0.9,
  cutWordMargin: 0.04,       // a cut may not fall inside a spoken word (with this margin either side)
};

export function storyConfig(film) {
  const s = { ...STORY_DEFAULTS, ...(film?.story ?? {}) };
  const errors = [];
  if (!s.script) errors.push('story.script is missing (the exact text, e.g. data/script.txt)');
  if (!s.narration) errors.push('story.narration is missing (the voice, e.g. media/narration.wav)');
  for (const [i, e] of (s.events ?? []).entries()) {
    if (!e.id) errors.push(`story.events[${i}] has no id`);
    if (!e.cue && !Number.isFinite(e.at)) errors.push(`story event ${e.id ?? i} needs a "cue" phrase from the script or an "at" time`);
  }
  for (const p of s.onScreen ?? []) if (typeof p !== 'string' || !p.trim()) errors.push('story.onScreen holds an empty phrase');
  return { ...s, events: s.events ?? [], onScreen: s.onScreen ?? [], errors };
}

// ---------- text ----------
// The spoken form of a word for comparison: case, accents, punctuation and apostrophes don't count.
// Small numbers count the same written either way ("Four" and "4"): a recogniser writes digits.
const NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export const normWord = (s) => {
  const w = String(s).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}]/gu, '');
  return /^\d+$/.test(w) && +w < NUMBERS.length ? NUMBERS[+w] : w;
};
export const tokens = (text) => String(text).split(/[\s—–]+|--/).map((t) => t.trim()).filter((t) => normWord(t));

// Script lines: one per non-empty line of the script file, each with its display text and tokens.
export function scriptLines(text) {
  return String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => ({ text: l, tokens: tokens(l) }));
}

// Word-level difference between what should be spoken and what was heard. A word heard as two
// ("grave clothes" for "graveclothes") or two heard as one count as the same. Returns the
// operations that are not matches; an empty list means the text was spoken exactly.
export function diffWords(expected, heard) {
  const a = expected.map(normWord).filter(Boolean), b = heard.map(normWord).filter(Boolean);
  const n = a.length, m = b.length;
  const D = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = 0; i <= n; i++) D[i][0] = i;
  for (let j = 0; j <= m; j++) D[0][j] = j;
  const join2 = (x, i) => (i >= 2 ? x[i - 2] + x[i - 1] : null);
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    let d = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (j >= 2 && a[i - 1] === join2(b, j)) d = Math.min(d, D[i - 1][j - 2]);
    if (i >= 2 && b[j - 1] === join2(a, i)) d = Math.min(d, D[i - 2][j - 1]);
    D[i][j] = d;
  }
  const ops = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1] && D[i][j] === D[i - 1][j - 1]) { i--; j--; continue; }
    if (i > 0 && j >= 2 && a[i - 1] === join2(b, j) && D[i][j] === D[i - 1][j - 2]) { i--; j -= 2; continue; }
    if (i >= 2 && j > 0 && b[j - 1] === join2(a, i) && D[i][j] === D[i - 2][j - 1]) { i -= 2; j--; continue; }
    if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + 1) { ops.push({ op: 'substituted', expected: a[i - 1], heard: b[j - 1], index: i - 1 }); i--; j--; continue; }
    if (i > 0 && D[i][j] === D[i - 1][j] + 1) { ops.push({ op: 'missing', expected: a[i - 1], index: i - 1 }); i--; continue; }
    ops.push({ op: 'extra', heard: b[j - 1], index: i }); j--;
  }
  return ops.reverse();
}

// Several models' hearings of one recording against the script. Exact only when every model heard
// exactly the script. `diffs` lists each word that any model got wrong, with the models that did.
export function combineHearing(scriptText, results) {
  const want = tokens(scriptText);
  const per = results.map((r) => ({ ...r, heard: tokens(r.transcript), diffs: diffWords(want, tokens(r.transcript)) }));
  const byWord = new Map();
  for (const r of per) for (const d of r.diffs) {
    const k = `${d.op}:${d.index}:${d.expected ?? ''}:${d.heard ?? ''}`;
    if (!byWord.has(k)) byWord.set(k, { ...d, models: [] });
    byWord.get(k).models.push(r.model);
  }
  const diffs = [...byWord.values()].sort((a, b) => a.index - b.index);
  return { exact: per.every((r) => r.diffs.length === 0), diffs, transcript: per[0]?.transcript ?? '', model: per.map((r) => r.model).join('+'), byModel: per.map((r) => ({ model: r.model, transcript: r.transcript, exact: r.diffs.length === 0 })) };
}

// Narration built from separate takes, one per script line (story.takes in film.json):
//   [{ "line": 1, "file": "media/tts/line01.flac", "pause": 2.4, "lufs": -20, "tempo": 0.92 }]
// line: script line (1-based); pause: silence after it (s); lufs: its loudness (default -20); tempo:
// a gentle speed change (0.85 to 1.15). Every script line exactly once, in order.
export function takesPlan(takes, scriptText) {
  const lines = scriptLines(scriptText), errors = [];
  if (!Array.isArray(takes) || !takes.length) return { errors: ['story.takes is empty'], plan: [] };
  takes.forEach((t, i) => {
    if (t.line !== i + 1) errors.push(`take ${i + 1} is for line ${t.line}; takes must cover script lines 1 to ${lines.length} in order`);
    if (!t.file) errors.push(`take for line ${t.line} has no file`);
    if (t.pause != null && !(t.pause >= 0)) errors.push(`take for line ${t.line} has a negative pause`);
    if (t.tempo != null && !(t.tempo >= 0.85 && t.tempo <= 1.15)) errors.push(`take for line ${t.line}: tempo ${t.tempo} is outside 0.85 to 1.15 (beyond that the voice sounds processed)`);
  });
  if (takes.length !== lines.length) errors.push(`${takes.length} takes for ${lines.length} script lines`);
  const plan = takes.map((t, i) => ({ line: t.line, text: lines[i]?.text ?? '', file: t.file, pause: t.pause ?? 0.8, lufs: t.lufs ?? -20, tempo: t.tempo ?? 1 }));
  return { errors, plan };
}

// ---------- timing ----------
// Measured narration words (in narration time, in script order) become the film's lyrics file:
// lines are script lines, words carry film time. Throws when the alignment doesn't cover the script.
export function narrationLyrics(script, aligned, { at = 0, source = 'narration' } = {}) {
  const lines = scriptLines(script);
  const want = lines.flatMap((l) => l.tokens);
  const got = aligned.filter((w) => normWord(w.text ?? w.w));
  if (got.length !== want.length) throw Error(`the alignment has ${got.length} words but the script has ${want.length}`);
  got.forEach((w, k) => { if (normWord(w.text ?? w.w) !== normWord(want[k])) throw Error(`aligned word ${k + 1} is "${w.text ?? w.w}" but the script says "${want[k]}"`); });
  const words = got.map((w, k) => ({ w: want[k], start: +(w.start + at).toFixed(3), end: +(w.end + at).toFixed(3) }));
  let k = 0;
  const out = lines.map((l) => {
    const ws = words.slice(k, k + l.tokens.length); k += l.tokens.length;
    return { text: l.text, start: ws[0].start, end: ws.at(-1).end };
  });
  return { source, mode: 'story', lines: out, words };
}

// Find a phrase of the script among the timed words; returns the index of its first word, or -1.
// `from` skips earlier occurrences.
export function findPhrase(words, phrase, from = 0) {
  const p = tokens(phrase).map(normWord);
  if (!p.length) return -1;
  for (let i = from; i + p.length <= words.length; i++) if (p.every((t, k) => normWord(words[i + k].w) === t)) return i;
  return -1;
}

// Events with their film times. Cues are looked for in script order, so a repeated phrase resolves to
// the occurrence after the previous event's. Returns { events, problems }.
export function resolveEvents(events, lyrics) {
  const words = lyrics.words ?? [];
  const problems = [];
  let from = 0;
  const out = events.map((e) => {
    if (!e.cue) return { ...e, time: +(+e.at).toFixed(3), silent: true };
    let i = findPhrase(words, e.cue, from);
    if (i < 0) i = findPhrase(words, e.cue, 0);
    if (i < 0) { problems.push({ event: e.id, detail: `the cue "${e.cue}" is not in the narration` }); return { ...e, time: null }; }
    from = i + 1;
    const n = tokens(e.cue).length;
    return { ...e, time: +(words[i].start + (e.offset ?? 0)).toFixed(3), cueStart: words[i].start, cueEnd: words[i + n - 1].end };
  });
  return { events: out, problems };
}

// On-screen phrases as a lyrics-shaped object, so the text gates check only the words a story film
// actually shows. Each phrase must be part of the script.
export function onScreenLyrics(phrases, lyrics) {
  const words = lyrics.words ?? [], lines = [], ws = [], missing = [];
  let from = 0;
  for (const p of phrases) {
    let i = findPhrase(words, p, from);
    if (i < 0) i = findPhrase(words, p, 0);
    if (i < 0) { missing.push(p); continue; }
    const seg = words.slice(i, i + tokens(p).length);
    from = i + 1;
    lines.push({ text: p, start: seg[0].start, end: seg.at(-1).end });
    ws.push(...seg);
  }
  return { lines, words: ws, missing };
}

// Stretches of speech: words joined across short pauses.
export function speechSpans(words, join = STORY_DEFAULTS.speechJoin) {
  const out = [];
  for (const w of words) {
    const last = out.at(-1);
    if (last && w.start - last.end <= join) last.end = Math.max(last.end, w.end);
    else out.push({ start: w.start, end: w.end });
  }
  return out;
}

// Music gain (linear) at time t: musicGainDb, dipping by duckDb while the voice speaks. The dip
// starts duckAttack before each stretch of speech so the music is already down when the first
// syllable lands, and recovers over duckRelease after it.
export function duckGain(t, spans, { musicGainDb = STORY_DEFAULTS.musicGainDb, duckDb = STORY_DEFAULTS.duckDb, duckAttack = STORY_DEFAULTS.duckAttack, duckRelease = STORY_DEFAULTS.duckRelease, fadeOutFrom = Infinity, end = Infinity } = {}) {
  let depth = 0;
  for (const s of spans) {
    if (t < s.start - duckAttack || t > s.end + duckRelease) continue;
    const d = t < s.start ? (t - (s.start - duckAttack)) / duckAttack : t <= s.end ? 1 : 1 - (t - s.end) / duckRelease;
    depth = Math.max(depth, Math.min(1, Math.max(0, d)));
  }
  const smooth = depth * depth * (3 - 2 * depth);
  let g = 10 ** ((musicGainDb - duckDb * smooth) / 20);
  if (t > fadeOutFrom) g *= Math.max(0, 1 - (t - fadeOutFrom) / Math.max(1e-6, end - fadeOutFrom));
  return g;
}

// ---------- measuring audio ----------
const db = (x) => 20 * Math.log10(Math.max(x, 1e-9));
export function rms(samples, a = 0, b = samples.length) {
  let s = 0; a = Math.max(0, a | 0); b = Math.min(samples.length, b | 0);
  for (let i = a; i < b; i++) s += samples[i] * samples[i];
  return b > a ? Math.sqrt(s / (b - a)) : 0;
}

// How far the voice sits above the music in each spoken word (both mono, same rate and start).
// Returns the words where the margin is under `min` dB.
export function voiceOverMusic(voice, music, rate, words, min = STORY_GATES.minVoiceOverMusicDb) {
  const low = [];
  let worst = Infinity;
  for (const w of words) {
    const a = Math.round(w.start * rate), b = Math.max(a + Math.round(0.03 * rate), Math.round(w.end * rate));
    const v = rms(voice, a, b), m = rms(music, a, b);
    if (v < 1e-5) continue;   // the aligner put the word in a silent gap; nothing to compare
    const margin = db(v) - db(m);
    worst = Math.min(worst, margin);
    if (margin < min) low.push({ word: w.w, start: w.start, marginDb: +margin.toFixed(1) });
  }
  return { low, worstDb: Number.isFinite(worst) ? +worst.toFixed(1) : null };
}

// Envelopes (RMS per `hop` samples) of two signals and the lag of b against a that matches them best,
// searched within ±maxLag seconds. Positive lag: b is late.
export function envelope(samples, hop) {
  const n = Math.floor(samples.length / hop), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = rms(samples, i * hop, (i + 1) * hop);
  return out;
}
export function bestLag(a, b, rate, { hopMs = 1, maxLag = 0.25 } = {}) {
  const hop = Math.max(1, Math.round(rate * hopMs / 1000));
  const ea = envelope(a, hop), eb = envelope(b, hop);
  const n = Math.min(ea.length, eb.length), K = Math.round(maxLag * 1000 / hopMs);
  const mean = (x) => { let s = 0; for (let i = 0; i < n; i++) s += x[i]; return s / n; };
  const ma = mean(ea), mb = mean(eb);
  let best = { lag: 0, r: -Infinity };
  for (let k = -K; k <= K; k++) {
    let sab = 0, saa = 0, sbb = 0;
    for (let i = Math.max(0, -k); i < n && i + k < n; i++) {
      const x = ea[i] - ma, y = eb[i + k] - mb;
      sab += x * y; saa += x * x; sbb += y * y;
    }
    const r = sab / Math.sqrt(saa * sbb || 1);
    if (r > best.r) best = { lag: k * hopMs / 1000, r };
  }
  return { lagMs: +(best.lag * 1000).toFixed(1), correlation: +best.r.toFixed(4) };
}

// ---------- picture against story ----------
// Cuts that fall inside a spoken word (the picture changing mid-word reads as an edit error). A scene
// can give "midWord": "why" when it means it.
export function cutsInsideWords(scenes, words, { cutWordMargin = STORY_GATES.cutWordMargin } = {}) {
  const out = [];
  for (const s of scenes.slice(1)) {
    if (s.midWord) continue;
    const w = words.find((x) => s.from > x.start + cutWordMargin && s.from < x.end - cutWordMargin);
    if (w) out.push({ id: s.id, cut: s.from, word: w.w, start: w.start, end: w.end });
  }
  return out;
}

// Each event must happen inside the scene that claims it, and the claimed scenes must run in story
// order (no scene showing a later beat before an earlier one).
export function eventProblems(events, scenes) {
  const out = [];
  const idx = (id) => scenes.findIndex((s) => s.id === id);
  let last = -1;
  for (const e of events) {
    if (e.time == null) continue;
    const here = scenes.findIndex((s) => e.time >= s.from && e.time < s.to);
    if (e.scene != null) {
      const k = idx(String(e.scene));
      if (k < 0) out.push({ event: e.id, time: e.time, detail: `event "${e.id}" names scene ${e.scene}, which film.json does not have` });
      else if (k !== here) out.push({ event: e.id, time: e.time, detail: `event "${e.id}" at ${e.time.toFixed(2)} s falls in scene ${scenes[here]?.id ?? 'none'}, not in scene ${e.scene} which should show it` });
    }
    if (here >= 0 && here < last) out.push({ event: e.id, time: e.time, detail: `event "${e.id}" comes before the previous event in the film` });
    if (here >= 0) last = here;
  }
  return out;
}

// ffmpeg arguments to read any audio file as mono float PCM at `rate`.
export const pcmArgs = (file, rate, { start, duration } = {}) => ['-v', 'error', ...(start != null ? ['-ss', String(start)] : []), '-i', file, ...(duration != null ? ['-t', String(duration)] : []), '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-'];
