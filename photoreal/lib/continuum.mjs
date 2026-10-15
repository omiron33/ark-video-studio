// H3-Continuum chaining for the photorealistic setting (photorealistic.mjs, "chain": "continuum").
//
// OPT-IN ONLY ("photorealistic": { "chain": "continuum" } or --chain continuum). Added 2026-10-14 on trial;
// FAILED its trial on 2026-10-15 (King of Glory, hall-of-Hades take T03, 0:31-0:57, steered by the code
// render): the last chunk jumped back to an earlier shot, then showed the raw code layout instead of
// the film, most likely because Continuum applies the guide video at every denoise step (the bridges
// path applies it only for the first `keep` steps). It also ran ~8.5 s per frame on OmiPC.
// The default went back to "bridges". Don't opt a lyric or code-steered take in until that is fixed.
//
// ComfyUI-H3-Continuum (MIT, github.com/ukr8b3g-cmyk/ComfyUI-H3-Continuum, v3.9.4 on OmiPC) makes one
// long H3 take as 5 s chunks in a single job, each chunk carrying the last 22 frames of the one before,
// and assembles the seams. Here a take longer than one H3 piece becomes chains of at most
// maxChainSeconds; each chain is one Continuum job:
//   - steering: the take's code render (the proxy) goes in as Continuum's Timeline Video in "Follow
//     Timeline" mode, so each chunk is steered by its own stretch of the code picture. Continuum applies
//     it for every denoise step (there is no early-step `keep` here), so --proxy-blur matters more.
//   - look: the take's look image is Reference Image 1 for every chunk.
//   - prompt: a Timeline prompt, one section per chunk, with the scenes that chunk covers.
//   - a chain after the first starts from the previous chain's last frame (First Image), which is
//     dropped when the chains are joined.
// Known risks, measured 2026-10-14 on KoG T01 at 960x544 (3 x 5 s, ~80 s of GPU per output second):
// contrast/sharpness climb ~25-35% over three chunks (Continuum Issue #13), a one-frame texture pop at
// each seam, peak VRAM 11.8 of 12 GB on OmiPC's 3080 Ti and ~42 GB host RAM. The chain cap and
// lib/chainmatch.py (each chunk's colour and contrast matched back to the take's first chunk, following
// the code render's own light changes) are the guards against the drift.
import { H3, h3Len } from './h3.mjs';

// how photorealistic.mjs joins a long take when film.json doesn't say
export const DEFAULT_CHAIN = 'bridges';

export const CONTINUUM = {
  chunkSeconds: 5,                       // the chunk length Continuum is validated at
  maxChainSeconds: 15,                   // three chunks; longer takes start a new chain (drift guard)
  continuity: 'Balanced — 22 frames',    // frames each chunk carries over from the one before
  sampler: 'H3ContinuumSamplerV39',
};

// Split a take of n frames into chains (each one Continuum job) and each chain into chunks.
// A chain after the first starts 1 frame early: its frame 0 is the previous chain's last frame.
export function planChains(n, { fps = H3.fps, chunkSeconds = CONTINUUM.chunkSeconds, maxChainSeconds = CONTINUUM.maxChainSeconds } = {}) {
  const maxChain = Math.round(maxChainSeconds * fps);
  const count = Math.max(1, Math.ceil(n / maxChain));
  const chains = [];
  let start = 0;
  for (let i = 0; i < count; i++) {
    // new frames this chain adds, spread evenly so no chain is a stub
    const fresh = Math.round(n * (i + 1) / count) - Math.round(n * i / count);
    const len = fresh + (i ? 1 : 0);
    const chunks = Math.max(1, Math.round(len / (chunkSeconds * fps)));
    // Continuum chunks are 4-30 s; a short chain is one 4 s chunk, trimmed after
    const secs = Math.max(4, Math.round(len / fps / chunks * 100) / 100);
    chains.push({ start, len, chunks, chunkSeconds: secs });
    start += len - 1;
  }
  return chains;
}

// Whether a take uses Continuum: only when it would otherwise be joined from more than one H3 piece
// (a take that fits in one piece has no join and renders exactly as with bridges).
export const usesContinuum = (chain, pieceCount) => chain === 'continuum' && pieceCount > 1;

// The Timeline prompt: one [a-bs] section per chunk (the header alone on its line, as Continuum needs).
export function timelinePrompt(sections, chunkSeconds) {
  const t = (x) => +(x * chunkSeconds).toFixed(2);
  return sections.map((text, i) => `[${t(i)}-${t(i + 1)}s]\n${text.replace(/\n+/g, ' ')}`).join('\n\n');
}

// The ComfyUI graph for one chain. `proxy`, `look` and `first` are uploaded filenames (or null).
// Same models, shift and sampler as the bridges path (lib/h3.mjs); Continuum does the chunking.
export function continuumWorkflow({ proxy, look, first, prompt, chunks, chunkSeconds, steps, seed, prefix, styleReference = null }) {
  const g = {
    1: { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors', type: 'minimax', device: 'default' } },
    2: { class_type: 'UNETLoader', inputs: { unet_name: 'minimax_h3_ref2va_pruned_int8_convrot.safetensors', weight_dtype: 'default' } },
    3: { class_type: 'VAELoader', inputs: { vae_name: 'minimax_h3_video_vae_fp16.safetensors' } },
    4: { class_type: 'VAELoader', inputs: { vae_name: 'minimax_h3_audio_vae_fp32.safetensors' } },
    5: { class_type: 'MiniMaxH3SigmaShift', inputs: { model: ['2', 0], shift_video: 12, shift_audio: 3 } },
    9: { class_type: 'BasicScheduler', inputs: { model: ['5', 0], scheduler: 'simple', steps, denoise: 1 } },
    10: { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
    11: { class_type: 'PrimitiveStringMultiline', inputs: { value: look && styleReference ? `${prompt}\n\nstyle_reference_guidance: ${styleReference}` : prompt } },
    13: { class_type: 'H3ContinuumReferenceAudios', inputs: { reference_audio_vae: ['4', 0] } },
    12: { class_type: CONTINUUM.sampler, inputs: {
      model: ['5', 0], clip: ['1', 0], video_vae: ['3', 0], sampler: ['10', 0], sigmas: ['9', 0],
      sequence_prompt: ['11', 0], audio_vae: ['4', 0], audio_references: ['13', 0],
      prompt_mode: 'Timeline', chunks, chunk_seconds: chunkSeconds,
      aspect: 'Auto from First Image', preset: 'Draft — 0.30 MP', custom_mp: 0.3,
      continuity: CONTINUUM.continuity, base_seed: seed, audio_continuity: true,
      diagnostics: 'Detailed Report', reroll_from_chunk: 'Auto', reroll_nonce: 0,
      strict_compatibility: true, debug: false, show_preview: false, run_storage: 'Off', run_name: '',
      reference_size: 'Match Output', project_id: '', video_reference_size: 'Efficient - 0.4 MP',
      continuation_backend: 'Standard', generation_mode: 'Full Run', review_action: 'Continue / Next',
      take_group: 0, take_revision_id: '', take_action: 'Automatic',
      size_source: 'Manual', width: H3.width, height: H3.height, video_reference_mode: 'Follow Timeline',
    } },
    14: { class_type: 'H3DecodeCacheHelper', inputs: { cache_mode: 'Auto', ram_budget_mb: 256, disk_budget_gb: 8, reset_token: 0,
      video_samples: ['12', 0], video_vae: ['3', 0], audio_samples: ['12', 1], audio_vae: ['4', 0] } },
    15: { class_type: 'H3ContinuumAssembleSeamV35', inputs: { images: ['14', 0], audio: ['14', 1], assembly_plan: ['12', 2], driving_audio: ['12', 4],
      exact_total_duration: true, audio_seam: 'Auto', video_seam: 'Auto', buffer_backend: 'Auto', diagnostics: 'Detailed Report' } },
    16: { class_type: 'CreateVideo', inputs: { images: ['15', 0], fps: H3.fps } },
    17: { class_type: 'SaveVideo', inputs: { video: ['16', 0], filename_prefix: prefix, format: 'auto', codec: 'auto' } },
    18: { class_type: 'PreviewAny', inputs: { source: ['12', 3] } },
  };
  if (proxy) {
    g[20] = { class_type: 'LoadVideo', inputs: { file: proxy } };
    g[21] = { class_type: 'H3ContinuumVideoAdapter', inputs: { video: ['20', 0], force_rate: H3.fps } };
    g[12].inputs.reference_video_1 = ['21', 0];
  }
  if (look) {
    g[30] = { class_type: 'LoadImage', inputs: { image: look } };
    g[31] = { class_type: 'H3ContinuumReferenceImagesV39', inputs: { reference_use: 'All chunks', reference_image_1: ['30', 0],
      ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`reference_r${i + 1}_chunks`, 'off'])) } };
    g[12].inputs.reference_images = ['31', 0];
  }
  if (first) {
    g[40] = { class_type: 'LoadImage', inputs: { image: first } };
    g[12].inputs.first_frame = ['40', 0];
  }
  return g;
}

// Continuum must be installed on the machine's ComfyUI (custom_nodes/ComfyUI-H3-Continuum).
export async function hasContinuum(comfy) {
  try {
    const r = await fetch(`${comfy}/object_info/${CONTINUUM.sampler}`, { signal: AbortSignal.timeout(60000) });
    return r.ok && !!(await r.json())[CONTINUUM.sampler];
  } catch { return false; }
}

// Frames each chunk of a chain covers inside the joined take (for the colour match), nominal.
export function chunkBounds(chains, fps = H3.fps) {
  const bounds = [];
  let at = 0;
  for (const [i, c] of chains.entries()) {
    const fresh = c.len - (i ? 1 : 0);
    const per = fresh / c.chunks;
    for (let k = 0; k < c.chunks; k++) bounds.push([Math.round(at + k * per), Math.round(at + (k + 1) * per)]);
    at += fresh;
  }
  return bounds;
}

export { h3Len };
