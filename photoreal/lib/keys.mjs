// Cache keys for a film's segments. A scene with scenes/<name>.lyric.js has two cached parts: the
// picture (plate) and the lyric layer. The plate key leaves out everything that only shapes the
// words (the lyric module and what it alone imports, the fonts and the layer pass), so a typography
// change re-renders the layer and the composite, never the picture.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');

export function filesUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith('.')) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? filesUnder(p) : [p];
  }).sort();
}

// a song module and the song modules it imports, followed recursively
export function depsOf(song, file, seen = new Set()) {
  if (seen.has(file) || !fs.existsSync(file)) return seen;
  seen.add(file);
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"]\/song\/([^'"]+)['"]/g)) depsOf(song, path.join(song, m[1]), seen);
  return seen;
}

const hashFiles = (h, files, base) => { for (const f of files) h.update(path.relative(base, f)).update(fs.readFileSync(f)); return h; };

export function makeKeys(song, { web = WEB } = {}) {
  const webFiles = filesUnder(web);
  const textOnly = (f) => path.basename(f) === 'layer.js' || f.includes(`${path.sep}fonts${path.sep}`);
  const data = ['lyrics.json', 'audio.json'].map((f) => path.join(song, 'data', f)).filter((f) => fs.existsSync(f));
  const engineAll = hashFiles(crypto.createHash('sha256'), [...webFiles, ...data], song).digest('hex');
  const enginePlate = hashFiles(crypto.createHash('sha256'), [...webFiles.filter((f) => !textOnly(f)), ...data], song).digest('hex');
  const lyricFile = (scene) => path.join(song, 'scenes', `${scene}.lyric.js`);
  const hasLayer = (scene) => fs.existsSync(lyricFile(scene));
  const sceneFiles = (scene) => [...depsOf(song, path.join(song, 'scenes', `${scene}.js`))].sort();
  const window = (s, fps) => `${Math.round(s.from * fps)}-${Math.round(s.to * fps)}`;

  // everything that decides what the segment looks like, apart from render quality
  function content(s, fps) {
    const h = crypto.createHash('sha256').update(hasLayer(s.scene) ? 'layer' : 'baked').update(engineAll);
    const files = new Set(sceneFiles(s.scene));
    if (hasLayer(s.scene)) for (const f of depsOf(song, lyricFile(s.scene))) files.add(f);
    hashFiles(h, [...files].sort(), song);
    return h.update(JSON.stringify(s.params ?? {})).update(window(s, fps)).digest('hex');
  }
  function plate(s, fps, samples) {
    const layered = hasLayer(s.scene);
    const h = crypto.createHash('sha256').update(layered ? 'plate' : 'baked').update(layered ? enginePlate : engineAll);
    hashFiles(h, sceneFiles(s.scene), song);
    return h.update(JSON.stringify(s.params ?? {})).update(`${window(s, fps)}-${samples}`).digest('hex');
  }
  function layer(s, fps, samples) {
    if (!hasLayer(s.scene)) return null;
    return crypto.createHash('sha256').update('layer').update(content(s, fps)).update(String(samples)).digest('hex');
  }
  return { content, plate, layer, hasLayer };
}
