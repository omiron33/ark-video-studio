# Full-song review and resume

`engine/fullsong-review.mjs` coordinates bounded review batches without changing the song, scenes, timing, rubric or audio reviewer. It reads actual frames from the final full MP4 at their original project times. It never substitutes freshly rendered stills or resets a cropped clip to zero.

```sh
node engine/fullsong-review.mjs \
  --project projects/genesis7-full/project.json \
  --video output/genesis7-full.mp4 \
  --audio-review output/genesis7-full-audio/audio-review.json \
  --out output/genesis7-full-review \
  --style-prompt 'The approved lyric-first cinematic Genesis treatment.' \
  --batch-size 4 --max-batches 2
```

Use actual project/output paths. Repeating the same command resumes pending batches. Omit `--max-batches` to continue through the remaining film. A batch has at most 12 sections; the default is four. `--max-batches` limits newly executed batches per invocation, not already validated cached batches. One local model stream runs sequentially to avoid GPU queue amplification. Exit 0 means the complete film passed; exit 2 means review executed but remains pending or failed; exit 1 means an execution/input error.

The coordinator requires every lyric ID to belong to a reviewed section. Every section must receive a real local model judgment with all five existing categories at least 8/10. Native OCR must observe every expected lyric. An instrumental-only batch has an explicit empty lyric scope, while its scene composition and continuity still receive model review. The final song must contain and cover its canonical lyrics. Partial reports use a distinct schema kind that the whole-film gauntlet refuses as approval.

`--audio-review` accepts the existing measured **full-film** audio report. The coordinator does not repeat or weaken acoustic analysis. `--gauntlet` can point to an existing full-film gauntlet report; valid current technical checks are reused. Otherwise the normal full-film technical gate decodes/probes the complete file and captures its usual evidence once. `--metadata` selects render metadata if it is not beside the MP4. A complete visual report still cannot finish without current technical, render/source-binding and audio gates.

## Durable evidence and safe reuse

The output directory contains:

- `fullsong-review.json`: compact progress, failed/pending batches, coverage, score minima and final gate.
- `visual-review.json`: full-film visual gate, written only after every batch has completed.
- `batches/<id>/<context-hash>/`: immutable review versions, native OCR, decoded frames/contact sheets and a digest-checked checkpoint.
- `gauntlet/review.json`: normal final technical/audio/visual acceptance report, unless an existing gauntlet path was supplied.

Resume first verifies report/evidence hashes. Unchanged artifact/source bindings can reuse a complete batch before extracting any frames or running OCR/model inference. After an isolated edit, a batch can be rebound only when its expected words, scene direction, absolute time range, review policy, model digest and style brief match, and **every decoded picture in its sampled interval** has the same fingerprint. Neighboring handoff pixels are included. This performs one bounded video decode per affected binding, not thousands of individual image seeks. Original review bindings remain in the provenance chain. Modified or missing evidence is regenerated; changed scene pixels or review context trigger a new review.

Valid low-score results remain failures when resumed. `--retry-failed` reruns failed orchestration; the underlying director retains its valid scene judgments, so it cannot reroll a low score into a convenient pass. Make the concrete scene edit first. The coordinator runs read-only (`repair: false`) so a long review cannot silently change the canonical project under other batches. After a repair, render changed sections and rerun the same command. Completion is refused if any source or video bytes change during review.

The lock prevents simultaneous review writers. A terminated process's lock is reclaimed only when it belongs to this host and its PID is demonstrably gone. Unknown or live-owner locks remain blocking. Stop between batches by setting `--max-batches`; completed evidence is durable even if a later model call fails.

## Known costs and verification

The earlier unbatched path recaptured OCR and scene frames before checking inference cache. On 537 words this could mean roughly two thousand OCR seeks plus thousands of director/technical samples on each restart. Batching removes repeated extraction and inference for completed review units. Initial full-song local vision still needs a real judgment for every section and may take tens of minutes. Review latency is separate from fast section rendering.

Tests in `tests/fullsong-review.test.mjs` cover complete coverage, pending/resume behavior, isolated-edit rebinding, changed evidence, low-score failure, stale inputs, protected story direction, and frame-exact hashing of actual encoded video. Mocked reviewer services are explicitly test-only and do not establish visual quality. The existing native OCR tests exercise actual Apple Vision. Production acceptance requires the real saved reports for the delivered full MP4.
