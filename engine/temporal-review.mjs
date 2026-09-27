import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const exec = promisify(execFile);
const modulePath = fileURLToPath(import.meta.url);
const digest = value => createHash('sha256').update(value).digest('hex');
const finite = value => typeof value === 'number' && Number.isFinite(value);
const ratio = value => { const [a, b = 1] = String(value ?? '').split('/').map(Number); return a / b; };
export const TEMPORAL_POLICY = Object.freeze({schemaVersion: 1, width: 480, noise: '-55dB', method: 'ffmpeg-freezedetect-all-frames'});

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

export const temporalProjectHash = project => digest(canonical(project));
async function sha256File(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
async function writeJSON(path, value) {
  await mkdir(dirname(path), {recursive: true});
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n');
  await rename(temporary, path);
}

export function temporalPolicy(project) {
  const maxStaticSeconds = project?.quality?.maxStaticSeconds;
  if (maxStaticSeconds === undefined) return null;
  if (!finite(maxStaticSeconds) || maxStaticSeconds <= 0) throw new Error('quality.maxStaticSeconds must be a finite positive number');
  if (!finite(project.duration) || project.duration <= 0) throw new Error('Temporal review requires a positive project.duration');
  const ids = new Set();
  for (const section of project.sections ?? []) {
    if (!section?.id || ids.has(section.id) || !finite(section.start) || !finite(section.end) || section.start < 0 || section.end <= section.start || section.end > project.duration + 1e-6) throw new Error('Temporal review requires unique section IDs and valid absolute section times');
    ids.add(section.id);
  }
  return {...TEMPORAL_POLICY, maxStaticSeconds};
}

/** FFmpeg does not emit freeze_end when the frozen run reaches EOF. */
export function parseFreezeLog(log, duration) {
  if (!finite(duration) || duration <= 0) throw new Error('A positive video duration is required to close EOF freezes');
  const intervals = [];
  let start = null;
  const bound = raw => {
    const value = Number(raw);
    if (!finite(value) || value < -1e-6 || value > duration + 0.001) throw new Error(`Invalid freeze timestamp: ${raw}`);
    return Math.max(0, Math.min(duration, value));
  };
  for (const match of String(log).matchAll(/lavfi\.freezedetect\.freeze_(start|end):\s*([^\s]+)/g)) {
    const time = bound(match[2]);
    if (match[1] === 'start') {
      if (start !== null) throw new Error('Overlapping freeze_start records');
      if (intervals.length && time < intervals.at(-1).end - 1e-6) throw new Error('Out-of-order freeze interval');
      start = time;
    } else {
      if (start === null || time < start) throw new Error('Unpaired or reversed freeze_end record');
      intervals.push({start, end: time, duration: time - start, endedAtEof: false});
      start = null;
    }
  }
  if (start !== null) intervals.push({start, end: duration, duration: duration - start, endedAtEof: true});
  return intervals;
}

export function mapStaticIntervals(intervals, sections = [], maxStaticSeconds, {fps} = {}) {
  return intervals.map(interval => {
    // Container timestamps may differ a few milliseconds from the manifest's frame grid.
    // Snap mapping only; keep measured duration and the budget decision untouched.
    const mapping = finite(fps) && fps > 0 ? {start: Math.round(interval.start * fps) / fps, end: Math.round(interval.end * fps) / fps, fps} : {start: interval.start, end: interval.end};
    const overlaps = sections.map(section => ({id: section.id, start: Math.max(mapping.start, section.start), end: Math.min(mapping.end, section.end), overlapSeconds: Math.min(mapping.end, section.end) - Math.max(mapping.start, section.start)})).filter(section => section.overlapSeconds > 1e-6);
    return {...interval, exceedsBudget: interval.duration > maxStaticSeconds + 1e-6, mapping, sectionIds: overlaps.map(section => section.id), sections: overlaps};
  });
}

/** Recheck persisted measurements against the current output, policy and raw evidence. */
export async function validateTemporalReport(report, {videoSha256, project}) {
  const errors = [];
  let policy;
  try { policy = temporalPolicy(project); } catch (error) { return {required: true, passed: false, errors: [error.message]}; }
  if (!policy) return {required: false, passed: true, errors: []};
  if (!report || report.schemaVersion !== 1 || report.kind !== 'machine-temporal-review') return {required: true, passed: false, errors: ['Temporal measurement is missing or has an unsupported schema']};
  if (report.status !== 'passed' || report.passed !== true) errors.push('Temporal activity measurement did not pass');
  const expectedBinding = {videoSha256, projectObjectHash: temporalProjectHash(project), detectorSourceSha256: await sha256File(modulePath), policySha256: digest(canonical(policy))};
  for (const [key, value] of Object.entries(expectedBinding)) if (report.binding?.[key] !== value) errors.push(`Temporal ${key} binding is stale`);
  if (canonical(report.policy) !== canonical(policy)) errors.push('Temporal detector policy changed');
  const checks = Array.isArray(report.checks) ? report.checks : [];
  for (const id of ['full_project_timebase', 'all_frames_decoded', 'max_static_interval', 'unchanged_during_review']) {
    const matches = checks.filter(check => check?.id === id);
    if (matches.length !== 1 || matches[0].passed !== true || matches[0].measured === undefined || matches[0].threshold === undefined) errors.push(`Temporal ${id} measurement is missing or failed`);
  }
  if (checks.some(check => check?.passed !== true)) errors.push('Temporal report contains failed checks');
  try {
    if (!report.evidence?.logPath || !report.evidence?.progressPath) throw new Error('Raw detector log and decode progress are required');
    const logPath = resolve(dirname(report.reportPath), report.evidence.logPath);
    const progressPath = resolve(dirname(report.reportPath), report.evidence.progressPath);
    if (await sha256File(logPath) !== report.evidence.logSha256 || await sha256File(progressPath) !== report.evidence.progressSha256) throw new Error('Raw temporal evidence hash changed');
    const log = await readFile(logPath, 'utf8');
    const progress = await readFile(progressPath, 'utf8');
    const decodedFrames = Number([...progress.matchAll(/^frame=(\d+)\s*$/gm)].at(-1)?.[1]);
    const duration = report.video?.duration;
    const fps = report.video?.fps;
    if (!finite(fps) || fps <= 0 || !finite(duration) || duration <= 0 || Math.abs(duration - project.duration) > 1 / fps + 0.005 || !finite(report.video.startTime) || Math.abs(report.video.startTime) > 1 / fps) throw new Error('Temporal full-project timebase is invalid');
    if (!(decodedFrames > 0) || decodedFrames !== report.video?.decodedFrames || !/(?:^|\n)progress=end(?:\n|$)/.test(progress) || (report.video.declaredFrameCount && decodedFrames !== report.video.declaredFrameCount)) throw new Error('Complete decoded frame evidence is invalid');
    const intervals = mapStaticIntervals(parseFreezeLog(log, duration), project.sections, policy.maxStaticSeconds, {fps: project.fps});
    if (canonical(intervals) !== canonical(report.intervals)) throw new Error('Temporal intervals do not match the measured detector log');
    if (intervals.some(interval => interval.exceedsBudget)) throw new Error('Measured static interval exceeds the project budget');
  } catch (error) { errors.push(`Cannot verify temporal evidence: ${error.message}`); }
  return {required: true, passed: errors.length === 0, errors};
}

/** Measure near-static intervals in the actual full encoded video. No aesthetic inference. */
export async function reviewTemporalActivity({videoPath, project, outDir}) {
  const policy = temporalPolicy(project);
  const projectSnapshot = JSON.parse(JSON.stringify(project));
  videoPath = resolve(videoPath);
  outDir = resolve(outDir ?? `${videoPath}.temporal-review`);
  await mkdir(outDir, {recursive: true});
  const reportPath = join(outDir, 'temporal-review.json');
  const projectObjectHash = temporalProjectHash(projectSnapshot);
  const videoSha256 = await sha256File(videoPath);
  const moduleSha256 = await sha256File(modulePath);
  const report = {
    schemaVersion: 1, kind: 'machine-temporal-review', createdAt: new Date().toISOString(), reportPath, videoPath,
    status: policy ? 'failed' : 'not_requested', passed: policy ? false : null,
    binding: {videoSha256, projectObjectHash, detectorSourceSha256: moduleSha256, policySha256: digest(canonical(policy))},
    policy, intervals: [], checks: [],
    limitations: ['Measures near-static pixels at 480px width and -55dB tolerance; it does not establish meaningful choreography, semantic motion or artistic quality.', 'Camera movement, animated texture or noise can avoid freeze detection without providing useful word motion. Independent visual review remains necessary.', 'Absolute interval times assume this is the complete project video, not a section-only export.'],
  };
  if (!policy) { await writeJSON(reportPath, report); return report; }
  const check = (id, passed, measured, threshold) => report.checks.push({id, passed: Boolean(passed), measured, threshold});
  const startTime = performance.now();
  try {
    const {stdout: version} = await exec('ffmpeg', ['-version'], {maxBuffer: 1024 * 1024});
    report.ffmpegVersion = version.split('\n')[0];
    const {stdout} = await exec('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', videoPath], {timeout: 60000, maxBuffer: 2 * 1024 * 1024});
    const probe = JSON.parse(stdout);
    const video = probe.streams?.find(stream => stream.codec_type === 'video');
    if (!video) throw new Error('No video stream');
    const duration = Number(video.duration ?? probe.format?.duration);
    const fps = ratio(video.avg_frame_rate);
    if (!(duration > 0) || !Number.isFinite(duration) || !(fps > 0) || !Number.isFinite(fps)) throw new Error('Video duration or frame rate unavailable');
    report.video = {duration, fps, width: video.width, height: video.height, declaredFrameCount: Number(video.nb_frames) || null, startTime: Number(video.start_time ?? 0)};
    check('full_project_timebase', Math.abs(duration - projectSnapshot.duration) <= 1 / fps + 0.005 && Math.abs(report.video.startTime) <= 1 / fps, {videoDuration: duration, projectDuration: projectSnapshot.duration, startTime: report.video.startTime}, {durationToleranceSeconds: 1 / fps + 0.005, startTimeToleranceSeconds: 1 / fps});
    const filter = `scale=${policy.width}:-2,freezedetect=n=${policy.noise}:d=${policy.maxStaticSeconds}`;
    const args = ['-hide_banner', '-nostdin', '-nostats', '-loglevel', 'info', '-xerror', '-progress', 'pipe:1', '-i', videoPath, '-map', '0:v:0', '-an', '-sn', '-dn', '-vf', filter, '-fps_mode', 'passthrough', '-f', 'null', '-'];
    report.command = {executable: 'ffmpeg', args};
    let result;
    try {
      result = await exec('ffmpeg', args, {timeout: 1800000, maxBuffer: 32 * 1024 * 1024});
    } catch (error) {
      await writeFile(join(outDir, 'freezedetect.log'), String(error.stderr ?? error.message));
      throw error;
    }
    const logPath = join(outDir, 'freezedetect.log');
    const progressPath = join(outDir, 'decode-progress.txt');
    await writeFile(logPath, result.stderr);
    await writeFile(progressPath, result.stdout);
    report.evidence = {logPath, logSha256: await sha256File(logPath), progressPath, progressSha256: await sha256File(progressPath)};
    const frames = [...result.stdout.matchAll(/^frame=(\d+)\s*$/gm)];
    const decodedFrames = Number(frames.at(-1)?.[1]);
    report.video.decodedFrames = decodedFrames || 0;
    check('all_frames_decoded', decodedFrames > 0 && /(?:^|\n)progress=end(?:\n|$)/.test(result.stdout) && (!report.video.declaredFrameCount || report.video.declaredFrameCount === decodedFrames), {decodedFrames: decodedFrames || 0, declaredFrameCount: report.video.declaredFrameCount, reachedEof: /(?:^|\n)progress=end(?:\n|$)/.test(result.stdout)}, {reachedEof: true, frameCount: report.video.declaredFrameCount});
    report.intervals = mapStaticIntervals(parseFreezeLog(result.stderr, duration), projectSnapshot.sections, policy.maxStaticSeconds, {fps: projectSnapshot.fps});
    const violations = report.intervals.filter(interval => interval.exceedsBudget);
    report.summary = {intervalCount: report.intervals.length, violationCount: violations.length, longestStaticSeconds: Math.max(0, ...report.intervals.map(interval => interval.duration)), staticSecondsDetected: report.intervals.reduce((sum, interval) => sum + interval.duration, 0), affectedSectionIds: [...new Set(violations.flatMap(interval => interval.sectionIds))]};
    check('max_static_interval', violations.length === 0, {longestStaticSeconds: report.summary.longestStaticSeconds, violations}, {maxStaticSeconds: policy.maxStaticSeconds, noise: policy.noise, width: policy.width});
  } catch (error) {
    report.error = String(error.stderr ?? error.message);
    check('temporal_analysis', false, report.error, 'Complete decoded temporal measurement');
  }
  check('unchanged_during_review', await sha256File(videoPath) === videoSha256 && temporalProjectHash(project) === projectObjectHash && await sha256File(modulePath) === moduleSha256, 'Video, project object and detector source compared before/after review', 'All unchanged');
  report.elapsedSeconds = (performance.now() - startTime) / 1000;
  report.passed = report.checks.every(item => item.passed);
  report.status = report.passed ? 'passed' : 'failed';
  await writeJSON(reportPath, report);
  return report;
}
