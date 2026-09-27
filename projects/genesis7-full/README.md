# Genesis 7 — full lyric film

This is the complete 367.1667-second film, built around 537 canonical lyric words in 66 individually replaceable scenes. The original song stays on one continuous audio timeline. The approved ten-second choreography is retained at the flood's climax with the full film's darker palette.

The visual direction uses charcoal, storm slate, weathered silver and restrained rust. Seven locally bundled fonts have separate roles: carved Cinzel, condensed Barlow, heavy Anton and Bebas, Archivo Black, and the serif voices of IM FELL English and Cormorant Garamond. Approximately 63% of the running time uses drawn motion graphics; photographs support the other scenes as backgrounds.

Words assemble, pair, part, rise, travel, curve over mountains, pass through a letter, dissolve, and disappear beneath water. Instrumental passages use the chapter numeral, timekeeping, a receding ark and an unbroken horizon. The closing image remains in the flood; it does not introduce a premature mountain landing.

## Work on the film

Run from the repository root:

```sh
node engine/cli.mjs serve --project projects/genesis7-full/project.json --port 4178
node engine/cli.mjs render --project projects/genesis7-full/project.json --out output/genesis7-full.mp4
node engine/cli.mjs render --project projects/genesis7-full/project.json --section g7-lifted-the-ark --out output/lifted-the-ark.mp4
```

Tell an agent the scene or time range and the intended visual change. Scene `direction` contains the typography, word placements and actions; canonical words retain stable IDs and absolute times. Change the art independently from those timing records. Triggered actions name the actual word ID; `afterTargets` can preserve the complete reading hold before departure. `fragments` dissolve individual letters after the sung word has ended. `countTimeline` animates an instrumental clock without inventing vocal cues.

The manifest is the current authored version. `scripts/build-genesis7-full.mjs` documents the initial scene assembly; rerunning it would replace subsequent art direction. Preserve the current manifest when making new edits. `choreography-patches.json` records a subset of the reviewed scene improvements and is not a complete reconstruction script.

Generated art provenance and font licenses are stored beside the assets. The original MP3 and canonical source lyrics are included locally. Models and generated intermediates live outside source control; no paid video-generation service is required.

## Review

The engine decodes the actual encoded film for frame/format checks, native word-visibility OCR, visual review and temporal activity checks. This film opts into a 2.8-second near-static limit. That detector measures pixels and cannot judge whether motion is meaningful; independent scene review remains part of the gauntlet.

The audio reviewer compares the encoded audio with the source and analyzes literal sung-word timing using local recognition/alignment models. Measured evidence, unresolved words and repairs are recorded without promoting raw acoustic scores into guarantees. A render is not an acceptance report. Current output-specific reports live under `output/` and must match the exact delivered file.

See [full-song review](../../docs/FULL_SONG_REVIEW.md), [audio review](../../docs/AUDIO_REVIEW.md), and [temporal review](../../docs/TEMPORAL_REVIEW.md) for repeatable commands and gate definitions.
