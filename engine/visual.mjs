// Propagate the render revision to the style module in a long-lived preview server.
const {installStoryStyles,STORY_CATALOG}=await import(new URL('./story-visual.mjs'+new URL(import.meta.url).search,import.meta.url));
/** Deterministic, environment-neutral Canvas scene graph. No wall clock or random state.
 * New styles implement { background, typography }; agent edits live in project JSON.
 */
export const STYLE_CATALOG = {
  ...STORY_CATALOG,
  rise: 'A word-driven ocean field; the verb physically ascends above the water.',
  terrain: 'Contour lines become a mountain; the peak word follows its crest.',
  submerge: 'Photographic ocean, living surface, and lyrics descending below a waterline.',
  orbit: 'Individual words occupy a rotating circular constellation.',
  impact: 'Percussive stacked words with restrained depth and rhythmic scale.',
  verse: 'Quiet editorial typography over a photographic or drawn scene.',
};
export const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b, v));
const mix=(a,b,v)=>a+(b-a)*v;
const ease=v=>1-Math.pow(1-clamp(v),3);
const smooth=v=>{v=clamp(v);return v*v*(3-2*v)};
const rand=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v)};
const TAU=Math.PI*2;
const registry=new Map();
export function registerStyle(id,style){if(!style.background||!style.typography)throw Error('Style requires background and typography');registry.set(id,style)}
function setFont(c,size,family='Bebas Neue',weight='normal'){c.font=`${weight} ${size}px "${family}"`;c.textBaseline='alphabetic';c.textAlign='center'}
function line(c,x1,y1,x2,y2,color,width=1){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.stroke()}
function role(e,name){
 const id=e.s.direction?.roles?.[name];if(typeof id==='string')return e.p.words.find(w=>w.id===id);
 const index=({rise:{lead:0,subject:1,verb:2,above:3,object:4},terrain:{summit:3,ground:4},submerge:{verb:0,below:1}})[e.s.style]?.[name];
 return index===undefined?undefined:e.p.words.find(w=>w.id===e.s.wordIds[index]);
}
function alpha(w,t,d=.11){return w?ease((t-w.start)/d):0}
function word(c,w,t,x,y,size,{color='#e8e1ce',family='Bebas Neue',motion='lift',scale=1,opacity=1,tracking=0,rotate=0,curve=0,fragment=0}={}){
  const a=alpha(w,t);if(a<=0)return;
  c.save();c.globalAlpha*=a*opacity;c.translate(x,y+(motion==='lift'?24*(1-a):0));c.rotate(rotate);c.scale(scale,scale);setFont(c,size,family);c.fillStyle=color;
  const text=w.text.replace(/[.,]$/,'').toUpperCase();
  if(tracking||curve||fragment){let ws=[...text].map(v=>c.measureText(v).width),total=ws.reduce((a,b)=>a+b,0)+tracking*(ws.length-1),x=-total/2;c.textAlign='center';[...text].forEach((v,i)=>{const cx=x+ws[i]/2,u=(cx+total/2)/total,f=smooth(fragment*1.55-rand(i+49)*.5);c.save();c.globalAlpha*=1-f;c.translate(cx-f*(60+rand(i+88)*130),-Math.sin(u*Math.PI)*curve+f*f*(35+rand(i+31)*140));c.rotate(-Math.cos(u*Math.PI)*Math.PI*curve/total+f*(rand(i+39)-.5)*.4);c.fillText(v,0,0);c.restore();x+=ws[i]+tracking})}else c.fillText(text,0,0);
  c.restore();
}
function beat(p,t){return Math.min(1,(p.beats||[]).reduce((s,b)=>{const bt=typeof b==='number'?b:b.time;const d=t-bt;return s+(d>=0&&d<.35?Math.exp(-d*17)*(typeof b==='object'?(b.strength||1):1):0)},0))}
function label(c,e,light=false){const text=e.s.direction?.label??e.p.title??'',marker=e.s.direction?.marker||'';if(!text&&!marker)return;c.save();c.globalAlpha=.66;c.fillStyle=light?e.ink:e.paper;setFont(c,23,'Bebas Neue');c.textAlign='left';c.fillText(text.toUpperCase(),104,89);if(text)line(c,104,111,178,111,light?e.ink:e.paper,1);c.textAlign='right';c.globalAlpha=.32;c.fillText(marker,1816,89);c.restore()}
function vignette(c,strength=.5){const g=c.createRadialGradient(960,500,300,960,500,1150);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,`rgba(0,0,0,${strength})`);c.fillStyle=g;c.fillRect(0,0,1920,1080)}
function grain(c,t,light=false){c.save();c.globalAlpha=light?.025:.045;c.fillStyle=light?'#061a20':'#fff';for(let i=0;i<950;i++){let x=rand(i+81)*1920,y=rand(i+381)*1080;c.fillRect(x,y,rand(i+32)*2+.3,rand(i+68)*2+.3)}c.restore()}
function contourOcean(c,e){
 c.fillStyle=e.ink;c.fillRect(0,0,1920,1080);
 const g=c.createRadialGradient(960,760,0,960,620,950);g.addColorStop(0,e.s.direction?.gritty?'#1a252c':'#17434a');g.addColorStop(1,e.ink);c.fillStyle=g;c.fillRect(0,0,1920,1080);
 const rise=role(e,'verb');const surge=rise?ease((e.t-rise.start)/.85):0;
 for(let j=0;j<43;j++){
  const f=j/42,y=430+f*f*790-surge*70,amp=12+f*48;
  c.beginPath();for(let x=-100;x<=2020;x+=18){const yy=y+Math.sin(x*.0045+e.t*.45+j*.12)*amp+Math.sin(x*.009-e.t*.35+j*.09)*amp*.32;x===-100?c.moveTo(x,yy):c.lineTo(x,yy)}
  c.strokeStyle=`rgba(120,182,184,${.04+f*.24})`;c.lineWidth=.7+f*1.3;c.stroke();
 }
 c.save();c.globalAlpha=.18;for(let j=0;j<14;j++){c.beginPath();for(let k=0;k<60;k++){const z=k/59;const x=960+(j-6.5)*(52+z*z*175)+Math.sin(z*5+e.t*.22+j)*17,y=435+z*715; k?c.lineTo(x,y):c.moveTo(x,y)}c.strokeStyle='#82b8b7';c.lineWidth=.6;c.stroke()}c.restore();vignette(c,.58);grain(c,e.t);label(c,e);
}
function riseType(c,e){
 const the=role(e,'lead'),water=role(e,'subject'),rose=role(e,'verb'),above=role(e,'above'),them=role(e,'object');
 const enter=water?ease((e.t-water.start+.30)/.30):0,lift=rose?ease((e.t-rose.start)/.64):0;
 word(c,the,e.t,960,mix(570,171,enter),mix(200,78,enter),{family:'Cormorant Garamond',color:e.paper});
 // The subject rises on the verb, leaving the object below it. Space carries meaning.
 const waterY=800-lift*345;
 word(c,water,e.t,900,waterY,330,{color:e.paper,tracking:5});
 if(lift>0){c.save();c.globalAlpha=.12*(1-lift*.6);setFont(c,330);c.strokeStyle=e.paper;c.lineWidth=1;for(let i=1;i<4;i++){c.globalAlpha=.04*(4-i);c.strokeText(water.text.toUpperCase(),900,waterY+i*58*lift)}c.restore()}
 word(c,rose,e.t,1540,715,218,{color:e.accent,motion:'none',rotate:-Math.PI/2});
 word(c,above,e.t,900,688,139,{family:'Cormorant Garamond',color:e.paper,motion:'none'});
 word(c,them,e.t,900,920,157,{family:'Cormorant Garamond',color:e.paper,motion:'none'});
 if(lift>0){const y=mix(895,368,lift);line(c,1640,900,1640,y,`${e.accent}80`,2);line(c,1640,y,1628,y+18,e.accent,2);line(c,1640,y,1652,y+18,e.accent,2);
  c.beginPath();for(let x=190;x<=1430;x+=12){const py=waterY+24+Math.sin(x*.008-e.t*1.1)*10;x===190?c.moveTo(x,py):c.lineTo(x,py)}c.strokeStyle=`${e.accent}88`;c.lineWidth=1.5;c.stroke();
 }
}
function mountainY(x,k,t){let xx=(x-960)/700;return 850-Math.exp(-xx*xx*1.4)*(480-k*4)+Math.sin(x*.009+k*.08)*15+Math.sin(x*.024+k*.11)*4+Math.sin(t*.45+k*.14)*7+k*13}
function terrainBg(c,e){
 c.fillStyle=e.paper;c.fillRect(0,0,1920,1080);
 const formation=ease((e.t-e.s.start)/1.1);
 for(let k=0;k<29;k++){
  c.beginPath();for(let x=40;x<=1880;x+=10){const y=mix(970,mountainY(x,k,e.t),formation);x===40?c.moveTo(x,y):c.lineTo(x,y)}c.strokeStyle=e.s.direction?.dark?(k%5===0?'rgba(152,170,176,.40)':'rgba(152,170,176,.21)'):(k%5===0?'rgba(18,57,61,.40)':'rgba(18,57,61,.21)');c.lineWidth=k%5===0?1.5:.8;c.stroke();
 }
 const y=mountainY(960,0,e.t);c.save();c.globalAlpha=.42;line(c,960,190,960,y-36,e.accent,1);c.beginPath();c.arc(960,y-20,5,0,TAU);c.fillStyle=e.accent;c.fill();c.restore();grain(c,e.t,true);label(c,e,true);
}
function terrainType(c,e){
 const ids=Array.isArray(e.s.direction?.roles?.lead)?e.s.direction.roles.lead:e.s.wordIds.slice(0,3);let words=ids.map(id=>e.p.words.find(w=>w.id===id));
 const summit=role(e,'summit'),arrive=summit?ease((e.t-summit.start+.18)/.32):0;
 words.forEach((w,i)=>word(c,w,e.t,960+(i-1)*mix(365,228,arrive),mix(465,229,arrive),mix(122,68,arrive),{family:'Cormorant Garamond',color:e.ink}));
 const top=role(e,'summit'),ground=role(e,'ground');
 if(top&&e.t>=top.start){
  const a=alpha(top,e.t,.17),text=top.text.toUpperCase(),size=244;c.save();setFont(c,size);c.fillStyle=e.ink;c.globalAlpha=a;
  const widths=[...text].map(ch=>c.measureText(ch).width),width=widths.reduce((a,b)=>a+b,0)+12*(text.length-1);let x=960-width/2;
  [...text].forEach((ch,i)=>{const frac=i/(text.length-1),lift=Math.sin(frac*Math.PI)*105*ease((e.t-top.start)/.62);c.save();c.translate(x+widths[i]/2,599-lift+(1-a)*75);c.fillText(ch,0,0);c.restore();x+=widths[i]+12});c.restore();
 }
 word(c,ground,e.t,960,876,318,{color:e.ink,tracking:9,scale:1+.005*e.beat});
 if(ground&&e.t>=ground.start){const a=ease((e.t-ground.start)/.28);line(c,960-600*a,910,960+600*a,910,e.accent,4);c.save();c.globalAlpha=.38;for(let i=0;i<21;i++)line(c,360+i*60,924,360+i*60,931+(i%5===0?12:0),e.ink,1);c.restore()}
}
function cover(c,img,x,y,w,h,zoom=1,dy=0){if(!img)return;const ratio=Math.max(w/img.width,h/img.height)*zoom,dw=img.width*ratio,dh=img.height*ratio;c.drawImage(img,x+(w-dw)/2,y+(h-dh)/2+dy,dw,dh)}
function oceanPhoto(c,e){
 c.fillStyle=e.ink;c.fillRect(0,0,1920,1080);const img=e.assets[e.s.direction?.photo||e.s.assetIds?.[0]];
 if(!img){contourOcean(c,e);return}
 if(img){
  const elapsed=e.t-e.s.start,zoom=1.09+elapsed*.018;
  // Sky/ridge movement is a slow camera drift; the foreground has depth-dependent flow.
  cover(c,img,0,0,1920,1080,zoom,elapsed*2);
  const ratio=Math.max(1920/img.width,1080/img.height)*zoom,dw=img.width*ratio,dh=img.height*ratio,x0=(1920-dw)/2,y0=(1080-dh)/2+elapsed*2;
  for(let y=493;y<1080;y+=5){const depth=(y-493)/587,offset=(Math.sin(y*.011-e.t*1.75)*11+Math.sin(y*.037+e.t*1.1)*4)*depth;const sy=(y-y0)/ratio,sh=5/ratio;c.drawImage(img,0,sy,img.width,sh,x0+offset,y,dw,5.4)}
 }
 const tint=c.createLinearGradient(0,0,0,1080);tint.addColorStop(0,'rgba(2,13,19,.45)');tint.addColorStop(.55,'rgba(2,13,19,.02)');tint.addColorStop(1,'rgba(2,13,19,.18)');c.fillStyle=tint;c.fillRect(0,0,1920,1080);
 // Rain is restrained, world-aligned, repeatable and never covers the frame with a flash.
 c.save();c.strokeStyle='rgba(190,213,212,.09)';c.lineWidth=1;for(let i=0;i<55;i++){const x=rand(i+e.seed)*2080-80,y=(rand(i+810)*1200+e.t*(90+rand(i)*140))%1200-100;line(c,x,y,x-6,y+30+rand(i)*16,c.strokeStyle,1)}c.restore();vignette(c,.26);label(c,e);
}
function foregroundWave(c,e,sink=0){
 const img=e.assets[e.s.direction?.wave||'wave'];
 if(!img){
  // Graphic scenes use a drawn surface with the same physical occlusion contract
  // as the photographic matte. Keep both lyrics clear until the sung phrase ends.
  const surface=mix(760,150,sink);
  const waveY=x=>surface+Math.sin(x*.004-e.t*1.05)*20+Math.sin(x*.011+e.t*.7)*7;
  c.save();c.beginPath();c.moveTo(0,1080);for(let x=0;x<=1920;x+=12)c.lineTo(x,waveY(x));c.lineTo(1920,1080);c.closePath();
  const g=c.createLinearGradient(0,surface,0,1080);g.addColorStop(0,'#123b43');g.addColorStop(1,e.ink);c.fillStyle=g;c.fill();
  for(let k=0;k<18;k++){c.beginPath();for(let x=0;x<=1920;x+=12){const y=waveY(x)+k*k*2.4;x?c.lineTo(x,y):c.moveTo(x,y)}c.strokeStyle=k===0?e.accent:`rgba(131,193,191,${.2-k*.009})`;c.lineWidth=k===0?2:1;c.stroke()}
  c.restore();return;
 }
 const roll=Math.sin(e.t*1.35)*13,forward=smooth((e.t-(e.s.direction?.submergeAt??8.72))/.95);
 const y=mix(480,-210,forward)+roll;
 c.save();c.translate(960,0);c.rotate(Math.sin(e.t*.5)*.007);c.translate(-960,0);
 c.drawImage(img,-95-Math.sin(e.t*.85)*22,y,2110,Math.max(1187,1140-y));c.restore();
}
function submergeType(c,e){
 const verb=role(e,'verb'),below=role(e,'below'),sink=smooth((e.t-(e.s.direction?.submergeAt??e.s.end-1.1))/.95);
 word(c,verb,e.t,960,355+sink*510,199,{color:e.paper,tracking:2,opacity:1-sink*.12});
 word(c,below,e.t,960,663+sink*480,340,{color:e.paper,tracking:13,motion:'none'});
}
function submergeForeground(c,e){
 const sink=smooth((e.t-(e.s.direction?.submergeAt??e.s.end-1.1))/.95);
 // A real alpha-matted wave passes in front of the letters. Their contours survive
 // below its transparent foam and vanish beneath opaque moving water.
 foregroundWave(c,e,sink);
 if(sink>.6){c.save();c.globalAlpha=(sink-.6)*.8;const g=c.createLinearGradient(0,0,0,1080);g.addColorStop(0,'rgba(3,22,29,0)');g.addColorStop(1,'rgba(3,22,29,.8)');c.fillStyle=g;c.fillRect(0,0,1920,1080);c.restore()}
}
function genericBg(c,e){
 const photo=e.assets[e.s.direction?.photo||e.s.assetIds?.find(id=>e.assets[id])];
 if(photo){c.fillStyle=e.ink;c.fillRect(0,0,1920,1080);cover(c,photo,0,0,1920,1080,1.05+(e.t-e.s.start)*.006);c.fillStyle='rgba(0,9,14,.50)';c.fillRect(0,0,1920,1080);vignette(c,.3);grain(c,e.t);label(c,e);return}
 const motif=e.s.direction?.motif||'waves';
 if(motif==='waves'){contourOcean(c,e);return}
 if(motif==='contours'){
  c.fillStyle=e.ink;c.fillRect(0,0,1920,1080);
  for(let k=0;k<34;k++){c.beginPath();for(let x=-20;x<=1940;x+=16){const y=mountainY(x,k,e.t);x<0?c.moveTo(x,y):c.lineTo(x,y)}c.strokeStyle=`rgba(142,191,190,${k%5===0?.21:.10})`;c.lineWidth=1;c.stroke()}
 }else{
  c.fillStyle=e.ink;c.fillRect(0,0,1920,1080);
  if(motif==='stars')for(let i=0;i<210;i++){c.globalAlpha=.12+.45*rand(i+43);const x=(rand(i+e.seed)*2020+(e.t-e.s.start)*3)%2020-50,y=rand(i+738)*1080;c.fillStyle=e.paper;c.beginPath();c.arc(x,y,.5+rand(i+44)*2,0,TAU);c.fill()}
  if(motif==='rays')for(let i=0;i<42;i++){const theta=i*TAU/42+e.t*.008;c.globalAlpha=.10;line(c,960+Math.cos(theta)*180,540+Math.sin(theta)*180,960+Math.cos(theta)*1400,540+Math.sin(theta)*1400,e.accent,1+i%4)}
  if(motif==='grid'){c.globalAlpha=.16;for(let x=0;x<1920;x+=96)line(c,x,0,x,1080,e.paper,.7);for(let y=0;y<1080;y+=96)line(c,0,y,1920,y,e.paper,.7)}
  c.globalAlpha=1;
 }
 vignette(c,.5);grain(c,e.t);label(c,e);
}
function genericType(c,e){const ws=e.p.words.filter(w=>e.s.wordIds.includes(w.id));if(e.s.style==='orbit'){
 const radius=e.s.direction?.radius||310;
 ws.forEach((w,i)=>{const theta=-Math.PI/2+i*TAU/ws.length+(e.t-e.s.start)*.13;word(c,w,e.t,960+Math.cos(theta)*radius,570+Math.sin(theta)*radius,Math.min(115,640/ws.length),{color:i%3===0?e.accent:e.paper,rotate:theta+Math.PI/2})});
 }else if(e.s.style==='impact')ws.forEach((w,i)=>{const size=Math.min(220,650/ws.length),baseline=540+(i-(ws.length-1)/2)*size*1.15+size*.35;word(c,w,e.t,960,baseline,size,{color:i%2?e.accent:e.paper,scale:1+Math.exp(-Math.max(0,e.t-w.start)*12)*.1})});
 else{const revealed=ws.filter(w=>e.t>=w.start);const text=revealed.map(w=>w.text).join(' '),size=Math.min(120,1600/Math.max(1,text.length)*1.8);c.save();setFont(c,size,'Cormorant Garamond');c.fillStyle=e.paper;c.fillText(text,960,565);c.restore()}}
registerStyle('rise',{background:contourOcean,typography:riseType});
registerStyle('terrain',{background:terrainBg,typography:terrainType});
registerStyle('submerge',{background:oceanPhoto,typography:submergeType,foreground:submergeForeground});
for(const id of ['orbit','impact','verse'])registerStyle(id,{background:genericBg,typography:genericType});
installStoryStyles(registerStyle,{word,setFont,label,vignette,grain,oceanPhoto});
function portalGeometry(c,e){
 const ground=role(e,'ground');if(!ground)return null;
 const text=ground.text.replace(/[.,]$/,'').toUpperCase(),i=text.indexOf('O');if(i<0)return null;
 setFont(c,318);const widths=[...text].map(ch=>c.measureText(ch).width),total=widths.reduce((a,b)=>a+b,0)+9*(text.length-1);
 const x=960-total/2+widths.slice(0,i).reduce((a,b)=>a+b,0)+9*i+widths[i]/2;
 const scale=e.s.direction?.scale||1;
 return {x:960+(x-960)*scale,y:540+(764-540)*scale,rx:29*scale,ry:80*scale};
}
export function drawFrame(ctx,project,assets,t,{layer='all'}={}){
 const frame=Math.round(t*project.fps);
 const s=project.sections.find((s,i)=>frame>=Math.round(s.start*project.fps)&&frame<(i+1<project.sections.length?Math.round(project.sections[i+1].start*project.fps):Math.ceil(project.duration*project.fps)))||project.sections.at(-1);if(!s)return;
 const style=registry.get(s.style);if(!style)throw Error(`Unknown visual style: ${s.style}`);
 const palette={ink:'#061a20',paper:'#e8e1ce',accent:'#e77951',...project.palette,...s.direction?.palette};
 const e={p:project,s,assets,t,seed:s.seed||1,...palette,accent:s.direction?.accent||palette.accent,beat:beat(project,t)};
 const sx=ctx.canvas.width/1920,sy=ctx.canvas.height/1080;
 ctx.save();ctx.setTransform(sx,0,0,sy,0,0);ctx.clearRect(0,0,1920,1080);
 const portal=s.style==='terrain'&&s.direction?.portalAt!==undefined?portalGeometry(ctx,e):null;
 const travel=portal?smooth((t-s.direction.portalAt)/(s.end-s.direction.portalAt)):0;
 if(portal&&travel>0){const zoom=1+40/(s.direction?.scale||1)*Math.pow(travel,2.4);ctx.translate(960,540);ctx.scale(zoom,zoom);ctx.translate(-mix(960,portal.x,travel),-mix(540,portal.y,travel))}
 if(layer!=='type')style.background(ctx,e);
 if(layer!=='background'){
  ctx.save();const scale=s.direction?.scale||1;ctx.translate(960,540);ctx.scale(scale,scale);ctx.translate(-960,-540);style.typography(ctx,e);ctx.restore();
 }
 if(layer==='all')style.foreground?.(ctx,e);
 if(layer==='all'&&s.style==='rise'){
  const wipe=smooth((t-(s.end-.23))/.23);
  if(wipe>0){ctx.save();ctx.beginPath();ctx.moveTo(0,1080);for(let x=0;x<=1920;x+=16)ctx.lineTo(x,1080-wipe*1200+Math.sin(x*.003+t*2)*60*(1-wipe));ctx.lineTo(1920,1080);ctx.closePath();ctx.fillStyle=s.direction?.wipeColor||palette.paper;ctx.fill();ctx.restore()}
 }
 if(layer==='all'&&portal&&t>=s.direction.portalAt){
  const next=project.sections[project.sections.indexOf(s)+1],ne={...e,s:next||s};
  // Aperture is registered to the actual O counter; the camera goes through the word.
  ctx.save();ctx.beginPath();ctx.roundRect(portal.x-portal.rx,portal.y-portal.ry,portal.rx*2,portal.ry*2,24*portal.rx/29);ctx.clip();ctx.setTransform(sx,0,0,sy,0,0);oceanPhoto(ctx,ne);foregroundWave(ctx,ne);ctx.restore();
 }
 ctx.restore();
}
