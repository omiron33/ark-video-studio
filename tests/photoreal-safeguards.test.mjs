import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runOnce, runWithWatchdog } from '../photoreal/lib/watchdog.mjs';
import { Progress, writeStatus } from '../photoreal/lib/progress.mjs';
import { parseStoryboard, validateStoryboard, draftStoryboard } from '../photoreal/lib/storyboard.mjs';
import { parseCritique, mergeLedger, openItems, buildPrompt } from '../photoreal/lib/critic.mjs';
import { stillStretches, deadStops, cutsOffBeat, wordContrast, luminance, collisions, findWord, wordChecks, summarize } from '../photoreal/lib/measure.mjs';
import { makeKeys } from '../photoreal/lib/keys.mjs';
import { pickKeyStills } from '../photoreal/lib/stills.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ark-safe-'));

// a fake render worker: writes `frames` heartbeats `ms` apart, then hangs if told to
function worker(dir, { frames, ms, hangAfter = -1, failTimes = 0 }) {
  const f = path.join(dir, 'worker.mjs'), count = path.join(dir, 'count');
  fs.writeFileSync(f, `import fs from 'node:fs';
const hb = process.argv[2];
let n = 0; try { n = +fs.readFileSync(${JSON.stringify(count)}, 'utf8'); } catch {}
fs.writeFileSync(${JSON.stringify(count)}, String(n + 1));
const hang = n < ${failTimes} ? ${hangAfter} : -1;
fs.writeFileSync(hb, JSON.stringify({ frame: 0, of: ${frames} }));
for (let k = 1; k <= ${frames}; k++) {
  if (k === hang) await new Promise(() => setInterval(() => {}, 1000));
  await new Promise((r) => setTimeout(r, ${ms}));
  fs.writeFileSync(hb, JSON.stringify({ frame: k, of: ${frames}, at: Date.now() }));
}`);
  return f;
}

test('watchdog lets a healthy worker finish', async () => {
  const d = tmp(), hb = path.join(d, 'hb.json');
  const r = await runOnce({ cmd: 'node', args: [worker(d, { frames: 5, ms: 20 }), hb], heartbeat: hb, stallSec: 2, firstFrameSec: 5, pollMs: 50 });
  assert.equal(r.ok, true);
  assert.equal(r.frames, 5);
});

test('watchdog kills a stalled worker, retries, and succeeds', async () => {
  const d = tmp(), hb = path.join(d, 'hb.json'), logs = [];
  const r = await runWithWatchdog({ cmd: 'node', args: [worker(d, { frames: 6, ms: 20, hangAfter: 3, failTimes: 1 }), hb], heartbeat: hb, stallSec: 0.5, firstFrameSec: 5, pollMs: 50, retries: 2, log: (m) => logs.push(m) });
  assert.equal(r.ok, true);
  assert.equal(r.attempts.length, 2);
  assert.match(logs.join('\n'), /stalled: no new frame/);
});

test('watchdog gives up after the retries and reports why', async () => {
  const d = tmp(), hb = path.join(d, 'hb.json');
  const r = await runWithWatchdog({ cmd: 'node', args: [worker(d, { frames: 6, ms: 20, hangAfter: 2, failTimes: 99 }), hb], heartbeat: hb, stallSec: 0.4, firstFrameSec: 5, pollMs: 50, retries: 2 });
  assert.equal(r.ok, false);
  assert.equal(r.attempts.length, 3);
  assert.match(r.reason, /stalled/);
});

test('watchdog catches a worker that never produces a first frame', async () => {
  const d = tmp(), hb = path.join(d, 'hb.json');
  const r = await runOnce({ cmd: 'node', args: [worker(d, { frames: 3, ms: 20, hangAfter: 1, failTimes: 9 }), hb], heartbeat: hb, stallSec: 5, firstFrameSec: 0.4, pollMs: 50 });
  assert.equal(r.ok, false);
  assert.match(r.reason, /no first frame/);
});

test('progress corrects its finish estimate from frames actually rendered', () => {
  const d = tmp(); let now = 0;
  const p = new Progress({ file: path.join(d, 'progress.json'), total: 3, cached: 1, now: () => now,
    jobs: [{ id: '01', scene: 'a', frames: 100, estMsPerFrame: 100 }, { id: '02', scene: 'b', frames: 100, estMsPerFrame: 100 }] });
  p.start('01'); now = 20000; p.frame('01', 100); p.finish('01', true);   // took twice the estimate
  const s = p.snapshot();
  assert.equal(s.estimateCorrection, 2);
  assert.equal(Date.parse(s.estimatedFinish) - now, 20000);
  assert.equal(s.scenesDone, 2);
  p.start('02'); p.finish('02', false, 'stalled');
  const s2 = JSON.parse(fs.readFileSync(path.join(d, 'progress.json'), 'utf8'));
  assert.equal(s2.state, 'blocked');
  assert.equal(s2.scenesFailed[0].reason, 'stalled');
  writeStatus(path.join(d, 'STATUS.md'), { song: '/x/genesis9', state: 'blocked', snapshot: s2, elapsed: 20 });
  assert.match(fs.readFileSync(path.join(d, 'STATUS.md'), 'utf8'), /Scene 02 \(b\): stalled/);
});

const lyrics = { lines: [{ text: 'God remembered Noe', start: 2, end: 4 }, { text: 'and every beast', start: 9, end: 11 }], words: [] };

test('storyboard: a complete table passes and yields the sound-off read', () => {
  const t = `| Time | On screen | What the moment is for | How it leaves | What carries into the next shot |
|---|---|---|---|---|
| 0:00.0–0:08.0 | Grey sea, the words rise | Remembrance | Crane up | The waterline |
| 0:08.0–0:12.0 | Ark small on the horizon | Scale | Cut on the beat | The gold line |`;
  const r = validateStoryboard(t, { duration: 12, lyrics });
  assert.equal(r.ok, true, r.errors.join('; '));
  assert.deepEqual(r.rows.map((x) => x.lyrics), [['God remembered Noe'], ['and every beast']]);
});

test('storyboard: gaps, TODOs, short coverage and stray lyrics fail', () => {
  const t = `| Time | On screen | What the moment is for | How it leaves | What carries into the next shot |
|---|---|---|---|---|
| 0:01.0–0:05.0 | TODO | x | x | x |
| 0:06.0–0:08.0 | a | b | c | |`;
  const r = validateStoryboard(t, { duration: 20, lyrics });
  assert.equal(r.ok, false);
  const all = r.errors.join('\n');
  for (const re of [/start at 0:00/, /gap/, /runs to/, /TODO/, /"What carries/, /and every beast/]) assert.match(all, re);
});

test('storyboard: the draft covers the song and is not yet valid', () => {
  const d = draftStoryboard({ title: 't', duration: 12, lyrics, scenes: [{ from: 0, to: 8 }, { from: 8, to: 12 }] });
  assert.equal(parseStoryboard(d).rows.length, 2);
  assert.match(d, /Lyric: “God remembered Noe”/);
  assert.equal(validateStoryboard(d, { duration: 12, lyrics }).ok, false);
});

test('critic: parses answers from both CLIs and records a ledger across rounds', () => {
  const a1 = JSON.stringify({ result: 'Here:\n```json\n{"verdict":"one more pass","problems":[{"rank":1,"time":"0:12.00","scene":"02","problem":"dove clipped","why":"reads as a glitch","fix":"move 80 px down"}],"ledger":[]}\n```' });
  const c1 = parseCritique(a1);
  assert.equal(c1.verdict, 'one more pass');
  let L = mergeLedger(null, { kind: 'film', round: 1, critique: c1, agent: 'claude', at: 'x' });
  assert.equal(openItems(L, 'film')[0].id, 'F1-1');
  assert.match(buildPrompt('film', { openItems: openItems(L, 'film') }), /F1-1 at 0:12.00 \(scene 02\): dove clipped/);
  const c2 = parseCritique('{"verdict":"Ship","problems":[],"ledger":[{"id":"F1-1","status":"partly fixed","note":"still touches the edge"}]}');
  assert.equal(c2.verdict, 'ship');
  L = mergeLedger(L, { kind: 'film', round: 2, critique: c2, agent: 'codex', at: 'y' });
  assert.equal(L.items[0].status, 'partly fixed');
  assert.equal(L.rounds.length, 2);
  assert.throws(() => parseCritique('no json here'));
});

test('measure: still stretches over 0.5 s are found, shorter holds are not', () => {
  const mad = [Infinity, ...Array(20).fill(5), ...Array(40).fill(0.1), ...Array(10).fill(5), ...Array(20).fill(0.1), 5];
  const s = stillStretches(mad, 60, { stillThreshold: 0.5, maxStillSeconds: 0.5 });
  assert.equal(s.length, 1);
  assert.equal(s[0].startFrame, 20);
  assert.equal(s[0].seconds, +(40 / 60).toFixed(3));
});

test('measure: a fast move into a dead stop is caught, but not at a cut', () => {
  const mad = [Infinity, ...Array(10).fill(1), ...Array(8).fill(20), ...Array(10).fill(0.1)];
  assert.equal(deadStops(mad, 60, { stillThreshold: 0.5 }).length, 1);
  assert.equal(deadStops(mad, 60, { stillThreshold: 0.5, cutFrames: [19] }).length, 0);
  const eased = [Infinity, ...Array(10).fill(1), 20, 20, 16, 12, 8, 5, 3, 2, 1, 0.8, 0.6, 0.4, 0.2, 0.1];
  assert.equal(deadStops(eased, 60, { stillThreshold: 0.5 }).length, 0);
});

test('measure: cuts must land on the beat or up to two frames before', () => {
  const sc = [{ id: '1', from: 0 }, { id: '2', from: 1.0 - 1 / 60 }, { id: '3', from: 2.05 }, { id: '4', from: 3.2, offBeat: 'follows the voice' }];
  const off = cutsOffBeat(sc, [1, 2, 3], 60);
  assert.deepEqual(off.map((o) => o.id), ['3']);
  assert.equal(off[0].offFrames, 3);
});

test('measure: contrast of light words on dark and on bright backgrounds', () => {
  const box = (ink, bg, inkShare = 0.25) => Array.from({ length: 400 }, (_, i) => (i < 400 * inkShare ? ink : bg));
  const good = wordContrast(box(luminance(245, 240, 230), luminance(20, 22, 30)));
  assert.ok(good.ratio > 10); assert.equal(good.ink, 'light');
  const bad = wordContrast(box(luminance(245, 240, 230), luminance(190, 190, 185)));
  assert.ok(bad.ratio < 4.5, String(bad.ratio));
});

test('measure: run-together, overlapping and crowded words', () => {
  const line = (words) => ({ text: words.map((w) => w.text).join(' '), box: { x: 0, y: 0.4, w: 0.6, h: 0.1 }, words });
  const frame = { lines: [line([{ text: 'everybeast', box: { x: 0.1, y: 0.4, w: 0.2, h: 0.1 } }, { text: 'and', box: { x: 0.28, y: 0.4, w: 0.1, h: 0.1 } }, { text: 'bird', box: { x: 0.382, y: 0.4, w: 0.1, h: 0.1 } }])] };
  const k = collisions(frame, ['and', 'every', 'beast', 'and', 'bird']).map((c) => c.kind);
  assert.deepEqual(k, ['run-together', 'overlap', 'tight']);
  assert.equal(findWord(frame, 'Bird,').box.x, 0.382);
});

test('measure: each word is checked once sung, within its line', () => {
  const ly = { lines: [{ text: 'a b', start: 1, end: 2 }], words: [{ w: 'a', start: 1, end: 1.3 }, { w: 'b', start: 1.5, end: 1.9 }] };
  const c = wordChecks(ly, 60, 10);
  assert.equal(c[0].f1, Math.round(1.45 * 60));
  assert.equal(c[1].f2 - c[1].f1, 8);
  assert.deepEqual(c[0].onScreen, ['a']);
  assert.equal(summarize([{ gate: 'x', severity: 'warn' }]).passed, true);
});

test('keys: a typography change touches only the lyric layer, never the picture', () => {
  const song = tmp();
  fs.mkdirSync(path.join(song, 'scenes')); fs.mkdirSync(path.join(song, 'lib')); fs.mkdirSync(path.join(song, 'data'));
  fs.writeFileSync(path.join(song, 'data', 'lyrics.json'), '{}');
  fs.writeFileSync(path.join(song, 'lib', 'sea.js'), 'export const SEA = 1;');
  fs.writeFileSync(path.join(song, 'lib', 'type.js'), 'export const FONT = 1;');
  fs.writeFileSync(path.join(song, 'scenes', 'a.js'), "import { SEA } from '/song/lib/sea.js';");
  fs.writeFileSync(path.join(song, 'scenes', 'a.lyric.js'), "import { FONT } from '/song/lib/type.js';");
  fs.writeFileSync(path.join(song, 'scenes', 'b.js'), "import { SEA } from '/song/lib/sea.js';");
  const s = { id: '1', scene: 'a', from: 0, to: 2 }, b = { id: '2', scene: 'b', from: 2, to: 4 };
  const k0 = makeKeys(song);
  const before = { plate: k0.plate(s, 60, 12), layer: k0.layer(s, 60, 8), baked: k0.plate(b, 60, 12) };
  assert.equal(k0.layer(b, 60, 8), null);
  fs.writeFileSync(path.join(song, 'lib', 'type.js'), 'export const FONT = 2;');
  const k1 = makeKeys(song);
  assert.equal(k1.plate(s, 60, 12), before.plate);
  assert.notEqual(k1.layer(s, 60, 8), before.layer);
  assert.equal(k1.plate(b, 60, 12), before.baked);
  fs.writeFileSync(path.join(song, 'lib', 'sea.js'), 'export const SEA = 2;');
  const k2 = makeKeys(song);
  assert.notEqual(k2.plate(s, 60, 12), before.plate);
  assert.notEqual(k2.plate(b, 60, 12), before.baked);
});

test('key stills: opening, main, both sides of the fastest cut, a lyric hold and the ending', () => {
  const sc = [{ id: '1', from: 0, to: 10 }, { id: '2', from: 10, to: 30 }, { id: '3', from: 30, to: 40 }];
  const pr = [{ id: '1', inSpeed: 0, outSpeed: 0.1 }, { id: '2', inSpeed: 0.1, outSpeed: 2 }, { id: '3', inSpeed: 1, outSpeed: 0 }];
  const p = pickKeyStills(sc, lyrics, pr, 60);
  assert.deepEqual(p.map((x) => x.name), ['1-opening', '2-main', '3a-cut-out', '3b-cut-in', '4-lyric-hold', '5-ending']);
  assert.equal(p[2].sceneId, '2'); assert.equal(p[3].sceneId, '3');
  assert.equal(p[1].sceneId, '2');
});

test('keys: do not depend on where the engine is checked out, and old keys carry over', () => {
  const song = tmp();
  fs.mkdirSync(path.join(song, 'scenes')); fs.mkdirSync(path.join(song, 'data'));
  fs.writeFileSync(path.join(song, 'data', 'lyrics.json'), '{}');
  fs.writeFileSync(path.join(song, 'scenes', 'a.js'), 'export default {}');
  const webA = path.join(tmp(), 'photoreal', 'web'), webB = path.join(tmp(), 'elsewhere', 'photoreal', 'web');
  for (const w of [webA, webB]) { fs.mkdirSync(w, { recursive: true }); fs.writeFileSync(path.join(w, 'engine.js'), 'x'); }
  const s = { id: '1', scene: 'a', from: 0, to: 1 };
  assert.equal(makeKeys(song, { web: webA }).plate(s, 60, 8), makeKeys(song, { web: webB }).plate(s, 60, 8));
  // what the old code wrote from webA is recognised by an engine now living at webB
  const oldKey = makeKeys(song, { web: webB }).legacyPlate(s, 60, 8, webA);
  assert.notEqual(oldKey, makeKeys(song, { web: webB }).plate(s, 60, 8));
  assert.equal(makeKeys(song, { web: webA }).legacyPlate(s, 60, 8), oldKey);
});

test('keys: song-wide lyric settings in film.json re-render only lyric layers', () => {
  const song = tmp();
  fs.mkdirSync(path.join(song, 'scenes')); fs.mkdirSync(path.join(song, 'data'));
  fs.writeFileSync(path.join(song, 'scenes', 'a.js'), 'export default {}');
  fs.writeFileSync(path.join(song, 'scenes', 'a.lyric.js'), 'export default {}');
  fs.writeFileSync(path.join(song, 'film.json'), '{"scenes":[]}');
  const s = { id: '1', scene: 'a', from: 0, to: 1 };
  const k0 = makeKeys(song);
  fs.writeFileSync(path.join(song, 'film.json'), '{"scenes":[],"lyric":{"haloSpread":4.5}}');
  const k1 = makeKeys(song);
  assert.equal(k1.plate(s, 60, 8), k0.plate(s, 60, 8));
  assert.notEqual(k1.layer(s, 60, 8), k0.layer(s, 60, 8));
});

test('measure: shots split at the film cuts and at hard cuts inside a scene', async () => {
  const { shots } = await import('../photoreal/lib/measure.mjs');
  const mad = [Infinity, ...Array(119).fill(1)];
  mad[60] = 40;                                   // a hard cut inside the scene
  const s = shots(mad, 60, [90]);
  assert.deepEqual(s.map((x) => x.seconds), [1, 0.5, 0.5]);
});

test('keys: premium scenes alone depend on web/premium, so it never re-renders an existing film', () => {
  const song = tmp(), web = path.join(tmp(), 'web');
  fs.mkdirSync(path.join(song, 'scenes'), { recursive: true }); fs.mkdirSync(path.join(web, 'premium'), { recursive: true });
  fs.writeFileSync(path.join(web, 'engine.js'), 'x');
  fs.writeFileSync(path.join(song, 'scenes', 'old.js'), 'export default {}');
  fs.writeFileSync(path.join(song, 'scenes', 'cup.js'), "export const kind = 'three';\nexport default {}");
  const old = { id: '1', scene: 'old', from: 0, to: 1 }, cup = { id: '2', scene: 'cup', from: 1, to: 2 };
  const k0 = makeKeys(song, { web });
  fs.writeFileSync(path.join(web, 'premium', 'engine.js'), 'premium v2');
  const k1 = makeKeys(song, { web });
  assert.equal(k1.plate(old, 60, 8), k0.plate(old, 60, 8));
  assert.notEqual(k1.plate(cup, 60, 8), k0.plate(cup, 60, 8));
  assert.equal(k1.isPremium('cup'), true); assert.equal(k1.isPremium('old'), false);
  // transition handles widen only the scenes that have them
  assert.notEqual(k1.plate({ ...old, handles: [0.25, 0] }, 60, 8), k1.plate(old, 60, 8));
});
