---
name: ark-frame-critic
description: Independently review an encoded Ark lyric film from its decoded gauntlet evidence, score the rubric honestly and record it with approve-review. Use after a render and gauntlet run, before claiming an Ark film is finished. Works for any vision-capable agent; written for Claude's frame-critique strength.
---

# Ark frame critic

Review what was actually encoded, never the source code, a screenshot of the editor, or your own intentions.

## Steps

1. Confirm the gauntlet exists for the current MP4: `node engine/cli.mjs gauntlet --project <project.json> --video <film.mp4> --out <review-dir>`. Note the video SHA-256 and revision hash in its report.
2. Open the decoded evidence the gauntlet wrote: word-onset frames, transition frames and contact sheets. Look at every scene's frames, and at the first second as a quick social-feed glance.
3. Score each visual rubric category in `scores.json` (leave out `sync`, which makes it a visual-only review) from 0 to 10: `lyricLegibility`, `semanticMotion`, `photorealism`, `composition`, `continuity`. The pass line is 8 in every category.
4. Do not score `sync` from hearing. Sync is owned by the measured machine audio gate; read its report and quote its result.
5. Write concrete notes per failing scene: section ID, time, what is wrong, and the specific change that would fix it.
6. Record the review:

```sh
node engine/cli.mjs approve-review --report <review-dir>/review.json \
  --reviewer claude --scores scores.json --notes 'Concrete notes...'
```

Use your real agent name as `--reviewer` (`claude`, `codex`, or the person's name).

## Honesty rules

- A score below 8 is a failure to repair, not a number to round up. Fix the named scenes, render those sections, rerun the gauntlet and review again.
- A review binds to one video hash and source revision. Any change makes it stale; `review-check` will reject it.
- Keep the local vision model's scores and your scores separate. Never overwrite a prior failing review.
- Your judgment is agent assessment, not Shane's approval. Say which one you are reporting.
