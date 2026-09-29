// The storyboard table, written before any animation (see lib/storyboard.mjs).
//   node photoreal/storyboard.mjs draft --song ../genesis9     write docs/STORYBOARD.md with one TODO row per scene
//   node photoreal/storyboard.mjs check --song ../genesis9     check it covers the song, has no empty cells and holds every lyric
// Then have the fresh critic read it: node photoreal/critic.mjs storyboard --song ../genesis9
import fs from 'node:fs';
import path from 'node:path';
import { draftStoryboard, validateStoryboard, storyboardPath } from './lib/storyboard.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const SONG = path.resolve(opt('song', '.'));
const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(SONG, f), 'utf8')); } catch { return null; } };
const lyrics = read('data/lyrics.json') ?? { lines: [], words: [] };
const film = read('film.json');
const audio = read('data/audio.json');
const duration = audio?.duration ?? film?.scenes?.at(-1)?.to ?? lyrics.lines.at(-1)?.end ?? 0;
const file = storyboardPath(SONG);

if (argv[0] === 'draft') {
  if (fs.existsSync(file) && !argv.includes('--force')) { console.error(`${file} exists; pass --force to replace it`); process.exit(1); }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, draftStoryboard({ title: path.basename(SONG), duration, lyrics, scenes: film?.scenes }));
  console.log('wrote', file);
} else if (argv[0] === 'check') {
  if (!fs.existsSync(file)) { console.error(`no storyboard at ${file}`); process.exit(1); }
  const r = validateStoryboard(fs.readFileSync(file, 'utf8'), { duration, lyrics });
  for (const e of r.errors) console.log('-', e);
  console.log(r.ok ? `storyboard ok: ${r.rows.length} rows` : `storyboard has ${r.errors.length} problems`);
  process.exit(r.ok ? 0 : 1);
} else {
  console.error('usage: node photoreal/storyboard.mjs draft|check --song <folder>');
  process.exit(1);
}
