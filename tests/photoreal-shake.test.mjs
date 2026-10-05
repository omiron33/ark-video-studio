import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { shakeHits, shakeReview } from '../photoreal/lib/shake.mjs';
import { makeKeys } from '../photoreal/lib/keys.mjs';

function song(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-shake-'));
  for (const [f, src] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), src); }
  return dir;
}

test('shake words and damped high-frequency sines are found in code, not in comments', () => {
  assert.equal(shakeHits('// the frame shakes here\n/* jolt\n tremor */\nconst a = 1;').length, 0);
  assert.deepEqual(shakeHits('const a = 1;\nconst shake = (t) => t;').map((h) => h.line), [2]);
  assert.equal(shakeHits('const p = Math.exp(-u * 18) * Math.sin(u * 90) * 0.01;').length, 1);
  assert.equal(shakeHits('const sway = Math.exp(-u) * Math.sin(u * 2);').length, 0, 'a slow damped sway is not a shake');
  assert.equal(shakeHits("const s = 'shake';").length, 1, 'strings count: they name options');
});

test('ark-shake-ok marks one object moving, on the line or the line above', () => {
  assert.equal(shakeHits('const shake = laugh(t); // ark-shake-ok: the head shakes with laughter').length, 0);
  assert.equal(shakeHits('// ark-shake-ok: the flame trembles\nconst tremor = flicker(t);').length, 0);
  assert.equal(shakeHits('// ark-shake-ok:\nconst tremor = flicker(t);').length, 1, 'needs a reason');
});

test('a scene that shakes fails unless film.json opts it in with a reason', () => {
  const dir = song({
    'scenes/a.js': "import { strike } from '/song/lib/type.js';\nconst shake = (t) => Math.sin(t * 80);\nexport default {};",
    'scenes/b.js': 'export default {};',
    'scenes/b.lyric.js': 'strike(ctx, w, t, 0, 0, 10, { shake: 0.5 });',
    'scenes/c.js': 'export default {};',
    'lib/type.js': 'export function strike(ctx, w, t, x, y, px, o) { const sh = Math.sin(t) * (o.shake ?? 1); }',
  });
  const scenes = [{ id: 's1', scene: 'a', from: 0, to: 2 }, { id: 's2', scene: 'b', from: 2, to: 4 }, { id: 's3', scene: 'c', from: 4, to: 6 }];
  let p = shakeReview(dir, scenes);
  assert.deepEqual(p.filter((x) => x.severity === 'fail').map((x) => x.scene.id), ['s1', 's2']);
  assert.match(p.find((x) => x.scene?.id === 's2').detail, /scenes\/b\.lyric\.js:1/);
  assert.equal(p.filter((x) => x.severity === 'warn' && /lib\/type\.js/.test(x.detail)).length, 1, 'the shared helper warns once');
  scenes[0].shake = 'the stone strikes Goliath'; scenes[1].shake = '';
  p = shakeReview(dir, scenes);
  assert.deepEqual(p.filter((x) => x.severity === 'fail').map((x) => x.scene.id), ['s2', 's2'], 'an empty reason does not opt in');
  scenes[1].shake = 'lightning hits the mast'; scenes[2].shake = 'the walls fall';
  p = shakeReview(dir, scenes);
  assert.equal(p.filter((x) => x.severity === 'fail').length, 0);
  assert.match(p.find((x) => x.severity === 'warn' && /scenes shake/.test(x.detail)).detail, /3 scenes shake/);
  assert.equal(shakeReview(dir, scenes, { maxShakeScenes: 3 }).filter((x) => /scenes shake/.test(x.detail)).length, 0);
});

test('opting a scene into shake never changes its cache keys', () => {
  const dir = song({ 'scenes/a.js': 'const shake = 1; export default {};', 'scenes/a.lyric.js': 'export default () => ({});' });
  const keys = makeKeys(dir), s = { id: 's1', scene: 'a', from: 0, to: 2 };
  const before = [keys.content(s, 60), keys.plate(s, 60, 16), keys.layer(s, 60, 16)];
  assert.deepEqual([keys.content({ ...s, shake: 'why' }, 60), keys.plate({ ...s, shake: 'why' }, 60, 16), keys.layer({ ...s, shake: 'why' }, 60, 16)], before);
});
