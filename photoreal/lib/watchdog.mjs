// Run a render worker under a watchdog. The worker writes a heartbeat file (JSON with `frame`, `of`
// and `at`) after every frame it hands to the encoder. If no new frame arrives within `stallSec`
// (or the first frame within `firstFrameSec`, which also covers Chrome start-up and shader
// compilation), the worker and everything it started are killed, the reason is logged, and the job
// is tried again up to `retries` more times. A job that still fails is reported, not thrown, so the
// caller can carry on with the other scenes.
import fs from 'node:fs';
import { spawn } from 'node:child_process';

export function readHeartbeat(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function killTree(child) {
  // the worker runs in its own process group, so Chrome and FFmpeg go with it
  try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch {} }
}

// One attempt. Resolves { ok, code, reason, frames, seconds }.
export function runOnce({ cmd, args, heartbeat, stallSec = 180, firstFrameSec = 600, pollMs = 1000, onFrame, log = () => {}, env }) {
  return new Promise((resolve) => {
    try { fs.rmSync(heartbeat, { force: true }); } catch {}
    const started = Date.now();
    const child = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], detached: true, env: env ?? process.env });
    let lastFrame = -1, lastAt = started, reason = null, done = false;
    const timer = setInterval(() => {
      const hb = readHeartbeat(heartbeat);
      // frame 0 only means the page loaded; the first-frame allowance runs until frame 1
      if (hb && hb.frame > 0 && hb.frame > lastFrame) { lastFrame = hb.frame; lastAt = Date.now(); onFrame?.(hb); }
      const quiet = (Date.now() - lastAt) / 1000;
      const limit = lastFrame < 0 ? firstFrameSec : stallSec;
      if (quiet > limit && !reason) {
        reason = lastFrame < 0
          ? `no first frame after ${Math.round(quiet)} s (start-up, shader compile or GPU hang)`
          : `stalled: no new frame for ${Math.round(quiet)} s after frame ${lastFrame}${hb?.of ? ' of ' + hb.of : ''}`;
        log(reason);
        killTree(child);
      }
    }, pollMs);
    const finish = (code, signal) => {
      if (done) return; done = true;
      clearInterval(timer);
      const hb = readHeartbeat(heartbeat);
      const frames = hb?.frame ?? Math.max(0, lastFrame);
      const seconds = (Date.now() - started) / 1000;
      if (!reason && code !== 0) reason = `worker exited with ${signal ? 'signal ' + signal : 'code ' + code}`;
      resolve({ ok: !reason && code === 0, code, reason, frames, seconds });
    };
    child.on('exit', finish);
    child.on('error', (e) => { reason = reason ?? `could not start worker: ${e.message}`; finish(-1); });
  });
}

// Up to 1 + retries attempts. Resolves { ok, attempts: [...], reason }.
export async function runWithWatchdog(o) {
  const retries = o.retries ?? 2;
  const attempts = [];
  for (let i = 0; i <= retries; i++) {
    if (i > 0) o.log?.(`retry ${i} of ${retries}`);
    const r = await runOnce(o);
    attempts.push(r);
    if (r.ok) return { ok: true, attempts };
  }
  return { ok: false, attempts, reason: attempts[attempts.length - 1].reason };
}
