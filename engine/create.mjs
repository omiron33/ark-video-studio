import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, stat, copyFile, open, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importSong } from './import.mjs';
import { atomicJson, digest, fileHash, loadProject, validateProject } from './project.mjs';
import { renderProject } from './export.mjs';

const wordKey = text => String(text).toLowerCase().replace(/[^a-z0-9']/g, '');
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const exists = async file => { try { return (await stat(file)).isFile(); } catch { return false; } };
const templates = [
  { tokens: ['the', 'waters', 'rose', 'above', 'them'], style: 'rise', roles: ws => ({ lead: ws[0].id, subject: ws[1].id, verb: ws[2].id, above: ws[3].id, object: ws[4].id }) },
  { tokens: ['until', 'even', 'the', 'highest', 'ground'], style: 'terrain', roles: ws => ({ lead: ws.slice(0, 3).map(w => w.id), summit: ws[3].id, ground: ws[4].id }) },
  { tokens: ['disappeared', 'below'], style: 'submerge', roles: ws => ({ verb: ws[0].id, below: ws[1].id }) },
];

/** A documented local vocabulary, not a claim of open-ended AI art direction. */
export function planStyle(project, stylePrompt) {
  if (typeof stylePrompt !== 'string' || !stylePrompt.trim()) throw new Error('A non-empty style prompt is required');
  const p = structuredClone(project), prompt = stylePrompt.toLowerCase();
  const requests = {
    quiet: /quiet|minimal|serif|contemplative|meditative|gentle/.test(prompt),
    energetic: /bold|impact|energetic|percussive|dramatic|powerful/.test(prompt),
    orbit: /orbit|circle|circular|constellation|spiral/.test(prompt),
    light: /parchment|paper|bright|ivory|light background/.test(prompt),
    photo: /photo|photoreal|realistic imagery|realistic scene|real-world/.test(prompt),
    semantic: /semantic|literal|words?.*(move|meaning)|rise|mountain|terrain|water|flood|sink|submerge/.test(prompt),
  };
  const avoid = id => new RegExp(`(?:no|avoid|without)\\s+(?:\\w+\\s+){0,2}${id}`, 'i').test(stylePrompt);
  const hex = stylePrompt.match(/#[0-9a-fA-F]{6}\b/)?.[0];
  const accent = hex ?? (/gold|amber/.test(prompt) ? '#d3a958' : /blue|teal|ocean/.test(prompt) ? '#6dbeb8' : /red|fire|ember/.test(prompt) ? '#e77951' : '#b7a0df');
  p.palette = { ...p.palette, ink: '#061a20', paper: requests.light ? '#eee4cc' : '#e8e1ce', accent };
  const pool = requests.quiet ? ['verse', 'orbit'] : requests.orbit ? ['orbit', 'verse', 'impact'] : requests.energetic ? ['impact', 'verse', 'orbit'] : ['verse', 'orbit', 'impact'];
  const styles = pool.filter(s => !avoid(s));
  if (!styles.length) styles.push('verse');
  const matches = index => templates.find(template => template.tokens.every((token, j) => wordKey(p.words[index + j]?.text) === token));
  const groups = [];
  for (let i = 0; i < p.words.length;) {
    const template = requests.semantic && matches(i);
    if (template) { groups.push({ words: p.words.slice(i, i + template.tokens.length), template }); i += template.tokens.length; continue; }
    const group = [];
    while (i < p.words.length && group.length < 6) {
      if (group.length && ((requests.semantic && matches(i)) || p.words[i].start - group.at(-1).end > 0.7 || /[.!?;:]$/.test(group.at(-1).text))) break;
      group.push(p.words[i++]);
    }
    groups.push({ words: group });
  }
  if (!groups.length) throw new Error('No timed words available for a lyric film');
  const total = Math.ceil(p.duration * p.fps - 1e-8);
  const scenes = [];
  const add = scene => {
    const previous = scenes.at(-1);
    if (previous && scene.frame <= previous.frame) {
      previous.words.push(...scene.words); previous.template = undefined;
    } else scenes.push(scene);
  };
  for (const group of groups) {
    const first = group.words[0], frame = Math.max(0, Math.min(total - 1, Math.round(first.start * p.fps)));
    if (!scenes.length && first.start > 1.5) add({ frame: 0, words: [], instrumental: true });
    const previous = scenes.at(-1);
    const previousEnd = previous?.words?.length ? Math.max(...previous.words.map(w => w.end)) : undefined;
    if (previousEnd !== undefined && first.start - previousEnd > 5) add({ frame: Math.min(frame - 1, Math.ceil((previousEnd + 0.5) * p.fps)), words: [], instrumental: true });
    add({ frame: scenes.length ? frame : 0, ...group });
  }
  const lastEnd = Math.max(...p.words.map(w => w.end));
  if (p.duration - lastEnd > 2.2) add({ frame: Math.min(total - 1, Math.ceil((lastEnd + 0.5) * p.fps)), words: [], instrumental: true });
  const warnings = [];
  p.sections = scenes.map((scene, i) => {
    const id = `scene-${digest(scene.words.length ? scene.words.map(w => w.id) : ['instrumental', scene.frame]).slice(0, 12)}`;
    const style = scene.template?.style ?? (scene.instrumental ? 'verse' : styles[i % styles.length]);
    return { id, start: scene.frame / p.fps, end: i === scenes.length - 1 ? p.duration : scenes[i + 1].frame / p.fps, style, wordIds: scene.words.map(w => w.id), assetIds: [], seed: parseInt(digest(id).slice(0, 7), 16), direction: { label: scene.instrumental ? p.title : '', accent, scale: requests.quiet ? 0.92 : 1, ...(scene.template ? { roles: scene.template.roles(scene.words) } : {}), ...(style === 'submerge' ? { submergeAt: scene.words.at(-1).end + 0.12 } : {}) } };
  });
  const imageIds = Object.entries(p.assets).filter(([, a]) => a.type === 'image').map(([id]) => id);
  for (const scene of p.sections) {
    if (imageIds.length && (requests.photo || scene.style === 'submerge')) { scene.assetIds = [...imageIds]; scene.direction.photo = imageIds[0]; }
  }
  for (let i = 0; i < p.sections.length - 1; i++) {
    const scene = p.sections[i], next = p.sections[i + 1];
    const ground = p.words.find(w => w.id === scene.direction?.roles?.ground);
    if (scene.style !== 'terrain' || next.style !== 'submerge' || !ground || !/o/i.test(ground.text)) continue;
    const portalAt = Math.max(ground.end + 0.15, scene.end - 1);
    if (scene.end - portalAt >= 0.4) scene.direction.portalAt = portalAt;
  }
  if (requests.photo && !imageIds.length) warnings.push('The brief asks for photographic imagery, but this project has no supplied image assets. The local vocabulary provides abstract scenes; a director/agent must add imagery to satisfy that part of the brief.');
  p.creation = { stylePrompt, planner: 'deterministic-vocabulary-v1', interpreted: requests, warnings };
  return { project: p, method: 'deterministic-vocabulary-v1', evidence: { stylePrompt, interpreted: requests, styles: p.sections.map(s => s.style), warnings } };
}

async function runAlignment(options, output, onProgress) {
  const candidates = [options.python, process.env.ARK_PYTHON, '/opt/homebrew/opt/openai-whisper/libexec/bin/python', '/opt/homebrew/Cellar/openai-whisper/20250625_3/libexec/bin/python', 'python3'].filter(Boolean);
  let python = candidates.find(candidate => candidate === 'python3');
  for (const candidate of candidates) if (candidate === 'python3' || await exists(candidate)) { python = candidate; break; }
  const forceKnown = Boolean(options.lyrics) && (!options.backend || ['auto', 'torchaudio-ctc'].includes(options.backend)) && (!options.model || options.model.endsWith('.pth'));
  const argv = [path.join(moduleDir, 'align.py'), '--audio', path.resolve(options.audio), '--output', output, '--offset', String(options.offset ?? 0), '--backend', forceKnown ? 'torchaudio-ctc' : options.backend ?? 'auto', '--threads', String(options.threads ?? 4)];
  if (forceKnown) argv.push('--task', 'force-align');
  for (const [key, value] of [['duration', options.duration], ['model', options.model], ['lyrics', options.lyrics], ['language', options.language]]) if (value !== undefined) argv.push(`--${key}`, String(value));
  await mkdir(path.dirname(output), { recursive: true });
  const result = await new Promise((resolve, reject) => {
    const proc = spawn(python, argv, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    proc.stdout.on('data', data => { stdout = (stdout + data).slice(-30000); });
    proc.stderr.on('data', data => { stderr = (stderr + data).slice(-30000); onProgress?.({ type: 'alignment-progress', detail: String(data).slice(-400) }); });
    proc.once('error', reject);
    proc.once('close', code => resolve({ code, stdout, stderr }));
  });
  await writeFile(`${output}.log`, `${result.stdout}\n${result.stderr}`);
  if (!await exists(output)) throw new Error(`Local alignment failed (${result.code}): ${result.stderr.slice(-1600)}`);
  const document = JSON.parse(await readFile(output, 'utf8'));
  if (result.code !== 0 || document.status === 'unresolved' || !document.words?.length) throw new Error(document.reason ?? `Local alignment produced no usable timing (${result.code})`);
  return { timingPath: output, document, python, method: document.method ?? document.source?.method ?? 'local-whisper' };
}

async function applyAuthoredDirection(project, directionFile, manifestPath, phase = 'all') {
  if (!directionFile) return project;
  const directive = JSON.parse(await readFile(directionFile, 'utf8'));
  if (directive.words || directive.audio || directive.duration !== undefined) throw new Error('Art direction cannot replace canonical words, audio, or duration');
  const p = structuredClone(project);
  for (const [id, asset] of Object.entries(phase === 'directions' ? {} : directive.assets ?? {})) {
    if (asset.type !== 'image' || typeof asset.src !== 'string') throw new Error('Authored extra assets must be local image assets');
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(id)) throw new Error(`Invalid authored asset id: ${id}`);
    const source = path.resolve(path.dirname(directionFile), asset.src);
    const hash = await fileHash(source), extension = path.extname(source).toLowerCase();
    if (p.assets[id]) {
      if (p.assets[id].type === 'image' && await fileHash(path.resolve(path.dirname(manifestPath), p.assets[id].src)) === hash) continue;
      throw new Error(`Authored asset id conflicts with an existing different asset: ${id}`);
    }
    const target = path.join('assets', `${id}-${hash.slice(0, 12)}${extension}`);
    await copyFile(source, path.resolve(path.dirname(manifestPath), target));
    p.assets[id] = { ...asset, src: target };
  }
  if (phase !== 'assets' && directive.palette) p.palette = { ...p.palette, ...directive.palette };
  if (phase !== 'assets' && directive.defaults) for (const scene of p.sections) {
    if (directive.defaults.assetIds) scene.assetIds = [...directive.defaults.assetIds];
    scene.direction = { ...scene.direction, ...directive.defaults.direction };
  }
  if (phase !== 'assets' && Array.isArray(directive.sections)) {
    for (const change of directive.sections) {
      const index = p.sections.findIndex(s => s.id === change.id);
      if (index < 0) throw new Error(`Authored direction references unknown section ${change.id}`);
      const original = p.sections[index];
      if (change.wordIds && digest(change.wordIds) !== digest(original.wordIds)) throw new Error('Art direction cannot change canonical scene words');
      if (change.start !== undefined && change.start !== original.start || change.end !== undefined && change.end !== original.end) throw new Error('Art direction cannot retime sections');
      p.sections[index] = { ...original, ...change, direction: { ...original.direction, ...change.direction } };
    }
  }
  return p;
}

async function optionalDirector(args) {
  try { return await (await import('./director.mjs')).directProject(args); }
  catch (error) { return { project: args.project, method: 'deterministic-fallback', evidence: { warning: `Local AI director unavailable: ${error.message}` } }; }
}
const defaultServices = {
  align: runAlignment,
  importSong,
  directProject: optionalDirector,
  renderProject,
  reviewAudio: async options => (await import('./audio-review.mjs')).reviewAudio(options),
  detectAudioEvents: async options => (await import('./audio-review.mjs')).detectAudioEvents(options),
  reviewVideo: async options => (await import('./gauntlet.mjs')).reviewVideo(options),
  reviewVisual: async options => (await import('./director.mjs')).reviewVisual(options),
  attachMachineVisualReview: async options => (await import('./gauntlet.mjs')).attachMachineVisualReview(options),
  checkReview: async options => (await import('./gauntlet.mjs')).checkReview(options),
};

/** One local creation run. Failed gates are saved and returned, never called a finished video. */
export async function createSong(options, serviceOverrides = {}) {
  if (!options.audio || !options.outDir || typeof options.stylePrompt !== 'string' || !options.stylePrompt.trim()) throw new Error('create requires audio, stylePrompt, and outDir');
  const services = { ...defaultServices, ...serviceOverrides };
  const outDir = path.resolve(options.outDir), reportPath = path.join(outDir, 'run.json');
  const maxPasses = Number(options.maxPasses ?? 3);
  if (!Number.isInteger(maxPasses) || maxPasses < 1 || maxPasses > 4) throw new Error('maxPasses must be an integer from 1 to 4');
  const sources = {};
  for (const field of ['audio', 'timing', 'lyrics', 'beats', 'directionFile']) if (options[field]) sources[field] = { path: path.resolve(options[field]), sha256: await fileHash(path.resolve(options[field])) };
  const request = { sources, stylePrompt: options.stylePrompt, offset: Number(options.offset ?? 0), duration: options.duration, fps: Number(options.fps ?? 30), width: Number(options.width ?? 1920), height: Number(options.height ?? 1080), scale: Number(options.scale ?? 1), model: options.model, backend: options.backend, directorModel: options.directorModel, directorEndpoint: options.directorEndpoint, timingTimebase: options.timingTimebase, beatTimebase: options.beatTimebase };
  const fingerprint = digest(request);
  let run;
  if (await exists(reportPath)) {
    if (!options.resume) throw new Error(`Run already exists. Use --resume to continue: ${reportPath}`);
    run = JSON.parse(await readFile(reportPath, 'utf8'));
    if (run.requestFingerprint !== fingerprint) throw new Error('Resume inputs/style prompt differ from this run. Use a new output directory for a different request.');
  } else {
    try { await mkdir(outDir); } catch (error) { if (error.code === 'ENOENT') { await mkdir(path.dirname(outDir), { recursive: true }); await mkdir(outDir); } else if (error.code === 'EEXIST') throw new Error('Output directory already exists without a creation run; choose a new directory'); else throw error; }
    run = { version: 1, requestFingerprint: fingerprint, request, reportPath, startedAt: new Date().toISOString(), status: 'started', steps: [], attempts: [] };
  }
  const lockPath = path.join(outDir, '.create.lock');
  let lock;
  try { lock = await open(lockPath, 'wx'); await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })); }
  catch (error) { if (error.code === 'EEXIST') throw new Error(`Another create run holds ${lockPath}; confirm that process has ended before removing its lock`); throw error; }
  const save = async () => { run.updatedAt = new Date().toISOString(); await atomicJson(reportPath, run); };
  const stage = async (name, action) => {
    const step = { name, startedAt: new Date().toISOString(), status: 'running' }; run.steps.push(step); run.status = name; await save(); options.onProgress?.({ type: 'stage', name });
    try { const result = await action(); step.status = 'complete'; step.completedAt = new Date().toISOString(); await save(); return result; }
    catch (error) { step.status = 'failed'; step.error = error.message; step.completedAt = new Date().toISOString(); await save(); throw error; }
  };
  try {
    delete run.error; delete run.nextAction; delete run.result; delete run.completedAt;
    await save();
    let manifestPath = run.projectPath;
    if (!manifestPath || !await exists(manifestPath)) {
      let timingPath = options.timing ? path.resolve(options.timing) : run.alignment?.timingPath;
      if (!timingPath || !await exists(timingPath)) {
        const output = path.join(outDir, 'analysis', `alignment-${Date.now()}.json`);
        run.alignment = await stage('align', () => services.align(options, output, options.onProgress)); timingPath = run.alignment.timingPath; await save();
      }
      let beatsPath = options.beats ? path.resolve(options.beats) : run.audioEventsPath;
      if (!beatsPath || !await exists(beatsPath)) {
        beatsPath = path.join(outDir, 'analysis', 'measured-audio-events.json');
        await stage('measure-audio', async () => { const events = await services.detectAudioEvents({ audioPath: path.resolve(options.audio), sourceOffset: request.offset, duration: request.duration, outPath: beatsPath }); await atomicJson(beatsPath, events); run.audioEventsPath = beatsPath; });
      }
      let projectDir = path.join(outDir, 'project');
      try { await stat(projectDir); projectDir = path.join(outDir, `project-retry-${Date.now()}`); } catch {}
      const imported = await stage('import', () => services.importSong({ audio: options.audio, timing: timingPath, lyrics: options.lyrics, beats: beatsPath, projectDir, sourceOffset: request.offset, duration: request.duration, fps: request.fps, width: request.width, height: request.height, title: options.title, id: options.id, timingTimebase: options.timingTimebase, beatTimebase: options.beatTimebase }));
      manifestPath = imported.manifestPath; run.projectPath = manifestPath; run.intake = { status: imported.status, warnings: imported.warnings }; await save();
      if (!imported.project.words.length) throw new Error('Alignment remains unresolved; no lyric video was fabricated');
    } else await loadProject(manifestPath);
    if (!run.planner || options.replan) {
      await stage('plan', async () => {
        const importedProject = (await loadProject(manifestPath)).project;
        const withAssets = await applyAuthoredDirection(importedProject, options.directionFile, manifestPath, 'assets');
        const base = planStyle(withAssets, options.stylePrompt);
        let project = await applyAuthoredDirection(base.project, options.directionFile, manifestPath, 'directions');
        const wordsBefore = digest(project.words), audioBefore = digest(project.audio), durationBefore = project.duration;
        const directed = await services.directProject({ project, stylePrompt: options.stylePrompt, endpoint: options.directorEndpoint, model: options.directorModel, fallbackPlan: base });
        project = directed.project ?? project;
        if (digest(project.words) !== wordsBefore || digest(project.audio) !== audioBefore || project.duration !== durationBefore) throw new Error('Director tried to change canonical lyrics, timing, audio, or duration');
        const validation = await validateProject(project, manifestPath);
        if (!validation.valid) throw new Error(`Directed project invalid: ${validation.errors.join('; ')}`);
        await atomicJson(path.join(outDir, 'plan.json'), { stylePrompt: options.stylePrompt, fallback: base.evidence, director: { method: directed.method, evidence: directed.evidence }, sections: project.sections });
        await atomicJson(manifestPath, project);
        run.planner = { method: directed.method, evidencePath: path.join(outDir, 'plan.json') };
        run.assetRequests = directed.evidence?.assetRequests ?? (base.evidence.warnings.some(w => /photographic imagery/.test(w)) ? [{ status: 'pending', request: options.stylePrompt, reason: 'No photographic asset supplied', agentAction: 'Use the built-in GPT Image tool to create the requested imagery, copy the selected assets into this portable project, assign section assetIds/direction, then resume. This is agent work, not a user handoff.' }] : []);
        await save();
      });
    }
    const videoPath = path.join(outDir, 'film.mp4'); run.videoPath = videoPath;
    for (let pass = 1; pass <= maxPasses; pass++) {
      const attempt = { number: run.attempts.length + 1, startedAt: new Date().toISOString(), repairsAllowed: pass < maxPasses }; run.attempts.push(attempt); await save();
      const attemptDir = path.join(outDir, 'review', `attempt-${String(attempt.number).padStart(2, '0')}`);
      const render = await stage('render', () => services.renderProject({ projectPath: manifestPath, outPath: videoPath, scale: request.scale, onProgress: options.onProgress }));
      attempt.render = { sha256: render.sha256, seconds: render.seconds, metadataPath: `${videoPath}.render.json` }; await save();
      const audio = await stage('audio-review', () => services.reviewAudio({ projectPath: manifestPath, videoPath, outDir: path.join(attemptDir, 'audio'), repair: pass < maxPasses, maxAttempts: 3, python: options.python ?? run.alignment?.python, model: options.model, backend: options.backend }));
      attempt.audio = { status: audio.status, reportPath: audio.reportPath, projectChanged: audio.projectChanged, repairs: audio.repairs, checks: audio.checks }; await save();
      if (audio.projectChanged) {
        attempt.outcome = 'audio-repaired-rerender-required'; await save();
        if (pass >= maxPasses) throw new Error('Audio review changed the project without an available rerender pass');
        if (audio.requiresDirectorReplan) await stage('replan-after-lyric-repair', async () => {
          const repaired = (await loadProject(manifestPath)).project;
          const base = planStyle(repaired, options.stylePrompt);
          const authored = await applyAuthoredDirection(base.project, options.directionFile, manifestPath, 'directions');
          const directed = await services.directProject({ project: authored, stylePrompt: options.stylePrompt, endpoint: options.directorEndpoint, model: options.directorModel, fallbackPlan: base });
          const project = directed.project ?? authored;
          if (digest(project.words) !== digest(repaired.words) || digest(project.audio) !== digest(repaired.audio) || project.duration !== repaired.duration) throw new Error('Director tried to alter audio-reviewed canonical lyrics or source');
          const validation = await validateProject(project, manifestPath);
          if (!validation.valid) throw new Error(`Replanned project invalid: ${validation.errors.join('; ')}`);
          const evidencePath = path.join(attemptDir, 'replan.json');
          await atomicJson(evidencePath, { method: directed.method, evidence: directed.evidence, sections: project.sections });
          await atomicJson(manifestPath, project);
          attempt.replan = { method: directed.method, evidencePath };
          run.planner = { ...attempt.replan };
          await save();
        });
        continue;
      }
      const gauntlet = await stage('technical-review', () => services.reviewVideo({ projectPath: manifestPath, videoPath, outDir: path.join(attemptDir, 'gauntlet'), audioReviewPath: audio.reportPath }));
      attempt.gauntletPath = gauntlet.reportPath; await save();
      const visual = await stage('visual-review', () => services.reviewVisual({ projectPath: manifestPath, videoPath, outDir: path.join(attemptDir, 'visual'), stylePrompt: options.stylePrompt, endpoint: options.directorEndpoint, model: options.directorModel, attempt: pass, repair: pass < maxPasses }));
      attempt.visual = { status: visual.status, scores: visual.scores, issues: visual.issues, projectChanged: visual.projectChanged, reviewPath: visual.reviewPath, method: visual.method }; await save();
      if (visual.projectChanged) { attempt.outcome = 'visual-repaired-rerender-required'; await save(); if (pass < maxPasses) continue; throw new Error('Visual review changed the project without an available rerender pass'); }
      if (visual.reviewPath) await services.attachMachineVisualReview({ reportPath: gauntlet.reportPath, visualReviewPath: visual.reviewPath });
      const gate = await services.checkReview({ reportPath: gauntlet.reportPath, audioReviewPath: audio.reportPath, visualReviewPath: visual.reviewPath, videoPath, projectPath: manifestPath });
      attempt.gate = { passed: gate.passed, status: gate.status, reasons: gate.reasons }; attempt.completedAt = new Date().toISOString();
      const currentProject = (await loadProject(manifestPath)).project;
      const imagesAssigned = currentProject.sections.some(s => s.assetIds.some(id => currentProject.assets[id]?.type === 'image'));
      const unresolvedAssets = (run.assetRequests ?? []).filter(a => a.status !== 'resolved' && !imagesAssigned);
      if (unresolvedAssets.length) { attempt.gate.passed = false; attempt.gate.reasons = [...(attempt.gate.reasons ?? []), 'Required photographic assets remain pending; the agent must generate or supply and assign them.']; attempt.gate.status = 'required_assets_pending'; }
      const finished = attempt.gate.passed === true && audio.status === 'passed' && visual.status === 'passed';
      attempt.outcome = finished ? 'finished' : 'quality-failed';
      run.status = finished ? 'finished' : 'quality_failed';
      run.result = { videoPath, projectPath: manifestPath, gauntletPath: gauntlet.reportPath, audioReviewPath: audio.reportPath, visualReviewPath: visual.reviewPath, passed: finished, gate: attempt.gate, nextAction: finished ? null : 'Inspect the saved concrete quality findings. Repair the portable project or resolve the reported model/input failure, then resume this same run.' };
      run.completedAt = new Date().toISOString(); await save(); return run;
    }
    throw new Error('Bounded repair passes exhausted');
  } catch (error) {
    run.status = 'failed'; run.error = { message: error.message, at: new Date().toISOString() }; run.nextAction = 'Resolve the recorded stage failure, then repeat the same command with --resume. The source song and existing project are preserved.'; await save(); return run;
  } finally { await lock.close(); await rm(lockPath, { force: true }); }
}

/** Finish from an existing, real independent visual-agent review; never create scores here. */
export async function finalizeRun(options, serviceOverrides = {}) {
  const supplied = options.runPath ?? options.runDir;
  if (!supplied) throw new Error('finalize-run requires a creation run directory or run.json');
  const reportFile = path.resolve(path.extname(supplied) === '.json' ? supplied : path.join(supplied, 'run.json'));
  const run = JSON.parse(await readFile(reportFile, 'utf8'));
  if (!run.projectPath || !run.videoPath) throw new Error('This creation run has no rendered project/video to finalize');
  const reportPath = options.reportPath ?? run.result?.gauntletPath ?? run.attempts?.at(-1)?.gauntletPath;
  if (!reportPath) throw new Error('A saved gauntlet report is required before independent finalization');
  const lockPath = path.join(path.dirname(reportFile), '.create.lock');
  let lock;
  try { lock = await open(lockPath, 'wx'); await lock.writeFile(JSON.stringify({ pid: process.pid, operation: 'finalize-run' })); }
  catch (error) { if (error.code === 'EEXIST') throw new Error('A create/finalize operation still holds this run lock'); throw error; }
  try {
    const { project } = await loadProject(run.projectPath);
    const check = serviceOverrides.checkReview ?? defaultServices.checkReview;
    const gate = await check({ reportPath: path.resolve(reportPath), projectPath: run.projectPath, videoPath: run.videoPath, audioReviewPath: options.audioReviewPath, visualReviewPath: options.visualReviewPath });
    const reasons = [...(gate.reasons ?? [])];
    if (!gate.quality?.technicalVerified) reasons.push('Current technical evidence is required');
    if (!gate.quality?.machineAudioVerified || !gate.machineAudio?.passed) reasons.push('Fresh bound measured audio review is required; a hearing score cannot replace it');
    if (!gate.quality?.independentVisualReviewed || gate.status !== 'independently_reviewed') reasons.push('An existing independent visual-agent review is required; finalize-run does not invent judgment');
    const imagesAssigned = project.sections.some(s => s.assetIds.some(id => project.assets[id]?.type === 'image'));
    const pendingAssets = (run.assetRequests ?? []).some(a => a.status !== 'resolved') && !imagesAssigned;
    if (pendingAssets) reasons.push('Required photographic assets remain pending');
    const passed = gate.passed === true && reasons.length === 0;
    const event = { checkedAt: new Date().toISOString(), method: 'existing-independent-visual-review', passed, reportPath: path.resolve(reportPath), gate: { passed, status: passed ? 'independently_reviewed' : pendingAssets ? 'required_assets_pending' : gate.passed ? 'independent_finalization_failed' : gate.status, reasons }, binding: gate.currentBinding };
    run.finalizations ??= []; run.finalizations.push(event);
    run.status = passed ? 'finished' : 'quality_failed';
    run.result = { videoPath: run.videoPath, projectPath: run.projectPath, gauntletPath: path.resolve(reportPath), audioReviewPath: gate.machineAudio?.path, visualReviewPath: gate.machineVisual?.path, passed, gate: event.gate, finalizationMethod: event.method, nextAction: passed ? null : 'Resolve the saved current gate failures before finalizing. Prior local-model reviews remain recorded.' };
    delete run.error; delete run.nextAction;
    run.updatedAt = new Date().toISOString();
    if (passed) run.completedAt = run.updatedAt; else delete run.completedAt;
    await atomicJson(reportFile, run);
    return run;
  } finally { await lock.close(); await rm(lockPath, { force: true }); }
}
