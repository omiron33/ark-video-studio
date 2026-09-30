// The machines a film can render on. This Mac is always one. Others are listed in a local file that
// never goes in the repository, because it holds hostnames and addresses:
//   ~/.config/ark/machines.json (or $ARK_MACHINES)
//   { "machines": [ { "name": "omipc", "kind": "helper", "helper": "omipc", "dashboard": "http://<host>:5299", "minFreeVramMB": 1500 } ] }
// A "helper" machine is a Windows PC reached through a small command on this Mac with the verbs
// `run "<cmd.exe command>"`, `put <local> <remote>` and `get <remote> <local>` (for example the
// `omipc` helper, which wraps SSH over Tailscale). Nothing is installed there beyond Node, Chrome and
// FFmpeg: the engine and each song are copied over as content-addressed bundles, so a change is
// sent once and an unchanged engine is never sent again.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { filesUnder } from './keys.mjs';

export function loadMachines({ file = process.env.ARK_MACHINES ?? path.join(os.homedir(), '.config', 'ark', 'machines.json'), only } = {}) {
  let list = [];
  try { list = JSON.parse(fs.readFileSync(file, 'utf8')).machines ?? []; } catch {}
  const onPath = (c) => spawnSync('sh', ['-c', `command -v ${c}`], { encoding: 'utf8' }).status === 0;
  // with no file, a helper named omipc on the PATH is picked up on its own
  if (!list.length && onPath('omipc')) list = [{ name: 'omipc', kind: 'helper', helper: 'omipc' }];
  const machines = [new LocalMachine(), ...list.filter((m) => m.kind === 'helper').map((m) => new HelperMachine(m))];
  return only ? machines.filter((m) => only.includes(m.name)) : machines;
}

export class LocalMachine {
  constructor() { this.name = 'mac'; this.remote = false; }
  async available() { return true; }
  describe() { return `this Mac (${os.cpus()[0]?.model ?? 'unknown CPU'})`; }
}

const enc = (ps) => Buffer.from(ps, 'utf16le').toString('base64');
const winq = (s) => `"${String(s).replace(/"/g, '')}"`;

export class HelperMachine {
  constructor(cfg) {
    Object.assign(this, { minFreeVramMB: 1500, ...cfg });
    this.remote = true;
    this.synced = new Map();
  }
  sh(cmd, { timeout = 120000 } = {}) {
    const r = spawnSync(this.helper, ['run', cmd], { encoding: 'utf8', timeout, maxBuffer: 64 << 20 });
    return { ok: r.status === 0, out: (r.stdout ?? '').replace(/\r/g, ''), err: (r.stderr ?? '') + (r.error ? r.error.message : '') };
  }
  ps(script, o) { return this.sh(`powershell -NoProfile -NonInteractive -EncodedCommand ${enc(`$ProgressPreference='SilentlyContinue'; ${script}`)}`, o); }
  describe() { return `${this.name} (${this.gpu ?? 'GPU unknown'})`; }

  // reachable, with Node, Chrome and FFmpeg, and enough free graphics memory for one worker
  async available() {
    const r = this.ps(`$u=$env:USERPROFILE; $n=(Get-Command node -EA SilentlyContinue).Source; $f=(Get-Command ffmpeg -EA SilentlyContinue).Source; $c=Test-Path 'C:/Program Files/Google/Chrome/Application/chrome.exe'; $g=(nvidia-smi --query-gpu=name,memory.free,memory.total --format=csv,noheader,nounits 2>$null) -join ';'; "ARK|$u|$n|$f|$c|$g"`, { timeout: 30000 });
    const line = r.out.split('\n').find((l) => l.startsWith('ARK|'));
    if (!r.ok || !line) { this.why = `not reachable (${(r.err || r.out).trim().split('\n').pop() || 'no answer'})`; return false; }
    const [, home, node, ffmpeg, chrome, gpu] = line.split('|');
    if (!node || !ffmpeg || chrome !== 'True') { this.why = `missing ${[!node && 'Node', !ffmpeg && 'FFmpeg', chrome !== 'True' && 'Chrome'].filter(Boolean).join(', ')}`; return false; }
    this.root = `${home.replace(/\\/g, '/')}/ark`;
    const [name, free, total] = (gpu ?? '').split(',').map((x) => x.trim());
    this.gpu = name || 'unknown GPU';
    this.freeVramMB = +free || null; this.totalVramMB = +total || null;
    if (this.freeVramMB != null && this.freeVramMB < this.minFreeVramMB) { this.why = `only ${this.freeVramMB} MB of graphics memory free`; return false; }
    return true;
  }

  // Send a bundle (name, base folder, files) unless an identical one is already there; returns its
  // folder on the machine.
  sync(name, base, files) {
    const h = crypto.createHash('sha256');
    for (const f of files) h.update(path.relative(base, f)).update(fs.readFileSync(f));
    const dir = `${this.root}/${name}-${h.digest('hex').slice(0, 12)}`;
    if (this.synced.has(dir)) return dir;
    if (!this.ps(`if (Test-Path '${dir}/.complete') { 'HAVE' } else { 'NEED' }`).out.includes('HAVE')) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-bundle-'));
      const list = path.join(tmp, 'files.txt'), tgz = path.join(tmp, 'b.tgz');
      fs.writeFileSync(list, files.map((f) => path.relative(base, f)).join('\n') + '\n');
      const t = spawnSync('tar', ['-czf', tgz, '-C', base, '-T', list], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
      if (t.status !== 0) throw Error(`could not pack ${name}: ${t.stderr}`);
      this.ps(`New-Item -ItemType Directory -Force -Path '${this.root}/incoming','${dir}' | Out-Null`);
      const incoming = `${this.root}/incoming/${path.basename(dir)}.tgz`;
      const p = spawnSync(this.helper, ['put', tgz, incoming], { encoding: 'utf8', timeout: 30 * 60000 });
      if (p.status !== 0) throw Error(`could not send ${name} to ${this.name}: ${p.stderr}`);
      const x = this.ps(`tar -xzf '${incoming}' -C '${dir}'; if ($LASTEXITCODE -eq 0) { Remove-Item '${incoming}'; New-Item '${dir}/.complete' | Out-Null; 'OK' }`, { timeout: 30 * 60000 });
      fs.rmSync(tmp, { recursive: true, force: true });
      if (!x.out.includes('OK')) throw Error(`could not unpack ${name} on ${this.name}: ${x.err || x.out}`);
    }
    this.synced.set(dir, true);
    return dir;
  }

  // Engine and song on the machine; returns { engine, song }.
  prepare(engineRoot, song) {
    const skip = (f) => path.basename(f).startsWith('.');
    const engineFiles = [
      ...filesUnder(path.join(engineRoot, 'photoreal')), path.join(engineRoot, 'package.json'),
      ...filesUnder(path.join(engineRoot, 'node_modules', 'playwright-core')),
      path.join(engineRoot, 'node_modules', 'three', 'package.json'), ...filesUnder(path.join(engineRoot, 'node_modules', 'three', 'build')),
    ].filter((f) => !skip(f) && fs.existsSync(f));
    const songFiles = [...['scenes', 'lib', 'data'].flatMap((d) => filesUnder(path.join(song, d))), path.join(song, 'film.json')].filter((f) => !skip(f) && fs.existsSync(f));
    return { engine: this.sync('engine', engineRoot, engineFiles), song: this.sync(`song-${path.basename(song)}`, song, songFiles) };
  }

  // The command that runs one render job there; its heartbeat streams back on stdout.
  command({ engine, song }, job, renderArgs) {
    const args = renderArgs.map((a) => (/[\s&|<>^"]/.test(a) ? winq(a) : a)).join(' ');
    return { cmd: this.helper, args: ['run', `cd /d ${winq(engine)} && node photoreal/render.mjs ${args} --song ${winq(song)} --job ${job} --heartbeat -`] };
  }

  // Stop a job: its Node worker and the Chrome it started.
  kill(job) {
    return this.ps(`$w = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*--job ${job}*' -and $_.Name -eq 'node.exe' }; foreach ($p in $w) { Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*ark-worker=$($p.ProcessId)*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -EA SilentlyContinue }; Stop-Process -Id $p.ProcessId -Force -EA SilentlyContinue }`);
  }

  fetch(remote, local) {
    const g = spawnSync(this.helper, ['get', remote, local], { encoding: 'utf8', timeout: 30 * 60000 });
    if (g.status !== 0) throw Error(`could not fetch ${remote} from ${this.name}: ${g.stderr}`);
    this.ps(`Remove-Item -Force -EA SilentlyContinue '${remote}'`);
  }

  // The machine's shared-GPU dashboard, if it has one: every job there is announced.
  async announce(phase, body) {
    if (!this.dashboard) return null;
    try {
      const r = await fetch(`${this.dashboard}/api/renders/${phase}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
      return r.ok ? await r.json().catch(() => ({})) : null;
    } catch { return null; }
  }
}
