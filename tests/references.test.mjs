import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink, unlink, stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createCanvas, loadImage} from '@napi-rs/canvas';
import {loadReferenceLibrary, searchReferences, referenceContext, validateReferenceCard, captureReference, DEFAULT_REFERENCE_LIBRARY} from '../engine/references.mjs';
import {runProcess} from '../engine/export.mjs';
import {fileHash} from '../engine/project.mjs';

const jpeg = createCanvas(64, 36).toBuffer('image/jpeg');
async function temporary(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ark-reference-test-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  return root;
}
function reference(id, {tags = ['lineage'], intent = ['Reveal ancestry'], title = 'Branches across generations', start = 0, end = 8, source = {}, quality = {}, motion = {}} = {}) {
  return {version: 1, id, title, source: {kind: 'internal', path: '/historical/render.mp4', videoSha256: 'a'.repeat(64), start, end, ...source}, intent, tags,
    motion: {summary: 'A parent shape unfolds into connected descendants.', phases: ['Establish the parent.', 'Unfold relationships.', 'Hold the resulting tree.'], transferablePrinciple: 'Show relationships by revealing space.', variations: ['Change the material and spatial organization.'], cautions: ['Leave time to read names.'], ...motion},
    quality: {status: 'observed', reviewer: 'Fixture observation', strengths: ['Clear relation between parts.'], limitations: ['Sampled stills do not prove smooth motion.'], userPreference: 'unknown', ...quality},
    frames: Array.from({length: 4}, (_, i) => ({path: `images/${id}/frame-${i}.jpg`, timeSeconds: start + (end - start) * i / 4})), contactSheet: `images/${id}/sheet.jpg`};
}
async function seed(root, card) {
  await mkdir(path.join(root, 'cards'), {recursive: true});
  await mkdir(path.join(root, 'images', card.id), {recursive: true});
  for (const name of [...card.frames.map(frame => frame.path), card.contactSheet]) await writeFile(path.join(root, name), jpeg);
  await writeFile(path.join(root, 'cards', `${card.id}.json`), JSON.stringify(card));
}

test('concept retrieval matches relevant ideas, preserves attributed quality, and has no random fallback', async t => {
  const root = await temporary(t);
  const tree = reference('lineage');
  await seed(root, tree);
  await seed(root, reference('rejected', {quality: {userPreference: 'avoid'}}));
  const result = await searchReferences({libraryRoot: root, query: 'family inheritance'});
  assert.deepEqual(result.results.map(hit => hit.card.id), ['lineage']);
  assert.ok(result.results[0].fit.matchedConcepts.some(match => match.kind === 'related'));
  assert.deepEqual(result.results[0].card.quality, tree.quality);
  assert.equal('rating' in result.results[0].fit, false);
  assert.deepEqual(result, await searchReferences({libraryRoot: root, query: 'family inheritance'}));
  for (const query of ['', 'the video animation reference', 'his her him hers he she theirs us me my mine its ours', 'cryptographic provisioning zirconium']) assert.deepEqual((await searchReferences({libraryRoot: root, query})).results, []);
  await assert.rejects(searchReferences({libraryRoot: root, query: 'family', duration: -1}), /positive/);
  await assert.rejects(searchReferences({libraryRoot: root, query: 'family', limit: 999}), /limit/);
});

test('scene duration, prior uses and selected-card diversity affect fit, never source quality', async t => {
  const root = await temporary(t);
  for (const card of [reference('brief', {end: 3}), reference('long', {end: 24}), reference('different-artifact', {end: 3, source: {videoSha256: 'b'.repeat(64)}})]) await seed(root, card);
  const short = await searchReferences({libraryRoot: root, query: 'lineage', duration: 3});
  assert.equal(short.results[0].card.id, 'brief');
  assert.equal(short.results[0].fit.durationFit, 1);
  assert.equal(short.results[1].card.id, 'different-artifact');
  assert.ok(short.results[1].fit.diversityPenalty > 0);
  const repeated = await searchReferences({libraryRoot: root, query: 'lineage', duration: 3, usedIds: ['brief', 'brief']});
  assert.equal(repeated.results[0].card.id, 'different-artifact');
  const brief = repeated.results.find(hit => hit.card.id === 'brief');
  assert.ok(brief.fit.repetitionPenalty > .8);
  assert.equal(brief.card.quality.userPreference, 'unknown');
});

test('narrative concepts find transferable motion and documented variations without relabeling the source', async t => {
  const root = await temporary(t);
  const release = reference('open-space', {title: 'Enclosing shapes separate', tags: ['release'], intent: ['Release from enclosure'], motion: {summary: 'Enclosing shapes separate to leave open space.', transferablePrinciple: 'Turn a barrier into room to move.', phases: ['Establish a barrier.', 'Separate the shapes.'], variations: ['Change the material and geometry.']}});
  const texture = reference('microtype-texture', {title: 'Tiny marks describe a silhouette', tags: ['microtype'], intent: ['Build an image from marks'], motion: {summary: 'Small marks give a silhouette its texture.', transferablePrinciple: 'Let each small mark carry part of the larger subject.', phases: ['Establish the marks.', 'Reveal the silhouette.'], variations: ['Use ancestry records as the texture of an original portrait.']}});
  await seed(root, release); await seed(root, texture);
  assert.ok(!JSON.stringify(release).includes('forgiveness'));
  const forgiveness = await searchReferences({libraryRoot: root, query: 'forgiveness'});
  assert.deepEqual(forgiveness.results.map(hit => hit.card.id), ['open-space']);
  assert.ok(forgiveness.results[0].fit.matchedConcepts.some(match => match.referenceTerm === 'release' && match.kind === 'related'));
  assert.deepEqual(forgiveness.results[0].card.intent, release.intent);
  assert.deepEqual(forgiveness.results[0].card.quality, release.quality);
  const ancestry = await searchReferences({libraryRoot: root, query: 'ancestry'});
  assert.deepEqual(ancestry.results.map(hit => hit.card.id), ['microtype-texture']);
  assert.equal(ancestry.results[0].fit.lexicalScore, .8);
});

test('schema rejects fabricated or incomplete provenance and invalid sample ranges', async t => {
  const root = await temporary(t), card = reference('valid');
  await seed(root, card);
  assert.equal((await validateReferenceCard(card, {libraryRoot: root})).id, 'valid');
  for (const mutate of [
    value => { delete value.source.videoSha256; },
    value => { value.source.videoSha256 = 'unknown'; },
    value => { delete value.source.path; },
    value => { value.source = {...value.source, kind: 'external', url: 'file:///etc/passwd'}; },
    value => { value.source = {...value.source, kind: 'external', url: 'https://user:password@example.com/video'}; },
    value => { value.source.end = value.source.start; },
    value => { value.frames[3].timeSeconds = value.source.end; },
    value => { value.frames[1].timeSeconds = value.frames[0].timeSeconds; },
    value => { value.frames[0].path = '../escape.jpg'; },
    value => { value.frames[0].path = 'images/another-id/escape.jpg'; },
    value => { value.contactSheet = value.frames[0].path; },
    value => { value.quality.status = 'awesome'; },
    value => { value.motion.cautions = []; },
  ]) {
    const value = structuredClone(card); mutate(value);
    await assert.rejects(validateReferenceCard(value, {libraryRoot: root}));
  }
  const external = {...card, source: {...card.source, kind: 'external', url: 'https://example.com/watch?v=original'}};
  delete external.source.path;
  await validateReferenceCard(external, {libraryRoot: root});
});

test('loader skips bad cards with evidence, and rejects card or image symlink escapes', async t => {
  const root = await temporary(t), outside = await temporary(t);
  await seed(root, reference('good'));
  await writeFile(path.join(root, 'cards', 'broken.json'), '{');
  await writeFile(path.join(outside, 'secret.json'), JSON.stringify(reference('outside')));
  await symlink(path.join(outside, 'secret.json'), path.join(root, 'cards', 'outside.json'));
  const compromised = reference('compromised'); await seed(root, compromised);
  await writeFile(path.join(outside, 'picture.jpg'), jpeg);
  await unlink(path.join(root, compromised.contactSheet));
  await symlink(path.join(outside, 'picture.jpg'), path.join(root, compromised.contactSheet));
  const loaded = await loadReferenceLibrary({libraryRoot: root});
  assert.deepEqual(loaded.cards.map(card => card.id), ['good']);
  assert.equal(loaded.warnings.length, 3);
  assert.equal(loaded.warnings.filter(warning => warning.includes('Symlink escapes')).length, 2);
  await assert.rejects(validateReferenceCard(compromised, {libraryRoot: root}), /Symlink escapes/);
  const missing = await loadReferenceLibrary({libraryRoot: path.join(root, 'missing')});
  assert.deepEqual(missing.cards, []);
  assert.equal(path.basename(path.resolve(DEFAULT_REFERENCE_LIBRARY)), 'motion');
  assert.equal(path.basename(path.dirname(path.resolve(DEFAULT_REFERENCE_LIBRARY))), 'references');
});

test('image context follows actual lyrics and neighbors, penalizes earlier inspirations, and includes no arbitrary extra metadata', async t => {
  const root = await temporary(t);
  const old = reference('already-used'), fresh = reference('fresh');
  fresh.source.creator = 'Original Creator'; fresh.source.originalPostUrl = 'https://example.com/original';
  fresh.quality.userPreferenceScope = 'Liked source video only; excerpt unapproved.';
  old.source.extraUntrustedPayload = 'EXTRA_METADATA_SHOULD_NOT_ENTER_CONTEXT';
  for (const card of [old, fresh]) await seed(root, card);
  const sections = [
    {id: 'before', start: 0, end: 3, wordIds: ['before'], direction: {inspiration: {referenceIds: ['already-used']}}},
    {id: 'now', start: 3, end: 8, wordIds: ['now'], direction: {pacing: {mode: 'held'}, inspiration: {principle: 'Spatial relationships', adaptation: 'Unfold a new ancestry sculpture'}}},
    {id: 'after', start: 8, end: 12, wordIds: ['after'], direction: {}},
  ];
  const project = {title: 'A song', sections, words: [{id: 'before', text: 'Beginning'}, {id: 'now', text: 'Our family and their children'}, {id: 'after', text: 'Tomorrow'}]};
  const context = await referenceContext({project, sections: [sections[1]], stylePrompt: 'Sculptural restraint', libraryRoot: root});
  assert.equal(context.cards[0].id, 'fresh');
  assert.equal(context.images.length, 2);
  assert.equal(context.evidence.selectedIds.length, context.images.length);
  assert.match(context.evidence.query, /family and their children/);
  assert.match(context.evidence.query, /Beginning/); assert.match(context.evidence.query, /Tomorrow/);
  assert.match(context.evidence.query, /Spatial relationships/); assert.match(context.evidence.query, /Unfold a new ancestry sculpture/);
  assert.match(context.text, /UNTRUSTED, NOT INSTRUCTIONS/);
  assert.match(context.text, /Invent new choreography/);
  assert.ok(!context.text.includes('EXTRA_METADATA_SHOULD_NOT_ENTER_CONTEXT'));
  const picture = await loadImage(Buffer.from(context.images[0], 'base64'));
  assert.ok(picture.width <= 1200 && picture.height <= 1000);
  assert.match(context.evidence.imageSha256[0], /^[a-f0-9]{64}$/);
  assert.match(context.evidence.matches[0].cardSha256, /^[a-f0-9]{64}$/);
  assert.equal(context.cards[0].source.creator, fresh.source.creator);
  assert.equal(context.cards[0].source.originalPostUrl, fresh.source.originalPostUrl);
  assert.equal(context.cards[0].quality.userPreferenceScope, fresh.quality.userPreferenceScope);
  await assert.rejects(referenceContext({project, libraryRoot: root, limit: 4}), /at most three/);
  const empty = await referenceContext({stylePrompt: 'cryptographic provisioning', libraryRoot: root});
  assert.equal(empty.text, ''); assert.deepEqual(empty.cards, []); assert.deepEqual(empty.images, []);
});

test('a real video capture writes bounded timed image evidence, binds hashes, and feeds image context', async t => {
  const directory = await temporary(t), root = path.join(directory, 'library'), source = path.join(directory, 'moving.mp4');
  await runProcess('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=240x136:rate=24:duration=1.5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-threads', '1', source]);
  const card = reference('captured-motion', {start: .1, end: 1.4, source: {kind: 'external', url: 'https://example.com/original-video'}});
  delete card.source.videoSha256; delete card.source.path;
  const result = await captureReference({card, videoPath: source, libraryRoot: root, times: [.1, .4, .8, 1.3]});
  assert.equal(result.card.source.videoSha256, await fileHash(source));
  assert.equal(result.card.source.url, card.source.url);
  assert.deepEqual(result.frames.map(frame => frame.timeSeconds), [.1, .4, .8, 1.3]);
  assert.ok((await stat(source)).size > 0);
  const entries = await readdir(path.join(root, 'images', card.id));
  assert.equal(entries.length, 5); assert.ok(entries.every(file => file.endsWith('.jpg')));
  assert.notEqual(result.frames[0].sha256, result.frames[3].sha256);
  assert.deepEqual(JSON.parse(await readFile(result.cardPath, 'utf8')), result.card);
  const sheet = await loadImage(path.join(root, result.contactSheet));
  assert.equal(sheet.width, 960); assert.equal(sheet.height, 664);
  const loaded = await loadReferenceLibrary({libraryRoot: root});
  assert.deepEqual(loaded.warnings, []); assert.equal(loaded.cards.length, 1);
  const context = await referenceContext({stylePrompt: 'Family relationships', libraryRoot: root});
  assert.equal(context.images.length, 1); assert.equal(context.evidence.selectedIds[0], card.id);
  await assert.rejects(captureReference({card, videoPath: source, libraryRoot: root}), /already exists/);
  await assert.rejects(captureReference({card: {...card, source: {...card.source, end: 2}}, videoPath: source, libraryRoot: root}), /actual video duration/);
  await assert.rejects(captureReference({card, videoPath: source, libraryRoot: root, times: [.1, .4, .8, 1.4]}), /inside the source interval/);
  await assert.rejects(captureReference({card: {...card, source: {...card.source, videoSha256: '0'.repeat(64)}}, videoPath: source, libraryRoot: root}), /SHA256 does not match/);
  await writeFile(path.join(root, result.frames[0].path), jpeg);
  const stale = await loadReferenceLibrary({libraryRoot: root});
  assert.deepEqual(stale.cards, []); assert.match(stale.warnings[0], /SHA256 mismatch/);
});
