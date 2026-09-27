#!/usr/bin/env node
/** Targeted v3 edit. Never run over subsequent manual direction changes. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {atomicJson,digest} from '../engine/project.mjs';
const root=path.resolve(new URL('..',import.meta.url).pathname),base=path.join(root,'projects/genesis4-motion-v2/project.json'),dest=path.join(root,'projects/genesis4-motion-v3');
const previous=JSON.parse(await fs.readFile(base,'utf8')),p=structuredClone(previous);
p.id='genesis4-motion-v3';p.title='Genesis 4 — Vengeance and Mercy';
const repairs=JSON.parse(await fs.readFile(path.join(dest,'sources/measured-cue-repairs.json'),'utf8'));
for(const repair of repairs.repairs){const w=p.words.find(w=>w.id===repair.id);if(!w||w.start!==repair.expectedStart||w.end!==repair.expectedEnd)throw Error(`Stale cue evidence ${repair.id}`);w.start=repair.start;w.end=repair.end;w.correction={method:'paired-local-alignment',source:'sources/measured-cue-repairs.json',originalStart:repair.expectedStart,originalEnd:repair.expectedEnd};}
for(const s of p.sections)s.direction.lyricOnset='immediate';
const get=id=>{const s=p.sections.find(s=>s.id===id);if(!s)throw Error(`Unknown section ${id}`);return s;};
function treatment(id,choreography,extra={}){const s=get(id);for(const key of ['positions','cameraGroups','actions','kinetic','authoredTreatment','title','titleMotion','genesis'])delete s.direction[key];s.direction={...s.direction,choreography,lyricOnset:'immediate',...extra};return s;}
const replacements={
 'g4-scene-004':'word-orbit',
 'g4-scene-018':'stone-crush',
 'g4-scene-030':'redaction-slab',
 'g4-scene-035':'concentric-rupture',
 'g4-scene-039':'torn-monument',
 'g4-scene-042':'shadow-procession',
 'g4-scene-048':'eclipse-disc',
 'g4-scene-054':'mark-seal',
 'g4-scene-055':'monolith-rise',
 'g4-scene-068':'crescent-sweep'
};
for(const [id,mode]of Object.entries(replacements))treatment(id,mode,{textBox:{x:180,y:220,w:1560,h:660}});
function merge(ids,mode){const selected=ids.map(get),first=selected[0],last=selected.at(-1),groups=selected.map(s=>[...s.wordIds]);first.end=last.end;first.wordIds=selected.flatMap(s=>s.wordIds);first.assetIds=[...new Set(selected.flatMap(s=>s.assetIds))];p.sections=p.sections.filter(s=>s===first||!ids.includes(s.id));treatment(first.id,mode,{genesis:{lyricGroups:groups}});return first;}
merge(['g4-scene-059','g4-scene-060'],'genesis-lineage-cain');
treatment('g4-scene-063','genesis-lineage-cain');
const vengeance=merge(['g4-scene-084','g4-scene-085','g4-scene-086'],'genesis-vengeance');
vengeance.direction.genesis.interpretiveNumber=77;
p.assets['christ-mercy']={type:'image',src:'assets/christ-mercy.png'};
const mercy=treatment('g4-scene-087','genesis-forgiveness',{photo:'christ-mercy',photoShade:.3,textBox:{x:160,y:730,w:1520,h:230},genesis:{interpretiveLabel:'CHRIST · MATTHEW 18:22',interpretiveSubtitle:'FORGIVE WITHOUT LIMIT'}});
mercy.assetIds=[...mercy.assetIds,'christ-mercy'];
treatment('g4-scene-088','genesis-lineage-seed');
treatment('g4-scene-091','genesis-lineage-prayer');
treatment('g4-ending-life','genesis-lineage-resolution',{label:'GENESIS 4',marker:'ANOTHER SEED'});
p.creation.stylePrompt+=' Revision: bold circular masses, thick silhouettes and materially different word actions replace ten repeated linear scenes. Continuous seven to seventy-seven vengeance transforms into explicitly labeled Matthew18:22 unlimited forgiveness. Preserve the actual sung wording seventy times seven. Accurate ancestor graphs and luminous newly sung patriarch names carry the closing family narrative. Immediate visible lyric onsets and conservatively measured source cue corrections.';
p.creation.creativePolicy.requiredArtworkSections=[...new Set([...p.creation.creativePolicy.requiredArtworkSections,'g4-scene-087'])];
p.production={...p.production,revision:{parentProject:'../genesis4-motion-v2/project.json',parentVideoSha256:'21a351db6f10d75e48dd32afeb399ee10b608737259f416458f686c7c94e5777',brief:'Tighter sync, new circular and silhouette animations, pivotal violence-to-forgiveness inversion, luminous correct genealogies.',audioUnchanged:digest(p.audio)===digest(previous.audio),beatsUnchanged:digest(p.beats)===digest(previous.beats),canonicalTextUnchanged:p.words.every((w,i)=>w.id===previous.words[i].id&&w.text===previous.words[i].text),measuredCueRepairs:repairs.repairs.map(r=>r.id),theology:'sources/orthodox-reading.md'}};
if(!p.production.revision.audioUnchanged||!p.production.revision.beatsUnchanged||!p.production.revision.canonicalTextUnchanged)throw Error('Unexpected source modification');
await atomicJson(path.join(dest,'project.json'),p);
const counts={};for(const s of p.sections.filter(s=>s.wordIds.length)){const id=s.direction.choreography||s.direction.authoredTreatment?.id;counts[id]=(counts[id]||0)+1;}
await atomicJson(path.join(dest,'review/direction-plan.json'),{parentVideo:p.production.revision.parentVideoSha256,measuredCueRepairs:repairs.repairs.map(r=>({id:r.id,old:r.expectedStart,new:r.start})),distinctTreatments:Object.keys(counts).length,maxUses:Math.max(...Object.values(counts)),counts,replacedLinearScenes:replacements,scenes:p.sections.map(s=>({id:s.id,start:s.start,end:s.end,treatment:s.direction.choreography||s.direction.authoredTreatment||s.direction.mode,lyrics:p.words.filter(w=>s.wordIds.includes(w.id)).map(w=>w.text).join(' ')}))});
console.log(JSON.stringify({sections:p.sections.length,words:p.words.length,distinct:Object.keys(counts).length,counts},null,2));
