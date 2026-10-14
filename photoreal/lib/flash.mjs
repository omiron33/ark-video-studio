// Flash safety: the WCAG 2.3.1 general flash threshold, measured on the encoded film.
//
// A flash is a PAIR of opposing changes in relative luminance of at least `delta` (10% of the range)
// where the darker state is below 0.8, over at least `area` (a quarter) of the frame. More than `max`
// (3) flashes in any one second fails. The film is read at 96x54 and 24 fps in linear-light relative
// luminance. A dark-to-white-to-dark strobe counts once: each change belongs to one pair only.
// Ported from claudia-bot's slop/render/flash.py (MIT, anabology), which ships the same rule.
//
// Hades gate bursts, lightning, glory breaking through and fast strobe cuts are the moments to
// watch; a film that fails this can hurt a viewer with photosensitive epilepsy, so it is a hard gate.

export const FLASH = { width: 96, height: 54, fps: 24, max: 3, area: 0.25, delta: 0.10, darkBelow: 0.8 };

const LIN = Float32Array.from({ length: 256 }, (_, i) => { const v = i / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });

// one frame of rgb24 bytes -> relative luminance per pixel
export function frameLuminance(rgb) {
  const n = rgb.length / 3, L = new Float32Array(n);
  for (let i = 0, q = 0; i < n; i++, q += 3) L[i] = 0.2126 * LIN[rgb[q]] + 0.7152 * LIN[rgb[q + 1]] + 0.0722 * LIN[rgb[q + 2]];
  return L;
}

// Per frame transition: +1 when at least `area` of the pixels brightened by `delta` (darker side under
// `darkBelow`), -1 when as many darkened, else 0. Index i is the change from frame i to frame i + 1.
export function transitionOf(a, b, { area = FLASH.area, delta = FLASH.delta, darkBelow = FLASH.darkBelow } = {}) {
  const n = a.length;
  let up = 0, dn = 0;
  for (let p = 0; p < n; p++) {
    if (Math.min(a[p], b[p]) >= darkBelow) continue;
    const d = b[p] - a[p];
    if (d >= delta) up++; else if (d <= -delta) dn++;
  }
  return dn / n >= area ? -1 : up / n >= area ? 1 : 0;
}
export function transitions(frames, opts = {}) {
  const ev = new Int8Array(Math.max(0, frames.length - 1));
  for (let i = 0; i + 1 < frames.length; i++) ev[i] = transitionOf(frames[i], frames[i + 1], opts);
  return ev;
}

// Flashes from the transitions: same-direction steps with no opposing change between them are one
// change; every two alternating changes are one flash. Returns the worst count in any 1 s window and
// the windows that break the limit (one report per second of trouble).
export function countFlashes(ev, { fps = FLASH.fps, max = FLASH.max } = {}) {
  const alt = [];
  for (let i = 0; i < ev.length; i++) if (ev[i] && (!alt.length || ev[alt.at(-1)] !== ev[i])) alt.push(i);
  const tt = alt.map((i) => (i + 1) / fps);
  const flashes = tt.filter((_, k) => k % 2 === 0);
  const seconds = (ev.length + 1) / fps;
  let worst = 0; const fails = [];
  for (let s = 0; s < seconds; s += 1 / fps) {
    let c = 0; for (const t of tt) if (t >= s && t < s + 1) c++;
    c = Math.floor(c / 2);
    worst = Math.max(worst, c);
    if (c > max && (!fails.length || s - fails.at(-1).time >= 1)) fails.push({ time: +s.toFixed(3), flashes: c });
  }
  return { seconds: +seconds.toFixed(2), flashes: flashes.length, worstPerSecond: worst, limit: max, fails, flashTimes: flashes.map((t) => +t.toFixed(3)), pass: !fails.length };
}
