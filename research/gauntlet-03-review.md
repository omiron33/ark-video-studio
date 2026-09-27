# Independent visual review — gauntlet 03

**Verdict: substantial improvement; two specific visual changes are still required before a visual pass.** Audio-listening verification remains separate and pending.

Reviewed encoded `output/gauntlet-03.mp4`, SHA256 `924815077ba96a3322f4b05c558401b8a6b5dd15edb4467347b4095f8514ebd8`. Recorded revision `24ca14801f8c1c1a705d7e935792b5197f925eeac3ae987b281c95abd3952934`; project `2feb26a048f367cf57475a860654cc888d24ad78d4767b20abe34198c8dca352`; renderer `fb356ca6ae3c491c17364eae39118938a949ef3d94f6c08f89c3f9ed50fca171`.

Evidence: full ten-second filmstrip at 4 fps; dense sequences across 1.10–1.70, 2.50–3.30, 6.00–6.90 and 8.75–9.55 seconds; full-size final decoded frame at 9.9667 seconds. Files are `/tmp/bible-video-reference/gauntlet-03-{contact,rise,cut1,cut2,sink}.jpg` and `gauntlet-03-final.png`. This is visual sequence review, not a claim of hearing audio.

| Rubric | Score / 10 | Change and remaining issue |
|---|---:|---|
| Lyric legibility | 8.2 | THE/WATERS collision is fixed. Connectives are meaningfully larger during their delivery. Hero words stay clear before intended occlusion. |
| Semantic motion | 7.2 | Rising WATERS, vertical ROSE, the summit-shaped HIGHEST and crest occlusion now communicate meaning. The middle still settles into a static card, and DISAPPEARED has not disappeared when the film ends. |
| Sync | Pending auditory review | The separate local analysis supplies useful timing evidence; see below. No invented listening score. |
| Photorealism | 8.0 | The detailed generated image and real photographic crest edge integrate plausibly in the sampled frames. The new foreground wave removes the previous rectangular-crop defect. It remains an animated photographic composite, not verified fluid simulation. |
| Composition | 7.8 | The opening is better staged and the palette remains coherent. The middle is visually sparse and parked relative to the opening/finale. The photo aperture cuts across the typography without a clear visual origin. |
| Continuity | 7.0 | The rising cream wipe is a real improvement. The oval aperture is smoother than a hard cut but appears to be an arbitrary mask rather than a transformation of the word or landscape. The final frame stops mid-burial. |

## Two targeted changes for the next round

1. **Complete the finale.** At 9.9667 seconds, a large part of DISAPPEARED remains clearly visible behind the crest. Move both words fully below the foreground wave by approximately 9.6–9.7 seconds and hold the ocean for the remaining fraction of a second. This should resolve the action already present, not add a new effect. Preserve the earlier readable hold of the full phrase.
2. **Make the middle produce the next image.** HIGHEST/GROUND is nearly unchanged from about 4.5 to 5.7 seconds; the underlying terrain is so faint that it contributes little. Strengthen a restrained contour landscape around the words and let a contour, baseline or letter counter initiate the photographic reveal. A dive through the O of GROUND would be one clear solution if its origin actually aligns with that glyph; a floodline that connects the graphic terrain to the photographic horizon is another. The important property is visible cause and effect. Do not merely replace the oval with a different generic wipe.

These are bounded corrections. The preview does not need additional images, particles, extra captions or more cuts. Its approximate 64% graphic / 36% photographic balance already serves the brief.

## Measured synchronization evidence, separate from listening

Read `research/audio-window.json`, particularly `independent_asr_passes`, `recommended_words` and `recommended_timing_policy`. Three local ASR checks were performed: base.en on the clip, small.en with context, and small.en with supplied lyrics. Two recover the complete lyric transcript. The recommended words correct the old GROUND onset from 5.55 seconds to 4.24 seconds; the two small.en estimates agree within 0.01 seconds. Most other words have reported inter-pass onset spread of 0.06–0.20 seconds. The sampled output follows the revised word ordering and approximate onsets.

Residual uncertainty is explicit for initial THE, DISAPPEARED and BELOW. DISAPPEARED's onset is retained from legacy alignment because other ASR passes absorb silence or delay it; BELOW is bracketed differently between passes. This supports broad readable phrase holds and rejects claims of sample-perfect vocal timing. The independently measured strong bass at about 4.528 seconds is an opportunity for the contour/summit action; the strong closing onset at about 8.870 seconds supports the existing submersion resolution.

No overall gauntlet approval is recorded. The next visual judgment can pass independently of the unresolved audio modality once the two visual defects above are resolved.
