// A deliberately frozen frame with baked words, so the still and cut gates have something to find.
import { cameraPlane } from '/engine.js';
import { anchor } from '/timing.js';
const A = anchor('and every beast');
export default (P) => ({
  name: 'hold', from: P.from, to: P.to, textSize: [4096, 1024],
  frag: /* glsl */ `
vec3 shade(vec2 fc) {
  vec3 ro; vec3 rd = camRay(fc, ro);
  vec3 c = vec3(0.75, 0.74, 0.7);
  vec3 tp = planeUV(ro, rd, uTxC, uTxX, uTxY, uTxHS);
  if (tp.z > 0.0 && all(greaterThan(tp.xy, vec2(0))) && all(lessThan(tp.xy, vec2(1)))) {
    vec4 tx = texture(uText, tp.xy);
    c = c * (1.0 - tx.a) + pow(tx.rgb, vec3(2.2));
  }
  return c;
}`,
  camera() { return { pos: [0, 0, 0], target: [0, 0, 1], fov: 40 }; },
  textPlane(t, cam) { return cameraPlane(cam, { y: 0, width: 0.8, dist: 2 }); },
  drawText(ctx, t) {
    ctx.font = '500 190px "EB Garamond"'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgb(236,232,222)';                 // pale words on a pale ground: the contrast gate should fail this
    ctx.fillText(A.lines[0].words.map((w) => w.w).join(''), 2048, 512);   // run together on purpose
  },
});
