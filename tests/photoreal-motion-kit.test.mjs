import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeKeys, kitDepsOf, filesUnder } from '../photoreal/lib/keys.mjs';
import { rig, spring, anticipate, follow, stagger, weight, handheld, curve } from '../photoreal/web/kit/motion.js';
import { liveResidual, cameraOnlyStretches, restToRest } from '../photoreal/lib/live.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(HERE, '..', 'photoreal', 'web');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ark-kit-'));

// a song with one scene that uses the kit and one that doesn't
function song() {
  const d = tmp();
  fs.mkdirSync(path.join(d, 'scenes'), { recursive: true });
  fs.mkdirSync(path.join(d, 'data'), { recursive: true });
  fs.writeFileSync(path.join(d, 'data', 'lyrics.json'), JSON.stringify({ lines: [], words: [] }));
  fs.writeFileSync(path.join(d, 'scenes', 'plain.js'), "import { keys } from '/engine.js';\nexport default (P) => ({ name: 'plain', from: P.from, to: P.to });\n");
  fs.writeFileSync(path.join(d, 'scenes', 'kit.js'), "import { rig } from '/kit/motion.js';\nexport default (P) => ({ name: 'kit', from: P.from, to: P.to });\n");
  fs.writeFileSync(path.join(d, 'scenes', 'life.js'), "import { LIFE_GLSL } from '/kit/life.js';\nexport default (P) => ({ name: 'life', from: P.from, to: P.to });\n");
  return d;
}
// a copy of the engine's web/ folder, optionally without its kit
function webCopy({ kit = true } = {}) {
  const d = tmp();
  for (const f of filesUnder(WEB)) {
    const rel = path.relative(WEB, f);
    if (!kit && rel.startsWith('kit' + path.sep)) continue;
    fs.mkdirSync(path.join(d, path.dirname(rel)), { recursive: true });
    fs.copyFileSync(f, path.join(d, rel));
  }
  return d;
}
const S = (scene) => ({ id: '01', scene, from: 0, to: 2 });

test('the kit never changes the keys of scenes that do not import it', () => {
  const s = song();
  const without = makeKeys(s, { web: webCopy({ kit: false }) }), withKit = makeKeys(s, { web: webCopy() });
  assert.equal(withKit.plate(S('plain'), 60, 16), without.plate(S('plain'), 60, 16));
  assert.equal(withKit.content(S('plain'), 60), without.content(S('plain'), 60));
});

test('a change to a kit file re-keys only the scenes that import it, through kit-to-kit imports', () => {
  const s = song(), w = webCopy();
  const k0 = makeKeys(s, { web: w });
  const before = ['plain', 'kit', 'life'].map((n) => k0.plate(S(n), 60, 16));
  fs.appendFileSync(path.join(w, 'kit', 'motion.js'), '\n// changed\n');
  const k1 = makeKeys(s, { web: w });
  const after = ['plain', 'kit', 'life'].map((n) => k1.plate(S(n), 60, 16));
  assert.equal(after[0], before[0], 'plain scene untouched');
  assert.notEqual(after[1], before[1], 'scene importing motion.js re-keyed');
  assert.notEqual(after[2], before[2], 'life.js imports motion.js, so its scene re-keys too');
  assert.deepEqual(kitDepsOf(w, [path.join(s, 'scenes', 'life.js')]).map((f) => path.basename(f)), ['life.js', 'motion.js']);
});

test('rig: a moving entry and exit keep the travelling speed; rest entries and exits stop', () => {
  const path3 = [[0, 1, 0], [3, 1, 2], [6, 1.5, 2.5]];
  const avg = curve(path3).length / 6;
  const moving = rig({ from: 0, to: 6, path: path3, look: [0, 0, 20], handheld: 0 });
  assert.ok(Math.abs(moving.speed(0.05) / avg - 1) < 0.1, 'enters at the average speed');
  assert.ok(Math.abs(moving.speed(5.95) / avg - 1) < 0.1, 'leaves at the average speed');
  const still = rig({ from: 0, to: 6, path: path3, look: [0, 0, 20], enter: 'rest', exit: 'rest', handheld: 0, settle: 0 });
  assert.ok(still.speed(0.01) / avg < 0.05 && still.speed(5.99) / avg < 0.05);
  // passes through every point, on a curve rather than straight lines
  const mid = moving.timing(3);
  assert.ok(mid > 0.3 && mid < 0.7);
  assert.deepEqual(moving(6).pos.map((v) => +v.toFixed(6)), path3[2]);
  assert.deepEqual(moving(0).pos.map((v) => +v.toFixed(6)), path3[0]);
});

test('rig: a rest exit with a settle carries a little past the mark and comes back, without wobbling', () => {
  const cam = rig({ from: 0, to: 4, path: [[0, 0, 0], [10, 0, 0]], look: [10, 0, 100], exit: 'rest', handheld: 0 });
  const xs = Array.from({ length: 401 }, (_, i) => cam(i / 100).pos[0]);
  const peak = Math.max(...xs);
  assert.ok(peak > 10 && peak < 10.1, `overshoot ${peak}`);
  assert.ok(Math.abs(xs.at(-1) - 10) < 0.01);
  // one return only: the motion changes direction once
  let turns = 0; for (let i = 2; i < xs.length; i++) if ((xs[i] - xs[i - 1]) * (xs[i - 1] - xs[i - 2]) < -1e-12) turns++;
  assert.equal(turns, 1);
});

test('rig and hand-held are pure functions of t', () => {
  const o = { from: 0, to: 3, path: [[0, 0, 0], [1, 0, 1], [2, 0, 1]], look: { ahead: 3 }, handheld: 1 };
  assert.deepEqual(rig(o)(1.2345), rig(o)(1.2345));
  assert.deepEqual(handheld(7.7, { seed: 3 }), handheld(7.7, { seed: 3 }));
  // hand-held stays small (centimetres) and never repeats exactly
  const xs = Array.from({ length: 2000 }, (_, i) => handheld(i / 60).pos[0]);
  assert.ok(Math.max(...xs.map(Math.abs)) < 0.03);
  assert.notEqual(handheld(1).pos[0], handheld(1 + 2 * Math.PI / 0.55).pos[0]);
});

test('spring, anticipation, follow-through, stagger and weight behave as named', () => {
  assert.equal(spring(-1, 0), 0);
  assert.ok(Math.max(...Array.from({ length: 100 }, (_, i) => spring(i / 100, 0))) > 1, 'overshoots');
  assert.ok(Math.abs(spring(3, 0) - 1) < 1e-3, 'settles');
  assert.ok(anticipate(-0.01, 0) < -0.1, 'winds up the other way first');
  assert.equal(anticipate(-1, 0), 0);
  assert.ok(Math.abs(anticipate(1, 0) - 1) < 1e-9);
  const step = (t) => (t > 0 ? 1 : 0);
  assert.ok(follow(step, 0.05, 0.2) < 0.5 && follow(step, 1.5, 0.2) > 0.99, 'trails, then catches up');
  const st = [0, 1, 2, 3, 4].map((i) => stagger(i, 5, 0.4));
  assert.ok(st.every((v, i) => i === 0 || v > st[i - 1]), 'in order');
  assert.ok(weight.heavy(0.25) < weight.normal(0.25) && weight.light(0.25) > weight.normal(0.25));
});

// a textured grey frame drawn as a function of (x, y), sampled on a 192x108 grid
function frame(f) { const W = 192, H = 108, b = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) b[y * W + x] = Math.max(0, Math.min(255, f(x, y))); return b; }
const tex = (x, y) => 128 + 50 * Math.sin(x * 0.21 + Math.sin(y * 0.13) * 2) + 40 * Math.cos(y * 0.17 + x * 0.05) + 20 * Math.sin((x + y) * 0.37);

test('live: a pushed or panned still scores low; something moving on its own scores high', () => {
  const W = 192, H = 108;
  const a = frame(tex);
  const panned = frame((x, y) => tex(x + 1.3, y + 0.4));
  const zoomed = frame((x, y) => tex(96 + (x - 96) / 1.01, 54 + (y - 54) / 1.01) * 1.03);   // push and a breath of light
  const lively = frame((x, y) => tex(x + 1.3, y + 0.4) + (Math.hypot(x - 40, y - 30) < 9 ? 70 * Math.sin(x * 0.9 + y * 0.7) : 0));
  const sPan = liveResidual(a, panned, W, H).score, sZoom = liveResidual(a, zoomed, W, H).score, sLive = liveResidual(a, lively, W, H).score;
  assert.ok(sPan < 11 && sZoom < 11, `pushes ${sPan.toFixed(1)} ${sZoom.toFixed(1)}`);
  assert.ok(sLive > 11, `lively ${sLive.toFixed(1)}`);
});

test('live: camera-only stretches use a running median and step over unmeasured frames', () => {
  const fps = 60;
  const scores = Array.from({ length: 300 }, (_, i) => (i % 2 ? NaN : i < 150 ? 4 : 30));
  scores[40] = 50;   // one busy frame doesn't break a dead stretch
  const st = cameraOnlyStretches(scores, fps);
  assert.equal(st.length, 1);
  assert.ok(st[0].from < 0.1 && st[0].to > 2.3 && st[0].to < 2.7, JSON.stringify(st[0]));
  assert.equal(cameraOnlyStretches(scores.map((s) => (Number.isFinite(s) ? 30 : s)), fps).length, 0);
});

test('rest-to-rest flags glides from a standstill to a standstill, unless the scene says why', () => {
  const bell = Array.from({ length: 61 }, (_, i) => Math.sin((Math.PI * i) / 60) * 0.05);
  const flowing = Array.from({ length: 61 }, () => 0.05);
  const scenes = [{ id: '01', scene: 'a', from: 0 }, { id: '02', scene: 'b', from: 4 }, { id: '03', scene: 'c', from: 8, rest: 'a held icon' }];
  const r = restToRest([{ id: '01', speed: bell }, { id: '02', speed: flowing }, { id: '03', speed: bell }], scenes);
  assert.deepEqual(r.map((x) => x.id), ['01']);
});
