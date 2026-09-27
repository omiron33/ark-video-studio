import { readFile, writeFile, rename, mkdir, stat, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';

const finite = n => typeof n === 'number' && Number.isFinite(n);
const epsilon = 1e-6;
export const resolveSource = (manifestPath, src) => path.resolve(path.dirname(path.resolve(manifestPath)), src);
export const canonical = value => JSON.stringify(sortObject(value));
function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => [k, sortObject(value[k])]));
  return value;
}
export const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : canonical(value)).digest('hex');
export async function fileHash(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
export async function atomicJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(data, null, 2) + '\n');
  await rename(temp, file);
}

export async function validateProject(project, manifestPath, { checkFiles = true } = {}) {
  const errors = [], warnings = [];
  const need = (ok, message) => { if (!ok) errors.push(message); };
  need(project && typeof project === 'object', 'Project must be an object');
  if (!project || typeof project !== 'object') return { valid: false, errors, warnings };
  need(project.version === 1, 'version must be 1');
  need(typeof project.id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(project.id), 'id must be a safe non-empty identifier');
  need(typeof project.title === 'string' && !!project.title.trim(), 'title is required');
  for (const key of ['width', 'height', 'fps', 'duration']) need(finite(project[key]) && project[key] > 0, `${key} must be positive and finite`);
  need(Number.isInteger(project.width) && Number.isInteger(project.height), 'width and height must be integers');
  need(project.audio && typeof project.audio.src === 'string' && project.audio.src.length > 0, 'audio.src is required');
  need(finite(project.audio?.offset ?? 0) && (project.audio?.offset ?? 0) >= 0, 'audio.offset must be a non-negative source-audio offset');
  need(project.assets && !Array.isArray(project.assets) && typeof project.assets === 'object', 'assets must be an object');
  const assets = project.assets && typeof project.assets === 'object' ? project.assets : {};
  for (const [id, asset] of Object.entries(assets)) {
    need(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(id), `Invalid asset id: ${id}`);
    need(asset && ['image', 'font'].includes(asset.type), `Asset ${id}: type must be image or font`);
    need(typeof asset?.src === 'string' && asset.src.length > 0, `Asset ${id}: src is required`);
    if (asset?.type === 'font') need(typeof asset.family === 'string' && !!asset.family.trim(), `Font ${id}: family is required`);
  }
  const unique = (items, label) => {
    const ids = new Set();
    for (const item of items) {
      need(item && typeof item.id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(item.id), `${label} has an invalid id`);
      need(!ids.has(item?.id), `${label} duplicate id: ${item?.id}`); ids.add(item?.id);
    }
    return ids;
  };
  need(Array.isArray(project.words), 'words must be an array');
  const words = Array.isArray(project.words) ? project.words : [];
  const wordIds = unique(words, 'Word');
  for (const w of words) {
    need(typeof w?.text === 'string' && !!w.text.trim(), `Word ${w?.id}: text is required`);
    need(finite(w?.start) && finite(w?.end) && w.start >= 0 && w.end > w.start && w.end <= project.duration + epsilon, `Word ${w?.id}: invalid time interval`);
    if (w?.confidence === false || w?.confidence === 'interpolated' || (finite(w?.confidence) && w.confidence < 0.5)) warnings.push(`Word ${w.id}: low-confidence/interpolated timing`);
  }
  need(Array.isArray(project.beats), 'beats must be an array');
  const beats = Array.isArray(project.beats) ? project.beats : [];
  for (const [i, beat] of beats.entries()) {
    need(finite(beat?.time) && beat.time >= 0 && beat.time <= project.duration + epsilon, `Beat ${i}: time outside project`);
    need(finite(beat?.strength) && beat.strength >= 0, `Beat ${i}: strength must be non-negative`);
    need(typeof beat?.kind === 'string', `Beat ${i}: kind is required`);
  }
  need(Array.isArray(project.sections) && project.sections.length > 0, 'At least one section is required');
  const sections = Array.isArray(project.sections) ? project.sections : [];
  const visualUrl = new URL('./visual.mjs', import.meta.url);
  visualUrl.searchParams.set('revision', await fileHash(visualUrl));
  const { STYLE_CATALOG } = await import(visualUrl.href);
  unique(sections, 'Section');
  let end = 0;
  for (const s of sections) {
    need(finite(s?.start) && finite(s?.end) && s.end > s.start, `Section ${s?.id}: invalid time interval`);
    need(Math.abs((s?.start ?? NaN) - end) <= epsilon, `Section ${s?.id}: coverage gap, overlap, or wrong order at ${end}`);
    need(typeof s?.style === 'string' && !!s.style, `Section ${s?.id}: style is required`);
    need(Object.hasOwn(STYLE_CATALOG, s?.style ?? ''), `Section ${s?.id}: unknown visual style ${s?.style}`);
    need(s?.direction && typeof s.direction === 'object' && !Array.isArray(s.direction), `Section ${s?.id}: direction must be an object`);
    need(Number.isInteger(s?.seed), `Section ${s?.id}: seed must be an integer`);
    need(Array.isArray(s?.wordIds), `Section ${s?.id}: wordIds must be an array`);
    need(Array.isArray(s?.assetIds), `Section ${s?.id}: assetIds must be an array`);
    for (const id of s?.wordIds ?? []) need(wordIds.has(id), `Section ${s.id}: unknown word ${id}`);
    for (const id of s?.assetIds ?? []) need(Object.hasOwn(assets, id), `Section ${s.id}: unknown asset ${id}`);
    if (s?.direction?.photo) need(s.assetIds?.includes(s.direction.photo), `Section ${s.id}: direction.photo must be declared in assetIds`);
    for (const role of Object.values(s?.direction?.roles ?? {})) for (const id of (Array.isArray(role) ? role : [role])) need(s.wordIds?.includes(id), `Section ${s.id}: role word ${id} must be declared in wordIds`);
    end = s?.end;
  }
  if (sections.length) need(Math.abs(end - project.duration) <= epsilon, `Section coverage ends at ${end}, expected ${project.duration}`);
  if (checkFiles) {
    const sources = [['audio', project.audio?.src], ...Object.entries(assets).map(([id, a]) => [`asset ${id}`, a?.src])];
    for (const [label, src] of sources) if (typeof src === 'string' && src) {
      try { need((await stat(resolveSource(manifestPath, src))).isFile(), `${label}: source is not a file`); }
      catch { errors.push(`${label}: source does not exist: ${resolveSource(manifestPath, src)}`); }
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}
export async function loadProject(manifestPath, options = {}) {
  const absolutePath = path.resolve(manifestPath);
  const project = JSON.parse(await readFile(absolutePath, 'utf8'));
  const validation = await validateProject(project, absolutePath, options);
  if (!validation.valid) throw new Error(`Invalid project:\n${validation.errors.join('\n')}`);
  return { project, manifestPath: absolutePath, validation };
}
export function frameSpans(project) {
  const total = Math.ceil(project.duration * project.fps - 1e-8);
  return project.sections.map((s, i) => {
    const start = Math.round(s.start * project.fps);
    const end = i === project.sections.length - 1 ? total : Math.round(project.sections[i + 1].start * project.fps);
    if (end <= start) throw new Error(`Section ${s.id} is shorter than one output frame`);
    return { id: s.id, start, end, frames: end - start };
  });
}
export function inspectProject(project, validation = {}) {
  return { id: project.id, title: project.title, duration: project.duration, width: project.width, height: project.height, fps: project.fps, frames: Math.ceil(project.duration * project.fps - 1e-8), words: project.words.length, beats: project.beats.length, assets: Object.keys(project.assets).length, sections: project.sections.map((s, i) => ({ id: s.id, start: s.start, end: s.end, style: s.style, ...frameSpans(project)[i], wordCount: wordsForSection(project, s).length })), warnings: validation.warnings ?? [] };
}
export function wordsForSection(project, section) {
  const ids = new Set(section.wordIds);
  return project.words.filter(w => ids.has(w.id) || (w.start < section.end && w.end > section.start));
}
function merge(base, patch) {
  const result = structuredClone(base);
  for (const [key, value] of Object.entries(patch)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Unsafe patch key');
    result[key] = value && typeof value === 'object' && !Array.isArray(value) && base?.[key] && typeof base[key] === 'object' && !Array.isArray(base[key]) ? merge(base[key], value) : structuredClone(value);
  }
  return result;
}
export async function editSection(manifestPath, sectionId, patch, { replace = false, retime = false } = {}) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Section edit must be a JSON object');
  const { project, manifestPath: manifest } = await loadProject(manifestPath);
  const beforeHash = digest(project);
  const index = project.sections.findIndex(s => s.id === sectionId);
  if (index < 0) throw new Error(`Unknown section: ${sectionId}`);
  const old = project.sections[index];
  if (patch.id !== undefined && patch.id !== old.id) throw new Error('Section id cannot change');
  for (const key of ['start', 'end']) if (!retime && patch[key] !== undefined && patch[key] !== old[key]) throw new Error(`Changing ${key} requires --retime`);
  const next = replace ? { ...structuredClone(patch), id: old.id, start: patch.start ?? old.start, end: patch.end ?? old.end } : merge(old, patch);
  project.sections[index] = next;
  // An explicitly retimed shared edge also moves the touching neighbor edge.
  // Word times remain absolute and unchanged; validation rejects collapsed neighbors.
  if (retime) {
    if (index > 0) project.sections[index - 1].end = next.start;
    if (index < project.sections.length - 1) project.sections[index + 1].start = next.end;
    else project.duration = next.end;
  }
  const validation = await validateProject(project, manifest);
  if (!validation.valid) throw new Error(`Edit rejected:\n${validation.errors.join('\n')}`);
  const current = JSON.parse(await readFile(manifest, 'utf8'));
  if (digest(current) !== beforeHash) throw new Error('Project changed during edit; reload and retry');
  const revisionDir = path.join(path.dirname(manifest), '.revisions');
  await mkdir(revisionDir, { recursive: true });
  const revision = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID().slice(0, 8)}`;
  const backup = path.join(revisionDir, `${path.basename(manifest, '.json')}-${revision}.json`);
  await copyFile(manifest, backup);
  await atomicJson(manifest, project);
  return { project, section: next, revision, backup, changed: digest(project) !== beforeHash };
}
