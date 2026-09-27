// Re-extract the exact encoded evidence used by internal motion reference cards.
// This does not render projects or copy source videos. Cards remain hand-authored.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createCanvas, loadImage } from '@napi-rs/canvas';
const root = path.resolve(import.meta.dirname, '../references/motion');
const entries=fs.readdirSync(path.join(root,'cards')).filter(f=>f.startsWith('internal-')&&f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(root,'cards',f),'utf8')));
const checked=new Map();
for(const card of entries) {
 if(!checked.has(card.source.path)) {
  const hash=createHash('sha256');
  for await(const chunk of fs.createReadStream(card.source.path)) hash.update(chunk);
  checked.set(card.source.path,hash.digest('hex'));
 }
 if(checked.get(card.source.path)!==card.source.videoSha256) throw new Error(`Source changed for ${card.id}; refusing to replace reference evidence.`);
}
for(const card of entries){
 const {id,title}=card; const video=card.source.path; const times=card.frames.map(f=>f.timeSeconds);
 const dir=path.join(root,'images',id);fs.mkdirSync(dir,{recursive:true});
 const canvas=createCanvas(1280,1144);const ctx=canvas.getContext('2d');ctx.fillStyle='#121618';ctx.fillRect(0,0,1280,1144);ctx.fillStyle='#ecedeb';ctx.font='20px sans-serif';ctx.fillText(title??id,16,28);
 for(const[i,time]of times.entries()){
  const file=path.join(dir,`${String(i+1).padStart(2,'0')}.jpg`);
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-ss',String(time),'-i',video,'-frames:v','1','-vf','scale=960:-2','-q:v','3','-y',file]);
  const x=(i%2)*640,y=40+Math.floor(i/2)*368;ctx.drawImage(await loadImage(file),x,y,640,360);ctx.fillStyle='#121618';ctx.fillRect(x,y+331,130,29);ctx.fillStyle='#fff';ctx.font='18px sans-serif';ctx.fillText(`${Math.floor(time/60)}:${(time%60).toFixed(2).padStart(5,'0')}  #${i+1}`,x+10,y+352);
 }
 fs.writeFileSync(path.join(dir,'sheet.jpg'),canvas.toBuffer('image/jpeg'));console.log(id);
}
