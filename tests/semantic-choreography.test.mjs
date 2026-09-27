import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCanvas,GlobalFonts} from '@napi-rs/canvas';
import {SEMANTIC_CATALOG,semanticLayout,semanticPoses,drawSemanticBackground,drawSemanticTypography} from '../engine/semantic-choreography.mjs';
for(const [file,family]of [['BebasNeue-Regular.ttf','Bebas Neue'],['ArchivoBlack-Regular.ttf','Archivo Black'],['EBGaramond-Italic-Variable.ttf','EB Garamond']])GlobalFonts.registerFromPath(new URL(`../assets/fonts/${file}`,import.meta.url).pathname,family);
const h={setFont(c,size,family){c.font=`${size}px "${family}"`;c.textAlign='center';c.textBaseline='alphabetic'},word(c,w,t,x,y,size,o={}){if(t<w.start)return;c.save();c.globalAlpha*=o.opacity??1;c.translate(x,y);c.rotate(o.rotate||0);c.scale(o.scale||1,o.scale||1);h.setFont(c,size,o.family);c.fillStyle=o.color||'#fff';c.fillText(w.text.toUpperCase(),0,0);c.restore()}};
const words='The blood of your brother cries from the ground'.split(' ').map((text,i)=>({id:`w${i}`,text,start:.5+i*.38,end:.8+i*.38}));
function env(id,t=3){return{p:{words},s:{start:0,end:6,wordIds:words.map(w=>w.id),direction:{choreography:id,heroIds:['w5']}},t,ink:'#070708',paper:'#eeeeec',accent:'#a51822',seed:12,beat:0,assets:{}}}
const layout=()=>({positions:[],box:{x:180,y:200,w:1560,h:710}});
function raster(id,t=3,e=env(id,t)){const c=createCanvas(480,270),ctx=c.getContext('2d');ctx.scale(.25,.25);drawSemanticBackground(ctx,e,h);drawSemanticTypography(ctx,e,h,layout);return Buffer.from(ctx.getImageData(0,0,480,270).data)}
test('all sixteen compositions retain each exact canonical word, even through irregular phrases',()=>{
 assert.equal(Object.keys(SEMANTIC_CATALOG).length,16);const c=createCanvas(1920,1080).getContext('2d');
 for(const id of Object.keys(SEMANTIC_CATALOG))for(const length of [0,1,2,7,9,17]){const e=env(id);e.p={words:Array.from({length},(_,i)=>({id:`x${i}`,text:i%3?'brother':'righteousness',start:i*.3,end:i*.3+.25}))};e.s.wordIds=e.p.words.map(w=>w.id);const result=semanticLayout(c,e,h,layout);assert.deepEqual(new Set(result.positions.map(o=>o.w.id)),new Set(e.s.wordIds),`${id} ${length}`);assert.equal(result.positions.length,length);for(const o of result.positions)assert.equal(o.w,e.p.words.find(w=>w.id===o.w.id),'source cue object stays intact')}
});
test('future words never reach the renderer and no source cue changes',()=>{
 const c=createCanvas(1920,1080).getContext('2d');for(const id of Object.keys(SEMANTIC_CATALOG)){const e=env(id,1.3),before=JSON.stringify(e),calls=[];drawSemanticTypography(c,e,{...h,word:(ctx,w)=>calls.push(w)},layout);assert.ok(calls.length>0,id);assert.ok(calls.every(w=>w.start<=e.t),id);assert.ok(calls.every(w=>e.p.words.includes(w)),id);assert.equal(JSON.stringify(e),before)}
});
test('all word centers and widths stay in the protected photographic reading box',()=>{
 const c=createCanvas(1920,1080).getContext('2d');for(const id of Object.keys(SEMANTIC_CATALOG))for(const t of [.51,1.5,2.5,3.8,5.5]){const e=env(id,t);e.s.direction.textBox={x:260,y:140,w:1390,h:570};const result=semanticPoses(c,e,h,layout),b=result.box;for(const o of result.positions){assert.ok([o.x,o.y,o.size,o.rotate,o.opacity,o.scale].every(Number.isFinite),id);h.setFont(c,o.size,o.family);const half=c.measureText(o.w.text.toUpperCase()).width*o.scale/2;assert.ok(o.x-half>=b.x-1&&o.x+half<=b.x+b.w+1,`${id}: horizontal safe region`);assert.ok(o.y-o.size*.9>=b.y-.1&&o.y<=b.y+b.h,`${id}: vertical safe region`);assert.ok(o.opacity>=0&&o.opacity<=1)}}
});
test('the sixteen compositions render distinct encoded silhouettes and support random seeking',()=>{
 const hashes=new Set();for(const id of Object.keys(SEMANTIC_CATALOG)){const before=raster(id,3.5);hashes.add(createHash('sha256').update(before).digest('hex'));raster(id,5.9);raster(id,.13);assert.deepEqual(raster(id,3.5),before,id);assert.notDeepEqual(raster(id,1.2),before,`${id}: cue driven progression`)}assert.equal(hashes.size,16)
});
test('background motifs never erase the photographic plate',()=>{
 const c=createCanvas(1920,1080).getContext('2d');const proxy=new Proxy(c,{get(target,key){if(['fillRect','clearRect','fill','drawImage'].includes(key))return()=>assert.fail(`${key} would cover the plate`);const v=target[key];return typeof v==='function'?v.bind(target):v},set(target,key,value){target[key]=value;return true}});for(const id of Object.keys(SEMANTIC_CATALOG))assert.equal(drawSemanticBackground(proxy,env(id),h),true)
});
test('exile preserves the full reading hold before departing; the balance moves continuously',()=>{
 const c=createCanvas(1920,1080).getContext('2d'),hold=env('threshold-exile',3.9),poses=semanticPoses(c,hold,h,layout);assert.ok(poses.positions.every(o=>o.scale===1&&o.opacity===1));const late=semanticPoses(c,env('threshold-exile',5.8),h,layout);assert.ok(late.positions.every(o=>o.scale<.3&&o.opacity<.4));const a=semanticPoses(c,env('balance-offering',words[3].start-.0001),h,layout),b=semanticPoses(c,env('balance-offering',words[3].start+.0001),h,layout);for(let i=0;i<a.positions.length;i++)assert.ok(Math.abs(a.positions[i].y-b.positions[i].y)<.1)
});
test('unknown choreography leaves the existing renderer responsible for the scene',()=>{
 const c=createCanvas(10,10).getContext('2d'),e=env('missing');assert.equal(semanticLayout(c,e,h,layout),null);assert.equal(drawSemanticBackground(c,e,h),false);assert.equal(drawSemanticTypography(c,e,h,layout),false)
});
test('word strike gives its decisive word a separate large reading tier',()=>{
 const c=createCanvas(1920,1080).getContext('2d');for(const phrase of ['I have killed a man to my sorrow','I killed him']){const e=env('word-strike');e.p={words:phrase.split(' ').map((text,i)=>({id:`strike${i}`,text,start:i*.4,end:i*.4+.35}))};e.s.wordIds=e.p.words.map(w=>w.id);const decisive=e.p.words.find(w=>w.text==='killed');e.s.direction.heroIds=[decisive.id];const result=semanticLayout(c,e,h,layout),hero=result.positions.find(o=>o.w.id===decisive.id),before=result.positions.filter(o=>o.w.start<decisive.start),after=result.positions.filter(o=>o.w.start>decisive.start);assert.ok(before.every(o=>o.y<hero.y-hero.size*.65));assert.ok(after.every(o=>o.y>hero.y+o.size*.5));assert.ok(hero.size>Math.max(...result.positions.filter(o=>o!==hero).map(o=>o.size))*1.3)}
});
