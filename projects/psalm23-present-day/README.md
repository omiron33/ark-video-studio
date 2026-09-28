# Psalm23 — Held in the Ordinary

Theme 1 was selected explicitly by Shane. This is a custom editable HyperFrames lyric film for the exact Suno song `32885123-f4b6-42e6-a546-f4acba404829`. The current cut uses contemporary scenes of protection, integrated lyric animation, two generated motion-graphics clips and two generated clips with Jesus and people. No previous film artwork is reused.

Current cut: the full v5 film is rendered at `/Volumes/DATA/ArkRender/psalm23-present-day/psalm23-held-in-the-ordinary-v5.mp4`, SHA-256 `9a3f691b0c58490a363cfe100df7cb075b6e9a40f5e532827bb58f85931a45a6`. The four clips enter at 43.834, 65.826, 120.305 and 163.855 seconds. Replacement stills show Jesus seated beside a distressed woman and guiding another woman from a dark underpass. The POV clip shows a crying woman look up, clasp Jesus's reaching hand, and smile as he helps her rise; she remains bent inside the underpass at the cut. The previous v2 movie and OmiPC candidate `vid-20260927-31bdda7a` remain preserved.

OmiPC v5 candidate `vid-20260928-aa61434f` is registered **pending Shane review**. The app's complete master download matched the local SHA-256, its thumbnail matched the poster, HTTP range playback returned 206, and frames advanced in the app's browser video player. All 25 earlier candidates were preserved. The delivery receipt is in `delivery-tools/runs/9a3f691b0c58490a363cfe100df7cb075b6e9a40f5e532827bb58f85931a45a6/app-delivery.json`.

V5 technical review passed whole-file decode, source binding, source-audio preservation, temporal activity and encoded OCR for all 210 words. Independent encoded visual review accepted the film with scores 8.4 legibility, 8.0 motion, 8.6 photorealism, 8.4 composition and 8.5 continuity. It inspected all 39 phrase sheets and 11 scene transitions. V5 was imported into the **Psalm 23 - Held in the Ordinary** Photos album; the album shows one 3:40 movie, and actual seeking/playback at the POV rescue and hospital scenes succeeded. Photos also shows an unsupported-format badge, so album presence alone is not the playback evidence.

**Strict singing-sync certification remains incomplete:** the v5 acoustic gate passed 153/210 words, left 55 unsupported and disputed two model matches. Independent spot checks confirmed 103 lyric onsets visually or by OCR, including the repaired separation of “paths of” on both sung frames. Those checks cannot turn unsupported acoustic matches into an automatic pass. The v5 review candidate preserves this exception. See the versioned review folders under `/Volumes/DATA/ArkRender/psalm23-present-day`.

Audio is219.960seconds; output target1920×1080,30fps,H264/AAC.6599frames represent219.966667seconds,6.7ms beyond the container duration. The original source is unchanged. Source acoustic preparation retains44 uncertain words after bounded local CTC/Whisper review; the actual encoded gate remains separate.

## Authored sources

- `build.mjs` compiles `composition.html.txt`, `opening.js`, `choreography.js` and the semantic-motion extension into `index.html` and `scene-plan.json`.
- `sources/words.json` provides210 literal performed words and39 stable phrase IDs; `performance-lyrics.txt` excludes only provider section headings.
- `provenance/photos.json` records the original12 generated photographs; replacement-still and video provenance is under `video-generation/`.
- `video-generation/README.md` and the per-clip provenance files record the local H3 workflow, frame counts, prompts and sampled limitations.
- `concepts/theme-choice.json` preserves Shane's chosen direction. Reference provenance and preliminary critique are recorded alongside it.

## Rebuild and review

```sh
npm run build
npm run check -- --snapshots
node review.mjs --prepare
node review.mjs --preflight
```

Use the pinned HyperFrames 0.8.81 renderer for the next revision. See `REVIEW_ADAPTER.md` for mandatory source snapshots before and after encoding, whole-file decode, source/encoded PCM comparison, exact lyric OCR, strict acoustic and temporal review, and independent visual review bound to the actual MP4. Heavy renders/evidence belong under `/Volumes/DATA/ArkRender/psalm23-present-day`, outside this nearly full code volume.

See `delivery-tools/README.md` for hash-verified, idempotent registration in the OmiPC app. Candidate status remains pending Shane review, never user approved. Native Photos import is verified separately; import does not prove iPhone synchronization.
