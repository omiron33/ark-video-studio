import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {planReviewBatches,fingerprintFrames,validateBatchReport,reviewFullSong} from '../engine/fullsong-review.mjs';
import {applyDirection,VISUAL_CATEGORIES} from '../engine/director.mjs';
import {computeRevision,sha256File,validateMachineVisualReport} from '../engine/gauntlet.mjs';
import {atomicJson} from '../engine/project.mjs';
import {runProcess} from '../engine/export.mjs';

const scores=Object.fromEntries(VISUAL_CATEGORIES.map(k=>[k,8]));
function fixture(){return {version:1,id:'batch-test',title:'Review control-flow fixture',width:320,height:180,fps:30,duration:3,audio:{src:'audio.wav',offset:0},assets:{},beats:[],words:[0,1,2].map(i=>({id:`w${i}`,text:['FIRST','SECOND','THIRD'][i],start:i+.1,end:i+.5})),sections:[0,1,2].map(i=>({id:`s${i}`,style:'impact',start:i,end:i+1,wordIds:[`w${i}`],assetIds:[],direction:{},seed:i}))};}
async function setup(t){const dir=await mkdtemp(path.join(os.tmpdir(),'ark-full-review-'));t.after(()=>rm(dir,{recursive:true,force:true}));await writeFile(path.join(dir,'audio.wav'),'test-only source');await writeFile(path.join(dir,'film.mp4'),'test-only video; decoding service mocked');const projectPath=path.join(dir,'project.json');await atomicJson(projectPath,fixture());return {dir,projectPath,videoPath:path.join(dir,'film.mp4'),outDir:path.join(dir,'review')};}
async function bound(projectPath,videoPath){const r=await computeRevision(projectPath);return {videoSha256:await sha256File(videoPath),projectHash:r.projectHash,rendererHash:r.rendererHash,revisionHash:r.revisionHash};}
function mockServices(counter,{failed=false,mutate}={}){return {
  modelIdentity:async()=>({model:'explicit-test-only-reviewer',digest:'fixture-checkpoint',endpoint:'test-only'}),
  fingerprintFrames:async(p,b)=>{counter.fingerprints++;return {sha256:`fixture-pixels-${b.startFrame}-${b.endFrame}`,frames:b.endFrame-b.startFrame,startFrame:b.startFrame,endFrame:b.endFrame,fps:b.fps,pixelFormat:'rgb24'};},
  reviewVisual:async({projectPath,videoPath,outDir,sectionIds})=>{
    counter.reviews++;const p=JSON.parse(await readFile(projectPath)),binding=await bound(projectPath,videoPath),wordIds=[...new Set(p.sections.filter(s=>sectionIds.includes(s.id)).flatMap(s=>s.wordIds))];
    await mkdir(outDir,{recursive:true});const image=path.join(outDir,'test-only-evidence.txt');await writeFile(image,'NOT REAL VISUAL ACCEPTANCE: explicit unit-test mock');const evidence=[{path:image,sha256:await sha256File(image),time:p.sections.find(s=>s.id===sectionIds[0]).start}];
    const ocrPath=path.join(outDir,'ocr.json');await atomicJson(ocrPath,{kind:'machine-lyric-visibility-section',scope:{wordIds},binding,status:'passed',checks:[{id:'test-only',passed:true}],wordCoverage:wordIds.map(id=>({id,observed:true})),evidence});
    const report={schemaVersion:1,kind:'machine-visual-section-review',method:'local-vision-model',model:'explicit-test-only-reviewer',binding,scope:{sectionIds,wordIds,timebase:'project',complete:false},status:failed?'failed':'passed',scores:failed?{...scores,composition:7}:scores,scenes:sectionIds.map(id=>({id,passed:!failed,scores:failed?{...scores,composition:7}:scores,evidence:{frames:evidence}})),issues:failed?[{section:sectionIds[0],issue:'Test-only failing score'}]:[],limitations:['Mocked solely to test orchestration; never a production acceptance report'],evidence,lyricVisibility:{status:'passed',coverage:{required:wordIds.length,observed:wordIds.length,ratio:1,unresolved:[]},reportPath:ocrPath}};
    if(mutate)await mutate(projectPath);return report;
  },
  checkReview:async()=>({passed:!failed,status:failed?'machine_visual_review_failed':'machine_verified',reasons:failed?['test-only failure']:[],quality:{technicalVerified:true,machineAudioVerified:true,machineVisualVerified:!failed},report:{renderProvenance:{verified:true}}}),
  reviewVideo:async()=>{throw Error('Existing technical gate expected in unit fixture');}
};}

test('batches cover all sections and canonical words, keep absolute time and boundary context',()=>{
 const p=fixture();p.words[1].start=.98;const before=structuredClone(p),b=planReviewBatches(p,{batchSize:1});
 assert.deepEqual(b.flatMap(x=>x.sectionIds),['s0','s1','s2']);assert.deepEqual(b.flatMap(x=>x.wordIds),['w0','w1','w2']);assert.ok(b[1].startFrame<30);assert.ok(b[1].endFrame>60);assert.equal(b[2].endFrame,90);assert.deepEqual(p,before);
 assert.throws(()=>planReviewBatches(p,{batchSize:0}));p.words.push({id:'orphan',text:'Lost',start:1,end:2});assert.throws(()=>planReviewBatches(p),/Every lyric/);
});

test('authored story style, mode and roles survive direction and cannot become a generic scene',()=>{
 const p=fixture();p.sections[0].style='story';p.sections[0].direction={mode:'door',roles:{hero:'w0'}};
 const proposal={id:'s0',style:'story',motif:'rays',scale:1,accent:'#ffcc66'};
 const result=applyDirection(p,{sections:[proposal]});assert.deepEqual(result.sections[0].direction.roles,{hero:'w0'});assert.equal(result.sections[0].direction.mode,'door');
 assert.throws(()=>applyDirection(p,{sections:[{...proposal,style:'impact'}]}),/must be preserved/);
 assert.throws(()=>applyDirection(fixture(),{sections:[proposal]}),/authored word roles/);
});

test('pending batches cannot pass; resume reuses evidence before extraction and finishes complete coverage',async t=>{
 const f=await setup(t),counter={reviews:0,fingerprints:0},svc=mockServices(counter),opts={...f,batchSize:1,maxBatches:1};
 const first=await reviewFullSong(opts,svc);assert.equal(first.status,'pending');assert.equal(first.completedBatches,1);assert.deepEqual(first.pendingBatches,['batch-002','batch-003']);
 const second=await reviewFullSong({...opts,maxBatches:3},svc);assert.equal(second.status,'passed');assert.equal(counter.reviews,3);assert.equal(counter.fingerprints,3);assert.equal(second.batches[0].cacheHit,true);
 const third=await reviewFullSong({...opts,maxBatches:3},svc);assert.equal(third.status,'passed');assert.equal(counter.reviews,3);assert.equal(counter.fingerprints,3);
 const full=JSON.parse(await readFile(third.visualReviewPath));assert.equal(full.scope.complete,true);assert.equal(full.scenes.length,3);assert.equal(full.lyricVisibility.coverage.observed,3);
 const batch=JSON.parse(await readFile(third.batches[0].reviewPath));assert.equal(validateMachineVisualReport(batch,third.binding).passed,false);
});

test('unchanged pixels rebind only matching scene context after an isolated edit',async t=>{
 const f=await setup(t),counter={reviews:0,fingerprints:0},svc=mockServices(counter);await reviewFullSong({...f,batchSize:1},svc);
 const p=JSON.parse(await readFile(f.projectPath));p.sections[1].direction.accent='#ffcc66';await atomicJson(f.projectPath,p);await writeFile(f.videoPath,'new full container in unit test; pixels service unchanged');
 const r=await reviewFullSong({...f,batchSize:1},svc);assert.equal(counter.reviews,4);assert.equal(r.batches[0].rebound,true);assert.equal(r.batches[1].cacheHit,false);assert.equal(r.batches[2].rebound,true);
 // Repeated rebind retains the true source binding of the native OCR evidence.
 p.sections[1].direction.accent='#ccccff';await atomicJson(f.projectPath,p);await writeFile(f.videoPath,'third container');const again=await reviewFullSong({...f,batchSize:1},svc);assert.equal(again.status,'passed');assert.equal(counter.reviews,5);
});

test('tampered evidence is regenerated and stale or fabricated partial coverage is refused',async t=>{
 const f=await setup(t),counter={reviews:0,fingerprints:0},svc=mockServices(counter),r=await reviewFullSong({...f,batchSize:1},svc);
 const b=JSON.parse(await readFile(r.batches[0].reviewPath));await writeFile(b.evidence[0].path,'corrupted');await reviewFullSong({...f,batchSize:1},svc);assert.equal(counter.reviews,4);
 const batch=planReviewBatches(fixture(),{batchSize:1})[0];await assert.rejects(validateBatchReport({...b,scope:{...b.scope,wordIds:[]}},batch,r.binding,{verifyFiles:false}),/scope/);
 await assert.rejects(validateBatchReport({...b,binding:{...b.binding,videoSha256:'wrong'}},batch,r.binding,{verifyFiles:false}),/stale/);
 await assert.rejects(validateBatchReport({...b,scenes:[]},batch,r.binding,{verifyFiles:false}),/coverage/);
});

test('valid low scores stay failed and source changes during review cannot finish',async t=>{
 const f=await setup(t),counter={reviews:0,fingerprints:0},svc=mockServices(counter,{failed:true});let r=await reviewFullSong({...f,batchSize:1},svc);assert.equal(r.status,'failed');assert.equal(r.failedBatches.length,3);r=await reviewFullSong({...f,batchSize:1},svc);assert.equal(counter.reviews,3);assert.equal(r.status,'failed');
 const g=await setup(t),c={reviews:0,fingerprints:0};await assert.rejects(reviewFullSong({...g,batchSize:3},mockServices(c,{mutate:async p=>{const v=JSON.parse(await readFile(p));v.title+=' modified';await atomicJson(p,v);}})),/Inputs changed/);
});

test('actual encoded-frame fingerprint is frame-exact and detects changed interval pixels',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'ark-frame-fingerprint-'));t.after(()=>rm(dir,{recursive:true,force:true}));const video=path.join(dir,'color.mkv');
 await runProcess('ffmpeg',['-v','error','-f','lavfi','-i','color=red:s=32x32:r=30:d=1','-f','lavfi','-i','color=blue:s=32x32:r=30:d=1','-filter_complex','[0:v][1:v]concat=n=2:v=1:a=0[v]','-map','[v]','-c:v','ffv1',video]);
 const a=await fingerprintFrames(video,{startFrame:0,endFrame:30,fps:30}),b=await fingerprintFrames(video,{startFrame:30,endFrame:60,fps:30});assert.equal(a.frames,30);assert.equal(b.frames,30);assert.notEqual(a.sha256,b.sha256);assert.deepEqual(a,await fingerprintFrames(video,{startFrame:0,endFrame:30,fps:30}));
 await assert.rejects(fingerprintFrames(video,{startFrame:50,endFrame:65,fps:30}),/10\/15/);
});

test('native scoped OCR uses late absolute times and does not approve missing lyrics outside its scope', {skip:process.platform!=='darwin',timeout:180000},async t=>{
 const {createCanvas}=await import('@napi-rs/canvas'),{reviewLyricVisibility}=await import('../engine/ocr.mjs');
 const dir=await mkdtemp(path.join(os.tmpdir(),'ark-scope-ocr-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const canvas=createCanvas(640,360),ctx=canvas.getContext('2d');ctx.fillStyle='#071e24';ctx.fillRect(0,0,640,360);ctx.fillStyle='#ffffff';ctx.font='bold 86px Arial';ctx.textAlign='center';ctx.fillText('LIGHT',320,210);
 const png=path.join(dir,'painted.png'),video=path.join(dir,'actual.mp4'),projectPath=path.join(dir,'project.json');await writeFile(png,canvas.toBuffer('image/png'));
 await runProcess('ffmpeg',['-v','error','-loop','1','-i',png,'-t','2','-r','30','-c:v','libx264','-pix_fmt','yuv420p',video]);
 const p={fps:30,width:640,height:360,duration:2,words:[{id:'missing',text:'UNPAINTED',start:.1,end:.5},{id:'late',text:'LIGHT',start:1.3,end:1.7}],sections:[{id:'early',start:0,end:1,wordIds:['missing'],direction:{}},{id:'late-section',start:1,end:2,wordIds:['late'],direction:{}}]};await atomicJson(projectPath,p);
 const scoped=await reviewLyricVisibility({projectPath,videoPath:video,outDir:path.join(dir,'late'),wordIds:['late']});
 assert.equal(scoped.status,'passed');assert.equal(scoped.kind,'machine-lyric-visibility-section');assert.deepEqual(scoped.wordCoverage.map(w=>w.id),['late']);assert.ok(scoped.evidence.every(e=>e.time>=1.3));assert.equal(scoped.scope.complete,false);
 const empty=await reviewLyricVisibility({projectPath,videoPath:video,outDir:path.join(dir,'empty'),wordIds:[]});assert.equal(empty.status,'passed');assert.equal(empty.coverage.required,0);assert.equal(empty.scope.complete,false);
 await assert.rejects(reviewLyricVisibility({projectPath,videoPath:video,outDir:path.join(dir,'bad'),wordIds:['unknown']}),/unique existing words/);
});

test('final completion still requires full-film render provenance and the original audio gate',async t=>{
 const f=await setup(t),counter={reviews:0,fingerprints:0},svc=mockServices(counter);
 svc.checkReview=async()=>({passed:true,status:'machine_verified',reasons:[],quality:{technicalVerified:true,machineAudioVerified:true},report:{renderProvenance:{verified:false}}});
 const r=await reviewFullSong({...f,batchSize:3},svc);assert.equal(r.status,'failed');assert.equal(r.gate.status,'render_provenance_required');
 svc.checkReview=async()=>({passed:false,status:'machine_audio_review_required',reasons:['No actual full-film audio review'],quality:{technicalVerified:true,machineAudioVerified:false},report:{renderProvenance:{verified:true}}});
 const next=await reviewFullSong({...f,batchSize:3},svc);assert.equal(next.status,'failed');assert.equal(next.gate.status,'machine_audio_review_required');assert.equal(counter.reviews,1);
});
