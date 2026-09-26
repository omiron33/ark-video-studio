# Status

Phase: pipeline is in place. The 5 second clip render is next, so times and the frame inspection are not filled in yet.

## What is done

The shot pipeline reads `shots/ark_door_187.yaml`. Prep upscales `../styles/real_1.png` to a 2304x1296 plate, runs relative Depth Anything V2 Small on MPS, splits four feathered layers, and Telea-fills the rim behind nearer layers. The frame pass dollies in, drifts, rolls, and shakes. It adds layered rain, fog, a left-weighted lightning relight, amber door glow, grain, vignette, a little chromatic aberration, and a teal and amber grade. ffmpeg encodes H.264 CRF 16, yuv420p, and AAC.

Depth on the plate did not need a flip. The sky is far, the ark sits in the middle layers, and the man and ground are nearest. The door glow lands on layer 2.

## Cues

Measured from `../audio.json`, onset strength, and a low-band envelope of `../song.mp3` between 187.0 and 192.0. The cue list is `shots/ark_door_187.cues.json`.

Flash is the beat-grid downbeat at 187.153 (target 187.13). The nearest onset is 187.139, 0.014 s away, onset strength about 13.1.

Door slam is the low-band attack at 190.460. The beat grid hit is 190.473. The low-band RMS maximum is 190.576 because the sub-bass note sustains after the attack. The slam uses the attack. It falls on the same frame as the beat.

Pulses snapped to onsets within 0.03 s of the listed times, so none were replaced: 187.580, 187.975, 188.254, 188.811, 189.090, 189.345, 191.574.

Lyric line "Then the Lord shut them in." uses lyrics.json, not the GOAL.md times. GOAL.md is early on every word except shut, and only shut is aligned true.

- Then: lyrics.json 188.50 to 188.95, aligned false. GOAL.md 188.02.
- the: lyrics.json 188.95 to 189.40, aligned false. GOAL.md 189.02.
- Lord: lyrics.json 189.40 to 189.85, aligned false. GOAL.md 189.54.
- shut: lyrics.json 189.85 to 190.30, aligned true. GOAL.md 189.80. Close enough that it is not listed as a clash.
- them: lyrics.json 190.30 to 190.75, aligned false. GOAL.md 190.18.
- in.: lyrics.json 190.75 to 191.20, aligned false. GOAL.md 190.46 to 191.8.

The slam stays on the musical hit at 190.460. It does not move to the word "in".

## Render times

Not recorded yet. Prep on a cold cache was about 6 to 8 seconds in a pilot, most of that Depth Anything V2. A cache hit was about 0.2 seconds. Frame render in the pilot was about 0.4 seconds a frame. Official prep time and frame render time will be written here after the full encode.

## Inspection

Not done yet. Pilot stills were used to fix two problems before the full render: rain that looked like white dashes, and a shut door that became a flat gray rectangle. The full check frames still need to be opened.

## Known issues

None recorded yet beyond the cue disagreements above.
