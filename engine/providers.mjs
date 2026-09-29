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
  supplied: { runs: 'any', label: 'An original image file added by a person or any agent' },
});

export function detectAgent(env = process.env) {
  if (env.ARK_AGENT) return AGENTS[env.ARK_AGENT] ? env.ARK_AGENT : 'none';
  if (env.CLAUDECODE === '1' || env.CLAUDE_CODE_ENTRYPOINT) return 'claude';
  if (Object.keys(env).some(key => key.startsWith('CODEX_'))) return 'codex';
  return 'none';
}

/** Explicit choice wins. Otherwise use what the current agent can actually do,
 * falling back to the API, then to a supplied file. When no agent is detected,
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
const fallbackProvider = env => env.OPENAI_API_KEY ? 'openai-images' : 'supplied';

export function imageAction(provider) {
  const record = 'record its prompt/provenance, copy it into this portable project, assign direction.photo and assetIds for this section, then rerun the artwork audit';
  if (provider === 'openai-images') return `Run \`node engine/cli.mjs image --prompt-file <request.txt> --out <project>/assets/<id>.png\` (GPT Image via the OpenAI API), then ${record}. Any agent or a person can run it.`;
  if (provider === 'supplied') return `Add an original image file for this scene (any image tool, or \`node engine/cli.mjs image\` when OPENAI_API_KEY is set), then ${record}. This is agent work when an image tool is available; otherwise leave the request pending and say so.`;
  return `Use the built-in GPT Image tool to create original artwork for this scene, ${record}. Without that tool, \`node engine/cli.mjs image\` does the same through the API. This is agent work, not a user handoff.`;
}

export function capabilities(env = process.env) {
  const agent = detectAgent(env);
  return {
    agent, agentProfile: AGENTS[agent], imageProvider: resolveImageProvider({ env }),
    imageProviders: Object.fromEntries(Object.entries(IMAGE_PROVIDERS).map(([id, p]) => [id, { ...p, available: id === 'openai-images' ? Boolean(env.OPENAI_API_KEY) : id === 'gpt-image' ? AGENTS[agent].imageTool : true }])),
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
