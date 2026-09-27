#!/usr/bin/env node
/** Decode the final movie once into bounded chronological visual evidence. */
import fs from 'node:fs/promises';import path from 'node:path';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {loadProject,atomicJson,fileHash} from '../engine/project.mjs';
import {runProcess} from '../engine/export.mjs';
const projectPath=path.resolve(process.argv[2]||'projects/genesis4-motion-v2/project.json');
const videoPath=path.resolve(process.argv[3]||'/Users/shanefisher/Movies/Genesis4-motion-v2-work/film.mp4');
const out=path.resolve(process.argv[4]||'/Users/shanefisher/Movies/Genesis4-motion-v2-work/visual');
const {project:p}=await loadProject(projectPath),frames=path.join(out,'frames');await fs.mkdir(frames,{recursive:true});
await runProcess('ffmpeg',['-v','error','-y','-i',videoPath,'-vf','fps=6,scale=960:540','-q:v','3',path.join(frames,'frame-%05d.jpg')]);
const files=(await fs.readdir(frames)).filter(f=>f.endsWith('.jpg')).sort(),scenes=[];
for(const [index,s]of p.sections.entries()){
 const ws=p.words.filter(w=>s.wordIds.includes(w.id)),samples=[];
 const from=s.start+.10,to=s.end-.13;
 for(let i=0;i<8;i++)samples.push(from+(to-from)*i/7);
 if(s.direction.choreography?.startsWith('camera-'))for(const group of s.direction.cameraGroups||[])for(const id of[group[0],group.at(-1)]){const w=ws.find(w=>w.id===id);if(w)samples.push(Math.min(s.end-.07,w.start+.18));}
 const selected=[...new Set(samples.map(t=>Math.min(files.length-1,Math.max(0,Math.round(t*6)))))].sort((a,b)=>a-b);
 const canvas=createCanvas(1920,Math.ceil(selected.length/3)*384),ctx=canvas.getContext('2d');ctx.fillStyle='#141414';ctx.fillRect(0,0,canvas.width,canvas.height);
 for(const [i,n]of selected.entries()){const img=await loadImage(path.join(frames,files[n])),x=i%3*640,y=Math.floor(i/3)*384;ctx.drawImage(img,x,y,640,360);ctx.font='16px sans-serif';ctx.fillStyle='white';ctx.fillText(`${s.id} | ${(n/6).toFixed(3)}s | ${s.direction.choreography||s.direction.titleMotion||s.direction.mode}`,x+8,y+378);}
 const sheet=path.join(out,`${String(index).padStart(2,'0')}-${s.id}.jpg`);await fs.writeFile(sheet,canvas.toBuffer('image/jpeg'));
 scenes.push({index,id:s.id,start:s.start,end:s.end,lyrics:ws.map(w=>w.text).join(' '),treatment:s.direction.choreography||s.direction.authoredTreatment||s.direction.titleMotion||s.direction.mode,sheet,samples:selected.map(n=>({time:n/6,path:path.join(frames,files[n])}))});
}
for(let page=0;page<Math.ceil(scenes.length/12);page++){
 const entries=scenes.slice(page*12,(page+1)*12),c=createCanvas(1920,Math.ceil(entries.length/3)*390),ctx=c.getContext('2d');ctx.fillStyle='#141414';ctx.fillRect(0,0,c.width,c.height);
 for(let i=0;i<entries.length;i++){const s=entries[i],ws=p.words.filter(w=>p.sections[s.index].wordIds.includes(w.id)),at=ws.length?Math.min(s.end-.12,ws.at(-1).start+.22):s.start+(s.end-s.start)*.64,n=Math.min(files.length-1,Math.round(at*6)),x=i%3*640,y=Math.floor(i/3)*390;ctx.drawImage(await loadImage(path.join(frames,files[n])),x,y,640,360);ctx.font='16px sans-serif';ctx.fillStyle='white';ctx.fillText(`${s.index} ${s.id} | ${at.toFixed(2)}s`,x+8,y+382);}
 await fs.writeFile(path.join(out,`overview-${page}.jpg`),c.toBuffer('image/jpeg'));
}
await atomicJson(path.join(out,'index.json'),{videoPath,videoSha256:await fileHash(videoPath),projectPath,method:'Actual final encode decoded at six frames per second; per-scene chronological sheets plus full frames for detailed inspection',scenes});console.log(JSON.stringify({scenes:scenes.length,frames:files.length,index:path.join(out,'index.json')}));
