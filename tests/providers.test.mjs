import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { detectAgent, resolveImageProvider, imageAction, capabilities, generateImage, generateComfyImage, comfyWorkflow, comfyUrls } from '../engine/providers.mjs';

test('detects the driving agent without requiring one', () => {
  assert.equal(detectAgent({}), 'none');
  assert.equal(detectAgent({ CLAUDECODE: '1' }), 'claude');
  assert.equal(detectAgent({ CODEX_SANDBOX: 'seatbelt' }), 'codex');
  assert.equal(detectAgent({ ARK_AGENT: 'codex', CLAUDECODE: '1' }), 'codex');
  assert.equal(detectAgent({ ARK_AGENT: 'mystery' }), 'none');
});

test('image provider follows what the agent can actually do', () => {
  assert.equal(resolveImageProvider({ env: {} }), 'gpt-image');
  assert.equal(resolveImageProvider({ env: { CODEX_HOME: '/x' } }), 'gpt-image');
  assert.equal(resolveImageProvider({ env: { CLAUDECODE: '1' } }), 'comfyui');
  assert.equal(resolveImageProvider({ env: { CLAUDECODE: '1', OPENAI_API_KEY: 'k' } }), 'openai-images');
  assert.equal(resolveImageProvider({ env: { ARK_AGENT: 'none' } }), 'comfyui');
  assert.equal(resolveImageProvider({ env: { ARK_IMAGE_PROVIDER: 'supplied' } }), 'supplied');
  assert.equal(resolveImageProvider({ env: { CLAUDECODE: '1', ARK_IMAGE_PROVIDER: 'gpt-image' } }), 'gpt-image');
  assert.throws(() => resolveImageProvider({ env: { ARK_IMAGE_PROVIDER: 'dall-e' } }), /Unknown image provider/);
});

test('every provider gives an actionable, audit-completing instruction', () => {
  for (const provider of ['gpt-image', 'openai-images', 'comfyui', 'supplied']) assert.match(imageAction(provider), /rerun the artwork audit/);
  assert.match(imageAction('gpt-image'), /GPT Image/);
  assert.match(imageAction('openai-images'), /cli\.mjs image/);
  assert.equal(capabilities({ CLAUDECODE: '1' }).imageProviders['gpt-image'].available, false);
});

test('API image generation writes the file and its provenance', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ark-image-'));
  try {
    const png = Buffer.from('fake-png');
    let sent;
    const fetchImpl = async (url, init) => { sent = JSON.parse(init.body); return { ok: true, json: async () => ({ data: [{ b64_json: png.toString('base64') }] }) }; };
    const result = await generateImage({ prompt: 'A lantern in rain', out: path.join(dir, 'a', 'scene.png'), model: 'm', env: { OPENAI_API_KEY: 'k' }, fetchImpl });
    assert.deepEqual(sent, { model: 'm', prompt: 'A lantern in rain', size: '1536x1024', n: 1 });
    assert.deepEqual(await readFile(result.path), png);
    const provenance = JSON.parse(await readFile(result.provenancePath, 'utf8'));
    assert.equal(provenance.provider, 'openai-images'); assert.equal(provenance.sha256.length, 64);
    await assert.rejects(generateImage({ prompt: 'x', out: path.join(dir, 'b.png'), env: {}, fetchImpl }), /OPENAI_API_KEY/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('local ComfyUI generation finds a reachable host, queues, polls and saves', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ark-comfy-'));
  try {
    const png = Buffer.from('comfy-png'), calls = [];
    let polls = 0, graph;
    const ok = body => ({ ok: true, json: async () => body, arrayBuffer: async () => png });
    const fetchImpl = async (url, init) => {
      calls.push(url);
      if (url.startsWith('http://dead')) throw new Error('offline');
      if (url.endsWith('/system_stats')) return ok({});
      if (url.includes('/object_info/')) return ok({ CheckpointLoaderSimple: { input: { required: { ckpt_name: [['sdxl.safetensors']] } } } });
      if (url.endsWith('/prompt')) { graph = JSON.parse(init.body).prompt; return ok({ prompt_id: 'p1' }); }
      if (url.includes('/history/')) return ok(++polls < 2 ? {} : { p1: { outputs: { 7: { images: [{ filename: 'ark_1.png', subfolder: '', type: 'output' }] } } } });
      if (url.includes('/view?')) return ok({});
      throw new Error(url);
    };
    const result = await generateComfyImage({ prompt: 'Ark at dawn', out: path.join(dir, 'scene.png'), size: '1024x576', seed: 7, env: { ARK_COMFY_URL: 'http://dead:1' }, fetchImpl, pollMs: 1 });
    assert.equal(result.host, 'http://192.168.4.245:8188');
    assert.equal(result.checkpoint, 'sdxl.safetensors');
    assert.deepEqual(graph[4].inputs, { width: 1024, height: 576, batch_size: 1 });
    assert.equal(graph[5].inputs.seed, 7); assert.equal(graph[2].inputs.text, 'Ark at dawn');
    assert.deepEqual(await readFile(result.path), png);
    assert.equal(JSON.parse(await readFile(result.provenancePath, 'utf8')).cost, 'Local GPU only; no paid API generation');
    await assert.rejects(generateComfyImage({ prompt: 'x', out: path.join(dir, 'b.png'), env: {}, fetchImpl: async () => { throw new Error('down'); } }), /No local ComfyUI reachable/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('custom ComfyUI workflows fill typed placeholders', () => {
  const graph = comfyWorkflow({ prompt: 'p', seed: 3, width: 8, height: 9, template: { a: { inputs: { text: 'Scene: {{prompt}}', seed: '{{seed}}', size: ['{{width}}', '{{height}}'] } } } });
  assert.deepEqual(graph.a.inputs, { text: 'Scene: p', seed: 3, size: [8, 9] });
  assert.deepEqual(comfyUrls({ ARK_COMFY_URL: 'http://x' })[0], 'http://x');
});
