#!/usr/bin/env node
/** Targeted direction revision of the accepted cut. Never realigns the song. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {atomicJson,digest} from '../engine/project.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const previous=JSON.parse(await fs.readFile(path.join(root,'projects/genesis4-full/project.json'),'utf8'));
const p=structuredClone(previous);
const plan={
  0:'branching-seed',1:'camera-micro',2:'camera-pullback',3:'balance-offering',4:'camera-arc',5:'camera-canyon',
  6:'camera-rail',7:'forge-assembly',8:'balance-offering',9:'camera-wall',11:'camera-rack',12:'refusal-bar',
  14:'falling-weight',15:'camera-stairwell',16:'camera-dolly',17:'negative-space',18:'falling-weight',
  19:'camera-runway',20:'split-verdict',21:'incision',22:'breath-resolve',23:'camera-horizon',
  24:'camera-switchback',25:'camera-switchback',26:'word-strike',
  29:'camera-tunnel',30:'refusal-bar',31:'camera-hinge',32:'incision',33:'echo-cry',35:'camera-canyon',
  36:'camera-micro',37:'camera-spiral',39:'camera-wall',40:'negative-space',41:'string-pluck',42:'camera-horizon',
  43:'camera-dolly',44:'falling-weight',46:'threshold-exile',47:'camera-pullback',48:'negative-space',
  49:'camera-stairwell',50:'word-strike',51:'split-verdict',52:'camera-rack',53:'tally-vengeance',
  54:'fingerprint-mark',55:'camera-arc',56:'threshold-exile',59:'camera-braid',60:'branching-seed',61:'forge-assembly',
  63:'camera-rail',64:'camera-rail',65:'camera-wall',66:'chain-lineage',67:'split-verdict',68:'camera-hinge',
  70:'camera-micro',71:'threshold-exile',72:'camera-canyon',73:'string-pluck',74:'camera-spiral',76:'chain-lineage',
  77:'forge-assembly',78:'camera-arc',79:'camera-hinge',80:'echo-cry',81:'camera-tunnel',82:'word-strike',
  83:'incision',84:'tally-vengeance',85:'camera-runway',86:'tally-vengeance',87:'camera-braid',88:'branching-seed',
  90:'camera-switchback',91:'camera-braid',93:'breath-resolve',
};
for(const s of p.sections){
 const n=Number(s.id.match(/scene-(\d+)/)?.[1]);
 if(!s.wordIds.length)continue;
 if(n===27||n===28){s.direction.authoredTreatment={id:n===27?'photographic-club-strike':'photographic-divine-question',description:n===27?'Preserved club attack: hard upper-left word strikes leave the physical struggle visible.':'Preserved embodied judgment: restrained left-aligned questioning over the accepted human Christophany.'};continue;}
 if(!plan[n])throw Error(`Missing scene ${n}`);
 s.direction.choreography=plan[n];
 // The new choreography owns movement. Old actions cannot compound with it.
 delete s.direction.kinetic;delete s.direction.actions;delete s.direction.fragments;
 s.direction.nativeMotion=false;s.direction.graphicStrength=s.direction.photo?.12:.43;
 s.direction.connectorFont='Bebas Neue';
 if(['Cinzel','Rubik Dirt','Stardos Stencil'].includes(s.direction.fontFamily))s.direction.fontFamily=n>=79&&n<=86?'Archivo Black':'Bebas Neue';
 // Preserve proven photo-safe boxes; camera scenes author their world positions.
 if(!s.direction.photo){s.direction.textBox={x:150,y:170,w:1620,h:750};s.direction.typeSize=250;}
 if(n===54){const mark=p.words.find(w=>s.wordIds.includes(w.id)&&/^mark\b/i.test(w.text));s.direction.heroIds=[mark.id];s.direction.triggerId=mark.id;}
 // Preserve measured accent bursts; eliminate old held-clock background overrides.
 if(['held','slow-dissolve'].includes(s.direction.pacing?.mode))s.direction.pacing={version:1,mode:'flow',policy:'lyric-choreography-v2',rationale:'A continuous authored camera or semantic move follows the phrase at its original musical pace.'};
}
function mergeScenes(ids,choreography,description){
 const originals=ids.map(id=>p.sections.find(s=>s.id===id));if(originals.some(s=>!s))throw Error('Missing merge section');
 const groups=originals.map(s=>[...s.wordIds]);
 const first=originals[0],last=originals.at(-1);first.end=last.end;first.wordIds=groups.flat();
 first.direction.choreography=choreography;first.direction.cameraGroups=groups;
 first.direction.choreographyNote=description;delete first.direction.lines;
 const removed=new Set(ids.slice(1));p.sections=p.sections.filter(s=>!removed.has(s.id));
}
mergeScenes(['g4-scene-024','g4-scene-025','g4-scene-026'],'camera-switchback','One continuous camera route follows the invitation, the journey to the plain and the rising confrontation; cuts only on the killing.');
mergeScenes(['g4-scene-063','g4-scene-064','g4-scene-065','g4-scene-066'],'camera-rail','One continuous lateral camera run connects four generations as sung, retaining their shared spatial lineage.');
p.assets['eden-altars-opening']={type:'image',src:'assets/eden-altars-opening.png',provenance:{provider:'OpenAI built-in GPT Image',subject:'Photoreal primordial basalt valley with two stone offering altars; modern severe landscape composition',promptFile:'sources/opening-provenance.json'}};
const opening=p.sections.find(s=>s.id==='g4-opening-eclipse');
opening.assetIds=['eden-altars-opening'];Object.assign(opening.direction,{photo:'eden-altars-opening',titleFont:'Archivo Black',fontFamily:'Archivo Black',titleMotion:'modern-chapter',titleSize:205,mode:'statement',zoom:1.055,pan:-1});
const subtitle=p.sections.find(s=>s.id==='g4-opening-blood');Object.assign(subtitle.direction,{titleFont:'Archivo Black',fontFamily:'Archivo Black',titleMotion:'editorial-reveal',mode:'statement',graphicStrength:.3});
const ending=p.sections.find(s=>s.id==='g4-ending-title');Object.assign(ending.direction,{titleFont:'Bebas Neue',titleMotion:'editorial-reveal',mode:'statement'});
// Wordless bridges change spatial language, without inventing captions or beats.
for(const [id,mode] of [['g4-rest-50-a','camera-tunnel'],['g4-rest-50-b','camera-horizon'],['g4-ending-life','camera-pullback']])p.sections.find(s=>s.id===id).direction.choreography=mode;
p.creation.creativePolicy.choreography={version:1,minDistinct:30,maxUses:3,noRepeatedTriples:true};
p.production={...p.production,revision:'Spatial lyric choreography v2',basedOn:'Accepted Genesis 4 film b3648decb79c77c99f6b670406019c659faf0fb216ac4e0dcb3f427e07548eca',editBrief:'Keep the film core; replace the repetitive sequence with distinct word-driven scenes, following-camera worlds, and a contemporary title over a new photograph. Match the song pace; never make variety an excuse for frantic motion.',canonicalWordsSha256:digest(previous.words),preservedIntervals:['g4-scene-027','g4-scene-028']};
if(digest(p.words)!==digest(previous.words)||digest(p.audio)!==digest(previous.audio)||digest(p.beats)!==digest(previous.beats))throw Error('Revision changed source timing or music');
const counts={};for(const s of p.sections.filter(s=>s.wordIds.length)){const id=s.direction.choreography||s.direction.authoredTreatment?.id;counts[id]=(counts[id]||0)+1;}
if(Math.max(...Object.values(counts))>3)throw Error('Choreography exceeds three uses: '+JSON.stringify(counts));
if(Object.keys(counts).length<30)throw Error('Not enough distinct choreography');
await atomicJson(path.join(root,'projects/genesis4-motion-v2/project.json'),p);
await atomicJson(path.join(root,'projects/genesis4-motion-v2/review/direction-plan.json'),{canonicalWordsUnchanged:true,audioUnchanged:true,beatsUnchanged:true,distinctTreatments:Object.keys(counts).length,maxUses:Math.max(...Object.values(counts)),counts,scenes:p.sections.map(s=>({id:s.id,start:s.start,end:s.end,treatment:s.direction.choreography||s.direction.authoredTreatment||s.direction.titleMotion||s.direction.mode,lyrics:p.words.filter(w=>s.wordIds.includes(w.id)).map(w=>w.text).join(' ')}))});
console.log(JSON.stringify({sections:p.sections.length,words:p.words.length,distinct:Object.keys(counts).length,counts},null,2));
