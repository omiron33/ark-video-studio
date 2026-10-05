# Code-only mode

When Claude drives the engine, every frame is drawn by code: type, line, geometry, shaders, particles and procedural texture, driven by measured lyrics and audio. There are no generated or photographic images and no generated video. Codex runs stay in mixed mode unless `ARK_MODE=code-only` is set. `ARK_MODE=mixed` turns code-only off for a Claude run.

## The accepted quality bar

The minimum acceptable film is on par with [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video) ("I'm Upping My P(doom)"), made with Opus 5.5 in Claude Code with no generated imagery. A film that would look weaker placed next to it is not finished. Concretely:

**Output**
- 1920×1080 at 60 fps, x264 CRF 16. Code-only projects get these by default; see `render` in the project JSON.
- Sub-frame motion blur: each frame averages sub-frames over a 0.2-frame shutter. `samples: "auto"` uses 12 sub-frames on still frames and up to 324 on whips and slams, stopping once more would not change the image.
- Every frame is a pure function of song time. Seeking to any frame gives the same pixels as playing up to it.

**Design system**
- One strict palette with one signal colour that owns emphasis and glow. Nothing else blooms, and body type stays crisp.
- Three or four type families with defined roles (the lyric voice, the machine or annotation voice, a rare sacred register, and a hand-written or plotted stroke). Kern properly and use typographic punctuation.
- Swiss-grid discipline: asymmetric layouts, generous negative space, hairline rules, small annotations beside big display type.
- One grain, one post-process and one type system shared across the film, so scenes vary in idiom without falling apart.

**Scenes**
- Each scene is a "plate" with its own visual idiom (engraving, blueprint, oscilloscope, woven cloth, stained-glass lead lines, manuscript, star chart), all inside the shared system.
- A running motif travels through the whole film, transforming from plate to plate (for scripture, for example, a single flame, a thread of light or a line of ink).
- Visual metaphors and transformations, never literal storyboard illustrations of each line.
- The lyric is part of the image: written by the motif, riding a curve, carved, stamped or woven. It is never a subtitle laid on top.

**Timing**
- Every word appears exactly at its measured start and completes by its end. Dim anticipation up to about 0.4 s early is fine; highlighting never runs ahead of the voice.
- Big changes land on the beat: cuts on downbeats, hits on kicks and snares, and camera moves that ease into downbeats. Use strong eases or springs, holds, then snaps. No floaty screensaver motion.
- A hit is not a shake. Land accents with light, scale, a cut or a snap into stillness; shake the frame only for extreme power or a violent collision, and opt that scene in (see [Shake](../photoreal/README.md#shake)).

**Not slop**
- No neon cyberpunk, glowing orbs, lens-flare soup, generic particle nebulae or anything that looks AI-generated.
- No realistic faces drawn in code. Depict biblical figures through silhouette, gesture, line and symbol.
- Don't copy existing artworks or videos; take principles, not frames.

## How the engine enforces it

- `create` detects Claude and starts the project with `creation.mode: "code-only"`, 60 fps and the render settings above. A brief asking for photography is translated into coded treatments, with a warning in the plan.
- The creative preflight fails any code-only scene that uses an image or video asset (fonts are the only permitted files), any code-only project below 60 fps, and any without motion blur.
- The theme-choice gate's four mockups are single still frames rendered by code, not image-model pictures.
- The visual rubric's `photorealism` category is scored as **finish** in code-only mode: anti-aliasing, grain, blur, banding and type crispness, judged against the pdoom renders.

## Drafting quickly

Full quality is slow on the CPU renderer. For a draft, render one section at `--scale .5` after temporarily setting `render.motionBlur.samples` to 4. Restore `"auto"` before the final render; a review binds to the exact render and source revision.

## Photoreal mode

For films that need lit, photographic depth (terrain, water, cloud, timber, feathers), scenes can be
written as GPU shaders and rendered by [photoreal mode](../photoreal/README.md) instead of the CPU
canvas. It keeps the same rules: code-only, 1080p60, sub-frame motion blur, frames as a pure function
of song time, and lyrics placed in the scene. Song scenes live in the song's own repository.
