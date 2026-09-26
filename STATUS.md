# Status

Phase: the 5 second test clip has been re-rendered after the door review and checked again.

## What is done

`shots/ark_door_187.yaml` drives the clip. Prep upscales `../styles/real_1.png` to a 2304x1296 plate, runs relative Depth Anything V2 Small on MPS, saves `out/depth_preview.png`, splits four feathered layers, and Telea-fills the rim behind nearer layers. The second launch hits that cache and does not load the model again.

The closed door is not an inpaint. The opening is filled with a 1:1 copy of the wall planks beside it, so the courses, grain, and painted rain match the hull. A razor amber seam is drawn on that leaf at the slam and fades out over 0.5 seconds. While the door is open, the slit is rebuilt as fire with a hot core, darker edges, and vertical variation, instead of the flat clipped yellow in the plate. The slam frame and the frame after it take an exposure dip, and the ramp puddle loses its orange with the door.

The frame pass is still a slow low dolly-in with small drift and a tiny roll, layered rain, fog, a left-weighted lightning flash, grain, vignette, a 1 pixel chromatic shift, and a teal and amber grade. ffmpeg writes H.264 CRF 16, yuv420p, and AAC, with short fades.

## Render times

Cold prep, including Depth Anything V2 on MPS: 6.26 seconds.
Frame render, run 1: 63.53 seconds.
Cache-hit prep, run 2: 0.23 seconds. Depth Anything V2 was not loaded.
Frame render, run 2: 59.17 seconds.

Decoded slam frames from the two encodes match byte for byte.

## Cues

Measured from `../audio.json`, librosa onset strength, and a low-band envelope of `../song.mp3` from 187.0 to 192.0. The list is `shots/ark_door_187.cues.json`.

Flash is the beat-grid downbeat at 187.153. The nearest onset is 187.139. That is frame 4, shown at 187.17.

Door slam is the low-band attack at 190.460. The beat grid hit is 190.473. The low-band RMS maximum is 190.576 because the note sustains. The slam uses the attack (frame 83, shown at 190.46).

Pulses snapped to onsets within 0.03 seconds of the listed times: 187.580, 187.975, 188.254, 188.811, 189.090, 189.345, 191.574.

Words marked aligned false in lyrics.json are interpolated, so those cue times now follow GOAL.md. "shut" is aligned true, so it stays on the lyrics.json time.

- Then: GOAL.md 188.02. lyrics.json 188.50 to 188.95, aligned false.
- the: GOAL.md 189.02. lyrics.json 188.95 to 189.40, aligned false.
- Lord: GOAL.md 189.54. lyrics.json 189.40 to 189.85, aligned false.
- shut: lyrics.json 189.85 to 190.30, aligned true. GOAL.md 189.80.
- them: GOAL.md 190.18. lyrics.json 190.30 to 190.75, aligned false.
- in.: GOAL.md 190.46 to 191.8. lyrics.json 190.75 to 191.20, aligned false.

The slam stays on the musical hit at 190.460, not on the word "in".

## Check frames

All of these are 1920x1080 in `out/frames_check/`.

- `flash.png` is frame 4, the lightning flash (song time 187.17).
- `pre_flash.png` is frame 3.
- `pre_slam.png` is frame 81, door still open.
- `slam.png` is frame 83, the door slam.
- `post_slam.png` is frame 89, seam fading, shake mostly gone.
- `pulse.png` is frame 30.
- `mid.png` is frame 60.

`out/contact_sheet.png` is 12 frames with timestamp labels, including "187.17 flash" and "190.46 slam". The bottom row shows the seam thinning and then gone.

## Inspection

I opened the check frames and the contact sheet after this render.

Before the slam the slit is orange with a brighter core and darker edges, and the ramp and puddle carry that light. It is no longer a flat clipped yellow bar. At the slam the doorway is the neighboring plank texture, the ramp reflection is gone, the frame is darker (mean about 24 versus about 39 before and about 38 after), and the camera is shifted about 36 pixels versus about 4 on a pulse. The seam is a thin orange line on the slam frame, thinner a quarter second later, and absent by the last contact-sheet frames. The left side of the flash still lifts more than the right (about 60 levels versus about 26). I did not see the old dark smear and pale stretch inside the doorway, parallax holes, a halo on the man, or the plate edge.

## Remaining weak spots

The fire's interior beams are faint. The gap reads as a gradient with texture, not as clear posts. The closed leaf is a copy of the wall, so a careful look can still find the edge of that patch where it meets the frame. A little of the seam can sit just at the threshold. Rain painted into the source plate does not move. The moving streaks are the ones added on top.
