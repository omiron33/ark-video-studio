import { cameraPlane } from '/engine.js';
import { anchor } from '/timing.js';
import { setWords } from '/song/lib/type.js';
const A = anchor('God remembered');
export default () => ({
  textSize: [4096, 1024],
  textPlane(t, cam) { return cameraPlane(cam, { y: -0.35, width: 0.8, dist: 2 }); },
  drawText(ctx, t) { setWords(ctx, A.lines[0].words, t); },
});
