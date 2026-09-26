# Goal: s01 to s04 preview of "Genesis Chapter 7" with more motion and kinetic scripture typography

This supersedes the FULL_GOAL.md render work for now. The detached genesis7_full render may finish on its own; leave its output alone. Do not start a new full render.

## Output
- `~/storybook/full2/preview/s01_s04_preview.mp4`: song time 0.000 to 24.102 s, shots s01 to s04, 1920x1080 (or 1280x720 if needed), 24 fps, H.264, song audio muxed as AAC for exactly that span. Cuts land exactly on the shot in/out times.
- `~/storybook/full2/preview/frames_contact.png`: contact sheet of about 12 frames sampled across the clip with timestamp labels, including at least one frame while each lyric word is on screen (Then, the, Lord, said, to, Noah).
- Verify with ffprobe (video + audio streams, duration about 24.1 s). Look at the contact sheet and frames yourself and fix problems before calling it done.
- Record render time and a short per-shot report in STATUS.md. Commit to git at milestones. Never use em dashes in any text, commit message, or on-screen type.

## Inputs
- Stills (1280x720): `~/storybook/full2/stills/s01_plain_storm.png`, `s02_storm_low_grass.png`, `s03_command_ridge.png`, `s04_light_on_stone.png`
- `~/storybook/full2/shotlist.json`: 72 shots. Use s01 to s04. Each has in/out, lyric, per-word timings (`words`), `verse`, `camera`, `motion`, `text_treatment`.
- `~/storybook/song.mp3`, `~/storybook/lyrics.json`, `~/storybook/audio.json` (beats, bars_4_4 = downbeats).

## Rules
- Pure code only: Python, numpy, PIL/OpenCV, ffmpeg, and the existing depth/parallax pipeline in this repo (2.5D parallax from stills). No AI video models, no image_to_video, no ComfyUI, no remote machines.
- Build a REUSABLE effect engine for all 72 shots: a per-shot config (e.g. `timeline/full2_fx.json` or yaml) that lists camera move, motion layers with parameters, and a text treatment name with parameters. The renderer reads shotlist.json + that config. The full 72-shot video comes next, so keep it general and fast.

## What good looks like
### Much more motion than the previous version
- Stronger parallax camera moves driven by the depth map (clearly visible push/slide/crane/tilt, with enough overscan so no edges show).
- Animated layers per shot: rolling cloud layer (sky region scrolls/warps), blowing dust particles, wind-swayed grass via displacement in the foreground, fog drift, flickering god-rays, dust motes glowing in light beams, distant lightning glow on beats.
- Camera accents on downbeats (small push or shake on bars_4_4 times), gentle and musical.

### Per shot
- s01 0.000 to 6.084, instrumental. Camera: slow push in. Motion: rolling clouds, ground fog, distant lightning glow on the horizon (teal band) on beats, dust on wind. Text: title "GENESIS 7" faintly condenses out of fog, letters drifting in like dust particles that gather into the glyphs. Verse layer: "Genesis 7:4" with "For yet seven days, and I will cause it to rain upon the earth".
- s02 6.084 to 10.588, word "Then" at 10.00 to 10.45. Camera: low slider across the grass. Motion: grass sway (displacement on the foreground wheat), dust gusts, cloud creep, one far lightning flicker. Text: lightning-flash reveal: the word burns in pure white for two frames (with a frame flash), then leaves a teal afterimage glow that decays. Title "GENESIS 7" can carry over or re-flash here too. Verse layer: "Genesis 7:4" with "every living substance that I have made will I destroy".
- s03 10.588 to 17.369, words "the" 11.00, "Lord" 12.01, "said" 13.01 (ends 14.55). Camera: slow crane up and push. Motion: god-ray flicker in the light shaft, drifting fog, dust motes in the beam, faint cloak flutter on the tiny figure. Text: type descends inside the light shaft (upper left to center), each word landing softly like slow dust settling, glowing with the beam. Keep words clear of the tiny figure. Verse layer: "Genesis 7:1" with "And the LORD said unto Noah".
- s04 17.369 to 24.102, words "to" 20.37, "Noah," 20.87 (ends 21.24). Camera: slow tilt down. Motion: beam shimmer, dust motes in the beam, cloak hem stir, slow fog. Text: words chiselled into the lit rock (right side, on the rock face or in the dark area above it): letters cut in with an engraved bevel/inner shadow, small stone chip particles flicking off each letter as it is carved. Verse layer: "Genesis 7:1" with "for thee have I seen righteous before me".

### Typography
- Every lyric word appears on its exact start time from lyrics.json / shotlist words (within one frame) and holds readably (at least until the next word or the shot end, fading gracefully).
- Each shot uses its own unique animated treatment above, not plain subtitles.
- Secondary scripture layer in every shot: small, elegant, verse reference plus snippet, with its own gentle reveal (e.g. letter-by-letter fade or tracking-in), placed in negative space, never covering the main word.
- Download and use an open-license font (for example Cinzel or Cinzel Decorative for the hero words, Cormorant Garamond or EB Garamond italic for the scripture; IM Fell is fine for a distressed feel). Store fonts in the repo (e.g. `assets/fonts/`) with their license file.
- Text sits in negative space, readable against the background (soft shadow/glow), not cheesy, no bright rainbow colors.

### Look
- Teal and amber grade, film grain, crushed blacks preserved, subtle vignette. No black frames, no flicker glitches, no stretched edges, no parallax holes.

## Done when
The mp4 and contact sheet exist, ffprobe checks pass, you have looked at the contact sheet and word frames and they meet the above, STATUS.md has the per-shot notes and render time, and the work is committed.
