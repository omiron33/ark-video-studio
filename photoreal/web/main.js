import { Engine, W, H } from './engine.js';

const params = new URLSearchParams(location.search);
const sceneName = params.get('scene');
const sceneParams = JSON.parse(atob(params.get('params') ?? 'e30='));

const G = (window.G = { ready: false, error: null });
window.addEventListener('error', (e) => { G.error = String(e.message); });

try {
  const [lyrics, mod] = await Promise.all([
    import('./timing.js').then((m) => m.default),
    import(`/song/scenes/${sceneName}.js`),
  ]);
  await document.fonts.load('500 64px "EB Garamond"');
  await document.fonts.load('italic 500 64px "EB Garamond"');
  await document.fonts.load('500 64px "Inter Tight"');
  // a scene module exports a scene, or a factory that builds one from the film's parameters
  const scene = typeof mod.default === 'function' ? await mod.default(sceneParams) : mod.default;
  const engine = new Engine(document.getElementById('c'));
  engine.load(scene, lyrics);
  const gl = engine.renderer.getContext();
  const buf = new Uint8Array(W * H * 4);
  Object.assign(G, {
    scene: { name: scene.name, from: scene.from, to: scene.to },
    // render one frame to the canvas and wait for the GPU
    still(t, samples = 16) { engine.frame(t, { samples }); gl.finish(); return true; },
    // render a range and stream raw RGBA frames to the local recorder
    async stream({ from, to, fps = 60, samples = 16, shutter = 0.5, url }) {
      const n = Math.round((to - from) * fps);
      const t0 = performance.now();
      for (let i = 0; i < n; i++) {
        engine.frame(from + i / fps, { fps, samples, shutter });
        engine.readPixels(buf);
        const r = await fetch(url, { method: 'POST', body: buf });
        if (!r.ok) throw Error('recorder refused frame ' + i);
      }
      return { frames: n, ms: performance.now() - t0 };
    },
  });
  G.ready = true;
} catch (e) {
  G.error = String((e && e.stack) || e);
}
