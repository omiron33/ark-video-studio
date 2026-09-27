# Independent final encoded-video review

**Visual pass: all five visual categories meet the 8/10 bar.** This review supersedes the earlier review of `genesis7-showcase-1080p.mp4`. It independently inspects the freshly aligned `output/genesis7-showcase-final.mp4`; it does not reuse the earlier approval or the local model's scores.

## Exact artifact binding

- Video SHA256: `042772eae34ff971aecb8f6f5eaceb780bb5551ac8e1442d15c22b255b457d0d`
- Project hash: `77158605c0d6875a140cf884355654b0a5e5ae1d31c0521fdd6c2e3bf8bc9b51`
- Renderer hash: `ab94c60a494c446afc478a6e92cf928879c66047a152e40607f2e5b54fc6329e`
- Combined revision: `51b91ecd83e30416f3039aa1f82a1bc6bde19b57eafa055a52a0035ca7da40c7`
- Reviewer: independent `motion_reference_research` agent
- Scope: visual-only; objective audio and synchronization checks are a separate machine gate, with no human listening dependency.

The actual file was hashed and decoded. FFprobe counted 300 H.264 frames at 1920×1080, 30 fps, 10.000 seconds, with 10.000 seconds of AAC audio. Full FFmpeg video/audio decode completed without errors. After current-source reassembly, the video remained byte-identical and its render metadata matches the combined revision above. This note records independent visual judgment; the formal gauntlet owns the final combined gate.

## Visual judgment

| Category | Score / 10 | Observed evidence |
|---|---:|---|
| Lyric legibility | 8.1 | All words are visibly readable during their delivery/hold. Large WATERS, HIGHEST, GROUND, DISAPPEARED and BELOW dominate. THE remains separated from WATERS; no unintended letter collisions or broken glyphs were found. |
| Semantic motion | 8.2 | WATERS visibly ascends beside vertical ROSE. HIGHEST forms a summit above GROUND. The camera enters GROUND's O, revealing the flood. The final phrase physically goes below the crest. |
| Photorealism | 8.0 | Detailed ocean, atmospheric mountains and irregular foam edges support a credible photographic composite. Foreground occlusion gives the final action spatial meaning. This is animated photographic art, not a fluid simulation. |
| Composition | 8.2 | Teal, ivory and coral unify three distinct visual treatments. Background detail stays subordinate to the lyrics. The graphic-to-photographic balance is close to the requested 60/40, with the photograph taking over near the six-second mark. |
| Continuity | 8.1 | The rising ivory wipe connects water lines to terrain lines. The O-counter dive remains registered to the letter. The final crest completes the disappearance; the last frame has no resurfaced text. |

The 8/10 threshold means a polished, usable ten-second proof, not perfection or a guarantee about every future generated scene.

## Actual sequence observations

- **0–2.73 seconds:** the opening remains a restrained moving contour field until the first word near 1.24 seconds. WATERS enters around 1.36 seconds and rises after ROSE begins. ABOVE and THEM retain clear contrast and spacing. THEM has a short readable hold before the ivory wipe, but the wipe does not begin hiding it before its updated sung interval ends.
- **2.73–6.4 seconds:** the contour mountain forms under the connector words. HIGHEST develops its visible arch; GROUND anchors the composition. The photo is first glimpsed inside the O before the enlarging counter occupies the frame. Dense samples show a continuous dive with no detached oval or accidental letter distortion.
- **6.4–10 seconds:** the photographic scene has room to establish before DISAPPEARED arrives near 7.19 seconds and BELOW near 8.16 seconds. Both are fully readable before the sinking action. Dense samples from 9.1 seconds through the end show ordered occlusion, followed by an ocean-only finish. The former bottom-edge resurfacing defect remains fixed.

## Remaining non-blocking limitations

1. The first roughly 1.24 seconds are visually quiet. It works as a musical lead-in, but a longer film should vary such openings rather than repeatedly use empty contour holds.
2. Connector words are intentionally smaller, and THEM is brief. The hero typography reads well at desktop size; a phone-specific version should be separately checked at its actual delivery size.
3. The ocean motion retains the character of a carefully layered photograph. Foam and water shapes do not evolve like simulated or filmed water. That limits the realism score while still meeting this proof's visual bar.

No further visual correction is required for this artifact. None of these visual judgments asserts that audio was heard. The bound waveform/ASR/CTC audio report supplies the independent objective synchronization gate; this review introduces no manual approval or listening requirement.

## Evidence inspected

- All eight scene-sequence sheets in `output/showcase-final-visual/`, covering the full film and both scene boundaries. The local model's score report was not read.
- Independently re-decoded dense sequences saved in `research/final-review-evidence/rise.jpg` (1.2–2.8 seconds, 15 fps), `dive.jpg` (5.1–6.5 seconds, 15 fps), and `sink.jpg` (9.1–10 seconds, 20 fps).
- The independent score record is `research/final-review-evidence/independent-visual-review.json`. Its approval is limited to the exact video and source binding above; different video bytes require a new visual review.

## Final source revalidation

After the subsequent creation-loop, generic layout and graphic-water changes, the showcase was rendered again against the final engine source. Its MP4 SHA and project hash remained exactly equal to those independently reviewed above. A fresh technical/audio gauntlet recorded that equality and retained this visual judgment; no new aesthetic score was invented. The current source binding and combined pass are in `output/final-verification.json` and `output/showcase-final-gauntlet/review.json`. The earlier binding above remains the historical record of the actual independent inspection.
