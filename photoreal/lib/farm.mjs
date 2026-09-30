// Rendering a film's scenes across machines: measure each machine, give it as many workers as
// actually speed it up, and hand scenes to whichever worker will finish them soonest.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runWithWatchdog } from './watchdog.mjs';

const b64 = (s) => Buffer.from(s).toString('base64');

// Seconds a scene would take on a worker slot: the machine's estimate for it, slowed by how many
// workers share that machine's GPU.
export const slotSeconds = (slot, task) => (task.frames * (task.light ? task.est ?? 300 : slot.machine.msPerFrame(task)) * (slot.machine.slotFactor ?? 1)) / 1000;

// Plan everything still waiting: biggest scenes first, each to the worker that would finish it
// soonest given what that worker already has queued (earliest-finish list scheduling). The plan is
// redone whenever a worker comes free, so it follows what actually happens.
export function plan(pending, slots, now) {
  const sl = slots.map((s) => ({ ref: s, free: Math.max(now, s.freeAt ?? now), tasks: [] }));
  for (const t of [...pending].sort((a, b) => b.weight - a.weight)) {
    let best = null, bestEnd = Infinity;
    for (const s of sl) {
      if (t.localOnly && s.ref.machine.remote) continue;
      if (t.avoid?.includes(s.ref.machine.name)) continue;   // this machine can't draw this scene
      const end = s.free + slotSeconds(s.ref, t);
      if (end < bestEnd - 1e-9) { best = s; bestEnd = end; }
    }
    if (!best) continue;
    best.free = bestEnd; best.tasks.push(t);
  }
  return sl;
}

// When a slot comes free it takes the first scene the plan gives it; none means the other workers
// will get through everything sooner, and it waits.
export function pickTask(slot, pending, slots, now) {
  const p = plan(pending, slots.includes(slot) ? slots : [...slots, slot], now).find((s) => s.ref === slot);
  return p?.tasks[0] ?? null;
}

// Worker count per machine from measured throughput: add a worker while it adds at least 25%.
export function chooseParallel(rates) {
  let n = 1;
  for (let k = 2; k <= rates.length; k++) if (rates[k - 1] >= rates[n - 1] * 1.25) n = k; else break;
  return { parallel: n, speedup: rates[n - 1] / rates[0] };
}

export class Worker {
  constructor({ machine, engineRoot, song, render, workDir, dirs }) { Object.assign(this, { machine, engineRoot, song, render, workDir, dirs, tag: Date.now().toString(36) }); }

  // One job under the watchdog; for a remote machine the output is fetched back and its frames
  // counted before it counts as done.
  async run({ job, renderArgs, out, frames, stallSec, retries, onFrame, log }) {
    const m = this.machine;
    const hb = path.join(this.workDir, `hb-${job}.json`);
    if (!m.remote) {
      return runWithWatchdog({ cmd: 'node', args: [this.render, ...renderArgs, '--song', this.song, '--out', out, '--heartbeat', hb], heartbeat: hb, stallSec, retries, onFrame, log });
    }
    // a token unique to this run, so stopping a job there can never touch another run's worker
    const token = `${job}-${this.tag}`;
    const remoteOut = `${m.root}/out/${token}${path.extname(out) || '.mp4'}`;
    m.ps(`New-Item -ItemType Directory -Force -Path '${m.root}/out' | Out-Null`);
    const c = m.command(this.dirs, token, [...renderArgs, '--out', remoteOut]);
    // a remote Chrome sometimes loses its GPU context in the first seconds (seen on OmiPC over SSH);
    // that costs a few seconds, so such a machine gets extra attempts before the scene moves home
    const r = await runWithWatchdog({ ...c, heartbeat: hb, stallSec, retries: retries + 3, onFrame, log, stdoutHeartbeat: true, onKill: () => m.kill(token), failOn: /CONTEXT_LOST|context lost/i });
    if (!r.ok) return r;
    try {
      const tmp = `${out}.part${path.extname(out) || '.mp4'}`;
      m.fetch(remoteOut, tmp);
      const n = +spawnSync('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', tmp], { encoding: 'utf8' }).stdout.trim();
      if (frames && n !== frames) throw Error(`fetched ${n} frames, expected ${frames}`);
      // a lost GPU context that slipped through draws flat black frames: look at one frame a second
      // (not for a lyric layer, which is mostly empty by design)
      if (!out.endsWith('.mkv')) {
      const st = spawnSync('ffmpeg', ['-hide_banner', '-i', tmp, '-vf', 'fps=1,scale=192:-2,signalstats,metadata=print:key=lavfi.signalstats.YMAX:file=-', '-f', 'null', '-'], { encoding: 'utf8' });
      const ymax = [...(st.stdout ?? '').matchAll(/YMAX=(\d+)/g)].map((x) => +x[1]);
      if (ymax.length && ymax.filter((y) => y < 24).length > ymax.length / 2) throw Error('most of its frames came back black');
      }
      fs.renameSync(tmp, out);
      return r;
    } catch (e) { return { ok: false, attempts: r.attempts, reason: `render finished on ${m.name} but ${e.message}` }; }
  }
}

// Plate render arguments that work on any machine (no local paths; parameters base64-encoded).
export function plateArgs(seg, fps, { draft, crf = '18', params }) {
  return ['video', '--scene', seg.scene, '--params64', b64(params), '--from', String(seg.f0 / fps), '--to', String(seg.f1 / fps),
    '--samples', String(seg.samples), '--noaudio', '--preset', draft ? 'veryfast' : 'slow', '--crf', crf];
}

// Cheap per-scene timing on a machine (see render.mjs probe).
export function probeOn(worker, list) {
  if (!list.length) return [];
  const scenes64 = b64(JSON.stringify(list.map((s) => ({ id: s.id, scene: s.scene, params: s.params, from: s.from, to: s.to }))));
  const m = worker.machine;
  let r;
  if (m.remote) { const c = m.command(worker.dirs, `probe${Date.now().toString(36)}`, ['probe', '--scenes64', scenes64]); r = spawnSync(c.cmd, c.args, { encoding: 'utf8', timeout: 60000 * (5 + list.length) }); }
  else r = spawnSync('node', [worker.render, 'probe', '--song', worker.song, '--scenes64', scenes64], { encoding: 'utf8', timeout: 60000 * (5 + list.length), stdio: ['ignore', 'pipe', 'inherit'] });
  return (r.stdout ?? '').split('\n').filter((l) => l.startsWith('PROBE ')).map((l) => JSON.parse(l.slice(6)));
}

// Estimated seconds until everything pending is done.
export function simulate(tasks, slots, now = 0) {
  if (!tasks.length) return 0;
  const sl = plan(tasks, slots, now);
  if (sl.reduce((n, s) => n + s.tasks.length, 0) < tasks.length) return Infinity;
  return Math.max(...sl.map((s) => s.free)) - now;
}
