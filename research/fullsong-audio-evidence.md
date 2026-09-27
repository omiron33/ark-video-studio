# Full-song word evidence: measured candidates, not a blanket confidence change

This analysis is **not an audio acceptance report**. The first full-song base-CTC pass contains 537 canonical words, 109 below its current 0.2 acoustic-score threshold. The literal words come from the MP3's embedded lyric metadata; that establishes the intended text, not their measured timing. Preserve all unresolved provenance while the visual draft renders.

[Machine-readable comparisons](fullsong-audio-evidence.json) bind the first four available base/large checkpoint reports by SHA-256. These two checkpoints have distinct weights but share an acoustic model family; agreement is corroboration, not proof of independent error distributions. Their speech-trained token scores are not calibrated probabilities that a sung word is correct.

| Word | Base score | Large score | Onset difference | End difference | Interpretation |
|---|---:|---:|---:|---:|---|
| into | .1321 | .8089 | .0002 s | .0398 s | Stronger-checkpoint candidate; independent recognition and AAC checks still required |
| Male | .0290 | .9925 | .0195 s | .0406 s | Same |
| to | .0602 | .2285 | .0197 s | .0197 s | Marginal stronger-checkpoint candidate, not automatic acceptance |
| ark | .0216 | .0478 | .0196 s | .7212 s | Unresolved: low scores and a large release disagreement |
| earth | .1293 | .2620 | 5.1809 s | 5.2205 s | Unresolved: a different acoustic placement |
| God | .0911 | .1292 | 3.3988 s | .0157 s | Unresolved: matching release does not corroborate onset |

The measured first vocal-separated excerpt does not fix every dispute: its base-CTC scores for `to`, `into` and `ark` are .0377, .1012 and .0093 respectively. Do not assume separation improved confidence because it sounds conceptually useful. That stem is cropped at source second 18; add 18 to its local times before comparison.

## Conservative route order

1. Keep the current acceptance thresholds for ordinary supported words.
2. Before adding a low-score exception, try a stronger installed CTC checkpoint on the bounded difficult phrase. A candidate must preserve the exact word and have an actual acoustic score at least 0.2, source/AAC alignment spread at most 0.12 s, and independent lexical recognition. Require the base and stronger checkpoint's **onset and end** to agree within 0.08 s and 0.12 s for this replacement route. Preserve the original low score and selected measured interval; do not invent a blended confidence. Stronger-checkpoint disagreement remains unresolved.
3. A further multi-evidence route is only a proposal until tested on real positive and negative controls: exact canonical text; at least two distinct ASR checkpoint votes (one on the original mix, not just forced text); paired mix CTC agreement as above; separately produced vocal-stem evidence with its known source offset, actual CTC score at least 0.2, and paired boundary agreement within 0.12 s. Source and AAC outputs of the same recognizer do not count as two independent checkpoints. No low-scoring word passes solely because two forced aligners were given the same text.
4. Preserve existing waveform correlation, segment correlation, gain, lag and duration checks. Keep cue tolerance 0.04 s, end tolerance 0.08 s, and codec alignment spread 0.12 s. A measured timing repair requires rerender and review against the replacement MP4. Never label a word musically perfect.

These are proposed conservative bounds for explicit routes, not newly calibrated universal singing thresholds. Missing support, conflicting lexical alternatives, zero-duration acoustic intervals or boundary disagreements remain unresolved. A candidate's ASR token probability is evidence to report, not a replacement timestamp-accuracy metric.

## Two existing contract issues to address separately

The existing `crossModelBoundaryDelta` uses the smallest difference across any matching onset **or** end. This was introduced to corroborate words whose ASR onset absorbed an instrumental pause. It must not be reused as the paired-boundary condition for a new fallback: the actual `God` example would conceal a 3.4-second onset disagreement if only its release were considered. Keep onset and release evidence distinct.

Long review windows add context before and after a group of canonical words. Exact equality against only the group's text can reject correctly recognized adjacent lyrics. Context-aware trimming must match known neighboring canonical words and their sequence positions. It may discard an identified prefix/suffix from outside the scored group; it must not erase substitutions, omissions, internal insertions, or ambiguous repeated-word matches to manufacture equality. Record the full recognized sequence and discarded context IDs.

A raw ASR token with zero duration should retain its text, confidence and diagnostics as lexical-only evidence; it cannot corroborate a boundary or become a timing repair. Rejecting an entire otherwise useful recognition pass loses that distinction. Acoustic zero-duration intervals must still fail timing support.

## Required test cases before enabling a new route

| Fixture | Required result |
|---|---|
| Low base / high stronger score, exact recognized word, paired boundaries inside .08/.12, verified AAC round-trip | Candidate may pass the explicit stronger-checkpoint route |
| Actual `ark` scores and .721 s release disagreement | Fail; no repair interval manufactured |
| Actual `earth` placement discrepancy | Fail despite stronger score exceeding .2 |
| Actual `God` onset discrepancy with matching end | Fail paired-boundary route |
| Two forced aligners supplied the same word but no free recognizer support | Fail |
| Two source/AAC passes from the same ASR checkpoint | One checkpoint vote, not two |
| Stem evidence without a recorded source offset or with shifted timing | Fail |
| Stem remains below .2, as in the measured `ark` example | No stem-supported exception |
| Both ASR checkpoints agree on a different literal word | Fail canonical-content gate; preserve discrepancy |
| Correct neighboring prefix/suffix outside the scored window | Preserve evidence, trim only proven context, keep core exact |
| An extra token inside the scored group or ambiguous repeated-word alignment | Fail, rather than filtering it away |
| Zero-duration ASR token | Retain lexical diagnostics; exclude it from boundary support |
| Proposed repaired word or source asset changes before publication | Refuse stale approval and rerender/review |

The audio agent owns implementation and full-song acoustic measurement. This document and its comparisons support that work without changing the production gates or declaring unresolved timings verified.
