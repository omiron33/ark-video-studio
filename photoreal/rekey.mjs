// Carry a song's cached segments over from the engine before the safeguards (93d7efb) so they are
// not re-rendered. A segment keeps its cache only if its old key still matches its scene code
// exactly as the old engine computed it; the picture code (engine.js, glsl.js, timing.js) did not
// change between the two engines, so those segments are pixel-identical to what the new engine
// would render.
//   node photoreal/rekey.mjs --song ../genesis8-the-dove [--old-web /path/to/old/photoreal/web] [--dry]
// --old-web is the absolute photoreal/web path the old engine ran from (it was part of the old key).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeKeys } from './lib/keys.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const SONG = path.resolve(opt('song', '.'));
const OLD_REV = opt('rev', '93d7efb');
const OLD_WEB = opt('old-web', '/Volumes/DATA/songs/ark-video-studio-photoreal/photoreal/web');
const film = JSON.parse(fs.readFileSync(path.join(SONG, 'film.json'), 'utf8'));
const fps = film.fps ?? 60;
const git = (...a) => execFileSync('git', ['-C', path.join(HERE, '..'), ...a]);

// the old engine hashed every file under photoreal/web by absolute path and content
const oldFiles = git('ls-tree', '-r', '--name-only', OLD_REV, 'photoreal/web').toString().trim().split('\n')
  .filter((f) => !path.basename(f).startsWith('.')).map((f) => ({ abs: path.join(OLD_WEB, path.relative('photoreal/web', f)), rel: f })).sort((a, b) => (a.abs < b.abs ? -1 : 1));
const eh = crypto.createHash('sha256');
for (const f of oldFiles) eh.update(f.abs).update(git('show', `${OLD_REV}:${f.rel}`));
for (const f of ['lyrics.json', 'audio.json']) { const p = path.join(SONG, 'data', f); if (fs.existsSync(p)) eh.update(fs.readFileSync(p)); }
const sharedKey = eh.digest('hex');
function depsOf(file, seen = new Set()) {
  if (seen.has(file) || !fs.existsSync(file)) return seen;
  seen.add(file);
  for (const m of fs.readFileSync(file, 'utf8').matchAll(/from\s+'\/song\/([^']+)'/g)) depsOf(path.join(SONG, m[1]), seen);
  return seen;
}
function oldKey(s, samples) {
  const h = crypto.createHash('sha256').update(sharedKey);
  for (const f of [...depsOf(path.join(SONG, 'scenes', `${s.scene}.js`))].sort()) h.update(f).update(fs.readFileSync(f));
  const f0 = Math.round(s.from * fps), f1 = Math.round(s.to * fps);
  return crypto.createHash('sha256').update(h.digest('hex')).update(JSON.stringify(s.params ?? {})).update(`${f0}-${f1}-${samples}`).digest('hex');
}

const keys = makeKeys(SONG);
let kept = 0, stale = 0;
for (const s of film.scenes) {
  if (keys.hasLayer(s.scene)) continue;   // lyric-layer scenes did not exist before
  const samples = String(s.samples ?? film.samples ?? 12);
  const out = path.join(SONG, 'out', 'segments', `${s.id}.mp4`), kf = out + '.key';
  if (!fs.existsSync(out) || !fs.existsSync(kf)) continue;
  const have = fs.readFileSync(kf, 'utf8');
  const next = keys.plate(s, fps, samples);
  if (have === next) { kept++; continue; }
  if (have !== oldKey(s, samples)) { stale++; console.log(`segment ${s.id}: out of date with its scene, will re-render`); continue; }
  if (!argv.includes('--dry')) fs.writeFileSync(kf, next);
  kept++;
}
console.log(`${kept} segments carried over, ${stale} out of date${argv.includes('--dry') ? ' (dry run)' : ''}`);
