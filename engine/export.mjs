import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { loadProject, frameSpans, resolveSource, fileHash, atomicJson, digest } from './project.mjs';
import { rendererHash, assetHashes, outputProfile, sectionCacheKey, cachedChunk, publishChunk } from './cache.mjs';

export async function runProcess(command, args, { signal } = {}) {
  return await new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], signal });
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr = (stderr + d).slice(-24000); });
    proc.on('error', reject);
    proc.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(`${command} exited ${code}: ${stderr.trim()}`)));
  });
}
export async function probeVideo(file) {
  return JSON.parse(await runProcess('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]));
}
export async function verifyChunk(file, frames, profile) {
  try {
    const probe = await probeVideo(file);
    const video = probe.streams.find(s => s.codec_type === 'video');
    const rate = video?.r_frame_rate?.split('/').map(Number);
    return video?.codec_name === 'h264' && video.width === profile.width && video.height === profile.height && video.pix_fmt === profile.pixelFormat && Number(video.nb_frames) === frames && Math.abs(rate[0] / rate[1] - profile.fps) < 1e-6 && !probe.streams.some(s => s.codec_type === 'audio');
  } catch { return false; }
}
export async function loadAssets(project, manifestPath) {
  const images = {};
  for (const [id, asset] of Object.entries(project.assets)) {
    const source = resolveSource(manifestPath, asset.src);
    if (asset.type === 'font') {
      const registered = GlobalFonts.registerFromPath(source, asset.family);
      if (!registered) throw new Error(`Could not register font ${id}: ${source}`);
    } else if (asset.type === 'image') images[id] = await loadImage(source);
  }
  return images;
}
async function captureRevision(projectPath, fallback) {
  try {
    const { computeRevision } = await import('./gauntlet.mjs');
    return await computeRevision(projectPath);
  } catch (e) {
    if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
    return fallback;
  }
}
/** Draw one output frame. With motion blur, average evenly spaced sub-frames
 * across the shutter interval centred on the frame time. Each sub-frame is a
 * pure function of its time, so the result stays deterministic and seekable.
 * `samples: 'auto'` tries 12, 36, 108 then 324 sub-frames and stops once more
 * would change no channel by more than `tolerance` levels of 255. */
export const AUTO_SAMPLES = Object.freeze([12, 36, 108, 324]);
export function renderFrame(ctx, profile, project, assets, drawFrame, frame) {
  const draw = t => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, profile.width, profile.height);
    drawFrame(ctx, project, assets, Math.max(0, t), { layer: 'all' });
    return ctx.getImageData(0, 0, profile.width, profile.height).data;
  };
  const time = frame / project.fps, blur = profile.motionBlur;
  if (!blur) return draw(time);
  const span = blur.shutter / project.fps;
  const average = samples => {
    const sum = new Float32Array(profile.width * profile.height * 4);
    for (let i = 0; i < samples; i++) {
      const data = draw(time + ((i + 0.5) / samples - 0.5) * span);
      for (let j = 0; j < sum.length; j++) sum[j] += data[j];
    }
    const out = new Uint8ClampedArray(sum.length);
    for (let j = 0; j < sum.length; j++) out[j] = Math.round(sum[j] / samples);
    return out;
  };
  if (blur.samples !== 'auto') return average(blur.samples);
  let previous = average(AUTO_SAMPLES[0]);
  for (const samples of AUTO_SAMPLES.slice(1)) {
    const next = average(samples);
    let change = 0;
    for (let j = 0; j < next.length && change <= blur.tolerance; j++) change = Math.max(change, Math.abs(next[j] - previous[j]));
    previous = next;
    if (change <= blur.tolerance) break;
  }
  return previous;
}

async function encodeSection(file, project, section, span, profile, assets, drawFrame, { signal, onProgress }) {
  const started = performance.now();
  const canvas = createCanvas(profile.width, profile.height);
  const ctx = canvas.getContext('2d');
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${profile.width}x${profile.height}`, '-r', String(profile.fps), '-i', 'pipe:0', '-frames:v', String(span.frames), '-c:v', profile.codec, '-preset', profile.preset, '-crf', String(profile.crf), '-pix_fmt', profile.pixelFormat, '-an', '-threads', '2', file];
  const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = '', processError;
  proc.stderr.on('data', d => { stderr = (stderr + d).slice(-24000); });
  const completed = new Promise(resolve => {
    proc.on('error', e => { processError = e; resolve(-1); });
    proc.on('close', resolve);
  });
  // An encoder failure must not become an unhandled pipe exception.
  proc.stdin.on('error', e => { processError = e; });
  const abort = () => proc.kill('SIGTERM');
  signal?.addEventListener('abort', abort, { once: true });
  try {
    for (let frame = span.start; frame < span.end; frame++) {
      signal?.throwIfAborted();
      if (processError) throw processError;
      const pixels = renderFrame(ctx, profile, project, assets, drawFrame, frame);
      await new Promise((resolve, reject) => proc.stdin.write(Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength), e => e ? reject(e) : resolve()));
      if ((frame - span.start) % Math.max(1, Math.round(project.fps * 2)) === 0) onProgress?.({ type: 'frame', section: section.id, frame: frame - span.start + 1, frames: span.frames });
    }
    proc.stdin.end();
    const code = await completed;
    if (code !== 0 || processError) throw new Error(`Section ${section.id} encoder failed: ${stderr || processError || code}`);
  } catch (error) {
    proc.stdin.destroy(); proc.kill('SIGTERM'); await completed;
    throw error;
  } finally { signal?.removeEventListener('abort', abort); }
  if (!await verifyChunk(file, span.frames, profile)) throw new Error(`Section ${section.id} failed frame/format verification`);
  return { sectionId: section.id, frames: span.frames, startFrame: span.start, endFrame: span.end, profile, seconds: (performance.now() - started) / 1000 };
}
const concatEscape = file => file.replaceAll("'", "'\\''");

export async function loadRenderer(codeHash, moduleUrl = new URL('./visual.mjs', import.meta.url)) {
  const url = new URL(moduleUrl);
  url.searchParams.set('revision', codeHash);
  return await import(url.href);
}

export async function renderProject({ projectPath, outPath, sectionId, scale = 1, force = false, cacheDir, onProgress = () => {}, signal }) {
  if (!projectPath || !outPath) throw new Error('render requires projectPath and outPath');
  const startedAt = new Date().toISOString(), started = performance.now();
  const loaded = await loadProject(projectPath);
  const { project, manifestPath } = loaded;
  const output = path.resolve(outPath);
  if (path.extname(output).toLowerCase() !== '.mp4') throw new Error('Output must use the .mp4 extension');
  const sources = [manifestPath, resolveSource(manifestPath, project.audio.src), ...Object.values(project.assets).map(a => resolveSource(manifestPath, a.src))];
  if (sources.includes(output)) throw new Error('Output cannot replace a source asset or manifest');
  const profile = outputProfile(project, scale);
  const spans = frameSpans(project);
  const selected = project.sections.map((section, i) => ({ section, span: spans[i] })).filter(({ section }) => !sectionId || section.id === sectionId);
  if (!selected.length) throw new Error(`Unknown section: ${sectionId}`);
  const cacheRoot = path.resolve(cacheDir ?? path.join(path.dirname(manifestPath), '.render-cache'));
  const codeHash = await rendererHash();
  const hashes = await assetHashes(project, manifestPath);
  const audioPath = resolveSource(manifestPath, project.audio.src);
  const audioHash = await fileHash(audioPath);
  const fallbackRevision = { projectHash: digest(project), rendererHash: codeHash, revisionHash: digest({ project, codeHash, assets: hashes, audioHash }) };
  const sourceRevision = await captureRevision(manifestPath, fallbackRevision);
  const firstFrame = selected[0].span.start;
  const lastFrame = selected.at(-1).span.end;
  const duration = (lastFrame - firstFrame) / project.fps;
  const audioStart = (project.audio.offset ?? 0) + firstFrame / project.fps;
  const audioProbe = await probeVideo(audioPath);
  if (!audioProbe.streams.some(s => s.codec_type === 'audio')) throw new Error('Source has no audio stream');
  if (Number(audioProbe.format.duration) + 1 / project.fps + 0.01 < audioStart + duration) throw new Error('Audio is shorter than requested project interval');
  const { drawFrame } = await loadRenderer(codeHash);
  const images = await loadAssets(project, manifestPath);
  const chunks = [];
  for (const { section, span } of selected) {
    signal?.throwIfAborted();
    const key = sectionCacheKey(project, section, span, { profile, codeHash, assets: hashes });
    const sectionStarted = performance.now();
    let chunk = !force && await cachedChunk(cacheRoot, section.id, key, file => verifyChunk(file, span.frames, profile));
    if (chunk) onProgress({ type: 'cache-hit', section: section.id, key });
    else {
      onProgress({ type: 'render-section', section: section.id, key, frames: span.frames });
      chunk = await publishChunk(cacheRoot, section.id, key, file => encodeSection(file, project, section, span, profile, images, drawFrame, { signal, onProgress }));
    }
    chunks.push({ ...chunk, id: section.id, key, frames: span.frames, startFrame: span.start, endFrame: span.end, seconds: (performance.now() - sectionStarted) / 1000 });
  }
  await mkdir(path.dirname(output), { recursive: true });
  const tempDir = await mkdtemp(path.join(path.dirname(output), '.ark-render-'));
  try {
    const listing = path.join(tempDir, 'concat.txt'), silent = path.join(tempDir, 'silent.mp4'), final = path.join(tempDir, 'output.mp4');
    await writeFile(listing, chunks.map(c => `file '${concatEscape(c.video)}'`).join('\n') + '\n');
    onProgress({ type: 'assemble', sections: chunks.length, duration });
    await runProcess('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listing, '-map', '0:v:0', '-c:v', 'copy', '-an', silent], { signal });
    await runProcess('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', silent, '-ss', String(audioStart), '-i', audioPath, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-af', 'apad', '-t', String(duration), '-movflags', '+faststart', final], { signal });
    const probe = await probeVideo(final);
    const video = probe.streams.find(s => s.codec_type === 'video');
    const audio = probe.streams.find(s => s.codec_type === 'audio');
    if (!video || !audio || video.codec_name !== 'h264' || video.width !== profile.width || video.height !== profile.height || Number(video.nb_frames) !== lastFrame - firstFrame || Math.abs(Number(probe.format.duration) - duration) > 0.1) throw new Error('Final output failed stream/frame/duration verification');
    const sourceRevisionEnd = await captureRevision(manifestPath, { projectHash: digest((await loadProject(manifestPath)).project), rendererHash: await rendererHash(), revisionHash: digest({ project: (await loadProject(manifestPath)).project, codeHash: await rendererHash(), assets: await assetHashes(project, manifestPath), audioHash: await fileHash(audioPath) }) });
    if (sourceRevision.revisionHash !== sourceRevisionEnd.revisionHash) throw new Error('Project or renderer changed during render; output was not published. Retry against the updated revision.');
    const sha256 = await fileHash(final);
    await rename(final, output);
    const report = { version: 1, projectPath: manifestPath, output, sha256, sourceRevision, sourceRevisionEnd, audioSha256: audioHash, audioStart, sourceStart: firstFrame / project.fps, sourceEnd: lastFrame / project.fps, duration, width: profile.width, height: profile.height, fps: project.fps, profile, sectionId: sectionId ?? null, frames: lastFrame - firstFrame, sections: chunks.map(c => ({ id: c.id, key: c.key, cacheHit: c.cacheHit, frames: c.frames, startFrame: c.startFrame, endFrame: c.endFrame, seconds: c.seconds, artifact: c.video, sha256: c.metadata.sha256 })), startedAt, completedAt: new Date().toISOString(), seconds: (performance.now() - started) / 1000, bytes: (await stat(output)).size, validation: { technical: 'passed', visual: 'pending-independent-review' } };
    await atomicJson(`${output}.render.json`, report);
    onProgress({ type: 'complete', output, sha256, seconds: report.seconds, cacheHits: chunks.filter(c => c.cacheHit).length });
    return report;
  } finally { await rm(tempDir, { recursive: true, force: true }); }
}
