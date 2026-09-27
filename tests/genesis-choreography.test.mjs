import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createCanvas,GlobalFonts} from '@napi-rs/canvas';
import {GENESIS_CATALOG,GENESIS_ANCESTRY,genesisState,genesisPoses,drawGenesisBackground,drawGenesisTypography} from '../engine/genesis-choreography.mjs';
for(const [file,family]of [['BebasNeue-Regular.ttf','Bebas Neue'],['ArchivoBlack-Regular.ttf','Archivo Black']])GlobalFonts.registerFromPath(new URL(`../assets/fonts/${file}`,import.meta.url).pathname,family);
const p=JSON.parse(fs.readFileSync(new URL('../projects/genesis4-motion-v2/project.json',import.meta.url)));
const h={setFont(c,size,family){c.font=`${size}px "${family}"`;c.textAlign='center';c.textBaseline='alphabetic'},word(c,w,t,x,y,size,o={}){if(t<w.start)return;c.save();c.globalAlpha*=o.opacity??1;h.setFont(c,size,o.family);c.fillStyle=o.color||'#fff';c.fillText(w.text.replace(/[.,:;]$/,'').toUpperCase(),x,y);c.restore()}};
const range={
 'genesis-vengeance':['g4-scene-084','g4-scene-085','g4-scene-086'],
 'genesis-forgiveness':['g4-scene-087'],
 'genesis-lineage-cain':['g4-scene-063'],
 'genesis-lineage-seed':['g4-scene-088'],
 'genesis-lineage-prayer':['g4-scene-091'],
 'genesis-lineage-resolution':['g4-ending-life']
};
function env(id,t,sections=range[id]){
 const source=sections.map(id=>p.sections.find(s=>s.id===id)),s={...source[0],start:source[0].start,end:source.at(-1).end,wordIds:source.flatMap(s=>s.wordIds),direction:{choreography:id,genesis:{lyricGroups:source.length>1?source.map(s=>s.wordIds):undefined}}};
 return{p,s,t:t??(s.start+s.end)/2,paper:'#f4f1eb',ink:'#080708',accent:'#e83f50',assets:{}};
}
const ctx=()=>createCanvas(1920,1080).getContext('2d');
function raster(e){const canvas=createCanvas(480,270),c=canvas.getContext('2d');c.scale(.25,.25);drawGenesisBackground(c,e,h);drawGenesisTypography(c,e,h);return Buffer.from(c.getImageData(0,0,480,270).data)}

test('six Genesis tableaux retain every primary cue and are deterministic when seeking backward',()=>{
 assert.equal(Object.keys(GENESIS_CATALOG).length,6);const hashes=new Set(),c=ctx();
 for(const id of Object.keys(GENESIS_CATALOG)){
  const e=env(id),before=JSON.stringify(e),m=genesisPoses(c,e,h),primary=m.positions.filter(o=>!o.isContext);
  assert.deepEqual(primary.map(o=>o.w.id).sort(),[...e.s.wordIds].sort(),id);
  for(const o of m.positions)assert.equal(o.w,p.words.find(w=>w.id===o.w.id));
  const pixels=raster(e);hashes.add(createHash('sha256').update(pixels).digest('hex'));raster({...e,t:e.s.end-.1});raster({...e,t:e.s.start+.01});assert.deepEqual(raster(e),pixels,id);assert.equal(JSON.stringify(e),before,'source cues and sections cannot be mutated');
 }
 assert.equal(hashes.size,6);
});
test('every actual sung word is fully present at its midpoint and no future word reaches drawing',()=>{
 const c=ctx();for(const id of Object.keys(GENESIS_CATALOG)){
  const e=env(id);for(const wordId of e.s.wordIds){const w=p.words.find(w=>w.id===wordId);e.t=(w.start+w.end)/2;const m=genesisPoses(c,e,h),o=m.positions.find(o=>!o.isContext&&o.w.id===wordId);assert.equal(o.visible,true,wordId);assert.equal(o.opacity,1,wordId);const calls=[];drawGenesisTypography(c,e,{...h,word:(ctx,w)=>calls.push(w)});assert.ok(calls.includes(w));assert.ok(calls.every(w=>w.start<=e.t),`${id}: future lyric or name preview`)}
 }
});
test('primary phrases and name layers stay finite, onscreen, and vertically separated',()=>{
 const c=ctx();for(const id of Object.keys(GENESIS_CATALOG)){
  const e=env(id);for(let t=e.s.start;t<e.s.end;t+=.17){e.t=t;const m=genesisPoses(c,e,h);for(const o of m.positions){assert.ok([o.x,o.y,o.size,o.scale,o.opacity,o.rotate].every(Number.isFinite));h.setFont(c,o.size,o.family);const width=c.measureText(o.w.text.replace(/[.,:;]$/,'').toUpperCase()).width;assert.ok(o.x-width/2>=60&&o.x+width/2<=1860,`${id} ${o.w.text}: horizontal bounds`);assert.ok(o.y-o.size>=60&&o.y<=1020,`${id} ${o.w.text}: vertical bounds`);if(!o.isContext)assert.ok(o.y<=390||id==='genesis-forgiveness',`${id}: primary lyric outside protected band`)}
   const current=m.positions.filter(o=>o.visible&&!o.isContext);for(let i=0;i<current.length;i++)for(let j=i+1;j<current.length;j++){const a=current[i],b=current[j];if(Math.abs(a.y-b.y)>20)continue;h.setFont(c,a.size,a.family);const aw=c.measureText(a.w.text.replace(/[.,:;]$/,'').toUpperCase()).width;h.setFont(c,b.size,b.family);const bw=c.measureText(b.w.text.replace(/[.,:;]$/,'').toUpperCase()).width;assert.ok(Math.abs(a.x-b.x)>(aw+bw)/2,`${id}: ${a.w.text}/${b.w.text} overlap`)}
  }
 }
});
test('vengeance escalation obeys the actual seven, seventy, final seven, and Lamech cues',()=>{
 const e=env('genesis-vengeance'),seven=p.words.find(w=>w.id==='g4-l084-w04'),seventy=p.words.find(w=>w.id==='g4-l086-w00'),last=p.words.find(w=>w.id==='g4-l086-w02');
 assert.equal(genesisState({...e,t:seven.start-.001}).sevenReveal,0);assert.equal(genesisState({...e,t:seven.start+.5}).sevenReveal,1);
 assert.equal(genesisState({...e,t:seventy.start-.001}).multiplication,0);assert.equal(genesisState({...e,t:seventy.start+.8}).multiplication,1);
 assert.equal(genesisState({...e,t:last.start-.001}).rupture,0);assert.equal(genesisState({...e,t:last.start+.5}).rupture,1);
 const m=genesisPoses(ctx(),{...e,t:last.end},h);assert.deepEqual(m.positions.filter(o=>o.visible&&!o.isContext).map(o=>o.w.text),['seventy','times','seven.']);assert.ok(!m.positions.some(o=>o.w.text==='77'),'the numeral does not replace or manufacture a sung word');
});
test('forgiveness is a sustained release and separate interpretive text does not enter lyric cues',()=>{
 const e=env('genesis-forgiveness'),start=e.s.start,c=ctx(),captions=[],calls=[],proxy=new Proxy(c,{get(target,key){if(key==='fillText')return text=>captions.push(text);const v=target[key];return typeof v==='function'?v.bind(target):v},set(target,key,value){target[key]=value;return true}});
 assert.equal(genesisState({...e,t:start}).release,0);assert.ok(genesisState({...e,t:start+1.75}).release>.45);assert.equal(genesisState({...e,t:start+3.5}).release,1);
 drawGenesisTypography(proxy,{...e,t:e.s.end-.1},{...h,word:(ctx,w)=>calls.push(w)});
 assert.deepEqual(captions,['CHRIST · MATTHEW 18:22','FORGIVE WITHOUT LIMIT']);assert.ok(calls.every(w=>p.words.includes(w)));assert.ok(calls.every(w=>e.s.wordIds.includes(w.id)));
});
test('genealogy has correct sibling branches, canonical LXX names, and no unsung Enos preview',()=>{
 for(const parent of ['ADAM','EVE'])for(const child of ['CAIN','ABEL','SETH'])assert.ok(GENESIS_ANCESTRY.some(([a,b])=>a===parent&&b===child));
 assert.ok(GENESIS_ANCESTRY.some(([a,b])=>a==='SETH'&&b==='ENOS'));assert.ok(!GENESIS_ANCESTRY.some(([a,b])=>a==='CAIN'&&b==='SETH'));
 const c=ctx(),e=env('genesis-lineage-prayer'),enos=p.words.find(w=>w.id==='g4-l092-w03');
 assert.equal(genesisPoses(c,{...e,t:enos.start-.001},h).tree.nodes.find(n=>n.n==='ENOS').visible,false);
 assert.equal(genesisPoses(c,{...e,t:enos.start+.001},h).tree.nodes.find(n=>n.n==='ENOS').visible,true);
 const close=genesisPoses(c,env('genesis-lineage-resolution'),h);assert.deepEqual(close.tree.nodes.filter(n=>n.dim).map(n=>n.n),['CAIN','ENOCH','GAIDAD','MALELEEL','MATHUSALA','LAMECH']);assert.equal(close.tree.nodes.find(n=>n.n==='ABEL').dim,false,'Abel must not receive the Cain-branch moral color');
 assert.notDeepEqual(raster(env('genesis-lineage-resolution',300)),raster(env('genesis-lineage-resolution',304.5)),'closing lineage performs a deliberate luminous traversal');
});
test('unknown selectors fall back without painting or creating content',()=>{
 const e=env('genesis-lineage-prayer');e.s.direction.choreography='unknown';assert.equal(genesisPoses(ctx(),e,h),null);assert.equal(drawGenesisBackground(ctx(),e,h),false);assert.equal(drawGenesisTypography(ctx(),e,h),false);
});
test('context name labels remove punctuation without changing source lyrics',()=>{
 const e=env('genesis-lineage-seed',279.5),c=ctx(),captions=[],calls=[],before=JSON.stringify(p.words);
 const proxy=new Proxy(c,{get(target,key){if(key==='fillText')return text=>captions.push(text);const v=target[key];return typeof v==='function'?v.bind(target):v},set(target,key,value){target[key]=value;return true}});
 drawGenesisTypography(proxy,e,{...h,word:(ctx,w)=>calls.push(w)});
 assert.deepEqual(captions,['ADAM','EVE','SETH']);assert.ok(calls.every(w=>p.words.includes(w)));assert.equal(JSON.stringify(p.words),before);
});
