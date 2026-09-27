# Genesis 4 — HyperFrames 20-second comparison

A separate experiment over source **250.9–270.9 seconds**. Neither the accepted
full film nor its manifest is edited. The project adapts the engine's canonical
words, measured accents, source audio and existing Christ-mercy photograph to a
seekable HTML/GSAP composition rendered by HyperFrames.

This is an optional experimental rendering path. The main Canvas engine and its
default `create` workflow are unchanged. The engine's prompt-plus-song workflow
exists in `docs/CREATE.md`; no dedicated Ark movie-creation skill had been
installed when this experiment began.

## Design

Five spatial reading stations share one 3D world. The camera crosses between
stations in vocal gaps and settles before the next phrase. Thick rings and
architectural masses give the type weight. A second seven collides with the
first, then the numbers turn pale and open into the photographic mercy scene.
The lower sung lyric stays prominent; the Matthew 18:22 title is supporting
interpretation. Exact song wording is preserved, including “seventy times seven.”

`BRIEF.md` records scope, meaning and inspected reference principles. The photograph
is copied from v3 for a controlled comparison, used once, and not newly generated.
Its original GPT Image provenance remains in the v3 source project.

## Reproduce locally

Requirements: Node 22+, FFmpeg/ffprobe, local Chrome, the parent engine dependencies,
and **HyperFrames 0.8.79**. The CLI was installed globally from npm. Core HyperFrames
skills and music-to-video were installed into `~/.codex/skills` from upstream
commit `950cccdac065442af4fe4ac2f1279fd910d8d28e` using the Codex skill installer.
GSAP 3.14.2 is vendored; fonts, image and audio are local. No account or hosted
rendering is needed. Telemetry was disabled. Disable optional Gemini snapshot
descriptions with `env -u GEMINI_API_KEY`; verification here uses local OCR and
independent inspection of decoded frames.

From this directory:

```sh
node prepare.mjs
node build.mjs
env -u GEMINI_API_KEY hyperframes check . --samples 16
env -u GEMINI_API_KEY hyperframes render . --fps 30 --quality delivery \
  --workers 2 --strict --no-best-effort \
  -o /Users/shanefisher/Movies/Genesis4-hyperframes-20s-work/hyperframes.mp4
node review.mjs
node compare.mjs
```

Edit `composition.html.txt` and `animation.js`, then build. `index.html` contains
the inlined timeline so HyperFrames' static contract checker can inspect it.
Do not author timing in the animation script: `data.js` holds the original word
IDs and source offsets. The numbered structural beats follow those onsets.

## Evidence and practical limits

The first encode took 23.4s. One finishing revision enlarged the last sung lyric
and reduced its competing interpretive heading; the final encode took 19.6s.
Both used hardware-GPU Chrome screenshot capture and local FFmpeg. Authoring and
review time are separate from rendering time. This is not evidence that the new
backend is faster than the native Canvas renderer.

- 1920×1080, 30fps, 600 frames, 20 seconds, H.264/AAC.
- Canonical 28 words and original file hashes preserved.
- Decoded audio correlation 0.99927; zero measured lag.
- Local Apple Vision OCR recognized 27 of 28 words in the final encoded clip.
  It read italic “his” as “bis”; native-frame inspection confirms the correct
  complete word. The raw failure is retained in `review/ocr-exception.json`.
- Full composition lint/runtime/layout checks passed; the revised ending passed
  all 32 sampled contrast checks with no layout findings.
- Independent visual review samples the encoded motion at 6fps and checks native
  ending frames; see `review/independent-visual.json`.

The retained source alignment has 13 acoustically supported words and 15 unsupported
ones in this interval. No supported timing failures were inherited. This test
proves source fidelity and cue preservation, not new acoustic certainty for those
15 words. It does not claim a complete strict whole-song gauntlet pass.

The new rendering is stronger in spatial travel and dimensional geometry; the
older one has a rougher, more scarred texture. Both are included so the creative
comparison remains inspectable. Delivery URLs and exact artifact hashes live in
`review/delivery.json`. Full OCR, waveform and decoded-frame evidence lives under
`/Users/shanefisher/Movies/Genesis4-hyperframes-20s-work/review`.
