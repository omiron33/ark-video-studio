/** Evidence-led phrasing for new films. This edits visual direction only: source
 * words, beat events, section boundaries and asset dependencies are immutable. */
export const PACING_POLICY = 'measured-phrase-contrast-v1';
export const PACING_MODES = ['flow', 'accent-burst', 'held', 'slow-dissolve', 'opening-hook'];
const finite = Number.isFinite;
const round = n => Number(n.toFixed(6));
const calmStyles = new Set(['verse', 'impact']);
const calmStoryModes = new Set(['statement', 'breath', 'silence', 'shelter', 'horizon']);
const isCalmCompatible = s => !s.direction?.actions?.length && (calmStyles.has(s.style) || (s.style === 'story' && calmStoryModes.has(s.direction?.mode)));
const usableWord = w => w.confidence !== false && w.confidence !== 'interpolated' && !(finite(w.confidence) && w.confidence < .5);
const measuredBeat = b => b && finite(b.time) && finite(b.strength) && b.strength >= .45 && b.kind === 'measured_onset' && b.provenance?.tempoGrid !== true && !/synthetic|interpolat|grid/i.test(b.provenance?.method || '');
const sceneWords = (p, s) => p.words.filter(w => s.wordIds.includes(w.id)).sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
function openingHook(project) {
  const s = project.sections[0]; if (!s) return null;
  const firstVocalAt = project.words.length ? Math.min(...project.words.map(w => w.start)) : null;
  const end = Math.min(s.end, firstVocalAt ?? s.end) - (firstVocalAt !== null && firstVocalAt <= s.end ? .12 : 0);
  const duration = end - s.start;
  if (duration < 1) return null;
  const title = String(s.direction?.title || project.title || '').trim();
  if (!title) return null;
  return { title, start: s.start, end: round(end), settleAt: round(s.start + Math.min(.8, duration * .24)), transformAt: round(s.start + Math.min(1.5, duration * .42)), releaseAt: round(end - Math.min(.32, duration * .18)), firstVocalAt };
}
function sceneEvidence(project, scene) {
  const words = sceneWords(project, scene), duration = scene.end - scene.start;
  const lastEnd = Math.max(scene.start, ...words.map(w => w.end));
  const sustained = words.reduce((best, w) => w.end - w.start > (best ? best.end - best.start : 0) ? w : best, null);
  return { sectionId: scene.id, duration: round(duration), wordCount: words.length, density: round(words.length / duration), phraseIds: [...new Set(words.map(w => w.phraseId).filter(Boolean))], lastWordEnd: round(lastEnd), readingTail: round(Math.max(0, scene.end - lastEnd)), longestSustain: sustained ? { wordId: sustained.id, start: sustained.start, end: sustained.end, duration: round(sustained.end - sustained.start) } : null, calmCompatible: isCalmCompatible(scene) };
}
function burstCandidates(project, scene) {
  const words = sceneWords(project, scene), result = [];
  const beats = project.beats.map((b, beatIndex) => ({ ...b, beatIndex })).filter(b => measuredBeat(b) && b.time >= scene.start && b.time < scene.end);
  for (let i = 0; i + 2 < words.length; i++) {
    const trio = words.slice(i, i + 3), gaps = [trio[1].start - trio[0].start, trio[2].start - trio[1].start];
    if (!trio.every(usableWord) || trio.some(w => w.end - w.start < .10) || gaps.some(g => g < .16 - 1e-6 || g > .50 + 1e-6)) continue;
    if (trio.some(w => w.phraseId) && new Set(trio.map(w => w.phraseId)).size !== 1) continue;
    if (scene.end - trio[2].start < .32) continue;
    const hits = trio.map(w => {
      // The word is never revealed early to meet a beat; only a following real
      // accent can reinforce its already-canonical vocal onset.
      const b = beats.filter(b => b.time >= w.start - 1e-6 && b.time - w.start <= .09 + 1e-6).sort((a, b) => b.strength - a.strength || a.time - b.time)[0];
      return b ? { wordId: w.id, at: b.time, beatIndex: b.beatIndex, beatTime: b.time, beatStrength: b.strength, beatKind: b.kind, onsetDelta: round(b.time - w.start) } : null;
    });
    if (hits.some(h => !h) || new Set(hits.map(h => h.beatIndex)).size !== 3) continue;
    result.push({ hits, score: round(hits.reduce((n, h) => n + h.beatStrength, 0) / 3), start: hits[0].at, end: hits[2].at });
  }
  return result.sort((a, b) => b.score - a.score || a.start - b.start);
}
export function planPacing(project, { stylePrompt = '' } = {}) {
  const result = structuredClone(project), scenes = result.sections.map(s => sceneEvidence(result, s));
  const hook = openingHook(result);
  const candidates = result.sections.flatMap((s, index) => index === 0 && hook ? [] : burstCandidates(result, s).map(b => ({ ...b, index, sectionId: s.id })));
  const chosen = [];
  for (const c of candidates.sort((a, b) => b.score - a.score || a.start - b.start)) {
    if (chosen.some(x => Math.abs(x.index - c.index) < 3 || Math.abs(x.start - c.start) < 8)) continue;
    chosen.push(c);
  }
  const decisions = [];
  let precedingFlowSeconds = 0;
  for (const [i, scene] of result.sections.entries()) {
    const e = scenes[i], burst = chosen.find(c => c.index === i), previous = decisions.at(-1)?.mode;
    let mode = 'flow', rationale = 'Keep the authored visual phrase; no supported contrast opportunity justifies interrupting it.', extra = {};
    if (i === 0 && hook) {
      mode = 'opening-hook'; extra = { hook };
      rationale = 'Use the real song or authored chapter title for immediate kinetic action, then transform the composition throughout the instrumental runway and clear it before the first vocal. No lyric or musical accent is invented.';
    } else if (burst) {
      mode = 'accent-burst'; extra = { hits: burst.hits, pulseSeconds: .16 };
      rationale = 'Three consecutive sung words each coincide with a distinct measured attack; use three restrained word and geometry hits, then retain the complete phrase for reading.';
    } else if (e.calmCompatible && previous === 'accent-burst' && e.duration >= 2.8 && e.density <= 2) {
      mode = 'held'; extra = { backgroundRate: .08 };
      rationale = 'Release the preceding three-hit phrase into a quieter composition while preserving every vocal onset.';
    } else if (e.calmCompatible && previous !== 'slow-dissolve' && e.duration >= 4 && (e.readingTail >= 1.3 || (e.longestSustain?.duration || 0) >= 1.1 || !e.wordCount)) {
      mode = 'slow-dissolve';
      const at = Math.min(scene.end - 2, Math.max(scene.start + .6, !e.wordCount ? scene.start + .6 : e.readingTail >= 1.3 ? e.lastWordEnd - .55 : e.longestSustain.start));
      extra = { dissolve: { start: round(at), duration: round(Math.min(2.8, scene.end - at)), motif: scene.direction?.motif === 'contours' ? 'waves' : 'contours' }, backgroundRate: .15 };
      rationale = !e.wordCount ? 'The instrumental space supports a slow scene-local background transformation.' : 'A sustained lyric or phrase-ending breath supports a slow background dissolve; the lyric layer remains fully independent.';
    } else if (e.calmCompatible && !['held', 'slow-dissolve'].includes(previous) && e.duration >= 3.2 && e.density <= 1.4 && (e.readingTail >= .7 || (e.longestSustain?.duration || 0) >= .9)) {
      mode = 'held'; extra = { backgroundRate: .08 };
      rationale = 'The measured phrase has space to settle; hold its composition and let the sustained words carry the moment.';
    } else if (e.calmCompatible && precedingFlowSeconds >= 12 && e.duration >= 2.5 && e.wordCount >= 2 && e.wordCount <= 12 && e.density <= 2.8 && (precedingFlowSeconds >= 20 || scenes.slice(i + 1, i + 3).every(next => !next.calmCompatible || next.density >= e.density))) {
      // A steady vocal does not demand equally steady background animation.
      // Choose an actual complete phrase at a local density trough once a long
      // run has earned contrast, even when no silence or accent triplet exists.
      const photo = scene.direction?.photo || scene.assetIds.find(id => result.assets[id]?.type === 'image');
      if (photo && e.duration >= 4) {
        mode = 'slow-dissolve'; extra = { backgroundRate: .15, dissolve: { start: round(scene.start + .6), duration: round(Math.min(2.8, e.duration - .8)), motif: scene.direction?.motif === 'contours' ? 'waves' : 'contours' } };
      } else { mode = 'held'; extra = { backgroundRate: .08 }; }
      rationale = `After ${round(precedingFlowSeconds)} seconds of uninterrupted flow, this complete, action-free phrase provides a readable change in supporting motion. Every sung word continues at its canonical onset; no silence or beat accent is claimed.`;
    }
    scene.direction = { ...scene.direction, pacing: { version: 1, policy: PACING_POLICY, mode, rationale, ...extra } };
    decisions.push({ ...e, mode, rationale, precedingFlowSeconds: round(precedingFlowSeconds), ...(burst ? { hits: burst.hits } : {}), ...(extra.dissolve ? { dissolve: extra.dissolve } : {}), ...(extra.hook ? { hook: extra.hook } : {}) });
    precedingFlowSeconds = mode === 'flow' ? precedingFlowSeconds + e.duration : 0;
  }
  return { project: result, evidence: { policy: PACING_POLICY, method: 'deterministic-evidence-led-visual-phrasing', stylePrompt, scenes: decisions, supportedBurstCandidates: candidates.length, ...auditPacing(result).evidence, limitations: ['This is a bounded visual phrasing plan, not a creativity score or listening approval.', 'Measured attacks support visual accents; they do not certify vocal alignment.', 'No lyric, musical event, scene interval or artwork was created or retimed.'] } };
}
export function auditPacing(project) {
  const errors = [], warnings = [], scenes = [], counts = Object.fromEntries(PACING_MODES.map(m => [m, 0]));
  let runMode, runStart = 0, runLength = 0;
  const bursts = [];
  const expectedHook = openingHook(project);
  if (project.creation?.creativePolicy?.immediateOpening === true && expectedHook && project.sections[0]?.direction?.pacing?.mode !== 'opening-hook') errors.push('Instrumental opening requires an immediate kinetic opening hook; a held photograph or slow pan alone cannot satisfy the future-film policy.');
  for (const [i, s] of project.sections.entries()) {
    const pacing = s.direction?.pacing;
    if (!pacing) { scenes.push({ sectionId: s.id, mode: 'legacy-unplanned' }); continue; }
    const prefix = `Section ${s.id}: `;
    if (pacing.version !== 1 || !PACING_MODES.includes(pacing.mode)) { errors.push(prefix + 'unsupported pacing version or mode'); continue; }
    counts[pacing.mode]++;
    const evidence = sceneEvidence(project, s); scenes.push({ ...evidence, mode: pacing.mode, rationale: pacing.rationale });
    if (typeof pacing.rationale !== 'string' || !pacing.rationale.trim()) errors.push(prefix + 'pacing requires a stated reason');
    if (['held', 'slow-dissolve'].includes(pacing.mode)) {
      if (!isCalmCompatible(s)) errors.push(prefix + 'calm pacing must not suppress an authored semantic action');
      if (!finite(pacing.backgroundRate) || pacing.backgroundRate < 0 || pacing.backgroundRate > .3) errors.push(prefix + 'calm backgroundRate must be between 0 and .3');
    }
    if (pacing.mode === 'slow-dissolve') {
      const d = pacing.dissolve;
      if (!d || !finite(d.start) || !finite(d.duration) || d.duration < 1.5 || d.start < s.start || d.start + d.duration > s.end + 1e-6 || !['contours', 'waves'].includes(d.motif)) errors.push(prefix + 'slow dissolve must last at least 1.5 seconds within this scene and use a supported scene-local motif');
    }
    if (pacing.mode === 'opening-hook') {
      const h = pacing.hook;
      if (i !== 0 || !expectedHook || !h || ['title', 'start', 'end', 'settleAt', 'transformAt', 'releaseAt', 'firstVocalAt'].some(field => h[field] !== expectedHook[field])) errors.push(prefix + 'opening hook must use the actual title and current instrumental interval, clearing before the first canonical vocal');
      if (pacing.hits?.length) errors.push(prefix + 'opening hook cannot invent word hits or musical accents');
      scenes.at(-1).hook = h;
    }
    if (pacing.mode === 'accent-burst') {
      const valid = burstCandidates(project, s), hits = pacing.hits;
      const sameHits = (a, b) => a.length === b.length && a.every((h, k) => b[k] && ['wordId', 'at', 'beatIndex', 'beatTime', 'beatStrength', 'beatKind', 'onsetDelta'].every(field => h[field] === b[k][field]));
      if (!Array.isArray(hits) || !valid.some(c => sameHits(c.hits, hits))) errors.push(prefix + 'three-hit burst lacks matching canonical words and distinct measured accents');
      if (!finite(pacing.pulseSeconds) || pacing.pulseSeconds < .08 || pacing.pulseSeconds > .20) errors.push(prefix + 'burst pulseSeconds must be .08–.20');
      if (Array.isArray(hits) && hits[0] && finite(hits[0].at)) bursts.push({ index: i, start: hits[0].at, sectionId: s.id });
    }
    if (pacing.mode === runMode) runLength++; else { runMode = pacing.mode; runLength = 1; runStart = s.start; }
    if (runLength === 6 && s.end - runStart >= 20) warnings.push(`Scenes through ${s.id} sustain ${pacing.mode} pacing for at least 20 seconds; inspect the encoded film for monotonous phrasing.`);
  }
  for (let i = 1; i < bursts.length; i++) if (bursts[i].index - bursts[i - 1].index < 3 || bursts[i].start - bursts[i - 1].start < 8) warnings.push(`Bursts ${bursts[i - 1].sectionId} and ${bursts[i].sectionId} are close; verify their impact is not diluted by repetition.`);
  if (project.sections.length >= 6 && counts['accent-burst'] === 0) warnings.push('No supported three-word accent burst is planned; do not invent beats to force one. Review phrase contrast through holds, semantic motion and scene length.');
  return { passed: errors.length === 0, status: errors.length ? 'invalid-pacing' : scenes.every(s => s.mode === 'legacy-unplanned') ? 'not-planned' : 'supported-plan', issues: errors, errors, warnings, evidence: { policy: PACING_POLICY, counts, scenes, limits: { onsetToleranceSeconds: .09, wordGapSeconds: [.16, .50], burstCooldownSeconds: 8, burstSceneSeparation: 3 }, aestheticApproval: false } };
}
