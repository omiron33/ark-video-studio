/** Resumable full-film review. Frames always come from the delivered MP4 in
 * absolute project time; a section report can never masquerade as a full gate. */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,mkdir,open,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {hostname} from 'node:os';
import {spawn} from 'node:child_process';
import {loadProject,atomicJson,digest,fileHash} from './project.mjs';
import {reviewVisual,VISUAL_CATEGORIES} from './director.mjs';
import {computeRevision,sha256File,reviewVideo,checkReview} from './gauntlet.mjs';

const readJSON=async p=>JSON.parse(await readFile(p,'utf8'));
const sameSet=(a,b)=>Array.isArray(a)&&a.length===new Set(a).size&&a.length===b.length&&a.every(x=>b.includes(x));
const scoreOK=n=>typeof n==='number'&&Number.isFinite(n)&&n>=8&&n<=10;
const bindingOf=(revision,videoSha256)=>({videoSha256,projectHash:revision.projectHash,rendererHash:revision.rendererHash,revisionHash:revision.revisionHash});

export function planReviewBatches(project,{batchSize=4}={}) {
  if(!Number.isInteger(batchSize)||batchSize<1||batchSize>12)throw Error('batchSize must be an integer from 1 to 12');
  const assigned=new Set(project.sections.flatMap(s=>s.wordIds));
  const missing=project.words.filter(w=>!assigned.has(w.id));
  if(missing.length)throw Error(`Every lyric must belong to a reviewed section: ${missing.map(w=>w.id).join(', ')}`);
  const result=[];
  for(let i=0;i<project.sections.length;i+=batchSize){
    const sections=project.sections.slice(i,i+batchSize),sectionIds=sections.map(s=>s.id),wordIds=[...new Set(sections.flatMap(s=>s.wordIds))];
    const words=project.words.filter(w=>wordIds.includes(w.id));
    // Includes all director and OCR sample ranges plus neighboring handoff pixels.
    const from=Math.max(0,Math.min(sections[0].start,...words.map(w=>w.start))-2/project.fps);
    const to=Math.min(project.duration,Math.max(sections.at(-1).end,...words.map(w=>w.end+.35))+2/project.fps);
    result.push({id:`batch-${String(result.length+1).padStart(3,'0')}`,sectionIds,wordIds,startFrame:Math.floor(from*project.fps+1e-8),endFrame:Math.ceil(to*project.fps-1e-8),timebase:'project'});
  }
  return result;
}

/** Hash every decoded picture in the review interval, not container bytes or a
 * cached renderer surrogate. Used only when rebinding unchanged scenes after edits. */
export async function fingerprintFrames(videoPath,{startFrame,endFrame,fps}) {
  if(!Number.isInteger(startFrame)||!Number.isInteger(endFrame)||startFrame<0||endFrame<=startFrame)throw Error('Invalid review frame range');
  return new Promise((resolve,reject)=>{
    const proc=spawn('ffmpeg',['-v','error','-ss',String(startFrame/fps),'-i',videoPath,'-map','0:v:0','-frames:v',String(endFrame-startFrame),'-an','-pix_fmt','rgb24','-f','framemd5','-'],{stdio:['ignore','pipe','pipe']});
    const hash=createHash('sha256');let pending='',frames=0,error='';
    proc.stdout.on('data',chunk=>{pending+=chunk;const lines=pending.split('\n');pending=lines.pop();for(const line of lines)if(line&&!line.startsWith('#')){const fields=line.split(',');hash.update(fields.at(-1).trim()+'\n');frames++;}});
    proc.stderr.on('data',chunk=>{error=(error+chunk).slice(-4000)});
    proc.on('error',reject);proc.on('close',code=>code||frames!==endFrame-startFrame?reject(Error(`Decoded review range failed (${frames}/${endFrame-startFrame} frames): ${error}`)):resolve({sha256:hash.digest('hex'),frames,startFrame,endFrame,fps,pixelFormat:'rgb24'}));
  });
}

async function verifyEvidence(evidence) {
  if(!Array.isArray(evidence)||!evidence.length)throw Error('Decoded visual evidence is missing');
  for(const e of evidence)if(!e.path||!e.sha256||await sha256File(e.path)!==e.sha256)throw Error(`Evidence changed or missing: ${e.path}`);
}

export async function validateBatchReport(report,batch,binding,{verifyFiles=true}={}) {
  if(report?.kind!=='machine-visual-section-review'||report.schemaVersion!==1)throw Error('Expected a scoped visual section report');
  if(report.method!=='local-vision-model'||!report.model)throw Error('Batch must identify its actual local vision model');
  if(!sameSet(report.scope?.sectionIds,batch.sectionIds)||!sameSet(report.scope?.wordIds,batch.wordIds)||report.scope?.timebase!=='project'||report.scope.complete!==false)throw Error('Batch scope is missing, duplicated, or incomplete');
  for(const k of Object.keys(binding))if(report.binding?.[k]!==binding[k])throw Error(`Batch ${k} binding is stale`);
  if(!sameSet(report.scenes?.map(s=>s.id),batch.sectionIds))throw Error('Batch scene coverage is incomplete');
  if(!Array.isArray(report.issues)||!Array.isArray(report.limitations))throw Error('Batch review findings must be explicit');
  if(report.status==='passed'){
    if(!VISUAL_CATEGORIES.every(k=>scoreOK(report.scores?.[k]))||!report.scenes.every(s=>s.passed===true&&VISUAL_CATEGORIES.every(k=>scoreOK(s.scores?.[k]))))throw Error('Passing batch contains a failed or unscored scene');
    if(report.lyricVisibility?.status!=='passed'||report.lyricVisibility.coverage?.required!==batch.wordIds.length||report.lyricVisibility.coverage?.observed!==batch.wordIds.length||report.lyricVisibility.coverage?.unresolved?.length)throw Error('Passing batch does not establish every expected lyric');
  }else if(report.status!=='failed')throw Error('Read-only batches cannot repair or claim an unknown state');
  if(verifyFiles){
    await verifyEvidence(report.evidence);
    const ocr=await readJSON(report.lyricVisibility?.reportPath);
    const provenanceBinding=report.reboundFrom?.binding??binding;
    if(ocr.kind!=='machine-lyric-visibility-section'||!sameSet(ocr.scope?.wordIds,batch.wordIds)||!sameSet(ocr.wordCoverage?.map(w=>w.id),batch.wordIds))throw Error('Native OCR word identities do not match batch scope');
    for(const k of ['videoSha256','projectHash'])if(ocr.binding?.[k]!==provenanceBinding[k])throw Error('Native OCR binding is stale');
    if(report.status==='passed'&&(ocr.status!=='passed'||!ocr.wordCoverage.every(w=>w.observed===true)||!ocr.checks?.length||!ocr.checks.every(c=>c.passed===true)))throw Error('Native OCR evidence does not pass');
    await verifyEvidence(ocr.evidence.length?ocr.evidence:report.evidence);
  }
  return report;
}

async function modelIdentity(endpoint,model) {
  if(/cloud/i.test(model))throw Error('Cloud inference models are excluded');
  const response=await fetch(new URL('/api/tags',endpoint),{signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error(`Cannot identify local review model (${response.status})`);
  const data=await response.json(),entry=data.models?.find(m=>m.name===model||m.model===model);
  if(!entry?.digest)throw Error(`Installed model digest unavailable for ${model}; no cached approval reused`);
  return {model,digest:entry.digest,endpoint:new URL(endpoint).origin};
}

async function reviewPolicyHash(){
  const files=['fullsong-review.mjs','director.mjs','ocr.mjs','ocr.swift'];
  return digest(await Promise.all(files.map(async f=>[f,await fileHash(new URL(f,import.meta.url))])));
}

export async function reviewFullSong(options,services={}) {
  const projectPath=path.resolve(options.projectPath),videoPath=path.resolve(options.videoPath),outDir=path.resolve(options.outDir??`${videoPath}.full-review`);
  const model=options.model??process.env.ARK_DIRECTOR_MODEL??'qwen3-vl:4b-instruct',endpoint=options.endpoint??process.env.ARK_DIRECTOR_URL??'http://127.0.0.1:11434';
  const maxBatches=options.maxBatches??Infinity;if(maxBatches!==Infinity&&(!Number.isInteger(maxBatches)||maxBatches<1))throw Error('maxBatches must be a positive integer');
  const api={reviewVisual,fingerprintFrames,reviewVideo,checkReview,modelIdentity,...services};
  await mkdir(outDir,{recursive:true});const lockPath=path.join(outDir,'.review.lock');let lock;
  try{lock=await open(lockPath,'wx');}catch(e){
    if(e.code!=='EEXIST')throw e;
    const bytes=await readFile(lockPath,'utf8');let stale=false;
    try{const prior=JSON.parse(bytes);if(prior.host===hostname()&&Number.isInteger(prior.pid)&&prior.pid>0){try{process.kill(prior.pid,0);}catch(error){stale=error.code==='ESRCH';}}}catch{}
    if(!stale||await readFile(lockPath,'utf8')!==bytes)throw Error(`Review is already running or its lock cannot be safely reclaimed: ${lockPath}`);
    await rm(lockPath);lock=await open(lockPath,'wx');
  }
  await lock.writeFile(JSON.stringify({pid:process.pid,host:hostname(),startedAt:new Date().toISOString()}));
  const reportPath=path.join(outDir,'fullsong-review.json'),visualReviewPath=path.join(outDir,'visual-review.json');let report;
  try{
    const {project}=await loadProject(projectPath),revision=await computeRevision(projectPath),binding=bindingOf(revision,await sha256File(videoPath));
    const batches=planReviewBatches(project,{batchSize:options.batchSize??4}),policy=await reviewPolicyHash(),identity=await api.modelIdentity(endpoint,model);
    report={schemaVersion:1,kind:'full-song-review',status:'running',projectPath,videoPath,binding,model:identity,timebase:'project',sectionCount:project.sections.length,wordCount:project.words.length,batches:[],startedAt:new Date().toISOString(),reportPath,visualReviewPath,limitations:['Reviews inspect sampled actual encoded frames; they do not establish perfection or subjective hearing.','Technical and independently measured full-film audio gates remain mandatory.']};
    let executed=0;const accepted=[];
    for(const batch of batches){
      const sections=project.sections.filter(s=>batch.sectionIds.includes(s.id)),words=project.words.filter(w=>batch.wordIds.includes(w.id));
      const context=digest({policy,identity,stylePrompt:options.stylePrompt??'',batch,sections,words,fps:project.fps,duration:project.duration});
      const cacheDir=path.join(outDir,'batches',batch.id,context),entryPath=path.join(cacheDir,'checkpoint.json');
      let prior,review,pixels,cacheHit=false,rebound=false;
      try{
        prior=await readJSON(entryPath);if(prior.context!==context||await sha256File(prior.reviewPath)!==prior.reviewSha256)throw Error('Review checkpoint digest mismatch');
        review=await readJSON(prior.reviewPath);await validateBatchReport(review,batch,prior.binding);
        if(options.retryFailed&&review.status!=='passed')throw Error('Explicit retry requested');
        if(digest(prior.binding)!==digest(binding)){
          pixels=await api.fingerprintFrames(videoPath,{...batch,fps:project.fps});
          if(digest(pixels)!==digest(prior.pixels))throw Error('Encoded scene pixels changed');
          review={...review,binding,videoSha256:binding.videoSha256,manifestSha256:await fileHash(projectPath),reboundFrom:{binding:review.reboundFrom?.binding??prior.binding,reviewPath:prior.reviewPath,reviewSha256:prior.reviewSha256,decodedFrames:pixels},reviewedAt:new Date().toISOString()};rebound=true;
        }
        cacheHit=true;
      }catch{review=null;}
      if(!review){
        if(executed>=maxBatches||options.signal?.aborted){report.batches.push({...batch,status:'pending'});continue;}
        await mkdir(cacheDir,{recursive:true});
        pixels??=await api.fingerprintFrames(videoPath,{...batch,fps:project.fps});
        options.onProgress?.({type:'review-batch',id:batch.id,sections:batch.sectionIds});
        const generatedDir=path.join(cacheDir,`attempt-${Date.now()}`);
        review=await api.reviewVisual({projectPath,videoPath,outDir:generatedDir,stylePrompt:options.stylePrompt,endpoint,model,repair:false,sectionIds:batch.sectionIds});
        await validateBatchReport(review,batch,binding);executed++;
      }
      if(!cacheHit||rebound){
        const storedPath=path.join(cacheDir,`bound-${binding.revisionHash.slice(0,12)}-${binding.videoSha256.slice(0,12)}.json`);
        await atomicJson(storedPath,review);await atomicJson(entryPath,{schemaVersion:1,context,binding,pixels:pixels??prior.pixels,reviewPath:storedPath,reviewSha256:await sha256File(storedPath)});prior=await readJSON(entryPath);
      }
      accepted.push(review);report.batches.push({...batch,status:review.status,cacheHit,rebound,reviewPath:prior.reviewPath,reviewSha256:prior.reviewSha256,scores:review.scores,failedSections:review.scenes.filter(s=>!s.passed).map(s=>s.id),ocr:review.lyricVisibility.coverage});
      report.completedBatches=accepted.length;report.updatedAt=new Date().toISOString();await atomicJson(reportPath,report);options.onProgress?.({type:'review-batch-complete',id:batch.id,status:review.status,cacheHit,rebound});
    }
    const endRevision=await computeRevision(projectPath),endBinding=bindingOf(endRevision,await sha256File(videoPath));
    if(digest(endBinding)!==digest(binding))throw Error('Inputs changed during full-song review; completion refused');
    report.completedBatches=accepted.length;report.pendingBatches=report.batches.filter(b=>b.status==='pending').map(b=>b.id);report.failedBatches=report.batches.filter(b=>b.status==='failed').map(b=>b.id);
    if(accepted.length!==batches.length){report.status='pending';await atomicJson(reportPath,report);return report;}
    const scenes=accepted.flatMap(r=>r.scenes);if(!sameSet(scenes.map(s=>s.id),project.sections.map(s=>s.id)))throw Error('Full-song scene coverage is incomplete');
    const observed=new Set();for(const reviewed of accepted){const ocr=await readJSON(reviewed.lyricVisibility.reportPath);for(const word of ocr.wordCoverage)if(word.observed===true)observed.add(word.id);}
    const allOCRPassed=accepted.every(r=>r.lyricVisibility.status==='passed');
    const unresolved=project.words.filter(w=>!observed.has(w.id)).map(w=>w.id),coverage={required:project.words.length,observed:observed.size,ratio:project.words.length?observed.size/project.words.length:0,unresolved};
    const passed=accepted.every(r=>r.status==='passed')&&project.words.length>0&&!unresolved.length&&allOCRPassed;
    const visual={schemaVersion:1,kind:'machine-visual-review',method:'local-vision-model',model,status:passed?'passed':'failed',binding,videoPath,projectPath,scope:{complete:true,sectionIds:project.sections.map(s=>s.id),wordIds:project.words.map(w=>w.id),timebase:'project'},scores:Object.fromEntries(VISUAL_CATEGORIES.map(k=>[k,Math.min(...scenes.map(s=>s.scores?.[k]??0))])),issues:accepted.flatMap(r=>r.issues),scenes,lyricVisibility:{status:unresolved.length||!allOCRPassed?'failed':'passed',coverage},evidence:[...new Map(accepted.flatMap(r=>r.evidence).map(e=>[`${e.path}:${e.sha256}`,e])).values()],batchReports:report.batches.map(b=>({path:b.reviewPath,sha256:b.reviewSha256,sectionIds:b.sectionIds})),projectChanged:false,reviewedAt:new Date().toISOString(),limitations:report.limitations,reviewPath:visualReviewPath};
    await atomicJson(visualReviewPath,visual);
    const gauntletPath=path.resolve(options.gauntletReportPath??path.join(outDir,'gauntlet','review.json'));let state;
    try{state=await api.checkReview({reportPath:gauntletPath,videoPath,projectPath,audioReviewPath:options.audioReviewPath,visualReviewPath});}catch{}
    if(!state?.quality?.technicalVerified){await api.reviewVideo({videoPath,projectPath,outDir:path.dirname(gauntletPath),renderMetadataPath:options.renderMetadataPath,audioReviewPath:options.audioReviewPath,visualReviewPath});state=await api.checkReview({reportPath:gauntletPath,videoPath,projectPath,audioReviewPath:options.audioReviewPath,visualReviewPath});}
    const provenanceVerified=state.report?.renderProvenance?.verified===true;
    const finalPassed=state.passed&&provenanceVerified&&project.words.length>0&&!unresolved.length&&allOCRPassed&&(passed||state.quality?.independentVisualReviewed===true);
    report.gauntletPath=gauntletPath;report.gate={passed:finalPassed,status:!provenanceVerified?'render_provenance_required':state.status,reasons:[...state.reasons,...(!provenanceVerified?['Full-song acceptance requires verified render-time source provenance']:[])],quality:state.quality};report.status=finalPassed?'passed':'failed';report.completedAt=new Date().toISOString();await atomicJson(reportPath,report);return report;
  }catch(error){if(report){report.status='failed';report.error=error.message;report.updatedAt=new Date().toISOString();await atomicJson(reportPath,report);}throw error;}finally{await lock.close();await rm(lockPath,{force:true});}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args={};for(let i=2;i<process.argv.length;i++){const name=process.argv[i];if(!name.startsWith('--'))throw Error(`Unexpected argument ${name}`);args[name.slice(2)]=process.argv[i+1]?.startsWith('--')?true:process.argv[++i]??true;}
  try{const result=await reviewFullSong({projectPath:args.project,videoPath:args.video,outDir:args.out,'stylePrompt':args['style-prompt'],audioReviewPath:args['audio-review'],gauntletReportPath:args.gauntlet,renderMetadataPath:args.metadata,batchSize:args['batch-size']?Number(args['batch-size']):4,maxBatches:args['max-batches']?Number(args['max-batches']):Infinity,retryFailed:args['retry-failed']===true,endpoint:args.endpoint,model:args.model,onProgress:e=>process.stderr.write(JSON.stringify(e)+'\n')});process.stdout.write(JSON.stringify(result,null,2)+'\n');process.exitCode=result.status==='passed'?0:2;}catch(e){process.stderr.write(`${e.message}\n`);process.exitCode=1;}
}
