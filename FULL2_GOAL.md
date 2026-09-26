# Goal: full "Genesis Chapter 7" music video from the 72 approved full2 stills

Shane approved all 72 storyboard stills. Render the full song-length video with the engine built for the s01 to s04 preview (per-shot motion layers + kinetic lyric/scripture typography), extended to all 72 shots. Never use em dashes in any text, commit message, or on-screen type.

## Inputs
- Stills: `~/storybook/full2/stills/sNN_<name>.png` (72 files, 1280x720). Use the current files as they are (s26 was just flipped horizontally on purpose). Do not generate, edit, or regenerate any images.
- `~/storybook/full2/shotlist.json`: list of 72 shots with `id`, `in`, `out`, `still`, `lyric`, per-word `words` timings, `verse`, `camera`, `motion`, `text_treatment`, `ark`, `beat`.
- `~/storybook/song.mp3` (367.2 s), `~/storybook/lyrics.json`, `~/storybook/audio.json` (beats, bars_4_4 downbeats).

## Rules
- Pure code only (Python, numpy, PIL/OpenCV, ffmpeg, the repo's depth/parallax pipeline). No AI video, no image_to_video, no image generation or editing, no remote machines.
- Reuse and generalise the full2 engine (`arkpipe/full2fx.py`, `timeline/full2_fx.json`, `render_preview.py`). Give every shot a config entry: camera move from `camera`, motion layers chosen from `motion` (clouds, fog, dust, rain, grass sway, god-rays, motes, lightning on beats, water/flood surface motion, etc.), and a text treatment from `text_treatment`. It is fine to map similar treatments onto a shared set of well-made treatment types with per-shot parameters, but keep variety between consecutive shots. Words appear on their exact start times; verse reference + snippet as the secondary layer in each shot; keep text in negative space and clear of figures.
- Downbeat camera accents, teal/amber grade, grain, crushed blacks, no parallax holes or visible plate edges.
- The old `out/genesis7_full.mp4` from FULL_GOAL.md is superseded; leave it in place, do not delete it.

## Output
- `~/storybook/full/genesis7_full.mp4`: 0 to 367.2 s (the full song), 1920x1080, 24 fps, H.264 (yuv420p, CRF about 18 to 20, keep the file under about 1.5 GB), full song audio as AAC. Cuts land exactly on the shot `in`/`out` times from shotlist.json, shots in order s01 to s72.
- `~/storybook/full/genesis7_contact.png`: contact sheet with one labelled frame per shot (72 tiles, shot id + timestamp), readable at a glance.
- Render robustly: render per-shot segments (resumable, skip finished ones), run the long render detached with a log, then concatenate and mux. A previous full render died mid-way, so free the depth model after each still and watch memory.

## Self-verification (must pass before done)
- ffprobe: one H.264 video stream 1920x1080 24 fps and one AAC audio stream; container duration matches 367.2 s within 0.1 s; video duration matches within 0.1 s.
- 72 segments in order; each segment frame count matches its (out - in) * 24 within one frame.
- No black or missing segments: sample frames across every shot and check mean luma is above a floor (flag any near-black frames that are not intentional fades), and no frozen duplicate stretches where motion should exist.
- Look at the contact sheet and a few word frames yourself; fix any shot that is broken (glitches, unreadable or misplaced text, plate edges).
- Write a per-shot table (id, in, out, camera, layers, text treatment, pass/notes) and total render time to STATUS.md. Commit at milestones.

## ADDENDUM (Shane, 8:58 CT): sentence-at-a-time lyrics (required before done)
- The hero lyric text must no longer drip one word at a time. Group the lyric words into full sentences (one complete thought), splitting on sentence punctuation (. ! ? ; and line ends from lyrics.json that close a thought) using the lyric word timings. Sentences may span shot cuts.
- Each sentence appears on screen all at once at its first word's start time (short fade in, about 0.15 to 0.25 s), stays fully readable until that sentence finishes in the song (last word end, plus a short hold), then fades out briefly and is replaced by the next sentence. Never show two sentences at once. Long sentences wrap to 2 lines, centred in negative space, readable (soft shadow/glow), same elegant fonts. Instrumental gaps show no lyric text (the small verse reference layer can stay).
- Do not re-render the shot motion more than needed. Preferred: make the segment renderer able to output motion-only plates (no hero lyric words, keep or also move the verse layer as you judge best), and apply the sentence lyric layer as a separate text-overlay pass over the concatenated video (e.g. render transparent text frames or PNG overlays with timings and composite with ffmpeg, or a Python pass that decodes, draws, encodes). If a textless re-render of segments is unavoidable, do it once so future text changes only need the overlay pass.
- Keep the previous v1 film as `~/storybook/full/genesis7_full_v1_words.mp4` (rename), and write the new one to `~/storybook/full/genesis7_full.mp4` and a new `~/storybook/full/genesis7_contact.png`.
- Verify: export 4 or more check frames to `~/storybook/full/sentence_checks/` (for example mid-sentence frames of 4 different sentences, at least one 2-line sentence, and one instrumental gap), look at them, confirm a full sentence is on screen with no leftover single word from the old layer. List those frame paths and which sentence each shows in STATUS.md. Re-run the ffprobe/duration/segment/black-frame checks.

## ADDENDUM 2 (Shane, 8:59 CT): varied sentence entrances and exits
- Vary how each sentence enters and leaves so it is not the same fade all video. Choose a technique per sentence to fit its mood from: fade, slide in (from left, right, or below), scale/zoom in, blur-to-sharp, letter-spacing tracking in, soft wipe or mask reveal, and a camera-style SHAKE or impact jolt on powerful lines (the flood, fountains of the deep bursting, windows of heaven opening, God shut him in, all flesh died, lightning or door-slam hits). Exits can differ from entrances.
- Sync shakes and impacts to the nearest downbeat (bars_4_4) or musical hit where possible. The text shake can be paired with a small whole-frame jolt in the overlay pass if it stays tasteful.
- Never use the same entrance technique on back-to-back sentences. Keep it readable and tasteful: no spins, no bouncy cartoon easing. The whole sentence stays fully visible and still (except a decaying shake) while held.
- Keep the per-sentence choice in a data file (e.g. `timeline/sentences.json` with text, start, end, lines, entrance, exit, shake_time) so it can be tuned later.
- In STATUS.md add a table: sentence index, start, end, text (short), entrance, exit. Add check frames in `~/storybook/full/sentence_checks/` that show at least one slide mid-entrance, one shake, one fade, and one fully held 2-line sentence, and list their paths.

## ADDENDUM 3 (9:59 CT): output paths
- The sentence-lyrics film is v2. Write it ONLY to `~/storybook/full/genesis7_full_v2.mp4` (contact sheet `~/storybook/full/genesis7_contact_v2.png`).
- Restore v1 at its original path: `~/storybook/full/genesis7_full.mp4` must be the v1 word-by-word film (move `genesis7_full_v1_words.mp4` back to that name once v2 is safely at its own path). Never overwrite v1 again; it is being reviewed elsewhere. Leave the v1 contact sheet `genesis7_contact.png` as the v1 sheet.
