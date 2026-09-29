// Measured gates for a lyric film. Pure functions here take numbers and return problems; the I/O
// (decoding the film, pulling frames, recognising text) lives in check.mjs. Every problem carries a
// time, a frame and, when a film.json is given, the scene, so a fix can be aimed at one segment.
//
// Problem: { gate, severity: 'fail' | 'warn', time, frame, scene?, detail, fix }

export const DEFAULTS = {
  minContrast: 4.5,        // WCAG AA for body text, measured against what is actually behind each word
  maxStillSeconds: 0.5,    // no stretch longer than this with nothing visibly moving
  stillThreshold: 0.5,     // mean absolute frame difference (0-255) on a 96x54 grey proxy that counts as still
  settleFrames: 8,         // a word stays put this long once it is fully on before it may move
  moveTolerance: 0.35,     // ...allowing drift up to this fraction of its own height
  minGapRatio: 0.12,       // horizontal gap between neighbouring words, as a fraction of their height
  cutEarlyFrames: 2,       // a cut lands on the beat or up to this many frames before it
};

// ---------- colour ----------
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
export const luminance = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const contrastRatio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

// Otsu threshold over luminance samples (0..1)
export function otsu(values) {
  const bins = 256, hist = new Array(bins).fill(0);
  for (const v of values) hist[Math.min(bins - 1, Math.floor(v * bins))]++;
  const n = values.length;
  let sum = 0; for (let i = 0; i < bins; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thr = 0;
  for (let i = 0; i < bins; i++) {
    wB += hist[i]; if (!wB) continue;
    const wF = n - wB; if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; thr = i; }
  }
  return (thr + 0.5) / bins;
}

const quantile = (arr, q) => { if (!arr.length) return NaN; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };

// Contrast of a word against what is behind it, from the luminance of the pixels in its box.
// The letters are the minority class of the box; their core (away from anti-aliased edges) is
// compared with the typical background around them.
export function wordContrast(lums) {
  const thr = otsu(lums);
  const lo = lums.filter((v) => v <= thr), hi = lums.filter((v) => v > thr);
  if (!lo.length || !hi.length) return { ratio: 1, ink: 'unknown' };
  const inkIsLight = hi.length < lo.length;
  const ink = inkIsLight ? quantile(hi, 0.75) : quantile(lo, 0.25);
  const bg = inkIsLight ? quantile(lo, 0.5) : quantile(hi, 0.5);
  return { ratio: contrastRatio(ink, bg), ink: inkIsLight ? 'light' : 'dark', inkLum: ink, bgLum: bg };
}

// ---------- motion ----------
// mad[i] = mean absolute difference between frame i and i-1 (mad[0] = Infinity)
export function stillStretches(mad, fps, { stillThreshold = DEFAULTS.stillThreshold, maxStillSeconds = DEFAULTS.maxStillSeconds } = {}) {
  const out = [];
  let a = -1;
  for (let i = 1; i <= mad.length; i++) {
    const still = i < mad.length && mad[i] < stillThreshold;
    if (still && a < 0) a = i - 1;
    if (!still && a >= 0) {
      const secs = (i - 1 - a) / fps;
      if (secs > maxStillSeconds + 1e-9) out.push({ from: a / fps, to: (i - 1) / fps, seconds: +secs.toFixed(3), startFrame: a, endFrame: i - 1 });
      a = -1;
    }
  }
  return out;
}

// A fast move that slams into a dead stop: strong motion over the previous `pre` frames, then
// next to nothing within `post` frames. Frames near a cut are ignored (a cut is not a stop).
export function deadStops(mad, fps, { stillThreshold = DEFAULTS.stillThreshold, cutFrames = [], pre = 6, post = 2, fastFactor = 8 } = {}) {
  const fast = Math.max(3, stillThreshold * fastFactor);
  const nearCut = (i) => cutFrames.some((c) => i >= c - pre - 1 && i <= c + post + 1);
  const out = [];
  for (let i = pre + 1; i + post < mad.length; i++) {
    if (nearCut(i)) continue;
    let s = 0; for (let k = i - pre; k < i; k++) s += mad[k];
    const before = s / pre;
    const after = Math.max(...mad.slice(i, i + post + 1));
    if (before >= fast && after < stillThreshold * 1.5 && mad[i - 1] >= fast * 0.5) {
      out.push({ frame: i, time: i / fps, before: +before.toFixed(2), after: +after.toFixed(2) });
      i += pre;   // one report per stop
    }
  }
  return out;
}

// ---------- cuts ----------
export function cutsOffBeat(scenes, beats, fps, { cutEarlyFrames = DEFAULTS.cutEarlyFrames } = {}) {
  const out = [];
  for (let i = 1; i < scenes.length; i++) {
    const s = scenes[i];
    if (s.offBeat) continue;          // a scene may say why its cut follows the voice instead
    const cut = s.from;
    let best = null;
    for (const b of beats) if (!best || Math.abs(b - cut) < Math.abs(best - cut)) best = b;
    if (best == null) continue;
    const off = Math.round((cut - best) * fps);   // negative: cut before the beat
    if (off > 0 || off < -cutEarlyFrames) {
      const target = Math.round(best * fps) / fps;
      out.push({ id: s.id, cut, beat: best, offFrames: off, target: +target.toFixed(4) });
    }
  }
  return out;
}

// ---------- words ----------
export const norm = (s) => String(s).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}]/gu, '');

// Find the recognised word matching `text` in one OCR frame; returns { box, line } or null.
// `near` (a box) picks the closest when the word appears more than once.
export function findWord(frame, text, near) {
  const want = norm(text);
  if (!want) return null;
  const hits = [];
  for (const line of frame.lines ?? []) {
    for (const w of line.words ?? []) if (norm(w.text) === want) hits.push({ box: w.box, line });
    // spaced-out letters recognised as separate tokens
    const tokens = (line.words ?? []).map((w) => norm(w.text));
    if (!hits.length && tokens.length > 1 && tokens.every((t) => t.length === 1) && tokens.join('') === want) hits.push({ box: line.box, line });
  }
  if (!hits.length) return null;
  if (!near) return hits[0];
  const c = (b) => [b.x + b.w / 2, b.y + b.h / 2];
  const [nx, ny] = c(near);
  return hits.sort((a, b) => Math.hypot(c(a.box)[0] - nx, c(a.box)[1] - ny) - Math.hypot(c(b.box)[0] - nx, c(b.box)[1] - ny))[0];
}

// Words that run together or collide in one frame. `expected` is the lyric words on screen, in order.
export function collisions(frame, expected, { minGapRatio = DEFAULTS.minGapRatio } = {}) {
  const out = [];
  const want = expected.map(norm).filter(Boolean);
  const pairs = new Set();
  for (let i = 0; i + 1 < want.length; i++) pairs.add(want[i] + want[i + 1]);
  for (const line of frame.lines ?? []) {
    const words = line.words ?? [];
    for (const w of words) {
      const n = norm(w.text);
      if (pairs.has(n) && !want.includes(n)) out.push({ kind: 'run-together', text: w.text, box: w.box });
    }
    // Vision sometimes gives every word the whole line's box; geometry is meaningless then
    const degenerate = words.length > 1 && words.every((w) => Math.abs(w.box.w - line.box.w) < 1e-3);
    if (degenerate) continue;
    for (let i = 0; i + 1 < words.length; i++) {
      const a = words[i].box, b = words[i + 1].box;
      const h = Math.min(a.h, b.h);
      const gap = b.x - (a.x + a.w);
      if (gap < -0.1 * h) out.push({ kind: 'overlap', text: `${words[i].text} ${words[i + 1].text}`, box: a, gap: +(gap / h).toFixed(2) });
      else if (gap < minGapRatio * h) out.push({ kind: 'tight', text: `${words[i].text} ${words[i + 1].text}`, box: a, gap: +(gap / h).toFixed(2) });
    }
  }
  // two different recognised lines overlapping each other
  const ls = frame.lines ?? [];
  for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) {
    const a = ls[i].box, b = ls[j].box;
    const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ix > 0 && iy > 0 && ix * iy > 0.15 * Math.min(a.w * a.h, b.w * b.h)) out.push({ kind: 'lines-overlap', text: `${ls[i].text} / ${ls[j].text}`, box: a });
  }
  return out;
}

// When each word should be readable: shortly after it is sung, and still on screen.
export function wordChecks(lyrics, fps, duration, { settleFrames = DEFAULTS.settleFrames } = {}) {
  const lines = lyrics.lines ?? [];
  return (lyrics.words ?? []).map((w, i) => {
    const line = lines.find((l) => w.start >= l.start - 0.05 && w.end <= l.end + 0.05);
    const until = Math.min(duration - 1 / fps, (line?.end ?? w.end) + 0.25);
    const t1 = Math.min(until, w.end + 0.15);
    const t2 = Math.min(duration - 1 / fps, t1 + settleFrames / fps);
    const onScreen = line ? (lyrics.words ?? []).filter((x) => x.start >= line.start - 0.05 && x.end <= line.end + 0.05 && x.start <= t1).map((x) => x.w) : [w.w];
    return { i, word: w.w, start: w.start, end: w.end, f1: Math.round(t1 * fps), f2: Math.round(t2 * fps), onScreen };
  });
}

export function sceneAt(scenes, t) { return scenes?.find((s) => t >= s.from && t < s.to)?.id; }

export function summarize(problems) {
  const fails = problems.filter((p) => p.severity === 'fail');
  const byGate = {};
  for (const p of problems) { byGate[p.gate] ??= { fail: 0, warn: 0 }; byGate[p.gate][p.severity]++; }
  return { passed: fails.length === 0, fails: fails.length, warns: problems.length - fails.length, byGate };
}
