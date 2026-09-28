const P23_CHOREOGRAPHY_FAMILIES = ["gathering-shepherd", "opening-nothing", "growing-grass", "dwelling-threshold", "nourishing-bowl", "resting-water", "restoring-soul", "guided-thread", "righteous-path", "name-signature", "walking-ground", "withdrawing-shadow", "courage-expansion", "embracing-presence", "staff-unfold", "comfort-cradle", "fear-clearing", "table-setting", "affliction-perimeter", "anointing-descent", "cup-overflow", "walking-depth-stations", "shadow-passage", "unfastening-fear", "meeting-you-me", "lifting-supports", "settling-comfort", "unbroken-declaration", "following-mercy", "days-orbit", "mercy-material", "life-continuum", "quiet-courage", "shared-shelter", "shepherd-homeward", "nothing-release", "house-doorway", "long-time", "final-anchor"];
// All composition state is a pure function of this single paused timeline.
// Each family below changes meaningful word geometry, relation or material.
// The shared reveal merely exposes the exact word on its measured onset.
const p23ById=id=>document.getElementById(id);
const move=(el,from,to,t,d=.72,ease='power3.out')=>{
 const word=el?.classList?.contains('word')?el:el?.closest?.('.word');
 const onset=Number(word?.dataset.wordStart);
 // Essential glyphs must be readable on the sung attack. Build their clip
 // or growth *before* that attack; the semantic traces and camera movement
 // still unfold through the vocal. A 20 ms sung word is shorter than a frame.
 if(Number.isFinite(onset)&&onset>0&&Math.abs(t-onset)<.04&&
    (from.clipPath!==undefined||(el?.classList?.contains('letter')&&from.scaleY!==undefined&&from.scaleY<.8)))t-=d;
 return tl.fromTo(el,from,{...to,duration:d,ease,immediateRender:false},t);
};
const letters=w=>[...p23ById(w.id).querySelectorAll('.letter')];
const applyLetters=(w,fn)=>letters(w).forEach((el,k,a)=>fn(el,k,a.length));
const normal={x:0,y:0,z:0,rotation:0,rotationX:0,rotationY:0,scaleX:1,scaleY:1};
const has=(w,s)=>w.text.toLowerCase().includes(s);
const makeTrace=(root,id,d,opacity=.65,width=1.7)=>{const el=document.createElementNS('http://www.w3.org/2000/svg','path');el.id=id;el.setAttribute('d',d);el.setAttribute('fill','none');el.setAttribute('stroke','#e7c896');el.setAttribute('stroke-width',width);el.setAttribute('stroke-linecap','round');el.style.opacity=opacity;root.querySelector('.front-contours').appendChild(el);const len=el.getTotalLength();el.style.strokeDasharray=len;el.style.strokeDashoffset=len;return el;};
const drawTrace=(el,start,span)=>move(el,{strokeDashoffset:el.getTotalLength()},{strokeDashoffset:0},start,span,'sine.inOut');
const onRoute=(w,points,at,span)=>{const el=p23ById(w.id),step=span/(points.length-1);for(let i=1;i<points.length;i++)move(el,{x:points[i-1][0]-w.x,y:points[i-1][1]-w.y,rotation:points[i-1][2]||0},{x:points[i][0]-w.x,y:points[i][1]-w.y,rotation:points[i][2]||0},at+(i-1)*step,step,i===points.length-1?'sine.out':'none');};
const fracture=w=>applyLetters(w,(el,k)=>{el.classList.add('cracked');el.dataset.glyph=el.textContent;el.setAttribute('data-layout-ignore','');const d=Math.min(.2,Math.max(.12,w.end-w.start));move(el,{'--upper-x':`${k%2?24:-24}px`,'--lower-x':`${k%2?-24:24}px`,'--upper-y':'-18px','--lower-y':'18px'},{'--upper-x':'0px','--lower-x':'0px','--upper-y':'0px','--lower-y':'0px'},w.start-d+k*.003,d,'power2.out');});

P23_DATA.acts.forEach((a,i)=>{
 const root=p23ById(a.id),wrap=root.querySelector('.photo-wrap'),photo=root.querySelector('.photo');
 const span=a.end-a.start;
 // Each still receives a visible dolly and lateral move, with extra crop for
 // safe frame edges. The generated clips take over at the four story peaks.
 move(photo,{scale:1.11,x:i%2?-62:66,y:i%3?-29:31,rotation:i%2?-.25:.25},{scale:i%3===0?1.225:1.19,x:i%2?116:-112,y:i%3?48:-45,rotation:i%2?.35:-.35},a.start,span,'sine.inOut');
 const light=wrap.querySelector('.act-light');
 if(light)move(light,{opacity:.08,x:i%2?-300:270,y:95,scale:.86},{opacity:i===7?.30:.23,x:i%2?320:-290,y:-115,scale:1.34},a.start,span,'sine.inOut');
 const shadow=wrap.querySelector('.act-shadow');
 if(shadow)move(shadow,{opacity:.23,x:-140},{opacity:.04,x:250},a.start,span,'sine.inOut');
 const rain=wrap.querySelector('.act-rain');
 if(rain){const cycles=Math.ceil(span/1.7);tl.fromTo(rain,{y:-265,opacity:.11},{y:295,opacity:.31,duration:span/cycles,ease:'none',repeat:cycles-1,immediateRender:false},a.start);}
 const ripple=wrap.querySelector('.act-ripple');
 if(ripple){const cycles=Math.ceil(span/3);tl.fromTo(ripple,{scale:.86,opacity:.02},{scale:1.24,opacity:.31,duration:span/cycles,ease:'sine.inOut',repeat:cycles-1,immediateRender:false},a.start);}
 // A broad polygon wipe left hard strips of the preceding photograph visible
 // through the new scene (especially water→hospital and sofa→rain). Dissolve
 // within the two acts' overlap and complete before the old act ends.
 if(i)move(wrap,{opacity:0},{opacity:1},a.start,.52,'sine.inOut');
});
P23_DATA.videos.forEach(v=>{
 const el=p23ById('video-'+v.id),poster=p23ById('poster-'+v.id);
 if(v.id==='mercy'){move(el,{opacity:0,clipPath:'inset(58% 0 0 0)'},{opacity:v.opacity,clipPath:'inset(58% 0 0 0)'},v.start+.9,.65,'sine.out');move(el,{clipPath:'inset(58% 0 0 0)'},{clipPath:'inset(0% 0 0 0)'},v.start+3.1,.48,'sine.inOut');}
 else move(el,{opacity:0},{opacity:v.opacity},v.start,v.id==='jesus-with-people'?.14:v.kind==='narrative'?.28:.65,'sine.out');
 if(v.holdEnd>v.end){const hold=v.holdEnd-v.end;if(hold<=.5)move(poster,{opacity:v.opacity},{opacity:0},v.end,hold,'sine.inOut');else{move(poster,{opacity:v.opacity},{opacity:v.opacity*.82},v.end,hold-.5,'none');tl.to(poster,{opacity:0,duration:.5,ease:'sine.in'},v.holdEnd-.5);}}
 else tl.to(el,{opacity:0,duration:.5},v.end-.5);
});

for(const p of P23_DATA.phrases){
 if(P23_CHOREOGRAPHY_FAMILIES[p.index-1]!==p.family)throw Error("Choreography family mapping mismatch "+p.id);
 const shadeHeight=p.rows.at(-1).y-p.y+570;
 tl.set("#reading-atmosphere",{x:p.x-180,y:p.y-190,scaleX:(p.maxWidth+330)/1400,scaleY:shadeHeight/750},p.showStart);
 move("#reading-atmosphere",{opacity:0},{opacity:p.index>=15&&p.index<=17?1:.67},p.showStart,.14,"sine.out");
 tl.to("#reading-atmosphere",{opacity:0,duration:.15},p.showEnd-.15);
 const root=p23ById(p.id),world=root.querySelector('.word-world'),inner=root.querySelector('.scene-inner');
 const all=p.words,span=p.showEnd-p.showStart,finish=Math.min(p.showEnd-.24,p.end+.08),last=all.at(-1);
 const get=s=>all.find(w=>has(w,s));
 const start=p.start;
 const accent=root.querySelector('.accent-line');
 const lines=[...root.querySelectorAll('.contour')];
 for(const [i,line]of lines.entries()){
  const len=line.getTotalLength();line.style.strokeDasharray=len;line.style.strokeDashoffset=len;
  move(line,{strokeDashoffset:len},{strokeDashoffset:0},start+i*.35,Math.max(.85,Math.min(span-.4,2.3+i*.9)),'sine.inOut');
 }
 const accentLength=accent.getTotalLength();accent.style.strokeDasharray=accentLength;accent.style.strokeDashoffset=accentLength;
 move(accent,{strokeDashoffset:accentLength,opacity:0},{strokeDashoffset:0,opacity:.66},Math.min(last.start,start+span*.6),Math.max(.32,Math.min(1.45,p.showEnd-last.start-.1)),'power2.out');
 tl.to(inner,{opacity:0,duration:.16,ease:'power1.in'},p.showEnd-.16);
 for(const w of all){move(p23ById(w.id),{opacity:0},{opacity:1},Math.max(p.showStart,w.start-.075),.055,'power1.out');}

 if(window.P23_SEMANTIC?.(p,{tl,move,normal,root,world,all,lines,accent,letters,applyLetters})) continue;
 switch(p.family){
 case 'gathering-shepherd':
  all.forEach((w,i)=>{const points=i===4?[[w.x+150,w.y+130,-8],[w.x+95,w.y+68,-4],[w.x+35,w.y+12,1],[w.x,w.y,0]]:[[w.x,w.y-52,0],[w.x+5,w.y-24,0],[w.x,w.y,0]];onRoute(w,points,w.start,i===4?.78:.28);});
  // Once the flock of words has gathered, shepherd holds while its crook
  // turns over the sentence as a single shelter, rather than an underline.
  tl.to(lines[0],{rotation:8,x:55,duration:Math.max(.4,span-2.6),transformOrigin:'52% 57%',ease:'sine.inOut'},start+2.4);
  break;
 case 'opening-nothing':
  all.slice(0,4).forEach((w,i)=>move(p23ById(w.id),{x:(i-1.5)*-80,clipPath:'inset(0 50% 0 50%)'},{x:0,clipPath:'inset(0 0% 0 0%)'},w.start,.2,'power2.out'));
  {const w=get('nothing'),el=p23ById(w.id);move(el,{clipPath:'circle(0% at 50% 50%)',scale:1.2},{clipPath:'circle(78% at 50% 50%)',scale:1},w.start,.2,'sine.out');const voidLine=makeTrace(root,p.id+'-empty-space',`M ${w.x-38} ${w.y+145} L ${w.x+w.width+38} ${w.y+145}`);drawTrace(voidLine,w.start,.7);tl.to(voidLine,{scaleX:1.65,opacity:0,transformOrigin:'50% 50%',duration:Math.max(.5,p.showEnd-w.start-.9),ease:'sine.inOut'},w.start+.8);}
  break;
 case 'growing-grass':
  all.forEach(w=>applyLetters(w,(el,k,n)=>move(el,{scaleY:.2,y:58,rotation:(k%2?1:-1)*(8+k%4)},{scaleY:1,y:0,rotation:0},w.start+k*.002,.19,'power3.out')));
  all.filter(w=>has(w,'green')||has(w,'grass')).forEach(w=>{const roots=makeTrace(root,w.id+'-roots',`M ${w.x+30} ${w.y+145} Q ${w.x-10} ${w.y+200},${w.x+50} ${w.y+225} M ${w.x+w.width*.5} ${w.y+140} Q ${w.x+w.width*.5+30} ${w.y+200},${w.x+w.width*.5-20} ${w.y+255} M ${w.x+w.width-25} ${w.y+140} Q ${w.x+w.width} ${w.y+190},${w.x+w.width+35} ${w.y+230}`,.6,1.4);drawTrace(roots,w.start+.2,1.1);});
  break;
 case 'dwelling-threshold':
  all.forEach((w,i)=>{const el=p23ById(w.id);move(el,{clipPath:'inset(0 100% 0 0)',x:i<4?72:130,rotationY:0},{clipPath:'inset(0 0% 0 0)',x:0,rotationY:0},w.start,.2,'power2.out');});
  {const w=get('dwell'),door=makeTrace(root,p.id+'-door',`M ${w.x-22} ${w.y+173} L ${w.x-22} ${w.y-28} L ${w.x+w.width+28} ${w.y-28} L ${w.x+w.width+28} ${w.y+173}`, .85,2.1);drawTrace(door,start,.7);tl.fromTo(door,{rotationY:0,transformOrigin:`${w.x-22}px ${w.y+70}px`},{rotationY:-69,duration:1.2,ease:'sine.inOut',immediateRender:false},w.start);tl.to(door,{rotationY:-82,opacity:.22,duration:Math.max(.5,p.showEnd-w.start-1.3),ease:'sine.inOut'},w.start+1.2);}
  break;
 case 'nourishing-bowl':
  all.forEach((w,i)=>{const target=[w.x,w.y,0];onRoute(w,[[p.x+350,800,-15+i*5],[p.x+160+i*70,690,8-i*3],[w.x-20,w.y+80,4],target],w.start,1.15);});
  {const source=makeTrace(root,p.id+'-nourish-source',`M ${p.x-10} 790 Q ${p.x+365} 945,${p.x+740} 790 M ${p.x+360} 850 C ${p.x+400} 690,${p.x+190} 645,${p.x+300} ${p.y+200}`,.74,2);drawTrace(source,start,3.8);}
  break;
 case 'resting-water':
  all.forEach((w,i)=>{const el=p23ById(w.id);el.classList.add('reflection');move(el,{y:40,rotation:3-i, '--reflection-distance':'9px','--reflection-alpha':.34},{y:0,rotation:0,'--reflection-distance':'-24px','--reflection-alpha':.08},w.start,Math.min(2.6,p.showEnd-w.start-.1),'sine.out');applyLetters(w,(glyph,k)=>move(glyph,{y:Math.sin(k*.8+i)*13},{y:0},w.start+.08,1.65,'sine.inOut'));});
  lines.forEach((line,i)=>tl.to(line,{y:12+i*13,scaleY:.55,duration:Math.max(1,span-1),ease:'sine.inOut'},start+.7));
  break;
 case 'restoring-soul':
  all.forEach(fracture);
  move(lines[0],{scaleX:.55,x:155},{scaleX:1,x:0},start,Math.min(2.9,span-.2),'power2.out');
  break;
 case 'guided-thread':
  all.forEach((w,i)=>{const el=p23ById(w.id);move(el,{x:-130-i*20,y:75-i*50,rotation:-10+i*4},{x:-28,y:-18,rotation:1},w.start,.4,'sine.out');tl.to(el,{x:0,y:0,rotation:0,duration:.58,ease:'power2.out'},w.start+.4);});
  break;
 case 'righteous-path':
  {const poses=[[150,225],[280,265],[470,315],[765,320],[215,540]];all.forEach((w,i)=>{const arrival=i===3?w.start-.68:w.start;move(p23ById(w.id),{x:poses[i][0]-w.x-130,y:poses[i][1]-w.y+40,z:-160,rotationY:-23},{x:poses[i][0]-w.x,y:poses[i][1]-w.y,z:0,rotationY:0,rotation:i<4?9:-5},arrival,.88,'power3.out');});const path=makeTrace(root,p.id+'-right-path','M 145 385 L 358 385 L 358 430 L 560 430 L 560 478 L 861 478 L 861 580',.78,2.2);drawTrace(path,start,2.4);}
  break;
 case 'name-signature':
  all.forEach(w=>{const el=p23ById(w.id);move(el,{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0% 0 0)'},w.start,Math.min(.2,Math.max(.12,w.end-w.start)),'none');const signature=makeTrace(root,w.id+'-signature',`M ${w.x} ${w.y+w.size*.83} Q ${w.x+w.width*.55} ${w.y+w.size*.52},${w.x+w.width} ${w.y+w.size*.86}`,.63,1.15);drawTrace(signature,w.start,Math.min(.75,Math.max(.3,w.end-w.start+.1)));tl.to(signature,{opacity:.12,duration:.6},w.end+.1);});
  move(lines[1],{y:45,rotation:-4},{y:0,rotation:0},start,Math.min(2.3,span-.1),'sine.inOut');
  break;
 case 'walking-ground':
  all.forEach((w,i)=>{const el=p23ById(w.id);move(el,{x:-90,y:i%2?32:-25,rotation:i%2?-4:4},{x:-20,y:-15,rotation:0},w.start,.3,'sine.out');tl.to(el,{x:0,y:0,duration:.38,ease:'power2.out'},w.start+.3);});
  break;
 case 'withdrawing-shadow':
  all.forEach(w=>{const el=p23ById(w.id);move(el,{x:50,rotationY:-12,textShadow:'-60px 28px 5px rgba(3,8,5,.98)'},{x:0,rotationY:0,textShadow:'0px 2px 13px rgba(7,12,8,.54)'},w.start,1.0,'power3.out');});
  move(lines[1],{x:-160,opacity:.24},{x:80,opacity:.7},start,Math.min(2.4,span-.1),'sine.inOut');
  break;
 case 'courage-expansion':
  all.forEach(w=>move(p23ById(w.id),{clipPath:'inset(100% 0 0 0)'},{clipPath:'inset(0% 0 0 0)'},w.start,.2,'power2.out'));
  {const fear=get('fear'),no=get('no'),barrier=makeTrace(root,p.id+'-barrier',`M ${fear.x-30} ${fear.y-10} L ${fear.x-30} ${fear.y+150} L ${fear.x+fear.width+30} ${fear.y+150} L ${fear.x+fear.width+30} ${fear.y-10}`,.9,3.5);drawTrace(barrier,fear.start,.35);move(barrier,{scaleX:1,rotation:0},{scaleX:2.1,rotation:-12,opacity:0},no.start,.95,'power3.out');move(p23ById(no.id),{scale:1.52,transformOrigin:'50% 50%'},{scale:1},no.start,.95,'power3.out');}
  break;
 case 'embracing-presence':
  all.forEach((w,i)=>move(p23ById(w.id),{x:i>=3?(i===3?-145:145):-60,y:i>=3?-65:20,rotation:i>=3?(i===3?-9:9):0},normal,w.start,.85,'sine.out'));
  move(lines[0],{scaleX:1.13,x:-65},{scaleX:1,x:0},start+.2,Math.min(3,span-.3),'sine.inOut');
  break;
 case 'staff-unfold':
  all.forEach(w=>{if(has(w,'rod')||has(w,'staff')){const after=w.end+.4,d=Math.min(.34,Math.max(.12,(p.showEnd-after-.26)/2));applyLetters(w,(el,k,n)=>{const folded={x:w.width*.42-k*w.width/n,y:(k-(n-1)/2)*36,rotation:has(w,'rod')?-90:90};move(el,{x:0,y:0,rotation:0},folded,after,d,'sine.inOut');move(el,folded,{x:0,y:0,rotation:0},after+d+.08,d,'power3.out');});}else move(p23ById(w.id),{clipPath:'inset(0 50% 0 50%)'},{clipPath:'inset(0 0% 0 0%)'},w.start,.2,'sine.out');});
  break;
 case 'comfort-cradle':
  all.forEach(w=>applyLetters(w,(el,k,n)=>{const bend=Math.sin(Math.PI*(k+1)/(n+1)),after=w.end+.4;move(el,{y:0,scaleY:1},{y:bend*35,scaleY:.87},after,.32,'sine.inOut');tl.to(el,{y:0,scaleY:1,duration:Math.max(.25,Math.min(.82,p.showEnd-after-.5)),ease:'sine.inOut'},after+.32);}));
  move(lines[0],{scaleY:.35,y:100},{scaleY:1,y:0},start,Math.min(2.5,span-.1),'power2.out');
  break;
 case 'fear-clearing':
  all.forEach((w,i)=>move(p23ById(w.id),i>=3?{clipPath:'circle(0% at 50% 50%)',z:-200}:{clipPath:'inset(0 100% 0 0)'},{clipPath:i>=3?'circle(80% at 50% 50%)':'inset(0 0% 0 0)',z:0},w.start,.2,'power3.out'));
  move(root.querySelector('.shadow-left'),{x:280,opacity:.65},{x:-270,opacity:0},start,.92,'power3.out');
  move(root.querySelector('.shadow-right'),{x:-280,opacity:.65},{x:270,opacity:0},start+.18,1.14,'power3.out');
  break;
 case 'table-setting':
  all.forEach((w,i)=>move(p23ById(w.id),{y:i<4?-70:110,x:(i-3)*-35,rotationX:i<4?-30:45,z:-60},normal,w.start,.83,'power2.out'));
  move(lines[0],{x:-80},{x:0},start,Math.min(2.4,span-.1),'power2.out');
  break;
 case 'affliction-perimeter':
  all.forEach((w,i)=>{const vulnerable=has(w,'me');move(p23ById(w.id),vulnerable?{scale:.85,y:20}:{x:(i%2?1:-1)*(50+i*8),y:Math.sin(i*1.7)*55,rotation:(i%2?1:-1)*9},{x:0,y:0,rotation:0,scale:1},w.start,.9,'power3.out');});
  move(lines[0],{scaleY:1.6,y:-180},{scaleY:1,y:0},start,Math.min(3.4,span-.1),'sine.inOut');
  break;
 case 'anointing-descent':
  all.forEach(w=>applyLetters(w,(el,k)=>move(el,{y:-110-(k%3)*24,scaleY:1.28},{y:0,scaleY:1},w.start+k*.018,.75,'power2.out')));
  move(lines[1],{y:-190,scaleY:.5},{y:40,scaleY:1},start,Math.min(3.1,span-.1),'sine.inOut');
  break;
 case 'cup-overflow':
  all.forEach((w,i)=>{const el=p23ById(w.id);move(el,{x:(i%3-1)*-75,y:115+(i%3)*12,rotation:(i%3-1)*12},{x:0,y:-10,rotation:0},w.start,.75,'power2.out');tl.to(el,{y:0,duration:.7,ease:'sine.inOut'},w.start+.75);});
  move(lines[0],{scaleY:.8,y:25},{scaleY:1,y:0},start,Math.min(3.7,span-.1),'sine.inOut');
  break;
 case 'walking-depth-stations':
  {const transit=all[3].start;all.forEach((w,i)=>move(p23ById(w.id),{z:i<3?0:-490,rotationY:i<3?0:-9},{z:i<3?0:-490,rotationY:i<3?0:-9},p.showStart,.01,'none'));move(world,{z:0,x:0},{z:490,x:-110},transit-.14,.64,'sine.inOut');all.slice(0,3).forEach(w=>tl.to(p23ById(w.id),{opacity:.22,duration:.4},transit));const gather=Math.min(p.end+.22,p.showEnd-.9);tl.to(world,{z:0,x:0,duration:.7,ease:'power3.out'},gather);all.forEach(w=>tl.to(p23ById(w.id),{z:0,rotationY:0,opacity:1,duration:.7,ease:'power3.out'},gather));const gate=makeTrace(root,p.id+'-depth-gate','M 710 70 L 710 980 M 1820 70 L 1820 980',.45,2.4);drawTrace(gate,start,.65);move(gate,{z:-60},{z:520,x:-80,opacity:0},transit,.7,'sine.inOut');}
  break;
 case 'shadow-passage':
  all.forEach(w=>move(p23ById(w.id),{rotationX:-18,z:-100},{...normal},w.start,.7,'power3.out'));
  move(root.querySelector('.shadow-left'),{x:370,opacity:.63,skewY:18},{x:-180,opacity:0,skewY:0},start,1.8,'sine.inOut');
  move(root.querySelector('.shadow-right'),{x:-370,opacity:.55,skewY:-18},{x:180,opacity:0,skewY:0},start+.15,1.8,'sine.inOut');
  break;
 case 'unfastening-fear':
  all.forEach(w=>applyLetters(w,(el,k,n)=>{const a=(k-(n-1)/2)*.34,after=w.end+.4,d=Math.min(.34,Math.max(.1,(p.showEnd-after-.24)/2));const knot={x:Math.sin(a)*55-k*2,y:(1-Math.cos(a))*-125,rotation:a*50};move(el,{x:0,y:0,rotation:0},knot,after,d,'sine.inOut');move(el,knot,{x:0,y:0,rotation:0},after+d,d,'sine.out');}));
  move(lines[0],{scaleX:.55,scaleY:1.6,x:190,y:-95},{scaleX:1.12,scaleY:.8,x:-40,y:30},start,Math.min(2.4,span-.1),'sine.inOut');
  break;
 case 'meeting-you-me':
  all.forEach(w=>{const you=has(w,'you'),me=has(w,'me');move(p23ById(w.id),{x:you?90:0,y:you?-45:me?110:18,rotation:0},normal,w.start,you?.5:me?.7:.4,'sine.out');});
  move(lines[1],{rotation:-12,x:-80},{rotation:0,x:0},start,Math.min(2.2,span-.1),'power2.out');
  break;
 case 'lifting-supports':
  all.forEach((w,i)=>move(p23ById(w.id),{rotation:has(w,'rod')?-30:has(w,'staff')?30:0,transformOrigin:has(w,'rod')?'0% 100%':'100% 100%',y:i%2?-20:40},normal,w.start,1.0,'sine.out'));
  {const rod=get('rod'),staff=get('staff');[rod,staff].forEach((w,i)=>{const support=makeTrace(root,w.id+'-bearing',`M ${w.x+w.width*.5} ${w.y+w.size*.98} L ${w.x+w.width*.5} 430`,.72,3);drawTrace(support,w.start,.7);move(support,{scaleY:.6},{scaleY:1},w.start,1,'sine.out');});}
  break;
 case 'settling-comfort':
  all.forEach(w=>applyLetters(w,(el,k,n)=>{const sign=k%2?1:-1,after=w.end+.4;move(el,{scaleX:1,scaleY:1,x:0},{scaleX:.86,scaleY:1.21,x:sign*4},after,.26,'sine.inOut');tl.to(el,{scaleX:1,scaleY:1,x:0,duration:Math.max(.24,Math.min(.7,p.showEnd-after-.44)),ease:'sine.inOut'},after+.26);}));
  break;
 case 'unbroken-declaration':
  all.forEach((w,i)=>{const el=p23ById(w.id);move(el,{rotationX:-78,transformOrigin:'50% 100%',clipPath:'inset(65% 0 0 0)'},{rotationX:0,clipPath:'inset(0% 0 0 0)'},w.start,.2,'power3.out');});
  {const joined=makeTrace(root,p.id+'-unbroken-baseline',`M ${p.x-15} ${p.y+181} L ${p.x+1340} ${p.y+181}`,.72,2.4);drawTrace(joined,start,Math.min(3.4,span-.4));tl.to(joined,{scaleX:1.04,duration:Math.max(.4,span-3.7),transformOrigin:'0 50%',ease:'none'},start+3.5);}
  break;
 case 'following-mercy':
  all.forEach((w,i)=>{const el=p23ById(w.id);move(el,{x:-180,y:75-Math.sin(i*.8)*90,rotation:-12},{x:-18,y:-8,rotation:1.5},w.start,.58,'sine.out');tl.to(el,{x:0,y:0,rotation:0,duration:.55,ease:'sine.inOut'},w.start+.58);});
  move(lines[0],{x:-220},{x:90},start,Math.max(1,span-.4),'sine.inOut');
  break;
 case 'days-orbit':
  all.forEach((w,i)=>{const a=(i-2.5)*.3;move(p23ById(w.id),{x:Math.sin(a)*100,y:Math.cos(a)*-95,rotation:a*20},normal,w.start,1,'sine.out');});
  move(lines[0],{rotation:-12,transformOrigin:'50% 52%'},{rotation:9},start,Math.max(1,span-.2),'sine.inOut');
  break;
 case 'mercy-material':
  // The sung word is complete and legible first. Generated filaments develop
  // beneath its same reading station; once generated spelling is whole,
  // the editable face hands off without a detached or competing second word.
  all.forEach(w=>{if(!has(w,'mercy'))move(p23ById(w.id),{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0% 0 0)'},w.start,.2,'sine.out');});
  {const w=get('mercy'),ink=p23ById(w.id).querySelector('.ink'),v=P23_DATA.videos.find(v=>v.id==='mercy');
   move(ink,{color:'#fff1d4'},{color:'#edcf91'},w.end+.4,1.05,'sine.inOut');
   tl.to(ink,{opacity:0,duration:.48,ease:'sine.inOut'},v.start+3.1);
   lines.forEach(line=>tl.to(line,{opacity:.14,duration:.7},v.start+2.8));
  }
  break;
 case 'life-continuum':
  all.forEach((w,i)=>move(p23ById(w.id),{x:110,rotationY:-26,z:-140+i*22},normal,w.start,.82,'power3.out'));
  move(world,{x:45,z:-100,rotationY:-5},{x:0,z:0,rotationY:0},start,Math.min(3.8,span-.2),'sine.out');
  tl.to(lines[0],{x:150,duration:Math.max(1,span-1.5),ease:'none'},start+1.3);
  break;
 case 'quiet-courage':
  all.forEach(w=>{const el=p23ById(w.id);if(has(w,'fear')){const after=w.end+.4;move(el,{z:0,rotationY:0},{z:280,rotationY:52},after,.4,'sine.inOut');tl.to(el,{z:0,rotationY:0,color:'#ddc6a1',duration:.6,ease:'sine.out'},after+.4);}else move(el,{clipPath:'inset(100% 0 0 0)'},{clipPath:'inset(0% 0 0 0)'},w.start,.2,'power2.out');});
  break;
 case 'shared-shelter':
  all.forEach((w,i)=>move(p23ById(w.id),{x:i<3?-45:45,y:i<3?-28:85,rotationX:i<3?-15:20},normal,w.start,.95,'power2.out'));
  lines.forEach((el,i)=>move(el,{scaleX:1.15+i*.07,x:-50-i*20},{scaleX:1,x:0},start+i*.15,Math.min(2.7,span-.25),'sine.inOut'));
  break;
 case 'shepherd-homeward':
  all.forEach((w,i)=>{const theta=(i-2)*.24;onRoute(w,[[p.x+640+Math.sin(theta)*250,p.y+350+Math.cos(theta)*60,theta*45],[p.x+330+Math.sin(theta)*180,p.y+200+Math.cos(theta)*45,theta*23],[w.x,w.y,0]],w.start,1.05);});
  move(world,{rotationY:-7,z:-110},{rotationY:0,z:0},start,Math.min(3.2,span-.15),'sine.out');
  break;
 case 'nothing-release':
  all.forEach((w,i)=>{move(p23ById(w.id),{clipPath:i===4?'inset(0 46% 0 46%)':'inset(0 100% 0 0)'},{clipPath:'inset(0 0% 0 0)'},w.start,.2,'sine.out');});
  {const w=get('nothing'),release=makeTrace(root,p.id+'-release',`M ${w.x+20} ${w.y+145} C ${w.x-50} ${w.y-40},${w.x+w.width+65} ${w.y-55},${w.x+w.width-10} ${w.y+145} Z`,.64,1.8);drawTrace(release,w.start,.7);tl.to(release,{scaleX:1.6,scaleY:.01,y:65,opacity:.16,transformOrigin:'50% 50%',duration:Math.max(.75,p.showEnd-w.start-.8),ease:'sine.inOut'},w.start+.7);}
  break;
 case 'house-doorway':
  all.forEach((w,i)=>move(p23ById(w.id),{x:i<5?140:-80,z:-160,rotationY:i<5?-34:34,y:i%5*12},normal,w.start,.85,'power3.out'));
  move(world,{z:-75},{z:0},start,Math.min(4,span-.2),'sine.out');
  break;
 case 'long-time':
  all.forEach(w=>{if(has(w,'long'))applyLetters(w,(el,k,n)=>{move(el,{x:0},{x:(k-(n-1)/2)*22},w.end+.4,Math.min(3.2,p.showEnd-w.end-.6),'sine.inOut');});else move(p23ById(w.id),{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0% 0 0)'},w.start,.2,'power2.out');});
  move(lines[1],{scaleX:.5,x:70},{scaleX:1.4,x:-65},start,Math.max(1,span-.2),'none');
  break;
 case 'final-anchor':
  all.forEach((w,i)=>move(p23ById(w.id),{clipPath:i<3?'inset(0 0 100% 0)':'inset(100% 0 0 0)',rotationX:i<3?-14:14},{clipPath:'inset(0 0 0% 0)',rotationX:0},w.start,.2,'sine.out'));
  {const w=get('shepherd'),anchor=makeTrace(root,p.id+'-anchor',`M ${w.x+w.width*.5} ${w.y+115} L ${w.x+w.width*.5} 860 C ${w.x+w.width*.5} 900,800 960,1050 775`,.74,1.8);drawTrace(anchor,w.start,Math.max(1,p.showEnd-w.start-.05));}
  break;
 default:throw Error('Missing choreography '+p.family);
 }
}
