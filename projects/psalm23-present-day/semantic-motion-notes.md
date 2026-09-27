# Semantic motion implementation

Scope: thirteen replacement word/world handlers in `semantic-motion.js`, used by the composition's existing paused GSAP timeline. This is Theme 1, **Held in the Ordinary**. The photographs, cream serif voice, canonical text, measured word timing, and host-owned opacity reveal remain the visual foundation.

## Dispatch and seeking contract

- `window.P23_SEMANTIC_FAMILIES` lists the thirteen handled families.
- `window.P23_SEMANTIC_REGISTRY` is the literal family-to-function registry.
- `window.P23_SEMANTIC(p, ctx)` returns `true` only when it invokes a registered handler. The host calls it after shared lyric visibility setup and skips the legacy switch for those phrases.
- The host supplies `p`, `tl`, the scene root, and its existing word DOM. Words are moved, reparented, or their existing letters transformed; canonical word IDs and literal text remain unchanged. The shadow handler adds explicitly decorative, aria-hidden silhouettes; these are not additional canonical lyric nodes.
- Top-level code only declares helpers/registry and exports the contract. Geometry is created during handler construction. SVG curves are sampled into explicit GSAP segments at construction time. No requestAnimationFrame, CSS animation, random input, runtime geometry callbacks, or independent clock is used.
- Original generic contours are suppressed in handled scenes. The replacement geometry is linked to that scene's word action rather than layered over a second competing contour system.

## Original ten implemented relationships

| Family / phrase | Actual mechanism | Reading and image-space constraint |
| --- | --- | --- |
| `guided-thread` / 008 | `guided` traverses a sampled curved bridge between pivot stations; the bridge flexes as its load moves toward the waiting `me` destination. | All four words have distinct map stations on the corridor wall. The destination was shifted right after width arithmetic exposed a possible endpoint overlap. The final state holds for about a second. |
| `walking-ground` / 011 | Alternating letter feet in `walk` step over moving ground sleepers; footprints remain while the whole word covers real distance. | Two restrained step cycles, not continuous jitter. The word remains at its new location. Porch figures stay on the right. |
| `following-mercy` / 029 | Canonical words occupy consecutive bends of one S-shaped path and advance along that exact curve with delayed followers. | The right garden/hedge is the word world; neither women nor umbrella are covered. Large bends supply separate reading stations. |
| `cup-overflow` / 021 | `cup` occupies a bounded vessel; its liquid level rises. `wine` appears inside the vessel and pours along a curve into the sentence. | The complete moving word stays readable. Vessel and route are on the upper wall above the family, with a final stable reading position. |
| `table-setting` / 018 | `table`, `before`, and `me` occupy separate place settings on one perspective tabletop. The shared hinged plane folds toward the viewer and resolves into reading order. | The plane is only mildly tilted while words are sung; it never becomes edge-on. All text stays above the guests. |
| `affliction-perimeter` / 019 | Threat words surround a guarded `me`. The protected word moves into a lower clear corridor first; threats then uncoil above it; `me` travels right and rises into the final sentence. Its guard follows. | A real collision found at 98.9s was removed by staging the transport instead of allowing crossing words. The lower corridor falls in the empty wall between the guests, not across faces. Final sentence holds after about 100.5s. |
| `anointing-descent` / 020 | Already-read `oil` letters gather into a droplet, descend toward `head`, and reopen into the intact word. The head responds once to the contact. | Coalescence begins only at `oil.end + 0.45`, after the measured reading guard. A line droplet supports the exact editable letters; it is not a second lyric word. |
| `days-orbit` / 030 | `days` makes one full orbit around the fixed `of my life` center, with twelve calendar divisions. | `life` was lowered and the orbit expanded after full-size inspection exposed crowding with `my`. The wider left edge and lower bottom route separate moving `days` from the center words. |
| `life-continuum` / 032 | Words belong to three connected ribbon planes. Two hinges unroll with the sung sequence; the connected ribbon and words then advance together. | Three discrete reading planes use the right hedge. Mild perspective retains readability, and the last movement is one calm 48px continuation. |
| `house-doorway` / 037 | Left and right wall stations open around the actual photographed doorway. After the left clause has been read, it passes behind a fixed left-jamb aperture; the right destination clause stays visible. | The family's central opening remains clear. Left-clause occlusion begins only after its final word ends plus 0.55s. This is an actual clipped passage, beyond the initial wall pivots. |

The code families are implementation identities, not a claim that the entire film has passed any perceptual variety count. Final motion quality requires chronological review of the encoded artifact.

## Reference evidence inspected for this implementation

Search from the engine checkout:

`node engine/cli.mjs references --query 'Psalm23 guided path walking protection mercy following days of life cup overflow table hospitality doorway slow warm lyric words spatial relationship clear reading hold' --limit 3`

All three returned contact sheets were opened, not inferred from captions.

| Reference | Source interval / sampled times | Observed principle and caution | Scene-specific adaptation |
| --- | --- | --- | --- |
| `internal-foreground-occlusion` | Genesis 7 v3, 116.1–122.787s; 117, 118, 119, 120, 121, 122.5s | Foreground depth can be convincing, but the supplied figures hide important words. This is cautionary evidence. Shane's approval of this treatment is not recorded. | Protected canonical onset intervals; post-reading oil/doorway actions; actual negative-space planning around people. |
| `internal-lineage-journey` | Genesis 4 Motion v2, 212.1667–221.3s; 212.3, 214, 216, 217.5, 219, 221.1s | Shared geography carries relationships across words rather than presenting disconnected cards. Departing words clip at the left edge. Shane's approval of this treatment is not recorded. | Fresh curved guide stations, mercy garden path, connected life ribbon, and photographed doorway passage; not the source's rail layout. |
| `internal-word-rupture` | Genesis 7 full dark, 143.7333–148.9s; 143.9, 145, 146.2, 147.2, 148, 148.7s | Separation between words performs the verb. The principle is meaningful geometry, not a reusable burst preset. Shane's approval of this treatment is not recorded. | Vessel/word pouring, guarded-center uncoiling, tabletop planes and letter-droplet contact. |

Reference sheets are under `references/motion/images/<reference-id>/sheet.jpg` in the engine checkout. Existing project `concepts/reference-notes.md` was also read; its other references were not newly claimed as inspected by this implementation.

Actual project photographs p04, p05, p07, p10 and p12 were opened to determine usable negative space: corridor left wall, rainy porch left field, meal upper wall, garden right hedge, and the two walls around the central family doorway.

## Validation and handoff

- `node --check semantic-motion.js` passes.
- The first merged runtime PNGs inspected at full size: 98.9, 106.15, 112.25, 147, 153.25 and 190.9s. These establish that the hook actually changes rendered structure. Cup and mercy scenes clearly demonstrate their intended spatial relationships.
- That inspection exposed the affliction transport collision and orbit-center crowding; both were corrected before freeze. Subsequent full-size inspection of `snapshots-final/frame-05-at-98.9s.png`, `frame-06-at-100.6s.png`, `frame-07-at-153.25s.png`, and `frame-08-at-154.1s.png` verifies the corrected spacing in those sampled states. The first PNGs must not be used as evidence for the final corrections.
- `snapshots-final/frame-02-at-50.5s.png` and `frame-04-at-60.8s.png` were also inspected: guide destination and walking words are clearly separated. Walking glyph tilt was reduced from 7 to 3 degrees after the layout check flagged adjacent letter boxes. A displaced decorative guide pivot in that first 50.5s PNG was corrected by removing its SVG scale/origin tween. The rebuilt `snapshots-pivot/frame-00-at-50.5s.png` was opened and confirms the circle now sits on the guide junction near (663,624), with no stray upper-wall circle.
- Recommended chronological proof ranges: guide 49.6–51.2; cup 111.3–112.9; oil 105.2–107.3; affliction 97.5–101.5; orbit 151.9–155.4; doorway 189.3–192.4s. A single still cannot establish the quality of those motions.
- Source is frozen for the merged full check and encoded review. This child did not render or approve a final film, claim a listening score, change acoustic alignment, or publish any delivery artifact.

Archived v1 semantic source SHA-256: `e2ea13eb9fd52c2fe12e679c94da00e7703315b6f6406676b5cb61a206ea3054`. The composition worker reported `/tmp/ps23-check-7.json` passed with zero errors before the final decorative pivot-only change; the pivot change received its targeted rebuilt visual check.


## Bounded encoded-review repair: three new mechanisms and two spacing fixes

This revision was implemented and encoded in `/tmp/ps23-semantic-v2`, with production left unchanged for parent integration. Only `semantic-motion.js` and this note are delivered in the patch. The original ten handlers remain active, with the following two concrete spacing repairs, and three previously generic families now dispatch to additional effective handlers.

| Family / phrase | Final changed behavior | Clear reading interval and visible evidence |
| --- | --- | --- |
| `growing-grass` / 003 | Existing cream `green` glyphs grow into rooted blades. Stems and broad branching leaf pairs connect the glyph baseline to the ground. `grass` subsequently grows from the same baseline. | All words first enter intact. Main growth begins after `green.end + 0.45`; `grass` remains intact through `grass.end + 0.4`. The brief scene ends at 25.795s, so the already-read `green` carries the longer visible growth while `grass` is still sung. The 390px decoded sequence shows growth from roughly 24.35s and a branched hold through 25.6s. |
| `withdrawing-shadow` / 012 | Fixed canonical words cast dark projected word silhouettes that physically traverse a fixed patch of warm porch light. Their y-compression, skew and translation change together as a projection. | Each silhouette starts after its source word ends plus 0.42s. The canonical line stays unobstructed and still. The projection surface uses a feathered warm gradient and 28px blur, with no polygon outline; this replaces the rejected hard-edged first proof. Final shadow was re-encoded against the reconciled timing for `shadow`, 62.603819–63.404285s. |
| `unbroken-declaration` / 028 | Exact canonical glyphs assemble as the material of a continuous arch, with two small footing stones. The sampled guide curve itself is invisible. | The complete horizontal declaration holds until the final word ends plus 0.45s, about 138.800s. Glyph construction completes around 139.94s and holds through approximately 141.96s. A 390px decoded action sequence confirms the arch remains large and distinct above the people. |
| `cup-overflow` / 021 | `wine` takes a low left exit from its cup before curving upward into the line, replacing the route that crossed `cup`. | Native 111.3, 111.8 and 112.2s plus the complete decoded 8fps sequence from 111.15–112.95s were inspected. The two words stay separate throughout the previously failing crossing. |
| `following-mercy` / 029 | The shared S-curve has a deeper middle bend. `shall` occupies an upper right station and `follow` a lower left station; all followers retain actual path travel. | At the previously failing 145.4s state, `shall` sits roughly y404–518 and `follow` y636–754, comfortably over half an em apart. Native 144.8, 145.4 and 146.4s and the complete decoded 143.3–147.2s sequence show distinct tiers instead of a false `follow shall` line. |

The three new hooks are literal registry entries, not unused branches or declared-only names. An isolated registry/dispatch test verifies all thirteen family keys invoke their own handlers and that an unknown family falls through. The host must continue invoking this hook before its legacy family switch and skipping that switch when handled.

### Additional reference evidence

The parent ran the bounded scene query for these three meanings, and this implementation opened both actual returned image sheets again:

- `external-microtype-image-world`, source 75–85.033s, sampled at 75, 77, 79, 81, 83 and 85s: a shared typographic material can build image structure. The small text is not a suitable scale for canonical lyrics. Fresh adaptation here uses the existing large cream glyphs as blades and arch stones; it does not recreate the reference imagery or sequence.
- `internal-foreground-occlusion`, source Genesis 7 v3, 116.1–122.787s, sampled at 117, 118, 119, 120, 121 and 122.5s: layered structure can integrate words into a world, but foreground overlap can hide sung words. Fresh adaptation keeps canonical words unobstructed until their measured reading interval has finished, and uses a separate decorative projection for the shadow scene.

The actual p02 lawn and p09 living-room photographs were opened for negative-space planning; the previously inspected p05 porch supplied the shadow surface. Source provenance and cautions are carried above. Neither source treatment is claimed as individually approved by Shane.

### Targeted encoded proof and source binding

All five excerpts are actual 1920×1080 H.264 encodes at 30fps with source AAC audio. The proof wrapper offsets local excerpt time into the original paused scene timeline. Off-range media is removed only in the excerpt wrapper; production composition and canonical data are not rewritten. The source intervals and exact artifact hashes are recorded in `/tmp/ps23-semantic-v2/repair-validation.json`.

| Change | Encoded artifact | Source interval | Decoded chronological sheet, 390px per frame |
| --- | --- | --- | --- |
| Grass | `proof-grass.mp4`, 103 frames | 22.35–25.78s | `grass-encoded-390.jpg` |
| Shadow | `proof-shadow.mp4`, 106 frames | 62.23–65.74s | `shadow-encoded-390.jpg` |
| Cup | `proof-cup.mp4`, 54 frames | 111.15–112.95s | `cup-encoded-390.jpg` |
| Declaration | `proof-bridge.mp4`, 220 frames | 134.78–142.10s | `bridge-action-encoded-390.jpg` for the complete transformation, plus `bridge-encoded-390.jpg` for the whole excerpt |
| Following | `proof-following.mp4`, 117 frames | 143.30–147.20s | `following-encoded-390.jpg` |

All files in this table are under `/tmp/ps23-semantic-v2/`. Each final chronological action sheet was opened and visually inspected. The final softened shadow sheet was reopened after the source timing reconciliation and re-encode. Initial hard-edged shadow stills in `proof-native/` and `proof-phone.jpg` are superseded and must not be used as final shadow evidence. The final native softened shadow states are in `proof-shadow-soft/`.

Validation confirms thirteen dispatching handlers and all 210 canonical `(id, text, start, end)` tuples equal the current source. Source words SHA-256: `a0457cf99af4c446721bde09a9f2aa287072d6a3bc478c92a002ff6aa0e3da2c`. Semantic source SHA-256: `86309f197ed2610bde8c4e9be51e8f9154a1c373b604e4ea928eed70df14703e`.

The shadow excerpt uses the current reconciled timing. The other four excerpts' visible behavior is unaffected by the parent's timing changes; the revised `cheers` interval ends before the cup excerpt begins. These isolated proofs establish the five bounded changes, not final-film acceptance, audio review, OCR acceptance, or a claimed film-wide variety count. Parent integration, merged checks and chronological full-film encoded review remain required.
