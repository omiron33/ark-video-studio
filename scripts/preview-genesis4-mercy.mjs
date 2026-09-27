#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {loadProject,atomicJson} from '../engine/project.mjs';
import {loadAssets} from '../engine/export.mjs';
import {drawFrame} from '../engine/visual.mjs';
const projectPath=path.resolve(process.argv[2]||'projects/genesis4-motion-v3/project.json'),out=path.resolve(process.argv[3]||'/Users/shanefisher/Movies/Genesis4-motion-v3-work/preview');
const {project:p}=await loadProject(projectPath),assets=await loadAssets(p,projectPath);await fs.mkdir(out,{recursive:true});
const groups={
 sculptural:p.sections.filter(s=>['eclipse-disc','concentric-rupture','stone-crush','crescent-sweep','shadow-procession','mark-seal','torn-monument','word-orbit','redaction-slab','monolith-rise'].includes(s.direction.choreography)).map(s=>{const w=p.words.filter(w=>s.wordIds.includes(w.id));return Math.min(s.end-.08,w.at(-1).start+.18)}),
 climax:[253.7,256,257.5,258.8,260.95,262.8,263.2,264.35,265.5,266.13,266.8,267.5,268.5,269.6,270.6],
 lineage:[203.8,206.6,208.6,212.5,214.7,216.7,218.7,220.9,271.5,274.6,277.4,280.5,286.6,290.1,292.3,299.9,302,305.3]
};
const index={projectPath,kind:'source-preview-not-encoded',groups:{}};
for(const [name,times]of Object.entries(groups)){
 const records=[];
 for(const t of times){const c=createCanvas(1920,1080);drawFrame(c.getContext('2d'),p,assets,t);const file=path.join(out,`${name}-${t.toFixed(3)}.png`);await fs.writeFile(file,c.toBuffer('image/png'));records.push({time:t,path:file});}
 const c=createCanvas(1920,Math.ceil(times.length/3)*384),ctx=c.getContext('2d');ctx.fillStyle='#0c0c0c';ctx.fillRect(0,0,c.width,c.height);
 for(const [i,r]of records.entries()){const x=i%3*640,y=Math.floor(i/3)*384;ctx.drawImage(await loadImage(r.path),x,y,640,360);ctx.font='18px sans-serif';ctx.fillStyle='#eee';ctx.fillText(`${name} · ${r.time.toFixed(3)}s`,x+12,y+380);}
 const sheet=path.join(out,`${name}-sheet.jpg`);await fs.writeFile(sheet,c.toBuffer('image/jpeg'));index.groups[name]={sheet,records};
}
await atomicJson(path.join(out,'index.json'),index);console.log(JSON.stringify(index.groups,null,2));
