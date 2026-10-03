// The fresh critic: a separate model session that has seen none of the building. It gets only an
// evidence folder (frames, the storyboard, the lyrics and the measured gate results), never the
// scene code or the building conversation, and returns ranked problems with timestamps and exact
// fixes, a verdict, and the status of every earlier problem. Any model can be the critic: Claude,
// Codex, or a command of your own (ARK_CRITIC_CMD).

export const KINDS = ['storyboard', 'stills', 'film'];

const SHARED = `You are a harsh film director reviewing a lyric film for a Bible song. You did not build it and
you owe its maker nothing. Your default verdict is "one more pass"; say "ship" only when you would
put your own name on it and nothing on your list would be noticed by an attentive viewer.

The lyrics are the source of truth: the words on screen must match them, be readable, and arrive
with the voice. Judge with your own eyes from the files in this folder. Open every image; zoom into
text. Do not guess at anything you cannot see.

Be specific. "The motion feels weird" is useless. "At 1:23.40 (frame 5004, scene 12) the word
'dove' sits on the bright cloud edge and loses its right half; move the line 80 px down or darken
the cloud behind it" is useful. Every problem needs a time, what is wrong, why it hurts the film,
and the exact fix. Rank problems by how much fixing them would improve the film, most first. Five
excellent problems beat twenty weak ones; list at most ten.`;

const KIND_TEXT = {
  storyboard: `This is the storyboard, written before any animation. Read STORYBOARD.md and lyrics.txt.

Check that every row says clearly what is on screen, what the moment is for, how it leaves and what
carries into the next shot; that the shots build and vary instead of repeating; that the transitions
chain (what one row carries, the next picks up); and that the images serve the words.

Then do the sound-off read: read sound-off.txt, which lists the lyric lines row by row next to what
is on screen, as if the film were playing muted. Does the story still come through? Say where it
breaks and what would carry it. Put that judgement in "soundOff".`,
  stills: `These are the key stills rendered at full quality before the full render: the opening, the main
image, both sides of the fastest cut, a lyric hold and the ending (stills.json says which is which
and when). Open each one, zoomed in. Check hierarchy (is it obvious where to look first), spacing,
typography (size, weight, line breaks, words colliding or running together, cut-off text), colour
and whether anything is there that should not be (stray shapes, seams, leftover effects, banding).`,
  film: `This is the finished film. contact.jpg is one frame every few seconds. transitions/ holds a strip
for every cut: frames at -12, -6, -2, -1, 0, +1, +2, +6 and +12 frames around the cut, left to
right (transitions.json has the times). check.json holds the measured gates: text contrast,
colliding words, still stretches, fast moves that slam into a dead stop, words moving before they
can be read, and cuts off the beat. Treat measured failures as real, and look for everything the
measurements cannot see: weak images, dead compositions, a transition that jars, a story that loses
its thread, a look that drifts between scenes.`,
};

// Narrated story films: the voice tells the story and the picture shows it. Words on screen are rare
// and deliberate, so the critic judges the story beats, not lyric legibility.
const STORY_SHARED = `You are a harsh film director reviewing a short narrated film of a Bible passage. You did not
build it and you owe its maker nothing. Your default verdict is "one more pass"; say "ship" only when
you would put your own name on it and nothing on your list would be noticed by an attentive viewer.

A narrator reads the passage word for word (narration.txt, with times); the picture must show what is
being told, beat by beat (beats.txt lists the story beats it must carry and when). This is not a lyric
video: most words are only heard, and any words on screen must be few, sharp and earned. Judge whether
someone watching with the sound on understands what happens at each beat, whether the shots follow
the spoken story in order, whether figures read as people (never stick figures, never horror), and
whether the climax lands with real force. Judge with your own eyes from the files in this folder. Open
every image; zoom in. Do not guess at anything you cannot see.

Be specific. Every problem needs a time, what is wrong, why it hurts the film, and the exact fix.
Rank problems by how much fixing them would improve the film, most first. Five excellent problems
beat twenty weak ones; list at most ten.`;

const STORY_KIND_TEXT = {
  storyboard: `This is the storyboard, written before any animation. Read STORYBOARD.md, narration.txt and beats.txt.

Check that every row says clearly what is on screen, what the moment is for, how it leaves and what
carries into the next shot; that every story beat has a shot that shows it; that the shots build and
vary; that the transitions chain; and that the images serve what is being said at that moment.

Then do the picture-only read: read sound-off.txt, which lists what is on screen row by row next to
what is spoken and the beats it must carry. Would a viewer who missed a sentence of narration still
follow what happens? Say where it breaks and what would carry it. Put that judgement in "soundOff".`,
  stills: `These are the key stills rendered at full quality before the full render: the opening, the main
image, both sides of the fastest cut, a narration hold, the ending, and one still just after each story
beat (stills.json says which is which and when). Open each one, zoomed in. Check that each beat still
shows its beat unmistakably, hierarchy, lighting, how the figures read, any type (sharp, never soft or
grainy), and anything that should not be there (stray shapes, seams, banding).`,
  film: `This is the finished film. contact.jpg is one frame every few seconds. transitions/ holds a strip
for every cut: frames at -12, -6, -2, -1, 0, +1, +2, +6 and +12 frames around the cut, left to right
(transitions.json has the times). check.json holds the measured gates: whether the film's audio says
the script exactly (spoken-text), whether it lines up with the narration (audio-sync), whether the
music stays under the voice (voice-music), whether each story beat falls in its scene (events), cuts
inside spoken words, still stretches, dead stops and the contrast of any words on screen. Treat
measured failures as real, and look for everything the measurements cannot see: a beat the picture
fails to show, weak images, a transition that jars, a climax without force, a look that drifts.`,
};

export function buildPrompt(kind, { openItems = [], extra = '', story = false } = {}) {
  const ledger = openItems.length
    ? `\n\nEarlier rounds found these problems. For each, look at the same moment now and say whether it is
"fixed", "partly fixed" or "still there", with a short note:\n${openItems.map((i) => `- ${i.id} at ${i.time ?? '?'}${i.scene ? ` (scene ${i.scene})` : ''}: ${i.problem}`).join('\n')}`
    : '';
  return `${story ? STORY_SHARED : SHARED}\n\n${(story ? STORY_KIND_TEXT : KIND_TEXT)[kind]}${ledger}${extra ? '\n\n' + extra : ''}

Answer with one JSON object and nothing else:
{
  "verdict": "ship" or "one more pass",
  "problems": [{ "rank": 1, "time": "m:ss.ss", "frame": 0, "scene": "id", "problem": "...", "why": "...", "fix": "..." }],
  "ledger": [{ "id": "F1-2", "status": "fixed" | "partly fixed" | "still there", "note": "..." }],
  "soundOff": "storyboard reviews only: does the story read with the sound off, and where does it break",
  "summary": "two sentences a busy person can act on"
}`;
}

// Pull the JSON object out of a model's answer (bare, fenced, or wrapped by the CLI).
export function parseCritique(text) {
  let s = String(text).trim();
  try { const w = JSON.parse(s); if (typeof w?.result === 'string') s = w.result.trim(); else if (w?.verdict) return normalize(w); } catch {}
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1];
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) throw Error('the critic did not answer with JSON');
  return normalize(JSON.parse(s.slice(a, b + 1)));
}

function normalize(c) {
  const verdict = String(c.verdict ?? '').toLowerCase().trim() === 'ship' ? 'ship' : 'one more pass';
  const problems = (Array.isArray(c.problems) ? c.problems : []).map((p, i) => ({ rank: +p.rank || i + 1, time: p.time ?? null, frame: Number.isFinite(+p.frame) ? +p.frame : null, scene: p.scene != null ? String(p.scene) : null, problem: String(p.problem ?? ''), why: String(p.why ?? ''), fix: String(p.fix ?? '') }))
    .filter((p) => p.problem).sort((a, b) => a.rank - b.rank);
  const STATUS = ['fixed', 'partly fixed', 'still there'];
  const ledger = (Array.isArray(c.ledger) ? c.ledger : []).map((l) => ({ id: String(l.id), status: STATUS.includes(String(l.status).toLowerCase()) ? String(l.status).toLowerCase() : 'still there', note: String(l.note ?? '') }));
  return { verdict, problems, ledger, soundOff: c.soundOff ?? null, summary: c.summary ?? null };
}

// Fold one round into the ledger that runs across rounds.
export function mergeLedger(ledger, { kind, round, critique, agent, at }) {
  const L = ledger ?? { rounds: [], items: [] };
  L.rounds.push({ kind, round, verdict: critique.verdict, agent, at, problems: critique.problems.length });
  const seen = new Set();
  for (const e of critique.ledger) {
    const item = L.items.find((i) => i.id === e.id);
    if (!item) continue;
    seen.add(item.id);
    item.status = e.status;
    item.history.push({ round, status: e.status, note: e.note });
  }
  for (const item of L.items) if (item.kind === kind && item.status !== 'fixed' && !seen.has(item.id)) item.history.push({ round, status: 'not checked', note: 'the critic did not report on it this round' });
  const prefix = { storyboard: 'S', stills: 'K', film: 'F' }[kind];
  for (const p of critique.problems) {
    L.items.push({ id: `${prefix}${round}-${p.rank}`, kind, round, status: 'open', time: p.time, frame: p.frame, scene: p.scene, problem: p.problem, why: p.why, fix: p.fix, history: [] });
  }
  return L;
}

export const openItems = (ledger, kind) => (ledger?.items ?? []).filter((i) => i.kind === kind && i.status !== 'fixed');

export function ledgerMarkdown(L) {
  const out = ['# Critic ledger', ''];
  for (const r of L.rounds) out.push(`- Round ${r.round} (${r.kind}, ${r.agent}, ${r.at}): **${r.verdict}**, ${r.problems} problems`);
  out.push('', '| Id | Status | Time | Scene | Problem | Fix |', '|---|---|---|---|---|---|');
  const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  for (const i of L.items) out.push(`| ${i.id} | ${i.status} | ${esc(i.time)} | ${esc(i.scene)} | ${esc(i.problem)} | ${esc(i.fix)} |`);
  return out.join('\n') + '\n';
}
