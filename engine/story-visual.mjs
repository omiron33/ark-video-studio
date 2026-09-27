/** The long-form film vocabulary. All motion is evaluated from absolute song time. */
export const STORY_CATALOG={story:'Authored lyric tableaux: threshold, pairing, calendar, rain, rupture, shelter and absence.'};
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),mix=(a,b,p)=>a+(b-a)*p;
const ease=v=>1-Math.pow(1-clamp(v),3),smooth=v=>{v=clamp(v);return v*v*(3-2*v)};
const tau=Math.PI*2,random=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v)};
const key=w=>String(w?.text||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const words=e=>e.p.words.filter(w=>e.s.wordIds.includes(w.id));
const afterPhrase=e=>{const end=Math.max(e.s.start,...words(e).map(w=>w.end));return smooth((e.t-end-.22)/Math.max(.45,e.s.end-end-.22))};

/** Lyric-triggered relationships, independent of where a word sits in the layout.
 * Agents may replace an action without altering text, audio or adjacent scenes. */
export function applyStoryActions(section,word,allWords,t,pose){
 const result={...pose};
 for(const action of section.direction?.actions||[]){
  if(action.targetIds?.length&&!action.targetIds.includes(word.id))continue;
  const trigger=allWords.find(w=>w.id===action.triggerId);if(!trigger)continue;
  let at=(action.after==='end'?trigger.end:trigger.start)+(action.delay||0);
  if(action.afterTargets)at=Math.max(at,...allWords.filter(w=>action.targetIds?.includes(w.id)).map(w=>w.end+.15));
  const p=smooth((t-at)/Math.max(.06,action.duration||.55));
  const from=action.from||{},to=action.to||{};
  const value=(field,neutral=0)=>mix(Number.isFinite(from[field])?from[field]:neutral,Number.isFinite(to[field])?to[field]:neutral,p);
  const scale=value('scale',1),origin=action.origin;
  if(origin){result.x=origin.x+(result.x-origin.x)*scale;result.y=origin.y+(result.y-origin.y)*scale;}
  result.x+=value('dx');result.y+=value('dy');result.rotate+=value('rotate');result.scale*=scale;result.opacity*=value('opacity',1);
 }
 return result;
}

export function installStoryStyles(register,h){
 function stroke(c,points,color,width=1){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke()}
 function circle(c,x,y,r,color,width=1){c.beginPath();c.arc(x,y,r,0,tau);c.strokeStyle=color;c.lineWidth=width;c.stroke()}
 function ark(c,x,y,w,color,progress=1){
  c.save();c.strokeStyle=color;c.lineWidth=2;c.setLineDash([w*3*progress,w*3]);c.beginPath();c.moveTo(x-w/2,y-60);c.lineTo(x+w/2,y-60);c.lineTo(x+w*.45,y+55);c.quadraticCurveTo(x,y+90,x-w*.45,y+55);c.closePath();c.stroke();
  c.setLineDash([]);stroke(c,[[x-w*.43,y-60],[x-w*.36,y-112],[x+w*.36,y-112],[x+w*.43,y-60]],color,1.6);
  for(let i=-5;i<=5;i++)stroke(c,[[x+i*w*.064,y-92],[x+i*w*.064,y-72]],color,1.1);
  stroke(c,[[x-w*.46,y],[x+w*.46,y]],color,1);c.restore();
 }
 function bird(c,x,y,size,phase,color){
  const wing=Math.sin(phase)*size*.35;c.beginPath();c.moveTo(x-size,y-wing);c.quadraticCurveTo(x-size*.5,y-size*.45,x,y);c.quadraticCurveTo(x+size*.5,y-size*.45,x+size,y-wing);c.strokeStyle=color;c.lineWidth=1.4;c.stroke();
 }
 function weather(c,e,strength=1){
  c.save();for(let i=0;i<125*strength;i++){const x=random(i+e.seed)*2040-60,y=(random(i+811)*1260+e.t*(190+random(i+90)*220))%1260-90;stroke(c,[[x,y],[x-11,y+38+random(i+70)*30]],`rgba(183,216,214,${.045+random(i+22)*.10})`,.8)}c.restore();
 }
 function photo(c,e){
  const d=e.s.direction,img=e.assets[d.photo||e.s.assetIds?.find(id=>e.assets[id])];
  if(!img)return false;
  if(d.water){h.oceanPhoto(c,e);return true}
  c.fillStyle=e.ink;c.fillRect(0,0,1920,1080);
  const p=clamp((e.t-e.s.start)/(e.s.end-e.s.start)),zoom=(d.zoom||1.08)+p*.045;
  const ratio=Math.max(1920/img.width,1080/img.height)*zoom,dw=img.width*ratio,dh=img.height*ratio;
  const dx=(d.pan??1)*mix(-18,18,p),dy=(d.tilt||0)*mix(-13,13,p);
  const x=(1920-dw)/2+dx,y=(1080-dh)/2+dy;
  if(d.mode==='seal'){
   // Each photographed timber leaf slides toward the real light seam. Cropping
   // at the center removes the slit as the doors meet; the wood remains real.
   const shut=afterPhrase(e),travel=48*shut;
   c.save();c.beginPath();c.rect(0,0,960,1080);c.clip();c.drawImage(img,x+travel,y,dw,dh);c.restore();
   c.save();c.beginPath();c.rect(960,0,960,1080);c.clip();c.drawImage(img,x-travel,y,dw,dh);c.restore();
  }else c.drawImage(img,x,y,dw,dh);
  if(Number.isFinite(d.waterline)){
   // A protected upper region keeps the ark rigid while foreground water flows.
   const top=clamp(d.waterline,.5,.95)*1080;
   for(let row=top;row<1080;row+=5){
    const depth=(row-top)/(1080-top),shift=(Math.sin(row*.012-e.t*1.4)*10+Math.sin(row*.037+e.t*.9)*4)*depth;
    c.drawImage(img,0,(row-y)/ratio,img.width,5/ratio,x+shift,row,dw,5.4);
   }
  }
  if(d.gritty){c.save();c.globalCompositeOperation='color';c.globalAlpha=d.mode==='shelter'?.3:.48;c.fillStyle='#46505a';c.fillRect(0,0,1920,1080);c.restore();c.fillStyle='rgba(3,8,13,.13)';c.fillRect(0,0,1920,1080);}
  const shade=c.createLinearGradient(0,0,0,1080);shade.addColorStop(0,'rgba(2,12,17,.48)');shade.addColorStop(.48,'rgba(2,12,17,.20)');shade.addColorStop(1,'rgba(2,12,17,.28)');c.fillStyle=shade;c.fillRect(0,0,1920,1080);
  if(d.rain)weather(c,e,.75);
  if(d.mode==='shelter'||d.mode==='breath'){
   c.save();for(let i=0;i<55;i++){const x=(random(i+56)*2000+(e.t-e.s.start)*(4+random(i)*7))%2000,y=random(i+971)*1080+Math.sin(e.t*.27+i)*17;c.globalAlpha=.08+random(i+81)*.16;c.fillStyle='#efc688';c.beginPath();c.arc(x,y,.5+random(i+19)*1.5,0,tau);c.fill()}c.restore();
  }
  h.vignette(c,.28);h.grain(c,e.t);h.label(c,e);return true;
 }
 function background(c,e){
  const d=e.s.direction,mode=d.mode||'statement',light=d.light===true,fg=light?e.ink:e.paper;
  if(photo(c,e))return;
  c.fillStyle=light?e.paper:e.ink;c.fillRect(0,0,1920,1080);
  if(!light){const g=c.createRadialGradient(960,570,70,960,570,1150);g.addColorStop(0,d.gritty?'#182126':'#12373d');g.addColorStop(1,e.ink);c.fillStyle=g;c.fillRect(0,0,1920,1080)}
  const elapsed=e.t-e.s.start,phase=elapsed*.23;
  c.save();c.globalAlpha=d.graphicStrength??(light?.28:.34);
  if(['gateway','seal','shelter','overture','names'].includes(mode)){
   const reveal=ease(elapsed/1.7);ark(c,960,790,1420,fg,reveal);
   if(mode==='gateway'||mode==='seal'){const width=mode==='seal'?mix(480,16,afterPhrase(e)):mix(36,470,ease(elapsed/2));stroke(c,[[960-width/2,750],[960-width/2,180],[960+width/2,180],[960+width/2,750]],e.accent,2);for(let i=0;i<9;i++)stroke(c,[[960+(i-4)*width/9,750],[960+(i-4)*165,1080]],e.accent,.8)}
   if(mode==='shelter')for(let i=0;i<6;i++){const x=360+i*240;circle(c,x,808,12,e.accent);stroke(c,[[x,820],[x,853]],fg,1)}
  }else if(['pairs','family'].includes(mode)){
   const pairs=d.number||7;
   if(d.pairLanes){
    const lanes=d.pairLanes,trigger=e.p.words.find(w=>w.id===lanes.triggerId),at=trigger?.start??e.s.start;
    for(let i=0;i<pairs;i++){const p=ease((e.t-at-i*.11)/.35),x=lanes.x+i*lanes.w/(pairs-1||1),y=lanes.y;
     c.globalAlpha=.18+p*.6;const gap=mix(45,18,p);circle(c,x-gap,y,12,fg,2);circle(c,x+gap,y,12,e.accent,2);stroke(c,[[x-gap+12,y],[x+gap-12,y]],e.accent,1.6);
    }
   }else for(let i=0;i<pairs;i++){const theta=-Math.PI/2+i*tau/pairs,rad=360+Math.sin(phase+i)*5,x=960+Math.cos(theta)*rad*1.9,y=555+Math.sin(theta)*rad;
    const settle=ease((elapsed-i*.11)/1.5),gap=mix(65,16,settle);
    circle(c,x-gap,y,11,fg,1.4);circle(c,x+gap,y,11,e.accent,1.4);stroke(c,[[x-gap+11,y],[x+gap-11,y]],fg,.7);circle(c,960,550,160+i*29,fg,.3)}
  }else if(['calendar','count'].includes(mode)){
   const number=d.number||40,n=Math.min(number,60),r=365;
   const countAt=(words(e).find(w=>w.id===d.triggerId)||words(e)[0])?.start??e.s.start;
   const clock=d.countTimeline,progress=clock?clamp((e.t-clock.start)/(clock.end-clock.start)):ease((e.t-countAt)/1.8);
   const counted=Math.floor(progress*n);
   for(let i=0;i<n;i++){const a=-Math.PI/2+i*tau/n,x=960+Math.cos(a)*r,y=560+Math.sin(a)*r;stroke(c,[[x,y],[960+Math.cos(a)*(r+(i%5?10:25)),560+Math.sin(a)*(r+(i%5?10:25))]],i<counted?e.accent:fg,i%5?1:2)}
   circle(c,960,560,r-20,fg,.7);
   if(clock){
    const a=-Math.PI/2+progress*tau,fade=1-smooth((e.t-countAt)/.45);
    c.globalAlpha=.5*fade;c.beginPath();c.arc(960,560,r-35,-Math.PI/2,a);c.strokeStyle=e.accent;c.lineWidth=5;c.stroke();
    stroke(c,[[960,560],[960+Math.cos(a)*(r-48),560+Math.sin(a)*(r-48)]],e.accent,2);
    c.globalAlpha=.26*fade+.04;h.setFont(c,600,'Barlow Condensed');c.fillStyle=fg;c.fillText(String(Math.round(mix(clock.from||0,clock.to||number,progress))).padStart(clock.digits||1,'0'),960,760);
    if(clock.caption){c.globalAlpha=.5*fade;h.setFont(c,42,'Cinzel');c.fillText(clock.caption,960,870)}
   }else{c.globalAlpha=light?.09:.055;h.setFont(c,740);c.fillStyle=fg;c.fillText(String(number),960,820)}
  }else if(mode==='birds'){
   for(let i=0;i<28;i++){const x=(random(i+e.seed)*2350+elapsed*(16+random(i)*15))%2350-200,y=200+random(i+86)*640;bird(c,x,y,14+random(i+9)*26,e.t*2.7+i,fg)}
   for(let j=0;j<9;j++){c.beginPath();for(let x=-100;x<2020;x+=20){const y=760-j*60-Math.sin(x*.0016+phase)*130;x===-100?c.moveTo(x,y):c.lineTo(x,y)}c.strokeStyle=fg;c.lineWidth=.5;c.stroke()}
  }else if(['rain','rupture','deep'].includes(mode)){
   c.globalAlpha=1;weather(c,e,mode==='rain'?1:.4);c.globalAlpha=.25;
   for(let j=0;j<19;j++){c.beginPath();for(let x=0;x<=1920;x+=16){const y=740+j*17+Math.sin(x*.006+phase+j*.16)*9; x?c.lineTo(x,y):c.moveTo(x,y)}c.strokeStyle=fg;c.lineWidth=.8;c.stroke()}
   if(mode!=='rain'){const split=ease(elapsed/1.3);for(let j=0;j<8;j++){const x=960+(j-3.5)*90;stroke(c,[[x,1080],[x+20,880],[x-35,800],[x+18,725],[x+85*split,680-230*split]],e.accent,j%2?1:2)}}
  }else if(['map','absence','sweep','silence'].includes(mode)){
   if(d.contourErosion){const erode=clamp(elapsed/3.3);c.beginPath();c.rect(erode*1940,0,1940*(1-erode),1080);c.clip()}
   const lost=afterPhrase(e);for(let j=0;j<17;j++){c.beginPath();for(let x=-100;x<=2020;x+=18){const y=220+j*43+Math.sin(x*.003+j*.51)*24+Math.sin(x*.009+j)*6;x===-100?c.moveTo(x,y):c.lineTo(x,y)}c.strokeStyle=fg;c.lineWidth=.7;c.globalAlpha=.18*(1-lost*.75);c.stroke()}
   if(mode==='map')for(let i=0;i<11;i++){const x=160+i*159,y=650+Math.sin(i*2.1)*130;stroke(c,[[x-15,y],[x-15,y-26],[x,y-40],[x+15,y-26],[x+15,y],[x-15,y]],e.accent,1)}
  }else if(['lift','drift','horizon','engulf'].includes(mode)){
   for(let j=0;j<35;j++){const depth=d.horizonTravel?(j+elapsed*1.9)%35:j;c.beginPath();for(let x=-50;x<=1970;x+=16){const y=670+depth*depth*.39+Math.sin(x*.004+e.t*.35+depth*.21)*(10+depth*.65);x===-50?c.moveTo(x,y):c.lineTo(x,y)}c.strokeStyle=fg;c.lineWidth=j%5?.65:1.2;c.stroke()}
   if(mode==='drift'||mode==='lift'||d.ark)ark(c,960+Math.sin(e.t*.25)*28,820+Math.sin(e.t*.7)*6,d.ark?mix(620,300,clamp(elapsed/(e.s.end-e.s.start))):700,e.accent);
  }else if(mode==='breath'){
   for(let i=0;i<9;i++)circle(c,960,560,120+i*38+Math.sin(elapsed*.9-i*.25)*14,fg,i%3?1:2);
  }else{
   for(let i=0;i<7;i++){const y=310+i*100;stroke(c,[[120,y],[1800,y]],fg,.45)}
   circle(c,960,555,390,fg,.6);
  }
  c.restore();h.grain(c,e.t,light);h.label(c,e,light);
 }
 function layout(c,e){
  const d=e.s.direction,ws=words(e),groups=[];
  if(d.lines?.length)for(const ids of d.lines)groups.push(ids.map(id=>ws.find(w=>w.id===id)).filter(Boolean));
  else{let group=[],letters=0;for(const w of ws){if(group.length&&letters+w.text.length>23){groups.push(group);group=[];letters=0}group.push(w);letters+=w.text.length+1}if(group.length)groups.push(group)}
  const rows=groups.filter(g=>g.length),box=d.textBox||{x:190,y:225,w:1540,h:650};
  const positions=[],maxSize=Math.min(d.typeSize||270,box.h/Math.max(1,rows.length)*1.03),centerX=box.x+box.w/2;
  rows.forEach((row,ri)=>{
   const sizes=row.map(w=>({w,hero:(d.heroIds||[]).includes(w.id),small:['the','and','of','to','in','a','as','his','for','with','upon','that','had','was'].includes(key(w))&&!d.uniform}));
   const measured=sizes.map(o=>{const factor=o.small?.72:o.hero?1.08:1,family=d.fonts?.[o.w.id]||(o.small?(d.connectorFont||'Cormorant Garamond'):(d.fontFamily||'Bebas Neue'));h.setFont(c,100*factor,family);return {...o,factor,family,width:c.measureText(o.w.text.replace(/[.,]$/,'').toUpperCase()).width}});
   const baseWidth=measured.reduce((s,o)=>s+o.width,0)+(row.length-1)*22;
   const size=Math.min(maxSize,box.w/baseWidth*100),width=baseWidth*size/100;
   let x=d.align==='left'?box.x:d.align==='right'?box.x+box.w-width:centerX-width/2;
   const rowY=box.y+box.h*(ri+.5)/rows.length+size*.33;
   for(const o of measured){const w=o.width*size/100;positions.push({...o,x:x+w/2,y:rowY,size:size*o.factor});x+=w+22*size/100}
  });
  // Authored compositions can place individual words in a landscape or in paired
  // lanes without coupling their acoustic timing to their visual position.
  for(const o of positions){
   const custom=d.positions?.[o.w.id];if(!custom)continue;
   for(const field of ['x','y','size','rotate'])if(Number.isFinite(custom[field]))o[field]=custom[field];
   if(typeof custom.family==='string')o.family=custom.family;
  }
  return {positions,box};
 }
 function typography(c,e){
  const d=e.s.direction,mode=d.mode||'statement',ws=words(e),light=d.light===true,ink=light?e.ink:e.paper;
  if(!ws.length){
   const title=d.title;if(title){const elapsed=e.t-e.s.start,p=ease((elapsed-.3)/1.2),fade=d.fadeOut?smooth((e.s.end-e.t)/2):1;c.save();c.globalAlpha=p*fade;
    if(d.titleMotion==='chapter'){
     const drift=clamp(elapsed/(e.s.end-e.s.start));c.save();c.globalAlpha=.13*p;h.setFont(c,1220,'Cinzel');c.fillStyle=e.accent;c.translate(1380-220*drift,1040-100*drift);c.rotate(-.09+.05*drift);c.fillText('7',0,0);c.restore();
     const letters=[...'GENESIS'],spread=mix(265,205,smooth(drift)),center=960-90*drift;
     h.setFont(c,210,d.titleFont||d.fontFamily||'Cinzel');c.fillStyle=ink;
     for(const [i,letter]of letters.entries()){const arrive=ease((elapsed-.2-i*.18)/1.05);c.save();c.globalAlpha=arrive;c.translate(center+(i-3)*spread,600+(1-arrive)*(i%2?-270:270)-45*drift);c.rotate((1-arrive)*(i%2?.1:-.1));c.fillText(letter,0,0);c.restore()}
     const rule=clamp((elapsed-1.1)/4.8);stroke(c,[[220,700],[220+1480*rule,700]],e.accent,2);
    }else if(d.titleMotion==='threshold'){
     const progress=clamp(elapsed/(e.s.end-e.s.start));c.translate(960,580-90*progress);c.scale(1-progress*.90,1+progress*.9);h.setFont(c,740,d.titleFont||'Cinzel');c.fillStyle=ink;c.globalAlpha=.5*(1-progress*.35);c.fillText(title,0,140);
    }else if(d.titleToHorizon){const gone=smooth((elapsed-3)/Math.max(2,e.s.end-e.s.start-4));c.translate(960,585);c.scale(1+gone*.55,1-gone*.985);h.setFont(c,d.titleSize||255,d.titleFont||d.fontFamily);c.fillStyle=ink;c.fillText(title,0,(1-p)*35)}
    else{h.setFont(c,d.titleSize||255,d.titleFont||d.fontFamily);c.fillStyle=ink;c.fillText(title,960,585+(1-p)*35);if(d.subtitle){h.setFont(c,50,'Cormorant Garamond');c.globalAlpha*=.7;c.fillText(d.subtitle,960,685)}}c.restore()}
   return;
  }
  const {positions,box}=layout(c,e),end=Math.max(...ws.map(w=>w.end)),tail=afterPhrase(e);
  const cue=ws.find(w=>w.id===d.triggerId)||ws.find(w=>['lifted','higher','above','burst','broke','shut','swept','below','gone'].includes(key(w)))||ws.at(-1);
  const action=ease((e.t-cue.start)/.8),native=d.nativeMotion??!(d.actions?.length);
  if(mode==='shelter'||mode==='family'){
   c.save();c.globalAlpha=.34*ease((e.t-e.s.start)/.6);const p=22;stroke(c,[[box.x+p,box.y],[box.x,box.y],[box.x,box.y+box.h],[box.x+p,box.y+box.h]],e.accent,2);stroke(c,[[box.x+box.w-p,box.y],[box.x+box.w,box.y],[box.x+box.w,box.y+box.h],[box.x+box.w-p,box.y+box.h]],e.accent,2);c.restore();
  }
  c.save();
  if(d.photo){c.shadowColor='rgba(1,10,14,.65)';c.shadowBlur=16;c.shadowOffsetY=3;}
  for(const [i,o]of positions.entries()){
   let x=o.x,y=o.y,rotate=o.rotate||0,opacity=1,scale=1;const entrance=ease((e.t-o.w.start)/.19);
   if(native&&(mode==='pairs'||mode==='family'))x+=(i%2?1:-1)*100*(1-entrance);
   if(mode==='gateway'){if(native)x-=130*(1-entrance);if(d.exitThrough){x=mix(x,d.exitThrough.x??1280,tail);y=mix(y,d.exitThrough.y??620,tail);scale=Math.max(.01,1-tail);opacity=1-tail;}}
   if(native&&mode==='rain')y-=140*(1-entrance);
   if(native&&mode==='lift'&&(o.hero||['ark','high','higher','lifted','above'].includes(key(o.w))))y-=action*60;
   if(native&&mode==='birds')y-=Math.sin(clamp((e.t-o.w.start)/1.2)*Math.PI)*22;
   if(native&&mode==='breath'){scale=1+Math.sin(Math.max(0,e.t-o.w.start)*1.7)*.008;}
   if(native&&mode==='drift')x+=Math.sin((e.t-e.s.start)*.3)*18;
   if(native&&mode==='rupture'&&o.hero){x+=(o.x<960?-1:1)*action*12;rotate+=(o.x<960?-.012:.012)*action;}
   if(mode==='sweep'){x-=tail*220;opacity=1-tail;}
   if(mode==='absence'&&e.t>end+.2){opacity=1-tail;}
   if(mode==='engulf'){y+=tail*220;}
   if(mode==='seal'){x=mix(x,960+(x-960)*.45,tail);scale*=1-tail*.55;opacity=1-tail;}
   ({x,y,rotate,opacity,scale}=applyStoryActions(e.s,o.w,e.p.words,e.t,{x,y,rotate,opacity,scale}));
   const color=o.hero?e.accent:ink;
   const tracking=native&&mode==='rupture'&&o.hero?tail*14:0,curve=d.curves?.[o.w.id]?.amplitude||0;
   const frag=d.fragments?.[o.w.id],fragTrigger=frag?e.p.words.find(w=>w.id===frag.triggerId):null;
   const fragment=fragTrigger?clamp((e.t-Math.max(o.w.end+.18,fragTrigger.end+(frag.delay??.2)))/(frag.duration||.8)):0;
   h.word(c,o.w,e.t,x,y,o.size,{family:o.family,color,rotate,opacity,scale,tracking,curve,fragment,motion:['rain','pairs','family','gateway'].includes(mode)?'none':'lift'});
  }
  c.restore();
  if(mode==='calendar'||mode==='count'){
   const p=ease((e.t-cue.start)/.7);c.save();c.globalAlpha=.75*p;const x=960,y=960;stroke(c,[[x-330*p,y],[x+330*p,y]],e.accent,2);for(let i=0;i<Math.min(d.number||7,40);i++){const n=Math.min(d.number||7,40),xx=x-320+i*640/(n-1||1);stroke(c,[[xx,y-5],[xx,y+8]],e.accent,1)}c.restore();
  }
 }
 function foreground(c,e){
  const d=e.s.direction,mode=d.mode,tail=afterPhrase(e);
  if(mode==='engulf'&&tail>0){
   const y=1080-tail*1190;c.beginPath();c.moveTo(0,1080);for(let x=0;x<=1920;x+=16)c.lineTo(x,y+Math.sin(x*.004-e.t)*25);c.lineTo(1920,1080);c.closePath();c.fillStyle=e.ink;c.fill();
  }
  if(mode==='seal'&&tail>0&&d.photo){
   c.fillStyle=`rgba(2,10,13,${tail*.72})`;c.fillRect(0,0,1920,1080);
  }else if(mode==='seal'&&tail>0){
   c.save();c.globalAlpha=tail;const width=tail*963;
   for(const [x,w]of [[0,width],[1920-width,width]]){const g=c.createLinearGradient(x,0,x+w,0);g.addColorStop(0,'#07191c');g.addColorStop(.9,'#102c2e');g.addColorStop(1,'#021216');c.fillStyle=g;c.fillRect(x,0,w,1080);for(let i=0;i<14;i++)stroke(c,[[x+i*w/14,0],[x+i*w/14,1080]],'rgba(124,137,117,.06)',2)}
   const gap=(1-tail)*3;c.fillStyle=`rgba(229,197,130,${1-tail})`;c.fillRect(960-gap,0,gap*2,1080);c.restore();
  }
  if(d.transition==='ink'&&e.t>e.s.end-.3){const p=smooth((e.t-(e.s.end-.3))/.3);c.fillStyle=e.ink;c.fillRect(0,1080-p*1080,1920,p*1080)}
  if(d.fadeOut){const p=smooth((e.t-(e.s.end-2.5))/2.5);c.fillStyle=`rgba(0,0,0,${p})`;c.fillRect(0,0,1920,1080)}
 }
 register('story',{background,typography,foreground});
 return {layout};
}
