import test from 'node:test';
import assert from 'node:assert/strict';
import { CREATIVE_POLICY, planCreativePolicy, reviewCreativePolicy } from '../engine/creative-policy.mjs';

function fixture() {
  return { title: 'Creative fixture', duration: 4, fps: 30, words: [], beats: [], assets: {}, sections: [{ id: 'scene', style: 'verse', start: 0, end: 4, wordIds: [], assetIds: [], direction: {}, seed: 1 }] };
}

test('legacy manifests do not acquire new creative gates or mutations', async () => {
  const p = fixture(), before = structuredClone(p);
  const review = await reviewCreativePolicy(p, '/unused/project.json');
  assert.equal(review.required, false); assert.equal(review.passed, true); assert.deepEqual(p, before);
});

test('creative replanning cannot silently remove an authored choreography gate',()=>{
 const p=fixture();p.creation={creativePolicy:{...CREATIVE_POLICY,choreography:{version:1,minDistinct:30,maxUses:3,noRepeatedTriples:true}}};
 assert.deepEqual(planCreativePolicy(p).project.creation.creativePolicy.choreography,p.creation.creativePolicy.choreography);
});

test('photographic requirements survive replacing direction and cannot be satisfied by dropping per-scene flags', async () => {
  const p = fixture(); p.creation = { interpreted: { photo: true }, creativePolicy: { ...CREATIVE_POLICY } };
  const planned = planCreativePolicy(p).project;
  assert.deepEqual(planned.creation.creativePolicy.requiredArtworkSections, ['scene']);
  delete planned.sections[0].direction.photoRequired;
  let review = await reviewCreativePolicy(planned, '/unused/project.json');
  assert.equal(review.passed, false); assert.equal(review.assetRequests[0].sectionId, 'scene');
  planned.creation.interpreted.photo = false;
  review = await reviewCreativePolicy(planned, '/unused/project.json');
  assert.equal(review.passed, false, 'persistent policy retains the required scene');
  delete planned.sections[0].direction.pacing;
  assert.match((await reviewCreativePolicy(planned, '/unused/project.json')).issues.join(' '), /no required visual pacing/);
});
