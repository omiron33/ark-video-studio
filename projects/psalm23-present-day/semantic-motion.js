/* Ten authored word/world mechanisms. Build-time geometry only; all motion belongs
   to the host's paused GSAP timeline. Canonical wrapper opacity remains host-owned. */
const P23_SEMANTIC_FAMILIES = ["guided-thread","walking-ground","following-mercy","cup-overflow","table-setting","affliction-perimeter","anointing-descent","days-orbit","life-continuum","house-doorway","growing-grass","withdrawing-shadow","unbroken-declaration"];
const P23_SVG_NS='http://www.w3.org/2000/svg';
function p23Word(ctx,w){return document.getElementById(w.id);}
function p23Named(ctx,term){return ctx.p.words.find(w=>w.text.toLowerCase().replace(/[^a-z]/g,'')===term);}
function p23Ink(ctx,w){return [...p23Word(ctx,w).querySelectorAll('.letter')];}
function p23Geometry(ctx){
 const old=ctx.root.querySelector('.p23-semantic-geometry');if(old)return old;
 for(const el of ctx.root.querySelectorAll('.contour,.accent-line'))el.style.stroke='transparent';
 const svg=document.createElementNS(P23_SVG_NS,'svg');svg.setAttribute('viewBox','0 0 1920 1080');svg.setAttribute('class','p23-semantic-geometry');svg.setAttribute('aria-hidden','true');svg.setAttribute('data-layout-ignore','');
 Object.assign(svg.style,{position:'absolute',inset:'0',width:'1920px',height:'1080px',overflow:'visible',pointerEvents:'none',zIndex:'0'});
 ctx.root.querySelector('.scene-inner').insertBefore(svg,ctx.root.querySelector('.lens'));return svg;
}
function p23Shape(ctx,tag,attrs,parent){
 const el=document.createElementNS(P23_SVG_NS,tag);
 for(const [key,val]of Object.entries({fill:'none',stroke:'#e7c896','stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round',...attrs}))el.setAttribute(key,String(val));
 (parent||p23Geometry(ctx)).append(el);return el;
}
function p23Path(ctx,d,attrs={}){return p23Shape(ctx,'path',{d,...attrs});}
function p23Draw(ctx,el,time,duration=1.2,opacity=.7){
 const len=el.getTotalLength();el.style.strokeDasharray=String(len);el.style.strokeDashoffset=String(len);el.style.opacity='0';
 ctx.tl.fromTo(el,{strokeDashoffset:len,opacity:0},{strokeDashoffset:0,opacity,duration,ease:'sine.inOut',immediateRender:false},time);
}
function p23Group(ctx,name){
 const group=document.createElement('div');group.className='p23-semantic-group '+name;group.dataset.semanticRole=name;
 Object.assign(group.style,{position:'absolute',inset:'0',transformStyle:'preserve-3d',pointerEvents:'none'});ctx.root.querySelector('.word-world').append(group);return group;
}
function p23Place(ctx,w,x,y,extras={}){
 ctx.tl.set(p23Word(ctx,w),{x:x-w.x,y:y-w.y,rotation:0,rotationX:0,rotationY:0,scaleX:1,scaleY:1,...extras},ctx.p.showStart);
}
function p23Center(ctx,w,x,y,extras={}){p23Place(ctx,w,x-w.width/2,y-w.size*.64,extras);}
function p23Travel(ctx,w,path,u0,u1,start,duration,{rotation=0,scale=1,steps=28}={}){
 // Sample the actual SVG curve at build time. No onUpdate callbacks or hidden clocks.
 const len=path.getTotalLength(),el=p23Word(ctx,w);let previous;
 for(let i=0;i<=steps;i++){
  const v=i/steps,q=path.getPointAtLength(len*(u0+(u1-u0)*v));
  const state={x:q.x-w.x-w.width/2,y:q.y-w.y-w.size*.64,rotation:typeof rotation==='function'?rotation(v):rotation,scaleX:scale,scaleY:scale};
  if(i===0)ctx.tl.set(el,state,start);
  else ctx.tl.fromTo(el,previous,{...state,duration:duration/steps,ease:'none',immediateRender:false},start+(i-1)*duration/steps);
  previous=state;
 }
}
function p23Orbit(ctx,w,cx,cy,rx,ry,a0,a1,start,duration){
 const el=p23Word(ctx,w),steps=48;let previous;
 for(let i=0;i<=steps;i++){
  const a=a0+(a1-a0)*i/steps,s={x:cx+Math.cos(a)*rx-w.x-w.width/2,y:cy+Math.sin(a)*ry-w.y-w.size*.64,rotation:0};
  if(!i)ctx.tl.set(el,s,start);else ctx.tl.fromTo(el,previous,{...s,duration:duration/steps,ease:'none',immediateRender:false},start+(i-1)*duration/steps);previous=s;
 }
}
function p23Dot(ctx,x,y,r=4){return p23Shape(ctx,'circle',{cx:x,cy:y,r,fill:'#f4dfb8',stroke:'none',opacity:0});}
function p23HoldEnd(ctx,min=.8){return Math.max(ctx.p.start+.25,ctx.p.showEnd-min);}


function p23Glyphs(ctx,w){
 const ink=p23Word(ctx,w).querySelector('.ink');
 if(!ink.querySelector('.letter')){
  const text=ink.textContent;ink.textContent='';
  for(const glyph of Array.from(text)){const span=document.createElement('span');span.className='letter';span.textContent=glyph;ink.append(span);}
 }
 const glyphs=[...ink.querySelectorAll('.letter')];
 const widths=glyphs.map(g=>g.offsetWidth),sum=widths.reduce((a,b)=>a+b,0)||1;
 let x=0;return glyphs.map((el,i)=>{const width=w.width*widths[i]/sum;const item={el,x,width,local:el.offsetLeft+el.offsetWidth/2};x+=width;return item;});
}
const P23_SEMANTIC_REGISTRY = {
 'growing-grass':function(ctx){
  const {p,tl}=ctx;const green=p23Named(ctx,'green'),grass=p23Named(ctx,'grass');
  // The lyric is first a readable sentence. Already-read green glyphs become
  // the upright blades themselves; branches visibly grow out of their roots.
  p.words.slice(0,4).forEach(w=>p23Place(ctx,w,w.x,180));
  [green,grass].forEach(w=>p23Place(ctx,w,w.x,520));
  const begin=green.end+.45,rootY=725;
  for(const w of [green,grass]){
   const glyphs=p23Glyphs(ctx,w);
   glyphs.forEach((g,i)=>{
    const x=w.x+g.x+g.width*.52;const height=100+(i%3)*23;
    const stem=p23Path(ctx,`M ${x} 938 C ${x-24} 842,${x+12} 798,${x} ${rootY}`,{'stroke-width':3.8,opacity:0});
    const leaf=p23Path(ctx,`M ${x} 831 C ${x-78} 808,${x-86} 755,${x-22} 781 Q ${x-5} 803,${x} 831 M ${x-4} 882 C ${x+71} 859,${x+86} 811,${x+25} 834 Q ${x+5} 856,${x-4} 882`,{fill:'#d9bd7f','fill-opacity':.17,'stroke-width':3.2,opacity:0});
    p23Draw(ctx,stem,begin+i*.025,.62,.88);p23Draw(ctx,leaf,begin+.17+i*.025,.56,.8);
    if(w===green){
     // Growth stays rooted at the same baseline and retains letter order.
     tl.to(g.el,{scaleY:1.48+(i%3)*.16,rotation:(i%2?1:-1)*3,transformOrigin:'50% 100%',duration:.61,ease:'power2.out'},begin+i*.025);
     tl.to(g.el,{rotation:(i%2?-1:1)*2,duration:.45,ease:'sine.inOut'},begin+.64+i*.015);
    }else{
     // The long sung grass remains intact through its end+0.4 reading guard.
     tl.to(g.el,{scaleY:1.24+(i%2)*.12,transformOrigin:'50% 100%',duration:.18,ease:'sine.out'},w.end+.4+i*.008);
    }
   });
  }
 },
 'withdrawing-shadow':function(ctx){
  const {p,tl}=ctx;
  // A fixed patch of porch light is a projection surface, not a moving wipe.
  // The readable source words stay still while their cast silhouettes cross it.
  const defs=p23Shape(ctx,'defs',{}),gradient=p23Shape(ctx,'linearGradient',{id:p.id+'-porch-light',x1:'85%',y1:'0%',x2:'25%',y2:'100%'},defs);
  for(const [offset,opacity]of [['0%',.05],['32%',.28],['74%',.24],['100%',.04]])p23Shape(ctx,'stop',{offset,'stop-color':'#efcc84','stop-opacity':opacity,stroke:'none'},gradient);
  const light=p23Path(ctx,'M 933 230 L 1158 273 L 848 950 L 170 950 Z',{fill:'url(#'+p.id+'-porch-light)',stroke:'none',opacity:0});
  light.style.filter='blur(28px)';
  tl.fromTo(light,{opacity:0},{opacity:1,duration:.42,ease:'sine.out',immediateRender:false},p.start);
  const projection=p23Group(ctx,'projected-word-shadows');projection.style.zIndex='0';
  projection.style.clipPath='polygon(933px 230px,1158px 273px,848px 950px,170px 950px)';
  for(const [i,w]of p.words.entries()){
   const source=p23Word(ctx,w);source.style.zIndex='1';
   const silhouette=document.createElement('div');silhouette.className='p23-cast-shadow';silhouette.setAttribute('aria-hidden','true');silhouette.setAttribute('data-layout-ignore','');
   silhouette.textContent=w.text;
   Object.assign(silhouette.style,{position:'absolute',left:w.x+'px',top:(w.y+210)+'px',fontFamily:w.font==='italic'?'OrdinaryItalic,serif':'Ordinary,serif',fontStyle:w.font==='italic'?'italic':'normal',fontSize:w.size+'px',lineHeight:'1.12',color:'#101710',opacity:'0',whiteSpace:'nowrap',textShadow:'0 1px 4px rgba(10,14,10,.55)',transformOrigin:'0 0'});
   projection.append(silhouette);
   const begin=Math.max(w.end+.42,p.start+.43);
   tl.fromTo(silhouette,{opacity:0,x:-235,y:-52,scaleY:.54,skewX:-34},{opacity:.82,x:140,y:100,scaleY:.8,skewX:-12,duration:Math.min(1.05,p.showEnd-begin-.16),ease:'sine.inOut',immediateRender:false},begin);
  }
 },
 'unbroken-declaration':function(ctx){
  const {p,tl}=ctx;
  // After the complete line is read, the exact canonical glyphs assemble as
  // the voussoirs of one continuous arch. No visible drawn line carries it.
  p23Geometry(ctx);
  const arch=p23Path(ctx,'M 225 376 C 350 91,1190 91,1320 376',{stroke:'none'});
  const length=arch.getTotalLength(),gap=28,total=p.words.reduce((n,w)=>n+w.width,0)+gap*(p.words.length-1);
  const begin=p.words.at(-1).end+.45;let cursor=0;
  for(const w of p.words){
   for(const g of p23Glyphs(ctx,w)){
    // Rotated line-height rectangles overlap on the arch; decoded glyph contours
    // were inspected separately and remain clear. This applies only to this arch.
    g.el.setAttribute('data-layout-allow-overlap','');
    const u=(cursor+g.x+g.width/2)/total;
    const q=arch.getPointAtLength(length*u),a=arch.getPointAtLength(Math.max(0,length*u-4)),b=arch.getPointAtLength(Math.min(length,length*u+4));
    const angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
    const dx=q.x-(w.x+g.local),dy=q.y-(w.y+w.size*.64);
    tl.to(g.el,{x:dx,y:dy,rotation:angle,transformOrigin:'50% 64%',duration:1.02,ease:'sine.inOut'},begin+u*.12);
   }
   cursor+=w.width+gap;
  }
  // Two small footing stones mark the word-built span's load-bearing ends.
  const feet=p23Path(ctx,'M 151 428 L 269 428 L 285 443 L 140 443 Z M 1272 428 L 1390 428 L 1405 443 L 1256 443 Z',{fill:'#e7c896','fill-opacity':.35,'stroke-width':1.7,opacity:0});
  p23Draw(ctx,feet,begin+.68,.42,.7);
 },

 'guided-thread':function(ctx){
  const {p,tl}=ctx;const [he,has,guided,me]=p.words;
  // The guide itself is a movable bridge: two pivot stations lead into the
  // waiting destination. Words occupy this map, rather than a common row.
  p23Center(ctx,he,295,405);p23Center(ctx,has,460,405);
  p23Center(ctx,guided,510,590,{rotation:-5});p23Center(ctx,me,1065,605);
  const track=p23Path(ctx,'M 248 458 C 375 435,414 600,592 633 S 840 599,1165 643',{'stroke-width':2.8});
  const pivot=p23Shape(ctx,'circle',{cx:592,cy:633,r:17,opacity:0,'stroke-width':1.2});
  const destination=p23Path(ctx,'M 956 634 Q 1065 696,1175 634 M 979 652 Q 1065 714,1155 652',{'stroke-width':1.5});
  p23Draw(ctx,track,p.start,.9,.74);tl.fromTo(pivot,{opacity:0},{opacity:.7,duration:.35,immediateRender:false},guided.start);
  p23Draw(ctx,destination,me.start,.6,.84);
  const transfer=p23Path(ctx,'M 510 590 C 542 534,649 511,735 563',{stroke:'none'});
  const t=Math.min(guided.end+.04,p.showEnd-1.5);
  p23Travel(ctx,guided,transfer,0,1,t,.72,{rotation:v=>-5+9*Math.sin(v*Math.PI)});
  // A flexing guide changes with the word's load, then ends as a stable span.
  tl.to(track,{attr:{d:'M 248 458 C 375 435,475 587,663 624 S 882 651,1165 643'},duration:.72,ease:'sine.inOut'},t);
  tl.to(pivot,{attr:{cx:663,cy:624},duration:.72,ease:'sine.inOut'},t);
 },
 'walking-ground':function(ctx){
  const {p,tl}=ctx;const walk=p23Named(ctx,'walk');
  const ground=p23Path(ctx,'M 108 622 L 1080 622',{'stroke-width':2.6});p23Draw(ctx,ground,p.start,.55,.8);
  const sleepers=p23Shape(ctx,'g',{});for(let i=0;i<13;i++)p23Shape(ctx,'path',{d:`M ${120+i*78} 634 l 26 0`,opacity:.42,'stroke-width':2},sleepers);
  // Three early words form a low shelter, while the action clause actually
  // walks over a travelling ground. The glyph feet alternate on contact.
  p23Place(ctx,p.words[0],155,278);p23Place(ctx,p.words[1],423,302);p23Place(ctx,p.words[2],550,325);
  p23Place(ctx,p.words[3],158,454);p23Place(ctx,walk,613,454);
  const span=Math.min(1.06,p.showEnd-walk.start-.65),begin=walk.start+.07;
  tl.to(sleepers,{x:-144,duration:span,ease:'none'},begin);
  tl.to(p23Word(ctx,walk),{x:613-walk.x+115,duration:span,ease:'none'},begin);
  p23Ink(ctx,walk).forEach((letter,i)=>{
   const phase=i%2*.18;
   for(let step=0;step<2;step++){
    const t=begin+phase+step*.36;
    tl.fromTo(letter,{y:0,rotation:0},{y:-19,rotation:i%2?3:-3,duration:.16,ease:'sine.out',immediateRender:false},t);
    tl.to(letter,{y:0,rotation:0,duration:.18,ease:'sine.in'},t+.16);
    const mark=p23Path(ctx,`M ${625+i*63+step*48} 625 l 20 0`,{opacity:0,'stroke-width':3.8});
    tl.fromTo(mark,{opacity:0},{opacity:.8,duration:.05,immediateRender:false},t+.31);
    tl.to(mark,{opacity:.25,duration:.45,ease:'sine.out'},t+.36);
   }
  });
  // The walked word holds at its new location: motion has covered distance.
 },
 'following-mercy':function(ctx){
  const {p,tl}=ctx;const track=p23Path(ctx,'M 1000 270 C 1340 210,1700 245,1660 390 C 1660 510,1140 430,1100 720 C 1000 910,1430 920,1685 858',{'stroke-width':2.4});
  const lens=p23Geometry(ctx);const len=track.getTotalLength();
  // Large words occupy consecutive bends in a shared geography. Nothing
  // crosses the women and umbrella, which stay left of x~800 in photo10.
  const u=[0,.15,.38,.65,.89];
  p.words.forEach((w,i)=>{const q=track.getPointAtLength(len*u[i]);p23Center(ctx,w,q.x,q.y);});
  p23Draw(ctx,track,p.start,3.1,.76);
  // Mercy moves first; its followers traverse the same measured curve behind
  // it after each has had its own clear vocal reading interval.
  p.words.forEach((w,i)=>{
   const begin=Math.max(w.end+.2,p.words[1].end+.15)+(i>1?(i-1)*.10:0);
   const end=Math.min(begin+.95,p.showEnd-.9);
   if(end>begin)p23Travel(ctx,w,track,u[i],Math.min(.98,u[i]+.06),begin,end-begin);
  });
  for(let i=0;i<18;i++){
   const q=track.getPointAtLength(len*(.04+i*.052));const dot=p23Dot(ctx,q.x,q.y,2.2);
   tl.fromTo(dot,{opacity:0,scale:.25},{opacity:.5,scale:1,duration:.3,transformOrigin:`${q.x}px ${q.y}px`,immediateRender:false},p.start+.13*i);
  }
 },
 'cup-overflow':function(ctx){
  const {p,tl}=ctx,cup=p23Named(ctx,'cup'),wine=p23Named(ctx,'wine');
  // The right upper wall supplies a real, bounded vessel; no cup geometry
  // intrudes into the dinner guests below y~350.
  const vessel=p23Path(ctx,'M 1235 51 L 1262 225 Q 1276 296,1400 296 Q 1524 296,1538 225 L 1565 51 M 1244 79 Q 1400 113,1556 79 M 1556 105 C 1654 74,1662 226,1538 228 M 1280 315 Q 1412 339,1532 314',{'stroke-width':2.5});
  const level=p23Path(ctx,'M 1268 252 Q 1405 265,1533 251',{opacity:0,'stroke-width':3.5});
  const overflow=p23Path(ctx,'M 1254 94 C 1145 50,1020 38,894 140 S 730 375,652 364',{'stroke-width':2.2});
  p23Draw(ctx,vessel,p.start,.65,.85);p23Draw(ctx,overflow,wine.start,.9,.75);
  // Cup is legible inside its own bowl; wine begins inside the rising level,
  // then pours as a whole readable word along the vessel's overflow route.
  p23Place(ctx,cup,1330,96);p23Place(ctx,wine,1322,190,{scaleX:.86,scaleY:.86});
  tl.fromTo(level,{opacity:0,y:0},{opacity:.66,y:-113,duration:Math.max(.5,wine.start-cup.start),ease:'sine.inOut',immediateRender:false},cup.start);
  const pour=p23Path(ctx,`M ${1322+wine.width/2} ${190+wine.size*.64} C 1190 315,1190 135,1050 165 S 790 379,${wine.x+wine.width/2} ${wine.y+wine.size*.64}`,{stroke:'none'});
  const t=wine.start+.38,d=Math.min(.93,p.showEnd-t-.65);
  p23Travel(ctx,wine,pour,0,1,t,d,{scale:.96,rotation:v=>-7*Math.sin(v*Math.PI)});
  tl.to(p23Word(ctx,wine),{scaleX:1,scaleY:1,duration:.22,ease:'sine.out'},t+d);
  // The cup stays a distinct reading station; the remaining canonical words
  // retain their generous left wall arrangement throughout.
 },
 'table-setting':function(ctx){
  const {p,tl}=ctx;const surface=p23Path(ctx,'M 205 114 L 1545 114 L 1680 320 L 130 320 Z',{fill:'#dcc79e','fill-opacity':.025,'stroke-width':1.8});
  const seam=p23Path(ctx,'M 207 182 L 1587 182',{'stroke-width':1,opacity:.5});
  p23Draw(ctx,surface,p.start,.95,.8);p23Draw(ctx,seam,p.start+.35,1,.5);
  // Three lower words sit in actual place settings. Their shared table plane
  // folds about a hinge; one camera-facing reading sentence emerges together.
  const tabletop=p23Group(ctx,'tabletop');const groupWords=p.words.slice(4);
  const slots=[[287,198],[695,198],[1154,198]];
  groupWords.forEach((w,i)=>{tabletop.append(p23Word(ctx,w));p23Place(ctx,w,slots[i][0],slots[i][1]);
   const plate=p23Shape(ctx,'ellipse',{cx:slots[i][0]+w.width/2,cy:284,rx:w.width*.6+28,ry:34,opacity:0,'stroke-width':1.4});
   tl.fromTo(plate,{opacity:0,scaleX:.6},{opacity:.7,scaleX:1,duration:.46,transformOrigin:`${slots[i][0]+w.width/2}px 284px`,immediateRender:false},w.start);
  });
  tl.set(tabletop,{rotationX:24,transformOrigin:'890px 182px',z:-70},p.showStart);
  const t=p.words.at(-1).end+.4;
  tl.to(tabletop,{rotationX:0,z:0,duration:1.08,ease:'sine.inOut'},t);
  groupWords.forEach((w,i)=>tl.to(p23Word(ctx,w),{x:0,y:0,duration:1.08,ease:'sine.inOut'},t));
  tl.to(surface,{attr:{d:'M 205 114 L 1545 114 L 1545 305 L 205 305 Z'},duration:1.08,ease:'sine.inOut'},t);
  tl.to([surface,seam],{opacity:.18,duration:.7,ease:'sine.out'},t+1.08);
 },
 'affliction-perimeter':function(ctx){
  const {p,tl}=ctx;const those=p23Named(ctx,'those'),who=p23Named(ctx,'who'),afflict=p23Named(ctx,'afflict'),me=p23Named(ctx,'me');
  // The threat words occupy three sides of a protected center. Their arcs
  // retract only after the complete sung sentence has had a reading interval.
  p23Place(ctx,those,335,197);p23Place(ctx,who,650,174);p23Place(ctx,afflict,1170,197);p23Place(ctx,me,889,247);
  const guard=p23Path(ctx,'M 870 327 C 870 251,1085 251,1085 327 C 1085 403,870 403,870 327',{'stroke-width':2.6});
  const left=p23Path(ctx,'M 292 274 C 400 180,615 204,722 263',{'stroke-width':1.8});
  const right=p23Path(ctx,'M 1122 260 C 1212 196,1451 186,1554 282',{'stroke-width':1.8});
  p23Draw(ctx,left,those.start,.6,.67);p23Draw(ctx,right,afflict.start,.6,.67);p23Draw(ctx,guard,me.start,.55,.95);
  const release=me.end+.65;
  // The center word first descends into a clear corridor between the guests.
  // Threats can then uncoil above it without crossing any readable glyphs.
  const down=p23Path(ctx,'M 977 328 C 977 350,977 372,977 390',{stroke:'none'});
  p23Travel(ctx,me,down,0,1,release,.3);
  [[those,'M 451 277 C 424 270,392 260,356 254',0],[who,'M 748 255 C 708 249,646 249,600 254',11],[afflict,'M 1319 277 C 1170 270,1005 260,877.5 254',22]].forEach(([w,d,dx])=>{
   const guide=p23Path(ctx,d,{stroke:'none'});p23Travel(ctx,w,guide,0,1,release+.3,.7);
   tl.to(p23Word(ctx,w),{x:dx,y:0,duration:.15,ease:'sine.out'},release+1);
  });
  const across=p23Path(ctx,'M 977 390 C 1020 390,1095 390,1145.5 390',{stroke:'none'});
  const rise=p23Path(ctx,'M 1145.5 390 C 1145.5 346,1145.5 294,1145.5 254',{stroke:'none'});
  p23Travel(ctx,me,across,0,1,release+1,.38);p23Travel(ctx,me,rise,0,1,release+1.38,.4);
  tl.to(p23Word(ctx,me),{x:33,y:0,duration:.12,ease:'sine.out'},release+1.78);
  tl.to(guard,{y:62,duration:.3,ease:'sine.inOut'},release);
  tl.to(guard,{x:168.5,duration:.38,ease:'sine.inOut'},release+1);
  tl.to(guard,{y:-74,opacity:.4,duration:.4,ease:'sine.inOut'},release+1.38);
  tl.to([left,right],{opacity:0,duration:.8,ease:'sine.out'},release);
 },
 'anointing-descent':function(ctx){
  const {p,tl}=ctx;const head=p23Named(ctx,'head'),oil=p23Named(ctx,'oil');
  const crown=p23Path(ctx,`M ${head.x-10} ${head.y+head.size*.93} Q ${head.x+head.width*.5} ${head.y+head.size*1.22},${head.x+head.width+10} ${head.y+head.size*.93}`,{'stroke-width':2.3});
  p23Draw(ctx,crown,head.start,.65,.62);
  const drop=p23Path(ctx,'M 0 -24 C -3 -10,-17 1,-13 12 C -9 26,10 27,15 13 C 18 3,3 -11,0 -24 Z',{fill:'#e7c896','fill-opacity':.2,opacity:0,'stroke-width':1.6});
  // Oil is first read intact in the sentence. Only the already-read glyphs
  // gather into a droplet, touch the word head, then open back into oil.
  const begin=oil.end+.45,land=begin+.5,reform=land+.26;
  const letters=p23Ink(ctx,oil),oilCenter=oil.x+oil.width/2,headCenter=head.x+head.width/2;
  letters.forEach((el,i)=>{
   const local=el.offsetLeft+el.offsetWidth/2;
   tl.to(el,{x:oil.width/2-local,y:-48-i*3,scaleX:.42,scaleY:.78,rotation:(i-(letters.length-1)/2)*12,duration:.25,ease:'sine.inOut'},begin);
   tl.to(el,{x:headCenter-oil.x-local,y:head.y-oil.y-24,scaleX:.35,scaleY:.62,rotation:0,duration:.35,ease:'power2.in'},begin+.25);
   tl.to(el,{x:0,y:0,scaleX:1,scaleY:1,rotation:0,duration:.46,ease:'sine.inOut'},reform);
  });
  tl.fromTo(drop,{x:oilCenter,y:oil.y+20,opacity:0},{x:headCenter,y:head.y+22,opacity:.7,duration:.55,ease:'power2.in',immediateRender:false},begin+.05);
  tl.to(drop,{opacity:0,scaleX:3,scaleY:.2,transformOrigin:'0px 0px',duration:.27,ease:'sine.out'},land+.05);
  tl.to(p23Word(ctx,head),{scaleY:.94,y:6,duration:.14,ease:'sine.in'},land+.05);
  tl.to(p23Word(ctx,head),{scaleY:1,y:0,duration:.55,ease:'sine.out'},land+.19);
 },
 'days-orbit':function(ctx){
  const {p,tl}=ctx;const days=p23Named(ctx,'days'),life=p23Named(ctx,'life'),cx=1458,cy=609,rx=322,ry=318;
  p23Place(ctx,p.words[0],880,212);p23Place(ctx,p.words[1],1020,212);
  p23Center(ctx,days,cx,cy-ry);p23Place(ctx,p.words[3],1260,482);p23Place(ctx,p.words[4],1402,482);p23Center(ctx,life,cx,769);
  const orbit=p23Path(ctx,`M ${cx} ${cy-ry} A ${rx} ${ry} 0 1 1 ${cx-.01} ${cy-ry}`,{'stroke-width':1.7});
  p23Draw(ctx,orbit,days.start,2.2,.67);
  for(let i=0;i<12;i++){
   const a=-Math.PI/2+i*Math.PI/6;
   const mark=p23Path(ctx,`M ${cx+Math.cos(a)*(rx+9)} ${cy+Math.sin(a)*(ry+9)} L ${cx+Math.cos(a)*(rx+21)} ${cy+Math.sin(a)*(ry+21)}`,{opacity:0,'stroke-width':1.8});
   tl.fromTo(mark,{opacity:0},{opacity:.6,duration:.12,immediateRender:false},days.start+i*.16);
  }
  const start=life.start+.3,duration=Math.min(3.15,p.showEnd-start-.85);
  p23Orbit(ctx,days,cx,cy,rx,ry,-Math.PI/2,Math.PI*1.5,start,duration);
  // Life never orbits: it is the fixed center against which days have meaning.
  const anchor=p23Path(ctx,'M 1361 854 Q 1458 873,1555 854',{'stroke-width':2.4});p23Draw(ctx,anchor,life.start,.8,.8);
 },
 'life-continuum':function(ctx){
  const {p,tl}=ctx;const world=ctx.root.querySelector('.word-world');
  const bands=[p23Group(ctx,'continuum-upper'),p23Group(ctx,'continuum-middle'),p23Group(ctx,'continuum-life')];
  const rowSets=[p.words.slice(0,3),p.words.slice(3,5),p.words.slice(5)];
  const y=[244,466,676],starts=[899,1190,1340];
  rowSets.forEach((set,ri)=>{let x=starts[ri];for(const w of set){bands[ri].append(p23Word(ctx,w));p23Place(ctx,w,x,y[ri]);x+=w.width+25;}});
  const ribbon=p23Path(ctx,'M 836 226 L 1758 226 L 1727 435 L 1131 435 L 1159 651 L 1715 651 L 1749 894 L 1322 894',{'stroke-width':3.1});
  const edge=p23Path(ctx,'M 836 371 L 1609 371 L 1580 435 M 1131 594 L 1577 594 L 1591 651 M 1322 841 L 1740 841',{'stroke-width':1.2,opacity:.38});
  p23Draw(ctx,ribbon,p.start,3.1,.77);p23Draw(ctx,edge,p.start+.3,3.5,.48);
  const folds=[p23Path(ctx,'M 1131 435 L 1609 371 L 1580 435 Z',{fill:'#e7c896','fill-opacity':.08,opacity:0}),p23Path(ctx,'M 1577 594 L 1715 651 L 1591 651 Z',{fill:'#e7c896','fill-opacity':.08,opacity:0})];
  // Canonical words belong to three connected planes. The middle and life
  // panels unroll around their own hinges, then the full ribbon drifts onward.
  tl.set(bands[1],{rotationX:22,z:-60,transformOrigin:'1450px 435px'},p.showStart);
  tl.set(bands[2],{rotationX:-18,z:-50,transformOrigin:'1450px 651px'},p.showStart);
  tl.fromTo(folds,{opacity:0},{opacity:.65,duration:.8,immediateRender:false},p.start+.7);
  tl.to(bands[1],{rotationX:0,z:0,duration:1.25,ease:'sine.inOut'},p.words[3].start);
  tl.to(bands[2],{rotationX:0,z:0,duration:1.65,ease:'sine.inOut'},p.words[5].start);
  const t=p.words[5].end+.13,d=Math.min(1.0,p.showEnd-t-.7);
  if(d>.15){tl.to([...bands,ribbon,edge,...folds],{y:-48,duration:d,ease:'sine.inOut'},t);}
 },
 'house-doorway':function(ctx){
  const {p,tl}=ctx;const left=p23Group(ctx,'doorway-left-station'),right=p23Group(ctx,'doorway-right-station');
  const leftAperture=p23Group(ctx,'left-jamb-aperture');
  leftAperture.style.clipPath='polygon(0 0,655px 0,655px 1080px,0 1080px)';leftAperture.append(left);
  p.words.forEach((w,i)=>(i<5?left:right).append(p23Word(ctx,w)));
  // A pair of text-bearing wall/door stations pivots around the photographed
  // doorway's two jambs. The family's central doorway remains an open aperture.
  tl.set(left,{rotationY:19,z:-40,transformOrigin:'635px 340px'},p.showStart);
  tl.set(right,{rotationY:-19,z:-40,transformOrigin:'1255px 340px'},p.showStart);
  const jambs=p23Path(ctx,'M 655 144 L 655 852 M 1250 144 L 1250 852',{'stroke-width':2.3});
  const threshold=p23Path(ctx,'M 445 854 C 687 861,999 931,1353 849 S 1675 758,1793 774',{'stroke-width':2.6});
  p23Draw(ctx,jambs,p.start,.9,.62);
  const dwell=p23Named(ctx,'dwell'),house=p23Named(ctx,'house'),lord=p23Named(ctx,'lord');
  tl.to(left,{rotationY:0,z:0,duration:1.05,ease:'sine.inOut'},dwell.start);
  p23Draw(ctx,threshold,p.words[4].start,1.6,.76);
  tl.to(right,{rotationY:0,z:0,duration:1.07,ease:'sine.inOut'},house.start);
  // After every left-clause word has been read, the clause crosses behind the
  // photographed jamb. The fixed aperture clips it before the family area;
  // destination words on the right remain intact throughout this passage.
  const crossing=p.words[4].end+.55;
  tl.to(left,{x:560,duration:1.2,ease:'sine.inOut'},crossing);
  const sill=p23Path(ctx,'M 640 812 L 676 812 L 676 853',{'stroke-width':3.2});
  p23Draw(ctx,sill,crossing+.45,.5,.9);
  const connection=p23Path(ctx,'M 520 476 C 615 460,607 725,714 796 C 882 916,1230 916,1380 792 C 1511 684,1431 546,1660 503',{'stroke-width':1.2});
  p23Draw(ctx,connection,p.words[4].start,Math.min(1.9,p.showEnd-p.words[4].start-.45),.45);
  // The destination is a settled reading room, not text flying through faces.
  const room=p23Path(ctx,'M 1240 180 L 1798 180 L 1798 495 L 1240 495',{'stroke-width':1.1});
  p23Draw(ctx,room,lord.start,.58,.35);
 }
};
window.P23_SEMANTIC_FAMILIES=P23_SEMANTIC_FAMILIES;
window.P23_SEMANTIC_REGISTRY=P23_SEMANTIC_REGISTRY;
window.P23_SEMANTIC=function(p,ctx){const fn=P23_SEMANTIC_REGISTRY[p.family];if(!fn)return false;fn({p,...ctx});return true;};
window.P23_SEMANTIC.registry=P23_SEMANTIC_REGISTRY;
