# Contributing to Ark Video Studio

Pull requests are welcome: bug fixes, documentation, tests, new scene ideas and tooling.

Every pull request needs an approving review from Shane Fisher (@omiron33), the code owner, before it can be merged. `main` is protected, so please work on a branch or a fork and open a pull request against `main`.

## Run it

The current engine is Node.js in `engine/`. It needs Node.js 22 or newer and `ffmpeg` / `ffprobe` on your PATH.

```sh
npm ci
npm test
./studio                                   # opens the Genesis 7 showcase project locally
./studio projects/genesis7-full/project.json
node engine/cli.mjs inspect --project projects/genesis7/project.json
node engine/cli.mjs render --project projects/genesis7/project.json --section waters-rise --out output/one-section.mp4
```

See [the engine guide](docs/ENGINE.md), [the create workflow](docs/CREATE.md) and [song intake](docs/SONG_INTAKE.md).

The original Python v1 to v3 pipeline (2.5D depth shots) uses Python 3.12 and uv:

```sh
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/python -m pytest tests -q
```

Render output goes to `output/` or a project's `out/` folder, which git ignores.

## Before you open a pull request

- Keep pull requests small and focused, and explain what you changed and how you checked it.
- For visual changes, render a still or a short clip and attach it to the pull request.
- Do not commit secrets, `.env` files, cookies, song recordings, full renders, or model weights. Large media stays out of git.
- Issues: use the bug report or feature request template.

## License

By contributing, you agree that your contributions are licensed under the repository's [MIT License](LICENSE). Fonts and third-party files keep their own notices.
