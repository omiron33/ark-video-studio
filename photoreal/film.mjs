// Render a whole film from a song's film.json, one cached segment per scene, then join them and
// lay the song under the picture.
//   node photoreal/film.mjs --song ../genesis8-the-dove [--only 01,02] [--samples 12] [--draft] [--out film.mp4]
// film.json: { "fps": 60, "scenes": [{ "id": "01", "scene": "sea", "from": 0, "to": 15.5, "params": {} }] }
// Scene windows must tile the song with no gaps. A segment is re-rendered only when its scene code,
// the song's shared code, its parameters, the lyrics or the engine's web code change.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const SONG = path.resolve(opt('song', '.'));
const film = JSON.parse(fs.readFileSync(path.join(SONG, 'film.json'), 'utf8'));
const fps = film.fps ?? 60;
const draft = argv.includes('--draft');
const samples = opt('samples', draft ? '2' : String(film.samples ?? 12));
const only = opt('only')?.split(',');
const segDir = path.join(SONG, 'out', draft ? 'segments-draft' : 'segments');
fs.mkdirSync(segDir, { recursive: true });

// tiling check
const scenes = film.scenes;
for (let i = 1; i < scenes.length; i++) {
  if (Math.abs(scenes[i].from - scenes[i - 1].to) > 1e-6) throw Error(`gap or overlap between ${scenes[i - 1].id} and ${scenes[i].id}`);
}

function filesUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith('.')) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? filesUnder(p) : [p];
  }).sort();
}
const shared = [...filesUnder(path.join(SONG, 'lib')), path.join(SONG, 'data', 'lyrics.json'), path.join(SONG, 'data', 'audio.json'), ...filesUnder(path.join(HERE, 'web'))]
  .filter((f) => fs.existsSync(f));
const sharedHash = crypto.createHash('sha256');
for (const f of shared) sharedHash.update(f).update(fs.readFileSync(f));
const sharedKey = sharedHash.digest('hex');

const segs = [];
for (const s of scenes) {
  const f0 = Math.round(s.from * fps), f1 = Math.round(s.to * fps);
  const out = path.join(segDir, `${s.id}.mp4`);
  segs.push(out);
  if (only && !only.includes(s.id)) continue;
  const key = crypto.createHash('sha256').update(sharedKey).update(fs.readFileSync(path.join(SONG, 'scenes', `${s.scene}.js`)))
    .update(JSON.stringify(s.params ?? {})).update(`${f0}-${f1}-${samples}`).digest('hex');
  const keyFile = out + '.key';
  if (fs.existsSync(out) && fs.existsSync(keyFile) && fs.readFileSync(keyFile, 'utf8') === key) { console.log(`segment ${s.id} cached`); continue; }
  console.log(`segment ${s.id} (${s.scene}) ${s.from}–${s.to}: ${f1 - f0} frames`);
  const r = spawnSync('node', [path.join(HERE, 'render.mjs'), 'video', '--song', SONG, '--scene', s.scene, '--params', JSON.stringify({ ...(s.params ?? {}), id: s.id, from: s.from, to: s.to }),
    '--from', String(f0 / fps), '--to', String(f1 / fps), '--samples', samples, '--noaudio', '--preset', draft ? 'veryfast' : 'slow', '--crf', opt('crf', '18'), '--out', out], { stdio: 'inherit' });
  if (r.status !== 0) throw Error(`segment ${s.id} failed`);
  fs.writeFileSync(keyFile, key);
}

if (only) process.exit(0);
const list = path.join(segDir, 'concat.txt');
fs.writeFileSync(list, segs.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
const out = path.resolve(opt('out', path.join(SONG, 'out', draft ? 'film-draft.mp4' : 'film.mp4')));
const end = scenes[scenes.length - 1].to;
const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-i', path.join(SONG, 'media', 'song.wav'),
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-t', String(end), '-movflags', '+faststart', out], { stdio: 'inherit' });
if (r.status !== 0) throw Error('join failed');
console.log('wrote', out);
