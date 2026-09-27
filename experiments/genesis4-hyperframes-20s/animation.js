/* Deterministic GSAP composition. Canonical lyric cues belong to data.js. */
document.fonts.ready.then(() => {
  const tl=gsap.timeline({paused:true});
  const $=s=>document.querySelector(s);
  const words=new Map(window.CLIP.words.map(w=>[w.id,w]));
  const cue=(line,index)=>words.get(`g4-l${line}-w${String(index).padStart(2,'0')}`);
  const el=(tag,cls,parent)=>{const n=document.createElement(tag);n.className=cls;parent.appendChild(n);return n};
  const positions={grief:[0,0,0],vengeance:[2200,-160,-180],cain:[4550,120,-300],lamech:[7000,-100,-160],seventy:[9350,0,0]};
  for(const [id,[x,y,z]] of Object.entries(positions))tl.set(`#${id}`,{x,y,z},0);
  // One spatial world. Camera routes connect physically separated reading stations.
  tl.fromTo('#world',{x:0,y:0,z:-140},{x:0,y:0,z:0,duration:.18,ease:'power3.out'},0);
  const travel=(id,start,end)=>{const [x,y,z]=positions[id];tl.to('#world',{x:-x,y:-y,z:-z,duration:end-start,ease:'power3.inOut'},start)};
  travel('vengeance',2.34,2.98);
  travel('cain',5.83,6.35);
  travel('lamech',8.67,9.70);
  travel('seventy',11.55,12.13);

  function word(line,index,station,x,y,size,cls='tall',opts={}){
    const w=cue(line,index);const n=el('span',`word ${cls}`,$(station+' .words')||$(station));
    n.id=w.id;n.textContent=w.text;n.dataset.wordId=w.id;n.dataset.cueStart=String(w.start);n.dataset.cueEnd=String(w.end);
    if(x!==null){n.style.left=x+'px';n.style.top=y+'px'}
    n.style.fontSize=size+'px';
    // All lyric opacity is instantaneous at the source onset. Movement settles within 140ms.
    tl.set(n,{opacity:1},w.start);
    tl.fromTo(n,{x:opts.dx??0,y:opts.dy??32,rotation:opts.rotate??0,scale:opts.scale??1.07},
      {x:0,y:0,rotation:0,scale:1,duration:opts.duration??.14,ease:'power3.out',immediateRender:false},w.start);
    return n;
  }
  // Grief: a human-scaled phrase crushed into a broken typographic monument.
  word('083',0,'#grief',260,220,110,'small');
  word('083',1,'#grief',375,175,196,'tall');
  word('083',2,'#grief',890,140,245,'hero');
  word('083',3,'#grief',265,455,115,'small');
  word('083',4,'#grief',405,455,115,'small');
  const grief=word('083',5,'#grief',570,404,278,'hero red',{dy:65,scale:1.12});
  tl.set('.grief-cut',{opacity:.65,scaleY:.05,rotation:19},0);
  tl.to('.grief-cut',{scaleY:1,duration:.20,ease:'power4.out'},cue('083',5).start);
  tl.to(grief,{rotation:-3,x:35,y:20,duration:.26,ease:'power2.in'},2.13);
  for(let i=0;i<5;i++){
    const r=el('div','ring',$('#grief-forms'));r.style.borderColor=i%2?'#200a10':'#400c19';
    tl.set(r,{z:-120-i*180,scale:.87+i*.16,rotationX:57,rotationY:11},0);
    tl.to(r,{rotationZ:25+i*8,duration:2.65,ease:'none'},0);
  }

  word('084',0,'#vengeance',240,175,123,'small');
  const veng=word('084',1,'#vengeance',215,330,244,'hero red',{dx:-85,dy:0,scale:1.1});
  word('084',2,'#vengeance',290,665,143,'small');
  word('084',3,'#vengeance',680,624,222,'tall',{dx:65,dy:0});
  tl.set('.crossbar',{opacity:1,scaleX:0,transformOrigin:'0% 50%'},3.51);
  tl.to('.crossbar',{scaleX:1,duration:.29,ease:'power4.out'},3.51);
  tl.to(veng,{z:95,duration:.7,ease:'power2.out'},3.66);
  for(let i=0;i<12;i++){
    const s=el('div','slab',$('#vengeance-forms'));s.style.left=120+i*149+'px';s.style.top=(i%2?730:-360)+'px';
    tl.set(s,{z:-130-(i%3)*110,rotation:18,scaleY:.4},0);
    tl.to(s,{scaleY:1.1,duration:.27,ease:'power3.out'},3.51+i*.012);
  }

  // Seven is a solid object. Seven concentric collars lock around it.
  word('084',4,'#cain',165,300,230,'tall');
  word('084',5,'#cain',180,595,143,'small');
  word('084',6,'#cain',1170,345,120,'small');
  word('084',7,'#cain',1140,485,205,'hero',{dx:50,dy:0});
  tl.set('#cain-seven',{opacity:1},cue('084',4).start);
  tl.fromTo('#cain-seven',{z:420,rotationY:-30,scale:1.2},{z:0,rotationY:0,scale:1,duration:.4,ease:'power4.out'},cue('084',4).start);
  for(let i=0;i<7;i++){
    const r=el('div','ring',$('#cain-forms'));r.style.width=750+i*76+'px';r.style.height=750+i*76+'px';r.style.left=960-(750+i*76)/2+'px';r.style.top=540-(750+i*76)/2+'px';r.style.borderWidth=19+i*4+'px';r.style.borderColor=i%2?'#5e0e1c':'#290b12';
    tl.set(r,{rotationX:68,rotationZ:i*11,z:-120-i*58,scale:1.5,opacity:0},0);
    tl.to(r,{opacity:1,scale:1,duration:.6,ease:'power3.out'},6.415+i*.036);
    tl.to(r,{rotationZ:35+i*11,duration:2.9,ease:'none'},6.415);
  }

  word('085',0,'#lamech',258,235,126,'small');
  const lamech=word('085',1,'#lamech',260,383,285,'hero red',{dy:-65,scale:1.08});
  word('085',2,'#lamech',675,742,102,'small');
  word('085',3,'#lamech',835,702,140,'tall');
  word('085',4,'#lamech',1090,742,102,'small');
  tl.to(lamech,{scaleX:1.06,duration:.9,ease:'power2.out'},10.3);
  for(let i=0;i<14;i++){
    const s=el('div','slab',$('#lamech-forms'));s.style.width=110+'px';s.style.height=740+'px';s.style.left=(i<7?80+i*30:1680+(i-7)*30)+'px';s.style.top=-100+i%3*95+'px';
    tl.set(s,{rotation:i<7?-24:24,z:-100-(i%7)*80},0);
    tl.fromTo(s,{y:i%2?-150:150},{y:0,duration:.5,immediateRender:false,ease:'power3.out'},9.72+i*.015);
  }

  // The escalation: physical second seven collides, radial fragments push out.
  word('086',0,'#seventy',248,830,130,'tall');
  word('086',1,'#seventy',862,835,124,'small');
  word('086',2,'#seventy',1260,830,130,'tall');
  tl.set('#first-seven',{opacity:1,x:-260,y:-80,scale:.91},12.1817);
  tl.fromTo('#first-seven',{rotationY:-50,z:-420},{rotationY:0,z:0,duration:.36,ease:'power3.out'},12.1817);
  tl.set('#second-seven',{opacity:1,x:1350,y:-80,scale:.91},13.283);
  tl.to('#second-seven',{x:270,duration:.21,ease:'expo.out'},13.283);
  tl.to('#first-seven',{x:-296,duration:.12,ease:'power2.out'},13.38);
  for(let i=0;i<44;i++){
    const s=el('div','splinter',$('#seventy-forms'));let a=i*2.39996323;
    s.style.left=950+'px';s.style.top=440+'px';s.style.width=(30+(i%8)*17)+'px';s.style.height=(7+i%4*7)+'px';
    tl.set(s,{opacity:0,rotation:a*180/Math.PI,z:-20},0);
    tl.set(s,{opacity:.76},13.40+(i%4)*.018);
    tl.to(s,{x:Math.cos(a)*(530+i%7*88),y:Math.sin(a)*(350+i%5*100),rotation:a*180/Math.PI+65,opacity:0,duration:1.25,ease:'power3.out'},13.40+(i%4)*.018);
  }
  for(let i=0;i<5;i++){
    const r=el('div','halo',$('#seventy-forms'));
    tl.set(r,{scale:.05,rotationX:i*11,opacity:0},0);
    tl.fromTo(r,{scale:.13,opacity:.55},{scale:1.6+i*.28,opacity:0,duration:1.35,ease:'power2.out'},13.4+i*.09);
  }
  // A slow reversal after the collision, not another frenetic cut.
  tl.to(['#first-seven','#second-seven'],{color:'#f1e6d6',duration:1.15,ease:'power2.inOut'},14.35);
  tl.to('#first-seven',{rotationY:-25,x:-470,z:120,duration:1.6,ease:'power2.inOut'},14.5);
  tl.to('#second-seven',{rotationY:25,x:500,z:120,duration:1.6,ease:'power2.inOut'},14.5);
  tl.to('#seventy .words',{opacity:0,duration:.25,ease:'power1.out'},15.6);
  tl.to(['#first-seven','#second-seven'],{opacity:0,duration:.35,ease:'power1.out'},15.8);
  tl.set('#world',{opacity:0},16.6);
  tl.fromTo('#mercy',{opacity:0,clipPath:'circle(0% at 50% 45%)'},{opacity:1,clipPath:'circle(100% at 50% 45%)',duration:1.65,ease:'power2.inOut'},15.05);
  tl.fromTo('#mercy-photo',{scale:1.075,x:20},{scale:1.01,x:0,duration:4.95,ease:'sine.out'},15.05);
  tl.fromTo('#mercy-heading',{opacity:0,y:20},{opacity:1,y:0,duration:.55,ease:'power2.out'},16.15);
  tl.fromTo('#mercy-title',{opacity:0,x:-35},{opacity:1,x:0,duration:.7,ease:'power2.out'},16.35);
  tl.fromTo('#mercy-number',{opacity:0,y:20},{opacity:.88,y:0,duration:.7,ease:'power2.out'},16.55);
  tl.to('#mercy-orbits',{opacity:1,duration:.4},15.8);
  for(let i=0;i<4;i++){
    const r=el('div','mercy-ring',$('#mercy-orbits'));
    tl.fromTo(r,{scale:.3+i*.15,opacity:.32},{scale:1.4+i*.17,opacity:0,duration:4.1,ease:'power1.out'},15.4+i*.15);
  }
  for(let i=0;i<6;i++)word('087',i,'#adam-line',null,null,128,i===0||i===2?'tall':'small',{dy:10,scale:1,duration:.14});
  // Low-amplitude measured accents touch geometry only; never move lyric cue times.
  for(let i=0;i<55;i++){
    const d=el('i','dust',$('#dust'));d.style.left=((i*419)%1920)+'px';d.style.top=((i*277)%1080)+'px';
    tl.to(d,{x:26+(i%4)*18,y:-60-(i%5)*20,duration:20,ease:'none'},0);
  }
  window.__timelines=window.__timelines||{};
  window.__timelines['genesis-hf']=tl;
});
