import test from 'node:test';
// These fixtures assert the historical GPT Image request; pin it so the agent running the suite does not change it.
process.env.ARK_IMAGE_PROVIDER = 'gpt-image';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { allocateSceneArtwork, auditSceneArtwork, sceneArtworkId } from '../engine/artwork.mjs';

const scene = (id, direction = {}, assetIds = [], style = 'verse') => ({ id, style, start: 0, end: 1, wordIds: ['word'], assetIds, direction });
const project = (sections, assets = {}) => ({ title: 'Fixture', words: [{ id: 'word', text: 'Mercy', start: 0, end: 1 }], assets, sections });
async function files(t, entries) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ark-artwork-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await Promise.all(Object.entries(entries).map(([name, bytes]) => writeFile(path.join(dir, name), bytes)));
  return path.join(dir, 'project.json');
}

test('unique allocator reserves later authored photos, preserves dependencies, and requests each exhausted scene', () => {
  const p = project([scene('first', { roles: { subject: 'word' } }, ['font']), scene('authored', { photo: 'reserved' }, ['reserved', 'successor']), scene('third'), scene('fourth')], {
    reserved: { type: 'image', src: 'reserved.png' }, spare: { type: 'image', src: 'spare.png' },
    successor: { type: 'font', src: 'type.otf', family: 'Fixture' }, font: { type: 'font', src: 'type.otf', family: 'Fixture' },
  });
  const original = structuredClone(p), result = allocateSceneArtwork(p, { requirePhotos: true, stylePrompt: 'Dark photoreal flood' });
  assert.deepEqual(p, original);
  assert.deepEqual(result.project.sections.map(s => s.direction.photo), ['spare', 'reserved', undefined, undefined]);
  assert.deepEqual(result.project.sections[0].assetIds, ['font', 'spare']);
  assert.deepEqual(result.project.sections[0].direction.roles, { subject: 'word' });
  assert.deepEqual(result.project.sections[1].assetIds, ['reserved', 'successor']);
  assert.deepEqual(result.assetRequests.map(r => r.sectionId), ['third', 'fourth']);
  assert.ok(result.assetRequests.every(r => r.provider === 'gpt-image' && /GPT Image/.test(r.agentAction) && /Mercy/.test(r.request)));
});

test('graphic scenes and semantic dependencies do not force arbitrary photo requests', async t => {
  const manifest = await files(t, { 'ocean.png': 'ocean', 'wave.png': 'foreground', 'grain.png': 'grain' });
  const p = project([scene('terrain', { portalAt: .5 }, ['ocean', 'wave'], 'terrain'), scene('water', { photo: 'ocean', wave: 'wave' }, ['ocean', 'wave'], 'submerge'), scene('graphic', {}, ['grain'])], {
    ocean: { type: 'image', src: 'ocean.png' }, wave: { type: 'image', src: 'wave.png' }, grain: { type: 'image', src: 'grain.png', artworkRole: 'shared-texture' },
  });
  assert.equal(sceneArtworkId(p, p.sections[0]), undefined);
  const result = allocateSceneArtwork(p);
  assert.equal(result.assetRequests.length, 0, 'an existing shared-texture fallback must not be promoted into photographic storytelling');
  assert.equal(result.project.sections[2].direction.photo, undefined);
  const audit = await auditSceneArtwork(p, manifest);
  assert.equal(audit.passed, true); assert.deepEqual(audit.uses.map(use => use.sectionId), ['water']);
  assert.equal(allocateSceneArtwork(project([scene('plain'), scene('mountain', {}, [], 'terrain')])).assetRequests.length, 0);
});

test('authored reuse fails instead of silently substituting an available image', async t => {
  const manifest = await files(t, { 'photo.png': 'same scene', 'unused.png': 'different scene' });
  const p = project([scene('a', { photo: 'photo' }, ['photo']), scene('b', { photo: 'photo' }, ['photo'])], {
    photo: { type: 'image', src: 'photo.png' }, unused: { type: 'image', src: 'unused.png' },
  });
  const allocated = allocateSceneArtwork(p, { requirePhotos: true });
  assert.deepEqual(allocated.project.sections.map(s => s.direction.photo), ['photo', 'photo']);
  const audit = await auditSceneArtwork(allocated.project, manifest);
  assert.equal(audit.passed, false); assert.equal(audit.status, 'reused_scene_artwork');
  assert.deepEqual(audit.duplicates[0].sectionIds, ['a', 'b']); assert.equal(audit.assetRequests[0].sectionId, 'b');
});

test('actual byte hashes detect renamed copies while ignoring unused aliases and dependency extras', async t => {
  const manifest = await files(t, { 'one.png': 'same bytes', 'renamed.png': 'same bytes', 'new.png': 'new image' });
  const p = project([scene('a', { photo: 'one' }, ['one', 'renamed']), scene('b', { photo: 'renamed' }, ['renamed']), scene('c', { photo: 'new' }, ['new', 'one'])], {
    one: { type: 'image', src: 'one.png', sha256: 'fake-one' }, renamed: { type: 'image', src: 'renamed.png', sha256: 'fake-two' }, new: { type: 'image', src: 'new.png' }, unused: { type: 'image', src: 'absent-and-unused.png' },
  });
  const audit = await auditSceneArtwork(p, manifest);
  assert.equal(audit.passed, false); assert.equal(audit.missing.length, 0); assert.equal(audit.duplicates.length, 1);
  assert.deepEqual(audit.duplicates[0].assetIds, ['one', 'renamed']); assert.deepEqual(audit.duplicates[0].sectionIds, ['a', 'b']);
  assert.equal(audit.uses.length, 3); assert.match(audit.limitations[0], /re-encoded, cropped/);
});

test('one assigned picture cannot satisfy missing photographs in other requested scenes', async t => {
  const manifest = await files(t, { 'photo.png': 'image' });
  const p = project([scene('a', { photo: 'photo' }, ['photo']), scene('b'), scene('c', { photo: 'broken' }, ['broken'])], {
    photo: { type: 'image', src: 'photo.png' }, broken: { type: 'image', src: 'missing.png' },
  });
  const allocated = allocateSceneArtwork(p, { requirePhotos: true }), audit = await auditSceneArtwork(allocated.project, manifest);
  assert.equal(audit.passed, false); assert.equal(audit.status, 'required_assets_pending');
  assert.deepEqual(audit.missing.map(m => m.sectionId), ['b', 'c']); assert.deepEqual(audit.assetRequests.map(r => r.sectionId), ['b', 'c']);
  assert.equal(audit.uses.length, 1);
});

test('allocator cannot recycle aliases of a reserved source and avoids semantic wave mattes', () => {
  const p = project([scene('a', { photo: 'one' }, ['one']), scene('b'), scene('water', { wave: 'wave' }, [], 'submerge')], {
    one: { type: 'image', src: 'one.png' }, alias: { type: 'image', src: './one.png' }, wave: { type: 'image', src: 'wave.png' },
  });
  const result = allocateSceneArtwork(p, { requirePhotos: true });
  assert.deepEqual(result.assetRequests.map(r => r.sectionId), ['b', 'water']);
  assert.equal(result.project.sections[2].direction.wave, 'wave');
});

test('required unsupported photos and unknown scene requests cannot silently pass', async t => {
  const manifest = await files(t, { 'photo.png': 'image' });
  const p = project([scene('mountain', { photo: 'photo' }, ['photo'], 'terrain')], { photo: { type: 'image', src: 'photo.png' } });
  const audit = await auditSceneArtwork(p, manifest);
  assert.equal(audit.passed, false); assert.match(audit.issues[0], /procedural style terrain/);
  assert.throws(() => allocateSceneArtwork(p, { requiredSectionIds: ['missing'] }), /unknown section/);
  assert.equal((await auditSceneArtwork(project([scene('a')]), manifest, { requiredSectionIds: ['missing'] })).passed, false);
});
