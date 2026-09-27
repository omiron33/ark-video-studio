# Full-song render and review evidence

Measured locally on the Mac mini; these are individual observations, not latency guarantees or a claim that automatic review produces perfect films. Generated evidence under `output/` is local and may not be committed.

## Export is separate from review

The full film is **367.167 seconds, 1920 × 1080, 30 fps, 11,015 frames and 66 scenes**. Completed exports took:

| Export | Render wall time | Cached scenes |
| --- | ---: | ---: |
| [Full pass01](../output/genesis7-full-pass01.mp4.render.json) | 160.85 s | 0 / 66 |
| [Full pass02](../output/genesis7-full-pass02.mp4.render.json) | 171.88 s | 0 / 66 |
| [Full pass03](../output/genesis7-full-pass03.mp4.render.json) | 166.54 s | 0 / 66 |
| [Full pass04](../output/genesis7-full-pass04.mp4.render.json) | 168.44 s | 0 / 66 |
| [Full pass05](../output/genesis7-full-pass05.mp4.render.json) | 27.51 s | 55 / 66 |
| [Full pass06](../output/genesis7-full-pass06.mp4.render.json) | 10.04 s | 64 / 66 |

Engine changes between passes 01–04 invalidated caches; those are **not** incremental-edit measurements. Pass 05 changed the closing title size and measured word intervals, rebuilt 11 scenes, and reused 55 unchanged scenes. Its 27.51 seconds is an actual full-film incremental-edit measurement. Pass 06 moves one shared cut by five frames, rebuilds two scenes and reuses 64; that full assembly took 10.04 seconds. Export includes rendering, assembly, audio muxing and technical verification, but excludes art generation, alignment and quality review.

The earlier ten-second showcase separately measured **5.520 s cold**, **0.430 s unchanged** and **1.677 s for one section edit**, with the other two sections reused. Those historical renderer measurements demonstrate scoped cache reuse, not a full-song turnaround guarantee. See [the original benchmark](performance.md) and [machine-readable results](../output/cache-benchmark.json).

A first full review must establish acoustic evidence, lyric visibility and visual quality across the film. A later edit may reuse matching evidence, but only when its content, policy and actual decoded inputs still match. The first complete review cost must not be represented by an unchanged export or cached ten-second edit. No completed end-to-end first full-film local-model review time is claimed here.

## Bounded visual-model inputs

The director retains every decoded archive frame and native OCR sample. It sends the model a deterministic **12–16-frame subset**, in one or two contact pages, emphasizing reading poses, action phases and both sides of cuts. Reports declare selected times, omitted anchors and maximum gaps; intermediate motion is not thereby verified.

For the same scene and identical 50 archived JPEG hashes, a controlled warm comparison measured **71.76 s for 50 frames / five pages** versus **15.51 s for 16 frames / two pages**. This single sequential pair showed a 78.4% reduction, but prefix caching, output length and system load affect it. An earlier selected-frame request took **95.16 s**, so the warm improvement is not unconditional. [Comparison](../output/director-sampling-benchmark/controlled-comparison.json), [caveats](../output/director-sampling-benchmark/findings.md).

## Partial model review is not film approval

The original bounded run inspected 12 / 66 scenes in **626.67 s**. The later run inferred the same scene count in **684.63 s**, but only **8 scenes / 42 words** passed complete evidence validation before the OCR defect below was caught. Dense four-scene batches took roughly 3.5–4 minutes. [Original summary](../output/fullsong-machine-pass01/bounded-summary.json), [later partial result](../output/fullsong-machine-pass03/partial-summary.json).

The small local model repeatedly returned every score as 8 while inventing clipping, missing words or inappropriate instrumental-lyric requirements. Exact decoded frames disproved several allegations. No score was rerolled; the model run stopped, and its coverage remains partial. Independent review of actual output, complete native OCR and objective audio checks are separate gates. None constitutes subjective listening or a guarantee of aesthetic perfection. [Observed limitations](../output/fullsong-machine-pass03/observed-model-limitations.md).

## OCR evidence collision and regression

Requested times **47.284590** and **47.300000** both rounded to filename `frame-0001419.png`, despite decoding different images. The second write overwrote the first; the coordinator correctly rejected its stale recorded hash. This was a deterministic filename collision, not interference between reviewers. [Reproduction](../output/fullsong-machine-pass03/ocr-collision-proof/collision.json).

Each sample now receives a unique deterministic filename. Requested times and seek calculations remain unchanged. Before reporting success, OCR rejects duplicate paths, missing files and changed hashes. Three [OCR tests](../tests/ocr.test.mjs) passed, including a moving encoded clip, rotated lyrics, the last 30 fps frame and evidence tampering. The [actual-film regression](../output/fullsong-machine-pass03/ocr-collision-fixed/regression.json) preserves both original distinct hashes, recognizes `OF` independently and verifies all four sampled files. This targeted fix does not retroactively approve older reports or replace a fresh complete OCR run.
