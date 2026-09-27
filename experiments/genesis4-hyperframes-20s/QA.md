# Separate 20-second comparison

The interval is source **250.900–270.900 seconds**, frames **7527–8126** at 30 fps. The experiment has 28 canonical words, five phrases and 55 measured musical onsets. The source manifest and accepted film are read only. No source cue correction is made for this rendering-backend comparison.

## Preparation and comparison

```sh
node experiments/genesis4-hyperframes-20s/prepare.mjs
# Author/render the separate HyperFrames composition to:
# /Users/shanefisher/Movies/Genesis4-hyperframes-20s-work/hyperframes.mp4
node experiments/genesis4-hyperframes-20s/review.mjs
node experiments/genesis4-hyperframes-20s/compare.mjs
```

`prepare.mjs` creates `clip.json` and browser `data.js` (`window.CLIP`), copies the three fonts and accepted Christ photograph, and extracts source PCM to `assets/song.wav`. Its separate `baseline.mp4` is a frame-accurate re-encode of the same accepted-film interval. The first preparation binds the original hashes; later preparation refuses to silently adopt a changed original. Files under `review/` and the work directory retain provenance.

Words and phrases use clip-local `start`/`end` while retaining `sourceStart`/`sourceEnd`, original IDs, exact text and full timing provenance. Measured beats likewise use local `time` and retain `sourceTime`. Some source section bounds extend beyond the chosen interval and are deliberately retained as context, rather than being mistaken for new scene-edit decisions.

The side-by-side comparison preserves each 16:9 frame at 960×540 inside a 1920×1080 canvas. Its left panel is **ORIGINAL V3** and right panel **HYPERFRAMES**. There is one continuous audio track from the extracted source WAV. It does not mix or double the two film soundtracks.

## Bounded review

`review.mjs` imports the existing engine's `decodeAudio`/`compareWaveforms` and native Apple Vision OCR. It checks the real MP4's 600 frames, H.264/AAC streams, full decode, exact source-audio correlation/lag, original source hashes and all 28 immutable cue mappings. It captures 40 actual frames at 0.5-second intervals plus native OCR's bounded per-word visibility samples. The review is bound to the encoded video and composition source hashes.

To inspect another output, use `--video /absolute/path.mp4`. `--skip-ocr` is a technical smoke test only; it is never a lyric-visibility approval. Contact sheets and complete reports live in the work directory; concise reports live in this experiment's `review/` directory.

The source v3 acoustic report already covers these words: **13 verified, 15 unsupported, zero supported words outside tolerance**. This evidence is inherited, explicitly identified and retained; it is not relabeled as new HyperFrames acoustic verification. The visual comparison must retain those timing uncertainties. No new full-song speech-model run is necessary to compare two renderers using identical audio and cues.

Final acceptance still needs independent visual inspection of the actual encoded sequence. A technical pass alone is not an animation-quality claim. Any failed OCR word remains unresolved until the actual pixels are inspected or the treatment is repaired.
