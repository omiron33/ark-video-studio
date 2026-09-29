// Measured lyric timing for the loaded song. Scenes anchor themselves to lines by their text.
const lyrics = await fetch('/song/data/lyrics.json').then((r) => r.json());
export default lyrics;

const norm = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z' ]/g, '').trim();

// Lines whose text starts with each prefix (in song order), plus a window that opens just before the
// first line and lasts at least 5 s, long enough to finish the last line.
export function anchor(...prefixes) {
  let from = 0;
  const lines = prefixes.map((p) => {
    const l = lyrics.lines.find((l) => l.start >= from && norm(l.text).startsWith(norm(p)));
    if (!l) throw Error('no line: ' + p);
    from = l.start;
    const words = lyrics.words.filter((w) => w.start >= l.start - 0.05 && w.end <= l.end + 0.05);
    return { ...l, words };
  });
  const a = lines[0].start - 0.45;
  const b = Math.max(a + 5, lines[lines.length - 1].end + 0.35);
  return { lines, from: a, to: b, placeholder: !!lyrics.placeholder };
}
