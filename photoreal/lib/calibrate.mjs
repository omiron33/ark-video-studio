// Calibrating the critic to Shane. A critic is only useful if it says no where he would, and yes
// where he would: claudia-bot's reviewer (docs/30-taste.md section 6, MIT, anabology) turned down 26
// of 27 chapters its owner accepted, because nobody had checked its bar against the owner's. The
// method, kept from there:
//   1. log every verdict Shane gives on a finished film (photoreal/calibration/verdicts.jsonl)
//   2. have the critic re-score each of those films blind (it never sees his verdict)
//   3. check the ranking first: accepted films must score above rejected ones (AUC >= 0.70), and in
//      films he ranked, the critic's order must follow his (Kendall tau >= 0.6)
//   4. set the bar: with both kinds of verdict, the score that best separates them; with accepted
//      films only, the 10th percentile of their scores
//   5. "ship" then means no blocking problem and a score at or over the bar (lib/critic.mjs)
// If the ranking check fails, the fix is the rubric's wording, not the numbers.

export const BARS = { minAuc: 0.70, minTau: 0.6 };

// probability that a random accepted film outscores a random rejected one (ties count half)
export function auc(accepted, rejected) {
  if (!accepted.length || !rejected.length) return null;
  let s = 0;
  for (const a of accepted) for (const r of rejected) s += a > r ? 1 : a === r ? 0.5 : 0;
  return s / (accepted.length * rejected.length);
}

// Kendall tau-b between two orderings of the same items (arrays of numbers, higher = better)
export function kendallTau(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return null;
  let c = 0, d = 0, tx = 0, ty = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = Math.sign(x[i] - x[j]), b = Math.sign(y[i] - y[j]);
    if (a === 0 && b === 0) continue;
    if (a === 0) tx++; else if (b === 0) ty++; else if (a === b) c++; else d++;
  }
  const den = Math.sqrt((c + d + tx) * (c + d + ty));
  return den ? (c - d) / den : null;
}

const pct = (arr, q) => { const s = [...arr].sort((a, b) => a - b); const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };

// the bar a film's score must reach to ship
export function threshold(accepted, rejected) {
  if (!accepted.length) return null;
  if (!rejected.length) return +pct(accepted, 0.1).toFixed(2);
  // the cut with the best balanced accuracy (accepted at or above, rejected below); ties go lower
  const cands = [...new Set([...accepted, ...rejected])].sort((a, b) => a - b);
  let best = null;
  for (const t of cands) {
    const tpr = accepted.filter((s) => s >= t).length / accepted.length;
    const tnr = rejected.filter((s) => s < t).length / rejected.length;
    const ba = (tpr + tnr) / 2;
    if (!best || ba > best.ba + 1e-9) best = { t, ba };
  }
  return best.t;
}

// One run over Shane's verdicts: rows of { film, verdict: 'accept'|'reject', rank?, score, blocking }
export function calibrate(rows, { rubricSha, bars = BARS } = {}) {
  const scored = rows.filter((r) => Number.isFinite(r.score));
  const acc = scored.filter((r) => r.verdict === 'accept'), rej = scored.filter((r) => r.verdict === 'reject');
  const A = auc(acc.map((r) => r.score), rej.map((r) => r.score));
  const ranked = scored.filter((r) => Number.isFinite(r.rank));
  // his rank 1 is his best: higher is better for both after flipping
  const tau = kendallTau(ranked.map((r) => -r.rank), ranked.map((r) => r.score));
  const t = threshold(acc.map((r) => r.score), rej.map((r) => r.score));
  const agree = scored.filter((r) => (r.verdict === 'accept') === (!r.blocking && t != null && r.score >= t)).length;
  const problems = [];
  if (A != null && A < bars.minAuc) problems.push(`the critic doesn't separate his accepted films from his rejected ones (AUC ${A.toFixed(2)}, needs ${bars.minAuc}): fix the rubric's wording before trusting its scores`);
  if (tau != null && tau < bars.minTau) problems.push(`the critic's order doesn't follow his ranking (Kendall tau ${tau.toFixed(2)}, needs ${bars.minTau}): fix the rubric's wording`);
  const blockedAccepted = acc.filter((r) => r.blocking);
  if (blockedAccepted.length) problems.push(`the critic found blocking problems in films he accepted (${blockedAccepted.map((r) => r.film).join(', ')}): its blocking list is stricter than he is there`);
  if (!acc.length) problems.push('no accepted film was scored, so there is no bar yet');
  return {
    rubricSha, at: new Date().toISOString(), films: scored.length, accepted: acc.length, rejected: rej.length,
    auc: A == null ? null : +A.toFixed(3), tau: tau == null ? null : +tau.toFixed(3), threshold: problems.some((p) => /fix the rubric|no accepted/.test(p)) ? null : t,
    agreement: `${agree} of ${scored.length} films`, ok: !problems.length, problems,
    rows: scored.map((r) => ({ film: r.film, verdict: r.verdict, rank: r.rank ?? null, score: r.score, blocking: r.blocking })),
  };
}
