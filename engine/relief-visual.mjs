/** Relief: a code-only plate. The ground is a topographic height field drawn as
 * contour lines. Creatures are signed-distance sculptures (smooth unions of
 * capsules) that rise out of it as clay relief; each sung word sends a ripple
 * through the ground; a drain-like vortex can pull the whole field inward.
 * Every frame is a pure function of song time. No images. */

export const RELIEF_CATALOG = {
  relief: 'Code-only topographic clay: creatures rise from the ground as contour relief, sung words ripple the field, a vortex drains it.',
};

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mix = (a, b, v) => a + (b - a) * v;
const smooth = v => { v = clamp(v); return v * v * (3 - 2 * v); };
const inOutCubic = v => { v = clamp(v); return v < .5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; };
const outExpo = v => { v = clamp(v); return v === 1 ? 1 : 1 - Math.pow(2, -10 * v); };
const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };

const BG = '#0E0B09', BONE = '#EFE6D6', VERDIGRIS = '#8FCBB4';

// Value noise with smooth interpolation, two octaves; drifts with time.
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return mix(mix(a, b, u), mix(c, d, u), v);
}
const terrain = (x, y, t) => .55 * noise(x / 260 + t * .1, y / 260 - t * .06) + .3 * noise(x / 110 - t * .16, y / 110 + 7) + .15 * noise(x / 45 + 3, y / 45 + t * .24);

// --- SDF sculpture ----------------------------------------------------------
function capsule(px, py, ax, ay, bx, by, r) {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay || 1));
  return Math.hypot(pax - bax * h, pay - bay * h) - r;
}
const smin = (a, b, k) => { const h = clamp(.5 + .5 * (b - a) / k); return mix(b, a, h) - k * h * (1 - h); };

// Parts are [ax, ay, bx, by, r] in local units (ground at y = 0, up is negative).
const DEER = [
  [-120, -232, 105, -238, 60], [80, -222, 108, -206, 66], [-150, -238, -118, -250, 52],
  [118, -258, 172, -372, 29], [172, -382, 236, -360, 22], [160, -398, 138, -432, 8], [186, -398, 204, -428, 8],
  [168, -400, 150, -498, 7], [150, -498, 118, -560, 6], [157, -468, 200, -520, 5], [132, -534, 98, -566, 4], [118, -560, 132, -604, 4],
  [190, -402, 214, -490, 7], [212, -470, 252, -512, 5], [214, -490, 232, -560, 5], [232, -560, 262, -592, 4],
  [100, -196, 110, -100, 15], [110, -100, 108, -8, 10], [66, -196, 76, -100, 15], [76, -100, 72, -8, 10],
  [-96, -206, -126, -110, 24], [-126, -110, -108, -8, 11], [-64, -206, -84, -110, 21], [-84, -110, -70, -8, 11],
  [-172, -262, -196, -228, 10],
];
const DOE = DEER.slice(0, 5).concat(DEER.slice(16));
const MAN = [
  [0, -548, 0, -536, 42], [0, -500, 0, -474, 20], [-78, -448, 78, -448, 30], [0, -452, 0, -300, 58], [0, -300, 0, -262, 50],
  [-92, -440, -112, -290, 20], [-112, -290, -104, -176, 16], [92, -440, 112, -290, 20], [112, -290, 104, -176, 16],
  [-34, -268, -40, -130, 30], [-40, -130, -42, -8, 20], [34, -268, 40, -130, 30], [40, -130, 42, -8, 20],
];

function sculpt(parts, x, y, { ox, oy, s = 1, flip = 1, k = 18 }) {
  const lx = (x - ox) / s * flip, ly = (y - oy) / s;
  let d = Infinity;
  for (const [ax, ay, bx, by, r] of parts) d = d === Infinity ? capsule(lx, ly, ax, ay, bx, by, r) : smin(d, capsule(lx, ly, ax, ay, bx, by, r), k);
  return d * s;
}
// Height from distance: a rounded mound with many concentric levels inside.
// A carved edge (a small cliff, so several contours stack into an outline)
// then a dome, so the rings spread across the form like modelled clay.
const relief = (d, depth = 70) => d >= 0 ? .1 * Math.exp(-d / 5) : .22 + Math.sqrt(clamp(-d / depth)) * .95 + Math.min(-d, 260) / 520;

// Bird seen from above: body along its heading, wings foreshortened by the flap.
function birdSdf(x, y, b) {
  const dx = x - b.x, dy = y - b.y, c = Math.cos(-b.a), s = Math.sin(-b.a);
  const lx = (dx * c - dy * s) / b.s, ly = (dx * s + dy * c) / b.s;
  const span = 44 * (.35 + .65 * Math.abs(b.flap)), sweep = 12 + 10 * b.flap;
  let d = capsule(lx, ly, -20, 0, 20, 0, 7);
  d = smin(d, capsule(lx, ly, 2, 0, -sweep, -span, 5), 6);
  d = smin(d, capsule(lx, ly, 2, 0, -sweep, span, 5), 6);
  d = smin(d, capsule(lx, ly, -20, 0, -34, -6, 3), 4);
  d = smin(d, capsule(lx, ly, -20, 0, -34, 6, 3), 4);
  return d * b.s;
}

// --- timeline ----------------------------------------------------------------
function words(e) {
  const list = e.s.wordIds.map(id => e.p.words.find(w => w.id === id));
  const at = (name, i) => { const id = e.s.direction?.roles?.[name]; return id ? e.p.words.find(w => w.id === id) : list[i]; };
  return { list, God: at('God', 0), formed: at('formed', 1), beasts: at('beasts', 3), field: at('field', 6), and: at('and', 7), birds: at('birds', 8), sky: at('sky', 11), from: at('from', 12), earth: at('earth', 14), He: at('He', 15), brought: at('brought', 16), Adam: at('Adam', 20) };
}

const DRAIN = [960, 620];

function state(e) {
  const { t, s } = e, W = words(e);
  const rise = smooth((t - W.formed.start + .1) / (W.field.end - W.formed.start + .5));
  const herd = smooth((t - W.beasts.start) / 1.6);
  const flock = W.and ? clamp((t - W.and.start + .1) / 2.6) : 0;
  const earth = W.from ? Math.exp(-Math.pow((t - W.earth.start - .1) / .55, 2)) : 0;
  const drainIn = W.brought ? inOutCubic((t - W.He.start + .1) / Math.max(.8, W.Adam.start - W.He.start + .2)) : 0;
  const drainOut = W.Adam ? smooth((t - W.Adam.start - .1) / 1.1) : 0;
  const swirl = drainIn * (1 - .75 * drainOut);
  const man = W.Adam ? smooth((t - W.Adam.start + .45) / 1.1) : 0;
  const creatures = 1 - smooth((drainIn - .55) / .4);
  return { W, rise, herd, flock, earth, swirl, drainIn, man, creatures, t0: s.start };
}

function birds(t, st) {
  const out = [];
  if (st.flock <= 0) return out;
  for (let i = 0; i < 7; i++) {
    const delay = i * .13, u = clamp((st.flock * 2.6 - delay) / 2.1);
    if (u <= 0) continue;
    const p = inOutCubic(u), jx = (hash(i, 1) - .5) * 260, jy = (hash(i, 2) - .5) * 150;
    // Peel up off the deer's back, arc high, and stream left across the sky.
    const x = mix(1180 + i * 55, 1330 - i * 105 + (hash(i, 3) - .5) * 60, p), y = mix(500, 330 + (i % 3) * 85 + (hash(i, 6) - .5) * 50, p) - Math.sin(p * Math.PI) * 150;
    const vx = -1, vy = -Math.cos(p * Math.PI) * .8 + .2;
    out.push({ x, y, a: Math.atan2(vy, vx), s: mix(.6, 1.7 + hash(i, 4) * .5, smooth(u * 2.5)), flap: Math.sin(t * TAU * (2.1 + hash(i, 5)) + i) });
  }
  return out;
}

function height(x, y, t, st, flock, ripples) {
  // The vortex: rotate and pull sampling outward, so the field appears to
  // spiral in and drain toward the centre.
  let qx = x, qy = y;
  if (st.swirl > 0) {
    const vx = x - DRAIN[0], vy = y - DRAIN[1], r = Math.hypot(vx, vy);
    const th = st.swirl * (7.5 * Math.exp(-r / 420) + 1.2), pull = 1 + st.swirl * 1.6 * Math.exp(-r / 900);
    const c = Math.cos(th), s = Math.sin(th);
    qx = DRAIN[0] + (vx * c - vy * s) * pull; qy = DRAIN[1] + (vx * s + vy * c) * pull;
  }
  let h = terrain(qx, qy, t) * (1.25 + .45 * st.earth);
  if (st.creatures > 0) {
    if (st.rise > 0 && qx > 900 && qx < 1800 && qy > 60 && qy < 900) h += relief(sculpt(DEER, qx, qy, { ox: 1360, oy: 880, s: 1.3 }), 90) * st.rise * st.creatures;
    if (st.herd > 0) {
      if (qx > 170 && qx < 700 && qy > 480 && qy < 910) h += relief(sculpt(DOE, qx, qy, { ox: 430, oy: 900, s: .8, flip: -1 }), 60) * st.herd * .8 * st.creatures;
      if (qx > 560 && qx < 960 && qy > 580 && qy < 930) h += relief(sculpt(DOE, qx, qy, { ox: 770, oy: 920, s: .6 }), 50) * smooth(st.herd * 1.4 - .3) * .7 * st.creatures;
    }
    for (const b of flock) if (Math.abs(qx - b.x) < 140 && Math.abs(qy - b.y) < 140) h += relief(birdSdf(qx, qy, b), 24) * .9 * st.creatures;
  }
  // The man is formed at the drain's centre, outside the vortex's warp.
  if (st.man > 0 && x > 650 && x < 1270 && y > 60 && y < 920) h += relief(sculpt(MAN, x, y, { ox: DRAIN[0], oy: 900, s: 1.1 }), 90) * st.man;
  for (const r of ripples) {
    const d = Math.hypot(x - r.x, y - r.y) - r.age * 520;
    if (d > -70 && d < 70) h += .34 * Math.exp(-d * d / 1100) * Math.exp(-r.age * 1.6);
  }
  return h;
}

// --- contour drawing -----------------------------------------------------------
const STEP = 6, NX = Math.ceil(1920 / STEP) + 1, NY = Math.ceil(1080 / STEP) + 1;
const LEVEL = .075, LEVELS = 40;

function contours(c, H) {
  const paths = Array.from({ length: LEVELS }, () => []);
  for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
    const a = H[j * NX + i], b = H[j * NX + i + 1], d = H[(j + 1) * NX + i], e = H[(j + 1) * NX + i + 1];
    const lo = Math.min(a, b, d, e), hi = Math.max(a, b, d, e);
    const l0 = Math.max(0, Math.ceil(lo / LEVEL)), l1 = Math.min(LEVELS - 1, Math.floor(hi / LEVEL));
    const x = i * STEP, y = j * STEP;
    for (let l = l0; l <= l1; l++) {
      const v = l * LEVEL, pts = [];
      if ((a < v) !== (b < v)) pts.push(x + STEP * (v - a) / (b - a), y);
      if ((b < v) !== (e < v)) pts.push(x + STEP, y + STEP * (v - b) / (e - b));
      if ((d < v) !== (e < v)) pts.push(x + STEP * (v - d) / (e - d), y + STEP);
      if ((a < v) !== (d < v)) pts.push(x, y + STEP * (v - a) / (d - a));
      if (pts.length >= 4) paths[l].push(pts);
    }
  }
  for (let l = 0; l < LEVELS; l++) {
    if (!paths[l].length) continue;
    const u = l / (LEVELS - 1), index = l % 4 === 0;
    // Low ground is dim umber; higher relief warms to clay, peaks go bone.
    const r = Math.round(mix(120, 246, Math.pow(u, .55))), g = Math.round(mix(74, 214, Math.pow(u, 1.05))), bl = Math.round(mix(50, 188, Math.pow(u, 1.5)));
    c.strokeStyle = `rgba(${r},${g},${bl},${mix(.55, 1, Math.pow(u, .5)) * (index ? 1 : .78)})`;
    c.lineWidth = index ? 1.9 : 1;
    c.beginPath();
    for (const p of paths[l]) { c.moveTo(p[0], p[1]); c.lineTo(p[2], p[3]); if (p.length === 8) { c.moveTo(p[4], p[5]); c.lineTo(p[6], p[7]); } }
    c.stroke();
  }
}

function grain(c, t) {
  const frame = Math.floor(t * 24);
  c.save();
  for (let i = 0; i < 3200; i++) {
    const n = i + frame * 3331;
    c.globalAlpha = .025 + hash(n, 9) * .045; c.fillStyle = hash(n, 7) < .5 ? '#000' : '#fff';
    c.fillRect(hash(n, 1) * 1920, hash(n, 2) * 1080, 1.4, 1.4);
  }
  c.restore();
}

// --- type ---------------------------------------------------------------------
const SERIF = 'EB Garamond Italic', CAPS = 'Bebas Neue';
function anchorOf(e) {
  // Where each word sits, for its ripple. Mirrors the layout in typography().
  const W = words(e), L = W.list, map = new Map();
  const put = (w, x, y) => w && map.set(w.id, [x, y]);
  put(W.God, 260, 200); put(W.formed, 560, 200); [2, 3, 4, 5, 6].forEach((i, k) => put(L[i], 170 + k * 120, 300));
  [7, 8, 9, 10, 11].forEach((i, k) => put(L[i], 1300 + k * 110, 160)); [12, 13, 14].forEach((i, k) => put(L[i], 250 + k * 170, 960));
  [15, 16, 17, 18].forEach((i, k) => put(L[i], 200 + k * 160, 200)); put(L[19], 820, 1000); put(W.Adam, 1010, 1000);
  return map;
}

function setWord(c, w, t, x, y, size, { family = SERIF, align = 'left', accent = false, fade = 1, lead = .35 } = {}) {
  if (!w) return 0;
  const text = w.text.replace(/[.,;:]$/, '');
  c.font = `${size}px "${family}"`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  const width = c.measureText(text).width;
  const shown = smooth((t - (w.start - lead)) / .3) * fade;
  if (shown <= 0) return width;
  const left = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
  const sung = t >= w.start, lift = sung ? (1 - outExpo((t - w.start) / .5)) * size * .08 : size * .08;
  c.save(); c.globalAlpha *= shown * (sung ? 1 : .28);
  // Knock the contours out around the letters so the word reads cleanly.
  c.lineJoin = 'round'; c.strokeStyle = BG; c.lineWidth = size * .16; c.strokeText(text, left, y + lift);
  const hot = sung && t < w.end + .35;
  c.fillStyle = hot || accent ? VERDIGRIS : BONE;
  if (hot && !accent) c.globalAlpha *= 1;
  c.fillText(text, left, y + lift);
  if (sung && !hot && !accent) { c.globalAlpha *= 1; c.fillStyle = BONE; c.fillText(text, left, y + lift); }
  c.restore();
  return width;
}

function line(c, e, t, items, x, y, size, opts = {}) {
  let cx = x;
  for (const [w, o] of items) cx += setWord(c, w, t, cx, y, o?.size ?? size, { ...opts, ...o }) + size * .26;
  return cx;
}

// --- style ------------------------------------------------------------------------
function background(c, e) {
  const { t } = e, st = state(e), flock = birds(t, st);
  const anchors = anchorOf(e), ripples = [];
  for (const w of words(e).list) { const age = t - w.start; if (age >= 0 && age < 1.8 && anchors.has(w.id)) { const [x, y] = anchors.get(w.id); ripples.push({ x, y, age }); } }
  // Opening: a pulse from the centre in the first second, before any vocal.
  if (t - st.t0 < 1.6) ripples.push({ x: 1330, y: 700, age: t - st.t0 + .05 });

  c.fillStyle = BG; c.fillRect(0, 0, 1920, 1080);
  // Camera: slow drift, then a turning dive toward the drain.
  const zoom = 1 + .04 * smooth((t - st.t0) / 6) + .22 * st.drainIn * (1 - .5 * st.man), turn = -.06 * st.drainIn;
  c.save(); c.translate(DRAIN[0], DRAIN[1]); c.rotate(turn); c.scale(zoom, zoom); c.translate(-DRAIN[0], -DRAIN[1]);
  const H = new Float32Array(NX * NY);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) H[j * NX + i] = height(i * STEP, j * STEP, t, st, flock, ripples);
  contours(c, H);
  c.restore();
  // Vignette keeps the eye in the relief.
  const g = c.createRadialGradient(960, 560, 380, 960, 560, 1150);
  g.addColorStop(0, 'rgba(14,11,9,0)'); g.addColorStop(1, 'rgba(14,11,9,.78)');
  c.fillStyle = g; c.fillRect(0, 0, 1920, 1080);
}

function typography(c, e) {
  const { t } = e, st = state(e), W = st.W, L = W.list;
  const gone = W.He ? 1 - smooth((t - W.He.start + .35) / .35) : 1;
  // Chapter slug, the only non-lyric text, gone once the voice enters.
  c.save(); c.globalAlpha = smooth((t - st.t0) / .3) * (1 - smooth((t - W.God.start + .2) / .4));
  c.font = `28px "${CAPS}"`; c.fillStyle = BONE; c.letterSpacing = '8px'; c.fillText('GENESIS 2 — THE GARDEN', 110, 120); c.restore();
  line(c, e, t, [[W.God], [W.formed]], 104, 214, 150, { fade: gone });
  line(c, e, t, [[L[2]], [W.beasts, { size: 104 }], [L[4]], [L[5]], [W.field, { size: 104 }]], 110, 322, 78, { fade: gone });
  // Right-aligned by measuring first.
  c.font = `96px "${SERIF}"`;
  const sky = [[W.and], [W.birds, { size: 124 }], [L[9]], [L[10]], [W.sky, { size: 124 }]];
  let width = 0; for (const [w, o] of sky) { c.font = `${o?.size ?? 84}px "${SERIF}"`; width += c.measureText(w.text.replace(/[.,;:]$/, '')).width + 84 * .26; }
  line(c, e, t, sky, 1816 - width, 170, 84, { fade: gone });
  line(c, e, t, [[W.from], [L[13]], [W.earth, { size: 128 }]], 110, 990, 96, { fade: gone });
  if (W.He) {
    line(c, e, t, [[W.He], [W.brought], [L[17]], [L[18]]], 104, 214, 132, { lead: .15 });
    c.font = `150px "${SERIF}"`; const w1 = c.measureText('to').width, w2 = c.measureText('Adam').width;
    line(c, e, t, [[L[19], { size: 96 }], [W.Adam, { size: 150, accent: true }]], 960 - (w1 * .64 + w2 + 25) / 2, 1010, 96, { lead: .15 });
  }
  grain(c, t);
}

export function installRelief(register) {
  register('relief', { background, typography });
}
