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
drawText?(ctx,t,lyrics), post?(t), textSize? }`. `frag` defines `vec3 shade(vec2 fragCoord)` and may
use everything in `web/glsl.js`. Scenes import helpers from `/engine.js` and anchor to measured lyrics
with `anchor()` from `/timing.js`.

## Running

```sh
node photoreal/render.mjs stills --song ../genesis8-the-dove --scene ararat --t 78,80 --samples 4
node photoreal/render.mjs video  --song ../genesis8-the-dove --scene ararat --samples 16
```

It needs Google Chrome (set `CHROME` to another path) and FFmpeg. Chrome runs headless on Metal
through ANGLE. At 16 samples a 1080p60 frame takes 1 to 5 s on an M4 Pro depending on the scene.
