import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.dirname(fileURLToPath(import.meta.url)),args=process.argv.slice(2),arg=k=>args.includes(k)?args[args.indexOf(k)+1]:undefined;
const read=async f=>JSON.parse(await fs.readFile(path.join(root,f),'utf8'));
const choice=await read('theme-choice.json');if(choice.status!=='chosen')throw Error('Theme not selected');
const source=await fs.readFile(path.join(root,'assets/song.mp3'));if(createHash('sha256').update(source).digest('hex')!==choice.audioSha256)throw Error('Wrong source audio');
const timing=await read(arg('--timing')||'timing/words.json'),words=timing.words,byId=new Map(words.map(w=>[w.id,w]));
const phrases=timing.phrases.map(p=>{const ws=p.wordIds.map(id=>byId.get(id));if(ws.some(w=>!w))throw Error('Missing phrase word '+p.id);return {...p,start:Math.min(...ws.map(w=>w.start)),end:Math.max(...ws.map(w=>w.end)),words:ws}});
const duration=Number(arg('--duration')||304.733333);if(!(duration>0&&duration<=304.733334))throw Error('Invalid duration');
const scenePlan=await read(arg('--scene-plan')||'scene-plan.json'),events=await read('intake/measured-attacks.json');let media=[];try{media=(await read('asset-map.json')).media||[]}catch{}
const data={duration,sourceDuration:304.72,words,phrases,beats:events.beats||events.events||events.attacks||[],scenePlan,media};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const mediaHTML=media.filter(m=>m.start<duration).map(m=>{const end=Math.min(m.end,duration),content=m.type==='video'?`<video id="clip-${esc(m.id)}" class="clip" src="${esc(m.src)}" data-start="${m.start}" data-duration="${Math.min(m.duration,end-m.start)}" data-track-index="2" muted playsinline></video>${m.poster?`<img class="g1-last-frame" src="${esc(m.poster)}" alt="Continuous last frame">`:''}`:`<img src="${esc(m.src)}" alt="${esc(m.alt||'Creation supporting scene')}">`;return `<div id="media-${esc(m.id)}" class="g1-media-shell" data-treatment="${esc(m.treatment||'water')}"><div class="g1-media-inner">${content}</div><div class="g1-media-shade"></div><div class="g1-media-foreground"></div></div>`}).join('\n');
const sceneFiles=(await fs.readdir(path.join(root,'scenes'))).filter(f=>f.endsWith('.js')).sort();
const scenes=(await Promise.all(sceneFiles.map(f=>fs.readFile(path.join(root,'scenes',f),'utf8')))).join('\n');
const [template,runtime,opening]=await Promise.all(['composition.html.txt','runtime.js','opening.js'].map(f=>fs.readFile(path.join(root,f),'utf8')));
let extraFonts='';try{await fs.access(path.join(root,'assets/AndaleMono.ttf'));extraFonts="@font-face{font-family:PlexMono;src:url('assets/AndaleMono.ttf')}"}catch{}
const html=template.replaceAll('__DURATION__',String(duration)).replace('__EXTRA_FONTS__',()=>extraFonts).replace('__MEDIA__',()=>mediaHTML).replace('__DATA__',()=>JSON.stringify(data).replaceAll('</','<\\/')).replace('__RUNTIME__',()=>runtime).replace('__SCENES__',()=>scenes).replace('__OPENING__',()=>opening);
await fs.writeFile(path.join(root,'index.html'),html);console.log(JSON.stringify({duration,words:words.length,phrases:phrases.length,sceneFiles,media:media.length,output:path.join(root,'index.html')}));
