/* The sung reprise changes mechanism; omitted lyric-sheet verses are not authored. */
(function(R){
 R('humankind-correspondence',[74],'Material comes into identity while the primary words remain active and clear.','The command occupies a high reading plane; HUMANKIND becomes a broad lower monument over the formation footage.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,draw}=h,human=find('humankind');
  flow(ids(0,human),{x:145,y:160,width:1580,size:134,maxLines:2,step:1.2});row([human],140,685,245,'condensed',1640,C.bone);reveal(ids(),{y:20},.08);
  s.reveal(human,{from:{y:60,scaleY:.85},duration:.16});to(s.nodes[human],{y:-95},q(human)+.19,1.15);
  draw('M 130 995 C 500 910 560 925 845 950 S 1470 995 1810 915',{at:q(human),duration:1.4,color:C.rust,width:18});
 });
 R('image-likeness-correspondence',[75],'Correspondence is visible without replacing words with a literal icon.','IMAGE and LIKENESS sit on equal open contours; the shared upper language bridges two distinct upright reading planes.',h=>{
  const {s,C,ids,find,q,row,reveal,to,draw}=h,image=find('image'),likeness=find('likeness');
  row(ids(0,image),150,170,141,'serif',1500);row([image],150,350,262,'condensed',745,C.bone);row(ids(image+1,likeness),1030,290,132,'serif',740);row([likeness],845,675,219,'condensed',935,C.amber);reveal(ids(),{y:25},.09);
  draw('M 155 775 L 155 695 Q 465 605 785 695 L 785 775',{at:q(image),duration:.9,color:C.rust,width:18});draw('M 945 995 L 945 950 Q 1310 905 1740 950 L 1740 995',{at:q(likeness),duration:.8,color:C.rust,width:18});
  to(s.nodes[image],{y:45},q(likeness),.8);to(s.nodes[likeness],{y:-40},q(likeness)+.14,.75);
 });
 R('domain-word-tiers',[76,77],'Separate living territories are joined by a purposeful camera journey.','The camera descends to FISH and arcs to BIRDS; the next verse travels CATTLE → EARTH → CRAWLS before revealing the whole living map.',h=>{
  const {s,C,ids,find,q,row,reveal,to,draw}=h,fish=s.words.some(w=>/^fish/i.test(w.text));
  s.camera.style.transformOrigin='0 0';
  for(const layer of [s.camera,s.back,s.front,s.type])Object.assign(layer.style,{width:'3600px',height:'1500px'});
  s.camera.dataset.layoutAllowOverflow=''; // Explicit traveling world; individual word bounds remain checked.
  const retire=(list,at)=>list.forEach(i=>to(s.nodes[i],{opacity:0},Math.max(at,s.words[i].end+.015),.095,'sine.out'));
  if(fish){
   const f=find('fish'),bird=find('birds'),theFish=f-1,theBird=bird-1;
   row(ids(0,theFish),145,150,159,'serif',1510);row([theFish],400,730,170,'serif',800);row([f],400,980,306,'condensed',945,C.bone);row([theBird],1390,510,167,'serif',680);row([bird],1390,780,264,'condensed',740,C.amber);reveal(ids(),{y:16},.08);
   draw('M 190 420 C 160 740 165 1070 310 1290 Q 855 1450 1280 1040 Q 1320 795 2135 1060',{at:s.start,duration:Math.max(1.5,s.end-s.start-.35),color:C.muted,width:25});
   const waterAt=Math.max(s.start,q(f)-.26),airAt=Math.max(q(f)+.19,Math.min(q(theBird)-.15,q(bird)-.26));
   to(s.camera,{x:-80,y:-520,scale:1},waterAt,.25,'power2.inOut');retire(ids(0,theFish),waterAt);
   to(s.camera,{x:-700,y:-180,scale:1},airAt,.25,'power2.inOut');retire([theFish,f],airAt);
   const overview=q(bird)+.18,len=Math.min(.52,Math.max(.2,s.end-overview-.1));to(s.camera,{x:90,y:45,scale:.69},overview,len,'power2.inOut');s.tl.set(s.nodes,{opacity:1},Math.min(s.end-.045,overview+len));
  }else{
   const earth=find('earth'),crawls=find('crawls'),all=find('all'),and=find('and');
   row(ids(0,all),155,230,253,'condensed',1190);row(ids(all,earth),1270,480,161,'serif',980);row([earth],1230,725,350,'condensed',1100,C.rust);row(ids(and,crawls),2220,680,158,'serif',1060);row([crawls],2290,955,311,'condensed',980,C.bone);reveal(ids(),{x:18},.08);
   draw('M 100 590 L 1120 590 Q 1040 1040 1790 1180 Q 2110 1245 2180 945 L 2180 1380 L 3370 1380',{at:s.start,duration:Math.max(2,s.end-s.start-.8),color:C.muted,width:28});
   const groundAt=Math.max(s.start,q(all)-.13),crawlAt=Math.max(q(earth)+.15,q(and)-.20);
   to(s.camera,{x:-910,y:-360,scale:1},groundAt,.42,'power2.inOut');retire(ids(0,all),groundAt);
   to(s.camera,{x:-1910,y:-600,scale:1},crawlAt,.25,'power2.inOut');retire(ids(all,and),crawlAt);
   // The long sung CRAWLS remains readable while the world expands around it.
   const overview=q(crawls)+.35,len=Math.min(.9,Math.max(.3,s.end-overview-.2));to(s.camera,{x:110,y:70,scale:.49},overview,len,'power2.inOut');s.tl.set(s.nodes,{opacity:1},Math.min(s.end-.045,overview+len));
  }
 });
 R('winged-reprise-fold',[64],'A repeated lyric revisits its meaning through a new spatial action.','The phrase opens from two folded typographic wings; MULTIPLY stays central while the outer banks lift.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,draw}=h,wing=find('winged'),mult=find('multiply');
  row(ids(0,wing),145,95,124,'serif',1400);row([wing],145,375,279,'condensed',1070);row([mult],825,695,220,'condensed',955,C.amber);flow(ids(mult+1),{x:320,y:900,width:1440,size:110,maxLines:1});reveal(ids(),{y:30},.11);
  s.nodes[wing].style.transformOrigin='right bottom';to(s.nodes[wing],{rotation:-3,y:-100},q(mult)+.13,1.0);to(s.nodes[mult],{y:-70},q(mult)+.13,1.0);
  draw('M 125 740 Q 585 775 790 530 M 1030 520 Q 1420 650 1785 390',{at:q(wing),duration:1.4,color:C.rust,width:24});
 });
 R('command-reprise-spine',[69],'A repeated command receives a different physical consequence.','The words form a vertical locking column, with HOLD spanning and sealing its base.',h=>{
  const {s,C,ids,q,row,reveal,to,draw}=h;row([0],145,155,178,'serif',1320);row([1],550,345,230,'condensed',1190,C.bone);row([2],1050,605,194,'serif',670);row([3],700,790,235,'condensed',1070,C.amber);reveal(ids(),{x:28},.10);
  draw('M 140 430 L 435 430 L 435 690 L 955 690 L 955 735',{at:q(0),duration:Math.max(1.2,s.end-s.start-.2),color:C.muted,width:23});to(s.nodes[3],{x:-110,y:-30},q(3)+.14,.65,'power3.out');
 });
 R('animal-reprise-triptych',[70],'The return expands the composition rather than copying its prior branch.','WILD, BEASTS and CATTLE unfold into three heavy typographic panels with clear continuous reading order.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,rect,from}=h,w=find('wild'),beast=find('beasts'),cat=find('cattle');flow(ids(0,w),{x:145,y:150,width:1570,size:136,maxLines:1});row([w],145,375,247,'condensed',675,C.rust);row([beast],750,550,214,'condensed',1030);row([cat],1110,845,159,'heavy',675,C.amber);reveal(ids(),{x:-20},.09);
  [w,beast,cat].forEach((i,k)=>{to(s.nodes[i],{y:-35-k*10},q(i)+.14,.6);const b=rect(145+k*510,730+k*65,370,13,k===1?C.rust:C.muted);from(b,{scaleX:0},{scaleX:1},q(i),.5);});
 });
 R('reptile-reprise-contour',[71],'A living contour remains subordinate to the reading surface.','REPTILES stays huge on a low contour while OF THE GROUND sinks into its own separate basin.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,draw,glyphCurve}=h,r=find('reptiles'),of=find('of');row(ids(0,r),155,150,141,'serif',1420);row([r],175,400,270,'condensed',1570);flow(ids(of),{x:630,y:815,width:1135,size:139,maxLines:1});reveal(ids(),{x:35},.10);glyphCurve(r,-24,q(r)+.13,1.0);to(s.nodes[r],{x:60,y:-35},q(r)+.15,1.0);draw('M 105 780 C 230 625 440 940 715 800 S 1170 795 1350 940 S 1670 965 1815 835',{at:q(r),duration:1.25,color:C.rust,width:20});
 });
 R('kind-reprise-nested-circle',[72],'The repeated kind phrase becomes a stable enclosure.','KIND rests in the center of an open thick circle while the preceding words follow an independent upper tangent.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,ring,from}=h,k=find('kind');flow(ids(0,k),{x:170,y:150,width:1560,size:148,maxLines:1});row([k],660,505,298,'condensed',1050,C.bone);reveal();const r=ring(450,330,940,30,C.rust);r.style.height='595px';r.style.borderTopColor='transparent';from(r,{scale:.6,rotation:-35},{scale:1,rotation:0},q(k),1.1);to(s.nodes[k],{x:-70,y:15},q(k)+.15,.7);
 });
 R('good-reprise-rising-disc',[73],'A revisited completion can change its weight and direction.','GOOD rises against a broad half-disc while its preceding sentence remains an anchored lower baseline.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,ring,from}=h,g=find('good');row([g],530,420,330,'condensed',1080);flow(ids(0,g),{x:170,y:865,width:1550,size:128,maxLines:1});reveal();to(s.nodes[g],{y:-110},q(g)+.15,1.2);const d=ring(410,240,990,40,C.muted);d.style.borderLeftColor='transparent';d.style.borderRightColor='transparent';d.style.borderBottomColor='transparent';from(d,{y:140,rotation:-15},{y:0,rotation:0},q(g),1.25);
 });
 R('humankind-reprise-monument',[74],'The final return resolves material formation into a stable readable identity.','The command walks down three rising shelves; HUMANKIND fills the final lower plane and settles as one monolithic word.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,draw}=h,human=find('humankind');row(ids(0,3),145,135,138,'serif',1550);row(ids(3,human),620,420,183,'condensed',1140,C.amber);row([human],145,760,249,'condensed',1640,C.bone);reveal(ids(),{y:18},.08);s.reveal(human,{from:{x:-45,scaleX:.92},duration:.16});to(s.nodes[human],{y:-80},q(human)+.18,1.0);
  draw('M 110 330 L 470 330 L 470 685 L 1830 685',{at:q(0),duration:Math.max(1.1,s.end-s.start-.1),color:C.muted,width:21});
 });
 R('likeness-reprise-facing-planes',[75],'An echo is a relationship, not a duplicated word image.','IMAGE and LIKENESS face one another on separate planes, then align into a common horizontal reading field.',h=>{
  const {s,C,ids,find,q,row,reveal,to,draw}=h,image=find('image'),like=find('likeness');row(ids(0,image),145,150,142,'serif',1490);row([image],145,395,267,'condensed',800,C.bone);row(ids(image+1,like),1040,255,135,'serif',745);row([like],835,625,214,'condensed',955,C.amber);reveal(ids(),{x:25},.09);to(s.nodes[image],{y:80,x:25},q(like),.8);to(s.nodes[like],{y:-95},q(like)+.14,.8);draw('M 150 865 L 1765 865 M 980 780 L 980 950',{at:q(image),duration:1.15,color:C.rust,width:18});
 });
})(window.G1_REGISTER);
