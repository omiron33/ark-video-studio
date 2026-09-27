# Genesis 4 — The Brother's Blood

Final 312-second, 1920 × 1080, 30 fps lyric film. The editable project is `project.json`; all declared assets and intake sidecars are stored beside it. It contains 498 canonical words across 89 scenes and uses 11 distinct photographic backdrops. Generated depictions are photoreal; abstract typography and line animation carry most of the film.

The final accepted style is red, black and white. The embodied human Jesus wears the plain clothing in Shane's approved photographic reference, with the strong light/dark division. Earlier armor, illustrated and hand-beam variants were rejected. The killing lyric at about 1:40 uses the new club-struggle image, with its text placed above the action.

## Edit and render

From the repository root:

```sh
node engine/cli.mjs serve --project projects/genesis4-full/project.json
node engine/cli.mjs render --project projects/genesis4-full/project.json --out output/genesis4-edited.mp4
```

Change only affected sections and preserve word IDs, measured timings and source audio. The renderer caches sections. Use this final manifest for edits; the original authoring recipe and intake remain in `scripts/create-genesis4.mjs` and `projects/genesis4-source`. Twenty bounded acoustic cue adjustments are documented in the source package. Those adjustments are already present in this final manifest.

## Delivery

- Final MP4 SHA-256: `b3648decb79c77c99f6b670406019c659faf0fb216ac4e0dcb3f427e07548eca`.
- [Download the film](https://omipc.taild60b4e.ts.net/api/admin/videos/vid-20260927-ab05f77d/media?download=1).
- [OmiPC review queue](https://omipc.taild60b4e.ts.net/studio#videos): candidate `vid-20260927-ab05f77d`, chapter 4, pending review.
- Mac Photos album: **Genesis 4 - The Brother's Blood**, one 5:12 video. Playback verified; Photos reported **Synced to iCloud** after import.
- Local viewing copy: `/Users/shanefisher/Movies/Genesis 4 - The Brother's Blood.mp4`.

The remote stored and served hashes match the final film; streaming returned HTTP 206. Previous candidates and the accepted Genesis 7 film remain unchanged.

## Review scope and limitations

The exact final encode passed full audio/video decoding, frame count, duration, dimensions and source/render binding. Three independent visual agents inspected all 89 scenes in contiguous ranges, plus temporal samples of important motion and handoffs. All three found no delivery blockers. Their five-category judgments are retained under `review/`; aggregate scores use the minimum of the range judgments, never invented hearing scores.

The engine's decoded soundtrack check passed: correlation 0.999583, zero measured offset, and exact 312-second audio duration. **Strict phrase and word-timing certification did not pass.** Local speech models disagree or have low confidence on some sung words. The film is a technically checked, independently visually reviewed candidate; it is not certified as perfect sync, and its creation run must retain that distinction. No repeated cosmetic finishing loop was performed after visual acceptance.

Native OCR inspected 1,736 encoded frames and recognized 496 of 498 required words (99.60%). A separate independent inspection confirmed both recognizer misses visibly present: the single **I** in **AM I**, and **JUBAL;** where the semicolon was read as an extra letter. The native OCR result remains failed against its strict 100% requirement; the exception judgment and two frame proofs are saved under `review/`. An end-of-file review-sampling error was corrected by clamping capture to the actual encoded stream duration. This changed only review capture, not the rendered film or its source revision.

GPT Image was used through the built-in tool. Source images, the approved reference and exact generation prompts are saved in `../genesis4-source/assets` and `../genesis4-source/sources/*provenance.json`, including `brother-struggle-provenance.json`. The selected fighting asset is `assets/brother-struggle.png`.
