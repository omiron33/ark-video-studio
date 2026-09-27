# Genesis 4 — spatial lyric revision

The revised 5:12 red, black and white film is available as OmiPC candidate **vid-20260927-9e73681b**, pending Shane's review.

- [Download the MP4](https://omipc.taild60b4e.ts.net/api/admin/videos/vid-20260927-9e73681b/media?download=1)
- [Open the OmiPC video review page](https://omipc.taild60b4e.ts.net/studio#videos) — select “Genesis 4 - The Brother's Blood”, version “Spatial lyric choreography v2”.
- Local reviewed file: `/Users/shanefisher/Movies/Genesis4-motion-v2-work/film-final.mp4`.
- Photos: **Genesis 4 - Motion v2**, containing the imported video. Native playback advanced to 00:11 and displayed the revised opening; the library reports **Synced to iCloud**. The iPhone itself was not checked.

Final SHA-256: `21a351db6f10d75e48dd32afeb399ee10b608737259f416458f686c7c94e5777`. The served OmiPC file has the same hash and HTTP byte-range playback returned 206. The movie is 1920 × 1080, 30 fps, 312 seconds, H.264/AAC, 37,256,773 bytes. See [upload evidence](review/candidate-upload-result.json) and [delivery status](review/delivery.json).

## What changed

This revision preserves all 498 canonical words, their source timings, original song and measured beats. The club attack and embodied Christophany interrogation compositions remain intact. Two adjacent-phrase sequences become continuous camera journeys, producing 84 sections, including 77 lyric sections.

All 32 registered camera/semantic choreographies are used, alongside two preserved bespoke scenes: 34 treatments, each used at most three times, with no adjacent duplicate or repeated three-treatment sequence. Word paths, camera runs, depth changes, rail/crane moves, opposing clauses and semantic actions replace the previous repeated background sequence. Readable phrase holds remain part of the motion. These counts describe the authored plan; actual visual acceptance is documented separately below.

The early title uses Archivo Black and a newly generated photoreal landscape of two offering altars. [Opening provenance](sources/opening-provenance.json) records the exact prompt and built-in GPT Image generation. The final asset is [eden-altars-opening.png](assets/eden-altars-opening.png). Other accepted story images are preserved; the artwork audit found 11 unique photographic scene assets and no byte-identical reuse.

## Verification and limits

- Technical inspection passed on the final encode: expected frames/dimensions/duration, full packet decoding, and exact output/source-revision binding. See [render report](review/render-final.json) and [gauntlet summary](review/gauntlet-summary.json).
- Three range reviewers inspected all 84 scenes in chronological decoded sheets and dense frame sequences. Initial review found held-text overlaps. One bounded correction resolved them and corrected phrase grouping; all seven changed scenes passed final reinspection. The other 77 encoded scene chunks are byte-identical to the reviewed initial cut. See [visual summary](review/independent-visual-summary.json), [opening](review/opening-final.json), [middle](review/middle-final.json), [ending](review/ending-final.json), and [changed-section proof](review/changed-sections.json).
- Some range reviewers also authored engine modules. This is a disclosed internal review, not a fully external blind panel. The review is visual; no hearing claim is made.
- The full suite passed **199 tests** before the bounded repair; **19 relevant tests** passed afterward. Logs: [before](review/tests-before-repair.log), [after](review/tests-after-repair.log).
- Decoded audio matches the supplied source with correlation **0.999583**, measured offset **0 seconds**, and matching 312-second duration. Strict automatic phrase and sung-word certification still **failed**, as it did on the accepted original; canonical timings were preserved. The gauntlet therefore retains `machine_audio_review_failed` despite technical and visual approval. See [audio summary](review/audio-review-summary.json).
- Native OCR recognized **494 of 498 words (99.20%)**. The strict all-word OCR gate remains **failed** for “low”, “rightly”, “so”, and “wives”. A [separate final-frame visual check](review/ocr-exceptions-final.json) found all four words visible and unobstructed. That judgment does not change the raw machine OCR failure. See [visibility summary](review/lyric-visibility-summary.json).

The review directory preserves all six initial/final range judgments, exact render and upload records, and bounded summaries of large machine reports. Summaries retain original report paths, sizes and SHA-256 hashes. Full frame inventories and inference evidence remain under `/Users/shanefisher/Movies/Genesis4-motion-v2-work/`.

## Editing

The manifest is the editable source. Preview with:

```sh
node engine/cli.mjs serve --project projects/genesis4-motion-v2/project.json
```

Render with:

```sh
node engine/cli.mjs render --project projects/genesis4-motion-v2/project.json --out output/genesis4-motion-v2.mp4
```

`scripts/revise-genesis4-motion.mjs` records the targeted authoring operation; do not rerun it over subsequent manual direction edits. The original film and review candidate remain preserved in `../genesis4-full/`. The accepted Genesis 7 film remains unchanged.
