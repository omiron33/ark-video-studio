# Reviewed Psalm 23 delivery

The OmiPC app was restored through its existing `ScriptureInSongLocal` scheduled task. Its loopback server had stopped; the LAN proxy and Tailscale route were already intact. No app source/configuration, workflow, or candidate was changed by readiness work. See `readiness.json` for current checks.

`publish-reviewed.py` defaults to **read-only**. It accepts an actual reviewed movie, a poster, and a hash-bound review disposition. It does not render, approve a film for Shane, supersede older candidates, or change canonical lyrics.

Readiness check:

```sh
python3 delivery-tools/publish-reviewed.py --check-readiness
```

After the final encoded review, copy `delivery-review.example.json` to a new disposition file and fill it from the actual evidence:

- `status`: `accepted_for_user_review` only after root's concrete review disposition.
- Exact `videoSha256`, `posterSha256`, and preserved `sourceAudioSha256`.
- Technical `status: passed`, independent visual `status: accepted`, and audio `status: passed` or `documented_exception`.
- Each evidence JSON's actual path and SHA-256. Each must contain the exact video SHA.
- An audio exception requires a nonempty `exception` describing the unresolved gate. It remains an exception in candidate notes, never an automatic pass.
- `auditNote` states actual findings, changes, remaining limitations and pending Shane review.

Dry run, then delivery:

```sh
python3 delivery-tools/publish-reviewed.py \
  --video /absolute/final-film.mp4 \
  --poster /absolute/poster.jpg \
  --report /absolute/delivery-review.json

python3 delivery-tools/publish-reviewed.py \
  --video /absolute/final-film.mp4 \
  --poster /absolute/poster.jpg \
  --report /absolute/delivery-review.json \
  --execute
```

The existing app contract is verified from `api/video-review.mjs`, `docs/video-ingest.md`, and `api/suno-workflows.mjs` on OmiPC. Delivery:

1. Revalidates exact song identity, canonical lyrics, source archive SHA and app health.
2. Copies content-addressed movie/poster/report files into `C:\Users\sjfis\Videos\Psalm23\`, outside the watched inbox. It reuses matching bytes and refuses different bytes at an existing destination.
3. Calls documented loopback `POST /api/admin/videos/ingest` with `pending_review` and expected MD5. The app's own duplicate detection prevents a second record for identical bytes. It never sends a supersedes field.
4. Hash-verifies the remote copy and full app master download, thumbnail bytes and HTTP 206 playback range.
5. Imports the existing `saveWorkflow` function and synchronously reads the latest workflow before appending one SHA-tagged candidate note. All current fields, takes, failures and other workflows are checked afterward. Notes beyond the app's 4000-character limit fail without truncation.
6. Verifies that every preexisting video candidate remains unchanged, and writes a receipt under `delivery-tools/runs/<video-sha>/app-delivery.json`.

A retry after a partial delivery is safe: copied bytes are reused, ingest deduplicates, and the workflow marker is appended once. This preparation has **not** executed a final publication; the write path awaits the reviewed files. Python and embedded Node syntax were checked, and the read-only readiness mode ran successfully against OmiPC.

Photos remains root's native UI task. Prior Psalm 91 V4 evidence shows an exact filename import followed by sampled playback and an album-item check; it does not certify iCloud/iPhone sync. Preserve matching existing imports and verify actual playback, especially given earlier unsupported-format badges.
