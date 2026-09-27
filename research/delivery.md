# Verified delivery

The upgraded source is `/Volumes/Code/ark-video-studio`. Start with [CREATE](../docs/CREATE.md) for a song plus a style prompt, or [ENGINE](../docs/ENGINE.md) for scene editing and preview.

## Showcase

- Movie: `output/genesis7-showcase-final.mp4`, also copied to `~/Movies/Genesis 7 - Lyric Studio - 10s Showcase.mp4` and the current Codex task folder as `Genesis7-10s-Showcase.mp4`.
- Editable source: [project.json](../projects/genesis7/project.json).
- Exact source interval: 221.450–231.450 seconds of the existing Genesis 7 song. The portable project includes its ten-second PCM excerpt.
- Format: 1920 × 1080, 30 fps, 300 frames, 10.000 seconds, H.264/AAC, 3,733,440 bytes.
- SHA-256: `042772eae34ff971aecb8f6f5eaceb780bb5551ac8e1442d15c22b255b457d0d`.
- Two new images were generated with GPT Image. Prompts and asset provenance are saved beside the assets.

The sequence uses word-driven rising motion, drawn mountain contours, a camera move through the actual O in GROUND, and photographic water passing in front of the descending lyrics. The existing v3 film remains available at `~/Movies/Genesis 7 - music video v3.mp4`.

## Verification

The final artifact passed all 13 technical checks, five measured audio checks, native OCR recovery of all 12 required words, and independent visual review (8.0–8.2 across five categories). The formal bound report is `output/showcase-final-gauntlet/review.json`. Its independent judgment is documented in [gauntlet-final-review.md](gauntlet-final-review.md).

Audio comparison measured zero offset and correlation 0.999617 between the source excerpt and decoded export. All 12 word cues match the independent acoustic intervals; uncertain per-word confidence remains recorded rather than inflated. See `output/showcase-final-audio-cached/audio-review.json` and [AUDIO_REVIEW](../docs/AUDIO_REVIEW.md).

All 67 Node tests pass. Tests include actual encoding/muxing, section cache invalidation, transition dependencies, saved edits, downloads, local OCR, measured audio repair, rejection of stale or incomplete reviews, actionable visual repairs, and independent run finalization. Live browser checks covered playback, seeking, frame stepping, section looping, saved direction edits, preview rendering and the MP4 route.

Measured renderer-only timings were 5.52 seconds for a cold ten-second export, 0.43 seconds with all scenes cached, and 1.68 seconds after a one-scene edit. These exclude image generation and model review; see [performance.md](performance.md).

The creation workflow was also tested from audio plus a style brief. The corrected graphic run passed the local model and independent agent review. A fresh photographic run, using the existing GPT assets but no supplied lyrics, word timestamps or beats, completed uninterrupted in 232.562 seconds. It repaired a misrecognized lyric and the word boundaries, replanned, rendered twice, and passed all technical, measured audio, OCR and local visual gates. A separate blind agent review also passed. This duration includes local inference; its two exports took 3.941 and 5.374 seconds. See [automation-proof.md](automation-proof.md) for exact bindings and the preserved earlier failures.

## Practical limits

The engine owns transcription, alignment, audio comparison, visual review and bounded repair. Local models can still be wrong; a passed gate is evidence of these checks, not a promise of a perfect film for every song. New photographic briefs require the orchestrating agent to fulfill GPT Image asset requests and resume automatically. The standalone local CLI cannot call Codex's built-in image tool.

The current semantic vocabulary is extensible and intentionally small. This showcase is an authored example of its strongest treatments; arbitrary new lyrics can require new scene design by the directing agent. The successful automatic runs validate this ten-second English excerpt, not every song or language. Review notes retain the quiet opening, brief THEM hold and photographic-composite water as non-blocking limitations.
