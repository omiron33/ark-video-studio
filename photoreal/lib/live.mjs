// Live footage: does anything move in the frame apart from the camera?
//
// A still picture that is pushed, panned, zoomed or rotated moves every pixel together. Real
// footage also has motion of its own (water, fire, smoke, cloth, people, dust) and, in a 3D world,
// parallax. This measures what is left over once the whole frame's move is taken out: for a pair
// of small grey frames a few frames apart, it finds the shift of each tile, fits one similarity
// (move, zoom, turn) to the textured tiles, warps the earlier frame by it and measures how much of
// the later frame it fails to explain. A pushed still leaves almost nothing; a world with a life of
// its own leaves a clear residual in at least some tiles.
//
// Pure functions of pixel buffers; check.mjs decodes the film.

export const LIVE_DEFAULTS = {
  liveWidth: 192, liveHeight: 108,   // grey proxy the measure runs on
  liveLagSeconds: 0.1,               // frames compared this far apart
  liveThreshold: 11,                 // liveliest tile's residual (% of its contrast, half-second median) below which only the camera moves
  liveWindowSeconds: 0.5,            // running median over this long, so one busy frame can't carry a dead stretch
  maxCameraOnlySeconds: 1.5,         // a stretch longer than this with only the camera moving fails
  restFraction: 0.15,                // a camera under this share of its shot's top speed is at rest
  minPeak: 0.001,                    // frame heights per second: a camera slower than this throughout isn't moving at all
};

const TX = 12, TY = 8, R = 4;        // tiles across and down, search radius in proxy pixels

function sad(a, b, W, x0, y0, bw, bh, dx, dy) {
  let s = 0;
  for (let y = y0; y < y0 + bh; y++) { const ra = y * W, rb = (y + dy) * W + dx; for (let x = x0; x < x0 + bw; x++) s += Math.abs(a[ra + x] - b[rb + x]); }
  return s / (bw * bh);
}

// tile motion vectors from prev to cur: [{ cx, cy, dx, dy, tex }]
export function tileVectors(prev, cur, W, H) {
  const out = [];
  const tw = Math.floor(W / TX), th = Math.floor(H / TY);
  for (let j = 0; j < TY; j++) for (let i = 0; i < TX; i++) {
    const bw = tw - 2 * R, bh = th - 2 * R;
    const x0 = i * tw + R, y0 = j * th + R;
    if (x0 - R < 0 || y0 - R < 0 || x0 + bw + R > W || y0 + bh + R > H) continue;
    // texture: mean absolute deviation of the block (flat sky can't say where it moved)
    let m = 0; for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) m += prev[y * W + x];
    m /= bw * bh;
    let tex = 0; for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) tex += Math.abs(prev[y * W + x] - m);
    tex /= bw * bh;
    let best = Infinity, bx = 0, by = 0;
    const cost = {};
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const c = sad(prev, cur, W, x0, y0, bw, bh, dx, dy);
      cost[`${dx},${dy}`] = c;
      if (c < best) { best = c; bx = dx; by = dy; }
    }
    // sub-pixel by a parabola through the neighbours
    const par = (l, c, r) => { const d = l - 2 * c + r; return d > 1e-9 ? 0.5 * (l - r) / d : 0; };
    const sx = Math.abs(bx) < R ? par(cost[`${bx - 1},${by}`], best, cost[`${bx + 1},${by}`]) : 0;
    const sy = Math.abs(by) < R ? par(cost[`${bx},${by - 1}`], best, cost[`${bx},${by + 1}`]) : 0;
    out.push({ cx: x0 + bw / 2, cy: y0 + bh / 2, dx: bx + sx, dy: by + sy, tex });
  }
  return out;
}

// least-squares similarity x' = a x - b y + tx, y' = b x + a y + ty about the frame centre
export function fitSimilarity(vecs, W, H) {
  const ox = W / 2, oy = H / 2;
  let n = 0, sx = 0, sy = 0, su = 0, sv = 0, sxx = 0, sxu = 0, syv = 0, sxv = 0, syu = 0;
  for (const v of vecs) {
    const x = v.cx - ox, y = v.cy - oy, u = x + v.dx, w = y + v.dy;
    n++; sx += x; sy += y; su += u; sv += w; sxx += x * x + y * y; sxu += x * u + y * w; sxv += x * w - y * u;
  }
  if (n < 3) return { a: 1, b: 0, tx: 0, ty: 0 };
  const mx = sx / n, my = sy / n, mu = su / n, mv = sv / n;
  const Sxx = sxx - n * (mx * mx + my * my), Sxu = sxu - n * (mx * mu + my * mv), Sxv = sxv - n * (mx * mv - my * mu);
  const a = Sxx > 1e-9 ? Sxu / Sxx : 1, b = Sxx > 1e-9 ? Sxv / Sxx : 0;
  return { a, b, tx: mu - (a * mx - b * my), ty: mv - (b * mx + a * my), ox, oy };
}

// a binomial blur (two 3x3 passes), so the comparison isn't dominated by sub-pixel resampling of
// fine detail: a pushed still must leave nothing behind
function soften(src, W, H) {
  let a = Float32Array.from(src), b = new Float32Array(W * H);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const xm = Math.max(0, x - 1), xp = Math.min(W - 1, x + 1), r = y * W;
      b[r + x] = (a[r + xm] + 2 * a[r + x] + a[r + xp]) / 4;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ym = Math.max(0, y - 1) * W, yp = Math.min(H - 1, y + 1) * W;
      a[y * W + x] = (b[ym + x] + 2 * b[y * W + x] + b[yp + x]) / 4;
    }
  }
  return a;
}

// How much of cur the frame-wide move of prev fails to explain, per tile, as a percentage of the
// tile's own contrast; the score is the liveliest tile (one flame or one walking figure is enough).
export function liveResidual(prev, cur, W, H) {
  let vecs = tileVectors(prev, cur, W, H);
  const textured = vecs.filter((v) => v.tex > 2);
  let M = fitSimilarity(textured.length >= 4 ? textured : vecs, W, H);
  // one robust pass: refit without the tiles that move on their own
  const err = (v, m) => { const x = v.cx - m.ox, y = v.cy - m.oy; return Math.hypot(m.a * x - m.b * y + m.tx - x - v.dx, m.b * x + m.a * y + m.ty - y - v.dy); };
  if (textured.length >= 6) {
    const es = textured.map((v) => err(v, M)).sort((p, q) => p - q), med = es[es.length >> 1];
    const keep = textured.filter((v) => err(v, M) <= Math.max(0.35, 2 * med));
    if (keep.length >= 4) M = fitSimilarity(keep, W, H);
  }
  // warp prev by M (inverse map: for each cur pixel, where it came from) and compare
  const det = M.a * M.a + M.b * M.b;
  const tw = Math.floor(W / TX), th = Math.floor(H / TY), margin = 6;
  const P = soften(prev, W, H), C = soften(cur, W, H);
  // warp the earlier frame by the frame-wide move
  const warped = new Float32Array(W * H).fill(NaN);
  for (let y = margin; y < H - margin; y++) for (let x = margin; x < W - margin; x++) {
    const u = x - M.ox - M.tx, w = y - M.oy - M.ty;
    const px = (M.a * u + M.b * w) / det + M.ox, py = (-M.b * u + M.a * w) / det + M.oy;
    if (px < 0 || py < 0 || px >= W - 1 || py >= H - 1) continue;
    const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy, k = iy * W + ix;
    const v = (P[k] * (1 - fx) + P[k + 1] * fx) * (1 - fy) + (P[k + W] * (1 - fx) + P[k + W + 1] * fx) * fy;
    warped[y * W + x] = v;
  }
  // light that changes without anything moving (a breathing exposure, a fade, a lamp flickering
  // on a wall) is taken out per tile as a gain and offset: what is left is structure that moved
  const tiles = new Float64Array(TX * TY), counts = new Float64Array(TX * TY);
  const S = Array.from({ length: TX * TY }, () => [0, 0, 0, 0, 0]);   // n, sv, sc, svv, svc
  const tileOf = (x, y) => Math.min(TY - 1, Math.floor(y / th)) * TX + Math.min(TX - 1, Math.floor(x / tw));
  for (let y = margin; y < H - margin; y++) for (let x = margin; x < W - margin; x++) {
    const v = warped[y * W + x];
    if (Number.isNaN(v)) continue;
    const c = C[y * W + x], s = S[tileOf(x, y)];
    s[0]++; s[1] += v; s[2] += c; s[3] += v * v; s[4] += v * c;
  }
  const fit = S.map(([n, sv, sc, svv, svc]) => {
    if (n < 2) return [1, 0];
    const vv = svv - (sv * sv) / n;
    const g = vv > 1e-3 ? Math.max(0.5, Math.min(2, (svc - (sv * sc) / n) / vv)) : 1;
    return [g, (sc - g * sv) / n];
  });
  for (let y = margin; y < H - margin; y++) for (let x = margin; x < W - margin; x++) {
    const v = warped[y * W + x];
    if (Number.isNaN(v)) continue;
    const t = tileOf(x, y), [g, o] = fit[t];
    tiles[t] += Math.abs(C[y * W + x] - (g * v + o)); counts[t]++;
  }
  // each tile's residual relative to its own contrast: resampling a sharp edge leaves a little in
  // proportion to the edge; something actually moving leaves about as much as the tile holds
  const mean = new Float64Array(TX * TY), dev = new Float64Array(TX * TY);
  for (let y = margin; y < H - margin; y++) for (let x = margin; x < W - margin; x++) if (!Number.isNaN(warped[y * W + x])) mean[tileOf(x, y)] += C[y * W + x];
  for (let t = 0; t < mean.length; t++) mean[t] /= Math.max(1, counts[t]);
  for (let y = margin; y < H - margin; y++) for (let x = margin; x < W - margin; x++) if (!Number.isNaN(warped[y * W + x])) { const t = tileOf(x, y); dev[t] += Math.abs(C[y * W + x] - mean[t]); }
  const per = [...tiles].map((s, i) => (counts[i] ? (100 * s / counts[i]) / (dev[i] / counts[i] + 4) : 0)).filter((_, i) => counts[i] > 0);
  const sorted = [...per].sort((p, q) => p - q);
  return { score: sorted.length ? sorted[sorted.length - 1] : 0, model: M, tiles: per };
}

// Stretches where only the camera moves: score under threshold for longer than maxSeconds.
// scores[i] belongs to frame i (NaN where it wasn't measured: the first frames, across a cut).
export function cameraOnlyStretches(raw, fps, { liveThreshold = LIVE_DEFAULTS.liveThreshold, maxCameraOnlySeconds = LIVE_DEFAULTS.maxCameraOnlySeconds, liveWindowSeconds = LIVE_DEFAULTS.liveWindowSeconds } = {}) {
  const out = [];
  // running median of the measured frames within half a window either side
  const half = Math.max(1, Math.round((liveWindowSeconds * fps) / 2));
  const scores = raw.map((s, i) => {
    if (!Number.isFinite(s)) return NaN;
    const w = [];
    for (let k = Math.max(0, i - half); k <= Math.min(raw.length - 1, i + half); k++) if (Number.isFinite(raw[k])) w.push(raw[k]);
    w.sort((a, b) => a - b);
    return w[w.length >> 1];
  });
  // frames that weren't measured (between samples) carry the state of the last measured one;
  // a run of unmeasured frames longer than the window (a cut) ends a stretch
  let a = -1, last = false, gap = 0;
  for (let i = 0; i <= scores.length; i++) {
    const s = scores[i];
    if (i < scores.length && !Number.isFinite(s)) gap++; else gap = 0;
    const dead = i < scores.length && (Number.isFinite(s) ? s < liveThreshold : last && gap <= half * 2);
    if (i < scores.length && Number.isFinite(s)) last = dead;
    if (dead && a < 0) a = i;
    if (!dead && a >= 0) {
      const secs = (i - a) / fps;
      if (secs > maxCameraOnlySeconds + 1e-9) {
        const run = scores.slice(a, i);
        out.push({ from: a / fps, to: i / fps, seconds: +secs.toFixed(2), startFrame: a, endFrame: i - 1, peak: +Math.max(...run).toFixed(2) });
      }
      a = -1;
    }
  }
  return out;
}

// Camera speed profiles (frame heights per second, one value per sampled frame) from render.mjs
// camera: shots that start and end at a standstill. A shot whose camera never really moves is
// left to the live gate.
export function restToRest(tracks, scenes, { restFraction = LIVE_DEFAULTS.restFraction, minPeak = LIVE_DEFAULTS.minPeak } = {}) {
  const out = [];
  for (const tr of tracks) {
    const sc = scenes.find((s) => s.id === tr.id);
    if (!sc || sc.rest || !tr.speed?.length) continue;
    const v = tr.speed, peak = Math.max(...v);
    if (peak < minPeak) continue;
    const k = Math.max(1, Math.round(v.length * 0.04));
    const head = v.slice(0, k).reduce((a, b) => a + b, 0) / k, tail = v.slice(-k).reduce((a, b) => a + b, 0) / k;
    if (head < restFraction * peak && tail < restFraction * peak) out.push({ id: sc.id, scene: sc.scene, from: sc.from, peak: +peak.toFixed(3), head: +(head / peak).toFixed(2), tail: +(tail / peak).toFixed(2) });
  }
  return out;
}
