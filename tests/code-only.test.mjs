import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { resolveMode, capabilities } from '../engine/providers.mjs';
import { CODE_ONLY, applyCodeOnly, auditCodeOnly } from '../engine/code-only.mjs';
import { outputProfile } from '../engine/cache.mjs';
import { renderFrame, renderProject, probeVideo, runProcess, AUTO_SAMPLES } from '../engine/export.mjs';
import { planStyle } from '../engine/create.mjs';

test('Claude drives the engine in code-only mode unless told otherwise', () => {
  assert.equal(resolveMode({ env: { CLAUDECODE: '1' } }), 'code-only');
  assert.equal(resolveMode({ env: { CODEX_HOME: '/x' } }), 'mixed');
  assert.equal(resolveMode({ env: {} }), 'mixed');
  assert.equal(resolveMode({ env: { CLAUDECODE: '1', ARK_MODE: 'mixed' } }), 'mixed');
  assert.equal(resolveMode({ env: { ARK_AGENT: 'codex' }, mode: 'code-only' }), 'code-only');
  assert.throws(() => resolveMode({ env: { ARK_MODE: 'photos' } }), /Unknown mode/);
  assert.equal(capabilities({ CLAUDECODE: '1' }).imageProvider, null);
});

const base = () => ({ fps: 30, assets: { img: { type: 'image', src: 'a.png' }, font: { type: 'font', src: 'f.ttf' } }, sections: [{ id: 's1', assetIds: ['font'], direction: {} }] });

test('code-only projects may use fonts only, at 60 fps with motion blur', () => {
  assert.equal(auditCodeOnly(base()).required, false);
  const project = { ...applyCodeOnly(base()), fps: CODE_ONLY.fps };
  assert.deepEqual(auditCodeOnly(project), { required: true, passed: true, issues: [] });
  project.sections.push({ id: 's2', assetIds: ['img'], direction: { photo: 'img' } });
  project.fps = 30; delete project.render.motionBlur;
  const issues = auditCodeOnly(project).issues.join('\n');
  assert.match(issues, /s2 uses image asset img/); assert.match(issues, /selects photo/); assert.match(issues, /60 fps/); assert.match(issues, /motion blur/);
  assert.deepEqual(applyCodeOnly({ render: { motionBlur: { samples: 32, shutter: .2 } } }).render.motionBlur, { samples: 32, shutter: .2 });
  assert.equal(auditCodeOnly({ ...project, render: { motionBlur: { samples: 'auto' } } }).issues.some(i => /motion blur/.test(i)), false);
});

test('a photographic brief is translated into coded treatments', () => {
  const words = ['Rain', 'fell'].map((text, i) => ({ id: `w${i}`, text, start: i, end: i + .5 }));
  const project = { id: 'p', title: 'P', fps: 60, duration: 3, words, beats: [], palette: {}, assets: {}, sections: [] };
  const coded = planStyle(project, 'photoreal storm imagery, dark', { mode: 'code-only' }).project;
  assert.equal(coded.creation.mode, 'code-only'); assert.equal(coded.creation.interpreted.photo, false);
  assert.match(coded.creation.warnings.join(' '), /drawn in code/);
  assert.equal(planStyle(project, 'photoreal storm imagery, dark').project.creation.interpreted.photo, true);
});

test('motion blur averages sub-frames across the shutter and stays deterministic', () => {
  const profile = { ...outputProfile({ width: 4, height: 2, fps: 10, render: { motionBlur: { samples: 4, shutter: 1 } } }) };
  assert.deepEqual(profile.motionBlur, { samples: 4, shutter: 1 });
  assert.equal(outputProfile({ width: 4, height: 2, fps: 10 }).motionBlur, undefined);
  const ctx = createCanvas(4, 2).getContext('2d'), times = [];
  // Brightness equals the sample time in tenths of a frame, so the average is known.
  const draw = (c, p, a, t) => { times.push(t); const v = Math.round((t * 10 % 1) * 200); c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(0, 0, 4, 2); };
  const out = renderFrame(ctx, profile, { fps: 10 }, {}, draw, 3);
  assert.deepEqual(times.map(t => +t.toFixed(4)), [0.2625, 0.2875, 0.3125, 0.3375]);
  const expected = Math.round([0.625, 0.875, 0.125, 0.375].reduce((sum, f) => sum + Math.round(f * 200), 0) / 4);
  assert.equal(out[0], expected); assert.equal(out[3], 255);
  assert.deepEqual(renderFrame(ctx, profile, { fps: 10 }, {}, draw, 3), out);
});

test('auto sampling stops early on still frames and refines moving ones', () => {
  const profile = outputProfile({ width: 2, height: 2, fps: 10, render: applyCodeOnly({}).render });
  assert.deepEqual(profile.motionBlur, { samples: 'auto', shutter: 0.2, tolerance: 3 });
  const ctx = createCanvas(2, 2).getContext('2d');
  let calls = 0;
  renderFrame(ctx, profile, { fps: 10 }, {}, (c) => { calls++; c.fillStyle = '#808080'; c.fillRect(0, 0, 2, 2); }, 5);
  assert.equal(calls, AUTO_SAMPLES[0] + AUTO_SAMPLES[1]);
  calls = 0;
  // A hard edge sweeping across the frame keeps changing as sampling refines.
  renderFrame(ctx, profile, { fps: 10 }, {}, (c, p, a, t) => { calls++; c.fillStyle = '#000'; c.fillRect(0, 0, 2, 2); if ((t * 1000) % 7 < 3.5) { c.fillStyle = '#fff'; c.fillRect(0, 0, 2, 2); } }, 5);
  assert.ok(calls > AUTO_SAMPLES[0] + AUTO_SAMPLES[1]);
});

test('a code-only project encodes at 60 fps with blurred frames', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ark-code-only-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await runProcess('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1', '-c:a', 'pcm_s16le', path.join(dir, 'song.wav')]);
  const project = applyCodeOnly({ version: 1, id: 'code', title: 'Code only', width: 320, height: 180, fps: 60, duration: 0.5, audio: { src: 'song.wav', offset: 0 }, assets: {}, words: [{ id: 'w', text: 'Light', start: 0, end: 0.4, confidence: 1, provenance: 'synthetic' }], beats: [], sections: [{ id: 'a', start: 0, end: 0.5, style: 'verse', wordIds: ['w'], assetIds: [], direction: {}, seed: 1 }], palette: {} });
  project.render.motionBlur.samples = 2;
  const projectPath = path.join(dir, 'project.json'), outPath = path.join(dir, 'film.mp4');
  await writeFile(projectPath, JSON.stringify(project));
  const result = await renderProject({ projectPath, outPath });
  assert.equal(result.frames, 30); assert.deepEqual(result.profile.motionBlur, { samples: 2, shutter: 0.2 }); assert.equal(result.profile.crf, 16);
  const video = (await probeVideo(outPath)).streams.find(s => s.codec_type === 'video');
  assert.equal(video.r_frame_rate, '60/1');
});

test('the gauntlet fails a code-only film that uses an image', async t => {
  const { reviewVideo } = await import('../engine/gauntlet.mjs');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ark-code-only-gauntlet-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await runProcess('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1', '-c:a', 'pcm_s16le', path.join(dir, 'song.wav')]);
  await runProcess('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=gray:s=320x180', '-frames:v', '1', path.join(dir, 'photo.png')]);
  const project = applyCodeOnly({ version: 1, id: 'code', title: 'Code only', width: 320, height: 180, fps: 60, duration: 0.5, audio: { src: 'song.wav', offset: 0 }, assets: { photo: { type: 'image', src: 'photo.png' } }, words: [{ id: 'w', text: 'Light', start: 0, end: 0.4, confidence: 1, provenance: 'synthetic' }], beats: [], sections: [{ id: 'a', start: 0, end: 0.5, style: 'verse', wordIds: ['w'], assetIds: ['photo'], direction: {}, seed: 1 }], palette: {} });
  project.render.motionBlur.samples = 2;
  const projectPath = path.join(dir, 'project.json'), videoPath = path.join(dir, 'film.mp4');
  await writeFile(projectPath, JSON.stringify(project));
  await renderProject({ projectPath, outPath: videoPath });
  const report = await reviewVideo({ videoPath, projectPath, outDir: path.join(dir, 'review') });
  const check = report.technical.checks.find(c => c.name === 'codeOnly');
  assert.equal(check.passed, false); assert.match(check.observed.issues[0], /uses image asset photo/);
  assert.equal(report.technical.passed, false);
});
