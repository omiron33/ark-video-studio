# Autonomous creation evidence

Two actual 1920 × 1080, 30 fps, 10-second videos passed technical, measured-audio, visible-lyric OCR and local-vision gates. No user listening or approval was required. Full measurements and report paths are in [output/automation-proof.json](../output/automation-proof.json).

| Proof | Execution scope | Automatic result | Wall time including inference | Export time |
|---|---|---|---:|---:|
| [Graphic audio-only](../output/create-audio-only-proof/film.mp4) | Clean resume after development fixes; no lyrics, timings or artwork ever supplied | `machine_verified`, attempt 06 | 135.661 s | 4.575 s |
| [Photographic](../output/create-photo-proof/film.mp4) | Fresh uninterrupted creation with automatic correction, replan and rerender | `machine_verified`, attempt 02 | 232.562 s | 3.941 + 5.374 = 9.315 s |

The graphic timing is its successful clean resume, not its original development run. Its rejected/interrupted probes remain in its history. The photographic timing covers the entire fresh invocation, including initial alignment, both exports and all acceptance checks; no external source or manifest edits occurred during it. Hardware was this Mac mini, Apple M4 Pro, 12 CPU cores, 24 GiB RAM.

## Inputs and actual commands

Both used the real excerpt `projects/genesis7/assets/showcase.wav`, SHA-256 `5aad29deb45baddb23843d381c50d64d4e796c7c20108cd8a46ebfb96b987367`. Neither supplied lyrics, timing or beat files. Commands ran from `/Volumes/Code/ark-video-studio`:

```sh
node engine/cli.mjs create \
  --audio projects/genesis7/assets/showcase.wav \
  --style-prompt 'Dark teal graphic kinetic typography. Luminous contours and restrained waves. Let words move with their meaning, and vary the scene composition while keeping every lyric clear.' \
  --out output/create-audio-only-proof --duration 10 --max-passes 3 \
  --resume --replan

node engine/cli.mjs create \
  --audio projects/genesis7/assets/showcase.wav \
  --style-prompt 'Kinetic typography over drawn water and terrain, ending in photorealistic flood imagery. Teal and ivory with warm amber accents. Let words rise, ground open into water, and disappeared sink below after being sung. Keep every lyric clear.' \
  --direction output/create-inputs/genesis7-photo-direction.json \
  --out output/create-photo-proof --duration 10 --max-passes 3 \
  --title 'Genesis 7 photographic proof'
```

The graphic's original invocation omitted `--resume --replan`. The photo direction file supplied existing GPT-generated `flood-gpt.png` and `wave-gpt.png`, assigned them to the scenes and selected `photo: "flood"`; the importer copied them into the portable project. This was not a claim of newly generated images from the CLI.

Both final planners recorded `local-language-model` with actual Ollama `qwen3-vl:4b-instruct` inference. Its installed digest is `ee4b975b58c17ce268cd19d40db35d5edc64603035d2ffc1fee1968eb0947f7b`. The vocabulary planner remains an explicitly labeled base/fallback. Recognition and acoustic alignment used installed local Whisper and TorchAudio models; neither proof invoked a paid API.

## Observed correction and acceptance

Initial recognition returned “Disappeared blue” and attached the opening word to 0.0 seconds. Independent recognition and acoustic alignment supported “below” and an opening onset of 1.242485 seconds. The workflow corrected all 12 cue timings, preserved stable IDs and prior provenance, changed the supported word, requested direction replanning and rerendered. The fresh photo run demonstrated this complete loop in one invocation. Its [first audio report](../output/create-photo-proof/review/attempt-01/audio/audio-review.json) and [automatic replan](../output/create-photo-proof/review/attempt-01/replan.json) retain the evidence.

Both final videos passed all five audio checks: decoded waveform correlation 0.999617, minimum segment correlation 0.998366, measured lag 0 seconds, source/encoded lyric similarity 1.0 and 12/12 supported words. Final cue deltas against the measured reference were zero; mean acoustic confidence was 0.845339. Encoded AAC duration was 10.005375 seconds against the 10-second video. Native OCR observed 12/12 lyrics with no unresolved words. The local vision reviewer scored all five categories at least 8/10 in every scene; aggregate minima were 8. All required art was assigned. Current-source gate checks passed again after completion.

| Stage | Graphic clean resume | Photo fresh creation |
|---|---:|---:|
| Initial alignment | Reused | 9.815 s |
| Initial direction | 12.266 s | 18.761 s |
| First audio review and repair | Earlier attempt retained | 62.828 s |
| Direction replan after repair | Earlier attempt retained | 12.471 s |
| Final audio review | 15.419 s | 6.788 s |
| Technical review | 4.778 s | 5.343 s |
| Visual review including OCR | 98.283 s | 106.774 s |

Export times are above; import and bookkeeping account for the remaining wall time. These totals include real model work. Run records: [graphic](../output/create-audio-only-proof/run.json), [photo](../output/create-photo-proof/run.json). Final gauntlets: [graphic attempt 06](../output/create-audio-only-proof/review/attempt-06/gauntlet/review.json), [photo attempt 02](../output/create-photo-proof/review/attempt-02/gauntlet/review.json).

An independent visual agent inspected actual decoded whole-video sequences, dense transition/ending samples and full-resolution frames without reading the local model's scores. The [graphic review](automatic-graphic-evidence/independent-visual-review.json) scored 8.3 / 8.2 / 8.0 / 8.0 / 8.1. After exact artifact/source/evidence hash checks, the actual `recordVisualReview` and `finalizeRun` APIs succeeded: its current status is `independently_reviewed`, preserving the automatic `machine_verified` attempt. The [photo review](automatic-photo-evidence/independent-visual-review.json) scored 8.3 / 8.2 / 8.0 / 8.2 / 8.1 and remains archived alongside its unchanged automatic result.

## Exact final bindings

| Binding | Graphic | Photo |
|---|---|---|
| Video SHA-256 | `0c8d5a9d547b5158047dce1335c92d622cc199ab519e4aaa691075538d86a790` | `6b653b14a49b3c14cf81d6febaf4d09b4c936c5c5f083137cbbfe4df7b924faf` |
| Project hash | `5f9e0ee8c7901d8c37ed58860b5d1ba9aad976d0e9cc90e620453106b766d705` | `8a6c8345a08ad7cf0c5a8c6b6fa5eff15f2cc98f1e222b7feab51ce374a6174e` |
| Revision hash | `e0e6175526327a48b8a03e7dad229491db8d365bf18288a1f04eb678f44d3cab` | `d29b157db1af614865d3bef2931edfac40b3bf278ca34d2a4f6711b937d8df3d` |

Shared renderer hash: `816bd0f35e518cb3807ecd348ac54d78656ce97bc2d657eebb151c58e97185cc`.

## Limits and previous failures

Earlier development probes failed on source drift, source-binding mismatch, an unsuitable thinking-model template, context/response limits and a weak empty instrumental scene/ending. Reports were preserved, implementation defects repaired and fresh artifacts reviewed. The older known-lyrics generic proof remains a failed predecessor, not a finished deliverable. Valid low scores are not retried simply to obtain a higher score. The frozen implementation passed 67 tests, including 13 creation tests; mocked tests verify control flow, while these real videos establish integration.

This is one 10-second English excerpt, not proof for every full song, language or voice. Audio checks are measured signal/recognition/alignment evidence, not subjective hearing or mathematically perfect sync. Vision inspects chronological sampled frames, not every frame, and model critiques can be mistaken. Independent agent review is an auditable fallback; fresh technical/audio/source gates still apply. Missing requested imagery creates an explicit task for the built-in GPT Image agent workflow and blocks finished status until supplied and reviewed.

Fast edits have separate evidence: [section export performance](performance.md) and the [audio-cache benchmark](../output/audio-cache-proof/benchmark.json). The latter measured 24.427 s cold, 8.908 s first warm, 0.795 s after a picture-only edit preserving AAC and 0.635 s final warm. Those last three reused all five inference passes while rechecking waveform/lag/duration. They are not full fresh-creation timings and are not an apples-to-apples speed comparison with the old Python engine.
