/* Living forms: water displacement, wings, footfalls, branching kinds. */
(function(R){
 R('living-water-wake',[54],'Emergence is clearer when the material progressively acquires direction.','SWARM stretches the phrase into a widening wake; LIVING REPTILES holds on a broad lower bank.',h=>{
  const {s,C,ids,find,q,row,reveal,to,draw,glyphCurve}=h,sw=find('swarm'),living=find('living');
  row(ids(0,sw),150,160,181,'serif',1550);row([sw],440,370,279,'condensed',1240,C.rust);row(ids(sw+1,living),160,785,135,'serif',570);row(ids(living),705,745,175,'condensed',1090);
  reveal(ids(),{x:-30},.10);glyphCurve(sw,45,q(sw)+.16,1.0);to(s.nodes[sw],{x:75,y:35},q(sw)+.16,1.25);
  draw('M 100 470 Q 230 600 465 655 Q 1160 820 1830 640',{at:q(sw),duration:1.6,color:C.muted,width:18});draw('M 100 575 Q 560 1000 1830 940',{at:q(sw)+.12,duration:1.65,color:C.rust,width:7});
 });
 R('winged-word-updraft',[55,56],'A coherent material can move upward without obscuring the lyric.','WINGED CREATURES opens into a rising plane led by FLY; the continuation resolves into a high vault.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,draw,camera}=h,fly=s.words.some(w=>/^fly/i.test(w.text));
  if(fly){const f=find('fly');row(ids(0,f),140,545,203,'condensed',1660);row([f],1200,235,244,'heavy',560,C.amber);flow(ids(f+1),{x:535,y:830,width:1230,size:126,maxLines:1});reveal(ids(),{y:50},.12);to(s.nodes.slice(0,f),{y:-155},q(f)+.16,1.15);to(s.nodes[f],{y:-60,x:30},q(f)+.16,1.1);draw('M 90 875 Q 750 735 900 240 Q 1150 715 1840 730',{at:q(f),duration:1.5,color:C.muted,width:18});camera({x:0,y:-20,scale:1.012},q(f),1.0);}
  else{row(ids(),170,415,194,'condensed',1560);reveal(ids(),{y:80},.15);to(s.type,{y:-120},q(0)+.2,1.2);draw('M 180 880 C 350 350 1450 160 1760 815',{at:s.start,duration:1.7,color:C.rust,width:17});}
 });
 R('whale-word-displacement',[57,58],'Weight is conveyed through displaced surroundings and slower motion.','The command lowers the waterline; GREAT WHALES moves as one massive plane while the wake rises around it.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,draw}=h,whales=s.words.some(w=>/whales/i.test(w.text));
  if(whales){const great=find('great');flow(ids(0,great),{x:145,y:150,width:1590,size:138,maxLines:1});row(ids(great),190,510,256,'condensed',1580,C.bone);reveal(ids(),{y:-30},.12);to(s.nodes.slice(great),{y:100,x:25},q(great)+.17,Math.max(1.1,s.end-s.start-.35));draw('M 110 720 Q 340 260 790 300 Q 1390 315 1830 595',{at:q(great),duration:1.65,color:C.muted,width:24});draw('M 105 985 Q 950 825 1810 980',{at:q(great)+.15,duration:1.7,color:C.rust,width:9});}
  else{row(ids(),175,470,204,'serif',1560);reveal(ids(),{y:-40},.12);to(s.type,{y:95},q(3)+.1,.8);draw('M 70 765 Q 955 595 1850 765',{at:s.start,duration:1.5,color:C.rust,width:20});}
 });
 R('reptile-winged-stroke-change',[59,60],'Related material can articulate into different anatomical rhythms.','WATER-REPTILE follows a low articulated line; WINGED CREATURE rises from its center on the next phrase.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,draw}=h,winged=s.words.some(w=>/^winged/i.test(w.text));
  const key=find(winged?'winged':'water-reptile'),kind=find('kind');flow(ids(0,key),{x:145,y:150,width:1570,size:135,maxLines:1});row(ids(key,kind),165,winged?420:585,217,'condensed',1600,C.bone);row([kind],1250,810,160,'heavy',520,C.amber);reveal(ids(),{y:30},.1);
  if(winged){to(s.nodes.slice(key,kind),{y:-105},q(key)+.15,1.1);draw('M 125 855 Q 620 870 965 545 Q 1310 900 1800 760',{at:q(key),duration:1.3,color:C.rust,width:22});}
  else{to(s.nodes.slice(key,kind),{x:65,y:-35},q(key)+.15,1.1);draw('M 80 875 Q 390 710 660 875 T 1220 875 T 1815 875',{at:q(key),duration:1.55,color:C.muted,width:20});}
 });
 R('blessing-word-resonance',[61,62],'A held focal word gives the next expansion somewhere to begin.','GOOD rests at the center; BLESSING, RANG, OUT open into three distinct resonance stations.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,ring,from}=h,good=s.words.some(w=>/good/i.test(w.text));
  if(good){const g=find('good');row([g],400,320,347,'condensed',1150);flow(ids(0,g),{x:180,y:800,width:1540,size:137,maxLines:1});reveal();const r=ring(340,135,885,9,C.muted);from(r,{scale:.72,opacity:0},{scale:1,opacity:.6},q(g),1.6);to(s.nodes[g],{y:45},q(g)+.15,1.0);}
  else{const b=find('blessing'),r=find('rang'),out=find('out');row(ids(0,b),155,155,139,'serif',1500);row([b],155,325,230,'condensed',1540,C.bone);row([r],550,645,199,'heavy',630,C.rust);row([out],1390,790,146,'heavy',400,C.amber);reveal(ids(),{x:-45},.12);to(s.nodes[b],{x:55},q(r),.8);to(s.nodes[r],{x:70},q(out),.7);[450,790,1130].forEach((d,k)=>{const ringEl=ring(1000-d/2,545-d/2,d,6,C.muted);from(ringEl,{scale:.85,opacity:0},{scale:1,opacity:.3},q(b)+k*.18,1.2);});}
 });
 R('population-expansion',[63,64],'Multiplicity is a growing spatial relationship, never duplicated lyrics.','INCREASE and MULTIPLY expand along separate radial axes; FILL resolves across a wider bank.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,draw,ring,from}=h,inc=s.words.some(w=>/^increase/i.test(w.text));
  if(inc){const mult=find('multiply'),fill=find('fill');row([0],155,165,245,'condensed',1410,C.bone);row([mult],600,490,235,'condensed',1165,C.rust);row(ids(fill),320,825,148,'heavy',1460,C.bone);reveal(ids(),{y:18},.09);to(s.nodes[0],{x:60,y:20},q(mult),.85);to(s.nodes[mult],{x:-100,y:-30},q(fill),.85);const r=ring(270,225,1010,15,C.muted);r.style.borderTopColor='transparent';from(r,{scale:.55,rotation:-45},{scale:1,rotation:20},s.start,s.end-s.start-.1);}
  else{const wing=find('winged'),mult=find('multiply');flow(ids(0,wing),{x:155,y:100,width:1520,size:125,maxLines:1});row(ids(wing,mult),175,360,265,'condensed',1550,C.bone);row(ids(mult),660,760,178,'condensed',1110,C.amber);reveal(ids(),{y:45},.12);to(s.nodes.slice(wing,mult),{y:-65,x:65},q(mult),.9);draw('M 110 960 Q 660 935 950 650 Q 1260 915 1810 915',{at:q(mult),duration:1.35,color:C.rust,width:17});}
 });
 R('fifth-day-tidal-crossover',[65],'The day counter resolves the preceding material vocabulary.','DUSK and DAWN occupy crossing wave heights, with the ordinal held safely between them.',h=>{
  const {s,C,ids,find,q,row,reveal,to,draw}=h,dawn=find('dawn');row([0],170,230,280,'condensed',710);row([dawn],1130,650,239,'condensed',660,C.amber);row(ids(dawn+1),550,900,103,'serif',1120);reveal();to(s.nodes[0],{y:105},q(dawn),1.0);to(s.nodes[dawn],{y:-130},q(dawn)+.12,1.0);draw('M 90 830 Q 390 600 810 700 T 1820 780',{at:s.start,duration:1.4,color:C.rust,width:17});draw('M 100 210 Q 680 95 1100 235 T 1800 200',{at:q(dawn),duration:1.1,color:C.muted,width:10});
 });
 R('earth-word-aperture',[66],'The place of emergence is constructed by the reading plane.','EARTH opens a low gate; BRING OUT and LIVING KINDS advance through the space it establishes.',h=>{
  const {s,C,ids,find,q,row,reveal,to,draw}=h,bring=find('bring'),living=find('living');row([0],140,185,304,'condensed',1540,C.rust);row(ids(bring,living),595,545,197,'heavy',1150);row(ids(living),820,830,139,'serif',950);reveal(ids(),{y:35},.11);to(s.nodes[0],{y:-55},q(bring)+.13,.8);to(s.nodes.slice(bring,living),{x:-105},q(living),.85);draw('M 155 835 L 155 525 L 1735 525 L 1735 985',{at:q(bring),duration:1.1,color:C.muted,width:24});
 });
 R('footfall-and-ground-crawl',[67],'Distinct body rhythms change the phrase geometry.','FOUR-FOOTED BEASTS lands on four heavy contacts; CRAWLING REPTILES takes a separate lower articulated track.',h=>{
  const {s,C,ids,find,q,row,reveal,to,rect,from,draw}=h,crawl=find('crawling');row(ids(0,crawl),150,280,204,'condensed',1620);row(ids(crawl),545,755,184,'condensed',1230,C.amber);reveal(ids(),{y:-45},.13);to(s.nodes.slice(0,crawl),{y:75},q(Math.max(0,crawl-1))+.14,.5,'power4.out');[250,580,925,1280].forEach((x,k)=>{const p=rect(x,625,100,25,C.rust);from(p,{scaleX:0},{scaleX:1},s.beat(q(Math.min(k,h.N-1))),.35);});draw('M 360 1010 Q 735 860 1015 980 T 1790 935',{at:q(crawl),duration:1.25,color:C.muted,width:15});
 });
 R('wild-kind-breakout',[68,69],'A living mass expands and then finds a meaningful boundary.','WILD BEASTS spreads away from a narrow origin; the command clamps the resulting field into place.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,rect,from,draw}=h,wild=s.words.some(w=>/^wild/i.test(w.text));
  if(wild){const each=find('each');row(ids(0,each),140,265,268,'condensed',1610,C.bone);flow(ids(each),{x:650,y:760,width:1110,size:147,maxLines:1});reveal(ids(),{x:-35},.10);to(s.nodes[0],{x:25,y:-65},q(1)+.1,.8);to(s.nodes[1],{x:100,y:70},q(1)+.1,.9);draw('M 150 600 L 670 600 L 670 650 L 1790 650',{at:q(1),duration:1.1,color:C.muted,width:22});}
  else{row(ids(),220,435,203,'serif',1490);reveal(ids(),{x:-70},.14);const l=rect(140,320,25,450,C.rust),r=rect(1755,320,25,450,C.rust);from(l,{x:-90},{x:0},q(3),.6);from(r,{x:90},{x:0},q(3),.6);to(s.type,{y:60},q(3)+.1,.65);}
 });
 R('living-kind-branch-map',[70,71,72],'Different creatures inhabit connected but non-overlapping reading territories.','BEASTS, CATTLE and REPTILES branch from a shared ground path; KIND closes its junction.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,draw}=h,cattle=s.words.some(w=>/cattle/i.test(w.text)),reptile=s.words.some(w=>/reptiles/i.test(w.text));
  if(cattle){const wild=find('wild'),cat=find('cattle');flow(ids(0,wild),{x:155,y:160,width:1540,size:139,maxLines:1});row(ids(wild,cat),160,390,231,'condensed',1430);row([cat],1120,765,206,'condensed',650,C.amber);reveal();draw('M 170 970 L 170 715 L 1020 715 L 1020 970 L 1750 970',{at:q(wild),duration:1.4,color:C.rust,width:18});to(s.nodes[cat],{y:-40},q(cat)+.14,.8);}
  else if(reptile){const r=find('reptiles');flow(ids(0,r),{x:155,y:150,width:1540,size:135,maxLines:1});row([r],170,480,272,'condensed',1590);row(ids(r+1),880,830,135,'serif',865);reveal(ids(),{x:45},.11);to(s.nodes[r],{x:55,y:-45},q(r)+.15,1.0);draw('M 105 810 Q 615 600 910 775 T 1810 790',{at:q(r),duration:1.35,color:C.muted,width:16});}
  else{row(ids(),205,430,205,'serif',1510);reveal(ids(),{y:25},.1);draw('M 190 810 L 955 810 L 955 1000 M 955 810 L 1755 810',{at:s.start,duration:1.3,color:C.rust,width:20});to(s.type,{y:65},q(h.N-1)+.14,.7);}
 });
 R('good-weighted-equilibrium',[73],'Completion can be carried by weight rather than spectacle.','GOOD settles between unequal thick arcs, with the preceding words held on an independent upper ledge.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,draw}=h,g=find('good');flow(ids(0,g),{x:145,y:175,width:1610,size:137,maxLines:1});row([g],545,520,319,'condensed',1060);reveal(ids(),{y:18},.08);to(s.nodes[g],{y:-80},q(g)+.15,1.1);draw('M 135 575 Q 135 980 810 975',{at:s.start,duration:1.4,color:C.rust,width:34});draw('M 1790 180 Q 1790 690 1600 810',{at:q(g),duration:1.2,color:C.muted,width:17});
 });
})(window.G1_REGISTER);
