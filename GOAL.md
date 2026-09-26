# GOAL: 5 second photoreal 2.5D test clip for "Genesis Chapter 7" (Shane Fisher's own song video)

You (Grok Build CLI) write ALL the code in this repo. This is a fresh, standalone project.
Do NOT use or touch any Mini operator on :8080, Transfiguration, ComfyUI, the old biblical-film factory, OmiPC, or any AI video model.
Allowed ML: Depth Anything V2 (PyTorch with MPS) for depth, and classical or lightweight inpainting (e.g. OpenCV Telea/NS, or a small LaMa-style model) for backfill. Everything else is code: Python/OpenCV/numpy (or three.js + headless Chrome, your call), piped into ffmpeg.
Use a project-local venv (uv is at /opt/homebrew/bin/uv, python3.12 is available). Do not install into system python.
No em dashes in anything written for Shane (STATUS.md, README, captions, logs meant for humans).

## Inputs (read only)
- ../styles/real_1.png  (1280x720: colossal ark at night in a storm, huge door closing with a blade of amber firelight, cloaked man at the foot of the ramp, lightning at left, wet rocky ground)
- ../song.mp3 (367.2 s, about 108 BPM)
- ../audio.json (beat grid, sections, energy), ../lyrics.json (aligned words), ../story_beats.md

## Repo structure (must be reusable for the full 6 minute video later)
- config-driven shots (e.g. shots/*.yaml or shots.json: source image, song in/out time, camera move, effects, cue list)
- an audio cue list file per shot (times + type: flash, slam, pulse, lyric words), generated or verified from the audio
- a render script (e.g. `python render.py shots/ark_door_187.yaml`) that does: prep (upscale, depth, layers, inpaint, cached), frame render, ffmpeg encode + mux, contact sheet
- README.md explaining how to add more shots and build the full song later
- STATUS.md that you keep updated as you go (phase, what is done, render times, known issues). Plain sentences, no em dashes.
- commit to git at each milestone.

## Clip spec
- Song window 187.0 to 192.0 s. 5 s, 24 fps, 120 frames, 1920x1080.
- Sync:
  - Strong downbeat at 187.13 (beat grid says 187.153): LIGHTNING FLASH.
  - Vocal "Then the Lord shut them in": Then 188.02, the 189.02, Lord 189.54, shut 189.80, them 190.18, in 190.46 to 191.8.
  - Big sub-bass hit at exactly 190.46 (beat grid 190.473): DOOR SLAM. The amber door light narrows to a thin line or cuts out, with hard camera shake that decays.
  - Small pulses near 187.6, 188.0, 188.25, 188.8, 189.08, 189.36, 191.57: subtle light or shake accents.
  - Verify these against audio.json and an onset analysis of the mp3 (e.g. librosa onset/low band energy in the venv) and write the final cue list with the measured times. Note any disagreements in STATUS.md.
- Method:
  - Upscale to 1920x1080 with overscan (render a larger canvas so camera motion and shake never show edges).
  - Depth map with Depth Anything V2 on MPS. Save depth preview.
  - Split into 3 to 4 feathered depth layers (e.g. far sky/lightning, ark body, door/ramp + man, near ground/rocks), with inpainted backfill behind each layer so parallax reveals no holes.
  - Camera: slow, low dolly-in with slight drift and a tiny roll.
  - Layered rain: near motion-blurred streaks, far fine rain, ground splashes. Must look like real rain, not uniform lines.
  - Drifting fog between layers.
  - Depth-shaped lightning relight (lights the scene according to depth/normals, left side stronger), plus the flash.
  - Amber door glow with bloom and flicker; it collapses at the slam.
  - Shake on hits, film grain, vignette, slight chromatic aberration, teal and amber grade with crushed blacks.
  - Look: gritty photoreal. NOT cartoony, NOT churchy/glowy-kitsch.
- Output:
  - out/test_ark_5s.mp4: mux with song segment 187.0 to 192.0 (short audio fades in/out), H.264 CRF 16, yuv420p, AAC. Exactly 120 frames.
  - out/contact_sheet.png: 12 frames in a grid, including the flash frame and the slam frame, with small timestamp labels.
  - out/frames_check/: extracted PNGs at flash, pre-slam, slam, post-slam, and a couple of others.
  - Record total render time (prep and frame render separately) in STATUS.md.

## Quality gate (required before you call it done)
Extract the check frames and actually LOOK at them (open the images). Check for parallax holes, layer seams or halos around the man and the ark edges, stretched or smeared pixels, fake-looking rain, banding, edges visible from shake. Fix and re-render until clean. Write what you checked and what you fixed in STATUS.md. Honestly list remaining weak spots.
Done means: out/test_ark_5s.mp4 (ffprobe: 5.0 s, 1920x1080, 24 fps, h264, aac) and out/contact_sheet.png exist, the cue list is verified, STATUS.md is complete, and everything is committed.
