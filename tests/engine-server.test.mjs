import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../engine/server.mjs';
import { runProcess } from '../engine/export.mjs';

test('studio routes normalize assets, support audio range seek, persist edits and reject foreign origins', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ark-server-test-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(path.join(dir, 'song.mp3'), Buffer.from('0123456789'));
  await writeFile(path.join(dir, 'image.png'), 'image');
  const project = { version: 1, id: 'server', title: 'Server', width: 320, height: 180, fps: 10, duration: 1, audio: { src: 'song.mp3', offset: 0 }, assets: { image: { type: 'image', src: 'image.png' } }, words: [], beats: [], sections: [{ id: 'a', start: 0, end: 1, style: 'verse', wordIds: [], assetIds: ['image'], direction: {}, seed: 1 }] };
  const projectPath = path.join(dir, 'project.json'); await writeFile(projectPath, JSON.stringify(project));
  const { server, url } = await startServer({ projectPath, port: 0 });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`${url}/api/project`), loaded = await response.json();
  assert.equal(loaded.project.audio.src, '/audio'); assert.equal(loaded.assets.image.src, '/asset/image');
  const audio = await fetch(`${url}/audio`, { headers: { Range: 'bytes=2-5' } }); assert.equal(audio.status, 206); assert.equal(await audio.text(), '2345');
  const visual = await fetch(`${url}/engine/visual.mjs`); assert.equal(visual.status, 200); assert.match(await visual.text(), /drawFrame/);
  const story = await fetch(`${url}/engine/story-visual.mjs`); assert.equal(story.status, 200); assert.match(await story.text(), /installStoryStyles/);
  assert.equal((await fetch(`${url}/engine/server.mjs`)).status, 404);
  const reject = await fetch(`${url}/api/sections/a`, { method: 'PATCH', headers: { Origin: 'https://example.org', 'Content-Type': 'application/json' }, body: JSON.stringify({ direction: { accent: '#f00' } }) }); assert.equal(reject.status, 403);
  const patched = await fetch(`${url}/api/sections/a`, { method: 'PATCH', headers: { Origin: url, 'Content-Type': 'application/json' }, body: JSON.stringify({ direction: { accent: '#f00' } }) }); assert.equal(patched.status, 200);
  assert.equal((await (await fetch(`${url}/api/project`)).json()).sections[0].direction.accent, '#f00');
  assert.equal((await fetch(`${url}/asset/unknown`)).status, 404);
});

test('completed real render jobs expose a downloadable MP4 with byte-range playback', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ark-download-test-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await runProcess('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1', '-c:a', 'pcm_s16le', path.join(dir, 'song.wav')]);
  const project = { version: 1, id: 'download', title: 'Download smoke', width: 160, height: 90, fps: 10, duration: 0.4, audio: { src: 'song.wav', offset: 0 }, assets: {}, words: [], beats: [], sections: [{ id: 'a', start: 0, end: 0.4, style: 'verse', wordIds: [], assetIds: [], direction: {}, seed: 1 }] };
  const projectPath = path.join(dir, 'project.json'); await writeFile(projectPath, JSON.stringify(project));
  const { server, url } = await startServer({ projectPath, port: 0 }); t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`${url}/api/render`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: url }, body: JSON.stringify({ scale: 1 }) });
  assert.equal(response.status, 202);
  const created = await response.json();
  let job;
  const deadline = Date.now() + 15000;
  do {
    job = await (await fetch(`${url}${created.poll}`)).json();
    if (job.status !== 'running') break;
    await new Promise(resolve => setTimeout(resolve, 30));
  } while (Date.now() < deadline);
  assert.equal(job.status, 'complete', job.error ?? 'Render timed out');
  assert.equal(job.downloadUrl, `/api/jobs/${created.jobId}/video`);
  const video = await fetch(`${url}${job.downloadUrl}`);
  assert.equal(video.status, 200); assert.equal(video.headers.get('content-type'), 'video/mp4');
  const bytes = Buffer.from(await video.arrayBuffer()); assert.equal(bytes.subarray(4, 8).toString(), 'ftyp');
  const range = await fetch(`${url}${job.downloadUrl}`, { headers: { Range: 'bytes=0-31' } });
  assert.equal(range.status, 206); assert.equal(range.headers.get('content-type'), 'video/mp4');
  assert.equal((await range.arrayBuffer()).byteLength, 32); assert.match(range.headers.get('content-range'), /^bytes 0-31\//);
  assert.equal((await fetch(`${url}/api/jobs/unknown/video`)).status, 404);
});
