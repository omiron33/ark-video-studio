# Agents and models

The engine is model agnostic. Every production step is a CLI command that runs with no model at all, so a film can move forward whichever agent has credits, or with none. Agents add judgment on top: direction, choreography code, images and review. When one agent is unavailable, another agent, or a person, picks up the same step from the same files.

`node engine/cli.mjs agents` reports the agent it detects, the image provider it will use and which providers are available.

## Modes

Claude runs in **code-only** mode: every frame is drawn in code, and the bar is the mexicat/pdoom-video film. See [CODE_ONLY.md](CODE_ONLY.md). Codex runs in **mixed** mode, which allows sparse generated imagery. `ARK_MODE` overrides either, and `node engine/cli.mjs agents` reports the mode. The image-provider rows below apply to mixed mode only.

## Who does what

| Step | Runs without a model | Codex | Claude | Fallback when neither is available |
| --- | --- | --- | --- | --- |
| Song intake, alignment, beats | Yes: `import`, `align` (local Whisper and forced alignment) | Yes | Yes | Run the CLI directly |
| Reference search | Yes: `references`, `reference-context` | Yes | Yes | Run the CLI directly |
| Four theme mockups | Yes, with local ComfyUI: `image --provider comfyui` | Built-in GPT Image | `image` command (API key, else local ComfyUI) | Local ComfyUI; if it is off, prompts wait in `concepts/` and the gate stays open |
| Director brief and scene plan | Deterministic planner only | Yes | Preferred (`ark-director-brief`) | Deterministic `create` vocabulary |
| Choreography and HyperFrames/GSAP code | No | Yes | Preferred | Existing vocabulary only |
| Scene artwork | Yes, with local ComfyUI | Built-in GPT Image | `image` command (API key, else local ComfyUI) | Local ComfyUI; if it is off, `assetRequests` stay pending |
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
- `comfyui`: local ComfyUI on the home network, the default whenever no external provider is available. It tries `ARK_COMFY_URL`, then OmiPC at `http://192.168.4.245:8188` (LAN) and `http://100.124.1.2:8188` (Tailscale). Run `node engine/cli.mjs image --provider comfyui --prompt-file request.txt --out project/assets/scene.png`. OmiPC has no classic checkpoints, so with no workflow set it uses the shipped `qwen-image` preset (Qwen-Image 2.1, `engine/comfy/`). `--workflow krea2-turbo` selects Krea 2 Turbo; its NVFP4 weights target newer GPUs and hung ComfyUI on OmiPC during the first test, so it is not the default. For any other model, export an API-format workflow and pass its path to `--workflow` or `ARK_COMFY_WORKFLOW`, using `{{prompt}}`, `{{negative}}`, `{{seed}}`, `{{width}}` and `{{height}}` placeholders. ComfyUI must be started on OmiPC and listening on the network. Provenance records the host, checkpoint or workflow, seed and hash.
- `supplied`: any original image file a person or agent adds, with its provenance recorded.

Order when the agent has no image tool: OpenAI API if `OPENAI_API_KEY` is set, otherwise local ComfyUI. Set `ARK_IMAGE_PROVIDER` to force a provider, or `ARK_AGENT` (`codex`, `claude`, `none`) to override detection. Detection reads `CLAUDECODE` for Claude Code and any `CODEX_*` variable for Codex.

## Skills

Project skills live in `skills/` and are linked, not copied, into both `~/.codex/skills` and `~/.claude/skills`, so an edit reaches both agents.

- `ark-song-video`: the whole song-to-film workflow and its theme-choice gate. Shared.
- `ark-director-brief`: turn an approved theme into a structured scene-by-scene brief. Written for Claude's planning strength; any agent can use it.
- `ark-frame-critic`: score decoded frames against the rubric and record an honest `approve-review`. Written for Claude's vision strength; any agent can use it.

The HeyGen HyperFrames and GSAP skills are installed once under `~/.codex/skills` and linked into `~/.claude/skills`.

## Rules that do not change with the model

The theme-choice gate, lyric provenance, the rubric threshold of 8, review binding to the exact file hash and source revision, and "no paid video services" are the same for every agent. A review records the reviewer's real name, such as `claude` or `codex`, and never claims to have listened.

## Asset storage

Generated scene images and their provenance stay in each project's `assets/` folder so projects remain portable. Finished movies and their delivery packages are stored locally under `/Volumes/Code/technochristianity-assets/movies/<project-id>/` and are never pushed; that repository's published content stays the church model releases.
