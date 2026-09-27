import test from 'node:test';
import assert from 'node:assert/strict';
import { assessOfficialWordEvidence, officialPhraseRetryWindow } from '../engine/audio-review.mjs';

// Pure measured-evidence fixtures. These tests verify rejection boundaries, not
// whether speech-trained acoustic models are perfect judges of sung material.
const A = 'a'.repeat(64), B = 'b'.repeat(64), R = 'c'.repeat(64);
const canonical = () => [{ id: 'cue-ark', text: 'ark,', start: 1, end: 1.4 }];
const word = (score, start = 1, end = 1.4, text = 'ark') => ({ text, start, end, provenance: { tokenProbability: score } });
const pass = (checkpointId, role, token) => ({ checkpointId, role, words: [token] });
const strong = () => [
  pass(A, 'source', word(.88)),
  pass(B, 'source', word(.94, 1.02, 1.42)),
  pass(B, 'encoded', word(.92, 1.03, 1.43)),
];
const weakWithRecognizer = () => [
  pass(A, 'source', word(.12)),
  pass(B, 'source', word(.41, 1.02, 1.42)),
  pass(B, 'encoded', word(.39, 1.03, 1.43)),
];
const recognition = () => [pass(R, 'source', word(.93, 1.01, 1.41))];
const assess = (ctc = strong(), asr = [], expected = canonical()) => assessOfficialWordEvidence(expected, ctc, asr, { duration: 12 });
const rejects = (ctc, asr = []) => {
  const result = assess(ctc, asr);
  assert.equal(result[0].supported, false);
  assert.equal(result[0].passed, false);
  assert.equal(result[0].repair ?? null, null);
};

test('official text has a strong two-checkpoint route with matching selected AAC evidence', () => {
  const result = assess();
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'cue-ark');
  assert.equal(result[0].text, 'ark,');
  assert.equal(result[0].supported, true);
  assert.equal(result[0].passed, true);
  assert.equal(result[0].route, 'official_dual_ctc');
  assert.equal(result[0].selectedCheckpointId, B);
  assert.equal(result[0].acousticConfidence, .94);
});

test('two CTC intervals plus exact independent recognition can support the moderate-score route', () => {
  const result = assess(weakWithRecognizer(), recognition());
  assert.equal(result[0].supported, true);
  assert.equal(result[0].passed, true);
  assert.equal(result[0].route, 'official_ctc_asr');
  assert.equal(result[0].acousticConfidence, .41);
});

test('duplicate model bytes do not count as independent source checkpoints', () => {
  const passes = strong();
  passes[0].checkpointId = B;
  rejects(passes);
});

test('source and encoded runs of one checkpoint do not provide two independent votes', () => {
  rejects(strong().slice(1));
});

test('a vocals run cannot silently replace the required second original-source checkpoint', () => {
  const passes = strong();
  passes[0].role = 'vocals';
  rejects(passes);
});

test('agreement on the end alone cannot hide an onset disagreement', () => {
  const passes = strong();
  passes[0].words[0].start = .65;
  rejects(passes);
});

test('agreement on the onset alone cannot hide an end disagreement', () => {
  const passes = strong();
  passes[0].words[0].end = 1.75;
  rejects(passes);
});

test('strong checkpoint route rejects confidence below its measured threshold', () => {
  const passes = strong();
  passes[0].words[0].provenance.tokenProbability = .699;
  rejects(passes);
});

test('all low CTC scores remain unsupported even with exact high-confidence recognition', () => {
  const passes = weakWithRecognizer();
  passes[1].words[0].provenance.tokenProbability = .199;
  passes[2].words[0].provenance.tokenProbability = .19;
  rejects(passes, recognition());
});

test('moderate CTC route rejects low-confidence ASR and absent recognition', () => {
  rejects(weakWithRecognizer());
  const asr = recognition();
  asr[0].words[0].provenance.tokenProbability = .599;
  rejects(weakWithRecognizer(), asr);
});

test('relabeling the same checkpoint bytes as ASR cannot supply independent recognition', () => {
  for (const checkpointId of [A, B]) {
    const asr = recognition();
    asr[0].checkpointId = checkpointId;
    rejects(weakWithRecognizer(), asr);
  }
});

test('moderate route requires the same literal lexical word, not a plausible substitution', () => {
  const asr = recognition();
  asr[0].words[0].text = 'arc';
  rejects(weakWithRecognizer(), asr);
});

test('moderate route requires both ASR boundaries to corroborate the selected interval', () => {
  for (const field of ['start', 'end']) {
    const asr = recognition();
    asr[0].words[0][field] += field === 'start' ? -.3 : .3;
    rejects(weakWithRecognizer(), asr);
  }
});

test('AAC evidence is mandatory and must belong to the selected source checkpoint', () => {
  rejects(strong().slice(0, 2));
  const passes = strong();
  passes[2].checkpointId = R;
  rejects(passes);
});

test('AAC onset or end disagreement independently blocks acceptance', () => {
  for (const field of ['start', 'end']) {
    const passes = strong();
    passes[2].words[0][field] += field === 'start' ? -.3 : .3;
    rejects(passes);
  }
});

test('matching AAC timestamps with weak acoustic support cannot pass', () => {
  const passes = strong();
  passes[2].words[0].provenance.tokenProbability = .199;
  rejects(passes);
});

test('long uncorroborated sustained tokens require exact recognizer boundary evidence', () => {
  const ctc = strong();
  for (const p of ctc) p.words[0].end += 1.5;
  rejects(ctc);
  const asr = recognition();
  asr[0].words[0].end += 1.5;
  const result = assess(ctc, asr)[0];
  assert.equal(result.supported, true);
  assert.equal(result.passed, false);
});

test('canonical text remains literal and recognizer disagreement is reported on the strong route', () => {
  const asr = recognition();
  asr[0].words[0].text = 'arc';
  const result = assess(strong(), asr)[0];
  assert.equal(result.supported, true);
  assert.equal(result.text, 'ark,');
  assert.equal(result.lexicalEvidence.mismatches.length, 1);
  assert.equal(result.lexicalEvidence.mismatches[0].checkpointId, R);
});

test('one invalid token rejects the entire source pass rather than trusting a partially corrupt pass', () => {
  const ctc = strong();
  ctc[0].words.push(word(.99, 2, 2, 'invalid'));
  rejects(ctc);
});

test('missing or invalid source duration is a hard error', () => {
  for (const duration of [undefined, 0, -1, NaN, Infinity]) {
    assert.throws(() => assessOfficialWordEvidence(canonical(), strong(), [], { duration }), /duration/i);
  }
});

test('zero, reversed, nonfinite, and out-of-source acoustic intervals never pass', () => {
  const invalid = [
    { start: 1, end: 1 }, { start: 1.4, end: 1 },
    { start: -1, end: -.6 }, { start: 11.8, end: 12.2 },
    { start: NaN, end: 1.4 }, { start: 1, end: Infinity },
  ];
  for (const boundary of invalid) {
    const passes = strong();
    for (const p of passes) Object.assign(p.words[0], boundary);
    rejects(passes);
  }
});

test('official canonical lyrics and raw measured evidence remain unmodified', () => {
  const expected = canonical(), ctc = strong(), asr = recognition();
  const before = structuredClone({ expected, ctc, asr });
  assess(ctc, asr, expected);
  assert.deepEqual({ expected, ctc, asr }, before);
});

test('timing repair requires supported evidence and preserves the canonical cue identity', () => {
  const expected = [{ ...canonical()[0], start: .55, end: 1.1 }];
  const result = assess(strong(), [], expected)[0];
  assert.equal(result.supported, true);
  assert.equal(result.passed, false);
  assert.equal(result.repair.id, 'cue-ark');
  assert.equal(result.repair.previousStart, .55);
  assert.equal(result.repair.previousEnd, 1.1);
  assert.ok(result.repair.start >= 1 && result.repair.start <= 1.02);
  assert.ok(result.repair.end >= 1.4 && result.repair.end <= 1.42);
  assert.equal(result.text, 'ark,');
});

const authoredPhrase = () => [word(.9, 10, 10.3, 'Noah'), word(.9, 10.4, 10.7, 'was'), word(.9, 11, 11.6, 'six')];
const recognizedPhrase = (score = .8) => ({checkpointId: R, role: 'source', words: [word(score, 12, 12.3, 'Noah'), word(score, 12.4, 12.7, 'was'), word(score, 12.8, 13.1, 'six')]});
const retryBounds = {start: 8, end: 16, duration: 20};
const retry = (passes, expected = authoredPhrase(), bounds = retryBounds) => officialPhraseRetryWindow(expected, passes, bounds);
const fallback = {start: 9.65, end: 11.95, method: 'authored-phrase-bounds'};

test('phrase retry uses a complete exact contiguous source recognition with contextual neighbors', () => {
  const source = recognizedPhrase();
  source.words.unshift(word(.9, 11, 11.5, 'before'));
  source.words.push(word(.9, 14, 14.5, 'after'));
  const result = retry([source]);
  assert.equal(result.method, 'complete-exact-recognized-phrase');
  assert.equal(result.start, 11.8);
  assert.equal(result.end, 13.35);
  assert.equal(result.checkpointId, R);
  assert.ok(Math.abs(result.confidence - .8) < 1e-10);
});

test('phrase retry accepts the mean probability threshold, selects strongest candidate and clamps to source', () => {
  const first = recognizedPhrase(.6), second = recognizedPhrase(.9);
  second.checkpointId = B;
  assert.equal(retry([first]).method, 'complete-exact-recognized-phrase');
  assert.equal(retry([first, second]).checkpointId, B);
  const edge = {checkpointId: R, role: 'source', words: [word(.9, .05, .2, 'Noah'), word(.9, .3, .6, 'was'), word(.9, .7, .95, 'six')]};
  const result = retry([edge], edge.words, {start: 0, end: 1, duration: 1});
  assert.equal(result.start, 0);
  assert.equal(result.end, 1);
});

test('phrase retry keeps authored bounds for missing, substituted, noncontiguous or weak recognition', () => {
  const missing = recognizedPhrase(); missing.words.splice(1, 1);
  const substituted = recognizedPhrase(); substituted.words[1].text = 'were';
  const noncontiguous = recognizedPhrase(); noncontiguous.words.splice(1, 0, word(.99, 12.31, 12.39, 'really'));
  for (const source of [missing, substituted, noncontiguous, recognizedPhrase(.59)]) assert.deepEqual(retry([source]), fallback);
  assert.deepEqual(retry([]), fallback);
});

test('phrase retry refuses encoded or separated vocals as original-source recognition', () => {
  for (const role of ['encoded', 'vocals', undefined]) assert.deepEqual(retry([{...recognizedPhrase(), role}]), fallback);
});

test('phrase retry rejects invalid, out-of-window and out-of-source intervals including interior tokens', () => {
  for (const boundary of [{start: 12.4, end: 12.4}, {start: 12.8, end: 12.4}, {start: NaN, end: 12.7}, {start: 12.4, end: Infinity}, {start: 7, end: 7.5}, {start: 17, end: 17.5}, {start: 21, end: 21.5}, {start: 11, end: 11.5}, {start: 13.5, end: 14}]) {
    const source = recognizedPhrase(); Object.assign(source.words[1], boundary);
    assert.deepEqual(retry([source]), fallback, JSON.stringify(boundary));
  }
  const early = recognizedPhrase(); early.words[0].start = 7;
  const late = recognizedPhrase(); late.words[2].end = 17;
  assert.deepEqual(retry([early]), fallback);
  assert.deepEqual(retry([late]), fallback);
});

test('phrase retry cannot accept nonfinite or out-of-range token probabilities', () => {
  for (const value of [NaN, Infinity, -1, 2]) {
    const source = recognizedPhrase(); source.words[1].provenance.tokenProbability = value;
    assert.deepEqual(retry([source]), fallback);
  }
});

test('phrase retry preserves source evidence and authored words', () => {
  const expected = authoredPhrase(), sources = [recognizedPhrase()];
  const before = structuredClone({expected, sources});
  retry(sources, expected);
  assert.deepEqual({expected, sources}, before);
});
