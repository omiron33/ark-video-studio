import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { normalizeTiming, normalizeBeats, buildSections, importSong } from '../engine/import.mjs';
import { validateProject, frameSpans } from '../engine/project.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function wav(seconds = 1.075) {
  const rate = 8000, samples = Math.round(rate * seconds), output = Buffer.alloc(44 + samples * 2);
  output.write('RIFF', 0); output.writeUInt32LE(output.length - 8, 4); output.write('WAVEfmt ', 8);
  output.writeUInt32LE(16, 16); output.writeUInt16LE(1, 20); output.writeUInt16LE(1, 22);
  output.writeUInt32LE(rate, 24); output.writeUInt32LE(rate * 2, 28); output.writeUInt16LE(2, 32); output.writeUInt16LE(16, 34);
  output.write('data', 36); output.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) output.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 220 / rate) * 2000), 44 + i * 2);
  return output;
}

test('legacy nested lyrics keep exact text, interpolation, source grouping and crop provenance', () => {
  const source = { method: 'supplied alignment', sections: [{ name: 'Bridge', tag: 'Bridge — spacious', lines: [{ text: '“Rise,” O earth!', words: [
    { word: '“Rise,”', start: 9.8, end: 10.3, aligned: false, custom: 'preserve me' },
    { word: 'O', start: 10.5, end: 10.8, aligned: true },
    { word: 'earth!', start: 10.9, end: 11.5, confidence: 0.83 },
  ] }] }] };
  const before = structuredClone(source);
  const result = normalizeTiming(source, { sourceOffset: 10, duration: 1 });
  assert.deepEqual(source, before, 'normalization must not mutate original data');
  assert.deepEqual(result.words.map(w => w.text), ['“Rise,”', 'O', 'earth!']);
  assert.equal(result.words[0].start, 0); assert.equal(result.words.at(-1).end, 1);
  assert.equal(result.words[0].confidence, 'interpolated'); assert.equal(result.words[0].aligned, false);
  assert.equal(result.words[0].provenance.original.custom, 'preserve me');
  assert.equal(result.words[0].provenance.sourceStart, 9.8);
  assert.equal(result.words[0].provenance.clampedStart, true);
  assert.equal(result.words.at(-1).provenance.clampedEnd, true);
  assert.equal(result.phrases[0].source.text, '“Rise,” O earth!');
  assert.equal(result.phrases[0].sourceSection.name, 'Bridge');
  assert.match(result.warnings.join(' '), /interpolated/);
});

test('word ids are durable across crop windows and source/clip timebases', () => {
  const source = { words: [{ text: 'Waters', start: 20, end: 21 }, { text: 'rise.', start: 21.2, end: 21.8 }] };
  const full = normalizeTiming(source, { duration: 30 });
  const crop = normalizeTiming(source, { sourceOffset: 20.5, duration: 2 });
  assert.deepEqual(crop.words.map(w => w.id), full.words.map(w => w.id));
  assert.equal(crop.words[0].start, 0);
  const relative = normalizeTiming({ timebase: 'clip', words: [{ id: 'owned-word', text: 'Exact—word', start: 0.2, end: 0.5, confidence: false, provenance: { reviewer: 'pending' } }] }, { sourceOffset: 30, duration: 1 });
  assert.equal(relative.words[0].id, 'owned-word');
  assert.ok(Math.abs(relative.words[0].start - 0.2) < 1e-9);
  assert.equal(relative.words[0].provenance.sourceStart, 30.2);
  assert.equal(relative.words[0].confidence, false);
  assert.equal(relative.words[0].provenance.reviewer, 'pending');
});

test('bad words, conflicting ids and missing phrase references fail instead of guessed timings', () => {
  const cases = [
    [{ text: 'Missing', start: 0 }], [{ text: 'Backwards', start: 1, end: 0.9 }],
    [{ text: 'String time', start: '0', end: 1 }], [{ text: ' ', start: 0, end: 1 }],
    [{ id: '../bad', text: 'word', start: 0, end: 1 }],
    [{ id: 'same', text: 'a', start: 0, end: 0.4 }, { id: 'same', text: 'b', start: 0.5, end: 1 }],
  ];
  for (const words of cases) assert.throws(() => normalizeTiming({ words }, { duration: 2 }));
  assert.throws(() => normalizeTiming({ words: [{ id: 'exists', text: 'Yes', start: 0, end: 1 }], phrases: [{ id: 'phrase', wordIds: ['missing'] }] }, { duration: 2 }), /missing word/);
});

test('phrase grouping and frame-aligned sections cover the whole clip without gaps', () => {
  const result = normalizeTiming({ words: [
    { text: 'First.', start: 0.2, end: 0.6 }, { text: 'Second', start: 1.017, end: 1.5 },
    { text: 'line.', start: 1.5, end: 2.1 }, { text: 'Third.', start: 2.811, end: 3.2 },
  ] }, { duration: 4 });
  assert.equal(result.phrases.length, 3);
  const sections = buildSections(result.phrases, { duration: 4, fps: 30 });
  assert.equal(sections[0].start, 0); assert.equal(sections.at(-1).end, 4);
  for (const [i, section] of sections.entries()) {
    assert.equal(section.style, 'verse');
    assert.ok(Math.abs(section.end * 30 - Math.round(section.end * 30)) < 1e-7);
    if (i) assert.equal(section.start, sections[i - 1].end);
  }
  assert.equal(frameSpans({ duration: 4, fps: 30, sections }).reduce((sum, s) => sum + s.frames, 0), 120);
  assert.throws(() => buildSections(result.phrases, { duration: 4, style: 'rise' }), /word roles/);
});

test('beats retain source provenance and strength, omit events beyond the clip', () => {
  const source = { beats: [9.8, { time: 10.3, strength: 0.6, kind: 'onset' }, 11] };
  const beats = normalizeBeats(source, { sourceOffset: 10, duration: 1 });
  assert.equal(beats.length, 1);
  assert.ok(Math.abs(beats[0].time - 0.3) < 1e-9);
  assert.equal(beats[0].strength, 0.6); assert.equal(beats[0].kind, 'onset');
  assert.equal(beats[0].provenance.sourceTime, 10.3);
  assert.deepEqual(normalizeBeats(undefined, { duration: 1 }), []);
  assert.throws(() => normalizeBeats([-1], { duration: 1 }), /invalid/);
});

test('real intake probes audio, copies sources byte-for-byte and creates a valid independent project', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'ark-import-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const audio = path.join(directory, 'input.wav'), timing = path.join(directory, 'words.json'), output = path.join(directory, 'new-song');
  const bytes = wav(); await writeFile(audio, bytes);
  const timingBytes = JSON.stringify({ words: [{ id: 'first', text: 'Faith,', start: 0.08, end: 0.7, aligned: false }, { id: 'second', text: 'still.', start: 0.7, end: 1.07 }] });
  await writeFile(timing, timingBytes);
  const result = await importSong({ audio, timing, projectDir: output, sourceOffset: 0.1, fps: 30, title: 'A different song' });
  assert.equal(result.status, 'timed_needs_review'); assert.equal(result.project.duration, 29 / 30);
  assert.equal(result.project.audio.offset, 0.1); assert.equal(result.project.words[0].start, 0);
  assert.equal(result.project.words.at(-1).end, result.project.duration);
  assert.deepEqual(await readFile(path.join(output, result.project.audio.src)), bytes);
  assert.deepEqual(await readFile(audio), bytes);
  assert.equal(await readFile(path.join(output, 'sources/timing.json'), 'utf8'), timingBytes);
  assert.equal((await validateProject(result.project, result.manifestPath)).valid, true);
  await assert.rejects(importSong({ audio, projectDir: output }), /already exists/);
  assert.deepEqual(JSON.parse(await readFile(result.manifestPath, 'utf8')), result.project);
});

test('missing timing remains explicitly unresolved and invalid timing creates no project', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'ark-import-unresolved-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const audio = path.join(directory, 'input.wav'), timing = path.join(directory, 'bad.json');
  await writeFile(audio, wav()); await writeFile(timing, JSON.stringify({ words: [{ text: 'Untimed' }] }));
  const draft = await importSong({ audio, projectDir: path.join(directory, 'draft') });
  assert.equal(draft.status, 'unresolved'); assert.deepEqual(draft.project.words, []);
  assert.equal(draft.project.sections.length, 1); assert.match(draft.warnings.join(' '), /no times were invented/);
  const badOutput = path.join(directory, 'bad');
  await assert.rejects(importSong({ audio, timing, projectDir: badOutput }), /invalid time/);
  await assert.rejects(access(badOutput));
});

test('offline alignment helper reports missing local model without timing or overwrite', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'ark-align-unresolved-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const audio = path.join(directory, 'input.wav'), output = path.join(directory, 'alignment.json');
  await writeFile(audio, wav());
  const args = [path.join(repo, 'engine/align.py'), '--audio', audio, '--output', output, '--model', path.join(directory, 'missing-local-model')];
  const first = spawnSync('python3', args, { encoding: 'utf8' });
  assert.equal(first.status, 2, first.stderr);
  const bytes = await readFile(output, 'utf8'), result = JSON.parse(bytes);
  assert.equal(result.status, 'unresolved'); assert.deepEqual(result.words, []);
  assert.match(result.reason, /Nothing was downloaded/);
  const second = spawnSync('python3', args, { encoding: 'utf8' });
  assert.equal(second.status, 2); assert.match(second.stderr, /Refusing to overwrite/);
  assert.equal(await readFile(output, 'utf8'), bytes);
});
