// Narrated story films (film.json "mode": "story"; see lib/story.mjs for the format).
//   node photoreal/story.mjs hear    --song S --audio take.wav   what a narration take actually says, word by word against the script
//   node photoreal/story.mjs prepare --song S                    align the narration, resolve the events, write data/ and build the mix
//   node photoreal/story.mjs assemble --song S                   build the narration from one take per script line (story.takes), each heard first
//   node photoreal/story.mjs mix     --song S                    rebuild only the mix (after changing music levels)
// Then the usual photoreal steps: storyboard, scenes, film.mjs --draft, check.mjs, stills, the full
// render and the critic. film.mjs joins the picture with out/audio/mix.wav instead of media/song.wav,
// and check.mjs adds the story gates (spoken text, audio sync, voice over music, events, cuts mid-word).
import fs from 'node:fs';
import path from 'node:path';
import { storyConfig, isStory } from './lib/story.mjs';
import { hear, prepare, buildMix, assemble } from './lib/story-audio.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const SONG = path.resolve(opt('song', '.'));
const film = JSON.parse(fs.readFileSync(path.join(SONG, 'film.json'), 'utf8'));
if (!isStory(film)) { console.error('film.json has no "mode": "story"; this is a lyric film'); process.exit(1); }
const cfg = storyConfig(film);
if (cfg.errors.length) { for (const e of cfg.errors) console.error('-', e); process.exit(1); }
const work = path.join(SONG, 'out', 'work', 'story');

const cmd = argv[0];
if (cmd === 'hear') {
  const audio = path.resolve(opt('audio', path.join(SONG, cfg.narration)));
  const r = hear(audio, fs.readFileSync(path.join(SONG, cfg.script), 'utf8'), { work });
  for (const m of r.byModel) console.log(`heard (${m.model}${m.exact ? ', exact' : ''}): ${m.transcript}`);
  if (r.exact) console.log('EXACT: every word of the script, in order, nothing added, by every model');
  else for (const d of r.diffs) console.log(`- ${d.op}: ${d.op === 'extra' ? `"${d.heard}"` : d.op === 'missing' ? `"${d.expected}"` : `"${d.expected}" heard as "${d.heard}"`} (word ${d.index + 1}; ${d.models.join(', ')})`);
  process.exit(r.exact ? 0 : 1);
} else if (cmd === 'prepare') {
  const r = prepare(SONG, film);
  console.log(`narration: ${r.lyrics.words.length} words in ${r.lyrics.lines.length} lines, ${r.lyrics.words[0].start.toFixed(2)}-${r.lyrics.words.at(-1).end.toFixed(2)} s; film ends at ${r.end} s`);
  for (const e of r.events) console.log(`  event ${e.id}: ${e.time == null ? 'NOT FOUND' : e.time.toFixed(2) + ' s'}${e.scene ? ` (scene ${e.scene})` : ''}  ${e.what ?? ''}`);
  for (const p of r.problems) console.log('-', p.detail);
  if (film.scenes?.length) buildMix(SONG, film, { force: true });
  else console.log('film.json has no scenes yet; the mix is built when it does (story.mjs mix, or the next film.mjs run)');
  process.exit(r.problems.length ? 1 : 0);
} else if (cmd === 'assemble') {
  try { assemble(SONG, film, { hearIt: !argv.includes('--no-hear') }); }
  catch (e) { console.error(e.message); process.exit(1); }
} else if (cmd === 'mix') {
  const r = buildMix(SONG, film, { force: true });
  console.log('wrote', r.mix);
} else {
  console.error('usage: node photoreal/story.mjs hear|assemble|prepare|mix --song <folder> [--audio take.wav]');
  process.exit(1);
}
