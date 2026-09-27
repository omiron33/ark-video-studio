# Genesis 4 — Vengeance and Mercy v3

The revised 5:12 film is delivered as OmiPC candidate **vid-20260927-d1bfc5f0**, awaiting Shane's review. The v1 and v2 films remain preserved.

- [Download the MP4](https://omipc.taild60b4e.ts.net/api/admin/videos/vid-20260927-d1bfc5f0/media?download=1)
- [OmiPC approval page](https://omipc.taild60b4e.ts.net/studio#videos): select “Vengeance, mercy and lineage v3”. Web playback advanced to 0:38 and was paused.
- Photos album: **Genesis 4 - Vengeance & Mercy v3**, containing one video. Native playback advanced to 01:12; the library reports **Synced to iCloud**. The iPhone itself was not checked.
- Local copy: `/Users/shanefisher/Movies/Genesis 4 - Vengeance and Mercy - v3.mp4`.

The film is 1920 × 1080 at 30 fps, 312 seconds, H.264/AAC, 33,661,545 bytes. Final SHA-256: `6f1d33843be71917ff109d834d536452fa6e8bba9d7b195c156cc7ea235097ca`. Local, Photos handoff and OmiPC-served bytes match. Range playback returned HTTP 206. See [delivery evidence](review/delivery.json) and [upload evidence](review/candidate-upload-result.json).

## Changes

The original audio, measured beats and all 498 literal lyric words are preserved. Two cue intervals near 2:29 were corrected only where two local acoustic alignments agreed; the other 496 remain unchanged. The opt-in immediate-onset renderer removes the prior 110ms text opacity ramp and lets camera travel settle by the next sung phrase. See [measured repairs](sources/measured-cue-repairs.json) and [applied validation](sources/applied-cue-validation.json).

Ten repeated linear scenes now use distinct filled-form treatments: circular word orbits, crushing stone, redaction slabs, concentric rupture, torn monuments, typographic silhouettes, eclipse discs, impressed seals, rising monoliths and broad crescents. There are 47 distinct registered lyric treatments across 74 lyric sections; none appears more than three times, with no adjacent duplicate or repeated three-treatment sequence. The complete film has 81 sections. [Creative-policy evidence](review/creative-policy.json) records these structural facts separately from artistic judgment.

The pivotal 253.5–266.067s passage is one sustained vengeance sequence. A massive red 7 is compressed and fractured into 77 on the sung cues; the following 4.833s passage releases its pressure into white, opens its enclosing forms and places Christ beside the words “FORGIVE WITHOUT LIMIT,” explicitly referencing Matthew 18:22. The literal sung words remain “seventy times seven.” The large 77 is an interpretive visual, not a count of victims or a forgiveness quota.

[Orthodox readings and direction](sources/orthodox-reading.md) preserve both Lamech's increased culpability and the patristic reading of sorrow/confession. The new photograph keeps Jesus human and physically present. [The exact GPT Image prompt and provenance](sources/mercy-image-provenance.json) accompany [the saved image](assets/christ-mercy.png).

The genealogy follows the names sung in this source: Cain → Enoch → Gaidad → Maleleel → Mathusala → Lamech. Adam and Eve's other branch is Seth → Enos, with Abel shown as a sibling. New patriarch names ignite as they are sung; the closing tree traces the family relationships with light. Dimming Cain's branch does not imply inherited guilt or biological extinction.

## Editing

The editable manifest is [project.json](project.json). New treatments are reusable engine modules. The authoring script `scripts/revise-genesis4-mercy.mjs` records this revision; do not rerun it over later manual edits.

```sh
node engine/cli.mjs serve --project projects/genesis4-motion-v3/project.json
node engine/cli.mjs render --project projects/genesis4-motion-v3/project.json --out output/genesis4-motion-v3.mp4
```

## Verification and practical limits

- All **219 tests passed**, including lyric-onset behavior, backward-seek determinism, protected text bounds and correct genealogy. See [test log](review/tests.log).
- Full render took **118.33 seconds**. All 9,360 frames and audio packets decoded without errors; expected format, duration, source revision and output hash passed. The gauntlet captured 1,800 frames and 80 transition strips. See [render record](review/render.json) and [gauntlet summary](review/gauntlet-summary.json).
- Actual film was also decoded at six frames per second into 1,872 frames and chronological scene sheets. The primary editor inspected all opening/middle scene overviews and detailed new/changed scenes; a separate reviewer who did not author the code inspected all 27 ending sheets and ten detailed frames. Both found no blocking visual defects. Scores range from 8.4 to 9.0. See [opening/middle review](review/opening-middle-visual-review.json) and [independent ending review](review/ending-visual-review.json). These are sampled visual judgments, with no subjective hearing claim.
- Decoded audio correlation is **0.999583**, measured offset **0 seconds**, matching duration **312 seconds**. The two corrected cues pass with zero measured boundary deviation. Strict sung-word certification remains **failed**: 248 verified, 243 unsupported by the speech-trained recognizers and seven outside tolerance. No further speculative timing edits were applied. See [audio summary](review/audio-review-summary.json).
- Native OCR recognized **494 of 498 words (99.20%)**, with all 1,733 evidence files intact. “low”, “rightly”, “so” and “wives” failed strict OCR; direct full-resolution inspection confirms all four are visible and unobstructed during their windows. See [OCR summary](review/lyric-visibility-summary.json) and [retained exception frames](review/ocr-exceptions-visual.json). The machine gate is retained as failed, not rewritten as a pass.
- The aggregate gauntlet therefore retains `machine_audio_review_failed` despite technical and visual acceptance. This project does not opt into the separate temporal-activity gate; no temporal certificate is claimed. Full machine evidence stays in `/Users/shanefisher/Movies/Genesis4-motion-v3-work/`, while portable summaries retain its hashes and paths.

The finishing loop was bounded: source preview, two concrete legibility cleanups, final render, encoded review, and explicit inspection of the four OCR exceptions. The delivered film was not endlessly revised to chase uncertain recognizer scores.
