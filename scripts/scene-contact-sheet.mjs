#!/usr/bin/env node
/** Fast direction proof from source. Final acceptance always inspects encoded MP4. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createCanvas} from '@napi-rs/canvas';
import {drawFrame} from '../engine/visual.mjs';
import {loadAssets} from '../engine/export.mjs';
const argv=process.argv.slice(2),option=(name,fallback)=>{const i=argv.indexOf(name);return i<0?fallback:argv[i+1]};
const file=path.resolve(option('--project','projects/genesis7-full/project.json'));
const out=path.resolve(option('--out','output/fullsong-direction'));
const p=JSON.parse(await readFile(file,'utf8')),assets=await loadAssets(p,file);
await mkdir(out,{recursive:true});
const width=480,height=270,caption=48,columns=4,pageSize=20;
for(let first=0;first<p.sections.length;first+=pageSize){
 const entries=p.sections.slice(first,first+pageSize),sheet=createCanvas(width*columns,(height+caption)*Math.ceil(entries.length/columns)),s=sheet.getContext('2d');
 s.fillStyle='#151b1d';s.fillRect(0,0,sheet.width,sheet.height);
 for(const [i,section]of entries.entries()){
  const ws=p.words.filter(w=>section.wordIds.includes(w.id));
  const last=ws.at(-1),t=Math.min(section.end-.25,last?Math.max(last.start+.15,Math.min(last.end,section.end-.3)):(section.start+section.end)/2);
  const frame=createCanvas(width,height),c=frame.getContext('2d');drawFrame(c,p,assets,t);
  const x=i%columns*width,y=Math.floor(i/columns)*(height+caption);s.drawImage(frame,x,y);
  s.font='15px sans-serif';s.fillStyle='#f2ece1';s.fillText(`${first+i+1}. ${section.id}`,x+10,y+height+19);
  s.fillStyle='#9dadad';s.fillText(`${section.start.toFixed(1)}–${section.end.toFixed(1)}s · ${section.style}/${section.direction?.mode||''} · frame ${t.toFixed(2)}`,x+10,y+height+39);
 }
 const dest=path.join(out,`direction-${String(first/pageSize+1).padStart(2,'0')}.jpg`);await writeFile(dest,await sheet.encode('jpeg',90));console.log(dest);
}
