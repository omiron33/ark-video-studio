import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {applyDirection,directProject} from '../engine/director.mjs';
import {CHOREOGRAPHY_CATALOG} from '../engine/story-visual.mjs';

const ids=Object.keys(CHOREOGRAPHY_CATALOG);
const proposal=(id='s0',patch={})=>({id,style:'story',motif:'contours',scale:1,accent:'#ee4455',reason:'Follow the sung words through a spatial scene.',choreography:ids[0],...patch});
function fixture(count=1){
 const words=Array.from({length:count},(_,i)=>({id:`w${i}`,text:'Brother',start:i+.1,end:i+.8,provenance:{method:'unchanged-fixture'}}));
 return {version:1,id:'choreography-direction',title:'Direction fixture',width:1920,height:1080,fps:30,duration:count,audio:{src:'unused.wav',offset:0},assets:{photo:{type:'image',src:'unchanged.png'}},beats:[{time:.2,strength:1,kind:'measured'}],words,sections:words.map((w,i)=>({id:`s${i}`,start:i,end:i+1,style:'verse',wordIds:[w.id],assetIds:['photo'],direction:{photo:'photo',pan:-1,fontFamily:'Archivo Black'},seed:i}))};
}

test('explicit catalog choreography upgrades generic styles while preserving audio, photographs and canonical times',()=>{
 for(const style of ['verse','impact','orbit']){
  const p=fixture();p.sections[0].style=style;const before=structuredClone(p);
  const result=applyDirection(p,{sections:[proposal('s0',{style})]});
  assert.equal(result.sections[0].style,'story');assert.equal(result.sections[0].direction.choreography,ids[0]);
  assert.deepEqual(result.words,p.words);assert.deepEqual(result.beats,p.beats);assert.deepEqual(result.audio,p.audio);
  assert.deepEqual(result.assets,p.assets);assert.deepEqual(result.sections[0].assetIds,['photo']);
  assert.equal(result.sections[0].direction.photo,'photo');assert.equal(result.sections[0].direction.pan,-1);
  assert.equal(result.sections[0].start,p.sections[0].start);assert.equal(result.sections[0].end,p.sections[0].end);
  assert.deepEqual(p,before);assert.equal(result.creation,undefined,'no mandatory policy is introduced to legacy manifests');
 }
});

test('omitting choreography preserves the existing proposal surface and cannot secretly create story roles',()=>{
 const p=fixture(),change=proposal('s0',{style:'impact'});delete change.choreography;
 const result=applyDirection(p,{sections:[change]});
 assert.equal(result.sections[0].style,'impact');assert.equal(result.sections[0].direction.choreography,undefined);
 assert.throws(()=>applyDirection(p,{sections:[{...change,style:'story'}]}),/authored word roles/);
});

test('invalid or absent catalog entries fail before any input can be mutated',()=>{
 for(const choreography of ['invented-camera',null,{},'']){
  const p=fixture(),before=structuredClone(p);
  assert.throws(()=>applyDirection(p,{sections:[proposal('s0',{choreography})]}),/Unknown directed choreography/);
  assert.deepEqual(p,before);
 }
 const instrumental=fixture();instrumental.sections[0].wordIds=[];
 assert.throws(()=>applyDirection(instrumental,{sections:[proposal()]}),/requires existing sung words/);
});

test('existing semantic scenes and authored actions are protected from model-selected replacements',()=>{
 for(const style of ['rise','terrain','submerge','story']){
  const p=fixture();p.sections[0].style=style;p.sections[0].direction.roles={lead:'w0'};
  assert.throws(()=>applyDirection(p,{sections:[proposal()]}),/must be preserved/);
  const generic=proposal('s0',{style:'impact'});delete generic.choreography;
  assert.throws(()=>applyDirection(p,{sections:[generic]}),/must be preserved/);
 }
 for(const authored of [{actions:[{triggerId:'w0',targetIds:['w0'],to:{dy:30}}]},{positions:{w0:{x:600,y:300}}},{authoredTreatment:{id:'club-impact',description:'Words recoil above the physical club attack.'}}]){
  const p=fixture();Object.assign(p.sections[0].direction,authored);
  assert.throws(()=>applyDirection(p,{sections:[proposal()]}),/must be preserved/);
 }
});

test('caller-selected replacement authorization retains every authored field and does not authorize other scenes',()=>{
 const p=fixture(2);for(const section of p.sections){section.style='story';section.direction.choreography=ids[0];section.direction.actions=[{triggerId:section.wordIds[0],targetIds:section.wordIds,to:{dy:25}}];section.direction.roles={lead:section.wordIds[0]};section.direction.mode='fracture';}
 const before=structuredClone(p),change=proposal('s0',{choreography:ids[1]});
 assert.throws(()=>applyDirection(p,{sections:[{...change,replaceAuthoredSectionIds:['s0']}]}),/must be preserved/,'the model cannot authorize its own replacement');
 const result=applyDirection(p,{sections:[change]},{replaceAuthoredSectionIds:['s0']});
 assert.equal(result.sections[0].direction.choreography,ids[1]);
 for(const key of ['actions','roles','mode','photo','pan','fontFamily'])assert.deepEqual(result.sections[0].direction[key],before.sections[0].direction[key]);
 assert.deepEqual(result.sections[1],before.sections[1]);assert.deepEqual(result.words,before.words);assert.deepEqual(p,before);
 assert.throws(()=>applyDirection(p,{sections:[proposal('s1',{choreography:ids[1]})]},{replaceAuthoredSectionIds:['s0']}),/must be preserved/);
});

test('retaining an existing choreography preserves object parameters and supports proposals without the optional field',()=>{
 const p=fixture();p.sections[0].style='story';p.sections[0].direction.choreography={id:ids[0],readingHold:.8};
 let result=applyDirection(p,{sections:[proposal()]});
 assert.deepEqual(result.sections[0].direction.choreography,p.sections[0].direction.choreography);
 const change=proposal();delete change.choreography;result=applyDirection(p,{sections:[change]});
 assert.deepEqual(result.sections[0].direction.choreography,p.sections[0].direction.choreography);
});

test('batched planning exposes catalog descriptions, musical pace, previous choices and whole-song counts without extra inference',async t=>{
 const requests=[];
 const server=createServer(async(req,res)=>{
  let body='';for await(const chunk of req)body+=chunk;
  const input=JSON.parse(body),brief=JSON.parse(input.messages[1].content);requests.push({input,brief});
  const sections=brief.scenes.map(s=>proposal(s.id,{choreography:ids[Number(s.id.slice(1))]}));
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({done_reason:'stop',message:{content:JSON.stringify({summary:'Fixture catalog plan',sections})}}));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const p=fixture(10),before=structuredClone(p);
 const result=await directProject({project:p,stylePrompt:'Large spatial words with musical breathing room.',endpoint:`http://127.0.0.1:${server.address().port}`,model:'explicit-test-service'});
 assert.equal(requests.length,2,'one normal inference per existing batch, with no additional planning pass');
 assert.equal(result.method,'local-language-model');assert.deepEqual(result.project.words,p.words);assert.deepEqual(p,before);
 assert.ok(result.project.sections.every(s=>s.style==='story'&&Object.hasOwn(CHOREOGRAPHY_CATALOG,s.direction.choreography)));
 const first=requests[0],second=requests[1];
 assert.deepEqual(first.brief.choreography.catalog,CHOREOGRAPHY_CATALOG);
 assert.equal(first.brief.choreography.wholeSong.total,10);assert.equal(first.brief.choreography.standards.minDistinct,10);
 assert.equal(first.brief.choreography.standards.maxUses,3);assert.equal(first.brief.choreography.standards.noRepeatedTriples,true);
 assert.match(first.brief.creativeStandards.rhythm,/Follow the music pace.*not frenetic/);
 assert.match(first.brief.creativeStandards.choreography,/at least 30/);
 assert.match(first.input.messages[0].content,/no adjacent repeats or cyclic preset sequences/);
 const fields=first.input.format.properties.sections.items;
 assert.ok(fields.properties.choreography.enum.includes(ids[0]));assert.equal(fields.required.includes('choreography'),false);
 assert.equal(second.brief.choreography.wholeSong.unique,8);assert.equal(second.brief.choreography.wholeSong.counts[ids[0]],1);
 assert.deepEqual(second.brief.choreography.previousTreatments.map(s=>s.choreography),ids.slice(0,8));
 assert.equal(result.project.creation,undefined);
});
