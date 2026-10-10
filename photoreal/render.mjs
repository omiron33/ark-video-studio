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
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { sceneKind } from './lib/keys.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.resolve(HERE, '..');
const WEB = path.join(HERE, 'web');
const argv = process.argv.slice(2);
const mode = argv[0];
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const CHROME = process.env.CHROME ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
// ANGLE backend: Metal on the Mac. On Windows, Chrome's own default (Direct3D 11) proved the most
// reliable over a remote session; forcing OpenGL lost the context on most runs. ARK_ANGLE overrides
// ('default' for Chrome's choice). Whatever the backend, a machine only renders the scenes whose
// pictures matched this Mac's (see film.mjs).
const ANGLE = process.env.ARK_ANGLE === 'default' ? null : process.env.ARK_ANGLE ?? (process.platform === 'darwin' ? 'metal' : process.platform === 'win32' ? null : 'vulkan');
// --res WxH draws at another size (default 1920x1080); the page reads it from its URL
const RES = opt('res', '1920x1080');
if (!/^\d+x\d+$/.test(RES)) { console.error('--res must look like 3840x2160'); process.exit(1); }
const [W, H] = RES.split('x').map(Number);
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

// premium scenes (a declared kind) render through web/premium/ with HTML-in-canvas enabled for
// in-world text; existing scenes keep exactly the browser and page they always had
const listed = (() => { try { return JSON.parse(Buffer.from(opt('scenes64', ''), 'base64').toString('utf8') || opt('scenes', '[]')).map((x) => x.scene); } catch { return []; } })();
const anyPremium = [opt('scene'), ...listed].filter(Boolean).some((sc) => sceneKind(SONG, sc));
const browser = await chromium.launch({
  executablePath: CHROME, headless: true,
  // --ark-worker marks this Chrome (which Playwright starts in its own process group) so the
  // watchdog can find and kill it along with this worker
  args: [`--ark-worker=${process.pid}`, ...(anyPremium ? ['--enable-blink-features=CanvasDrawElement'] : []), ...(ANGLE ? [`--use-angle=${ANGLE}`] : []), '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
});
const lyricOf = (scene) => fs.existsSync(path.join(SONG, 'scenes', `${scene}.lyric.js`));
async function openScene(scene, params, tries = 1) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  // Windows resets a GPU that goes about two seconds without finishing submitted work, losing the
  // WebGL context (black frames). Flushing after every draw keeps each submission short. It changes
  // no pixels, and it lives here rather than in web/ so it doesn't touch any segment's cache key.
  if ((process.platform === 'win32' && !process.env.ARK_NO_FLUSH) || process.env.ARK_FLUSH_EACH_DRAW) await page.addInitScript(() => {
    for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) for (const f of ['drawArrays', 'drawElements']) {
      const orig = C.prototype[f];
      C.prototype[f] = function (...a) { const r = orig.apply(this, a); this.flush(); return r; };
    }
  });
  page.on('console', (m) => {
    if (/CONTEXT_LOST/.test(m.text())) page.contextLost = true;   // the GPU driver gave up on this scene
    if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 2000));
  });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('requestfailed', () => {});
  const p64 = Buffer.from(params).toString('base64');
  const kind = sceneKind(SONG, scene);
  await page.goto(`http://127.0.0.1:${port}/${kind ? `premium/index.html?kind=${kind}&` : '?'}scene=${scene}&params=${encodeURIComponent(p64)}${lyricOf(scene) ? '&lyric=1' : ''}${RES !== '1920x1080' ? `&res=${RES}` : ''}`);
  await page.waitForFunction(() => window.G && (window.G.ready || window.G.error), null, { timeout: 120000 });
  const err = await page.evaluate(() => window.G.error);
  if (err) {
    // a GPU busy with other work (on a shared machine) can refuse a WebGL context for a moment
    if (/creating WebGL context/.test(err) && tries < 4) { await page.close(); await new Promise((r) => setTimeout(r, 3000 * tries)); return openScene(scene, params, tries + 1); }
    throw Error(`PAGE ERROR in ${scene}: ${err}`);
  }
  return page;
}
const samples = +opt('samples', 16);
const heartbeat = opt('heartbeat');
// --heartbeat - prints the heartbeat as "HB {json}" lines instead, for a worker on another machine
// whose output streams back over SSH
const beat = (o) => {
  if (!heartbeat) return;
  const line = JSON.stringify({ ...o, at: Date.now() });
  if (heartbeat === '-') process.stdout.write(`HB ${line}\n`); else fs.writeFileSync(heartbeat, line);
};
beat({ frame: 0 });

if (mode === 'checkstills') {
  // One still per scene (list in --scenes64, each with its time t) for comparing one machine's
  // pictures with another's: writes <out>/<id>.png and prints CHECK {"id", "lost"} per scene.
  const list = JSON.parse(Buffer.from(opt('scenes64', ''), 'base64').toString('utf8') || '[]');
  const out = path.resolve(opt('out', path.join(SONG, 'out', 'checkstills')));
  fs.mkdirSync(out, { recursive: true });
  try {
    for (const s of list) {
      let lost = false;
      try {
        const page = await openScene(s.scene, JSON.stringify({ ...(s.params ?? {}), id: s.id, from: s.from, to: s.to }));
        await page.evaluate(([t, n]) => window.G.still(t, n), [s.t, +opt('samples', 2)]);
        await page.screenshot({ path: path.join(out, `${s.id}.png`), clip: { x: 0, y: 0, width: W, height: H }, timeout: 600000 });
        lost = !!page.contextLost;
        await page.close();
      } catch (e) { lost = true; console.log(`scene ${s.id}: ${e.message.split('\n')[0]}`); }
      console.log('CHECK ' + JSON.stringify({ id: s.id, lost }));
    }
  } finally { server.closeAllConnections?.(); server.close(); await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 10000))]); }
  process.exit(0);
}

if (mode === 'probe') {
  // One Chrome, one page per scene: a few frames at 1 and 4 sub-frames give the fixed and per-sample
  // cost of a frame, and the camera sampled at both ends gives how fast each cut moves.
  const list = JSON.parse(opt('scenes64') ? Buffer.from(opt('scenes64'), 'base64').toString('utf8') : opt('scenes', '[]'));
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
      const lost = !!page.contextLost || await page.evaluate(() => !!document.querySelector('canvas')?.getContext('webgl2')?.isContextLost?.());
      const gpu = await page.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2'); const x = gl?.getExtension('WEBGL_debug_renderer_info'); return x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
      await page.close();
      const perSample = Math.max(0.1, (ms4 - ms1) / 3), fixed = Math.max(0, ms1 - perSample);
      console.log('PROBE ' + JSON.stringify({ id: s.id, scene: s.scene, loadMs, fixedMs: +fixed.toFixed(1), perSampleMs: +perSample.toFixed(2), inSpeed: +inSpeed.toFixed(3), outSpeed: +outSpeed.toFixed(3), layer, gpu, lost }));
    }
  } finally { server.closeAllConnections?.(); server.close(); await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 10000))]); }
  process.exit(0);
}

// Every scene's camera, sampled through the shot with nothing drawn: the speed of the picture's
// movement in frame heights per second (camera turn and travel relative to what it looks at), for
// the rest-to-rest check. Prints one "CAMERA {json}" line per scene.
if (mode === 'camera') {
  const list = JSON.parse(opt('scenes64') ? Buffer.from(opt('scenes64'), 'base64').toString('utf8') : opt('scenes', '[]'));
  const rate = +opt('rate', 15);
  const page = await browser.newPage({ viewport: { width: 64, height: 64 } });
  // the premium page's import map resolves three and its add-ons for premium scenes too; with no
  // scene named it draws nothing
  await page.goto(`http://127.0.0.1:${port}/premium/index.html?kind=none`);
  try {
    for (const s of list) {
      const r = await page.evaluate(async ([s, rate]) => {
        const m = await import(`/song/scenes/${s.scene}.js`);
        const sc = typeof m.default === 'function' ? await m.default({ ...(s.params ?? {}), id: s.id, from: s.from, to: s.to }) : m.default;
        if (!sc.camera) return { id: s.id, speed: [] };
        const dir = (c) => { const d = [c.target[0] - c.pos[0], c.target[1] - c.pos[1], c.target[2] - c.pos[2]]; const l = Math.hypot(...d); return [d.map((x) => x / l), l]; };
        const n = Math.max(2, Math.round((s.to - s.from) * rate)), dt = 1 / 120, speed = [];
        for (let i = 0; i <= n; i++) {
          const t = Math.min(s.to - dt - 1e-4, s.from + 1e-4 + ((s.to - s.from) * i) / n);
          const a = sc.camera(t), b = sc.camera(t + dt);
          const [da, la] = dir(a), [db] = dir(b), fa = a.fov ?? 40, fb = b.fov ?? 40;
          const turn = Math.acos(Math.min(1, da[0] * db[0] + da[1] * db[1] + da[2] * db[2])) / ((fa * Math.PI) / 180);
          const travel = Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2]) / la;
          speed.push((turn + travel + Math.abs(fa - fb) / fa) / dt);
        }
        return { id: s.id, speed };
      }, [s, rate]).catch((e) => ({ id: s.id, error: String(e.message).slice(0, 300) }));
      console.log('CAMERA ' + JSON.stringify(r));
    }
  } finally { await page.close(); server.closeAllConnections?.(); server.close(); await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 10000))]); }
  process.exit(0);
}

// The people of a scene, rendered by Blender as their own transparent layer (scenes/<name>.people.json
// says who stands where, in what pose and light; the song's renderer script draws them). The camera
// comes from the scene module itself, frame by frame, so the people sit exactly in the shader's world.
if (mode === 'people') {
  const sceneName = opt('scene');
  const spec = JSON.parse(fs.readFileSync(path.join(SONG, 'scenes', `${sceneName}.people.json`), 'utf8'));
  const params = JSON.parse(opt('params64') ? Buffer.from(opt('params64'), 'base64').toString('utf8') : opt('params', '{}'));
  const from = +opt('from'), to = +opt('to'), fps = +opt('fps', 60);
  const n = Math.round((to - from) * fps);
  const out = path.resolve(opt('out'));
  // the camera track, from the scene module evaluated in the page (no picture is drawn)
  const page = await browser.newPage({ viewport: { width: 64, height: 64 } });
  await page.goto(`http://127.0.0.1:${port}/`);
  const track = await page.evaluate(async ([name, params, from, fps, n]) => {
    const m = await import(`/song/scenes/${name}.js`);
    const sc = typeof m.default === 'function' ? await m.default(params) : m.default;
    const out = [];
    for (let i = 0; i < n; i++) { const t = from + i / fps; const c = sc.camera(t); out.push({ t, pos: c.pos, target: c.target, fov: c.fov ?? 40, roll: c.roll ?? 0, focus: c.focus, aperture: c.aperture ?? 0 }); }
    return out;
  }, [sceneName, { ...params }, from, fps, n]).catch((e) => { throw Error('camera track: ' + e.message); });
  await page.close();
  server.closeAllConnections?.(); server.close(); await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 10000))]);
  const work = `${out}.frames`;
  fs.rmSync(work, { recursive: true, force: true }); fs.mkdirSync(work, { recursive: true });
  const specFile = path.join(work, 'spec.json');
  fs.writeFileSync(specFile, JSON.stringify({ ...spec, fps, from, camera: track }));
  const film = JSON.parse(fs.readFileSync(path.join(SONG, 'film.json'), 'utf8'));
  const script = path.join(SONG, film.people?.renderer ?? 'tools/blender_layer.py');
  const blender = process.env.BLENDER ?? (process.platform === 'darwin' ? '/Applications/Blender.app/Contents/MacOS/Blender' : 'blender');
  beat({ frame: 0, of: n });
  const t0 = Date.now();
  const code = await new Promise((res) => {
    const b = spawn(blender, ['-b', '-P', script, '--', '--spec', specFile, '--out', work, '--res', `${W}x${H}`, '--samples', String(samples), '--frames', `0:${n}`], { stdio: ['ignore', 'pipe', 'inherit'] });
    let carry = '';
    b.stdout.on('data', (d) => {
      carry += d; const lines = carry.split('\n'); carry = lines.pop();
      for (const l of lines) { const m = /^FRAME (\d+)/.exec(l); if (m) { const k = +m[1] + 1; beat({ frame: k, of: n, msPerFrame: Math.round((Date.now() - t0) / k) }); if (k % 10 === 0 || k === n) console.log(`people frame ${k}/${n}`); } }
    });
    b.on('close', res);
  });
  if (code !== 0) { console.error(`blender exited with ${code}`); process.exit(1); }
  // transparency kept losslessly (FFV1, as the lyric layer)
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(work, '%05d.png'), '-vf', 'format=yuva444p', '-c:v', 'ffv1', '-level', '3', '-slices', '16', out], { stdio: 'inherit' });
  if (r.status !== 0) { console.error('encoding the people layer failed'); process.exit(1); }
  fs.rmSync(work, { recursive: true, force: true });
  console.log('wrote', out, { frames: n, ms: Date.now() - t0 });
  process.exit(0);
}

const clip = opt('scene');
if (!clip) { console.error('--scene is required'); process.exit(1); }
let page;
// --params64 carries the parameters base64-encoded, which survives remote shells' quoting
const clipParams = opt('params64') ? Buffer.from(opt('params64'), 'base64').toString('utf8') : opt('params', '{}');
try { page = await openScene(clip, clipParams); } catch (e) { console.error(e.message); await browser.close(); process.exit(1); }
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
      await page.screenshot({ path: f, clip: { x: 0, y: 0, width: W, height: H }, timeout: 600000 });
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
  server.closeAllConnections?.();
  server.close();
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 10000))]);
}
// nothing may keep a finished worker alive (a lingering Chrome or socket would look like a stall)
process.exit(0);
