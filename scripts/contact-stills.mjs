#!/usr/bin/env node
// Render still frames straight from the renderer (no encode) for fast visual review.
// usage: node scripts/contact-stills.mjs project.json out-dir [--scale .5] [--times 1,2,3 | --sections]
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { createCanvas } from '@napi-rs/canvas';
import { loadProject } from '../engine/project.mjs';
import { loadAssets } from '../engine/export.mjs';
import { drawFrame } from '../engine/visual.mjs';
const [projectPath, outDir, ...rest] = process.argv.slice(2);
const opt = k => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
const scale = Number(opt('--scale') ?? .5);
const { project, manifestPath } = await loadProject(path.resolve(projectPath));
const assets = await loadAssets(project, manifestPath);
const times = opt('--times') ? opt('--times').split(',').map(Number)
  : project.sections.flatMap(s => { const d = s.end - s.start; return (opt('--at') ?? '.55').split(',').map(f => s.start + d * Number(f)); });
await mkdir(outDir, { recursive: true });
const canvas = createCanvas(Math.round(1920 * scale), Math.round(1080 * scale)), ctx = canvas.getContext('2d');
for (const t of times) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawFrame(ctx, project, assets, Math.round(t * project.fps) / project.fps);
  const s = project.sections.find(s => t >= s.start && t < s.end) ?? project.sections.at(-1);
  await writeFile(path.join(outDir, `${t.toFixed(2).padStart(7, '0')}-${s.id}.png`), await canvas.encode('png'));
}
console.log(times.length, 'stills in', outDir);
