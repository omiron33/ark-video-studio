// Music cues: motion keyed to what the track does, measured in data/music.json (photoreal/lib/music.py:
// a beat map that follows the tempo, real hits, swells and the hit each lands on, fills, stem
// envelopes). The camera answers a sound you can hear: push slowly into a swell and arrive on its hit,
// let a held light breathe with the strings, hold still where the drums drop out.
//
//   import music from '/song/data/music.json' with { type: 'json' };
//   import { track } from '/kit/music.js';
//   const M = track(music);
//   M.swell(t)              // 0..1 along the swell t is in (eased in), 1 on its hit, else 0
//   M.landed(t)             // 1 on a real hit, dying away over 0.3 s (scaled by the hit's strength)
//   M.env(t, 'other')       // 0..1 loudness of a stem (mix, drums, bass, other, vocals), 24 fps, smooth
//   M.beat(t)               // { n, phase }: the beat t is in and how far through it (0..1)
//   M.bar(t)                // { n, phase }: the same for bars, from the measured downbeats
//   M.next(t, 'hits')       // the next hit (or kick, snare, downbeat...) after t, or null
//   M.progress(t, a, b)     // 0..1 from a to b, moving faster where the music is louder
//   rig({ from, to, path, move: (t) => M.progress(t, from, to) })
//
// For the slow, physical camera of the lyric films; the music video's pop camera (punches, shake)
// lives in photoreal/lib/popcam.py and is not for these films. Importing music.json from '/song/...'
// puts it in this scene's cache key, and only this scene's. Every function is a pure function of t.
// This file imports nothing. Moves and constants after claudia-bot's HIT helpers (MIT, anabology).

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };

// last index i with a[i] <= t (-1 when t is before them all)
function before(a, t) {
  let lo = 0, hi = a.length - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (a[m] <= t) { r = m; lo = m + 1; } else hi = m - 1; }
  return r;
}

export function track(music) {
  const m = music ?? {};
  const beats = m.beats ?? [], downs = m.downbeats ?? [], env24 = m.env24 ?? {};
  const times = (kind) => kind === 'hits' ? (m.hits ?? []).map((h) => h.t) : kind === 'downbeats' ? downs : kind === 'beats' ? beats : (m[kind] ?? []);
  const env = (t, stem = 'mix') => {
    const e = env24[stem]; if (!e?.length) return 0;
    const x = Math.max(0, t * 24), i = Math.floor(x);
    if (i >= e.length - 1) return e[e.length - 1];
    return e[i] + (e[i + 1] - e[i]) * (x - i);
  };
  const within = (a, t) => {
    const i = before(a, t);
    if (i < 0 || i >= a.length - 1) return { n: i, phase: 0 };
    return { n: i, phase: (t - a[i]) / (a[i + 1] - a[i]) };
  };
  return {
    music: m,
    env,
    beat: (t) => within(beats, t),
    bar: (t) => within(downs, t),
    next(t, kind = 'hits') { const a = times(kind), i = before(a, t) + 1; return i < a.length ? a[i] : null; },
    swell(t, curve = 2.2) {
      for (const r of m.risers ?? []) if (t >= r.t0 && t < r.land) return clamp01((t - r.t0) / (r.land - r.t0)) ** curve;
      return 0;
    },
    landed(t, tau = 0.3, min = 0.5) {
      let v = 0;
      for (const h of m.hits ?? []) if (h.score >= min && t >= h.t && t - h.t < 6 * tau) v = Math.max(v, h.score * Math.exp(-(t - h.t) / tau));
      return v;
    },
    // a move whose speed is the music's loudness: integrates the stem's envelope from a to b
    progress(t, a, b, stem = 'other') {
      if (t <= a) return 0; if (t >= b) return 1;
      const step = 1 / 24; let total = 0, upto = 0;
      for (let x = a; x < b; x += step) { const w = 0.15 + env(x, stem); total += w; if (x < t) upto += w * Math.min(1, (t - x) / step); }
      return smooth(total ? upto / total : (t - a) / (b - a));
    },
  };
}
