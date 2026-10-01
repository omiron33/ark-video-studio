// A hero-object scene: a gold chalice of dark wine on a glossy black floor, lit like a product shot,
// with the lyric set in real type on the floor in front of it. The camera pushes in slowly and the
// focus racks from the words to the cup.
import { studio, materials } from '/premium/studio.js';
import { htmlText } from '/premium/text.js';
import { FINISH } from '/premium/finish.js';
import { anchor } from '/timing.js';

export const kind = 'three';
const A = anchor('and every beast');
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export default (P) => {
  let words;
  return {
    name: 'chalice', from: P.from, to: P.to,
    async build({ THREE, renderer }) {
      const scene = new THREE.Scene();
      studio(renderer, scene, { floor: 'gloss', key: { pos: [-1.6, 1.8, 1.4], size: [1.4, 0.8], intensity: 10, target: [0, 0.4, 0] } });
      // the cup: a lathe of a classic chalice profile
      const pts = [[0, 0], [0.32, 0], [0.33, 0.03], [0.12, 0.08], [0.05, 0.12], [0.045, 0.45], [0.09, 0.5], [0.05, 0.54], [0.06, 0.62], [0.24, 0.7], [0.3, 0.86], [0.31, 0.95], [0.295, 0.95], [0.285, 0.87], [0.23, 0.72], [0.0, 0.66]].map(([x, y]) => new THREE.Vector2(x, y));
      // a smooth profile through the control points
      const prof = new THREE.SplineCurve(pts).getPoints(220);
      const cup = new THREE.Mesh(new THREE.LatheGeometry(prof, 200), materials.gold({ roughness: 0.16 }));
      scene.add(cup);
      const wine = new THREE.Mesh(new THREE.CircleGeometry(0.284, 96), materials.wine());
      wine.rotation.x = -Math.PI / 2; wine.position.y = 0.9; scene.add(wine);
      // words on the floor, in front of the cup
      words = await htmlText({ width: 2048, height: 512, css: 'font: 500 150px "EB Garamond"; color: #f2e4c4; letter-spacing: -0.01em; text-shadow: 0 0 24px rgba(255,190,110,0.45)' });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: words.texture, transparent: true, toneMapped: false, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
      plane.rotation.x = -Math.PI / 2; plane.position.set(0, 0.004, 0.62); scene.add(plane);
      return { scene };
    },
    async prepare(t) {
      const html = A.lines[0].words.map((w) => `<span style="opacity:${ease((t - w.start) / 0.25).toFixed(3)}">${w.w}</span>`).join(' ');
      await words.set(html);
    },
    camera(t) {
      const p = ease((t - P.from) / (P.to - P.from));
      const pos = [0.45 - 0.25 * p, 1.05 - 0.2 * p, 3.1 - 0.6 * p];
      const target = [0, 0.42, 0.15];
      // rack focus: from the words on the floor to the cup
      const d = (q) => Math.hypot(pos[0] - q[0], pos[1] - q[1], pos[2] - q[2]);
      const focus = d([0, 0, 0.62]) + (d(target) - d([0, 0, 0.62])) * ease((t - P.from - 0.6) / 0.8);
      return { pos, target, fov: 28, focus, aperture: 0.015 };
    },
    update(t, { scene }) { scene.rotation.y = 0.15 * Math.sin(t * 0.5); },
    post() { return { exposure: 1.1, bloom: 0.12, threshold: 0.9, grain: 0.025, vignette: 0.55, ca: 0.25 }; },
    finish(t) { return { ...FINISH.studio, fade: 0 }; },
  };
};
