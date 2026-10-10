// Motion kit: the camera rig and the animation helpers every film can share, after Lasseter's
// principles of animation (slow in and out only where a move really starts or stops, arcs,
// anticipation, follow-through, overlapping action, timing as weight).
//
// Import from a scene module: import { rig, spring, anticipate } from '/kit/motion.js';
// Files under web/kit/ count toward the cache keys of the scenes that import them, and of no other
// scene, so adding to the kit never re-renders a finished film. Every function is a pure function of
// its arguments: frame t depends only on t.

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, k) => a + (b - a) * k;
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, s) => a.map((v) => v * s);
const len = (a) => Math.hypot(...a);
const nrm = (a) => { const l = len(a) || 1; return a.map((v) => v / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// ---------------------------------------------------------------- noise
// 1D gradient noise, -1..1, smooth (C2), deterministic for a seed
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return s - Math.floor(s); }
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const g0 = hash(i + seed * 57.3) * 2 - 1, g1 = hash(i + 1 + seed * 57.3) * 2 - 1;
  const u = f * f * f * (f * (f * 6 - 15) + 10);
  return 2 * lerp(g0 * f, g1 * (f - 1), u);
}
// layered noise with a natural (1/f) spectrum: what a hand, a breeze or a flame actually does
export function fractal(x, { seed = 0, octaves = 4, gain = 0.55, lacunarity = 2.13 } = {}) {
  let s = 0, a = 1, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) { s += a * noise1(x * f + o * 17.17, seed + o * 3.1); norm += a; a *= gain; f *= lacunarity; }
  return s / norm;
}

// ---------------------------------------------------------------- timing
// Easing as weight. A heavy thing (a stone, a beam, a door) is slow to get going and lands firmly;
// a light thing (cloth, a feather, smoke) gets going at once and floats into place.
export const weight = {
  heavy: (x) => { x = clamp01(x); return x < 0.62 ? 0.5 * (x / 0.62) ** 2.6 : 1 - 0.5 * ((1 - x) / 0.38) ** 2.0; },
  normal: (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2; },
  light: (x) => { x = clamp01(x); return 1 - (1 - x) ** 4; },
};
// 0..1 between t0 and t1 with a weight
export const move = (t, t0, t1, w = weight.normal) => w((t - t0) / Math.max(1e-6, t1 - t0));

// An underdamped spring's step response: 0 before t0, then rising to 1 with a little overshoot and
// settle. freq in Hz, damping 0..1 (1 = critically damped, no overshoot).
export function spring(t, t0, { freq = 2.2, damping = 0.55 } = {}) {
  const x = t - t0;
  if (x <= 0) return 0;
  const w = 2 * Math.PI * freq, z = Math.min(0.999, Math.max(0.05, damping));
  const wd = w * Math.sqrt(1 - z * z), decay = Math.exp(-z * w * x);
  return 1 - decay * (Math.cos(wd * x) + (z * w / wd) * Math.sin(wd * x));
}

// Anticipation: a small wind-up the other way before the move, then the move itself.
// Returns about -back at t0 (the wind-up's deepest point), 0 before t0 - lead, 1 by t0 + dur.
export function anticipate(t, t0, { lead = 0.35, back = 0.12, dur = 0.5, land = weight.light } = {}) {
  if (t < t0 - lead) return 0;
  if (t < t0) { const k = (t - (t0 - lead)) / lead; return -back * (k * k * (3 - 2 * k)); }
  const k = clamp01((t - t0) / dur);
  return lerp(-back, 1, land(k));
}

// Follow-through: a lagged copy of a motion. fn(t) returns a number or an array; the result trails
// it by about `lag` seconds and keeps going for a moment after it stops (an exponential kernel,
// sampled, so it stays a pure function of t).
export function follow(fn, t, lag = 0.2, taps = 16) {
  let acc = null, wsum = 0;
  for (let k = 0; k < taps; k++) {
    const dt = (k / (taps - 1)) * lag * 4, w = Math.exp(-dt / lag);
    const v = fn(t - dt);
    acc = acc === null ? (Array.isArray(v) ? mul(v, w) : v * w) : Array.isArray(v) ? add(acc, mul(v, w)) : acc + v * w;
    wsum += w;
  }
  return Array.isArray(acc) ? mul(acc, 1 / wsum) : acc / wsum;
}

// Overlapping action: the start time of part i of n, spread over `spread` seconds, with a little
// seeded unevenness so a row of things never moves like a machine.
export function stagger(i, n, spread = 0.25, { seed = 0, jitter = 0.3 } = {}) {
  if (n <= 1) return 0;
  const base = (i / (n - 1)) * spread, step = spread / (n - 1);
  return Math.max(0, base + (hash(i * 7.31 + seed) - 0.5) * step * jitter);
}

// ---------------------------------------------------------------- the camera rig
// Paths: centripetal Catmull-Rom through the points (so the camera travels on arcs), measured by
// arc length so the speed along it is what the timing says.
function catmull(p0, p1, p2, p3, u) {
  const d = (a, b) => Math.max(1e-6, Math.sqrt(len(sub(b, a))));
  const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
  const t = lerp(t1, t2, u);
  const L = (a, b, ta, tb) => add(mul(a, (tb - t) / (tb - ta)), mul(b, (t - ta) / (tb - ta)));
  const a1 = L(p0, p1, t0, t1), a2 = L(p1, p2, t1, t2), a3 = L(p2, p3, t2, t3);
  const b1 = L(a1, a2, t0, t2), b2 = L(a2, a3, t1, t3);
  return L(b1, b2, t1, t2);
}
export function curve(points, { closed = false } = {}) {
  const P = points.map((p) => [...p]);
  if (P.length === 1) return { at: () => P[0], length: 0 };
  const n = P.length;
  const get = (i) => closed ? P[(i + n) % n] : i < 0 ? sub(mul(P[0], 2), P[1]) : i >= n ? sub(mul(P[n - 1], 2), P[n - 2]) : P[i];
  const segs = closed ? n : n - 1;
  const raw = (s) => { s = Math.min(segs - 1e-9, Math.max(0, s)); const i = Math.floor(s); return catmull(get(i - 1), get(i), get(i + 1), get(i + 2), s - i); };
  // arc-length table
  const N = 64 * segs, table = [0];
  let prev = raw(0), total = 0;
  for (let k = 1; k <= N; k++) { const q = raw((k / N) * segs); total += len(sub(q, prev)); table.push(total); prev = q; }
  const at = (u) => {
    const target = clamp01(u) * total;
    let lo = 0, hi = N;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (table[mid] < target) lo = mid; else hi = mid; }
    const f = table[hi] > table[lo] ? (target - table[lo]) / (table[hi] - table[lo]) : 0;
    return raw(((lo + f) / N) * segs);
  };
  return { at, length: total };
}

// Hermite timing from 0 to 1 over x in 0..1 with end slopes s0, s1 (in units of the average speed):
// 0 is a standstill, 1 is the average speed. Monotonic for slopes up to 3.
function hermite(x, s0, s1) {
  const x2 = x * x, x3 = x2 * x;
  return (x3 - 2 * x2 + x) * s0 + (-2 * x3 + 3 * x2) + (x3 - x2) * s1;
}

// Hand-held, as a person holding a camera: layered natural noise in position and aim, a slow
// breath, never a periodic wobble. amount 1 is about 1.5 cm and 0.15 degrees; scale for the scene's
// units with `metres` (how many scene units a metre is).
export function handheld(t, { amount = 1, seed = 1, metres = 1 } = {}) {
  const a = amount * metres;
  const f = (k, rate) => fractal(t * rate, { seed: seed * 13.7 + k, octaves: 4 });
  const breath = Math.sin(t * 2 * Math.PI * 0.23 + seed) * 0.35 + fractal(t * 0.11, { seed: seed + 9 }) * 0.65;
  return {
    pos: [0.015 * a * f(1, 0.55), 0.012 * a * (0.6 * f(2, 0.5) + 0.4 * breath), 0.01 * a * f(3, 0.4)],
    // aim offsets in radians: yaw, pitch, roll
    yaw: 0.0026 * amount * f(4, 0.45), pitch: 0.0022 * amount * f(5, 0.5), roll: 0.0018 * amount * f(6, 0.35),
  };
}

// rig(): a camera that moves like it is operated.
//   from, to       the shot (song seconds)
//   path           positions to pass through, in order (two or more), or a fixed [x, y, z]
//   look           what it looks at: points (moved along with the camera), a fixed [x, y, z], or
//                  { ahead: d } to look d units along the path ahead (a walk, a fly-through)
//   enter, exit    'moving' (default): the shot starts or ends at the move's travelling speed,
//                  so a cut lands on a moving camera; 'rest': it starts or ends at a standstill;
//                  or a number, the speed as a multiple of the average speed (match a cut by
//                  giving the next shot the speed the last one left at, see rig.speed)
//   move           [t0, t1] the part of the shot the move takes (default the whole shot); outside
//                  it the camera holds, still hand-held
//   settle         at a 'rest' exit, the operator carries a little past the mark and eases back:
//                  the fraction of the path to overshoot (default 0.004, 0 for none)
//   handheld       amount (default 0.6; 0 for a locked-off tripod), or the handheld() options
//   bank           roll into turns, radians per unit of curvature x speed (default 0, try 0.3 for
//                  a crane or a drone)
//   fov, roll      a number, [start, end] (moved with the same timing as the camera), or a
//                  function of t
//   focus, aperture passed through (numbers or functions of t)
// Returns camera(t) -> { pos, target, fov, roll, focus?, aperture? } with camera.speed(t), the
// travelling speed (scene units per second) for matching the next shot.
export function rig(o) {
  const { from, to } = o;
  const isPts = (p) => Array.isArray(p) && Array.isArray(p[0]);
  const path = isPts(o.path) ? curve(o.path) : { at: () => o.path, length: 0 };
  const look = o.look ?? [0, 0, 0];
  const lookPath = isPts(look) ? curve(look) : null;
  const [m0, m1] = o.move ?? [from, to];
  const T = Math.max(1e-6, m1 - m0);
  const slope = (v) => (v === 'rest' ? 0 : v === 'moving' || v === undefined ? 1 : Math.max(0, Math.min(3, +v)));
  const s0 = slope(o.enter), s1 = slope(o.exit);
  const settle = o.exit === 'rest' ? Math.max(0, o.settle ?? 0.004) : 0;
  const hh = typeof o.handheld === 'object' ? o.handheld : { amount: o.handheld ?? 0.6 };
  const bank = o.bank ?? 0;
  // With a settle, the camera reaches its mark at xa of the move with a little speed left, carries
  // past it by `settle` of the path and eases back, critically damped (one soft return, no wobble).
  const xa = settle > 0 ? 0.8 : 1, tau = (1 - xa) / 4.5;
  const v0 = settle > 0 ? Math.min(1 / xa, (settle * Math.E) / tau) : 0;   // speed at the mark, in u per unit x
  const sa = settle > 0 ? v0 * xa : s1;
  const timing = (t) => {
    const x = (t - m0) / T;
    if (x <= 0) return 0;
    if (settle === 0) return x >= 1 ? 1 : hermite(x, s0, s1);
    if (x < xa) return hermite(x / xa, s0, sa);
    const q = x - xa;
    return 1 + v0 * q * Math.exp(-q / tau);
  };
  const val = (v, t, u) => (typeof v === 'function' ? v(t) : Array.isArray(v) ? lerp(v[0], v[1], u) : v);
  const posAt = (u) => {
    if (u <= 1 || path.length === 0) return path.at(Math.min(1, u));
    const e = path.at(1), d = nrm(sub(e, path.at(0.995)));
    return add(e, mul(d, (u - 1) * path.length));
  };
  const cam = (t) => {
    const u = timing(t);
    const p = posAt(u);
    let target;
    if (lookPath) target = lookPath.at(Math.min(1, u));
    else if (look.ahead !== undefined) { const ua = Math.min(1, u + look.ahead / Math.max(1e-6, path.length)); const pa = path.at(ua); target = ua > u + 1e-6 ? add(p, mul(nrm(sub(pa, p)), look.ahead)) : add(p, mul(nrm(sub(path.at(1), path.at(0.99))), look.ahead)); }
    else target = look;
    let roll = val(o.roll ?? 0, t, clamp01(u));
    const fov = val(o.fov ?? 40, t, clamp01(u));
    // bank into the turn: curvature of the path here times the travelling speed
    if (bank && path.length > 0) {
      const e = 0.01, a = path.at(Math.max(0, u - e)), b = path.at(Math.min(1, u + e)), c = path.at(clamp01(u));
      const t1 = nrm(sub(c, a)), t2 = nrm(sub(b, c)), turn = cross(t1, t2)[1];
      roll += -bank * turn * Math.min(3, cam.speed(t) / Math.max(1e-6, path.length / T));
    }
    // hand-held: offsets in position and aim, in the camera's own frame
    if (hh.amount > 0) {
      const h = handheld(t, hh);
      const ww = nrm(sub(target, p)), uu = nrm(cross(ww, [0, 1, 0])), vv = cross(uu, ww), dist = len(sub(target, p));
      const pos = add(p, add(mul(uu, h.pos[0]), add(mul(vv, h.pos[1]), mul(ww, h.pos[2]))));
      target = add(target, add(mul(uu, h.yaw * dist), mul(vv, h.pitch * dist)));
      roll += h.roll;
      return finish(t, pos, target, fov, roll);
    }
    return finish(t, p, target, fov, roll);
  };
  const finish = (t, pos, target, fov, roll) => {
    const c = { pos, target, fov, roll };
    if (o.focus !== undefined) c.focus = typeof o.focus === 'function' ? o.focus(t) : o.focus;
    if (o.aperture !== undefined) c.aperture = typeof o.aperture === 'function' ? o.aperture(t) : o.aperture;
    return c;
  };
  // travelling speed along the path, scene units per second (no hand-held)
  cam.speed = (t) => { const e = 1 / 240; return Math.abs(timing(t + e) - timing(t - e)) / (2 * e) * path.length; };
  cam.timing = timing;
  return cam;
}
