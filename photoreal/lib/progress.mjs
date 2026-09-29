// progress.json while a film renders, and a plain STATUS.md when it finishes or gets blocked.
// The finish estimate starts from the measured test render and is corrected by the frames actually
// rendered so far, so it gets more honest as the run goes on.
import fs from 'node:fs';
import path from 'node:path';

function writeAtomic(file, text) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

export const fmtDuration = (s) => {
  if (!Number.isFinite(s)) return 'unknown';
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${m} min` : m ? `${m} min` : `${s} s`;
};

export class Progress {
  // jobs: [{ id, scene, frames, estMsPerFrame }] still to render; speedup: measured gain from parallel workers
  constructor({ file, jobs, total, cached = 0, speedup = 1, now = () => Date.now() }) {
    this.file = file; this.now = now; this.speedup = speedup;
    this.jobs = new Map(jobs.map((j) => [j.id, { ...j, frameDone: 0, state: 'waiting', attempts: 0 }]));
    this.total = total; this.cached = cached;
    this.startedAt = now(); this.lastFrameAt = null;
    this.events = [];
    this.write();
  }

  start(id) { const j = this.jobs.get(id); j.state = 'rendering'; j.attempts++; j.startedAt = this.now(); j.frameDone = 0; this.write(); }
  frame(id, frame) { const j = this.jobs.get(id); j.frameDone = frame; this.lastFrameAt = this.now(); this.write(); }
  log(id, text) { this.events.push({ at: new Date(this.now()).toISOString(), scene: id, text }); this.write(); }
  finish(id, ok, reason) {
    const j = this.jobs.get(id);
    j.state = ok ? 'done' : 'failed'; j.reason = reason;
    j.seconds = (this.now() - j.startedAt) / 1000;
    if (ok) j.frameDone = j.frames;
    this.write();
  }

  // actual / estimated time over everything rendered so far (1 until there is evidence)
  correction() {
    let est = 0, act = 0;
    for (const j of this.jobs.values()) if (j.state === 'done' && j.estMsPerFrame) { est += j.frames * j.estMsPerFrame; act += j.seconds * 1000; }
    return est > 0 ? act / est : 1;
  }

  snapshot() {
    const js = [...this.jobs.values()];
    const done = js.filter((j) => j.state === 'done'), failed = js.filter((j) => j.state === 'failed');
    const framesTotal = js.reduce((a, j) => a + j.frames, 0), framesDone = js.reduce((a, j) => a + (j.state === 'failed' ? 0 : j.frameDone), 0);
    const k = this.correction();
    const remainingMs = js.filter((j) => j.state === 'waiting' || j.state === 'rendering')
      .reduce((a, j) => a + (j.frames - j.frameDone) * (j.estMsPerFrame ?? 0) * k, 0) / this.speedup;
    const known = js.every((j) => j.estMsPerFrame || j.state !== 'waiting');
    const state = js.some((j) => j.state === 'rendering' || j.state === 'waiting') ? 'rendering' : failed.length ? 'blocked' : 'done';
    return {
      state,
      scenesDone: done.length + this.cached, scenesTotal: this.total, scenesCached: this.cached, scenesFailed: failed.map((j) => ({ id: j.id, scene: j.scene, reason: j.reason, attempts: j.attempts })),
      current: js.filter((j) => j.state === 'rendering').map((j) => ({ id: j.id, scene: j.scene, frame: j.frameDone, of: j.frames, attempt: j.attempts })),
      framesDone, framesTotal,
      secondsPerScene: Object.fromEntries(done.map((j) => [j.id, Math.round(j.seconds)])),
      startedAt: new Date(this.startedAt).toISOString(),
      lastFrameAt: this.lastFrameAt ? new Date(this.lastFrameAt).toISOString() : null,
      estimatedFinish: known && state === 'rendering' ? new Date(this.now() + remainingMs).toISOString() : null,
      estimateCorrection: +k.toFixed(3),
      events: this.events.slice(-50),
    };
  }

  write() { writeAtomic(this.file, JSON.stringify(this.snapshot(), null, 1) + '\n'); }
}

// STATUS.md: what a person needs when they come back to the machine.
export function writeStatus(file, { song, state, output, snapshot, notes = [], elapsed }) {
  const s = snapshot;
  const lines = [`# ${path.basename(song)}: ${state === 'done' ? 'finished' : state === 'blocked' ? 'blocked' : state}`, ''];
  if (state === 'done') lines.push(`The film rendered in ${fmtDuration(elapsed)}${output ? ` and is at \`${output}\`` : ''}.`);
  else if (state === 'blocked') lines.push(`The render stopped short of a finished film after ${fmtDuration(elapsed)}. ${s?.scenesFailed?.length ? 'These scenes failed even after retries, so the film was not joined:' : ''}`);
  else lines.push(`The render is ${state}.`);
  if (s?.scenesFailed?.length) {
    lines.push('');
    for (const f of s.scenesFailed) lines.push(`- Scene ${f.id} (${f.scene}): ${f.reason} (${f.attempts} attempt${f.attempts === 1 ? '' : 's'})`);
  }
  if (s) {
    lines.push('', `Scenes: ${s.scenesDone} of ${s.scenesTotal} done (${s.scenesCached} were already cached).`);
    const slow = Object.entries(s.secondsPerScene).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (slow.length) lines.push(`Slowest scenes: ${slow.map(([id, sec]) => `${id} ${fmtDuration(sec)}`).join(', ')}.`);
    const retried = s.events.filter((e) => /retry|stalled|no first frame|exited/.test(e.text));
    if (retried.length) { lines.push('', 'Watchdog events:'); for (const e of retried) lines.push(`- ${e.at} scene ${e.scene}: ${e.text}`); }
  }
  for (const n of notes) lines.push('', n);
  writeAtomic(file, lines.join('\n') + '\n');
}
