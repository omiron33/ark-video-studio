@AGENTS.md

# Claude in Ark Lyric Studio

Everything in AGENTS.md applies. This file only adds what differs when Claude drives the engine. See [docs/AGENTS_AND_MODELS.md](docs/AGENTS_AND_MODELS.md) for the shared division of work.

- Claude has no built-in image generator. Run `node engine/cli.mjs agents` first. Use `node engine/cli.mjs image` when `OPENAI_API_KEY` is set; otherwise save the exact prompts in the project and leave `assetRequests` pending for Codex or a person. Never draw a substitute in code and call it the requested photograph.
- Lean on planning and code: write the scene brief with the `ark-director-brief` skill, then author choreography with the HyperFrames and GSAP skills. Review encoded output with the `ark-frame-critic` skill.
- Browser or Photos delivery needs computer use. If it isn't available in this session, finish everything up to the finished MP4 and its review, and say delivery is paused.

## Render contract

Every composition Claude writes must meet these before any review:

1. Deterministic and seekable. Frame `t` depends only on `t`, the project JSON and its assets. No `Date.now()`, unseeded randomness or wall-clock timers; HyperFrames timelines stay paused and are driven by seek.
2. Words are time-bound to their measured cues. Motion keyframes derive from word IDs and measured beats, never from a guessed grid.
3. Motion is physical. Prefer spring or measured-inertia easing over stock ease curves, and let held notes breathe.
4. The audio plan comes first. Mark accents, phrases and held notes from the analysis before choreographing.
5. One brief per scene, in the structure `ark-director-brief` defines, recorded in `direction`.
6. Nothing ships under 8/10 in any rubric category, scored on decoded frames of the encoded MP4, bound to its hash.
