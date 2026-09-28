# Psalm 23 word-sync audit for the next render

This audit is bound to the delivered v2 MP4 (SHA-256 `e483e690ef13766ee4e04414711d0826209151d3beab5a91864c113758f3e4f2`), the original audio (`3669040e797c9d2bf8b4136dc4c029c6e1ed51f302ccc411d1888ae50da80c8f`), `sources/words.json` (`a0457cf99af4c446721bde09a9f2aa287072d6a3bc478c92a002ff6aa0e3da2c`), and the exact encoded audio review (`f4c2233394188e622e0a1b21649d8e930ed77dc04068832bebb51a967df1844b`). No source word interval was changed in this audit.

## Finding

The source and encoded audio agree closely (overall decoded PCM correlation 0.999414, zero measured lag). Of 210 canonical words, the strict machine review passed 153, left 55 acoustically unsupported, and flagged two disputed matches. The seven defensible source timing corrections from v1 already pass in v2. These numbers do not support a global shift of the word-cue table. They also do not establish perfect subjective sync.

The clearer defect is **visible word arrival after its measured vocal attack**. `choreography.js` begins the shared opacity ramp at `word.start - 0.035` and takes 0.115 s to finish, so the word reaches full opacity about 80 ms *after* the attack. Many scene families also begin a 0.2 s clip or a longer spatial route at the attack. In the existing cue map, 12 words have only a roughly 20 ms CTC interval (shorter than one 30 fps frame), 48 have an interval shorter than the opacity ramp, and 82 shorter than a typical 0.2 s clip. A correct acoustic cue cannot make such a treatment read on its sung attack.

The [decoded v2 frame sheet](visual-word-sync-v2-frames.jpg) (SHA-256 `4139c6124b5d6d30bce3f2928cb5a9aabbd490b2ae1e55756fa97e7bc29ff01f`) shows these prioritized cases. Requested seek times are shown on the sheet; the encoded stream has 33.33 ms frame spacing, so a requested time may decode to a neighboring frame.

| Priority | Word and cue | Actual visual finding | Mechanism |
| --- | --- | --- | --- |
| 1 | `p23-l033-w01` “I”, 171.002–171.022 s | Absent on the attack and cue-end seeks, visible by 171.122 s | Shared opacity plus `quiet-courage` clip reveal; the source CTC alternatives disagree and cannot justify moving the sung cue 0.74 s. |
| 2 | `p23-l017-w01` “I”, 80.355–80.375 s | Absent on the attack seek, visible at the cue-end/next-frame seek | Shared opacity and `fear-clearing` reveal applied to a sub-frame word. |
| 3 | `p23-l001-w04` “my”, 16.302–16.502 s | Very faint at the attack, legible around 16.402 s | Shared opacity and gathering movement delay a clear reading state by roughly 0.1 s. |
| 4 | `p23-l024-w04` “no”, 121.766–122.067 s | Faint at the attack, strong by 121.933 s | Shared opacity and `unfastening-fear` reveal; movement and the readable state arrive in the latter half of the sung interval. |

The same short-cue risk occurs in `p23-l002-w02`, `p23-l003-w02`, `p23-l011-w03`, `p23-l013-w01`, `p23-l018-w04`, `p23-l024-w01`, `p23-l028-w01`, `p23-l036-w02`, `p23-l037-w02`, and `p23-l038-w02`. These are the other approximately 20 ms intervals and should get explicit attack-frame spot checks after the next encode. Existing OCR coverage (210/210) verifies eventual readability, not visibility at the sung onset; its first match time is too sparse to use as an onset measurement.

## Recommended rendering fix

Bring the essential, complete glyph into a clear reading state by the measured attack, with a short bounded lead if needed; run the expressive clip, travel, or material change on the already-readable word or after the sung reading interval. Keep the canonical source interval separate from a display lead and hold. For sub-frame cues, ensure the word is visible in at least one decoded frame near the attack and remains readable afterward. Recheck the actual encoded frames at the listed times and at representative longer words, including the Mercy generated-video handoff.

Do not copy the 14.332 s reviewer misassignment for `p23-l030-w05` “my” into the first refrain: it belongs to the later repeated phrase. Do not move `p23-l011-w03` “I” by 66 ms from one selected CTC pass when its complete-phrase pair supports the retained cue. Four “evil” occurrences also have conflicting CTC start boundaries; the large model's late start cannot by itself overwrite their first syllables. `p23-l020-w03` “anointed” has a selected start before the preceding “have” ends, so that proposed shift needs stronger evidence. No further ASR/CTC attempt was run here. Residual machine uncertainty remains explicit until a new encoded review and any justified manual acoustic check.
