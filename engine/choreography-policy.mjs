/** Structural variety is necessary, but is not a certificate of artistic quality. */
export const CHOREOGRAPHY_POLICY = Object.freeze({ version: 1, minDistinct: 30, maxUses: 3, noRepeatedTriples: true });

const clean = value => typeof value === 'string' ? value.trim() : '';
const normalized = value => clean(value).toLowerCase().replace(/\s+/g, ' ');

function catalogIds(catalog) {
  if (catalog === undefined) return null;
  if (catalog instanceof Map || catalog instanceof Set) return new Set(catalog.keys());
  if (Array.isArray(catalog)) return new Set(catalog.map(entry => typeof entry === 'string' ? entry : entry?.id));
  if (catalog && typeof catalog === 'object') return new Set(Object.keys(catalog));
  throw new TypeError('Choreography catalog must be an object, Map, Set, or array');
}

/**
 * Audit explicit primary treatments on lyric scenes without changing the project.
 * A scene uses direction.choreography (a catalog ID or { id }), or a preserved
 * bespoke direction.authoredTreatment: { id, description }. Background modes,
 * image IDs, random seeds, font choices and parameter variations do not invent
 * additional treatments. Instrumentals break adjacency/trigram windows and are
 * excluded from counts; the same trigram in separate runs is still repetition.
 *
 * `sequences` contains contiguous lyric runs as arrays of { sectionId, id }.
 * An invalid or missing descriptor has id:null, preserving its actual position.
 */
export function auditChoreography(project, { catalog } = {}) {
  const requested = project?.creation?.creativePolicy?.choreography;
  const required = requested !== undefined && requested !== null && requested !== false;
  const policy = { ...CHOREOGRAPHY_POLICY, ...(requested && typeof requested === 'object' ? requested : {}) };
  const knownIds = catalogIds(catalog), issues = [], counts = new Map(), legacyModes = new Map();
  const sequences = [], missing = [], authoredDescriptions = new Map();
  let run = [], total = 0;
  const issue = message => { if (required) issues.push(message); };
  const endRun = () => { if (run.length) sequences.push(run); run = []; };
  if (required && (!requested || typeof requested !== 'object' || Array.isArray(requested))) issue('Choreography policy must be an object');
  if (required && policy.version !== 1) issue(`Unsupported choreography policy version: ${policy.version}`);
  for (const field of ['minDistinct', 'maxUses']) if (!Number.isInteger(policy[field]) || policy[field] < 1) issue(`Choreography policy ${field} must be a positive integer`);
  if (typeof policy.noRepeatedTriples !== 'boolean') issue('Choreography policy noRepeatedTriples must be a boolean');

  for (const section of project?.sections ?? []) {
    if (!Array.isArray(section.wordIds) || section.wordIds.length === 0) { endRun(); continue; }
    total++;
    const direction = section.direction ?? {};
    const legacyMode = clean(direction.mode) || clean(section.style) || 'unspecified';
    legacyModes.set(legacyMode, (legacyModes.get(legacyMode) ?? 0) + 1);
    let id = null;
    // Explicit primary choreography takes precedence. An unknown primary cannot
    // be hidden by supplying an authored fallback on the same scene.
    if (direction.choreography !== undefined) {
      id = clean(typeof direction.choreography === 'string' ? direction.choreography : direction.choreography?.id) || null;
      if (!id) issue(`Scene ${section.id} has an invalid choreography descriptor`);
      else if (knownIds && !knownIds.has(id)) { issue(`Scene ${section.id} has unknown choreography "${id}"`); id = null; }
    } else if (direction.authoredTreatment !== undefined) {
      const treatment = direction.authoredTreatment;
      id = treatment && typeof treatment === 'object' ? clean(treatment.id) || null : null;
      const description = clean(treatment?.description);
      if (!id || !description) {
        issue(`Scene ${section.id} authoredTreatment requires an id and a description of its word choreography`);
        id = null;
      } else {
        const meaning = normalized(description), prior = authoredDescriptions.get(meaning);
        if (prior && prior !== id) issue(`Authored treatments "${prior}" and "${id}" share one description; renamed copies do not establish distinct choreography`);
        else authoredDescriptions.set(meaning, id);
      }
    } else missing.push(section.id);
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    run.push({ sectionId: section.id, id });
  }
  endRun();
  if (missing.length) issue(`${missing.length} lyric scene(s) lack explicit choreography or authoredTreatment: ${missing.join(', ')}`);

  const minDistinct = Math.min(policy.minDistinct, total);
  if (counts.size < minDistinct) issue(`Only ${counts.size} distinct lyric choreographies; at least ${minDistinct} required for ${total} lyric scenes`);
  for (const [id, uses] of counts) if (uses > policy.maxUses) issue(`Choreography "${id}" is used ${uses} times; maximum is ${policy.maxUses}`);

  const adjacentDuplicates = [], triples = new Map();
  for (const sequence of sequences) {
    for (let i = 1; i < sequence.length; i++) {
      const previous = sequence[i - 1], current = sequence[i];
      if (current.id && current.id === previous.id) adjacentDuplicates.push({ id: current.id, sectionIds: [previous.sectionId, current.sectionId] });
    }
    for (let i = 0; i + 2 < sequence.length; i++) {
      const slice = sequence.slice(i, i + 3), ids = slice.map(entry => entry.id);
      if (ids.some(id => !id)) continue;
      const signature = JSON.stringify(ids);
      if (!triples.has(signature)) triples.set(signature, { ids, occurrences: [] });
      triples.get(signature).occurrences.push(slice.map(entry => entry.sectionId));
    }
  }
  for (const duplicate of adjacentDuplicates) issue(`Adjacent scenes ${duplicate.sectionIds.join(' and ')} repeat choreography "${duplicate.id}"`);
  const repeatedTriples = [...triples.values()].filter(entry => entry.occurrences.length > 1);
  if (policy.noRepeatedTriples === true) for (const triple of repeatedTriples) issue(`Repeated choreography sequence ${triple.ids.join(' → ')} occurs ${triple.occurrences.length} times`);

  return {
    required, passed: issues.length === 0, issues, counts: Object.fromEntries(counts), unique: counts.size, total, sequences,
    policy, minDistinct, adjacentDuplicates, repeatedTriples, legacyModes: Object.fromEntries(legacyModes),
    limitations: ['Distinct IDs and descriptions do not prove distinct rendered motion or compelling artistry. Independent review of the encoded scenes is still required.'],
  };
}
