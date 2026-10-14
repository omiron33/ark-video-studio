// The photorealistic setting: a film's code scenes, repainted to look filmed by MiniMax H3.
//   node photoreal/photorealistic.mjs --song ../king-of-glory --only 73 [--from 409.4 --to 417.4]
//   options: [--look none|code|<image>] [--keep 5] [--steps 20] [--seed 42] [--word-samples 16] [--prompt-file f]
//            [--reuse] (keep this window's code passes and H3 pieces) [--out film.mp4] [--chain continuum|bridges]
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
//
// Words that tuck: with "photorealistic": { "tuck": true } (on by default in a music video; --no-tuck
// turns it off) the code words are cut where H3 paints something nearer in front of them, measured
// from H3's own frames, so only a line's end letter ever tucks (lib/tuck.py).
//
// The music video ("mode": "musicvideo", see musicvideo.mjs) uses this for its generated shots: only
// scenes with "source": "h3" are painted here. A generated shot with a code scene behind it works as
// above. One without ("source": "h3" and no "scene") is live action: H3 paints it from its prompt and
// look, steered by "photorealistic": { "proxy": "<a guide video in the song folder>" } when it has one
// (a Blender greybox of the blocking and camera, rendered at any size), and carries no words.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { H3, h3Len, findComfy, claimGpu, gpuProgress, gpuEnd, generate, upload, runGraph, STYLE_REFERENCE } from './lib/h3.mjs';
import { CONTINUUM, planChains, usesContinuum, timelinePrompt, continuumWorkflow, hasContinuum, chunkBounds } from './lib/continuum.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RENDER = path.join(HERE, 'render.mjs');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const SONG = path.resolve(opt('song', '.'));
const film = JSON.parse(fs.readFileSync(path.join(SONG, 'film.json'), 'utf8'));
const keep = +opt('keep', 5), steps = +opt('steps', 20), seed = +opt('seed', 42), look = opt('look', 'none');
const wordSamples = opt('word-samples', '16');
const maxFrames = Math.min(+opt('max-frames', H3.maxFrames), H3.maxFrames);
// --stage proxy|words|h3|composite|all: run one part for every unit, so the code passes can run on one
// machine while H3 runs on another (h3 waits for each unit's proxy; composite needs everything)
const stage = opt('stage', 'all');
// --proxy-blur <sigma>: soften the proxy H3 sees, so fine code patterns (dense rivets, crack networks)
// steer only the layout and are not copied as texture
const proxyBlur = +opt('proxy-blur', 0);
// --matte-floor <0-255>: how much a pixel must change with the words before it counts as a word (raise it
// when the words' glow on nearby code surfaces drags a haze of code picture into the composite)
const matteFloor = +opt('matte-floor', 4), matteGain = matteFloor <= 4 ? 24 : 12;
const doing = (k) => stage === 'all' || stage === k;
const OUT = path.join(SONG, 'out', 'photorealistic');
// --reuse keeps the code passes and H3 pieces already made for this window (after a composite change)
const reuse = argv.includes('--reuse') || stage !== 'all';
const have = (f) => reuse && fs.existsSync(f) && fs.statSync(f).size > 0;
const FW = 1920, FH = 1088;   // code renders at twice H3's 960x544, cropped to 1080 at the end

// The units H3 paints. By default each scene is one. With "photorealistic": { "takes": [...] } in film.json,
// consecutive scenes in one place are one take: H3 paints the take as one continuous generation (chained
// pieces), so the place, the people and the light stay the same across the code film's cuts inside it.
//   "photorealistic": { "style": "<the look, for every take>",
//                       "takes": [{ "id": "T04", "scenes": ["04", "05"], "prompt": "<the place>", "look": "looks/x.png" }] }
// A take's "look" is a style reference image (palette, light, texture; not its composition) shipped in the song folder.
// Each piece's prompt is the style, the take's place, then the action of the scenes it covers in order
// (each scene's own "photorealistic": { "prompt" }).
const PR = film.photorealistic ?? {};
// How a take longer than one H3 piece is joined (ON TRIAL since 2026-10-14, see lib/continuum.mjs):
//   "continuum" (default): ComfyUI-H3-Continuum chains, 5 s chunks with 22 frames of carried context,
//               steered chunk by chunk by the code render, colour/contrast matched back to the first chunk
//   "bridges":  the original pieces, each started from the previous piece's last 5 frames
// If photoreal takes look harsh or contrasty at their ends, pop every ~5 s, or stop following the code
// camera, Continuum is the first suspect: set "photorealistic": { "chain": "bridges" } or pass --chain bridges.
const chain = opt('chain', PR.chain ?? 'continuum');
if (!['continuum', 'bridges'].includes(chain)) throw Error(`"chain" is continuum or bridges, not ${chain}`);
const MV = film.mode === 'musicvideo';
const tuck = argv.includes('--no-tuck') ? false : argv.includes('--tuck') ? true : (PR.tuck ?? MV);
// a music video paints only its generated shots here; its code shots render as code (film.mjs)
const painted = MV ? film.scenes.filter((s) => s.source === 'h3') : film.scenes;
const byId = Object.fromEntries(painted.map((s) => [s.id, s]));
const allUnits = PR.takes
  ? PR.takes.map((t) => ({ id: t.id, place: t.prompt, look: t.look, scenes: t.scenes.map((id) => byId[id] ?? (() => { throw Error(`take ${t.id}: no scene ${id}`); })()) }))
  : painted.map((s) => ({ id: s.id, place: null, look: s.photorealistic?.look, scenes: [s] }));
for (const u of allUnits) {
  // a unit is steered by its code scenes (and keeps their words), or is live action with none
  const withCode = u.scenes.filter((s) => s.scene).length;
  if (withCode && withCode < u.scenes.length) throw Error(`take ${u.id} mixes code scenes and live-action shots; split it into two takes`);
  u.words = withCode > 0;
  u.guide = u.words ? null : (PR.takes?.find((t) => t.id === u.id)?.proxy ?? u.scenes[0].photorealistic?.proxy ?? null);
}
const covered = new Set(allUnits.flatMap((u) => u.scenes.map((s) => s.id)));
const missing = painted.filter((s) => !covered.has(s.id)).map((s) => s.id);
if (missing.length) throw Error(`scenes in no take: ${missing.join(', ')}`);
const only = opt('only')?.split(',');
const units = allUnits.filter((u) => !only || only.includes(u.id));
if (!units.length) { console.error('no takes or scenes match --only'); process.exit(1); }

const run = (cmd, args, what) => {
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) throw Error(`${what} failed (${cmd} exited ${r.status})`);
};
const ff = (args, what) => run('ffmpeg', ['-y', '-loglevel', 'error', ...args], what);
const frameCount = (f) => +spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim();
const code = (s, from, to, { res, samples, nowords, out }) => run('node', [RENDER, 'video', '--song', SONG, '--scene', s.scene,
  '--params64', Buffer.from(JSON.stringify({ ...(s.params ?? {}), id: s.id, from: s.from, to: s.to })).toString('base64'),
  '--from', String(from), '--to', String(to), '--fps', String(H3.fps), '--res', res, '--samples', String(samples),
  '--noaudio', '--crf', '10', '--preset', 'medium', ...(nowords ? ['--nowords'] : []), '--out', out + '.part.mp4'], `code render of ${s.id}`)
  || fs.renameSync(out + '.part.mp4', out);
const sceneFrames = (from, to) => Math.round(to * H3.fps) - Math.round(from * H3.fps);
// one code pass over a unit's window: each scene's part, joined (scene boundaries on whole frames)
const pass = (u, from, to, kind, dir) => {
  const parts = u.parts.map(({ s, a, b }) => {
    const sd = path.join(OUT, 'scenes', s.id, `${a}-${b}`);
    fs.mkdirSync(sd, { recursive: true });
    const f = path.join(sd, `${kind}.mp4`);
    if (!have(f)) code(s, a, b, kind === 'proxy' ? { res: `${H3.width}x${H3.height}`, samples: 4, nowords: true, out: f }
      : { res: `${FW}x${FH}`, samples: wordSamples, nowords: kind === 'plate', out: f });
    return { f, n: sceneFrames(a, b) };
  });
  const out = path.join(dir, `${kind}.mp4`);
  if (have(out)) return out;
  const list = path.join(dir, `${kind}.txt`);
  // each part trimmed or held to its exact frame count, so the passes line up frame for frame
  const fixed = parts.map(({ f, n }, i) => {
    const t = path.join(dir, `${kind}-part-${i}.mp4`);
    ff(['-i', f, '-vf', `tpad=stop_mode=clone:stop=2,trim=end_frame=${n},setpts=PTS-STARTPTS`, '-r', String(H3.fps), '-c:v', 'libx264', '-crf', '10', '-preset', 'medium', '-pix_fmt', 'yuv420p', t], `${kind} part`);
    return t;
  });
  fs.writeFileSync(list, fixed.map((t) => `file '${t}'`).join('\n'));
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out + '.part.mp4'], `${kind} join`);
  fs.renameSync(out + '.part.mp4', out);
  for (const t of fixed) fs.rmSync(t);
  return out;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { comfy, dashboard } = doing('h3') ? findComfy() : {};
const done = [];
for (const u of units) {
  const a0 = u.scenes[0].from, b0 = u.scenes.at(-1).to;
  const from = Math.max(+opt('from', a0), a0), to = Math.min(+opt('to', b0), b0);
  u.parts = u.scenes.map((s) => ({ s, a: Math.max(from, s.from), b: Math.min(to, s.to) })).filter((p) => p.b - p.a > 1 / H3.fps);
  if (!u.parts.length) throw Error(`--from/--to miss ${u.id}`);
  const beatOf = (s) => s.photorealistic?.prompt ?? (opt('prompt-file') && fs.readFileSync(opt('prompt-file'), 'utf8').trim());
  if (!u.place && u.parts.some(({ s }) => !beatOf(s))) throw Error(`scene ${u.parts.find(({ s }) => !beatOf(s)).s.id} needs "photorealistic": { "prompt": "..." } in film.json (or --prompt-file)`);
  const win = from === a0 && to === b0 ? 'full' : `${from}-${to}`;
  const dir = path.join(OUT, u.id, win);
  fs.mkdirSync(dir, { recursive: true });
  const n = u.parts.reduce((k, p) => k + sceneFrames(p.a, p.b), 0);
  console.log(`${u.id} (${u.parts.map((p) => p.s.id).join(' ')}) ${from}-${to} s: ${n} frames [${stage}]`);
  // where each part starts, in frames from the unit's start, for the piece prompts
  let at = 0; const marks = u.parts.map((p) => { const m = { ...p, f0: at }; at += sceneFrames(p.a, p.b); return { ...m, f1: at }; });

  // 1. the proxy: the code picture without its words, at H3's size and rate
  // (live action: the guide video conformed to H3's size, rate and length, or no proxy at all)
  let proxy = path.join(dir, 'proxy.mp4');
  if (u.words) { if (doing('proxy')) pass(u, from, to, 'proxy', dir); }
  else if (u.guide) {
    const src = path.resolve(SONG, u.guide);
    if (!fs.existsSync(src)) throw Error(`take ${u.id}: no guide video at ${src}`);
    if (doing('proxy') && !have(proxy)) ff(['-ss', String(from - a0), '-i', src, '-vf', `fps=${H3.fps},scale=${H3.width}:${H3.height}:force_original_aspect_ratio=increase,crop=${H3.width}:${H3.height},tpad=stop_mode=clone:stop=${n},trim=end_frame=${n},setpts=PTS-STARTPTS`, '-an', '-c:v', 'libx264', '-crf', '12', '-pix_fmt', 'yuv420p', proxy], 'guide proxy');
  } else proxy = null;
  // 2. the words: the full-size code picture with and without them
  const withWords = path.join(dir, 'words.mp4'), noWords = path.join(dir, 'plate.mp4');
  if (u.words && doing('words')) { pass(u, from, to, 'words', dir); pass(u, from, to, 'plate', dir); }

  // the style reference
  // a take's own "look" (an image in the song folder) wins over --look
  let lookFile = null;
  if (u.look && !argv.includes('--look')) lookFile = path.resolve(SONG, u.look);
  else if (look === 'code' && proxy) { lookFile = path.join(dir, 'look.png'); if (!have(lookFile)) ff(['-i', proxy, '-frames:v', '1', lookFile], 'first code frame'); }
  else if (look !== 'none') lookFile = path.resolve(look);

  // 3. H3, in pieces of at most maxFrames; each later piece repeats the last 5 frames of the one before
  const OVER = 5, pieces = [];
  for (let start = 0; ;) {
    const want = Math.min(n - start, maxFrames);
    const len = Math.min(h3Len(want), H3.maxFrames);
    pieces.push({ start, len });
    if (start + len >= n) break;
    start += len - OVER;
  }
  const promptOf = (p) => {
    const beats = marks.filter((m) => m.f1 > p.start && m.f0 < p.start + p.len).map((m) => beatOf(m.s)).filter(Boolean);
    return [PR.style, u.place, beats.length > 1 ? beats.map((b, i) => (i ? 'Then ' : '') + b).join(' ') : beats[0]].filter(Boolean).join('\n\n');
  };
  const sectionOf = (a, b) => {
    const beats = marks.filter((m) => m.f1 > a && m.f0 < b).map((m) => beatOf(m.s)).filter(Boolean);
    return [PR.style, u.place, beats.length > 1 ? beats.map((t, i) => (i ? 'Then ' : '') + t).join(' ') : beats[0]].filter(Boolean).join(' ');
  };
  const continuum = usesContinuum(chain, pieces.length);
  const chains = continuum ? planChains(n) : null;
  const outs = continuum ? chains.map((c, i) => path.join(dir, `chain-${i}-${seed}.mp4`)) : pieces.map((p, i) => path.join(dir, `h3-${i}-${seed}.mp4`));
  if (continuum && doing('h3')) {
    // 3c. Continuum: each chain is one GPU job of 5 s chunks (lib/continuum.mjs)
    while (proxy && !fs.existsSync(proxy)) { console.log(`  waiting for ${path.relative(SONG, proxy)}`); await sleep(60000); }
    if (chains.some((c, i) => !have(outs[i])) && !(await hasContinuum(comfy))) throw Error(`ComfyUI at ${comfy} has no ${CONTINUUM.sampler}: install ComfyUI-H3-Continuum there, or set "photorealistic": { "chain": "bridges" }`);
    for (const [i, c] of chains.entries()) {
      const tag = `${path.basename(SONG)}-${u.id}-c${i}`;
      const out = outs[i];
      if (have(out)) continue;
      const piece = proxy && path.join(dir, `proxy-c${i}.mp4`);
      if (proxy) ff(['-i', proxy, '-vf', `${proxyBlur ? `gblur=sigma=${proxyBlur},` : ''}trim=start_frame=${c.start}:end_frame=${c.start + c.len},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop=${c.len},trim=end_frame=${c.len}`, '-r', String(H3.fps), '-c:v', 'libx264', '-crf', '12', '-pix_fmt', 'yuv420p', piece], 'proxy chain');
      let firstFile = null;
      if (i > 0) {
        firstFile = path.join(dir, `first-c${i}.png`);
        ff(['-sseof', '-0.2', '-i', outs[i - 1], '-update', '1', '-frames:v', '1', firstFile], 'chain first frame');
      }
      const per = c.len / c.chunks;
      const prompt = timelinePrompt(Array.from({ length: c.chunks }, (_, k) => sectionOf(c.start + Math.round(k * per), c.start + Math.round((k + 1) * per))), c.chunkSeconds);
      fs.writeFileSync(path.join(dir, `prompt-c${i}.txt`), prompt);
      const job = await claimGpu(dashboard, { description: `${path.basename(SONG)} ${u.id} photorealistic (Continuum), chain ${i + 1}/${chains.length} (${c.chunks} x ${c.chunkSeconds} s, ${H3.width}x${H3.height})`, project: path.basename(SONG), expectMinutes: Math.ceil(c.chunks * 7) });
      try {
        const files = {
          proxy: piece ? await upload(comfy, piece, `ark-${tag}-proxy.mp4`) : null,
          look: lookFile ? await upload(comfy, lookFile, `ark-${tag}-look${path.extname(lookFile)}`) : null,
          first: firstFile ? await upload(comfy, firstFile, `ark-${tag}-first.png`) : null,
        };
        const graph = continuumWorkflow({ ...files, prompt, chunks: c.chunks, chunkSeconds: c.chunkSeconds, steps, seed: seed + i, prefix: `ark-photorealistic/${tag}-${seed}`, styleReference: STYLE_REFERENCE });
        const r = await runGraph(comfy, graph, { out: out + '.part.mp4', onBeat: (min, pid) => { if (min && min % 5 === 0) gpuProgress(dashboard, job, `rendering for ${min} min, ComfyUI prompt ${pid}`); } });
        fs.renameSync(out + '.part.mp4', out);
        await gpuEnd(dashboard, job, 'done');
        console.log(`  chain ${i + 1}/${chains.length}: ${r.seconds} s on the GPU`);
        fs.appendFileSync(path.join(OUT, 'timings.jsonl'), JSON.stringify({ unit: u.id, win, chain: i, chunks: c.chunks, frames: c.len, seconds: r.seconds, continuum: true, at: new Date().toISOString() }) + '\n');
      } catch (e) { await gpuEnd(dashboard, job, 'failed'); throw e; }
    }
  }
  if (!continuum && doing('h3')) {
    while (proxy && !fs.existsSync(proxy)) { console.log(`  waiting for ${path.relative(SONG, proxy)}`); await sleep(60000); }
    for (const [i, p] of pieces.entries()) {
      const tag = `${path.basename(SONG)}-${u.id}-${i}`;
      const out = outs[i];
      if (have(out)) continue;
      const piece = proxy && path.join(dir, `proxy-${i}.mp4`);
      // the proxy's frames for this piece, the last one held if the piece runs past the unit
      if (proxy) ff(['-i', proxy, '-vf', `${proxyBlur ? `gblur=sigma=${proxyBlur},` : ''}trim=start_frame=${p.start}:end_frame=${p.start + p.len},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop=${p.len},trim=end_frame=${p.len}`, '-r', String(H3.fps), '-c:v', 'libx264', '-crf', '12', '-pix_fmt', 'yuv420p', piece], 'proxy piece');
      let guideFile = null;
      if (i > 0) {
        guideFile = path.join(dir, `guide-${i}.mp4`);
        const prev = outs[i - 1], pn = frameCount(prev);
        ff(['-i', prev, '-vf', `trim=start_frame=${pn - OVER},setpts=PTS-STARTPTS`, '-c:v', 'libx264', '-crf', '12', '-pix_fmt', 'yuv420p', guideFile], 'guide clip');
      }
      const prompt = promptOf(p);
      fs.writeFileSync(path.join(dir, `prompt-${i}.txt`), prompt);
      const job = await claimGpu(dashboard, { description: `${path.basename(SONG)} ${u.id} photorealistic, piece ${i + 1}/${pieces.length} (${p.len} frames, ${H3.width}x${H3.height})`, project: path.basename(SONG), expectMinutes: Math.ceil(p.len / 10) });
      try {
        const r = await generate(comfy, { proxyFile: piece, lookFile, guideFile, prompt, frames: p.len, steps, keep, seed: seed + i, tag, out: out + '.part.mp4',
          onBeat: (min, pid) => { if (min && min % 5 === 0) gpuProgress(dashboard, job, `rendering for ${min} min, ComfyUI prompt ${pid}`); } });
        fs.renameSync(out + '.part.mp4', out);
        await gpuEnd(dashboard, job, 'done');
        console.log(`  piece ${i + 1}/${pieces.length}: ${r.seconds} s on the GPU`);
        fs.appendFileSync(path.join(OUT, 'timings.jsonl'), JSON.stringify({ unit: u.id, win, piece: i, frames: p.len, seconds: r.seconds, at: new Date().toISOString() }) + '\n');
      } catch (e) { await gpuEnd(dashboard, job, 'failed'); throw e; }
    }
  }

  // 4. join the pieces (dropping each repeated head), upscale, crop to 1080, lay the code words back on top
  const seg = path.join(OUT, win === 'full' ? `${u.id}.mp4` : `${u.id}-${win}.mp4`);
  if (!doing('composite')) continue;
  if (have(seg) && stage !== 'all') { done.push(seg); continue; }
  const list = path.join(dir, 'pieces.txt');
  const trimmed = outs.map((o, i) => {
    const t = path.join(dir, `piece-${i}.mp4`);
    // a Continuum chain is held or cut to its planned length; after the first it drops its frame 0 (the previous chain's last)
    const vf = continuum ? `tpad=stop_mode=clone:stop=${chains[i].len},trim=end_frame=${chains[i].len},trim=start_frame=${i ? 1 : 0},setpts=PTS-STARTPTS`
      : `trim=start_frame=${i ? OVER : 0},setpts=PTS-STARTPTS`;
    ff(['-i', o, '-vf', vf, '-an', '-r', String(H3.fps), '-c:v', 'libx264', '-crf', '10', '-pix_fmt', 'yuv420p', t], 'piece trim');
    return t;
  });
  fs.writeFileSync(list, trimmed.map((t) => `file '${t}'`).join('\n'));
  const gen = path.join(dir, `generated-${seed}.mp4`);
  let chainMatch = null;
  if (continuum) {
    // the drift guard: every chunk's colour and contrast matched back to the take's first chunk (lib/chainmatch.py)
    const joined = path.join(dir, `joined-${seed}.mp4`), matched = path.join(dir, `matched-${seed}.mp4`), rep = path.join(dir, 'chainmatch.json');
    ff(['-f', 'concat', '-safe', '0', '-i', list, '-vf', `tpad=stop_mode=clone:stop=${n},trim=end_frame=${n}`, '-c:v', 'libx264', '-crf', '10', '-pix_fmt', 'yuv420p', joined], 'chain join');
    run('python3', [path.join(HERE, 'lib', 'chainmatch.py'), '--generated', joined, '--bounds', JSON.stringify(chunkBounds(chains)), '--out', matched, '--report', rep, ...(proxy ? ['--proxy', proxy] : [])], 'chain colour match');
    chainMatch = JSON.parse(fs.readFileSync(rep, 'utf8'));
    ff(['-i', matched, '-vf', `trim=end_frame=${n},scale=${FW}:${FH}:flags=lanczos`, '-c:v', 'libx264', '-crf', '10', '-pix_fmt', 'yuv420p', gen], 'upscale');
  } else ff(['-f', 'concat', '-safe', '0', '-i', list, '-vf', `trim=end_frame=${n},scale=${FW}:${FH}:flags=lanczos`, '-c:v', 'libx264', '-crf', '10', '-pix_fmt', 'yuv420p', gen], 'join');
  const song = path.join(SONG, 'media', 'song.wav');
  const audioIn = fs.existsSync(song) ? ['-ss', String(from), '-t', String(n / H3.fps), '-i', song] : [];
  const encodeOut = ['-r', String(H3.fps), '-c:v', 'libx264', '-preset', 'slow', '-crf', '14',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', seg];
  // the matte: where the code picture changes when its words are left out, softened by a pixel
  // (in RGB: a YUV difference has an offset in every pixel), less a little for encoder noise
  const matteGraph = '[1:v]format=gbrp,split[wa][w0];[2:v]format=gbrp[pa];[wa][pa]blend=all_mode=difference,'
    + 'colorchannelmixer=rr=.34:rg=.33:rb=.33:gr=.34:gg=.33:gb=.33:br=.34:bg=.33:bb=.33,format=gray,'
    + `lut=y='clip((val-${matteFloor})*${matteGain},0,255)',gblur=sigma=1.2`;
  let tuckReport = null;
  if (!u.words) {
    // a generated shot with no code scene behind it (a music video's live-action take): no words to lay on
    ff(['-i', gen, ...(audioIn.length ? audioIn : []), '-vf', `trim=end_frame=${n},crop=1920:1080,format=yuv420p`, '-map', '0:v', ...(audioIn.length ? ['-map', '1:a', '-c:a', 'aac', '-b:a', '320k', '-shortest'] : []), ...encodeOut], 'generated shot');
  } else if (tuck) {
    // the words tuck behind what H3 paints in front of them (lib/tuck.py): the matte is written out,
    // cut where H3's own depth puts something nearer than the words' surface, then used as before
    const matte = path.join(dir, 'matte.mkv'), tucked = path.join(dir, 'matte-tucked.mkv'), rep = path.join(dir, 'tuck.json');
    ff(['-i', gen, '-i', withWords, '-i', noWords, '-filter_complex', `${matteGraph},trim=end_frame=${n}[m]`, '-map', '[m]', '-c:v', 'ffv1', '-pix_fmt', 'gray', matte], 'word matte');
    run('python3', [path.join(HERE, 'lib', 'tuck.py'), '--generated', gen, '--matte', matte, '--out', tucked, '--report', rep], 'word tuck');
    tuckReport = JSON.parse(fs.readFileSync(rep, 'utf8'));
    ff(['-i', gen, '-i', withWords, '-i', tucked, ...audioIn,
      '-filter_complex', `[2:v]format=gray,format=gbrp[m];[0:v]trim=end_frame=${n},format=gbrp[g];[1:v]format=gbrp,trim=end_frame=${n}[w];[g][w][m]maskedmerge,crop=1920:1080,format=yuv420p[v]`,
      '-map', '[v]', ...(audioIn.length ? ['-map', '3:a', '-c:a', 'aac', '-b:a', '320k', '-shortest'] : []), ...encodeOut], 'word composite');
  } else {
    ff(['-i', gen, '-i', withWords, '-i', noWords, ...audioIn,
      '-filter_complex', `${matteGraph},format=gbrp[m];[0:v]trim=end_frame=${n},format=gbrp[g];[w0]trim=end_frame=${n}[w];[g][w][m]maskedmerge,crop=1920:1080,format=yuv420p[v]`,
      '-map', '[v]', ...(audioIn.length ? ['-map', '3:a', '-c:a', 'aac', '-b:a', '320k', '-shortest'] : []), ...encodeOut], 'word composite');
  }
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify({ unit: u.id, scenes: u.parts.map((p) => p.s.id), from, to, frames: n, chain: continuum ? 'continuum' : 'bridges', ...(continuum ? { chains, chainMatch } : { pieces: pieces.map((p) => ({ ...p, prompt: promptOf(p) })) }), look, keep, steps, seed, tuck: tuckReport, generated: u.words ? 'every pixel but the in-scene words is painted by MiniMax H3' : 'every pixel is painted by MiniMax H3' }, null, 1));
  console.log('wrote', seg);
  done.push(seg);
}
if (!MV && !only && !argv.includes('--from') && !argv.includes('--to') && done.length === allUnits.length) {
  const list = path.join(OUT, 'segments.txt');
  fs.writeFileSync(list, done.map((f) => `file '${f}'`).join('\n'));
  const out = path.resolve(opt('out', path.join(SONG, 'out', 'film-photorealistic.mp4')));
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out], 'film join');
  console.log('wrote', out);
}
process.exit(0);
