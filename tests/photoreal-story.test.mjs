import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  isStory, storyConfig, diffWords, tokens, scriptLines, narrationLyrics, findPhrase, resolveEvents, onScreenLyrics,
  speechSpans, duckGain, voiceOverMusic, bestLag, cutsInsideWords, eventProblems, combineHearing, takesPlan,
} from '../photoreal/lib/story.mjs';
import { buildMix, mixPaths, decode, writeWav, RATE, assemble } from '../photoreal/lib/story-audio.mjs';
import { validateStoryboard } from '../photoreal/lib/storyboard.mjs';
import { buildPrompt } from '../photoreal/lib/critic.mjs';
import { makeKeys } from '../photoreal/lib/keys.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ark-story-'));
const SCRIPT = 'Then they took away the stone.\nAnd he cried with a loud voice, Lazarus, come forth.\nAnd he that was dead came forth, bound with graveclothes.';
// aligned words as align.py returns them (narration time, script order)
const aligned = () => {
  let t = 0.2;
  return tokens(SCRIPT.replace(/\n/g, ' ')).map((w) => { const a = { text: w.replace(/[.,]/g, ''), start: t, end: t + 0.3 }; t += 0.4; return a; });
};

test('a film without "mode": "story" is a lyric film', () => {
  assert.equal(isStory({ scenes: [] }), false);
  assert.equal(isStory({ mode: 'story' }), true);
});

test('story config names what is missing', () => {
  const c = storyConfig({ mode: 'story', story: { events: [{ id: 'x' }] } });
  assert.equal(c.errors.length, 3);
  assert.match(c.errors.join('\n'), /script/);
  assert.match(c.errors.join('\n'), /cue/);
  assert.equal(storyConfig({ story: { script: 's', narration: 'n' } }).errors.length, 0);
});

test('spoken text: exact reading passes; punctuation and case do not count', () => {
  assert.deepEqual(diffWords(tokens('Lazarus, come forth.'), ['lazarus', 'Come', 'forth!']), []);
});

test('spoken text: a changed, dropped or added word is reported', () => {
  const d = diffWords(tokens('Father, I thank thee that thou hast heard me.'), tokens('Father I thank you that thou hast me'));
  assert.deepEqual(d.map((x) => x.op), ['substituted', 'missing']);
  assert.equal(d[0].expected, 'thee');
  assert.equal(d[0].heard, 'you');
  assert.equal(d[1].expected, 'heard');
  assert.deepEqual(diffWords(tokens('Loose him, and let him go.'), tokens('Loose him and let him go now')).map((x) => [x.op, x.heard]), [['extra', 'now']]);
});

test('spoken text: a small number written as a digit is the same word', () => {
  assert.deepEqual(diffWords(tokens('One day passed. Two. Three. Four.'), tokens('One day passed, 2, 3, 4.')), []);
});

test('spoken text: a compound heard as two words (or two as one) is the same text', () => {
  assert.deepEqual(diffWords(tokens('bound with graveclothes'), tokens('bound with grave clothes')), []);
  assert.deepEqual(diffWords(tokens('came forth any more'), tokens('came forth anymore')), []);
});

test('narration lyrics: script lines with measured words in film time', () => {
  const L = narrationLyrics(SCRIPT, aligned(), { at: 2 });
  assert.equal(L.lines.length, 3);
  assert.equal(L.lines[1].text, 'And he cried with a loud voice, Lazarus, come forth.');
  assert.equal(L.words[0].w, 'Then');
  assert.equal(L.words[0].start, 2.2);
  assert.equal(L.lines[0].end, L.words[5].end);
  assert.equal(scriptLines(SCRIPT).length, 3);
});

test('narration lyrics refuse an alignment that does not match the script', () => {
  const a = aligned(); a[3].text = 'rock';
  assert.throws(() => narrationLyrics(SCRIPT, a), /script says "away"/);
  assert.throws(() => narrationLyrics(SCRIPT, aligned().slice(1)), /has \d+ words but the script has/);
});

test('events resolve to the spoken cue, in story order, with repeated phrases taken in turn', () => {
  const L = narrationLyrics(SCRIPT, aligned());
  assert.equal(findPhrase(L.words, 'came forth'), 21);
  const { events, problems } = resolveEvents([
    { id: 'stone', cue: 'took away the stone' },
    { id: 'command', cue: 'Lazarus, come forth', offset: 0.1 },
    { id: 'forth', cue: 'came forth' },
    { id: 'quiet', at: 9.5 },
    { id: 'nope', cue: 'rolled the rock' },
  ], L);
  assert.equal(events[0].time, L.words[2].start);
  assert.equal(events[1].time, +(L.words[13].start + 0.1).toFixed(3));
  assert.equal(events[2].time, L.words[21].start);
  assert.equal(events[3].time, 9.5);
  assert.equal(problems.length, 1);
  assert.match(problems[0].detail, /rolled the rock/);
});

test('only the on-screen phrases reach the text gates', () => {
  const L = narrationLyrics(SCRIPT, aligned());
  const o = onScreenLyrics(['Lazarus, come forth', 'not said'], L);
  assert.deepEqual(o.words.map((w) => w.w), ['Lazarus,', 'come', 'forth.']);
  assert.equal(o.lines[0].start, o.words[0].start);
  assert.deepEqual(o.missing, ['not said']);
});

test('music ducks under speech, is down before the first syllable and recovers after', () => {
  const spans = speechSpans([{ start: 2, end: 2.4 }, { start: 2.5, end: 3 }, { start: 6, end: 7 }]);
  assert.deepEqual(spans, [{ start: 2, end: 3 }, { start: 6, end: 7 }]);
  const o = { musicGainDb: -10, duckDb: 12, duckAttack: 0.1, duckRelease: 0.5 };
  const dB = (t) => 20 * Math.log10(duckGain(t, spans, o));
  assert.ok(Math.abs(dB(1) + 10) < 1e-6);
  assert.ok(Math.abs(dB(2) + 22) < 1e-6);
  assert.ok(Math.abs(dB(2.7) + 22) < 1e-6);
  assert.ok(dB(3.25) > -22 && dB(3.25) < -10);
  assert.ok(Math.abs(dB(4) + 10) < 1e-6);
  assert.ok(duckGain(9.5, spans, { ...o, fadeOutFrom: 9, end: 10 }) < duckGain(9, spans, o));
});

test('voice over music: a word the music masks is reported', () => {
  const rate = 1000, n = 3000;
  const voice = new Float32Array(n), music = new Float32Array(n);
  for (let i = 0; i < n; i++) { voice[i] = 0.5 * Math.sin(i); music[i] = (i < 2000 ? 0.05 : 0.4) * Math.sin(i * 0.3); }
  const r = voiceOverMusic(voice, music, rate, [{ w: 'quiet', start: 0.5, end: 1 }, { w: 'masked', start: 2.2, end: 2.8 }], 12);
  assert.deepEqual(r.low.map((x) => x.word), ['masked']);
});

test('audio sync finds a delay between two copies of the same sound', () => {
  const rate = 8000, n = rate * 3, a = new Float32Array(n), b = new Float32Array(n);
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5;
  for (let i = 0; i < n; i++) a[i] = rnd() * (Math.sin(i / 900) > 0 ? 1 : 0.1);
  const d = Math.round(0.03 * rate);
  for (let i = d; i < n; i++) b[i] = a[i - d];
  const r = bestLag(a, b, rate);
  assert.ok(Math.abs(r.lagMs - 30) <= 1, `lag ${r.lagMs}`);
  assert.ok(r.correlation > 0.9);
});

test('cuts inside spoken words are caught; a scene can say why it means it', () => {
  const words = [{ w: 'Lazarus', start: 10, end: 10.6 }, { w: 'come', start: 10.8, end: 11 }];
  const scenes = [{ id: '1', from: 0, to: 10.3 }, { id: '2', from: 10.3, to: 10.7 }, { id: '3', from: 10.7, to: 20 }];
  assert.deepEqual(cutsInsideWords(scenes, words).map((c) => c.id), ['2']);
  scenes[1].midWord = 'the voice breaks across the cut';
  assert.deepEqual(cutsInsideWords(scenes, words), []);
});

test('each story beat must fall in the scene that claims it, in story order', () => {
  const scenes = [{ id: '01', from: 0, to: 5 }, { id: '02', from: 5, to: 9 }, { id: '03', from: 9, to: 12 }];
  assert.deepEqual(eventProblems([{ id: 'a', time: 1, scene: '01' }, { id: 'b', time: 6, scene: '02' }], scenes), []);
  const p = eventProblems([{ id: 'a', time: 6, scene: '01' }, { id: 'b', time: 2, scene: '09' }], scenes);
  assert.equal(p.length, 3);
  assert.match(p.map((x) => x.detail).join('\n'), /not in scene 01/);
  assert.match(p.map((x) => x.detail).join('\n'), /scene 09, which film.json does not have/);
  assert.match(p.map((x) => x.detail).join('\n'), /before the previous event/);
});

test('the storyboard must place every story beat in a row', () => {
  const sb = ['| Time | On screen | What the moment is for | How it leaves | What carries into the next shot |', '|---|---|---|---|---|',
    '| 0:00.0–0:05.0 | stone | open | cut | light |', '| 0:05.0–0:10.0 | tomb | climax | fade | cloth |'].join('\n');
  const ok = validateStoryboard(sb, { duration: 10, lyrics: { lines: [] }, events: [{ id: 'stone', time: 2 }, { id: 'forth', time: 7 }] });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.rows[1].events.map((e) => e.id), ['forth']);
  assert.equal(validateStoryboard(sb, { duration: 10, lyrics: { lines: [] }, events: [{ id: 'late', time: 12 }] }).ok, false);
});

test('the critic is told it is judging a narrated story, not a lyric film', () => {
  assert.match(buildPrompt('film', { story: true }), /narrated film/);
  assert.match(buildPrompt('storyboard', { story: true }), /beats\.txt/);
  assert.doesNotMatch(buildPrompt('film', {}), /narrated/);
});

test('a lyric film keeps its cache keys when the engine learns story mode', () => {
  const d = tmp();
  fs.mkdirSync(path.join(d, 'scenes')); fs.mkdirSync(path.join(d, 'data'));
  fs.writeFileSync(path.join(d, 'scenes', 'a.js'), 'export default {}');
  fs.writeFileSync(path.join(d, 'data', 'lyrics.json'), '{"lines":[],"words":[]}');
  const s = { id: '01', scene: 'a', from: 0, to: 2 };
  const before = makeKeys(d).plate(s, 60, 8);
  // story.json only exists in story films, and changing it re-renders their scenes
  fs.writeFileSync(path.join(d, 'data', 'story.json'), '{"events":[]}');
  const withStory = makeKeys(d).plate(s, 60, 8);
  assert.notEqual(before, withStory);
  fs.rmSync(path.join(d, 'data', 'story.json'));
  assert.equal(makeKeys(d).plate(s, 60, 8), before);
});

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
test('the mix keeps the voice untouched, ducks the music under it and caches until an input changes', { skip: !hasFfmpeg && 'needs ffmpeg' }, () => {
  const d = tmp();
  fs.mkdirSync(path.join(d, 'media')); fs.mkdirSync(path.join(d, 'data'));
  const sec = (n) => Math.round(n * RATE);
  // a voice: a 220 Hz tone from 0.5 to 1.5 s of the narration file
  const v = new Float32Array(sec(2));
  for (let i = sec(0.5); i < sec(1.5); i++) v[i] = 0.3 * Math.sin(2 * Math.PI * 220 * i / RATE);
  writeWav(path.join(d, 'media', 'narration.wav'), v, 1);
  const m = new Float32Array(sec(4) * 2);
  for (let i = 0; i < sec(4); i++) m[2 * i] = m[2 * i + 1] = 0.5 * Math.sin(2 * Math.PI * 55 * i / RATE);
  writeWav(path.join(d, 'media', 'score.wav'), m, 2);
  fs.writeFileSync(path.join(d, 'data', 'lyrics.json'), JSON.stringify({ lines: [], words: [{ w: 'voice', start: 1.5, end: 2.5 }] }));
  fs.writeFileSync(path.join(d, 'data', 'story.json'), JSON.stringify({ end: 4, events: [] }));
  const film = { mode: 'story', scenes: [{ id: '01', from: 0, to: 4 }], story: { script: 'x', narration: 'media/narration.wav', narrationAt: 1, music: 'media/score.wav', musicGainDb: -6, duckDb: 18, musicFadeOut: 0.5 } };
  const r = buildMix(d, film, { log: () => {} });
  assert.equal(r.cached, false);
  const P = mixPaths(d);
  const voice = decode(P.voice, { rate: 8000 }), music = decode(P.music, { rate: 8000 });
  assert.equal(voice.length, 4 * 8000);
  const level = (x, a, b) => { let s = 0; for (let i = a * 8000; i < b * 8000; i++) s += x[i] * x[i]; return 10 * Math.log10(s / ((b - a) * 8000)); };
  assert.ok(level(voice, 1.6, 2.4) > -15, 'voice placed at narrationAt + 0.5');
  assert.ok(level(voice, 0.1, 1.4) < -80, 'silent before the voice');
  const ducked = level(music, 1.7, 2.3), open = level(music, 0.2, 1.2);
  assert.ok(Math.abs(open - ducked - 18) < 1.5, `ducked by ${open - ducked} dB`);
  assert.equal(buildMix(d, film, { log: () => {} }).cached, true);
  film.story.duckDb = 10;
  assert.equal(buildMix(d, film, { log: () => {} }).cached, false);
});

test('listening with two models: exact only when both hear the script; a slip names the model that heard it', () => {
  const both = combineHearing('Loose him, and let him go.', [{ model: 'small.en', transcript: 'Loose him and let him go.' }, { model: 'medium.en', transcript: 'Loose him, and let him go' }]);
  assert.equal(both.exact, true);
  const one = combineHearing('Loose him, and let him go.', [{ model: 'small.en', transcript: 'Loose him and let him go. Thank you.' }, { model: 'medium.en', transcript: 'Loose him, and let him go.' }]);
  assert.equal(one.exact, false);
  assert.deepEqual(one.diffs.map((d) => [d.op, d.heard, d.models]), [['extra', 'thank', ['small.en']], ['extra', 'you', ['small.en']]]);
  const real = combineHearing('Loose him', [{ model: 'small.en', transcript: 'lose him' }, { model: 'medium.en', transcript: 'Lose him.' }]);
  assert.deepEqual(real.diffs.map((d) => d.models), [['small.en', 'medium.en']]);
});

test('line takes must cover the script once, in order, with sane tempo', () => {
  const script = 'One line.\nTwo line.';
  assert.deepEqual(takesPlan([{ line: 1, file: 'a' }, { line: 2, file: 'b', pause: 0, tempo: 0.92 }], script).errors, []);
  assert.equal(takesPlan([{ line: 1, file: 'a' }, { line: 2, file: 'b' }], script).plan[0].pause, 0.8);
  const bad = takesPlan([{ line: 2, file: 'b', tempo: 0.5 }], script).errors.join('\n');
  assert.match(bad, /in order/);
  assert.match(bad, /tempo 0.5/);
  assert.match(bad, /1 takes for 2 script lines/);
});

test('assembling line takes: trimmed, levelled, paused, and laid out in a plan', { skip: !hasFfmpeg && 'needs ffmpeg' }, () => {
  const d = tmp();
  fs.mkdirSync(path.join(d, 'media'), { recursive: true }); fs.mkdirSync(path.join(d, 'data'));
  fs.writeFileSync(path.join(d, 'data', 'script.txt'), 'First.\nSecond.\n');
  const tone = (secs, amp) => { const x = new Float32Array(Math.round((secs + 1) * RATE)); for (let i = Math.round(0.5 * RATE); i < Math.round((0.5 + secs) * RATE); i++) x[i] = amp * Math.sin(2 * Math.PI * 180 * i / RATE); return x; };
  writeWav(path.join(d, 'media', 'l1.wav'), tone(1, 0.05), 1);
  writeWav(path.join(d, 'media', 'l2.wav'), tone(0.8, 0.4), 1);
  const film = { mode: 'story', story: { script: 'data/script.txt', narration: 'media/narration.wav', takes: [{ line: 1, file: 'media/l1.wav', pause: 1.5 }, { line: 2, file: 'media/l2.wav', pause: 0 }] } };
  const r = assemble(d, film, { hearIt: false, log: () => {} });
  // 0.25 lead + 1.0 + 1.5 pause + 0.8 + 0.4 tail; each take keeps 0.03 s before and 0.06 s after its
  // sound of its own half-second silences
  assert.ok(Math.abs(r.duration - 4.13) < 0.06, `duration ${r.duration}`);
  assert.ok(Math.abs(r.lines[1].start - 2.84) < 0.05, `line 2 at ${r.lines[1].start}`);
  assert.ok(r.lines[0].gainDb > 10 && r.lines[1].gainDb < 0, 'both levelled toward -20 LUFS');
  assert.ok(fs.existsSync(path.join(d, 'media', 'narration.plan.json')));
});

test('drawing at 4K: segments made before keep their keys; a non-default size gets its own', () => {
  const d = tmp();
  fs.mkdirSync(path.join(d, 'scenes')); fs.mkdirSync(path.join(d, 'data'));
  fs.writeFileSync(path.join(d, 'scenes', 'a.js'), 'export default {}');
  fs.writeFileSync(path.join(d, 'data', 'lyrics.json'), '{"lines":[],"words":[]}');
  // the engine's web folder as it was before it read its size from the URL
  const web = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'photoreal', 'web');
  const old = path.join(d, 'oldweb'); fs.cpSync(web, old, { recursive: true });
  const f = path.join(old, 'engine.js');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/^export const \[W, H\] = .*$/m, 'export const W = 1920, H = 1080;'));
  const s = { id: '01', scene: 'a', from: 0, to: 2 };
  assert.equal(makeKeys(d).plate(s, 60, 8), makeKeys(d, { web: old }).plate(s, 60, 8));
  assert.equal(makeKeys(d).plate({ ...s, res: '1920x1080' }, 60, 8), makeKeys(d).plate(s, 60, 8));
  assert.notEqual(makeKeys(d).plate({ ...s, res: '3840x2160' }, 60, 8), makeKeys(d).plate(s, 60, 8));
});
