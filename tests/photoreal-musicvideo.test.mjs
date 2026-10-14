import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { frameLuminance, transitions, countFlashes, FLASH } from '../photoreal/lib/flash.mjs';
import { auc, kendallTau, threshold, calibrate } from '../photoreal/lib/calibrate.mjs';
import { parseCritique, applyCalibration, buildPrompt } from '../photoreal/lib/critic.mjs';
import { validate, units, framesOf, codeSegment } from '../photoreal/musicvideo.mjs';
import { workflow } from '../photoreal/lib/h3.mjs';
import { track } from '../photoreal/web/kit/music.js';
import { makeKeys } from '../photoreal/lib/keys.mjs';

// ---------- flash ----------
const flat = (v) => new Float32Array(FLASH.width * FLASH.height).fill(v);
test('a strobe faster than 3 a second fails; 3 a second passes; one pair counts once', () => {
  // 24 fps: dark/white alternating every 2 frames = 6 flashes a second
  const fast = Array.from({ length: 48 }, (_, i) => flat(Math.floor(i / 2) % 2 ? 0.9 : 0.02));
  const r = countFlashes(transitions(fast));
  assert.equal(r.pass, false);
  assert.ok(r.worstPerSecond >= 5, `worst ${r.worstPerSecond}`);
  // every 4 frames = 3 a second, at the limit
  const ok = Array.from({ length: 48 }, (_, i) => flat(Math.floor(i / 4) % 2 ? 0.9 : 0.02));
  assert.equal(countFlashes(transitions(ok)).pass, true);
  // dark -> white -> dark is one flash
  const one = [flat(0.02), flat(0.9), flat(0.9), flat(0.02)];
  assert.equal(countFlashes(transitions(one)).flashes, 1);
});

test('small or bright-only changes are not flashes', () => {
  const small = Array.from({ length: 48 }, (_, i) => { const f = flat(0.02); if (i % 2) f.fill(0.9, 0, Math.floor(f.length * 0.2)); return f; });
  assert.equal(countFlashes(transitions(small)).flashes, 0, 'under a quarter of the frame');
  const bright = Array.from({ length: 48 }, (_, i) => flat(i % 2 ? 0.95 : 0.82));
  assert.equal(countFlashes(transitions(bright)).flashes, 0, 'both states brighter than 0.8');
  assert.ok(Math.abs(frameLuminance(Uint8Array.from([255, 255, 255]))[0] - 1) < 1e-6);
});

// ---------- critic calibration ----------
test('calibration statistics: AUC, Kendall tau and the bar', () => {
  assert.equal(auc([8, 9], [3, 4]), 1);
  assert.equal(auc([5], [5]), 0.5);
  assert.equal(kendallTau([1, 2, 3], [10, 20, 30]), 1);
  assert.equal(kendallTau([1, 2, 3], [30, 20, 10]), -1);
  assert.equal(threshold([7, 8, 9], [3, 4]), 7);
  assert.equal(threshold([7.0, 7.5, 8, 8.5, 9, 9, 9, 9, 9, 9], []), 7.45, '10th percentile of accepted films');
});

test('a critic that disagrees with Shane gets no bar; one that agrees does', () => {
  const good = calibrate([{ film: 'a', verdict: 'accept', score: 8, blocking: 0 }, { film: 'b', verdict: 'accept', score: 7, blocking: 0 }, { film: 'k', verdict: 'reject', score: 3, blocking: 2 }], { rubricSha: 'x' });
  assert.equal(good.ok, true); assert.equal(good.threshold, 7); assert.equal(good.agreement, '3 of 3 films');
  const bad = calibrate([{ film: 'a', verdict: 'accept', score: 3, blocking: 0 }, { film: 'k', verdict: 'reject', score: 8, blocking: 0 }], { rubricSha: 'x' });
  assert.equal(bad.threshold, null); assert.match(bad.problems[0], /AUC/);
});

test('a blocking problem never ships; calibration sets the bar for the rest', () => {
  const c = parseCritique(JSON.stringify({ verdict: 'ship', score: 8, problems: [{ rank: 1, problem: 'the word "dove" is unreadable', fix: 'x', blocking: true }] }));
  assert.equal(c.verdict, 'one more pass'); assert.equal(c.said, 'ship'); assert.equal(c.blocking, 1);
  const polish = parseCritique(JSON.stringify({ verdict: 'one more pass', score: 7.5, problems: [{ rank: 1, problem: 'a richer light', fix: 'x', blocking: false }] }));
  const cal = { rubricSha: 'r', threshold: 7, films: 6, agreement: '6 of 6 films' };
  assert.equal(applyCalibration(polish, cal, 'r').verdict, 'ship', 'polish only, over the bar');
  assert.equal(applyCalibration({ ...polish, score: 6 }, cal, 'r').verdict, 'one more pass');
  assert.equal(applyCalibration(polish, cal, 'changed').verdict, 'one more pass', 'a stale calibration leaves the critic\'s own verdict');
  assert.match(applyCalibration(polish, cal, 'changed').calibration, /stale/);
  assert.match(buildPrompt('film'), /"blocking": true or false/);
  assert.match(buildPrompt('film'), /"score": 0 to 10/);
});

// ---------- the music video ----------
function song(film, files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-mv-'));
  fs.writeFileSync(path.join(dir, 'film.json'), JSON.stringify(film));
  for (const [f, src] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), src); }
  return dir;
}
const mv = (scenes, extra = {}) => ({ mode: 'musicvideo', fps: 24, scenes, ...extra });

test('a music video mixes generated and code shots, tiled, at 24 fps', () => {
  const f = mv([
    { id: '01', source: 'h3', from: 0, to: 6, photorealistic: { prompt: 'a shepherd on a ridge at dawn', proxy: 'greybox/01.mp4' } },
    { id: '02', scene: 'ridge', from: 6, to: 12 },
    { id: '03', source: 'h3', scene: 'ridge', from: 12, to: 20, photorealistic: { prompt: 'the same ridge, filmed' } },
  ]);
  const dir = song(f, { 'scenes/ridge.js': 'export default {};', 'greybox/01.mp4': '' });
  assert.deepEqual(validate(f, dir), []);
  assert.deepEqual(units(f).map((u) => u.id), ['01', '03']);
  assert.equal(framesOf(f.scenes[0]), 144);
  assert.match(codeSegment('/s/out', f.scenes[1], 'ultra'), /segments-ultra\/02\.mp4$/);
  const errs = validate({ ...f, fps: 60, scenes: [{ id: 'a', source: 'h3', from: 0, to: 5 }, { id: 'b', from: 5.5, to: 8 }] }, dir);
  assert.ok(errs.some((e) => /24 fps/.test(e)));
  assert.ok(errs.some((e) => /gap or overlap/.test(e)));
  assert.ok(errs.some((e) => /needs "photorealistic"/.test(e)));
  assert.ok(errs.some((e) => /code shot with no "scene"/.test(e)));
});

test('H3 with no proxy runs the free conditioning over every step', () => {
  const g = workflow({ proxy: null, look: 'look.png', guide: null, prompt: 'p', frames: 124, steps: 20, keep: 5, seed: 1, prefix: 'x' });
  assert.equal(g[20], undefined); assert.equal(g[6], undefined); assert.equal(g[11], undefined);
  assert.deepEqual(g[22].inputs.guider, ['17', 0]); assert.deepEqual(g[22].inputs.sigmas, ['9', 0]); assert.deepEqual(g[22].inputs.latent_image, ['16', 1]);
  const chained = workflow({ proxy: null, look: null, guide: 'g.mp4', prompt: 'p', frames: 124, steps: 20, keep: 5, seed: 1, prefix: 'x' });
  assert.deepEqual(chained[17].inputs.conditioning, ['43', 0]); assert.equal(chained[42], undefined);
  const steered = workflow({ proxy: 'p.mp4', look: null, guide: 'g.mp4', prompt: 'p', frames: 124, steps: 20, keep: 5, seed: 1, prefix: 'x' });
  assert.deepEqual(steered[7].inputs.conditioning, ['42', 0]); assert.deepEqual(steered[22].inputs.latent_image, ['11', 0]);
});

test('the music kit: swells, hits, beats and loudness-paced moves', () => {
  const M = track({ beats: [0, 0.5, 1, 1.5, 2], downbeats: [0, 2], hits: [{ t: 10, score: 1 }], risers: [{ t0: 8, t1: 9.8, land: 10 }], env24: { other: Array(24 * 20).fill(0).map((_, i) => (i > 24 * 5 ? 1 : 0)) } });
  assert.equal(M.swell(7), 0); assert.ok(M.swell(9.95) > 0.9); assert.equal(M.swell(10), 0);
  assert.equal(M.landed(10), 1); assert.ok(M.landed(10.3) < 0.4); assert.equal(M.landed(9.9), 0);
  assert.deepEqual(M.beat(0.75), { n: 1, phase: 0.5 });
  assert.equal(M.next(3, 'hits'), 10);
  // half the time is quiet, half loud: halfway through the time is well under halfway along
  assert.ok(M.progress(5, 0, 10) < 0.3, String(M.progress(5, 0, 10)));
  assert.equal(M.progress(0, 0, 10), 0); assert.equal(M.progress(10, 0, 10), 1);
});

test('data/music.json is keyed only by the scenes that import it', () => {
  const dir = song(mv([{ id: '01', scene: 'a', from: 0, to: 4 }, { id: '02', scene: 'b', from: 4, to: 8 }]), {
    'scenes/a.js': "import music from '/song/data/music.json' with { type: 'json' };\nexport default {};",
    'scenes/b.js': 'export default {};',
    'data/lyrics.json': '{"lines":[],"words":[]}', 'data/music.json': '{"beats":[1]}',
  });
  const k1 = makeKeys(dir), a1 = k1.content({ id: '01', scene: 'a', from: 0, to: 4 }, 24), b1 = k1.content({ id: '02', scene: 'b', from: 4, to: 8 }, 24);
  fs.writeFileSync(path.join(dir, 'data', 'music.json'), '{"beats":[2]}');
  const k2 = makeKeys(dir);
  assert.notEqual(k2.content({ id: '01', scene: 'a', from: 0, to: 4 }, 24), a1);
  assert.equal(k2.content({ id: '02', scene: 'b', from: 4, to: 8 }, 24), b1);
});
