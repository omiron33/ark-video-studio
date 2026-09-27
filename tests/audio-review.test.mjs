import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { compareWaveforms, extractOnsets, alignLexicalWords, assessWordEvidence, cachedAudioPass } from '../engine/audio-review.mjs';
import { digest, fileHash } from '../engine/project.mjs';

function signal(seconds=4,rate=8000){const a=new Float32Array(seconds*rate);for(let i=0;i<a.length;i++){const t=i/rate;a[i]=(.12+.08*Math.sin(t*1.73))*Math.sin(2*Math.PI*(130*t+30*t*t))+.04*Math.sin(2*Math.PI*317*t);}return a;}

test('decoded waveform comparison measures sample lag and gain through small codec-like noise',()=>{
  const original=signal(),encoded=new Float32Array(original.length+96);
  for(let i=0;i<original.length;i++)encoded[i+96]=original[i]*.98+.0002*Math.sin(i*1.37);
  const result=compareWaveforms(original,encoded);
  assert.equal(result.offsetSeconds,.012);
  assert.ok(result.correlation>.9999);
  assert.ok(Math.abs(result.gainDb-20*Math.log10(.98))<.002);
  assert.equal(result.encodedDuration,4.012);
});

test('waveform review catches a replaced audio section despite matching total duration',()=>{
  const original=signal(),encoded=original.slice();
  for(let i=16000;i<24000;i++)encoded[i]=Math.sin(i*1.91)*.1;
  const result=compareWaveforms(original,encoded);
  assert.ok(result.correlation<.985);
  assert.ok(result.minSegmentCorrelation<.97);
});

test('measured onset extraction follows real attacks without filling a tempo grid',()=>{
  const rate=16000,a=new Float32Array(rate*3);
  for(const start of [.5,1.5])for(let i=Math.round(start*rate);i<(start+.12)*rate;i++)a[i]=Math.sin(i*2*Math.PI*220/rate)*.4;
  const events=extractOnsets(a,{sampleRate:rate,sourceOffset:10});
  assert.ok(events.some(e=>Math.abs(e.time-10.5)<.04));
  assert.ok(events.some(e=>Math.abs(e.time-11.5)<.04));
  assert.ok(events.length<5);
  assert.ok(events.every(e=>e.kind==='measured_onset'&&e.provenance.tempoGrid===false));
  assert.deepEqual(extractOnsets(new Float32Array(rate)),[]);
});

test('independent phrase matching accepts punctuation but exposes a wrong lyric',()=>{
  const expected=[{text:'Disappeared'},{text:'below.'}];
  assert.equal(alignLexicalWords(expected,[{text:'disappeared'},{text:'below'}]).similarity,1);
  const wrong=alignLexicalWords(expected,[{text:'disappeared'},{text:'blue'}]);
  assert.equal(wrong.similarity,.5);assert.equal(wrong.matches[1],null);
});

test('acoustic evidence repairs the known pause-absorption failure while preserving measured confidence',()=>{
  const expected=[{id:'the',text:'The',start:.65,end:1.3},{id:'below',text:'below.',start:7.86,end:8.54}];
  const acoustic=[{text:'The',start:1.242,end:1.323,provenance:{tokenProbability:.992}},{text:'below.',start:8.156,end:8.537,provenance:{tokenProbability:.352}}];
  const encoded=acoustic.map(w=>({...w,start:w.start+.02,end:w.end+.02}));
  const recognized=[[{text:'The',start:0,end:1.3},{text:'below',start:7.99,end:8.53}],[{text:'The',start:.65,end:1.31},{text:'blue',start:7.99,end:8.53}]];
  const result=assessWordEvidence(expected,acoustic,encoded,recognized);
  assert.ok(result.every(w=>w.supported&&!w.passed));
  assert.equal(result[0].repair.start,1.242);
  assert.equal(result[1].acousticConfidence,.352);
  assert.ok(result[1].crossModelBoundaryDelta<.01);
});

test('uncorroborated or weak acoustic boundaries fail instead of becoming self-approved repairs',()=>{
  const expected=[{id:'x',text:'waters',start:1,end:1.5}];
  const weak=[{text:'waters',start:1.5,end:2,provenance:{tokenProbability:.05}}];
  const recognized=[[{text:'waters',start:1.5,end:2}]];
  assert.equal(assessWordEvidence(expected,weak,weak,recognized)[0].supported,false);
  const good=weak.map(w=>({...w,provenance:{tokenProbability:.9}}));
  assert.equal(assessWordEvidence(expected,good,good,[[]])[0].supported,false);
  assert.equal(assessWordEvidence(expected,good,good.map(w=>({...w,start:w.start+.5})),recognized)[0].supported,false);
});

test('small early cues are corrected to supported acoustic intervals, including cues within the gate tolerance',()=>{
  const acoustic=[{text:'rose',start:1.703407,end:1.923848,provenance:{tokenProbability:.951499}}];
  const early=[{id:'rose',text:'rose',start:1.6,end:1.9}];
  const evidence=assessWordEvidence(early,acoustic,acoustic,[acoustic])[0];
  assert.equal(evidence.passed,false);
  assert.equal(evidence.repair.start,1.703407);
  const withinTolerance=[{...early[0],start:1.683407,end:1.913848}];
  const precise=assessWordEvidence(withinTolerance,acoustic,acoustic,[acoustic])[0];
  assert.equal(precise.passed,true);
  assert.deepEqual(precise.repair,{id:'rose',start:1.703407,end:1.923848,previousStart:1.683407,previousEnd:1.913848});
});

const cacheIdentity=()=>({schemaVersion:1,audio:{sha256:digest('actual PCM'),format:'mono-s16le-16000',samples:16000},offset:0,duration:1,model:{path:'/local/model.pt',sha256:digest('model bytes')},backend:'openai-whisper',task:'transcribe',lyrics:null,alignCodeHash:digest('aligner code'),runtime:{python:'3.14',packages:{torch:'2.10.0'}},settings:{language:'en',threads:4,device:'cpu',relaxedSpeech:false}});
const passResult=identity=>({version:1,timebase:'source',status:'machine_estimate',task:identity.task,source:{backend:identity.backend,model:identity.model.path,language:identity.settings.language,offset:identity.offset,duration:identity.duration},words:[{id:'word',text:identity.lyrics??'waters',start:identity.offset+.1,end:identity.offset+.5,provenance:{tokenProbability:.9}}]});

test('persistent audio cache survives a new review directory and invalidates audio, window, model bytes, lyrics and runtime',async t=>{
  const folder=await mkdtemp(path.join(tmpdir(),'ark-audio-cache-'));t.after(()=>rm(folder,{recursive:true,force:true}));
  const model=path.join(folder,'model.pt');await writeFile(model,'first model');
  const identity=cacheIdentity();identity.model={path:model,sha256:await fileHash(model)};
  let generated=0;
  const request=async value=>cachedAudioPass({cacheDir:path.join(folder,'.review-cache','audio'),identity:value,generate:async()=>{generated++;return passResult(value);}});
  const cold=await request(identity);assert.equal(cold.cacheHit,false);
  const warm=await request(structuredClone(identity));assert.equal(warm.cacheHit,true);assert.equal(generated,1);assert.equal(warm.resultSha256,cold.resultSha256);
  const changed=[
    {...identity,audio:{...identity.audio,sha256:digest('changed PCM')}},
    {...identity,offset:.25},
    {...identity,duration:2},
    {...identity,alignCodeHash:digest('changed aligner')},
    {...identity,runtime:{...identity.runtime,python:'3.15'}},
    {...identity,settings:{...identity.settings,relaxedSpeech:true}},
    {...identity,task:'force-align',lyrics:'waters'},
    {...identity,task:'force-align',lyrics:'rivers'},
  ];
  await writeFile(model,'other model');changed.push({...identity,model:{path:model,sha256:await fileHash(model)}});
  for(const value of changed)assert.equal((await request(value)).cacheHit,false);
  assert.equal(generated,10);
});

test('malformed, failed, mutated or out-of-window cached results never become accepted evidence',async t=>{
  const cacheDir=await mkdtemp(path.join(tmpdir(),'ark-audio-bad-cache-'));t.after(()=>rm(cacheDir,{recursive:true,force:true}));
  const identity=cacheIdentity();let generated=0;
  const request=()=>cachedAudioPass({cacheDir,identity,generate:async()=>{generated++;return passResult(identity);}});
  const first=await request(),valid=JSON.parse(await readFile(first.entryPath,'utf8'));
  const invalid=[
    '{broken JSON',
    JSON.stringify({...valid,result:{...valid.result,status:'unresolved'}}),
    JSON.stringify({...valid,identity:{...identity,duration:8}}),
    JSON.stringify({...valid,resultSha256:'0'.repeat(64)}),
  ];
  const negative=structuredClone(valid);negative.result.words[0].start=-1;negative.resultSha256=digest(negative.result);invalid.push(JSON.stringify(negative));
  const wrongLyrics=structuredClone(valid);wrongLyrics.result.words[0].provenance.tokenProbability=null;wrongLyrics.resultSha256=digest(wrongLyrics.result);invalid.push(JSON.stringify(wrongLyrics));
  for(const raw of invalid){await writeFile(first.entryPath,raw);const result=await request();assert.equal(result.cacheHit,false);assert.equal(result.rejectedEntry,true);}
  assert.equal(generated,invalid.length+1);
  const failedIdentity={...identity,audio:{...identity.audio,sha256:digest('new input')}};
  await assert.rejects(cachedAudioPass({cacheDir,identity:failedIdentity,generate:async()=>({status:'unresolved',words:[],reason:'No acoustic support'})}),/No acoustic support/);
  await assert.rejects(readFile(path.join(cacheDir,`${digest(failedIdentity)}.json`)),{code:'ENOENT'});
});

test('partial recognition is explicit official-only diagnostic evidence and cannot enter audio-only or forced caches',async t=>{
  const cacheDir=await mkdtemp(path.join(tmpdir(),'ark-partial-cache-'));t.after(()=>rm(cacheDir,{recursive:true,force:true}));
  const identity={...cacheIdentity(),duration:3,settings:{...cacheIdentity().settings,partialRecognition:true,partialRecognitionCodeSha256:digest('recovery code')}};
  const partial={...passResult(identity),status:'partial_recognition',rawWordCount:20,omittedInvalidWords:[{index:3,text:'missing',rawStart:.3,rawEnd:.3,reason:'Zero duration'}],words:Array.from({length:19},(_,i)=>({id:`p${i}`,text:`token${i}`,start:i*.1,end:i*.1+.05,provenance:{tokenProbability:.8}}))};
  const first=await cachedAudioPass({cacheDir,identity,generate:async()=>partial});assert.equal(first.cacheHit,false);assert.equal(first.result.words.length,19);assert.equal(first.result.omittedInvalidWords[0].text,'missing');
  assert.equal((await cachedAudioPass({cacheDir,identity,generate:async()=>{throw Error('Should reuse validated evidence');}})).cacheHit,true);
  for(const invalidIdentity of [{...identity,settings:cacheIdentity().settings},{...identity,task:'force-align',lyrics:'known lyrics'}])await assert.rejects(cachedAudioPass({cacheDir,identity:invalidIdentity,generate:async()=>partial}),/invalid evidence/);
  for(const corrupt of [{...partial,rawWordCount:19},{...partial,omittedInvalidWords:[...partial.omittedInvalidWords,{index:4,text:'other'}],rawWordCount:21},{...partial,words:partial.words.map(w=>({...w,text:'N'}))}]){
    const different={...identity,audio:{...identity.audio,sha256:digest(corrupt)}};await assert.rejects(cachedAudioPass({cacheDir,identity:different,generate:async()=>corrupt}),/invalid evidence/);
  }
});
