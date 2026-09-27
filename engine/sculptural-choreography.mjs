/** Filled, sculptural lyric compositions. Shapes are physical masses, not a
 * second set of hairline paths. Absolute time is the only animation state. */
export const SCULPTURAL_CATALOG={
 'eclipse-disc':'A massive dark-red eclipse passes behind an asymmetric verdict; words keep their reading plane.',
 'concentric-rupture':'Thick circular strata split outward once, releasing a monumental central word.',
 'stone-crush':'Two jagged stone masses converge around a sentence and its oversized decisive verb.',
 'crescent-sweep':'A broad crescent scythes around diagonal clauses while the lyric remains upright.',
 'shadow-procession':'Staggered words cast long architectural silhouettes into a receding plane.',
 'mark-seal':'A heavy, irregular impressed seal takes a named word at its center.',
 'torn-monument':'A monumental word is torn into two readable halves only after its reading hold.',
 'word-orbit':'Words occupy separate cardinal stations around a solid circular core, gently advancing after reading.',
 'redaction-slab':'Opaque typographic blocks accumulate into a bold offset ledger as each real word arrives.',
 'monolith-rise':'Successive clauses stand on three broad ascending monoliths, with measured vertical travel.'
};
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),mix=(a,b,p)=>a+(b-a)*p;
const ease=v=>1-Math.pow(1-clamp(v),3),smooth=v=>{v=clamp(v);return v*v*(3-2*v)};
const tau=Math.PI*2;
const selector=e=>typeof e.s.direction?.choreography==='string'?e.s.direction.choreography:e.s.direction?.choreography?.id;
const wordsOf=e=>e.s.wordIds.map(id=>e.p.words.find(w=>w.id===id)).filter(Boolean);
const textOf=w=>String(w.text).replace(/[.,]$/,'').toUpperCase();
const boxOf=(e,base)=>e.s.direction?.textBox||base?.box||{x:180,y:185,w:1560,h:750};
const tailOf=e=>{const end=Math.max(e.s.start,...wordsOf(e).map(w=>w.end));return smooth((e.t-end-.25)/Math.max(.45,e.s.end-end-.25))};
const random=n=>{const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x)};
const measure=(c,h,w,size,family)=>{h.setFont(c,size,family);return c.measureText(textOf(w)).width};
function groupsOf(words,count){
 if(!words.length)return[];count=Math.min(count,words.length);const out=Array.from({length:count},()=>[]),target=words.reduce((n,w)=>n+w.text.length+1,0)/count;let at=0,total=0;
 words.forEach((w,i)=>{out[at].push(w);total+=w.text.length+1;if(at<count-1&&(total>=target||words.length-i-1===count-at-1)){at++;total=0}});return out.filter(g=>g.length);
}
function row(c,e,h,words,b,{size=180,align='center',family='Bebas Neue',group=0}={}){
 if(!words.length)return[];const items=words.map(w=>{const f=e.s.direction.fonts?.[w.id]||family;return{w,family:f,width:measure(c,h,w,100,f),hero:(e.s.direction.heroIds||[]).includes(w.id)}});
 const length=items.reduce((n,o)=>n+o.width,0)+(words.length-1)*24,sizeFit=Math.min(size,b.h*.84,b.w/Math.max(1,length)*100),width=length*sizeFit/100;let x=align==='left'?b.x:align==='right'?b.x+b.w-width:b.x+(b.w-width)/2;
 return items.map(o=>{const width=o.width*sizeFit/100,p={w:o.w,family:o.family,hero:o.hero,x:x+width/2,y:b.y+b.h*.53+sizeFit*.29,size:sizeFit,rotate:0,group};x+=width+sizeFit*.24;return p});
}
function safe(c,h,p,box){
 const o={...p},scale=o.scale??1;let width=measure(c,h,o.w,o.size,o.family)*scale;
 if(width>box.w-24){o.size*=(box.w-24)/width;width=box.w-24}
 if(o.size*scale>box.h*.6)o.size=box.h*.6/scale;
 const half=measure(c,h,o.w,o.size,o.family)*scale/2;
 o.x=clamp(o.x,box.x+half+8,box.x+box.w-half-8);o.y=clamp(o.y,box.y+o.size*scale*.88+8,box.y+box.h-10);return o;
}
function triggerOf(e,words){return words.find(w=>w.id===e.s.direction.triggerId)||words.find(w=>(e.s.direction.heroIds||[]).includes(w.id))||words[Math.floor(words.length/2)]}
/** Base layout is intentionally independent of camera layouts. Each treatment
 * composes the sentence differently; authored photo-safe boxes remain binding. */
export function sculpturalLayout(c,e,h,layout){
 const id=selector(e);if(!SCULPTURAL_CATALOG[id])return null;
 const words=wordsOf(e),box=boxOf(e,layout?.(c,e)),d=e.s.direction,trigger=triggerOf(e,words),out=[];
 const R=(x,y,w,ht)=>({x:box.x+x*box.w,y:box.y+y*box.h,w:w*box.w,h:ht*box.h});
 const add=(ws,r,opt)=>out.push(...row(c,e,h,ws,r,opt)),groups=groupsOf(words,3),cut=trigger?words.indexOf(trigger):0;
 if(id==='eclipse-disc'){
  groups.forEach((g,i)=>add(g,R(.025+i*.035,.055+i*.295,.79,.26),{size:i===1?240:165,align:'left',family:i===1?'Archivo Black':'Bebas Neue',group:i}));
 }else if(['concentric-rupture','stone-crush','mark-seal','torn-monument'].includes(id)){
  const narrow=id==='stone-crush',left=narrow?.18:.055,width=narrow?.64:.89;
  add(words.slice(0,cut),R(left,.01,width,.20),{size:145,group:0});
  add(words.slice(cut,cut+1),R(left,.27,width,.43),{size:id==='mark-seal'?315:370,family:'Archivo Black',group:1});
  const after=groupsOf(words.slice(cut+1),words.slice(cut+1).reduce((n,w)=>n+w.text.length,0)>32?2:1);
  after.forEach((g,i)=>add(g,R(left,.735+i*.24/after.length,width,.225/after.length),{size:150,group:2+i}));
 }else if(id==='crescent-sweep'){
  groups.forEach((g,i)=>add(g,R(.035+i*.14,.04+i*.295,.68,.25),{size:205,align:i===1?'center':'left',family:i===1?'Archivo Black':'Bebas Neue',group:i}));
 }else if(id==='shadow-procession'){
  groups.forEach((g,i)=>add(g,R(.02+i*.09,.03+i*.275,.79,.23),{size:190,align:i%2?'right':'left',family:'Archivo Black',group:i}));
 }else if(id==='word-orbit'){
  if(words.length<=4){const stations=[[.2,.01,.6,.24],[.54,.36,.44,.24],[.2,.74,.6,.24],[.02,.36,.44,.24]];words.forEach((w,i)=>add([w],R(...stations[i]),{size:205,family:i%2?'Bebas Neue':'Archivo Black',group:i}));}
  else{const bands=groupsOf(words,4),stations=[[.11,.005,.78,.19],[.51,.34,.48,.23],[.11,.79,.78,.19],[.015,.34,.45,.23]];bands.forEach((g,i)=>add(g,R(...stations[i]),{size:160,family:i%2?'Bebas Neue':'Archivo Black',group:i}));}
 }else if(id==='redaction-slab'){
  groups.forEach((g,i)=>add(g,R(i===1?.16:.025,.045+i*.29,.79,.25),{size:190,align:i===1?'right':'left',family:'Archivo Black',group:i}));
 }else if(id==='monolith-rise'){
  groups.forEach((g,i)=>{const short=groupsOf(g,Math.max(1,Math.ceil(g.reduce((n,w)=>n+w.text.length+1,0)/13))),top=.075+(2-i)*.105,step=(.96-top)/short.length;short.forEach((part,j)=>add(part,R(.025+i*.33,top+j*step,.29,step*.76),{size:190,family:i===1?'Archivo Black':'Bebas Neue',group:i}));});
 }
 for(const o of out){const custom=d.positions?.[o.w.id];if(custom)for(const k of ['x','y','size','rotate','family'])if(custom[k]!==undefined)o[k]=custom[k]}
 return{id,box,words,trigger,positions:out.map(p=>safe(c,h,p,box))};
}
export function sculpturalPoses(c,e,h,layout){
 const m=sculpturalLayout(c,e,h,layout);if(!m)return null;const {id,box,trigger}=m,cx=box.x+box.w/2,cy=box.y+box.h/2,gone=tailOf(e),elapsed=Math.max(0,e.t-e.s.start),action=trigger?ease((e.t-trigger.start)/.8):ease(elapsed/1.2);
 const poses=m.positions.map(o=>{let x=o.x,y=o.y,scale=1,rotate=o.rotate||0;const settled=ease((e.t-o.w.start)/.28);
  // The full word is present in its readable position on the onset frame.
  // Action changes the relation after arrival, rather than delaying arrival.
  if(id==='eclipse-disc')x+=(o.group===1?1:-1)*12*action;
  if(id==='concentric-rupture'){if(o.w.id===trigger?.id)scale=1+.025*action;else y+=Math.sign(o.y-cy)*14*action;}
  if(id==='stone-crush'){x=cx+(x-cx)*(1-.035*action);y+=o.group===1?8*action:0;}
  if(id==='crescent-sweep'){x+=o.group===1?-12*settled:8*settled;y+=(o.group-1)*8*action;}
  if(id==='shadow-procession'){x+=16*smooth(elapsed/Math.max(1,e.s.end-e.s.start));y-=o.group*4*settled;}
  if(id==='mark-seal'&&o.w.id===trigger?.id){scale=1+.025*smooth((e.t-o.w.end)/.55);}
  if(id==='torn-monument'){x+=Math.sign(x-cx||1)*10*gone;}
  if(id==='word-orbit'){const a=.085*gone,dx=x-cx,dy=y-cy;x=cx+dx*Math.cos(a)-dy*Math.sin(a);y=cy+dx*Math.sin(a)*.25+dy*Math.cos(a);}
  if(id==='redaction-slab')x+=(o.group===1?-1:1)*9*settled;
  if(id==='monolith-rise')y-=Math.min(18,box.h*.025)*smooth((e.t-o.w.start)/.9);
  return safe(c,h,{...o,x,y,rotate,scale,opacity:1,visible:e.t>=o.w.start},box);
 });return{...m,positions:poses,action,tail:gone};
}
const polygon=(c,points,color)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill()};
const disc=(c,x,y,r,color)=>{c.beginPath();c.arc(x,y,Math.max(.01,r),0,tau);c.fillStyle=color;c.fill()};
const ring=(c,x,y,outer,inner,color,start=0,end=tau)=>{c.beginPath();c.arc(x,y,Math.max(.1,outer),start,end);c.arc(x,y,Math.max(.01,inner),end,start,true);c.closePath();c.fillStyle=color;c.fill()};
function roughDisc(c,x,y,r,color,seed=1){const pts=[];for(let i=0;i<80;i++){const a=i*tau/80,rad=r*(.975+random(i+seed)*.025);pts.push([x+Math.cos(a)*rad,y+Math.sin(a)*rad])}polygon(c,pts,color)}
function thickArc(c,x,y,r,start,end,width,color){c.beginPath();c.arc(x,y,Math.max(1,r),start,end);c.lineWidth=width;c.strokeStyle=color;c.lineCap='butt';c.stroke()}
/** Photo overlays stay translucent; without a photograph these become broad,
 * decisive silhouettes. No human or celestial figure is synthesized here. */
export function drawSculpturalBackground(c,e,h){
 const id=selector(e);if(!SCULPTURAL_CATALOG[id])return false;
 const d=e.s.direction||{},box=boxOf(e),X=q=>box.x+box.w*q,Y=q=>box.y+box.h*q,words=wordsOf(e),trigger=triggerOf(e,words),age=Math.max(0,e.t-e.s.start),progress=clamp(age/Math.max(.01,e.s.end-e.s.start)),action=trigger?ease((e.t-trigger.start)/.85):ease(age/1.3),r=Math.min(box.w*.32,box.h*.62),fg=d.light?e.ink:e.paper;
 // Keep the palette deep even when the director's lyric accent is bright coral.
 const red='#901522',redLight='#ae2230',coal=d.light?'#282629':'#151316';
 c.save();c.globalAlpha*=d.photo?.22:.9;
 if(id==='eclipse-disc'){
  const x=X(.78)-box.w*.07*smooth(progress),y=Y(.47);roughDisc(c,x,y,r*1.18,red,e.seed||1);disc(c,x-r*(.52-.15*action),y-r*.03,r*1.08,coal);ring(c,x,y,r*1.25,r*1.20,redLight,Math.PI*.11,Math.PI*.89);
 }else if(id==='concentric-rupture'){
  const x=X(.5),y=Y(.5),turn=-.25+.14*progress;
  for(let j=0;j<4;j++){const outer=r*(.43+j*.26)+action*j*18,inner=outer-r*.12;const gap=.11+action*.07;c.save();c.translate(x,y);c.rotate(turn+j*.13);for(let k=0;k<3;k++)ring(c,0,0,outer,inner,j%2?coal:red,k*tau/3+gap,(k+1)*tau/3-gap);c.restore()}
  disc(c,x,y,r*.24,coal);
 }else if(id==='stone-crush'){
  const inward=box.w*(.06+.055*action),left=X(.04)+inward,right=X(.96)-inward;
  polygon(c,[[-100,-80],[left-70,-30],[left+15,220],[left-18,465],[left+38,740],[left-30,1150],[-100,1180]],coal);
  polygon(c,[[2020,-80],[right+35,-20],[right-10,210],[right+36,455],[right-38,730],[right+18,1160],[2020,1160]],red);
  polygon(c,[[left-92,-50],[left-33,260],[left-67,525],[left-6,1020],[left-29,1130],[left-102,600],[left-65,230],[left-132,-50]],redLight);
  polygon(c,[[right+58,-20],[right+105,280],[right+51,610],[right+123,1110],[right+74,1110],[right+8,620],[right+64,270],[right+18,-20]],coal);
 }else if(id==='crescent-sweep'){
  const x=X(.57),y=Y(.53);c.save();c.translate(x,y);c.rotate(-.72+progress*.60);c.beginPath();c.arc(0,0,r*1.14,-Math.PI*.64,Math.PI*.69);c.arc(r*.29,-r*.09,r*.84,Math.PI*.62,-Math.PI*.62,true);c.closePath();c.fillStyle=red;c.fill();c.restore();
  c.save();c.globalAlpha*=.45;thickArc(c,x,y,r*1.34,-Math.PI*.66+progress*.4,-Math.PI*.20+progress*.4,27,fg);c.restore();
 }else if(id==='shadow-procession'){
  const sway=progress*38;for(let i=0;i<7;i++){const x=X(-.07+i*.17),w=box.w*(.045+(i%3)*.008),top=Y(.12+(i%3)*.08);polygon(c,[[x+sway,top],[x+w+sway,top-22],[x+w*.8+sway,Y(.71)],[x+box.w*.18,Y(1.18)],[x-box.w*.12,Y(1.18)],[x+sway,Y(.71)]],i%3===1?red:coal)}
 }else if(id==='mark-seal'){
  const x=X(.5),y=Y(.51),size=r*(.70+.03*action);roughDisc(c,x,y,size*1.13,red,e.seed||2);disc(c,x,y,size*.93,coal);
  for(let i=0;i<7;i++){const rr=size*(.21+i*.095),start=-2.6+i*.12,end=2.55-i*.08;thickArc(c,x+Math.sin(i)*5,y+4,rr,start,end,10+i*.8,i%2?redLight:red)}
  for(let i=0;i<9;i++){const a=i*tau/9+.2,rr=size*1.10;c.save();c.translate(x+Math.cos(a)*rr,y+Math.sin(a)*rr);c.rotate(a);c.fillStyle=coal;c.fillRect(-4,-6,22,12);c.restore()}
 }else if(id==='torn-monument'){
  const split=box.w*(.016+.02*action);for(const side of [-1,1]){const ridge=[];for(let i=0;i<13;i++)ridge.push([X(.5)+side*(split+random(i+38)*32),Y(-.2+i*.12)]);polygon(c,[...ridge,[X(.5)+side*box.w*.6,Y(1.22)],[X(.5)+side*box.w*.6,Y(-.2)]],side<0?coal:red)}
  c.save();c.globalAlpha*=.16;polygon(c,[[X(-.03),Y(.13)],[X(1.02),Y(.02)],[X(1.02),Y(.19)],[X(-.03),Y(.3)]],fg);c.restore();
 }else if(id==='word-orbit'){
  const x=X(.5),y=Y(.50);roughDisc(c,x,y,r*.43,red,e.seed||5);ring(c,x,y,r*.70,r*.54,coal);ring(c,x,y,r*1.08,r*.98,red,-Math.PI*.58+progress*.15,-Math.PI*.23+progress*.15);ring(c,x,y,r*1.10,r*.91,red,Math.PI*.40+progress*.12,Math.PI*.69+progress*.12);
 }else if(id==='redaction-slab'){
  const slide=box.w*.05*smooth(progress);c.save();c.translate(X(.5),Y(.5));c.rotate(-.065);c.fillStyle=coal;c.fillRect(-box.w*.65+slide,-box.h*.45,box.w*1.25,box.h*.31);c.fillStyle=red;c.fillRect(-box.w*.4-slide,-box.h*.06,box.w,box.h*.30);c.fillStyle=coal;c.fillRect(-box.w*.62+slide,box.h*.32,box.w*1.21,box.h*.18);c.restore();
 }else if(id==='monolith-rise'){
  const groups=groupsOf(words,3);for(let i=0;i<3;i++){const first=groups[i]?.[0],rise=first?ease((e.t-first.start)/.95):ease(age/1.3),x=X(.02+i*.335),w=box.w*.28,top=Y(.29+(2-i)*.08)-rise*box.h*.08;polygon(c,[[x,top],[x+w,top-18],[x+w,Y(1.22)],[x,Y(1.22)]],i===1?red:coal);polygon(c,[[x+w,top-18],[x+w+22,top+3],[x+w+22,Y(1.22)],[x+w,Y(1.22)]],i===1?redLight:'#252025');}
 }
 c.restore();return true;
}
function silhouetteWord(c,e,h,o){
 const m=measure(c,h,o.w,o.size,o.family),photo=!!e.s.direction.photo;
 c.save();c.globalAlpha*=photo?.10:.3;c.translate(o.x,o.y+12);c.transform(1,.04,-.85,.80,0,0);h.setFont(c,o.size,o.family);c.fillStyle='#8e1422';c.fillText(textOf(o.w),0,0);c.restore();
 c.save();c.globalAlpha*=photo?.04:.10;polygon(c,[[o.x-m/2,o.y+8],[o.x+m/2,o.y+8],[o.x+m/2-170,o.y+225],[o.x-m/2-170,o.y+225]],e.accent);c.restore();
}
export function drawSculpturalTypography(c,e,h,layout){
 const m=sculpturalPoses(c,e,h,layout);if(!m)return false;const {id,positions,box}=m,fg=e.s.direction.light?e.ink:e.paper;
 c.save();if(e.s.direction.photo){c.shadowColor='rgba(0,0,0,.9)';c.shadowBlur=16;c.shadowOffsetY=3}
 for(const o of positions){if(!o.visible)continue;const age=Math.max(0,e.t-o.w.start),opts={family:o.family,color:o.hero?e.accent:fg,rotate:o.rotate,opacity:1,scale:o.scale,motion:'none',immediate:true};
  if(id==='shadow-procession')silhouetteWord(c,e,h,o);
  if(id==='redaction-slab'){
   const width=measure(c,h,o.w,o.size,o.family),grow=ease(age/.35);c.save();c.globalAlpha*=e.s.direction.photo?.24:.84;c.fillStyle=o.hero?'#6f0b17':'#252125';c.fillRect(o.x-width/2-12,o.y-o.size*.8,width+24,Math.max(5,o.size*.94*grow));c.restore();
  }
  if(id==='torn-monument'&&m.tail>.001){
   const width=measure(c,h,o.w,o.size,o.family),fracture=14*m.tail;
   for(const side of [-1,1]){c.save();c.beginPath();c.rect(side<0?0:o.x,o.y-o.size*1.2,side<0?o.x:1920-o.x,o.size*1.6);c.clip();h.word(c,o.w,e.t,o.x+side*fracture,o.y-side*fracture*.26,o.size,opts);c.restore()}
  }else h.word(c,o.w,e.t,o.x,o.y,o.size,opts);
 }
 c.restore();return true;
}
