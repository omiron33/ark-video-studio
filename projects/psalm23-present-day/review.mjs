/** Review adapter for this authored HyperFrames film. Never renders or changes lyric timing. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {runInNewContext} from 'node:vm';
import {loadProject,validateProject,fileHash,atomicJson,resolveSource,digest} from '../../engine/project.mjs';
import {computeRevision,checkReview,VISUAL_RUBRIC} from '../../engine/gauntlet.mjs';
import {reviewAudio,decodeAudio,compareWaveforms} from '../../engine/audio-review.mjs';
import {reviewLyricVisibility} from '../../engine/ocr.mjs';
import {reviewTemporalActivity,validateTemporalReport} from '../../engine/temporal-review.mjs';

const projectDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(projectDir,'../..');
const work=path.join(root,'output/psalm23-production');
const projectPath=path.join(projectDir,'project.json');
const FROZEN_ALIGNMENT_SHA256='a0457cf99af4c446721bde09a9f2aa287072d6a3bc478c92a002ff6aa0e3da2c';
const SOURCE_AUDIO_SHA256='3669040e797c9d2bf8b4136dc4c029c6e1ed51f302ccc411d1888ae50da80c8f';
const WORD_COUNT=210,PHRASE_COUNT=39,DURATION=219.96,FPS=30,WIDTH=1920,HEIGHT=1080;
const HYPERFRAMES_VERSION='0.8.80',COMPOSITION_ID='psalm23';
const SOURCE_AUDIO='sources/32885123-f4b6-42e6-a546-f4acba404829.m4a';
const PERFORMANCE_LYRICS='sources/performance-lyrics.txt';
const EXPECTED_FRAMES=Math.ceil(DURATION*FPS-1e-8);
const args=process.argv.slice(2);
const arg=(flag,fallback)=>{const i=args.indexOf(flag);if(i<0)return fallback;if(!args[i+1]||args[i+1].startsWith('--'))throw Error(`Missing value for ${flag}`);return args[i+1]};
const videoPath=path.resolve(arg('--video',path.join(work,'psalm23-held-in-the-ordinary-v1.mp4')));
const outDir=path.resolve(arg('--out',path.join(work,'review-full')));
const audioMaxAttempts=Number(arg('--audio-max-attempts','1'));
if(!Number.isInteger(audioMaxAttempts)||audioMaxAttempts<1||audioMaxAttempts>3)throw Error('--audio-max-attempts must be an integer from 1 through 3');
const run=promisify(execFile),read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const exists=async p=>{try{return(await fs.stat(p)).isFile()}catch{return false}};
const progress=(stage,detail={})=>console.log(JSON.stringify({stage,...detail}));
const command=(tool,values,timeout=600000)=>run(tool,values,{timeout,maxBuffer:32*1024*1024});
const identity=words=>words.map(w=>[w.id,w.text,w.start,w.end,w.phraseId]);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const localRef=value=>{
 if(typeof value!=='string'||!value||/^(?:https?:|data:|blob:|\/\/)/i.test(value))throw Error(`Production input must be a local file: ${value}`);
 const absolute=path.resolve(projectDir,value);
 if(!absolute.startsWith(projectDir+path.sep))throw Error(`Production input escapes project: ${value}`);
 return path.relative(projectDir,absolute).split(path.sep).join('/');
};
const assetId=src=>src.replace(/\.[^.]+$/,'').replace(/[^A-Za-z0-9_.-]/g,'-');
const independentGate=state=>{
 const passed=state.passed&&state.quality?.independentVisualReviewed===true;
 return{...state,passed,status:state.passed&&!passed?'independent_visual_review_required':state.status,reasons:state.quality?.independentVisualReviewed?state.reasons:[...state.reasons,'This film requires an independent visual-only reviewer of the exact encoded output; machine-only or structural checks cannot replace that review.']};
};

async function filesBelow(dir){
 let entries;try{entries=await fs.readdir(path.join(projectDir,dir),{withFileTypes:true})}catch(e){if(e.code==='ENOENT')return[];throw e}
 const found=[];for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))){const name=path.posix.join(dir,entry.name);if(entry.isDirectory())found.push(...await filesBelow(name));else if(entry.isFile())found.push(name)}return found;
}

async function compiledData(){
 const html=await fs.readFile(path.join(projectDir,'index.html'),'utf8');
 const marker='window.P23_DATA=',start=html.indexOf(marker);
 if(start<0)throw Error('Compiled P23_DATA is missing; run the project build first');
 let end=start+marker.length,depth=0,quoted=false,escaped=false;
 for(;end<html.length;end++){
  const c=html[end];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue}
  if(c==='"'){quoted=true;continue}if(c==='{')depth++;if(c==='}'&&--depth===0){end++;break}
 }
 const data=JSON.parse(html.slice(start+marker.length,end));
 return{data,html};
}

async function sourceContract(){
 const timingPath=path.join(projectDir,'sources/words.json');
 const timing=await read(timingPath),sha256=await fileHash(timingPath);
 if(sha256!==FROZEN_ALIGNMENT_SHA256)throw Error('Frozen alignment hash changed; explicitly reconcile source timing before preparing or reviewing');
 const tokens=(await fs.readFile(path.join(projectDir,PERFORMANCE_LYRICS),'utf8')).trim().split(/\s+/);
 if(tokens.length!==WORD_COUNT||timing.words.length!==WORD_COUNT||timing.phrases.length!==PHRASE_COUNT)throw Error('Expected exactly210 performed words and39 phrases');
 if(!equal(tokens,timing.words.map(w=>w.text)))throw Error('Performance lyrics differ from literal timed word sequence; headings must not enter the audio gate');
 if(new Set(timing.words.map(w=>w.id)).size!==WORD_COUNT)throw Error('Duplicate canonical word IDs');
 if(await fileHash(path.join(projectDir,SOURCE_AUDIO))!==SOURCE_AUDIO_SHA256||timing.source?.sha256!==SOURCE_AUDIO_SHA256)throw Error('Source song identity/audio hash mismatch');
 const choice=await read(path.join(projectDir,'concepts/theme-choice.json'));
 if(choice.status!=='chosen')throw Error('Explicit chosen theme is required');
 return{timing,sha256,tokens};
}

async function productionInputs(plan,data,html){
 const refs=new Set([
  'review.mjs','index.html','composition.html.txt','opening.js','choreography.js','semantic-motion.js','build.mjs',
  'package.json','hyperframes.json','scene-plan.json','vendor/gsap.min.js',
  'sources/words.json','sources/phrases.json',PERFORMANCE_LYRICS,'sources/canonical-lyrics.txt',
  'sources/suno-lyrics-exact.txt','analysis/audio-energy-attacks.json','concepts/theme-choice.json',
  'concepts/reference-notes.md',...(plan.assets??[]),data.audio,
  ...data.acts.map(a=>a.photo),...data.videos.flatMap(v=>[v.src,v.poster]),
  ...await filesBelow('assets')
 ].filter(Boolean).map(localRef));
 for(const match of html.matchAll(/\b(?:src|poster)\s*=\s*["']([^"']+)["']/g))refs.add(localRef(match[1]));
 for(const match of html.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g))if(!match[1].startsWith('#'))refs.add(localRef(match[1]));
 for(const name of await fs.readdir(projectDir))if(/\.(?:mjs|cjs|js|css|html|html\.txt)$/.test(name)||(/(?:motion|choreograph|mechanism)/i.test(name)&&/\.json$/i.test(name)))refs.add(localRef(name));
 const result={};for(const src of [...refs].sort())result[assetId(src)]={src};return result;
}

async function effectiveSemanticHooks(){
 const filename='semantic-motion.js',source=await fs.readFile(path.join(projectDir,filename),'utf8');
 // Initialize only the authored registry in an isolated context with no DOM, Node, timers,
 // network or timeline. Do not execute production motion functions.
 const sandbox={window:Object.create(null)};
 runInNewContext(source,sandbox,{timeout:1000,contextCodeGeneration:{strings:false,wasm:false}});
 const registry=sandbox.window.P23_SEMANTIC_REGISTRY,families=sandbox.window.P23_SEMANTIC_FAMILIES,dispatch=sandbox.window.P23_SEMANTIC;
 if(!registry||typeof registry!=='object'||!Array.isArray(families)||typeof dispatch!=='function')throw Error('Semantic file must expose actual P23_SEMANTIC_REGISTRY, P23_SEMANTIC_FAMILIES and dispatcher');
 const keys=Object.keys(registry),declared=Array.from(families),errors=[];
 if(new Set(declared).size!==declared.length||!equal([...keys].sort(),[...declared].sort()))errors.push('Semantic family declaration differs from actual registry keys');
 if(keys.length!==13)errors.push('Expected the13 deliberately assigned semantic hook implementations');
 const implementations=keys.map(family=>{
  const fn=registry[family];if(typeof fn!=='function')throw Error(`Semantic registry value is not a function: ${family}`);
  const body=Function.prototype.toString.call(fn).replace(/\s+/g,' ').trim();
  return{family,provider:'semantic-hook',source:filename,bodySha256:digest(body),bodyCharacters:body.length};
 });
 // Replace only isolated-context registry entries with spies. This verifies actual dispatch
 // selection/return semantics without executing any DOM mutation or animation implementation.
 const calls=[];for(const family of keys)registry[family]=ctx=>calls.push({family,ctx});
 for(const family of keys){
  const p={family},ctx={auditToken:family};calls.length=0;
  const handled=dispatch(p,ctx);
  if(handled!==true||calls.length!==1||calls[0].family!==family||calls[0].ctx?.p!==p||calls[0].ctx?.auditToken!==family)errors.push(`Semantic dispatcher does not select exactly its declared implementation: ${family}`);
 }
 calls.length=0;if(dispatch({family:'__unassigned_audit_family__'},{})!==false||calls.length)errors.push('Semantic dispatcher does not leave unassigned families to the main switch');
 return{source,filename,families:declared,implementations,errors,sha256:await fileHash(path.join(projectDir,filename)),dispatchVerified:!errors.length};
}

async function choreographyAudit(plan,data,html){
 const source=await fs.readFile(path.join(projectDir,'choreography.js'),'utf8');
 const hooks=await effectiveSemanticHooks();
 const counts={},sceneIds=new Set(),missing=[],mismatch=[];
 mismatch.push(...hooks.errors);
 if(!html.includes(source.trim())||!html.includes(hooks.source.trim()))mismatch.push('Compiled HTML does not contain the current main/semantic source verbatim; rebuild before review');
 const mapping=[];
 for(const scene of plan.scenes??[]){
  const family=scene.choreography??scene.family;
  const phrase=data.phrases.find(p=>p.id===scene.id);
  if(sceneIds.has(scene.id))mismatch.push(`Duplicate scene ${scene.id}`);sceneIds.add(scene.id);
  if(!family||phrase?.family!==family)mismatch.push(`Scene/compiled family mismatch: ${scene.id}`);
  else counts[family]=(counts[family]??0)+1;
  if(phrase&&!equal(identity((scene.words??[]).map(w=>({...w,phraseId:scene.id}))),identity(phrase.words.map(w=>({...w,phraseId:phrase.id})))))mismatch.push(`Scene/compiled word identity or timing mismatch: ${scene.id}`);
  mapping.push({phraseId:scene.id,index:phrase?.index,family,intent:scene.intent});
 }
 for(const phrase of data.phrases)if(!sceneIds.has(phrase.id))missing.push(phrase.id);
 // Inspect actual main switch cases, then remove every case bypassed by a semantic hook.
 const implementationCases=[...source.matchAll(/case\s+(['"])([A-Za-z0-9_.-]+)\1\s*:\s*([\s\S]*?)\bbreak\s*;/g)].map(match=>({family:match[2],body:match[3].replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g,'').replace(/\s+/g,' ').trim()}));
 const switchFamilies=implementationCases.map(c=>c.family);
 if(new Set(switchFamilies).size!==switchFamilies.length)mismatch.push('Duplicate implemented family cases');
 if(!source.includes('switch(p.family)'))mismatch.push('Expected actual family dispatch is missing');
 const hookCall=source.indexOf('window.P23_SEMANTIC?.(p,'),switchStart=source.indexOf('switch(p.family)');
 const bypass=hookCall>=0?source.slice(hookCall,switchStart):'';
 if(hookCall<0||hookCall>switchStart||!/^window\.P23_SEMANTIC\?\.\(p,\{[^]*?\}\)\)\s*continue\s*;/.test(bypass))mismatch.push('Semantic hook must return handled and continue before the old family switch');
 const inactiveSwitchFamilies=switchFamilies.filter(f=>hooks.families.includes(f));
 const mainCases=implementationCases.filter(c=>!hooks.families.includes(c.family));
 const mechanisms=[...mainCases.map(c=>({family:c.family,provider:'main-switch',source:'choreography.js',bodySha256:digest(c.body),bodyCharacters:c.body.length})),...hooks.implementations];
 const implemented=mechanisms.map(c=>c.family);
 if(new Set(implemented).size!==implemented.length)mismatch.push('More than one effective implementation for a family');
 const usedMechanisms=mechanisms.filter(c=>Object.hasOwn(counts,c.family));
 const distinctImplementationBodies=new Set(usedMechanisms.map(c=>c.bodySha256)).size;
 if(usedMechanisms.some(c=>c.bodyCharacters<15))mismatch.push('Empty or trivial family implementation');
 // An optional runtime registry must agree with actual cases and compiled mapping.
 const registryMatch=source.match(/(?:const|let|var)\s+P23_CHOREOGRAPHY_FAMILIES\s*=\s*(\[[\s\S]*?\])\s*;/);
 let registry=null;
 if(registryMatch){try{registry=JSON.parse(registryMatch[1]);if(!equal(registry,data.phrases.map(p=>p.family))||registry.some(f=>!implemented.includes(f)))mismatch.push('Runtime family registry differs from compiled order or actual switch cases')}catch{mismatch.push('Implementation family registry must be JSON-compatible')}}
 const unimplemented=Object.keys(counts).filter(f=>!implemented.includes(f));
 const uniqueFamilies=Object.keys(counts).length,maxUses=Math.max(0,...Object.values(counts));
 return{uniqueFamilies,distinctImplementationBodies,maxUses,counts,mapping: mapping.map(m=>({...m,implementation:mechanisms.find(c=>c.family===m.family)})),missingPhraseIds:missing,unimplementedFamilies:unimplemented,mismatches:mismatch,effectiveImplementations:mechanisms,inactiveSwitchFamilies,semanticDispatchVerified:hooks.dispatchVerified,implementationRegistry:registry,implementationSources:[{src:'choreography.js',sha256:await fileHash(path.join(projectDir,'choreography.js'))},{src:hooks.filename,sha256:hooks.sha256}],passed:uniqueFamilies>=30&&distinctImplementationBodies>=30&&maxUses<=3&&!missing.length&&!unimplemented.length&&!mismatch.length&&sceneIds.size===PHRASE_COUNT,note:'Only effective dispatched implementations count. Bypassed old switch cases are excluded. Distinct code bodies can still look repetitive; independent encoded review must judge at least30 meaningful choreography groups with none used more than3times.'};
}

async function prepare(){
 const{timing}=await sourceContract(),plan=await read(path.join(projectDir,'scene-plan.json')),{data,html}=await compiledData();
 const inputs=await productionInputs(plan,data,html),assets={},mediaAssets={};
 for(const{src}of Object.values(inputs)){
  const id=assetId(src);
  if(/\.(?:png|jpe?g|webp)$/i.test(src))assets[id]={type:'image',src};
  else if(/\.(?:ttf|otf|woff2?)$/i.test(src))assets[id]={type:'font',src,family:src.includes('Cormorant')?'Cormorant':'Elegy'};
  else if(/\.(?:mp4|mov|webm)$/i.test(src))mediaAssets[id]={type:'video',src};
 }
 const lastScene=plan.scenes.find(s=>s.id===timing.phrases.at(-1).id);
 const outroStart=Math.min(DURATION-1/FPS,Math.max(timing.words.at(-1).end,lastScene?.end??0));
 const regions=[{id:'p23-opening-review',start:0,wordIds:[],choreography:'opening-contour-and-threshold'},...timing.phrases.map(p=>({id:p.id,start:p.start,wordIds:p.wordIds,choreography:plan.scenes.find(s=>s.id===p.id)?.choreography})),{id:'p23-outro-review',start:outroStart,wordIds:[],choreography:'returning-home-open-threshold'}];
 const sections=regions.map((s,i)=>({id:s.id,start:s.start,end:regions[i+1]?.start??DURATION,style:'verse',seed:23000+i,wordIds:s.wordIds,assetIds:[],direction:{backend:'hyperframes',reviewRegion:true,choreography:s.choreography,inspiration:plan.direction?.inspiration,note:'Contiguous engine-schema review region only; actual composition is bound custom HyperFrames source, not the Canvas verse renderer.'}}));
 const attacks=await read(path.join(projectDir,'analysis/audio-energy-attacks.json'));
 const project={version:1,id:'psalm23-present-day',title:'Psalm 23 — Held in the Ordinary',width:WIDTH,height:HEIGHT,fps:FPS,duration:DURATION,audio:{src:SOURCE_AUDIO,offset:0},lyricsPath:PERFORMANCE_LYRICS,source:{title:timing.title,start:0,end:DURATION,audioDuration:DURATION,audioSha256:SOURCE_AUDIO_SHA256},palette:{ink:'#171c15',paper:'#fff1d4',accent:'#d9b574'},assets,mediaAssets,productionInputs:inputs,words:timing.words,phrases:timing.phrases,beats:attacks.attacks.map(a=>({time:a.time,strength:a.strengthRelativeToMax,kind:a.kind,provenance:'analysis/audio-energy-attacks.json; accompaniment attack, not a vocal onset or verified beat'})),sections,intake:{status:'timed_needs_encoded_review',timingVerified:false,originalAudio:SOURCE_AUDIO,originalLyrics:PERFORMANCE_LYRICS,originalTiming:'sources/words.json',originalBeats:'analysis/audio-energy-attacks.json',suppliedLyrics:'sources/canonical-lyrics.txt',warnings:['The210 sung literal words exclude provider section headings; canonical/provider archives remain unchanged.','Source-only timing preparation supports166words and leaves44uncertain; neither source preparation nor a successful render passes encoded sync.']},sourceAlignment:{src:'sources/words.json',sha256:FROZEN_ALIGNMENT_SHA256,status:timing.status,summary:timing.summary,notEncodedAcceptance:true},quality:{maxStaticSeconds:4},renderBackend:{name:'hyperframes',version:HYPERFRAMES_VERSION,compositionId:COMPOSITION_ID,entry:{src:'index.html'},adapterPurpose:'Review manifest for the bound custom HyperFrames composition; use pinned HyperFrames CLI to render.'},creation:{stylePrompt:'Theme1 Held in the Ordinary: warm amber, olive and ivory; present-day protection, intricate semantic editable lyric choreography, photographic human relationships and three locally generated organic inserts.'},hyperframesReviewPolicy:{minDistinctLyricChoreographies:30,maxUsesPerChoreography:3,canonicalWordCount:WORD_COUNT,performedPhraseCount:PHRASE_COUNT,sourceSupportNotAcceptance:true,independentEncodedReviewRequired:true,canvasCreativePolicyApplicable:false,note:'Only effective dispatched main/semantic implementations count structurally; unused shadowed switch bodies do not count. Independent decoded review must group perceptually equivalent actions and verify at least30 meaningful mechanisms, no group used more than3times, depth, opening action and integrated generated motion.'}};
 const validation=await validateProject(project,projectPath,{checkFiles:false});if(!validation.valid)throw Error(validation.errors.join('\n'));
 await atomicJson(projectPath,project);
 const missing=[];for(const{src}of Object.values(inputs))if(!await exists(resolveSource(projectPath,src)))missing.push(src);
 progress('manifest-prepared',{projectPath,words:project.words.length,phrases:project.phrases.length,sections:sections.length,productionInputs:Object.keys(inputs).length,missingInputs:missing,ready:!missing.length});
 if(missing.length)process.exitCode=2;
 return project;
}

async function preflight(project){
 await sourceContract();const{data,html}=await compiledData(),plan=await read(path.join(projectDir,'scene-plan.json'));
 if(!html.includes(`data-composition-id="${COMPOSITION_ID}"`))throw Error('Compiled HyperFrames composition ID mismatch');
 const pkg=await read(path.join(projectDir,'package.json'));
 if(!['check','render'].every(k=>pkg.scripts?.[k]?.includes(`hyperframes@${HYPERFRAMES_VERSION}`)))throw Error('Pinned renderer version differs from review contract');
 const compiledWords=data.phrases.flatMap(p=>p.words.map(w=>({...w,phraseId:p.id})));
 if(data.duration!==DURATION||data.fps!==FPS||data.width!==WIDTH||data.height!==HEIGHT||data.phrases.length!==PHRASE_COUNT||!equal(identity(compiledWords),identity(project.words)))throw Error('Compiled format/duration/210 canonical words differ from review manifest');
 if(!equal(project.phrases.map(p=>[p.id,p.start,p.end,p.wordIds]),data.phrases.map(p=>[p.id,p.start,p.end,p.words.map(w=>w.id)])))throw Error('Compiled phrase identity/timing differs from review manifest');
 const declared=new Set(Object.values(project.productionInputs??{}).map(i=>i.src));
 const actual=await productionInputs(plan,data,html),missingBindings=Object.values(actual).map(i=>i.src).filter(src=>!declared.has(src));
 if(missingBindings.length)throw Error(`Inputs are not revision-bound; re-run --prepare: ${missingBindings.join(', ')}`);
 for(const src of declared)if(!await exists(resolveSource(projectPath,src)))throw Error(`Required custom input is missing: ${src}`);
 const ids=project.sections.flatMap(s=>s.wordIds);if(ids.length!==WORD_COUNT||new Set(ids).size!==WORD_COUNT||project.words.some(w=>!ids.includes(w.id)))throw Error('Review sections do not cover each canonical word exactly once');
 const choreography=await choreographyAudit(plan,data,html);if(!choreography.passed)throw Error(`Choreography structural audit failed: ${JSON.stringify(choreography)}`);
 return{data,plan,choreography,revision:await computeRevision(projectPath)};
}

async function main(){
 if(args.includes('--help')){console.log('Review only; no rendering or delivery. Modes: --prepare | --preflight | --capture-render-start | --capture-render-end | --check-review | (full review). Use --video PATH, --out DIR, and optional --audio-max-attempts N (1..3; default1). Full review runs bounded audio/OCR/temporal measurements and leaves independent visual review pending.');return}
 if(args.includes('--prepare')){await prepare();return}
 const{project}=await loadProject(projectPath),prepared=await preflight(project);
 if(args.includes('--preflight')){progress('preflight-passed',{words:WORD_COUNT,phrases:PHRASE_COUNT,expectedFrames:EXPECTED_FRAMES,uniqueFamilies:prepared.choreography.uniqueFamilies,maxUses:prepared.choreography.maxUses,effectiveProviders:prepared.choreography.effectiveImplementations.reduce((a,c)=>(a[c.provider]=(a[c.provider]??0)+1,a),{}),inactiveSwitchFamilies:prepared.choreography.inactiveSwitchFamilies,structuralOnly:true,meaningfulVariety:'pending_independent_encoded_review',boundInputs:prepared.revision.projectFiles.length-1,revisionHash:prepared.revision.revisionHash,sourceTiming:'166supported/44uncertain; not acceptance'});return}
 const renderStartPath=`${videoPath}.render-start.json`,renderMetadataPath=`${videoPath}.render.json`;
 if(args.includes('--capture-render-start')){
  await fs.mkdir(path.dirname(videoPath),{recursive:true});
  if(await exists(videoPath)||await exists(renderStartPath)||await exists(renderMetadataPath))throw Error('Movie or render provenance already exists; use a new versioned video pathname');
  const record={schemaVersion:1,kind:'hyperframes-render-start',projectPath,videoPath,capturedAt:new Date().toISOString(),sourceRevision:prepared.revision,expected:{duration:DURATION,fps:FPS,width:WIDTH,height:HEIGHT,frames:EXPECTED_FRAMES},renderer:`HyperFrames${HYPERFRAMES_VERSION}`};
  await atomicJson(renderStartPath,record);progress('render-start-captured',{renderStartPath,revisionHash:prepared.revision.revisionHash});return;
 }
 if(args.includes('--capture-render-end')){
  if(await exists(renderMetadataPath))throw Error('Render provenance already captured; use a new versioned movie for another render');
  const start=await read(renderStartPath),end=prepared.revision;
  if(start.projectPath!==projectPath||start.videoPath!==videoPath||start.sourceRevision?.revisionHash!==end.revisionHash)throw Error('Input bytes changed between render start and finish; refusing render provenance');
  const metadata={schemaVersion:1,kind:'hyperframes-render-provenance',sha256:await fileHash(videoPath),sourceRevision:start.sourceRevision,sourceRevisionEnd:end,duration:DURATION,fps:FPS,width:WIDTH,height:HEIGHT,frames:EXPECTED_FRAMES,renderStartedAt:start.capturedAt,renderEndedAt:new Date().toISOString(),renderer:`HyperFrames${HYPERFRAMES_VERSION}`,note:'Input snapshot captured before render and verified afterward. Encoding, audio, OCR, temporal and independent visual gates remain separate.'};
  await atomicJson(renderMetadataPath,metadata);progress('render-end-captured',{renderMetadataPath,videoSha256:metadata.sha256});return;
 }
 if(args.includes('--check-review')){const state=independentGate(await checkReview({reportPath:path.join(outDir,'review.json'),videoPath,projectPath}));progress('review-check',{passed:state.passed,status:state.status,reasons:state.reasons,quality:state.quality});process.exitCode=state.passed?0:2;return}

 await fs.mkdir(outDir,{recursive:true});
 const reportPath=path.join(outDir,'review.json');if(await exists(reportPath))throw Error('Review already exists; preserve evidence and use a new --out directory');
 const revision=prepared.revision,videoSha256=await fileHash(videoPath),binding={videoSha256,projectHash:revision.projectHash,rendererHash:revision.rendererHash,revisionHash:revision.revisionHash};
 const technical=[],check=(name,passed,observed,expected=null)=>technical.push({name,passed:!!passed,observed,expected});
 const started=new Date().toISOString();progress('review-start',{videoPath,words:WORD_COUNT});
 const{stdout}=await command('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',videoPath]);const probe=JSON.parse(stdout),v=probe.streams.find(s=>s.codec_type==='video'),a=probe.streams.filter(s=>s.codec_type==='audio');
 check('encodedFormat',v?.codec_name==='h264'&&v.width===WIDTH&&v.height===HEIGHT&&v.avg_frame_rate===`${FPS}/1`&&Number(v.nb_read_frames)===EXPECTED_FRAMES&&a.length===1&&a[0].codec_name==='aac',{video:v?.codec_name,width:v?.width,height:v?.height,fps:v?.avg_frame_rate,frames:v?.nb_read_frames,audioTracks:a.length,audioCodec:a[0]?.codec_name},{videoCodec:'h264',width:WIDTH,height:HEIGHT,fps:`${FPS}/1`,frames:EXPECTED_FRAMES,audioTracks:1,audioCodec:'aac'});
 check('encodedFullTimebase',Math.abs(Number(v?.start_time??0))<=1/FPS&&Math.abs(Number(v?.duration)-EXPECTED_FRAMES/FPS)<=1/FPS,{startTime:v?.start_time,duration:v?.duration},{startTime:0,duration:EXPECTED_FRAMES/FPS,tolerance:1/FPS});
 try{await command('ffmpeg',['-v','error','-xerror','-i',videoPath,'-map','0:v:0','-map','0:a:0','-f','null','-']);check('safeDecode',true,'All video/audio packets decoded')}catch(e){check('safeDecode',false,e.stderr??e.message)}
 const sourceAudio=resolveSource(projectPath,project.audio.src);
 try{const wave=compareWaveforms(await decodeAudio(sourceAudio,{sourceOffset:0,duration:DURATION}),await decodeAudio(videoPath));await atomicJson(path.join(outDir,'waveform.json'),{binding,sourceAudioSha256:await fileHash(sourceAudio),...wave});check('decodedAudioMatch',wave.correlation>=.985&&wave.minSegmentCorrelation>=.97&&Math.abs(wave.gainDb??Infinity)<=.75,{correlation:wave.correlation,minSegmentCorrelation:wave.minSegmentCorrelation,gainDb:wave.gainDb},{minCorrelation:.985,minSegmentCorrelation:.97,maxAbsoluteGainDb:.75});check('audioLag',Math.abs(wave.offsetSeconds)<=.035,{offsetSeconds:wave.offsetSeconds},{maxAbsoluteSeconds:.035});check('audioDuration',Math.abs(wave.encodedDuration-DURATION)<=.08&&Math.abs(wave.sourceDuration-DURATION)<=.08,{source:wave.sourceDuration,encoded:wave.encodedDuration},{expected:DURATION,tolerance:.08})}catch(e){check('decodedAudioMeasurements',false,e.message)}
 let metadata=null;try{metadata=await read(renderMetadataPath);check('renderOutputBinding',metadata.sha256===videoSha256,metadata.sha256,videoSha256);check('renderRevisionBinding',metadata.sourceRevision?.revisionHash===revision.revisionHash&&metadata.sourceRevisionEnd?.revisionHash===revision.revisionHash,{start:metadata.sourceRevision?.revisionHash,end:metadata.sourceRevisionEnd?.revisionHash},revision.revisionHash)}catch(e){check('renderProvenanceAvailable',false,e.message,'Pre-render and post-render snapshots required; no retroactive proof')}
 const mechanical=prepared.choreography;await atomicJson(path.join(outDir,'choreography-audit.json'),{binding,...mechanical});check('authoredChoreographyCoverage',mechanical.passed,mechanical,{minDistinctFamilies:30,maxUses:3,allPerformedPhrases:true});
 const jobs=await Promise.allSettled([
  (async()=>{progress('strict-audio-start',{maxAttempts:audioMaxAttempts,canonicalWords:WORD_COUNT});const report=await reviewAudio({projectPath,videoPath,outDir:path.join(outDir,'audio'),lyricsPath:resolveSource(projectPath,PERFORMANCE_LYRICS),repair:false,maxAttempts:audioMaxAttempts,threads:4,passTimeoutMs:180000});progress('strict-audio-complete',{status:report.status,verified:report.wordEvidence.filter(w=>w.passed).length,unsupported:report.wordEvidence.filter(w=>!w.supported).length});return report})(),
  (async()=>{progress('ocr-start',{requiredWords:WORD_COUNT});const report=await reviewLyricVisibility({projectPath,videoPath,outDir:path.join(outDir,'ocr'),nativeBatchSize:64});progress('ocr-complete',{status:report.status,coverage:report.coverage});return report})()
 ]);
 const audio=jobs[0].status==='fulfilled'?jobs[0].value:{status:'failed',error:jobs[0].reason?.message},ocr=jobs[1].status==='fulfilled'?jobs[1].value:{status:'failed',error:jobs[1].reason?.message};
 if(jobs[0].status==='rejected')await atomicJson(path.join(outDir,'audio-execution-failure.json'),{binding,...audio});if(jobs[1].status==='rejected')await atomicJson(path.join(outDir,'ocr-execution-failure.json'),{binding,...ocr});
 check('allCanonicalWordsSampled',ocr.coverage?.required===WORD_COUNT,ocr.coverage??ocr.error,{required:WORD_COUNT});check('encodedLyricVisibility',ocr.status==='passed',ocr.coverage??ocr.error,{requiredRatio:1});
 progress('temporal-start');let temporal;try{const r=await reviewTemporalActivity({videoPath,project,outDir:path.join(outDir,'temporal')});temporal={path:r.reportPath,sha256:await fileHash(r.reportPath),present:true,...await validateTemporalReport(r,{videoSha256,project}),report:r}}catch(e){temporal={required:true,present:false,passed:false,errors:[e.message]}}check('temporalActivity',temporal.passed,{errors:temporal.errors,intervals:temporal.report?.intervals},{maxStaticSeconds:4});
 const ending=await computeRevision(projectPath);check('unchangedDuringReview',ending.revisionHash===revision.revisionHash&&await fileHash(videoPath)===videoSha256,ending.revisionHash,revision.revisionHash);
 const report={schemaVersion:2,kind:'hyperframes-full-film-review-adapter',createdAt:started,reportPath,videoPath,projectPath,binding,revision,technical:{passed:technical.every(c=>c.passed),checks:technical,probe},evidence:{samples:(ocr.evidence??[]).map(f=>({time:f.time,path:f.path,sha256:f.sha256,reasons:['encoded-word-visibility']})),contactSheets:[],transitionStrips:[],note:'Actual encoded OCR samples; external independent visual critic also needs dense motion sequences, opening, transitions and all scene families.'},temporalActivity:temporal,renderProvenance:metadata?{path:renderMetadataPath,sha256:await fileHash(renderMetadataPath),verified:technical.filter(c=>c.name.startsWith('render')).every(c=>c.passed)}:{verified:false},visual:{status:'pending',threshold:8,rubric:VISUAL_RUBRIC,reviews:[],note:'Independent visual judgment required. This adapter never creates reviewer scores or claims hearing.'},machineAudio:audio.reportPath?{path:audio.reportPath,sha256:await fileHash(audio.reportPath),status:audio.status}:audio,lyricVisibility:{status:ocr.status,coverage:ocr.coverage,reportPath:ocr.reportPath},choreography:mechanical,sourceTimingPreparation:{sourceSupportCount:project.sourceAlignment.summary.sourceSupported,unsupported:project.sourceAlignment.summary.unsupported,wordCount:WORD_COUNT,status:'not_encoded_acceptance'},limitations:['Strict audio failures remain failures; good PCM correlation, source estimates and OCR cannot approve unsupported lyric sync.','Family IDs and implementation mapping are structural, not proof of meaningful visual variety.','Temporal pixel activity can be satisfied by texture without meaningful choreography.','No claim of artistic acceptance until independent review of exact encoded output is recorded.'],status:'pending-gauntlet-check'};
 await atomicJson(reportPath,report);const state=independentGate(await checkReview({reportPath,videoPath,projectPath,audioReviewPath:audio.reportPath}));await atomicJson(path.join(outDir,'gate.json'),{passed:state.passed,status:state.status,reasons:state.reasons,quality:state.quality,binding});report.status=state.status;report.quality=state.quality;report.completedAt=new Date().toISOString();await atomicJson(reportPath,report);progress('review-complete',{reportPath,status:state.status,strictAudioStatus:audio.status,ocrCoverage:ocr.coverage,technicalPassed:report.technical.passed,independentVisualReview:'pending'});process.exitCode=state.passed?0:2;
}
await main();
