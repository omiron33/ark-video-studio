#!/usr/bin/env node
/** Authored Genesis 4 production. Canonical acoustic cues remain immutable here. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createSong} from '../engine/create.mjs';
import {atomicJson,digest,fileHash,loadProject} from '../engine/project.mjs';
import {reviewAudio} from '../engine/audio-review.mjs';
import {captureSceneEvidence} from '../engine/director.mjs';
import {reviewLyricVisibility} from '../engine/ocr.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'projects/genesis4-source');
export const runDir=path.join(root,'output/genesis4-production');
const clone=structuredClone;
const key=t=>String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9']/g,'');
export const stylePrompt='Dark gritty Genesis 4 lyric film: charcoal, bone and dried rust. Words lead every action. Fast purposeful succession, sharp kinetic typography, drawn fractures, perspective tunnels, plucked strings and branching lineage. Immediate action in the instrumental opening. Cain and Abel begin human and tender, rejection becomes unstable, murder cuts hard, judgment feels immense, exile isolated, descendants restless, Lamech heavy, Seth and Enos restrained hope. Vary motion and font roles; short bursts contrast with real rests. Selected unique cinematic backdrops support the authored story. No recycled scene artwork, decorative flash barrage, invented lyrics or uniform slow pans.';

// Each entry names exact canonical lyric lines, never guessed seconds.
const combinations=new Map([[9,10],[12,13],[33,34],[37,38],[44,45],[56,58],[61,62],[68,69],[74,75],[88,89],[91,92],[93,94]]);
const pictures=new Map([[3,'brothers'],[12,'offering'],[27,'brother-struggle'],[28,'christ-judgment'],[33,'blood-earth'],[56,'exile'],[61,'city'],[77,'forge'],[88,'new-seed'],[93,'christ-hope']]);
const families=['Bebas Neue','Cinzel','Archivo Black','Rubik Dirt','Stardos Stencil','EB Garamond'];
const heroKeys=new Set('adam eve cain abel sheep ground offering sacrifices regard grieved face fallen rightly divide sinned still rule plain rose killed brother where know keeper done blood voice cries cursed earth mouth hand strength groan tremble crime forgiven cast hidden kill not vengeance sevenfold mark nod edem enoch gaidad maleleel mathusala lamech ada sella jobel jubal psaltery harp thobel brass iron noema hear voice listen sorrow grief seventy times seven seth seed enos lord god'.split(' '));
function modeFor(n){
 if(n<=3)return 'lineage';if(n<=5)return 'fracture';if(n<=11)return n%2?'eclipse':'strings';
 if(n<=15)return 'fracture';if(n<=18)return 'vortex';if(n<=23)return n===22?'breath':'fracture';
 if(n<=27)return n===27?'fracture':'vortex';if(n<=32)return n===31?'eclipse':'fracture';
 if(n<=38)return 'fracture';if(n<=42)return 'vortex';if(n<=50)return n===45?'eclipse':'fracture';
 if(n<=55)return n===53?'count':'eclipse';if(n<=58)return 'fracture';if(n<=72)return 'lineage';
 if(n<=75)return 'strings';if(n<=78)return 'scorch';if(n<=83)return n===81?'vortex':'fracture';
 if(n<=86)return 'count';return n>=93?'strings':'lineage';
}
function splitRows(ws){
 const rows=[];let row=[],count=0;
 for(const w of ws){if(row.length&&(count+w.text.length>26||row.length>=5)){rows.push(row);row=[];count=0;}row.push(w.id);count+=w.text.length+1;}
 if(row.length)rows.push(row);return rows;
}
function songSection(project,index,lastIndex){
 const ws=project.words.filter(w=>{const n=Number(w.id.match(/^g4-l(\d+)-/)?.[1]);return n>=index&&n<=lastIndex;});
 if(!ws.length)throw Error(`No canonical words for line ${index}`);
 const mode=modeFor(index),photo=pictures.get(index),heavy=index>=79&&index<=86,hope=index>=87;
 const font=heavy?(index%2?'Rubik Dirt':'Archivo Black'):index<12?(index%3?'Bebas Neue':'Cinzel'):hope?(index%2?'Cinzel':'EB Garamond'):families[(index*5+Math.floor(index/7))%families.length];
 const lines=splitRows(ws),left=[3,12,28,56,77,88,93].includes(index);
 const d={mode,label:'',marker:'',gritty:true,colorGrade:'red-black-white',graphicStrength:heavy?.70:.62,fontFamily:font,connectorFont:'EB Garamond',typeSize:lines.length>=4?155:lines.length===3?215:285,lines,
  textBox:left?{x:180,y:210,w:1300,h:650}:{x:170,y:190,w:1580,h:700},align:left?'left':'center',
  accent:hope?'#f4eeee':heavy?'#f04a58':'#e95861',
  heroIds:ws.filter(w=>heroKeys.has(key(w.text))).map(w=>w.id),
  kinetic:{mode:heavy?'strike':index%3===0?'split':index%3===1?'cascade':'strike',amount:heavy?1:.78,seconds:.17},
 };
 if(photo)Object.assign(d,{photo,photoRequired:true,pan:index%2?1:-1,zoom:1.07});
 if(hope)d.graphicStrength=.4;
 if([53,84,85,86].includes(index)){d.number=index===53?7:70;d.graphicStrength=.52;}
 const actions=[],get=k=>ws.find(w=>key(w.text)===k),all=ws.map(w=>w.id);
 const move=(trigger,targetIds,to,{from={},after='start',duration=.55,afterTargets=false,...rest}={})=>{if(trigger&&targetIds.length)actions.push({triggerId:trigger.id,targetIds,from,to,after,duration,afterTargets,...rest});};
 if(index===15||index===18)move(get('fallen')||get('fell'),all,{dy:70},{after:'end',duration:.6});
 if(index===20){const divide=get('divide');move(divide,lines[0],{dx:-80},{after:'end'});if(lines[1])move(divide,lines[1],{dx:80},{after:'end'});}
 if(index===26)move(get('rose'),all,{dy:-70},{after:'end'});
 if(index===27){d.fontFamily='Rubik Dirt';d.heroIds=ws.filter(w=>['killed','brother'].includes(key(w.text))).map(w=>w.id);d.lines=[all.slice(0,2),all.slice(2)];d.textBox={x:100,y:70,w:920,h:370};d.typeSize=195;d.graphicStrength=.22;d.kinetic={mode:'strike',amount:1.15,seconds:.14};}
 if(index===29){d.typeSize=310;d.fontFamily='Cinzel';}
 if(index===33)move(get('voice'),all,{dy:-42},{after:'end',afterTargets:true,duration:.8});
 if(index===35)move(get('cursed'),ws.filter(w=>['cursed','earth'].includes(key(w.text))).map(w=>w.id),{dy:52},{after:'end',afterTargets:true});
 if(index===40){const strength=get('strength');if(strength)d.fragments={[strength.id]:{triggerId:strength.id,delay:.3,duration:.8}};}
 if(index===46)move(get('out'),all,{dx:95},{after:'end',afterTargets:true});
 if(index===48)move(get('hidden'),all,{dy:32},{after:'end',afterTargets:true});
 if(index===51){d.fontFamily='Archivo Black';d.typeSize=285;d.accent='#ffffff';}
 if(index===54){const mark=get('mark');move(mark,mark?[mark.id]:[],{scale:1.1},{origin:{x:960,y:540},after:'end'});}
 if(index>=63&&index<=66){d.fontFamily='Stardos Stencil';d.connectorFont='EB Garamond';d.graphicStrength=.68;move(ws.at(-1),all,{dx:40},{after:'end',duration:.6});}
 if(index===80){d.fontFamily='Rubik Dirt';d.typeSize=270;}
 if(index===82||index===83){d.kinetic={mode:'strike',amount:1.1,seconds:.14};d.typeSize=280;}
 if(index===86){d.fontFamily='Archivo Black';d.typeSize=340;d.lines=[all];d.uniform=true;d.countTimeline={start:ws[0].start,end:ws.at(-1).end,from:7,to:490};}
 if(index===88)move(get('raised'),all,{dy:-35},{after:'end',afterTargets:true,duration:.8});
 if(actions.length)d.actions=actions;
 return {id:`g4-scene-${String(index).padStart(3,'0')}`,style:'story',wordIds:all,assetIds:photo?[photo]:[],seed:parseInt(digest(`genesis4:${index}`).slice(0,7),16),direction:d,_first:ws[0].start,_last:Math.max(...ws.map(w=>w.end))};
}
function instrumental(id,start,end,direction){return{id:`g4-${id}`,start,end,style:'story',wordIds:[],assetIds:direction.photo?[direction.photo]:[],seed:parseInt(digest(id).slice(0,7),16),direction:{label:'',marker:'',gritty:true,colorGrade:'red-black-white',graphicStrength:.65,fontFamily:'Bebas Neue',...direction}};}

export async function authorGenesis4({project}){
 const p=clone(project),manifestDir=path.join(runDir,'project'),fps=p.fps,frame=t=>Math.round(t*fps)/fps;
 p.palette={ink:'#030305',paper:'#f5f3ef',accent:'#ed4657'};
 for(const id of ['christ-eden','christ-judgment','christ-hope']){
  const file=`${id}.png`;await fs.copyFile(path.join(source,'assets',file),path.join(manifestDir,'assets',file));
  p.assets[id]={type:'image',src:`assets/${file}`,provenance:{provider:'OpenAI built-in GPT Image',subject:'Embodied human Jesus with divine energy, photoreal primordial biblical world'}};
 }
 await fs.copyFile(path.join(source,'assets/brother-struggle.png'),path.join(manifestDir,'assets/brother-struggle.png'));
 p.assets['brother-struggle']={type:'image',src:'assets/brother-struggle.png',provenance:{provider:'OpenAI built-in GPT Image',subject:'Cain attacks Abel with a wooden club; grounded photoreal physical struggle, no graphic gore'}};
 const fontFiles=[['dirt','RubikDirt-Regular.ttf','Rubik Dirt','OFL-rubikdirt.txt'],['stencil','StardosStencil-Bold.ttf','Stardos Stencil','OFL-stardosstencil.txt'],['cinzel','Cinzel-Variable.ttf','Cinzel','OFL-cinzel.txt'],['eb','EBGaramond-Italic-Variable.ttf','EB Garamond','OFL-ebgaramond.txt']];
 for(const[id,file,family,license]of fontFiles){await fs.copyFile(path.join(root,'assets/fonts',file),path.join(manifestDir,'assets',file));await fs.copyFile(path.join(root,'assets/fonts',license),path.join(manifestDir,'assets',license));p.assets[id]={type:'font',src:`assets/${file}`,family};}
 const scenes=[];
 for(let i=0;i<95;i++){const last=combinations.get(i)??i;scenes.push(songSection(p,i,last));i=last;}
 // A cut is chosen inside the measured inter-phrase interval. Never move a cue.
 for(let i=0;i<scenes.length-1;i++){
  const a=scenes[i],b=scenes[i+1],lo=Math.ceil(a._last*fps-1e-6)/fps,hi=Math.floor(b._first*fps+1e-6)/fps;
  const cut=lo<=hi?Math.max(lo,Math.min(hi,frame((a._last+b._first)/2))):frame(b._first);
  a.end=cut;b.start=cut;
 }
 const first=scenes[0],introEnd=frame(Math.max(0,first._first-.06));first.start=introEnd;
 const all=[];
 if(introEnd>=6){
  const a=frame(Math.min(2.4,introEnd*.25)),b=frame(Math.min(5.7,introEnd*.58));
  all.push(instrumental('opening-strike',0,a,{mode:'fracture',title:'GENESIS 4',fontFamily:'Archivo Black'}));
  all.push(instrumental('opening-blood',a,b,{mode:'vortex',title:"THE BROTHER'S BLOOD",titleSize:142,titleFont:'Rubik Dirt'}));
  all.push(instrumental('opening-eclipse',b,introEnd,{mode:'eclipse',title:'GENESIS 4',titleSize:190,titleFont:'Cinzel',photo:'christ-eden',photoRequired:true}));
 }else if(introEnd>0)all.push(instrumental('opening-strike',0,introEnd,{mode:'fracture',title:'GENESIS 4'}));
 for(let i=0;i<scenes.length;i++){
  const s=scenes[i],next=scenes[i+1];
  if(next&&next._first-s._last>5){
   const start=frame(s._last+.45),end=frame(next._first-.12);s.end=start;next.start=end;all.push(s);
   const mid=frame((start+end)/2);
   all.push(instrumental(`rest-${i}-a`,start,mid,{mode:i<50?'vortex':'lineage'}),instrumental(`rest-${i}-b`,mid,end,{mode:i<50?'fracture':'strings'}));
  }else all.push(s);
 }
 const last=scenes.at(-1),endStart=frame(Math.min(p.duration,last._last+.6));last.end=endStart;
 if(p.duration-endStart>5){const mid=frame(endStart+(p.duration-endStart)*.48);all.push(instrumental('ending-life',endStart,mid,{mode:'lineage',graphicStrength:.48,accent:'#eeeeee'}),instrumental('ending-title',mid,p.duration,{mode:'strings',title:"THE BROTHER'S BLOOD",titleSize:135,titleFont:'Cinzel',fadeOut:true,graphicStrength:.45,accent:'#eeeeee'}));}
 else if(endStart<p.duration)last.end=p.duration;
 for(const s of all){delete s._first;delete s._last;}
 p.sections=all;p.production={sourceSunoId:'dd723dc8-5303-4694-9553-6d29f9768d04',method:'Rook authored lyric-line scene plan',story:'Genesis 4',qualityTarget:'Polished review candidate; bounded correction, no perfection claim',steering:{palette:'red black white',world:'Photoreal gritty primordial creation outside Eden; fantastical celestial beings remain physical and believable',divinePresence:'Christophany: embodied human Jesus with divine energy flowing from him. Never an ethereal or abstract depiction of God.'}};
 return {project:p,method:'independent-agent-authored-genesis4',evidence:{storyArc:['brothers and offerings','rejection','murder','interrogation and blood','curse and exile','mark','descendants and invention','Lamech','Seth and Enos'],uniqueImageScenes:[...pictures],preservedWordsSha256:digest(p.words),assetRequests:[]}};
}

export async function encodedReviewPackage(options){
 const {project}=await loadProject(options.projectPath);await fs.mkdir(options.outDir,{recursive:true});
 // Section concatenation can end a few milliseconds before the nominal duration.
 // Sample inside the encoded video stream, including during the last outro frame.
 const probe=JSON.parse((await promisify(execFile)('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=duration','-of','json',options.videoPath])).stdout);
 const streamDuration=Number(probe.streams[0].duration);
 const captureProject={...project,duration:Math.min(project.duration,streamDuration-.001)};
 const scenes=new Array(project.sections.length);let cursor=0,completed=0;
 const capture=async()=>{while(cursor<project.sections.length){const s=cursor++,section=project.sections[s],sceneDir=path.join(options.outDir,section.id);await fs.mkdir(sceneDir,{recursive:true});
  const evidence=await captureSceneEvidence(captureProject,section,options.videoPath,sceneDir);
  scenes[s]={sectionId:section.id,start:section.start,end:section.end,lyrics:project.words.filter(w=>section.wordIds.includes(w.id)).map(w=>w.text).join(' '),...evidence};
  if(++completed%10===0)process.stderr.write(JSON.stringify({type:'encoded-review-evidence',scene:completed,total:project.sections.length})+'\n');
 }};
 await Promise.all([capture(),capture(),capture()]);
 const visibility=await reviewLyricVisibility({projectPath:options.projectPath,videoPath:options.videoPath,outDir:path.join(options.outDir,'ocr')});
 const packagePath=path.join(options.outDir,'independent-review-package.json');
 await atomicJson(packagePath,{kind:'encoded-evidence-for-independent-review',videoPath:options.videoPath,videoSha256:await fileHash(options.videoPath),projectPath:options.projectPath,scenes,lyricVisibility:visibility,scored:false});
 return{status:'pending',method:'independent-agent-review-pending',issues:['Encoded visual evidence awaits independent judgment.'],projectChanged:false,evidencePath:packagePath};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await createSong({audio:path.join(source,'assets/song.mp3'),lyrics:path.join(source,'sources/lyrics.txt'),timing:path.join(source,'sources/timing.json'),directionFile:path.join(source,'direction.json'),stylePrompt,outDir:runDir,title:"Genesis 4 — The Brother's Blood",id:'genesis4-brothers-blood',width:1920,height:1080,fps:30,maxPasses:2,resume:process.argv.includes('--resume'),replan:process.argv.includes('--replan'),onProgress:e=>process.stderr.write(JSON.stringify(e)+'\n')},{directProject:authorGenesis4,reviewAudio:options=>reviewAudio({...options,maxAttempts:2}),reviewVisual:encodedReviewPackage});
 console.log(JSON.stringify({status:result.status,result:result.result,error:result.error,reportPath:result.reportPath},null,2));
 if(result.status!=='finished')process.exitCode=2;
}
