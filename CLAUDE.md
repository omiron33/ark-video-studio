@AGENTS.md

# Claude in Ark Lyric Studio

Everything in AGENTS.md applies. This file only adds what differs when Claude drives the engine. See [docs/AGENTS_AND_MODELS.md](docs/AGENTS_AND_MODELS.md) for the shared division of work.

- **Claude runs in code-only mode.** Every frame is drawn in code, and the minimum accepted quality is on par with mexicat/pdoom-video. Read [docs/CODE_ONLY.md](docs/CODE_ONLY.md) before planning. `create` sets this up automatically; don't add image or video assets. Only an explicit `ARK_MODE=mixed` from Shane turns it off.
- In mixed mode only: Claude has no built-in image generator. Run `node engine/cli.mjs agents` first. Use `node engine/cli.mjs image`: it uses the OpenAI API when `OPENAI_API_KEY` is set, otherwise local ComfyUI on OmiPC. If neither is reachable, save the exact prompts in the project and leave `assetRequests` pending. Never draw a substitute in code and call it the requested photograph.
- Lean on planning and code: write the scene brief with the `ark-director-brief` skill, then author choreography with the HyperFrames and GSAP skills. Review encoded output with the `ark-frame-critic` skill.
- Browser or Photos delivery needs computer use. If it isn't available in this session, finish everything up to the finished MP4 and its review, and say delivery is paused.

## Render contract

Every composition Claude writes must meet these before any review:

1. Deterministic and seekable. Frame `t` depends only on `t`, the project JSON and its assets. No `Date.now()`, unseeded randomness or wall-clock timers; HyperFrames timelines stay paused and are driven by seek.
2. Words are time-bound to their measured cues. Motion keyframes derive from word IDs and measured beats, never from a guessed grid.
3. Motion is physical. Prefer spring or measured-inertia easing over stock ease curves, and let held notes breathe.
4. The audio plan comes first. Mark accents, phrases and held notes from the analysis before choreographing.
5. One brief per scene, in the structure `ark-director-brief` defines, recorded in `direction`.
6. Nothing ships under 8/10 in any rubric category, scored on decoded frames of the encoded MP4, bound to its hash. In code-only mode an 8 means it holds up next to the pdoom video.
7. Render at 60 fps with adaptive sub-frame motion blur (`render.motionBlur.samples: "auto"`, shutter 0.2).
