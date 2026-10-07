// Lyrics live in the scene by default. The words are part of the world: painted or carved on a
// surface, lying along a ridge, wrapped round a form, bent by the scene's own field, burned or
// stamped, and lit, fogged and hidden by what is there. That means drawing them in the scene module
// itself (baked), where they render with the picture and re-render with it.
//
// A lyric layer (scenes/<name>.lyric.js) is drawn on its own and composited over the finished
// picture, so nothing in the scene can light, shade or hide its words. It is an opt-in for the rare
// scene that wants words over the picture (a title card, an annotation, a quote held over black):
// the scene says so with "overlay": "<why>" on its film.json entry. That field is not part of any
// cache key, so opting in never re-renders a segment.
//
// The check fails an ultra or premium scene that uses a layer without opting in, and warns at the other
// tiers, so films made before in-scene became the default still pass.
import fs from 'node:fs';
import path from 'node:path';

const hasLayer = (song, scene) => fs.existsSync(path.join(song, 'scenes', `${scene}.lyric.js`));

// Problems for check.mjs: { severity, scene, detail, fix }
export function inSceneReview(song, scenes, tier) {
  const problems = [];
  for (const s of scenes) {
    const why = typeof s.overlay === 'string' ? s.overlay.trim() : s.overlay;
    if (s.overlay !== undefined && (typeof why !== 'string' || !why)) {
      problems.push({ severity: 'fail', scene: s, detail: `scene ${s.id} sets "overlay" without saying why`, fix: 'write why these words sit over the picture instead of in it, e.g. "overlay": "the title held over black before the first image", or remove it' });
      continue;
    }
    if (hasLayer(song, s.scene) && !why) {
      problems.push({
        severity: tier === 'premium' || tier === 'ultra' ? 'fail' : 'warn', scene: s,
        detail: `scene ${s.id} lays its words over the picture (scenes/${s.scene}.lyric.js) instead of putting them in the scene`,
        fix: `draw the words in scenes/${s.scene}.js as part of the world (on a surface, along a form, lit, fogged and hidden by it) and remove the lyric layer, or give the scene "overlay": "<why the words sit over the picture>" in film.json`,
      });
    }
  }
  return problems;
}
