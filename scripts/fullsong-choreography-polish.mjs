#!/usr/bin/env node
/** Direction-only proposals. Never writes the source manifest or changes a lyric cue. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createCanvas} from '@napi-rs/canvas';
import {drawFrame} from '../engine/visual.mjs';
import {loadAssets} from '../engine/export.mjs';
import {applyStoryActions} from '../engine/story-visual.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),opt=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1]};
const projectPath=path.resolve(opt('--project',path.join(root,'projects/genesis7-full/project.json')));
const out=path.resolve(opt('--out',path.join(root,'output/fullsong-direction/polish-proofs')));
const patchPath=path.resolve(opt('--patches',path.join(root,'output/fullsong-direction/polish-patches.json')));
const bytes=await fs.readFile(projectPath),source=JSON.parse(bytes),p=structuredClone(source),assets=await loadAssets(p,projectPath);
const sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const expectedFonts=['Anton','Barlow Condensed','Cinzel','IM FELL English'];
const registeredFamilies=new Set(Object.values(p.assets).filter(a=>a.type==='font').map(a=>a.family));
for(const family of expectedFonts)if(!registeredFamilies.has(family))throw new Error(`Waiting for root font installation/manifest declaration: ${family}`);
const clean=w=>w.text.replace(/[.,]$/,'').toUpperCase();
const measure=createCanvas(32,32).getContext('2d'),patches=[];
function scene(id){const s=p.sections.find(s=>s.id===id);if(!s)throw new Error(`Missing ${id}`);return s;}
function author(id,fn){
 const s=scene(id),before=sha(s.direction),ws=p.words.filter(w=>s.wordIds.includes(w.id));
 const mainFamily=['g7-the-date','g7-sons-enter','g7-mountains-covered'].includes(id)?'Cinzel':'Barlow Condensed';
 const connectorFamily='IM FELL English';
 const d={...structuredClone(s.direction),light:false,fontFamily:mainFamily,connectorFont:connectorFamily,nativeMotion:false,positions:{},actions:[],curves:{}};
 const word=(phrase,index)=>ws.find(w=>w.id===`g7-${phrase}-w${String(index).padStart(2,'0')}`);
 const phrase=key=>ws.filter(w=>w.id.startsWith(`g7-${key}-w`));
 const pos=(w,x,y,size,family=mainFamily,rotate=0)=>{if(!w)throw new Error(`${id}: missing word`);d.positions[w.id]={x,y,size,family,rotate};};
 const row=(words,x,y,size,{gap=30,maxWidth=1660,sizes={},serif=[],families={},align='center'}={})=>{
  let entries=words.map(w=>{const family=families[w.id]||(serif.includes(w.id)?connectorFamily:mainFamily),s=sizes[w.id]||size;measure.font=`${s}px "${family}"`;return {w,size:s,family,width:measure.measureText(clean(w)).width};});
  let total=entries.reduce((n,e)=>n+e.width,0)+gap*(entries.length-1),scale=Math.min(1,maxWidth/total);total*=scale;
  let cursor=align==='left'?x:align==='right'?x-total:x-total/2;
  for(const e of entries){pos(e.w,cursor+e.width*scale/2,y,e.size*scale,e.family);cursor+=(e.width+gap)*scale;}
 };
 const act=(trigger,targets,from,to,extra={})=>d.actions.push({triggerId:trigger.id,targetIds:targets.map(w=>w.id),duration:.8,from,to,...extra});
 const curve=(w,amplitude)=>d.curves[w.id]={amplitude};
 fn({s,ws,d,word,phrase,pos,row,act,curve});
 for(const w of ws)if(!d.positions[w.id])throw new Error(`${id}: no authored position for ${w.id}`);
 for(const a of d.actions){if(!s.wordIds.includes(a.triggerId)||a.targetIds.some(id=>!s.wordIds.includes(id)))throw new Error(`${id}: invalid action target`);}
 s.direction=d;patches.push({sectionId:id,beforeDirectionSha256:before,direction:d,wordDataSha256:sha(ws)});
}
author('g7-seven-pairs',({d,phrase,word,row,pos,act})=>{
 const take=phrase('s01-l05'),pairs=phrase('s01-l06');
 row(take.slice(0,3),960,210,112,{serif:[take[1].id],gap:30});
 row(take.slice(3),960,420,184,{sizes:{[take[3].id]:100},serif:[take[3].id],gap:34});
 pos(pairs[0],565,700,272,'Anton');pos(pairs[1],1360,700,248,'Barlow Condensed');
 row(pairs.slice(2),960,947,108,{serif:[pairs[2].id],gap:30});
 act(take.at(-1),take,{scale:1},{scale:.72},{origin:{x:960,y:170},after:'end',delay:.3,duration:.9});
 act(pairs[0],[pairs[0]],{dx:-130},{dx:0},{duration:.85});act(pairs[1],[pairs[1]],{dx:130},{dx:0},{duration:.85});
 d.number=7;d.pairLanes={x:350,y:805,w:1220,triggerId:pairs[0].id};
});
author('g7-the-date',({d,phrase,pos,row,act})=>{
 const year=phrase('s07-l02'),life=phrase('s07-l03'),month=phrase('s07-l04'),day=phrase('s07-l05');
 row(year.slice(0,2),360,195,85,{serif:year.slice(0,2).map(w=>w.id),gap:22});
 row(year.slice(2),960,375,194,{sizes:{[year[4].id]:110},gap:38,maxWidth:1600});
 row(life,960,505,105,{serif:[life[0].id],gap:28});
 row(month.slice(0,2),440,625,77,{serif:month.slice(0,2).map(w=>w.id),gap:20});
 row([month[2]],460,802,145,{maxWidth:660});pos(month[3],460,950,100);
 row(day.slice(0,2),1330,625,77,{serif:day.slice(0,2).map(w=>w.id),gap:20});
 row([day[2]],1350,795,120,{maxWidth:840});pos(day[3],1350,950,115);
 act(life.at(-1),[...year,...life],{dy:0},{dy:-70},{after:'end',duration:.8});
 act(month[2],month,{dy:85},{dy:0},{duration:.55});act(day[2],day,{dy:85},{dy:0},{duration:.55});
 d.number=17;d.triggerId=day[2].id;
});
author('g7-deep-breaks-open',({d,phrase,row,act,curve})=>{
 const deep=phrase('s07-l06'),fountains=phrase('s07-l07'),burst=phrase('s07-l08');
 row(deep.slice(0,3),960,277,196,{sizes:{[deep[0].id]:102},serif:[deep[0].id],families:{[deep[2].id]:'Anton'},gap:48});
 row(deep.slice(3),960,508,200,{families:{[deep[3].id]:'Anton',[deep[4].id]:'Anton'},gap:130,maxWidth:1390});
 row(fountains,960,742,116,{sizes:{[fountains[0].id]:85,[fountains[3].id]:85},serif:[fountains[0].id,fountains[3].id],gap:24});
 row(burst,960,945,139,{sizes:{[burst[1].id]:100,[burst[2].id]:108},serif:[burst[1].id,burst[2].id],gap:32});
 curve(deep[2],18);act(deep[4],[deep[3]],{dx:0},{dx:-125},{after:'end',duration:.85});act(deep[4],[deep[4]],{dx:0},{dx:125},{after:'end',duration:.85});
 act(burst[0],burst,{dy:80},{dy:0},{duration:.65});d.triggerId=deep[4].id;
});
author('g7-sons-enter',({d,phrase,pos,row,act})=>{
 const noah=phrase('s05-l02'),sons=phrase('s05-l03'),shem=phrase('s05-l04'),ham=phrase('s05-l05'),japheth=phrase('s05-l06');
 row(noah,960,350,181,{sizes:{[noah[0].id]:230,[noah[2].id]:90,[noah[3].id]:250},serif:[noah[2].id],gap:55,maxWidth:1550});
 row(sons,960,575,114,{sizes:{[sons[0].id]:80,[sons[1].id]:85,[sons[4].id]:90,[sons[5].id]:142},serif:[sons[0].id,sons[1].id,sons[4].id],gap:32,maxWidth:1550});
 row(shem,420,842,154,{maxWidth:420});row(ham,870,842,150,{maxWidth:310});pos(japheth[0],1110,835,65,'IM FELL English');row(japheth.slice(1),1500,842,145,{maxWidth:525});
 act(noah[1],noah,{dx:-85},{dx:0},{duration:1});
 act(shem[0],shem,{dx:-145,dy:25},{dx:0,dy:0},{duration:.5});act(ham[0],ham,{dy:85},{dy:0},{duration:.42});act(japheth[0],japheth,{dx:135,dy:25},{dx:0,dy:0},{duration:.5});
 d.mode='names';
});
author('g7-lifted-the-ark',({d,phrase,pos,row,act,curve})=>{
 const waters=phrase('s12-l01'),lifted=phrase('s12-l02'),high=phrase('s12-l03');
 row(waters,960,205,123,{sizes:{[waters[0].id]:83},serif:[waters[0].id],gap:35});
 row(lifted.slice(0,3),620,410,122,{sizes:{[lifted[0].id]:85,[lifted[2].id]:85},serif:[lifted[0].id,lifted[2].id],gap:32,maxWidth:850});
 pos(lifted[3],660,827,262,'Anton');
 pos(high[0],1435,378,187,'Barlow Condensed');pos(high[1],1435,615,169,'Cinzel');row(high.slice(2),1435,850,124,{sizes:{[high[2].id]:82},serif:[high[2].id],gap:28,maxWidth:650});
 act(lifted[1],[lifted[3]],{dy:10},{dy:-160},{delay:.4,duration:1.6});
 act(high[0],high,{dy:55},{dy:0},{duration:.55});curve(high[1],25);
 d.triggerId=lifted[1].id;d.mode='lift';
});
author('g7-mountains-covered',({d,phrase,pos,row,act,curve})=>{
 const flood=phrase('s12-l08'),mountain=phrase('s12-l09'),heaven=phrase('s12-l10'),covered=phrase('s12-l11');
 row(flood.slice(0,2),960,285,195,{sizes:{[flood[0].id]:95},serif:[flood[0].id],gap:42,maxWidth:1560});
 row(flood.slice(2),960,495,203,{gap:45});
 act(flood[3],flood,{dy:0,opacity:1},{dy:-80,opacity:0},{after:'end',delay:.3,duration:.65});
 row(mountain.slice(0,2),420,535,102,{sizes:{[mountain[0].id]:75},serif:[mountain[0].id],gap:24});
 pos(mountain[2],1060,527,153,'Cinzel');pos(mountain[3],1040,810,218,'Anton');curve(mountain[3],58);
 pos(heaven[0],340,357,103);row(heaven.slice(1),1160,286,128,{sizes:{[heaven[1].id]:82},serif:[heaven[1].id],gap:30,maxWidth:1090});curve(heaven[3],22);
 row(covered,960,1007,139,{sizes:{[covered[0].id]:93},serif:[covered[0].id],gap:37});
 act(covered[1],mountain,{dy:0},{dy:72},{duration:.45});d.triggerId=covered[1].id;d.mode='engulf';
});
if(sha(p.words)!==sha(source.words)||sha(p.phrases)!==sha(source.phrases))throw new Error('Polish changed lyrics or timing');
await fs.mkdir(out,{recursive:true});
const evidence=[];
for(const patch of patches){
 const s=scene(patch.sectionId),ws=p.words.filter(w=>s.wordIds.includes(w.id)),firstPhrase=ws.filter(w=>w.phraseId===ws[0].phraseId),trigger=p.words.find(w=>w.id===s.direction.triggerId)||ws.find(w=>w.id===s.direction.actions.at(-1)?.triggerId)||ws.at(-1);
 const points=[['onset',ws[0].start+.16],['first-phrase',firstPhrase.at(-1).end+.12],['action',trigger.start+.52],['last-word',ws.at(-1).end+.1],['last-frame',s.end-1/p.fps]].map(([label,t])=>({label,time:Math.min(s.end-1/p.fps,Math.max(s.start,t))}));
 const strip=createCanvas(960*3,540*2+100),sc=strip.getContext('2d');sc.fillStyle='#07191c';sc.fillRect(0,0,strip.width,strip.height);const files=[];
 for(let i=0;i<points.length;i++){
  const point=points[i],canvas=createCanvas(1920,1080),c=canvas.getContext('2d');drawFrame(c,p,assets,point.time);
  const file=path.join(out,`${s.id}-${point.label}.png`),data=await canvas.encode('png');await fs.writeFile(file,data);files.push({...point,path:file,sha256:sha(data)});
  const x=i%3*960,y=Math.floor(i/3)*590;sc.drawImage(canvas,x,y,960,540);sc.font='25px sans-serif';sc.fillStyle='#e8e1ce';sc.fillText(`${point.label} · ${point.time.toFixed(3)}s`,x+20,y+577);
 }
 const sheet=path.join(out,`${s.id}-proof.png`);await fs.writeFile(sheet,await strip.encode('png'));evidence.push({sectionId:s.id,proof:sheet,frames:files});
}
// Small geometric checks catch the earlier static overlaps; source motion/curves still need actual visual review.
const layoutChecks=[];
for(const patch of patches){const s=scene(patch.sectionId),ws=p.words.filter(w=>s.wordIds.includes(w.id)),bad=new Map();
 for(let t=s.start;t<s.end;t+=.08){const visible=[];for(const w of ws){if(t<w.start+.12)continue;const base=s.direction.positions[w.id],pose=applyStoryActions(s,w,p.words,t,{...base,rotate:base.rotate||0,scale:1,opacity:1});if(pose.opacity<.2)continue;measure.font=`${base.size}px "${base.family}"`;const m=measure.measureText(clean(w)),width=m.width*pose.scale,height=(m.actualBoundingBoxAscent||base.size*.72)*pose.scale,arc=s.direction.curves[w.id]?.amplitude||0;visible.push({id:w.id,x:pose.x-width/2,y:pose.y-height-arc,w:width,h:height+arc});}
  for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){const a=visible[i],b=visible[j],ox=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),oy=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);if(ox>9&&oy>9){const k=[a.id,b.id].join('/');if(!bad.has(k))bad.set(k,{a:a.id,b:b.id,time:Number(t.toFixed(3)),overlapX:Number(ox.toFixed(1)),overlapY:Number(oy.toFixed(1))});}}
 }
 layoutChecks.push({sectionId:s.id,possibleOverlaps:[...bad.values()]});
}
const report={schemaVersion:1,kind:'direction-patches',projectPath,projectSha256:sha(bytes),wordDataSha256:sha(source.words),rendererSourceSha256:sha(await fs.readFile(path.join(root,'engine/story-visual.mjs'))),patches,evidence,layoutChecks,notes:['Source-rendered PNG proofs, not final encoded-film acceptance.','Only direction objects are proposed; words, timing, sections and assets remain unchanged.','Root should check beforeDirectionSha256 or inspect a changed section before applying each proposal.']};
await fs.mkdir(path.dirname(patchPath),{recursive:true});await fs.writeFile(patchPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({patchPath,scenes:patches.length,out,layoutChecks},null,2));
