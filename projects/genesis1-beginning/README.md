# Genesis 1 — Breath & Earth

Complete lyric film for [The Beginning](https://suno.com/song/b9b82c2c-7c8e-4ef4-9338-942de876644a), 5:04.73 at 1920×1080/30fps. Shane selected theme 3 with charcoal, bone, rust and amber, restrained code imagery, regular supporting footage, and active foreground words. `theme-choice.json` records that authorization.

The authored composition contains 86 performed phrases, 462 canonical words and 63 choreography families, each used at most three times. Four locally generated video inserts (land, vegetation, whale and the reserved Adam formation) and five unique still-art intervals support the word animation. HyperFrames 0.8.79 renders original seekable scene code; library presets do not define the composition.

## Source and rendering

The exact source was reused from the existing OmiPC app track. Audio SHA256: `196c6f8183eb18bc530f4ebb83b1af44532d210deecfacaa465eb6592046bbc2`. Its duration is 304.72s; the rendered duration is padded to 9,142 frames. The supplied 96-line lyric archive remains intact. The performed transcript reflects the recording's repeated lines and excludes unsung supplied lines; see `timing/ALIGNMENT.md`.

`build.mjs` combines `runtime.js`, `opening.js`, the scene modules, measured timing and asset map into `index.html`. `review.mjs --prepare` creates the engine review manifest; its render-start/end operations bind the encoded artifact to all declared source inputs. Render from this directory with `npm run render -- --quality delivery --output <absolute-mp4-path>` after preparation and capture the end provenance afterward. Do not edit production inputs during rendering or review.

## Review and delivery

The full first encode is preserved with its exact source in commit `020644c`. Independent encoded visual review accepted it with no required artistic fixes. Full decode, format, PCM correlation and zero global audio offset passed. OCR found 458/462 words automatically; two reviewers inspected the actual four missed-word frames and found the words readable. The static detector flagged the intentional final 5.4-second settle. These raw failures remain in `review/v1/`, alongside unsupported strict speech-model alignment findings; none is relabeled an automatic pass.

A bounded timing correction addresses one independently supported early entrance; a second model disagreement remains documented. See the final `DELIVERY.md` and versioned review receipts for the delivered artifact and remaining certification limits. Every delivered preview/full version is preserved in Photos and as an OmiPC review candidate. Photos import and playback do not establish iCloud/iPhone synchronization.
