// A drifting dusk sky: the picture only; its words are in sky.lyric.js.
export default (P) => ({
  name: 'sky', from: P.from, to: P.to,
  frag: /* glsl */ `
vec3 shade(vec2 fc) {
  vec3 ro; vec3 rd = camRay(fc, ro);
  float h = rd.y;
  vec3 c = mix(vec3(0.9, 0.55, 0.3), vec3(0.08, 0.12, 0.3), sat(h * 2.0 + 0.4));
  c += vec3(0.4) * vnoise(rd.xy * 6.0 + vec2(uTime * 0.3, 0.0)) * sat(h + 0.6);
  return c;
}`,
  camera(t) { return { pos: [0, 0, 0], target: [Math.sin(t * 0.8) * 0.4, 0.1, 1], fov: 40 }; },
});
