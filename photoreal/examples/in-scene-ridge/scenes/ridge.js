// Example of the default lyric mode: the words are part of the world. "upon the mountains of Ararat"
// burns into the near face of a ridge just under its crest, following the crest as it rises and
// falls. The letters are embers in the rock: they light the slope around them, take the terrain's
// contour lines across them, fall away in the haze with distance and are hidden where a nearer spur
// crosses in front. Each word catches as it is sung. Nothing is laid over the picture.
//   node photoreal/render.mjs stills --song photoreal/examples/in-scene-ridge --scene ridge --t 5.5
const X0 = -7, X1 = 15;             // the text runs along the ridge from x = -7 to 15 m
const V = 2.0;                      // ...and from the crest down to 2 m below it
const TW = 8192, TH = Math.round(TW * V / (X1 - X0));   // same pixels per metre both ways

const ease = (x) => { x = Math.min(1, Math.max(0, x)); return 1 - (1 - x) ** 3; };

export default (P) => ({
  name: 'ridge', from: P.from, to: P.to,
  textSize: [TW, TH],
  frag: /* glsl */ `
// the ridge: a crest wandering along x, a long slope toward the camera (+z), detail from fbm
float crestZ(float x) { return 1.6 * sin(x * 0.21) + 0.7 * sin(x * 0.53 + 1.0); }
float crestH(float x) { return 3.2 + 0.9 * sin(x * 0.17 + 0.4) + 0.35 * sin(x * 0.61); }
float terrain(vec2 q) {
  float d = q.y - crestZ(q.x);
  float prof = crestH(q.x) * exp(-d * d * (d > 0.0 ? 0.045 : 0.09));
  // a nearer spur, lower, crossing in front of the right-hand end
  float s = q.y - (6.5 + 0.25 * (q.x - 9.0));
  prof = max(prof, (1.9 - 0.08 * abs(q.x - 11.0)) * exp(-s * s * 0.35) * smoothstep(3.5, 7.0, q.x));
  return prof + 0.35 * (fbm(q * 0.45, 5) - 0.5) + 0.05 * fbm(q * 3.1, 3);
}
vec3 terrainN(vec2 q) {
  vec2 e = vec2(0.02, 0.0);
  return normalize(vec3(terrain(q - e.xy) - terrain(q + e.xy), 2.0 * e.x, terrain(q - e.yx) - terrain(q + e.yx)));
}
// where the words are on the rock: x along the ridge, depth below this x's crest on the near face
vec2 textUV(vec3 p) {
  return vec2((p.x - (${X0.toFixed(1)})) / ${(X1 - X0).toFixed(1)}, 1.0 - (crestH(p.x) - p.y) / ${V.toFixed(1)});
}
vec3 skyCol(vec3 rd) {
  vec3 hi = vec3(0.006, 0.009, 0.020), lo = vec3(0.075, 0.05, 0.045);
  return mix(lo, hi, pow(sat(rd.y * 4.0 + 0.02), 0.6));
}

vec3 shade(vec2 fc) {
  vec3 ro; vec3 rd = camRay(fc, ro);
  float t = 0.5, hit = -1.0;
  for (int i = 0; i < 220; i++) {
    vec3 p = ro + rd * t;
    float h = p.y - terrain(p.xz);
    if (h < 0.002 * t) { hit = t; break; }
    t += max(0.012, h * 0.45);
    if (t > 90.0) break;
  }
  if (hit < 0.0) return skyCol(rd);
  vec3 p = ro + rd * hit, n = terrainN(p.xz);
  // dark basalt, a little warmer in the gullies
  float g = fbm(p.xz * 1.7, 4);
  vec3 alb = mix(vec3(0.020, 0.019, 0.021), vec3(0.055, 0.045, 0.040), g);
  vec3 moon = normalize(vec3(0.35, 0.45, -0.8));   // behind the ridge: a cold rim along the crest
  vec3 col = alb * (vec3(1.6, 1.9, 2.6) * pow(sat(dot(n, moon)), 2.0) + vec3(0.10, 0.12, 0.18) * (0.3 + 0.7 * sat(n.z)) + vec3(0.06, 0.07, 0.1) * sat(n.y));
  // contour lines every 0.25 m of height: survey hairlines, a little brighter on the ridge
  float ch = p.y / 0.25, cw = fwidth(ch);
  float contour = smoothstep(0.0, 1.2 * cw, abs(fract(ch) - 0.5) * 2.0 - (1.0 - 1.4 * cw));
  // cross-section lines along the slope every 0.5 m, so the contours read as a survey mesh
  float sx = p.x / 0.5, sw = fwidth(sx);
  float section = smoothstep(0.0, 1.2 * sw, abs(fract(sx) - 0.5) * 2.0 - (1.0 - 1.4 * sw));
  float mesh = max(contour, 0.4 * section) * exp(-hit * 0.025);
  float lit = 0.0;   // how much the burning words light this spot
  // the words, on the near face only: ember letters cut into the rock
  vec2 uv = textUV(p);
  float dz = p.z - crestZ(p.x);
  float near = smoothstep(0.0, 0.4, dz) * smoothstep(4.5, 3.5, dz);
  if (near > 0.0 && all(greaterThan(uv, vec2(0.0))) && all(lessThan(uv, vec2(1.0)))) {
    vec4 tx = texture(uText, uv);
    vec4 glow = texture(uTextShade, uv) * smoothstep(0.0, 0.08, uv.y) * smoothstep(1.0, 0.92, uv.y);
    // the letters light the rock around them, warmest close in
    lit = sat(glow.a * 3.0) * near;
    col += vec3(1.0, 0.36, 0.08) * 0.45 * glow.a * near * (0.4 + 0.6 * sat(dot(n, vec3(0.0, 0.3, 1.0))));
    // ember core: white-gold where the cut is deepest, orange at its edges, contour lines across it
    vec3 ember = mix(vec3(1.0, 0.30, 0.05) * 1.4, vec3(1.0, 0.72, 0.38) * 1.9, smoothstep(0.6, 1.0, tx.a) * (0.6 + 0.4 * fbm(p.xy * 9.0 + uTime * 0.7, 3)));
    ember *= 1.0 - 0.35 * contour;
    col = mix(col, ember, tx.a * near);
  }
  // the survey lines glow faintly everywhere and burn hot where the words light them
  col += vec3(1.0, 0.42, 0.12) * mesh * (0.55 + 2.0 * lit);
  // haze with distance, a little warm at ground level
  float fog = 1.0 - exp(-hit * 0.016);
  return mix(col, skyCol(normalize(vec3(rd.x, 0.02, rd.z))) * 1.2, fog);
}`,
  camera(t) {
    // a slow, low track along the ridge, the crest just above frame centre
    const p = (t - P.from) / (P.to - P.from);
    const x = -1.5 + 2.5 * p;
    return { pos: [x, 2.4, 19.0], target: [x + 2.5, 2.6, 0.5], fov: 38, roll: 0 };
  },
  post() { return { exposure: 1.1, bloom: 0.14, threshold: 0.9, vignette: 0.55, grain: 0.03, ca: 0.25 }; },
  drawText(ctx, t, lyrics) {
    const px = (x) => ((x - X0) / (X1 - X0)) * TW;
    const size = Math.round(TH * 0.56);
    ctx.font = `600 ${size}px "EB Garamond"`;
    ctx.textBaseline = 'alphabetic';
    let x = px(-3.0);
    for (const w of lyrics.words) {
      // each word catches as it is sung and burns up to full over 0.25 s
      const k = ease((t - w.start + 0.05) / 0.25);
      if (k > 0) { ctx.fillStyle = `rgba(255,255,255,${k.toFixed(3)})`; ctx.fillText(w.w, x, TH * 0.66); }
      x += ctx.measureText(w.w + ' ').width;
    }
  },
});
