import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createCanvas} from '@napi-rs/canvas';
import {drawFrame} from '../engine/visual.mjs';
import {loadAssets} from '../engine/export.mjs';
const file=path.resolve('projects/genesis7/project.json');
const project=JSON.parse(await readFile(file,'utf8'));
const assets=await loadAssets(project,file);
const pixels=(p,t,layer='all')=>{const canvas=createCanvas(480,270);drawFrame(canvas.getContext('2d'),p,assets,t,{layer});return Buffer.from(canvas.getContext('2d').getImageData(0,0,480,270).data)};
test('random access equals sequential rendering, including water and scene transitions',()=>{
 const times=[0,.65,1.34,2.7,2.7333333333,4.3,5.6,6.4,8.9,9.9666666];
 const ordered=times.map(t=>pixels(project,t));for(const i of [8,1,5,2,9,0,4,3,7,6])assert.deepEqual(pixels(project,times[i]),ordered[i]);
});
test('typography layer remains completely transparent before first vocal onset',()=>{
 const data=pixels(project,.3,'type');assert.equal(data.some((v,i)=>i%4===3&&v>0),false);
});
test('camera enters the actual O and image equals the next scene at the cut',()=>{
 for(const scale of [.7,1,1.1]){const p=structuredClone(project);p.sections[1].direction.scale=scale;const last=pixels(p,191/30),next=pixels(p,6.4);let total=0;for(let i=0;i<last.length;i++)total+=Math.abs(last[i]-next[i]);assert.ok(total/last.length<2,`No visible aperture or framing discontinuity with typography scale ${scale}`)}
});
test('styles render deterministically with a normal imported phrase',()=>{
 for(const style of ['orbit','impact','verse']){const p=structuredClone(project);p.sections=[{id:'phrase',start:0,end:10,style,wordIds:p.words.map(w=>w.id),assetIds:[],direction:{},seed:4}];const data=pixels(p,4.5);assert.ok(data.some(v=>v>0));assert.deepEqual(data,pixels(p,4.5))}
});
test('graphic submerge keeps sung words visible and physically occludes them in the tail',()=>{
 const p=structuredClone(project),s=p.sections.at(-1);s.assetIds=[];s.direction.photo='absent';s.direction.wave='absent';s.direction.submergeAt=8.7;
 const at=8.6,tail=9.9;
 assert.notDeepEqual(pixels(p,at,'all'),pixels(p,at,'background'));
 const end=pixels(p,tail,'all');assert.deepEqual(end,pixels(p,tail,'all'));
 const canvas=createCanvas(480,270);drawFrame(canvas.getContext('2d'),p,{},tail);const data=canvas.getContext('2d').getImageData(0,0,480,270).data;
 // Ivory lyric pixels cannot resurface in the lower half after the water covers them.
 let ivory=0;for(let y=135;y<270;y++)for(let x=0;x<480;x++){let i=(y*480+x)*4;if(data[i]>210&&data[i+1]>210&&data[i+2]>180)ivory++}assert.equal(ivory,0);
});
