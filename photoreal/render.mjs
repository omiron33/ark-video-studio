// Photoreal mode: renders a song's GPU scenes in headless Chrome on the Mac's graphics chip.
//   node photoreal/render.mjs stills --song ../genesis8-the-dove --scene dove --t 140,142.5 [--samples 16]
//   node photoreal/render.mjs video  --song ../genesis8-the-dove --scene dove [--from 139.7 --to 144.7] [--samples 16]
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
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 2000)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const clip = opt('scene');
if (!clip) { console.error('--scene is required'); process.exit(1); }
page.on('requestfailed', () => {});
const sceneParams = Buffer.from(opt('params', '{}')).toString('base64');
await page.goto(`http://127.0.0.1:${port}/?scene=${clip}&params=${encodeURIComponent(sceneParams)}`);
await page.waitForFunction(() => window.G && (window.G.ready || window.G.error), null, { timeout: 120000 });
const err = await page.evaluate(() => window.G.error);
if (err) { console.error('PAGE ERROR', err); await browser.close(); process.exit(1); }
const info = await page.evaluate(() => window.G.scene);
const samples = +opt('samples', 16);

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
  } else if (mode === 'video') {
    const from = +opt('from', info.from), to = +opt('to', info.to), fps = +opt('fps', 60);
    const out = path.resolve(opt('out', path.join(SONG, 'out', clip, `${clip}.mp4`)));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const audio = argv.includes('--noaudio') ? '' : path.join(SONG, 'media/song.wav');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error',
      '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', 'pipe:0',
      ...(audio && fs.existsSync(audio) ? ['-ss', String(from), '-t', String(to - from), '-i', audio] : []),
      '-vf', 'vflip,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
      '-c:v', 'libx264', '-preset', opt('preset', 'slow'), '-crf', opt('crf', '16'),
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
      ...(audio && fs.existsSync(audio) ? ['-c:a', 'aac', '-b:a', '320k', '-af', `afade=t=in:d=0.15,afade=t=out:st=${Math.max(0, to - from - 0.25)}:d=0.25`, '-shortest'] : []), '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const n = Math.round((to - from) * fps);
    let k = 0; const t0 = Date.now();
    onFrame = (buf) => new Promise((res, rej) => {
      if (buf.length !== W * H * 4) return rej(Error('bad frame size ' + buf.length));
      k++;
      if (k % 30 === 0 || k === n) {
        const el = (Date.now() - t0) / 1000;
        console.log(`frame ${k}/${n}  ${(el / k * 1000).toFixed(0)} ms/frame  eta ${((n - k) * el / k).toFixed(0)} s`);
      }
      if (ff.stdin.write(buf)) res(); else ff.stdin.once('drain', res);
    });
    const r = await page.evaluate((o) => window.G.stream(o), { from, to, fps, samples, shutter: +opt('shutter', 0.5), url: `http://127.0.0.1:${port}/frame` });
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
    console.log('wrote', out, r);
  }
} finally {
  await browser.close();
  server.close();
}
