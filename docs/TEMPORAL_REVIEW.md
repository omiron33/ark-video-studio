# Encoded temporal activity gate

Set `quality.maxStaticSeconds` to a finite positive number in a project to require this check. For example:

```json
{"quality":{"maxStaticSeconds":2.8}}
```

The gauntlet calls `reviewTemporalActivity({videoPath, project, outDir})` on the complete encoded MP4. FFmpeg decodes every video frame through `scale=480:-2,freezedetect=n=-55dB`, with the minimum detection duration equal to the project's budget. Any measured interval longer than the budget fails the technical gate. Titles, instrumental gaps and endings receive no automatic exemption. Equality is allowed within one microsecond of numeric precision.

The report records decoded frame count, EOF completion, measured intervals, affected scene IDs, tool version, raw detector/progress logs, and SHA256 bindings for the video, project object, detector source and policy. A freeze still open at EOF is closed at the probed video-stream duration. Scene mapping rounds timestamps to the project's frame grid to avoid millisecond container timestamp spill into neighboring sections; the measured durations and pass/fail decision remain unchanged.

The gauntlet saves the report under its review directory's `temporal/` folder. Every later `checkReview` or approval validates the report hash, source/policy/video bindings, raw evidence hashes, decoded frame evidence and intervals reparsed from the detector log. A missing, changed, failed or stale measurement cannot satisfy an enabled policy. A visual score cannot override it. Regenerate the review after a change.

Projects without `quality.maxStaticSeconds` keep the existing gauntlet behavior. Direct use of the helper without an enabled policy returns `status: "not_requested"` and `passed: null`, rather than claiming a measurement passed. Invalid budgets fail closed. The helper expects the complete project video and rejects a duration/timebase mismatch; it is not a section-only export reviewer.

This check measures near-static pixels. It does **not** prove meaningful choreography, lyric synchronization or artistic quality. Animated noise and camera motion can avoid freeze detection without providing useful word animation. The independent visual and audio gates remain necessary.

Validation includes actual encoded flat and moving three-second clips, a two-second moving clip followed by a three-second freeze through EOF, malformed interval evidence, scene mapping at cuts, changed bindings/logs, missing measurements and the gauntlet approval path. The original full-film pass decoded all 11,015 frames in roughly four seconds and exposed six over-budget intervals under a 2.8-second policy; that is diagnostic evidence, not a current-film acceptance claim.
