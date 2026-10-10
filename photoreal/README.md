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
   Tight for annotations) and placed in the world by the scene, on a surface or along a form, so it
   takes the scene's fog, occlusion and light. See [Words in the scene](#words-in-the-scene).

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

## Words in the scene

The lyric is part of the world by default, and the world carries the story. Words are painted or
carved on a surface (written on the side of the ark), lie along a ridge or a wave crest, wrap round a
3D form with callout lines to what they name, bend into the same field that bends the grid, get
typed, signed and stamped onto a page, or burn as a fuse runs through them. Something in the scene
touches them: its light, shadow, fog, focus, a hand, a flame, an object passing in front. Draw them
in the scene module itself (the shader's text texture, or `htmlText` on a mesh in a premium scene)
so they render with the picture. A word changed there re-renders that scene only, which is the
price of the words belonging to it; every other segment stays cached.

They still have to read: sharp at the moment they are sung, one clear reading path, never light
words on bright sky. Put them on a quiet part of the world (a dark hull, a shadowed ridge, the
lit side of a form) or light the surface they are on. The contrast and collision gates measure it.

`photoreal/examples/in-scene-ridge/` is a small worked example: "upon the mountains of Ararat"
burned into the near face of a surveyed ridge, each word catching as it is sung, lighting the rock
and the contour lines around it (`node photoreal/render.mjs stills --song
photoreal/examples/in-scene-ridge --scene ridge --params '{"from":0,"to":8}' --t 5.5`).

Plan it in the storyboard's last column, "Where the words live in the scene", before any animation.
`check.mjs` fails a premium scene that lays its words over the picture with a lyric layer unless it
opts in (below).

### Words over the picture (opt-in)

A lyric layer is the exception, for a scene that genuinely wants words over the picture (a title
held over black, an annotation beside the image). The scene opts in with `"overlay": "<why>"` on its
film.json entry; the field is not part of any cache key. Give the scene a sibling `scenes/<name>.lyric.js` exporting `(params) => ({ textSize?, textPlane(t, cam),
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

For a narrated story instead of a song, see [Narrated story films](#narrated-story-films); the
steps are the same. Every step is a command any agent (or a person) can run; the critic can be Claude, Codex (GPT-6 Sol by default, reasoning high for a storyboard or stills and xhigh for a film) or any
command in `ARK_CRITIC_CMD`.

1. **Storyboard, before any animation.** `node photoreal/storyboard.mjs draft --song S` writes
   `docs/STORYBOARD.md`: one row per stretch of the song with the time, what's on screen, what the
   moment is for, how it leaves, what carries into the next shot and where the words live in the
   scene, with the lyrics filled in. Fill
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
word at least 4.5:1 against what is actually behind it once sung; no words running together or
overlapping, and no lines on top of each other; no stretch over 0.5 s with nothing visibly moving;
no fast move that stops dead; no stretch over 1.5 s where only the camera moves (a still pushed,
panned or breathing light: the `live` gate takes the frame-wide move and any light change out of
each pair of frames and fails when nothing is left; a scene can give `"cameraOnly": "<why>"`); a
warning for a shot whose camera starts and ends at a standstill (`rest-to-rest`, read from the
scene's camera; a scene can give `"rest": "<why>"`); no word moving before it has been still for 8 frames; every cut on a
measured beat or up to 2 frames before it (a scene can give `"offBeat": "why"`); no shaking frame in
a scene that hasn't opted in (see [Shake](#shake)); and no lyric layer over the picture in a premium
scene that hasn't opted in (see [Words in the scene](#words-in-the-scene)). A shot over 8 s warns
unless its scene gives `"hold": "<why>"`; a long camera move through one world is allowed.

## Motion kit

`/kit/motion.js` is the shared way to move a camera or anything else, after Lasseter's principles of
animation. Most of our shots used to be one ease from a standstill to a standstill: measured over 263
shots of six code films, 70% started and ended at rest, so most cuts joined two stopped cameras, and
the paths were straight lines. The rig fixes that by default.

```js
import { rig, spring, anticipate, follow, stagger, weight, move } from '/kit/motion.js';
camera: rig({
  from: P.from, to: P.to,
  path: [[0, 1.6, 0], [2, 1.7, 4], [3, 1.6, 9]],   // passed through on a curve, at an even pace
  look: { ahead: 6 },                                // or fixed [x, y, z], or points moved along
  enter: 'moving', exit: 'moving',                   // the defaults; 'rest' or a speed multiple
  handheld: 0.6,                                     // 0 for a tripod
}),
```

- **Slow in and out only where a move really starts or stops.** `enter` and `exit` default to
  `'moving'`, so a shot starts and ends at its travelling speed. `'rest'` eases to a standstill; at a
  rest exit the operator carries a hair past the mark and comes back (`settle`, critically damped:
  one soft return, never a wobble). To join two shots of one moment, give the second `enter` the
  speed the first left at (`camera.speed(t)`).
- **Arcs.** Paths are centripetal Catmull-Rom curves through the points, measured by arc length.
  `bank` rolls into turns for a crane or a drone.
- **Hand-held.** Layered natural noise in position and aim plus a slow breath, about 1.5 cm and
  0.15 degrees at `handheld: 1` (`metres` scales it to a scene's units). It replaces the two-sine
  `drift()`. It is not shake: nothing in it is periodic or fast, and the shake rules still apply.
- **Helpers.** `spring(t, t0, { freq, damping })` (a hit that settles), `anticipate(t, t0, { lead,
  back, dur })` (a small wind-up the other way before the move), `follow(fn, t, lag)` (a lagged copy
  of a motion that keeps going after it stops), `stagger(i, n, spread)` (parts of a whole starting one
  after another, a little unevenly), and `weight.heavy | normal | light` with `move(t, t0, t1, w)`
  (a stone is slow to get going and lands firmly; cloth gets going at once and floats in).

## Life kit

`/kit/life.js` holds the secondary action that makes a frame read as footage, in GLSL
(`LIFE_GLSL`, added to a scene's `frag` before its own code) and in JS for uniforms:
`lifeMotes` (dust turning in a box of air, taking the scene's light through `LIFE_LIGHT(p)`),
`lifeEmbers` (sparks rising off a fire, cooling as they go), `lifeFlicker` / `flicker()` (a flame
that never repeats), `lifeGust` and `lifeSway` (wind that travels across a field, the tip of each
stalk lagging its root), `lifeShimmer` (heat haze), `lifeHaze` (drifting density for light shafts)
and `lifeGlow` (a glowing point hidden behind anything nearer). Pass the depth of the scene's hit so
particles go behind what stands in front. Keep them restrained: dust is seen against shadow, never
as fireflies against the sky, and nothing reads as rain.

Files under `web/kit/` belong to the cache keys of the scenes that import them (followed through
kit-to-kit imports) and of no other scene, so adding to or changing the kit never re-renders a
finished film that doesn't use it.

## Shake

Shake is off by default. Shaking the whole frame (camera shake, a jolted or juddering picture, a
lyric that rattles as it lands) is only for extreme power or a violent, energetic collision: a blow
landing, lightning striking close, the ground splitting, walls falling, a wave breaking over the
ark. It is not a way to make a strong word, a beat or a chorus feel big; light, scale, a cut on the
beat, a held composition or sudden stillness carry that. A scene that earns it says so in film.json,
`"shake": "<the violent moment>"`; keep it to the one or two most violent moments in a film, short
and damped (gone within about 0.3 s), and written in that scene's own code. Shared song helpers
(for example a lyric `strike()` in `lib/type.js`) default to no shake and shake only when an
opted-in scene passes it. One object moving on its own (a flame trembling, a head shaking no) is
not frame shake; mark the line with a comment `ark-shake-ok: <what moves>`. The `shake` gate in
`check.mjs` reads every scene's source and fails a scene that shakes without opting in, warns about
shared helpers that shake, and warns when more than `maxShakeScenes` (2) scenes opt in. The field
is not part of any cache key, so opting in never re-renders a segment.

## Narrated story films

A film can follow a spoken story instead of a song: the same scenes, segments, layers, farm, checks
and critic, switched on by `"mode": "story"` in film.json. A film without it is a lyric film, and
nothing about it changes (its cache keys included).

```json
"mode": "story",
"story": {
  "script": "data/script.txt",
  "narration": "media/narration.wav",
  "narrationAt": 1.5,
  "music": "media/score.wav", "musicGainDb": -14, "duckDb": 12,
  "onScreen": ["Lazarus, come forth."],
  "events": [{ "id": "stone", "cue": "took away the stone", "scene": "02", "what": "the stone is rolled back" }]
}
```

- **The script** is the exact text, one spoken line per line of the file. Whatever the narrator says
  must match it word for word; punctuation and case don't count, and a compound heard as two words
  (`graveclothes`, `grave clothes`) is the same word.
- **The narration's timing is authoritative.** `node photoreal/story.mjs prepare --song S` aligns
  the voice to the script locally (wav2vec2 CTC) and writes `data/lyrics.json` in film time, so a
  scene anchors to a spoken phrase exactly as a lyric scene anchors to a sung line (`anchor()` in
  `/timing.js`). It also writes `data/story.json` with each event's time and `data/audio.json` with
  no beats: story cuts follow the voice. Re-run it whenever the narration changes.
- **Events are the story beats the picture must show.** `cue` is a phrase of the script and the
  event lands on its first word (`offset` moves it); `at` gives a silent beat in film seconds;
  `scene` is the scene that shows it. Scenes can read `/song/data/story.json` to time their action.
- **Most words are only heard.** The phrases in `onScreen` are the only ones the text gates read;
  put them in a `scenes/<name>.lyric.js` layer as usual. Everything else is carried by the voice and
  the picture.
- **Music sits under the voice.** `music` is optional. The engine builds `out/audio/mix.wav` from the
  measured words: the music drops `duckDb` before each stretch of speech and recovers after it, and
  fades out over `musicFadeOut` s at the end; the voice itself is never compressed or moved. One
  fixed trim is applied only if the sum would clip. `film.mjs` joins the picture with this mix
  instead of `media/song.wav`. `story.mjs mix` rebuilds it after a level change.
- **Auditioning takes:** `node photoreal/story.mjs hear --song S --audio take.wav` transcribes a
  take with two local Whisper models (small.en and medium.en; `ARK_STORY_HEAR` changes them) and
  lists every word changed, missing or added against the script, with the model that heard it. A
  take is exact only when both hear the script. One model alone can imagine words in a silence
  ("Thank you" at the end of a take); a real misreading is heard by both.
- **A narration from line takes:** when no single take reads everything exactly (a long passage, a
  local voice), generate one take per script line and list them in `story.takes`:
  `[{ "line": 1, "file": "media/tts/line01.flac", "pause": 2.4, "lufs": -20, "tempo": 0.92 }]`.
  `node photoreal/story.mjs assemble --song S` hears each take against its own line (any slip
  stops it), trims each take's own silence, sets its loudness (`lufs`, -20 by default; raise one
  line to give it force), applies a gentle `tempo` (0.85 to 1.15) and the `pause` after it, and
  writes `story.narration` with a `.plan.json` beside it. Then `prepare` as usual.

`check.mjs` on a story film runs the motion gates as usual, drops the beat gate, and adds:

| Gate | Fails when |
|---|---|
| `spoken-text` | the encoded film's own audio over the narrated stretch, heard by both local models, differs from the script by any word |
| `audio-sync` | the encoded audio is more than 20 ms off the mix it was made from (or shorter or longer) |
| `voice-music` | during any spoken word the music is less than 12 dB under the voice (measured on the stems) |
| `events` | a cue is not in the narration, an event falls outside the scene that claims it, or beats run out of order |
| `cut-word` | a cut lands inside a spoken word (a scene can give `"midWord": "why"`) |

The text gates (contrast, collision, settle) read only the `onScreen` phrases. The storyboard check
also requires every event to fall in a row; the key stills add one still just after each event; and
the critic is briefed on a narrated story (`narration.txt`, `beats.txt`) rather than a lyric film.
Thresholds live with the others under `"gates"` (`minVoiceOverMusicDb`, `maxSyncLagMs`,
`minSyncCorrelation`, `cutWordMargin`).

The working sequence: write the script, record and `hear` takes until one is exact (or `assemble`
exact line takes), `prepare`, write
the storyboard against `narration.txt` and the events, build scenes, then `--draft`, `check.mjs`,
`--stills`, the full render and the critic exactly as for a song.

## People rendered in Blender

A scene can have its people drawn by Blender instead of in the shader: put who stands where in
`scenes/<name>.people.json` (people with a pose, a place on the ground in the scene's own
coordinates and a heading, plus the sun, sky and any local light), and name the song's Blender script
in film.json (`"people": { "renderer": "tools/blender_layer.py", "samples": 64 }`). `film.mjs` then
renders that scene's picture as usual, asks the scene module for its camera at every frame, runs the
script in Blender (`BLENDER` overrides the path) to draw the people as a transparent layer from that
camera, and composites picture, people and words in that order. The layer is cached like the lyric
layer, keyed by the scene, the people file and everything under the song's `tools/`. It renders on
this Mac. The script receives `--spec` (the people file plus `camera`: one entry per frame with
`pos`, `target`, `fov`, `roll`, `focus` and `aperture`), `--out`, `--res`, `--samples` and `--frames`
and writes `00000.png`, ... with transparency. Engine coordinates are metres with y up; Blender's
are z up, so (x, y, z) becomes (x, -z, y).

Segments now render at the film's own frame rate when it is not 60 (`"fps": 24`); films at 60 are
rendered exactly as before.

## Tiers

`film.mjs --tier fast|standard|premium|ultra` (or `"tier"` in film.json). **Ultra, the ultra
realistic render, is the default** when neither says: 1920x1080 at the film's frame rate, at least
64 sub-frames, CRF 12 (add `"resolution": "3840x2160"` for 4K). A film already rendered at standard
before that (it has segments in `out/segments/`) stays at standard so it is never silently
re-rendered; give it `"tier": "ultra"` to move it up.
`node photoreal/film.mjs --song S --estimate` measures the machines and prints what each tier
would cost for this film, without rendering.

| Tier | Frames | Sub-frames | Encode | Gates | For |
|---|---|---|---|---|---|
| fast | 30 fps | 2 | veryfast | none (STATUS.md says so) | a watchable film in a couple of hours |
| standard | film.json fps | film.json samples | slow | all | films already rendered at standard, unchanged |
| premium | 60 fps | at least twice, 32 for premium scenes | slow, CRF 16 | all, plus in-scene words | a lighter all-out render |
| ultra (default) | film.json fps | four times, at least 64 | slow, CRF 12, 1080p unless `resolution` says | all, plus in-scene words | ultra realistic: every new film. Every sub-frame is jittered inside the pixel, so 64 sub-frames is 64x supersampling as well as motion blur |

**Resolution.** `"resolution": "3840x2160"` in film.json (or `--res`) renders every picture, lyric
layer and key still at that size; drafts and the fast tier stay 1920x1080. The page reads its size
from its URL, and that line of `web/engine.js` is hashed as the constant it replaced, so films
rendered before keep their cached segments; a size other than 1920x1080 is part of each segment's
key. A 4K frame costs about four times a 1080p one.

Each tier keeps its own segments (`out/segments-fast/`, `out/segments/`, `out/segments-premium/`,
`out/segments-ultra/`),
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
  This is how a premium scene's words are drawn: on the hero object, wrapped round it, on the floor
  it stands on. A lyric layer over the picture (`scenes/<name>.lyric.js`) needs `"overlay"`.
- **Finishing kit** (`/premium/finish.js`): anamorphic flare, light leaks, split-tone grade and
  fades, with presets `FINISH.studio`, `FINISH.film` and `FINISH.night`; grain, vignette, chromatic
  aberration and bloom stay in `post()`.
- **Transitions**: give a scene `"transition": { "type": "fade", "duration": 0.5 }` in film.json
  and it blends in from the previous scene, centred on the cut. Both scenes render half the
  duration past the cut so the blend has real frames. `type` is any FFmpeg xfade transition:
  fade, fadeblack, fadewhite, smoothleft, circleopen, radial, hblur, zoomin, distance, pixelize and
  more (`dissolve` is a grainy pixel dissolve).
- **Checks** (`check.mjs` with the premium tier): close-set designed type passes the collision
  gate as long as words don't overlap or run together; every lyric word stays sharp; a lyric layer
  needs `"overlay"`; the critic judges against premium product and title work and ranks words that
  float over the picture as a problem.

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
