import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { renderProject, probeVideo, runProcess, loadRenderer } from '../engine/export.mjs';
import { editSection } from '../engine/project.mjs';
import { pathToFileURL } from 'node:url';

test('long-lived renderer imports use the code revision instead of stale module state', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ark-module-test-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const moduleFile = path.join(dir, 'visual.mjs'), moduleUrl = pathToFileURL(moduleFile);
  await writeFile(moduleFile, 'export const drawFrame = () => "first";');
  assert.equal((await loadRenderer('revision-1', moduleUrl)).drawFrame(), 'first');
  await writeFile(moduleFile, 'export const drawFrame = () => "second";');
  assert.equal((await loadRenderer('revision-2', moduleUrl)).drawFrame(), 'second');
  assert.equal((await loadRenderer('revision-1', moduleUrl)).drawFrame(), 'first');
});

test('the production renderer propagates revisions to the story style dependency',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'ark-style-module-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  await writeFile(path.join(dir,'visual.mjs'),await readFile(new URL('../engine/visual.mjs',import.meta.url),'utf8'));
  await writeFile(path.join(dir,'field-guide-visual.mjs'),await readFile(new URL('../engine/field-guide-visual.mjs',import.meta.url),'utf8'));
  await writeFile(path.join(dir,'relief-visual.mjs'),await readFile(new URL('../engine/relief-visual.mjs',import.meta.url),'utf8'));
  const dependency=path.join(dir,'story-visual.mjs'),entry=pathToFileURL(path.join(dir,'visual.mjs'));
  const source=version=>`export const STORY_CATALOG={story:'${version}'};export const installStoryStyles=()=>{};`;
  await writeFile(dependency,source('first'));assert.equal((await loadRenderer('first',entry)).STYLE_CATALOG.story,'first');
  await writeFile(dependency,source('second'));assert.equal((await loadRenderer('second',entry)).STYLE_CATALOG.story,'second');
});

test('real encoder exports exact frames, resumes cache, isolates edits and offsets section audio', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ark-export-test-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const audio = path.join(dir, 'song.wav');
  await runProcess('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=2', '-c:a', 'pcm_s16le', audio]);
  const project = { version: 1, id: 'smoke', title: 'Pipeline smoke', width: 320, height: 180, fps: 10, duration: 0.8, audio: { src: 'song.wav', offset: 0.2 }, assets: {}, words: [{ id: 'a-word', text: 'One', start: 0, end: 0.3, confidence: 1, provenance: 'synthetic' }, { id: 'b-word', text: 'Two', start: 0.4, end: 0.7, confidence: 1, provenance: 'synthetic' }], beats: [], sections: [{ id: 'a', start: 0, end: 0.4, style: 'verse', wordIds: ['a-word'], assetIds: [], direction: {}, seed: 1 }, { id: 'b', start: 0.4, end: 0.8, style: 'verse', wordIds: ['b-word'], assetIds: [], direction: {}, seed: 2 }], palette: {} };
  const projectPath = path.join(dir, 'project.json'), outPath = path.join(dir, 'smoke.mp4');
  await writeFile(projectPath, JSON.stringify(project));
  const first = await renderProject({ projectPath, outPath });
  assert.equal(first.frames, 8); assert.equal(first.audioStart, 0.2);
  assert.ok(first.sections.every(s => !s.cacheHit));
  assert.equal(first.sourceRevision.revisionHash, first.sourceRevisionEnd.revisionHash);
  const video = (await probeVideo(outPath)).streams.find(s => s.codec_type === 'video');
  assert.equal(Number(video.nb_frames), 8); assert.equal(video.width, 320);
  const second = await renderProject({ projectPath, outPath });
  assert.ok(second.sections.every(s => s.cacheHit));
  await editSection(projectPath, 'b', { direction: { accent: '#00ff00' } });
  const edited = await renderProject({ projectPath, outPath });
  assert.deepEqual(edited.sections.map(s => s.cacheHit), [true, false]);
  const section = await renderProject({ projectPath, outPath: path.join(dir, 'section.mp4'), sectionId: 'b' });
  assert.equal(section.frames, 4); assert.equal(section.sourceStart, 0.4); assert.ok(Math.abs(section.audioStart - 0.6) < 1e-9);
  assert.equal(section.sections[0].cacheHit, true);
  const saved = JSON.parse(await readFile(`${outPath}.render.json`, 'utf8')); assert.equal(saved.sha256, edited.sha256);
});
