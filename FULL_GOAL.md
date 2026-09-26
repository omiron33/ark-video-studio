# FULL GOAL: the complete 6:07 "Genesis Chapter 7" music video (Shane Fisher's own song)

Shane liked the 5 s test. Build the full video overnight by extending THIS repo into a multi-shot renderer. Same rules as GOAL.md: you write all the code, Mini only, no ComfyUI / :8080 operator / Transfiguration / old factory / OmiPC, no AI video models of any kind (never use image_to_video or reference_to_video). No em dashes in anything for Shane.

## Inputs
- timeline/shotlist.json and timeline/shotlist.md: 36 shots covering 0.0 to 367.2 s, cuts already snapped to bar downbeats from ../audio.json. Each shot has id, in_, out, still, source, beat, camera, effects, and for new stills a `prompt`.
- Existing stills: ../styles/real_1.png (the tested door shot), ../styles/real_3.png (lone ark on a stormy sea), ../styles/gritty_C3.png.
- ../song.mp3, ../audio.json, ../lyrics.json, ../story_beats.md.

## Step 1: stills (image generation, STILLS ONLY)
Generate the 28 new stills with your image_gen tool from the `prompt` in shotlist.json, 16:9, largest size available, saved to ../shots/<still>.png (one file per unique still name). Look at every image yourself. Regenerate any that: look like AI slop or plastic CGI, show the wrong ark (it must be a boxy pitch-sealed timber barge, flat roof, no sails, no masts, no ship prow), show faces or large close people (people must be small, cloaked, faceless), contain text or watermarks, look cartoony or churchy, or contain gore. Keep the look consistent with real_1: gritty photoreal, teal and amber, crushed blacks, rain. Log each still and any regenerations in STATUS.md. Upscale/crop to 16:9 as needed in code.

## Step 2: multi-shot renderer
- Timeline config: shots yaml (or convert shotlist.json into timeline/genesis7.yaml) with per-shot still, in/out, camera move, and effects preset: rain (light/heavy), flood water motion (displacement/flow on water regions found by depth + color), fountains/spray, lightning cues, fog, door (the tested 187 s preset), lantern/torch flicker, birds drift, fade out.
- Reuse the per-still prep (upscale with overscan, Depth Anything V2 on MPS, 3 to 4 feathered layers, inpainted backfill) with caching.
- Cue sync from audio.json beats plus onset / low-band analysis of the mp3 over the whole song: lightning flashes on the big hits (not every beat, keep it musical and section-aware, more in Verse 1, Chorus 1, Dub Bass Solo, Bridge 1, Pro sections), shake on sub-bass drops, subtle pulses on smaller hits. Write the global cue list to timeline/cues.json.
- Transitions: hard cuts on downbeats by default, short dissolves (6 to 12 frames) between calm shots, a fade in at the start and fade to black at the end.
- Shot s21 (187.0 to 193.0) must use the tested door-slam preset with the slam on 190.46.
- Fix the three test weak spots Shane's lead saw in the 5 s clip: (1) after the slam the door must NOT go fully dark; leave a thin, steady line of warm light at the door seam; (2) remove the greenish rim/halo around the door after the slam; (3) the cloaked figure is fully static: give him subtle life (cloak sway, slight weight shift or breathing via a local mesh warp) so he does not look frozen. Apply the same figure-life idea wherever small people appear.
- Render 1920x1080, 24 fps, full song 0.0 to 367.2 s, mux the full song, H.264 CRF 16, yuv420p, AAC. Render shots in parallel or in chunks so a crash can resume (per-shot intermediate files, then concat), and log render time per shot and total.
- Output: out/genesis7_full.mp4, out/contact_sheet_full.png (one labelled frame per shot, 36 tiles, grid), out/shot_checks/<id>_{a,b,c}.png (start, middle, key-cue frame of every shot).

## Step 3: quality gate on EVERY shot
Open and look at frames from every shot. Check parallax holes, layer seams, halos, stretched pixels, fake rain, water that looks like a warped still, visible plate edges from shake, banding, wrong ark shape, faces. Fix or regenerate the still and re-render the affected shots until clean. Write a per-shot pass/fix table in STATUS.md with honest remaining weak spots and render times. Commit at each milestone (stills done, renderer done, first full render, final).

Done means: out/genesis7_full.mp4 (ffprobe about 367.2 s, 1920x1080, 24 fps, h264 + aac), out/contact_sheet_full.png, all 36 shots checked with the table in STATUS.md, and everything committed.
