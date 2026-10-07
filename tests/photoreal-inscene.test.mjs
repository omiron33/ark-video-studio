import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inSceneReview } from '../photoreal/lib/inscene.mjs';
import { resolveTier } from '../photoreal/lib/tier.mjs';
import { validateStoryboard, draftStoryboard } from '../photoreal/lib/storyboard.mjs';
import { makeKeys } from '../photoreal/lib/keys.mjs';

function song(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-inscene-'));
  for (const [f, src] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), src); }
  return dir;
}

test('premium (ultra realistic) is the default tier; a film already rendered at standard keeps it', () => {
  assert.equal(resolveTier(song({}), {}).tier, 'premium');
  assert.equal(resolveTier(song({ 'out/segments/01.mp4': '' }), {}).tier, 'standard');
  assert.equal(resolveTier(song({ 'out/segments-draft/01.mp4': '' }), {}).tier, 'premium', 'a draft is not a standard render');
  assert.equal(resolveTier(song({ 'out/segments/01.mp4': '' }), { tier: 'premium' }).tier, 'premium');
  assert.equal(resolveTier(song({}), { tier: 'standard' }, 'fast').tier, 'fast');
  assert.throws(() => resolveTier(song({}), { tier: 'huge' }));
});

test('a lyric layer over the picture fails at premium unless the scene opts into overlay with a reason', () => {
  const dir = song({ 'scenes/a.js': '', 'scenes/a.lyric.js': '', 'scenes/b.js': '', 'scenes/b.lyric.js': '', 'scenes/c.js': '' });
  const scenes = [
    { id: '01', scene: 'a', from: 0, to: 2 },
    { id: '02', scene: 'b', from: 2, to: 4, overlay: 'the title over black before the first image' },
    { id: '03', scene: 'c', from: 4, to: 6 },
  ];
  const p = inSceneReview(dir, scenes, 'premium');
  assert.deepEqual(p.map((x) => [x.scene.id, x.severity]), [['01', 'fail']]);
  assert.deepEqual(inSceneReview(dir, scenes, 'standard').map((x) => x.severity), ['warn'], 'older films only warn');
  assert.equal(inSceneReview(dir, [{ id: '04', scene: 'c', from: 0, to: 1, overlay: ' ' }], 'standard')[0].severity, 'fail', 'an opt-in needs a reason');
});

test('opting a scene into overlay never changes its cache keys', () => {
  const dir = song({ 'scenes/a.js': 'export default {};', 'scenes/a.lyric.js': 'export default () => ({});', 'data/lyrics.json': '{"lines":[],"words":[]}' });
  const k = makeKeys(dir), s = { id: '01', scene: 'a', from: 0, to: 2 };
  assert.equal(k.plate({ ...s, overlay: 'why' }, 60, 16), k.plate(s, 60, 16));
  assert.equal(k.layer({ ...s, overlay: 'why' }, 60, 16), k.layer(s, 60, 16));
});

test('the storyboard asks where the words live in each scene, and older five-column boards still pass', () => {
  const lyrics = { lines: [{ text: 'every herd and creeping', start: 1, end: 3 }] };
  const d = draftStoryboard({ title: 't', duration: 6, lyrics, scenes: [{ from: 0, to: 6 }] });
  assert.match(d, /Where the words live in the scene/);
  const filled = d.replace(/TODO/g, 'done');
  assert.equal(validateStoryboard(filled, { duration: 6, lyrics }).ok, true);
  const blank = filled.replace(/\| done \|\n/, '| |\n');
  assert.equal(validateStoryboard(blank, { duration: 6, lyrics }).ok, false, 'an empty words cell fails');
  const old = '| Time | On screen | What the moment is for | How it leaves | What carries into the next shot |\n|---|---|---|---|---|\n| 0:00.0–0:06.0 | ark | flood | rain | water |\n';
  assert.equal(validateStoryboard(old, { duration: 6, lyrics }).ok, true);
});
