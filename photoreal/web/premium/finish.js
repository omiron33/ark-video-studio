// The finishing kit: what makes a frame read as shot through a real lens, applied after the grade.
// A scene's finish(t) returns any of:
//   flare:  { amount 0..1, threshold, tint [r,g,b], length }   anamorphic streaks from bright points
//   leak:   { amount 0..1, warm [r,g,b], cool [r,g,b], speed } soft light leaking in from the frame edge
//   grade:  { shadows [r,g,b], highlights [r,g,b], amount 0..1, balance -1..1 }   split toning
//   fade:   0..1                                               to black (openings and endings)
// Unset means off, so a scene opts into each piece. Presets: import { FINISH } from './finish.js'.
import * as THREE from 'three';

export const FINISH = {
  // a product shot: blue anamorphic streaks, cool shadows, warm highlights
  studio: { flare: { amount: 0.35, threshold: 0.75, tint: [0.55, 0.75, 1.0], length: 0.45 }, grade: { shadows: [0.02, 0.04, 0.07], highlights: [1.0, 0.93, 0.82], amount: 0.5 } },
  // warm film: leaks and a gentle amber grade
  film: { leak: { amount: 0.25, warm: [1.0, 0.55, 0.25], cool: [0.9, 0.3, 0.35], speed: 0.08 }, grade: { shadows: [0.05, 0.03, 0.02], highlights: [1.0, 0.9, 0.75], amount: 0.4 } },
  // night: cool, contrasty, a little flare on practical lights
  night: { flare: { amount: 0.25, threshold: 0.8, tint: [0.6, 0.7, 1.0], length: 0.35 }, grade: { shadows: [0.0, 0.03, 0.08], highlights: [0.9, 0.95, 1.0], amount: 0.6 } },
};

const VERT = /* glsl */ `in vec3 position; out vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = /* glsl */ `precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D src, bloom; uniform float t;
uniform float flareAmt, flareThr, flareLen; uniform vec3 flareTint;
uniform float leakAmt, leakSpeed; uniform vec3 leakWarm, leakCool;
uniform float gradeAmt, gradeBal; uniform vec3 gradeShadow, gradeHigh;
uniform float fade;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec3 c = texture(src, vUv).rgb;
  // anamorphic flare: a long horizontal streak of the brightest parts of the bloom
  if (flareAmt > 0.0) {
    vec3 s = vec3(0); float wsum = 0.0;
    for (int i = -64; i <= 64; i++) {
      float x = float(i) / 64.0; float w = exp(-x * x * 3.0);
      vec3 b = texture(bloom, vUv + vec2(x * flareLen, 0.0)).rgb;
      s += max(b - flareThr, 0.0) * w; wsum += w;
    }
    c += s / wsum * flareTint * flareAmt * 6.0;
  }
  // light leak: slow soft warm/cool light from the edges (screen blend)
  if (leakAmt > 0.0) {
    vec2 p = vUv * vec2(1.6, 0.9);
    float a = n2(p * 1.3 + vec2(t * leakSpeed, -t * leakSpeed * 0.6));
    float b = n2(p * 0.8 - vec2(t * leakSpeed * 0.7, 0.0) + 7.0);
    float edge = smoothstep(0.35, 1.0, length((vUv - 0.5) * vec2(1.7, 1.2)));
    vec3 leak = (leakWarm * smoothstep(0.45, 0.9, a) + leakCool * smoothstep(0.55, 0.95, b)) * edge * leakAmt;
    c = 1.0 - (1.0 - c) * (1.0 - clamp(leak, 0.0, 1.0));
  }
  // split-tone grade in display space
  if (gradeAmt > 0.0) {
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float hw = smoothstep(0.25 + 0.2 * gradeBal, 0.85, l), sw = 1.0 - smoothstep(0.0, 0.5 + 0.2 * gradeBal, l);
    vec3 toned = c + gradeShadow * sw - (1.0 - gradeHigh) * hw * l;
    c = mix(c, toned, gradeAmt);
  }
  c *= 1.0 - fade;
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export class Finish {
  constructor() {
    const u = (v) => ({ value: v }), V = (a) => new THREE.Vector3(...a);
    this.u = {
      src: u(null), bloom: u(null), t: u(0),
      flareAmt: u(0), flareThr: u(0.8), flareLen: u(0.4), flareTint: u(V([0.6, 0.75, 1])),
      leakAmt: u(0), leakSpeed: u(0.08), leakWarm: u(V([1, 0.55, 0.25])), leakCool: u(V([0.9, 0.3, 0.35])),
      gradeAmt: u(0), gradeBal: u(0), gradeShadow: u(V([0, 0, 0])), gradeHigh: u(V([1, 1, 1])),
      fade: u(0),
    };
    const mat = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG, uniforms: this.u, depthTest: false, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); mesh.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(mesh);
  }

  render(renderer, cam, { src, bloom, t, opts }) {
    const u = this.u, f = opts.flare, l = opts.leak, g = opts.grade;
    u.src.value = src; u.bloom.value = bloom; u.t.value = t;
    u.flareAmt.value = f?.amount ?? 0; u.flareThr.value = f?.threshold ?? 0.8; u.flareLen.value = f?.length ?? 0.4; u.flareTint.value.set(...(f?.tint ?? [0.6, 0.75, 1]));
    u.leakAmt.value = l?.amount ?? 0; u.leakSpeed.value = l?.speed ?? 0.08; u.leakWarm.value.set(...(l?.warm ?? [1, 0.55, 0.25])); u.leakCool.value.set(...(l?.cool ?? [0.9, 0.3, 0.35]));
    u.gradeAmt.value = g?.amount ?? 0; u.gradeBal.value = g?.balance ?? 0; u.gradeShadow.value.set(...(g?.shadows ?? [0, 0, 0])); u.gradeHigh.value.set(...(g?.highlights ?? [1, 1, 1]));
    u.fade.value = opts.fade ?? 0;
    renderer.setRenderTarget(null); renderer.render(this.scene, cam);
  }
}
