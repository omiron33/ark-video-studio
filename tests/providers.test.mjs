import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { detectAgent, resolveImageProvider, imageAction, capabilities, generateImage } from '../engine/providers.mjs';

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
  assert.equal(resolveImageProvider({ env: { CLAUDECODE: '1' } }), 'supplied');
  assert.equal(resolveImageProvider({ env: { CLAUDECODE: '1', OPENAI_API_KEY: 'k' } }), 'openai-images');
  assert.equal(resolveImageProvider({ env: { ARK_AGENT: 'none' } }), 'supplied');
  assert.equal(resolveImageProvider({ env: { CLAUDECODE: '1', ARK_IMAGE_PROVIDER: 'gpt-image' } }), 'gpt-image');
  assert.throws(() => resolveImageProvider({ env: { ARK_IMAGE_PROVIDER: 'dall-e' } }), /Unknown image provider/);
});

test('every provider gives an actionable, audit-completing instruction', () => {
  for (const provider of ['gpt-image', 'openai-images', 'supplied']) assert.match(imageAction(provider), /rerun the artwork audit/);
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
