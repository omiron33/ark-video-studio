// Photoreal mode: renders a song's GPU scenes in headless Chrome on the Mac's graphics chip.
//   node photoreal/render.mjs stills --song ../genesis8-the-dove --scene dove --t 140,142.5 [--samples 16]
//   node photoreal/render.mjs video  --song ../genesis8-the-dove --scene dove [--from 139.7 --to 144.7] [--samples 16] [--heartbeat f.json]
//   node photoreal/render.mjs layer  --song ../genesis8-the-dove --scene dove --from 139.7 --to 144.7 --out dove.lyric.mkv
//   node photoreal/render.mjs probe  --song ../genesis8-the-dove --scenes '[{"id":"01","scene":"dove","from":0,"to":8}]'
// `video` renders the picture (for a scene with scenes/<name>.lyric.js, the picture without its words);
// `layer` renders that lyric layer alone with transparency; `probe` times each scene cheaply and
// measures how fast its camera moves at the cuts, for the film's test render and key stills.
// A song folder holds scenes/<name>.js, data/lyrics.json and media/song.wav (see photoreal/README.md).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.resolve(HERE, '..');
const WEB = path.join(HERE, 'web');
const argv = process.argv.slice(2);
const mode = argv[0];
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = 1920, H = 1080;
const SONG = path.resolve(opt('song', '.'));
if (!fs.existsSync(path.join(SONG, 'scenes'))) { console.error('--song must be a folder with scenes/'); process.exit(1); }

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png' };
let onFrame = null;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname === '/frame') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => { try { await onFrame(Buffer.concat(chunks)); res.end('ok'); } catch (e) { res.statusCode = 500; res.end(String(e)); } });
    return;
  }
  const p = decodeURIComponent(url.pathname);
  let base, rel;
  if (p.startsWith('/song/')) { base = SONG; rel = p.slice(6); }
  else if (p.startsWith('/node_modules/')) { base = ENGINE; rel = p.slice(1); }
  else { base = WEB; rel = p === '/' ? 'index.html' : p.slice(1); }
  const f = path.resolve(base, rel);
  if (!f.startsWith(base + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', TYPES[path.extname(f)] ?? 'application/octet-stream');
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: CHROME, headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
});
const lyricOf = (scene) => fs.existsSync(path.join(SONG, 'scenes', `${scene}.lyric.js`));
async function openScene(scene, params) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 2000)); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('requestfailed', () => {});
  const p64 = Buffer.from(params).toString('base64');
  await page.goto(`http://127.0.0.1:${port}/?scene=${scene}&params=${encodeURIComponent(p64)}${lyricOf(scene) ? '&lyric=1' : ''}`);
  await page.waitForFunction(() => window.G && (window.G.ready || window.G.error), null, { timeout: 120000 });
  const err = await page.evaluate(() => window.G.error);
  if (err) throw Error(`PAGE ERROR in ${scene}: ${err}`);
  return page;
}
const samples = +opt('samples', 16);
const heartbeat = opt('heartbeat');
const beat = (o) => { if (heartbeat) fs.writeFileSync(heartbeat, JSON.stringify({ ...o, at: Date.now() })); };

if (mode === 'probe') {
  // One Chrome, one page per scene: a few frames at 1 and 4 sub-frames give the fixed and per-sample
  // cost of a frame, and the camera sampled at both ends gives how fast each cut moves.
  const list = JSON.parse(opt('scenes', '[]'));
  const vec = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const dir = (c) => { const d = [c.target[0] - c.pos[0], c.target[1] - c.pos[1], c.target[2] - c.pos[2]]; const l = Math.hypot(...d); return [d.map((x) => x / l), l]; };
  // screen motion in frame heights per second, from camera turn and travel relative to what it looks at
  const speed = (a, b, dt) => {
    const [da, la] = dir(a), [db] = dir(b);
    const turn = Math.acos(Math.min(1, da[0] * db[0] + da[1] * db[1] + da[2] * db[2])) / ((a.fov * Math.PI) / 180);
    return (turn + vec(a.pos, b.pos) / la + Math.abs(a.fov - b.fov) / a.fov) / dt;
  };
  try {
    for (const s of list) {
      const t0 = Date.now();
      const page = await openScene(s.scene, JSON.stringify({ ...(s.params ?? {}), id: s.id, from: s.from, to: s.to }));
      const loadMs = Date.now() - t0;
      const mid = (s.from + s.to) / 2;
      const ms1 = await page.evaluate(([t]) => window.G.time(t, 1), [mid]);
      const ms4 = await page.evaluate(([t]) => window.G.time(t, 4), [mid]);
      const dt = 1 / 30;
      const cam = (t) => page.evaluate((t) => window.G.cameraAt(t), t);
      const inSpeed = speed(await cam(s.from + 0.001), await cam(s.from + 0.001 + dt), dt);
      const outSpeed = speed(await cam(s.to - dt - 0.001), await cam(s.to - 0.001), dt);
      const layer = await page.evaluate(() => window.G.scene.layer);
      await page.close();
      const perSample = Math.max(0.1, (ms4 - ms1) / 3), fixed = Math.max(0, ms1 - perSample);
      console.log('PROBE ' + JSON.stringify({ id: s.id, scene: s.scene, loadMs, fixedMs: +fixed.toFixed(1), perSampleMs: +perSample.toFixed(2), inSpeed: +inSpeed.toFixed(3), outSpeed: +outSpeed.toFixed(3), layer }));
    }
  } finally { await browser.close(); server.close(); }
  process.exit(0);
}

const clip = opt('scene');
if (!clip) { console.error('--scene is required'); process.exit(1); }
let page;
try { page = await openScene(clip, opt('params', '{}')); } catch (e) { console.error(e.message); await browser.close(); process.exit(1); }
const info = await page.evaluate(() => window.G.scene);

try {
  if (mode === 'stills') {
    const out = path.resolve(opt('out', path.join(SONG, 'out', clip, 'stills')));
    fs.mkdirSync(out, { recursive: true });
    const ts = opt('t', '').split(',').filter(Boolean).map(Number);
    for (const t of ts) {
      const t0 = Date.now();
      await page.evaluate(([t, s]) => window.G.still(t, s), [t, samples]);
      const f = path.join(out, `${clip}-${t.toFixed(2)}.png`);
      await page.screenshot({ path: f, clip: { x: 0, y: 0, width: W, height: H } });
      console.log(f, `${Date.now() - t0} ms`);
    }
  } else if (mode === 'video' || mode === 'layer') {
    const isLayer = mode === 'layer';
    if (isLayer && !info.layer) throw Error(`${clip} has no scenes/${clip}.lyric.js`);
    const from = +opt('from', info.from), to = +opt('to', info.to), fps = +opt('fps', 60);
    const out = path.resolve(opt('out', path.join(SONG, 'out', clip, isLayer ? `${clip}.lyric.mkv` : `${clip}.mp4`)));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const audio = argv.includes('--noaudio') || isLayer ? '' : path.join(SONG, 'media/song.wav');
    // the lyric layer keeps its transparency losslessly (FFV1 in Matroska); mostly-empty frames stay small
    const codec = isLayer ? ['-vf', 'vflip,format=yuva444p', '-c:v', 'ffv1', '-level', '3', '-slices', '16'] : null;
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error',
      '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', 'pipe:0',
      ...(audio && fs.existsSync(audio) ? ['-ss', String(from), '-t', String(to - from), '-i', audio] : []),
      ...(codec ?? ['-vf', 'vflip,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
        '-c:v', 'libx264', '-preset', opt('preset', 'slow'), '-crf', opt('crf', '16')]),
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
      ...(audio && fs.existsSync(audio) ? ['-c:a', 'aac', '-b:a', '320k', '-af', `afade=t=in:d=0.15,afade=t=out:st=${Math.max(0, to - from - 0.25)}:d=0.25`, '-shortest'] : []), ...(isLayer ? [] : ['-movflags', '+faststart']), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const n = Math.round((to - from) * fps);
    let k = 0; const t0 = Date.now();
    onFrame = (buf) => new Promise((res, rej) => {
      if (buf.length !== W * H * 4) return rej(Error('bad frame size ' + buf.length));
      k++;
      beat({ frame: k, of: n, msPerFrame: Math.round((Date.now() - t0) / k) });
      if (k % 30 === 0 || k === n) {
        const el = (Date.now() - t0) / 1000;
        console.log(`frame ${k}/${n}  ${(el / k * 1000).toFixed(0)} ms/frame  eta ${((n - k) * el / k).toFixed(0)} s`);
      }
      if (ff.stdin.write(buf)) res(); else ff.stdin.once('drain', res);
    });
    beat({ frame: 0, of: n });
    const r = await page.evaluate((o) => window.G.stream(o), { from, to, fps, samples, shutter: +opt('shutter', 0.5), url: `http://127.0.0.1:${port}/frame`, layer: isLayer });
    ff.stdin.end();
    const code = await new Promise((r) => ff.on('close', r));
    if (code !== 0) throw Error(`ffmpeg exited with ${code} writing ${out}`);
    console.log('wrote', out, r);
  }
} finally {
  await browser.close();
  server.close();
}
