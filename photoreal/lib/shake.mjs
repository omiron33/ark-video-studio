// Shake is off by default. A shaking frame (camera shake, a jolted picture, a juddering lyric
// strike) is kept for extreme power or a violent, energetic collision: a blow landing, lightning
// striking close, the ground breaking, a wall falling. It is not a way to make a line feel strong.
// A scene opts in with "shake": "<the moment and why it is violent>" on its film.json entry; that
// field is not part of any cache key, so opting in never re-renders a segment.
//
// The check reads the song's source. Hits in a scene module or its lyric module fail unless the
// scene opted in; hits in a shared song module (lib/...) warn once, because a helper that shakes by
// default shakes every scene that calls it. Comments are ignored. A line that moves one object
// rather than the frame (a flame trembling, a head shaking no) can say so with a comment containing
// `ark-shake-ok: <what moves>` on that line or the line above it.
import fs from 'node:fs';
import path from 'node:path';
import { depsOf } from './keys.mjs';

// words agents use for it, and the damped high-frequency sine that is a shake whatever it is called
const WORDS = /shake|shaking|jolt|judder|quake|tremor|rumble/i;
const DAMPED = /Math\.exp\([^;]*?\)\s*\*\s*Math\.sin\(\s*[^;]*?\*\s*(\d+(?:\.\d+)?)\s*\)/;
const MIN_RATE = 30;   // rad/s in a damped sine: about 5 Hz and up reads as a shake, not a sway

// one line with its comments removed; `state.block` carries an open /* comment across lines
function code(line, state) {
  let out = '', i = 0, quote = null;
  while (i < line.length) {
    if (state.block) { const e = line.indexOf('*/', i); if (e < 0) return out; state.block = false; i = e + 2; continue; }
    const c = line[i];
    if (quote) { out += c; if (c === '\\') { out += line[i + 1] ?? ''; i += 2; continue; } if (c === quote) quote = null; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i++; continue; }
    if (c === '/' && line[i + 1] === '/') return out;
    if (c === '/' && line[i + 1] === '*') { state.block = true; i += 2; continue; }
    out += c; i++;
  }
  return out;
}

export function shakeHits(src) {
  const lines = String(src).split('\n'), state = { block: false }, hits = [];
  lines.forEach((line, i) => {
    const c = code(line, state);
    const m = WORDS.exec(c) ?? (() => { const d = DAMPED.exec(c); return d && +d[1] >= MIN_RATE ? d : null; })();
    if (!m) return;
    if (/ark-shake-ok\s*:\s*\S/.test(line) || /ark-shake-ok\s*:\s*\S/.test(lines[i - 1] ?? '')) return;
    hits.push({ line: i + 1, text: c.trim().slice(0, 120) });
  });
  return hits;
}

// Problems for check.mjs: { severity, scene (film.json entry or null), detail, fix }
export function shakeReview(song, scenes, { maxShakeScenes = 2 } = {}) {
  const problems = [], libs = new Map();
  const rel = (f) => path.relative(song, f);
  for (const s of scenes) {
    const own = [path.join(song, 'scenes', `${s.scene}.js`), path.join(song, 'scenes', `${s.scene}.lyric.js`)].filter((f) => fs.existsSync(f));
    // other scenes' modules are judged as their own scenes
    const sceneDir = path.join(song, 'scenes') + path.sep;
    for (const f of own) for (const d of depsOf(song, f)) if (!d.startsWith(sceneDir) && !libs.has(d)) libs.set(d, null);
    const hits = own.flatMap((f) => shakeHits(fs.readFileSync(f, 'utf8')).map((h) => `${rel(f)}:${h.line}`));
    const optIn = typeof s.shake === 'string' ? s.shake.trim() : s.shake;
    if (s.shake !== undefined && (typeof optIn !== 'string' || !optIn)) {
      problems.push({ severity: 'fail', scene: s, detail: `scene ${s.id} sets "shake" without saying why`, fix: 'write the violent moment it serves, e.g. "shake": "the stone strikes Goliath", or remove it' });
    }
    if (hits.length && !optIn) {
      problems.push({ severity: 'fail', scene: s, detail: `scene ${s.id} shakes without opting in (${hits.slice(0, 4).join(', ')}${hits.length > 4 ? ', …' : ''})`, fix: `shake is only for extreme power or a violent collision; remove it and let light, scale or a cut carry the weight, or give the scene "shake": "<the violent moment>" in film.json` });
    }
  }
  for (const f of [...libs.keys()].sort()) {
    const hits = shakeHits(fs.readFileSync(f, 'utf8'));
    if (hits.length) problems.push({ severity: 'warn', scene: null, detail: `${rel(f)} has shake code (lines ${hits.slice(0, 6).map((h) => h.line).join(', ')}) that the scenes calling it inherit`, fix: 'make the helper shake only when a caller passes it (default 0), and pass it only in scenes that opted in' });
  }
  const opted = scenes.filter((s) => typeof s.shake === 'string' && s.shake.trim());
  if (opted.length > maxShakeScenes) {
    problems.push({ severity: 'warn', scene: opted[maxShakeScenes], detail: `${opted.length} scenes shake (${opted.map((s) => s.id).join(', ')})`, fix: `keep shake for the ${maxShakeScenes} most violent moments at most; it stops reading as power when it repeats` });
  }
  return problems;
}
