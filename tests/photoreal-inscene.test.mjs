import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inSceneReview } from '../photoreal/lib/inscene.mjs';
import { resolveTier, resolveSamplePreset, samplesForTier, samplesForScene, DEFAULT_SAMPLES } from '../photoreal/lib/tier.mjs';
import { plateArgs } from '../photoreal/lib/farm.mjs';
import { validateStoryboard, draftStoryboard } from '../photoreal/lib/storyboard.mjs';
import { makeKeys } from '../photoreal/lib/keys.mjs';

function song(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-inscene-'));
  for (const [f, src] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), src); }
  return dir;
}

test('Ultra finishing remains the default; cached films retain their tier and explicit choices win', () => {
  assert.equal(resolveTier(song({}), {}).tier, 'ultra');
  assert.equal(resolveTier(song({ 'out/segments/01.mp4': '' }), {}).tier, 'standard');
  assert.equal(resolveTier(song({ 'out/segments-draft/01.mp4': '' }), {}).tier, 'ultra', 'a draft does not pin a production tier');
  for (const tier of ['ultra', 'premium', 'fast']) {
    assert.equal(resolveTier(song({ [`out/segments-${tier}/01.mp4`]: '' }), {}).tier, tier);
  }
  assert.equal(resolveTier(song({ 'out/segments-ultra/not-a-plate.txt': '' }), {}).tier, 'ultra');
  assert.equal(resolveTier(song({ 'out/segments/01.mp4': '', 'out/segments-ultra/01.mp4': '' }), {}).tier, 'standard');
  assert.equal(resolveTier(song({ 'out/segments/01.mp4': '' }), { tier: 'premium' }).tier, 'premium');
  assert.equal(resolveTier(song({}), { tier: 'standard' }, 'fast').tier, 'fast');
  assert.throws(() => resolveTier(song({}), { tier: 'huge' }));
});

test('Dove samples are default independently of finishing; 16 and heavier samples remain explicit', () => {
  assert.equal(DEFAULT_SAMPLES, 8);
  assert.equal(samplesForTier('standard'), 8);
  assert.equal(samplesForTier('ultra'), 8);
  assert.equal(samplesForTier('ultra', 16), 16);
  assert.equal(samplesForTier('standard', 16), 16);
  assert.equal(samplesForTier('standard', 64), 64, 'explicit samples are never capped');
  assert.equal(samplesForTier('ultra', 16, 'ultra'), 64, 'the previous Ultra sampling remains opt-in');
  assert.equal(samplesForTier('ultra', 32, 'ultra'), 128);
  assert.equal(samplesForTier('premium', 12), 24);
  assert.equal(samplesForTier('fast', 16), 2);
  assert.throws(() => samplesForTier('huge'));
  assert.throws(() => samplesForTier('ultra', 8, 'huge'));
});

test('sample-preset overrides win; cached production preserves old sampling and drafts do not', () => {
  assert.deepEqual(resolveSamplePreset(song({}), {}), { preset: 'dove', why: 'default' });
  assert.equal(resolveSamplePreset(song({ 'out/segments-draft/01.mp4': '' }), {}).preset, 'dove');
  for (const dir of ['segments', 'segments-ultra', 'segments-premium', 'segments-fast']) {
    const s = song({ [`out/${dir}/01.mp4`]: '' });
    assert.equal(resolveSamplePreset(s, {}).preset, 'ultra');
    assert.equal(resolveSamplePreset(s, { samplePreset: 'dove' }).preset, 'dove');
    assert.equal(resolveSamplePreset(s, { samplePreset: 'ultra' }, 'dove').preset, 'dove');
  }
  assert.equal(resolveSamplePreset(song({}), { samplePreset: 'ultra' }).preset, 'ultra');
  assert.throws(() => resolveSamplePreset(song({}), { samplePreset: 'huge' }));
});

test('Dove scenes send 8/16 samples to the worker and changes invalidate cached plates', () => {
  const dir = song({ 'scenes/a.js': 'export default {};', 'data/lyrics.json': '{"lines":[],"words":[]}' });
  const keys = makeKeys(dir), s = { id: '01', scene: 'a', from: 0, to: 2, f0: 0, f1: 120 };
  const tier = resolveTier(dir, {}).tier, preset = resolveSamplePreset(dir, {}).preset;
  const base = samplesForTier(tier, DEFAULT_SAMPLES, preset);
  for (const samples of [undefined, 16]) {
    const n = samplesForScene(tier, base, { samples });
    assert.equal(n, samples ?? 8);
    const args = plateArgs({ ...s, samples: String(n) }, 60, { params: '{}' });
    assert.equal(args[args.indexOf('--samples') + 1], String(n));
  }
  assert.notEqual(keys.plate(s, 60, 8), keys.plate(s, 60, 16));
  assert.notEqual(keys.plate(s, 60, 8), keys.plate(s, 60, 64));
  assert.equal(samplesForScene('ultra', 64, { samples: 16 }), 64);
  assert.equal(samplesForScene('ultra', 2, { samples: 16, draft: true }), 2);
  assert.equal(samplesForScene('premium', 16, { premiumScene: true }), 32);
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
