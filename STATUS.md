# Status

Phase: the 5 second test clip is rendered and checked.

## What is done

`shots/ark_door_187.yaml` drives the clip. Prep upscales `../styles/real_1.png` to a 2304x1296 plate, runs relative Depth Anything V2 Small on MPS, saves `out/depth_preview.png`, splits four feathered layers, and Telea-fills the rim behind nearer layers. The second launch hits that cache and does not load the model again.

The frame pass is a slow low dolly-in with small drift and a tiny roll. It adds far fine rain, longer blurred near streaks, ground splashes, fog between layers, depth-shaped lightning from the left, an amber door glow, film grain, vignette, a 1 pixel chromatic shift, and a teal and amber grade with crushed blacks. ffmpeg writes H.264 CRF 16, yuv420p, and AAC, with short fades on the song segment.

Depth did not need a flip. The sky is far, the ark body sits in the middle layers, the door glow lands on layer 2, and the man and the ground are nearest.

## Render times

Cold prep, including Depth Anything V2 on MPS: 6.38 seconds.
Frame render, run 1: 55.63 seconds.
Cache-hit prep, run 2: 0.18 seconds. Depth Anything V2 was not loaded.
Frame render, run 2: 51.84 seconds.

Decoded flash and slam frames from the two encodes match byte for byte.

## Cues

Measured from `../audio.json`, librosa onset strength, and a low-band envelope of `../song.mp3` from 187.0 to 192.0. The list is `shots/ark_door_187.cues.json`.

Flash is the beat-grid downbeat at 187.153 (target 187.13). The nearest onset is 187.139, 0.014 seconds away, onset strength about 13.1. That is frame 4, shown at 187.17 because the frame time is 187 plus 4/24.

Door slam is the low-band attack at 190.460. The beat grid hit is 190.473. The low-band RMS maximum is 190.576 because the sub-bass note sustains after the attack. The slam uses the attack, which is the same frame as the beat (frame 83, shown at 190.46).

Pulses snapped to onsets within 0.03 seconds of the listed times, so none were replaced: 187.580, 187.975, 188.254, 188.811, 189.090, 189.345, 191.574.

The line "Then the Lord shut them in." uses lyrics.json. GOAL.md is earlier on every word except shut, and only shut is aligned true.

- Then: lyrics.json 188.50 to 188.95, aligned false. GOAL.md 188.02.
- the: lyrics.json 188.95 to 189.40, aligned false. GOAL.md 189.02.
- Lord: lyrics.json 189.40 to 189.85, aligned false. GOAL.md 189.54.
- shut: lyrics.json 189.85 to 190.30, aligned true. GOAL.md 189.80. Close enough that it is not listed as a clash.
- them: lyrics.json 190.30 to 190.75, aligned false. GOAL.md 190.18.
- in.: lyrics.json 190.75 to 191.20, aligned false. GOAL.md 190.46 to 191.8.

The slam stays on the musical hit at 190.460. It does not move to the word "in".

## Check frames

All of these are 1920x1080 in `out/frames_check/`.

- `flash.png` is frame 4, the lightning flash (song time 187.17).
- `pre_flash.png` is frame 3, the frame before the flash.
- `pre_slam.png` is frame 81, door still open.
- `slam.png` is frame 83, the door slam.
- `post_slam.png` is frame 89, door still shut, shake mostly gone.
- `pulse.png` is frame 30, the pulse near 188.25.
- `mid.png` is frame 60.

`out/contact_sheet.png` is 12 frames with timestamp labels, including "187.17 flash" and "190.46 slam".

## Inspection

I opened the check frames and the contact sheet.

The flash frame is clearly brighter than the frame before it. The lift on the left half is about 60 levels and the lift on the right half is about 25, so the left side carries the strike. The door stays amber through the flash.

At the slam the amber score in the door window drops from about 39 to about 9, and it stays there after the slam. The wide glow becomes a thin vertical blade and the ramp reflection goes dark. The contact sheet shows that slam frame shifted against its neighbors. Phase correlation puts the slam about 35 pixels from the pre-slam frame, a pulse about 4 pixels from its neighbor, and the post-slam frame about 3 pixels from the pre-slam frame, so the hit decays. The outer pixels of the slam frame are storm and rock (standard deviation about 38), not an empty border.

Rain reads as fine diagonal streaks with gaps, plus longer softer streaks in front, not one field of identical dashes. Fog sits at the base of the ark and between the layers. I did not see parallax holes, a halo around the man, a seam tearing the ark edge, banding, or the plate edge from the shake. An earlier pass that drew rain as short white dashes was replaced, and a pass that filled the shut door with a flat gray rectangle was replaced by darkening the glow in place.

## Remaining weak spots

The shut doorway keeps a dark irregular interior beside the blade. The original opening is wider than the amber core, so crushing the glow does not turn the whole recess into brick. A few small bright flecks sit in that recess. Parallax is deliberately small because the depth map splits the ark face across two layers, and a harder split would show a seam. Some rain is painted into the source plate, so it does not move. The moving streaks are the ones added on top. Ground splashes are easy to miss on the wet rocks.
