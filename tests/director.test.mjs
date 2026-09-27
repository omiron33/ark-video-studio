import test from 'node:test';
import assert from 'node:assert/strict';
import {applyDirection,localChat,captureSceneEvidence,structuredResponse,directProject,proposeVisualRepair} from '../engine/director.mjs';
import {createServer} from 'node:http';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {runProcess} from '../engine/export.mjs';

const project={words:[{id:'a',text:'Light',start:1,end:2}],sections:[{id:'s',style:'verse',start:0,end:3,wordIds:['a'],assetIds:[],direction:{},seed:1}]};
const change={id:'s',style:'impact',motif:'rays',scale:.9,accent:'#ecc57a',reason:'Light radiates around the word'};
test('director preserves exact lyric timing and IDs while applying scene language',()=>{
 const p=applyDirection(project,{sections:[{...change,words:[{text:'WRONG'}]}]});
 assert.deepEqual(p.words,project.words);assert.deepEqual(p.sections[0].wordIds,['a']);assert.equal(p.sections[0].style,'impact');assert.equal(p.sections[0].direction.motif,'rays');assert.equal(project.sections[0].style,'verse');
});
test('director refuses unsupported roles, invalid sizes, colors and scene IDs',()=>{
 for(const patch of [{style:'submerge'},{scale:100},{accent:'transparent'},{id:'missing'},{motif:'javascript'}])assert.throws(()=>applyDirection(project,{sections:[{...change,...patch}]}));
});
test('a failed review with an unchanged repair requests one actionable alternative without altering lyrics',async()=>{
 const p=applyDirection(project,{sections:[change]});let calls=0;
 const result=await proposeVisualRepair({project:p,scene:{id:'s',repair:change,issues:['Rays distract from the word']},chat:async()=>{calls++;return {result:{sections:[{...change,motif:'contours'}]},provider:{method:'test-only'}}}});
 assert.equal(calls,1);assert.equal(result.changed,true);assert.equal(result.replacement.direction.motif,'contours');assert.equal(result.attempts.length,2);assert.deepEqual(p.words,project.words);
});
test('two unchanged repair proposals remain a failure, and invalid ranges are normalized transparently',async()=>{
 const p=applyDirection(project,{sections:[change]});
 const result=await proposeVisualRepair({project:p,scene:{id:'s',repair:change,issues:['Observed defect']},chat:async()=>({result:{sections:[change]},provider:{method:'test-only'}})});
 assert.equal(result.changed,false);assert.match(result.attempts[1].error,/nothing/);
 const bounded=await proposeVisualRepair({project:p,scene:{id:'s',repair:{...change,scale:12},issues:['Type too small']},chat:async()=>{throw Error('Should not call model')}});
 assert.equal(bounded.changed,true);assert.equal(bounded.replacement.direction.scale,1.1);assert.equal(bounded.corrections[0].from,12);
});
test('home director refuses a cloud model instead of silently spending remotely',async()=>{
 await assert.rejects(localChat({messages:[],model:'qwen3-vl:235b-cloud'}),/excluded/);
});
test('planning and visual evidence share one context profile to avoid runner reloads',async t=>{
 const contexts=[];const server=createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;contexts.push(JSON.parse(body).options.num_ctx);res.end(JSON.stringify({done_reason:'stop',message:{content:'{}'}}))});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const endpoint=`http://127.0.0.1:${server.address().port}`;
 await localChat({endpoint,messages:[{role:'user',content:'Plan'}]});
 await localChat({endpoint,messages:[{role:'user',content:'Review',images:['fixture-image']}]});
 assert.deepEqual(contexts,[32768,32768]);
});
test('Ollama structured JSON in the Qwen thinking field is accepted only as a complete object',()=>{
 assert.deepEqual(structuredResponse({done_reason:'stop',message:{content:'',thinking:'{"scores":{"composition":8}}'}}).result,{scores:{composition:8}});
 assert.throws(()=>structuredResponse({done_reason:'length',message:{content:'',thinking:'{"score":8}'}}));
 assert.throws(()=>structuredResponse({done_reason:'stop',message:{content:'',thinking:'I think this deserves eight.'}}));
});
test('malformed model output retries once with a larger budget and preserves failure evidence',async t=>{
 const budgets=[];const server=createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;budgets.push(JSON.parse(body).options.num_predict);res.end(JSON.stringify(budgets.length===1?{done_reason:'length',eval_count:2200,message:{thinking:'{"unfinished":'}}:{done_reason:'stop',message:{content:'{"reason":"Actual complete response"}'}}))});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const result=await localChat({endpoint:`http://127.0.0.1:${server.address().port}`,messages:[{role:'user',content:'Review'}]});
 assert.deepEqual(budgets,[2200,4400]);assert.equal(result.provider.attempts.length,1);assert.equal(result.provider.attempts[0].stopReason,'length');assert.equal(result.result.reason,'Actual complete response');
});
test('encoded frame evidence includes the last 30fps frame without rounding past EOF',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'ark-vision-evidence-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const video=path.join(dir,'sample.mp4');await runProcess('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:s=320x180:r=30:d=1','-c:v','libx264','-pix_fmt','yuv420p',video]);
 const section={id:'last',start:0,end:1,wordIds:[],direction:{},style:'verse'};
 const evidence=await captureSceneEvidence({duration:1,fps:30,words:[]},section,video,dir);
 assert.ok(evidence.frames.some(f=>f.time>.96));for(const f of evidence.frames)assert.ok((await stat(f.path)).size>0);
 assert.ok((await stat(evidence.contactPath)).size>0);
});
test('long-song direction uses bounded batches and preserves the complete timing map',async t=>{
 const requests=[];const server=createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;const input=JSON.parse(body),brief=JSON.parse(input.messages[1].content);requests.push(brief.scenes.length);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({done_reason:'stop',message:{content:JSON.stringify({summary:'Explicit test-only director',sections:brief.scenes.map(s=>({id:s.id,style:'impact',motif:'rays',scale:1,accent:'#e77951',reason:'Fixture'}))})}}))});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const p={version:1,id:'batch',title:'Batch fixture',width:1920,height:1080,fps:30,duration:12,audio:{src:'unused.wav',offset:0},assets:{},beats:[],words:[],sections:[]};
 for(let i=0;i<12;i++){p.words.push({id:`w${i}`,text:'Light',start:i+.1,end:i+.8});p.sections.push({id:`s${i}`,start:i,end:i+1,style:'verse',wordIds:[`w${i}`],assetIds:[],direction:{},seed:i})}
 const result=await directProject({project:p,stylePrompt:'Radiant graphic words',endpoint:`http://127.0.0.1:${server.address().port}`,model:'explicit-test-service'});
 assert.deepEqual(requests,[8,4]);assert.deepEqual(result.project.words,p.words);assert.equal(result.project.sections.length,12);assert.ok(result.project.sections.every(s=>s.style==='impact'));
});
