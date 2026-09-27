#!/usr/bin/env node
import fs from 'node:fs/promises';
const file='projects/genesis7-full/project.json',p=JSON.parse(await fs.readFile(file,'utf8'));
const fonts=JSON.parse(await fs.readFile('projects/genesis7-full/assets/font-provenance.json','utf8'));
for(const f of fonts)p.assets[f.id]={type:'font',src:f.src,family:f.family};
p.palette={ink:'#080e13',paper:'#bec5c4',accent:'#a17b65',muted:'#73878e'};
const families={overture:'Cinzel',names:'IM FELL English',gateway:'Barlow Condensed',pairs:'Barlow Condensed',family:'IM FELL English',calendar:'Cinzel',count:'Cinzel',birds:'Barlow Condensed',rain:'Anton',rupture:'Anton',deep:'Anton',lift:'Bebas Neue',drift:'Barlow Condensed',map:'IM FELL English',absence:'IM FELL English',sweep:'Barlow Condensed',shelter:'Barlow Condensed',breath:'IM FELL English',horizon:'Bebas Neue',engulf:'Anton',seal:'Cinzel'};
for(const s of p.sections){
 const d=s.direction;d.gritty=true;d.light=false;d.label='';d.marker='';d.connectorFont='IM FELL English';
 d.fontFamily=families[d.mode]||'Bebas Neue';
 d.accent=['rain','rupture','deep','lift','drift','horizon','engulf','absence'].includes(d.mode)?'#82979c':'#a17b65';
 if(s.style==='rise')d.wipeColor='#141d23';
 if(s.style==='terrain'){d.dark=true;d.palette={paper:'#141d23',ink:'#c0c7c6',accent:'#83969c'};}
}
const by=id=>p.sections.find(s=>s.id===id),pos=(x,y,size,family='Bebas Neue',rotate=0)=>({x,y,size,family,rotate});
// Keep the drowned-world epilogue within the story: no reappearance of mountains.
Object.assign(by('g7-ending-near-water'),{assetIds:[]});
Object.assign(by('g7-ending-near-water').direction,{photo:null,water:false,mode:'horizon',horizonTravel:true,ark:true});
const roads=by('g7-roads-homes-ground').direction;
roads.positions['g7-s14-l14-w00']=pos(425,865,90,'IM FELL English');
roads.positions['g7-s14-l14-w01']=pos(870,865,150,'IM FELL English');
roads.positions['g7-s14-l14-w02']=pos(1450,865,176,'Bebas Neue');
roads.mode='engulf';roads.heroIds=['g7-s14-l14-w02'];
const above=by('g7-above-them').direction;
above.mode='shelter';above.nativeMotion=false;above.textBox={x:350,y:690,w:1220,h:260};
above.positions={
 'g7-s16-l08-w00':pos(630,875,125,'IM FELL English'),'g7-s16-l08-w01':pos(995,875,88,'IM FELL English'),'g7-s16-l08-w02':pos(1240,885,208),
 'g7-s16-l09-w00':pos(790,320,290),'g7-s16-l09-w01':pos(1330,320,136,'IM FELL English'),
 'g7-s16-l10-w00':pos(300,595,95,'IM FELL English'),'g7-s16-l10-w01':pos(740,615,222),'g7-s16-l10-w02':pos(1230,615,146,'Barlow Condensed'),'g7-s16-l10-w03':pos(1600,615,160,'Barlow Condensed')
};
above.heroIds=['g7-s16-l09-w00','g7-s16-l10-w01'];
above.actions=[{triggerId:'g7-s16-l09-w00',targetIds:['g7-s16-l09-w00','g7-s16-l09-w01'],duration:.75,from:{dy:110},to:{dy:0}},{triggerId:'g7-s16-l10-w03',targetIds:['g7-s16-l10-w00','g7-s16-l10-w01','g7-s16-l10-w02','g7-s16-l10-w03'],duration:.9,to:{dx:55},origin:{x:960,y:615}}];
const sweep=by('g7-forty-days-sweep'),sw=sweep.direction,old=sweep.wordIds.filter(id=>id.startsWith('g7-s03-l02-')||id.startsWith('g7-s03-l03-'));
sw.actions=[...(sw.actions||[]),{triggerId:'g7-s03-l04-w02',targetIds:old,afterTargets:true,duration:.8,to:{dx:-220,opacity:0}}];
const birds=by('g7-continuation'),bd=birds.direction;
const across=birds.wordIds.filter(id=>id.startsWith('g7-s01-l13-'));
bd.curves={'g7-s01-l13-w05':{amplitude:24}};
bd.actions=[...(bd.actions||[]),{triggerId:across[0],targetIds:across,duration:1.8,from:{dx:-170,dy:45},to:{dx:80,dy:-20}}];
// Differentiate the opening voice from the later procession's stacked phrases.
const voice=by('g7-the-voice').direction;voice.fontFamily='Cinzel';voice.nativeMotion=false;
voice.positions={
 'g7-s01-l00-w00':pos(275,660,110,'Barlow Condensed',-Math.PI/2),
 'g7-s01-l00-w01':pos(645,270,96,'IM FELL English'),
 'g7-s01-l00-w02':pos(1130,485,305,'Cinzel'),
 'g7-s01-l00-w03':pos(690,705,108,'IM FELL English'),
 'g7-s01-l00-w04':pos(955,705,90,'IM FELL English'),
 'g7-s01-l00-w05':pos(1300,895,270,'Bebas Neue')
};
voice.heroIds=['g7-s01-l00-w02'];voice.actions=[{triggerId:'g7-s01-l00-w05',targetIds:['g7-s01-l00-w02'],duration:.7,from:{scale:1.1},to:{scale:1}}];
p.artDirection.theme='Charcoal, storm slate, weathered silver and restrained rust; full-film direction revised from user feedback.';
p.artDirection.photoCoverageSeconds=p.sections.filter(s=>s.direction.photo).reduce((sum,s)=>sum+s.end-s.start,0);
p.artDirection.graphicCoverageSeconds=p.duration-p.artDirection.photoCoverageSeconds;
await fs.writeFile(file,JSON.stringify(p,null,2)+'\n');
console.log(JSON.stringify({scenes:p.sections.length,fonts:Object.values(p.assets).filter(a=>a.type==='font').map(a=>a.family),graphicPercent:p.artDirection.graphicCoverageSeconds/p.duration*100}));
