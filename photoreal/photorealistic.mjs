// The photorealistic setting: a film's code scenes, repainted to look filmed by MiniMax H3.
//   node photoreal/photorealistic.mjs --song ../king-of-glory --only 73 [--from 409.4 --to 417.4]
//   options: [--look none|code|<image>] [--keep 5] [--steps 20] [--seed 42] [--word-samples 16] [--prompt-file f]
//            [--reuse] (keep this window's code passes and H3 pieces) [--out film.mp4]
//
// This is separate from the render tiers (fast, standard, premium, ultra), which stay pure code: it
// never changes their segments, keys or output. The picture it makes is GENERATED: H3 paints every
// pixel except the in-scene words. Each scene's code render (with its words left out) steers H3 for
// the first `keep` of `steps` denoise steps (Code Video Model's early-step conditioning), so layout,
// camera, timing and motion come from the code and the surface detail from H3.
//
// The words stay code. The scene is rendered twice more at full size, with and without its words; where
// the two differ is the words (and the light they cast), and those pixels are laid over H3's picture
// unchanged, so H3 never repaints a letter.
//
// Per scene in film.json: "photorealistic": { "prompt": "<what the shot shows, as live action>" }.
// --look picks the style reference: none (prompt only, the default: nothing but code and text in the
// repo), code (the scene's own first code frame) or an image file (which the repo then has to ship).
// H3 makes 24 fps pictures at 960x544, upscaled to 1920x1080; a scene longer than 15 s is made in
// pieces, each starting from the last frames of the one before. Output: out/photorealistic/<id>.mp4
// per scene, then out/film-photorealistic.mp4 with the song when every scene is done.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { H3, h3Len, findComfy, claimGpu, gpuProgress, gpuEnd, generate } from './lib/h3.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RENDER = path.join(HERE, 'render.mjs');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const SONG = path.resolve(opt('song', '.'));
const film = JSON.parse(fs.readFileSync(path.join(SONG, 'film.json'), 'utf8'));
const only = opt('only')?.split(',');
const scenes = film.scenes.filter((s) => !only || only.includes(s.id));
if (!scenes.length) { console.error('no scenes match --only'); process.exit(1); }
const keep = +opt('keep', 5), steps = +opt('steps', 20), seed = +opt('seed', 42), look = opt('look', 'none');
const wordSamples = opt('word-samples', '16');
const OUT = path.join(SONG, 'out', 'photorealistic');
// --reuse keeps the code passes and H3 pieces already made for this window (after a composite change)
const reuse = argv.includes('--reuse');
const have = (f) => reuse && fs.existsSync(f) && fs.statSync(f).size > 0;
const FW = 1920, FH = 1088;   // code renders at twice H3's 960x544, cropped to 1080 at the end

const run = (cmd, args, what) => {
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) throw Error(`${what} failed (${cmd} exited ${r.status})`);
};
const ff = (args, what) => run('ffmpeg', ['-y', '-loglevel', 'error', ...args], what);
const frameCount = (f) => +spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim();
const code = (s, from, to, { res, samples, nowords, out }) => run('node', [RENDER, 'video', '--song', SONG, '--scene', s.scene,
  '--params64', Buffer.from(JSON.stringify({ ...(s.params ?? {}), id: s.id, from: s.from, to: s.to })).toString('base64'),
  '--from', String(from), '--to', String(to), '--fps', String(H3.fps), '--res', res, '--samples', String(samples),
  '--noaudio', '--crf', '10', '--preset', 'medium', ...(nowords ? ['--nowords'] : []), '--out', out], `code render of ${s.id}`);

const { comfy, dashboard } = findComfy();
const done = [];
for (const s of scenes) {
  const prompt = s.photorealistic?.prompt ?? (opt('prompt-file') && fs.readFileSync(opt('prompt-file'), 'utf8').trim());
  if (!prompt) throw Error(`scene ${s.id} needs "photorealistic": { "prompt": "..." } in film.json (or --prompt-file)`);
  const from = +opt('from', s.from), to = +opt('to', s.to);
  const dir = path.join(OUT, s.id);
  fs.mkdirSync(dir, { recursive: true });
  const n = Math.round((to - from) * H3.fps);
  console.log(`scene ${s.id} (${s.scene}) ${from}-${to} s: ${n} frames`);

  // 1. the proxy: the code picture without its words, at H3's size and rate
  const proxy = path.join(dir, 'proxy.mp4');
  if (!have(proxy)) code(s, from, to, { res: `${H3.width}x${H3.height}`, samples: 4, nowords: true, out: proxy });
  // 2. the words: the full-size code picture with and without them
  const withWords = path.join(dir, 'words.mp4'), noWords = path.join(dir, 'plate.mp4');
  if (!have(withWords)) code(s, from, to, { res: `${FW}x${FH}`, samples: wordSamples, nowords: false, out: withWords });
  if (!have(noWords)) code(s, from, to, { res: `${FW}x${FH}`, samples: wordSamples, nowords: true, out: noWords });

  // the style reference
  let lookFile = null;
  if (look === 'code') { lookFile = path.join(dir, 'look.png'); ff(['-i', noWords, '-frames:v', '1', lookFile], 'first code frame'); }
  else if (look !== 'none') lookFile = path.resolve(look);

  // 3. H3, in pieces of at most 362 frames; each later piece repeats the last 5 frames of the one before
  const OVER = 5, pieces = [];
  for (let start = 0; ;) {
    const want = Math.min(n - start, H3.maxFrames);
    const len = Math.min(h3Len(want), H3.maxFrames);
    pieces.push({ start, len });
    if (start + len >= n) break;
    start += len - OVER;
  }
  const outs = [];
  for (const [i, p] of pieces.entries()) {
    const tag = `${path.basename(SONG)}-${s.id}-${i}`;
    const piece = path.join(dir, `proxy-${i}.mp4`);
    // the proxy's frames for this piece, the last one held if the piece runs past the scene
    ff(['-i', proxy, '-vf', `trim=start_frame=${p.start}:end_frame=${p.start + p.len},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop=${p.len},trim=end_frame=${p.len}`, '-r', String(H3.fps), '-c:v', 'libx264', '-crf', '12', '-pix_fmt', 'yuv420p', piece], 'proxy piece');
    let guideFile = null;
    if (i > 0) {
      guideFile = path.join(dir, `guide-${i}.mp4`);
      const prev = outs[i - 1], pn = frameCount(prev);
      ff(['-i', prev, '-vf', `trim=start_frame=${pn - OVER},setpts=PTS-STARTPTS`, '-c:v', 'libx264', '-crf', '12', '-pix_fmt', 'yuv420p', guideFile], 'guide clip');
    }
    const out = path.join(dir, `h3-${i}-${seed}.mp4`);
    if (have(out)) { outs.push(out); continue; }
    const job = await claimGpu(dashboard, { description: `${path.basename(SONG)} scene ${s.id} photorealistic, piece ${i + 1}/${pieces.length} (${p.len} frames, ${H3.width}x${H3.height})`, project: path.basename(SONG), expectMinutes: Math.ceil(p.len / 12) });
    try {
      const r = await generate(comfy, { proxyFile: piece, lookFile, guideFile, prompt, frames: p.len, steps, keep, seed: seed + i, tag, out,
        onBeat: (min, pid) => { if (min && min % 5 === 0) gpuProgress(dashboard, job, `rendering for ${min} min, ComfyUI prompt ${pid}`); } });
      await gpuEnd(dashboard, job, 'done');
      console.log(`  piece ${i + 1}/${pieces.length}: ${r.seconds} s on the GPU`);
    } catch (e) { await gpuEnd(dashboard, job, 'failed'); throw e; }
    outs.push(out);
  }

  // 4. join the pieces (dropping each repeated head), upscale, crop to 1080, lay the code words back on top
  const list = path.join(dir, 'pieces.txt');
  const trimmed = outs.map((o, i) => {
    const t = path.join(dir, `piece-${i}.mp4`);
    ff(['-i', o, '-vf', `trim=start_frame=${i ? OVER : 0},setpts=PTS-STARTPTS`, '-an', '-c:v', 'libx264', '-crf', '10', '-pix_fmt', 'yuv420p', t], 'piece trim');
    return t;
  });
  fs.writeFileSync(list, trimmed.map((t) => `file '${t}'`).join('\n'));
  const gen = path.join(dir, `generated-${seed}.mp4`);
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-vf', `trim=end_frame=${n},scale=${FW}:${FH}:flags=lanczos`, '-c:v', 'libx264', '-crf', '10', '-pix_fmt', 'yuv420p', gen], 'join');
  const seg = path.join(OUT, `${s.id}.mp4`);
  const song = path.join(SONG, 'media', 'song.wav');
  ff(['-i', gen, '-i', withWords, '-i', noWords, ...(fs.existsSync(song) ? ['-ss', String(from), '-t', String(to - from), '-i', song] : []),
    '-filter_complex',
    // the matte: where the code picture changes when its words are left out, softened by a pixel
    // (in RGB: a YUV difference has an offset in every pixel), less a little for encoder noise
    '[1:v]format=gbrp,split[wa][w0];[2:v]format=gbrp[pa];[wa][pa]blend=all_mode=difference,'
    + 'colorchannelmixer=rr=.34:rg=.33:rb=.33:gr=.34:gg=.33:gb=.33:br=.34:bg=.33:bb=.33,format=gray,'
    + 'lut=y=\'clip((val-4)*24,0,255)\',gblur=sigma=1.2,format=gbrp[m];'
    + `[0:v]trim=end_frame=${n},format=gbrp[g];[w0]trim=end_frame=${n}[w];[g][w][m]maskedmerge,crop=1920:1080,format=yuv420p[v]`,
    '-map', '[v]', ...(fs.existsSync(song) ? ['-map', '3:a', '-c:a', 'aac', '-b:a', '320k', '-shortest'] : []),
    '-r', String(H3.fps), '-c:v', 'libx264', '-preset', 'slow', '-crf', '14',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', seg], 'word composite');
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify({ scene: s.id, from, to, frames: n, pieces, look, keep, steps, seed, prompt, generated: 'every pixel but the in-scene words is painted by MiniMax H3' }, null, 1));
  console.log('wrote', seg);
  done.push(seg);
}
if (!only && done.length === film.scenes.length) {
  const list = path.join(OUT, 'segments.txt');
  fs.writeFileSync(list, done.map((f) => `file '${f}'`).join('\n'));
  const out = path.resolve(opt('out', path.join(SONG, 'out', 'film-photorealistic.mp4')));
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out], 'film join');
  console.log('wrote', out);
}
process.exit(0);
