import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateProject, loadProject, frameSpans, editSection, canonical } from '../engine/project.mjs';

export function fixture() {
  return { version: 1, id: 'test-song', title: 'Test Song', width: 1920, height: 1080, fps: 30, duration: 4, audio: { src: 'song.wav', offset: 0 }, assets: { a: { type: 'image', src: 'a.png' }, b: { type: 'image', src: 'b.png' }, font: { type: 'font', src: 'font.ttf', family: 'Test Font' } }, words: [{ id: 'one', text: 'Rise', start: 0.2, end: 0.8, confidence: 1, provenance: 'checked' }, { id: 'cross', text: 'waters', start: 1.8, end: 2.2, confidence: 0.4, provenance: 'interpolated' }, { id: 'late', text: 'above', start: 2.5, end: 3.1, confidence: 1, provenance: 'checked' }], beats: [{ time: 0.5, strength: 1, kind: 'beat' }, { time: 2.5, strength: 0.8, kind: 'beat' }], sections: [{ id: 'first', start: 0, end: 2, style: 'verse', wordIds: ['one'], assetIds: ['a'], direction: {}, seed: 1 }, { id: 'second', start: 2, end: 4, style: 'verse', wordIds: ['late'], assetIds: ['b'], direction: {}, seed: 2 }], palette: { accent: '#f80' } };
}
async function directory(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ark-engine-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await Promise.all(['song.wav', 'a.png', 'b.png', 'font.ttf'].map(name => writeFile(path.join(dir, name), name)));
  const manifest = path.join(dir, 'project.json');
  await writeFile(manifest, JSON.stringify(fixture(), null, 2));
  return { dir, manifest };
}
test('manifest validates declared sources, coverage, IDs, roles, styles and preserves timing uncertainty', async t => {
  const { manifest } = await directory(t);
  const loaded = await loadProject(manifest);
  assert.equal(loaded.validation.valid, true);
  assert.match(loaded.validation.warnings.join(' '), /cross/);
  for (const mutate of [p => { p.sections[1].start = 2.1; }, p => { p.sections[1].end = 3.9; }, p => { p.words[1].id = 'one'; }, p => { p.sections[0].assetIds = ['missing']; }, p => { p.sections[0].direction.roles = { verb: 'late' }; }, p => { p.sections[0].style = 'unknown'; }, p => { p.audio.src = 'missing.wav'; }]) {
    const project = fixture(); mutate(project);
    assert.equal((await validateProject(project, manifest)).valid, false);
  }
});
test('cumulative rounding covers every frame exactly once', () => {
  const p = fixture();
  p.duration = 10; p.sections = [{ id: 'a', start: 0, end: 2.73 }, { id: 'b', start: 2.73, end: 6.4 }, { id: 'c', start: 6.4, end: 10 }];
  const spans = frameSpans(p);
  assert.deepEqual(spans.map(s => [s.start, s.end]), [[0, 82], [82, 192], [192, 300]]);
  assert.equal(spans.reduce((a, s) => a + s.frames, 0), 300);
});
test('patch is durable, makes exact revision backup, preserves other sections and rejects implicit retiming', async t => {
  const { manifest, dir } = await directory(t);
  const originalBytes = await readFile(manifest, 'utf8');
  const { section, backup } = await editSection(manifest, 'first', { direction: { accent: '#f00', roles: { verb: 'one' } } });
  assert.equal(section.direction.accent, '#f00');
  assert.equal(await readFile(backup, 'utf8'), originalBytes);
  let p = JSON.parse(await readFile(manifest, 'utf8'));
  assert.deepEqual(p.sections[1], fixture().sections[1]);
  const editedBytes = await readFile(manifest, 'utf8');
  await assert.rejects(editSection(manifest, 'first', { end: 1.5 }), /--retime/);
  await assert.rejects(editSection(manifest, 'first', { end: 4.1 }, { retime: true }), /invalid time interval/);
  assert.equal(await readFile(manifest, 'utf8'), editedBytes);
  await editSection(manifest, 'first', { style: 'orbit', wordIds: ['one'], assetIds: ['a'], direction: {}, seed: 7 }, { replace: true });
  p = JSON.parse(await readFile(manifest, 'utf8'));
  assert.equal(p.sections[0].start, 0); assert.equal(p.sections[0].end, 2); assert.equal(p.sections[0].style, 'orbit');
  assert.equal((await readdir(path.join(dir, '.revisions'))).length, 2);
  await editSection(manifest, 'first', { end: 1.5 }, { retime: true });
  p = JSON.parse(await readFile(manifest, 'utf8'));
  assert.equal(p.sections[0].end, 1.5); assert.equal(p.sections[1].start, 1.5);
});
test('canonical JSON is insensitive to object property insertion order', () => {
  assert.equal(canonical({ b: [2, { d: 1, c: 0 }], a: 0 }), canonical({ a: 0, b: [2, { c: 0, d: 1 }] }));
});
