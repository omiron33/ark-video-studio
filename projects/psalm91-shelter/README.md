# Psalm 91 — Shelter

Full 327.6-second lyric film for Shane's selected Suno take. Approved direction combines Word Journey and Photo Reveal in charcoal, copper and ivory, with sparse keyholes and local generated video.

## Sources

- Song: https://suno.com/song/5d78a5c1-4341-4867-b25e-c3698b1ffe54
- Exact source SHA256: `b444350b68359bc06f17a90ace1b6d7bba9255a0358b308acec9cdccf3103420`
- Original supplied lyrics: `sources/canonical-lyrics.txt`.
- Performed lyrics: `sources/performance-lyrics.txt`, retaining the independently recognized seven-word repeat.
- Canonical cue IDs and raw model provenance: `sources/words.json`. A machine timing proposal is not an approval.
- Photographs: built-in GPT Image; prompts and hashes in `asset-provenance.json`.

## Edit and build

`opening.js` authors the introduction. `narrative.js` contains scene layouts and choreography keyed by stable phrase IDs. `asset-map.json` maps independent visual assets to the timeline. `build.mjs` compiles those sources into `index.html`; do not hand-edit compiled HTML.

```sh
node build.mjs
env -u GEMINI_API_KEY hyperframes check . --samples 80 --json
env -u GEMINI_API_KEY hyperframes render . --fps 30 --quality delivery --workers 1 --strict --no-best-effort -o /absolute/output.mp4
```

HyperFrames is pinned to 0.8.79. One worker streams the encode and avoids temporary frame storage on the small Code volume. Two workers may be used with an output directory on a volume with at least 12 GB free. Explicitly load all font faces before measuring or constructing text; `document.fonts.ready` alone does not load faces used only by later dynamic elements.

## Review and delivery

The review manifest binds the compiled HTML, authored sources, audio, assets and fonts. Capture source hashes before and after the final render, then check decoded audio lag, literal word visibility, temporal activity and independent visual sequences. Keep failed strict singing-alignment evidence visible; PCM agreement alone does not establish lyric synchronization or creative quality.

From the repository root, after building and freezing production inputs:

```sh
node projects/psalm91-shelter/review.mjs --prepare
node projects/psalm91-shelter/review.mjs --video /absolute/output.mp4 --capture-render-start
# Render the frozen composition, then:
node projects/psalm91-shelter/review.mjs --video /absolute/output.mp4 --capture-render-end
node projects/psalm91-shelter/review.mjs --video /absolute/output.mp4 --out /absolute/review-directory
```

The local H3 supporting clips include physical guardian footage and four material transformations: a lion, a gathering wing, disintegrating arrows, and a stone refuge forming against the storm. The Adam-from-dust shot is removed from this film and reserved with its source inputs and generation settings in `../../briefs/genesis1-creation/reserved-assets/adam-formation/`. All depicted divine presence remains embodied and photographic. Use decoded final-frame posters behind timed video elements so a completed insert never jumps back to its initial pose.

Production and review evidence is under `output/psalm91-production/`. Finished film and review previews belong in the Photos album **Psalm 91 - Shelter** and the OmiPC app as separate review candidates. A Photos import does not establish iPhone synchronization.
