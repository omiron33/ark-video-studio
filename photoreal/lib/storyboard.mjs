// The storyboard: one table, written before any animation, that says for every stretch of the song
// what is on screen, what the moment is for, how it leaves and what carries into the next shot.
// A sixth column says where the words live in that world (carved on the hull, lying along the ridge,
// burned by the fuse); storyboards written before it existed may leave it out, but when it is there
// every row fills it. It lives at docs/STORYBOARD.md in the song folder. The fresh critic checks it, including whether
// the story reads with the sound off through the lyrics alone.
import fs from 'node:fs';
import path from 'node:path';

export const COLUMNS = ['Time', 'On screen', 'What the moment is for', 'How it leaves', 'What carries into the next shot', 'Where the words live in the scene'];
const MATCH = [/time/i, /screen/i, /for|purpose|why/i, /leave|exit|out/i, /carr|next/i];

export const storyboardPath = (song) => path.join(song, 'docs', 'STORYBOARD.md');

export function parseTime(s) {
  s = s.trim();
  const m = s.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!m) return NaN;
  return (m[1] ? +m[1] * 60 : 0) + +m[2];
}
export const fmtTime = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

const cells = (line) => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));

export function parseStoryboard(text) {
  const lines = text.split('\n');
  const h = lines.findIndex((l) => l.trim().startsWith('|') && MATCH.every((re, i) => re.test(cells(l)[i] ?? '')));
  if (h < 0) return { rows: [], errors: [`No storyboard table: expected a header row with the columns ${COLUMNS.join(' | ')}.`] };
  const words = /word|lyric|text/i.test(cells(lines[h])[5] ?? '');
  const rows = [], errors = [];
  for (let i = h + 2; i < lines.length && lines[i].trim().startsWith('|'); i++) {
    const c = cells(lines[i]);
    const [a, b] = (c[0] ?? '').split(/\s*[-–—]\s*/);
    const row = { line: i + 1, from: parseTime(a ?? ''), to: parseTime(b ?? ''), time: c[0], screen: c[1] ?? '', purpose: c[2] ?? '', leaves: c[3] ?? '', carries: c[4] ?? '', words: words ? c[5] ?? '' : undefined };
    if (!Number.isFinite(row.from) || !Number.isFinite(row.to) || row.to <= row.from) errors.push(`Line ${row.line}: the time "${c[0]}" should look like 0:12.5–0:20.0.`);
    rows.push(row);
  }
  return { rows, errors };
}

// duration: song length in seconds; lyrics: { lines: [{ text, start, end }] }; events (story films):
// [{ id, time, what }], each of which must fall inside a row
export function validateStoryboard(text, { duration, lyrics, events } = {}) {
  const { rows, errors } = parseStoryboard(text);
  if (!rows.length) return { ok: false, errors: errors.length ? errors : ['The storyboard table has no rows.'], rows };
  const tol = 0.1;
  if (rows[0].from > tol) errors.push(`The first row starts at ${fmtTime(rows[0].from)}; the storyboard must start at 0:00.0.`);
  for (let i = 1; i < rows.length; i++) {
    const gap = rows[i].from - rows[i - 1].to;
    if (Math.abs(gap) > tol) errors.push(`Line ${rows[i].line}: ${gap > 0 ? 'a gap' : 'an overlap'} of ${Math.abs(gap).toFixed(2)} s after the previous row.`);
  }
  if (duration && rows[rows.length - 1].to < duration - 0.5) errors.push(`The last row ends at ${fmtTime(rows[rows.length - 1].to)} but the song runs to ${fmtTime(duration)}.`);
  for (const r of rows) {
    for (const [k, name] of [['screen', 'On screen'], ['purpose', 'What the moment is for'], ['leaves', 'How it leaves'], ['carries', 'What carries into the next shot'], ['words', 'Where the words live in the scene']]) {
      if (k === 'words' && r.words === undefined) continue;
      if (!r[k] || /\bTODO\b|^\?+$|^[-–—]$/.test(r[k])) errors.push(`Line ${r.line} (${r.time}): "${name}" is empty or still TODO.`);
    }
  }
  // the lyric lines each row carries, for the sound-off read
  const byRow = rows.map((r) => ({ ...r, lyrics: [] }));
  for (const l of lyrics?.lines ?? []) {
    const r = byRow.find((x) => l.start >= x.from - 0.05 && l.start < x.to);
    if (r) r.lyrics.push(l.text); else errors.push(`The lyric "${l.text}" at ${fmtTime(l.start)} falls outside every row.`);
  }
  for (const r of byRow) r.events = [];
  for (const e of events ?? []) {
    if (e.time == null) continue;
    const r = byRow.find((x) => e.time >= x.from - 0.05 && e.time < x.to);
    if (r) r.events.push(e); else errors.push(`The story beat "${e.id}" at ${fmtTime(e.time)} falls outside every row.`);
  }
  return { ok: errors.length === 0, errors, rows: byRow };
}

// A skeleton to fill in: one row per film.json scene when there is one, otherwise rows of whole
// lyric lines about 8 to 12 seconds long. Every judgement cell starts as TODO.
export function draftStoryboard({ title, duration, lyrics, scenes }) {
  let spans;
  if (scenes?.length) spans = scenes.map((s) => [s.from, s.to]);
  else {
    spans = []; let a = 0;
    for (const l of lyrics?.lines ?? []) if (l.start - a >= 8) { spans.push([a, l.start]); a = l.start; }
    spans.push([a, duration]);
  }
  const rows = spans.map(([a, b]) => {
    const words = (lyrics?.lines ?? []).filter((l) => l.start >= a - 0.05 && l.start < b).map((l) => `“${l.text}”`).join(' ');
    return `| ${fmtTime(a)}–${fmtTime(b)} | ${words ? `Lyric: ${words}. ` : ''}TODO | TODO | TODO | TODO | TODO |`;
  });
  return [`# Storyboard: ${title}`, '',
    'Written before any animation. One row per stretch of the song. Read the lyric column top to bottom with the sound off: the story should still come through. The last column says how the words are part of that world (on a surface, along a form, lit, burned, stamped or hidden by it), not laid over it.', '',
    `| ${COLUMNS.join(' | ')} |`, `|${COLUMNS.map(() => '---').join('|')}|`, ...rows, ''].join('\n');
}
