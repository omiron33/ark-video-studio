import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CONTINUUM, DEFAULT_CHAIN, planChains, usesContinuum, timelinePrompt, continuumWorkflow, chunkBounds } from '../photoreal/lib/continuum.mjs';
import { H3 } from '../photoreal/lib/h3.mjs';

const fresh = (chains) => chains.reduce((k, c, i) => k + c.len - (i ? 1 : 0), 0);

test('bridges are the default; Continuum is opt-in only (its trial failed 2026-10-15)', () => {
  assert.equal(DEFAULT_CHAIN, 'bridges');
  const src = fs.readFileSync(new URL('../photoreal/photorealistic.mjs', import.meta.url), 'utf8');
  assert.match(src, /opt\('chain', PR\.chain \?\? DEFAULT_CHAIN\)/);
  assert.equal(usesContinuum(DEFAULT_CHAIN, 3), false, 'a long take with no "chain" in film.json uses bridges');
});

test('Continuum is used only for takes that would otherwise be joined from pieces', () => {
  assert.equal(usesContinuum('continuum', 1), false);
  assert.equal(usesContinuum('continuum', 3), true);
  assert.equal(usesContinuum('bridges', 3), false);
});

test('chains cover the take exactly, stay near the drift cap and use 4-30 s chunks', () => {
  for (const n of [60, 124, 192, 345, 360, 362, 500, 724, 1000]) {
    const chains = planChains(n);
    assert.equal(fresh(chains), n, `n=${n}`);
    let at = 0;
    for (const [i, c] of chains.entries()) {
      assert.equal(c.start, i ? at - 1 : 0, 'a later chain starts on the previous chain\'s last frame');
      at = c.start + c.len;
      assert.ok(c.len <= CONTINUUM.maxChainSeconds * H3.fps + 1, `n=${n} chain ${i} is ${c.len} frames`);
      assert.ok(c.chunkSeconds >= 4 && c.chunkSeconds <= 30);
      assert.ok(Math.abs(c.chunks * c.chunkSeconds * H3.fps - c.len) <= 2 || c.chunkSeconds === 4, `n=${n}: chunks fit the chain`);
    }
    assert.equal(at, n);
  }
  assert.equal(planChains(360).length, 1);
  assert.equal(planChains(360)[0].chunks, 3);
  assert.equal(planChains(500).length, 2);
});

test('chunk bounds tile the joined take', () => {
  const chains = planChains(724);
  const b = chunkBounds(chains);
  assert.equal(b[0][0], 0);
  assert.equal(b.at(-1)[1], 724);
  for (let i = 1; i < b.length; i++) assert.equal(b[i][0], b[i - 1][1]);
  assert.equal(b.length, chains.reduce((k, c) => k + c.chunks, 0));
});

test('the Timeline prompt puts each header alone on its line', () => {
  const t = timelinePrompt(['a stone\nat night', 'mist'], 5);
  assert.equal(t, '[0-5s]\na stone at night\n\n[5-10s]\nmist');
  assert.match(timelinePrompt(['x', 'y'], 4.17), /\[4\.17-8\.34s\]/);
});

test('the Continuum graph: code render steers each chunk, look is Reference 1, same models as the bridges path', () => {
  const g = continuumWorkflow({ proxy: 'p.mp4', look: 'l.png', first: 'f.png', prompt: '[0-5s]\nx', chunks: 3, chunkSeconds: 5, steps: 20, seed: 7, prefix: 'x', styleReference: 'STYLE' });
  const s = g[12].inputs;
  assert.equal(g[12].class_type, 'H3ContinuumSamplerV39');
  assert.equal(s.prompt_mode, 'Timeline');
  assert.equal(s.chunks, 3);
  assert.equal(s.chunk_seconds, 5);
  assert.equal(s.continuity, 'Balanced — 22 frames');
  assert.equal(s.size_source, 'Manual');
  assert.equal(s.width, H3.width);
  assert.equal(s.height, H3.height);
  assert.equal(s.video_reference_mode, 'Follow Timeline');
  assert.deepEqual(s.reference_video_1, ['21', 0]);
  assert.equal(g[21].class_type, 'H3ContinuumVideoAdapter');
  assert.deepEqual(g[21].inputs.video, ['20', 0]);
  assert.deepEqual(s.reference_images, ['31', 0]);
  assert.equal(g[31].inputs.reference_use, 'All chunks');
  assert.deepEqual(g[31].inputs.reference_image_1, ['30', 0]);
  assert.deepEqual(s.first_frame, ['40', 0]);
  assert.equal(g[2].inputs.unet_name, 'minimax_h3_ref2va_pruned_int8_convrot.safetensors');
  assert.deepEqual(s.model, ['5', 0]);
  assert.equal(g[5].class_type, 'MiniMaxH3SigmaShift');
  assert.equal(g[10].inputs.sampler_name, 'euler');
  assert.ok(g[11].inputs.value.endsWith('STYLE'));
  assert.equal(s.run_storage, 'Off');
});

test('the Continuum graph without a proxy, look or first frame leaves those inputs off', () => {
  const g = continuumWorkflow({ proxy: null, look: null, first: null, prompt: 'x', chunks: 1, chunkSeconds: 4, steps: 20, seed: 1, prefix: 'x' });
  for (const k of [20, 21, 30, 31, 40]) assert.equal(g[k], undefined);
  for (const k of ['reference_video_1', 'reference_images', 'first_frame']) assert.equal(g[12].inputs[k], undefined);
  assert.equal(g[11].inputs.value, 'x');
});

const hasTools = spawnSync('ffmpeg', ['-version']).status === 0
  && spawnSync('python3', ['-c', 'import numpy']).status === 0;

test('chainmatch pulls a drifting chunk back to the first, and follows the code render\'s own light', { skip: !hasTools && 'needs ffmpeg and numpy' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chainmatch-'));
  const ff = (args) => assert.equal(spawnSync('ffmpeg', ['-y', '-v', 'error', ...args]).status, 0);
  const mean = (f) => {
    const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', 'scale=32:18', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 26 }).stdout;
    const per = 32 * 18, out = [];
    for (let i = 0; i + per <= raw.length; i += per) out.push(raw.subarray(i, i + per).reduce((a, b) => a + b, 0) / per);
    return out;
  };
  // 48 frames: the second half drifts brighter and harsher (a gradient so it has contrast)
  const src = path.join(dir, 'gen.mp4');
  ff(['-f', 'lavfi', '-i', 'gradients=s=96x64:c0=0x202020:c1=0x808080:speed=0:r=24:d=2', '-vf', "eq=brightness='if(gte(n,24),0.12,0)':contrast='if(gte(n,24),1.3,1)':eval=frame", '-c:v', 'libx264', '-crf', '4', '-pix_fmt', 'yuv420p', src]);
  const out = path.join(dir, 'out.mp4'), rep = path.join(dir, 'r.json');
  const lib = new URL('../photoreal/lib/chainmatch.py', import.meta.url).pathname;
  assert.equal(spawnSync('python3', [lib, '--generated', src, '--bounds', '[[0,24],[24,48]]', '--out', out, '--report', rep]).status, 0);
  const before = mean(src), after = mean(out);
  const drift = (m) => m.slice(40).reduce((a, b) => a + b, 0) / 8 - m.slice(0, 8).reduce((a, b) => a + b, 0) / 8;
  assert.ok(Math.abs(drift(after)) < Math.abs(drift(before)) / 2, `drift ${drift(before).toFixed(1)} -> ${drift(after).toFixed(1)}`);
  const r = JSON.parse(fs.readFileSync(rep, 'utf8'));
  assert.deepEqual(r.chunks[0].gain, [1, 1, 1]);
  // a code render that brightens the same way: the brightening is kept
  const kept = path.join(dir, 'kept.mp4');
  assert.equal(spawnSync('python3', [lib, '--generated', src, '--proxy', src, '--bounds', '[[0,24],[24,48]]', '--out', kept]).status, 0);
  assert.ok(Math.abs(drift(mean(kept)) - drift(before)) < 3, 'follows the proxy\'s light');
  fs.rmSync(dir, { recursive: true });
});
