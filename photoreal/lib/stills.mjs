// The five key stills rendered at full quality before a full render: the opening, the main image,
// both sides of the fastest cut, a lyric hold and the ending. They catch hierarchy, spacing, type and
// stray-shape problems in minutes instead of after hours of rendering.
export function pickKeyStills(scenes, lyrics, probes = [], fps = 60) {
  const first = scenes[0], last = scenes[scenes.length - 1];
  const snap = (t) => Math.round(t * fps) / fps;
  const at = (t) => scenes.find((s) => t >= s.from && t < s.to) ?? last;
  const out = [];
  const add = (name, t, why) => { t = snap(t); out.push({ name, time: t, sceneId: at(t).id, why }); };

  add('1-opening', first.from + Math.min(1, (first.to - first.from) / 2), 'the first second a viewer sees');
  const longest = [...scenes].sort((a, b) => (b.to - b.from) - (a.to - a.from))[0];
  add('2-main', (longest.from + longest.to) / 2, `middle of the longest scene (${longest.id})`);

  // the cut where the camera moves fastest across it, from the probe; the middle cut without one
  const speed = new Map(probes.map((p) => [p.id, p]));
  let cut = null, best = -1;
  for (let i = 1; i < scenes.length; i++) {
    const v = (speed.get(scenes[i - 1].id)?.outSpeed ?? 0) + (speed.get(scenes[i].id)?.inSpeed ?? 0);
    if (v > best) { best = v; cut = scenes[i].from; }
  }
  if (cut == null) cut = scenes[Math.floor(scenes.length / 2)]?.from ?? first.to;
  if (scenes.length > 1) {
    add('3a-cut-out', cut - 3 / fps, 'three frames before the fastest cut');
    add('3b-cut-in', cut + 3 / fps, 'three frames after the fastest cut');
  }

  const line = [...(lyrics.lines ?? [])].sort((a, b) => (b.end - b.start) - (a.end - a.start))[0];
  if (line) add('4-lyric-hold', Math.min(line.end - 0.1, last.to - 1 / fps), `end of the longest-held line: "${line.text}"`);
  add('5-ending', last.to - 0.5, 'half a second before the end');
  return out;
}
