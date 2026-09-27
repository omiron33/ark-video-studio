import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {planPacing,auditPacing} from '../engine/pacing.mjs';
import {drawFrame} from '../engine/visual.mjs';

function fixture(){
 const rows=[
  [0,3,[[.15,.45,'Across'],[.72,1,'the'],[1.30,1.6,'sea'],[1.91,2.3,'we'],[2.5,2.8,'go']]],
  [3,6,[[3.2,3.4,'Rise'],[3.48,3.66,'Break'],[3.76,4.1,'Run']]],
  [6,9.5,[[6.2,7.2,'Mercy'],[7.4,8.3,'remains']]],
  [9.5,15,[[10,11.3,'Still'],[11.5,12.2,'waters']]],
  [15,17,[[15.1,15.3,'And'],[15.46,15.65,'we'],[15.8,16,'come'],[16.18,16.35,'back'],[16.52,16.9,'home']]]
 ];
 const p={version:1,id:'phrasing',title:'Measured phrasing fixture',width:480,height:270,fps:30,duration:17,audio:{src:'fixture.wav',offset:0},assets:{},palette:{ink:'#080e13',paper:'#d8d3c5',accent:'#a17b65'},words:[],beats:[],sections:[]};
 rows.forEach(([start,end,ws],i)=>{const words=ws.map(([start,end,text],j)=>({id:`s${i}w${j}`,text,start,end,phraseId:`p${i}`,confidence:.95,provenance:{method:'fixture reviewed alignment',unaltered:true}}));p.words.push(...words);p.sections.push({id:`s${i}`,start,end,wordIds:words.map(w=>w.id),assetIds:[],style:'verse',seed:i+1,direction:{motif:'waves'}});});
 p.beats=[3.22,3.50,3.78].map(time=>({time,strength:.9,kind:'measured_onset',provenance:{method:'20ms RMS attack',tempoGrid:false}}));return p;
}
function pixels(p,t,layer='all',assets={}){const c=createCanvas(480,270),ctx=c.getContext('2d');drawFrame(ctx,p,assets,t,{layer});return Buffer.from(ctx.getImageData(0,0,480,270).data);}

test('phrase-led pacing creates supported contrast without mutating canonical evidence',()=>{
 const input=fixture(),snapshot=structuredClone(input),{project:p,evidence}=planPacing(input,{stylePrompt:'Dark gritty word art'});
 assert.deepEqual(input,snapshot);for(const field of ['words','beats','audio','assets'])assert.deepEqual(p[field],input[field]);
 assert.deepEqual(p.sections.map(s=>({id:s.id,start:s.start,end:s.end,wordIds:s.wordIds,assetIds:s.assetIds})),input.sections.map(s=>({id:s.id,start:s.start,end:s.end,wordIds:s.wordIds,assetIds:s.assetIds})));
 assert.deepEqual(p.sections.map(s=>s.direction.pacing.mode),['flow','accent-burst','held','slow-dissolve','flow']);
 assert.equal(evidence.method,'deterministic-evidence-led-visual-phrasing');assert.equal(evidence.aestheticApproval,false);
 assert.deepEqual(planPacing(p).project,p,'replanning is idempotent');assert.equal(auditPacing(p).passed,true);
});

test('bursts need three distinct measured attacks near consecutive canonical onsets',()=>{
 for(const mutate of [p=>p.beats.splice(1,1),p=>p.beats.forEach(b=>b.kind='supplied_beat'),p=>p.beats.forEach(b=>b.provenance.tempoGrid=true),p=>p.beats.forEach(b=>b.time-=.12),p=>p.words.find(w=>w.id==='s1w1').confidence='interpolated',p=>p.words.find(w=>w.id==='s1w1').phraseId='other']){
  const p=fixture();mutate(p);assert.equal(planPacing(p).project.sections.some(s=>s.direction.pacing.mode==='accent-burst'),false);
 }
 const p=planPacing(fixture()).project;p.beats[0].time+=.01;assert.equal(auditPacing(p).passed,false);assert.match(auditPacing(p).issues.join(' '),/measured accents/);
 const revised=planPacing(p).project;assert.equal(auditPacing(revised).passed,true);assert.equal(revised.sections[1].direction.pacing.hits[0].at,p.beats[0].time);
 p.sections[1].direction.pacing.hits=[null];assert.equal(auditPacing(p).passed,false);
});

test('burst choices are sparse, favor measured strength and do not rotate modes arbitrarily',()=>{
 const p=fixture(),base=structuredClone(p.sections[1]),words=p.words.filter(w=>base.wordIds.includes(w.id));
 p.words=[];p.sections=[];p.beats=[];p.duration=30;
 for(let i=0;i<10;i++){const ws=words.map(w=>({...w,id:`${w.id}-${i}`,phraseId:`p${i}`,start:w.start-3+i*3,end:w.end-3+i*3}));p.words.push(...ws);p.sections.push({...structuredClone(base),id:`s${i}`,start:i*3,end:i*3+3,wordIds:ws.map(w=>w.id)});p.beats.push(...ws.map(w=>({time:w.start+.02,strength:i===4?1:.6,kind:'measured_onset'})));}
 const planned=planPacing(p).project,bursts=planned.sections.map((s,i)=>s.direction.pacing.mode==='accent-burst'?i:null).filter(i=>i!==null);
 assert.ok(bursts.includes(4));for(let i=1;i<bursts.length;i++)assert.ok(bursts[i]-bursts[i-1]>=3);assert.ok(bursts.length<5);assert.equal(auditPacing(planned).passed,true);
});

test('calm modes preserve authored actions and invalid local dissolves fail audit',()=>{
 const p=fixture();p.sections[3].style='story';p.sections[3].direction={mode:'shelter',actions:[{triggerId:'s3w1',duration:.8,to:{dy:200}}]};
 assert.equal(planPacing(p).project.sections[3].direction.pacing.mode,'flow');
 const bad=planPacing(fixture()).project;bad.sections[3].direction.pacing.dissolve.duration=90;assert.equal(auditPacing(bad).passed,false);
});

test('frames stay deterministic out of order and planning does not mutate source while rendering',()=>{
 const p=planPacing(fixture()).project,before=structuredClone(p),times=[3.1,3.22,3.5,3.78,5,6.4,8,12,13,14.9];
 const frames=times.map(t=>pixels(p,t));for(const i of [7,2,9,0,4,1,8,5,3,6])assert.deepEqual(pixels(p,times[i]),frames[i]);assert.deepEqual(p,before);
 assert.equal(pixels(p,3.1,'type').some((v,i)=>i%4===3&&v>0),false,'no lyrics pre-reveal before their canonical onset');
});

test('accent pulses change addressed word typography and return to the complete readable phrase',()=>{
 const p=planPacing(fixture()).project,neutral=structuredClone(p);neutral.sections[1].direction.pacing.hits=[];
 for(const hit of p.sections[1].direction.pacing.hits){assert.notDeepEqual(pixels(p,hit.at+.01,'type'),pixels(neutral,hit.at+.01,'type'));assert.notDeepEqual(pixels(p,hit.at+.01,'background'),pixels(neutral,hit.at+.01,'background'));}
 assert.deepEqual(pixels(p,4.8,'type'),pixels(neutral,4.8,'type'),'burst never hides the already-sung phrase');
});

test('held background moves less and slow dissolve changes only supporting material',()=>{
 const p=planPacing(fixture()).project,flow=structuredClone(p);flow.sections[2].direction.pacing.mode='flow';
 const distance=(a,b)=>a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0);
 assert.ok(distance(pixels(p,7,'background'),pixels(p,8,'background'))<distance(pixels(flow,7,'background'),pixels(flow,8,'background')));
 const withoutDissolve=structuredClone(p);withoutDissolve.sections[3].direction.pacing.mode='held';
 assert.notDeepEqual(pixels(p,14.5,'background'),pixels(withoutDissolve,14.5,'background'));
 assert.deepEqual(pixels(p,14.5,'type'),pixels(withoutDissolve,14.5,'type'),'background dissolve leaves settled lyrics readable');
});

test('a photograph dissolves into scene-local line art with no new asset or neighboring dependency',()=>{
 const input=fixture(),s=input.sections[3];input.assets={scenePhoto:{type:'image',src:'unique-fixture.png'}};s.assetIds=['scenePhoto'];s.direction.photo='scenePhoto';
 const p=planPacing(input).project,photo=createCanvas(480,270),ctx=photo.getContext('2d');
 ctx.fillStyle='#604c31';ctx.fillRect(0,0,480,270);ctx.fillStyle='#9c7b49';ctx.fillRect(220,30,40,190);
 const assets={scenePhoto:photo},start=p.sections[3].direction.pacing.dissolve.start,end=start+p.sections[3].direction.pacing.dissolve.duration;
 assert.notDeepEqual(pixels(p,start,'background',assets),pixels(p,end-.01,'background',assets));
 const isolated=structuredClone(p);isolated.sections=isolated.sections.filter(s=>s.id==='s3');
 assert.deepEqual(pixels(p,end-.01,'all',assets),pixels(isolated,end-.01,'all',assets),'evaluation never reads a previous or next scene');
 assert.deepEqual(p.assets,input.assets);assert.deepEqual(p.sections[3].assetIds,['scenePhoto']);assert.equal(p.sections[3].direction.photo,'scenePhoto');
});

test('legacy render path remains identical to explicit flow with no performance claim',()=>{
 const p=fixture(),flow=structuredClone(p);flow.sections.forEach(s=>s.direction.pacing={version:1,mode:'flow',rationale:'Keep authored motion'});
 for(const time of [.5,3.6,7,12])assert.deepEqual(pixels(p,time),pixels(flow,time));
 const audit=auditPacing(p);assert.equal(audit.status,'not-planned');assert.equal(audit.evidence.aestheticApproval,false);
});

function openingFixture(){
 const p=fixture();p.title='Genesis Seven';p.duration=15;p.beats=[];p.words=[{id:'first',text:'Mercy',start:12,end:12.9,phraseId:'first',confidence:.95},{id:'second',text:'remains',start:13.2,end:14,phraseId:'first',confidence:.95}];
 p.sections=[{id:'opening',start:0,end:15,wordIds:['first','second'],assetIds:[],style:'verse',seed:1,direction:{motif:'contours'}}];p.creation={creativePolicy:{version:1,expressivePacing:true,immediateOpening:true}};return p;
}

test('long instrumental opening gets immediate title action and clears before canonical vocals',()=>{
 const source=openingFixture(),p=planPacing(source).project,h=p.sections[0].direction.pacing.hook;
 assert.equal(p.sections[0].direction.pacing.mode,'opening-hook');assert.equal(h.title,'Genesis Seven');assert.equal(h.start,0);assert.equal(h.end,11.88);assert.equal(h.firstVocalAt,12);assert.ok(h.settleAt<=.8);assert.ok(h.transformAt<=1.5);
 assert.deepEqual(p.words,source.words);assert.deepEqual(p.beats,[]);assert.equal(auditPacing(p).passed,true);assert.equal(p.sections[0].direction.pacing.hits,undefined);
 assert.equal(pixels(p,0,'type').some((v,i)=>i%4===3&&v>0),true,'actual title is visible on frame zero');
 for(const [a,b]of [[0,.3],[.3,.8],[2,5],[5,10]])assert.notDeepEqual(pixels(p,a),pixels(p,b),`opening composition develops between ${a}s and ${b}s`);
 assert.equal(pixels(p,11.95,'type').some((v,i)=>i%4===3&&v>0),false,'title is gone before first lyric');
 assert.equal(pixels(p,12.3,'type').some((v,i)=>i%4===3&&v>0),true,'canonical lyric remains visible');
 for(const time of [10,.2,5,0,12.3,.8])assert.deepEqual(pixels(p,time),pixels(p,time),'opening remains random-access safe');
});

test('future opening policy rejects a static intro, forged title, invented accents and stale vocal bounds',()=>{
 const unplanned=openingFixture();assert.equal(auditPacing(unplanned).passed,false);assert.match(auditPacing(unplanned).issues.join(' '),/Instrumental opening/);
 for(const change of [p=>p.sections[0].direction.pacing.hook.title='Invented story',p=>p.words[0].start=11,p=>p.sections[0].direction.pacing.hits=[{at:.2}],p=>p.sections[0].direction.pacing.mode='held']){
  const p=planPacing(openingFixture()).project;change(p);assert.equal(auditPacing(p).passed,false);
 }
 const repaired=planPacing(openingFixture()).project;repaired.words[0].start=11;const replanned=planPacing(repaired).project;assert.equal(replanned.sections[0].direction.pacing.hook.end,10.88);assert.equal(auditPacing(replanned).passed,true);
 const vocalFirst=openingFixture();vocalFirst.words[0].start=.1;assert.notEqual(planPacing(vocalFirst).project.sections[0].direction.pacing.mode,'opening-hook');
});

test('steady vocal phrases gain deliberate supporting contrast without fabricated musical accents',()=>{
 const p=fixture();p.words=[];p.sections=[];p.beats=[];p.duration=36;
 for(let i=0;i<12;i++){
  const ws=Array.from({length:6},(_,j)=>({id:`s${i}w${j}`,text:['Every','step','along','this','winding','road'][j],start:i*3+j*.5,end:i*3+j*.5+.46,phraseId:`p${i}`,confidence:.9}));
  p.words.push(...ws);p.sections.push({id:`s${i}`,start:i*3,end:i*3+3,wordIds:ws.map(w=>w.id),assetIds:[],style:'verse',seed:i,direction:{motif:'waves'}});
 }
 const planned=planPacing(p).project,modes=planned.sections.map(s=>s.direction.pacing.mode);
 assert.ok(modes.includes('held'),'steady half-second words still admit visual contrast');assert.equal(modes.includes('accent-burst'),false);assert.deepEqual(planned.words,p.words);assert.deepEqual(planned.beats,[]);
 assert.match(planned.sections.find(s=>s.direction.pacing.mode==='held').direction.pacing.rationale,/uninterrupted flow/);
 let run=0;for(const mode of modes){run=mode==='flow'?run+1:0;assert.ok(run<7,'does not wait indefinitely for rare beat coincidences');}
 assert.equal(auditPacing(planned).passed,true);
});
