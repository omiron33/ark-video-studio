# Genesis 7 — dark full-film delivery

The revised **6:07 film** is rendered at **1920 × 1080, 30 fps**, with **11,015 frames**, **66 editable scenes** and **537 canonical lyric words**. This is a visually reviewed delivery with explicit timing uncertainty; the automatic whole-film gate remains **machine_audio_review_failed**.

[Reviewed MP4](../output/genesis7-full-reviewed.mp4) · [Manifest](../projects/genesis7-full/project.json) · [Delivery record](../output/fullsong-delivery.json)

The palette is charcoal and storm slate, with weathered silver type and restrained rust. Seven font families have distinct roles. Words pair, separate, rise, curve over a mountain, pass through a letter, dissolve and submerge. Drawn graphics lead approximately **62.9%** of the runtime; GPT Image photographs support the other scenes. The approved ten-second sequence remains in the climax with the darker palette.

## Actual-file review

- Independent visual review passes all five visual categories after correcting collisions, static intervals and the closing-title clipping. It makes no subjective hearing claim.
- All **537/537** lyric words were recognized by native Apple Vision in the actual encoded movie. Every evidence file has a unique path and a verified hash.
- Every video frame decodes correctly; temporal review found no near-static interval longer than the declared 2.8-second limit.
- The encoded soundtrack matches the source: correlation **0.999609**, weakest two-second region **0.997963**, detected lag **0 ms**.
- Strict local acoustic review supports **425/537** words; **424** meet its authored cue limits. **113** cues remain uncertified. Those failures are preserved; uncertain speech-model evidence is not proof that those words are wrong, and source-waveform agreement cannot certify lyric animation timing.

The automatic “song + style prompt → perfect finished film” goal is **not fully achieved for this song**. The engine performs alignment, rendering, review and bounded repairs, but the available speech models do not resolve every sung cue reliably. This movie is delivered without relabeling the failed audio gate as a pass. The two disputed nights/I estimates retain exact measured ASR evidence and explicit uncertified provenance. The context-sensitive remained estimate is retained with its disagreement documented rather than oscillating through more repairs.

[Independent visual evidence](fullsong-independent-review.md) · [Technical gauntlet](../output/fullsong-independent-encoded-pass06/gauntlet/review.json) · [Complete OCR](../output/fullsong-independent-encoded-pass06/full-ocr/lyric-visibility.json) · [Final audio review](../output/fullsong-audio/final-pass06/audio-review.json) · [Readable audio limits](../output/fullsong-audio/FINAL_AUDIO_REVIEW.md) · [Exact unresolved cues](../output/fullsong-audio/final-unresolved-cues.tsv)

## Editing and performance

The latest 11-scene edit exported the complete film in **27.51 seconds**, reusing 55 scenes. A final two-scene cut correction took **10.04 seconds**, reusing 64 scenes. Cold full renders took approximately 161–172 seconds. These times exclude image creation and full first-pass review. The final shared cut is 159.233333 seconds, keeping both neighboring cues within one 30 fps frame of their measured intervals.

Source checks: **131 tests passed**, project validation passed, and the current browser editor loaded the dark project and closing typography without console errors. The engine's original approved 10-second deliverable is unchanged. See [measured performance and review limitations](fullsong-review-performance.md).

## Exact delivery

SHA-256: `3c369ecf6b0f2318bf918c85ee23c3673dfe4105446cd101cf86eb314d985bd8`

- /Users/shanefisher/Documents/Codex/2026-09-26/we-ve-been-working-on-an/Genesis7-Full-Dark-Lyric-Film.mp4
- /Users/shanefisher/Movies/Genesis 7 - Full Dark Lyric Film.mp4
- /Volumes/Code/ark-video-studio/output/genesis7-full-reviewed.mp4

The project and engine are committed locally. No Git remote is configured, so there is no remote push or public upload. Original v3 footage and historical notes are preserved.
