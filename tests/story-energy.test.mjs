import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {drawFrame} from '../engine/visual.mjs';
import {applyStoryKinetics} from '../engine/story-visual.mjs';

const modes=['fracture','vortex','scorch','eclipse','lineage','strings'];
function fixture(mode='fracture',kinetic='strike'){
 return {width:480,height:270,fps:30,duration:4,title:'The Brother’s Blood',palette:{ink:'#080a0c',paper:'#d4c9b6',accent:'#a64831'},words:[{id:'a',text:'Blood',start:.3,end:1},{id:'b',text:'cries',start:1.1,end:1.65},{id:'c',text:'from',start:1.8,end:2.1},{id:'d',text:'earth',start:2.2,end:3.1}],beats:[],sections:[{id:'scene',start:0,end:4,style:'story',wordIds:['a','b','c','d'],assetIds:[],seed:9,direction:{mode,kinetic,gritty:true,heroIds:['a','d'],lines:[['a','b'],['c','d']]}}]};
}
function raster(project,t,layer='all'){
 const c=createCanvas(480,270),ctx=c.getContext('2d');drawFrame(ctx,project,{},t,{layer});return Buffer.from(ctx.getImageData(0,0,480,270).data);
}
test('new line families progress immediately and remain deterministic under random seeking',()=>{
 const signatures=[];
 for(const mode of modes){
  const p=fixture(mode),snapshot=structuredClone(p),times=[0,.16,.5,1.15,2.7,3.8],frames=times.map(t=>raster(p,t,'background'));
  assert.notDeepEqual(frames[0],frames[1],`${mode} has first-second action`);
  assert.notDeepEqual(frames[2],frames[4],`${mode} evolves throughout the scene`);
  for(const index of [5,0,3,1,4,2])assert.deepEqual(raster(p,times[index],'background'),frames[index],`${mode} is random-access`);
  assert.deepEqual(p,snapshot,`${mode} never mutates canonical timing or directions`);signatures.push(frames[3]);
 }
 for(let i=0;i<signatures.length;i++)for(let j=i+1;j<signatures.length;j++)assert.notDeepEqual(signatures[i],signatures[j],'families produce distinct compositions');
});
test('all kinetic entrances preserve canonical visibility and settled reading positions',()=>{
 const pose={x:710,y:600,scale:1,rotate:0,opacity:1},word={start:1};
 for(const mode of ['strike','split','cascade']){
  const direction={kinetic:mode};
  assert.deepEqual(applyStoryKinetics(direction,word,1,.99,pose),pose);
  assert.notDeepEqual(applyStoryKinetics(direction,word,1,1.04,pose),pose);
  assert.deepEqual(applyStoryKinetics(direction,word,1,1.2,pose),pose);
  assert.deepEqual(applyStoryKinetics({kinetic:{mode,seconds:4,amount:2}},word,1,1.21,pose),pose,'duration remains bounded');
  const p=fixture('fracture',mode);assert.equal(raster(p,.29,'type').some((v,i)=>i%4===3&&v>0),false);
  assert.ok(raster(p,.5,'type').some((v,i)=>i%4===3&&v>0));
  const neutral=fixture('fracture','strike');assert.deepEqual(raster(p,3.2,'type'),raster(neutral,3.2,'type'),'reading hold has no residual displacement');
 }
 assert.deepEqual(pose,{x:710,y:600,scale:1,rotate:0,opacity:1});
});
test('energy backgrounds leave the lyric layer unchanged and avoid bright full-frame washes',()=>{
 const p=fixture(),type=raster(p,2.8,'type');
 for(const mode of modes){
  p.sections[0].direction.mode=mode;assert.deepEqual(raster(p,2.8,'type'),type);
  for(const time of [0,.32,1.12,2.22,3.8]){
   const pixels=raster(p,time,'background');let bright=0;
   for(let i=0;i<pixels.length;i+=4)if((pixels[i]+pixels[i+1]+pixels[i+2])/3>180)bright++;
   assert.ok(bright/(480*270)<.10,`${mode} never flashes the screen bright`);
  }
 }
});
test('missing and unsupported kinetic settings leave the established pose untouched',()=>{
 const pose={x:740,y:650,scale:.9,rotate:.1,opacity:.8};
 for(const direction of [{},{kinetic:null},{kinetic:'unrecognized'}])assert.deepEqual(applyStoryKinetics(direction,{start:1},0,1.05,pose),pose);
});
test('plucked strings react to canonical word attacks and settle without invented beats',()=>{
 const p=fixture('strings'),silent=structuredClone(p);silent.words=[];silent.sections[0].wordIds=[];
 assert.deepEqual(raster(p,.29,'background'),raster(silent,.29,'background'),'no pluck before first word');
 assert.notDeepEqual(raster(p,1.15,'background'),raster(silent,1.15,'background'),'word onset excites the string');
 assert.deepEqual(raster(p,3.8,'background'),raster(silent,3.8,'background'),'strings rest once actual attacks decay');
});
