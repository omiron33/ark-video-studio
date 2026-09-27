/** Bespoke Genesis 4 tableaux. All motion is a pure function of canonical cue
 * time. The large 77 and Matthew caption are an explicitly labelled visual
 * interpretation; the sung words always retain their literal source text. */
export const GENESIS_CATALOG = {
 'genesis-vengeance':'Seven becomes a monumental, fractured seventy-seven under the weight of Lamech’s boast.',
 'genesis-forgiveness':'The closed red structures release into open white rings beside the embodied Christ.',
 'genesis-lineage-cain':'Named generations ignite and extend a continuous, staggered ancestry.',
 'genesis-lineage-seed':'Adam and Eve’s joined roots bring forth a new luminous Seth branch.',
 'genesis-lineage-prayer':'The renewed branch travels from Seth to Enos and opens upward.',
 'genesis-lineage-resolution':'One family tree holds the dim Cain branch beside Seth and Enos’s luminous continuation.'
};
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a,b,p)=>a+(b-a)*p;
const smooth=v=>{v=clamp(v);return v*v*(3-2*v)};
const ease=v=>1-Math.pow(1-clamp(v),3);
const tau=Math.PI*2;
const clean=w=>String(w?.text||'').replace(/[.,:;]$/,'').toUpperCase();
const name=w=>clean(w).replace(/[’']/g,'');
const random=n=>{const z=Math.sin(n*127.1+311.7)*43758.5453;return z-Math.floor(z)};
const selector=e=>typeof e.s.direction?.choreography==='string'?e.s.direction.choreography:e.s.direction?.choreography?.id;
const config=e=>e.s.direction?.genesis||{};
const words=e=>(e.s.wordIds||[]).map(id=>e.p.words.find(w=>w.id===id)).filter(Boolean);
const measure=(c,h,text,size,family='Bebas Neue')=>{h.setFont(c,size,family);return c.measureText(text).width};
const stroke=(c,points,color,width=1)=>{if(points.length<2)return;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke()};
const pulse=(at,t,seconds=.75)=>{const age=t-at;return age<0?0:Math.sin(clamp(age/seconds)*Math.PI)*Math.exp(-age*.9)};
function cue(e,key,id,fallback){return e.p.words.find(w=>w.id===(config(e).cueIds?.[key]||id))||words(e).find(fallback)||null}

/** Auditable state for the two connected moral tableaux. Numerals are scenic
 * forms, never substituted for the words “seventy times seven.” */
export function genesisState(e){
 const id=selector(e);if(!GENESIS_CATALOG[id])return null;
 const seven=cue(e,'seven','g4-l084-w04',w=>name(w)==='SEVEN');
 const seventy=cue(e,'seventy','g4-l086-w00',w=>name(w)==='SEVENTY');
 const finalSeven=cue(e,'finalSeven','g4-l086-w02',w=>name(w)==='SEVEN'&&w!==seven);
 const lamech=cue(e,'lamech','g4-l085-w01',w=>name(w)==='LAMECH');
 const at=w=>w?.start??Infinity,elapsed=e.t-e.s.start;
 return{id,elapsed,seven,seventy,finalSeven,lamech,
  sevenReveal:ease((e.t-at(seven))/.34),multiplication:smooth((e.t-at(seventy))/.7),
  rupture:ease((e.t-at(finalSeven))/.45),pressure:smooth((e.t-at(lamech))/.9),
  impact:pulse(at(seven),e.t,.52)+pulse(at(seventy),e.t,.52)+pulse(at(finalSeven),e.t,.62),
  release:smooth(elapsed/3.5),progress:smooth(elapsed/Math.max(.1,e.s.end-e.s.start))};
}

function lyricGroups(e){
 const all=words(e),byId=new Map(all.map(w=>[w.id,w])),used=new Set(),groups=[];
 if(config(e).lyricGroups)for(const ids of config(e).lyricGroups){const g=ids.map(id=>byId.get(id)).filter(w=>w&&!used.has(w.id));if(g.length){g.forEach(w=>used.add(w.id));groups.push(g)}}
 for(const w of all){if(used.has(w.id))continue;let g=groups.at(-1);if(!g||g[0].phraseId!==w.phraseId||!w.phraseId&&g.length>=6){g=[];groups.push(g)}g.push(w);used.add(w.id)}
 return groups;
}
function splitRows(group){
 const chars=group.reduce((n,w)=>n+clean(w).length+1,0);if(chars<=33&&group.length<=6)return[group];
 let cut=1,best=Infinity;for(let i=1;i<group.length;i++){const left=group.slice(0,i).reduce((n,w)=>n+clean(w).length+1,0),cost=Math.abs(chars-2*left);if(cost<best){best=cost;cut=i}}
 return[group.slice(0,cut),group.slice(cut)];
}
function lyricPoses(c,e,h,id){
 const groups=lyricGroups(e),box=id==='genesis-forgiveness'?{x:160,y:770,w:1530,h:235}:{x:150,y:110,w:1620,h:270},out=[];
 let active=0;groups.forEach((g,i)=>{if(e.t>=g[0].start)active=i});
 for(const [gi,g]of groups.entries()){
  const rows=splitRows(g);for(const [ri,row]of rows.entries()){
   const family=id==='genesis-vengeance'&&gi===groups.length-1?'Archivo Black':'Bebas Neue';
   const widths=row.map(w=>measure(c,h,clean(w),100,family)),base=widths.reduce((a,b)=>a+b,0)+(row.length-1)*22;
   const size=Math.min(rows.length>1?146:190,box.w/Math.max(1,base)*100),span=base*size/100;
   let x=box.x+(box.w-span)/2;
   for(const [i,w]of row.entries()){
    const width=widths[i]*size/100,age=e.t-w.start,hero=/^(VENGEANCE|SEVEN|SEVENTY|LAMECH|SETH|ENOS|RAISED|SEED)$/.test(name(w));
    out.push({w,x:x+width/2,y:box.y+(rows.length===1?box.h*.68:ri*145+112),size,family,rotate:0,scale:1,
     opacity:gi===active?1:0,visible:gi===active&&age>=0,isContext:false,hero,box});x+=width+size*.22;
   }
  }
 }
 return{box,groups,positions:out};
}

const SOURCE_NAMES={ADAM:'g4-l000-w00',EVE:'g4-l000-w04',CAIN:'g4-l059-w00',ABEL:'g4-l003-w05',ENOCH:'g4-l060-w04',GAIDAD:'g4-l063-w04',MALELEEL:'g4-l064-w02',MATHUSALA:'g4-l065-w02',LAMECH:'g4-l066-w03',SETH:'g4-l088-w07',ENOS:'g4-l092-w03'};
/** Biological edges only. Dimness expresses the scene’s moral contrast; no
 * visual or label claims the historical extinction of Cain’s descendants. */
export const GENESIS_ANCESTRY=Object.freeze([
 ['ADAM','CAIN'],['EVE','CAIN'],['ADAM','ABEL'],['EVE','ABEL'],['ADAM','SETH'],['EVE','SETH'],
 ['CAIN','ENOCH'],['ENOCH','GAIDAD'],['GAIDAD','MALELEEL'],['MALELEEL','MATHUSALA'],['MATHUSALA','LAMECH'],['SETH','ENOS']
].map(edge=>Object.freeze(edge)));
function sourceName(e,n){return e.p.words.find(w=>w.id===SOURCE_NAMES[n])||e.p.words.find(w=>name(w)===n)}
function treeModel(c,e,h,id){
 const tree={nodes:[],edges:[],junctions:[]};if(!id.startsWith('genesis-lineage-'))return tree;
 const ending=id==='genesis-lineage-resolution',seed=id==='genesis-lineage-seed',prayer=id==='genesis-lineage-prayer';
 const early=id==='genesis-lineage-cain'&&!words(e).some(w=>['GAIDAD','MALELEEL','MATHUSALA','LAMECH'].includes(name(w)));
 const coords=ending?{
  ADAM:[810,190,100],EVE:[1110,190,100],CAIN:[380,460,103],ENOCH:[235,600,83],GAIDAD:[510,650,82],MALELEEL:[235,765,78],MATHUSALA:[510,815,73],LAMECH:[390,965,83],ABEL:[955,575,90],SETH:[1450,540,155],ENOS:[1450,875,169]
 }:seed?{ADAM:[390,560,126],EVE:[900,560,126],SETH:[640,900,208]}
 :prayer?{ADAM:[750,450,69],EVE:[1080,450,69],SETH:[500,690,202],ENOS:[1420,875,214]}
 :early?{CAIN:[430,670,248],ENOCH:[1410,825,248]}
 :{CAIN:[185,625,101],ENOCH:[480,795,113],GAIDAD:[780,625,111],MALELEEL:[1080,795,108],MATHUSALA:[1390,625,101],LAMECH:[1690,795,115]};
 const heard=words(e).filter(w=>w.start<=e.t);
 for(const [n,[x,y,maxSize]]of Object.entries(coords)){
  const w=sourceName(e,n);if(!w)continue;
  const local=heard.filter(q=>name(q)===n).at(-1),closingOrder=['ADAM','EVE','CAIN','ENOCH','GAIDAD','MALELEEL','MATHUSALA','LAMECH','ABEL','SETH','ENOS'];
  const ignite=ending?e.s.start+.2+closingOrder.indexOf(n)*.38:local?.start??w.start;
  const glow=pulse(ignite,e.t,1.1),renewed=['ADAM','EVE','SETH','ENOS'].includes(n),dim=ending&&['CAIN','ENOCH','GAIDAD','MALELEEL','MATHUSALA','LAMECH'].includes(n);
  const maxWidth=ending?(n==='MATHUSALA'?238:305):early?680:seed?490:prayer?680:270;
  const size=Math.min(maxSize,maxWidth/Math.max(1,measure(c,h,clean(w),100,'Bebas Neue'))*100);
  tree.nodes.push({n,w,x,y,size,family:'Bebas Neue',rotate:0,scale:1,opacity:dim?.57:1,visible:e.t>=w.start,isContext:true,hero:renewed,glow,ignite,dim,box:{x:65,y:400,w:1790,h:625}});
 }
 const byName=new Map(tree.nodes.map(n=>[n.n,n]));
 const edge=(from,to,points)=>{
  const a=byName.get(from),b=byName.get(to);if(!a||!b)return;
  const begin=ending?b.ignite-.2:b.w.start,progress=e.t>=begin?ease((e.t-begin)/.75):0;
  tree.edges.push({from,to,points:points||[[a.x,a.y+30],[b.x,b.y-b.size*.88-24]],visible:a.visible&&b.visible,progress,glow:pulse(b.ignite,e.t,1.35),dim:b.dim});
 };
 if(ending){
  // The paired parental stems meet before splitting into three sibling lines.
  tree.junctions.push({points:[[810,215],[810,290],[1110,290],[1110,215]],opacity:1});
  for(const child of ['CAIN','ABEL','SETH']){const b=byName.get(child);if(b)edge('ADAM',child,[[960,290],[960,350],[b.x,350],[b.x,b.y-b.size*.88-22]])}
 }else if(seed||prayer){
  const a=byName.get('ADAM'),b=byName.get('EVE'),s=byName.get('SETH'),join=seed?620:500;
  if(a&&b)tree.junctions.push({points:[[a.x,a.y+25],[a.x,join],[b.x,join],[b.x,b.y+25]],opacity:.75});
  if(s)edge('ADAM','SETH',[[(a.x+b.x)/2,join],[s.x,seed?720:500],[s.x,s.y-s.size*.88-24]]);
 }
 for(const [from,to]of GENESIS_ANCESTRY){if(['ADAM','EVE'].includes(from))continue;const a=byName.get(from),b=byName.get(to);if(!a||!b)continue;
  if(id==='genesis-lineage-cain')edge(from,to,[[a.x+a.size*.75,a.y-a.size*.28],[(a.x+b.x)/2,a.y-a.size*.28],[(a.x+b.x)/2,b.y-b.size*.28],[b.x-b.size*.9,b.y-b.size*.28]]);
  else if(prayer)edge(from,to,[[a.x+175,a.y-50],[870,a.y-50],[1030,b.y-105],[b.x-170,b.y-105]]);
  else edge(from,to);
 }
 return tree;
}

/** Exact source word objects and bounds for both lyric and contextual name
 * layers. Secondary names are never visible before their first sung cue. */
export function genesisPoses(c,e,h){
 const state=genesisState(e);if(!state)return null;
 const lyric=lyricPoses(c,e,h,state.id),tree=treeModel(c,e,h,state.id);
 return{...state,box:lyric.box,groups:lyric.groups,tree,positions:[...lyric.positions,...tree.nodes]};
}
function traced(c,points,p,color,width){
 if(!p)return;const distances=points.slice(1).map((b,i)=>Math.hypot(b[0]-points[i][0],b[1]-points[i][1]));let remaining=distances.reduce((a,b)=>a+b,0)*clamp(p),part=[points[0]];
 for(let i=0;i<distances.length;i++){const a=points[i],b=points[i+1];if(remaining>=distances[i]){part.push(b);remaining-=distances[i]}else{const f=remaining/Math.max(.001,distances[i]);part.push([mix(a[0],b[0],f),mix(a[1],b[1],f)]);break}}
 stroke(c,part,color,width);
}
function glowLine(c,points,color,width,alpha=1){c.save();c.globalAlpha*=alpha;c.shadowColor=color;c.shadowBlur=16;stroke(c,points,color,width);c.shadowBlur=0;stroke(c,points,color,width*.4);c.restore()}
function treeBackground(c,e,h,m){
 const white=e.paper||'#f4f1eb',red=e.accent||'#e93d4f';
 for(const j of m.tree.junctions){c.save();c.globalAlpha*=j.opacity*.5;stroke(c,j.points,white,2);c.restore()}
 for(const edge of m.tree.edges){if(!edge.visible)continue;c.save();c.globalAlpha*=edge.dim?.34:.65;
  const color=edge.dim?red:white;c.shadowColor=color;c.shadowBlur=12+edge.glow*20;traced(c,edge.points,edge.progress,color,2.4+edge.glow*2);c.restore();
 }
 for(const n of m.tree.nodes){if(!n.visible)continue;const y=n.y+21,w=measure(c,h,clean(n.w),n.size,n.family),color=n.dim?red:white;
  c.save();c.globalAlpha*=n.dim?.25:.5;stroke(c,[[n.x-w*.43,y],[n.x+w*.43,y]],color,1.4);c.restore();
  if(n.glow>.01){c.save();c.globalAlpha*=n.glow*.45;c.shadowColor=white;c.shadowBlur=38;const g=c.createRadialGradient(n.x,n.y-n.size*.38,3,n.x,n.y-n.size*.38,Math.max(150,w*.65));g.addColorStop(0,'rgba(244,241,232,.25)');g.addColorStop(1,'rgba(244,241,232,0)');c.fillStyle=g;c.fillRect(n.x-w-100,n.y-n.size-100,w*2+200,n.size+220);c.restore()}
 }
 if(m.id==='genesis-lineage-seed'){
  const raised=e.p.words.find(w=>w.id==='g4-l089-w02'),q=raised?ease((e.t-raised.start)/1.5):0;
  for(let i=0;i<7;i++){const x=640+(i-3)*62,y=1002-Math.abs(i-3)*9;glowLine(c,[[640,967],[x,y],[x+(i-3)*20,1040]],white,1.7,.18+.36*q)}
 }
 if(m.id==='genesis-lineage-prayer'||m.id==='genesis-lineage-resolution'){
  const enos=m.tree.nodes.find(n=>n.n==='ENOS');if(enos?.visible){const p=ease((e.t-enos.w.start)/1.4),y=enos.y+36;for(const side of [-1,1])glowLine(c,[[enos.x+side*170,y],[enos.x+side*(200+70*p),y-45*p],[enos.x+side*(218+110*p),y-125*p]],white,1.5,.3*p)}
 }
}
function numeral(c,h,text,x,y,size,color,{opacity=1,split=0,shake=0}={}){
 c.save();c.globalAlpha*=opacity;h.setFont(c,size,'Archivo Black');c.fillStyle=color;
 // Three physical strata shear without breaking numeral recognition.
 for(let i=0;i<3;i++){c.save();c.beginPath();c.rect(80,y-size+i*size/3,1760,size/3+2);c.clip();c.fillText(text,x+(i===1?-1:1)*split+shake,y);c.restore()}
 c.restore();
}
function vengeanceBackground(c,e,h,m){
 const red=e.accent||'#e33c4e',white=e.paper||'#f4f1eb',pre=smooth((e.t-e.s.start)/2.5),shake=Math.sin((e.t-e.s.start)*42)*m.impact*9;
 // The compression architecture is substantial, while the lyric band remains
 // completely outside the blast field. No illustrated people or victim count.
 c.save();c.beginPath();c.rect(65,410,1790,615);c.clip();
 const close=pre*.2+m.pressure*.8,rift=30*m.rupture;
 for(const side of [-1,1]){const inner=960+side*(620-180*close+rift);c.save();c.globalAlpha*=.58;c.fillStyle='#321016';c.beginPath();c.moveTo(side<0?65:1855,450);c.lineTo(inner,445+side*24);c.lineTo(inner+side*75,980);c.lineTo(side<0?65:1855,1035);c.closePath();c.fill();c.restore();glowLine(c,[[inner,446],[inner+side*26,640],[inner+side*75,980]],red,3.5,.5)}
 for(let i=0;i<7;i++){const x=360+i*200;stroke(c,[[x,948],[x+15,1025]],red,4+pre*3)}
 if(m.sevenReveal>0){
  const x=mix(960,685,m.pressure),drop=-150*(1-m.sevenReveal);numeral(c,h,'7',x,942+drop,715,red,{opacity:m.sevenReveal,split:m.rupture*9,shake});
  if(m.multiplication>0)numeral(c,h,'7',1210,942-240*(1-m.multiplication),715,red,{opacity:m.multiplication,split:-m.rupture*9,shake:-shake});
  // Deep shadow extrusions give the slabs physical mass without tiny chatter.
  c.save();c.globalAlpha*=.16*m.sevenReveal;h.setFont(c,715,'Archivo Black');c.strokeStyle=white;c.lineWidth=1.2;c.strokeText('7',x+12,954+drop);if(m.multiplication)c.strokeText('7',1222,954-240*(1-m.multiplication));c.restore();
 }
 if(m.rupture>0)for(let i=0;i<23;i++){
  const side=i%2?-1:1,r=random(i+19),x=960+side*(170+r*530)*m.rupture,y=800+Math.sin(i*2.1)*(90+150*m.rupture),len=24+random(i+4)*70;
  c.save();c.globalAlpha*=.35+.3*(1-m.rupture);c.fillStyle=i%4?red:white;c.translate(x,y);c.rotate(side*(.2+r*1.2));c.beginPath();c.moveTo(-len/2,0);c.lineTo(len/2,-9-r*18);c.lineTo(len/3,14);c.closePath();c.fill();c.restore();
 }
 for(let j=0;j<4;j++){const y=964+j*15;stroke(c,[[180,y],[660+j*19,y-2],[835,y+13*m.rupture],[1090,y-8*m.rupture],[1280,y],[1740,y]],j%2?white:red,j?1:4)}
 c.restore();
}
function forgivenessBackground(c,e,h,m){
 const white=e.paper||'#f4f1eb',red=e.accent||'#e33c4e',p=m.release;
 numeral(c,h,'77',645,700,460,red,{opacity:1-smooth(p*1.65),split:20*p});
 // Each formerly closed pressure form opens rather than becoming a magical
 // emanation from the Christ photograph. The opening is a typographic action.
 for(let i=0;i<7;i++){
  const x=520+(i%2?1:-1)*i*26*p,y=475+(i-3)*8*p,r=100+i*23,open=.2+2.4*p;
  c.save();c.globalAlpha*=(.15+.47*p)*smooth(p*3);c.strokeStyle=white;c.shadowColor=white;c.shadowBlur=8+10*p;c.lineWidth=i===0?5:1.6;c.beginPath();c.ellipse(x,y,r*(1+.1*p),r*.7,0,open,tau-open*.6);c.stroke();c.restore();
 }
 for(const side of [-1,1]){const x=650+side*(340+155*p);glowLine(c,[[x,325+40*p],[x+side*30*p,580],[x+side*70*p,675]],p>.35?white:red,2.5,.48*(1-p*.6))}
}
/** Supporting geometry only; caller owns the photograph/full-frame fill. */
export function drawGenesisBackground(c,e,h){
 const m=genesisPoses(c,e,h);if(!m)return false;c.save();
 if(m.id==='genesis-vengeance')vengeanceBackground(c,e,h,m);
 else if(m.id==='genesis-forgiveness')forgivenessBackground(c,e,h,m);
 else treeBackground(c,e,h,m);
 c.restore();return true;
}
export function drawGenesisTypography(c,e,h){
 const m=genesisPoses(c,e,h);if(!m)return false;
 c.save();const white=e.paper||'#f4f1eb',red=e.accent||'#e33c4e';
 if(e.s.direction?.photo){c.shadowColor='rgba(0,0,0,.95)';c.shadowBlur=16;c.shadowOffsetY=3}
 for(const o of m.positions){if(!o.visible||o.opacity<=0)continue;c.save();
  if(o.isContext&&o.glow>.01){c.shadowColor=white;c.shadowBlur=12+28*o.glow}
  // Graph labels normalize only punctuation, while their source object and
  // canonical onset remain intact. The complete sung phrase still uses word().
  if(o.isContext){h.setFont(c,o.size,o.family);c.globalAlpha*=o.opacity*ease((e.t-o.w.start)/.14);c.fillStyle=o.dim?red:white;c.fillText(clean(o.w),o.x,o.y)}
  else h.word(c,o.w,e.t,o.x,o.y,o.size,{family:o.family,color:o.hero&&m.id==='genesis-vengeance'?red:white,rotate:0,opacity:o.opacity,scale:1,motion:'none'});c.restore();
 }
 if(m.id==='genesis-forgiveness'){
  const cfg=config(e);c.textAlign='left';c.textBaseline='alphabetic';c.fillStyle=white;c.globalAlpha*=.8;
  c.font='26px "Archivo Black"';c.fillText(cfg.interpretiveLabel||'CHRIST · MATTHEW 18:22',170,157);
  const subtitle=cfg.interpretiveSubtitle||'FORGIVE WITHOUT LIMIT';c.font='86px "Bebas Neue"';
  const size=Math.min(86,86*960/Math.max(1,c.measureText(subtitle).width));c.font=`${size}px "Bebas Neue"`;
  c.globalAlpha*=smooth((m.elapsed-.55)/1.4);c.fillText(subtitle,170,268);
 }
 c.restore();return true;
}
