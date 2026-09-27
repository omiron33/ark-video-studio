import { constants } from 'node:fs';
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicJson, digest, fileHash, validateProject } from './project.mjs';

const run = promisify(execFile);
const finite = n => typeof n === 'number' && Number.isFinite(n);
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value);
const stableId = (prefix, value) => `${prefix}_${digest(value).slice(0, 16)}`;
const fail = message => { throw new Error(message); };
const clone = value => structuredClone(value);
const slug = value => String(value).normalize('NFKD').replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/^[^A-Za-z0-9]+|[-.]+$/g, '') || 'song';

/** Inspect the audio stream, not an attached cover image or filename extension. */
export async function probeAudio(file, { ffprobe = 'ffprobe' } = {}) {
  const { stdout } = await run(ffprobe, ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=duration,sample_rate,channels:format=duration', '-of', 'json', path.resolve(file)]);
  const data = JSON.parse(stdout), stream = data.streams?.[0];
  const duration = Number(stream?.duration ?? data.format?.duration);
  if (!stream || !Number.isFinite(duration) || duration <= 0) fail('Input must contain an audio stream with a measurable positive duration');
  return { duration, sampleRate: Number(stream.sample_rate), channels: Number(stream.channels) };
}

function timingEntries(data) {
  if (Array.isArray(data)) return data.map(word => ({ word }));
  if (!data || typeof data !== 'object') fail('Timing must be a word array or JSON object');
  if (Array.isArray(data.words)) {
    const explicit = new Map();
    for (const phrase of data.phrases ?? []) {
      if (!Array.isArray(phrase.wordIds)) fail('Each supplied phrase needs wordIds');
      for (const id of phrase.wordIds) {
        if (explicit.has(id)) fail(`Word ${id} belongs to more than one supplied phrase`);
        explicit.set(id, phrase);
      }
    }
    return data.words.map(word => ({ word, phrase: explicit.get(word.id) ?? (word.phraseId ? { id: word.phraseId } : undefined) }));
  }
  if (Array.isArray(data.sections)) return data.sections.flatMap((section, si) => {
    if (!Array.isArray(section.lines)) fail(`Legacy section ${si} needs a lines array`);
    return section.lines.flatMap((line, li) => {
      if (!Array.isArray(line.words)) fail(`Legacy line ${si}:${li} needs timed words; untimed lyrics cannot be aligned by import`);
      return line.words.map(word => ({ word, phrase: { ...line, id: line.id ?? stableId('p', [section.id ?? section.tag ?? section.name ?? si, line.text, line.words.map(w => [w.text ?? w.word, w.start, w.end])]) }, sourceSection: { id: section.id, name: section.name, tag: section.tag, index: si, lineIndex: li } }));
    });
  });
  // Also accepts local Whisper's segment/word JSON without flattening it by hand.
  if (Array.isArray(data.segments)) return data.segments.flatMap((segment, i) => {
    if (!Array.isArray(segment.words)) fail(`ASR segment ${i} has no word timestamps`);
    return segment.words.map(word => ({ word, phrase: { ...segment, id: stableId('p', [segment.start, segment.end, segment.text]) } }));
  });
  fail('Unrecognized timing format: expected words, sections[].lines[].words, or segments[].words');
}

/** Convert source timestamps to clip timestamps; retain originals and never invent a word time. */
export function normalizeTiming(data, { sourceOffset = 0, duration, timebase } = {}) {
  if (!finite(sourceOffset) || sourceOffset < 0 || !finite(duration) || duration <= 0) fail('Timing normalization requires a non-negative sourceOffset and positive duration');
  const basis = timebase ?? data?.timebase ?? 'source';
  if (!['source', 'clip'].includes(basis)) fail('Timing timebase must be source or clip');
  const entries = timingEntries(data), seen = new Set(), words = [], warnings = [];
  const inputIdMap = new Map();
  let previousStart = -Infinity;
  for (const [index, entry] of entries.entries()) {
    const w = entry.word;
    if (!w || typeof w !== 'object') fail(`Word ${index}: expected an object`);
    const text = w.text ?? w.word;
    if (typeof text !== 'string' || !text.trim()) fail(`Word ${index}: non-empty text is required`);
    if (!finite(w.start) || !finite(w.end) || w.start < 0 || w.end <= w.start) fail(`Word ${index}: invalid time interval; numeric start < end is required`);
    if (w.start < previousStart) fail(`Word ${index}: words must be ordered by start time`);
    previousStart = w.start;
    const sourceStart = w.start + (basis === 'clip' ? sourceOffset : 0), sourceEnd = w.end + (basis === 'clip' ? sourceOffset : 0);
    const id = w.id ?? stableId('w', [text, sourceStart, sourceEnd]);
    if (!safeId(id)) fail(`Word ${index}: invalid durable id ${id}`);
    if (seen.has(id)) fail(`Duplicate word id ${id}; provide distinct ids for simultaneous repeated words`);
    seen.add(id); if (w.id) inputIdMap.set(w.id, id);
    if (sourceEnd <= sourceOffset || sourceStart >= sourceOffset + duration) continue;
    const start = Math.max(0, sourceStart - sourceOffset), end = Math.min(duration, sourceEnd - sourceOffset);
    const interpolated = w.aligned === false || w.interpolated === true || w.confidence === 'interpolated';
    const confidence = w.confidence ?? (interpolated ? 'interpolated' : w.probability ?? 'machine_estimate');
    const phraseId = entry.phrase?.id;
    if (phraseId !== undefined && !safeId(phraseId)) fail(`Invalid phrase id ${phraseId}`);
    const word = { id, text, start, end, confidence, provenance: { ...clone(w.provenance ?? {}), original: clone(w), sourceStart, sourceEnd, inputTimebase: basis, sourceOffset, clampedStart: sourceStart < sourceOffset, clampedEnd: sourceEnd > sourceOffset + duration, interpolated, timingMethod: data?.method ?? data?.source?.method ?? 'supplied-word-timestamps' } };
    if ('aligned' in w) word.aligned = w.aligned;
    if ('listening_verified' in w) word.listening_verified = w.listening_verified;
    if (phraseId) word.phraseId = phraseId;
    if (entry.sourceSection) word.provenance.sourceSection = entry.sourceSection;
    if (entry.phrase) word.provenance.sourcePhrase = { id: phraseId, text: entry.phrase.text, start: entry.phrase.start, end: entry.phrase.end };
    if (interpolated) warnings.push(`Word ${id} (${text}) has interpolated, unverified timing`);
    if (word.provenance.clampedStart || word.provenance.clampedEnd) warnings.push(`Word ${id} crosses the selected clip boundary; its visible interval was clamped`);
    words.push(word);
  }
  for (const phrase of data?.phrases ?? []) for (const id of phrase.wordIds) if (!inputIdMap.has(id)) fail(`Phrase references missing word ${id}`);
  // Supplied phrase groups win. Ungrouped input is split on punctuation, gaps, or eight words.
  const phrases = []; let group = [];
  const flush = () => {
    if (!group.length) return;
    const id = group[0].phraseId ?? stableId('p', group.map(w => w.id));
    if (phrases.some(p => p.id === id)) fail(`Phrase ${id} is not contiguous in word order`);
    const original = group[0].provenance.sourcePhrase;
    group.forEach(w => { w.phraseId = id; });
    phrases.push({ id, text: group.map(w => w.text).join(' '), start: group[0].start, end: Math.max(...group.map(w => w.end)), wordIds: group.map(w => w.id), ...(original ? { source: original } : {}), ...(group[0].provenance.sourceSection ? { sourceSection: group[0].provenance.sourceSection } : {}) });
    group = [];
  };
  for (const word of words) {
    const last = group.at(-1);
    if (last && ((word.phraseId || last.phraseId) ? word.phraseId !== last.phraseId : (word.start - last.end >= 0.65 || /[.!?;:]\s*$/.test(last.text) || group.length >= 8))) flush();
    group.push(word);
  }
  flush();
  if (!words.length) warnings.push('No timed words overlap this clip; lyric timing remains unresolved');
  return { words, phrases, warnings, sourceWordCount: entries.length, timebase: basis };
}

export function normalizeBeats(data, { sourceOffset = 0, duration, timebase } = {}) {
  if (data == null) return [];
  if (!finite(sourceOffset) || sourceOffset < 0 || !finite(duration) || duration <= 0) fail('Beat normalization needs a valid sourceOffset and duration');
  const basis = timebase ?? data.timebase ?? 'source';
  if (!['source', 'clip'].includes(basis)) fail('Beat timebase must be source or clip');
  const rows = Array.isArray(data) ? data : data.beats;
  if (!Array.isArray(rows)) fail('Beat JSON must be an array or contain beats[]');
  return rows.map((row, i) => {
    const input = typeof row === 'number' ? { time: row } : row;
    if (!input || !finite(input.time) || input.time < 0 || (input.strength !== undefined && (!finite(input.strength) || input.strength < 0))) fail(`Beat ${i}: invalid time or strength`);
    const sourceTime = input.time + (basis === 'clip' ? sourceOffset : 0);
    return { time: sourceTime - sourceOffset, strength: input.strength ?? 1, kind: input.kind ?? 'supplied_beat', provenance: { original: clone(row), sourceTime, inputTimebase: basis } };
  }).filter(b => b.time >= 0 && b.time < duration).sort((a, b) => a.time - b.time);
}

/** Every section boundary is a frame boundary; phrases too close to split share a section. */
export function buildSections(phrases, { duration, fps = 30, style = 'verse' } = {}) {
  if (!['verse', 'impact', 'orbit'].includes(style)) fail('Generic imports support verse, impact, or orbit; semantic styles require agent-authored word roles');
  const totalFrames = Math.round(duration * fps);
  if (!Number.isInteger(totalFrames) || totalFrames < 1 || Math.abs(totalFrames / fps - duration) > 1e-6) fail('Project duration must be frame aligned');
  const groups = [];
  for (const phrase of phrases) {
    const startFrame = groups.length ? Math.min(totalFrames - 1, Math.max(0, Math.floor(phrase.start * fps + 1e-8))) : 0;
    if (groups.length && startFrame <= groups.at(-1).startFrame) groups.at(-1).phrases.push(phrase);
    else groups.push({ startFrame, phrases: [phrase] });
  }
  if (!groups.length) groups.push({ startFrame: 0, phrases: [] });
  return groups.map((g, i) => {
    const ids = g.phrases.flatMap(p => p.wordIds);
    const id = g.phrases.length ? `section-${g.phrases[0].id}` : 'unresolved-timing';
    return { id, start: g.startFrame / fps, end: (groups[i + 1]?.startFrame ?? totalFrames) / fps, style, wordIds: ids, assetIds: [], seed: parseInt(digest(id).slice(0, 7), 16), direction: { label: '', phraseIds: g.phrases.map(p => p.id) } };
  });
}

const fontRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/fonts');
const bundledFonts = [
  ['display', 'BebasNeue-Regular.ttf', 'Bebas Neue', 'OFL-bebasneue.txt'],
  ['serif', 'CormorantGaramond.ttf', 'Cormorant Garamond', 'OFL-cormorantgaramond.txt'],
  ['sans', 'ArchivoBlack-Regular.ttf', 'Archivo Black', 'OFL-archivoblack.txt'],
];

/** Create a NEW project directory. Original audio and sidecars are copied, never rewritten. */
export async function importSong(options) {
  const { audio, timing, beats, lyrics, projectDir, sourceOffset = 0, fps = 30, width = 2560, height = 1440, style = 'verse' } = options;
  if (!audio || !projectDir) fail('importSong requires audio and projectDir');
  if (!finite(sourceOffset) || sourceOffset < 0 || !finite(fps) || fps <= 0 || !Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) fail('Invalid source offset, fps, or canvas dimensions');
  const sourceAudio = path.resolve(audio), destination = path.resolve(projectDir);
  const metadata = await probeAudio(sourceAudio, options);
  if (sourceOffset >= metadata.duration) fail('Source offset must be before the end of the audio');
  if (options.duration !== undefined && (!finite(options.duration) || options.duration <= 0)) fail('duration must be positive');
  const requestedDuration = options.duration ?? metadata.duration - sourceOffset;
  const availableDuration = Math.min(requestedDuration, metadata.duration - sourceOffset);
  const duration = Math.floor(availableDuration * fps + 1e-8) / fps;
  if (duration <= 0) fail('Selected audio is shorter than one output frame');
  const warnings = [];
  if (Math.abs(duration - requestedDuration) > 1e-7) warnings.push(`Duration shortened from ${requestedDuration}s to ${duration}s to stay inside source audio and end on a frame`);
  const timingData = timing ? JSON.parse(await readFile(timing, 'utf8')) : undefined;
  const normalized = timingData ? normalizeTiming(timingData, { sourceOffset, duration, timebase: options.timingTimebase }) : { words: [], phrases: [], warnings: ['Timing missing: supply word JSON or run the optional local alignment helper; no times were invented'], sourceWordCount: 0 };
  warnings.push(...normalized.warnings);
  if (timingData?.reason) warnings.push(`Alignment unresolved: ${timingData.reason}`);
  if (Array.isArray(timingData?.warnings)) warnings.push(...timingData.warnings.map(String));
  const beatData = beats ? JSON.parse(await readFile(beats, 'utf8')) : undefined;
  const normalizedBeats = normalizeBeats(beatData, { sourceOffset, duration, timebase: options.beatTimebase });
  if (!normalizedBeats.length) warnings.push('No measured beat events supplied; beat accents are disabled');
  const sourceHash = await fileHash(sourceAudio);
  const extension = /^[.][A-Za-z0-9]{1,8}$/.test(path.extname(audio)) ? path.extname(audio).toLowerCase() : '.audio';
  const audioRelative = `assets/source-${sourceHash.slice(0, 16)}${extension}`;
  const title = options.title ?? timingData?.title ?? path.basename(audio, path.extname(audio));
  const id = options.id ?? slug(path.basename(destination));
  const importedStatus = timingData?.status;
  const status = !normalized.words.length || importedStatus === 'unresolved' ? 'unresolved' : importedStatus === 'needs_lyric_review' ? 'needs_lyric_review' : 'timed_needs_review';
  const project = { version: 1, id, title, width, height, fps, duration, audio: { src: audioRelative, offset: sourceOffset }, source: { title, start: sourceOffset, end: sourceOffset + duration, audioDuration: metadata.duration, audioSha256: sourceHash }, palette: { ink: '#061a20', paper: '#e8e1ce', accent: '#e77951' }, assets: {}, words: normalized.words, phrases: normalized.phrases, beats: normalizedBeats, sections: buildSections(normalized.phrases, { duration, fps, style }), intake: { status, timingVerified: false, sourceWordCount: normalized.sourceWordCount, originalAudio: path.basename(sourceAudio), ...(timing ? { originalTiming: 'sources/timing.json' } : {}), ...(beats ? { originalBeats: 'sources/beats.json' } : {}), ...(lyrics ? { originalLyrics: `sources/lyrics${path.extname(lyrics) || '.txt'}` } : {}), warnings } };
  if (timingData?.status) project.intake.alignmentStatus = timingData.status;
  const manifestPath = path.join(destination, 'project.json');
  const preflight = await validateProject(project, manifestPath, { checkFiles: false });
  if (!preflight.valid) fail(`Import rejected: ${preflight.errors.join('; ')}`);
  // Validate sidecar paths before reserving a new directory.
  for (const file of [timing, beats, lyrics].filter(Boolean)) if (!(await stat(file)).isFile()) fail(`Not a file: ${file}`);
  await mkdir(path.dirname(destination), { recursive: true });
  try { await mkdir(destination); } catch (error) { if (error.code === 'EEXIST') fail(`Project directory already exists; choose a new directory: ${destination}`); throw error; }
  await mkdir(path.join(destination, 'assets'));
  await mkdir(path.join(destination, 'sources'));
  await copyFile(sourceAudio, path.join(destination, audioRelative), constants.COPYFILE_EXCL);
  for (const [source, relative] of [[timing, 'sources/timing.json'], [beats, 'sources/beats.json'], [lyrics, project.intake.originalLyrics]]) if (source) await copyFile(source, path.join(destination, relative), constants.COPYFILE_EXCL);
  for (const [fontId, file, family, license] of bundledFonts) {
    try { await stat(path.join(fontRoot, file)); await stat(path.join(fontRoot, license)); } catch { warnings.push(`Bundled font unavailable: ${family}; render uses system fallback`); continue; }
    await copyFile(path.join(fontRoot, file), path.join(destination, 'assets', file), constants.COPYFILE_EXCL);
    await copyFile(path.join(fontRoot, license), path.join(destination, 'assets', license), constants.COPYFILE_EXCL);
    project.assets[fontId] = { type: 'font', src: `assets/${file}`, family };
  }
  const validation = await validateProject(project, manifestPath);
  if (!validation.valid) fail(`Imported files need attention in ${destination}: ${validation.errors.join('; ')}`);
  await atomicJson(manifestPath, project);
  return { manifestPath, project, validation, status, warnings };
}
