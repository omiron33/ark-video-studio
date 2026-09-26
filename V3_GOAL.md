# Goal: Genesis Chapter 7 v3: kinetic typography as half the show, scene-motivated light

Supersedes the ADDENDUM 5 overlay-only rerender. Build v3 on the full2 engine (plates, sentences.json, render_full2.py, render_sentences.py). Never use em dashes in any text, commit message, or on-screen type.

## Paths (hard rule)
- Output ONLY: `~/storybook/full/genesis7_full_v3.mp4`, `~/storybook/full/genesis7_contact_v3.png`, segments in `~/storybook/full/segments_v3/` (or similar new dir), checks in `~/storybook/full/v3_checks/`.
- Never touch v1 (`genesis7_full.mp4`, `genesis7_contact.png`, `genesis7_full_v1_words.mp4` if present) or v2 (`genesis7_full_v2.mp4`, `genesis7_contact_v2.png`), or the existing `segments/` and `plates/` dirs (read them if useful, never overwrite).
- Same spec: 0 to 367.2 s, 1920x1080, 24 fps, H.264 yuv420p CRF about 20, full song AAC, 72 shots cut on shotlist.json times.

## A) Typography is HALF THE SHOW (kinetic typography, not uniform subtitles)
- Sentence rules stay: one complete sentence at a time; it builds in, is readable as a whole once built, holds until its last word ends, then leaves before the next starts. Also apply: split on periods even mid lyric line; never split one sentence across a lyric gap (hold through it, e.g. "Noah was six hundred years old when the waters came upon the earth."); max 3 lines; lowercase lyric-line capitals that land mid-sentence (keep proper nouns, Lord, God, Me); break lines at natural phrase points.
- FONTS: install at least 5 contrasting free OFL fonts into `assets/fonts/` with licenses, e.g. a heavy condensed display (Bebas Neue, Anton, Oswald Bold), an elegant old-style biblical serif (Cinzel, Cormorant, IM Fell), a rough hand-cut or stencil face (Special Elite, Stardos Stencil, Black Ops One, Rubik Dirt), a clean wide sans (Montserrat ExtraBold/ Wide, Archivo Expanded, Syncopate), and a glitch or distorted face (Rubik Glitch, Nabla, Monoton, or a clean face run through the glitch effect). Pick the face per sentence by meaning and energy; powerful lines get bigger, bolder faces.
- SIZE and SCALE: some lines huge and filling much of the frame, some small and intimate; emphasis words scaled up and/or in a different face inside a line (FLOOD, SHUT, DIED, FORTY DAYS, DEEP, FOUNTAINS, HEAVENS, NOAH, LORD, ARK, etc.).
- POSITION and LAYOUT: not always centred. Left or right thirds, top, bottom, diagonal, stacked or broken lines, text anchored near the subject, and text partly BEHIND foreground elements using the depth map (composite text at a chosen depth so nearer layers occlude it). Always in readable contrast (brightness-aware placement, subtle backing/shadow); never over faces or tiny figures in a way that hides them.
- ANIMATION VOCABULARY on top of fade, slide, zoom, blur, tracking, wipe, shake: GLITCH (RGB split, slice displacement, flicker, scanline jitter), typewriter and per-letter cascades, stamp or impact slams, ink or smoke dissolves, masked reveals, light-sweep reveals, embers or sparks burning in the text on fire lines. Sync hits to beats/downbeats (audio.json). Never the same font+position+animation combo back to back.
- MOTION WHILE HELD (Shane 10:58): sometimes, not always, the text moves while it is held: slow drift or travel across the screen, slow push or pan (scale/translate), or slide in and slide out across the hold. Mix static held lines with moving ones so pacing stays varied (roughly a third to half moving). Readability rule unchanged: slow enough to read, whole sentence visible once built.
- Keep all of this data driven: `timeline/sentences_v3.json` (per sentence: text, start, end, lines, font(s), emphasis words, size, layout/anchor, depth, entrance, exit, hold_motion, fx, hit times).

## B) Remove the flash strip; scene-motivated localized light
- REMOVE the generic full-width white flash strip across the centre on beats, everywhere.
- Replace with motivated, localized light layered in depth, per shot, based on what is in the frame: lanterns and fires glowing, flickering and occasionally glitching; firelight blooms; storm light moving inside the clouds; actual lightning bolts (procedural branching bolts) with flicker lighting the scene; light spilling from the ark door or windows; rain streaks catching light. Place each effect in the correct parallax layer (behind or around subjects, masked by depth, not a flat full-frame overlay) and pulse on beats. Locate light sources per still (bright warm blobs for lanterns/fire/windows, sky region for storm light) automatically with per-shot overrides in the fx config.
- This needs new shot segments (not just an overlay). Keep motion quality from v2.

## Order of work and checkpoints
1. Plan, estimate total render time, and write the ETA at the top of STATUS.md early.
2. Build the engine changes, test on a few shots with quick check frames, then go straight on (no approval checkpoint; Shane approved v3 outright).
3. Render the full film (resumable per-shot segments, detached, logged), concat, mux, write the v3 contact sheet.

## Self-verification (must pass)
- ffprobe: H.264 1920x1080 24 fps + AAC, duration 367.2 s within 0.1 s; 72 segments in order with correct frame counts; no black or missing segments.
- `~/storybook/full/v3_checks/`: frames proving at least 5 distinct fonts in use, varied positions and sizes (list them), at least 3 glitch lines, at least one text-behind-foreground frame, and localized lightning, fire or lantern effects, plus proof there is no full-width flash strip (e.g. a frame on a beat where the old strip used to fire). Look at them yourself and fix problems.
- STATUS.md: ETA, actual render time, a table per sentence (start, end, text, font, layout, entrance, exit, fx), list of check frame paths. Commit at milestones.

## V3 FIXES (review of the first v3 check frames, 11:22)
1. Sentence length: "Then the Lord said to Noah, come into the ark, you and all your household, for I have seen you walking rightly before Me in this generation." is showing as one 4-line block at 10 to 12 s, long before most of it is sung. Rule: a displayed unit is one complete thought that fits in at most 2 lines (3 only for short huge display lines), roughly 60 characters max; if a sentence is longer, split it at a comma or clause boundary into complete clauses ("Then the Lord said to Noah," / "Come into the ark, you and all your household," / "For I have seen you walking rightly before Me in this generation."). Never show text more than about 0.3 s before its first word is sung. No unit shorter than about 1.5 s unless it is a single punchy line.
2. Baseline jitter: words within a line sit at different heights and sizes randomly ("you", "your", "for I have seen you" bouncing). Only deliberate emphasis words get scaled; everything else sits on one clean baseline with consistent size. Emphasis scaling must stay aligned (shared baseline or centred cap height), 1 to 3 emphasis words per sentence max.
3. Glyph bug: "Me" renders as a broken glyph (looks like "l\e"). Check every font covers the characters used (curly quotes, apostrophes, capitals) and fall back per glyph.
4. Depth occlusion must look intentional: text partly behind solid foreground objects (rock, hull, figure's cloak), never "occluded" by sky, clouds or the light shaft. Only use text-behind on shots where there is a clear near foreground object and the words stay readable.
5. In s03 the new warm glow reads as a wide horizontal band across the horizon. Keep lights localized to their source (the figure/beam base, lanterns, windows, fire) with a falloff radius, not wide strips.
6. Keep the rest: 5+ fonts by meaning, varied sizes/positions, glitch lines, some held lines moving, localized lightning/lantern/fire light.
Stop the current v3 render, fix these, re-check a few frames (s01 to s06 plus a powerful line and a lantern shot), then render the full v3 straight through. v3 paths only; never touch v1 or v2.
