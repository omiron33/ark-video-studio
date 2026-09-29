import test from 'node:test';
// These fixtures assert the historical GPT Image request; pin it so the agent running the suite does not change it.
process.env.ARK_IMAGE_PROVIDER = 'gpt-image';
process.env.ARK_MODE = 'mixed';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { planStyle, createSong, finalizeRun } from '../engine/create.mjs';
import { atomicJson } from '../engine/project.mjs';

function project(text = 'The waters rose above them until even the highest ground disappeared below') {
  const words = text.split(' ').map((text, i) => ({ id: `w${i}`, text, start: i * .6, end: i * .6 + .4, confidence: .9, provenance: { method: 'fixture' } }));
  return { version: 1, id: 'song', title: 'Song', width: 640, height: 360, fps: 30, duration: words.length * .6 + .3, audio: { src: 'song.wav', offset: 0 }, assets: {}, words, beats: [], palette: {}, sections: [] };
}
function wav(seconds = 3) {
  const rate = 8000, count = rate * seconds, bytes = Buffer.alloc(44 + count * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22); bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) bytes.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 220 / rate) * 3000), 44 + i * 2);
  return bytes;
}
async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ark-create-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const audio = path.join(dir, 'song.wav'), timing = path.join(dir, 'words.json');
  await writeFile(audio, wav()); await atomicJson(timing, { timebase: 'clip', words: [{ text: 'Faith', start: .2, end: .7 }, { text: 'endures.', start: .9, end: 1.5 }] });
  return { dir, audio, timing, outDir: path.join(dir, 'run'), stylePrompt: 'Quiet gold typography', duration: 3, width: 640, height: 360 };
}
function services(log = []) {
  return {
    detectAudioEvents: async () => ({ timebase: 'source', beats: [{ time: .5, strength: .7, kind: 'measured_onset' }] }),
    directProject: async ({ project }) => { log.push('plan'); return { project, method: 'test-only-director', evidence: {} }; },
    renderProject: async ({ outPath }) => { log.push('render'); await writeFile(outPath, 'test-only encoded output'); return { sha256: 'test-only', seconds: .01 }; },
    reviewAudio: async () => { log.push('audio'); return { status: 'passed', reportPath: '/test/audio.json', checks: [] }; },
    reviewVideo: async () => { log.push('technical'); return { reportPath: '/test/gauntlet.json' }; },
    reviewVisual: async () => { log.push('visual'); return { status: 'passed', scores: {}, reviewPath: '/test/visual.json' }; },
    attachMachineVisualReview: async () => { log.push('attach'); },
    checkReview: async () => { log.push('gate'); return { passed: true, status: 'machine_verified', reasons: [] }; },
  };
}

test('semantic planning preserves every exact word and timing with gap-free frame boundaries', () => {
  const source = project(), before = structuredClone(source), result = planStyle(source, 'Words move with their meaning: water rises, terrain and submerge');
  assert.deepEqual(source, before); assert.deepEqual(result.project.words, before.words);
  assert.deepEqual(result.project.sections.map(s => s.style), ['rise', 'terrain', 'submerge']);
  assert.deepEqual(result.project.sections.flatMap(s => s.wordIds), before.words.map(w => w.id));
  assert.equal(result.project.sections[0].start, 0); assert.equal(result.project.sections.at(-1).end, source.duration);
  result.project.sections.forEach((s, i) => { if (i) assert.equal(s.start, result.project.sections[i - 1].end); assert.ok(Math.abs(s.start * source.fps - Math.round(s.start * source.fps)) < 1e-7); });
  const longer = planStyle(project('The waters rose above them again and again.'), 'Semantic water rise');
  assert.equal(longer.project.sections.flatMap(s => s.wordIds).length, 8, 'unmatched words must not vanish into an authored role map');
});

test('different briefs produce different real direction without rewriting lyrics', () => {
  const source = project('One two three four five six seven eight nine ten eleven twelve.');
  const quiet = planStyle(source, 'Quiet minimal gold serif'), bold = planStyle(source, 'Bold energetic red impact');
  assert.notDeepEqual(quiet.project.sections.map(s => s.style), bold.project.sections.map(s => s.style));
  assert.notEqual(quiet.project.palette.accent, bold.project.palette.accent);
  assert.notEqual(quiet.project.sections[0].direction.scale, bold.project.sections[0].direction.scale);
  assert.deepEqual(quiet.project.words, bold.project.words);
  assert.equal(planStyle(source, 'Cinematic abstract typography').evidence.interpreted.photo, false);
  assert.match(planStyle(source, 'Photorealistic mountains').evidence.warnings.join(' '), /no supplied image/);
});

test('dark gritty briefs keep semantic mountains and their transition dark',()=>{
  const original=project(),result=planStyle(original,'Dark gritty chapter, avoid bright backgrounds. Words move with their meaning: water rises, mountain terrain, submerge.');
  assert.equal(result.evidence.interpreted.dark,true);assert.equal(result.evidence.interpreted.light,false);
  assert.equal(result.project.palette.ink,'#080e13');assert.equal(result.project.palette.accent,'#a17b65');
  assert.equal(result.project.sections.find(s=>s.style==='terrain').direction.palette.paper,'#141d23');
  assert.equal(result.project.sections.find(s=>s.style==='rise').direction.wipeColor,'#141d23');
  assert.deepEqual(result.project.words,original.words);
  assert.equal(planStyle(original,'Dark typography accent #926c59').project.palette.accent,'#926c59');
});

test('create portable intake copies fonts, invokes measured reviews, and records only the gate result', async t => {
  const options = await fixture(t), log = [], result = await createSong(options, services(log));
  assert.equal(result.status, 'finished'); assert.deepEqual(log, ['plan', 'render', 'audio', 'technical', 'visual', 'attach', 'gate']);
  const manifest = JSON.parse(await readFile(result.projectPath));
  assert.deepEqual(manifest.words.map(w => w.text), ['Faith', 'endures.']);
  const fonts = Object.values(manifest.assets).filter(a => a.type === 'font'); assert.equal(fonts.length, 3);
  for (const font of fonts) await access(path.resolve(path.dirname(result.projectPath), font.src));
  await access(path.join(path.dirname(result.projectPath), 'assets', 'OFL-bebasneue.txt'));
  assert.equal(result.attempts.length, 1); assert.equal(result.result.passed, true);
});

test('repair rerenders before reviewing the changed project, and final pass cannot repair', async t => {
  const options = await fixture(t), log = [], mocks = services(log); let audioCalls = 0;
  mocks.reviewAudio = async ({ projectPath, repair }) => { log.push('audio'); audioCalls++; assert.equal(repair, audioCalls === 1); if (audioCalls === 1) { const p = JSON.parse(await readFile(projectPath)); p.words[0].end += .01; await atomicJson(projectPath, p); return { status: 'needs_repair', projectChanged: true, repairs: [{ wordId: p.words[0].id }], reportPath: '/test/audio1.json' }; } return { status: 'passed', reportPath: '/test/audio2.json' }; };
  const result = await createSong({ ...options, maxPasses: 2 }, mocks);
  assert.equal(result.status, 'finished'); assert.equal(result.attempts.length, 2);
  assert.deepEqual(log.slice(0, 5), ['plan', 'render', 'audio', 'render', 'audio']);
  assert.equal(result.attempts[0].outcome, 'audio-repaired-rerender-required');
});

test('failed measurements and pending requested imagery cannot be called finished', async t => {
  const options = await fixture(t), mocks = services();
  mocks.reviewAudio = async () => ({ status: 'failed', reportPath: '/test/failed-audio.json' });
  const failed = await createSong(options, mocks); assert.equal(failed.status, 'quality_failed'); assert.equal(failed.result.passed, false);
  const imageRun = await createSong({ ...options, outDir: path.join(options.dir, 'photo'), stylePrompt: 'Photorealistic mountains' }, services());
  assert.equal(imageRun.status, 'quality_failed'); assert.equal(imageRun.result.gate.status, 'required_assets_pending'); assert.match(imageRun.assetRequests[0].agentAction, /GPT Image/);
});

test('resume preserves intake, records concrete errors, and rejects changed source requests', async t => {
  const options = await fixture(t), broken = services(); broken.renderProject = async () => { throw new Error('encoder test failure'); };
  const failed = await createSong(options, broken); assert.equal(failed.status, 'failed'); assert.match(failed.error.message, /encoder/);
  await assert.rejects(createSong(options, services()), /--resume/);
  await assert.rejects(createSong({ ...options, resume: true, stylePrompt: 'Different' }, services()), /differ/);
  const fixed = await createSong({ ...options, resume: true }, services()); assert.equal(fixed.status, 'finished'); assert.equal(fixed.error, undefined);
  assert.equal(fixed.projectPath, failed.projectPath); assert.equal(fixed.steps.filter(s => s.name === 'import').length, 1);
  const failedAgain = await createSong({ ...options, resume: true }, broken);
  assert.equal(failedAgain.status, 'failed'); assert.equal(failedAgain.result, undefined, 'a failed resume must not retain an old passed delivery claim');
  assert.equal(failedAgain.completedAt, undefined);
});

test('authored image files become portable assets and resolve the photographic brief', async t => {
  const options = await fixture(t), image = path.join(options.dir, 'photo.png'), directionFile = path.join(options.dir, 'direction.json');
  // A real one-pixel PNG suffices for file validation; visual quality is independently reviewed in integration runs.
  await writeFile(image, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA1cAAAAASUVORK5CYII=', 'base64'));
  await atomicJson(directionFile, { assets: { landscape: { type: 'image', src: './photo.png' } }, defaults: { assetIds: ['landscape'], direction: { photo: 'landscape' } } });
  const result = await createSong({ ...options, directionFile, stylePrompt: 'Photorealistic mountains' }, services()); assert.equal(result.status, 'finished');
  const p = JSON.parse(await readFile(result.projectPath)); assert.equal(p.sections[0].direction.photo, 'landscape');
  assert.ok(!path.isAbsolute(p.assets.landscape.src)); assert.deepEqual(await readFile(path.resolve(path.dirname(result.projectPath), p.assets.landscape.src)), await readFile(image));
  const replanned = await createSong({ ...options, directionFile, stylePrompt: 'Photorealistic mountains', resume: true, replan: true }, services());
  assert.equal(replanned.status, 'finished'); assert.equal(replanned.steps.filter(s => s.name === 'plan').length, 2);
  assert.equal(Object.values(JSON.parse(await readFile(replanned.projectPath)).assets).filter(a => a.type === 'image').length, 1);
});

test('evidence-supported lyric repair triggers a new scene plan before rerender', async t => {
  const options = await fixture(t), log = [], mocks = services(log); let calls = 0, plans = 0;
  mocks.directProject = async ({ project }) => { log.push('plan'); return { project, method: ++plans === 1 ? 'test-initial-fallback' : 'test-repaired-local-model', evidence: {} }; };
  mocks.reviewAudio = async ({ projectPath }) => {
    log.push('audio'); if (++calls > 1) return { status: 'passed', reportPath: '/test/audio.json' };
    const p = JSON.parse(await readFile(projectPath)); p.words[1].text = 'endures!'; await atomicJson(projectPath, p);
    return { status: 'needs_repair', reportPath: '/test/audio.json', projectChanged: true, requiresDirectorReplan: true };
  };
  const result = await createSong({ ...options, maxPasses: 2 }, mocks);
  assert.equal(result.status, 'finished'); assert.deepEqual(log.slice(0, 6), ['plan', 'render', 'audio', 'plan', 'render', 'audio']);
  const p = JSON.parse(await readFile(result.projectPath)); assert.equal(p.words[1].text, 'endures!');
  assert.equal(result.steps.some(s => s.name === 'replan-after-lyric-repair'), true);
  assert.equal(result.planner.method, 'test-repaired-local-model');
  assert.match(result.planner.evidencePath, /replan.json$/);
  assert.deepEqual(result.attempts[0].replan, result.planner);
});

test('director changing canonical words is rejected before rendering', async t => {
  const options = await fixture(t), mocks = services(), log = [];
  mocks.directProject = async ({ project }) => { project.words[0].text = 'Invented'; return { project, method: 'test-bad-director' }; };
  mocks.renderProject = async () => { log.push('render'); };
  const result = await createSong(options, mocks); assert.equal(result.status, 'failed'); assert.match(result.error.message, /canonical/); assert.equal(log.length, 0);
});

test('short musical breaths hold the preceding scene; long gaps get an instrumental scene', () => {
  const p = project('Hope holds. Mercy stays.');
  p.words[2].start = 3.26; p.words[2].end = 3.66; p.words[3].start = 3.86; p.words[3].end = 4.26; p.duration = 5;
  const before = structuredClone(p.words), short = planStyle(p, 'Quiet waves').project;
  assert.deepEqual(short.words, before); assert.equal(short.sections.length, 2); assert.equal(short.sections.some(s => !s.wordIds.length), false);
  assert.equal(short.sections[0].end, Math.round(3.26 * p.fps) / p.fps);
  p.words[2].start = 6.26; p.words[2].end = 6.66; p.words[3].start = 6.86; p.words[3].end = 7.26; p.duration = 8;
  const long = planStyle(p, 'Quiet waves').project;
  assert.deepEqual(long.words, p.words); assert.equal(long.sections.filter(s => !s.wordIds.length).length, 1);
  assert.deepEqual(long.sections.flatMap(s => s.wordIds), p.words.map(w => w.id));
});

test('graphic submerge preserves semantic roles and starts sinking after the last sung word', () => {
  const p = project(), directed = planStyle(p, 'Semantic water motion').project, last = directed.sections.at(-1);
  assert.equal(last.style, 'submerge'); assert.ok(last.direction.roles.below); assert.equal(last.assetIds.length, 0);
  assert.ok(last.direction.submergeAt >= p.words.at(-1).end + .119999);
});

test('finalize-run only accepts fresh measured audio plus an existing independent visual review', async t => {
  const options = await fixture(t), mocks = services();
  mocks.reviewVisual = async () => ({ status: 'failed', reviewPath: '/test/local-critic.json', scores: { composition: 7 } });
  mocks.checkReview = async () => ({ passed: false, status: 'machine_visual_review_failed', reasons: ['local composition below 8'] });
  const draft = await createSong(options, mocks); assert.equal(draft.status, 'quality_failed');
  const valid = { passed: true, status: 'independently_reviewed', reasons: [], quality: { technicalVerified: true, machineAudioVerified: true, independentVisualReviewed: true }, machineAudio: { passed: true, path: '/test/audio.json' }, machineVisual: { path: '/test/local-critic.json' }, currentBinding: { videoSha256: 'test-only' } };
  let seen;
  const finished = await finalizeRun({ runDir: options.outDir }, { checkReview: async args => { seen = args; return valid; } });
  assert.equal(finished.status, 'finished'); assert.equal(finished.result.gate.status, 'independently_reviewed');
  assert.equal(seen.projectPath, draft.projectPath); assert.equal(seen.videoPath, draft.videoPath);
  assert.equal(finished.attempts[0].visual.status, 'failed', 'do not erase the disagreeing local critic');
  assert.equal(finished.finalizations[0].method, 'existing-independent-visual-review');
  for (const invalid of [
    { ...valid, passed: false, status: 'stale', reasons: ['Stale revisionHash'] },
    { ...valid, machineAudio: { passed: false }, quality: { ...valid.quality, machineAudioVerified: false } },
    { ...valid, status: 'machine_verified', quality: { ...valid.quality, independentVisualReviewed: false } },
  ]) {
    const failed = await finalizeRun({ runDir: options.outDir }, { checkReview: async () => invalid });
    assert.equal(failed.status, 'quality_failed'); assert.equal(failed.result.passed, false); assert.equal(failed.completedAt, undefined);
  }
  const r = JSON.parse(await readFile(path.join(options.outDir, 'run.json'))); r.assetRequests = [{ status: 'pending', request: 'Required photography' }]; await atomicJson(path.join(options.outDir, 'run.json'), r);
  const assetsPending = await finalizeRun({ runDir: options.outDir }, { checkReview: async () => valid });
  assert.equal(assetsPending.result.passed, false); assert.match(assetsPending.result.gate.reasons.join(' '), /photographic assets/);
});

test('ground O-counter portal bridges a short rest only when travel time is available', () => {
  const p = project(); p.words[10].start = 8.06; p.words[10].end = 8.65; p.words[11].start = 9.02; p.words[11].end = 9.4; p.duration = 11;
  const planned = planStyle(p, 'Semantic waters terrain disappear below').project;
  assert.equal(planned.sections.length, 3); const terrain = planned.sections[1];
  assert.equal(terrain.style, 'terrain'); assert.ok(terrain.direction.portalAt >= p.words[9].end + .15); assert.ok(terrain.end - terrain.direction.portalAt >= .4);
  assert.equal(planStyle(project(), 'Semantic water').project.sections[1].direction.portalAt, undefined, 'short syllable gap cannot fit portal travel');
  assert.equal(planStyle(project('Land faded into a new day.'), 'Quiet typography').project.sections.some(s => s.direction.portalAt !== undefined), false);
});

test('new runs block incomplete or repeated scene artwork before rendering, and resume after individual assignments', async t => {
  const options = await fixture(t), directionFile = path.join(options.dir, 'direction.json');
  await atomicJson(options.timing, { timebase: 'clip', words: [
    { text: 'Faith', start: .2, end: .5 }, { text: 'endures.', start: .6, end: 1.1 },
    { text: 'Mercy', start: 1.5, end: 1.9 }, { text: 'stays.', start: 2, end: 2.6 },
  ] });
  const {createCanvas} = await import('@napi-rs/canvas');
  const canvas = createCanvas(2, 2), ctx = canvas.getContext('2d');
  ctx.fillStyle = '#213546'; ctx.fillRect(0, 0, 2, 2); await writeFile(path.join(options.dir, 'first.png'), canvas.toBuffer('image/png'));
  ctx.fillStyle = '#514137'; ctx.fillRect(0, 0, 2, 2); await writeFile(path.join(options.dir, 'second.png'), canvas.toBuffer('image/png'));
  await atomicJson(directionFile, { assets: { first: { type: 'image', src: './first.png' } } });
  const log = [], args = { ...options, directionFile, stylePrompt: 'Dark photorealistic story behind the lyrics' };
  const pending = await createSong(args, services(log));
  assert.equal(pending.status, 'quality_failed'); assert.equal(pending.result.gate.status, 'required_assets_pending');
  assert.deepEqual(log, ['plan'], 'missing scene images are caught before encoding');
  assert.equal(pending.assetRequests.length, 1); assert.ok(pending.assetRequests[0].sectionId);
  const p = JSON.parse(await readFile(pending.projectPath));
  assert.equal(p.creation.creativePolicy.uniqueSceneArtwork, true);
  assert.ok(p.sections.every(s => s.direction.pacing));
  const second = p.sections.find(s => !s.direction.photo);
  second.direction.photo = 'first'; second.assetIds = ['first']; await atomicJson(pending.projectPath, p);
  const repeated = await createSong({ ...args, resume: true }, services(log));
  assert.equal(repeated.status, 'quality_failed'); assert.match(repeated.result.gate.reasons.join(' '), /reused/);
  assert.deepEqual(log, ['plan']);
  p.assets.second = { type: 'image', src: path.relative(path.dirname(pending.projectPath), path.join(options.dir, 'second.png')) };
  second.direction.photo = 'second'; second.assetIds = ['second']; await atomicJson(pending.projectPath, p);
  const resolved = await createSong({ ...args, resume: true }, services(log));
  assert.equal(resolved.status, 'finished'); assert.deepEqual(resolved.assetRequests, []);
  assert.equal(resolved.attempts[0].creative.passed, true);
  const repairLog = [], repairServices = services(repairLog);
  repairServices.reviewVisual = async ({ projectPath }) => {
    const changed = JSON.parse(await readFile(projectPath));
    changed.sections[1].direction.photo = changed.sections[0].direction.photo;
    changed.sections[1].assetIds = [...changed.sections[0].assetIds];
    await atomicJson(projectPath, changed);
    return { status: 'failed', projectChanged: true };
  };
  const badRepair = await createSong({ ...args, resume: true, maxPasses: 2 }, repairServices);
  assert.equal(badRepair.status, 'quality_failed'); assert.match(badRepair.result.gate.reasons.join(' '), /reused/);
  assert.equal(repairLog.filter(s => s === 'render').length, 1, 'recheck repairs before spending time on another encode');
});
