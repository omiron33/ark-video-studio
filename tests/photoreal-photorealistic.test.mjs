import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { h3Len, workflow, STYLE_REFERENCE, H3 } from '../photoreal/lib/h3.mjs';

test('H3 clip lengths snap up to 17k + 5 frames', () => {
  assert.equal(h3Len(124), 124);
  assert.equal(h3Len(192), 192);
  assert.equal(h3Len(193), 209);
  assert.equal(h3Len(1), 5);
  assert.ok(h3Len(H3.maxFrames) >= H3.maxFrames);
});

test('the proxy steers only the first `keep` steps', () => {
  const g = workflow({ proxy: 'p.mp4', look: null, guide: null, prompt: 'a dove', frames: 124, steps: 20, keep: 5, seed: 1, prefix: 'x' });
  assert.equal(g[19].class_type, 'SplitSigmas');
  assert.equal(g[19].inputs.step, 5);
  // first pass: noise on, the conditioning with the proxy video; second pass: no new noise, without it
  assert.deepEqual(g[11].inputs.guider, ['7', 0]);
  assert.deepEqual(g[7].inputs.conditioning, ['6', 0]);
  assert.ok(g[6].inputs['ref_videos.ref_video_1']);
  assert.deepEqual(g[22].inputs.noise, ['18', 0]);
  assert.deepEqual(g[22].inputs.latent_image, ['11', 0]);
  assert.deepEqual(g[22].inputs.guider, ['17', 0]);
  assert.equal(g[16].inputs['ref_videos.ref_video_1'], undefined);
  // no look: prompt only, no image reference anywhere
  assert.equal(g[30], undefined);
  assert.equal(g[6].inputs.prompt, 'a dove');
});

test('a look image adds the style reference to both passes; a guide anchors frame 0 of both', () => {
  const g = workflow({ proxy: 'p.mp4', look: 'l.png', guide: 'g.mp4', prompt: 'a dove', frames: 209, steps: 20, keep: 5, seed: 1, prefix: 'x' });
  for (const k of [6, 16]) {
    assert.deepEqual(g[k].inputs['ref_images.ref_image_1'], ['30', 0]);
    assert.ok(g[k].inputs.prompt.endsWith(STYLE_REFERENCE));
  }
  assert.equal(g[42].class_type, 'MiniMaxH3AddGuide');
  assert.equal(g[42].inputs.frame_idx, 0);
  assert.deepEqual(g[7].inputs.conditioning, ['42', 0]);
  assert.deepEqual(g[17].inputs.conditioning, ['43', 0]);
});

test('the no-words switch is hashed as the lines it was added to', () => {
  for (const f of ['photoreal/web/main.js', 'photoreal/web/premium/main.js', 'photoreal/web/premium/text.js']) {
    const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    const marked = src.split('\n').filter((l) => /nowords|ARK_NO_WORDS/.test(l));
    assert.ok(marked.length, `${f} has the switch`);
    for (const l of marked) assert.match(l, /\/\/ key-neutral: nowords$/, `${f}: ${l}`);
  }
});
