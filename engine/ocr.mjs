import {mkdir, readFile, stat, rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {sha256File, computeRevision} from './gauntlet.mjs';
import {atomicJson, digest} from './project.mjs';

const exec = promisify(execFile);
const sourcePath = fileURLToPath(new URL('./ocr.swift', import.meta.url));
const defaultToolsDir = fileURLToPath(new URL('../output/.tools/', import.meta.url));
const normalize = value => String(value).normalize('NFKD').replace(/\p{M}/gu, '').toUpperCase().replace(/[^\p{L}\p{N}]/gu, '');
const command = (name, args, timeout = 180000) => exec(name, args, {timeout, maxBuffer: 32 * 1024 * 1024});
let compilation;

export async function ensureOCR({toolsDir = defaultToolsDir} = {}) {
  if (process.platform !== 'darwin') throw new Error('Native lyric OCR requires macOS Apple Vision');
  const sourceHash = await sha256File(sourcePath);
  const binary = path.resolve(toolsDir, `ark-ocr-${sourceHash.slice(0, 20)}`);
  try { if ((await stat(binary)).isFile()) return {binary, sourceHash}; } catch {}
  if (!compilation) compilation = (async () => {
    await mkdir(toolsDir, {recursive: true});
    const temporary = `${binary}.${process.pid}.tmp`;
    await command('swiftc', ['-O', sourcePath, '-o', temporary, '-framework', 'Vision', '-framework', 'ImageIO'], 180000);
    await rename(temporary, binary);
  })().finally(() => { compilation = null; });
  await compilation;
  return {binary, sourceHash};
}

/** No lyric dictionary is supplied to the recognizer: these are observations of pixels. */
export async function recognizeFrames({paths, outDir, orientations = [1], toolsDir}) {
  const {binary, sourceHash} = await ensureOCR({toolsDir});
  await mkdir(outDir, {recursive: true});
  const requestPath = path.join(outDir, `ocr-input-${digest({paths, orientations}).slice(0, 12)}.json`);
  await atomicJson(requestPath, {images: paths.map(p => path.resolve(p)), orientations});
  const {stdout} = await command(binary, [requestPath]);
  const result = JSON.parse(stdout);
  if (!Array.isArray(result.frames) || result.frames.length !== paths.length * orientations.length) throw new Error('Native OCR returned incomplete frame evidence');
  return {...result, sourceHash};
}

export function visibilityWindows(project) {
  return project.words.map(word => {
    const section = project.sections.find(s => s.wordIds.includes(word.id));
    const start = Math.max(0, word.start, section?.start ?? 0);
    // A modest post-syllable hold allows entry easing, but never forces lyrics to survive a deliberate exit.
    const intentionalExit = Math.min(section?.end ?? project.duration, section?.direction?.portalAt ?? Infinity, section?.direction?.submergeAt ?? Infinity);
    const end = Math.max(start, Math.min(project.duration - 1/project.fps, word.end + 0.35, intentionalExit - 1/project.fps));
    const span = end - start;
    const times = [...new Set([start + Math.min(.18, span*.45), (Math.max(start, Math.min(word.end, end)) + start)/2, Math.min(end, word.end-.03), end].map(t => Math.max(start, Math.min(end, Math.floor(t*project.fps)/project.fps)).toFixed(6)))].map(Number);
    return {id: word.id, text: word.text, sectionId: section?.id, style: section?.style, start, end, times, required: true};
  });
}

function observationsFor(word, evidence) {
  const expected = normalize(word.text), observations = [];
  for (const frame of evidence) {
    if (frame.time + .001 < word.start || frame.time > word.end + .001) continue;
    for (const result of frame.recognition ?? []) for (const line of result.lines) {
      const glyphHeight = line.box.height * result.height;
      if (line.confidence < .3 || glyphHeight < Math.min(result.width, result.height)*.027) continue;
      const tokens = line.text.split(/\s+/).map(normalize).filter(Boolean);
      const joinedSpacedLetters = tokens.length > 1 && tokens.every(t => t.length === 1) ? tokens.join('') : null;
      if (tokens.includes(expected) || normalize(line.text) === expected || joinedSpacedLetters === expected) observations.push({time: frame.time, path: frame.path, sha256: frame.sha256, text: line.text, confidence: line.confidence, box: line.box, coordinateSpace: 'normalized-top-left-oriented-image', orientation: result.orientation, imageWidth: result.width, imageHeight: result.height, method: joinedSpacedLetters === expected ? 'recognized-spaced-letters' : 'recognized-word'});
    }
  }
  return observations;
}

export async function reviewLyricVisibility({projectPath, videoPath, outDir, evidence: suppliedEvidence}) {
  projectPath = path.resolve(projectPath); videoPath = path.resolve(videoPath); outDir = path.resolve(outDir);
  await mkdir(outDir, {recursive: true});
  const manifestBytes = await readFile(projectPath);
  const project = JSON.parse(manifestBytes.toString('utf8'));
  const revision = await computeRevision(projectPath), videoSha256 = await sha256File(videoPath);
  if (digest(manifestBytes) !== revision.projectFiles.find(f => f.path === '$manifest')?.sha256) throw new Error('Project changed before OCR began; retry against stable inputs');
  const binding = {videoSha256, projectHash: revision.projectHash};
  const reportPath = path.join(outDir, 'lyric-visibility.json');
  const report = {schemaVersion: 1, kind: 'machine-lyric-visibility', binding, status: 'failed', method: 'Apple Vision native accurate OCR', projectPath, videoPath, wordCoverage: [], evidence: [], checks: [], limitations: ['OCR proves sampled word recognition, not perfect legibility or aesthetic quality.', 'OCR may miss arced, heavily stylized or occluded letters; an unresolved word is reported, never silently counted as visible.', 'Only top recognizer candidates are used, without lyric dictionary hints or language correction.', 'English recognition is configured for this Bible-song workflow.', 'Bounding boxes use each oriented image coordinate space.'], createdAt: new Date().toISOString(), reportPath};
  try {
    const windows = visibilityWindows(project), framesDir = path.join(outDir, 'frames');
    await mkdir(framesDir, {recursive: true});
    const supplemental = Array.isArray(suppliedEvidence) ? suppliedEvidence : suppliedEvidence?.frames ?? suppliedEvidence?.samples ?? [];
    const extraTimes = supplemental.map(frame => frame.time).filter(time => Number.isFinite(time) && time >= 0 && time <= project.duration - 1/project.fps);
    const times = [...new Set([...windows.flatMap(w => w.times), ...extraTimes])].sort((a,b) => a-b);
    // Supplementary director timestamps are re-decoded; supplied files/text cannot manufacture recognition.
    for (const time of times) {
      const file = path.join(framesDir, `frame-${Math.round(time*project.fps).toString().padStart(7,'0')}.png`);
      // A decimal rounded a fraction past the last frame can seek beyond EOF; floor the seek while retaining the requested frame time.
      const seekTime = Math.floor(time*1000)/1000;
      await command('ffmpeg', ['-v','error','-y','-ss',String(seekTime),'-i',videoPath,'-map','0:v:0','-frames:v','1',file]);
      report.evidence.push({time, seekTime, path: file, sha256: await sha256File(file), recognition: []});
    }
    const primary = await recognizeFrames({paths: report.evidence.map(f => f.path), outDir});
    report.recognizerSourceHash = primary.sourceHash;
    for (const frame of report.evidence) frame.recognition = primary.frames.filter(result => result.path === frame.path);
    // Retry only windows with unresolved lyrics, in rotated orientations. This catches semantic vertical words.
    const missing = windows.filter(w => !observationsFor(w, report.evidence).length);
    const retryFrames = report.evidence.filter(frame => missing.some(w => frame.time >= w.start && frame.time <= w.end));
    if (retryFrames.length) {
      const rotated = await recognizeFrames({paths: retryFrames.map(f => f.path), orientations: [6,8,3], outDir});
      for (const frame of retryFrames) frame.recognition.push(...rotated.frames.filter(result => result.path === frame.path));
    }
    report.wordCoverage = windows.map(w => {
      const observations = observationsFor(w, report.evidence);
      return {...w, observed: observations.length > 0, observations, reason: observations.length ? 'Recognized in actual encoded frames during the lyric visibility window' : `No confident full-word OCR match in its window${['terrain','orbit'].includes(w.style) ? '; curved/spatial typography may require a targeted visual repair or more legible pose' : ''}`};
    });
    const errors = report.evidence.flatMap(f => f.recognition.filter(r => r.error).map(r => ({time:f.time,error:r.error})));
    const matched = report.wordCoverage.filter(w => w.observed).length;
    report.coverage = {required: windows.length, observed: matched, ratio: windows.length ? matched/windows.length : 0, unresolved: report.wordCoverage.filter(w => !w.observed).map(w => w.id)};
    report.checks.push({id:'native_ocr_available',passed:!errors.length,errors}, {id:'required_lyrics_visible',passed:windows.length > 0 && matched === windows.length,measured:report.coverage,threshold:{requiredRatio:1}});
    const endRevision = await computeRevision(projectPath);
    report.checks.push({id:'unchanged_inputs',passed:endRevision.projectHash===binding.projectHash && await sha256File(videoPath)===binding.videoSha256});
    report.status = report.checks.every(c=>c.passed) ? 'passed' : 'failed';
  } catch(error) {
    report.checks.push({id:'ocr_execution',passed:false,error:error.message});
    report.error = error.message;
  }
  await atomicJson(reportPath, report);
  return report;
}
