/** Field guide: a code-only plate for Genesis 2 (the forming and naming of the
 * animals). A modern specimen sheet on bone paper. One clay-coloured point rises
 * out of the soil strata and draws each creature as a single continuous line;
 * the lyric is set into the sheet as headline, callout and soil label.
 * Everything is a pure function of song time. No images. */

export const FIELD_GUIDE_CATALOG = {
  'field-guide': 'Code-only specimen sheet: a clay line rises from soil strata and draws each creature in one stroke; lyrics set as headline, callouts and soil labels.',
};

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mix = (a, b, v) => a + (b - a) * v;
const smooth = v => { v = clamp(v); return v * v * (3 - 2 * v); };
const outExpo = v => { v = clamp(v); return v === 1 ? 1 : 1 - Math.pow(2, -10 * v); };
const inOutCubic = v => { v = clamp(v); return v < .5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; };
const rand = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
/** Critically damped spring response to a step at `at`, 0..1 with a small overshoot. */
const spring = (t, at, freq = 9, damping = .55) => {
  const x = t - at; if (x <= 0) return 0;
  const w = freq, z = damping, wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + z * w / wd * Math.sin(wd * x));
};

const PAPER = '#ECE7DB', INK = '#141416', GRAPHITE = '#77726A', ASH = '#B3ADA2', CLAY = '#C2522B';

// One continuous contour per creature, in a unit box (y down). Retracing is
// allowed, as in a single-line drawing; Catmull-Rom smooths the points.
const DEER = [[.16,1],[.19,.8],[.17,.6],[.12,.47],[.2,.38],[.4,.39],[.6,.37],[.69,.32],[.75,.2],[.79,.1],[.76,-.05],[.71,-.2],[.66,-.3],[.71,-.2],[.78,-.24],[.83,-.34],[.78,-.24],[.76,-.05],[.84,.02],[.83,.07],[.97,.14],[.95,.19],[.84,.2],[.76,.34],[.73,.52],[.74,.74],[.76,1],[.71,1],[.68,.76],[.66,.62],[.5,.68],[.32,.67],[.27,.74],[.29,1]];
const BIRD = [[-.62,.06],[-.5,-.02],[-.36,-.12],[-.22,-.08],[-.1,.02],[-.03,.07],[0,.04],[.04,.02],[.07,.04],[.03,.08],[0,.13],[-.04,.2],[0,.14],[.04,.2],[0,.13],[.03,.08],[.1,.02],[.22,-.08],[.36,-.12],[.5,-.02],[.62,.06]];

function catmull(points, steps = 10) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(k => .5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(points.at(-1));
  return out;
}
// The man: feet, legs, torso, a looped head, one arm open toward the animals.
const MAN = [[.44,1],[.46,.78],[.48,.6],[.49,.42],[.5,.27],[.5,.2],[.45,.15],[.45,.06],[.5,0],[.56,.05],[.56,.14],[.5,.2],[.5,.27],[.58,.34],[.7,.44],[.8,.47],[.7,.44],[.58,.34],[.5,.3],[.44,.4],[.42,.55],[.44,.4],[.5,.3],[.51,.6],[.54,.78],[.57,1]];
const DEER_PATH = catmull(DEER), BIRD_BASE = BIRD, MAN_PATH = catmull(MAN);

/** Draw the first `f` of a polyline (by length). Returns the head point. */
function partial(c, pts, f, { color = INK, width = 2.2 } = {}) {
  if (f <= 0 || pts.length < 2) return pts[0];
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const target = lens.at(-1) * clamp(f);
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  let head = pts[0];
  for (let i = 1; i < pts.length; i++) {
    if (lens[i] <= target) { c.lineTo(pts[i][0], pts[i][1]); head = pts[i]; continue; }
    const u = (target - lens[i - 1]) / (lens[i] - lens[i - 1]);
    head = [mix(pts[i - 1][0], pts[i][0], u), mix(pts[i - 1][1], pts[i][1], u)]; c.lineTo(head[0], head[1]); break;
  }
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
  return head;
}

function spark(c, x, y, t, intensity = 1) {
  if (intensity <= 0) return;
  c.save();
  const g = c.createRadialGradient(x, y, 0, x, y, 26);
  g.addColorStop(0, `rgba(226,110,62,${.55 * intensity})`); g.addColorStop(1, 'rgba(226,110,62,0)');
  c.fillStyle = g; c.fillRect(x - 26, y - 26, 52, 52);
  c.fillStyle = CLAY; c.beginPath(); c.arc(x, y, 4.2, 0, TAU); c.fill();
  c.fillStyle = '#FFE3CF'; c.beginPath(); c.arc(x, y, 1.6, 0, TAU); c.fill();
  // A few grains of soil fall off the point as it draws.
  for (let i = 0; i < 7; i++) {
    const age = ((t * 3.1 + rand(i + 5)) % 1), a = (1 - age) * intensity;
    c.globalAlpha = a * .8; c.fillStyle = i % 3 ? GRAPHITE : CLAY;
    c.fillRect(x + (rand(i + 11) - .5) * 26 * age, y + age * 34 + rand(i + 3) * 6, 1.6, 1.6);
  }
  c.restore();
}

function mono(c, text, x, y, { size = 17, color = GRAPHITE, align = 'left', alpha = 1 } = {}) {
  if (alpha <= 0) return;
  c.save(); c.globalAlpha *= alpha; c.font = `500 ${size}px "JetBrains Mono"`; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'alphabetic';
  c.fillText(text, x, y); c.restore();
}

/** Karaoke word: dim before it is sung, ink while and after. Never ahead of the voice. */
function lyric(c, w, t, x, y, size, { family = 'Archivo Black', align = 'left', color = INK, sung = CLAY, lead = .4, track = -.02 } = {}) {
  if (!w) return 0;
  const shown = smooth((t - (w.start - lead)) / .25);
  if (shown <= 0) return 0;
  const text = w.text.replace(/[.,;:]$/, '');
  c.save(); c.font = `${size}px "${family}"`; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  c.letterSpacing = `${track * size}px`;
  const width = c.measureText(text).width, left = align === 'right' ? x - width : x;
  const p = clamp((t - w.start) / Math.max(.08, w.end - w.start));
  const hit = spring(t, w.start, 14, .5);
  c.globalAlpha *= shown * (t < w.start ? .2 : 1);
  c.translate(left, y + (1 - hit) * size * .12 * (t >= w.start ? 1 : 0));
  c.fillStyle = t < w.start ? GRAPHITE : color; c.fillText(text, 0, 0);
  // The sung portion carries the clay signal, completing by the word's end.
  if (t >= w.start && t < w.end + .35) {
    c.save(); c.beginPath(); c.rect(-4, -size, (width + 8) * p, size * 1.3); c.clip();
    c.globalAlpha *= 1 - smooth((t - w.end) / .35); c.fillStyle = sung; c.fillText(text, 0, 0); c.restore();
  }
  c.restore();
  return width;
}

function strata(c, t, rise) {
  // Soil layers: hairlines with stippled grains; they breathe with the music.
  const top = 842;
  for (let k = 0; k < 7; k++) {
    const y0 = top + k * 34 + k * k * 2.2;
    c.beginPath();
    for (let x = 0; x <= 1920; x += 12) {
      const y = y0 + Math.sin(x * .004 + k * 1.7) * (5 + k) + Math.sin(x * .013 + k) * 2;
      x ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.strokeStyle = k === 0 ? INK : GRAPHITE; c.globalAlpha = k === 0 ? .9 : .38; c.lineWidth = k === 0 ? 1.4 : .8; c.stroke();
  }
  c.globalAlpha = 1;
  for (let i = 0; i < 900; i++) {
    const x = rand(i + 1) * 1920, y = top + 14 + Math.pow(rand(i + 2), .7) * 230;
    const lift = rise * smooth((rise * 1.4) - rand(i + 3) * .6) * (80 + rand(i + 4) * 260);
    c.globalAlpha = .18 + rand(i + 5) * .4; c.fillStyle = rand(i + 6) < .14 ? CLAY : INK;
    const s = .8 + rand(i + 7) * 1.6; c.fillRect(x + Math.sin(t * .7 + i) * lift * .05, y - lift, s, s);
  }
  c.globalAlpha = 1;
  mono(c, 'A  HUMUS', 1760, top + 30, { size: 13, color: GRAPHITE, align: 'right' });
  mono(c, 'B  LOAM', 1760, top + 72, { size: 13, color: GRAPHITE, align: 'right' });
  mono(c, 'C  CLAY', 1760, top + 118, { size: 13, color: CLAY, align: 'right' });
}

function grid(c, alpha) {
  c.save(); c.globalAlpha = alpha * .08; c.strokeStyle = INK; c.lineWidth = 1;
  for (let i = 1; i < 12; i++) { const x = 96 + i * (1728 / 12); c.beginPath(); c.moveTo(x, 70); c.lineTo(x, 820); c.stroke(); }
  c.globalAlpha = alpha * .55;
  // Registration ticks at the sheet corners.
  for (const [x, y, dx, dy] of [[96, 70, 1, 1], [1824, 70, -1, 1], [96, 1010, 1, -1], [1824, 1010, -1, -1]]) {
    c.beginPath(); c.moveTo(x, y + dy * 18); c.lineTo(x, y); c.lineTo(x + dx * 18, y); c.stroke();
  }
  c.restore();
}

function grain(c, t) {
  c.save();
  const frame = Math.floor(t * 24);
  for (let i = 0; i < 2600; i++) {
    const n = i + frame * 3331;
    c.globalAlpha = .035 + rand(n + 9) * .05; c.fillStyle = rand(n + 7) < .5 ? '#000' : '#fff';
    c.fillRect(rand(n) * 1920, rand(n + 1) * 1080, 1.3, 1.3);
  }
  c.restore();
}

/** Words by position in the section: God formed the beasts of the field / and
 * birds of the sky from the earth. Roles can override indices. */
function words(e) {
  const list = e.s.wordIds.map(id => e.p.words.find(w => w.id === id));
  const at = (name, i) => { const id = e.s.direction?.roles?.[name]; return id ? e.p.words.find(w => w.id === id) : list[i]; };
  return { list, God: at('God', 0), formed: at('formed', 1), beasts: at('beasts', 3), field: at('field', 6), and: at('and', 7), birds: at('birds', 8), sky: at('sky', 11), from: at('from', 12), earth: at('earth', 14), He: at('He', 15), brought: at('brought', 16), Adam: at('Adam', 20) };
}

function background(c, e) {
  const { t, s } = e, W = words(e);
  c.fillStyle = PAPER; c.fillRect(0, 0, 1920, 1080);
  const intro = smooth((t - s.start) / .6);
  // Camera: a slow push, then a tilt up with the bird, easing into a downbeat.
  const tilt = W.birds ? inOutCubic((t - W.birds.start + .2) / 1.4) * (1 - inOutCubic((t - W.from.start + .1) / 1.1)) : 0;
  const push = 1 + .035 * smooth((t - s.start) / (s.end - s.start));
  c.save(); c.translate(960, 540); c.scale(push, push); c.translate(-960, -540 + tilt * 36);
  grid(c, intro);
  const rise = W.from ? smooth((t - W.from.start) / Math.max(.6, (W.earth.end - W.from.start) + .8)) : 0;
  strata(c, t, rise);

  // Header: dry, specific, modern. The chapter reference, not a sermon.
  mono(c, 'GENESIS 2 : 19', 96, 52, { size: 16, color: INK, alpha: intro });
  mono(c, 'FIELD NOTES — SPECIMENS FORMED FROM SOIL', 330, 52, { size: 16, alpha: intro });
  const count = W.field ? Math.floor(mix(1, 412, smooth((t - W.formed.start) / (W.earth.end - W.formed.start)))) : 1;
  mono(c, `No. ${String(count).padStart(4, '0')}`, 1824, 52, { size: 16, color: CLAY, align: 'right', alpha: intro });

  // Fig. 1: the beast of the field, drawn in one stroke rising from the soil.
  const deerF = W.formed ? smooth((t - W.formed.start + .1) / Math.max(.8, W.field.end - W.formed.start + .2)) : 0;
  const deer = DEER_PATH.map(([x, y]) => [1050 + x * 430, 452 + y * 390]);
  // The line starts in the clay layer and climbs to the first hoof.
  const stem = [[1120, 960], [1110, 900], [1118, 842]];
  const stemF = smooth((t - s.start - .08) / Math.max(.4, W.formed.start - s.start));
  let head = partial(c, stem.concat(deer.slice(0, 1)), stemF, { color: CLAY, width: 1.6 });
  if (deerF > 0) head = partial(c, deer, deerF, { color: INK, width: 2.4 });
  const drawingDeer = deerF > 0 && deerF < 1;

  // Callout for fig. 1, a hairline bracket to the drawing.
  const call1 = smooth((t - W.beasts.start) / .35);
  if (call1 > 0) {
    c.save(); c.globalAlpha = call1; c.strokeStyle = GRAPHITE; c.lineWidth = 1;
    c.beginPath(); c.moveTo(1500, 520); c.lineTo(1500 + 150 * call1, 520); c.lineTo(1500 + 150 * call1, 490); c.stroke(); c.restore();
    mono(c, 'FIG. 1', 1506, 550, { size: 14, color: CLAY, alpha: call1 });
    mono(c, 'beast of the field', 1506, 572, { size: 15, alpha: call1 });
    mono(c, 'material: ground', 1506, 594, { size: 15, alpha: call1 * .8 });
    mono(c, 'name: pending', 1506, 616, { size: 15, alpha: call1 * .8 });
  }

  // Fig. 2: the same line lifts off the antler and becomes a bird in flight.
  const birdF = W.and ? smooth((t - W.and.start) / Math.max(.6, W.sky.end - W.and.start)) : 0;
  let bird = null;
  if (birdF > 0) {
    const fly = inOutCubic((t - W.birds.start) / Math.max(.8, W.earth.end - W.birds.start + .6));
    const bx = mix(1390, 1600, fly), by = mix(300, 250, fly) - Math.sin(fly * Math.PI) * 40;
    const flap = Math.sin((t - W.birds.start) * TAU * 1.53);
    const pts = catmull(BIRD_BASE.map(([x, y]) => [x, y - Math.sign(x) * 0 + (Math.abs(x) > .08 ? flap * .3 * (Math.abs(x) - .08) * 2 : 0)]), 8)
      .map(([x, y]) => [bx + x * 300, by + y * 300]);
    bird = pts;
    // The connecting thread from the antler tip to the bird, fading as it flies.
    const tip = deer[Math.floor(DEER_PATH.length * .38)];
    c.save(); c.globalAlpha = (1 - smooth((t - W.birds.start) / 1.2)) * .7;
    c.beginPath(); c.moveTo(tip[0], tip[1]); c.quadraticCurveTo(mix(tip[0], bx, .5), Math.min(tip[1], by) - 90, bx - 180, by);
    c.strokeStyle = CLAY; c.lineWidth = 1.2; c.setLineDash([2, 6]); c.stroke(); c.restore();
    head = partial(c, pts, birdF, { color: INK, width: 2.2 });
    // The label waits until the bird has cleared the antlers.
    const call2 = smooth((fly - .45) / .2);
    mono(c, 'FIG. 2', bx - 60, by + 100, { size: 14, color: CLAY, alpha: call2 });
    mono(c, 'bird of the sky', bx - 60, by + 122, { size: 15, alpha: call2 });
  }

  // Fig. 3: "He brought them all to Adam". The same clay line climbs out of
  // the soil a third time and draws the man; dotted paths bring the creatures.
  let manHead = null;
  if (W.He) {
    const manF = smooth((t - W.He.start + .15) / Math.max(.8, W.Adam.end - W.He.start));
    const man = MAN_PATH.map(([x, y]) => [560 + x * 300, 422 + y * 420]);
    const manStem = [[700, 990], [696, 910], [692, 842]];
    const climb = smooth((t - W.He.start + .45) / .35);
    if (climb > 0) manHead = partial(c, manStem, climb, { color: CLAY, width: 1.6 });
    if (manF > 0) manHead = partial(c, man, manF, { color: INK, width: 2.4 });
    const bring = smooth((t - W.brought.start) / Math.max(.6, W.Adam.start - W.brought.start));
    if (bring > 0) {
      const hand = man[Math.floor(MAN_PATH.length * .58)];
      c.save(); c.strokeStyle = CLAY; c.lineWidth = 1.3; c.setLineDash([2, 7]); c.lineDashOffset = -t * 40;
      for (const [from, lift] of [[deer[Math.floor(DEER_PATH.length * .45)], -60], [bird ? bird[Math.floor(bird.length / 2)] : [1600, 250], -140]]) {
        const pts = [from, [mix(from[0], hand[0], .5), Math.min(from[1], hand[1]) + lift], hand];
        c.globalAlpha = .75 * (1 - smooth((t - W.Adam.end - .4) / .6) * .4);
        partial(c, catmull(pts, 16), bring, { color: CLAY, width: 1.3 });
      }
      c.restore();
    }
    const call3 = smooth((t - W.Adam.start) / .3);
    mono(c, 'FIG. 3', 860, 700, { size: 14, color: CLAY, alpha: call3 });
    mono(c, 'the man', 860, 722, { size: 15, alpha: call3 });
    mono(c, 'material: ground (adamah)', 860, 744, { size: 15, alpha: call3 * .8 });
    const cursor = Math.floor(t * 2.2) % 2 ? '' : '_';
    mono(c, `task: naming${call3 >= 1 ? cursor : ''}`, 860, 766, { size: 15, color: INK, alpha: call3 });
  }

  // The spark rides whichever line is being drawn, then settles into the soil
  // until the man is drawn from it.
  const settle = W.from ? smooth((t - W.from.start) / .9) * (W.He ? 1 - smooth((t - W.He.start + .45) / .2) : 1) : 0;
  const drawingMan = manHead && W.He && t >= W.He.start - .45 && t <= W.Adam.end + .1;
  const drawing = drawingDeer || (birdF > 0 && birdF < 1) || (stemF > 0 && stemF < 1);
  if (drawingMan) spark(c, manHead[0], manHead[1], t, 1);
  else if (head && (drawing || birdF >= 1) && settle < 1) spark(c, mix(head[0], 700, settle), mix(head[1], 860, settle), t, 1 - settle * .6);
  c.restore();
}

function typography(c, e) {
  const { t } = e, W = words(e);
  const tilt = W.birds ? inOutCubic((t - W.birds.start + .2) / 1.4) * (1 - inOutCubic((t - W.from.start + .1) / 1.1)) : 0;
  c.save(); c.translate(0, tilt * 36);
  // Headline: "God formed", left, big and tight — the verb carries the scene.
  // On "He brought" it snaps up and out, and the new line takes the grid.
  const out = W.He ? inOutCubic((t - W.He.start + .3) / .45) : 0;
  c.save(); c.globalAlpha *= 1 - out; c.translate(0, -out * 160);
  let x = 96;
  x += lyric(c, W.God, t, x, 250, 118) + 30;
  lyric(c, W.formed, t, x, 250, 118);
  // "the beasts / of the field" stacked under it, the noun large.
  const L = W.list;
  x = 100; x += lyric(c, L[2], t, x, 360, 54) + 16; lyric(c, W.beasts, t, x, 360, 92);
  x = 100; x += lyric(c, L[4], t, x, 450, 54) + 16; x += lyric(c, L[5], t, x, 450, 54) + 16; lyric(c, W.field, t, x, 450, 92);
  c.restore();
  if (W.He && out > 0) {
    c.save(); c.globalAlpha *= out; c.translate(0, (1 - out) * 120);
    x = 96; x += lyric(c, W.He, t, x, 250, 118, { lead: 0 }) + 30; lyric(c, W.brought, t, x, 250, 118, { lead: 0 });
    x = 100; x += lyric(c, L[17], t, x, 350, 92, { lead: 0 }) + 22; lyric(c, L[18], t, x, 350, 92, { lead: 0 });
    x = 100; x += lyric(c, L[19], t, x, 440, 54, { lead: 0 }) + 16; lyric(c, W.Adam, t, x, 440, 92, { lead: 0, color: CLAY, sung: INK });
    c.restore();
  }
  // "and birds of the sky" rides high along the bird's line.
  x = 1100; x += lyric(c, W.and, t, x, 150, 44, { family: 'Cormorant Garamond' }) + 14; x += lyric(c, W.birds, t, x, 150, 84) + 18;
  x += lyric(c, L[9], t, x, 150, 44, { family: 'Cormorant Garamond' }) + 12; x += lyric(c, L[10], t, x, 150, 44, { family: 'Cormorant Garamond' }) + 14; lyric(c, W.sky, t, x, 150, 84);
  c.restore();
  // "from the earth" is set into the soil itself, the one italic moment.
  x = 728; x += lyric(c, W.from, t, x, 948, 70, { family: 'Cormorant Garamond', color: INK }) + 18;
  x += lyric(c, L[13], t, x, 948, 70, { family: 'Cormorant Garamond', color: INK }) + 18; lyric(c, W.earth, t, x, 948, 70, { family: 'Cormorant Garamond', color: CLAY, sung: INK });
  grain(c, t);
}

export function installFieldGuide(register) {
  register('field-guide', { background, typography });
}
