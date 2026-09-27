window.G1_SCENES=window.G1_SCENES||{};
window.G1_SCENE_META=window.G1_SCENE_META||{};
window.buildGenesisFilm=function({tl,stage,data}){
 const theme={ink:'#10100f',bone:'#f0e4cc',rust:'#a45636',amber:'#c59659',muted:'#665447'};
 const fonts={condensed:'Bebas',heavy:'Archivo',serif:'Elegy',mono:'PlexMono'};
 const measure=document.createElement('canvas').getContext('2d');
 const E=(tag,cls,parent=stage,style={})=>{const e=document.createElement(tag);e.className=cls;Object.assign(e.style,style);parent.appendChild(e);return e};
 const rect=(p,x,y,w,h,c=theme.rust)=>E('i','g1-form',p,{left:x+'px',top:y+'px',width:w+'px',height:h+'px',background:c});
 const ring=(p,x,y,d,s=8,c=theme.rust)=>E('i','g1-form',p,{left:x+'px',top:y+'px',width:d+'px',height:d+'px',border:s+'px solid '+c,borderRadius:'50%'});
 const path=(p,d,{stroke=theme.rust,width=8,fill='none',viewBox='0 0 1920 1080'}={})=>{const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),line=document.createElementNS(ns,'path');svg.setAttribute('viewBox',viewBox);svg.setAttribute('width','1920');svg.setAttribute('height','1080');Object.assign(svg.style,{position:'absolute',inset:'0',overflow:'visible'});line.setAttribute('d',d);line.setAttribute('stroke',stroke);line.setAttribute('stroke-width',width);line.setAttribute('fill',fill);line.setAttribute('stroke-linecap','round');line.setAttribute('stroke-linejoin','round');svg.appendChild(line);p.appendChild(svg);return line};
 const beat=(near,window=.1)=>{const hit=(data.beats||[]).filter(b=>Math.abs(b.time-near)<=window).sort((a,b)=>Math.abs(a.time-near)-Math.abs(b.time-near))[0];return hit?.time??near};
 const width=(text,size,font)=>{measure.font=(font==='serif'?'italic ':'')+size+'px '+fonts[font];return measure.measureText(text).width};
 const scenes=data.scenePlan.scenes;
 for(const [sceneIndex,spec] of scenes.entries()){
  const phrase=data.phrases.find(p=>p.id===spec.id);if(!phrase||phrase.start>=data.duration)continue;
  const words=phrase.wordIds.map(id=>data.words.find(w=>w.id===id));
  if(words.some(w=>!w))throw Error('Missing words '+spec.id);
  const start=phrase.start,next=data.phrases[data.phrases.indexOf(phrase)+1],end=Math.min(data.duration,Math.max(phrase.end+.09,next?.start??data.duration));
  const scene=E('section','g1-scene',stage);scene.id='scene-'+phrase.id;scene.dataset.family=spec.family;
  const camera=E('div','g1-camera',scene),back=E('div','g1-back',camera),front=E('div','g1-front',camera),type=E('div','g1-type',camera);
  const nodes=words.map(w=>{const n=E('span','g1-word',type);n.textContent=w.text;n.id='word-'+w.id;n.dataset.wordId=w.id;n.dataset.cueStart=w.start;n.dataset.cueEnd=w.end;return n});
  function place(i,x,y,size,{font='condensed',color=theme.bone,rotation=0,scaleX=1}={}){
   const n=nodes[i];if(!n)return null;Object.assign(n.style,{left:x+'px',top:y+'px',fontSize:size+'px',fontFamily:fonts[font]||fonts.condensed,fontStyle:font==='serif'?'italic':'normal',color});
   n._width=width(words[i].text,size,font);n._height=size*1.13;n._pose={x:0,y:0,z:0,rotation,rotationX:0,rotationY:0,scale:1,scaleX,scaleY:1};
   tl.set(n,{rotation,scaleX},0);return n;
  }
  function row(indices,{x=140,y=400,maxWidth=1640,size=160,font='condensed',color=theme.bone,gap=20,align='left'}={}){
   const ids=indices.filter(i=>nodes[i]);const estimated=ids.reduce((v,i)=>v+width(words[i].text,size,font),0)+Math.max(0,ids.length-1)*gap;
   const ratio=Math.min(1,maxWidth/Math.max(1,estimated));size*=ratio;gap*=ratio;const total=ids.reduce((v,i)=>v+width(words[i].text,size,font),0)+Math.max(0,ids.length-1)*gap;
   let px=x+(align==='center'?(maxWidth-total)/2:align==='right'?maxWidth-total:0);
   return ids.map(i=>{const n=place(i,px,y,size,{font,color});px+=n._width+gap;return n});
  }
  function reveal(i,{from={y:20},to={},duration=.12,ease='power3.out'}={}){
   const n=nodes[i];if(!n)return;n._customReveal=true;const pose=n._pose||{x:0,y:0,scale:1,rotation:0};
   tl.set(n,{opacity:1},words[i].start);tl.fromTo(n,{...pose,...from},{...pose,...to,duration,ease,immediateRender:false},words[i].start);
  }
  function glyphs(i){const n=nodes[i];if(!n)return[];n.textContent='';return [...words[i].text].map(t=>{const s=E('span','g1-letter',n);s.textContent=t;return s})}
  // A safe fallback is used only if a registered bespoke scene omits a word.
  const ids=words.map((_,i)=>i),split=Math.ceil(ids.length/2);
  row(ids.slice(0,split),{y:350,size:180});row(ids.slice(split),{y:570,size:180});
  const ctx={tl,phrase,words,nodes,start,end,scene,camera,back,front,type,theme,E,place,row,reveal,rect,ring,path,glyphs,beat,sceneIndex,spec};
  const handler=window.G1_SCENES[spec.family];if(!handler)throw Error('Missing authored scene '+spec.family+' for '+spec.id);
  handler(ctx);
  nodes.forEach((n,i)=>{if(!n._customReveal)reveal(i,{from:{y:10},duration:.065});});
  const lead=Math.max(0,start-Math.min(.14,start));tl.set(scene,{opacity:1},lead);
  // Keep a sung word present until its measured end. Transitions affect the world only afterwards.
  const exit=Math.max(phrase.end+.045,end-.11);
  if(next&&next.start<phrase.end+.15)nodes.forEach((n,i)=>{if(words[i].end<next.start-.04)tl.to(n,{opacity:0,duration:.06,ease:'sine.in'},next.start-.06);});
  if(exit<data.duration)tl.to(scene,{opacity:0,duration:Math.max(.03,Math.min(.11,data.duration-exit)),ease:'sine.in'},exit);
 }
 if(window.buildGenesisOpening)window.buildGenesisOpening({tl,stage:document.getElementById('g1-opening'),data,theme,E,rect,ring,path,beat});
 if(window.buildGenesisClosing)window.buildGenesisClosing({tl,stage:document.getElementById('g1-closing'),data,theme,E,rect,ring,path,beat});
 // Media wrappers are not timed ancestors. HyperFrames owns the nested video's data-start.
 for(const m of data.media||[]){
  const shell=document.getElementById('media-'+m.id);if(!shell||m.start>=data.duration)continue;
  const inner=shell.querySelector('.g1-media-inner'),foreground=shell.querySelector('.g1-media-foreground');
  tl.fromTo(shell,{opacity:0},{opacity:m.opacity??.78,duration:.28,ease:'sine.inOut'},m.start);
  const picture=shell.querySelector('video,img');if(picture&&m.type!=='video')tl.fromTo(inner,{scale:1.025,x:0},{scale:1.065,x:-18,duration:m.end-m.start,ease:'none'},m.start);
  if(m.type==='video'&&m.poster){const hold=shell.querySelector('.g1-last-frame');if(hold)tl.set(hold,{opacity:1},m.start+m.duration-1/30);}
  // A separate foreground vocabulary belongs to each material; no naked video inserts.
  const span=m.end-m.start,kind=m.treatment||'water';
  const draw=(d,color,width,delay=0)=>{const p=path(foreground,d,{stroke:color,width});const len=p.getTotalLength();tl.fromTo(p,{strokeDasharray:len,strokeDashoffset:len,opacity:.25},{strokeDashoffset:0,opacity:.58,duration:Math.min(2.4,span*.38),ease:'sine.inOut'},m.start+delay);return p;};
  if(kind==='dust'){
   for(let k=0;k<76;k++){const x=(k*347)%1920,y=820+(k*73)%260,d=2+(k%4);const p=rect(foreground,x,y,d,d,k%4?theme.bone:theme.rust);tl.fromTo(p,{opacity:0,y:0,x:0},{opacity:.4,y:-150-(k*43)%340,x:30*Math.sin(k),duration:span*.67,ease:'sine.out'},m.start+(k%11)*.12);tl.to(p,{opacity:0,duration:span*.28},m.start+span*.65);}
   draw('M 40 999 C 510 830 1250 1060 1890 860',theme.rust,11);
  }else if(kind==='roots'){
   for(let k=0;k<7;k++){const x=220+k*240;draw(`M ${x} 1110 Q ${x+110} 940 ${x+40} 830 Q ${x-50} 725 ${x+20} 650`,k%2?theme.rust:theme.amber,k===3?8:3,k*.1);draw(`M ${x+48} 898 Q ${x-65} 800 ${x-120} 820`,theme.muted,4,k*.13+.25);}
  }else if(kind==='strata'||kind==='ground'){
   for(let k=0;k<4;k++){const y=855+k*54,p=draw(`M -90 ${y+80} L 410 ${y-25} L 730 ${y+18} L 1080 ${y-63} L 1500 ${y+20} L 2040 ${y-80}`,k%2?theme.muted:theme.rust,k===0?15:4,k*.17);tl.to(p,{y:kind==='strata'?75:-25,x:22,duration:span-.8,ease:'sine.inOut'},m.start+.8);}
  }else if(kind==='wind'){
   for(let k=0;k<5;k++){const p=draw(`M ${-250+k*190} 1150 C 590 ${750+k*40} 900 ${580-k*60} ${1620+k*100} -100`,k%2?theme.bone:theme.amber,k===2?7:2,k*.13);tl.to(p,{x:30,y:-45,duration:span-1,ease:'sine.inOut'},m.start+1);}
  }else if(kind.startsWith('angel')){
   if(kind==='angel-wing'){const base=inner.querySelector('img');if(base){base.style.clipPath='polygon(39% 0,61% 0,64% 100%,36% 100%)';for(const side of [-1,1]){const wing=base.cloneNode(true);wing.style.clipPath=side<0?'polygon(0 0,42% 0,50% 48%,40% 100%,0 100%)':'polygon(58% 0,100% 0,100% 100%,60% 100%,50% 48%)';wing.style.transformOrigin='50% 48%';inner.appendChild(wing);tl.fromTo(wing,{rotation:side*-1.6},{rotation:side*1.6,duration:span/2,yoyo:true,repeat:1,ease:'sine.inOut'},m.start);}}}inner.style.transformOrigin='65% 50%';tl.fromTo(inner,{scale:1.01,rotation:-1},{scale:1.055,rotation:1,duration:span,ease:'sine.inOut'},m.start);
   const ns='http://www.w3.org/2000/svg';
   for(let k=0;k<4;k++){const svg=document.createElementNS(ns,'svg'),p=document.createElementNS(ns,'path'),t=document.createElementNS(ns,'text'),tp=document.createElementNS(ns,'textPath');svg.setAttribute('viewBox','0 0 1920 1080');Object.assign(svg.style,{position:'absolute',inset:'0',width:'100%',height:'100%',opacity:k===0?'.55':'.28'});const x=1260,y=525,rx=350+k*110,ry=210+k*84,id='orbit-'+m.id+'-'+k;p.id=id;p.setAttribute('d',`M ${x-rx} ${y} a ${rx} ${ry} 0 1 1 ${rx*2} 0 a ${rx} ${ry} 0 1 1 ${-rx*2} 0`);p.setAttribute('fill','none');p.setAttribute('stroke','none');tp.setAttribute('href','#'+id);tp.setAttribute('startOffset',(k*19)+'%');tp.textContent='01 · ∴ · + : / 01 · ∴ · + : / 01 · ∴ · + : / 01 · ∴ · + : /';t.setAttribute('data-layout-allow-overlap','Decorative code texture behind canonical lyric layer');tp.setAttribute('data-layout-allow-overlap','Decorative code texture behind canonical lyric layer');t.setAttribute('aria-hidden','true');t.setAttribute('fill',k%2?theme.rust:theme.bone);t.setAttribute('font-family','PlexMono');t.setAttribute('font-size',String(14+k*2));t.setAttribute('letter-spacing','9');t.appendChild(tp);svg.append(p,t);foreground.appendChild(svg);tl.to(tp,{attr:{startOffset:(k*19+20)+'%'},duration:span,ease:'none'},m.start);}
  }else{
   for(let k=0;k<3;k++){const y=780+k*66,p=draw(`M -120 ${y+100} C 360 ${y-140},820 ${y+160},1180 ${y-35} S 1770 ${y-145},2070 ${y+20}`,kind==='wake'?theme.bone:k===1?theme.bone:theme.rust,k===1?3:7,k*.16);tl.to(p,{y:-24-k*12,duration:span-.7,ease:'sine.inOut'},m.start+.7);}
  }
  tl.to(shell,{opacity:0,duration:.35,ease:'sine.inOut'},Math.max(m.start+.3,m.end-.35));
 }
};
