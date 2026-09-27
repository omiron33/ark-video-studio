import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {computeRevision, sha256File, reviewVideo, approveReview, recordVisualReview, checkReview, attachMachineAudioReview, attachMachineVisualReview, validateMachineAudioReport, validateMachineVisualReport, evidenceTimes, RUBRIC, VISUAL_RUBRIC, AUDIO_CHECKS} from '../engine/gauntlet.mjs';

const scores = Object.fromEntries(RUBRIC.map(category => [category, 8.5]));
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'ark-gauntlet-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const rendererDir = join(dir, 'engine');
  const projectDir = join(dir, 'project');
  await mkdir(rendererDir); await mkdir(projectDir);
  await writeFile(join(rendererDir, 'render.mjs'), 'export const version = 1;\n');
  await writeFile(join(projectDir, 'asset.txt'), 'original asset');
  const projectPath = join(projectDir, 'project.json');
  await writeFile(projectPath, JSON.stringify({duration: 0.6, width: 320, height: 180, fps: 10, audio: {src: 'asset.txt'}, assets: {test: {src: 'asset.txt'}}, words: [{id: 'w1', text: 'test', start: 0.1, end: 0.5}], sections: [{id: 'a', start: 0, end: 0.3}, {id: 'b', start: 0.3, end: 0.6}]}));
  return {dir, rendererDir, projectDir, projectPath, videoPath: join(dir, 'video.mp4'), outDir: join(projectDir, 'review')};
}

test('revision binds declared asset bytes and renderer, but ignores evidence', async t => {
  const f = await fixture(t);
  const first = await computeRevision(f.projectPath, f);
  await mkdir(f.outDir); await writeFile(join(f.outDir, 'review.json'), '{}');
  assert.equal((await computeRevision(f.projectPath, f)).revisionHash, first.revisionHash);
  await writeFile(join(f.projectDir, 'asset.txt'), 'changed asset');
  const assetChange = await computeRevision(f.projectPath, f);
  assert.notEqual(assetChange.projectHash, first.projectHash);
  assert.equal(assetChange.rendererHash, first.rendererHash);
  await writeFile(join(f.rendererDir, 'render.mjs'), 'export const version = 2;\n');
  const rendererChange = await computeRevision(f.projectPath, f);
  assert.notEqual(rendererChange.rendererHash, first.rendererHash);
  await writeFile(join(f.rendererDir, 'ocr.swift'), 'import Vision\n');
  const nativeChange = await computeRevision(f.projectPath, f);
  assert.notEqual(nativeChange.rendererHash, rendererChange.rendererHash);
  await writeFile(join(f.rendererDir, 'audio-review.py'), '# changed measurement policy\n');
  assert.notEqual((await computeRevision(f.projectPath, f)).rendererHash, nativeChange.rendererHash);
  const manifest = JSON.parse(await readFile(f.projectPath, 'utf8'));
  manifest.intake = {originalLyrics: 'lyrics.txt', originalTiming: 'timing.json', originalBeats: 'beats.json'};
  for (const name of Object.values(manifest.intake)) await writeFile(join(f.projectDir, name), 'original sidecar');
  await writeFile(f.projectPath, JSON.stringify(manifest));
  const sidecars = await computeRevision(f.projectPath, f);
  for (const name of Object.values(manifest.intake)) {
    await writeFile(join(f.projectDir, name), 'changed sidecar');
    assert.notEqual((await computeRevision(f.projectPath, f)).projectHash, sidecars.projectHash);
    await writeFile(join(f.projectDir, name), 'original sidecar');
  }
});

test('evidence samples word onsets and both sides of boundaries without leaving the clip', () => {
  const samples = evidenceTimes({words: [{id: 'late', start: 1.95}], sections: [{id: 'cut', start: 1.5}]}, {fps: 30, frameCount: 30, start: 1});
  assert.ok(samples.every(sample => sample.frame >= 0 && sample.frame < 30));
  assert.ok(samples.some(sample => sample.frame === 14 && sample.reasons.includes('section:cut:-1')));
  assert.ok(samples.some(sample => sample.frame === 16 && sample.reasons.includes('section:cut:1')));
  assert.ok(samples.some(sample => sample.reasons.some(reason => reason.startsWith('word:late'))));
});

test('actual decoded output requires complete judgment; failures and stale bindings cannot pass', {timeout: 60000}, async t => {
  const f = await fixture(t);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=navy:s=320x180:r=10:d=0.6', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.6', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-t', '0.6', f.videoPath]);
  const revision = await computeRevision(f.projectPath, f);
  await writeFile(`${f.videoPath}.render.json`, JSON.stringify({sha256: await sha256File(f.videoPath), sourceRevision: revision, sourceRevisionEnd: revision, duration: 0.6, width: 320, height: 180, fps: 10, sections: [{startFrame: 0}]}));
  const report = await reviewVideo(f);
  assert.equal(report.technical.passed, true, JSON.stringify(report.technical.checks));
  assert.equal(report.technical.probe.streams.find(stream => stream.codec_type === 'video').nb_read_frames, '6');
  assert.equal(report.status, 'machine_audio_review_required');
  assert.ok(report.evidence.contactSheets.length > 0);
  assert.equal(report.evidence.transitionStrips.length, 1);
  const common = {reportPath: report.reportPath, reviewer: 'Independent test reviewer', scores, notes: 'Synthetic test evidence only, not an artistic judgment.'};
  assert.equal((await checkReview(common)).passed, false);
  await assert.rejects(approveReview({...common, scores: {composition: 9}}), /must be a number/);
  await assert.rejects(approveReview({...common, scores: {...scores, sync: '9'}}), /must be a number/);
  await assert.rejects(approveReview({...common, scores: {...scores, sync: 11}}), /must be a number/);
  await assert.rejects(approveReview({...common, reviewer: ''}), /reviewer/);
  await assert.rejects(approveReview({...common, notes: ''}), /notes/);
  const fail = await approveReview({...common, scores: {...scores, semanticMotion: 7}});
  assert.equal(fail.passed, false);
  assert.equal(fail.report.visual.status, 'changes_requested');
  assert.equal((await approveReview(common)).passed, true);
  const passed = JSON.parse(await readFile(report.reportPath));
  passed.visual.reviews.at(-1).binding.videoSha256 = 'wrong';
  await writeFile(report.reportPath, JSON.stringify(passed));
  assert.equal((await checkReview(common)).passed, false);
  await approveReview(common);
  await writeFile(join(f.projectDir, 'asset.txt'), 'updated art');
  assert.equal((await checkReview(common)).status, 'stale');
  await assert.rejects(approveReview(common), /Stale/);
  await writeFile(join(f.projectDir, 'asset.txt'), 'original asset');
  await writeFile(f.videoPath, 'different final video');
  assert.equal((await checkReview(common)).status, 'stale');
});

test('machine audio schema cannot pass with missing measurements, stale input, duplicate checks or failure', () => {
  const binding = {videoSha256: 'video', projectHash: 'project'};
  const audio = {schemaVersion: 1, kind: 'machine-audio-review', binding: {...binding, audioSha256: 'audio'}, status: 'passed', methods: ['Synthetic schema fixture'], limitations: ['Not an actual acoustic measurement'], checks: AUDIO_CHECKS.map(id => ({id, passed: true, measured: 0, threshold: 1}))};
  const validate = value => validateMachineAudioReport(value, binding, {audioSha256: 'audio'});
  assert.equal(validate(audio).passed, true);
  assert.equal(validate({...audio, checks: []}).passed, false);
  assert.equal(validate({...audio, checks: [...audio.checks, audio.checks[0]]}).passed, false);
  assert.equal(validate({...audio, binding: {...audio.binding, videoSha256: 'stale'}}).passed, false);
  assert.equal(validate({...audio, binding: {...audio.binding, audioSha256: 'changed-source'}}).passed, false);
  assert.equal(validate({...audio, checks: [...audio.checks, null]}).passed, false);
  assert.equal(validate({...audio, checks: audio.checks.map(check => ({...check, threshold: null}))}).passed, false);
  assert.equal(validate({...audio, checks: audio.checks.map(check => ({...check, passed: false}))}).passed, false);
});

test('machine visual schema rejects missing categories, nonnumeric scores and absent decoded evidence', () => {
  const binding = {videoSha256: 'video', projectHash: 'project'};
  const visual = {schemaVersion: 1, kind: 'machine-visual-review', binding, status: 'passed', method: 'local-vision-model', model: 'test-model', scores: Object.fromEntries(VISUAL_RUBRIC.map(key => [key, 8])), evidence: [{path: 'frame.jpg', sha256: 'fixture'}], issues: [], limitations: []};
  assert.equal(validateMachineVisualReport(visual, binding).passed, true);
  assert.equal(validateMachineVisualReport({...visual, scores: {composition: 9}}, binding).passed, false);
  assert.equal(validateMachineVisualReport({...visual, scores: {...visual.scores, composition: '9'}}, binding).passed, false);
  assert.equal(validateMachineVisualReport({...visual, evidence: []}, binding).passed, false);
  assert.equal(validateMachineVisualReport({...visual, binding: {...binding, projectHash: 'stale'}}, binding).passed, false);
});

test('autonomous machine gates finish without a human hearing score, but retain separate aesthetic quality', {timeout: 60000}, async t => {
  const f = await fixture(t);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=navy:s=320x180:r=10:d=0.6', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.6', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-t', '0.6', f.videoPath]);
  const report = await reviewVideo(f);
  const audioPath = join(f.dir, 'machine-audio.json');
  const audio = {schemaVersion: 1, kind: 'machine-audio-review', binding: {...report.binding, audioSha256: await sha256File(join(f.projectDir, 'asset.txt'))}, status: 'passed', methods: ['Synthetic bound schema fixture'], limitations: ['Checks are mocked for gauntlet integration; acoustic analysis has its own tests'], checks: AUDIO_CHECKS.map(id => ({id, passed: true, measured: {fixture: 0}, threshold: {maximum: 1}}))};
  await writeFile(audioPath, JSON.stringify(audio));
  const audioOnly = await attachMachineAudioReview({reportPath: report.reportPath, audioReviewPath: audioPath});
  assert.equal(audioOnly.status, 'machine_visual_review_required');
  assert.equal(audioOnly.passed, false);
  const visualScores = Object.fromEntries(VISUAL_RUBRIC.map(key => [key, 8.5]));
  const independent = await recordVisualReview({reportPath: report.reportPath, reviewer: 'Independent test agent', scores: visualScores, notes: 'Test-only synthetic judgment; no claimed listening.'});
  assert.equal(independent.status, 'independently_reviewed');
  assert.equal(independent.passed, true);
  assert.equal(independent.quality.syncBasis, 'measured_local_audio_review');
  assert.equal(independent.quality.machineVisualVerified, false);
  const reset = JSON.parse(await readFile(report.reportPath, 'utf8'));
  reset.visual.reviews = [];
  await writeFile(report.reportPath, JSON.stringify(reset));
  const visualPath = join(f.dir, 'machine-visual.json');
  const evidencePath = report.evidence.samples[0].path;
  const visual = {schemaVersion: 1, kind: 'machine-visual-review', binding: {...report.binding}, status: 'passed', method: 'local-vision-model', model: 'test-model', scores: visualScores, issues: [], limitations: ['Synthetic test judgment'], evidence: [{path: evidencePath, time: 0, sha256: await sha256File(evidencePath)}]};
  await writeFile(visualPath, JSON.stringify(visual));
  const automated = await attachMachineVisualReview({reportPath: report.reportPath, visualReviewPath: visualPath});
  assert.equal(automated.passed, true);
  assert.equal(automated.status, 'machine_verified');
  assert.equal(automated.quality.machineQualityVerified, true);
  assert.equal(automated.quality.independentVisualReviewed, false);
  await writeFile(evidencePath, 'changed evidence');
  const brokenEvidence = await checkReview({reportPath: report.reportPath});
  assert.equal(brokenEvidence.passed, false);
  assert.equal(brokenEvidence.status, 'machine_visual_review_failed');
  audio.status = 'needs_repair';
  audio.checks.find(check => check.id === 'word_sync').passed = false;
  await writeFile(audioPath, JSON.stringify(audio));
  const failedAudio = await attachMachineAudioReview({reportPath: report.reportPath, audioReviewPath: audioPath});
  assert.equal(failedAudio.passed, false);
  assert.equal(failedAudio.status, 'machine_audio_review_failed');
});

test('missing audio is a technical failure even when frames render', {timeout: 60000}, async t => {
  const f = await fixture(t);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=320x180:r=10:d=0.6', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', f.videoPath]);
  const report = await reviewVideo(f);
  assert.equal(report.technical.passed, false);
  assert.equal(report.technical.checks.find(check => check.name === 'audioStream').passed, false);
  await assert.rejects(approveReview({reportPath: report.reportPath, reviewer: 'Test reviewer', scores, notes: 'No audio exists in the output.'}), /technical/);
});
