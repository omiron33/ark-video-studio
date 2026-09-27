import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,get} from 'node:http';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {directProject,applyDirection} from '../engine/director.mjs';
import {startReferenceServer} from '../engine/reference-gallery.mjs';

const project={version:1,id:'ref-test',title:'Lineage',width:640,height:360,fps:30,duration:3,audio:{src:'test.wav',offset:0},assets:{},beats:[],words:[{id:'a',text:'Generations',start:.2,end:2.8}],sections:[{id:'s',style:'verse',start:0,end:3,wordIds:['a'],assetIds:[],direction:{},seed:1}]};
const change={id:'s',style:'impact',motif:'grid',scale:1,accent:'#ef936d',reason:'Show branching generations'};
async function fixture(t){
  const root=await mkdtemp(path.join(os.tmpdir(),'ark-reference-director-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(path.join(root,'cards'));await mkdir(path.join(root,'images','lineage'),{recursive:true});
  const jpeg=createCanvas(128,72).toBuffer('image/jpeg');
  const frames=[];for(let i=0;i<4;i++){const image=`images/lineage/${i}.jpg`;await writeFile(path.join(root,image),jpeg);frames.push({path:image,timeSeconds:i*.7});}
  await writeFile(path.join(root,'images/lineage/sheet.jpg'),jpeg);
  const card={version:1,id:'lineage',title:'Branching generations',source:{kind:'internal',path:'/fixture/source.mp4',videoSha256:'a'.repeat(64),start:0,end:3},intent:['lineage','generations'],tags:['family','ancestry','branching'],motion:{summary:'Reveal a new branch for each generation.',phases:['Trunk appears','Branches unfold'],transferablePrinciple:'Reveal relationships through space.',variations:['Use luminous folds'],cautions:['Keep names legible']},quality:{status:'observed',reviewer:'Test fixture only',strengths:['Distinct hierarchy'],limitations:['Fixture, not aesthetic evidence'],userPreference:'unknown'},frames,contactSheet:'images/lineage/sheet.jpg'};
  await writeFile(path.join(root,'cards/lineage.json'),JSON.stringify(card));return {root,jpeg,card};
}
test('scene planning receives real reference images and records an original proposed concept',async t=>{
  const {root,jpeg}=await fixture(t);let captured;
  const server=createServer(async(req,res)=>{let text='';for await(const part of req)text+=part;captured=JSON.parse(text);res.end(JSON.stringify({message:{content:JSON.stringify({summary:'Explicit test only',sections:[{...change,concept:{referenceIds:['lineage'],principle:'Reveal relationships through space',adaptation:'Unfold a tree from the sung names, keeping each new generation in a clear plane.'}}]})}}));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const result=await directProject({project,stylePrompt:'Lineage and branching generations',libraryRoot:root,endpoint:`http://127.0.0.1:${server.address().port}`,model:'explicit-test-service'});
  assert.equal(result.method,'local-language-model');
  assert.equal(captured.messages[1].images.length,1);
  const attached=await loadImage(Buffer.from(captured.messages[1].images[0],'base64'));assert.equal(attached.width,128);assert.equal(attached.height,72);
  assert.equal(result.evidence.references.imagePaths[0],'images/lineage/sheet.jpg');
  const brief=JSON.parse(captured.messages[1].content);assert.equal(brief.scenes[0].lyrics,'Generations');assert.match(brief.visualReferences.guidance,/"id":"lineage"/);
  assert.match(captured.messages[0].content,/untrusted data/);assert.match(captured.messages[0].content,/invent a different/);
  assert.deepEqual(result.project.words,project.words);assert.deepEqual(result.project.audio,project.audio);
  assert.deepEqual(result.evidence.references.selectedIds,['lineage']);
  assert.equal(result.project.sections[0].direction.inspiration.status,'proposed');
  assert.deepEqual(result.project.sections[0].direction.inspiration.referenceIds,['lineage']);
});
test('a proposal cannot cite references it never received or overwrite a protected scene concept',()=>{
  const concept={referenceIds:['missing'],principle:'A principle',adaptation:'A new scene'};
  assert.throws(()=>applyDirection(project,{sections:[{...change,concept}]}),/unavailable reference/);
  const authored=structuredClone(project);authored.sections[0].style='story';authored.sections[0].direction.authoredTreatment={id:'original',description:'Preserve'};
  const result=applyDirection(authored,{sections:[{...change,style:'story',concept:{...concept,referenceIds:[]}}]});
  assert.equal(result.sections[0].direction.inspiration,undefined);
});
test('reference browser serves real evidence, searches and rejects arbitrary paths and writes',async t=>{
  const {root,jpeg}=await fixture(t),{server,url}=await startReferenceServer({libraryRoot:root,port:0});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const all=await (await fetch(new URL('/api/references',url))).json();assert.equal(all.cards.length,1);
  const matching=await (await fetch(new URL('/api/references?q=generations',url))).json();assert.equal(matching.cards[0].id,'lineage');
  const missing=await (await fetch(new URL('/api/references?q=zzqxv',url))).json();assert.equal(missing.cards.length,0);
  const media=await fetch(new URL('/media?path=images/lineage/sheet.jpg',url));assert.equal(media.status,200);assert.deepEqual(Buffer.from(await media.arrayBuffer()),jpeg);
  assert.equal((await fetch(new URL('/media?path=../../package.json',url))).status,404);
  assert.equal((await fetch(new URL('/api/references',url),{method:'POST'})).status,405);
  const badHost=await new Promise((resolve,reject)=>get(url,{headers:{Host:'evil.invalid'}},res=>{res.resume();resolve(res.statusCode);}).once('error',reject));assert.equal(badHost,403);
});
