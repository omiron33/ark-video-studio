#!/usr/bin/env node
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { loadProject, inspectProject, editSection } from './project.mjs';

function args(argv) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) result._.push(token);
    else {
      const split = token.slice(2).split('='), key = split.shift();
      if (split.length) result[key] = split.join('=');
      else if (['json', 'force', 'retime', 'help', 'resume', 'replan'].includes(key)) result[key] = true;
      else { if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`--${key} requires a value`); result[key] = argv[++i]; }
    }
  }
  return result;
}
const usage = `Ark Video Studio
  create --audio song.mp3 --style-prompt 'Dark cinematic typography' --out new-run-directory [--timing words.json] [--lyrics lyrics.txt] [--offset 0] [--duration 10] [--resume]
  references --query 'lineage emerging through space' [--limit 4] [--used id1,id2] [--library path]
  reference-context --project project.json --section id --style-prompt 'brief' --out context-directory
  capture-reference --card draft-card.json --video source.mp4 [--times 1,2,3,4] [--library path]
  serve-references [--port 4179] [--library path]
  finalize-run --run creation-directory [--report gauntlet-review.json]
  import --audio song.mp3 --out project-directory [--timing words.json] [--beats beats.json] [--offset 0] [--duration 10] [--title 'Song']
  align --audio song.mp3 --out words.json [--model local-model-directory] [--offset 0] [--duration 10] [--lyrics lyrics.txt]
  validate --project project.json
  inspect --project project.json [--json]
  serve --project project.json [--port 4177]
  render --project project.json --out film.mp4 [--section id] [--scale .5] [--force]
  patch --project project.json --section id --set '{"direction":{"accent":"#f80"}}'
  replace --project project.json --section id --file replacement.json [--retime]
  gauntlet --project project.json --video film.mp4 --out review-directory
  approve-review --report report.json --reviewer name --scores scores.json --notes 'Review notes'
  review-check --report report.json [--video film.mp4] [--project project.json]
  agents [--json]
  image --prompt 'scene description' | --prompt-file request.txt --out assets/scene.png [--provider openai-images|comfyui] [--size 1536x1024] [--model id] [--seed n]`;
try {
  const options = args(process.argv.slice(2)), command = options._[0];
  if (options.help || !command || command === 'help') console.log(usage);
  else if(command==='agents'){
    const {capabilities}=await import('./providers.mjs');
    console.log(JSON.stringify(capabilities(),null,2));
  } else if(command==='image'){
    if(!options.out||!(options.prompt||options['prompt-file']))throw Error('image requires --prompt or --prompt-file, and --out');
    const {generateImage,generateComfyImage}=await import('./providers.mjs');
    const prompt=options.prompt??await readFile(options['prompt-file'],'utf8');
    const provider=options.provider??(process.env.OPENAI_API_KEY?'openai-images':'comfyui');
    if(!['openai-images','comfyui'].includes(provider))throw Error('image --provider must be openai-images or comfyui');
    const {revisedPrompt,...result}=provider==='comfyui'?await generateComfyImage({prompt,out:options.out,size:options.size,seed:options.seed===undefined?undefined:Number(options.seed)}):await generateImage({prompt,out:options.out,size:options.size,model:options.model});
    console.log(JSON.stringify(result,null,2));
  } else if(command==='references'){
    const {loadReferenceLibrary,searchReferences}=await import('./references.mjs');
    const result=options.query?await searchReferences({query:options.query,limit:Number(options.limit??4),usedIds:(options.used??'').split(',').filter(Boolean),duration:options.duration===undefined?undefined:Number(options.duration),libraryRoot:options.library}):await loadReferenceLibrary({libraryRoot:options.library});
    console.log(JSON.stringify(result,null,2));
  } else if(command==='reference-context'){
    if(!options.project||!options.out)throw Error('reference-context requires --project and --out');
    const {referenceContext}=await import('./references.mjs');
    const {mkdir,writeFile}=await import('node:fs/promises');
    const {project}=await loadProject(path.resolve(options.project));
    const sections=options.section?project.sections.filter(s=>s.id===options.section):project.sections;
    if(!sections.length)throw Error('Unknown section');
    const result=await referenceContext({project,sections,stylePrompt:options['style-prompt']??'',libraryRoot:options.library,limit:Number(options.limit??3)});
    const out=path.resolve(options.out);await mkdir(out,{recursive:true});
    const images=[];for(let i=0;i<result.images.length;i++){const file=path.join(out,`reference-${i+1}.jpg`);await writeFile(file,Buffer.from(result.images[i],'base64'));images.push(file);}
    const packet={...result,images};await writeFile(path.join(out,'context.json'),JSON.stringify(packet,null,2)+'\n');await writeFile(path.join(out,'brief.md'),result.text+'\n');
    console.log(JSON.stringify({contextPath:path.join(out,'context.json'),images,evidence:result.evidence},null,2));
  } else if(command==='capture-reference'){
    if(!options.card||!options.video)throw Error('capture-reference requires --card and --video');
    const {captureReference}=await import('./references.mjs');
    const result=await captureReference({card:JSON.parse(await readFile(options.card,'utf8')),videoPath:options.video,libraryRoot:options.library,times:options.times?.split(',').map(Number)});
    console.log(JSON.stringify(result,null,2));
  } else if(command==='serve-references'){
    const {startReferenceServer}=await import('./reference-gallery.mjs');
    const result=await startReferenceServer({libraryRoot:options.library,port:Number(options.port??4179)});
    console.log(`Motion library: ${result.url}`);
    const close=()=>result.server.close(()=>process.exit(0));process.on('SIGINT',close);process.on('SIGTERM',close);
  } else if (command === 'create') {
    const { createSong } = await import('./create.mjs');
    const result = await createSong({ audio: options.audio, stylePrompt: options['style-prompt'], outDir: options.out, timing: options.timing, lyrics: options.lyrics, beats: options.beats, directionFile: options.direction, offset: Number(options.offset ?? 0), duration: options.duration === undefined ? undefined : Number(options.duration), fps: Number(options.fps ?? 30), width: Number(options.width ?? 1920), height: Number(options.height ?? 1080), scale: Number(options.scale ?? 1), maxPasses: Number(options['max-passes'] ?? 3), resume: options.resume === true, replan: options.replan === true, python: options.python, model: options.model, backend: options.backend, threads: Number(options.threads ?? 4), language: options.language, title: options.title, id: options.id, timingTimebase: options['timing-timebase'], beatTimebase: options['beat-timebase'], directorEndpoint: options['director-endpoint'], directorModel: options['director-model'], referenceLibrary: options['reference-library'], referenceLimit: options['reference-limit']===undefined?undefined:Number(options['reference-limit']), onProgress: event => process.stderr.write(JSON.stringify(event) + '\n') });
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== 'finished') process.exitCode = 2;
  } else if (command === 'finalize-run') {
    const { finalizeRun } = await import('./create.mjs');
    const result = await finalizeRun({ runPath: options.run, reportPath: options.report, audioReviewPath: options['audio-review'], visualReviewPath: options['visual-review'] });
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== 'finished') process.exitCode = 2;
  } else if (command === 'import') {
    const { importSong } = await import('./import.mjs');
    const result = await importSong({ audio: options.audio, timing: options.timing, beats: options.beats, lyrics: options.lyrics, projectDir: options.out, id: options.id, title: options.title, sourceOffset: Number(options.offset ?? 0), duration: options.duration === undefined ? undefined : Number(options.duration), fps: Number(options.fps ?? 30), width: Number(options.width ?? 2560), height: Number(options.height ?? 1440), style: options.style ?? 'verse', timingTimebase: options['timing-timebase'], beatTimebase: options['beat-timebase'] });
    console.log(JSON.stringify(result, null, 2));
  } else if (command === 'align') {
    if (!options.audio || !options.out) throw new Error('align requires --audio and --out');
    const { spawn } = await import('node:child_process');
    const { fileURLToPath } = await import('node:url');
    const argv = [fileURLToPath(new URL('./align.py', import.meta.url)), '--audio', options.audio, '--output', options.out];
    for (const key of ['backend', 'task', 'model', 'offset', 'duration', 'language', 'lyrics', 'threads']) if (options[key] !== undefined) argv.push(`--${key}`, String(options[key]));
    const proc = spawn(options.python ?? 'python3', argv, { stdio: 'inherit' });
    process.exitCode = await new Promise((resolve, reject) => { proc.once('error', reject); proc.once('close', resolve); });
  } else if (['gauntlet', 'approve-review', 'review-check'].includes(command)) {
    const gauntlet = await import('./gauntlet.mjs');
    let result;
    if (command === 'gauntlet') result = await gauntlet.reviewVideo({ videoPath: options.video, projectPath: options.project, outDir: options.out, renderMetadataPath: options.metadata, audioReviewPath: options['audio-review'], visualReviewPath: options['visual-review'] });
    if (command === 'approve-review') result = await gauntlet.approveReview({ reportPath: options.report, reviewer: options.reviewer, scores: JSON.parse(await readFile(options.scores, 'utf8')), notes: options.notes, videoPath: options.video, projectPath: options.project });
    if (command === 'review-check') result = await gauntlet.checkReview({ reportPath: options.report, videoPath: options.video, projectPath: options.project, audioReviewPath: options['audio-review'], visualReviewPath: options['visual-review'] });
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (!options.project) throw new Error('--project is required');
    const projectPath = path.resolve(options.project);
    if (command === 'validate' || command === 'inspect') {
      const loaded = await loadProject(projectPath);
      const result = command === 'validate' ? loaded.validation : { ...inspectProject(loaded.project, loaded.validation), styles: (await import('./visual.mjs')).STYLE_CATALOG };
      console.log(JSON.stringify(result, null, 2));
    } else if (command === 'patch' || command === 'replace') {
      if (!options.section) throw new Error('--section is required');
      const patch = command === 'patch' ? JSON.parse(options.set ?? '') : JSON.parse(await readFile(options.file, 'utf8'));
      const result = await editSection(projectPath, options.section, patch, { replace: command === 'replace', retime: options.retime === true });
      console.log(JSON.stringify({ section: result.section, revision: result.revision, backup: result.backup, changed: result.changed }, null, 2));
    } else if (command === 'render') {
      const { renderProject } = await import('./export.mjs');
      const result = await renderProject({ projectPath, outPath: options.out, sectionId: options.section, scale: Number(options.scale ?? 1), force: options.force === true, cacheDir: options.cache, onProgress: event => process.stderr.write(JSON.stringify(event) + '\n') });
      console.log(JSON.stringify(result, null, 2));
    } else if (command === 'serve') {
      const { startServer } = await import('./server.mjs');
      const result = await startServer({ projectPath, port: Number(options.port ?? 4177) });
      console.log(`Studio: ${result.url}`);
      const close = () => result.server.close(() => process.exit(0));
      process.on('SIGINT', close); process.on('SIGTERM', close);
    } else throw new Error(`Unknown command: ${command}\n${usage}`);
  }
} catch (error) { console.error(error.stack ?? error.message); process.exitCode = 1; }
