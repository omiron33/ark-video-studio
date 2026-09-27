import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { sectionCacheKey, outputProfile, publishChunk, cachedChunk } from '../engine/cache.mjs';
import { frameSpans } from '../engine/project.mjs';

const base = () => ({ id: 'demo', title: 'Demo', width: 1920, height: 1080, fps: 30, duration: 4, palette: {}, words: [{ id: 'first-word', text: 'First', start: 0.2, end: 1 }, { id: 'cross-word', text: 'Both', start: 1.8, end: 2.2 }, { id: 'last-word', text: 'Last', start: 2.5, end: 3.3 }], beats: [{ time: 1, strength: 1, kind: 'beat' }], sections: [{ id: 'a', start: 0, end: 2, assetIds: ['image-a'], wordIds: ['first-word'], direction: {}, style: 'verse', seed: 1 }, { id: 'b', start: 2, end: 4, assetIds: ['image-b'], wordIds: ['last-word'], direction: {}, style: 'verse', seed: 2 }] });
const assetSet = () => ({ 'image-a': { type: 'image', sha256: 'aaa' }, 'image-b': { type: 'image', sha256: 'bbb' }, font: { type: 'font', family: 'Demo', sha256: 'fff' } });
function keys(project, extras = {}) { return project.sections.map((s, i) => sectionCacheKey(project, s, frameSpans(project)[i], { profile: outputProfile(project), codeHash: 'renderer-1', assets: assetSet(), ...extras })); }
test('an isolated edit invalidates only its section; crossing lyric invalidates both', () => {
  const p = base(), initial = keys(p);
  p.sections[1].direction.accent = '#ff0000';
  let edited = keys(p); assert.equal(initial[0], edited[0]); assert.notEqual(initial[1], edited[1]);
  const isolated = base(); isolated.words[2].text = 'Final';
  edited = keys(isolated); assert.equal(initial[0], edited[0]); assert.notEqual(initial[1], edited[1]);
  const crossing = base(); crossing.words[1].start = 1.9;
  edited = keys(crossing); assert.notEqual(initial[0], edited[0]); assert.notEqual(initial[1], edited[1]);
});
test('image hashes, every font, output profile and renderer changes invalidate their consumers', () => {
  const p = base(), initial = keys(p), images = assetSet();
  images['image-a'].sha256 = 'replacement';
  let next = keys(p, { assets: images }); assert.notEqual(initial[0], next[0]); assert.equal(initial[1], next[1]);
  const fonts = assetSet(); fonts.font.sha256 = 'replacement';
  next = keys(p, { assets: fonts }); assert.ok(next.every((v, i) => v !== initial[i]));
  for (const override of [{ profile: outputProfile(p, 0.5) }, { codeHash: 'renderer-2' }]) assert.ok(keys(p, override).every((v, i) => v !== initial[i]));
});
test('portal invalidates for next scene direction, style, word timing and referenced image bytes', () => {
  const p = base(); p.sections[0].direction.portalAt = 1.5;
  const initial = keys(p);
  for (const modify of [q => { q.sections[1].direction.photo = 'image-b'; }, q => { q.sections[1].style = 'submerge'; }, q => { q.words[2].start += 0.1; }]) {
    const modified = structuredClone(p); modify(modified);
    assert.notEqual(keys(modified)[0], initial[0]);
  }
  const assets = assetSet(); assets['image-b'].sha256 = 'new-next-image';
  assert.notEqual(keys(p, { assets })[0], initial[0]);
  const ordinary = base(), before = keys(ordinary); ordinary.sections[1].direction.photo = 'image-b';
  assert.equal(keys(ordinary)[0], before[0]);
  ordinary.sections[1].direction.transition = 'crossfade';
  assert.equal(keys(ordinary)[0], before[0]);
  const transition = base(); transition.sections[0].direction.transition = 'crossfade';
  const transitionBefore = keys(transition); transition.sections[1].direction.photo = 'image-b';
  assert.notEqual(keys(transition)[0], transitionBefore[0]);
});
test('quantized edge cues remain dependencies', () => {
  const p = base(); p.sections[0].end = 1.51; p.sections[1].start = 1.51;
  p.words.push({ id: 'edge', text: 'Edge', start: 1.502, end: 1.508 });
  const initial = keys(p); p.words.at(-1).text = 'Changed';
  assert.notEqual(keys(p)[1], initial[1]);
});
test('cache requires complete atomic publication, content hash and independent format verification', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ark-cache-test-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const result = await publishChunk(dir, 'a', 'key', async output => { await writeFile(output, 'real chunk'); return { frames: 30 }; });
  assert.equal((await cachedChunk(dir, 'a', 'key', async () => true)).cacheHit, true);
  assert.equal(await cachedChunk(dir, 'a', 'key', async () => false), null);
  await writeFile(result.video, 'corrupted'); assert.equal(await cachedChunk(dir, 'a', 'key'), null);
  await assert.rejects(publishChunk(dir, 'b', 'failed', async output => { await writeFile(output, 'partial'); throw new Error('interrupted'); }), /interrupted/);
  assert.equal(await cachedChunk(dir, 'b', 'failed'), null);
});
