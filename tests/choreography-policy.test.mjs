import test from 'node:test';
import assert from 'node:assert/strict';
import { auditChoreography, CHOREOGRAPHY_POLICY } from '../engine/choreography-policy.mjs';

function fixture(ids, overrides = {}) {
  return {
    creation: { creativePolicy: { choreography: { ...CHOREOGRAPHY_POLICY, ...overrides } } },
    sections: ids.map((id, i) => ({ id: `scene-${i}`, start: i * 4, end: (i + 1) * 4, style: 'story', wordIds: [`word-${i}`], direction: { choreography: id } })),
  };
}

test('legacy manifests remain ungated and no project or catalog is mutated', () => {
  const p = fixture(['path', 'path']); delete p.creation;
  const before = structuredClone(p), catalog = new Set(['path']);
  const review = auditChoreography(p, { catalog });
  assert.equal(review.required, false); assert.equal(review.passed, true); assert.deepEqual(review.issues, []);
  assert.deepEqual(p, before); assert.deepEqual([...catalog], ['path']);
  assert.equal(review.total, 2); assert.equal(review.counts.path, 2);
  assert.equal(review.adjacentDuplicates.length, 1, 'factual measurements remain available without imposing a new gate');
});

test('the old fracture31 background sequence cannot count as 31 authored animations', () => {
  const p = fixture(Array(31).fill(undefined));
  for (const section of p.sections) section.direction = { mode: 'fracture', photo: `unique-photo-${section.id}` };
  const review = auditChoreography(p);
  assert.equal(review.passed, false); assert.equal(review.unique, 0); assert.equal(review.total, 31);
  assert.equal(review.legacyModes.fracture, 31); assert.match(review.issues.join(' '), /lack explicit choreography/);
  assert.match(review.issues.join(' '), /at least 30 required/);
});

test('thirty distinct registered treatments pass a short-film-scaled requirement', () => {
  const ids = Array.from({ length: 30 }, (_, i) => `treatment-${i}`), p = fixture(ids), before = structuredClone(p);
  const result = auditChoreography(p, { catalog: Object.fromEntries(ids.map(id => [id, { description: id }])) });
  assert.equal(result.passed, true); assert.equal(result.unique, 30); assert.equal(result.minDistinct, 30);
  assert.deepEqual(p, before);
  const short = auditChoreography(fixture(['path', 'fold', 'press']));
  assert.equal(short.passed, true); assert.equal(short.minDistinct, 3);
});

test('an 82-scene film needs thirty IDs and may use each at most three times', () => {
  // Rotate the sequence in each pass so the numerical max cannot conceal a loop.
  const ids = Array.from({ length: 30 }, (_, i) => `t${i}`);
  const second = ids.filter((_, i) => i % 2 === 0).concat(ids.filter((_, i) => i % 2 === 1));
  const third = ['t5', 't16', 't27', 't8', 't19', 't0', 't11', 't22', 't3', 't14', 't25', 't6', 't17', 't28', 't9', 't20', 't1', 't12', 't23', 't4', 't15', 't26'];
  const result = auditChoreography(fixture([...ids, ...second, ...third]));
  assert.equal(result.passed, true, result.issues.join('\n')); assert.equal(result.total, 82); assert.equal(result.unique, 30);
  assert.equal(Math.max(...Object.values(result.counts)), 3);
  const bad = fixture(['path', 'orbit', 'press', 'path', 'fold', 'tilt', 'path', 'split', 'rise', 'path'], { minDistinct: 1 });
  assert.match(auditChoreography(bad).issues.join(' '), /"path" is used 4 times; maximum is 3/);
});

test('a repeated three-animation cycle fails even though every ID respects maxUses', () => {
  const result = auditChoreography(fixture(['path', 'fold', 'press', 'path', 'fold', 'press', 'path', 'fold', 'press'], { minDistinct: 3 }));
  assert.equal(result.passed, false); assert.deepEqual(result.counts, { path: 3, fold: 3, press: 3 });
  assert.equal(result.adjacentDuplicates.length, 0);
  assert.ok(result.repeatedTriples.some(entry => entry.ids.join(',') === 'path,fold,press' && entry.occurrences.length === 3));
  assert.match(result.issues.join(' '), /Repeated choreography sequence/);
});

test('adjacent duplicates fail independently of the trigram option', () => {
  const result = auditChoreography(fixture(['path', 'path', 'fold'], { minDistinct: 2, noRepeatedTriples: false }));
  assert.equal(result.passed, false); assert.equal(result.adjacentDuplicates.length, 1);
  assert.deepEqual(result.adjacentDuplicates[0].sectionIds, ['scene-0', 'scene-1']);
});

test('instrumentals exclude title IDs and break adjacency and trigram windows', () => {
  const p = fixture(['a', 'b', 'title', 'c', 'a', 'b', 'title', 'c'], { minDistinct: 3 });
  for (const i of [2, 6]) p.sections[i].wordIds = [];
  const result = auditChoreography(p);
  assert.equal(result.passed, true, result.issues.join('\n')); assert.equal(result.total, 6); assert.equal(result.counts.title, undefined);
  assert.deepEqual(result.sequences.map(run => run.map(entry => entry.id)), [['a', 'b'], ['c', 'a', 'b'], ['c']]);
  assert.equal(result.repeatedTriples.length, 0);
  const duplicateAcrossBreak = fixture(['a', 'title', 'a'], { minDistinct: 1 }); duplicateAcrossBreak.sections[1].wordIds = [];
  assert.equal(auditChoreography(duplicateAcrossBreak).passed, true);
});

test('identical trigrams within separate runs are still reported, without bridging the break', () => {
  const p = fixture(['a', 'b', 'c', 'title', 'a', 'b', 'c'], { minDistinct: 3 }); p.sections[3].wordIds = [];
  const result = auditChoreography(p);
  assert.equal(result.passed, false); assert.equal(result.repeatedTriples.length, 1);
  assert.deepEqual(result.repeatedTriples[0].ids, ['a', 'b', 'c']);
});

test('unknown catalog IDs fail and cannot be concealed behind authoredTreatment', () => {
  for (const catalog of [{ path: {} }, new Map([['path', {}]]), new Set(['path']), ['path'], [{ id: 'path' }]]) {
    const p = fixture(['path', 'unknown']);
    p.sections[1].direction.authoredTreatment = { id: 'fight', description: 'Words recoil above the visible club strike.' };
    const result = auditChoreography(p, { catalog });
    assert.equal(result.passed, false); assert.equal(result.unique, 1); assert.match(result.issues.join(' '), /unknown choreography "unknown"/);
  }
});

test('preserved fight and judgment require explicit described word treatments', () => {
  const p = fixture([undefined, undefined]);
  p.sections[0].direction = { photo: 'fight', authoredTreatment: { id: 'fight-recoil', description: 'The killing words strike and recoil above the photographed struggle.' } };
  p.sections[1].direction = { photo: 'judgment', authoredTreatment: { id: 'judgment-weight', description: 'The accusing question enlarges and settles against the divine figure.' } };
  assert.equal(auditChoreography(p, { catalog: {} }).passed, true);
  p.sections[0].direction.authoredTreatment = 'fight';
  const missingDescription = auditChoreography(p);
  assert.equal(missingDescription.passed, false); assert.match(missingDescription.issues.join(' '), /requires an id and a description/);
  p.sections[0].direction.authoredTreatment = { id: 'another-name', description: p.sections[1].direction.authoredTreatment.description };
  assert.match(auditChoreography(p).issues.join(' '), /renamed copies do not establish distinct choreography/);
});

test('empty projects and malformed policies have explicit outcomes', () => {
  const empty = auditChoreography(fixture([]));
  assert.equal(empty.passed, true); assert.equal(empty.total, 0); assert.equal(empty.minDistinct, 0);
  for (const patch of [{ version: 2 }, { minDistinct: 0 }, { maxUses: 1.5 }, { noRepeatedTriples: 'yes' }]) {
    assert.equal(auditChoreography(fixture(['a'], patch)).passed, false);
  }
});
