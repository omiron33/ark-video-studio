// The premium frame engine. It keeps everything the photoreal engine does (sub-frame motion blur,
// bloom, ACES, grade, grain) and adds:
//   - Three.js scenes: modelled hero objects, physically based materials, studio reflections
//     (a scene module with `export const kind = 'three'`, see README "Premium scenes")
//   - a real lens: every sub-frame also samples a point on the aperture and aims at the focus
//     plane, so depth of field, bokeh and rack focus come out of the same averaging as motion blur
//   - a finishing pass (finish.js): anamorphic flare, light leaks, split-tone grade
// A raymarched scene can use the finishing pass too, with `export const kind = 'shader'`.
// Everything is still a pure function of song time.
import * as THREE from 'three';
import { Engine, W, H } from '../engine.js';
import { Finish } from './finish.js';

function r2(i) { const g = 1.32471795724474602596; return [((0.5 + i / g) % 1) - 0.5, ((0.5 + i / (g * g)) % 1) - 0.5]; }
// a low-discrepancy point on the unit disc (aperture samples)
function disc(i) {
  const a = ((0.5 + i * 0.7548776662466927) % 1), b = ((0.5 + i * 0.5698402909980532) % 1);
  const r = Math.sqrt(a), th = 2 * Math.PI * b;
  return [r * Math.cos(th), r * Math.sin(th)];
}

export class PremiumEngine extends Engine {
  constructor(canvas) {
    super(canvas);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // our own final pass converts
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.gradedRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: false });
    this.finish = new Finish();
  }

  async loadPremium(kind, clip, lyrics) {
    this.kind = kind;
    if (kind === 'three') {
      this.clip = clip; this.lyrics = lyrics;
      // a target with a depth buffer for the 3D scene
      this.sceneRT3 = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: true, samples: 0 });
      this.camera3 = new THREE.PerspectiveCamera(40, W / H, 0.01, 2000);
      const built = await clip.build({ THREE, renderer: this.renderer, camera: this.camera3, W, H });
      this.scene3 = built.scene;
      if (built.camera) this.camera3 = built.camera;
      // the text canvas the base class expects (unused unless the clip draws baked text)
      this.textCanvas = document.createElement('canvas'); this.textCanvas.width = 16; this.textCanvas.height = 16;
      this.textTex = new THREE.CanvasTexture(this.textCanvas);
      this.shadeCanvas = document.createElement('canvas'); this.shadeCanvas.width = 4; this.shadeCanvas.height = 4;
      this.shadeTex = new THREE.CanvasTexture(this.shadeCanvas);
    } else {
      this.load(clip, lyrics);
    }
  }

  // async work a frame needs before it renders (in-world HTML text has to be painted)
  async prepare(t) { await this.clip.prepare?.(t); }

  setCamera3(t, k, samples) {
    const c = this.clip.camera(t);
    const cam = this.camera3;
    cam.fov = c.fov ?? 40; cam.near = c.near ?? 0.01; cam.far = c.far ?? 2000; cam.aspect = W / H;
    const pos = new THREE.Vector3(...c.pos), target = new THREE.Vector3(...c.target);
    const fwd = target.clone().sub(pos).normalize();
    const up0 = new THREE.Vector3(Math.sin(c.roll ?? 0), Math.cos(c.roll ?? 0), 0);
    const right = fwd.clone().cross(up0).normalize(), up = right.clone().cross(fwd).normalize();
    // thin lens: move the eye across the aperture and keep looking at the same point on the focus plane
    const aperture = c.aperture ?? 0, focus = c.focus ?? pos.distanceTo(target);
    let eye = pos;
    if (aperture > 0 && samples > 1) {
      const [dx, dy] = disc(k);
      eye = pos.clone().addScaledVector(right, dx * aperture).addScaledVector(up, dy * aperture);
    }
    const focal = pos.clone().addScaledVector(fwd, focus);
    cam.position.copy(eye); cam.up.copy(up); cam.lookAt(focal);
    cam.updateProjectionMatrix();
  }

  renderSample(st, k, samples, fi) {
    const r = this.renderer;
    const [jx, jy] = r2(k + fi * 7);
    if (this.kind === 'three') {
      this.setCamera3(st, k, samples);
      this.camera3.setViewOffset(W, H, jx, jy, W, H);   // sub-pixel jitter: anti-aliasing
      this.clip.update?.(st, { scene: this.scene3, camera: this.camera3, THREE });
      r.setRenderTarget(this.sceneRT3); r.setClearColor(0x000000, 1); r.clear(true, true, false);
      r.render(this.scene3, this.camera3);
      this.camera3.clearViewOffset();
      return this.sceneRT3.texture;
    }
    this.scenePass.u.uJitter.value.set(jx, jy);
    this.setUniforms(st);
    r.setRenderTarget(this.sceneRT); r.render(this.scenePass.scene, this.cam);
    return this.sceneRT.texture;
  }

  // Same steps as Engine.frame, with the 3D path, the lens and the finishing pass.
  frame(t, { fps = 60, samples = 16, shutter = 0.5 } = {}) {
    const r = this.renderer;
    const fi = Math.round(t * fps);
    if (this.kind !== 'three') { this.scenePass.u.uFrame.value = fi; this.drawText(t); }
    r.setRenderTarget(this.accumRT); r.setClearColor(0x000000, 1); r.clear();
    for (let k = 0; k < samples; k++) {
      const st = t + ((k + 0.5) / samples - 0.5) * shutter / fps;
      const tex = this.renderSample(st, k, samples, fi);
      this.accPass.u.src.value = tex; this.accPass.u.w.value = 1 / samples;
      r.setRenderTarget(this.accumRT); r.render(this.accPass.scene, this.cam);
    }
    const post = { exposure: 1, bloom: 0.08, threshold: 1.0, knee: 0.6, grain: 0.03, vignette: 0.45, ca: 0.35, contrast: 1, saturation: 1, lift: [0, 0, 0], gain: [1, 1, 1], ...(this.clip.post?.(t) ?? {}) };
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
    r.setRenderTarget(this.gradedRT); r.render(this.final.scene, this.cam);
    // finishing kit over the graded picture, using the bloom pyramid for the flare
    this.finish.render(r, this.cam, { src: this.gradedRT.texture, bloom: b[3].up.texture, t, opts: this.clip.finish?.(t) ?? {} });
  }
}
