/* Psalm 91. All lyric onsets come from canonical P91_DATA words.
   Each scene has its own semantic arrangement and deterministic motion score. */
window.buildPsalm91Narrative=function({tl,stage,data}){
 const W=1920,H=1080,C='#c77746',D='#533021',P='#f4ead6',K='#0a0908';
 const make=(tag,cls,parent,styles={})=>{const n=document.createElement(tag);n.className=cls;Object.assign(n.style,styles);parent.appendChild(n);return n};
 const world=make('div','p91-world',stage,{position:'absolute',inset:'0',transformStyle:'preserve-3d'});
 world.dataset.layoutAllowOverflow='';
 const meter=document.createElement('canvas').getContext('2d');
 const specs={
  2:{family:'ascending-dwelling',groups:['Whoever makes the','Most High','his dwelling'],sizes:[100,226,126],styles:['serif','condensed','heavy'],ys:[240,390,685],align:'center'},
  3:{family:'canopy-rest',groups:['will rest beneath','the God of','heaven’s care.'],sizes:[125,105,174],styles:['serif','condensed','heavy'],ys:[260,475,630],align:'center'},
  4:{family:'spoken-anchor',groups:['I say,','Lord,','you are my helper;'],sizes:[110,270,140],styles:['serif','heavy','condensed'],ys:[175,300,680],xs:[260,430,470]},
  5:{family:'trust-bridge',groups:['my refuge and my God,','I trust','in you.'],sizes:[124,214,142],styles:['condensed','heavy','serif'],ys:[240,410,680],xs:[180,370,1090]},
  6:{family:'net-release',groups:['You draw me from','the hunter’s','hidden net'],sizes:[110,128,193],styles:['serif','condensed','heavy'],ys:[230,422,610],photo:true},
  7:{family:'parting-obstacles',groups:['and bring me through','the trouble','in my way.'],sizes:[112,190,133],styles:['serif','heavy','condensed'],ys:[230,407,670],align:'center'},
  8:{family:'shoulder-shadow',groups:['Your shoulders','cast their shadow','over me;'],sizes:[178,136,180],styles:['heavy','serif','condensed'],ys:[260,492,685],align:'center'},
  9:{family:'wing-stillness',groups:['beneath your','wings','my fear grows still.'],sizes:[123,276,123],styles:['serif','condensed','heavy'],ys:[190,346,715],photo:true},
  10:{family:'shield-lock',groups:['Your faithfulness','surrounds me','like a shield;'],sizes:[132,154,145],styles:['serif','heavy','condensed'],ys:[258,440,650],align:'center'},
  11:{family:'word-sentinels',groups:['your faithful','word','is guarding me.'],sizes:[136,296,129],styles:['serif','heavy','condensed'],ys:[170,345,724],align:'center'},
  12:{family:'night-rejection',groups:['The dread that comes','at night','cannot command me;'],sizes:[111,190,145],styles:['serif','heavy','condensed'],ys:[214,398,666],align:'center'},
  13:{family:'arrow-deflection',groups:['the flying arrow','cannot rule','my day.'],sizes:[110,182,142],styles:['serif','condensed','heavy'],ys:[239,429,666],photo:true},
  14:{family:'darkness-split',groups:['The darkness carries','no power','over me,'],sizes:[117,222,150],styles:['serif','heavy','condensed'],ys:[220,420,700],align:'center'},
  15:{family:'noon-impact',groups:['nor does the evil','striking at','high noon.'],sizes:[122,144,229],styles:['serif','condensed','heavy'],ys:[220,392,620],align:'center'},
  16:{family:'thousand-collapse',groups:['Though a','thousand','fall beside me'],sizes:[109,260,138],styles:['serif','condensed','heavy'],ys:[180,344,716],align:'center'},
  17:{family:'tenfold-radial',groups:['and ten thousand','at my right,'],sizes:[196,143],styles:['heavy','serif'],ys:[325,620],align:'center'},
  18:{family:'shelter-enclosure',groups:['your shelter','will stand','around me;'],sizes:[201,160,141],styles:['heavy','condensed','serif'],ys:[223,484,720],align:'center'},
  19:{family:'stopping-distance',groups:['that harm','will never','reach me.'],sizes:[150,195,180],styles:['serif','heavy','condensed'],ys:[237,427,669],align:'center'},
  20:{family:'falling-field',groups:['Though a thousand','fall','beside me,'],sizes:[149,280,140],styles:['condensed','heavy','serif'],ys:[177,352,746],align:'center'},
  21:{family:'trust-causeway',groups:['I will trust you','through','the fight.'],sizes:[166,142,232],styles:['serif','condensed','heavy'],ys:[187,418,608],align:'center'},
  22:{family:'weight-of-wages',groups:['I may see the wicked','face their','wages,'],sizes:[117,139,286],styles:['serif','condensed','heavy'],ys:[183,357,537],xs:[190,720,550]},
  23:{family:'home-threshold',groups:['but I have called','the Highest one','my home.'],sizes:[107,134,193],styles:['serif','condensed','heavy'],ys:[231,413,641],photo:true},
  24:{family:'held-hope',groups:['Lord, you are','the hope','I hold.'],sizes:[118,205,159],styles:['serif','heavy','condensed'],ys:[247,422,680],align:'center'},
  25:{family:'unclaimed-ground',groups:['No evil can claim','my dwelling;'],sizes:[148,241],styles:['serif','heavy'],ys:[294,535],align:'center'},
  26:{family:'sealed-door',groups:['no scourge will settle','by my door.'],sizes:[151,243],styles:['serif','condensed'],ys:[293,524],align:'center'},
  27:{family:'night-clock',groups:['The dread that comes','at night','cannot command me;'],sizes:[116,191,154],styles:['condensed','heavy','serif'],ys:[187,405,673],align:'center'},
  28:{family:'arrow-tangent',groups:['the flying arrow','cannot rule','my day.'],sizes:[144,229,166],styles:['serif','condensed','heavy'],ys:[189,378,676],align:'center'},
  29:{family:'shadow-unbinding',groups:['The darkness carries','no power','over me,'],sizes:[126,240,155],styles:['condensed','heavy','serif'],ys:[205,411,706],align:'center'},
  30:{family:'solar-shutter',groups:['nor does the evil','striking at','high noon.'],sizes:[134,164,226],styles:['serif','condensed','heavy'],ys:[203,410,638],align:'center'},
  31:{family:'thousand-tilt',groups:['Though a thousand','fall beside me'],sizes:[213,167],styles:['condensed','heavy'],ys:[304,620],align:'center'},
  32:{family:'right-ranks',groups:['and ten thousand','at my right,'],sizes:[195,166],styles:['heavy','serif'],ys:[330,620],align:'center'},
  33:{family:'shelter-buttress',groups:['your shelter','will stand around me;'],sizes:[238,153],styles:['heavy','condensed'],ys:[267,625],align:'center'},
  34:{family:'harm-void',groups:['that harm will','never','reach me.'],sizes:[155,237,179],styles:['serif','heavy','condensed'],ys:[190,407,715],align:'center'},
  35:{family:'thousand-domino',groups:['Though a','thousand fall','beside me,'],sizes:[107,250,151],styles:['serif','condensed','heavy'],ys:[163,327,711],align:'center'},
  36:{family:'trust-keystone',groups:['I will trust you','through the fight.'],sizes:[202,221],styles:['serif','condensed'],ys:[307,574],align:'center'},
  37:{family:'guardian-steps',groups:['You send your angels','out to watch','my steps'],sizes:[103,120,210],styles:['serif','condensed','heavy'],ys:[242,427,654],photo:true},
  38:{family:'road-perspective',groups:['and keep me','on the road','ahead.'],sizes:[124,182,229],styles:['serif','heavy','condensed'],ys:[202,382,650],xs:[180,490,1130]},
  39:{family:'lifted-over-stone',groups:['They lift me high','above the','jagged stone.'],sizes:[177,123,203],styles:['heavy','serif','condensed'],ys:[168,430,670],align:'center'},
  40:{family:'viper-floor',groups:['The viper and the basilisk','lie beneath','my feet;'],sizes:[116,178,210],styles:['condensed','serif','heavy'],ys:[214,440,660],align:'center'},
  41:{family:'lion-gate',groups:['the lion and the dragon','cannot bar','the way.'],sizes:[104,166,227],styles:['serif','heavy','condensed'],ys:[210,415,654],photo:true},
  42:{family:'rescue-tether',groups:['Because you have held on to me,','I will rescue you.'],sizes:[116,219],styles:['serif','condensed'],ys:[299,549],align:'center'},
  43:{family:'name-revelation',groups:['You know my name;','I will guard','your life.'],sizes:[110,155,221],styles:['serif','condensed','heavy'],ys:[224,420,668],photo:true},
  44:{family:'call-response',groups:['Call,','and I will','answer.'],sizes:[230,115,238],styles:['heavy','serif','condensed'],ys:[198,444,614],xs:[210,660,850]},
  45:{family:'presence-gap',groups:['When trouble comes,','I will be there.'],sizes:[155,233],styles:['serif','heavy'],ys:[321,568],align:'center'},
  46:{family:'raised-hand',groups:['I’ll bring you through','and raise','you up.'],sizes:[105,167,215],styles:['serif','condensed','heavy'],ys:[212,414,669],photo:true},
  47:{family:'days-unfold',groups:['I’ll fill your days','and let you','see'],sizes:[167,145,294],styles:['serif','condensed','heavy'],ys:[204,426,617],align:'center'},
  48:{family:'hand-print',groups:['the saving work','of my hand.'],sizes:[196,236],styles:['serif','condensed'],ys:[312,585],align:'center'},
  49:{family:'thousand-surge',groups:['Though a','thousand','fall beside me'],sizes:[108,276,147],styles:['serif','condensed','heavy'],ys:[162,338,721],align:'center'},
  50:{family:'ten-thousand-sweep',groups:['and ten thousand','at my right,'],sizes:[191,163],styles:['heavy','serif'],ys:[311,618],align:'center'},
  51:{family:'shelter-crown',groups:['your shelter','will stand','around me;'],sizes:[229,150,147],styles:['heavy','condensed','serif'],ys:[187,492,714],align:'center'},
  52:{family:'unreachable-island',groups:['that harm','will never reach me.'],sizes:[209,194],styles:['serif','condensed'],ys:[303,594],align:'center'},
  53:{family:'falling-copper-rain',groups:['Though a thousand','fall beside me,'],sizes:[218,170],styles:['condensed','heavy'],ys:[316,621],align:'center'},
  54:{family:'trust-summit',groups:['I will trust you','through','the fight.'],sizes:[163,157,266],styles:['serif','condensed','heavy'],ys:[162,383,625],align:'center'},
  55:{family:'shelter-dawn',groups:['Under the','Highest’s','shelter.'],sizes:[125,200,234],styles:['serif','condensed','heavy'],ys:[221,398,661],photo:true}
 };
 const heroScenes=new Set([5,7,10,14,16,18,21,28,34,38,39,42,44,49,51,54]);
 const scenes=[];let wx=0,wy=0,wz=0;
 const rowCounts=groups=>groups.map(g=>g.split(/\s+/).length);
 function addWords(s){
  let wi=0;const spec=s.spec;const counts=rowCounts(spec.groups);const photo=!!s.asset;
  if(counts.reduce((a,b)=>a+b,0)!==s.words.length)throw new Error(`Line layout mismatch ${s.p.id}: ${counts} vs ${s.words.length}`);
  const out=[];
  counts.forEach((count,ri)=>{
   const rowWords=s.words.slice(wi,wi+count),style=spec.styles[ri],family=style==='serif'?'Elegy':style==='heavy'?'Archivo':'Bebas';
   let size=spec.sizes[ri],gap=size*(style==='serif'?.22:style==='heavy'?.23:.18);
   const max=photo?1080:1640;
   const measure=sz=>{meter.font=`${style==='serif'?'italic ':''}${sz}px ${family}`;meter.fontKerning='normal';return rowWords.map(w=>meter.measureText(w.text).width)};
   let widths=measure(size),total=widths.reduce((a,b)=>a+b,0)+gap*(count-1);
   if(total>max){size=size*max/total;gap=size*(style==='serif'?.22:style==='heavy'?.23:.18);widths=measure(size);total=widths.reduce((a,b)=>a+b,0)+gap*(count-1)}
   if(size<70)throw new Error(`Too-small lyric ${s.p.id} ${size}`);
   let x=photo?128:spec.align==='center'?(W-total)/2:(spec.xs?.[ri]||160);
   if(x+total>1780)x=1780-total;
   rowWords.forEach((w,j)=>{
    const n=make('span',`p91-word ${style}`,s.type,{left:x+'px',top:spec.ys[ri]+'px',fontSize:size+'px',color:ri===1?C:P});
    n.textContent=w.text;n.id=w.id;n.dataset.wordId=w.id;n.dataset.cueStart=String(w.start);n.dataset.cueEnd=String(w.end);n.dataset.cueProvenance=JSON.stringify(w.provenance||{});
    tl.set(n,{opacity:1},w.start);
    // Opacity lands on vocal onset; a short supported motion settles without delaying reading.
    const axis=(s.num+ri)%4;if(!heroScenes.has(s.num))tl.fromTo(n,{x:axis===0?-26:axis===2?26:0,y:axis===1?22:axis===3?-22:0,scale:style==='heavy'?1.04:1},{x:0,y:0,scale:1,duration:.14,ease:'power3.out',immediateRender:false},w.start);
    out.push(n);x+=widths[j]+gap;
   });wi+=count;
  });return out;
 }
 function box(s,x,y,w,h,color=C,other={}){return make('div','p91-form',s.shapes,{left:x+'px',top:y+'px',width:w+'px',height:h+'px',background:color,...other})}
 function ring(s,x,y,d,width=40,color=D){return box(s,x,y,d,d,'transparent',{border:`${width}px solid ${color}`,borderRadius:'50%'})}
 function move(n,from,to,t,d=.45,ease='power3.out'){tl.fromTo(n,from,{...to,duration:d,ease,immediateRender:false},t)}
 function pulse(n,t,amp=1.04){tl.to(n,{scale:amp,duration:.09,ease:'power2.out'},t);tl.to(n,{scale:1,duration:.25,ease:'power2.out'},t+.09)}
 function photoLayer(s){
  if(!s.asset)return;const a=typeof s.asset==='string'?{src:s.asset}:s.asset;
  const zone=make('div','p91-photo-zone',s.camera),mask=make('div','p91-photo-mask',zone);
  let posterNode=null;
  if(a.type==='video'&&a.poster){const poster=make('img','p91-video-poster',mask,{objectPosition:a.objectPosition||'68% 50%'});poster.src=a.poster;poster.id=`${s.p.id}-poster`;poster.alt=a.alt||'Same shot held after the short motion segment';posterNode=poster;}
  const staticMedia=document.getElementById(`${s.p.id}-art`);
  const media=staticMedia||make(a.type==='video'?'video':'img','',mask);if(staticMedia)mask.appendChild(media);media.style.objectPosition=a.objectPosition||'68% 50%';media.src=a.src;media.id=`${s.p.id}-art`;media.setAttribute('alt',a.alt||'Photorealistic scene supporting this lyric');
  if(a.type==='video'){media.muted=true;media.playsInline=true;media.setAttribute('muted','');media.setAttribute('playsinline','');media.dataset.start=String(s.start);media.dataset.duration=String(Math.min(a.duration||s.end-s.start,s.end-s.start));media.dataset.trackIndex='2';}
  const reveal=s.num===43?'keyhole':a.reveal||'diagonal';
  if(reveal==='full')mask.style.clipPath='none';
  else if(reveal==='keyhole')mask.style.clipPath='polygon(64% 10%,85% 10%,95% 29%,86% 48%,91% 95%,58% 95%,63% 48%,54% 29%)';
  else if(reveal==='round')mask.style.clipPath='ellipse(51% 72% at 94% 48%)';
  else mask.style.clipPath=s.num===41?'polygon(56% 0,100% 0,100% 100%,37% 100%)':'polygon(61% 0,100% 0,100% 100%,48% 100%)';
  make('div','p91-photo-shade',mask);
  move(mask,{opacity:0,x:80},{opacity:1,x:0},s.start,.55,'power2.out');
  move(posterNode?[media,posterNode]:media,{scale:1.05,x:22},{scale:1,x:0},s.start,Math.max(2,s.end-s.start),'sine.out');
  s.photoMask=mask;
 }
 function baseScene(p,num,index){
  const spec=specs[num],next=data.phrases[index+1],start=p.start;
  const end=num===55?data.duration:Math.min(data.duration,next?.start||p.end);
  const duration=Math.max(.1,end-start),id=p.id;
  const section=make('section','p91-scene',world);section.dataset.sceneId=id;section.dataset.choreography=spec.family;section.dataset.startCue=String(start);section.dataset.endCue=String(end);
  const camera=make('div','p91-camera',section),shapes=make('div','p91-shapes',camera),type=make('div','p91-type',camera);
  make('div','p91-vignette',camera);
  const s={p,num,spec,start,end,duration,section,camera,shapes,type,words:p.words||p.wordIds.map(id=>data.words.find(w=>w.id===id)),asset:data.assets[id]};
  const dir=num%5;wx+=dir===3?-2150:dir===4?0:2150;wy+=dir===4?1250:dir===1?-170:dir===2?170:0;wz+=dir===2?-90:dir===1?90:0;
  tl.set(section,{x:wx,y:wy,z:wz,opacity:0},0);
  const previous=scenes.at(-1),first=index===1;
  // Complete a short local film before the camera departs, including standalone
  // instrumental inserts. Word onsets stay authoritative for the incoming shot.
  let protectedEnd=previous?.p.end||0;
  if(previous){
   const art=typeof previous.asset==='object'?previous.asset:null;
   if(art?.type==='video')protectedEnd=Math.max(protectedEnd,Math.min(start,Number(art.start??previous.start)+Number(art.duration||previous.duration)));
   for(const insert of Object.values(data.assets))if(insert?.type==='video'&&Number.isFinite(insert.start)&&insert.start>=previous.start&&insert.start<start)protectedEnd=Math.max(protectedEnd,Math.min(start,insert.start+Number(insert.duration||0)));
  }
  const available=previous?Math.max(0,start-protectedEnd-.035):0;
  const travelTime=first?0:Math.min(.36,available);
  const enter=start-travelTime;
  tl.set(section,{opacity:1},enter);
  if(first)tl.set(world,{x:-wx,y:-wy,z:-wz},0);
  else if(travelTime>.08)tl.to(world,{x:-wx,y:-wy,z:-wz,duration:travelTime,ease:'power3.inOut'},enter);
  else tl.set(world,{x:-wx,y:-wy,z:-wz},start);
  if(scenes.length)tl.set(scenes.at(-1).section,{opacity:0},start);
  if(end<data.duration)tl.set(section,{opacity:0},end+.01);
  photoLayer(s);s.nodes=addWords(s);scenes.push(s);return s;
 }
 function choreograph(s){
  const t=s.start,d=s.duration,last=s.words.at(-1).start;
  const hit=i=>s.words[Math.min(i,s.words.length-1)].start;
  switch(s.num){
   case 2:{ // A dwelling rises from a foundation, and its roof opens above Most High.
    const floor=box(s,170,884,1580,36,D),roof=box(s,220,139,1480,38,C),a=box(s,210,149,38,695,D),b=box(s,1672,149,38,695,D);
    move(floor,{scaleX:0},{scaleX:1},t,.6);move(roof,{y:120,opacity:0},{y:0,opacity:1},hit(3),.55);move(a,{scaleY:0},{scaleY:1},t,.55);move(b,{scaleY:0},{scaleY:1},hit(2),.55);
    break;
   }
   case 3:{ // A wide roof settles down; the words remain at rest beneath it.
    const canopy=box(s,180,120,1560,120,C,{clipPath:'polygon(0 100%,12% 0,88% 0,100% 100%)'});
    move(canopy,{y:-260,scaleX:.3},{y:0,scaleX:1},t,.8,'power2.out');
    const shade=box(s,120,255,1680,665,'linear-gradient(180deg,#c777461d,transparent)');
    move(shade,{scaleY:0,opacity:0},{scaleY:1,opacity:1},hit(2),1.2);
    const rest=box(s,330,897,1260,24,D);move(rest,{x:190,scaleX:0},{x:0,scaleX:1},hit(6),.7);
    break;
   }
   case 4:{ // Speech travels as a copper punctuation pulse toward the anchored LORD.
    const stem=box(s,170,302,45,420,C);move(stem,{scaleY:0},{scaleY:1},hit(2),.32);
    for(let i=0;i<4;i++){const r=ring(s,225-i*75,315-i*75,490+i*150,13,C);r.style.borderRightColor='transparent';r.style.borderTopColor='transparent';move(r,{scale:.5,opacity:0},{scale:1,opacity:.20-i*.025},t+i*.16,.7);}
    const support=box(s,425,635,1120,20,D);move(support,{scaleX:0},{scaleX:1},hit(5),.45);
    break;
   }
   case 5:{ // Trust completes the missing span in a graphic bridge.
    for(let i=0;i<7;i++){const b=box(s,210+i*223,845,191,48,i===3?C:D);move(b,{y:i===3?170:70,opacity:0},{y:0,opacity:1},t+i*.08,.45);}
    const wire=box(s,214,827,1525,8,C);move(wire,{scaleX:0},{scaleX:1},hit(5),.6);
    const pier1=box(s,385,892,45,188,D),pier2=box(s,1460,892,45,188,D);move(pier1,{scaleY:0},{scaleY:1},t,.5);move(pier2,{scaleY:0},{scaleY:1},t+.2,.5);
    break;
   }
   case 6:{ // The net parts around the lyric, never across its reading surface.
    for(let i=0;i<8;i++){const n=box(s,30+i*78,20,10,1040,D);move(n,{rotation:-20,x:150,opacity:0},{rotation:-20,x:0,opacity:.75},t,.4);tl.to(n,{x:-540-i*25,rotation:-42,duration:1.4,ease:'power3.inOut'},hit(3));}
    const notch=box(s,100,910,925,24,C);move(notch,{scaleX:0},{scaleX:1},hit(6),.55);
    break;
   }
   case 7:{ // Solid obstacles are forced apart to open a central passage.
    for(let i=0;i<5;i++){const a=box(s,0,65+i*196,240+i*23,90,i%2?C:D),b=box(s,1660-i*23,135+i*190,300,90,i%2?D:C);move(a,{x:350},{x:-75},t+i*.055,.9,'power3.inOut');move(b,{x:-350},{x:75},hit(3)+i*.045,.9,'power3.inOut');}
    const path=box(s,100,968,1720,24,C);move(path,{scaleX:0},{scaleX:1},hit(4),1.2);
    break;
   }
   case 8:{ // Two broad shoulder silhouettes produce a protective shadow.
    const left=box(s,-180,-340,1160,630,C,{borderRadius:'45%'}),right=box(s,950,-340,1160,630,C,{borderRadius:'45%'});
    move(left,{rotation:-30,x:-150},{rotation:-8,x:0},t,1.1);move(right,{rotation:30,x:150},{rotation:8,x:0},t,1.1);
    const shadow=box(s,140,100,1640,905,'linear-gradient(180deg,#3b281a88,transparent)',{borderRadius:'0 0 45% 45%'});move(shadow,{scaleY:0},{scaleY:1},hit(3),1.6,'sine.out');
    break;
   }
   case 9:{ // A slow wing arc settles; agitation diminishes as STILL is sung.
    const arc=ring(s,1145,-300,1440,30,C);arc.style.opacity='.65';move(arc,{rotation:-40,x:155},{rotation:0,x:0},t,Math.min(3,d),'sine.out');
    for(let i=0;i<12;i++){const feather=box(s,1660+i*24,-90+i*72,44,450,D,{borderRadius:'80% 0 80% 0'});move(feather,{rotation:35,x:160},{rotation:-10,x:0},t+i*.045,1.7);}
    const calm=box(s,130,901,950,12,C);move(calm,{scaleX:.1},{scaleX:1},hit(4),Math.max(.3,last-hit(4)),'sine.out');
    break;
   }
   case 10:{ // Four independent shield quarters lock around the completed sentence.
    const bounds=[[105,140,60,820],[1755,140,60,820],[105,100,1710,40],[105,940,1710,40]];
    bounds.forEach(([x,y,w,h],i)=>{const b=box(s,x,y,w,h,i<2?C:D);move(b,{x:i===0?-220:i===1?220:0,y:i===2?-200:i===3?200:0,opacity:0},{x:0,y:0,opacity:1},hit(Math.min(2+i,s.words.length-1)),.4);});
    break;
   }
   case 11:{ // The word itself is flanked by tall, solid sentinels.
    [-1,1].forEach(sign=>{const x=sign<0?110:1750;const sentinel=box(s,x,190,60,700,C);move(sentinel,{y:sign*250,scaleY:.15},{y:0,scaleY:1},hit(2),.5);const cap=box(s,x-20,175,100,32,P);move(cap,{opacity:0,scaleX:0},{opacity:1,scaleX:1},hit(4),.32)});
    const plate=box(s,345,676,1230,17,D);move(plate,{scaleX:0},{scaleX:1},hit(3),.65);
    break;
   }
   case 12:{ // Night closes toward the word but cannot cross the copper boundary.
    const moon=ring(s,1430,-200,700,140,D);move(moon,{x:200,rotation:-30},{x:0,rotation:12},t,d,'none');
    const night=box(s,0,0,280,1080,'#010101');move(night,{x:-260},{x:0},t,1.1);tl.to(night,{x:-320,duration:.5,ease:'power3.in'},hit(6));
    const refusal=box(s,150,653,1620,15,C);move(refusal,{scaleX:0},{scaleX:1},hit(6),.22);
    break;
   }
   case 13:{ // Arrows bend away at a material boundary, behind the protected words.
    const wall=box(s,1140,90,24,900,C);move(wall,{scaleY:0},{scaleY:1},t,.45);
    // The local film owns the physical disintegration when it is present.
    if(s.asset?.type==='video'){tl.to(wall,{opacity:.22,duration:.7},hit(3));break;}
    for(let i=0;i<6;i++){const a=box(s,1910,150+i*152,320,13,i%2?P:C,{clipPath:'polygon(0 30%,85% 30%,85% 0,100% 50%,85% 100%,85% 70%,0 70%)'});move(a,{x:280,rotation:180,opacity:0},{x:-630,rotation:180,opacity:.7},t+.28+i*.3,.42,'power2.in');tl.to(a,{x:-380,y:i<3?-230:230,rotation:i<3?225:135,opacity:0,duration:.6},t+.7+i*.3);}
    break;
   }
   case 14:{ // A dark central mass physically splits around NO POWER.
    const a=box(s,0,0,970,1080,'#020202'),b=box(s,970,0,950,1080,'#020202');
    move(a,{x:300},{x:0},t,.3);move(b,{x:-300},{x:0},t,.3);
    tl.to(a,{x:-610,duration:.6,ease:'power4.out'},hit(3));tl.to(b,{x:610,duration:.6,ease:'power4.out'},hit(3));
    const seam=box(s,950,100,20,880,C);move(seam,{scaleY:0},{scaleY:1},hit(3),.3);tl.to(seam,{opacity:.1,duration:.7},hit(4));
    break;
   }
   case 15:{ // Noon becomes an overhead disc, whose blow stops above the lyric.
    const sun=ring(s,690,-330,540,110,C);move(sun,{y:-200,rotation:0},{y:80,rotation:90},t,1.4,'power2.out');
    for(let i=0;i<7;i++){const ray=box(s,300+i*215,70,15,230,D);move(ray,{scaleY:0},{scaleY:1},t+i*.09,.4);tl.to(ray,{scaleY:.2,duration:.3},hit(5));}
    const stop=box(s,120,211,1680,14,C);move(stop,{scaleX:0},{scaleX:1},hit(5),.22);
    break;
   }
   case 16:{ // A thousand is represented by a field of ranks which collapses outward.
    for(let i=0;i<26;i++){const x=i<13?42+i*13:1690+(i-13)*13;const rank=box(s,x,155+(i%4)*75,15,700-i%3*130,i%4===0?C:D);move(rank,{scaleY:0},{scaleY:1},t+i*.006,.18);tl.to(rank,{rotation:i<13?-75:75,y:280,opacity:.15,duration:.85,ease:'power3.in'},hit(3)+(i%13)*.027);}
    break;
   }
   case 17:{ // Ten concentric sectors articulate the vastly greater number on the right.
    for(let i=0;i<10;i++){const r=ring(s,1200-i*54,20-i*54,800+i*108,23,i%2?D:C);r.style.borderLeftColor='transparent';move(r,{rotation:-80,opacity:0,scale:.75},{rotation:i*5,opacity:.5,scale:1},t+i*.023,.52);}
    const orient=box(s,170,894,1540,18,C);move(orient,{scaleX:0},{scaleX:1},last,.35);
    break;
   }
   case 18:{ // Shelter assembles inward from four thick copper planes.
    [[75,100,60,865,-200,0],[1785,100,60,865,200,0],[110,95,1700,45,0,-200],[110,935,1700,45,0,200]].forEach(([x,y,w,h,dx,dy],i)=>{const panel=box(s,x,y,w,h,i%2?D:C);move(panel,{x:dx,y:dy,rotation:i%2?7:-7},{x:0,y:0,rotation:0},hit(Math.min(i+1,5)),.35);});
    break;
   }
   case 19:{ // A dense moving mass halts at an unbridgeable gap.
    for(let i=0;i<9;i++){const chunk=box(s,-100-i*35,130+i*90,180,48,C);move(chunk,{x:-250},{x:180+(i%3)*25},t+i*.06,.44);tl.to(chunk,{x:150+(i%3)*25,duration:.15},hit(3));}
    const boundary=box(s,310,80,12,920,D);move(boundary,{scaleY:0},{scaleY:1},hit(2),.3);
    break;
   }
   case 20:{ // Wide falling ranks open a still island around BESIDE ME.
    for(let i=0;i<34;i++){const x=20+i*58,b=box(s,x,72+(i%3)*19,23,150+i%4*32,i%5?D:C);move(b,{y:-260,rotation:0},{y:1000,rotation:(i%2?1:-1)*(20+i%4*10)},hit(3)+(i%7)*.11,Math.max(1,d*.6),'power2.in');}
    const island=box(s,265,905,1390,40,C);move(island,{scaleX:0},{scaleX:1},hit(4),.65);
    break;
   }
   case 21:{ // A sequence of raised spans connects a causeway toward the final word.
    for(let i=0;i<9;i++){const slab=box(s,130+i*195,935-i*8,163,38,i%2?C:D);move(slab,{y:190,rotationX:75},{y:0,rotationX:0},t+i*.12,.55);}
    const horizon=box(s,138,151,1644,8,D);move(horizon,{scaleX:0},{scaleX:1},t,1.8);
    break;
   }
   case 22:{ // The weight of wages lowers one side of a sober balance.
    const pivot=box(s,940,820,40,180,C),beam=box(s,270,840,1380,22,D);
    move(pivot,{scaleY:0},{scaleY:1},t,.5);move(beam,{rotation:-12},{rotation:8},hit(4),1,'sine.inOut');
    const weight=box(s,1550,692,110,135,C);move(weight,{y:-350,opacity:0},{y:0,opacity:1},hit(7),.4,'power3.in');
    break;
   }
   case 23:{ // The threshold opens as HOME lands; photograph is a single unique scene.
    const jamb=box(s,1157,90,35,900,C),lintel=box(s,1170,90,730,35,D);move(jamb,{scaleY:0},{scaleY:1},t,.5);move(lintel,{scaleX:0},{scaleX:1},hit(3),.7);
    const step=box(s,125,907,1640,24,C);move(step,{scaleX:0},{scaleX:1},hit(7),.4);
    break;
   }
   case 24:{ // Hope is physically cradled, not decorated by another generic ring.
    const cradle=box(s,315,677,1290,238,'transparent',{borderBottom:`48px solid ${C}`,borderLeft:`40px solid ${D}`,borderRight:`40px solid ${D}`,borderRadius:'0 0 170px 170px'});move(cradle,{y:190,scaleX:.6},{y:0,scaleX:1},hit(3),.45);
    break;
   }
   case 25:{ // Claiming bars fail to cross the boundary of the dwelling.
    for(let i=0;i<5;i++){const claw=box(s,60,180+i*150,220,22,D);move(claw,{x:-250},{x:-5},t+i*.025,.18);tl.to(claw,{x:-310,duration:.4,ease:'power3.in'},hit(3));}
    const ground=box(s,225,869,1470,70,C);move(ground,{scaleX:.1},{scaleX:1},hit(4),.3);
    break;
   }
   case 26:{ // Door halves meet along a bright seam and seal behind the lyric.
    const a=box(s,40,90,140,905,D),b=box(s,1740,90,140,905,D);move(a,{x:-180},{x:0},t,.6);move(b,{x:180},{x:0},t,.6);
    const latch=box(s,320,900,1280,25,C);move(latch,{scaleX:0},{scaleX:1},last,.38);
    const seam=box(s,930,0,60,130,C);move(seam,{y:-150},{y:0},last,.4);
    break;
   }
   case 27:{ // The second night has a turning dial whose empty center cannot command us.
    const dial=ring(s,1370,-250,940,85,D);move(dial,{rotation:0},{rotation:65},t,d,'none');
    for(let i=0;i<9;i++){const tick=box(s,1600+i%3*87,80+Math.floor(i/3)*117,28,80,C);move(tick,{opacity:0,y:45},{opacity:.5,y:0},t+i*.045,.35);tl.to(tick,{x:280,opacity:0,duration:.6},hit(6)+(i%3)*.04);}
    const stop=box(s,184,931,1552,28,C);move(stop,{scaleX:0},{scaleX:1},hit(6),.35);
    break;
   }
   case 28:{ // Arrows follow a tangent around a protected center rather than another wall.
    const arc=ring(s,135,100,1650,20,D);arc.style.height='870px';move(arc,{rotation:-10,scale:.9},{rotation:0,scale:1},t,.7);
    for(let i=0;i<5;i++){const a=box(s,-300,85+i*18,340,16,C,{clipPath:'polygon(0 30%,85% 30%,85% 0,100% 50%,85% 100%,85% 70%,0 70%)'});move(a,{x:0,rotation:0},{x:1390,rotation:0},t+i*.16,.6,'power1.in');tl.to(a,{x:2050,y:160+i*20,rotation:24,duration:.7,ease:'power2.out'},t+.6+i*.16);}
    break;
   }
   case 29:{ // Black bindings unravel into two opposed curls at NO POWER.
    for(let i=0;i<6;i++){const strip=box(s,40,75+i*165,1840,26,i%2?D:'#17120e');move(strip,{scaleX:0},{scaleX:1},t+i*.018,.25);tl.to(strip,{x:i%2?1800:-1800,rotation:i%2?14:-14,duration:.55,ease:'power3.in'},hit(3)+i*.035);}
    const axis=box(s,920,910,80,80,C,{borderRadius:'50%'});move(axis,{scale:0},{scale:1},hit(5),.25);
    break;
   }
   case 30:{ // Daylight arrives through a rotating square shutter above and below the words.
    for(let i=0;i<4;i++){const shutter=box(s,i%2?1450:-280,i<2?-250:820,760,340,i%2?D:C);move(shutter,{rotation:i%2?40:-40},{rotation:i%2?12:-12},t,d*.55,'sine.inOut');}
    const line=box(s,220,910,1480,18,P);move(line,{scaleX:0},{scaleX:1},last,.3);
    break;
   }
   case 31:{ // First chorus reprise: a floor of solid plates buckles outwards.
    for(let i=0;i<12;i++){const slab=box(s,35+i*157,820+(i%3)*35,128,190,i%3?D:C);move(slab,{rotationX:70,y:170},{rotationX:0,y:0},t+i*.018,.2);tl.to(slab,{rotation:i<6?-40:40,y:350,duration:.6,ease:'power2.in'},hit(3)+Math.abs(i-6)*.03);}
    break;
   }
   case 32:{ // The right-side ranks peel into deep perspective, multiplying spatial scale.
    for(let i=0;i<16;i++){const rank=box(s,1610+i*18,110,22,900,C);move(rank,{x:400,z:-i*90,opacity:0},{x:0,z:-i*90,opacity:.55},t+i*.013,.3);tl.to(rank,{rotationY:35,x:120+i*18,duration:Math.max(.6,d-.4),ease:'sine.out'},t+.35);}
    break;
   }
   case 33:{ // Low triangular buttresses rise beneath an otherwise open typographic space.
    const a=box(s,0,120,320,960,C,{clipPath:'polygon(0 0,100% 100%,0 100%)'}),b=box(s,1600,120,320,960,D,{clipPath:'polygon(100% 0,100% 100%,0 100%)'});
    move(a,{y:1080},{y:0},hit(1),.42);move(b,{y:1080},{y:0},hit(2),.42);
    const brace=box(s,215,921,1490,37,C);move(brace,{scaleX:0},{scaleX:1},hit(4),.35);
    break;
   }
   case 34:{ // The empty interval becomes a physical moat which harm cannot cross.
    const moat=ring(s,1430,145,830,170,D);move(moat,{scale:.1,opacity:0},{scale:1,opacity:1},hit(2),.45);
    const block=box(s,1745,469,220,165,C);move(block,{x:350},{x:0},t,.55);tl.to(block,{x:150,y:180,rotation:35,duration:.5},hit(3));
    break;
   }
   case 35:{ // A row of dominoes falls in a single measured directional chain.
    for(let i=0;i<15;i++){const dom=box(s,94+i*117,814,40,231,i%2?D:C,{transformOrigin:'50% 100%'});tl.set(dom,{rotation:0},t);tl.to(dom,{rotation:74,duration:.22,ease:'power2.in'},hit(3)+i*.028);}
    break;
   }
   case 36:{ // A missing keystone descends into an arch, establishing trust under load.
    const left=box(s,140,160,160,770,D,{clipPath:'polygon(0 0,100% 20%,100% 100%,0 100%)'}),right=box(s,1620,160,160,770,D,{clipPath:'polygon(0 20%,100% 0,100% 100%,0 100%)'});
    move(left,{x:-220},{x:0},t,.6);move(right,{x:220},{x:0},t,.6);
    for(let i=0;i<7;i++){const arch=box(s,290+i*194,90+Math.abs(i-3)*27,164,70,i===3?C:D);move(arch,{y:i===3?-180:-80,opacity:0},{y:0,opacity:1},t+.2+i*.09,.45);}
    break;
   }
   case 37:{ // Guardian wings support actual steps; photography supplies embodied angels.
    for(let i=0;i<6;i++){const tread=box(s,1350+i*81,947-i*89,150,22,i%2?D:C);move(tread,{x:120,opacity:0},{x:0,opacity:.8},t+i*.19,.7);}
    const wing=box(s,1510,80,280,450,'transparent',{borderLeft:`28px solid ${C}`,borderRadius:'80% 0 0 0'});move(wing,{scaleY:0,rotation:30},{scaleY:1,rotation:0},hit(3),1.1);
    break;
   }
   case 38:{ // The reading order follows three staggered depth stations along the road.
    const road1=box(s,-250,1030,2350,25,D),road2=box(s,980,950,1370,25,C);tl.set(road1,{rotation:-13,transformOrigin:'50% 50%'},t);tl.set(road2,{rotation:-33},t);
    move(road1,{scaleX:.2},{scaleX:1},t,d*.8);move(road2,{scaleX:0},{scaleX:1},hit(3),.8);
    for(let i=0;i<5;i++){const mark=box(s,220+i*290,915-i*23,80,15,P);move(mark,{opacity:0},{opacity:.3},t+i*.13,.3);}
    break;
   }
   case 39:{ // Jagged stone lowers while the complete high phrase gains a small rise.
    for(let i=0;i<9;i++){const stone=box(s,80+i*212,886-i%3*35,190,240,D,{clipPath:'polygon(0 40%,35% 0,60% 24%,83% 8%,100% 70%,100% 100%,0 100%)'});move(stone,{y:170},{y:0},t+i*.035,.5);tl.to(stone,{y:170,duration:1,ease:'sine.inOut'},hit(4));}
    s.nodes.slice(0,4).forEach(n=>tl.to(n,{y:-30,duration:.8,ease:'sine.out'},hit(4)+.25));
    break;
   }
   case 40:{ // Serpentine contours flatten harmlessly beneath a stable baseline.
    for(let i=0;i<6;i++){const coil=ring(s,130+i*305,879+i%2*44,330,32,i%2?C:D);coil.style.height='155px';move(coil,{y:100,rotation:i%2?12:-12},{y:0,rotation:0},t+i*.055,.5);tl.to(coil,{scaleY:.35,y:55,duration:.65},hit(7));}
    const heel=box(s,210,901,1500,23,P);move(heel,{scaleX:0},{scaleX:1},hit(8),.27);
    break;
   }
   case 41:{ // Two heavy barriers release the road; creatures remain photographic.
    const gate=box(s,1210,80,34,850,C),top=box(s,1210,80,690,34,D);move(gate,{rotationY:70,x:180},{rotationY:0,x:0},t,.8);move(top,{scaleX:0},{scaleX:1},t,.65);
    const road=box(s,127,947,1640,18,C);move(road,{scaleX:0},{scaleX:1},hit(6),1);
    tl.to(gate,{x:700,rotationY:70,opacity:0,duration:1.6,ease:'power2.inOut'},last+.5);
    break;
   }
   case 42:{ // Two ends of a tether converge and lock, visualizing held-on rescue.
    const left=box(s,40,210,710,28,C),right=box(s,1170,210,710,28,C),knot=ring(s,893,148,134,29,C);
    move(left,{x:-750},{x:0},t,1.0);move(right,{x:750},{x:0},t,1.0);move(knot,{scale:0},{scale:1},hit(4),.4);
    const lift=box(s,235,893,1450,35,D);move(lift,{y:170},{y:0},hit(8),.7);
    break;
   }
   case 43:{ // Only the second keyhole in the entire film: the name reveals a person.
    const rim=box(s,1132,102,680,832,'transparent',{borderLeft:`16px solid ${C}`,borderRadius:'45% 45% 8% 8%'});move(rim,{scaleY:0,opacity:0},{scaleY:1,opacity:.65},t,1.1,'sine.out');
    const seal=box(s,125,927,1040,26,C);move(seal,{scaleX:0},{scaleX:1},hit(5),.55);
    break;
   }
   case 44:{ // Call creates a single broad echo that resolves at ANSWER.
    const pulse1=ring(s,90,105,800,26,D),pulse2=ring(s,760,472,750,42,C);move(pulse1,{scale:.05,opacity:.8},{scale:1.7,opacity:0},t,1.4,'power1.out');move(pulse2,{scale:1.8,opacity:0},{scale:1,opacity:.32},last,.4);
    const connector=box(s,412,929,1095,20,C);move(connector,{scaleX:0},{scaleX:1},hit(2),.55);
    break;
   }
   case 45:{ // An empty place in a supporting beam is filled: I WILL BE THERE.
    const a=box(s,165,876,575,50,D),b=box(s,1180,876,575,50,D),presence=box(s,740,876,440,50,C);move(a,{scaleX:0},{scaleX:1},t,.4);move(b,{scaleX:0},{scaleX:1},t,.4);move(presence,{y:-310,opacity:0},{y:0,opacity:1},hit(5),.38,'power3.out');
    break;
   }
   case 46:{ // A raising hand is physical support; the type ascends on copper steps.
    for(let i=0;i<5;i++){const step=box(s,1290+i*111,1030-i*133,260,35,i%2?D:C);move(step,{y:230,opacity:0},{y:0,opacity:.8},hit(Math.min(2+i,7)),.35);}
    s.nodes.slice(-2).forEach(n=>tl.to(n,{y:-30,duration:.65,ease:'sine.out'},last+.18));
    break;
   }
   case 47:{ // Days unfold as broad, alternating panels along a continuous horizon.
    for(let i=0;i<9;i++){const day=box(s,67+i*205,922,177,95,i%2?C:D);move(day,{rotationX:90,scaleY:0},{rotationX:0,scaleY:1},t+i*.1,.45);}
    const sight=box(s,135,140,1650,15,D);move(sight,{scaleX:0},{scaleX:1},last,.35);
    break;
   }
   case 48:{ // Five converging solid rays form a receiving, grounded hand-like base.
    for(let i=0;i<5;i++){const finger=box(s,590+i*154,875,72,320,i%2?D:C,{borderRadius:'38px 38px 0 0'});move(finger,{y:330,rotation:(i-2)*11},{y:0,rotation:(i-2)*5},t+i*.055,.5);}
    const palm=box(s,610,1010,695,190,D,{borderRadius:'50%'});move(palm,{y:190},{y:0},hit(4),.5);
    break;
   }
   case 49:{ // The final thousand is a rising wave of ranks collapsing away from center.
    for(let i=0;i<22;i++){const blade=box(s,15+i*88,80+(i%4)*15,36,200+i%3*70,i%3?D:C);move(blade,{scaleY:0},{scaleY:1},t+i*.006,.18);tl.to(blade,{y:i<11?-420:1130,rotation:i<11?-20:20,duration:.8,ease:'power3.in'},hit(3)+Math.abs(i-11)*.019);}
    break;
   }
   case 50:{ // Ten broad horizontal ranks sweep to the right, reading as an army's scale.
    for(let i=0;i<10;i++){const rank=box(s,1550-i*25,65+i*102,430,29,i%2?D:C);move(rank,{x:600,opacity:0},{x:0,opacity:.7},t+i*.025,.28);tl.to(rank,{x:240+i*9,duration:.8,ease:'power1.out'},hit(4));}
    break;
   }
   case 51:{ // The shelter's crown clicks into a broad roof, ending on four bearings.
    for(let i=0;i<7;i++){const tile=box(s,163+i*234,112,201,56,i%2?D:C);move(tile,{y:-250,rotation:(i-3)*11},{y:0,rotation:0},t+i*.035,.4);}
    [[105,165],[1760,165],[105,820],[1760,820]].forEach(([x,y],i)=>{const bearing=box(s,x,y,55,110,C);move(bearing,{scaleY:0},{scaleY:1},hit(2+i),.24);});
    break;
   }
   case 52:{ // A broad horizontal island remains fixed as two currents separate outside it.
    const island=box(s,260,912,1400,50,C,{borderRadius:'50%'});move(island,{scaleX:.1},{scaleX:1},t,.55);
    for(let i=0;i<8;i++){const current=box(s,i%2?1650:-90,50+i*133,360,33,D);move(current,{x:0},{x:i%2?430:-430},t+i*.04,1.2,'power2.in');}
    break;
   }
   case 53:{ // Copper rain is angled and sparse; it parts around the central reading island.
    for(let i=0;i<18;i++){const shard=box(s,i<9?20+i*24:1660+(i-9)*24,-300+(i%6)*42,19,240+i%3*45,i%2?D:C);move(shard,{rotation:17,y:0},{rotation:17,y:1650},t+(i%9)*.055,1.5,'power1.in');}
    break;
   }
   case 54:{ // A broad summit lifts beneath TRUST; the journey resolves at a high horizon.
    const mountain=box(s,-40,750,2000,360,D,{clipPath:'polygon(0 100%,0 80%,22% 60%,43% 28%,52% 0,67% 37%,84% 65%,100% 85%,100% 100%)'});move(mountain,{y:380},{y:0},t,1.4,'power2.out');
    const ridge=box(s,310,934,1300,14,C);move(ridge,{scaleX:0},{scaleX:1},hit(4),1.2);
    break;
   }
   case 55:{ // The final lyrical shelter continues into one continuous dawn shot.
    const threshold=box(s,1110,86,29,910,C);move(threshold,{scaleY:0},{scaleY:1},t,.7);
    const foundation=box(s,115,963,1690,20,D);move(foundation,{scaleX:0},{scaleX:1},t,.9);
    break;
   }
   default:throw new Error('Missing authored scene '+s.num);
  }
 }
 // Hero passages replace the former repeated three-row entrance grammar.
 // The word nodes are the actors: physical drops, opposing barriers, climbing paths,
 // and the camera's changing reading position are all keyed to source vocal cues.
 function heroChoreography(s){
  const heroNames={5:'trust-spanning-word-bridge',7:'descending-word-passage',10:'surrounds-typographic-arch',14:'no-power-word-separation',16:'fall-tier-glyph-drop',18:'shelter-word-roof',21:s.p.performanceRepeatOf?'suspended-trust-sentence':'trust-three-station-camera',28:'arrow-word-projectile',34:'harm-versus-never-barrier',38:'road-word-camera-descent',39:'lifted-phrase-above-stone',42:'held-and-rescue-tether',44:'call-meets-answer',49:'thousand-letter-avalanche',51:'shelter-letter-crown',54:'trust-lyric-ascent'};
  s.heroFamily=heroNames[s.num];s.section.dataset.choreography=s.heroFamily;
  const t=s.start,end=s.end,at=i=>s.words[i].start;
  const normalize=(style)=>style==='serif'?'Elegy':style==='heavy'?'Archivo':'Bebas';
  const row=(ids,x,y,size,style='condensed',max=1500,color=P)=>{
   const family=normalize(style),gapRatio=style==='serif'?.22:style==='heavy'?.23:.18;
   const measure=sz=>{meter.font=`${style==='serif'?'italic ':''}${sz}px ${family}`;return ids.map(i=>meter.measureText(s.words[i].text).width)};
   let widths=measure(size),gap=size*gapRatio,total=widths.reduce((a,b)=>a+b,0)+gap*(ids.length-1);
   if(total>max){size*=max/total;widths=measure(size);gap=size*gapRatio;total=widths.reduce((a,b)=>a+b,0)+gap*(ids.length-1)}
   if(x===null)x=(W-total)/2;
   ids.forEach((i,j)=>{const n=s.nodes[i];n.className=`p91-word ${style}`;Object.assign(n.style,{left:x+'px',top:y+'px',fontSize:size+'px',color});n.dataset.heroLayout='true';x+=widths[j]+gap});
   return ids.map(i=>s.nodes[i]);
  };
  const node=i=>s.nodes[i];
  const go=(target,props,start,d=.5,ease='power3.out')=>{const duration=Math.min(d,end-start-.08);if(duration>.03)tl.to(target,{...props,duration,ease},start)};
  const arrive=(i,from,d=.18,ease='power3.out')=>move(node(i),from,{x:0,y:0,rotation:0,scale:1},at(i),Math.min(d,end-at(i)-.05),ease);
  const beam=(x,y,w,h,color=C)=>box(s,x,y,w,h,color);
  const camera=(poses)=>{for(const p of poses)go(s.camera,p.pose,p.at,p.duration||.6,'sine.inOut')};
  const glyphs=(i)=>{
   const n=node(i),text=s.words[i].text;n.textContent='';
   return Array.from(text).map((letter,j)=>{const g=make('span','p91-letter-actor',n,{display:'inline-block',transformOrigin:'50% 90%'});g.textContent=letter;g.dataset.letterIndex=String(j);return g});
  };
  const arch=(i,peak,start,d=.6)=>{
   const chars=glyphs(i),mid=(chars.length-1)/2;
   chars.forEach((g,j)=>go(g,{y:-peak*(1-Math.pow((j-mid)/(mid||1),2)),rotation:(j-mid)*1.4},start+j*.012,d,'power2.out'));
  };
  switch(s.num){
   case 5:{ // TRUST spans a real gap between two incomplete halves of the sentence.
    row([0,1,2,3,4],null,190,122,'serif');row([5],205,555,112,'serif');row([6],null,417,258,'heavy',1260,C);row([7,8],1280,719,125,'serif',480);
    const l=beam(180,810,650,48,D),r=beam(1090,810,650,48,D),span=beam(820,810,280,48,C);
    move(l,{scaleX:0},{scaleX:1},t,.7);move(r,{scaleX:0},{scaleX:1},at(4),.5);move(span,{y:210,rotation:40},{y:0,rotation:0},at(6),.5);
    arrive(6,{y:-160,rotation:-7,scale:1},.24);go(node(6),{y:50},at(6)+.25,.45,'power2.inOut');
    break;
   }
   case 7:{ // Words occupy a descending route; the camera reads around the obstruction.
    row([0,1,2,3],190,192,126,'serif',1170);row([4,5],645,448,188,'heavy',1110,C);row([6,7,8],1210,763,105,'condensed',550);
    const a=beam(96,453,330,95,D),b=beam(1508,282,330,95,C);
    move(a,{x:610},{x:0},at(3),.62,'power3.inOut');move(b,{x:-730},{x:0},at(3),.62,'power3.inOut');
    arrive(3,{x:-105},.23);arrive(5,{x:180},.25);arrive(8,{y:110},.25);
    camera([{at:t,pose:{x:80,y:80,scale:1.08},duration:.35},{at:at(4),pose:{x:-60,y:-10,scale:1.04},duration:.55},{at:at(6),pose:{x:0,y:0,scale:1},duration:.65}]);
    break;
   }
   case 10:{ // SURROUNDS bends into an actual typographic shelter over ME.
    row([0,1],null,152,123,'serif');row([2],null,365,201,'condensed',1350,C);row([3],null,640,155,'heavy');row([4,5,6],null,885,96,'serif');
    arch(2,75,at(3),.65);
    const shield=box(s,390,263,1140,615,'transparent',{border:`32px solid ${D}`,borderRadius:'48% 48% 18% 18%'});
    move(shield,{scaleX:.4,opacity:0},{scaleX:1,opacity:1},at(2),.7);
    arrive(3,{y:110},.22);go(shield,{borderColor:C},at(6),.4);
    break;
   }
   case 14:{ // The phrase NO POWER visibly tears into opposed sides.
    row([0,1,2],null,180,126,'serif');row([3],300,413,262,'heavy',550,C);row([4],810,413,262,'condensed',910,C);row([5,6],null,781,129,'serif');
    const seam=beam(939,145,42,775,D);move(seam,{scaleY:0},{scaleY:1},t,.55);
    go(node(3),{x:-105},at(4)+.2,.55);go(node(4),{x:105},at(4)+.2,.55);
    go(seam,{scaleX:0},at(4)+.2,.5);
    arrive(3,{x:120},.18);arrive(4,{x:-120},.18);
    break;
   }
   case 16:{ // FALL drops a full tier while the enormous thousand holds its ground.
    row([0,1],null,125,115,'serif');row([2],null,270,230,'condensed',1600,C);row([3],null,542,160,'heavy');row([4,5],null,900,106,'serif');
    const floor=beam(310,1040,1300,25,D);move(floor,{scaleX:0},{scaleX:1},t,.4);
    const chars=glyphs(3);chars.forEach((g,j)=>go(g,{y:119,rotation:(j-1.5)*3},at(3)+.17+j*.038,.42,'power3.in'));
    for(let i=0;i<18;i++){const rank=beam(i<9?90+i*16:1686+(i-9)*16,300,12,450,D);go(rank,{rotation:i<9?-72:72,y:300},at(3)+(i%9)*.02,.65,'power3.in');}
    break;
   }
   case 18:{ // SHELTER is the roof; WILL STAND raises the supporting words into place.
    row([0],263,105,112,'serif');row([1],null,320,272,'heavy',1470,C);row([2,3],null,669,152,'condensed');row([4,5],null,905,112,'serif');
    const a=beam(200,190,55,760,D),b=beam(1665,190,55,760,D);
    move(a,{scaleY:0},{scaleY:1},at(2),.45);move(b,{scaleY:0},{scaleY:1},at(3),.45);
    go(node(1),{y:-125},at(3),.5,'power2.inOut');go(node(0),{y:-10},at(3),.5);
    go([node(2),node(3)],{y:-80},at(4),.4);arrive(5,{y:90},.23);
    break;
   }
   case 21:{
    if(s.p.performanceRepeatOf){ // First trust passage is a suspended sentence bridge.
     row([0],255,451,134,'serif');row([1],465,344,150,'condensed');row([2],750,240,192,'heavy',670,C);row([3],1430,493,120,'serif',350);
     row([4],null,612,177,'condensed');row([5,6],null,865,124,'heavy');
     [0,1,2,3].forEach((i)=>arrive(i,{y:130,rotation:(i-1.5)*7},.3,'power2.out'));
     const cable=box(s,185,367,1560,335,'transparent',{borderBottom:`19px solid ${D}`,borderRadius:'0 0 50% 50%'});move(cable,{scaleX:0},{scaleX:1},t,1.0);
     go([node(0),node(1),node(2),node(3)],{y:40},at(4),.7,'sine.inOut');
    }else{ // Repeated lyric becomes a three-station camera journey, not the same shot.
     row([0,1,2,3],190,178,133,'serif',1200);row([4],635,437,243,'condensed',1080,C);row([5,6],1060,756,171,'heavy',700);
     const rail=beam(80,984,1760,28,D);move(rail,{scaleX:0},{scaleX:1},t,1.8);
     for(let i=0;i<5;i++){const p=beam(210+i*315,920-i*42,76,26,C);move(p,{y:120,opacity:0},{y:0,opacity:1},t+i*.15,.4);}
     camera([{at:t,pose:{x:120,y:95,scale:1.08},duration:.28},{at:at(4),pose:{x:-115,y:20,scale:1.07},duration:.45},{at:at(6),pose:{x:0,y:0,scale:1},duration:.6}]);
     arrive(4,{x:120,y:60},.23);arrive(6,{y:100},.25);
    }
    break;
   }
   case 28:{ // ARROW is itself the projectile; CANNOT RULE becomes its stopping wall.
    row([0,1],210,180,136,'serif',1350);row([2],290,405,190,'condensed',1030,C);row([3,4],900,626,178,'heavy',865);row([5,6],null,871,120,'serif');
    const wall=beam(1450,110,25,425,C);move(wall,{scaleY:0},{scaleY:1},t,.4);
    arrive(2,{x:-210,rotation:-8},.18);go(node(2),{x:125,y:-15,rotation:-1},at(3)+.12,.55,'power2.out');
    const tail=beam(150,505,260,18,D);move(tail,{scaleX:0},{scaleX:1},at(2),.18);go(tail,{x:125,y:-15,rotation:-1,opacity:0},at(3)+.12,.55);
    break;
   }
   case 34:{ // HARM approaches a very large NEVER, collides and withdraws.
    row([0,1,2],140,190,148,'serif',1490);row([3],null,430,300,'heavy',1420,C);row([4,5],1210,833,139,'serif',570);
    arrive(3,{scale:.7,y:75},.23);
    go([node(0),node(1),node(2)],{x:120,y:60},at(2),.3,'power2.in');go([node(0),node(1),node(2)],{x:0,y:-15,rotation:0},at(3),.33,'power3.out');
    const ground=beam(245,788,1430,40,D);move(ground,{scaleX:0},{scaleX:1},at(3),.3);
    break;
   }
   case 38:{ // The sentence is a road with changing baselines and a travelling reader.
    row([0,1,2],200,135,127,'serif',1200);row([3,4],600,372,123,'serif',1100);row([5],895,548,210,'heavy',900,C);row([6],1300,805,162,'condensed',490);
    for(let i=0;i<7;i++){const step=beam(165+i*240,938-i*17,185,24,i%2?D:C);move(step,{scaleX:0},{scaleX:1},t+i*.12,.4);}
    camera([{at:t,pose:{x:105,y:100,scale:1.06},duration:.35},{at:at(3),pose:{x:-95,y:20,scale:1.04},duration:.65},{at:at(6),pose:{x:0,y:0,scale:1},duration:.65}]);
    arrive(5,{y:110},.28);arrive(6,{x:115},.28);
    break;
   }
   case 39:{ // Four words are physically lifted together above a massive stone baseline.
    row([0,1,2,3],null,368,170,'heavy',1550,C);row([4,5],null,621,122,'serif');row([6,7],null,828,169,'condensed');
    for(let i=0;i<9;i++){const rock=box(s,120+i*198,940-i%3*18,180,160,D,{clipPath:'polygon(0 100%,0 40%,28% 3%,55% 36%,85% 0,100% 100%)'});move(rock,{y:130},{y:0},t+i*.025,.5);}
    go(s.nodes.slice(0,4),{y:-180},at(3)+.28,1.05,'power2.inOut');
    go(s.nodes.slice(4,6),{y:-85},at(6),.7,'sine.out');
    const sling=box(s,370,461,1180,175,'transparent',{borderBottom:`22px solid ${C}`,borderRadius:'0 0 50% 50%'});move(sling,{opacity:0,scaleX:.4},{opacity:1,scaleX:1},at(1),.6);go(sling,{y:-180},at(3)+.28,1.05,'power2.inOut');
    break;
   }
   case 42:{ // HELD is a physical tether; RESCUE draws the last phrase upward.
    row([0,1,2],200,171,122,'serif',1450);row([3,4,5,6],null,390,152,'condensed',1430,C);row([7,8],220,745,112,'serif',460);row([9,10],800,724,173,'heavy',980);
    const tether=beam(250,637,1450,19,D);move(tether,{scaleX:0},{scaleX:1},at(3),1.0);
    go(s.nodes.slice(3,7),{y:-75},at(7),.75,'sine.inOut');
    go(s.nodes.slice(7),{y:-105},at(9)+.2,.8,'power2.out');
    arrive(9,{y:115},.24);
    break;
   }
   case 44:{ // CALL moves through the space; ANSWER meets it from the other side.
    row([0],150,235,210,'heavy',800,C);row([1,2,3],null,650,113,'serif');row([4],1260,300,215,'condensed',510);
    const relay=beam(300,575,1370,20,D);move(relay,{scaleX:0},{scaleX:1},t,.55);
    go(node(0),{x:240,y:75},at(1),.45,'power2.inOut');arrive(4,{x:140},.28);
    go(node(4),{x:-105,y:45},at(4)+.3,.4,'power2.out');
    const arrival=ring(s,1350,210,510,22,C);move(arrival,{scale:.2,opacity:0},{scale:1.25,opacity:0},at(4),.6);
    break;
   }
   case 49:{ // Final chorus thousand uses a letter avalanche, not ranks or a preset reprise.
    row([0,1],null,139,120,'serif');row([2],null,337,266,'condensed',1510,C);row([3,4,5],null,844,118,'heavy',1490);
    const chars=glyphs(2);chars.forEach((g,j)=>go(g,{x:(j-(chars.length-1)/2)*9,y:72+((j*7)%3)*25,rotation:0},at(3)+j*.022,.44,'power3.in'));
    const floor=beam(260,1012,1400,25,D);move(floor,{scaleX:0},{scaleX:1},at(3),.5);
    break;
   }
   case 51:{ // SHELTER curves over the complete statement, becoming its crown.
    row([0],260,171,132,'serif');row([1],null,385,250,'condensed',1420,C);row([2,3],null,728,153,'heavy');row([4,5],null,942,98,'serif');
    arch(1,120,at(2),.7);go(node(0),{y:-40},at(3),.5);
    go(s.nodes.slice(2,4),{y:-68},at(4),.45);go(s.nodes.slice(4),{y:-70},at(5)+.13,.35);
    const crown=box(s,205,215,1510,695,'transparent',{borderTop:`25px solid ${D}`,borderLeft:`25px solid ${D}`,borderRight:`25px solid ${D}`,borderRadius:'45% 45% 0 0'});move(crown,{scaleY:.3,opacity:0},{scaleY:1,opacity:1},at(1),.75);
    break;
   }
   case 54:{ // A final ascent: the reader climbs the lyric and returns to a full readable frame.
    row([0,1],205,708,130,'serif',950);row([2,3],650,443,210,'heavy',1150,C);row([4],1220,220,177,'condensed',620);row([5,6],950,775,166,'condensed',800);
    const ridge=box(s,105,954,1710,120,D,{clipPath:'polygon(0 100%,0 90%,20% 60%,45% 0,60% 42%,100% 90%,100% 100%)'});move(ridge,{y:140},{y:0},t,1.3);
    camera([{at:t,pose:{x:120,y:-65,scale:1.08},duration:.5},{at:at(2),pose:{x:0,y:45,scale:1.06},duration:.85},{at:at(4),pose:{x:-95,y:100,scale:1.04},duration:.85},{at:at(6)+.2,pose:{x:0,y:0,scale:1},duration:1.1}]);
    arrive(2,{y:105},.24);arrive(4,{x:130,y:30},.28);go(s.nodes.slice(5),{y:-100},at(6)+.3,.85,'sine.out');
    break;
   }
   default:throw new Error('Hero has no choreography '+s.num);
  }
 }

 function expressiveWords(s){
  const find=text=>{const i=s.words.findIndex(w=>w.text.toLowerCase().replace(/[^a-z]/g,'')===text);return i<0?null:{w:s.words[i],node:s.nodes[i]}};
  const act=(word,props,duration=.45,delay=.17)=>{const target=find(word);if(!target)return;const at=target.w.start+delay;if(at+duration>s.end-.08)return;tl.to(target.node,{...props,duration,ease:'power2.out'},at)};
  // These are semantic actions on the lyric itself. They remain inside the safe reading area.
  if(s.num===3)act('rest',{y:26},.7);
  if(s.num===5)act('trust',{x:27},.6);
  if(s.num===7)act('through',{x:40},.6);
  if(s.num===9)act('still',{y:0,scale:1},1);
  // The unbroken CANNOT COMMAND phrase stays stable; moving one word narrowed its actual gap.
  if(s.num===14||s.num===29){act('no',{x:-24},.35);act('power',{x:24},.35)}
  if([20,35].includes(s.num))act('fall',{y:54,rotation:3},.5);
  if(s.num===17||s.num===32||s.num===50)act('right',{x:36},.45);
  if(s.num===22)act('wages',{y:36},.45);
  if(s.num===24)act('hold',{y:-16},.5);
  if(s.num===28)act('flying',{x:25},.45);
  if(s.num===34)act('never',{scale:1.035},.35);
  if(s.num===38)act('ahead',{x:32},.6);
  if(s.num===39)act('high',{y:-24},.65);
  if(s.num===40)act('beneath',{y:28},.4);
  if(s.num===42)act('rescue',{y:-24},.5);
  if(s.num===44)act('answer',{x:-28},.4);
  if(s.num===47)act('see',{scale:1.035},.6);
  if(s.num===48)act('hand',{y:-18},.5);
  if(s.num===54)act('trust',{y:-22},.6);
 }
 data.phrases.forEach((p,index)=>{const num=Number((p.performanceRepeatOf||p.id).match(/l(\d+)/)[1]);if(num<2||p.start>=data.duration)return;const s=baseScene(p,num,index);if(heroScenes.has(num))heroChoreography(s);else{choreograph(s);expressiveWords(s)}});
 function title(parent,text,x,y,size,style='condensed',color=P){const n=make('div',`p91-word ${style}`,parent,{left:x+'px',top:y+'px',fontSize:size+'px',color,opacity:'1'});n.textContent=text;n.dataset.textRole='song-or-chapter-title';return n}
 function instrumentalScore(scene,start,end){
  if(!scene||start>=data.duration)return;end=Math.min(end,data.duration);
  const space=make('div','p91-instrumental',scene.camera,{position:'absolute',inset:'0',opacity:'0',zIndex:'6',overflow:'hidden',background:'#090909'});
  const refugeArt=data.assets['p91-storm-refuge'];
  const refugeMovie=refugeArt&&document.getElementById('p91-storm-refuge-art');
  space.dataset.sceneId='p91-instrumental-passage';space.dataset.choreography=refugeMovie?'corridor-to-wing-to-storm-refuge':'corridor-to-dust-wing-to-refuge';
  tl.to(scene.type,{opacity:0,duration:.75,ease:'sine.inOut'},start+.2);
  tl.to(space,{opacity:1,duration:.8,ease:'sine.inOut'},start+.5);
  const chamber=make('div','p91-chamber',space,{position:'absolute',inset:'0',perspective:'1400px',transformStyle:'preserve-3d'});
  for(let i=0;i<11;i++){
   const g=make('div','p91-form',chamber,{left:'220px',top:'90px',width:'1480px',height:'900px',border:`${i%3===0?45:21}px solid ${i%2?D:C}`,opacity:String(.30+(i%3)*.12)});
   tl.set(g,{z:-i*390,rotationZ:i%2?2:-2},start);tl.to(g,{z:2350-i*390,rotationZ:0,duration:6.5,ease:'sine.inOut'},start+1.0);tl.to(g,{opacity:0,duration:.6},Number(data.assets['p91-dust-wing']?.start??232)-.05);
  }
  // Reserved independently-rendered five-second transformation, no lyric overlay.
  const art=data.assets['p91-dust-wing'];
  if(art){
   const movie=document.getElementById('p91-dust-wing-art');
   if(movie){const pane=make('div','p91-artsy-wing',space,{position:'absolute',inset:'0',opacity:'0',background:'#070706',zIndex:'7'});pane.appendChild(movie);Object.assign(movie.style,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:'cover'});
    if(art.poster){const poster=make('img','',pane,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:'cover',zIndex:'-1'});poster.src=art.poster;}
    const a=Number(art.start??232),b=a+Number(art.duration??5.1667);tl.to(pane,{opacity:1,duration:.45,ease:'sine.inOut'},a);
    tl.to(pane,{opacity:0,duration:refugeMovie?.45:.6,ease:'sine.inOut'},refugeMovie?Number(refugeArt.start):b-.35);
   }
  }
  if(refugeMovie){
   // A wordless shelter forms against the storm before the sung promise of
   // rescue. Keep this instrumental view clear; no lyric is replaced.
   const pane=make('div','p91-artsy-storm-refuge',space,{position:'absolute',inset:'0',opacity:'0',background:'#070706',zIndex:'8'});
   pane.dataset.sceneId='p91-storm-refuge';pane.dataset.choreography='stone-shelter-against-storm';
   if(refugeArt.poster){const poster=make('img','p91-storm-refuge-poster',pane,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:'cover',zIndex:'0'});poster.src=refugeArt.poster;poster.alt=refugeArt.alt||'The completed shelter held for the return to the lyric';}
   pane.appendChild(refugeMovie);Object.assign(refugeMovie.style,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:'cover',zIndex:'1'});
   tl.to(pane,{opacity:1,duration:.45,ease:'sine.inOut'},Number(refugeArt.start));
   // Last decoded frame holds through the brief camera departure. Fading this
   // whole layer early would reveal the older lion scene underneath the film.
   return;
  }
  const returnLayer=make('div','',space,{position:'absolute',inset:'0',opacity:'0'});tl.to(returnLayer,{opacity:1,duration:.7},237.1);
  const a=title(returnLayer,'A THOUSAND',260,302,223,'condensed'),b=title(returnLayer,'SHALL FALL',390,593,175,'heavy',C);
  move(a,{x:-180,opacity:0},{x:0,opacity:1},237.35,.8);move(b,{y:120,opacity:0},{y:0,opacity:1},238.0,.8);
  const roof=make('div','p91-form',returnLayer,{left:'190px',top:'141px',width:'1540px',height:'740px',border:`32px solid ${D}`});
  move(roof,{scaleX:.45,rotationY:55},{scaleX:1,rotationY:0},237.4,2.1,'power2.inOut');
  tl.to(roof,{scale:1.10,opacity:.2,duration:3.5,ease:'sine.inOut'},240.0);
  tl.to([a,b],{y:-28,duration:3.5,ease:'sine.inOut'},240.0);
  tl.to(returnLayer,{opacity:0,duration:.6},end-.8);tl.to(space,{opacity:0,duration:.65},end-.7);
 }
 function outroScore(scene,start,end){
  if(!scene||start>=data.duration)return;end=Math.min(end,data.duration);
  scene.section.dataset.outro='dawn-panorama-and-typographic-horizon';
  // Release the photo from its narrow reveal into a continuous panorama.
  if(scene.photoMask)tl.to(scene.photoMask,{clipPath:'polygon(0% 0%,100% 0%,100% 100%,0% 100%)',duration:4.2,ease:'sine.inOut'},start+.7);
  tl.to(scene.type,{opacity:0,y:-65,duration:1.0,ease:'sine.inOut'},start+4.2);
  tl.set(scene.nodes,{opacity:0},start+5.2);
  const space=make('div','p91-outro',scene.camera,{position:'absolute',inset:'0',zIndex:'5',opacity:'0',overflow:'hidden',background:'linear-gradient(90deg,#090909ee,#09090993 52%,#09090900)'});
  space.dataset.sceneId='p91-outro-horizon';space.dataset.choreography='dawn-panorama-and-typographic-horizon';tl.to(space,{opacity:1,duration:2},start+3.6);
  // A single chapter title is assembled along an ascending, curved horizon.
  const p=title(space,'PSALM',180,430,258,'condensed',P),n=title(space,'91',990,460,284,'heavy',C);
  const letters=Array.from(p.textContent);p.textContent='';
  const glyphs=letters.map((letter,i)=>{const g=make('span','p91-horizon-letter',p,{display:'inline-block',transformOrigin:'50% 85%'});g.textContent=letter;tl.set(g,{y:220+i*25,rotation:(i-2)*8,opacity:0},0);tl.to(g,{y:-Math.sin(i/4*Math.PI)*52,rotation:0,opacity:1,duration:1.2,ease:'power3.out'},start+5.5+i*.32);return g});
  tl.set(n,{opacity:0,scale:.55},0);tl.to(n,{opacity:1,scale:1,duration:1.3,ease:'power3.out'},start+7.9);
  const strata=make('div','p91-horizon-strata',space,{position:'absolute',inset:'0'});
  // Broad geographic silhouettes rise at different rates, replacing repeated frames/rings.
  for(let i=0;i<5;i++){
   const land=make('div','p91-form',strata,{left:'-40px',top:(899+i*34)+'px',width:'2000px',height:'260px',background:i%2?D:'#21170f',clipPath:`polygon(0 100%,0 ${60-i*4}%,18% ${48+i*3}%,36% ${19+i*5}%,53% ${45-i*3}%,74% ${13+i*5}%,100% ${49-i*2}%,100% 100%)`});
   tl.set(land,{y:220,opacity:0},0);tl.to(land,{y:-i*5,opacity:.52,duration:2.8,ease:'sine.out'},start+10+i*.35);tl.to(land,{x:(i-2)*18,y:-20-i*7,duration:8,ease:'sine.inOut'},start+17);
  }
  const skyline=make('div','p91-form',space,{left:'175px',top:'810px',width:'1380px',height:'8px',background:C});tl.set(skyline,{scaleX:0,transformOrigin:'0% 50%'},0);tl.to(skyline,{scaleX:1,duration:3,ease:'power2.out'},start+10);
  // The whole reading surface rises, then settles on the dawning path rather than repeating a corridor.
  tl.to(p,{y:-62,x:55,scale:.84,duration:4.5,ease:'sine.inOut'},start+14);
  tl.to(n,{y:-55,x:-95,scale:.84,duration:4.5,ease:'sine.inOut'},start+14);
  tl.to(skyline,{y:-35,scaleX:.85,duration:4.5,ease:'sine.inOut'},start+14);
  const horizonGlow=make('div','p91-form',space,{left:'0',top:'810px',width:'1920px',height:'270px',background:'linear-gradient(180deg,transparent,#c7774639)',opacity:'0'});tl.to(horizonGlow,{opacity:.7,duration:6,ease:'sine.inOut'},start+19);
  glyphs.forEach((g,i)=>tl.to(g,{y:0,duration:2.2,ease:'sine.inOut'},start+21+i*.08));
  // End on a resolved image and title, with the soundtrack's natural decay.
  tl.to(space,{opacity:.76,duration:3.2,ease:'sine.inOut'},end-4);
 }
 const bridge=scenes.find(s=>s.num===41);if(bridge)instrumentalScore(bridge,Math.max(223.67,bridge.p.end+.15),data.phrases.find(p=>p.id==='p91-l042').start);
 const final=scenes.find(s=>s.num===55);if(final)outroScore(final,Math.max(293.617,final.p.end+.25),data.duration);
 const first=data.phrases.find(p=>p.id==='p91-l002');if(first)tl.set(document.getElementById('opening'),{opacity:0},first.start);
};
