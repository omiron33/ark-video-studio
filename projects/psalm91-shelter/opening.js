/* Revised opening: measured musical accents move the world; vocal cues reveal words. */
window.buildPsalm91Opening=function({tl,stage,data}){
 const C='#c77746',P='#f4ead6',K='#090909';
 const E=(tag,cls,parent=stage,style={})=>{const e=document.createElement(tag);e.className=cls;Object.assign(e.style,style);parent.appendChild(e);return e};
 E('style','op-css').textContent=`#opening{position:absolute;inset:0;overflow:hidden;perspective:1300px;background:#090909}#opening .op-world{position:absolute;inset:0;transform-style:preserve-3d;opacity:0}#opening .op-word{position:absolute;white-space:nowrap;line-height:1;margin:0;color:#f4ead6;opacity:0;font-family:Bebas,sans-serif}#opening .op-heavy{font-family:Archivo,sans-serif;letter-spacing:-8px}#opening .op-serif{font-family:Elegy,serif;font-style:italic;letter-spacing:-2px}#opening .op-form{position:absolute;transform-origin:50% 50%;pointer-events:none}#opening .op-photo{position:absolute;inset:0;width:1920px;height:1080px;object-fit:cover}#opening .op-depth{transform-style:preserve-3d}`;
 const group=()=>E('div','op-world');
 const rect=(p,x,y,w,h,c=C)=>E('i','op-form',p,{left:x+'px',top:y+'px',width:w+'px',height:h+'px',background:c});
 const ring=(p,x,y,d,width,c=C)=>E('i','op-form',p,{left:x+'px',top:y+'px',width:d+'px',height:d+'px',border:`${width}px solid ${c}`,borderRadius:'50%'});
 const word=(p,t,x,y,size,kind='',color=P)=>{const e=E('span','op-word '+kind,p,{left:x+'px',top:y+'px',fontSize:size+'px',color});e.textContent=t;return e};
 const show=(e,t,from={},dur=.18)=>{tl.set(e,{opacity:1},t);tl.fromTo(e,from,{x:0,y:0,z:0,rotation:0,rotationY:0,scale:1,duration:dur,ease:'power4.out',immediateRender:false},t)};
 const end=data.phrases.find(p=>p.id==='p91-l002')?.start||29.202253;
 const hit=(near)=>data.beats.filter(b=>Math.abs(b.time-near)<.13).sort((a,b)=>Math.abs(a.time-near)-Math.abs(b.time-near))[0]?.time||near;
 const h=(x)=>hit(x);
 // A percussive seal opens immediately; no quiet still or decorative box loop.
 const seal=group();tl.set(seal,{opacity:1},0);
 const disc=ring(seal,498,88,894,103,C),disc2=ring(seal,415,5,1060,3,'#603321');
 disc.style.borderTopColor=P;disc.style.borderRightColor='#5a3020';
 const slash=rect(seal,-140,483,2200,114,'#312018');
 tl.set(slash,{rotation:-16},0);tl.fromTo(slash,{scaleX:0},{scaleX:1,duration:.12,ease:'power4.in'},0);
 const n=word(seal,'91',574,174,638,'op-heavy'),ps=word(seal,'PSALM',96,179,108),lxx=word(seal,'LXX 90',1510,820,64);
 show(n,h(.12),{scale:1.45,z:400},.24);show(ps,h(.54),{x:-150},.17);show(lxx,h(.88),{y:50},.15);
 tl.fromTo(disc,{rotation:-96,scale:.12},{rotation:0,scale:1,duration:.42,ease:'expo.out'},h(.12));
 tl.to(disc,{rotation:80,duration:.46,ease:'power4.inOut'},h(1.52));
 tl.to(disc2,{rotationY:58,rotationX:-14,duration:.65,ease:'power3.inOut'},h(1.86));
 tl.to(seal,{x:-1480,rotationY:32,z:210,duration:.36,ease:'power3.in'},h(2.18));tl.set(seal,{opacity:0},h(2.52)+.05);
 // The title describes its own verb: THOUSAND becomes ranks; FALL loses its footing.
 const title=group();tl.set(title,{opacity:1},h(2.52));
 const a=word(title,'A',173,155,90,'op-serif'),th=word(title,'THOUSAND',160,277,286),sh=word(title,'SHALL',220,660,116);
 show(a,h(2.52),{x:200},.18);show(th,h(2.81),{x:580,rotationY:-40},.30);show(sh,h(3.51),{y:70},.15);
 const letters=[... 'FALL'].map((x,i)=>word(title,x,779+i*211,565,251,'op-heavy',C));
 letters.forEach((e,i)=>show(e,h(3.84),{y:-220,rotation:6-i*4},.16+i*.02));
 const ledge=rect(title,130,895,1600,25,C);tl.fromTo(ledge,{scaleX:0},{scaleX:1,duration:.22,ease:'power3.out'},h(4.16));
 for(let i=0;i<24;i++){const b=rect(title,164+i*68,990,20,200,i%3===0?P:'#5b3323');tl.fromTo(b,{y:220},{y:-80-(i%4)*17,duration:.3,ease:'power3.out'},h(4.51)+(i%4)*.022);tl.to(b,{y:340,rotation:28+i%5*8,duration:.55,ease:'power3.in'},h(5.52)+i*.023);}
 tl.to(ledge,{scaleX:0,x:780,duration:.17,ease:'power4.in'},h(5.52));
 letters.forEach((e,i)=>tl.to(e,{y:650,rotation:11+i*6,duration:.5,ease:'power3.in'},h(5.52)+i*.07));
 tl.to(th,{y:75,x:80,scale:.94,duration:.42,ease:'power3.inOut'},h(6.2));
 const shield=ring(title,1105,437,584,72,P);tl.set(shield,{opacity:0,rotationY:-70},0);show(shield,h(6.82),{scale:.3,z:-600},.35);
 tl.to(shield,{rotationY:50,rotationZ:-35,duration:.52,ease:'power3.inOut'},h(7.5));
 tl.to(title,{x:-1150,z:700,rotationY:35,opacity:0,duration:.55,ease:'power3.in'},h(8.17));
 // The sung words inhabit a physical canopy. The final word becomes its foundation.
 const lyric=group();tl.set(lyric,{opacity:1},h(8.49));
 const canopy=E('i','op-form',lyric,{left:'215px',top:'119px',width:'1470px',height:'760px',border:`74px solid ${C}`,borderBottom:'none',borderRadius:'740px 740px 0 0'});
 const foot=rect(lyric,256,958,1408,26,P);
 tl.fromTo(canopy,{scaleY:.015,y:620},{scaleY:1,y:0,duration:.53,ease:'power3.out'},h(8.49));tl.fromTo(foot,{scaleX:0},{scaleX:1,duration:.3,ease:'power4.out'},h(9.15));
 const positions=[[306,298,152,''],[912,306,132,'op-serif'],[308,483,217,''],[337,729,195,'op-heavy']];
 const openingWords=data.words.filter(w=>w.phraseId==='p91-l001');
 openingWords.forEach((w,i)=>{const [x,y,size,kind]=positions[i];const e=word(lyric,w.text,x,y,size,kind,i===3?C:P);e.id='opening-'+w.id;e.dataset.wordId=w.id;e.dataset.cueStart=w.start;e.dataset.cueEnd=w.end;show(e,w.start,{y:i===0?-18:18},.075)});
 const lyricEnd=Math.max(...openingWords.map(w=>w.end));
 const departure=Math.max(h(14.82),lyricEnd+.45);
 tl.to(canopy,{borderColor:P,duration:.12},h(12.15));tl.to(canopy,{borderColor:C,duration:.9},h(12.15)+.12);
 tl.to(lyric,{x:-420,z:280,rotationY:25,scale:.76,duration:.72,ease:'power3.inOut'},departure);
 // Cross a single expanding architectural arch into the photo's keyhole.
 const passage=group();tl.set(passage,{opacity:1},departure+.36);
 for(let i=0;i<7;i++){
  const arch=E('i','op-form',passage,{left:(930+i*18)+'px',top:(135+i*30)+'px',width:(850-i*61)+'px',height:(1000-i*43)+'px',border:`${60-i*5}px solid ${i===0?P:C}`,borderBottom:'none',borderRadius:'500px 500px 0 0'});arch.dataset.layoutAllowOverflow='';
  tl.set(arch,{z:-i*260,rotationY:-25,opacity:1-i*.1},0);tl.fromTo(arch,{scale:.25},{scale:1.15,duration:2.55,ease:'power2.inOut',immediateRender:false},departure+.36+i*.055);
 }
 tl.to(lyric,{x:-1950,opacity:0,duration:.48,ease:'power3.in'},h(17.67));
 tl.to(passage,{scale:3.8,x:-1480,y:-380,opacity:0,duration:1.1,ease:'power3.in'},h(18.82));
 const photo=group();tl.set(photo,{opacity:1},h(19.5));
 // One photograph persists throughout. Only the keyhole boundary expands;
 // transforming the photo then dissolving to another copy caused a visible reset.
 const ns='http://www.w3.org/2000/svg';
 const maskSvg=document.createElementNS(ns,'svg');maskSvg.setAttribute('width','0');maskSvg.setAttribute('height','0');maskSvg.style.position='absolute';photo.appendChild(maskSvg);
 const defs=document.createElementNS(ns,'defs'),clip=document.createElementNS(ns,'clipPath'),hole=document.createElementNS(ns,'path');
 maskSvg.appendChild(defs);defs.appendChild(clip);clip.appendChild(hole);clip.id='op-keyhole-clip';clip.setAttribute('clipPathUnits','userSpaceOnUse');
 hole.setAttribute('d','M 1170 276 A 185 185 0 1 1 1390 276 L 1485 950 L 1075 950 Z');
 const maskPose=s=>`translate(1280 420) scale(${s}) translate(-1280 -420)`;
 const aperture=E('div','op-world',photo,{opacity:'1',clipPath:'url(#op-keyhole-clip)'});
 const image=E('img','op-photo',aperture);image.src='assets/opening-refuge.png';image.alt='Traveler under the shelter of stone';
 tl.fromTo(hole,{attr:{transform:maskPose(.84)}},{attr:{transform:maskPose(1)},duration:.67,ease:'power3.out',immediateRender:false},h(19.5));
 const tag=word(photo,'PSALM 91',149,325,179),small=word(photo,'LXX 90',153,535,77,'op-serif',C);show(tag,h(20.17),{x:-80},.2);show(small,h(20.84),{x:-40},.18);
 const line=rect(photo,150,680,630,14);tl.fromTo(line,{scaleX:0},{scaleX:1,duration:.3,ease:'power3.out'},h(21.51));
 // The aperture opens across the anchored photo, never replacing its crop.
 tl.to(hole,{attr:{transform:maskPose(14)},duration:2,ease:'power3.inOut'},h(22.19));
 tl.to([tag,small,line],{x:-140,opacity:0,duration:.55,ease:'power2.in'},h(22.84));
 const full=E('div','op-world',photo);
 tl.to(full,{opacity:1,duration:.52,ease:'sine.inOut'},h(24.19));
 const closing=word(full,'91',89,456,433,'op-heavy',C),label=word(full,'PSALM',116,317,95);show(closing,h(24.87),{x:-220},.25);show(label,h(24.52),{y:-40},.16);
 // Three measured impacts pull a horizon toward the verse, then give its words a clean stage.
 for(let i=0;i<3;i++){const dash=rect(full,700+i*240,895-i*95,184,14,i===1?P:C);tl.fromTo(dash,{opacity:0,scaleX:0},{opacity:1,scaleX:1,duration:.13,ease:'power4.out'},[h(26.21),h(27.07),h(27.55)][i]);tl.to(dash,{x:-180,opacity:0,duration:.6},h(28.9)-.6)}
 tl.to(image,{scale:1.025,x:-16,duration:4.5,ease:'none'},h(24.19));
 tl.to(photo,{opacity:0,duration:.2,ease:'power2.inOut'},end-.22);tl.set(stage,{opacity:0},end-.015);
};
