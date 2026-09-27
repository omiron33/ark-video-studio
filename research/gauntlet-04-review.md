# Independent visual review — gauntlet 04

**Verdict: the middle-to-photo transition is resolved; one visible occlusion regression prevents a visual pass.**

Actual encoded artifact: `output/gauntlet-04.mp4`, 960×540, 30 fps, 10 seconds. SHA256 `6ccb5b458e62dd3129c0e58c739dfc15e458558fb6c0ea2bf6ade8d628bc3002`; render revision `ca7d81287a579a4c2fe297c4aadd17d6a71cb176221dc9424d1b0b138e1290e1`; project hash `397e9bc8c2f6f4e42e0759ba72f7bff22105bd2fff202aa2295ee1456b85c6da`; renderer hash `4e8456766adacd08df97ee9cec1a9f7698c404938baec38000c21841d11e08dc`.

Inspected a full-film 4-fps contact sheet, a denser 4.3–6.5-second middle sequence, a 20-fps dive sequence, a 15-fps sinking sequence and the final decoded frame at 9.9667 seconds. Local evidence: `/tmp/bible-video-reference/gauntlet-04-{contact,middle,dive,sink}.jpg` and `gauntlet-04-final.png`.

| Visual category | Score / 10 | Finding |
|---|---:|---|
| Lyric legibility | 8.2 | Words remain readable before intentional transition/occlusion. Earlier overlap stays fixed. |
| Semantic motion | 7.5 | The camera now travels through the O in GROUND, visibly turning a letter into a doorway into the flood. The finale loses its resolution because BELOW reappears after submerging. |
| Photorealism | 8.0 | The crest and photographic layers retain plausible detail. The reappearing text exposes a compositing boundary but does not require regenerating the artwork. |
| Composition | 8.2 | Strengthened contour terrain and scale change give the middle a visible spatial role. Graphic/photo balance and palette remain coherent. |
| Continuity | 7.2 | The O-counter transition addresses the prior arbitrary aperture. The sole remaining blocking discontinuity is the submerged word returning at the bottom edge. |

## Required fix

At approximately 9.5 seconds, **BELOW reappears underneath the foreground wave layer at the bottom of the frame**. It remains visibly cropped across the lower edge in the final frame. DISAPPEARED is now covered, but the end is not clear ocean.

The visible symptom is consistent with text translating below a finite foreground alpha matte. Extend opaque foreground coverage to the canvas bottom, or stop drawing the text once it has become fully occluded. Verify the complete 9.3–10.0-second sequence after the fix, including the actual encoded last frame. No further redesign is requested for this round.

Sync remains separately pending auditory verification; the measured ASR evidence and its residual uncertainties are unchanged from `gauntlet-03-review.md`. No overall approval or visual-only pass is recorded for this artifact.
