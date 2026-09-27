import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {drawFrame} from '../engine/visual.mjs';
import {installStoryStyles,applyStoryActions} from '../engine/story-visual.mjs';
const ws=[{id:'one',text:'Living',start:1,end:1.5},{id:'two',text:'words',start:1.6,end:2.2}];
const p={width:1920,height:1080,fps:30,duration:4,title:'Genesis',palette:{ink:'#061a20',paper:'#e8e1ce',accent:'#e77951'},words:ws,beats:[],sections:[{id:'scene',start:0,end:4,style:'story',wordIds:['one','two'],assetIds:[],seed:1,direction:{}}]};
function raster(project,t,layer='all'){const c=createCanvas(480,270),ctx=c.getContext('2d');drawFrame(ctx,project,{},t,{layer});return Buffer.from(ctx.getImageData(0,0,480,270).data)}
test('story scenes support repeatable random seeking across every semantic motion family',()=>{
 for(const mode of ['gateway','seal','shelter','pairs','family','calendar','count','birds','rain','rupture','deep','map','absence','sweep','silence','lift','drift','horizon','engulf','breath','names']){
  const film=structuredClone(p);film.sections[0].direction={mode,heroIds:['two'],number:7};
  const before=JSON.stringify(film),frame=raster(film,2.3);raster(film,3.9);raster(film,.2);assert.deepEqual(raster(film,2.3),frame,mode);assert.equal(JSON.stringify(film),before,'render cannot mutate timing or source');
 }
});
test('custom positions preserve cue identity and support noncentral editorial compositions',()=>{
 const c=createCanvas(1920,1080).getContext('2d');
 const {layout}=installStoryStyles(()=>{},{setFont:(ctx,size,family='sans-serif')=>{ctx.font=`${size}px "${family}"`;}});
 const film=structuredClone(p),section=film.sections[0];section.direction={lines:[['one','two']],align:'left',positions:{two:{x:1440,y:750,size:290,rotate:-.05}}};
 const result=layout(c,{p:film,s:section});assert.equal(result.positions[1].w.id,'two');assert.equal(result.positions[1].x,1440);assert.equal(result.positions[1].y,750);assert.equal(result.positions[1].rotate,-.05);assert.ok(result.positions[0].x<700);
});
test('story lyrics never appear before their vocal onset, including custom placements',()=>{
 const film=structuredClone(p);film.sections[0].direction={mode:'pairs',positions:{one:{x:500,y:700},two:{x:1420,y:700}}};
 assert.equal(raster(film,.8,'type').some((v,i)=>i%4===3&&v>0),false);
 assert.ok(raster(film,2.3,'type').some((v,i)=>i%4===3&&v>0));
});
test('a sung trigger moves its subject without changing cue timing or unrelated words',()=>{
 const section={direction:{actions:[{triggerId:'two',targetIds:['one'],duration:.5,to:{dy:-200,scale:1.1}}]}};
 const pose={x:800,y:700,scale:1,rotate:0,opacity:1};
 assert.deepEqual(applyStoryActions(section,ws[0],ws,1.5,pose),pose);
 const lifted=applyStoryActions(section,ws[0],ws,2.2,pose);assert.equal(lifted.y,500);assert.equal(lifted.scale,1.1);
 assert.deepEqual(applyStoryActions(section,ws[1],ws,2.2,pose),pose);
 assert.equal(ws[0].start,1);assert.equal(ws[1].start,1.6);
});
test('subject motion can wait until every target has been sung',()=>{
 const section={direction:{actions:[{triggerId:'one',targetIds:['one','two'],afterTargets:true,duration:.5,to:{dx:100}}]}},pose={x:800,y:700,scale:1,rotate:0,opacity:1};
 assert.deepEqual(applyStoryActions(section,ws[0],ws,2.25,pose),pose);
 assert.equal(applyStoryActions(section,ws[0],ws,2.85,pose).x,900);
});
test('dissolving words retain their complete reading hold and disappear after the triggered action',()=>{
 const film=structuredClone(p);film.sections[0].direction={mode:'statement',fragments:{one:{triggerId:'two',delay:.3,duration:.6},two:{triggerId:'two',delay:.3,duration:.6}}};
 const plain=structuredClone(film);delete plain.sections[0].direction.fragments;
 assert.deepEqual(raster(film,2.45,'type'),raster(plain,2.45,'type'));
 assert.notDeepEqual(raster(film,2.7,'type'),raster(plain,2.7,'type')); 
 assert.equal(raster(film,3.2,'type').some((v,i)=>i%4===3&&v>0),false);
});
test('instrumental title and calendar motion remain time driven without inventing lyric cues',()=>{
 const film=structuredClone(p);film.words=[];film.sections[0].wordIds=[];
 for(const direction of [{mode:'overture',title:'GENESIS 7',titleMotion:'chapter'},{mode:'gateway',title:'7',titleMotion:'threshold'},{mode:'calendar',number:600,countTimeline:{start:0,end:3.8,from:0,to:600,digits:3}}]){
  film.sections[0].direction=direction;const a=raster(film,1),b=raster(film,2.5);assert.notDeepEqual(a,b);assert.deepEqual(raster(film,1),a);
 }
 assert.deepEqual(film.words,[]);
});
