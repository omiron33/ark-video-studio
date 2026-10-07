// Frame engine: renders a clip's raymarched shader as a pure function of song time,
// averages jittered sub-frames over the shutter (motion blur + anti-aliasing),
// then applies one shared film finish: bloom, ACES tonemap, grain, vignette.
import * as THREE from 'three';
import { COMMON } from './glsl.js';

export const [W, H] = (new URLSearchParams(location.search).get('res') ?? '1920x1080').split('x').map(Number);   // key-neutral: see lib/keys.mjs

const VERT = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function quad(frag, uniforms, opts = {}) {
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: frag, uniforms,
    depthTest: false, depthWrite: false, ...opts,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  return { mat, scene, u: uniforms };
}

function target(w, h, type = THREE.HalfFloatType) {
  return new THREE.WebGLRenderTarget(w, h, {
    type, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
  });
}

// R2 low-discrepancy sequence for sub-pixel jitter
function r2(i) { const g = 1.32471795724474602596; return [((0.5 + i / g) % 1) - 0.5, ((0.5 + i / (g * g)) % 1) - 0.5]; }

export class Engine {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(W, H, false);
    this.renderer.autoClear = false;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.sceneRT = target(W, H);
    this.accumRT = target(W, H, THREE.FloatType);
    this.bloomRTs = [];
    for (let i = 0, w = W / 2, h = H / 2; i < 7; i++, w = Math.max(1, w >> 1), h = Math.max(1, h >> 1)) this.bloomRTs.push({ down: target(w, h), up: target(w, h) });

    this.accPass = quad(/* glsl */ `precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D src; uniform float w;
      void main() { o = vec4(texture(src, vUv).rgb * w, 1.0); }`,
      { src: { value: null }, w: { value: 1 } },
      { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });

    this.prefilter = quad(/* glsl */ `precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D src; uniform vec2 texel; uniform float threshold, knee;
      void main() {
        vec3 c = vec3(0);
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) c += texture(src, vUv + vec2(i, j) * texel).rgb;
        c /= 9.0;
        float br = max(c.r, max(c.g, c.b));
        float rq = clamp(br - threshold + knee, 0.0, 2.0 * knee); rq = rq * rq / (4.0 * knee + 1e-4);
        o = vec4(c * max(rq, br - threshold) / max(br, 1e-4), 1.0);
      }`, { src: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 1 }, knee: { value: 0.5 } });

    this.down = quad(/* glsl */ `precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D src; uniform vec2 texel;
      void main() {
        vec3 a = texture(src, vUv + texel * vec2(-1, -1)).rgb, b = texture(src, vUv + texel * vec2(1, -1)).rgb;
        vec3 c = texture(src, vUv + texel * vec2(-1, 1)).rgb, d = texture(src, vUv + texel * vec2(1, 1)).rgb;
        vec3 e = texture(src, vUv).rgb;
        o = vec4(e * 0.5 + (a + b + c + d) * 0.125, 1.0);
      }`, { src: { value: null }, texel: { value: new THREE.Vector2() } });

    this.up = quad(/* glsl */ `precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D src, base; uniform vec2 texel; uniform float radius;
      void main() {
        vec2 d = texel * radius; vec3 s = vec3(0);
        s += texture(src, vUv + vec2(-d.x, -d.y)).rgb + texture(src, vUv + vec2(d.x, -d.y)).rgb + texture(src, vUv + vec2(-d.x, d.y)).rgb + texture(src, vUv + vec2(d.x, d.y)).rgb;
        s += 2.0 * (texture(src, vUv + vec2(0, -d.y)).rgb + texture(src, vUv + vec2(0, d.y)).rgb + texture(src, vUv + vec2(-d.x, 0)).rgb + texture(src, vUv + vec2(d.x, 0)).rgb);
        s += 4.0 * texture(src, vUv).rgb;
        o = vec4(texture(base, vUv).rgb + s / 16.0, 1.0);
      }`, { src: { value: null }, base: { value: null }, texel: { value: new THREE.Vector2() }, radius: { value: 1 } });

    this.final = quad(/* glsl */ `precision highp float; in vec2 vUv; out vec4 o;
      uniform sampler2D src, bloom; uniform float exposure, bloomAmt, grain, vignette, frame, ca, contrast, saturation;
      uniform vec3 lift, gain;
      float h(vec3 p) { p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
      vec3 aces(vec3 x) { // Stephen Hill fit
        const mat3 A = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
        const mat3 B = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
        x = A * x; vec3 a = x * (x + 0.0245786) - 0.000090537; vec3 b = x * (0.983729 * x + 0.4329510) + 0.238081; return clamp(B * (a / b), 0.0, 1.0);
      }
      vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      void main() {
        vec2 d = vUv - 0.5;
        vec3 c;
        if (ca > 0.0) { vec2 off = d * ca * 0.004; c = vec3(texture(src, vUv + off).r, texture(src, vUv).g, texture(src, vUv - off).b); }
        else c = texture(src, vUv).rgb;
        c += texture(bloom, vUv).rgb * bloomAmt;
        c *= exposure;
        c *= mix(1.0, smoothstep(1.25, 0.25, length(d * vec2(1.0, 0.82)) * 1.5), vignette);
        c = aces(c);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, saturation);
        c = clamp((c - 0.5) * contrast + 0.5, 0.0, 1.0);
        c = c * gain + lift * (1.0 - c);
        // grain in display space, strongest in the mid-tones, re-seeded once per frame
        vec2 px = gl_FragCoord.xy;
        float g = h(vec3(px, frame)) + h(vec3(px + 17.0, frame + 0.5)) - 1.0;
        c += g * grain * (0.35 + 0.65 * (1.0 - abs(l * 2.0 - 1.0)));
        c = toSRGB(clamp(c, 0.0, 1.0));
        c += (h(vec3(px, frame + 3.1)) - 0.5) / 255.0;
        o = vec4(c, 1.0);
      }`, {
      src: { value: null }, bloom: { value: null }, exposure: { value: 1 }, bloomAmt: { value: 0.1 }, grain: { value: 0.035 }, vignette: { value: 0.5 },
      frame: { value: 0 }, ca: { value: 0.4 }, contrast: { value: 1.0 }, saturation: { value: 1.0 }, lift: { value: new THREE.Vector3() }, gain: { value: new THREE.Vector3(1, 1, 1) },
    });
  }

  load(clip, lyrics) {
    this.clip = clip;
    this.lyrics = lyrics;
    const tc = document.createElement('canvas');
    tc.width = clip.textSize?.[0] ?? 4096; tc.height = clip.textSize?.[1] ?? 1024;
    this.textCanvas = tc;
    this.textTex = new THREE.CanvasTexture(tc);
    this.textTex.colorSpace = THREE.NoColorSpace;
    this.textTex.generateMipmaps = true;
    this.textTex.premultiplyAlpha = true;
    this.textTex.minFilter = THREE.LinearMipmapLinearFilter;
    this.textTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    // a soft blurred copy of the text, for the shade that keeps words readable
    const sc = document.createElement('canvas');
    sc.width = Math.round(tc.width / 4); sc.height = Math.round(tc.height / 4);
    this.shadeCanvas = sc;
    this.shadeTex = new THREE.CanvasTexture(sc);
    this.shadeTex.colorSpace = THREE.NoColorSpace;
    this.shadeTex.premultiplyAlpha = true;
    this.shadeTex.minFilter = THREE.LinearFilter; this.shadeTex.generateMipmaps = false;
    const u = {
      uRes: { value: new THREE.Vector2(W, H) }, uJitter: { value: new THREE.Vector2() }, uTime: { value: 0 }, uFrame: { value: 0 },
      uCamPos: { value: new THREE.Vector3() }, uCamTarget: { value: new THREE.Vector3() }, uCamRoll: { value: 0 }, uFov: { value: 40 },
      uText: { value: this.textTex }, uTextShade: { value: this.shadeTex },
      uTxC: { value: new THREE.Vector3() }, uTxX: { value: new THREE.Vector3(1, 0, 0) }, uTxY: { value: new THREE.Vector3(0, 1, 0) }, uTxHS: { value: new THREE.Vector2(1, 0.25) },
    };
    for (const [k, v] of Object.entries(clip.uniforms ?? {})) u[k] = { value: Array.isArray(v) && v.length === 3 ? new THREE.Vector3(...v) : v };   // 3-arrays are vectors; longer arrays stay float arrays
    this.scenePass = quad(COMMON + '\nin vec2 vUv;\nout vec4 fragOut;\n' + clip.frag + `
void main() { vec3 c = shade(gl_FragCoord.xy); fragOut = vec4(max(c, 0.0), 1.0); }`, u);
  }

  setUniforms(t) {
    const u = this.scenePass.u, c = this.clip;
    u.uTime.value = t;
    const cam = c.camera(t);
    u.uCamPos.value.set(...cam.pos); u.uCamTarget.value.set(...cam.target);
    u.uCamRoll.value = cam.roll ?? 0; u.uFov.value = cam.fov ?? 40;
    if (c.textPlane) {
      const tp = c.textPlane(t, cam);
      u.uTxC.value.set(...tp.c); u.uTxX.value.set(...tp.ax); u.uTxY.value.set(...tp.ay); u.uTxHS.value.set(...tp.hs);
    }
    c.update?.(t, u);
  }

  drawText(t) {
    const ctx = this.textCanvas.getContext('2d');
    ctx.clearRect(0, 0, this.textCanvas.width, this.textCanvas.height);
    this.clip.drawText?.(ctx, t, this.lyrics);
    this.textTex.needsUpdate = true;
    const sc = this.shadeCanvas, sx = sc.getContext('2d');
    sx.clearRect(0, 0, sc.width, sc.height);
    sx.filter = `blur(${Math.round(sc.height / 60)}px)`;
    sx.drawImage(this.textCanvas, 0, 0, sc.width, sc.height);
    sx.filter = 'none';
    this.shadeTex.needsUpdate = true;
  }

  // Render the frame at song time t: `samples` jittered sub-frames spread over `shutter` frames.
  frame(t, { fps = 60, samples = 16, shutter = 0.5 } = {}) {
    const r = this.renderer;
    const fi = Math.round(t * fps);
    this.scenePass.u.uFrame.value = fi;
    this.drawText(t);
    r.setRenderTarget(this.accumRT); r.setClearColor(0x000000, 1); r.clear();
    for (let k = 0; k < samples; k++) {
      const st = t + ((k + 0.5) / samples - 0.5) * shutter / fps;
      const [jx, jy] = r2(k + fi * 7);
      this.scenePass.u.uJitter.value.set(jx, jy);
      this.setUniforms(st);
      r.setRenderTarget(this.sceneRT); r.render(this.scenePass.scene, this.cam);
      this.accPass.u.src.value = this.sceneRT.texture; this.accPass.u.w.value = 1 / samples;
      r.setRenderTarget(this.accumRT); r.render(this.accPass.scene, this.cam);
    }
    const post = { exposure: 1, bloom: 0.08, threshold: 1.0, knee: 0.6, grain: 0.03, vignette: 0.45, ca: 0.35, contrast: 1, saturation: 1, lift: [0, 0, 0], gain: [1, 1, 1], ...(this.clip.post?.(t) ?? {}) };
    // bloom pyramid
    const b = this.bloomRTs;
    this.prefilter.u.src.value = this.accumRT.texture; this.prefilter.u.texel.value.set(1 / W, 1 / H);
    this.prefilter.u.threshold.value = post.threshold; this.prefilter.u.knee.value = post.knee;
    r.setRenderTarget(b[0].down); r.render(this.prefilter.scene, this.cam);
    for (let i = 1; i < b.length; i++) {
      this.down.u.src.value = b[i - 1].down.texture; this.down.u.texel.value.set(1 / b[i - 1].down.width, 1 / b[i - 1].down.height);
      r.setRenderTarget(b[i].down); r.render(this.down.scene, this.cam);
    }
    let src = b[b.length - 1].down;
    for (let i = b.length - 2; i >= 0; i--) {
      this.up.u.src.value = src.texture; this.up.u.base.value = b[i].down.texture; this.up.u.texel.value.set(1 / src.width, 1 / src.height); this.up.u.radius.value = 1.0;
      r.setRenderTarget(b[i].up); r.render(this.up.scene, this.cam); src = b[i].up;
    }
    const f = this.final.u;
    f.src.value = this.accumRT.texture; f.bloom.value = src.texture;
    f.exposure.value = post.exposure; f.bloomAmt.value = post.bloom; f.grain.value = post.grain; f.vignette.value = post.vignette; f.ca.value = post.ca;
    f.contrast.value = post.contrast; f.saturation.value = post.saturation; f.lift.value.set(...post.lift); f.gain.value.set(...post.gain);
    f.frame.value = fi % 997;
    r.setRenderTarget(null); r.render(this.final.scene, this.cam);
  }

  readPixels(buf) {
    const gl = this.renderer.getContext();
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return buf;
  }
}

// ---------- lyrics helpers ----------
export function smooth(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }
export function clamp01(x) { return Math.min(1, Math.max(0, x)); }
export const ease = {
  inOut3: (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
  out3: (x) => 1 - Math.pow(1 - clamp01(x), 3),
  out5: (x) => 1 - Math.pow(1 - clamp01(x), 5),
  in2: (x) => clamp01(x) ** 2,
  inOut5: (x) => { x = clamp01(x); return x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2; },
};
// piecewise keyframes: [[t, value], ...] with an easing per segment
export function keys(t, ks, e = ease.inOut3) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i][0]) {
      const [t0, v0] = ks[i - 1], [t1, v1, ef] = ks[i];
      const p = (ef ?? e)((t - t0) / (t1 - t0));
      return Array.isArray(v0) ? v0.map((a, j) => a + (v1[j] - a) * p) : v0 + (v1 - v0) * p;
    }
  }
  return ks[ks.length - 1][1];
}

// Words of the line whose text starts with `prefix` (order preserved), with the line's timing.
export function lineWords(lyrics, prefix) {
  const line = lyrics.lines.find((l) => l.text.startsWith(prefix));
  if (!line) throw Error('no line ' + prefix);
  const words = lyrics.words.filter((w) => w.start >= line.start - 0.05 && w.end <= line.end + 0.05);
  return { ...line, words };
}

// Word visibility: dim anticipation up to 0.35 s early, full by the word's end (never ahead of the voice).
export function wordState(w, t) {
  const antic = clamp01((t - (w.start - 0.35)) / 0.35) * 0.0;
  const dur = Math.max(0.08, Math.min(0.3, w.end - w.start));
  const on = ease.out3((t - w.start) / dur);
  return { a: Math.max(antic, on), on };
}

export function smartQuotes(s) { return s.replace(/'/g, '’').replace(/--/g, '—'); }

// A text plane that sits `dist` metres in front of a camera, occupying a screen-space box:
// x, y = box centre in NDC (-1..1), width = fraction of screen width, aspect = canvas w/h.
export function cameraPlane(cam, { x = 0, y = 0, width = 0.5, dist = 2, aspect = 4, W = 1920, H = 1080 }) {
  const sub = (a, b) => a.map((v, i) => v - b[i]), add = (a, b) => a.map((v, i) => v + b[i]), mul = (a, s) => a.map((v) => v * s);
  const norm = (a) => mul(a, 1 / Math.hypot(...a));
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const ww = norm(sub(cam.target, cam.pos));
  const roll = cam.roll ?? 0;
  const uu = norm(cross(ww, [Math.sin(roll), Math.cos(roll), 0])), vv = cross(uu, ww);
  const hh = dist * Math.tan(((cam.fov ?? 40) * Math.PI) / 360), hw = hh * (W / H);
  const c = add(add(add(cam.pos, mul(ww, dist)), mul(uu, x * hw)), mul(vv, y * hh));
  const hx = width * hw;
  return { c, ax: uu, ay: vv, hs: [hx, hx / aspect] };
}
