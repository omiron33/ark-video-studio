/** Bounded V1→V2 artifact comparison. This does not replace or pass the engine gate. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileHash,atomicJson} from '../../engine/project.mjs';
import {computeRevision} from '../../engine/gauntlet.mjs';

const projectDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(projectDir,'../..'),projectPath=path.join(projectDir,'project.json');
const renderDir='/Volumes/DATA/ArkRender/genesis1';
const args=process.argv.slice(2),arg=(flag,fallback)=>args.includes(flag)?args[args.indexOf(flag)+1]:fallback;
const baseline=path.resolve(arg('--baseline',path.join(renderDir,'genesis1-breath-earth-v1.mp4')));
const candidate=path.resolve(arg('--candidate',path.join(renderDir,'genesis1-breath-earth-v2.mp4')));
const outDir=path.resolve(arg('--out',path.join(renderDir,'review-v2')));
const baselineMd5=path.resolve(arg('--baseline-framemd5',path.join(renderDir,'review-v2/baseline-framemd5.txt')));
const baselineReviewDir=path.resolve(arg('--baseline-review',path.join(renderDir,'review-v1')));
const baselineCommit='020644c5514b3bd8d506e705f624f4a0506e2a85';
const expectedScope={start:154,end:161,endExclusive:true};
const allowedCue={id:'g1-l045-w01',before:{start:157.7,end:158.2},after:{start:158.016318,end:158.096385}};
const expected={width:1920,height:1080,fps:30,frames:9142,duration:9142/30};
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const digest=b=>createHash('sha256').update(b).digest('hex');
const run=promisify(execFile),command=(name,a)=>run(name,a,{cwd:root,timeout:600000,maxBuffer:16*1024*1024});
const progress=(stage,detail={})=>console.log(JSON.stringify({stage,...detail}));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const wordIdentity=ws=>ws.map(w=>[w.id,w.text,w.phraseId,w.sourcePhraseId??null]);
const wordCues=ws=>ws.map(w=>[w.id,w.text,w.start,w.end,w.phraseId]);
const phraseIdentity=ps=>ps.map(p=>[p.id,p.text??null,p.sourcePhraseId??null,p.wordIds??null]);
const record=async p=>({path:p,sha256:await fileHash(p)});
const checks=[],check=(name,passed,observed,required=null)=>checks.push({name,passed:!!passed,observed,required});

// Streaming hashing avoids buffering raw PCM or large committed media blobs.
function hashProcess(name,a){
 return new Promise((resolve,reject)=>{
  const child=spawn(name,a,{cwd:root,stdio:['ignore','pipe','pipe']}),hash=createHash('sha256');
  let bytes=0,stderr='';const timer=setTimeout(()=>child.kill('SIGTERM'),600000);
  child.stdout.on('data',b=>{bytes+=b.length;hash.update(b)});
  child.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-16384)});
  child.on('error',e=>{clearTimeout(timer);reject(e)});
  child.on('close',code=>{clearTimeout(timer);if(code!==0)reject(Error(`${name} exited ${code}: ${stderr}`));else resolve({sha256:hash.digest('hex'),bytes,stderr})});
 });
}

function parseFrames(text){
 const timebase=text.match(/^#tb 0:\s*(\d+)\/(\d+)$/m);
 if(!timebase)throw Error('Native frame time base is missing');
 const frames=text.split(/\r?\n/).filter(s=>s.trim()&&!s.startsWith('#')).map((line,index)=>{
  const p=line.split(',').map(s=>s.trim());
  if(p.length!==6||!/^[a-f0-9]{32}$/.test(p[5]))throw Error(`Invalid frame checksum row ${index}`);
  return {index,stream:Number(p[0]),dts:Number(p[1]),pts:Number(p[2]),duration:Number(p[3]),bytes:Number(p[4]),md5:p[5]};
 });
 const tick=Number(timebase[1])/Number(timebase[2]);
 return {timebase:timebase[1]+'/'+timebase[2],tick,frames};
}
function groups(indices,frames,tick){
 const result=[];for(const i of indices){const last=result.at(-1);if(last&&last.lastFrame+1===i){last.lastFrame=i;last.count++}else result.push({firstFrame:i,lastFrame:i,count:1})}
 return result.map(g=>({...g,start:frames[g.firstFrame].pts*tick,end:(frames[g.lastFrame].pts+frames[g.lastFrame].duration)*tick,endExclusive:true}));
}
function formatProbe(probe){
 const v=probe.streams.filter(s=>s.codec_type==='video'),a=probe.streams.filter(s=>s.codec_type==='audio');
 return {videoTracks:v.length,audioTracks:a.length,video:v.map(s=>({codec:s.codec_name,width:s.width,height:s.height,pixFmt:s.pix_fmt,fps:s.avg_frame_rate,timeBase:s.time_base,start:s.start_time,frames:Number(s.nb_read_frames),duration:Number(s.duration)})),audio:a.map(s=>({codec:s.codec_name,sampleRate:s.sample_rate,channels:s.channels,channelLayout:s.channel_layout,start:s.start_time,duration:s.duration})),duration:Number(probe.format.duration)};
}
async function verifyCommittedInputs(revision){
 const results=[];
 for(const [kind,prefix,files] of [['project','projects/genesis1-beginning',revision.projectFiles],['renderer','engine',revision.rendererFiles]]){
  for(const item of files){
   const relative=`${prefix}/${item.path==='$manifest'?'project.json':item.path}`;
   try{const actual=await hashProcess('git',['show',`${baselineCommit}:${relative}`]);results.push({kind,path:relative,expectedSha256:item.sha256,commitSha256:actual.sha256,matched:actual.sha256===item.sha256})}
   catch(e){results.push({kind,path:relative,matched:false,error:e.message})}
  }
 }
 return results;
}
async function preflight(){
 const revision=await computeRevision(projectPath);
 const project=await read(projectPath),timing=await read(path.join(projectDir,'timing/words.json'));
 const html=await fs.readFile(path.join(projectDir,'index.html'),'utf8');
 const data=JSON.parse(html.match(/<script>window\.G1_DATA=([\s\S]*?);<\/script>/)?.[1]??'null');
 const committedProject=JSON.parse((await command('git',['show',`${baselineCommit}:projects/genesis1-beginning/project.json`])).stdout);
 const baselineMetadata=await read(baseline+'.render.json');
 const baselineReview=await read(path.join(baselineReviewDir,'review.json'));
 const baselineGate=await read(path.join(baselineReviewDir,'gate.json'));
 const baselineOcr=await read(path.join(baselineReviewDir,'ocr/lyric-visibility.json'));
 const manualPath=path.join(projectDir,'review/v1/manual-exceptions.json');
 const manual=await read(manualPath);
 const visualPath=path.join(projectDir,'review/v1/independent-visual-review.json');
 const visual=await read(visualPath);
 const baselineSha256=await fileHash(baseline);
 const suppliedMd5=await record(baselineMd5),baseFrames=parseFrames(await fs.readFile(baselineMd5,'utf8'));
 const committedInputs=await verifyCommittedInputs(baselineMetadata.sourceRevision);
 check('baselineCommittedSourceBinding',committedInputs.every(f=>f.matched),{commit:baselineCommit,checked:committedInputs.length,mismatches:committedInputs.filter(f=>!f.matched)},'Every V1 declared project and renderer input must match commit');
 check('baselineVideoProvenance',baselineMetadata.sha256===baselineSha256&&baselineMetadata.sourceRevision.revisionHash===baselineMetadata.sourceRevisionEnd.revisionHash,{videoSha256:baselineSha256,metadataSha256:baselineMetadata.sha256,start:baselineMetadata.sourceRevision.revisionHash,end:baselineMetadata.sourceRevisionEnd.revisionHash});
 const records=[baselineReview,baselineGate,baselineOcr,visual];
 check('baselineReviewBindings',records.every(r=>r.binding?.videoSha256===baselineSha256&&r.binding?.projectHash===baselineMetadata.sourceRevision.projectHash)&&manual.videoSha256===baselineSha256,records.map(r=>r.binding));
 check('providedNativeFrameBaseline',baseFrames.timebase==='1/30'&&baseFrames.frames.length===expected.frames&&baseFrames.frames.every((f,i)=>f.stream===0&&f.pts===i&&f.dts===i&&f.duration===1&&f.bytes===3110400),{...suppliedMd5,count:baseFrames.frames.length,timebase:baseFrames.timebase,origin:'Existing baseline supplied by coordinating agent; not regenerated by this utility.'},{frames:expected.frames,timebase:'1/30',pixelBytes:3110400});
 check('canonicalWordIdentity',project.words.length===462&&equal(wordIdentity(committedProject.words),wordIdentity(project.words)),{before:committedProject.words.length,after:project.words.length,identitySha256:digest(JSON.stringify(wordIdentity(project.words)))},'Exact ordered word IDs, text, phrase IDs and source phrase IDs from V1');
 check('canonicalPhraseIdentity',project.phrases.length===86&&equal(phraseIdentity(committedProject.phrases),phraseIdentity(project.phrases)),{before:committedProject.phrases.length,after:project.phrases.length},'Exact ordered phrase IDs/text/source IDs/word lists');
 const cueChanges=project.words.flatMap((w,i)=>{const b=committedProject.words[i];return b.start===w.start&&b.end===w.end?[]:[{id:w.id,before:{start:b.start,end:b.end},after:{start:w.start,end:w.end}}]});
 check('onlyAuthorizedCueDelta',equal(cueChanges,[allowedCue]),cueChanges,[allowedCue]);
 check('compiledCanonicalTimeline',data&&equal(wordCues(data.words),wordCues(project.words))&&equal(wordCues(timing.words),wordCues(project.words))&&Math.abs(data.duration-project.duration)<1e-6,{words:data?.words.length,duration:data?.duration},'Compiled HTML, source timing and manifest agree; duration rounding tolerance 1 microsecond');
 const dependencyMismatches=[];
 for(const item of Object.values(project.productionInputs)){if(!item?.src?.endsWith('.js'))continue;const source=await fs.readFile(path.join(projectDir,item.src),'utf8');const externalReference=html.includes(`src="${item.src}"`)||html.includes(`src='${item.src}'`);if(!html.includes(source)&&!externalReference)dependencyMismatches.push(item.src)}
 check('compiledScriptSources',!dependencyMismatches.length,dependencyMismatches,'Every declared JS source is embedded without drift');
 const oldFiles=new Map(baselineMetadata.sourceRevision.projectFiles.map(f=>[f.path,f.sha256]));
 const fileChanges=revision.projectFiles.filter(f=>oldFiles.get(f.path)!==f.sha256).map(f=>f.path);
 const allowedFiles=['$manifest','index.html','timing/words.json'];
 check('boundedProductionInputDelta',fileChanges.every(p=>allowedFiles.includes(p))&&revision.projectFiles.length===oldFiles.size&&revision.rendererHash===baselineMetadata.sourceRevision.rendererHash,{fileChanges,rendererUnchanged:revision.rendererHash===baselineMetadata.sourceRevision.rendererHash},allowedFiles);
 const frozenFiles=await Promise.all([baseline,baseline+'.render.json',baselineMd5,path.join(baselineReviewDir,'review.json'),path.join(baselineReviewDir,'gate.json'),path.join(baselineReviewDir,'ocr/lyric-visibility.json'),manualPath,visualPath].map(record));
 return {revision,project,baselineMetadata,baselineReview,baselineGate,baselineOcr,manual,visual,visualPath,baselineSha256,baseFrames,suppliedMd5,committedInputs,cueChanges,fileChanges,frozenFiles};
}
async function ssimDiagnostics(indices){
 const statsPath=path.join(outDir,'delta-ssim-frames.log');
 // Working-directory-relative filter path keeps ffmpeg's filter parser independent of volume-path escaping.
 const relativeStats=path.relative(root,statsPath).replaceAll('\\','/');
 if(/[:'\[\],;]/.test(relativeStats))throw Error('SSIM output path needs explicit ffmpeg escaping');
 const result=await command('ffmpeg',['-hide_banner','-v','error','-xerror','-i',baseline,'-i',candidate,'-filter_complex',`[0:v:0][1:v:0]ssim=stats_file='${relativeStats}'`,'-an','-f','null','-']);
 const text=await fs.readFile(statsPath,'utf8'),scores=new Map(text.split(/\r?\n/).flatMap(s=>{const m=s.match(/n:(\d+).*?All:([\d.]+)/);return m?[[Number(m[1])-1,Number(m[2])]]:[]}));
 const values=indices.map(i=>({frame:i,time:i/30,ssim:scores.get(i)??null}));
 return {method:'Native-frame luminance/chroma SSIM diagnostics only; no threshold reclassifies differences or passes scope.',stats:await record(statsPath),stderr:result.stderr,frameCount:scores.size,outsideScope:values,min:Math.min(...values.map(v=>v.ssim??-1)),requiresIndependentReview:true};
}

async function carryEvidence(context,identical){
 const {baselineOcr,baselineReview,manual,visual,visualPath,baselineSha256}=context;
 const evidence=new Map();
 for(const f of [...baselineOcr.evidence,...baselineReview.evidence.samples,...manual.manuallyVisibleWords]){
  const index=Math.round(f.time*expected.fps),key=`${f.path}|${f.sha256}`;
  if(evidence.has(key))continue;
  const actual=await fileHash(f.path),fileVerified=actual===f.sha256;
  evidence.set(key,{path:f.path,sha256:f.sha256,time:f.time,frame:index,fileVerified,decodedFrameIdentical:identical.has(index),status:fileVerified&&identical.has(index)?'carried_from_v1_identical_decoded_frame':'not_carried',originalVideoSha256:baselineSha256});
 }
 const lookup=(f)=>evidence.get(`${f.path}|${f.sha256}`);
 const wordCoverage=baselineOcr.wordCoverage.map(w=>{
  const retained=w.observations.filter(f=>lookup(f)?.status==='carried_from_v1_identical_decoded_frame');
  const visibilityWindowIdentical=Array.from({length:Math.max(0,Math.ceil(w.end*30)-Math.floor(w.start*30))},(_,i)=>Math.floor(w.start*30)+i).every(i=>identical.has(i));
  return {id:w.id,text:w.text,originalObserved:w.observed,originalReason:w.reason,originalObservationCount:w.observations.length,retainedObservationCount:retained.length,retainedObservations:retained.map(f=>({time:f.time,path:f.path,sha256:f.sha256})),visibilityWindowIdentical,carryStatus:w.observed&&retained.length?'original_positive_observation_carried':!w.observed?'original_ocr_miss_preserved':'requires_changed_frame_review',timingAcceptance:'not_claimed'};
 });
 const manualWords=manual.manuallyVisibleWords.map(f=>({...f,carryStatus:lookup(f)?.status??'not_carried'}));
 check('baselineEvidenceFileHashes',[...evidence.values()].every(f=>f.fileVerified),{verified:[...evidence.values()].filter(f=>f.fileVerified).length,total:evidence.size},'Original encoded evidence files unchanged');
 const visualEvidence=await Promise.all(visual.evidence.map(async f=>({...f,fileVerified:await fileHash(f.path)===f.sha256})));
 check('baselineIndependentVisualEvidenceHashes',visualEvidence.every(f=>f.fileVerified),{count:visualEvidence.length,failed:visualEvidence.filter(f=>!f.fileVerified)},'Previously inspected contact-sheet files unchanged');
 const rangeIdentical=(start,end)=>Array.from({length:Math.max(0,Math.ceil(end*30)-Math.floor(start*30))},(_,i)=>Math.floor(start*30)+i).every(i=>identical.has(i));
 const independentVisual={originalReport:await record(visualPath),originalBinding:visual.binding,originalStatus:visual.status,originalReviewer:visual.reviewer,originalScores:visual.scores,scoresApplyTo:'V1 only; not new V2 scores',method:'V1 sampled-frame judgments may be inherited only over identical native-frame intervals. Composite contact sheets are preserved as V1 artifacts, not relabeled as V2 captures.',eligibleIntervals:groups([...identical],context.baseFrames.frames,context.baseFrames.tick),timestampObservations:visual.timestampEvidence.map(t=>({...t,allIntervalFramesIdentical:rangeIdentical(t.start,t.end)})),evidence:visualEvidence,limitations:visual.limitations};
 return {schemaVersion:1,kind:'decoded-frame-evidence-carry-forward',baselineVideoSha256:baselineSha256,candidateVideoSha256:await fileHash(candidate),method:'Original sampled visual/OCR judgments apply only at native frame indices with identical decoded pixel hashes. Source records and failures remain unchanged.',originalOcrStatus:baselineOcr.status,originalOcrCoverage:baselineOcr.coverage,originalVisualStatus:baselineReview.visual.status,independentVisual,automaticCompletePass:false,evidence:[...evidence.values()],wordCoverage,manualVisibility:manualWords,temporalException:{...manual.temporalException,allIntervalFramesIdentical:rangeIdentical(manual.temporalException.start,manual.temporalException.end)},limitations:['No new OCR, ASR, artistic score or full-sync approval was generated.','Identical audio retains waveform identity, not a new word-sync verdict.','Raw failed V1 gate and four OCR misses remain failed in their original artifacts.','Changed frames and the corrected entrance require focused V2 visual/audio judgment.']};
}

async function main(){
 await fs.mkdir(outDir,{recursive:true});
 progress('delta-preflight-start');
 const context=await preflight(),start=new Date().toISOString();
 await atomicJson(path.join(outDir,'delta-preflight.json'),{createdAt:start,baselineCommit,expectedScope,allowedCue,checks,revision:context.revision,committedInputs:context.committedInputs,baselineFiles:context.frozenFiles,notAnEngineGate:true});
 if(args.includes('--prepare')){progress('delta-preflight-complete',{passed:checks.every(c=>c.passed),failures:checks.filter(c=>!c.passed)});process.exitCode=checks.every(c=>c.passed)?0:2;return}
 if(checks.some(c=>!c.passed))throw Error('Preflight failed; see delta-preflight.json');
 const candidateMetaPath=candidate+'.render.json',candidateMeta=await read(candidateMetaPath),candidateSha256=await fileHash(candidate),candidateMetaHash=await fileHash(candidateMetaPath);
 check('candidateRenderBindings',candidateMeta.sha256===candidateSha256&&candidateMeta.sourceRevision.revisionHash===context.revision.revisionHash&&candidateMeta.sourceRevisionEnd.revisionHash===context.revision.revisionHash,{videoSha256:candidateSha256,metadataVideoSha256:candidateMeta.sha256,start:candidateMeta.sourceRevision.revisionHash,end:candidateMeta.sourceRevisionEnd.revisionHash,active:context.revision.revisionHash});
 if(checks.some(c=>!c.passed))throw Error('Candidate render/source binding mismatch');
 const ffmpegVersion=(await command('ffmpeg',['-version'])).stdout.split('\n')[0];
 const candidateMd5=path.join(outDir,'delta-v2-framemd5.txt');
 progress('delta-native-decode-start');
 const operations=[
  ['baselineProbe',()=>command('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',baseline])],
  ['candidateProbe',()=>command('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',candidate])],
  ['candidateNativeFrames',()=>command('ffmpeg',['-hide_banner','-v','error','-xerror','-i',candidate,'-map','0:v:0','-an','-fps_mode','passthrough','-f','framemd5','-y',candidateMd5])],
  ['baselinePcm',()=>hashProcess('ffmpeg',['-hide_banner','-v','error','-xerror','-i',baseline,'-map','0:a:0','-vn','-c:a','pcm_s16le','-f','s16le','-'])],
  ['candidatePcm',()=>hashProcess('ffmpeg',['-hide_banner','-v','error','-xerror','-i',candidate,'-map','0:a:0','-vn','-c:a','pcm_s16le','-f','s16le','-'])]
 ];
 const settled=await Promise.allSettled(operations.map(([,fn])=>fn())),results={};
 settled.forEach((r,i)=>{const name=operations[i][0];check(name+'Decode',r.status==='fulfilled',r.status==='fulfilled'?'Completed without ffmpeg/ffprobe errors':r.reason.message);if(r.status==='fulfilled')results[name]=r.value});
 if(settled.some(r=>r.status==='rejected'))throw Error('Decode/probe failed');
 const probes={baseline:JSON.parse(results.baselineProbe.stdout),candidate:JSON.parse(results.candidateProbe.stdout)};
 await atomicJson(path.join(outDir,'delta-probe.json'),probes);
 const formats={baseline:formatProbe(probes.baseline),candidate:formatProbe(probes.candidate)};
 check('matchingStreamFormats',equal(formats.baseline,formats.candidate),formats);
 check('requiredFormat',formats.candidate.videoTracks===1&&formats.candidate.audioTracks===1&&formats.candidate.video[0].codec==='h264'&&formats.candidate.video[0].width===expected.width&&formats.candidate.video[0].height===expected.height&&formats.candidate.video[0].fps==='30/1'&&formats.candidate.video[0].frames===expected.frames&&Math.abs(formats.candidate.duration-expected.duration)<.08,formats.candidate,expected);
 check('decodedPcmIdentity',results.baselinePcm.bytes===results.candidatePcm.bytes&&results.baselinePcm.sha256===results.candidatePcm.sha256,{baseline:results.baselinePcm,candidate:results.candidatePcm},'All decoded native-channel/native-rate signed16 PCM bytes identical');
 const a=context.baseFrames,b=parseFrames(await fs.readFile(candidateMd5,'utf8'));
 check('nativeFrameStructure',a.timebase===b.timebase&&a.frames.length===b.frames.length&&a.frames.every((f,i)=>{const x=b.frames[i];return x&&f.stream===x.stream&&f.pts===x.pts&&f.dts===x.dts&&f.duration===x.duration&&f.bytes===x.bytes}),{baselineFrames:a.frames.length,candidateFrames:b.frames.length,baselineTimebase:a.timebase,candidateTimebase:b.timebase});
 const different=a.frames.flatMap((f,i)=>f.md5===b.frames[i]?.md5?[]:[i]);
 const identical=new Set(a.frames.flatMap((f,i)=>f.md5===b.frames[i]?.md5?[i]:[]));
 const outside=different.filter(i=>a.frames[i].pts*a.tick<expectedScope.start||a.frames[i].pts*a.tick>=expectedScope.end);
 check('decodedDifferencesConfinedToAuthorizedInterval',!outside.length,{differentFrames:different.length,outsideFrames:outside.length,intervals:groups(different,a.frames,a.tick),outsideIntervals:groups(outside,a.frames,a.tick)},expectedScope);
 check('authorizedChangePresent',different.length>0,{differentFrames:different.length},'The new render must differ somewhere in the changed scene');
 let ssim=null;if(outside.length){progress('delta-outside-scope-ssim',{frames:outside.length});ssim=await ssimDiagnostics(outside);await atomicJson(path.join(outDir,'delta-ssim-diagnostics.json'),ssim)}
 const evidence=await carryEvidence(context,identical),evidencePath=path.join(outDir,'delta-evidence-carry-forward.json');
 await atomicJson(evidencePath,evidence);
 const endRevision=await computeRevision(projectPath);
 const unchangedRecords=await Promise.all(context.frozenFiles.map(async f=>({...f,endSha256:await fileHash(f.path)})));
 check('frozenInputsUnchanged',endRevision.revisionHash===context.revision.revisionHash&&await fileHash(candidate)===candidateSha256&&await fileHash(candidateMetaPath)===candidateMetaHash&&unchangedRecords.every(f=>f.sha256===f.endSha256),{startRevision:context.revision.revisionHash,endRevision:endRevision.revisionHash,mutatedBaselineEvidence:unchangedRecords.filter(f=>f.sha256!==f.endSha256)});
 const passed=checks.every(c=>c.passed);
 const report={schemaVersion:1,kind:'bounded-artifact-delta-review',createdAt:start,completedAt:new Date().toISOString(),status:passed?'delta_checks_passed_focused_review_required':'delta_checks_failed',deltaChecksPassed:passed,notAnEngineGate:true,automaticCompletePass:false,baseline:{video:baseline,sha256:context.baselineSha256,commit:baselineCommit,revision:context.baselineMetadata.sourceRevision.revisionHash,frameMd5:context.suppliedMd5},candidate:{video:candidate,sha256:candidateSha256,renderMetadata:{path:candidateMetaPath,sha256:candidateMetaHash},revision:context.revision.revisionHash,frameMd5:await record(candidateMd5)},tool:{ffmpeg:ffmpegVersion,script:await record(fileURLToPath(import.meta.url))},expectedScope,allowedCue,checks,frameComparison:{total:a.frames.length,identical:identical.size,different:different.length,differentIntervals:groups(different,a.frames,a.tick),identicalIntervals:groups([...identical],a.frames,a.tick),outsideScope:groups(outside,a.frames,a.tick),ssimDiagnostics:ssim?await record(path.join(outDir,'delta-ssim-diagnostics.json')):null},audio:{method:'Full native-rate/channel signed16 PCM decode; stream metadata separately compared',baseline:results.baselinePcm,candidate:results.candidatePcm},carryForward:{path:evidencePath,sha256:await fileHash(evidencePath),carriedSamples:evidence.evidence.filter(f=>f.status==='carried_from_v1_identical_decoded_frame').length,totalOriginalSamples:evidence.evidence.length,originalPositiveWordObservationsCarried:evidence.wordCoverage.filter(w=>w.carryStatus==='original_positive_observation_carried').length},preservedV1Gate:{...await record(path.join(baselineReviewDir,'gate.json')),passed:context.baselineGate.passed,status:context.baselineGate.status,reasons:context.baselineGate.reasons,quality:context.baselineGate.quality},limitations:evidence.limitations};
 await atomicJson(path.join(outDir,'delta-review.json'),report);
 progress('delta-review-complete',{status:report.status,identical:identical.size,different:different.length,outsideScope:outside.length,report:path.join(outDir,'delta-review.json')});
 process.exitCode=passed?0:2;
}
if(args.includes('--help'))console.log('node review-delta.mjs [--prepare] [--baseline PATH] [--candidate PATH] [--out DIR] [--baseline-framemd5 PATH] [--baseline-review DIR]\nThe expected edit scope and sole authorized cue change are explicit constants. No engine gate or input files are changed.');
else await main().catch(async e=>{await fs.mkdir(outDir,{recursive:true});await atomicJson(path.join(outDir,'delta-execution-failure.json'),{createdAt:new Date().toISOString(),error:e.stack,checks,notAnEngineGate:true});console.error(e.stack);process.exitCode=2});
