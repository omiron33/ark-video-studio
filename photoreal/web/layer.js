// The lyric as its own layer. A scene that keeps its typography in scenes/<name>.lyric.js renders
// its picture (the plate) with no words in it, and this pass renders the words alone, with
// transparency, from the same camera. The two are composited after rendering, so a typography change
// re-renders only this cheap layer and never the scene behind it.
//
// A lyric module exports (params) => ({ textSize?, textPlane(t, cam), drawText(ctx, t, lyrics), shade? }).
// `shade` (0..1, default 0.6) is a soft darkening round light words (a lift round dark ones) that
// keeps them readable over whatever passes behind; the contrast gate measures the result.
// Words in this layer are not hidden by objects in the scene. Words that must sit behind something,
// refract through water or take the scene's fog belong in the scene itself.
import * as THREE from 'three';
import { COMMON } from './glsl.js';
import { W, H } from './engine.js';

// song-wide lyric settings from film.json ("lyric": { "haloSpread": 9, "shade": 0.6 }); a lyric
// module's own values win
const SONG_LYRIC = await fetch('/song/film.json').then((r) => (r.ok ? r.json() : {})).then((f) => f.lyric ?? {}).catch(() => ({}));

const VERT = /* glsl */ `in vec3 position; void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function pass(frag, uniforms, opts = {}) {
  const mat = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...opts });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  return { scene, u: uniforms };
}
const rt = (type) => new THREE.WebGLRenderTarget(W, H, { type, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
function r2(i) { const g = 1.32471795724474602596; return [((0.5 + i / g) % 1) - 0.5, ((0.5 + i / (g * g)) % 1) - 0.5]; }

export class LyricLayer {
  constructor(engine, scene, lyric, lyrics) {
    this.engine = engine; this.scene = scene; this.lyric = lyric; this.lyrics = lyrics;
    const tc = document.createElement('canvas');
    tc.width = lyric.textSize?.[0] ?? 4096; tc.height = lyric.textSize?.[1] ?? 1024;
    this.canvas = tc;
    this.tex = new THREE.CanvasTexture(tc);
    Object.assign(this.tex, { colorSpace: THREE.NoColorSpace, generateMipmaps: true, premultiplyAlpha: true, minFilter: THREE.LinearMipmapLinearFilter });
    this.tex.anisotropy = engine.renderer.capabilities.getMaxAnisotropy();
    const sc = document.createElement('canvas');
    sc.width = Math.round(tc.width / 4); sc.height = Math.round(tc.height / 4);
    this.shadeCanvas = sc;
    this.shadeTex = new THREE.CanvasTexture(sc);
    Object.assign(this.shadeTex, { colorSpace: THREE.NoColorSpace, premultiplyAlpha: true, minFilter: THREE.LinearFilter, generateMipmaps: false });
    this.accum = rt(THREE.FloatType);
    this.out = rt(THREE.UnsignedByteType);
    const V = () => new THREE.Vector3();
    this.draw = pass(COMMON + /* glsl */ `
uniform float uShade, uHaloSpread;
out vec4 o;
void main() {
  vec3 ro; vec3 rd = camRay(gl_FragCoord.xy, ro);
  vec3 tp = planeUV(ro, rd, uTxC, uTxX, uTxY, uTxHS);
  if (tp.z < 0.0 || any(lessThan(tp.xy, vec2(0))) || any(greaterThan(tp.xy, vec2(1)))) { o = vec4(0); return; }
  vec4 tx = texture(uText, tp.xy);           // premultiplied sRGB ink
  vec4 bl = texture(uTextShade, tp.xy);
  float halo = sat(bl.a * uHaloSpread) * uShade;
  vec3 ink = bl.a > 1e-3 ? bl.rgb / bl.a : vec3(1);
  float il = dot(ink, vec3(0.2126, 0.7152, 0.0722));
  vec3 haloCol = il > 0.4 ? vec3(0) : vec3(1);  // darken under light words, lift under dark ones
  float a = tx.a + halo * (1.0 - tx.a);
  o = vec4(tx.rgb + haloCol * halo * (1.0 - tx.a), a);   // premultiplied
}`, {
      uRes: { value: new THREE.Vector2(W, H) }, uJitter: { value: new THREE.Vector2() }, uCamPos: { value: V() }, uCamTarget: { value: V() }, uCamRoll: { value: 0 }, uFov: { value: 40 },
      uText: { value: this.tex }, uTextShade: { value: this.shadeTex }, uTxC: { value: V() }, uTxX: { value: new THREE.Vector3(1, 0, 0) }, uTxY: { value: new THREE.Vector3(0, 1, 0) }, uTxHS: { value: new THREE.Vector2(1, 0.25) },
      uShade: { value: lyric.shade ?? SONG_LYRIC.shade ?? 0.6 },
      // how far the backing spreads round the letters: 9 is what Genesis 8 settled on for readability
      uHaloSpread: { value: lyric.haloSpread ?? SONG_LYRIC.haloSpread ?? 9 },
    }, { transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor });
    // accumulated premultiplied average -> straight-alpha 8-bit for the encoder
    this.resolve = pass(/* glsl */ `precision highp float; uniform sampler2D src; uniform float n; out vec4 o;
      void main() { vec4 c = texelFetch(src, ivec2(gl_FragCoord.xy), 0); o = c.a > 1e-4 ? vec4(clamp(c.rgb / c.a, 0.0, 1.0), clamp(c.a / n, 0.0, 1.0)) : vec4(0); }`, { src: { value: this.accum.texture }, n: { value: 1 } });
    // straight-alpha layer over whatever is on screen (for stills)
    this.over = pass(/* glsl */ `precision highp float; uniform sampler2D src; out vec4 o;
      void main() { o = texelFetch(src, ivec2(gl_FragCoord.xy), 0); }`, { src: { value: this.out.texture } },
      { transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  drawText(t) {
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.lyric.drawText(ctx, t, this.lyrics);
    this.tex.needsUpdate = true;
    const sx = this.shadeCanvas.getContext('2d');
    sx.clearRect(0, 0, this.shadeCanvas.width, this.shadeCanvas.height);
    sx.filter = `blur(${Math.round(this.shadeCanvas.height / 60)}px)`;
    sx.drawImage(this.canvas, 0, 0, this.shadeCanvas.width, this.shadeCanvas.height);
    sx.filter = 'none';
    this.shadeTex.needsUpdate = true;
  }

  // Render the layer at song time t into this.out (same shutter and jitter as the plate).
  frame(t, { fps = 60, samples = 16, shutter = 0.5 } = {}) {
    const r = this.engine.renderer, u = this.draw.u;
    const fi = Math.round(t * fps);
    this.drawText(t);
    r.setRenderTarget(this.accum); r.setClearColor(0x000000, 0); r.clear();
    for (let k = 0; k < samples; k++) {
      const st = t + ((k + 0.5) / samples - 0.5) * shutter / fps;
      const [jx, jy] = r2(k + fi * 7);
      u.uJitter.value.set(jx, jy);
      const cam = this.scene.camera(st);
      u.uCamPos.value.set(...cam.pos); u.uCamTarget.value.set(...cam.target); u.uCamRoll.value = cam.roll ?? 0; u.uFov.value = cam.fov ?? 40;
      const tp = this.lyric.textPlane(st, cam);
      u.uTxC.value.set(...tp.c); u.uTxX.value.set(...tp.ax); u.uTxY.value.set(...tp.ay); u.uTxHS.value.set(...tp.hs);
      r.render(this.draw.scene, this.cam);
    }
    // the draw pass sums premultiplied samples: colour / alpha unpremultiplies, alpha / samples averages
    this.resolve.u.n.value = samples;
    r.setRenderTarget(this.out); r.setClearColor(0x000000, 0); r.clear();
    r.render(this.resolve.scene, this.cam);
    r.setClearColor(0x000000, 1);
  }

  // Composite the last rendered layer over the frame already on screen.
  overScreen() { const r = this.engine.renderer; r.setRenderTarget(null); r.render(this.over.scene, this.cam); }

  readPixels(buf) { this.engine.renderer.readRenderTargetPixels(this.out, 0, 0, W, H, buf); return buf; }
}
