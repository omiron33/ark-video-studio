# Reviewed Psalm 23 delivery

Use `publish-reviewed-node.py` while PowerShell launched over SSH hangs on OmiPC. It uses the installed Node 24.19.0 runtime and SCP, with no PowerShell invocation. The original `publish-reviewed.py` is preserved. Its earlier service-restoration evidence remains in `readiness.json`; that historical snapshot is not a fresh readiness check.

The fallback defaults to **read-only**. It accepts an actual reviewed movie, a poster, and a hash-bound review disposition. It does not render, approve a film for Shane, supersede older candidates, or change canonical lyrics. Run the commands below from `/Volumes/Code/ark-video-studio/projects/psalm23-present-day`.

Readiness check:

```sh
python3 delivery-tools/publish-reviewed-node.py --check-readiness
```

This reads app health, the exact workflow and selected Suno take, canonical lyrics, archived audio SHA-256 and existing candidates. For the archived source alone, `python3 delivery-tools/remote_node_readonly.py --archive-audio` performs a read-only Node-over-SSH hash check.

The latest fallback validation on 2026-09-28 UTC passed Python and embedded Node syntax checks, live `--check-readiness`, and a full read-only dry run using the existing v2 review disposition. The app reported `ok: true`, 25 candidates, and v2 `vid-20260927-31bdda7a` still `pending_review`. The preserved audio was 3,643,492 bytes with SHA-256 `3669040e797c9d2bf8b4136dc4c029c6e1ed51f302ccc411d1888ae50da80c8f`. This verifies readiness at that check; rerun it before delivery. The fallback's mutation path has not been executed during its preparation.

After the final encoded review, copy `delivery-review.example.json` to a new disposition file and fill it from the actual evidence:

- `status`: `accepted_for_user_review` only after root's concrete review disposition.
- Exact `videoSha256`, `posterSha256`, and preserved `sourceAudioSha256`.
- Technical `status: passed`, independent visual `status: accepted`, and audio `status: passed` or `documented_exception`.
- Each evidence JSON's actual path and SHA-256. Each must contain the exact video SHA.
- An audio exception requires a nonempty `exception` describing the unresolved gate. It remains an exception in candidate notes, never an automatic pass.
- `auditNote` states actual findings, changes, remaining limitations and pending Shane review.

Replace the example paths with the exact reviewed v5 artifacts. `--version` is required for both dry run and execution; readiness needs no version. A dry run validates the evidence and prints its plan without uploads, ingestion or workflow changes:

```sh
python3 delivery-tools/publish-reviewed-node.py \
  --video /absolute/final-reviewed-v5.mp4 \
  --poster /absolute/poster-v5.jpg \
  --report /absolute/delivery-review-v5.json \
  --version 'Held in the Ordinary - full film v5'
```

Only after the exact reviewed candidate has been authorized for delivery, run the same command with `--execute`:

```sh
python3 delivery-tools/publish-reviewed-node.py \
  --video /absolute/final-reviewed-v5.mp4 \
  --poster /absolute/poster-v5.jpg \
  --report /absolute/delivery-review-v5.json \
  --version 'Held in the Ordinary - full film v5' \
  --execute
```

The existing app contract is verified from `api/video-review.mjs`, `docs/video-ingest.md`, and `api/suno-workflows.mjs` on OmiPC. Delivery:

1. Revalidates exact song identity, canonical lyrics, source archive SHA and app health.
2. Binds uploads to the originally reviewed hashes and copies content-addressed movie/poster/report files into `C:\Users\sjfis\Videos\Psalm23\`, outside the watched inbox. It reuses matching bytes and refuses different bytes at an existing destination. An exclusive same-volume hard link promotes each verified staged upload without overwriting a destination that appeared concurrently.
3. For a new candidate, Node calls documented loopback `POST /api/admin/videos/ingest` with `pending_review` and expected MD5. An existing identical pending-review candidate is reused without another ingest POST. A candidate whose review status has changed is preserved and causes the publisher to stop. The publisher never sends a supersedes field.
4. Hash-verifies the remote copy and full app master download, thumbnail bytes and HTTP 206 playback range.
5. Imports the existing `saveWorkflow` function and synchronously reads the latest workflow before appending one SHA-tagged candidate note. It requires exactly one marker associated with this candidate and media URL. All current fields, takes, failures and other workflows are checked afterward. Note budgets are checked before delivery and again before the workflow write; existing notes are never truncated.
6. Verifies that every preexisting video candidate remains unchanged and that the delivered candidate still has the expected hash, project and `pending_review` status, then writes a receipt under `delivery-tools/runs/<video-sha>/app-delivery.json`.

Partial-delivery retries reuse matching copies and candidates and append the workflow marker only once. A mismatch stops with existing bytes and review states preserved. The original publisher already delivered v2; that receipt remains under its video hash. Readiness and dry-run success do not demonstrate that a new candidate was published.

**Concurrency limitation:** the existing workflow storage has no cross-process lock or compare-and-swap operation. Reading immediately before the append and checking afterward detects changes but cannot guarantee serialization against simultaneous app/user writes. Avoid editing workflow notes during delivery. The fallback also refuses Python `-O`, because its shared evidence validator uses assertions.

Photos remains root's native UI task. Prior Psalm 91 V4 evidence shows an exact filename import followed by sampled playback and an album-item check; it does not certify iCloud/iPhone sync. Preserve matching existing imports and verify actual playback, especially given earlier unsupported-format badges.
