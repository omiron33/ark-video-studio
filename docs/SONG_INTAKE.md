# Bring a song into Ark Video Studio

The project manifest is the editable source. An agent changes lyric timing, word roles, scene direction, and section membership in JSON, then previews or renders the affected section. Audio, original timing, and approved lyric sidecars are copied into a **new** project directory. Import never rewrites the supplied files or an existing project.

## Import supplied word timing

From the repository root:

```sh
node engine/cli.mjs import \
  --audio /path/to/song.mp3 \
  --timing /path/to/words.json \
  --beats /path/to/beats.json \
  --out projects/my-song \
  --title 'My song'

node engine/cli.mjs validate --project projects/my-song/project.json
node engine/cli.mjs serve --project projects/my-song/project.json
```

`--beats` is optional. If absent, import creates no invented beat grid. `--lyrics /path/to/official-lyrics.txt` optionally archives the exact official text alongside timing; it does not guess a forced alignment or silently replace the supplied timed words.

Defaults are 2560 × 1440, 30 fps, and the generic `verse` style. `--width`, `--height`, `--fps`, and `--style verse|impact|orbit` change them. The semantic `rise`, `terrain`, and `submerge` styles need an agent to assign the appropriate word roles after import.

Import probes the actual audio stream with `ffprobe`. The selected duration is bounded by the source and rounded **down** to an output frame, with any adjustment reported. The original audio stays intact; `audio.offset` selects the source interval during playback/export. Sections are contiguous and their ends land on frame boundaries.

To work on a ten-second passage:

```sh
node engine/cli.mjs import \
  --audio /path/to/song.mp3 \
  --timing /path/to/full-song-words.json \
  --beats /path/to/full-song-beats.json \
  --offset 120.5 --duration 10 \
  --out projects/my-song-passage
```

The default timing coordinate system is the **source audio**. Import subtracts the selected source offset from words and beats, discards events outside the passage, and clamps words crossing its edges. Original intervals, confidence, interpolation flags, source section/line names, and clipping decisions remain in `word.provenance`.

If timing already starts at zero for the selected passage, set `"timebase": "clip"` in the JSON or pass `--timing-timebase clip`. Beats have their own `--beat-timebase clip` option. An explicit command option takes precedence over the JSON; otherwise the JSON takes precedence over the `source` default. Do not subtract a source offset twice.

## Word JSON

```json
{
  "version": 1,
  "timebase": "source",
  "title": "My song",
  "method": "reviewed word timing",
  "words": [
    {"id": "opening-in", "text": "In", "start": 0.8, "end": 1.1, "confidence": "reviewed"},
    {"id": "opening-the", "text": "the", "start": 1.1, "end": 1.3, "confidence": "reviewed"},
    {"id": "opening-beginning", "text": "beginning,", "start": 1.3, "end": 2.1, "confidence": "reviewed"}
  ],
  "phrases": [
    {"id": "opening", "text": "In the beginning,", "wordIds": ["opening-in", "opening-the", "opening-beginning"]}
  ]
}
```

The literal `text` is preserved, including case, punctuation, and apostrophes. `start` and `end` must be finite numbers, with `0 <= start < end`, in source order. IDs may contain letters, digits, `_`, `.`, and `-`, beginning with a letter or digit. Keep IDs when revising timing or spelling: they connect the word to scene roles and edits.

IDs are optional on first import. Generated word IDs derive from exact text and original source intervals, so cropping the same timing does not renumber the words. Distinct simultaneous repeated words need explicit distinct IDs. Bad or missing times cause an error; the importer does not interpolate replacements.

Optional phrases preserve deliberate grouping. `phraseId` on individual words also works. Without groups, the importer makes short phrases at sentence punctuation, gaps of at least 0.65 seconds, or eight words. Legacy `sections[].lines[].words` records (`word` or `text`, `start`, `end`, `aligned`) and Whisper `segments[].words` records are accepted directly. Explicit phrase/source section metadata remains available in `project.phrases` and provenance.

Beat JSON accepts either numbers or objects:

```json
{
  "timebase": "source",
  "beats": [0.5, 1.0, {"time": 1.5, "strength": 0.8, "kind": "onset"}]
}
```

Beat strength is non-negative. Input events remain in provenance. Word timing and beat timing are separate: a beat is not evidence that a word started there.

## When only audio is available

Importing without `--timing` creates a valid draft with `intake.status: "unresolved"`, no words, and one scene covering the song. The status and warning remain explicit; the draft is not a synchronized lyric video yet.

The optional helper produces **local machine estimates** using either OpenAI Whisper or faster-whisper. OpenAI Whisper here is the installed, local Python model runner, not an API. The helper never calls a paid or remote inference API and never downloads a model. It requires:

- Python 3.10+ with `openai-whisper` or `faster-whisper` in the chosen environment.
- `ffmpeg` and `ffprobe` on PATH.
- An existing OpenAI Whisper `.pt` checkpoint, or a compatible CTranslate2/faster-whisper model directory containing `model.bin`, `config.json`, and its tokenizer files.

`--backend auto` is the default. An explicit `.pt` file selects `openai-whisper`; a CTranslate2 directory selects `faster-whisper`. `--backend openai-whisper` or `--backend faster-whisper` can require a particular backend. No remote model names are accepted.

**Verified command on this Mac**, using the already installed Homebrew interpreter and existing model:

```sh
node engine/cli.mjs align \
  --python /opt/homebrew/Cellar/openai-whisper/20250625_3/libexec/bin/python \
  --backend openai-whisper \
  --audio projects/genesis7/assets/showcase.wav \
  --model /Volumes/DATA/AI/Models/Whisper/small.en.pt \
  --out output/align-smoke/showcase-words.json \
  --language en --threads 4
```

This actual ten-second run completed with 12 timed words. The checkpoint was already on disk; nothing was downloaded. That output now exists, so use a new output filename when repeating the command. The path is the installed interpreter verified during this build; a Homebrew upgrade may change its versioned directory.

The initial smoke deliberately preserves an ASR error: small.en recognized “blue” where the supplied lyric says “below.” Machine output remains a proposal. The automatic audio reviewer subsequently used base.en, a stronger local medium.en retry, and acoustic forced alignment to repair this word and require a rerender. The showcase now uses all twelve acoustically supported intervals. See [automatic audio review](AUDIO_REVIEW.md) for the verified evidence and strict acceptance policy.

Use an existing environment if available. To prepare a dedicated one explicitly:

```sh
python3 -m venv .venv-align
.venv-align/bin/python -m pip install faster-whisper
```

This installs software dependencies, **not** a model. For a separate OpenAI Whisper environment, install `openai-whisper` instead. Keep model files under `/Volumes/DATA/AI`. The two checkpoint formats are not interchangeable; the helper dispatches to the matching backend. It accepts `--model /absolute/local/path`, or `ARK_WHISPER_MODEL`. With neither, it checks existing local `small.en.pt`/`base.en.pt` files and models under `/Volumes/DATA/AI/Models/faster-whisper`, `/Volumes/DATA/AI/Models/Whisper`, and the corresponding faster-whisper snapshots in `/Volumes/DATA/AI/Cache/HuggingFace/hub`. Auto prefers a backend available in the selected Python environment.

```sh
node engine/cli.mjs align \
  --python .venv-align/bin/python \
  --backend faster-whisper \
  --audio /path/to/song.mp3 \
  --model /Volumes/DATA/AI/Models/faster-whisper/small.en \
  --lyrics /path/to/official-lyrics.txt \
  --out /path/to/word-estimates.json
```

Direct invocation is also supported:

```sh
.venv-align/bin/python engine/align.py \
  --backend faster-whisper \
  --audio /path/to/song.mp3 \
  --model /Volumes/DATA/AI/Models/faster-whisper/small.en \
  --output /path/to/word-estimates.json \
  --offset 120.5 --duration 10 --language en --threads 4
```

Alignment output uses absolute source times even for a passage. Missing dependencies, missing local model, or a failed alignment produce a JSON document with `status: "unresolved"`, an actionable reason, and `words: []`, and return exit code 2. Existing output files are never overwritten. The helper sets offline mode and loads only an existing filesystem model. For OpenAI Whisper it passes the absolute checkpoint path to the loader's local-file branch and preserves the standard checkpoint's bundled alignment-head configuration when available.

If official lyrics are supplied to transcription, their exact text is preserved as `approvedLyrics`. A mismatch between that text and recognition sets `status: "needs_lyric_review"`; no unheard words receive fabricated timing. `--backend torchaudio-ctc --task force-align` instead aligns the supplied literal lyrics acoustically. The `create` workflow selects this path for official lyrics and runs the automatic audio reviewer after encoding. A recognition token's probability does not measure timestamp accuracy: CTC blank-state alignment and corroborating recognition catch estimates that absorbed an instrumental pause into the next word. See [automatic audio review](AUDIO_REVIEW.md) for the direct verified command.

## Agent edit contract

After import, edit `project.json` as the source of truth. Preserve `words[].id`; keep each word's source timing/provenance when correcting its visible onset. Change `sections[].wordIds`, `style`, `direction`, and `assetIds` to compose or replace a scene. Every section must continue to cover its existing time span unless deliberately retimed.

Useful agent requests include “make this phrase rise,” “replace only the bridge with line art,” or “keep the audio and word times, but rebuild this section.” A semantic style needs explicit word-role assignments; generic verse/impact works without those assignments. Image generation remains a separate, agent-directed step using GPT image generation, followed by adding the generated asset to the manifest.

```sh
node engine/cli.mjs inspect --project projects/my-song/project.json --json
node engine/cli.mjs render --project projects/my-song/project.json --section SECTION_ID --out section-preview.mp4
node engine/cli.mjs render --project projects/my-song/project.json --out film.mp4
```

Import status intentionally starts at `timed_needs_review`, even for supplied timing. Validation confirms the data contract; the gauntlet and audio/visual review establish whether the final song passage works.

## Verification

```sh
node --test tests/import.test.mjs
```

The tests cover exact lyric preservation, interpolation provenance, durable IDs across cropping, source versus clip timing, clamping, invalid inputs, beat events, gap-free frame coverage, real audio probing and immutable copying, unresolved drafts, and offline alignment failure without overwriting output. The separate `output/align-smoke` artifacts verify actual successful local OpenAI Whisper inference on the ten-second clip. The alternative faster-whisper execution path still requires its own compatible dependency/model and was not run on this Mac.
