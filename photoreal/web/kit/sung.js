// Sung cues: motion keyed to the words as they are sung, after ManimGX's say(). Write the lyric as
// it is sung and put the words that something happens on in brackets; each bracket becomes a beat
// that starts on its first word and ends on its last, at the measured times in data/lyrics.json.
// A new take or a re-measured lyric moves every beat with it, and the scene says in words, not in
// seconds, what lands where.
//
//   import lyrics from '/timing.js';
//   import { sung, weight } from '/kit/sung.js';
//   const S = sung(lyrics, 'let us make [brick] and [burn them throughly]');
//   S.beat('brick').start          // song seconds of "brick"
//   S.on(t, 'brick')               // 0..1 over the beat: a brick stamped as the word is sung
//   S.hit(t, 1)                    // 1 at the onset of "burn", dying away: the kiln flares
//   S.lit(t, 'throughly')          // 0..1, each word catching as it is sung
//   rig({ from, to, path, move: S.span('burn them throughly') })   // a camera move on the phrase
//
// The same cues drive words carved, burned or lit in the world (drawText, a shader uniform, an
// htmlText span) and the lyric layer, so the picture and the type key off the same sung words.
// Every function is a pure function of t. This file imports nothing, so it adds only itself to the
// cache keys of the scenes that use it (see lib/keys.mjs).

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
export const weight = {
  linear: clamp01,
  smooth,
  heavy: (x) => { x = clamp01(x); return x < 0.62 ? 0.5 * (x / 0.62) ** 2.6 : 1 - 0.5 * ((1 - x) / 0.38) ** 2.0; },
  light: (x) => { x = clamp01(x); return 1 - (1 - x) ** 4; },
};

// the same normalisation timing.js's anchor() uses, applied per word: case, curly quotes and
// punctuation never stop a match
export const norm = (s) => String(s).toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s) => norm(s).split(' ').filter(Boolean).map((w) => w.replace(/^'+|'+$/g, '')).filter(Boolean);

// Parse 'a [b c] d [e]' into tokens and the token ranges of each bracket.
export function parseCue(text) {
  const toks = [], beats = [];
  let open = -1, label = '';
  for (const part of String(text).split(/([[\]])/)) {
    if (part === '[') { if (open >= 0) throw Error(`sung: nested [ in "${text}"`); open = toks.length; label = ''; continue; }
    if (part === ']') {
      if (open < 0) throw Error(`sung: ] without [ in "${text}"`);
      if (toks.length === open) throw Error(`sung: empty [] in "${text}"`);
      beats.push({ label: norm(label), from: open, to: toks.length }); open = -1; continue;
    }
    if (open >= 0) label += ' ' + part;
    toks.push(...tokens(part));
  }
  if (open >= 0) throw Error(`sung: [ without ] in "${text}"`);
  if (!toks.length) throw Error('sung: no words');
  return { tokens: toks, beats };
}

// The measured words of the song as one token list: a measured "Noah's," or "re-built" still
// lines up with what the scene wrote, and each token remembers which measured word it came from.
function flatten(words) {
  const out = [];
  words.forEach((w, i) => { for (const tk of tokens(w.w ?? w.text ?? '')) out.push({ tk, i }); });
  return out;
}

// sung(lyrics, text, { after, within }): find `text` in the measured words, in order and
// contiguous, at or after `after` song seconds (default 0), and give its beats.
//   lyrics   the song's lyrics.json ({ words: [{ w, start, end }] }) or a words array
//   after    start looking here: the second time a refrain is sung is sung(L, '...', { after: 95 })
//   within   [a, b]: the match must start inside this window (a scene's from and to), so a cue
//            never silently lands on the same words in another part of the song
// Throws, naming the nearest place it nearly matched, when the words are not in the lyrics.
export function sung(lyrics, text, { after = 0, within } = {}) {
  const words = Array.isArray(lyrics) ? lyrics : lyrics.words;
  if (!Array.isArray(words)) throw Error('sung: lyrics has no words');
  const { tokens: want, beats: marks } = parseCue(text);
  const flat = flatten(words);
  const lo = within ? Math.max(after, within[0]) : after;
  let best = { n: -1, k: -1 }, at = -1;
  for (let k = 0; k + want.length <= flat.length; k++) {
    const s = words[flat[k].i].start;
    if (s < lo - 0.05) continue;
    if (within && s > within[1]) break;
    let n = 0;
    while (n < want.length && flat[k + n].tk === want[n]) n++;
    if (n === want.length) { at = k; break; }
    if (n > best.n) best = { n, k };
  }
  if (at < 0) {
    const near = best.k >= 0 ? flat.slice(best.k, best.k + want.length).map((f) => f.tk).join(' ') : '';
    const where = within ? ` between ${within[0]} s and ${within[1]} s` : after ? ` after ${after} s` : '';
    throw Error(`sung: "${want.join(' ')}" is not in the measured lyrics${where}` + (near ? `; nearest: "${near}" at ${words[flat[best.k].i].start} s` : ''));
  }
  // measured words covered by token range [a, b)
  const cover = (a, b) => {
    const i0 = flat[at + a].i, i1 = flat[at + b - 1].i;
    return words.slice(i0, i1 + 1);
  };
  const all = cover(0, want.length);
  const mk = (ws, label) => ({ label, text: ws.map((w) => w.w ?? w.text).join(' '), start: ws[0].start, end: ws[ws.length - 1].end, words: ws });
  // no brackets: the whole phrase is one beat
  const beats = (marks.length ? marks : [{ label: norm(want.join(' ')), from: 0, to: want.length }]).map((m) => mk(cover(m.from, m.to), m.label));
  const whole = mk(all, norm(want.join(' ')));

  const beat = (key) => {
    if (typeof key === 'number') { const b = beats[key]; if (!b) throw Error(`sung: no beat ${key} in "${text}"`); return b; }
    const k = norm(key);
    const b = beats.find((x) => x.label === k) ?? (k === whole.label ? whole : null);
    if (!b) throw Error(`sung: no beat "${key}" in "${text}" (beats: ${beats.map((x) => x.label).join(', ')})`);
    return b;
  };
  // the k-th measured word of the cue (0-based), or a word given by its text
  const word = (key) => {
    if (typeof key === 'number') { const w = all[key]; if (!w) throw Error(`sung: no word ${key} in "${text}"`); return w; }
    const k = norm(key), w = all.find((x) => norm(x.w ?? x.text) === k);
    if (!w) throw Error(`sung: no word "${key}" in "${text}"`);
    return w;
  };

  return {
    text: whole.text, start: whole.start, end: whole.end, words: all, beats,
    beat,
    word,
    // [start, end] of a beat, for rig({ move }) or anything that takes a span
    span: (key = 0, { lead = 0, tail = 0 } = {}) => { const b = beat(key); return [b.start - lead, b.end + tail]; },
    // 0..1 across a beat: starts `lead` s before its first word, lasts the beat (or `dur` s), eased
    on: (t, key = 0, { lead = 0, dur, ease = smooth } = {}) => {
      const b = beat(key), t0 = b.start - lead, d = dur ?? Math.max(0.05, b.end - b.start + lead);
      return ease((t - t0) / d);
    },
    // a strike at the beat's onset: 0 before it, rising over `attack` s to 1 and dying away with a
    // half-life of `decay` s (a kiln flare, a hammer on a brick, light catching a carved line)
    hit: (t, key = 0, { attack = 0.04, decay = 0.35, lead = 0 } = {}) => {
      const x = t - (beat(key).start - lead);
      if (x <= 0) return 0;
      if (x < attack) return smooth(x / attack);
      return 0.5 ** ((x - attack) / Math.max(1e-6, decay));
    },
    // held: 1 while the beat is being sung, eased in and out over `soft` s
    held: (t, key = 0, { soft = 0.12 } = {}) => {
      const b = beat(key);
      return smooth((t - b.start + soft) / (2 * soft)) * (1 - smooth((t - b.end + soft) / (2 * soft)));
    },
    // a word catching as it is sung: 0 before its onset, 1 after `dur` s (default 0.25), so a word
    // never shows before it is sung
    lit: (t, key, { lead = 0.05, dur = 0.25, ease = weight.light } = {}) => ease((t - word(key).start + lead) / dur),
    // every measured word of the cue with its own lit value: for drawing the line in the world
    each: (t, { lead = 0.05, dur = 0.25, ease = weight.light } = {}) => all.map((w, i) => ({ ...w, i, k: ease((t - w.start + lead) / dur) })),
  };
}

// cues(lyrics): bind the lyrics once, then const S = cue('...'), with the same options as sung()
export const cues = (lyrics, defaults = {}) => (text, o = {}) => sung(lyrics, text, { ...defaults, ...o });
