# Agents and models

The engine is model agnostic. Every production step is a CLI command that runs with no model at all, so a film can move forward whichever agent has credits, or with none. Agents add judgment on top: direction, choreography code, images and review. When one agent is unavailable, another agent, or a person, picks up the same step from the same files.

`node engine/cli.mjs agents` reports the agent it detects, the image provider it will use and which providers are available.

## Who does what

| Step | Runs without a model | Codex | Claude | Fallback when neither is available |
| --- | --- | --- | --- | --- |
| Song intake, alignment, beats | Yes: `import`, `align` (local Whisper and forced alignment) | Yes | Yes | Run the CLI directly |
| Reference search | Yes: `references`, `reference-context` | Yes | Yes | Run the CLI directly |
| Four theme mockups | No, needs an image model | Built-in GPT Image | `image` command with an API key, or hand the prompts to Codex | Prompts wait in `concepts/`; the gate stays open |
| Director brief and scene plan | Deterministic planner only | Yes | Preferred (`ark-director-brief`) | Deterministic `create` vocabulary |
| Choreography and HyperFrames/GSAP code | No | Yes | Preferred | Existing vocabulary only |
| Scene artwork | No | Built-in GPT Image | `image` command, or pending request | `assetRequests` stay pending and the gate stays unfinished |
| Render, section cache, export | Yes: `render`, `patch`, `replace` | Yes | Yes | Run the CLI directly |
| Audio and sync review | Yes, local measurement only | Yes | Yes | Run the CLI directly |
| Visual review | Machine gate uses the local vision model | Independent review | Preferred (`ark-frame-critic`) | A person records `approve-review` |
| Finishing | Yes: `finish-ark-video.mjs` | Yes | Yes | Run the script directly |
| Photos import, Suno, Site upload in a browser | No, needs computer use | Preferred | Possible with computer use | Pause; delivery waits and the film stays a local candidate |

"Preferred" is a strength, not an exclusive right. Either agent may do any step, and the output format is the same whoever produced it.

## Image providers

Scene artwork requests (`assetRequests`) name a provider chosen by `resolveImageProvider` in `engine/providers.mjs`:

- `gpt-image`: the agent's built-in GPT Image tool. The default for Codex and when no agent is detected.
- `openai-images`: GPT Image through the OpenAI Images API. Used when the agent has no image tool and `OPENAI_API_KEY` is set. Run `node engine/cli.mjs image --prompt-file request.txt --out project/assets/scene.png`; it writes `scene.png.provenance.json` beside the image. Set `ARK_IMAGE_MODEL` to change the model.
- `supplied`: any original image file a person or agent adds, with its provenance recorded.

Set `ARK_IMAGE_PROVIDER` to force a provider, or `ARK_AGENT` (`codex`, `claude`, `none`) to override detection. Detection reads `CLAUDECODE` for Claude Code and any `CODEX_*` variable for Codex.

## Skills

Project skills live in `skills/` and are linked, not copied, into both `~/.codex/skills` and `~/.claude/skills`, so an edit reaches both agents.

- `ark-song-video`: the whole song-to-film workflow and its theme-choice gate. Shared.
- `ark-director-brief`: turn an approved theme into a structured scene-by-scene brief. Written for Claude's planning strength; any agent can use it.
- `ark-frame-critic`: score decoded frames against the rubric and record an honest `approve-review`. Written for Claude's vision strength; any agent can use it.

The HeyGen HyperFrames and GSAP skills are installed once under `~/.codex/skills` and linked into `~/.claude/skills`.

## Rules that do not change with the model

The theme-choice gate, lyric provenance, the rubric threshold of 8, review binding to the exact file hash and source revision, and "no paid video services" are the same for every agent. A review records the reviewer's real name, such as `claude` or `codex`, and never claims to have listened.

## Asset storage

Generated scene images and their provenance stay in each project's `assets/` folder so projects remain portable. Published film packages go to the `technochristianity-assets` repository under `/Volumes/Code/technochristianity-assets`. Finished movies are usually over GitHub's 100 MB file limit, so they need Git LFS or release attachments there; a plain commit will be rejected.
