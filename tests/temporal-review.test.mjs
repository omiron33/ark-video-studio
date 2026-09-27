import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {temporalPolicy, temporalProjectHash, parseFreezeLog, mapStaticIntervals, reviewTemporalActivity, validateTemporalReport} from '../engine/temporal-review.mjs';
import {reviewVideo, checkReview, approveReview, RUBRIC} from '../engine/gauntlet.mjs';

test('temporal policy is opt-in and malformed budgets fail closed', () => {
  assert.equal(temporalPolicy({}), null);
  for (const value of [null, 0, -1, NaN, Infinity, '2.8']) assert.throws(() => temporalPolicy({duration: 3, quality: {maxStaticSeconds: value}}), /finite positive/);
  assert.equal(temporalPolicy({duration: 3, quality: {maxStaticSeconds: 2.8}}).maxStaticSeconds, 2.8);
});

test('freeze parser closes EOF intervals and maps every intersecting section without resetting at cuts', () => {
  const intervals = parseFreezeLog('[freezedetect] lavfi.freezedetect.freeze_start: 0\n[freezedetect] lavfi.freezedetect.freeze_duration: 3\n[freezedetect] lavfi.freezedetect.freeze_end: 3\n[freezedetect] lavfi.freezedetect.freeze_start: 5.2\n', 9);
  assert.deepEqual(intervals, [{start: 0, end: 3, duration: 3, endedAtEof: false}, {start: 5.2, end: 9, duration: 3.8, endedAtEof: true}]);
  const mapped = mapStaticIntervals(intervals, [{id: 'a', start: 0, end: 2}, {id: 'b', start: 2, end: 6}, {id: 'c', start: 6, end: 9}], 2.8);
  assert.deepEqual(mapped.map(item => item.sectionIds), [['a', 'b'], ['b', 'c']]);
  assert.deepEqual(mapped[0].sections.map(item => item.overlapSeconds), [2, 1]);
  assert.ok(mapped.every(item => item.exceedsBudget));
  assert.equal(mapStaticIntervals([{start: 0, end: 2.8, duration: 2.8}], [], 2.8)[0].exceedsBudget, false);
  const cut = mapStaticIntervals([{start: 2.997, end: 6, duration: 3.003}], [{id: 'before', start: 0, end: 3}, {id: 'after', start: 3, end: 6}], 2.8, {fps: 30})[0];
  assert.deepEqual(cut.sectionIds, ['after']);
  assert.equal(cut.start, 2.997);
  assert.equal(cut.duration, 3.003);
  assert.equal(cut.mapping.start, 3);
});

test('malformed freeze evidence never silently becomes an empty pass', () => {
  for (const log of ['lavfi.freezedetect.freeze_end: 1', 'lavfi.freezedetect.freeze_start: NaN', 'lavfi.freezedetect.freeze_start: 4', 'lavfi.freezedetect.freeze_start: 2\nlavfi.freezedetect.freeze_end: 1', 'lavfi.freezedetect.freeze_start: 0\nlavfi.freezedetect.freeze_start: 1']) assert.throws(() => parseFreezeLog(log, 3));
  assert.deepEqual(parseFreezeLog('', 3), []);
});

test('project binding includes temporal policy and scene boundaries with stable key order', () => {
  const project = {duration: 3, quality: {maxStaticSeconds: 2.8}, sections: [{id: 'a', start: 0, end: 3}]};
  assert.equal(temporalProjectHash(project), temporalProjectHash({sections: project.sections, quality: project.quality, duration: 3}));
  assert.notEqual(temporalProjectHash(project), temporalProjectHash({...project, quality: {maxStaticSeconds: 4}}));
});

test('real encoded 3-second flat clip fails through EOF; moving clip passes; no-policy is not a pass', {timeout: 60000}, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'ark-temporal-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const encode = (source, name) => {
    const path = join(dir, `${name}.mp4`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', source, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path]);
    return path;
  };
  const flat = encode('color=c=navy:s=320x180:r=30:d=3', 'flat');
  const moving = encode('testsrc2=s=320x180:r=30:d=3', 'moving');
  const project = {duration: 3, fps: 30, quality: {maxStaticSeconds: 2.8}, sections: [{id: 'one', start: 0, end: 1.5}, {id: 'two', start: 1.5, end: 3}]};
  const frozen = await reviewTemporalActivity({videoPath: flat, project, outDir: join(dir, 'flat-review')});
  assert.equal(frozen.passed, false, JSON.stringify(frozen));
  assert.equal(frozen.video.decodedFrames, 90);
  assert.equal(frozen.intervals.length, 1);
  assert.equal(frozen.intervals[0].start, 0);
  assert.equal(frozen.intervals[0].end, 3);
  assert.equal(frozen.intervals[0].endedAtEof, true);
  assert.deepEqual(frozen.intervals[0].sectionIds, ['one', 'two']);
  assert.equal(frozen.checks.find(item => item.id === 'all_frames_decoded').passed, true);
  assert.equal(frozen.checks.find(item => item.id === 'max_static_interval').passed, false);
  assert.match(frozen.binding.videoSha256, /^[a-f0-9]{64}$/);
  assert.match(await readFile(frozen.evidence.logPath, 'utf8'), /freeze_start: 0/);
  const active = await reviewTemporalActivity({videoPath: moving, project, outDir: join(dir, 'moving-review')});
  assert.equal(active.passed, true, JSON.stringify(active));
  assert.equal(active.video.decodedFrames, 90);
  assert.deepEqual(active.intervals, []);
  assert.equal((await validateTemporalReport(active, {videoSha256: active.binding.videoSha256, project})).passed, true);
  for (const binding of [{...active.binding, videoSha256: 'other'}, {...active.binding, detectorSourceSha256: 'old'}, {...active.binding, policySha256: 'old'}, {...active.binding, projectObjectHash: 'old'}]) {
    assert.equal((await validateTemporalReport({...active, binding}, {videoSha256: active.binding.videoSha256, project})).passed, false);
  }
  assert.equal((await validateTemporalReport({...active, intervals: [{start: 0, end: 3, duration: 3}]}, {videoSha256: active.binding.videoSha256, project})).passed, false);
  assert.equal((await validateTemporalReport({...active, checks: []}, {videoSha256: active.binding.videoSha256, project})).passed, false);
  const skipped = await reviewTemporalActivity({videoPath: flat, project: {duration: 3}, outDir: join(dir, 'skipped-review')});
  assert.equal(skipped.status, 'not_requested');
  assert.equal(skipped.passed, null);
  const mismatched = await reviewTemporalActivity({videoPath: moving, project: {...project, duration: 4}, outDir: join(dir, 'mismatched-review')});
  assert.equal(mismatched.passed, false);
  assert.equal(mismatched.checks.find(item => item.id === 'full_project_timebase').passed, false);
  const ending = join(dir, 'ending.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=30:d=2', '-f', 'lavfi', '-i', 'color=c=navy:s=320x180:r=30:d=3', '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]', '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', ending]);
  const endReport = await reviewTemporalActivity({videoPath: ending, project: {...project, duration: 5, sections: [{id: 'moving', start: 0, end: 2}, {id: 'frozen-ending', start: 2, end: 5}]}, outDir: join(dir, 'ending-review')});
  assert.equal(endReport.passed, false);
  assert.equal(endReport.video.decodedFrames, 150);
  assert.equal(endReport.intervals[0].start, 2);
  assert.equal(endReport.intervals[0].end, 5);
  assert.equal(endReport.intervals[0].endedAtEof, true);
  assert.deepEqual(endReport.intervals[0].sectionIds, ['frozen-ending']);
});

test('gauntlet enforces opt-in temporal measurements and rechecks raw evidence before any approval', {timeout: 60000}, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'ark-temporal-gate-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const rendererDir = join(dir, 'engine');
  await mkdir(rendererDir);
  await writeFile(join(rendererDir, 'renderer.mjs'), 'export const testOnly=true;\n');
  await writeFile(join(dir, 'audio.txt'), 'Test-only declared audio input; MP4 sine encoded below.');
  const project = {duration: 3, fps: 30, width: 320, height: 180, quality: {maxStaticSeconds: 2.8}, audio: {src: 'audio.txt'}, sections: [{id: 'full', start: 0, end: 3}]};
  const projectPath = join(dir, 'project.json');
  await writeFile(projectPath, JSON.stringify(project));
  const encode = (source, name) => {
    const videoPath = join(dir, `${name}.mp4`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', source, '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-t', '3', videoPath]);
    return videoPath;
  };
  const review = async (source, name) => reviewVideo({videoPath: encode(source, name), projectPath, rendererDir, outDir: join(dir, name)});
  const flat = await review('color=c=navy:s=320x180:r=30:d=3', 'flat');
  assert.equal(flat.technical.passed, false);
  assert.equal(flat.temporalActivity.passed, false);
  assert.equal((await checkReview({reportPath: flat.reportPath})).status, 'technical_failed');
  const judgment = {reviewer: 'Synthetic test reviewer', scores: Object.fromEntries(RUBRIC.map(key => [key, 9])), notes: 'Synthetic schema fixture; no claim that this is an artistic review.'};
  await assert.rejects(approveReview({...judgment, reportPath: flat.reportPath}), /technical checks failed/);
  const moving = await review('testsrc2=s=320x180:r=30:d=3', 'moving');
  assert.equal(moving.technical.passed, true, JSON.stringify(moving.technical.checks));
  assert.equal(moving.temporalActivity.passed, true);
  assert.equal((await checkReview({reportPath: moving.reportPath})).quality.temporalActivityVerified, true);
  assert.equal((await approveReview({...judgment, reportPath: moving.reportPath})).passed, true);
  const original = await readFile(moving.reportPath, 'utf8');
  const missing = JSON.parse(original); delete missing.temporalActivity;
  await writeFile(moving.reportPath, JSON.stringify(missing));
  assert.equal((await checkReview({reportPath: moving.reportPath})).status, 'technical_failed');
  await assert.rejects(approveReview({...judgment, reportPath: moving.reportPath}), /technical checks failed/);
  await writeFile(moving.reportPath, original);
  await writeFile(moving.temporalActivity.report.evidence.logPath, 'Changed raw measurement log');
  const staleEvidence = await checkReview({reportPath: moving.reportPath});
  assert.equal(staleEvidence.passed, false);
  assert.equal(staleEvidence.status, 'technical_failed');
  assert.ok(staleEvidence.reasons.some(reason => reason.includes('evidence hash changed')));
  await assert.rejects(approveReview({...judgment, reportPath: moving.reportPath}), /technical checks failed/);
});
