import { readFile, readdir, mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { digest, fileHash, resolveSource, wordsForSection, atomicJson } from './project.mjs';

export const CACHE_VERSION = 1;
export async function rendererHash(engineDir = path.dirname(fileURLToPath(import.meta.url))) {
  const names = (await readdir(engineDir)).filter(n => /\.(mjs|js|css)$/.test(n)).sort();
  const files = await Promise.all(names.map(async name => [name, await fileHash(path.join(engineDir, name))]));
  const lock = path.resolve(engineDir, '..', 'package-lock.json');
  try { files.push(['package-lock.json', await fileHash(lock)]); } catch { /* tests can use a temporary isolated renderer */ }
  return digest(files);
}
export function outputProfile(project, scale = 1) {
  scale = Number(scale);
  if (!Number.isFinite(scale) || scale <= 0 || scale > 2) throw new Error('scale must be greater than 0 and no more than 2');
  const even = n => Math.max(2, Math.round(n / 2) * 2);
  return { width: even(project.width * scale), height: even(project.height * scale), fps: project.fps, codec: 'libx264', pixelFormat: 'yuv420p', crf: 20, preset: 'veryfast', scale };
}
export async function assetHashes(project, manifestPath) {
  return Object.fromEntries(await Promise.all(Object.entries(project.assets).map(async ([id, a]) => [id, { ...a, sha256: await fileHash(resolveSource(manifestPath, a.src)) }])));
}
export function sectionCacheKey(project, section, span, { profile, codeHash, assets, layer = 'all' }) {
  const index = project.sections.findIndex(s => s.id === section.id);
  const next = project.sections[index + 1];
  const consumesNext = next && (Number.isFinite(section.direction?.portalAt) || Boolean(section.direction?.transition));
  const referenced = new Set(section.assetIds);
  if (consumesNext) for (const id of next.assetIds) referenced.add(id);
  const sources = Object.fromEntries(Object.entries(assets).filter(([id, a]) => referenced.has(id) || a.type === 'font').map(([id, a]) => [id, { type: a.type, family: a.family, sha256: a.sha256 }]));
  const beatWindow = project.beats.filter(b => b.time >= section.start - 2 && b.time <= (consumesNext ? next.end : section.end) + 2);
  // A portal samples the next complete scene, including its directed image and words.
  // Ordinary cuts have no neighbor dependency: an unrelated section edit stays local.
  const nextStart = consumesNext ? Math.round(next.start * project.fps) / project.fps : 0;
  const nextEnd = consumesNext ? (index + 1 === project.sections.length - 1 ? Math.ceil(project.duration * project.fps - 1e-8) / project.fps : Math.round(project.sections[index + 2].start * project.fps) / project.fps) : 0;
  const transitionDependency = consumesNext ? { section: next, words: wordsForSection(project, { ...next, start: Math.min(next.start, nextStart), end: Math.max(next.end, nextEnd) }) } : null;
  const effective = { ...section, start: Math.min(section.start, span.start / project.fps), end: Math.max(section.end, span.end / project.fps) };
  return digest({ cacheVersion: CACHE_VERSION, codeHash, layer, profile, project: { id: project.id, title: project.title, duration: project.duration, width: project.width, height: project.height, fps: project.fps, palette: project.palette }, section, span, words: wordsForSection(project, effective), beats: beatWindow, assets: sources, transitionDependency });
}
export function cachePaths(cacheDir, sectionId, key) {
  const dir = path.resolve(cacheDir, sectionId, key);
  return { dir, video: path.join(dir, 'video.mp4'), metadata: path.join(dir, 'metadata.json') };
}
export async function cachedChunk(cacheDir, sectionId, key, verify) {
  const files = cachePaths(cacheDir, sectionId, key);
  try {
    const metadata = JSON.parse(await readFile(files.metadata, 'utf8'));
    if (metadata.key !== key || metadata.sha256 !== await fileHash(files.video)) return null;
    if (verify && !await verify(files.video, metadata)) return null;
    return { ...files, metadata, cacheHit: true };
  } catch { return null; }
}
export async function publishChunk(cacheDir, sectionId, key, build) {
  const files = cachePaths(cacheDir, sectionId, key);
  await mkdir(files.dir, { recursive: true });
  const temp = path.join(files.dir, `${randomUUID()}.partial.mp4`);
  try {
    const metadata = await build(temp);
    const sha256 = await fileHash(temp);
    await rename(temp, files.video);
    await atomicJson(files.metadata, { ...metadata, key, sha256, completedAt: new Date().toISOString() });
    return { ...files, metadata: { ...metadata, key, sha256 }, cacheHit: false };
  } catch (error) { await rm(temp, { force: true }); throw error; }
}
