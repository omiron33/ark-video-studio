# Automatic audio review and repair

The engine checks the actual rendered movie against the selected song interval. It does not mark listening as a user task or infer approval from a successful encode. `create` runs this review, applies supported word corrections, rerenders affected sections, and repeats the gate. If the available acoustic evidence cannot resolve an error, the workflow returns a concrete failure and retains its diagnostic files.

```js
import { reviewAudio, detectAudioEvents } from './engine/audio-review.mjs';

const report = await reviewAudio({
  projectPath: 'projects/my-song/project.json',
  videoPath: 'output/my-song.mp4',
  outDir: 'output/my-song-audio-review',
  repair: true,
  maxAttempts: 3,
});
```

`status` is `passed`, `needs_repair`, or `failed`. `projectChanged` means the caller must render the revised project before accepting a movie. A lyric correction also sets `requiresDirectorReplan`: the director must rebuild actions around the corrected words. The old manifest is retained under the project's `.revisions` folder, and corrected words preserve previous intervals and acoustic evidence in provenance. Concurrent project changes cause a refusal to overwrite.

## Measurements and acceptance

The exact lexical-match and single-CTC defaults in this table describe audio-only lyric discovery. Supplied official lyrics use the stricter paired-checkpoint policy below; waveform, duration, AAC, cue-error and mean-score limits stay unchanged.

The report binds its evidence to SHA-256 hashes of the actual video and source audio, plus `computeRevision(projectPath).projectHash`. The gauntlet recomputes those hashes; a report for an earlier movie or project cannot approve a newer result. It requires all five checks below. A passed report is also saved beside the movie as `MOVIE.mp4.audio-review.json`.

| Check | What is measured | Default acceptance |
| --- | --- | --- |
| `decoded_audio_match` | Correlation of decoded mono 8 kHz PCM over the selected source interval, each two-second region, and relative gain | Overall correlation ≥ 0.985; every non-silent region ≥ 0.97; absolute gain difference ≤ 0.75 dB |
| `audio_offset` | Best waveform lag over ±0.5 seconds, refined to one sample at 8 kHz | Absolute lag ≤ 35 ms |
| `audio_duration` | Decoded source interval and encoded stream length versus project duration | Both within 80 ms |
| `lyric_phrase_match` | Normalized word sequence from local recognition of source and encoded audio | Exact lexical match; punctuation/case do not create false mismatches |
| `word_sync` | Acoustic CTC intervals, source/AAC stability, corroborating ASR boundary, and authored cue error | Each word acoustic score ≥ 0.2; mean ≥ 0.55; source/AAC spread ≤ 120 ms; a corroborating ASR start or end within 450 ms; authored onset within 40 ms and end within 80 ms |

Supported repairs use the measured CTC interval even when the old cue happens to fall inside the gate tolerance. The gate tolerance is not an instruction to leave a cue early. Any applied repair requires another render and review.

Whisper's word probability measures recognition confidence, not timestamp accuracy. Its attention alignment can absorb an instrumental pause into the next word. The CTC aligner explicitly allows blank frames between phonetic tokens, which fixed that failure in the showcase. A source/output CTC match is a codec-stability check, not an independent second recognition model. The separate Whisper checkpoints supply recognition and boundary corroboration.

The default English recognition passes use local OpenAI Whisper `base.en` and `small.en`. If they disagree on audio-only lyrics, a bounded retry uses the local `medium.en` checkpoint. A disputed correction needs at least two of the three distinct checkpoints to agree, stronger-model token probability ≥ 0.6, and acoustic CTC support ≥ 0.2. A higher CTC score alone does not overrule recognizer disagreement. Missing stronger models or unresolved disagreement fail explicitly. Supplied official lyrics remain authoritative and are aligned literally; they do not get replaced by an ASR spelling.

The reviewer splits longer songs into phrase windows and retries uncertain boundaries in narrower windows, with at most three attempts. Every review retains its own attempt artifacts in `outDir/passes`, including fresh input/video hashes, decoded PCM hashes, model hashes, cache-hit status, and artifact SHA-256 evidence.

Successful ASR/CTC results persist in `project/.review-cache/audio`, so another review attempt or a picture-only edit can reuse speech inference. The key includes the **actual mono 16 kHz signed PCM consumed by the aligner**, source offset and window, exact checkpoint bytes and path, Python executable/package versions, FFmpeg version, aligner code, backend/task/settings, and forced lyrics. Transcription does not use supplied lyric text, so it can be reused after a spelling correction; forced alignment is always keyed to the literal words. Actual model bytes are hashed again for each review, including a checkpoint replaced at the same path. Threshold decisions, waveform correlation, source/video hashes, and final bindings are recomputed on every review.

Cache writes use atomic replacement. Reads validate the key, identity, result digest, successful status, model/backend/language, source interval, finite ordered word intervals and probabilities, and exact forced text. Failed or malformed entries cause inference to run again; they never count as accepted evidence. Source PCM and model bytes are checked again before storing newly computed results. Cache files are disposable and excluded from Git. No manifest changes are needed to populate the cache.

These are engineering checks with stated thresholds, not a claim of perfect perception. The current CTC checkpoint is trained for English speech; music, unfamiliar pronunciations, overlapping singers, and other languages can exceed its capability. All recognition models can share an error. Mono low-band PCM comparison establishes excerpt and lag fidelity, not a complete stereo or perceptual mastering assessment.

## Supplied official lyrics

When `lyricsPath` or `intake.originalLyrics` supplies canonical text, the engine preserves its literal words. Independent ASR substitutions and omissions remain visible in each word’s `lexicalEvidence`; they cannot rewrite the canonical lyric. CTC and recognition checkpoint identities are the SHA-256 of the actual model bytes. Two encodings of one checkpoint never count as two models.

`assessOfficialWordEvidence(expected, ctcPasses, recognitionPasses, {duration, thresholds})` accepts a cue through one of two explicit routes:

- `official_dual_ctc`: distinct source CTC checkpoints both score at least0.7, their onsets agree within80ms and ends within120ms. A word longer than1.5s also needs independent ASR support of both boundaries.
- `official_ctc_asr`: the selected source CTC score is at least0.2, a distinct source CTC agrees within80ms at the onset and120ms at the end, and an exact original-mix ASR token scores at least0.6 with both endpoints within250ms.

Both routes require the selected CTC checkpoint’s AAC-decoded interval to score at least0.2 and agree at both endpoints within120ms. The literal official token remains unchanged, selected boundaries come from one actual acoustic pass, and raw scores are retained. Scores are model posteriors, not calibrated probabilities of musical correctness. Invalid, zero-duration, out-of-source or malformed passes are rejected. Uncorroborated long intervals cannot pass by absorbing silence. Vocal-separated passes cannot independently vote in these routes. Audio-only lyric discovery retains its original gates.

Official review uses local base and large CTC checkpoints plus independent base/small Whisper recognition. Uncertain words trigger a bounded medium recognition retry and a complete-phrase acoustic retry. Still-unsupported cues fail explicitly. This policy does not guarantee that every difficult sung word can be verified by speech-trained models.

## Resident models and bounded recognition recovery

A review owns one local `audio-worker.py` process and retains at most five checkpoint objects, identified by their actual SHA-256 and architecture. It executes the unchanged numeric implementation in `align.py`. The worker rechecks checkpoint identity, preserves standalone output, and exits at review completion or bounded timeout. Each attempt records worker-code SHA, resident-model hit status and actual inference duration. Set `residentModels:false` to use individual processes. The disk pass cache still binds exact decoded audio, model bytes and inference settings; resident loading does not change those computations.

A real ten-second large-CTC smoke measured11.277s cold and2.256s resident. All twelve word intervals and token probabilities matched the standalone run exactly. Short full-song retries subsequently measured approximately0.5–0.8s in the resident worker. These are observed timings, not latency guarantees.

For supplied official lyrics only, a failed long ASR pass may retain its valid measured tokens as `partial_recognition`. Recovery requires at least20 raw tokens, at most5% invalid tokens, at least10 surviving tokens, and no degenerate run of more than five identical words. Invalid tokens are omitted with their original measurements and reasons; their timings are never filled. The result may corroborate only the surviving exact words. It cannot provide audio-only lyric discovery or forced-alignment evidence. Its cache key explicitly binds the recovery setting and worker implementation hash. The same checks validate cached partial results. A real64-token song window retained63 measured tokens and recorded one zero-duration “male” omission.

Phrase retries prefer a complete contiguous exact phrase independently recognized in the source mix, with mean token probability at least0.6. Every matched token must have finite ordered intervals within the source review window. This chooses a narrower search span, not an acceptance shortcut: all paired acoustic/AAC criteria still apply. A passed review records any sub-tolerance refinements but does not automatically trigger another rerender solely for those refinements; failed cue checks still trigger supported repairs.

## Local installation used for the verified run

No runtime command silently downloads a model or invokes a remote inference API. This Mac uses:

- Python: `/opt/homebrew/Cellar/openai-whisper/20250625_3/libexec/bin/python`
- OpenAI Whisper `20250625`, Torch `2.10.0`, TorchAudio `2.10.0`.
- TorchAudio installed under `/Volumes/DATA/AI/Tools/ark-audio-review/python`; `align.py` adds this local dependency directory automatically.
- Whisper checkpoints under `/Volumes/DATA/AI/Models/Whisper`.
- CTC checkpoint under `/Volumes/DATA/AI/Models/TorchAudio`.

The checkpoint SHA-256 values are pinned here. Whisper's explicit setup download checked its published URL hash; the CTC model was downloaded from the official PyTorch host and hashed locally.

| File | SHA-256 |
| --- | --- |
| `base.en.pt` | `25a8566e1d0c1e2231d1c762132cd20e0f96a85d16145c3a00adf5d1ac670ead` |
| `small.en.pt` | `f953ad0fd29cacd07d5a9eda5624af0f6bcf2258be67c92b79389873d91e0872` |
| `medium.en.pt` | `d7440d1dc186f76616474e0ff0b3b6b879abc9d1a4926b7adfa41db2d497ab4f` |
| `wav2vec2_fairseq_base_ls960_asr_ls960.pth` | `488fd4f16de84438ffc945334278c1b9fb9b7159a806c1080b16111a958c945d` |
| `wav2vec2_fairseq_large_lv60k_asr_ls960.pth` | `7a88965716fbd598a595209bf45c1210a18a6935cfb0cf53527fc986c5543ac7` |

Verified direct forced-alignment command (choose a new output filename when repeating):

```sh
/opt/homebrew/Cellar/openai-whisper/20250625_3/libexec/bin/python engine/align.py \
  --audio projects/genesis7/assets/showcase.wav \
  --backend torchaudio-ctc --task force-align \
  --lyrics output/align-smoke/official-lyrics.txt \
  --output output/align-smoke/forced-ctc-repeat.json \
  --language en --threads 4
```

Without `--model`, that backend discovers the pinned local CTC checkpoint. For another installation, pass an existing checkpoint explicitly and install a matching Torch/TorchAudio pair. The helper's `--backend openai-whisper` supports local `.pt` files, including `medium.en.pt`; `--relaxed-speech` enables the bounded music-backed recognition retry used by the reviewer. API options `python`, `baseModel`, `model` (small checkpoint), `strongModel`, `ctcModel`, `ctcLargeModel`, `threads`, and `passTimeoutMs` select local runtime resources. `ARK_AUDIO_PYTHON` can set the interpreter globally for review.

The CTC implementation follows the state/token alignment approach in the [official TorchAudio forced-alignment tutorial](https://docs.pytorch.org/audio/main/tutorials/forced_alignment_tutorial.html) and loads the architecture from the [official wav2vec2 pipeline definition](https://github.com/pytorch/audio/blob/main/src/torchaudio/pipelines/_wav2vec2/impl.py). Its [checkpoint is hosted by PyTorch](https://download.pytorch.org/torchaudio/models/wav2vec2_fairseq_base_ls960_asr_ls960.pth). The large checkpoint uses the official `WAV2VEC2_ASR_LARGE_LV60K_960H` architecture and [PyTorch-hosted weights](https://download.pytorch.org/torchaudio/models/wav2vec2_fairseq_large_lv60k_asr_ls960.pth), with waveform normalization taken from the official bundle definition. `align.py` sets OpenMP, MKL, Accelerate and Numba thread caps before importing inference packages, in addition to Torch’s own thread limit. Local recognition uses the [official OpenAI Whisper implementation](https://github.com/openai/whisper).

## Musical attack events

```js
const events = await detectAudioEvents({
  audioPath: '/path/to/song.wav', sourceOffset: 120.5, duration: 10,
  outPath: 'output/song-attacks.json',
});
```

The detector measures positive log-energy changes in 20 ms full-band RMS and a 120 Hz low-frequency band, sampled every 10 ms. It returns separated local peaks with measured strength, confidence, and provenance. These are musical attack candidates, not a fabricated beat grid or a guarantee of metrical downbeat position. `create` uses them when no beat file was supplied. Word cues still come from acoustic word timing.

## Real regression evidence

On the selected ten-second showcase, decoded audio correlation was **0.999617**, the weakest two-second region was **0.998366**, detected lag was **0 ms**, and decoded AAC duration was **10.005375 s**. All twelve word intervals were supported. Mean source CTC score was **0.845339**; the weakest word, “below,” remained explicitly **0.352356**.

The audio-only regression intentionally began with small.en's wrong word “blue.” Base.en recognized “below”; medium.en independently recognized “below” with token probability **0.936692**. The engine selected “below,” preserved that non-perfect acoustic score, repaired the manifest, and required redirection/rerender before acceptance. Evidence is in `output/audio-only-candidate-proof/review-medium/audio-review.json`. That repair report is not a final movie acceptance.

The persistent-cache smoke used the same final MP4, then re-encoded the pictures in grayscale while copying its AAC stream. All reviews passed all five audio gates. `output/audio-cache-proof/benchmark.json` records the runs and report paths:

| Actual run | Wall time | Inference reuse |
| --- | --- | --- |
| Empty persistent cache, final MP4 | 24.427 s | 0 hits, 5 computed passes |
| Same MP4, different review directory | 8.908 s | 5 hits, no inference |
| Different grayscale video, identical decoded audio | 0.795 s | 5 hits, no inference |
| Final MP4, repeated after strict cache validation | 0.635 s | 5 hits, no inference |

The two movie files have different SHA-256 hashes; encoded PCM hashes agree exactly. Each report binds to its own movie bytes. Disk caching and concurrent local workloads affect total wall time; these measurements are observed runs, not latency guarantees.

```sh
node --test tests/audio-review.test.mjs tests/import.test.mjs
```

These tests exercise measured lag/gain, substituted audio, real attack extraction, wrong lyrics, pause absorption, insufficient acoustic support, correction of small early cues, persistent reuse, audio/model/lyrics/runtime invalidation, and rejection of malformed or failed cache data. Integration evidence comes from the actual source and encoded movie runs, not mocked model outputs.
