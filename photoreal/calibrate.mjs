// Calibrate the fresh critic to Shane's own verdicts (method in lib/calibrate.mjs).
//   node photoreal/calibrate.mjs list
//   node photoreal/calibrate.mjs record --film "Genesis 5 ultra" --verdict accept [--rank 2] [--song genesis5] [--video out/film.mp4] [--note "..."]
//   node photoreal/calibrate.mjs run --songs /Volumes/DATA/songs [--agent claude|codex] [--only "Genesis 5 ultra,..."]
//
// photoreal/calibration/verdicts.jsonl is the log: one line per film he has judged, with his verdict
// (accept or reject), his rank among the films he compared (1 = best) when he gave one, the song
// folder and the cut he judged. Record a verdict the day he gives it, in his words in "note".
// `run` has the critic score every logged film it can find, blind (critic.mjs film --blind: no
// ledger, no earlier problems, never his verdict), checks its ranking against his and sets the bar
// in photoreal/calibration/calibration.json, which critic.mjs then applies to every film review.
// Commit both files: the calibration belongs to the rubric it was measured with, and goes stale
// (critic.mjs says so) when the rubric's wording changes. Re-run after every ten new verdicts.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { calibrate } from './lib/calibrate.mjs';
import { rubric } from './lib/critic.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(HERE, 'calibration');
const LOG = path.join(DIR, 'verdicts.jsonl'), OUT = path.join(DIR, 'calibration.json');
const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const readLog = () => (fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : []);
const writeLog = (rows) => fs.writeFileSync(LOG, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

if (cmd === 'list') {
  const rows = readLog();
  for (const r of rows) console.log(`${r.verdict === 'accept' ? 'accept' : 'reject'}  ${r.film}${r.rank ? ` (rank ${r.rank})` : ''}  ${r.song ? `${r.song}/${r.video ?? 'out/film.mp4'}` : '(no film recorded yet)'}  ${r.when ?? ''}  ${r.note ?? ''}`);
  const cal = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  console.log(cal ? `\ncalibration ${cal.at}: bar ${cal.threshold ?? 'none'}, AUC ${cal.auc ?? '-'}, tau ${cal.tau ?? '-'}, agrees on ${cal.agreement}${cal.problems.length ? `\n  ${cal.problems.join('\n  ')}` : ''}` : '\nnot calibrated yet');
} else if (cmd === 'record') {
  const film = opt('film'), verdict = opt('verdict');
  if (!film || !['accept', 'reject'].includes(verdict)) { console.error('record needs --film "<name>" and --verdict accept|reject'); process.exit(1); }
  const rows = readLog();
  const row = rows.find((r) => r.film === film) ?? (rows.push({ film }), rows.at(-1));
  Object.assign(row, { verdict, when: opt('when', new Date().toISOString().slice(0, 10)) });
  for (const k of ['song', 'video', 'note']) if (opt(k)) row[k] = opt(k);
  if (opt('rank')) row.rank = +opt('rank');
  fs.mkdirSync(DIR, { recursive: true });
  writeLog(rows);
  console.log(`recorded: ${verdict} ${film}`);
} else if (cmd === 'run') {
  const songs = opt('songs');
  if (!songs) { console.error('run needs --songs <the folder the song folders are in>'); process.exit(1); }
  const only = opt('only')?.split(',');
  const rubricSha = crypto.createHash('sha256').update(rubric('film', false)).digest('hex');
  const rows = [];
  for (const r of readLog().filter((x) => !only || only.includes(x.film))) {
    if (!r.song) { console.log(`skip ${r.film}: no song folder recorded (calibrate.mjs record --film "${r.film}" --verdict ${r.verdict} --song <folder>)`); continue; }
    const song = path.resolve(songs, r.song), video = r.video ?? 'out/film.mp4';
    if (!fs.existsSync(path.resolve(song, video))) { console.log(`skip ${r.film}: no ${path.join(song, video)}`); continue; }
    const res = path.join(DIR, '.work', `${r.song}.json`);
    fs.mkdirSync(path.dirname(res), { recursive: true });
    console.log(`\nscoring ${r.film} blind`);
    const p = spawnSync('node', [path.join(HERE, 'critic.mjs'), 'film', '--song', song, '--video', video, '--blind', '--result', res, '--agent', opt('agent', 'claude'), ...(opt('model') ? ['--model', opt('model')] : [])], { stdio: 'inherit' });
    if (p.status !== 0 || !fs.existsSync(res)) { console.log(`  the critic failed on ${r.film}; left out`); continue; }
    const out = JSON.parse(fs.readFileSync(res, 'utf8'));
    rows.push({ film: r.film, verdict: r.verdict, rank: r.rank, score: out.score, blocking: out.blocking });
  }
  const cal = calibrate(rows, { rubricSha });
  fs.writeFileSync(OUT, JSON.stringify(cal, null, 1) + '\n');
  fs.rmSync(path.join(DIR, '.work'), { recursive: true, force: true });
  console.log(`\nthe critic agrees with Shane on ${cal.agreement}; bar ${cal.threshold ?? 'none'} (AUC ${cal.auc ?? '-'}, tau ${cal.tau ?? '-'})`);
  for (const p of cal.problems) console.log(`- ${p}`);
  console.log(`wrote ${OUT}; commit it with the verdicts`);
} else {
  console.error('usage: node photoreal/calibrate.mjs list | record --film F --verdict accept|reject [...] | run --songs DIR');
  process.exit(1);
}
