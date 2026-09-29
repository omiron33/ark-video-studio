# Create a lyric video from a song and a style brief

## Choose the theme before running production

The agent entry point is [ark-song-video](../skills/ark-song-video/SKILL.md). For every new video, check the private Genesis Site for the approved song first, inspect actual reference-library contact sheets using [MOTION_REFERENCES.md](MOTION_REFERENCES.md), then generate **four GPT Image theme mockup images as one numbered contact sheet** (built-in tool or `node engine/cli.mjs image`; see [AGENTS_AND_MODELS.md](AGENTS_AND_MODELS.md)). Show it and wait for Shane's explicit choice. These are still-image concepts, not HTML builds, animated prototypes or rendered clips. Record the pending/chosen state and selected theme with the concept artifacts.

Each still should depict a distinct web-motion system built around editable lyric type, layout, coded geometry and palette. Use generated or photographic imagery sparingly as support; four pictures with overlaid type are not four themes. Before the choice, only intake, analysis, reference inspection and mockup images may proceed. Do not run `create`, author animation, build a prototype, generate the production asset set or render a preview/movie. General autonomous permission cannot bypass this requested checkpoint; only an explicit later waiver can. Existing approved projects retain their choice for routine edits. The private Site enforces its job choice; the standalone CLI does not.

## Run the approved direction

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

## Visual reference search

Scene direction now searches the [image-backed motion library](MOTION_REFERENCES.md) automatically, using the scene lyrics, style brief, neighbors, duration and previously used references. Up to three contact sheets enter the local model context. Selected sources and image evidence are saved with the plan. References inspire new scene-specific concepts; source images never become production artwork. The standalone director still applies supported controls; an orchestrating agent authors additional choreography. `--reference-library /path/to/library` selects another collection and `--reference-limit 0` disables lookup for the run.

## Artwork and authored direction

The CLI consumes supplied images; it does not pretend to generate photographs. A brief requesting photography without images records `assetRequests` and cannot finish until imagery has been assigned and the reviews pass. When an agent operates this workflow, fulfilling those requests is the agent's job: use the built-in GPT Image tool, select the result, copy it into the project, assign it to the intended sections, then resume. Do not turn an ordinary artwork task into a user handoff.

Existing artwork and exact direction can enter through `--direction direction.json`:

```json
{
  "assets": {
    "landscape": { "type": "image", "src": "./landscape.png" },
    "storm": { "type": "image", "src": "./storm.png" }
  },
  "palette": { "accent": "#6dbeb8" }
}
```

Image paths resolve relative to this JSON and are copied with content hashes into the portable project. An optional `sections` array patches known section IDs from `plan.json`, including style, assetIds and direction. It cannot retime sections or replace canonical scene words. A local director may refine styles after these defaults; original image assignments remain available.

New runs assign a supplied picture to at most one photographic scene. Supply enough distinct pictures for every requested scene, or fulfill the scene-specific `assetRequests` with the provider each request names and assign each result to its section. Never use `defaults.direction.photo` to repeat one picture throughout a film. Explicit repeated assignments are preserved for diagnosis and rejected, not silently swapped. The audit hashes actual file bytes, catching copied files under different names. Re-encoded/cropped variations still require visual review: a new file hash is not proof of a new composition. Fonts, shared texture dependencies, and a successor image visible inside a continuous transition do not count as separate scene reuse.

## Visual rhythm for future runs

Every new `create` plan includes a recorded creative policy and deterministic phrase-pacing evidence. Measured vocal onsets and audio attacks can support a sparse three-word accent burst. Sustains and phrase tails support held compositions or slow dissolves of the supporting graphics. Ordinary flow connects these changes; a burst is an accent, not the default. Canonical word timings are never moved to make an effect fit. Without measured support, the planner does not invent a syncopated beat grid.

The opening has a separate requirement: meaningful action begins within the first second even when the song starts with an instrumental gap. The real song/chapter title and supporting graphics provide an immediate reveal; longer gaps must develop beyond a single slowly panning still. This is authored opening motion, not a claim of measured beat sync. Lyrics remain tied to the vocals. The encoded opening is sampled densely and the visual critic must reject an opening that still reads as a static poster or slow pan in a quick glance.

The evidence records each mode and its rationale in `plan.json` and `direction.pacing`. This is a constrained fallback to help an agent compose the film, not a claim of unlimited creative judgment. Local direction receives the whole-song scene arc, including across planning batches. Encoded scene review samples pacing anchors as well as word onsets; independent full-film review should judge whether contrasts feel intentional, whether recycled-looking compositions remain, and whether the lyric still leads.

Missing/repeated required artwork and invalid pacing fail the creation preflight before spending time encoding. Resolve the named requests and resume. The gauntlet checks the same policy again after rendering and repairs; independent finalization cannot bypass it. Older projects without the policy are not automatically replanned. The accepted Genesis 7 full dark lyric film remains a frozen delivery.

## Outputs and retry

After reviewing a finished output or preview clip, run the Site delivery finisher described in the [workflow skill](../skills/ark-song-video/SKILL.md). A changed encode needs fresh encoded visual and timing review tied to its new hash. Then import the reviewed file into Photos and add it to the private Genesis Site as a review candidate. Verify both destinations and provide the review/download link; avoid duplicate imports and do not confuse local Photos import with confirmed iPhone sync.

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
