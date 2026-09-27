# Independent review of the automatic draft

**Current result: the corrected automatic proof passes all five visual categories at 8.0–8.3/10.** Its exact bound approval and evidence are in `research/automatic-graphic-evidence/independent-visual-review.json`; the corrected review appears below the original findings.

**Original draft, superseded: readable, but its final section did not meet the 8/10 visual-quality bar.** Its weakness was composition and meaningful motion, not missing or broken letters.

Reviewed the actual result resolved from `output/create-audio-only-proof/run.json`: `output/create-audio-only-proof/film.mp4`, 1920×1080, 30 fps, 10 seconds. I inspected decoded frames before looking at the project and did not read local-model grades.

- Video SHA256: `3388266bf88134ac70e3cb1b7846cef10d73690f699a8002b0b0cb3c5356db14`
- Render/project hash: `3e0f85b9cee3ef2d3022d0e2cecec95c15c9fe5812f3e3b01ad293582e4f73f0`
- Render revision: `9a331c763141dea5cd922824714efd85ed08aa29ca91c80bc9a2b3e217dc76ee`

Evidence inspected: a whole-film 4-fps contact sheet, a 10-fps sequence from 5.4–8.2 seconds, and a full-resolution frame at 7.45 seconds. Temporary decoded evidence is under `/tmp/ark-auto-independent-aPGbjJ/`.

## What the actual frames show

1. **A nearly empty interruption from 5.433–7.2 seconds.** The useful HIGHEST/GROUND composition abruptly becomes a faint dark grid for about 1.77 seconds. A vocal rest explains why there is no new lyric, but does not make an unrelated, nearly empty grid an interesting visual bridge. The preceding terrain could continue to carry the action during this interval.
2. **DISAPPEARED is stranded near the top.** At 7.45 seconds its glyphs occupy roughly y=124–281 of a 1080-pixel frame, leaving most of the canvas unused. The word is clean and large; reducing the font is not the solution. Its position looks like the first row of an unfinished layout rather than a deliberate single-word composition.
3. **The last phrase does not perform its meaning.** DISAPPEARED enters and holds; BELOW is then stacked beneath it. The phrase remains visible through the ending. The first two scenes use spatial meaning successfully, so this generic final card is a conspicuous drop in quality.
4. **Two arbitrary changes weaken continuity.** Terrain cuts to grid, then grid cuts to stars. Neither visual change carries the flood/height/disappearance idea forward. Subtle star drift does not resolve this disconnect.

No accidental letter collision, malformed glyph, clipping, or spelling defect was found in the final phrase. Its contrast and size are good. The absence of photographs is not itself a defect for an explicitly graphic-only proof; the final graphic action still needs to be purposeful.

## Smallest real fix

**First fix the obvious layout:** position the visible phrase as a vertically centered block. A single word should begin around the visual center; when BELOW arrives, shift into a balanced two-line composition. Compute the block bounds from its actual line count/metrics instead of always starting at a fixed upper baseline. Keep the present readable scale.

**Then fix the semantic ending with one supported action:** retain a related contour/water field through the rest, bring in the centered final phrase at the existing acoustic cue times, and move/mask the phrase downward after BELOW has finished its readable hold. An abstract waterline or contour mask is sufficient; no new photographic generation is needed for this graphic-only test. The final frame should complete the disappearance instead of freezing both words on screen.

For the gap, extend the preceding terrain treatment or deliberately transform those same contours into the final water field. Avoid creating a separate decorative scene solely because there is a vocal pause. Preserve the frozen word timings; all of these corrections are visual staging and exit timing.

Independent provisional scores for this exact draft: lyric legibility **8.5**, semantic motion **6.5**, graphic/material coherence **7.2**, composition **6.5**, continuity **6.0**. These do not transfer to a revised render. Audio synchronization is outside this visual review and remains governed by the separate machine measurements, with no manual listening requirement added.

No source was edited.

## Corrected automatic proof: independent pass

The fresh artifact `0c8d5a9d547b5158047dce1335c92d622cc199ab519e4aaa691075538d86a790` supersedes the failed draft above. It was reviewed independently from actual decoded output; no local-model grades were read. The current project hash is `5f9e0ee8c7901d8c37ed58860b5d1ba9aad976d0e9cc90e620453106b766d705`.

All five visual categories now meet the 8/10 bar for this **explicitly graphic-only proof**:

| Category | Score / 10 | Judgment |
|---|---:|---|
| Lyric legibility | 8.3 | Clean, readable hero words and distinct connector words; no accidental collisions or cut-off glyphs. |
| Semantic motion | 8.2 | Rise, summit, letter-counter travel and submersion provide causal actions driven by the words. |
| Graphic/material coherence | 8.0 | The photorealism rubric slot assesses coherent drawn materials here; this score does not claim photographic realism. Contour water and terrain use a consistent visual language. |
| Composition | 8.0 | The final phrase now occupies the useful central area with clear size hierarchy; the waveform-like water field supports it instead of leaving an unfinished empty layout. |
| Continuity | 8.1 | Terrain carries the vocal pause, the O-counter leads into the water field, and the words disappear completely without resurfacing. |

The previous 1.77-second unrelated grid has been removed. The terrain now remains readable through the rest and transitions through GROUND's O. The final phrase is balanced in the center; after its readable hold, it moves below a rising drawn waterline. Dense samples and the actual last frame show a completed exit with no leftover lyric fragments. Full video/audio decode also completed without errors.

The opening and the HIGHEST/GROUND hold remain restrained. They are acceptable in this ten-second proof, but repeated use across a whole song would need more variation. This pass covers the corrected artifact only, not arbitrary future engine output or the separately authored photographic showcase.

Evidence and the exact bound independent score record are saved under `research/automatic-graphic-evidence/`: whole-film contact sheet, dense transition and ending sequences, full-resolution phrase and last frames, and `independent-visual-review.json`. Approval attachment is deferred until the active create run finishes, to avoid concurrent report writes. The pipeline must recheck exact video/project/source bindings before attachment. Audio remains a separate objective machine gate; no manual listening requirement is introduced.
