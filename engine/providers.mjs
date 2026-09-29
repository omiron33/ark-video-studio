import path from 'node:path';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

/** Which agent is driving the engine. Nothing in the engine requires one:
 * every CLI step runs without a model, and agent-only steps name a fallback. */
export const AGENTS = Object.freeze({
  codex: { imageTool: true, vision: true, computerUse: true, strengths: ['built-in GPT Image generation', 'computer-use delivery (Suno, Photos)', 'long unattended runs'] },
  claude: { imageTool: false, vision: true, computerUse: true, strengths: ['director briefs and scene planning', 'hand-authored choreography and HyperFrames/GSAP code', 'frame critique of decoded evidence'] },
  none: { imageTool: false, vision: false, computerUse: false, strengths: ['every CLI command: create, render, gauntlet, audio review, finish'] },
});

/** Image providers. `agent` providers need an agent's own tool; `cli` providers
 * run from `node engine/cli.mjs image` with no agent at all. */
export const IMAGE_PROVIDERS = Object.freeze({
  'gpt-image': { runs: 'agent', label: 'GPT Image through the agent\'s built-in image tool (Codex)' },
  'openai-images': { runs: 'cli', label: 'GPT Image through the OpenAI Images API (needs OPENAI_API_KEY)' },
  comfyui: { runs: 'cli', label: 'Local ComfyUI on the home network (OmiPC); no paid API' },
  supplied: { runs: 'any', label: 'An original image file added by a person or any agent' },
});

export function detectAgent(env = process.env) {
  if (env.ARK_AGENT) return AGENTS[env.ARK_AGENT] ? env.ARK_AGENT : 'none';
  if (env.CLAUDECODE === '1' || env.CLAUDE_CODE_ENTRYPOINT) return 'claude';
  if (Object.keys(env).some(key => key.startsWith('CODEX_'))) return 'codex';
  return 'none';
}

/** Explicit choice wins. Otherwise use what the current agent can actually do,
 * falling back to the API, then to local ComfyUI on the home network. When no agent is detected,
 * keep the historical GPT Image default so existing runs behave as before. */
export function resolveImageProvider({ env = process.env, provider } = {}) {
  const chosen = provider ?? env.ARK_IMAGE_PROVIDER;
  if (chosen) {
    if (!IMAGE_PROVIDERS[chosen]) throw new Error(`Unknown image provider ${chosen}; use ${Object.keys(IMAGE_PROVIDERS).join(', ')}`);
    return chosen;
  }
  const agent = detectAgent(env);
  if (agent === 'none' && !env.ARK_AGENT || AGENTS[agent].imageTool) return 'gpt-image';
  return fallbackProvider(env);
}
const fallbackProvider = env => env.OPENAI_API_KEY ? 'openai-images' : 'comfyui';

/** Home ComfyUI hosts, tried in order: explicit, OmiPC on the LAN, OmiPC on Tailscale. */
export const comfyUrls = (env = process.env) => [...new Set([env.ARK_COMFY_URL, env.COMFY_URL, 'http://192.168.4.245:8188', 'http://100.124.1.2:8188'].filter(Boolean))];

export function imageAction(provider) {
  const record = 'record its prompt/provenance, copy it into this portable project, assign direction.photo and assetIds for this section, then rerun the artwork audit';
  if (provider === 'openai-images') return `Run \`node engine/cli.mjs image --prompt-file <request.txt> --out <project>/assets/<id>.png\` (GPT Image via the OpenAI API), then ${record}. Any agent or a person can run it.`;
  if (provider === 'comfyui') return `Run \`node engine/cli.mjs image --provider comfyui --prompt-file <request.txt> --out <project>/assets/<id>.png\` (local ComfyUI on OmiPC), then ${record}. Any agent or a person can run it. If ComfyUI is not reachable, start it on OmiPC or leave the request pending and say so.`;
  if (provider === 'supplied') return `Add an original image file for this scene (any image tool, or \`node engine/cli.mjs image\` when OPENAI_API_KEY is set), then ${record}. This is agent work when an image tool is available; otherwise leave the request pending and say so.`;
  return `Use the built-in GPT Image tool to create original artwork for this scene, ${record}. Without that tool, \`node engine/cli.mjs image\` does the same through the API. This is agent work, not a user handoff.`;
}

export function capabilities(env = process.env) {
  const agent = detectAgent(env);
  return {
    agent, agentProfile: AGENTS[agent], imageProvider: resolveImageProvider({ env }),
    imageProviders: Object.fromEntries(Object.entries(IMAGE_PROVIDERS).map(([id, p]) => [id, { ...p, available: id === 'comfyui' ? 'probe with `image --provider comfyui`' : id === 'openai-images' ? Boolean(env.OPENAI_API_KEY) : id === 'gpt-image' ? AGENTS[agent].imageTool : true }])),
    visualReview: 'Any vision-capable agent or person records an independent review with approve-review; the machine gate uses the local vision model.',
    audioReview: 'Local only (Whisper, forced alignment, decoded-audio comparison). No hosted model is involved.',
  };
}

/** Generate one image through the OpenAI Images API and write provenance
 * beside it. Deterministic inputs are recorded; the output itself is not. */
export async function generateImage({ prompt, out, size = '1536x1024', model = process.env.ARK_IMAGE_MODEL ?? 'gpt-image-1', env = process.env, fetchImpl = fetch }) {
  if (!prompt?.trim()) throw new Error('image requires a prompt');
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set; use the agent\'s image tool or supply a file instead');
  const response = await fetchImpl('https://api.openai.com/v1/images/generations', {
    method: 'POST', headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt, size, n: 1 }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Image API ${response.status}: ${body?.error?.message ?? 'request failed'}`);
  const b64 = body.data?.[0]?.b64_json;
  if (!b64) throw new Error('Image API returned no image data');
  const bytes = Buffer.from(b64, 'base64'), file = path.resolve(out);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
  const provenance = { provider: 'openai-images', model, size, prompt, revisedPrompt: body.data[0].revised_prompt, sha256: createHash('sha256').update(bytes).digest('hex'), createdAt: new Date().toISOString() };
  await writeFile(`${file}.provenance.json`, JSON.stringify(provenance, null, 2) + '\n');
  return { path: file, provenancePath: `${file}.provenance.json`, ...provenance };
}

/** Default text-to-image graph for a standard checkpoint. A custom API-format
 * workflow (ARK_COMFY_WORKFLOW) may use {{prompt}}, {{negative}}, {{seed}},
 * {{width}} and {{height}} placeholders for models that need other nodes. */
export function comfyWorkflow({ prompt, negative = 'text, watermark, logo, blurry, deformed', seed, width, height, checkpoint, template }) {
  if (template) {
    const values = { prompt, negative, seed, width, height };
    const fill = value => typeof value === 'string' ? (/^\{\{(\w+)\}\}$/.test(value) ? values[value.slice(2, -2)] : value.replace(/\{\{(\w+)\}\}/g, (_, key) => String(values[key]))) : Array.isArray(value) ? value.map(fill) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v)])) : value;
    return fill(structuredClone(template));
  }
  return {
    1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: checkpoint } },
    2: { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['1', 1] } },
    3: { class_type: 'CLIPTextEncode', inputs: { text: negative, clip: ['1', 1] } },
    4: { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } },
    5: { class_type: 'KSampler', inputs: { model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0], seed, steps: 28, cfg: 5.5, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1 } },
    6: { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    7: { class_type: 'SaveImage', inputs: { images: ['6', 0], filename_prefix: 'ark' } },
  };
}

async function reachableComfy(env, fetchImpl) {
  for (const url of comfyUrls(env)) {
    try { const response = await fetchImpl(`${url}/system_stats`, { signal: AbortSignal.timeout(4000) }); if (response.ok) return url; } catch {}
  }
  throw new Error(`No local ComfyUI reachable at ${comfyUrls(env).join(', ')}; start ComfyUI on OmiPC (listening on the network) or set ARK_COMFY_URL`);
}

/** Generate one image with local ComfyUI: queue the graph, wait for its
 * history entry, download the first saved image and record provenance. */
/** Workflows shipped for the models installed on OmiPC. `ARK_COMFY_WORKFLOW`
 * takes one of these names or a path to any API-format workflow. */
export const COMFY_PRESETS = Object.freeze({
  'qwen-image': new URL('./comfy/qwen-image-2.1.api.json', import.meta.url),
  'krea2-turbo': new URL('./comfy/krea2-turbo.api.json', import.meta.url),
});

export async function generateComfyImage({ prompt, out, size = '1536x1024', seed = Math.floor(Math.random() * 2 ** 31), env = process.env, fetchImpl = fetch, workflow = env.ARK_COMFY_WORKFLOW, pollMs = 1500, timeoutMs = 600000 }) {
  if (!prompt?.trim()) throw new Error('image requires a prompt');
  const [width, height] = size.split('x').map(Number);
  const url = await reachableComfy(env, fetchImpl);
  let checkpoint = env.ARK_COMFY_CHECKPOINT;
  if (!workflow && !checkpoint) {
    const info = await (await fetchImpl(`${url}/object_info/CheckpointLoaderSimple`)).json();
    checkpoint = info.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0]?.[0];
    // OmiPC has no classic checkpoints; its installed image model is Qwen-Image.
    if (!checkpoint) workflow = 'qwen-image';
  }
  const workflowPath = COMFY_PRESETS[workflow] ?? workflow;
  // Workflows saved by ComfyUI on Windows may start with a UTF-8 byte order mark.
  const template = workflowPath ? JSON.parse((await (await import('node:fs/promises')).readFile(workflowPath, 'utf8')).replace(/^\uFEFF/, '')) : undefined;
  const graph = comfyWorkflow({ prompt, seed, width, height, checkpoint, template });
  const queued = await fetchImpl(`${url}/prompt`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: graph, client_id: 'ark-video-studio' }) });
  const queuedBody = await queued.json();
  if (!queued.ok || !queuedBody.prompt_id) throw new Error(`ComfyUI rejected the workflow: ${JSON.stringify(queuedBody.error ?? queuedBody.node_errors ?? queuedBody).slice(0, 400)}`);
  const id = queuedBody.prompt_id, started = Date.now();
  let image;
  while (!image) {
    if (Date.now() - started > timeoutMs) throw new Error(`ComfyUI job ${id} did not finish within ${timeoutMs / 1000}s`);
    const history = (await (await fetchImpl(`${url}/history/${id}`)).json())[id];
    if (history?.status?.status_str === 'error') throw new Error(`ComfyUI job ${id} failed`);
    image = Object.values(history?.outputs ?? {}).flatMap(output => output.images ?? [])[0];
    if (!image) await new Promise(resolve => setTimeout(resolve, pollMs));
  }
  const view = await fetchImpl(`${url}/view?${new URLSearchParams({ filename: image.filename, subfolder: image.subfolder ?? '', type: image.type ?? 'output' })}`);
  if (!view.ok) throw new Error(`ComfyUI image download failed (${view.status})`);
  const bytes = Buffer.from(await view.arrayBuffer()), file = path.resolve(out);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
  const provenance = { provider: 'comfyui', host: url, promptId: id, checkpoint: template ? null : checkpoint, workflow: template ? workflow : 'default-checkpoint-graph', seed, size, prompt, sha256: createHash('sha256').update(bytes).digest('hex'), cost: 'Local GPU only; no paid API generation', createdAt: new Date().toISOString() };
  await writeFile(`${file}.provenance.json`, JSON.stringify(provenance, null, 2) + '\n');
  return { path: file, provenancePath: `${file}.provenance.json`, ...provenance };
}
