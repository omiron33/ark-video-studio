# Review contract for Held in the Ordinary

`review.mjs` adapts this custom HyperFrames film to Ark's existing audio, OCR, temporal and independent visual gates. It does not render, deliver, repair timing, score aesthetics or declare that anyone listened.

The expected full film is 1920×1080,30fps,219.96 seconds: 6599 decoded video frames after ceiling to the frame grid, with one AAC audio track. Renderer is pinned to HyperFrames0.8.80; composition ID is `psalm23`.

## Source authority

- Audio: `sources/32885123-f4b6-42e6-a546-f4acba404829.m4a`, SHA256 `3669040e797c9d2bf8b4136dc4c029c6e1ed51f302ccc411d1888ae50da80c8f`.
- Frozen alignment: `sources/words.json`, SHA256 `a0457cf99af4c446721bde09a9f2aa287072d6a3bc478c92a002ff6aa0e3da2c`.
- Literal performed text: `sources/performance-lyrics.txt`, exactly210 words in39 phrases. This is explicitly passed as the audio review's `lyricsPath` and stored in `intake.originalLyrics`; provider section headings must not be forced as sung words. `sources/canonical-lyrics.txt` and the supplied Suno text remain preserved archives.
- Source preparation supports166 words and leaves44 uncertain. These are source-only findings, not an encoded sync pass. The adapter preserves those limitations and never turns the remaining words into supported evidence.

Any legitimate timing revision requires deliberate reconciliation of the frozen-hash constant, rebuilt composition and new render/review evidence. The adapter never does that automatically.

## Cheap preparation and preflight

From `/Volumes/Code/ark-video-studio`, after composition and all media are ready:

```sh
node projects/psalm23-present-day/build.mjs
node projects/psalm23-present-day/review.mjs --prepare
node projects/psalm23-present-day/review.mjs --preflight
```

`--prepare` writes only `project.json`. The manifest has41 contiguous review regions: instrumental opening,39 performed phrases and instrumental ending. Its `verse` style is solely an engine-schema compatibility label; it is not the film's actual renderer. If an input is missing, preparation names it and exits2. Do not render until preflight passes.

Preflight checks exact compiled word IDs/text/times, phrase identity, source hashes, renderer pin, complete review-word coverage and input-file existence. It audits the effective implementation selected for each family. The13 semantic handlers in `semantic-motion.js` take precedence over the26 remaining main switch handlers in `choreography.js`. All old switch cases shadowed by a successful semantic hook are listed as inactive and excluded from the count. The hook registry is initialized in an isolated context with no DOM, Node, network or timeline; production animation handlers are never called. Replacing only that isolated registry's values with spies verifies the actual dispatcher's family selection and true/false return behavior. The main loop must continue before its switch when a hook handles the phrase. The adapter requires at least30 distinct effective bodies/families with no family used more than3 times, and checks both animation source files occur verbatim in the compiled HTML.

This remains a structural test. The preliminary independent critic correctly rejected the earlier39-branch count as insufficient evidence of39 meaningful choreographies: many were cosmetic entrance changes. That prior mechanical count is not an artistic acceptance. Final independent encoded review must group perceptually equivalent motion together and demonstrate at least30 genuinely different mechanisms, with none used more than3times. Commentary differences, offset changes and distinct body hashes cannot satisfy that visual requirement by themselves.

`productionInputs` binds the actual compiled HTML, build script, template, opening, main choreography and semantic hook code, renderer/config files, local GSAP, timeline, scene plan, performed/canonical lyric archives, source analysis, chosen theme and references. All local photo/font/video/poster assets are also bound, including paths found in actual HTML/CSS and the scene plan. Nothing uses a hypothetical default Canvas source list.

## Render provenance order

Use a fresh versioned output path. The adapter refuses to overwrite existing movie provenance. These commands are a contract for the rendering owner; the review adapter itself never invokes rendering.

```sh
PS23_VIDEO='/Volumes/DATA/ArkRender/psalm23-present-day/psalm23-held-in-the-ordinary-v1.mp4'
node projects/psalm23-present-day/review.mjs --video "$PS23_VIDEO" --capture-render-start
npm --prefix projects/psalm23-present-day run render -- . --fps 30 --quality delivery --workers 1 --strict --no-best-effort --output "$PS23_VIDEO"
node projects/psalm23-present-day/review.mjs --video "$PS23_VIDEO" --capture-render-end
```

Start snapshots all declared source and asset bytes plus the engine review/renderer source. Finish requires the same revision and binds the resulting MP4 SHA256. It cannot retrospectively prove a render that started before the snapshot. Do not modify production inputs, rerun build/prepare, or edit this adapter during rendering or review. Review evidence belongs outside production inputs, in the chosen output directory.

## Full encoded review

Choose a new review output directory for each run; previous reports are preserved rather than overwritten.

```sh
PS23_REVIEW='/Volumes/DATA/ArkRender/psalm23-present-day/review-v1'
node projects/psalm23-present-day/review.mjs --video "$PS23_VIDEO" --out "$PS23_REVIEW"
```

This is the costly operation. It performs:

1. FFprobe frame/stream/timebase checks and full video/audio decode.
2. Decoded source/encoded PCM comparison: overall correlation≥0.985, every non-silent segment≥0.97, absolute gain error≤0.75dB, lag≤35ms and duration error≤80ms.
3. Existing strict local paired-checkpoint audio review, a bounded attempt budget (default1, final review3), `repair:false`, with the210 exact performed words. Source estimates, OCR and good PCM correlation cannot override unsupported sung-word sync.
4. Native Apple Vision OCR sampling every canonical word within its actual visibility window. All210 must be observed; no lyric hints or silent manual approvals are supplied.
5. Existing full-frame FFmpeg temporal measurement, maximum static interval4s. A moving texture can satisfy this detector without meaningful choreography; it does not certify artistic motion.
6. Exact render provenance and unchanged input/output hashes across review.

Audio and OCR execute concurrently; temporal review follows. Full reports preserve raw failures and retain their hashes. A normal first run remains pending or failing until independent visual judgment and all machine requirements pass. Exit2 means the gate is incomplete or failed; it is not permission to relabel the result.

## Independent visual judgment

An independent agent/person must inspect decoded sequences from this exact MP4, its opening within the first second, all39 choreographies, transitions, reading holds, phone-scale legibility, contemporary photographic coherence and all three generated/coded composites. In particular, inspect for rectangular video seams, inactive foregrounds, the progressive generated `mercy` letters competing with canonical text, and excessive repetition hidden behind distinct family names. Static sheets alone cannot certify full-speed motion.

Preserve the independent critique, actual inspected evidence and exact movie/revision bindings. The reviewer supplies real scores for only `lyricLegibility`, `semanticMotion`, `photorealism`, `composition` and `continuity`, plus concrete notes. Do not create a subjective `sync` score; machine audio owns that gate. Each visual category must reach8/10, with real failures preserved and repaired first.

After the technical checks pass, use the existing gauntlet command to attach those actual reviewer scores. `PS23_SCORES` points to the JSON file containing the reviewer's five scores; the notes must describe the actual inspected result, not boilerplate.

```sh
node engine/cli.mjs approve-review --report "$PS23_REVIEW/review.json" --project projects/psalm23-present-day/project.json --video "$PS23_VIDEO" --reviewer 'INDEPENDENT_REVIEWER_ID' --scores "$PS23_SCORES" --notes 'ACTUAL_CONCRETE_REVIEW_NOTES'
node projects/psalm23-present-day/review.mjs --video "$PS23_VIDEO" --out "$PS23_REVIEW" --check-review
```

Omitting `sync` makes the existing gauntlet use its visual-only scope. Attaching visual judgment does not override measured audio failure. The final adapter check adds this film's stricter requirement for an independent visual review; a machine-only visual verdict cannot fulfill it. Do not infer acceptance from the original `gate.json` after attaching a later review—run `--check-review`, which recomputes current hashes and evidence validity.

No delivery/import commands are provided here. The production owner handles the final accepted film and any finished previews under the Ark Photos/OmiPC delivery workflow.


## Bounded execution for full-song review

Psalm23 opts into native OCR batches of64 images per process. Each batch keeps the existing180-second deadline, Apple Vision settings, orientations, word windows and full-word visibility thresholds. Actual observations are merged in input order. Other callers retain the existing single-batch behavior. Native execution failures now retain process signal/code/killed diagnostics.

Full review accepts `--audio-max-attempts 1`, `2`, or `3`; default1 preserves prior behavior. For a final encoded review after the authorized bounded follow-up, use3 once to reuse validated acoustic cache entries and the existing medium-recognition/whole-phrase retry policy. This changes the bounded attempt budget only; it does not relax thresholds, repair source timing, or turn unsupported words into passes.

## V2 measured corrections

Seven source-word intervals changed after paired source/AAC inspection of v1; exact evidence and rejected alternatives are preserved in `analysis/timing-repairs-v2.json`. Historical166/44 preparation counts are not a new timing verdict. V1 strict failures remain intact. For final review, hash-copy the finished movie and both provenance sidecars to internal review scratch before OCR/audio extraction; random image seeks on the external data HDD were slow. Capture render-end provenance at the original output path before copying.
