// Life kit: secondary action, the motion that makes a frame read as footage rather than a still
// being pushed. Dust turning in a beam, embers rising off a fire, a flame that never repeats, heat
// haze, cloth and grass moving in gusts that travel across them, drifting haze for light shafts.
// Each film so far wrote its own; these are the shared versions, built from what worked in Salt and
// Light (motes in the temple beam and the lamplight), Genesis 6 (the ember sparks and the shimmer)
// and Genesis 3 (dust and wind on the plain).
//
// GLSL: add LIFE_GLSL after COMMON in a scene's frag (frag: LIFE_GLSL + MY_WORLD) and call the
// functions in shade(). Everything is named life* so it never collides with a film's own helpers.
// Pass the depth of the scene's hit along the ray, so particles go behind what stands in front.
// Motes take the scene's light: define LIFE_LIGHT(p) before LIFE_GLSL (for example the beam's
// density at p) or they are lit evenly.
//
// JS: flicker() and gust() give the same motion for uniforms (a lamp's light on a wall, the wind
// on a rig).
//
// Files under web/kit/ count only toward the scenes that import them (see lib/keys.mjs).
import { fractal } from '/kit/motion.js';

export const LIFE_GLSL = /* glsl */ `
#ifndef LIFE_LIGHT
#define LIFE_LIGHT(p) 1.0
#endif

// smooth 1D gradient noise, -1..1
float lifeNoise(float x) {
  float i = floor(x), f = x - i;
  float g0 = hash11(i) * 2.0 - 1.0, g1 = hash11(i + 1.0) * 2.0 - 1.0;
  float u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return 2.0 * mix(g0 * f, g1 * (f - 1.0), u);
}
float lifeFractal(float x, float seed) {
  return (lifeNoise(x + seed * 17.0) + 0.55 * lifeNoise(x * 2.13 + seed * 31.0 + 5.0) + 0.3 * lifeNoise(x * 4.5 + seed * 7.0 + 9.0)) / 1.85;
}

// Light a ray picks up passing a glowing point c of radius r, hidden behind anything nearer than
// depth. Soft enough to read as a defocused speck at small r.
float lifeGlow(vec3 ro, vec3 rd, vec3 c, float r, float depth) {
  vec3 oc = c - ro; float tc = dot(oc, rd);
  if (tc < 0.0 || tc > depth) return 0.0;
  float h2 = max(dot(oc, oc) - tc * tc, 0.0);
  return r * r / (h2 + r * r * 0.15);
}

// A flame's brightness: never periodic, quick small flutters over a slow breath, and now and then a
// gutter. About 0.7 to 1.15.
float lifeFlicker(float t, float seed) {
  float slow = lifeFractal(t * 0.9, seed), fast = lifeFractal(t * 7.0, seed + 3.0);
  float gutter = smoothstep(0.75, 1.0, lifeNoise(t * 0.45 + seed * 11.0)) * 0.25;
  return 0.94 + 0.12 * slow + 0.07 * fast - gutter;
}

// Wind that comes in gusts, travelling across the world along dir (xz) at speed: the far side moves
// a moment after the near side, so a field of grass or a row of banners never moves in unison.
float lifeGust(vec2 xz, vec2 dir, float speed) {
  float s = dot(xz, normalize(dir)) / max(speed, 1e-3);
  float x = uTime - s;
  return 0.55 + 0.35 * lifeFractal(x * 0.35, 1.0) + 0.25 * lifeFractal(x * 1.3 + dot(xz, vec2(0.37, 0.71)), 2.0);
}
// Displacement of a point on something rooted (a stalk, a branch, a hanging cloth), at fraction h
// of its length from the root (0 at the root, 1 at the tip): it bends more toward the tip and the
// tip lags the root (follow-through). strength in scene units at the tip.
vec3 lifeSway(vec3 p, float h, vec2 dir, float strength) {
  float g = lifeGust(p.xz, dir, 4.0);
  float lag = lifeFractal((uTime - 0.25 * h) * 1.7 + dot(p.xz, vec2(1.3, 0.7)), 4.0);
  vec2 d = normalize(dir);
  float bend = strength * h * h * (g + 0.25 * lag);
  return vec3(d.x * bend, -0.15 * abs(bend) * h, d.y * bend) + vec3(-d.y, 0.0, d.x) * strength * 0.2 * h * h * lag;
}

// Dust motes turning in the air of a box (centre C, half size H): count specks of radius r drifting
// on slow eddies and the wind (scene units per second), wrapping inside the box and fading at its
// faces so none pops in, each catching the light now and then as it turns. Lit by LIFE_LIGHT(p).
vec3 lifeMotes(vec3 ro, vec3 rd, float depth, vec3 C, vec3 H, int count, float r, vec3 wind, vec3 tint, float seed) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 96; i++) {
    if (i >= count) break;
    float fi = float(i) + seed * 101.0;
    vec3 base = hash33(vec3(fi, fi * 1.7, seed + 3.1)) * 2.0 - 1.0;
    vec3 ph = hash33(vec3(fi * 3.3, seed, 7.7)) * 6.2831;
    vec3 eddy = vec3(sin(uTime * 0.23 + ph.x) + 0.5 * sin(uTime * 0.51 + ph.y),
                     sin(uTime * 0.19 + ph.y) + 0.5 * sin(uTime * 0.43 + ph.z),
                     sin(uTime * 0.21 + ph.z) + 0.5 * sin(uTime * 0.47 + ph.x)) * 0.08;
    vec3 q = base + (wind * uTime) / H + eddy;
    q = mod(q + 1.0, 2.0) - 1.0;                                   // wrap inside the box
    float edge = smoothstep(1.0, 0.8, max(abs(q.x), max(abs(q.y), abs(q.z))));
    vec3 p = C + q * H;
    float turn = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (0.8 + 1.4 * hash11(fi * 9.1)) + ph.x * 3.0), 6.0);
    acc += tint * lifeGlow(ro, rd, p, r * (0.6 + 0.8 * hash11(fi * 5.3)), depth) * edge * turn * LIFE_LIGHT(p);
  }
  return acc;
}

// Blackbody-ish colour of a spark cooling from white-yellow (T = 1) through orange to dull red (0).
vec3 lifeHeat(float T) {
  vec3 c = mix(vec3(0.0), vec3(0.42, 0.035, 0.004), smoothstep(0.0, 0.3, T));
  c = mix(c, vec3(1.8, 0.55, 0.1), smoothstep(0.3, 0.65, T));
  return mix(c, vec3(3.6, 1.9, 0.7), smoothstep(0.65, 1.0, T));
}

// Embers rising off a fire: count sparks born on a disc of radius R round O, rising at about rise
// units per second, pushed by the wind and wandering, cooling and fading over a life of 1.5 to 3.5 s.
// Each has its own birth time, so they never rise in step. size: spark radius.
vec3 lifeEmbers(vec3 ro, vec3 rd, float depth, vec3 O, float R, float rise, int count, vec3 wind, float size, float seed) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 64; i++) {
    if (i >= count) break;
    float fi = float(i) + seed * 53.0;
    float life = 1.5 + 2.0 * hash11(fi * 3.1);
    float k = mod(uTime + hash11(fi * 7.7) * life, life);
    float cyc = floor((uTime + hash11(fi * 7.7) * life) / life);
    vec2 o = (hash22(vec2(fi, cyc)) - 0.5) * 2.0 * R;
    float up = rise * (0.6 + 0.8 * hash11(fi + cyc * 1.3));
    vec3 p = O + vec3(o.x, 0.0, o.y) + vec3(0.0, up * k * (1.0 - 0.12 * k), 0.0) + wind * k * k * 0.5;
    p.x += 0.35 * R * sin(k * (1.7 + hash11(fi * 2.1)) + fi) * k;
    p.z += 0.35 * R * cos(k * (1.3 + hash11(fi * 4.3)) + fi) * k;
    float T = clamp(1.0 - k / life * 1.15, 0.0, 1.0);
    float b = smoothstep(0.0, 0.12, k) * smoothstep(life, life * 0.6, k) * (0.75 + 0.25 * lifeNoise(uTime * 23.0 + fi * 5.0));
    acc += lifeHeat(T) * lifeGlow(ro, rd, p, size, depth) * b;
  }
  return acc;
}

// Heat haze: an offset to add to a ray's direction (rd = normalize(rd + vec3(lifeShimmer(fc, a), 0)))
// above something hot. Rising, never a regular ripple. amount about 0.002 to 0.004.
vec2 lifeShimmer(vec2 fc, float amount) {
  vec2 sp = fc / uRes.y;
  vec2 d = vec2(vnoise(vec2(sp.x * 9.0, sp.y * 7.0 - uTime * 2.2)), vnoise(vec2(sp.x * 9.0 + 5.0, sp.y * 7.0 - uTime * 2.6))) - 0.5;
  return d * amount;
}

// Haze drifting through the air (for light shafts and fog banks): density 0..1 at p, carried by
// the wind and slowly changing shape. scale: size of the swirls in scene units.
float lifeHaze(vec3 p, vec3 wind, float scale) {
  vec3 q = p / scale - wind * uTime / scale;
  return fbm(q + vec3(0.0, uTime * 0.03, 0.0), 4);
}
`;

// The same flame flicker, for a uniform (a lamp's light on the wall it stands by).
export function flicker(t, seed = 0) {
  const slow = fractal(t * 0.9, { seed, octaves: 3 }), fast = fractal(t * 7.0, { seed: seed + 3, octaves: 3 });
  const g = fractal(t * 0.45, { seed: seed + 11, octaves: 1 });
  const gutter = g > 0.5 ? Math.min(1, (g - 0.5) / 0.4) * 0.25 : 0;
  return 0.94 + 0.12 * slow + 0.07 * fast - gutter;
}
// Wind strength in gusts, about 0.3 to 1.1, for a uniform or a rig.
export const gust = (t, seed = 0) => 0.6 + 0.3 * fractal(t * 0.35, { seed, octaves: 3 }) + 0.2 * fractal(t * 1.3, { seed: seed + 2, octaves: 2 });
