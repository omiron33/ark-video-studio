import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas,GlobalFonts} from '@napi-rs/canvas';
import {CAMERA_CATALOG,cameraStations,cameraStationPosition,projectCameraPoint,sampleCameraChoreography,fadeCameraTrailCollisions,drawCameraBackground,drawCameraTypography} from '../engine/camera-choreography.mjs';
import {existsSync} from 'node:fs';
for(const [file,family] of [['BebasNeue-Regular.ttf','Bebas Neue'],['ArchivoBlack-Regular.ttf','Archivo Black']]){const url=new URL('../projects/genesis4-full/assets/'+file,import.meta.url);if(existsSync(url))GlobalFonts.registerFromPath(url.pathname,family);}
const texts='AND CAIN ROSE AGAINST HIS BROTHER ABEL IN THE OPEN FIELD'.split(' ');
const ws=texts.map((text,i)=>({id:`w${i}`,text,start:.25+i*.46,end:.65+i*.46}));
const base={p:{words:ws},s:{start:0,end:6,wordIds:ws.map(w=>w.id),direction:{}},t:1,ink:'#050505',paper:'#f2f2f0',accent:'#d9182b'};
const setFont=(c,size,family)=>{c.font=`${size}px "${family}"`;c.textAlign='center';c.textBaseline='alphabetic'};
const helpers={setFont,word(c,w,t,x,y,size,o){if(t<w.start)return;c.save();c.translate(x,y);c.rotate(o.rotate||0);c.scale(o.scale||1,o.scale||1);c.globalAlpha*=o.opacity??1;setFont(c,size,o.family);c.fillStyle=o.color;c.fillText(w.text,0,0);c.restore()}};
function env(id,t){return {...base,t,s:{...base.s,direction:{choreography:id}}}}
function frame(id,t){const canvas=createCanvas(480,270),c=canvas.getContext('2d');c.scale(.25,.25);c.fillStyle=base.ink;c.fillRect(0,0,1920,1080);const e=env(id,t);drawCameraBackground(c,e,helpers);drawCameraTypography(c,e,helpers);return Buffer.from(canvas.getContext('2d').getImageData(0,0,480,270).data)}
test('sixteen distinct fixed world arrangements exist, rather than aliases of a pan',()=>{
 assert.equal(Object.keys(CAMERA_CATALOG).length,16);
 const paths=new Set(Object.keys(CAMERA_CATALOG).map(id=>JSON.stringify(Array.from({length:4},(_,i)=>cameraStationPosition(id,i,4)))));
 assert.equal(paths.size,16);
});
test('perspective projection treats geometry and word anchors identically',()=>{
 const camera={x:0,y:0,z:-1000,focal:1000};
 assert.deepEqual(projectCameraPoint({x:100,y:200,z:0},camera),{x:1060,y:770,scale:1,depth:1000});
 assert.deepEqual(projectCameraPoint({x:100,y:200,z:1000},camera),{x:1010,y:670,scale:.5,depth:2000});
 assert.equal(projectCameraPoint({x:0,y:0,z:-1000},camera),null);
});
test('authored phrase groups are respected, with bounded long-phrase subdivision',()=>{
 const groups=cameraStations(ws,'camera-switchback',[ws.slice(0,5).map(w=>w.id),ws.slice(5).map(w=>w.id)]);
 assert.deepEqual(groups[0].map(w=>w.id),ws.slice(0,5).map(w=>w.id));
 assert.deepEqual(groups.flat().map(w=>w.id),ws.map(w=>w.id));
 assert.ok(groups.every(group=>group.length<=6));
});
test('all paths retain world coordinates while the camera moves and preserve the lyric source',()=>{
 const c=createCanvas(1920,1080).getContext('2d'),original=JSON.stringify(base);
 for(const id of Object.keys(CAMERA_CATALOG)){
  const a=sampleCameraChoreography(c,env(id,1),helpers),b=sampleCameraChoreography(c,env(id,4.5),helpers);
  assert.deepEqual(a.poses.map(o=>o.world),b.poses.map(o=>o.world),id);
  assert.notDeepEqual(a.camera,b.camera,id);
 }
 assert.equal(JSON.stringify(base),original);
});
test('active words remain within the reading region, including long words and random seeks',()=>{
 const c=createCanvas(1920,1080).getContext('2d');
 for(const id of Object.keys(CAMERA_CATALOG))for(const w of ws)for(const delta of [.12,.28]){
  const f=sampleCameraChoreography(c,env(id,w.start+delta),helpers),o=f.poses.find(o=>o.w.id===w.id);
  assert.ok(o.visible,`${id} ${w.text} visible`);
  const width=o.width*o.scale,height=o.size*o.scale;
  assert.ok(Number.isFinite(o.x+o.y+o.scale+o.rotate));
  assert.ok(o.x-width/2>=95&&o.x+width/2<=1825,`${id} ${w.text} horizontal ${o.x}, ${width}`);
  assert.ok(o.y-height*.9>=135&&o.y<=925,`${id} ${w.text} vertical ${o.y}, ${height}`);
  assert.ok(Math.abs(o.rotate)<=.10001);
 }
});
test('no choreography submits a future lyric to the renderer',()=>{
 const c=createCanvas(1920,1080).getContext('2d');
 for(const id of Object.keys(CAMERA_CATALOG))for(const t of [0,.2,.5,1.7,3.2,5.8]){
  let submitted=0;
  drawCameraTypography(c,env(id,t),{...helpers,word(_c,w,time){assert.ok(time>=w.start,`${id} leaked ${w.text}`);submitted++}});
  if(t<ws[0].start)assert.equal(submitted,0);
 }
});
test('camera rendering is deterministic under out-of-order frame requests',()=>{
 for(const id of Object.keys(CAMERA_CATALOG)){
  const a=frame(id,2.6);frame(id,5.5);frame(id,.2);assert.deepEqual(frame(id,2.6),a,id);
  assert.notDeepEqual(a,frame(id,4.6),id);
 }
});
test('three-word scenes retain a visible one-time camera arrival',()=>{
 const c=createCanvas(1920,1080).getContext('2d');
 for(const id of Object.keys(CAMERA_CATALOG)){
  const e=env(id,.05);e.s.wordIds=ws.slice(0,3).map(w=>w.id);
  const a=sampleCameraChoreography(c,e,helpers);e.t=.65;const b=sampleCameraChoreography(c,e,helpers);
  assert.notDeepEqual(a.camera,b.camera,id);
 }
});
test('passed near planes fade before their oversized text obscures the next station',()=>{
 const c=createCanvas(1920,1080).getContext('2d');
 for(const mode of ['camera-tunnel','camera-runway','camera-dolly','camera-horizon']){
  const f=sampleCameraChoreography(c,env(mode,3.6),helpers);
  for(const o of f.poses)if(!o.active&&o.group<f.camera.station-.25&&o.depth<700)assert.ok(o.opacity<.15,`${mode}: ${o.w.text} remained opaque`);
 }
});
test('wordless instrumental camera shots traverse their geometry without invented lyrics',()=>{
 const c=createCanvas(1920,1080).getContext('2d');
 for(const mode of Object.keys(CAMERA_CATALOG)){
  const e=env(mode,1);e.s.wordIds=[];
  const a=sampleCameraChoreography(c,e,helpers);e.t=4;const b=sampleCameraChoreography(c,e,helpers);
  assert.notDeepEqual(a.camera,b.camera,mode);assert.equal(a.poses.length,0);assert.equal(a.stations.length,4);
 }
});

test('completed spiral phrases cannot cover the active Brothers and Psaltery reading groups',()=>{
 const fixtures=[
  {text:["to","take","your","brother's","blood","from","your","hand."],starts:[.024,.184,.404,.564,1.064,3.046,3.446,3.826],ends:[.104,.384,.524,.984,2.946,3.266,3.726,4.127],font:'Bebas Neue',time:1.634,end:4.667},
  {text:['he','invented','the','psaltery','and','the','harp.'],starts:[.054,.235,.715,.815,1.857,1.977,2.177],ends:[.134,.655,.775,1.697,1.937,2.077,2.398],font:'Archivo Black',time:1.10,end:2.434}
 ];
 const c=createCanvas(1920,1080).getContext('2d');
 for(const fixture of fixtures){
  const words=fixture.text.map((text,i)=>({id:'fixture-'+i,text,start:fixture.starts[i],end:fixture.ends[i]}));
  const e={...base,p:{words},t:fixture.time,s:{start:0,end:fixture.end,wordIds:words.map(w=>w.id),direction:{choreography:'camera-spiral',fontFamily:fixture.font}}};
  const f=sampleCameraChoreography(c,e,helpers),active=f.poses.find(p=>p.active),occluded=f.poses.filter(p=>p.occludedByCurrentPhrase);
  assert.ok(occluded.length>0,fixture.text.join(' '));
  assert.ok(occluded.every(p=>p.opacity===0&&p.group<active.group));
  assert.equal(active.opacity,1);assert.ok(f.poses.filter(p=>p.group===active.group).every(p=>!p.occludedByCurrentPhrase));
 }
});
test('collision fading preserves nonintersecting trail words and any word still being sung',()=>{
 const word=(id,start,end)=>({id,text:id,start,end}),old=word('old',0,.7),held=word('held',0,2),current=word('current',1,1.8);
 const pose=(w,x,y,group)=>({w,x,y,width:240,size:120,scale:1,rotate:0,opacity:1,visible:true,active:group===1,group,world:{x,y,z:0}});
 const outside=pose(old,200,850,0),stillSinging=pose(held,950,550,0),now=pose(current,950,550,1);
 const result=fadeCameraTrailCollisions([outside,stillSinging,now],[[old,held],[current]],1.2,1);
 assert.equal(result[0].opacity,1);assert.equal(result[1].opacity,1);assert.equal(result[2].opacity,1);
 assert.deepEqual(result.map(p=>p.world),[outside,stillSinging,now].map(p=>p.world));
});
