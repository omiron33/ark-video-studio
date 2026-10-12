// MiniMax H3 on a machine's ComfyUI, for the photorealistic setting (photorealistic.mjs).
//
// Code Video Model's early-step conditioning (github.com/code-video-model/CodeVideoModel, Apache 2.0):
// the code render (the proxy) is a reference video only for the first `keep` of `steps` denoise
// steps, so it fixes layout, camera and timing; the remaining steps run without it and draw the detail.
// No model is trained or changed. The machine is the one in ~/.config/ark/machines.json with a ComfyUI
// service; its GPU dashboard queue is honoured (one GPU job at a time, control set to run).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// their style suffix, verbatim from cvm/video.py: the picture sets the look, the prompt the content
export const STYLE_REFERENCE = 'The provided image condition is a visual style reference. '
  + 'Transfer its color palette, lighting, texture, material treatment, rendering medium, '
  + "and overall aesthetic to the generated video. Do not copy the image's exact composition, "
  + "object identity, pose, or spatial layout; follow the main prompt for content and action.";

export const H3 = { width: 960, height: 544, fps: 24, maxFrames: 362 };
// H3 clip lengths are 17k + 5 frames
export const h3Len = (n) => Math.max(5, 17 * Math.ceil((n - 5) / 17) + 5);

// The machine with ComfyUI: { comfy: 'http://host:8188', dashboard: 'http://host:5299' | undefined }
export function findComfy({ file = process.env.ARK_MACHINES ?? path.join(os.homedir(), '.config', 'ark', 'machines.json') } = {}) {
  if (process.env.ARK_COMFY) return { comfy: process.env.ARK_COMFY.replace(/\/$/, ''), dashboard: process.env.ARK_DASHBOARD };
  let list = [];
  try { list = JSON.parse(fs.readFileSync(file, 'utf8')).machines ?? []; } catch {}
  for (const m of list) {
    const svc = (m.services ?? []).find((s) => /comfy/i.test(s.name ?? '') && s.check);
    if (svc) return { comfy: new URL(svc.check).origin, dashboard: m.dashboard, name: m.name };
  }
  throw Error('no machine with a ComfyUI service in ~/.config/ark/machines.json (or set ARK_COMFY=http://host:8188)');
}

const post = async (url, body, timeout = 120000) => {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeout) });
  return r.json().catch(() => ({}));
};
const getJson = async (url, timeout = 30000) => (await fetch(url, { signal: AbortSignal.timeout(timeout) })).json();

async function upload(comfy, file, name) {
  const form = new FormData();
  form.append('image', new Blob([fs.readFileSync(file)]), name);
  form.append('overwrite', 'true');
  const r = await fetch(`${comfy}/upload/image`, { method: 'POST', body: form, signal: AbortSignal.timeout(600000) });
  if (!r.ok) throw Error(`uploading ${name} to ComfyUI failed: ${r.status}`);
  return (await r.json()).name;
}

// Wait for the GPU on the machine's dashboard queue; returns the dashboard job id (null without a dashboard).
export async function claimGpu(dashboard, { description, project, expectMinutes = 20, log = console.log } = {}) {
  if (!dashboard) return null;
  const c = await getJson(`${dashboard}/api/control`);
  if ((c.control ?? c.state) !== 'run') throw Error(`the GPU dashboard is set to ${c.control ?? c.state}; not starting`);
  const { id } = await post(`${dashboard}/api/renders/start`, { agent: 'Claude', origin_machine: 'mac-mini', tool: 'Ark photorealistic (ComfyUI MiniMax H3)', description, project, expected_minutes: expectMinutes, queue: true });
  if (!id) throw Error('the GPU dashboard did not accept the job');
  let last = null;
  for (;;) {
    const r = await post(`${dashboard}/api/renders/${id}/claim`, {});
    if (r.granted) return id;
    if (['stopped', 'failed', 'cancelled'].includes(r.status)) throw Error(`GPU job ${r.status} from the dashboard`);
    if (r.note !== last) { log(`  queued: ${r.note}`); last = r.note; }
    await new Promise((res) => setTimeout(res, 20000));
  }
}
export const gpuProgress = (dashboard, id, note) => id && post(`${dashboard}/api/renders/${id}/progress`, { note }).catch(() => {});
export const gpuEnd = (dashboard, id, status) => id && post(`${dashboard}/api/renders/${id}/end`, { status }).catch(() => {});

// The ComfyUI graph: two ref2va conditionings (with and without the proxy) over one schedule split at `keep`.
// `look` is an image filename already uploaded (or null), `guide` an uploaded clip of the previous
// piece's last frames anchored at frame 0 (or null).
export function workflow({ proxy, look, guide, prompt, frames, steps, keep, seed, prefix }) {
  const ref = (withProxy) => ({
    class_type: 'MiniMaxH3ReferenceToVideo',
    inputs: {
      clip: ['1', 0], vae: ['3', 0], audio_vae: ['4', 0], prompt: look ? `${prompt}\n\nstyle_reference_guidance: ${STYLE_REFERENCE}` : prompt,
      width: H3.width, height: H3.height, length: frames, ref_image_size: 'match',
      ...(look ? { 'ref_images.ref_image_1': ['30', 0] } : {}),
      ...(withProxy ? { 'ref_videos.ref_video_1': ['21', 0] } : {}),
    },
  });
  const g = {
    1: { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors', type: 'minimax', device: 'default' } },
    2: { class_type: 'UNETLoader', inputs: { unet_name: 'minimax_h3_ref2va_pruned_int8_convrot.safetensors', weight_dtype: 'default' } },
    3: { class_type: 'VAELoader', inputs: { vae_name: 'minimax_h3_video_vae_fp16.safetensors' } },
    4: { class_type: 'VAELoader', inputs: { vae_name: 'minimax_h3_audio_vae_fp32.safetensors' } },
    5: { class_type: 'MiniMaxH3SigmaShift', inputs: { model: ['2', 0], shift_video: 12, shift_audio: 3 } },
    20: { class_type: 'LoadVideo', inputs: { file: proxy } },
    21: { class_type: 'GetVideoComponents', inputs: { video: ['20', 0] } },
    6: ref(true),
    16: ref(false),
    7: { class_type: 'BasicGuider', inputs: { model: ['5', 0], conditioning: ['6', 0] } },
    17: { class_type: 'BasicGuider', inputs: { model: ['5', 0], conditioning: ['16', 0] } },
    8: { class_type: 'RandomNoise', inputs: { noise_seed: seed } },
    18: { class_type: 'DisableNoise', inputs: {} },
    9: { class_type: 'BasicScheduler', inputs: { model: ['5', 0], scheduler: 'simple', steps, denoise: 1 } },
    19: { class_type: 'SplitSigmas', inputs: { sigmas: ['9', 0], step: keep } },
    10: { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
    11: { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['8', 0], guider: ['7', 0], sampler: ['10', 0], sigmas: ['19', 0], latent_image: ['6', 1] } },
    22: { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['18', 0], guider: ['17', 0], sampler: ['10', 0], sigmas: ['19', 1], latent_image: ['11', 0] } },
    12: { class_type: 'VAEDecode', inputs: { samples: ['22', 0], vae: ['3', 0] } },
    14: { class_type: 'CreateVideo', inputs: { images: ['12', 0], fps: H3.fps, bit_depth: 8 } },
    15: { class_type: 'SaveVideo', inputs: { video: ['14', 0], filename_prefix: prefix, format: 'auto', codec: 'auto' } },
  };
  if (look) g[30] = { class_type: 'LoadImage', inputs: { image: look } };
  if (guide) {
    // the previous piece's last frames, anchored at frame 0 of both conditionings, carry the shot on
    g[40] = { class_type: 'LoadVideo', inputs: { file: guide } };
    g[41] = { class_type: 'GetVideoComponents', inputs: { video: ['40', 0] } };
    g[42] = { class_type: 'MiniMaxH3AddGuide', inputs: { positive: ['6', 0], vae: ['3', 0], latent: ['6', 1], image: ['41', 0], frame_idx: 0 } };
    g[43] = { class_type: 'MiniMaxH3AddGuide', inputs: { positive: ['16', 0], vae: ['3', 0], latent: ['6', 1], image: ['41', 0], frame_idx: 0 } };
    g[7].inputs.conditioning = ['42', 0];
    g[17].inputs.conditioning = ['43', 0];
  }
  return g;
}

// Run one piece: upload, queue the prompt, wait, download the video to `out`.
export async function generate(comfy, { proxyFile, lookFile, guideFile, prompt, frames, steps, keep, seed, tag, out, onBeat = () => {} }) {
  const proxy = await upload(comfy, proxyFile, `ark-${tag}-proxy.mp4`);
  const look = lookFile ? await upload(comfy, lookFile, `ark-${tag}-look${path.extname(lookFile)}`) : null;
  const guide = guideFile ? await upload(comfy, guideFile, `ark-${tag}-guide.mp4`) : null;
  const r = await post(`${comfy}/prompt`, { prompt: workflow({ proxy, look, guide, prompt, frames, steps, keep, seed, prefix: `ark-photorealistic/${tag}-${seed}` }) });
  if (!r.prompt_id) throw Error('ComfyUI rejected the graph: ' + JSON.stringify(r).slice(0, 1500));
  const id = r.prompt_id, t0 = Date.now();
  for (;;) {
    await new Promise((res) => setTimeout(res, 15000));
    onBeat(Math.round((Date.now() - t0) / 60000), id);
    const h = (await getJson(`${comfy}/history/${id}`))[id];
    if (!h) continue;
    if (h.status?.status_str === 'error') throw Error('ComfyUI failed: ' + JSON.stringify(h.status).slice(0, 2000));
    for (const node of Object.values(h.outputs ?? {})) {
      for (const v of [...(node.images ?? []), ...(node.videos ?? []), ...(node.gifs ?? [])]) {
        if (!/\.(mp4|webm|mov)$/.test(v.filename ?? '')) continue;
        const q = new URLSearchParams({ filename: v.filename, subfolder: v.subfolder ?? '', type: v.type ?? 'output' });
        const res = await fetch(`${comfy}/view?${q}`, { signal: AbortSignal.timeout(600000) });
        fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
        return { promptId: id, seconds: Math.round((Date.now() - t0) / 1000) };
      }
    }
    if (h.status?.completed) throw Error('ComfyUI finished without a video');
  }
}
