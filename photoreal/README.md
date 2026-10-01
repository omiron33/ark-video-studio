# Photoreal mode

Code-only films drawn on the Mac's GPU instead of the CPU canvas. Each scene is a raymarched GLSL
shader (terrain, water, cloud, timber, feathers, clay) lit by one sun with soft shadows, ambient
occlusion and in-scattering, so the engine can reach lit, photographic depth without any generated
imagery. Every frame is still a pure function of song time.

## How a frame is made

1. The scene's `camera(t)` and `update(t, uniforms)` set the camera and scene state.
2. The engine renders `samples` sub-frames spread over a 0.5-frame shutter, each with an R2
   sub-pixel jitter (and, if the scene uses it, a thin-lens aperture sample), and averages them in a
   float target: motion blur, anti-aliasing and depth of field in one pass.
3. One film finish is shared by every scene: bloom pyramid, ACES tonemap, grade, per-frame grain,
   vignette, slight chromatic aberration and dither.
4. The lyric is drawn per frame into a Canvas2D texture (EB Garamond for the lyric voice, Inter
   Tight for annotations) and placed in the world by the scene, either on a surface or on a plane
   anchored to the camera, so it takes the scene's fog, occlusion and light.

## A song folder

Songs live in their own repositories, outside the engine:

```
song/
  scenes/<name>.js   one module per scene (default export, see below)
  data/lyrics.json   { lines: [{text,start,end}], words: [{w,start,end}] } in song seconds
  media/song.wav     source audio (kept local, never committed)
```

A scene module exports `{ name, from, to, frag, uniforms, camera(t), update?(t,u), textPlane?(t,cam),
drawText?(ctx,t,lyrics), post?(t), textSize? }`.

### The lyric as its own layer

Give a scene a sibling `scenes/<name>.lyric.js` exporting `(params) => ({ textSize?, textPlane(t, cam),
drawText(ctx, t, lyrics), shade? })` and leave `drawText` and `uText` out of the scene itself. The
picture then renders without words, the words render alone with transparency from the same camera,
and the two are composited per segment. A typography change re-renders only the layer (seconds per
scene) and the composite, never the picture. Keep type helpers in a song module that only lyric
modules import (for example `lib/type.js`): anything a scene module imports is part of its picture.
The layer has a soft `shade` (0 to 1, default 0.6) behind light words so they read over anything,
spread by `haloSpread` (default 9, what Genesis 8 settled on); set either song-wide in film.json
(`"lyric": { "haloSpread": 9, "shade": 0.6 }`) or per lyric module;
the contrast gate measures whether that was enough. Words that must sit behind objects, refract
through water or take the scene's fog stay in the scene (baked), and re-render with it. `frag` defines `vec3 shade(vec2 fragCoord)` and may
use everything in `web/glsl.js`. Scenes import helpers from `/engine.js` and anchor to measured lyrics
with `anchor()` from `/timing.js`.

## Making a film

Every step is a command any agent (or a person) can run; the critic can be Claude, Codex (GPT-6 Sol by default, reasoning high for a storyboard or stills and xhigh for a film) or any
command in `ARK_CRITIC_CMD`.

1. **Storyboard, before any animation.** `node photoreal/storyboard.mjs draft --song S` writes
   `docs/STORYBOARD.md`: one row per stretch of the song with the time, what's on screen, what the
   moment is for, how it leaves and what carries into the next shot, with the lyrics filled in. Fill
   every cell, `storyboard.mjs check`, then `node photoreal/critic.mjs storyboard --song S --agent
   claude|codex`. The critic also reads the lyrics row by row as if the film were muted and says
   whether the story still comes through.
2. **Build the scenes**, then `node photoreal/film.mjs --song S --draft` and the pre-render check,
   `node photoreal/check.mjs --song S --label draft`.
3. **Key stills.** `node photoreal/film.mjs --song S --stills` renders the opening, the main image,
   both sides of the fastest cut, a lyric hold and the ending at full quality;
   `node photoreal/critic.mjs stills --song S` reviews them zoomed in.
4. **Full render.** `node photoreal/film.mjs --song S` refuses to start until the storyboard, the
   stills and the draft check have passed for the current scenes (`--skip-storyboard`,
   `--skip-stills`, `--skip-check` override, and say so in `STATUS.md`). It times every scene
   cheaply, renders one second of the slowest, uses that to choose one or two workers and prints an
   honest finish time. Each worker runs under a watchdog: no new frame for 3 minutes (`--stall`)
   and it is killed, logged and retried twice (`--retries`); a scene that still fails is marked
   failed and the rest carry on. `out/progress.json` holds scenes done and total, what is rendering,
   frames done, seconds per scene, the estimated finish and the last frame's time;
   `out/STATUS.md` is written when the run finishes or gets blocked.
5. **Final review.** `node photoreal/check.mjs --song S --label final`, then
   `node photoreal/critic.mjs film --song S`. The critic gets a contact sheet, a strip of frames
   around every cut and the measured results, and nothing about how the film was built. It returns
   ranked problems with times and exact fixes and a verdict of ship or one more pass; it cannot ship
   over a failed measurement. `out/review/ledger.md` carries every problem across rounds and marks
   each fixed, partly fixed or still there. Fix, re-render only the scenes involved (`--only`), and
   run the check and the critic again until the verdict is ship.

The measured gates (`check.mjs`, thresholds overridable under `"gates"` in film.json): every lyric
word at least 4.5:1 against what is actually behind it once sung; no words running together,
overlapping or crowding, and no lines on top of each other; no stretch over 0.5 s with nothing
visibly moving; no fast move that stops dead; no word moving before it has been still for 8 frames;
and every cut on a measured beat or up to 2 frames before it (a scene can give `"offBeat": "why"`).

## Tiers

`film.mjs --tier fast|standard|premium` (or `"tier"` in film.json; standard when neither says).
`node photoreal/film.mjs --song S --estimate` measures the machines and prints what each tier
would cost for this film, without rendering.

| Tier | Frames | Sub-frames | Encode | Gates | For |
|---|---|---|---|---|---|
| fast | 30 fps | 2 | veryfast | none (STATUS.md says so) | a watchable film in a couple of hours |
| standard | film.json fps | film.json samples | slow | all | everything rendered before tiers existed, unchanged |
| premium | 60 fps | at least twice, 32 for premium scenes | slow, CRF 16 | all, plus shot-length rules | the all-out photorealistic film |

Each tier keeps its own segments (`out/segments-fast/`, `out/segments/`, `out/segments-premium/`),
so trying one never throws away another. The fast film is `out/film-fast.mp4`.

To rebuild a few scenes all-out inside a film rendered at standard, give those scenes
`"tier": "premium"` in film.json. They render with premium sub-frames, layers and encode at the
film's frame rate into `out/segments-premium/`, and the join stitches them in; every other
segment stays cached.

## Premium scenes

A scene that declares `export const kind = 'three'` is a Three.js scene rendered through
`web/premium/`; `export const kind = 'shader'` keeps a raymarched scene and adds the lens and
finishing kit. Nothing else changes for existing scenes: their page, engine and cache keys are
untouched (files in `web/premium/` count only toward premium scenes' keys).

```js
export const kind = 'three';
export default (P) => ({
  name, from: P.from, to: P.to,
  async build({ THREE, renderer }) { /* make and return { scene } */ },
  camera(t) { return { pos, target, fov, focus, aperture }; },   // focus distance, lens radius
  update(t, { scene }) {},          // move things
  async prepare(t) {},              // e.g. await words.set(html) for in-world text
  post(t) { return { exposure, bloom, ... }; },                   // as for every scene
  finish(t) { return { ...FINISH.studio }; },                     // flare, leak, grade, fade
});
```

- **Studio** (`/premium/studio.js`): `studio(renderer, scene, { key, fill, rim, floor })` lights a
  hero object like a product shot (room reflections, soft boxes, rim light, a glossy, matte or
  mirror floor); `materials` has lacquer, glass, gold, silver, brushed metal, porcelain, wine and
  emissive presets.
- **Lens**: every sub-frame samples a point on the aperture and aims at the focus plane, so depth of
  field, bokeh and rack focus (animate `focus`) come from the same averaging as motion blur. Wide
  apertures need more sub-frames to stay smooth; set `samples` on the scene in film.json.
- **In-world lyrics** (`/premium/text.js`): `htmlText({ width, height, css })` paints real browser
  typography (HTML and CSS) into a texture for any surface in the scene, through Chrome's
  HTML-in-canvas (enabled for premium scenes); without it, the same text is drawn with Canvas 2D.
  The flat lyric layer (`scenes/<name>.lyric.js`) still works on top, and stays the cheap way to
  revise words.
- **Finishing kit** (`/premium/finish.js`): anamorphic flare, light leaks, split-tone grade and
  fades, with presets `FINISH.studio`, `FINISH.film` and `FINISH.night`; grain, vignette, chromatic
  aberration and bloom stay in `post()`.
- **Transitions**: give a scene `"transition": { "type": "fade", "duration": 0.5 }` in film.json
  and it blends in from the previous scene, centred on the cut. Both scenes render half the
  duration past the cut so the blend has real frames. `type` is any FFmpeg xfade transition:
  fade, fadeblack, fadewhite, smoothleft, circleopen, radial, hblur, zoomin, distance, pixelize and
  more (`dissolve` is a grainy pixel dissolve).
- **Checks** (`check.mjs` with the premium tier): shots over 4 s warn and over 8 s fail unless the
  scene gives `"hold": "<why>"`; readability is judged on the word being sung, so soft background
  text and close-set designed type pass; the critic judges against premium product and title work.

## Several machines

`film.mjs` renders on every reachable machine (see "Where work runs" in AGENTS.md). Other machines
are listed only in `~/.config/ark/machines.json`, which is never committed:

```json
{ "machines": [ { "name": "omipc", "kind": "helper", "helper": "omipc", "dashboard": "http://<host>:5299", "minFreeVramMB": 1500 } ] }
```

A helper is a command on this Mac with the verbs `run "<cmd.exe command>"`, `put <local> <remote>`
and `get <remote> <local>`. The machine needs Node, Chrome and FFmpeg; the engine and the song are
sent as content-addressed bundles (the whole song folder except `out/` and `media/`), so an
unchanged engine is never sent twice. On Windows Chrome uses its default backend (Direct3D 11),
with a flush after every draw; `ARK_ANGLE` overrides. A remote Chrome can still lose its GPU
context, which draws black: output that says so stops the job at once, it is retried, and after
repeated losses the scene moves to this Mac. Before a full render every scene is drawn once on
both machines and compared; scenes the other machine draws differently stay on this Mac.
`out/test-render.json` records each machine's per-scene check, speed and worker count.

## Running single scenes

```sh
node photoreal/render.mjs stills --song ../genesis8-the-dove --scene ararat --t 78,80 --samples 4
node photoreal/render.mjs video  --song ../genesis8-the-dove --scene ararat --samples 16
```

It needs Google Chrome (set `CHROME` to another path) and FFmpeg. Chrome runs headless on Metal
through ANGLE. At 16 samples a 1080p60 frame takes 1 to 5 s on an M4 Pro depending on the scene.
