# Create a lyric video from a song and a style brief

`create` runs local alignment, portable project intake, measured musical-event detection, scene direction, rendering, decoded-audio and vocal-sync review, visual review, and the final quality gate. It saves evidence at every stage and allows at most three rendering/review passes per invocation by default. A failed gate produces a report and a draft, never a misleading `finished` status.

```sh
node engine/cli.mjs create \
  --audio /path/to/song.wav \
  --style-prompt 'Dark teal kinetic typography, luminous contours, words that move with their meaning' \
  --out output/my-song
```

For known lyrics, add `--lyrics exact-lyrics.txt`. Canonical supplied lyrics remain exact; the local acoustic forced aligner measures their position. Without supplied lyrics, local speech recognition provides the candidate text and the measured audio reviewer checks its support. Sung words remain a difficult recognition problem: unresolved or weakly supported alignment fails with evidence, rather than invented word timing. Existing timing can be supplied with `--timing words.json`. JSON timebases are respected; `--timing-timebase source|clip` is an explicit override.

Useful controls:

- `--offset 121.3 --duration 10` selects a source-song excerpt. Word timing is converted to project time and output audio uses the same source offset.
- `--width 1920 --height 1080 --fps 30` sets delivery resolution; `--scale .5` makes a smaller test export.
- `--beats events.json` supplies measured events; otherwise RMS/low-frequency attacks are detected from actual audio. Events are onsets, not a fabricated BPM grid.
- `--max-passes 3` bounds repair and rerender passes (1–4 allowed). The final pass cannot mutate the project.
- `--director-endpoint http://127.0.0.1:11434 --director-model qwen3-vl:4b-instruct` selects the local Ollama model. No paid API is called.
- `--python /path/to/python --backend torchaudio-ctc --model /path/to/local/model.pth` overrides local audio runtime discovery. Models must already exist locally; this command does not download them.

## What the style prompt does

The base plan groups exact timed words into varied, editable sections, with reproducible section IDs and random seeds. Its limited vocabulary recognizes calm/energetic/spatial direction, colors, and a few explicitly authored semantic phrases. This is an honest deterministic fallback, not an open-ended AI claim.

By default an available local language model then interprets the complete brief and each section's actual lyrics. Its validated edits select scene styles, motifs, scale and accent. It cannot change canonical lyrics, word timings, song source or duration. The plan records the actual model, method, proposal and any failed attempts. A missing or malformed director falls back explicitly; a missing visual reviewer cannot satisfy the final quality gate.

A separate local vision pass judges contact sequences extracted from the encoded video, with a required score of at least 8/10 for lyric legibility, semantic motion, photorealism/treatment, composition and continuity. This model does not claim to hear the audio. Decoded-audio matching, source offset/duration, phrase presence and word timing are measured by the audio reviewer. The gauntlet binds reviews to the exact MP4 and project revision. Local-model review is fallible; the evidence and limitations remain available for inspection.

## Artwork and authored direction

The CLI consumes supplied images; it does not pretend to generate photographs. A brief requesting photography without images records `assetRequests` and cannot finish until imagery has been assigned and the reviews pass. When an agent operates this workflow, fulfilling those requests is the agent's job: use the built-in GPT Image tool, select the result, copy it into the project, assign it to the intended sections, then resume. Do not turn an ordinary artwork task into a user handoff.

Existing artwork and exact direction can enter through `--direction direction.json`:

```json
{
  "assets": {
    "landscape": { "type": "image", "src": "./landscape.png" }
  },
  "defaults": {
    "assetIds": ["landscape"],
    "direction": { "photo": "landscape" }
  },
  "palette": { "accent": "#6dbeb8" }
}
```

Image paths resolve relative to this JSON and are copied with content hashes into the portable project. An optional `sections` array patches known section IDs from `plan.json`, including style, assetIds and direction. It cannot retime sections or replace canonical scene words. A local director may refine styles after these defaults; original image assignments remain available.

## Outputs and retry

`output/my-song/run.json` is the authoritative orchestration report. `project/project.json` is the portable editable source; its assets include the original song, supplied images, fonts and font licenses. `plan.json` records direction evidence. `film.mp4.render.json` records encoding/cache timing and source revision. `review/attempt-NN/` contains measured audio, visual evidence and the gauntlet result.

A run has `status: finished` only when technical, measured audio, visual and required-artwork gates all pass. `quality_failed` keeps the rendered draft and concrete findings. `failed` records a runtime or input failure. CLI exit code is 0 only for `finished`, 2 for an executed but unfinished creation run, and 1 for invalid command/setup arguments.

After repairing a project or resolving a missing local model, repeat the same command with `--resume`. Inputs and brief must match the saved request; changing them requires a new output directory. Resume retains intake, exact timing and the planned project, then rerenders/reviews. Add `--replan` to rerun local direction from the current canonical words and assets (for example after restoring an unavailable local model). The saved report retains every attempt across resumes; its original start time includes any pause between invocations. Individual stage timestamps and export seconds distinguish processing from that elapsed span. Each run is locked to prevent simultaneous writers, and section caches reuse unchanged compatible chunks. Existing source audio, prior projects and v1–v3 films remain untouched.

Unit tests use explicitly labeled test services for orchestration assertions; they are not evidence that a synthetic test video passed actual listening or visual review. Real integration runs and their model/measurement reports are separate deliverables.

## Independent agent review fallback

A small local vision model can disagree with a stronger independent visual agent, including about intentional motion. Its original scores and notes remain recorded. An independent agent must inspect the actual decoded output, record its real five-category judgment through the gauntlet, and bind that judgment to the current output and source. The user does not need to supply a hearing score.

After that review exists, an agent can run:

```sh
node engine/cli.mjs finalize-run --run output/my-song
```

`finalizeRun({runDir, reportPath?})` is the equivalent API. It generates no scores and changes no video. It calls `checkReview` against the current MP4, project, declared inputs and engine source, requires current technical checks and actual measured audio evidence, requires an existing independent visual review, and rejects pending required artwork. Successful status is `finished` with `gate.status: independently_reviewed`, preserving the prior local critic's failure and every attempt. A stale, incomplete or failed review remains `quality_failed`; an old subjective hearing score cannot substitute for measured audio.

Short musical breaths hold the preceding meaningful composition. Only gaps longer than five seconds receive a separate instrumental scene. A suitable ground-to-water transition uses the O counter in GROUND when enough travel time exists. Graphic briefs retain the semantic submerge treatment through drawn water; a photographic brief still requires actual photographs. Submerging begins after the final word's measured end, with a small reading allowance, instead of hiding it while it is sung.
