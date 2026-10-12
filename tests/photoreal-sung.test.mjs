import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sung, cues, parseCue } from '../photoreal/web/kit/sung.js';
import { kitDepsOf, makeKeys } from '../photoreal/lib/keys.mjs';

const L = {
  words: [
    { w: 'Go', start: 1.0, end: 1.3 }, { w: 'to,', start: 1.3, end: 1.5 }, { w: 'let', start: 1.5, end: 1.7 }, { w: 'us', start: 1.7, end: 1.9 },
    { w: 'make', start: 1.9, end: 2.3 }, { w: 'brick,', start: 2.3, end: 3.0 }, { w: 'and', start: 3.2, end: 3.4 }, { w: 'burn', start: 3.4, end: 3.9 },
    { w: 'them', start: 3.9, end: 4.1 }, { w: 'throughly', start: 4.1, end: 5.2 },
    // the refrain again later
    { w: 'Let', start: 20.0, end: 20.2 }, { w: 'us', start: 20.2, end: 20.4 }, { w: 'make', start: 20.4, end: 20.8 }, { w: 'brick', start: 20.8, end: 21.5 },
    { w: "Babel's", start: 30.0, end: 30.6 }, { w: 're-built', start: 30.6, end: 31.4 },
  ],
};

test('brackets become beats on the measured words, ignoring case and punctuation', () => {
  const S = sung(L, 'let us make [brick] and [burn them throughly]');
  assert.equal(S.start, 1.5);
  assert.equal(S.end, 5.2);
  assert.equal(S.beats.length, 2);
  assert.deepEqual(S.span('brick'), [2.3, 3.0]);
  assert.deepEqual(S.span(1), [3.4, 5.2]);
  assert.equal(S.beat('Burn them throughly').text, 'burn them throughly');
  assert.equal(S.beat('let us make brick and burn them throughly').start, 1.5, 'the whole phrase is a beat too');
});

test('a cue without brackets is one beat over the whole phrase', () => {
  const S = sung(L, 'and burn them');
  assert.equal(S.beats.length, 1);
  assert.deepEqual(S.span(), [3.2, 4.1]);
});

test('after and within pick which time a repeated phrase is sung', () => {
  assert.equal(sung(L, 'let us [make brick]').beat(0).start, 1.9);
  assert.equal(sung(L, 'let us [make brick]', { after: 10 }).beat(0).start, 20.4);
  assert.equal(sung(L, 'let us make brick', { within: [18, 25] }).start, 20.0);
  assert.throws(() => sung(L, 'and burn them', { within: [18, 25] }), /not in the measured lyrics between 18 s and 25 s/);
});

test('a cue that is not sung fails loudly, naming the nearest match', () => {
  assert.throws(() => sung(L, 'let us make stone'), /"let us make stone" is not in the measured lyrics; nearest: "let us make brick" at 1.5 s/);
  assert.throws(() => sung(L, 'and [burn'), /\[ without \]/);
  assert.throws(() => sung(L, 'and [] burn'), /empty \[\]/);
  assert.throws(() => sung(L, '[a [b]]'), /nested/);
  assert.throws(() => sung(L, 'let us make [brick]').beat('stone'), /no beat "stone".*beats: brick/);
});

test('apostrophes and hyphens in the measured words still match', () => {
  const S = sung(L, "[babel's] re built");
  assert.equal(S.beat(0).start, 30.0);
  assert.equal(S.end, 31.4);
  assert.deepEqual(parseCue("[Babel’s] tower").tokens, ["babel's", 'tower']);
});

test('on, hit, held and lit are timed by the sung words and never early', () => {
  const S = sung(L, 'let us make [brick] and [burn them throughly]');
  // on: 0 before the beat, 1 by its end
  assert.equal(S.on(2.2, 'brick'), 0);
  assert.equal(S.on(3.0, 'brick'), 1);
  assert.ok(S.on(2.65, 'brick') > 0.3 && S.on(2.65, 'brick') < 0.7);
  assert.equal(S.on(2.3 + 0.1, 'brick', { dur: 0.1 }), 1);
  // hit: a strike at the onset that dies away
  assert.equal(S.hit(3.39, 1), 0);
  assert.ok(Math.abs(S.hit(3.44, 1) - 1) < 1e-9);
  assert.ok(Math.abs(S.hit(3.44 + 0.35, 1) - 0.5) < 1e-9, 'half-life of decay');
  // held: up while the beat is sung, down after
  assert.ok(S.held(4.5, 1) > 0.99);
  assert.equal(S.held(6, 1), 0);
  assert.equal(S.held(3.0, 1), 0);
  // lit: per word, from just before its onset
  assert.equal(S.lit(2.2, 'brick'), 0);
  assert.equal(S.lit(2.6, 'brick'), 1);
  const e = S.each(3.5);
  assert.equal(e.length, 8);
  assert.deepEqual(e.map((w) => w.k > 0), [true, true, true, true, true, true, false, false]);
  // pure functions of t
  assert.equal(S.hit(3.7, 1), S.hit(3.7, 1));
});

test('span feeds a camera move on a sung phrase', () => {
  const S = sung(L, 'and [burn them throughly]');
  assert.deepEqual(S.span('burn them throughly', { lead: 0.3, tail: 0.5 }), [3.1, 5.7]);
});

test('cues() binds the lyrics once', () => {
  const cue = cues(L, { after: 10 });
  assert.equal(cue('let us [make]').beat(0).start, 20.4);
  assert.equal(cue('let us [make]', { after: 0 }).beat(0).start, 1.9);
  assert.equal(sung(L.words, 'go to').start, 1.0, 'a words array works as well');
});

test('sung.js imports nothing, so it adds only itself to a scene\'s keys', () => {
  const web = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'photoreal', 'web');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-sung-'));
  fs.mkdirSync(path.join(d, 'scenes'));
  fs.mkdirSync(path.join(d, 'data'));
  fs.writeFileSync(path.join(d, 'data', 'lyrics.json'), JSON.stringify(L));
  fs.writeFileSync(path.join(d, 'scenes', 'a.js'), "import { sung } from '/kit/sung.js';\nexport default (P) => ({ name: 'a', from: P.from, to: P.to });\n");
  fs.writeFileSync(path.join(d, 'scenes', 'b.js'), "export default (P) => ({ name: 'b', from: P.from, to: P.to });\n");
  assert.deepEqual(kitDepsOf(web, [path.join(d, 'scenes', 'a.js')]).map((f) => path.basename(f)), ['sung.js']);
  assert.deepEqual(kitDepsOf(web, [path.join(d, 'scenes', 'b.js')]), []);
  assert.equal(typeof makeKeys, 'function');
});
