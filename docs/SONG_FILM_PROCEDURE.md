# Song film procedure (default since 2026-11-25)

How *Agar in the Wilderness (Genesis 16)* was made, written so a fresh session can repeat it. Shane made it
the default after watching v3: "We need to continue with this process... a 7 out of 10 is a great mix of
speed vs quality." **Target: about 7 of 10 in about a day.** Not perfection, no endless loops.

Three things here differ from what Genesis 16 did, on purpose:

1. **Critics.** Genesis 16 used one independent critic per round. Shane asked for a **three-critic panel**.
2. **Order.** Genesis 16 reached this process on its third version. Versions 1 and 2 were empty wides and
   drifting cameras. Start here, at version 3's method, not there.
3. **Skipped rules.** Version 1 skipped the render rules and the shot plan. Do them first.

This public file holds no addresses, hostnames or machine paths. Those are in the owner's local notes.

## 0. Before anything (30 min)

- Read the owner's render toolbox rules. Check the render queue is open and no job of ours is running.
- Register the project on the dashboard. Send the plan and an ETA. A progress note every 30 to 45 minutes.
- Find the song in Music Studio's store of WAV masters by its chapter id; the same database record holds
  the lyrics. Copy it to `media/song.wav`. Never commit it.
- **No theme gate.** The four-mockup theme choice is skipped by default for every new song film (Shane,
  2026-11-25: "Skip for every film"). Choose the theme yourself, write it in `docs/BRIEF.md`, and go on.
  Make the mockups only when he asks for them; then wait for his choice.

## 1. Lyrics and beats (about 1 h)

1. `tools/analyze.py`: tempo and beats. Set the tempo range from the song's style notes.
2. `tools/vocals.py`: separate the vocal.
3. Force-align the lyrics to the **separated vocal** with the base CTC model, then again with the large one.
   Use them as a check on each other. Genesis 16: within 0.15 s on 314 of 322 words.
4. Whisper is a third opinion only. Match it **in order**. A nearest-word match called 71 words bad that
   were mostly name spellings.
5. Check line starts after a pause against the voice's onset. Fix only words with evidence, in a script
   that records why (`tools/fix_timing.py`). Check the tail for unsung audio.
6. `tools/plan.py` cuts on measured beats. Use the song's own spelling of names.
7. Say "nobody has checked it by ear" unless somebody has.

## 2. Design (about 1 h)

- **One world** for the film, written for this chapter. Its worlds, props and look are not carried to the
  next film. Tools, the kit and techniques (cloth simulation, per-scene prop compiling) may be.
- **A palette arc** tied to the story, and **one glowing signal colour** that means one thing.
- **Two typefaces.** The speaker sets the voice: narrator roman, people italic, the Lord in small capitals
  in the signal colour. Title card at the start and again at the end.
- **Overlay lyrics** as a sharp type pass, with the engine's required `"overlay"` reason per scene. Light
  type never on a bright sky. Off dark shapes, off edges, light shading, no heavy halo, no verse chips.
- **No people.** Never a figure, stick or otherwise. Each person is an **object that acts**: Agar is an
  indigo veil, Sara a red cloth, Abram a staff and tent. The angel of the Lord is light only.
- Theology Orthodox. No blood. No text inside a picture. Nothing violent shown as spectacle.

## 3. Staging: 45 to 50 short beat-cut scenes

For every scene write one sentence: **what object does what, on which sung word.** If the sentence is "the
camera drifts past", it is not a scene yet. Examples that worked: an empty cradle swings to a stop on "no
children"; the veil lifts and the cradle begins to rock on "through her"; a balance tips and comes level on
"judge"; pins let go one at a time until the veil tears free on "fled".

Lasseter, with the engine's motion kit (`rig`, `spring`, `anticipate`, `follow`, `stagger`, `gust`):

- Cameras travel on arcs and enter and leave moving. No single straight glide from rest to rest.
- Anticipation before each beat, timed so the beat lands **on the word**.
- Weight: heavy things start slow, knock, rebound once and settle. Rigid things do not squash.
- Follow-through and overlap: **simulate cloth**, do not fake it. Pin its whole top edge to its line.
- Secondary action in every shot, restrained: smoke that answers the wind late, a lamp, a swinging skin.
- No shake, no slow motion, no motes or rain-like particles.

**Dress the set.** Cluster props, do not scatter: fire, jars, loom, quern, rugs, baskets, woodpile, trodden
paths, ash, far cliffs. Foreground in every wide.

## 4. Build and look (3 to 5 h)

1. Stills on the Mac, two samples, at two or three times in each scene. A new shader takes about 30 s to
   compile before its first frame.
2. Check every scene **near its end**, when the whole line is showing.
3. `shot-plan.json` from `film.json`; run the toolbox validator until it passes. Rewrite it after changes.
4. Profile before rendering if a scene is slow. Time at least two sample counts and subtract.

## 5. Motion clips (about 30 min)

Render **every** changed scene as a quarter-size clip (960x540, 20 fps, 2 samples) on the render machine.
Lay out 8 to 10 frames across time per scene and look at all of them. Fix what is dead. A still cannot show
that nothing happens. This is not the old full-film draft.

## 6. The three-critic panel

Three fresh reviewers, **started together and unable to see each other**, with no build context: no source,
no earlier reviews, no opinions of yours. Evidence folder: clips, time strips, stills with words, the
requirements, and one line per scene saying what it intends and what is sung. Tell them low resolution and
noise in the clips is deliberate.

| Critic | Judges |
|---|---|
| A. Look and realism | light, sand, cloth, stone, plants, water, night, rendering faults, lyric legibility |
| B. Motion and staging | does the action read, timing on the word, weight, anticipation, arcs, camera |
| C. Story, emotion, theology | does each shot tell its line, emotional build, anything misread, hard rules |

Each returns scores out of 10 with a reason, one line per scene, the ten worst defects with exact fixes,
hard-rule breaches or "none", and what it could not judge.

**Merge:** put all defects in one list. Rank hard-rule breaches first, then anything two critics name, then
by damage to the film. Record what you will not fix and why.

**One fix round.** Re-check the fixed scenes on stills and clips yourself. Do not rescore. Report the panel's
score as "before the fix round; the fixed film has not been scored".

## 7. Render

- Picture renders only on the render machine, through its queue, **one job at a time**, with its image
  service left running (a machines file with no services to stop) and the engine's `--no-test`.
- 1920x1080, 60 fps, CRF 12, 8 samples, 16 for fast motion.
- Two controllers is a rule broken. Before any restart: stop the old controller, end its queue lease, and
  list the remote workers. A process id list can hold two ids; check each one stopped.
- **Watchdog:** act after 5 minutes without log movement. Wait until the machine answers **and** no old worker
  is left before starting another. A network drop kills the worker while the controller waits forever.
- A changed opening only re-renders its own scenes. Keep finished files aside, never overwrite.

## 8. Finish on the Mac

Lyric layers and composites as each picture lands, then the join. The guard that stops a Mac picture render
must match `segment NN (` and not `segment NN cached`.

Check the encoded file: size, 60 fps, frame count, full decode, black and frozen runs, audio offset against
the song, a brightness test for repeated flashing, one frame of every scene, and (on a splice) that the
reused scenes still match. Say what was not checked.

Copy to `movies/`, import to the chapter's Photos album, push source and a stills sheet to the public repo
after a privacy scan, close the dashboard entry.

## 9. Timings measured on Genesis 16 (273 s song, 47 scenes)

| Step | Measured |
|---|---|
| Version 1, all scenes | 4.1 h of render time, median 0.79 s per frame |
| Version 2, all scenes | 3.7 h of render time, 4 h 17 min by the clock, median 0.76 s |
| Version 3, 19 heavy opening scenes | 2.7 h of render time, 3 h by the clock, median 1.45 s, slowest 2.6 s |
| 19 quarter-size clips | about 30 min |
| Join | about 4 min |
| Request to delivery | v1 7 h, v2 5 h 20 min, v3 6 h |

Shader cost varies by scene. A four-scene test predicted version 2 within about 20%. Estimate from the
clock once several scenes have finished; early frames of a scene read two to four times too slow.

## 10. Reporting

- **Measure before claiming.** Genesis 16 reported "4x faster" from one still. It was not true in general.
- Say which frames you looked at, and whether you watched it. "Checked" names the check.
- Give your own honest score and the panel's, and say which version each one saw.
- Correct a wrong claim where it was made, including in public notes.
- No approval stop once the owner has said go. Report problems, keep rendering.

## Lessons

- Empty wides with a drifting camera are the main failure. Put an actor and a foreground in every shot.
- Objects acting the line beat realism. The opening was liked for story before it was liked for picture.
- Judge motion from clips. Twenty good stills hid a film in which nothing happened.
- Evenly scattered rocks and bushes read as polka dots. Faceted props read as an old game.
- Night goes flat or black: light it, keep contrast, check the encoded file.
- Curtains, hides and folds can look like faces or animals. Ask critic C.
- Soft-shadow tricks leave rings on cloth and tents. Look for them.
- Keep the old version. The owner may want to compare.
