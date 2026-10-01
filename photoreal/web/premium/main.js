// The premium page: the same contract as ../main.js, for scenes that declare a kind ('three' for a
// Three.js scene, 'shader' for a raymarched scene that wants the lens and finishing kit). Frames are
// prepared asynchronously first, because in-world HTML text has to be painted before it is drawn.
import { W, H } from '../engine.js';
import { PremiumEngine } from './engine.js';
import { LyricLayer } from '../layer.js';

const params = new URLSearchParams(location.search);
const sceneName = params.get('scene');
const sceneParams = JSON.parse(atob(params.get('params') ?? 'e30='));
const hasLyric = params.get('lyric') === '1';

const G = (window.G = { ready: false, error: null });
window.addEventListener('error', (e) => { G.error = String(e.message); });

try {
  const [lyrics, mod, lyricMod] = await Promise.all([
    import('../timing.js').then((m) => m.default),
    import(`/song/scenes/${sceneName}.js`),
    hasLyric ? import(`/song/scenes/${sceneName}.lyric.js`) : null,
  ]);
  await document.fonts.load('500 64px "EB Garamond"');
  await document.fonts.load('italic 500 64px "EB Garamond"');
  await document.fonts.load('500 64px "Inter Tight"');
  for (const f of ['600 64px "EB Garamond"', '700 64px "EB Garamond"', '800 64px "EB Garamond"', 'italic 400 64px "EB Garamond"', 'italic 600 64px "EB Garamond"', '300 64px "Inter Tight"', '700 64px "Inter Tight"', '800 64px "Inter Tight"']) await document.fonts.load(f);
  // a scene module exports a scene, or a factory that builds one from the film's parameters
  const build = async (m) => (typeof m.default === 'function' ? await m.default(sceneParams) : m.default);
  const scene = await build(mod);
  const lyric = lyricMod ? await build(lyricMod) : null;
  const engine = new PremiumEngine(document.getElementById('c'));
  await engine.loadPremium(params.get('kind') ?? 'three', scene, lyrics);
  const layer = lyric ? new LyricLayer(engine, scene, lyric, lyrics) : null;
  const gl = engine.renderer.getContext();
  const buf = new Uint8Array(W * H * 4);
  Object.assign(G, {
    scene: { name: scene.name, from: scene.from, to: scene.to, layer: !!layer },
    // render one frame to the canvas (with its lyric layer on top) and wait for the GPU
    async still(t, samples = 16) {
      await engine.prepare(t);
      engine.frame(t, { samples });
      if (layer) { layer.frame(t, { samples }); layer.overScreen(); }
      gl.finish(); return true;
    },
    // time `n` frames of the picture at `samples` sub-frames, after one warm-up frame
    async time(t, samples, n = 3) {
      await engine.prepare(t); engine.frame(t, { samples }); gl.finish();
      const t0 = performance.now();
      for (let i = 0; i < n; i++) { await engine.prepare(t + i / 60); engine.frame(t + i / 60, { samples }); gl.finish(); }
      return (performance.now() - t0) / n;
    },
    cameraAt(t) { const c = scene.camera(t); return { pos: c.pos, target: c.target, fov: c.fov ?? 40, roll: c.roll ?? 0 }; },
    // render a range and stream raw RGBA frames to the local recorder: the picture, or with
    // { layer: true } the lyric layer alone (straight alpha)
    async stream({ from, to, fps = 60, samples = 16, shutter = 0.5, url, layer: onlyLayer = false }) {
      if (onlyLayer && !layer) throw Error('this scene has no lyric layer');
      const n = Math.round((to - from) * fps);
      const t0 = performance.now();
      for (let i = 0; i < n; i++) {
        const t = from + i / fps;
        if (onlyLayer) { layer.frame(t, { fps, samples, shutter }); layer.readPixels(buf); }
        else { await engine.prepare(t); engine.frame(t, { fps, samples, shutter }); engine.readPixels(buf); }
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
