import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir, readFile, writeFile, readdir, stat, rename} from 'node:fs/promises';
import {dirname, resolve, relative, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {reviewTemporalActivity, validateTemporalReport} from './temporal-review.mjs';
import {reviewCreativePolicy} from './creative-policy.mjs';

const exec = promisify(execFile);
const defaultRendererDir = dirname(fileURLToPath(import.meta.url));
export const RUBRIC = Object.freeze(['lyricLegibility', 'semanticMotion', 'sync', 'photorealism', 'composition', 'continuity']);
export const VISUAL_RUBRIC = Object.freeze(RUBRIC.filter(category => category !== 'sync'));
export const AUDIO_CHECKS = Object.freeze(['decoded_audio_match', 'audio_offset', 'audio_duration', 'lyric_phrase_match', 'word_sync']);
export const PASS_THRESHOLD = 8;
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const digest = data => createHash('sha256').update(data).digest('hex');
const finite = value => typeof value === 'number' && Number.isFinite(value);
const number = value => Number.isFinite(Number(value)) ? Number(value) : null;
const ratio = value => {
  if (typeof value === 'number') return value;
  const [a, b = 1] = String(value ?? '').split('/').map(Number);
  return a / b;
};
const tool = (name, args) => exec(name, args, {timeout: 600000, maxBuffer: 8 * 1024 * 1024});

export async function sha256File(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

/** Hash only declared inputs and renderer source, never generated review evidence. */
export async function computeRevision(projectPath, {rendererDir = defaultRendererDir} = {}) {
  projectPath = resolve(projectPath);
  rendererDir = resolve(rendererDir);
  const manifest = await json(projectPath);
  const references = new Set();
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (['src', 'file', 'path'].includes(key) && typeof child === 'string') {
        if (/^https?:\/\//.test(child)) throw new Error(`Remote input cannot be revision-bound: ${child}`);
        references.add(resolve(dirname(projectPath), child));
      } else if (child && typeof child === 'object') visit(child);
    }
  };
  visit(manifest);
  // Intake sidecars are consumed by alignment/audio review even though their keys are not generic `src` fields.
  for (const key of ['originalLyrics', 'originalTiming', 'originalBeats']) {
    const reference = manifest.intake?.[key];
    if (typeof reference === 'string' && reference) {
      if (/^https?:\/\//.test(reference)) throw new Error(`Remote input cannot be revision-bound: ${reference}`);
      references.add(resolve(dirname(projectPath), reference));
    }
  }
  const projectFiles = [{path: '$manifest', sha256: await sha256File(projectPath)}];
  const assets = [];
  for (const path of [...references].sort()) {
    const record = {path: relative(dirname(projectPath), path), sha256: await sha256File(path), bytes: (await stat(path)).size};
    assets.push(record);
    projectFiles.push(record);
  }
  const rendererFiles = [];
  const walk = async dir => {
    const entries = await readdir(dir, {withFileTypes: true});
    for (const item of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (item.name.startsWith('.') || ['node_modules', 'out', 'cache'].includes(item.name)) continue;
      const path = join(dir, item.name);
      if (item.isDirectory()) await walk(path);
      else if (/\.(?:mjs|cjs|js|json|css|html|glsl|swift|py)$/.test(item.name)) rendererFiles.push({path: relative(rendererDir, path), sha256: await sha256File(path)});
    }
  };
  await walk(rendererDir);
  if (!rendererFiles.length) throw new Error('No renderer source files found for revision binding');
  const projectHash = digest(JSON.stringify(projectFiles));
  const rendererHash = digest(JSON.stringify(rendererFiles));
  return {projectHash, rendererHash, revisionHash: digest(`${projectHash}\n${rendererHash}`), projectFiles, rendererFiles, assets, rendererDir};
}

async function writeJSON(path, value) {
  await mkdir(dirname(path), {recursive: true});
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n');
  await rename(temporary, path);
}

function addSample(map, frame, count, reason) {
  frame = Math.max(0, Math.min(count - 1, Math.round(frame)));
  if (!map.has(frame)) map.set(frame, new Set());
  map.get(frame).add(reason);
}

export function evidenceTimes(project, {fps, frameCount, start = 0}) {
  const map = new Map();
  for (const [frame, name] of [[0, 'first'], [Math.floor(frameCount / 2), 'middle'], [frameCount - 1, 'last']]) addSample(map, frame, frameCount, name);
  const duration = frameCount / fps;
  for (const word of project.words ?? project.timeline?.words ?? []) {
    const local = Number(word.start) - start;
    if (!Number.isFinite(local) || local < 0 || local >= duration) continue;
    for (const delta of [-1, 1, Math.max(2, Math.round(fps * 0.16))]) addSample(map, local * fps + delta, frameCount, `word:${word.id ?? word.text}:${delta}`);
  }
  for (const section of project.sections ?? project.scenes ?? []) {
    const local = Number(section.start) - start;
    if (!Number.isFinite(local) || local <= 0 || local >= duration) continue;
    for (const delta of [-3, -1, 0, 1, 3]) addSample(map, local * fps + delta, frameCount, `section:${section.id}:${delta}`);
  }
  return [...map].sort((a, b) => a[0] - b[0]).map(([frame, reasons]) => ({frame, time: frame / fps, sourceTime: start + frame / fps, reasons: [...reasons]}));
}

async function captureEvidence(videoPath, project, outDir, facts) {
  const framesDir = join(outDir, 'frames');
  await mkdir(framesDir, {recursive: true});
  const samples = evidenceTimes(project, facts);
  // Isolate each generation so old frames cannot leak into a new contact sheet.
  const generation = digest(`${videoPath}:${Date.now()}:${Math.random()}`).slice(0, 12);
  const runDir = join(framesDir, generation);
  await mkdir(runDir, {recursive: true});
  let cursor = 0;
  const capture = async () => {
    while (cursor < samples.length) {
      const index = cursor++;
      const sample = samples[index];
      sample.path = join(runDir, `frame-${String(index).padStart(4, '0')}.png`);
      await tool('ffmpeg', ['-v', 'error', '-y', '-ss', sample.time.toFixed(8), '-i', videoPath, '-map', '0:v:0', '-frames:v', '1', sample.path]);
      if (!(await stat(sample.path)).size) throw new Error(`Empty evidence frame at ${sample.time}`);
    }
  };
  await Promise.all([capture(), capture()]);
  const contactPattern = join(outDir, `contact-${generation}-%02d.jpg`);
  await tool('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', join(runDir, 'frame-%04d.png'), '-vf', 'scale=480:-2,tile=4x6:padding=4:margin=4:color=0x171717', '-fps_mode', 'vfr', '-q:v', '3', contactPattern]);
  const contacts = (await readdir(outDir)).filter(name => name.startsWith(`contact-${generation}-`)).sort().map(name => join(outDir, name));
  const transitions = [];
  const duration = facts.frameCount / facts.fps;
  for (const section of project.sections ?? project.scenes ?? []) {
    const local = Number(section.start) - facts.start;
    if (!Number.isFinite(local) || local <= 0 || local >= duration) continue;
    const index = transitions.length;
    const stripDir = join(outDir, `transition-${generation}-${index}`);
    await mkdir(stripDir, {recursive: true});
    const frames = [];
    for (let offset = -3; offset <= 3; offset++) {
      const frame = Math.max(0, Math.min(facts.frameCount - 1, Math.round(local * facts.fps) + offset));
      const path = join(stripDir, `frame-${offset + 3}.png`);
      await tool('ffmpeg', ['-v', 'error', '-y', '-ss', (frame / facts.fps).toFixed(8), '-i', videoPath, '-map', '0:v:0', '-frames:v', '1', '-vf', 'scale=480:-2', path]);
      frames.push({frame, time: frame / facts.fps});
    }
    const path = join(outDir, `transition-${generation}-${index}.jpg`);
    await tool('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', join(stripDir, 'frame-%d.png'), '-vf', 'tile=7x1:padding=3:margin=3:color=0x171717', '-frames:v', '1', '-q:v', '2', path]);
    transitions.push({sectionId: section.id, sourceTime: section.start, path, frames});
  }
  return {samples, contactSheets: contacts, transitionStrips: transitions};
}

/** Decode and inspect the deliverable itself, then create a pending visual review. */
export async function reviewVideo({videoPath, projectPath, outDir, renderMetadataPath, audioReviewPath, visualReviewPath, rendererDir = defaultRendererDir}) {
  videoPath = resolve(videoPath);
  projectPath = resolve(projectPath);
  outDir = resolve(outDir ?? `${videoPath}.review`);
  await mkdir(outDir, {recursive: true});
  const project = await json(projectPath);
  const revision = await computeRevision(projectPath, {rendererDir});
  const videoSha256 = await sha256File(videoPath);
  const reportPath = join(outDir, 'review.json');
  let metadata = null;
  const metadataPath = resolve(renderMetadataPath ?? `${videoPath}.render.json`);
  try { metadata = await json(metadataPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const checks = [];
  const check = (name, passed, observed, expected = null) => checks.push({name, passed: Boolean(passed), observed, expected});
  let probe = null;
  try {
    const {stdout} = await tool('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', videoPath]);
    probe = JSON.parse(stdout);
    check('probe', true, 'ffprobe completed');
  } catch (error) { check('probe', false, String(error.stderr ?? error.message)); }
  const video = probe?.streams?.find(stream => stream.codec_type === 'video');
  const audio = probe?.streams?.find(stream => stream.codec_type === 'audio');
  const fps = ratio(video?.avg_frame_rate);
  const frameCount = number(video?.nb_read_frames);
  const duration = number(video?.duration ?? probe?.format?.duration);
  const expectedFps = Number(metadata?.fps ?? project.fps);
  const expectedDuration = Number(metadata?.duration ?? project.duration);
  const expectedWidth = Number(metadata?.width ?? project.width);
  const expectedHeight = Number(metadata?.height ?? project.height);
  check('videoStream', Boolean(video), video?.codec_name ?? null);
  check('audioStream', Boolean(audio), audio?.codec_name ?? null);
  check('frameCount', Number.isInteger(frameCount) && frameCount > 0 && frameCount === Math.round(expectedDuration * expectedFps), frameCount, Math.round(expectedDuration * expectedFps));
  check('frameRate', Number.isFinite(fps) && Math.abs(fps - expectedFps) < 0.001, fps || null, expectedFps);
  check('duration', duration > 0 && Math.abs(duration - expectedDuration) <= 1 / expectedFps + 0.005, duration, expectedDuration);
  check('dimensions', video?.width === expectedWidth && video?.height === expectedHeight, [video?.width, video?.height], [expectedWidth, expectedHeight]);
  const audioDuration = number(audio?.duration);
  check('audioDuration', audioDuration > 0 && Math.abs(audioDuration - expectedDuration) <= Math.max(0.1, 2 / expectedFps), audioDuration, expectedDuration);
  try {
    await tool('ffmpeg', ['-v', 'error', '-xerror', '-i', videoPath, '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-']);
    check('safeDecode', true, 'All video and audio packets decoded without errors');
  } catch (error) { check('safeDecode', false, String(error.stderr ?? error.message)); }
  if (metadata) {
    check('renderOutputBinding', metadata.sha256 === videoSha256, metadata.sha256 ?? null, videoSha256);
    check('renderRevisionBinding', metadata.sourceRevision?.revisionHash === revision.revisionHash && metadata.sourceRevisionEnd?.revisionHash === revision.revisionHash, {start: metadata.sourceRevision?.revisionHash, end: metadata.sourceRevisionEnd?.revisionHash}, revision.revisionHash);
  }
  let temporalActivity = {required: false, passed: true, present: false, errors: []};
  if (project.quality?.maxStaticSeconds !== undefined) {
    try {
      const measured = await reviewTemporalActivity({videoPath, project, outDir: join(outDir, 'temporal')});
      temporalActivity = await loadTemporalActivity({project, videoSha256, record: {path: measured.reportPath, sha256: await sha256File(measured.reportPath)}});
    } catch (error) { temporalActivity = {required: true, passed: false, present: false, errors: [error.message]}; }
    check('temporalActivity', temporalActivity.passed, {path: temporalActivity.path ?? null, errors: temporalActivity.errors}, {maxStaticSeconds: project.quality.maxStaticSeconds});
  }
  const start = metadata?.sections?.length ? Math.min(...metadata.sections.map(section => Number(section.startFrame) / expectedFps)) : 0;
  let evidence = {samples: [], contactSheets: [], transitionStrips: []};
  if (video && frameCount > 0 && Number.isFinite(fps) && fps > 0) {
    try {
      evidence = await captureEvidence(videoPath, project, outDir, {fps, frameCount, start: Number.isFinite(start) ? start : 0});
      check('evidenceCapture', true, `${evidence.samples.length} frames, ${evidence.transitionStrips.length} transition strips`);
    } catch (error) { check('evidenceCapture', false, String(error.stderr ?? error.message)); }
  } else check('evidenceCapture', false, 'No decodable video frames');
  const endRevision = await computeRevision(projectPath, {rendererDir});
  const creativeDirection = await reviewCreativePolicy(project, projectPath);
  check('unchangedDuringReview', endRevision.revisionHash === revision.revisionHash && await sha256File(videoPath) === videoSha256, endRevision.revisionHash, revision.revisionHash);
  const report = {
    schemaVersion: 2, createdAt: new Date().toISOString(), reportPath, videoPath, projectPath,
    binding: {videoSha256, projectHash: revision.projectHash, rendererHash: revision.rendererHash, revisionHash: revision.revisionHash},
    revision, technical: {passed: checks.every(item => item.passed), checks, probe}, evidence, temporalActivity, creativeDirection,
    renderProvenance: metadata ? {path: metadataPath, sha256: await sha256File(metadataPath), verified: checks.filter(item => item.name.startsWith('render')).every(item => item.passed)} : {verified: false, note: 'Source hash observed at review; render-time provenance was not supplied'},
    suppliedMetrics: metadata ? {performance: metadata.sections ?? null, text: metadata.textMetrics ?? null} : null,
    visual: {status: 'pending', threshold: PASS_THRESHOLD, rubric: VISUAL_RUBRIC, reviews: [], note: 'An independent agent or person judges decoded visual evidence. Audio/sync can be verified by the separate local machine-measurement gate; a human listening score is not required. Machine verification does not establish artistic excellence.'},
    status: checks.every(item => item.passed) ? 'machine_audio_review_required' : 'technical_failed',
  };
  report.machineAudio = await loadMachineAudio({audioReviewPath: audioReviewPath ?? `${videoPath}.audio-review.json`, binding: report.binding, projectPath});
  report.machineVisual = await loadMachineVisual({visualReviewPath: visualReviewPath ?? `${videoPath}.visual-review.json`, binding: report.binding});
  await writeJSON(reportPath, report);
  const state = await checkReview({reportPath});
  report.status = state.status;
  report.quality = state.quality;
  await writeJSON(reportPath, report);
  return report;
}

function reviewErrors(review, binding) {
  const errors = [];
  if (!review || typeof review !== 'object') return ['No visual review recorded'];
  if (typeof review.reviewer !== 'string' || !review.reviewer.trim()) errors.push('A named reviewer is required');
  if (typeof review.notes !== 'string' || review.notes.trim().length < 10) errors.push('Concrete review notes are required (at least 10 characters)');
  if (review.scope !== undefined && !['visual-only', 'full-rubric'].includes(review.scope)) errors.push('Unknown review scope');
  if (!review.scores || typeof review.scores !== 'object') errors.push('Rubric scores are required');
  const rubric = review.scope === 'visual-only' ? VISUAL_RUBRIC : RUBRIC;
  for (const category of rubric) {
    const score = review.scores?.[category];
    if (!finite(score) || score < 0 || score > 10) errors.push(`${category} must be a number from 0 to 10`);
    else if (score < PASS_THRESHOLD) errors.push(`${category} is below ${PASS_THRESHOLD}`);
  }
  for (const key of Object.keys(review.scores ?? {})) if (!rubric.includes(key)) errors.push(`Unknown rubric category: ${key}`);
  if (!review.binding || Object.keys(binding).some(key => review.binding[key] !== binding[key])) errors.push('Visual review is for a different output or source revision');
  return errors;
}

/** Validate measured evidence independently of subjective listening or a numeric sync rating. */
export function validateMachineAudioReport(audio, binding, {audioSha256} = {}) {
  const errors = [];
  if (!audio || typeof audio !== 'object') return {passed: false, errors: ['Machine audio review is missing']};
  if (audio.schemaVersion !== 1 || audio.kind !== 'machine-audio-review') errors.push('Unsupported machine audio report schema');
  if (!['passed', 'failed', 'needs_repair'].includes(audio.status)) errors.push('Invalid machine audio report status');
  for (const key of ['videoSha256', 'projectHash']) if (audio.binding?.[key] !== binding?.[key]) errors.push(`Machine audio ${key} binding is stale`);
  if (!audioSha256 || audio.binding?.audioSha256 !== audioSha256) errors.push('Machine audio source hash is stale or missing');
  if (!Array.isArray(audio.methods) || !audio.methods.length) errors.push('Machine audio methods are missing');
  if (!Array.isArray(audio.limitations)) errors.push('Machine audio limitations must be explicit');
  const suppliedChecks = Array.isArray(audio.checks) ? audio.checks : [];
  const checks = suppliedChecks.filter(check => check && typeof check === 'object' && !Array.isArray(check));
  if (checks.length !== suppliedChecks.length) errors.push('Machine audio measurements must be check objects');
  if (!checks.length) errors.push('Machine audio measurements are missing');
  for (const id of AUDIO_CHECKS) {
    const matches = checks.filter(check => check.id === id);
    if (matches.length !== 1) { errors.push(`Machine audio requires exactly one ${id} check`); continue; }
    const check = matches[0];
    if (typeof check.passed !== 'boolean') errors.push(`Machine audio ${id} result must be boolean`);
    if (check.measured === null || check.measured === undefined || check.threshold === null || check.threshold === undefined) errors.push(`Machine audio ${id} must include its measurement and acceptance threshold`);
    if (check.passed !== true) errors.push(`Machine audio ${id} did not pass`);
  }
  // Additional declared checks may tighten the gate; they cannot hide a failure.
  for (const check of checks) if (!AUDIO_CHECKS.includes(check.id) && check.passed !== true) errors.push(`Machine audio additional check ${check.id ?? '(unnamed)'} did not pass`);
  if (audio.status !== 'passed') errors.push(`Machine audio status is ${audio.status ?? 'missing'}`);
  return {passed: errors.length === 0, errors};
}

async function loadMachineAudio({audioReviewPath, binding, projectPath}) {
  const path = resolve(audioReviewPath);
  let audio;
  try { audio = await json(path); }
  catch (error) {
    return {path, present: error.code !== 'ENOENT', passed: false, errors: [error.code === 'ENOENT' ? 'Machine audio review has not been generated' : `Cannot read machine audio review: ${error.message}`]};
  }
  try {
    const project = await json(projectPath);
    const source = typeof project.audio === 'string' ? project.audio : project.audio?.src;
    if (!source) throw new Error('Project has no declared source audio');
    const audioSha256 = await sha256File(resolve(dirname(projectPath), source));
    const validation = validateMachineAudioReport(audio, binding, {audioSha256});
    return {path, present: true, sha256: await sha256File(path), ...validation, report: audio};
  } catch (error) { return {path, present: true, passed: false, report: audio, errors: [`Cannot verify audio inputs: ${error.message}`]}; }
}

export function validateMachineVisualReport(visual, binding) {
  const errors = [];
  if (!visual || typeof visual !== 'object') return {passed: false, errors: ['Machine visual review is missing']};
  if (visual.schemaVersion !== 1 || visual.kind !== 'machine-visual-review') errors.push('Unsupported machine visual report schema');
  if (visual.method !== 'local-vision-model' || typeof visual.model !== 'string' || !visual.model.trim()) errors.push('Machine visual review must identify the local vision model');
  for (const key of ['videoSha256', 'projectHash']) if (visual.binding?.[key] !== binding?.[key]) errors.push(`Machine visual ${key} binding is stale`);
  for (const category of VISUAL_RUBRIC) {
    const score = visual.scores?.[category];
    if (!finite(score) || score < 0 || score > 10) errors.push(`Machine visual ${category} must be a number from 0 to 10`);
    else if (score < PASS_THRESHOLD) errors.push(`Machine visual ${category} is below ${PASS_THRESHOLD}`);
  }
  for (const key of Object.keys(visual.scores ?? {})) if (!VISUAL_RUBRIC.includes(key)) errors.push(`Unknown machine visual category: ${key}`);
  if (!Array.isArray(visual.issues) || !Array.isArray(visual.limitations)) errors.push('Machine visual issues and limitations must be explicit');
  if (!Array.isArray(visual.evidence) || !visual.evidence.length) errors.push('Machine visual decoded-frame evidence is missing');
  if (visual.status !== 'passed') errors.push(`Machine visual status is ${visual.status ?? 'missing'}`);
  return {passed: errors.length === 0, errors};
}

async function loadMachineVisual({visualReviewPath, binding}) {
  const path = resolve(visualReviewPath);
  let visual;
  try { visual = await json(path); }
  catch (error) {
    return {path, present: error.code !== 'ENOENT', passed: false, errors: [error.code === 'ENOENT' ? 'Machine visual review has not been generated' : `Cannot read machine visual review: ${error.message}`]};
  }
  const validation = validateMachineVisualReport(visual, binding);
  for (const evidence of Array.isArray(visual.evidence) ? visual.evidence : []) {
    try {
      if (!evidence.path || !evidence.sha256) throw new Error('Evidence path and SHA256 are required');
      if (await sha256File(resolve(dirname(path), evidence.path)) !== evidence.sha256) throw new Error('Evidence SHA256 changed');
    } catch (error) { validation.errors.push(`Cannot verify machine visual evidence: ${error.message}`); }
  }
  return {path, present: true, sha256: await sha256File(path), passed: validation.errors.length === 0, errors: validation.errors, report: visual};
}

async function loadTemporalActivity({project, videoSha256, record}) {
  if (project.quality?.maxStaticSeconds === undefined) return {required: false, present: false, passed: true, errors: []};
  try {
    if (!record?.path || !record.sha256) throw new Error('Enabled temporal policy requires a bound temporal measurement; regenerate the review');
    const path = resolve(record.path);
    const sha256 = await sha256File(path);
    if (sha256 !== record.sha256) throw new Error('Temporal review changed; regenerate the review');
    const report = await json(path);
    return {path, sha256, present: true, ...await validateTemporalReport(report, {videoSha256, project}), report};
  } catch (error) { return {path: record?.path ?? null, required: true, present: false, passed: false, errors: [error.message]}; }
}

/** Revalidate the actual output and source hashes on every approval/check. */
export async function checkReview({reportPath, videoPath, projectPath, audioReviewPath, visualReviewPath}) {
  const report = await json(resolve(reportPath));
  const reasons = [];
  let currentBinding = null;
  let currentProject = null;
  try {
    currentProject = await json(projectPath ?? report.projectPath);
    const revision = await computeRevision(projectPath ?? report.projectPath, {rendererDir: report.revision.rendererDir});
    currentBinding = {videoSha256: await sha256File(videoPath ?? report.videoPath), projectHash: revision.projectHash, rendererHash: revision.rendererHash, revisionHash: revision.revisionHash};
    for (const key of Object.keys(currentBinding)) if (currentBinding[key] !== report.binding?.[key]) reasons.push(`Stale ${key}: regenerate evidence for the current output and source`);
  } catch (error) { reasons.push(`Cannot verify current inputs: ${error.message}`); }
  const stale = reasons.length > 0;
  const temporalActivity = currentProject ? await loadTemporalActivity({project: currentProject, videoSha256: currentBinding?.videoSha256, record: report.temporalActivity}) : {required: false, passed: false, errors: ['Cannot verify temporal project inputs']};
  if (!temporalActivity.passed) reasons.push(...temporalActivity.errors);
  const creativeDirection = currentProject ? await reviewCreativePolicy(currentProject, projectPath ?? report.projectPath) : {required: false, passed: false, issues: ['Cannot verify creative policy inputs']};
  if (!creativeDirection.passed) reasons.push(...creativeDirection.issues);
  const technicalPassed = Boolean(report.technical?.passed && report.technical.checks?.length && report.technical.checks.every(item => item.passed === true) && temporalActivity.passed);
  if (!technicalPassed) reasons.push('Technical checks did not all pass');
  const latest = report.visual?.reviews?.at(-1) ?? report.visual?.visualOnlyReview;
  const visualErrors = latest ? reviewErrors(latest, report.binding ?? {}) : [];
  const visualPassed = Boolean(latest && !visualErrors.length);
  reasons.push(...visualErrors);
  const machineAudio = await loadMachineAudio({audioReviewPath: audioReviewPath ?? report.machineAudio?.path ?? `${videoPath ?? report.videoPath}.audio-review.json`, binding: currentBinding ?? report.binding, projectPath: projectPath ?? report.projectPath});
  if (report.machineAudio?.sha256 && !audioReviewPath && report.machineAudio.sha256 !== machineAudio.sha256) {
    machineAudio.passed = false;
    machineAudio.errors.push('Machine audio evidence changed; attach the new report explicitly');
  }
  const machineVisual = await loadMachineVisual({visualReviewPath: visualReviewPath ?? report.machineVisual?.path ?? `${videoPath ?? report.videoPath}.visual-review.json`, binding: currentBinding ?? report.binding});
  if (report.machineVisual?.sha256 && !visualReviewPath && report.machineVisual.sha256 !== machineVisual.sha256) {
    machineVisual.passed = false;
    machineVisual.errors.push('Machine visual evidence changed; attach the new report explicitly');
  }
  const legacySubjectiveSync = Boolean(visualPassed && latest.scope !== 'visual-only');
  // Existing measured failures always block. A legacy score cannot override them.
  const audioPassed = machineAudio.passed || (!machineAudio.present && legacySubjectiveSync);
  if (!audioPassed) reasons.push(...machineAudio.errors);
  const visualGate = visualPassed || machineVisual.passed;
  if (!visualGate) reasons.push(...machineVisual.errors);
  const passed = !stale && technicalPassed && audioPassed && visualGate && !visualErrors.length && creativeDirection.passed;
  const status = stale ? 'stale' : !technicalPassed ? 'technical_failed' : !creativeDirection.passed ? 'creative_policy_failed' : visualErrors.length ? 'review_failed' : !audioPassed ? machineAudio.present ? 'machine_audio_review_failed' : 'machine_audio_review_required' : !visualGate ? machineVisual.present ? 'machine_visual_review_failed' : 'machine_visual_review_required' : visualPassed ? 'independently_reviewed' : 'machine_verified';
  const quality = {technicalVerified: !stale && technicalPassed, temporalActivityVerified: !stale && temporalActivity.required && temporalActivity.passed, machineAudioVerified: !stale && machineAudio.passed, machineVisualVerified: !stale && machineVisual.passed, independentVisualReviewed: !stale && visualPassed, machineQualityVerified: !stale && technicalPassed && machineAudio.passed && machineVisual.passed, syncBasis: machineAudio.passed ? 'measured_local_audio_review' : legacySubjectiveSync ? 'recorded_reviewer_judgment' : 'unverified', aestheticJudgment: visualPassed ? 'independent_review_passed' : latest ? 'changes_requested' : machineVisual.passed ? 'local_vision_model_passed' : 'not_claimed'};
  quality.creativePolicyVerified = !stale && creativeDirection.required && creativeDirection.passed;
  quality.machineQualityVerified &&= creativeDirection.passed;
  return {passed, status, reasons, quality, machineAudio, machineVisual, temporalActivity, creativeDirection, currentBinding, reportPath: resolve(reportPath), report};
}

/** Attach a newly generated, hash-bound machine audio report; failed evidence is retained for repair. */
export async function attachMachineAudioReview({reportPath, audioReviewPath}) {
  reportPath = resolve(reportPath);
  const state = await checkReview({reportPath, audioReviewPath});
  if (state.status === 'stale') throw new Error(state.reasons.join('; '));
  state.report.machineAudio = state.machineAudio;
  state.report.status = state.status;
  state.report.quality = state.quality;
  await writeJSON(reportPath, state.report);
  return checkReview({reportPath});
}

export async function attachMachineVisualReview({reportPath, visualReviewPath}) {
  reportPath = resolve(reportPath);
  const state = await checkReview({reportPath, visualReviewPath});
  if (state.status === 'stale') throw new Error(state.reasons.join('; '));
  state.report.machineVisual = state.machineVisual;
  state.report.status = state.status;
  state.report.quality = state.quality;
  await writeJSON(reportPath, state.report);
  return checkReview({reportPath});
}

/** Record independent agent/person visual judgment without inventing a hearing score. */
export async function recordVisualReview(args) {
  return approveReview({...args, scope: 'visual-only'});
}

/** Record real reviewer judgment. Failed scores are retained to drive the next loop. */
export async function approveReview({reportPath, reviewer, scores, notes, videoPath, projectPath, scope}) {
  reportPath = resolve(reportPath);
  const state = await checkReview({reportPath, videoPath, projectPath});
  if (state.status === 'stale') throw new Error(state.reasons.join('; '));
  if (!state.quality.technicalVerified) throw new Error('Cannot approve a video whose technical checks failed');
  const resolvedScope = scope ?? (Object.hasOwn(scores ?? {}, 'sync') ? 'full-rubric' : 'visual-only');
  const review = {scope: resolvedScope, reviewer, scores, notes, binding: {...state.report.binding}, reviewedAt: new Date().toISOString()};
  const errors = reviewErrors(review, state.report.binding);
  const malformed = errors.filter(error => !error.includes('is below'));
  if (malformed.length) throw new Error(malformed.join('; '));
  state.report.visual.reviews.push(review);
  state.report.visual.status = errors.length ? 'changes_requested' : 'approved';
  await writeJSON(reportPath, state.report);
  const result = await checkReview({reportPath, videoPath, projectPath});
  result.report.status = result.status;
  result.report.quality = result.quality;
  await writeJSON(reportPath, result.report);
  return result;
}
