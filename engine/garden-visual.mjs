/** Garden: the full Genesis 2 film in the code-only relief language.
 * One height field drawn as contour lines is the whole world. Every scene is a
 * height function over that field (creatures, trees, rivers, rings, strata),
 * so a cut between scenes is a morph of the same lines. Words ripple the
 * ground, the measured music breathes it. Pure function of song time. */

export const GARDEN_CATALOG = {
  garden: 'Code-only Genesis 2 relief: one contour field morphs scene to scene (creatures, trees, rivers, rings), sung words ripple it, the music breathes it.',
};

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mix = (a, b, v) => a + (b - a) * v;
const smooth = v => { v = clamp(v); return v * v * (3 - 2 * v); };
const inOut = v => { v = clamp(v); return v < .5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; };
const outExpo = v => { v = clamp(v); return v === 1 ? 1 : 1 - Math.pow(2, -10 * v); };
const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
const tri = v => Math.abs((v % 2 + 2) % 2 - 1);

// A touch lighter than the demo: warm umber ground, bone type, verdigris signal.
const BG = '#2A211A', BONE = '#F1E8D8', VERDIGRIS = '#9AD6BE', CLAY = '#D98A5A';
// Each scene's hue and the spread across its relief levels. The film starts
// muted and grows more vivid toward the creation of man and woman; from Eve on
// it runs in love colours: rose, coral, magenta and gold.
const HUES = {
  title: [28, 30], finished: [210, 80], sixDays: [30, 40], ceased: [200, 30], holy: [45, 30], unwind: [45, 60], strata: [20, 60], range: [15, 90],
  barren: [35, 20], drought: [18, 25], fountain: [185, 40], calmWater: [190, 30], dust: [25, 30], breath: [170, 60], soul: [160, 80],
  garden: [110, 60], placed: [100, 60], orchard: [95, 120], lifeTree: [130, 80], knowing: [300, 120], river: [195, 50], fourHeads: [200, 90],
  gold: [42, 25], gems: [350, 140], geon: [210, 70], twinRivers: [190, 60], wall: [120, 80], furrows: [30, 50], freely: [80, 140],
  forbidden: [355, 40], die: [270, 40], alone: [220, 40], helper: [260, 60], beasts: [28, 50], drain: [20, 280], naming: [50, 120],
  parade: [30, 200], noHelper: [230, 40], trance: [250, 60], rib: [300, 90], woman: [330, 120], brought: [340, 140], bone: [320, 160],
  oneFlesh: [330, 200], noShame: [300, 240], outro: [0, 360],
};
const LOVE = new Set(['woman', 'brought', 'bone', 'oneFlesh', 'noShame', 'outro']);
const vibrancy = (t, scene) => Math.max(.12 + .88 * Math.pow(smooth((t - 8) / 262), 1.15), LOVE.has(scene) ? .96 : 0);
function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360; const a = s * Math.min(l, 1 - l);
  const f = n => { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
const TINTS = [null, [150, 214, 190], [232, 184, 92], [226, 96, 80], [104, 206, 140], [190, 208, 236]];

function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return mix(mix(hash(xi, yi), hash(xi + 1, yi), u), mix(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v);
}
const terrain = (x, y, t) => .55 * noise(x / 260 + t * .06, y / 260 - t * .04) + .3 * noise(x / 110 - t * .1, y / 110 + 7) + .15 * noise(x / 45 + 3, y / 45 + t * .16);

// --- signed-distance sculpture ---------------------------------------------------
function capsule(px, py, ax, ay, bx, by, r) {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay || 1));
  return Math.hypot(pax - bax * h, pay - bay * h) - r;
}
const smin = (a, b, k) => { const h = clamp(.5 + .5 * (b - a) / k); return mix(b, a, h) - k * h * (1 - h); };
function sculpt(parts, x, y, ox, oy, s = 1, flip = 1, k = 18, rot = 0) {
  let lx = (x - ox) / s * flip, ly = (y - oy) / s;
  if (rot) { const c = Math.cos(-rot), n = Math.sin(-rot), rx = lx * c - ly * n; ly = lx * n + ly * c; lx = rx; }
  let d = Infinity;
  for (const [ax, ay, bx, by, r] of parts) { const e = capsule(lx, ly, ax, ay, bx, by, r); d = d === Infinity ? e : smin(d, e, k); }
  return d * s;
}
const relief = (d, depth = 80) => d >= 0 ? .1 * Math.exp(-d / 5) : .22 + Math.sqrt(clamp(-d / depth)) * .95 + Math.min(-d, 260) / 520;

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
const OX = [
  [-150, -220, 120, -230, 88], [120, -230, 175, -250, 70], [175, -250, 240, -200, 40], [238, -204, 262, -180, 30],
  [178, -290, 228, -330, 12], [228, -330, 250, -300, 9], [150, -290, 128, -336, 12], [128, -336, 108, -312, 9],
  [90, -160, 96, -8, 20], [50, -160, 56, -8, 20], [-110, -160, -118, -8, 22], [-70, -160, -76, -8, 22], [-236, -250, -250, -140, 7],
];
const LION = [
  [-150, -200, 100, -210, 62], [120, -250, 120, -250, 92], [150, -250, 210, -236, 40], [100, -170, 104, -8, 18], [70, -170, 74, -8, 18],
  [-120, -170, -126, -8, 20], [-86, -170, -92, -8, 20], [-210, -210, -280, -270, 7], [-280, -270, -300, -250, 12],
];
const MAN = [
  [0, -548, 0, -536, 42], [0, -500, 0, -474, 20], [-78, -448, 78, -448, 30], [0, -452, 0, -300, 58], [0, -300, 0, -262, 50],
  [-92, -440, -112, -290, 20], [-112, -290, -104, -176, 16], [92, -440, 112, -290, 20], [112, -290, 104, -176, 16],
  [-34, -268, -40, -130, 30], [-40, -130, -42, -8, 20], [34, -268, 40, -130, 30], [40, -130, 42, -8, 20],
];
const WOMAN = [
  [0, -532, 0, -522, 38], [-30, -540, -44, -420, 16], [30, -540, 44, -420, 16], [0, -488, 0, -462, 17], [-64, -436, 64, -436, 24],
  [0, -440, 0, -330, 46], [0, -330, 0, -260, 38], [-60, -262, 60, -262, 44],
  [-80, -428, -100, -290, 17], [-100, -290, -94, -180, 14], [80, -428, 100, -290, 17], [100, -290, 94, -180, 14],
  [-30, -250, -34, -130, 27], [-34, -130, -36, -8, 17], [30, -250, 34, -130, 27], [34, -130, 36, -8, 17],
];
const RIB = [[-60, -40, 0, -70, 12], [0, -70, 60, -40, 12]];

function birdSdf(x, y, bx, by, a, s, flap) {
  const dx = x - bx, dy = y - by, c = Math.cos(-a), n = Math.sin(-a);
  const lx = (dx * c - dy * n) / s, ly = (dx * n + dy * c) / s;
  const span = 44 * (.35 + .65 * Math.abs(flap)), sweep = 18 + 10 * flap;
  let d = capsule(lx, ly, -22, 0, 22, 0, 7);
  d = smin(d, capsule(lx, ly, 4, 0, -sweep, -span, 5), 6);
  d = smin(d, capsule(lx, ly, 4, 0, -sweep, span, 5), 6);
  d = smin(d, capsule(lx, ly, -22, 0, -38, -7, 3), 4);
  d = smin(d, capsule(lx, ly, -22, 0, -38, 7, 3), 4);
  return d * s;
}

// Voronoi: distance to the nearest cell edge, plus the cell's id.
function voronoi(x, y, size, seed = 1) {
  const gx = Math.floor(x / size), gy = Math.floor(y / size);
  let f1 = 1e9, f2 = 1e9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = (gx + i + .15 + .7 * hash(gx + i + seed, gy + j)) * size, cy = (gy + j + .15 + .7 * hash(gx + i, gy + j + seed * 7)) * size;
    const d = Math.hypot(x - cx, y - cy);
    if (d < f1) { f2 = f1; f1 = d; id = hash(gx + i + 3, gy + j + 9); } else if (d < f2) f2 = d;
  }
  return [f2 - f1, id, f1];
}

function segDist(x, y, pts) {
  let best = 1e9, along = 0, acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    const h = clamp(((x - ax) * dx + (y - ay) * dy) / (L * L)), d = Math.hypot(x - ax - dx * h, y - ay - dy * h);
    if (d < best) { best = d; along = acc + h * L; }
    acc += L;
  }
  return [best, along];
}
const wave = (pts, amp, freq, phase) => pts.map(([x, y], i) => [x, y + Math.sin(i * freq + phase) * amp]);

// --- text relief (for a few carved words) -------------------------------------------
const STEP = 6, NX = Math.ceil(1920 / STEP) + 1, NY = Math.ceil(1080 / STEP) + 1;
const textFields = new Map();
let CanvasCtor = null;
function textField(key, text, font, x, y, align = 'center') {
  if (textFields.has(key)) return textFields.get(key);
  let cv;
  if (globalThis.OffscreenCanvas) cv = new OffscreenCanvas(NX, NY); else cv = new CanvasCtor(NX, NY);
  const c = cv.getContext('2d');
  c.fillStyle = '#000'; c.fillRect(0, 0, NX, NY); c.scale(1 / STEP, 1 / STEP);
  c.font = font; c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(text, x, y);
  const data = c.getImageData(0, 0, NX, NY).data;
  let a = new Float32Array(NX * NY);
  for (let i = 0; i < a.length; i++) a[i] = data[i * 4] / 255;
  // Three box blurs round the letters into a carved mound.
  for (let pass = 0; pass < 2; pass++) {
    const b = new Float32Array(a.length);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      let s = 0, n = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < NX && jj < NY) { s += a[jj * NX + ii]; n++; } }
      b[j * NX + i] = s / n;
    }
    a = b;
  }
  textFields.set(key, a);
  return a;
}

// --- music -------------------------------------------------------------------------
function envelope(p, name, t) {
  const a = p.analysis; if (!a?.[name]) return 0;
  const i = t * a.envelopeRate, i0 = Math.floor(i), f = i - i0, v = a[name];
  return mix(v[clamp(i0, 0, v.length - 1)] ?? 0, v[clamp(i0 + 1, 0, v.length - 1)] ?? 0, f);
}
function pulse(p, t, list = 'beats', decay = 7) {
  const src = list === 'kicks' ? (p.analysis?.kicks ?? []) : (p.beats ?? []);
  let lo = 0, hi = src.length - 1, best = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1, bt = typeof src[m] === 'number' ? src[m] : src[m].time; if (bt <= t) { best = m; lo = m + 1; } else hi = m - 1; }
  if (best < 0) return 0;
  const b = src[best], bt = typeof b === 'number' ? b : b.time, st = typeof b === 'number' ? 1 : (b.strength ?? 1);
  return Math.exp(-(t - bt) * decay) * (list === 'kicks' ? 1 : .4 + .6 * st);
}

// --- scenes ---------------------------------------------------------------------------
// Each scene: h(x, y, q) adds height; tint(x, y, q) picks a colour band;
// cam(q) frames it; ground scales the base terrain. q carries time, local
// progress u, the section's words and music.
const W = (q, i) => q.words[i] ?? q.words.at(-1);
const born = (q, i, lead = 0, dur = .6) => smooth((q.t - W(q, i).start + lead) / dur);
// By word text, so a scene does not depend on how its section is split.
const find = (q, text) => q.words.find(w => w.text.toLowerCase().replace(/[^a-z']/g, '') === text) ?? q.words.at(-1);
const bw = (q, text, lead = 0, dur = .6) => smooth((q.t - find(q, text).start + lead) / dur);
const at = (q, sec, dur = .8) => smooth((q.t - q.s.start - sec) / dur);

const DRAIN = [960, 620];
const SCENES = {
  title: {
    ground: q => .9 + .5 * q.rms,
    h(x, y, q) {
      const f = textField('title', 'GENESIS 2', `330px "Bebas Neue"`, 960, 470);
      const g = textField('title2', 'THE GARDEN', `190px "Bebas Neue"`, 960, 720);
      const i = Math.round(y / STEP) * NX + Math.round(x / STEP);
      return f[i] * 1.2 * at(q, .2, 2.2) + g[i] * .9 * at(q, 3.5, 2) + ring(x, y, 960, 540, q.t - q.s.start, 420, .3);
    },
    texts: q => [{ text: 'GENESIS 2', font: `330px "Bebas Neue"`, x: 960, y: 470, w: at(q, .2, 2.2) }, { text: 'THE GARDEN', font: `190px "Bebas Neue"`, x: 960, y: 720, w: at(q, 3.5, 2) }],
    cam: q => ({ zoom: 1.1 - .1 * inOut(q.u), rot: .02 * (1 - q.u) }),
  },
  finished: {
    // Heavens above as orbit rings, earth below as ground; "finished" locks them.
    ground: q => .8,
    h(x, y, q) {
      const r = Math.hypot(x - 960, y - 260 + 60 * q.u), lock = bw(q, 'finished', .1, .5);
      const orbits = .55 * tri(r / 38 - q.t * (1 - lock) * .6) * smooth((620 - r) / 200) * (y < 560 ? 1 : smooth((700 - y) / 140));
      const world = bw(q, 'world', 0, 1.2) * relief(Math.hypot(x - 960, y - 560) - 380, 260) * .5;
      return orbits * (1 - bw(q, 'world', 0, 1.2) * .6) + world;
    },
    cam: q => ({ zoom: 1 + .08 * q.u }),
  },
  sixDays: {
    ground: q => .7,
    h(x, y, q) {
      let h = 0;
      for (let k = 0; k < 6; k++) {
        const cx = 260 + k * 280, rise = smooth((q.t - q.s.start - .3 - k * .62) / .45);
        if (rise > 0) h += rise * relief(capsule(x, y, cx - 20 + 40 * hash(k, 2), 900, cx + (hash(k, 3) - .5) * 120, 330 + 200 * hash(k, 4), 46 + 44 * hash(k, 5)), 90) * .85;
      }
      return h;
    },
    cam: q => ({ zoom: 1.02, y: -20 * q.u }),
  },
  ceased: {
    // Rest: the field freezes and flattens into long calm lines.
    ground: q => 1.1 * (1 - .75 * inOut(q.u * 1.3)), freeze: true,
    h: (x, y, q) => (y / 1080) * 1.1 * inOut(q.u * 1.3) + .05 * Math.sin(x / 300 + y / 170) * (1 - q.u),
    cam: q => ({ zoom: 1.04 - .04 * q.u }),
  },
  holy: {
    ground: q => .45,
    h(x, y, q) {
      const dx = x - 960, dy = y - 560, r = Math.hypot(dx, dy), th = Math.atan2(dy, dx), grow = at(q, 0, 2.2);
      const petal = r / (330 * grow + 1) * (1 - .28 * Math.cos(7 * th + q.t * .3));
      const rose = petal < 1 ? .25 + .9 * (1 - petal) + .35 * tri((1 - petal) * 7) : 0;
      const f = textField('holy', 'holy', `italic 260px "EB Garamond Italic"`, 960, 560);
      return rose * grow + f[Math.round(y / STEP) * NX + Math.round(x / STEP)] * bw(q, 'holy', .2, .8) * .9;
    },
    tint: (x, y, q) => Math.hypot(x - 960, y - 560) < 360 * at(q, 0, 2.2) ? 2 : 0,
    texts: q => [{ text: 'holy', font: `italic 260px "EB Garamond Italic"`, x: 960, y: 560, w: bw(q, 'holy', .2, .8) }],
    cam: q => ({ zoom: 1 + .06 * q.u, rot: -.03 * q.u }),
  },
  unwind: {
    ground: q => .5 + .3 * q.u,
    h(x, y, q) {
      const dx = x - 960, dy = y - 560, r = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
      const spin = (1 - inOut(q.u)) * 1.4;
      return .55 * tri(r / 46 - th / TAU * 7 + spin * q.u * 6) * smooth((700 - r) / 300) * (1 - .6 * q.u);
    },
    tint: (x, y, q) => Math.hypot(x - 960, y - 560) < 320 * (1 - q.u) ? 2 : 0,
    cam: q => ({ zoom: 1.06 - .06 * q.u, rot: -.03 + .03 * q.u }),
  },
  strata: {
    // Earth in section: stacked layers, as if the story were being read in rock.
    ground: q => .25,
    h(x, y, q) {
      const slide = q.t * 18, fold = .25 * Math.sin(x / 260 + q.u * 2) * at(q, 1, 3);
      return 1.6 * (y + 40 * Math.sin((x + slide) / 330) + 20 * Math.sin((x - slide * 1.7) / 97)) / 1080 * 1.4 + fold + .06 * noise(x / 40, y / 40);
    },
    cam: q => ({ zoom: 1.02 + .04 * q.u, x: -30 * q.u }),
  },
  range: {
    ground: q => .6,
    h(x, y, q) {
      const peaks = [[380, 520, 300], [760, 470, 360], [1150, 500, 330], [1540, 540, 280]];
      let h = 0;
      peaks.forEach(([px, py, r], i) => { const up = smooth((q.t - q.s.start - .2 - i * .35) / 1); h += up * .9 * Math.max(0, 1 - Math.hypot((x - px) / r, (y - py) / (r * .75))) ** 1.4 * 1.8; });
      return h;
    },
    cam: q => ({ zoom: 1.08 - .08 * q.u, y: 20 * q.u }),
  },
  barren: {
    // No herbs yet: a grid of shallow pits waiting to be filled.
    ground: q => .55,
    h(x, y, q) {
      const gx = ((x + 60) % 120) - 60, gy = ((y + 60) % 120) - 60, d = Math.hypot(gx, gy);
      return -.35 * smooth((22 - d) / 10) * at(q, .1, 1.5) + .08 * Math.sin(x / 90);
    },
    cam: q => ({ zoom: 1.12 - .06 * q.u, rot: .015 }),
  },
  drought: {
    ground: q => .45,
    h(x, y, q) {
      const [edge] = voronoi(x, y, 150, 3), crack = at(q, 0, 2.4);
      return .9 - .8 * smooth((10 - edge) / 10) * crack + .3 * smooth(edge / 60);
    },
    cam: q => ({ zoom: 1 + .05 * q.u }),
  },
  fountain: {
    ground: q => .5,
    h(x, y, q) {
      const r = Math.hypot(x - 960, y - 600), front = (q.t - q.s.start) * 190;
      const [edge] = voronoi(x, y, 150, 3), healed = smooth((front - r) / 180);
      const rings = .35 * Math.sin(r / 22 - (q.t - q.s.start) * 7) * Math.exp(-Math.abs(r - front) / 260) * smooth(front / 60);
      return (.9 - .8 * smooth((10 - edge) / 10) + .3 * smooth(edge / 60)) * (1 - healed) + healed * .6 + rings + relief(r - 40, 50) * .8;
    },
    tint: (x, y, q) => Math.hypot(x - 960, y - 600) < (q.t - q.s.start) * 190 ? 1 : 0,
    cam: q => ({ zoom: 1.05 + .05 * q.u }),
  },
  calmWater: {
    ground: q => .6 + .2 * q.rms,
    h: (x, y, q) => .25 * Math.sin(Math.hypot(x - 960, y - 600) / 30 - q.t * 2) * .5,
    tint: () => 1,
    cam: q => ({ zoom: 1.08 }),
  },
  dust: {
    // The man assembles from the soil: each patch rises when the noise lets it.
    ground: q => .7,
    h(x, y, q) {
      if (x < 600 || x > 1320) return 0;
      const m = relief(sculpt(MAN, x, y, 960, 960, 1.35), 100) * 1.1;
      const gate = smooth((q.u * 1.4 - noise(x / 26, y / 26) * .8 - .1) * 5);
      return m * gate;
    },
    cam: q => ({ zoom: 1.1 - .1 * inOut(q.u), y: -30 * q.u }),
  },
  breath: {
    ground: q => .55,
    h(x, y, q) {
      const m = x > 600 && x < 1320 ? relief(sculpt(MAN, x, y, 960, 960, 1.35), 100) * 1.1 : 0;
      const face = Math.hypot(x - 960, y - 220), gust = q.t - q.s.start;
      const wind = .3 * Math.sin((x - 1900) / 40 + gust * 9) * smooth((gust * 700 - (1900 - x)) / 300) * Math.exp(-Math.abs(y - 230) / 170) * (x > 1000 ? 1 : smooth((x - 900) / 100));
      return m + wind + .5 * Math.exp(-face / 60) * smooth((gust - 1.2) / .6);
    },
    tint: (x, y, q) => Math.hypot(x - 960, y - 230) < 110 * smooth((q.t - q.s.start - 1.2) / .6) ? 1 : 0,
    cam: q => ({ zoom: 1.12, y: 30 }),
  },
  soul: {
    ground: q => .5,
    h(x, y, q) {
      if (x < 560 || x > 1360) return 0;
      const beat = pulse(q.p, q.t, 'beats', 5);
      return relief(sculpt(MAN, x, y, 960, 960, 1.35), 100) * (1.1 + .35 * beat);
    },
    tint: (x, y, q) => x > 860 && x < 1060 && y > 300 && y < 560 ? 1 : 0,
    cam: q => ({ zoom: 1 + .03 * q.u }),
  },
  garden: {
    // Planted eastward: the field pans east while saplings rise in rows.
    ground: q => .6,
    h(x, y, q) {
      const pan = inOut(q.u) * 500, wx = x + pan;
      let h = 0;
      for (let k = 0; k < 12; k++) {
        const tx = 300 + k * 170, ty = 470 + (k % 3) * 170, rise = smooth((q.t - q.s.start - .2 - k * .22) / .6);
        if (rise > 0 && Math.abs(wx - tx) < 150 && Math.abs(y - ty) < 150) h += rise * relief(Math.hypot(wx - tx, y - ty) - 60 - 12 * (k % 2), 60) * .9;
      }
      const f = textField('edem', 'Edem', `italic 230px "EB Garamond Italic"`, 1440, 800);
      return h + f[Math.round(y / STEP) * NX + Math.round(x / STEP)] * bw(q, 'edem', .1, .7) * .9;
    },
    tint: (x, y, q) => 4 * (y < 780 ? 1 : 0) * (at(q, 0, 2) > .5 ? 1 : 0),
    texts: q => [{ text: 'Edem', font: `italic 230px "EB Garamond Italic"`, x: 1440, y: 800, w: bw(q, 'edem', .1, .7) }],
    cam: q => ({ zoom: 1.04 }),
  },
  placed: {
    ground: q => .6,
    h(x, y, q) {
      let h = 0;
      for (let k = 0; k < 9; k++) { const tx = 180 + k * 200, ty = 380 + (k % 2) * 380; if (Math.abs(x - tx) < 140 && Math.abs(y - ty) < 140) h += relief(Math.hypot(x - tx, y - ty) - 70, 60) * .85; }
      const set = inOut(q.u * 1.3);
      if (x > 780 && x < 1140) h += relief(sculpt(MAN, x, y, 960, mix(1240, 820, set), .8), 70) * set;
      return h;
    },
    tint: (x, y) => Math.abs(x - 960) > 190 ? 4 : 0,
    cam: q => ({ zoom: 1.12 - .08 * q.u }),
  },
  orchard: {
    // Every tree: canopies seen from above, popping open on the beat.
    ground: q => .55,
    h(x, y, q) {
      const cx = Math.floor(x / 190), cy = Math.floor(y / 190), ox = (cx + .5) * 190 + (hash(cx, cy) - .5) * 60, oy = (cy + .5) * 190 + (hash(cy, cx) - .5) * 60;
      const idx = (cx * 7 + cy * 3) % 23, open = smooth((q.t - q.s.start - idx * .18) / .35);
      const r = Math.hypot(x - ox, y - oy), crown = relief(r - 72 * open, 50) * open;
      const fruit = open > .9 && hash(cx + 5, cy) > .4 ? relief(Math.hypot(x - ox - 30 * Math.cos(idx), y - oy - 30 * Math.sin(idx)) - 14, 10) * .7 : 0;
      return crown + fruit + .3 * tri(r / 16) * open * smooth((70 - r) / 20);
    },
    tint: (x, y) => { const cx = Math.floor(x / 190), cy = Math.floor(y / 190); return hash(cx + 5, cy) > .4 ? 3 : 4; },
    cam: q => ({ zoom: 1 + .08 * q.u, rot: .02 * q.u }),
  },
  lifeTree: {
    // The tree of life as its own cross-section: rings in the middle of it all.
    ground: q => .4,
    h(x, y, q) {
      const r = Math.hypot(x - 960, y - 560), th = Math.atan2(y - 560, x - 960), grow = at(q, 0, 1.6);
      const wob = 12 * noise(th * 3 + 10, r / 90) + 8 * Math.sin(th * 5 + r / 70);
      return r < 460 * grow ? .3 + .7 * tri((r + wob) / 20) * (1 - r / 520) + (1 - r / 460) * .6 : 0;
    },
    tint: (x, y) => Math.hypot(x - 960, y - 560) < 60 ? 1 : 0,
    cam: q => ({ zoom: 1.02 + .1 * q.u, rot: .05 * q.u }),
  },
  knowing: {
    ground: q => .4,
    h(x, y, q) {
      const r1 = Math.hypot(x - 620, y - 560), r2 = Math.hypot(x - 1300, y - 560), g = at(q, 0, 1.2);
      const t1 = r1 < 330 ? .3 + .7 * tri(r1 / 20) * (1 - r1 / 380) + (1 - r1 / 330) * .5 : 0;
      const t2 = r2 < 330 * g ? .3 + .7 * tri((r2 + 8 * Math.sin(Math.atan2(y - 560, x - 1300) * 2)) / 20) * (1 - r2 / 380) + (1 - r2 / 330) * .5 : 0;
      return t1 * .7 + t2;
    },
    // Good and evil: the second tree splits into two colours down its middle.
    tint: (x, y) => Math.hypot(x - 1300, y - 560) < 330 ? (x < 1300 ? 1 : 3) : Math.hypot(x - 620, y - 560) < 330 ? 4 : 0,
    cam: q => ({ zoom: 1.02, x: 60 * q.u }),
  },
  river: {
    ground: q => .6,
    h(x, y, q) {
      const path = wave([[-100, 560], [300, 520], [700, 620], [1100, 520], [1500, 600], [2020, 560]], 50, 1.3, q.t * .4);
      const [d, along] = segDist(x, y, path), reach = (q.t - q.s.start) * 900;
      if (along > reach + 200) return 0;
      const bed = -.9 * smooth((70 - d) / 50) * smooth((reach - along) / 200);
      const flow = .12 * Math.sin(along / 30 - q.t * 8) * smooth((60 - d) / 40);
      return bed + flow + .25 * smooth((d - 70) / 40) * Math.exp(-d / 300);
    },
    tint: (x, y, q) => segDist(x, y, wave([[-100, 560], [300, 520], [700, 620], [1100, 520], [1500, 600], [2020, 560]], 50, 1.3, q.t * .4))[0] < 90 ? 1 : 0,
    cam: q => ({ zoom: 1.05, x: -60 * q.u }),
  },
  fourHeads: {
    ground: q => .6,
    h(x, y, q) {
      const dx = x - 960, dy = y - 560, r = Math.hypot(dx, dy), th = Math.atan2(dy, dx), split = at(q, 0, 1.4);
      let best = 1e9;
      for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + .4 + .35 * Math.sin(r / 180 + k); let d = Math.abs(((th - a + Math.PI) % TAU + TAU) % TAU - Math.PI) * r; best = Math.min(best, d); }
      return -.9 * smooth((60 - best) / 40) * smooth((split * 900 - r) / 100) + .3 * relief(r - 70, 40) + .1 * Math.sin(r / 25 - q.t * 6) * smooth((60 - best) / 40);
    },
    tint: (x, y, q) => 1,
    cam: q => ({ zoom: 1.12 - .12 * q.u, rot: -.05 * q.u }),
  },
  gold: {
    // Phisom circling Evilat: a loop of river, the land inside turns gold.
    ground: q => .7,
    h(x, y, q) {
      const r = Math.hypot((x - 980) / 1.25, y - 560), loop = (q.t - q.s.start) / 2.2;
      const th = (Math.atan2(y - 560, (x - 980) / 1.25) + Math.PI) / TAU;
      const bed = Math.abs(r - 330) < 55 && th < loop ? -.9 * smooth((55 - Math.abs(r - 330)) / 30) : 0;
      const land = r < 280 ? .6 + .45 * tri(noise(x / 70, y / 70) * 6 + q.t * .2) : 0;
      return bed + land * at(q, 1.5, 1.5);
    },
    tint: (x, y, q) => { const r = Math.hypot((x - 980) / 1.25, y - 560); return Math.abs(r - 330) < 60 ? 1 : r < 280 && at(q, 1.5, 1.5) > .2 ? 2 : 0; },
    cam: q => ({ zoom: 1.03 + .06 * q.u }),
  },
  gems: {
    // Carbuncle and emerald: a faceted crystal field.
    ground: q => .2,
    h(x, y, q) {
      const [edge, id] = voronoi(x, y, 130, 11), grow = smooth((q.t - q.s.start - id * 1.2) / .4);
      return grow * (.25 + Math.min(edge, 70) / 70 * 1.4) + (1 - grow) * .1;
    },
    tint: (x, y, q) => { const [, id] = voronoi(x, y, 130, 11); return q.t - q.s.start < 1.6 ? 2 : id < .45 ? 3 : id < .9 ? 4 : 2; },
    cam: q => ({ zoom: 1.08 - .08 * q.u, rot: .03 * q.u }),
  },
  geon: {
    ground: q => .7,
    h(x, y, q) {
      const path = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU * clamp((q.t - q.s.start) / 2.6); path.push([960 + Math.cos(a - 1.2) * (380 + 60 * Math.sin(a * 3)), 560 + Math.sin(a - 1.2) * (290 + 40 * Math.cos(a * 2))]); }
      const [d, along] = segDist(x, y, path);
      return -.9 * smooth((55 - d) / 35) + .12 * Math.sin(along / 28 - q.t * 7) * smooth((50 - d) / 30) + .5 * relief(Math.hypot((x - 960) / 1.3, y - 560) - 250, 200);
    },
    tint: (x, y, q) => 1,
    cam: q => ({ zoom: 1.02 + .06 * q.u, rot: .04 * q.u }),
  },
  twinRivers: {
    // Tigris and Euphrates: two rivers running together across the land.
    ground: q => .7,
    h(x, y, q) {
      const flow = (q.t - q.s.start) * 700;
      const a = wave([[1980, 150], [1500, 330], [1100, 460], [700, 640], [300, 820], [-60, 960]], 36, 1.7, 0);
      const b = wave([[1980, 380], [1560, 520], [1160, 640], [760, 770], [360, 900], [-60, 1030]], 30, 1.4, 1);
      const [da, la] = segDist(x, y, a), [db, lb] = segDist(x, y, b);
      const second = bw(q, 'euphrates', .2, .8);
      return -.85 * smooth((42 - da) / 26) * smooth((flow - la) / 200) - .85 * smooth((42 - db) / 26) * smooth((flow - lb) / 200) * second + .1 * Math.sin((la + lb) / 40 - q.t * 7) * smooth((40 - Math.min(da, db)) / 20);
    },
    tint: (x, y, q) => 1,
    cam: q => ({ zoom: 1.04, x: 40 * q.u, y: -30 * q.u }),
  },
  wall: {
    // The garden of Delight: a ring wall, the man set down inside it.
    ground: q => .6,
    h(x, y, q) {
      const r = Math.hypot(x - 960, y - 600), wall = relief(Math.abs(r - 430) - 16, 20) * at(q, 0, 1.2);
      const set = inOut((q.t - q.s.start - .4) / 2.2);
      const man = x > 820 && x < 1100 ? relief(sculpt(MAN, x, y, 960, mix(200, 830, set), .55), 50) * set : 0;
      const bloom = r < 400 ? .25 * tri(noise(x / 60, y / 60) * 5) * bw(q, 'delight', 0, 1) : 0;
      return wall + man + bloom;
    },
    tint: (x, y) => Math.hypot(x - 960, y - 600) < 410 ? 4 : 0,
    cam: q => ({ zoom: 1.1 - .1 * inOut(q.u) }),
  },
  furrows: {
    // To tend it and keep it: the ground combed into rows, turning with him.
    ground: q => .3,
    h(x, y, q) {
      const a = .5 + .4 * q.u, v = x * Math.cos(a) + y * Math.sin(a), comb = at(q, 0, 1.2);
      const along = x * -Math.sin(a) + y * Math.cos(a);
      const done = smooth(((q.t - q.s.start) * 900 - along - 400) / 200);
      return comb * .45 * tri(v / 32) * done + (x > 860 && x < 1060 ? relief(sculpt(MAN, x, y, 960, 900, .6), 50) : 0);
    },
    tint: (x, y, q) => 0,
    cam: q => ({ zoom: 1.04, rot: .03 }),
  },
  freely: {
    ground: q => .55,
    h(x, y, q) {
      const cx = Math.floor(x / 160), cy = Math.floor(y / 160), ox = (cx + .5) * 160, oy = (cy + .5) * 160;
      const r = Math.hypot(x - ox, y - oy), beat = pulse(q.p, q.t, 'beats', 4);
      return relief(r - 52 - 10 * beat, 40) * at(q, 0, .8) + .3 * relief(Math.hypot(x - ox - 20, y - oy - 16) - 14, 10);
    },
    tint: (x, y) => hash(Math.floor(x / 160), Math.floor(y / 160)) > .5 ? 3 : 4,
    cam: q => ({ zoom: 1.05 + .05 * q.u }),
  },
  forbidden: {
    // One tree the lines will not cross.
    ground: q => .9,
    h(x, y, q) {
      const r = Math.hypot(x - 960, y - 560), push = at(q, 0, 1.4);
      const tree = r < 220 ? .3 + .7 * tri(r / 18) * (1 - r / 260) + (1 - r / 220) * .5 : 0;
      return tree + push * (.9 * Math.exp(-Math.pow((r - 290) / 60, 2)) - .5 * smooth((r - 220) / 10) * smooth((360 - r) / 50));
    },
    tint: (x, y) => { const r = Math.hypot(x - 960, y - 560); return r < 220 ? (x < 960 ? 1 : 3) : 0; },
    cam: q => ({ zoom: 1.06 + .1 * q.u }),
  },
  die: {
    // Surely die: the ground sinks slowly into a hollow at the tree.
    ground: q => .9 * (1 - .4 * q.u),
    h(x, y, q) {
      const r = Math.hypot(x - 960, y - 560), sink = inOut(q.u);
      return 1.3 - 1.25 * sink * Math.exp(-r * r / (2 * 300 * 300)) + .25 * tri(r / 34 + sink * 2) * sink * Math.exp(-r / 500) + (r < 200 ? .5 * (1 - sink) * tri(r / 18) : 0);
    },
    tint: (x, y) => Math.hypot(x - 960, y - 560) < 200 ? 3 : 0,
    cam: q => ({ zoom: 1.02 + .18 * inOut(q.u), rot: -.04 * q.u }),
  },
  alone: {
    ground: q => .5,
    h(x, y, q) {
      const man = x > 1250 && x < 1510 ? relief(sculpt(MAN, x, y, 1380, 900, .55), 50) : 0;
      return man + .45 * Math.exp(-Math.pow((Math.hypot(x - 1380, y - 740) - 260 - 40 * q.u) / 30, 2)) * at(q, 1, 1.4);
    },
    cam: q => ({ zoom: 1.1 - .1 * q.u }),
  },
  helper: {
    ground: q => .5,
    h(x, y, q) {
      const man = x > 1250 && x < 1510 ? relief(sculpt(MAN, x, y, 1380, 900, .55), 50) : 0;
      const ghost = x > 410 && x < 670 ? relief(sculpt(MAN, x, y, 540, 900, .55, -1), 50) * .35 * Math.sin(Math.PI * clamp(q.u * 1.1)) : 0;
      return man + ghost;
    },
    cam: q => ({ zoom: 1 }),
  },
  beasts: {
    ground: q => 1.25,
    h(x, y, q) {
      const rise = bw(q, 'formed', .1, 2.4), herd = bw(q, 'beasts', 0, 1.6), birdsOn = clamp((q.t - find(q, 'birds').start + .6) / 2.6);
      let h = 0;
      if (rise > 0 && x > 900 && x < 1800 && y > 60 && y < 900) h += relief(sculpt(DEER, x, y, 1360, 880, 1.3), 90) * rise;
      if (herd > 0 && x > 170 && x < 700 && y > 480 && y < 910) h += relief(sculpt(DOE, x, y, 430, 900, .8, -1), 60) * herd * .8;
      if (herd > 0 && x > 560 && x < 960 && y > 580 && y < 930) h += relief(sculpt(DOE, x, y, 770, 920, .6), 50) * smooth(herd * 1.4 - .3) * .7;
      if (birdsOn > 0) for (let i = 0; i < 7; i++) {
        const u = clamp((birdsOn * 2.6 - i * .13) / 2.1); if (u <= 0) continue;
        const p = inOut(u), bx = mix(1180 + i * 55, 1330 - i * 105, p), by = mix(500, 330 + (i % 3) * 85, p) - Math.sin(p * Math.PI) * 150;
        if (Math.abs(x - bx) < 140 && Math.abs(y - by) < 140) h += relief(birdSdf(x, y, bx, by, Math.atan2(-Math.cos(p * Math.PI) * .8 + .2, -1), mix(.6, 1.9, smooth(u * 2.5)), Math.sin(q.t * TAU * 2.3 + i)), 24) * .9;
      }
      return h;
    },
    cam: q => ({ zoom: 1 + .04 * q.u }),
  },
  drain: {
    // He brought them all: everything spirals down into the centre, and the man rises from it.
    ground: q => 1.25, warp: q => { const a = q.words.at(-1); return inOut((q.t - q.s.start + .1) / Math.max(.8, a.start - q.s.start)) * (1 - .75 * smooth((q.t - a.start - .1) / 1.1)); },
    h(x, y, q) {
      const a = q.words.at(-1), gone = 1 - smooth((q.warpAmount - .55) / .4);
      let h = 0;
      if (gone > 0) {
        const [qx, qy] = q.warped;
        if (qx > 900 && qx < 1800 && qy > 60 && qy < 900) h += relief(sculpt(DEER, qx, qy, 1360, 880, 1.3), 90) * gone;
        if (qx > 170 && qx < 700 && qy > 480 && qy < 910) h += relief(sculpt(DOE, qx, qy, 430, 900, .8, -1), 60) * .8 * gone;
      }
      const man = smooth((q.t - a.start + .45) / 1.1);
      if (man > 0 && x > 650 && x < 1270) h += relief(sculpt(MAN, x, y, DRAIN[0], 900, 1.1), 90) * man;
      return h;
    },
    cam: q => ({ zoom: 1 + .22 * q.warpAmount, rot: -.06 * q.warpAmount, cx: DRAIN[0], cy: DRAIN[1] }),
  },
  naming: {
    // Each creature is carved, then its name is carved beside it.
    ground: q => .8,
    h(x, y, q) {
      const cast = [[DEER, 420, 640, .6, 'deer'], [OX, 1000, 640, .55, 'ox'], [LION, 1560, 650, .55, 'lion']];
      let h = 0;
      cast.forEach(([parts, cx, cy, s, name], i) => {
        const on = smooth((q.t - q.s.start - i * .7) / .6);
        if (on > 0 && Math.abs(x - cx) < 240 && y > cy - 420 && y < cy + 30) h += relief(sculpt(parts, x, y, cx, cy, s), 50) * on;
        const n = smooth((q.t - find(q, 'name').start - i * .25) / .5);
        if (n > 0) h += textField('name-' + name, name, `italic 110px "EB Garamond Italic"`, cx, cy + 110)[Math.round(y / STEP) * NX + Math.round(x / STEP)] * n;
      });
      return h;
    },
    tint: (x, y, q) => y > 700 ? 1 : 0,
    texts: q => [['deer', 420, 640], ['ox', 1000, 640], ['lion', 1560, 650]].map(([name, cx, cy], i) => ({ text: name, font: `italic 110px "EB Garamond Italic"`, x: cx, y: cy + 110, w: smooth((q.t - find(q, 'name').start - i * .25) / .5) })),
    cam: q => ({ zoom: 1.02 }),
  },
  parade: {
    // Adam named the cattle, the birds and every wild beast: a procession.
    ground: q => .9,
    h(x, y, q) {
      let h = 0;
      const march = (q.t - q.s.start) * 260;
      const cast = [[OX, .5, 0], [DOE, .6, -380], [LION, .5, -760], [DEER, .55, -1140], [OX, .45, -1520]];
      for (const [parts, s, off] of cast) {
        const cx = -250 + march + off; if (Math.abs(x - cx) > 220 || y < 520 || y > 1000) continue;
        h += relief(sculpt(parts, x, y, cx, 960, s), 45);
      }
      for (let i = 0; i < 6; i++) {
        const bx = 2000 - march * 1.5 - i * 170, by = 280 + (i % 2) * 90; if (Math.abs(x - bx) > 100 || Math.abs(y - by) > 100) continue;
        h += relief(birdSdf(x, y, bx, by, Math.PI, 1.3, Math.sin(q.t * 14 + i)), 18) * .9;
      }
      return h;
    },
    cam: q => ({ zoom: 1 }),
  },
  noHelper: {
    ground: q => .45,
    h(x, y, q) {
      const man = x > 820 && x < 1100 ? relief(sculpt(MAN, x, y, 960, 900, .6), 50) : 0;
      const r = Math.hypot(x - 960, y - 700);
      return man + .5 * Math.exp(-Math.pow((r - mix(900, 300, inOut(q.u))) / 40, 2));
    },
    cam: q => ({ zoom: 1.05 + .08 * q.u }),
  },
  trance: {
    // Deep sleep: the man lies down; the whole ground breathes slowly.
    ground: q => .5 + .25 * Math.sin((q.t - q.s.start) * 1.4),
    h(x, y, q) {
      const lie = inOut(q.u * 1.4);
      return y > 400 && y < 900 ? relief(sculpt(MAN, x, y, 960, mix(900, 640, lie), .95, 1, 18, lie * Math.PI / 2), 70) : 0;
    },
    tint: () => 5,
    cam: q => ({ zoom: 1.08 }),
  },
  rib: {
    ground: q => .5 + .2 * Math.sin((q.t - q.s.start) * 1.4),
    h(x, y, q) {
      const man = y > 400 && y < 900 ? relief(sculpt(MAN, x, y, 960, 640, .95, 1, 18, Math.PI / 2), 70) : 0;
      const lift = inOut((q.t - find(q, 'rib').start) / 1.6), close = bw(q, 'closed', 0, 1.2);
      const rib = relief(sculpt(RIB, x, y, 930, mix(600, 400, lift), 1.1), 20) * smooth(lift * 4);
      const gap = -.6 * Math.exp(-Math.pow(Math.hypot(x - 930, y - 610) / 60, 2)) * smooth(lift * 3) * (1 - close);
      return man + rib + gap;
    },
    tint: (x, y, q) => y < 520 ? 1 : 5,
    cam: q => ({ zoom: 1.12 }),
  },
  woman: {
    ground: q => .6,
    h(x, y, q) {
      const g = inOut(q.u * 1.2), man = y > 500 && y < 900 ? relief(sculpt(MAN, x, y, 960, 900, .7, 1, 18, Math.PI / 2), 60) * .6 : 0;
      const rib = relief(sculpt(RIB, x, y, 960, 420, 1.1 * (1 - g)), 20) * (1 - g);
      const w = x > 660 && x < 1260 && y < 860 ? relief(sculpt(WOMAN, x, y, 960, 860, 1.05 * g + .05), 80) * g : 0;
      return man * (1 - g) + rib + w;
    },
    tint: (x, y, q) => 1,
    cam: q => ({ zoom: 1.02 + .06 * q.u }),
  },
  brought: {
    ground: q => .6,
    h(x, y, q) {
      const walk = inOut(q.u);
      const w = relief(sculpt(WOMAN, x, y, mix(700, 880, walk), 900, .8), 70), m = relief(sculpt(MAN, x, y, 1240, 900, .8, -1), 70);
      return (x < 1080 ? w : 0) + (x > 1080 ? m : 0);
    },
    cam: q => ({ zoom: 1 }),
  },
  bone: {
    // Bone of my bones: the rings between the two begin to be shared.
    ground: q => .55,
    h(x, y, q) {
      const d1 = sculpt(MAN, x, y, 1120, 900, .8, -1), d2 = sculpt(WOMAN, x, y, 800, 900, .8);
      const bridge = at(q, .4, 2.5), d = smin(d1, d2, 10 + 120 * bridge);
      return relief(d, 80) + .35 * tri(Math.min(-d, 400) / 30) * (d < 0 ? 0 : Math.exp(-d / 90)) * bridge;
    },
    tint: (x, y, q) => x > 960 ? 0 : 1,
    cam: q => ({ zoom: 1.04 + .06 * q.u }),
  },
  oneFlesh: {
    // Leave, cling, one flesh: two sculptures melt into a single form.
    ground: q => .6,
    h(x, y, q) {
      const cling = bw(q, 'cling', .2, 1.2), one = bw(q, 'one', 0, 1.4), leave = bw(q, 'leave', 0, 1.2);
      const gap = mix(420, 150, cling) - 60 * one;
      const d1 = sculpt(MAN, x, y, 960 + gap / 2, 900, .8, -1), d2 = sculpt(WOMAN, x, y, 960 - gap / 2, 900, .8);
      let h = relief(smin(d1, d2, 10 + 140 * one), 90);
      // Father and mother, left behind, fade as small forms at the edge.
      if (x < 400) h += relief(Math.min(sculpt(MAN, x, y, 170, 900, .4), sculpt(WOMAN, x, y, 290, 900, .4)), 30) * (1 - leave) * .7;
      return h;
    },
    tint: (x, y, q) => Math.abs(x - 960) < 220 && bw(q, 'one', 0, 1.4) > .5 ? 2 : 0,
    cam: q => ({ zoom: 1.06 + .08 * q.u }),
  },
  noShame: {
    // Naked and unashamed: open light, the two side by side, trees returning.
    ground: q => .8 + .4 * q.rms,
    h(x, y, q) {
      let h = relief(sculpt(MAN, x, y, 1050, 900, .7, -1), 60) + relief(sculpt(WOMAN, x, y, 870, 900, .7), 60);
      for (let k = 0; k < 8; k++) { const tx = 140 + k * 235, ty = 300 + (k % 2) * 90; if (Math.abs(tx - 960) < 260) continue; const g = smooth((q.t - q.s.start - k * .3) / 1); if (Math.abs(x - tx) < 150 && Math.abs(y - ty) < 150) h += relief(Math.hypot(x - tx, y - ty) - 80, 60) * g; }
      return h;
    },
    tint: (x, y, q) => y < 450 ? 4 : 0,
    cam: q => ({ zoom: 1.1 - .12 * inOut(q.u) }),
  },
  outro: {
    // The whole garden at once: four rivers, trees around, the two at the centre,
    // then it all lies down flat and the chapter's name is carved last.
    ground: q => .8 + .4 * q.rms,
    h(x, y, q) {
      const settle = smooth((q.u - .55) / .35), dx = x - 960, dy = y - 560, r = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
      let best = 1e9;
      for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + .4 + .35 * Math.sin(r / 180 + k); best = Math.min(best, Math.abs(((th - a + Math.PI) % TAU + TAU) % TAU - Math.PI) * r); }
      let h = .9 - .8 * smooth((50 - best) / 30) * smooth((r - 120) / 60);
      for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + .3, tx = 960 + Math.cos(a) * 640, ty = 560 + Math.sin(a) * 380; if (Math.abs(x - tx) < 120 && Math.abs(y - ty) < 120) h += relief(Math.hypot(x - tx, y - ty) - 70, 50) * smooth(q.u * 6 - k * .3); }
      if (r < 260) h += relief(smin(sculpt(MAN, x, y, 1000, 700, .42, -1), sculpt(WOMAN, x, y, 920, 700, .42), 30), 40);
      const f = textField('end', 'GENESIS 2', `200px "Bebas Neue"`, 960, 900);
      return h * (1 - .7 * settle) + f[Math.round(y / STEP) * NX + Math.round(x / STEP)] * settle * 1.2;
    },
    tint: (x, y, q) => { const r = Math.hypot(x - 960, y - 560); return r > 520 && y < 1000 ? 4 : r < 260 ? 2 : 1; },
    texts: q => [{ text: 'GENESIS 2', font: `200px "Bebas Neue"`, x: 960, y: 900, w: smooth((q.u - .55) / .35) }],
    cam: q => ({ zoom: 1.18 - .2 * inOut(q.u), rot: .04 * (1 - q.u) }),
  },
};

function ring(x, y, cx, cy, age, speed, amp) {
  if (age < 0) return 0;
  const d = Math.hypot(x - cx, y - cy) - age * speed;
  return d > -80 && d < 80 ? amp * Math.exp(-d * d / 1200) * Math.exp(-age * 1.2) : 0;
}

// --- per-frame evaluation ----------------------------------------------------------------
function context(p, s, t) {
  const scene = SCENES[s.direction?.scene] ?? SCENES.calmWater;
  const words = s.wordIds.map(id => p.words.find(w => w.id === id)).filter(Boolean);
  const u = clamp((t - s.start) / Math.max(.01, s.end - s.start));
  const q = { p, s, t: scene.freeze ? mix(t, s.start, clamp((t - s.start) / 1.5)) : t, words: words.length ? words : [{ start: s.start, end: s.start, text: '' }], u, rms: envelope(p, 'rms', t), scene };
  q.ground = scene.ground?.(q) ?? .8;
  q.warpAmount = scene.warp ? scene.warp(q) : 0;
  q.cam = { x: 0, y: 0, zoom: 1, rot: 0, cx: 960, cy: 540, ...scene.cam?.(q) };
  return q;
}

function heightAt(x, y, q) {
  let qx = x, qy = y;
  if (q.warpAmount > 0) {
    const vx = x - DRAIN[0], vy = y - DRAIN[1], r = Math.hypot(vx, vy);
    const th = q.warpAmount * (7.5 * Math.exp(-r / 420) + 1.2), pull = 1 + q.warpAmount * 1.6 * Math.exp(-r / 900);
    const c = Math.cos(th), n = Math.sin(th);
    qx = DRAIN[0] + (vx * c - vy * n) * pull; qy = DRAIN[1] + (vx * n + vy * c) * pull;
  }
  q.warped = [qx, qy];
  return terrain(qx, qy, q.t) * q.ground + q.scene.h(x, y, q);
}

const LEVEL = .075, LEVELS = 40, BANDS = TINTS.length;
function contours(c, H, T, look) {
  const paths = Array.from({ length: LEVELS * BANDS }, () => []);
  for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
    const a = H[j * NX + i], b = H[j * NX + i + 1], d = H[(j + 1) * NX + i], e = H[(j + 1) * NX + i + 1];
    const l0 = Math.max(0, Math.ceil(Math.min(a, b, d, e) / LEVEL)), l1 = Math.min(LEVELS - 1, Math.floor(Math.max(a, b, d, e) / LEVEL));
    if (l0 > l1) continue;
    const x = i * STEP, y = j * STEP, band = T[j * NX + i];
    for (let l = l0; l <= l1; l++) {
      const v = l * LEVEL, pts = [];
      if ((a < v) !== (b < v)) pts.push(x + STEP * (v - a) / (b - a), y);
      if ((b < v) !== (e < v)) pts.push(x + STEP, y + STEP * (v - b) / (e - b));
      if ((d < v) !== (e < v)) pts.push(x + STEP * (v - d) / (e - d), y + STEP);
      if ((a < v) !== (d < v)) pts.push(x, y + STEP * (v - a) / (d - a));
      if (pts.length >= 4) paths[l * BANDS + band].push(pts);
    }
  }
  for (let l = 0; l < LEVELS; l++) for (let band = 0; band < BANDS; band++) {
    const list = paths[l * BANDS + band]; if (!list.length) continue;
    const u = l / (LEVELS - 1), index = l % 4 === 0;
    let r = mix(150, 250, Math.pow(u, .5)), g = mix(100, 222, Math.pow(u, 1)), b = mix(72, 196, Math.pow(u, 1.4));
    const [vr, vg, vb] = hsl(look.hue + look.spread * u, .72 + .22 * u, .52 + .36 * Math.pow(u, .8));
    r = mix(r, vr, look.vib); g = mix(g, vg, look.vib); b = mix(b, vb, look.vib);
    const tint = TINTS[band];
    if (tint) { const k = (.35 + .55 * Math.pow(u, .5)) * (1 - .7 * look.vib); r = mix(r, tint[0], k); g = mix(g, tint[1], k); b = mix(b, tint[2], k); }
    c.strokeStyle = `rgba(${r | 0},${g | 0},${b | 0},${Math.min(1, mix(.55 + .2 * look.vib, 1, Math.pow(u, .45))) * (index ? 1 : .8 + .12 * look.vib)})`;
    c.lineWidth = (index ? 1.9 : 1) * (1 + .25 * look.vib);
    c.beginPath();
    for (const p of list) { c.moveTo(p[0], p[1]); c.lineTo(p[2], p[3]); if (p.length === 8) { c.moveTo(p[4], p[5]); c.lineTo(p[6], p[7]); } }
    c.stroke();
  }
}

function field(p, s, t, ripples) {
  const q = context(p, s, t);
  const H = new Float32Array(NX * NY), T = new Uint8Array(NX * NY);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const x = i * STEP, y = j * STEP;
    let h = heightAt(x, y, q);
    for (const r of ripples) { const d = Math.hypot(x - r.x, y - r.y) - r.age * 520; if (d > -70 && d < 70) h += .3 * Math.exp(-d * d / 1100) * Math.exp(-r.age * 1.6); }
    H[j * NX + i] = h;
  }
  if (q.scene.tint) for (let j = 0; j < NY; j += 2) for (let i = 0; i < NX; i += 2) {
    const v = q.scene.tint(i * STEP, j * STEP, q) | 0;
    T[j * NX + i] = v; if (i + 1 < NX) T[j * NX + i + 1] = v; if (j + 1 < NY) { T[(j + 1) * NX + i] = v; if (i + 1 < NX) T[(j + 1) * NX + i + 1] = v; }
  }
  return { H, T, q };
}

const TRANSITION = .6;
/** Crisp outlines over carved words, so relief text reads sharply while its
 * rings still ripple around it. */
function carved(c, q, look) {
  for (const spec of q.scene.texts?.(q) ?? []) {
    if (spec.w <= 0) continue;
    const [r, g, b] = hsl(look.hue + look.spread, .55 + .3 * look.vib, .84);
    c.save(); c.globalAlpha = spec.w; c.font = spec.font; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.fillStyle = 'rgba(20,15,12,.55)'; c.fillText(spec.text, spec.x, spec.y);
    c.strokeStyle = `rgb(${mix(241, r, look.vib) | 0},${mix(232, g, look.vib) | 0},${mix(216, b, look.vib) | 0})`; c.lineWidth = 3.2; c.strokeText(spec.text, spec.x, spec.y);
    c.globalAlpha = spec.w * .45; c.lineWidth = 1.2; c.strokeStyle = BONE;
    c.save(); c.translate(0, -3); c.strokeText(spec.text, spec.x, spec.y); c.restore();
    c.restore();
  }
}

function background(c, e) {
  const { p, s, t } = e;
  if (!CanvasCtor && !globalThis.OffscreenCanvas) CanvasCtor = c.canvas.constructor;
  const ripples = rippleSources(c, e);
  let { H, T, q } = field(p, s, t, ripples);
  // Morph from the previous scene: same lines, reshaped.
  const i = p.sections.indexOf(s), prev = p.sections[i - 1];
  let cam = q.cam;
  const k = smooth((t - s.start) / TRANSITION);
  if (prev && prev.style === 'garden' && k < 1) {
    const before = field(p, prev, t, []);
    for (let n = 0; n < H.length; n++) H[n] = mix(before.H[n], H[n], k);
    if (k < .5) T = before.T;
    const a = before.q.cam; cam = Object.fromEntries(Object.keys(cam).map(key => [key, mix(a[key] ?? cam[key], cam[key], k)]));
  }
  const sceneName = s.direction?.scene, [h1, s1] = HUES[sceneName] ?? [28, 40];
  let look = { hue: h1, spread: s1, vib: vibrancy(t, sceneName) };
  if (prev && prev.style === 'garden' && k < 1) {
    const [h0, s0] = HUES[prev.direction?.scene] ?? [28, 40], dh = ((h1 - h0 + 540) % 360) - 180;
    look = { hue: h0 + dh * k, spread: mix(s0, s1, k), vib: mix(vibrancy(t, prev.direction?.scene), look.vib, k) };
  }
  const [br, bg_, bb] = hsl(look.hue, .38, LOVE.has(sceneName) ? .15 : .12);
  c.fillStyle = `rgb(${mix(42, br, look.vib * .7) | 0},${mix(33, bg_, look.vib * .7) | 0},${mix(26, bb, look.vib * .7) | 0})`; c.fillRect(0, 0, 1920, 1080);
  const kick = pulse(p, t, 'kicks', 9) * .012;
  c.save(); c.translate(cam.cx, cam.cy); c.rotate(cam.rot); c.scale(cam.zoom + kick, cam.zoom + kick); c.translate(-cam.cx + cam.x, -cam.cy + cam.y);
  contours(c, H, T, look);
  carved(c, q, look);
  c.restore();
  const g = c.createRadialGradient(960, 560, 420, 960, 560, 1180);
  g.addColorStop(0, 'rgba(26,20,16,0)'); g.addColorStop(1, 'rgba(26,20,16,.55)');
  c.fillStyle = g; c.fillRect(0, 0, 1920, 1080);
}

// --- type ------------------------------------------------------------------------------------
const SERIF = 'EB Garamond Italic', CAPS = 'Bebas Neue';
const SPEAKER = /^(adam|eve|and):?$/i;
const layouts = new Map();
/** Lines of the section, laid out once. direction.lines gives the word count per line,
 * direction.layout the placement; speaker labels ("Adam:") become small caps tags. */
function layout(c, e) {
  const s = e.s, key = s.id;
  if (layouts.has(key)) return layouts.get(key);
  const words = s.wordIds.map(id => e.p.words.find(w => w.id === id)).filter(Boolean);
  const counts = s.direction?.lines ?? [words.length];
  const speakerCount = s.direction?.speaker ? s.direction.speaker.split(' ').length : 0;
  const speakerWords = words.slice(0, speakerCount), sung = words.slice(speakerCount);
  const size = s.direction?.size ?? 104, pos = s.direction?.layout ?? 'bl';
  const lines = []; let k = 0;
  for (const n of counts) { lines.push(sung.slice(k, k + n)); k += n; }
  if (k < sung.length) lines.push(sung.slice(k));
  c.font = `${size}px "${SERIF}"`;
  const gap = size * .26, lh = size * 1.02;
  const widths = lines.map(l => l.reduce((a, w) => a + c.measureText(clean(w.text)).width + gap, -gap));
  const blockH = lh * lines.length;
  const top = pos[0] === 't' ? 120 + size * .8 : pos[0] === 'c' ? 540 - blockH / 2 + size * .7 : 1000 - blockH + size * .7;
  const placed = [];
  lines.forEach((l, li) => {
    const w = widths[li];
    let x = pos[1] === 'r' ? 1810 - w : pos[1] === 'c' ? 960 - w / 2 : 110;
    const y = top + li * lh;
    for (const word of l) { const ww = c.measureText(clean(word.text)).width; placed.push({ word, x, y, w: ww }); x += ww + gap; }
  });
  const out = { placed, size, speaker: s.direction?.speaker, speakerAt: speakerWords[0]?.start, top, pos };
  layouts.set(key, out);
  return out;
}
const clean = text => text.replace(/[,;:]$/, '').replace(/\.$/, '');

function rippleSources(c, e) {
  const L = layout(c, e), out = [];
  for (const { word, x, y, w } of L.placed) { const age = e.t - word.start; if (age >= 0 && age < 1.8) out.push({ x: x + w / 2, y: y - L.size * .3, age }); }
  return out;
}

function typography(c, e) {
  const { t, s, p } = e, L = layout(c, e);
  const next = p.sections[p.sections.indexOf(s) + 1];
  const exit = next ? smooth((t - (next.start - .3)) / .3) : 0;
  const enter = smooth((t - s.start) / .25);
  c.save(); c.globalAlpha = (1 - exit) * enter; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  if (L.speaker) {
    c.save(); c.font = `46px "${CAPS}"`; c.letterSpacing = '10px'; c.fillStyle = LOVE.has(s.direction?.scene) ? '#FFA3B8' : VERDIGRIS;
    const x = L.pos[1] === 'r' ? 1810 - c.measureText(L.speaker.toUpperCase()).width : L.pos[1] === 'c' ? 960 - c.measureText(L.speaker.toUpperCase()).width / 2 : 112;
    c.globalAlpha *= smooth((t - (L.speakerAt ?? s.start) + .2) / .3); c.fillText(L.speaker.toUpperCase(), x, L.top - L.size * .95); c.restore();
  }
  c.font = `${L.size}px "${SERIF}"`;
  for (const { word, x, y } of L.placed) {
    const text = clean(word.text), shown = smooth((t - (word.start - .35)) / .3);
    if (shown <= 0) continue;
    const sung = t >= word.start, lift = sung ? (1 - outExpo((t - word.start) / .5)) * L.size * .08 : L.size * .08;
    c.save(); c.globalAlpha *= shown * (sung ? 1 : .3);
    c.lineJoin = 'round'; c.strokeStyle = BG; c.lineWidth = L.size * .17; c.strokeText(text, x, y + lift);
    c.fillStyle = sung && t < word.end + .35 ? (LOVE.has(s.direction?.scene) ? '#FFA3B8' : VERDIGRIS) : BONE; c.fillText(text, x, y + lift);
    c.restore();
  }
  c.restore();
  grain(c, t);
}

function grain(c, t) {
  const frame = Math.floor(t * 24);
  c.save();
  for (let i = 0; i < 3200; i++) {
    const n = i + frame * 3331;
    c.globalAlpha = .02 + hash(n, 9) * .04; c.fillStyle = hash(n, 7) < .5 ? '#000' : '#fff';
    c.fillRect(hash(n, 1) * 1920, hash(n, 2) * 1080, 1.4, 1.4);
  }
  c.restore();
}

export function installGarden(register) {
  register('garden', { background, typography });
}
