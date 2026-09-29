// Run the fresh critic on a storyboard, the key stills or the finished film.
//   node photoreal/critic.mjs storyboard --song ../genesis9 --agent claude
//   node photoreal/critic.mjs stills     --song ../genesis9 --agent codex
//   node photoreal/critic.mjs film       --song ../genesis9 [--video out/film.mp4] --agent claude
//   options: --model <name>   --pack-only (build the evidence folder and prompt, run nothing)
//            --answer <file>  (record a critique written elsewhere, e.g. by a person or another tool)
// The critic runs as a brand-new process whose working folder is the evidence folder alone, so it
// cannot see the scene code or anything said while building. ARK_CRITIC_CMD overrides the agent:
// a shell command that receives the prompt file as $ARK_CRITIC_PROMPT, runs in the evidence folder
// and prints the answer.
// Results: out/review/<kind>-review.json (what the render gates read), out/review/ledger.json and
// ledger.md (every problem across rounds and whether it was fixed).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { buildPrompt, parseCritique, mergeLedger, openItems, ledgerMarkdown, KINDS } from './lib/critic.mjs';
import { validateStoryboard, storyboardPath, fmtTime } from './lib/storyboard.mjs';

const argv = process.argv.slice(2);
const kind = argv[0];
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
if (!KINDS.includes(kind)) { console.error(`usage: node photoreal/critic.mjs ${KINDS.join('|')} --song <folder> --agent claude|codex`); process.exit(1); }
const SONG = path.resolve(opt('song', '.'));
const REVIEW = path.join(SONG, 'out', 'review');
const read = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const shaFile = (f) => { const h = crypto.createHash('sha256'); const fd = fs.openSync(f, 'r'); const b = Buffer.alloc(1 << 22); let n; while ((n = fs.readSync(fd, b, 0, b.length)) > 0) h.update(b.subarray(0, n)); fs.closeSync(fd); return h.digest('hex'); };
const lyrics = read(path.join(SONG, 'data', 'lyrics.json')) ?? { lines: [], words: [] };
const film = read(path.join(SONG, 'film.json'));
const fps = film?.fps ?? 60;
const ledgerFile = path.join(REVIEW, 'ledger.json');
const ledger = read(ledgerFile);
const round = 1 + (ledger?.rounds ?? []).filter((r) => r.kind === kind).length;
const pack = path.join(REVIEW, 'critic', `${kind}-round-${round}`);
fs.rmSync(pack, { recursive: true, force: true });
fs.mkdirSync(pack, { recursive: true });
const ff = (args) => { const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' }); if (r.status !== 0) throw Error('ffmpeg failed: ' + args.join(' ')); };

// ---------- evidence ----------
fs.writeFileSync(path.join(pack, 'lyrics.txt'), lyrics.lines.map((l) => `${fmtTime(l.start)}  ${l.text}`).join('\n') + '\n');
const sb = storyboardPath(SONG);
const images = [];
const binding = {};
if (fs.existsSync(sb)) fs.copyFileSync(sb, path.join(pack, 'STORYBOARD.md'));

if (kind === 'storyboard') {
  if (!fs.existsSync(sb)) { console.error(`no storyboard at ${sb}; run node photoreal/storyboard.mjs draft`); process.exit(1); }
  const text = fs.readFileSync(sb, 'utf8');
  const v = validateStoryboard(text, { duration: read(path.join(SONG, 'data', 'audio.json'))?.duration ?? film?.scenes?.at(-1)?.to, lyrics });
  if (!v.ok) { for (const e of v.errors) console.log('-', e); console.error('fix the storyboard (node photoreal/storyboard.mjs check) before the critic reads it'); process.exit(1); }
  fs.writeFileSync(path.join(pack, 'sound-off.txt'), v.rows.map((r) => `${r.time}\n  on screen: ${r.screen}\n  words: ${r.lyrics.length ? r.lyrics.join(' / ') : '(no singing)'}`).join('\n\n') + '\n');
  binding.storyboardSha = sha(fs.readFileSync(sb));
} else if (kind === 'stills') {
  const dir = path.join(SONG, 'out', 'keystills');
  const st = read(path.join(dir, 'stills.json'));
  if (!st) { console.error('no key stills; run node photoreal/film.mjs --stills first'); process.exit(1); }
  for (const s of st.stills) { const f = path.basename(s.file); fs.copyFileSync(path.join(SONG, s.file), path.join(pack, f)); images.push(f); }
  fs.writeFileSync(path.join(pack, 'stills.json'), JSON.stringify(st.stills.map((s) => ({ file: path.basename(s.file), time: fmtTime(s.time), frame: Math.round(s.time * fps), scene: s.sceneId, what: s.why })), null, 1) + '\n');
  binding.stillsSha = sha(JSON.stringify(st));
} else {
  const video = path.resolve(SONG, opt('video', 'out/film.mp4'));
  if (!fs.existsSync(video)) { console.error(`no film at ${video}`); process.exit(1); }
  const dur = +spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video], { encoding: 'utf8' }).stdout.trim();
  const every = Math.max(2, Math.ceil(dur / 90));   // at most about 90 tiles
  const n = Math.ceil(dur / every), cols = 8, rows = Math.ceil(n / cols);
  ff(['-i', video, '-vf', `fps=1/${every},scale=400:-2,tile=${cols}x${rows}:padding=4`, '-frames:v', '1', '-q:v', '3', path.join(pack, 'contact.jpg')]);
  images.push('contact.jpg');
  fs.writeFileSync(path.join(pack, 'contact.json'), JSON.stringify({ secondsPerTile: every, columns: cols, note: 'tile k (left to right, top to bottom, from 0) is at k * secondsPerTile' }) + '\n');
  const tdir = path.join(pack, 'transitions'); fs.mkdirSync(tdir);
  const offs = [-12, -6, -2, -1, 0, 1, 2, 6, 12];
  const cuts = (film?.scenes ?? []).slice(1).map((s) => ({ id: s.id, t: s.from }));
  const tjson = [];
  for (const c of cuts) {
    const f0 = Math.round(c.t * fps), a = Math.max(0, f0 - 12);
    const sel = offs.map((o) => `eq(n\\,${f0 + o - a})`).join('+');
    const f = `cut-${c.id}.jpg`;
    ff(['-ss', String(a / fps), '-i', video, '-frames:v', '1', '-vf', `select='${sel}',scale=384:-2,tile=${offs.length}x1:padding=3`, '-fps_mode', 'passthrough', '-q:v', '3', path.join(tdir, f)]);
    images.push(`transitions/${f}`);
    tjson.push({ file: `transitions/${f}`, intoScene: c.id, cut: fmtTime(c.t), cutFrame: f0, offsets: offs });
  }
  fs.writeFileSync(path.join(pack, 'transitions.json'), JSON.stringify(tjson, null, 1) + '\n');
  const chk = read(path.join(REVIEW, 'check-final.json'));
  if (chk) fs.writeFileSync(path.join(pack, 'check.json'), JSON.stringify({ summary: chk.summary, problems: chk.problems.slice(0, 80) }, null, 1) + '\n');
  binding.videoSha = shaFile(video);
}

const prompt = buildPrompt(kind, { openItems: openItems(ledger, kind) });
fs.writeFileSync(path.join(pack, 'PROMPT.md'), prompt + '\n');
console.log(`evidence and prompt in ${pack}`);
if (argv.includes('--pack-only')) process.exit(0);

// ---------- run the critic ----------
let answer, agent;
if (opt('answer')) { answer = fs.readFileSync(path.resolve(opt('answer')), 'utf8'); agent = opt('agent', 'external'); }
else {
  agent = process.env.ARK_CRITIC_CMD ? 'custom' : opt('agent', 'claude');
  const task = 'Read PROMPT.md in this folder and do exactly what it asks, using only the files in this folder. Answer with the JSON object only.';
  let r;
  if (agent === 'custom') r = spawnSync('sh', ['-c', process.env.ARK_CRITIC_CMD], { cwd: pack, encoding: 'utf8', env: { ...process.env, ARK_CRITIC_PROMPT: path.join(pack, 'PROMPT.md') }, maxBuffer: 64 << 20 });
  else if (agent === 'claude') r = spawnSync('claude', ['-p', task, '--output-format', 'json', '--allowedTools', 'Read,Glob,LS', '--no-session-persistence', '--setting-sources', '', ...(opt('model') ? ['--model', opt('model')] : [])],
    { cwd: pack, encoding: 'utf8', maxBuffer: 64 << 20, timeout: 45 * 60000 });
  else if (agent === 'codex') {
    const last = path.join(pack, '.answer.txt');
    r = spawnSync('codex', ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', '-C', pack, '-o', last, ...(opt('model') ? ['-m', opt('model')] : []), ...images.slice(0, 40).flatMap((f) => ['-i', f]), task],
      { cwd: pack, encoding: 'utf8', maxBuffer: 64 << 20, timeout: 45 * 60000 });
    if (fs.existsSync(last)) r.stdout = fs.readFileSync(last, 'utf8');
  } else { console.error(`unknown agent ${agent}; use claude, codex or ARK_CRITIC_CMD`); process.exit(1); }
  if (r.status !== 0 && !r.stdout) { console.error(`the critic (${agent}) failed: ${r.error?.message ?? r.stderr?.slice(-2000)}`); process.exit(1); }
  answer = r.stdout;
}
fs.writeFileSync(path.join(pack, 'answer.txt'), answer);
let critique;
try { critique = parseCritique(answer); } catch (e) { console.error(`${e.message}; the raw answer is in ${path.join(pack, 'answer.txt')}`); process.exit(1); }

// measured failures are hard gates: the critic cannot ship over them
if (kind === 'film') {
  const chk = read(path.join(REVIEW, 'check-final.json'));
  if (!chk || chk.videoSha !== binding.videoSha) { critique.verdict = 'one more pass'; critique.gateNote = 'no measured check of this exact film (run node photoreal/check.mjs --label final)'; }
  else if (!chk.summary.passed) { critique.verdict = 'one more pass'; critique.gateNote = `the measured check failed ${chk.summary.fails} times`; }
}

const at = new Date().toISOString();
const L = mergeLedger(ledger, { kind, round, critique, agent, at });
fs.writeFileSync(ledgerFile, JSON.stringify(L, null, 1) + '\n');
fs.writeFileSync(path.join(REVIEW, 'ledger.md'), ledgerMarkdown(L));
fs.writeFileSync(path.join(REVIEW, `${kind}-review.json`), JSON.stringify({ kind, round, agent, at, ...binding, ...critique }, null, 1) + '\n');

console.log(`\n${kind} round ${round} (${agent}): ${critique.verdict.toUpperCase()}${critique.gateNote ? ` (${critique.gateNote})` : ''}`);
if (critique.summary) console.log(critique.summary);
for (const p of critique.problems) console.log(`${p.rank}. ${p.time ?? ''}${p.scene ? ` [${p.scene}]` : ''} ${p.problem}\n   fix: ${p.fix}`);
for (const l of critique.ledger) console.log(`   ${l.id}: ${l.status}${l.note ? ` (${l.note})` : ''}`);
if (critique.soundOff) console.log(`\nsound off: ${critique.soundOff}`);
process.exit(critique.verdict === 'ship' ? 0 : 3);
