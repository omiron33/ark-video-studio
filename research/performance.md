# Render and cache measurements

Measured 2026-09-27T00:47:10.875Z on this Mac mini: Apple M4 Pro, Mac16,11, 12 physical / 12 logical CPU cores, 24 GiB RAM, Darwin arm64. Hardware values came from `uname -sm` and `sysctl`; these are local measurements.

The initial showcase renderer revision produced a 10.000-second, 300-frame, 1920 × 1080, 30 fps H.264/AAC showcase. The measured operation includes source/cache checks, any required section rendering, stream-copy video assembly, audio muxing, and final verification. Times are the renderer's recorded wall-clock interval before its final metadata sidecar write. It does not include alignment, asset generation, or independent visual review.

| Case | Elapsed wall time | Cache hits | Rendered sections |
| --- | ---: | ---: | --- |
| Cold showcase export | 5.520 s | 0 / 3 | All three |
| Unchanged full export | 0.430 s | 3 / 3 | None |
| Change only `waters-rise` accent | 1.677 s | 2 / 3 | `waters-rise` only, 82 frames |

The cold result is the existing `output/benchmark-cold-1080p.mp4.render.json` (5.52021275 seconds). Before benchmarking, its render-time source revision was checked against the unchanged current project and renderer; they matched. The unchanged export reused all three encoded chunks and still assembled and muxed the complete ten-second video. Its final bytes match the cold output.

For the isolated edit, a temporary manifest was created next to the original manifest so all relative audio/image/font paths resolved identically. Only `sections[waters-rise].direction.accent` changed from `#e77951` to `#61c9bd`. It used the original `.render-cache`. The `highest-ground` and `disappeared-below` chunk keys remained identical; only `waters-rise` missed. The temporary manifest was removed afterward; its complete contents are preserved in the aggregate benchmark JSON for reproduction.

The real `projects/genesis7/project.json` and engine sources were not edited. Original manifest SHA-256 before and after: `053dcaa5db8901928b74285ca914714650c80d8913bb76cf8c6b60d7c4c997f6`.

Renderer revision: `dbbb38b867114677073b1b8935664719c3c7ed3543b9d2040bfb03bec12d46f9`.

## Evidence

- [Aggregate machine-readable results](../output/cache-benchmark.json)
- [Cold export metadata](../output/benchmark-cold-1080p.mp4.render.json)
- [Warm export metadata](../output/benchmark-warm-1080p.mp4.render.json)
- [Isolated edit metadata](../output/benchmark-one-section-edit-1080p.mp4.render.json)

These are single-run observations under the machine's current load, not averages or guarantees. They establish correct incremental reuse for this representative showcase. The old Python v3 film uses a different visual pipeline, duration, and frame rate, so these measurements do not establish a like-for-like speedup over that renderer and should not be extrapolated to a full-song ETA.

These measurements predate the autonomous ASR/forced-alignment/vision extension. They measure export and cache work only; model inference and review are deliberately excluded. Later source changes intentionally invalidate cache entries. The original cold metadata is archived separately so later final renders cannot overwrite this evidence.
