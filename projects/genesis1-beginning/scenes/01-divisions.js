/* Light, naming, firmament and the arrival of dry land. */
(function(R){
R('good-afterglow',[8],'The judgment resolves motion into rest.','GOOD finds the center of a decelerating enclosing disc.',u=>{
 const i=u.find('good');u.rest(i,{beforeY:145,afterY:835});u.hero(i,{x:540,y:398,size:302,width:1050});u.reveal();
 const disc=u.ring(565,244,725,23,u.C.amber);u.from(disc,{scale:1.4,rotation:30,opacity:0},{scale:1,rotation:0,opacity:.42},u.q(i),1.2);u.to(u.s.nodes[i],{y:-46},u.q(i)+.18,.8);u.draw('M 270 900 Q 960 960 1660 900',{at:u.q(i),duration:1.3,width:13});
});
R('word-incision',[9],'Division creates real negative space.','The two sentence halves move apart around an incised interval.',u=>{
 const i=u.find('between'),cut=u.find('line');u.flow(u.ids(0,i),{x:120,y:175,width:1510,size:122});u.row([i],720,440,157,'heavy',920,u.C.rust);u.flow(u.ids(i+1),{x:920,y:765,width:865,size:123});u.reveal();
 const seam=u.rect(860,320,14,590,u.C.amber);u.scaleIn(seam,'Y',u.q(cut),.55);u.to(u.s.nodes.slice(0,i),{x:-32,y:-18},u.q(i),.55);u.to(u.s.nodes.slice(i+1),{x:35,y:18},u.q(Math.min(i+2,u.N-1)),.65);u.to(seam,{scaleX:.16},u.q(u.N-1)+.12,.6);
});
R('day-horizon-rise',[10],'A name becomes the visible horizon.','DAY rises while its naming sentence follows a broad lower tangent.',u=>{
 const i=u.find('day');u.hero(i,{x:140,y:585,size:300,width:800});u.flow(u.ids(i+1),{x:840,y:240,width:950,size:128,maxLines:3});u.flow(u.ids(0,i),{x:150,y:130,width:1500,size:110});u.reveal();
 u.to(u.s.nodes[i],{y:-255},u.q(i)+.2,1.15,'power2.out');u.draw('M 80 935 Q 910 510 1830 935',{at:u.q(i),duration:1.5,width:24,color:u.C.amber});u.camera({x:-24,y:-12,scale:1.025},u.q(2),1.2);
});
R('night-crescent-fold',[11],'The darker name occupies an enclosing curve.','NIGHT lowers beside an asymmetrical crescent as the sentence turns around it.',u=>{
 const i=u.find('night');u.hero(i,{x:870,y:218,size:295,width:930,color:u.C.bone,font:'condensed'});u.flow(u.ids(i+1),{x:145,y:445,width:650,size:127});u.flow(u.ids(0,i),{x:140,y:155,width:850,size:105});u.reveal();
 const moon=u.ring(1090,110,650,115,u.C.muted);moon.style.borderTopColor='transparent';moon.style.borderLeftColor='transparent';u.from(moon,{rotation:-25,opacity:0},{rotation:22,opacity:.48},u.q(i),1.35);u.to(u.s.nodes[i],{y:170},u.q(i)+.18,1.15);u.draw('M 130 905 C 470 1000 1330 1010 1770 788',{at:u.q(u.N-2),duration:1,width:13});
});
R('first-day-shutter',[12],'Dusk and dawn are successive material boundaries.','Two large words cross shallow opposing planes before the ordinal resolves.',u=>{
 const d=u.find('dusk'),a=u.find('dawn');u.row([d],160,200,235,'heavy',775,u.C.muted);u.row([a],1030,595,225,'condensed',730,u.C.amber);u.flow(u.ids().filter(i=>i!==d&&i!==a),{x:465,y:865,width:1300,size:119,maxLines:1});u.reveal();
 const left=u.rect(100,490,685,32,u.C.muted),right=u.rect(1140,520,670,32,u.C.amber);u.scaleIn(left,'X',u.q(d),.7);u.scaleIn(right,'X',u.q(a),.7);u.to(u.s.nodes[d],{x:60,y:80},u.q(a),.7);u.to(u.s.nodes[a],{x:-60,y:-80},u.q(u.N-1),.7);u.draw('M 765 515 L 1148 515',{at:u.q(u.N-1),duration:.55,width:9});
});
R('firmament-letter-span',[13],'The command stretches a structure across space.','FIRMAMENT lengthens into a beam and the remaining words occupy its open span.',u=>{
 const i=u.find('firmament');u.rest(i,{beforeY:142,afterY:784,size:119});u.hero(i,{x:170,y:390,size:266,width:1590,font:'condensed'});u.reveal();
 u.glyphCurve(i,68,u.q(i)+.18,.95);u.draw('M 130 850 Q 960 145 1800 850',{at:u.q(i),duration:1.25,width:25,color:u.C.rust});u.draw('M 210 948 Q 965 277 1710 948',{at:u.q(i)+.12,duration:1.45,width:7,color:u.C.amber});u.camera({y:24,scale:1.02},u.q(i),1.1);
});
R('water-word-separation',[14],'Water is separated from water.','The actual two WATER words depart vertically from PART into readable opposed levels.',u=>{
 const a=u.find('water',0),b=u.find('water',1,u.N-1),p=u.find('part');u.row([u.find('let')],135,60,105,'serif',700);u.row([u.find('from')],690,785,106,'serif',375);u.row([a],245,260,215,'heavy',940);u.row([p],770,530,167,'serif',790,u.C.amber);u.row([b],1110,730,225,'condensed',720);u.reveal();
 u.to(u.s.nodes[a],{y:-40,x:-30},u.q(p)+.1,.9);u.to(u.s.nodes[b],{y:75,x:25},u.q(b)+.12,.75);u.draw('M 100 550 C 450 475 600 625 920 550 S 1470 475 1820 550',{at:u.q(p),duration:1.1,width:16});
});
R('hold-typographic-clamp',[15],'The command takes material hold.','HOLD joins two opposing brackets; other words remain suspended inside their clearance.',u=>{
 const i=u.find('hold');u.flow(u.ids(0,i),{x:240,y:235,width:1400,size:175,font:'serif'});u.hero(i,{x:530,y:550,size:305,width:1080,font:'condensed'});u.reveal();
 const l=u.path('M 260 190 L 145 190 L 145 898 L 260 898',{width:34,color:u.C.rust}),r=u.path('M 1660 190 L 1775 190 L 1775 898 L 1660 898',{width:34,color:u.C.rust});u.from(l,{x:-160},{x:0},u.q(i),.6);u.from(r,{x:160},{x:0},u.q(i),.6);u.to(u.s.nodes[i],{y:-70},u.q(i)+.16,.65);u.to([l,r],{opacity:.42},u.q(i)+.72,.7);
});
R('raised-span-hinge',[16],'The span becomes an upward-moving structure.','The two final words rise together while earlier words retain a low pivot.',u=>{
 const a=Math.max(0,u.N-2);u.flow(u.ids(0,a),{x:145,y:720,width:780,size:132});u.row(u.ids(a),695,430,240,'condensed',1100,u.C.amber);u.reveal();
 const support=u.draw('M 130 949 L 670 949 Q 800 780 1700 790',{at:u.q(a),duration:1.0,width:32,color:u.C.muted});u.to(u.s.nodes.slice(a),{y:-190,x:30},u.q(a)+.17,1.2);u.to(support,{y:-95},u.q(u.N-1)+.12,1.0);u.camera({y:30,scale:1.025},u.q(a),1.15);
});
R('flood-level-countermotion',[17,18],'The opposed floods occupy different vertical levels.','The location word pulls the complete short phrase toward its physical level.',u=>{
 const above=u.s.words.some(w=>/above/i.test(w.text)),i=u.find(above?'above':'beneath');u.row(u.ids(),above?550:170,above?300:585,195,'condensed',1500,above?u.C.bone:u.C.amber);u.reveal();
 const y=above?620:400;u.draw(`M 80 ${y} Q 640 ${y-55} 1110 ${y+16} T 1840 ${y}`,{at:u.q(i),duration:1.0,width:28,color:u.C.muted});u.to(u.s.nodes,{y:above?-75:75},u.q(i)+.13,.85);for(let j=0;j<3;j++)u.draw(`M 100 ${y+j*55} Q 760 ${y-34+j*55} 1810 ${y+j*55}`,{at:u.q(i)+j*.06,duration:1.3,width:5,color:u.C.rust});
});
R('heaven-vault-resolution',[19,20],'The sky name and its judgment resolve a shared vault.','HEAVEN climbs into a high curved word span; GOOD rests centrally when the shorter verdict arrives.',u=>{
 const isName=u.s.words.some(w=>/heaven/i.test(w.text)),i=u.find(isName?'heaven':'good');u.rest(i,{beforeY:isName?850:165,afterY:870,size:isName?111:125});u.hero(i,{x:isName?385:640,y:isName?435:450,size:isName?298:330,width:isName?1300:1020,font:'condensed',color:isName?u.C.bone:u.C.amber});u.reveal();
 const arch=u.draw('M 130 990 L 130 480 Q 960 -80 1790 480 L 1790 990',{at:u.q(i),duration:1.5,width:24});u.to(arch,{opacity:.38},u.q(i)+.75,.8);if(isName){u.glyphCurve(i,75,u.q(i)+.13,1);u.to(u.s.nodes[i],{y:-110},u.q(i)+.18,1);}else u.to(u.s.nodes[i],{scale:1.055},u.q(i)+.15,1.15,'sine.out');
});
R('second-day-book-fold',[21],'The second boundary closes two halves.','DUSK and DAWN open from two hinged word planes into the second-day reading field.',u=>{
 const d=u.find('dusk'),a=u.find('dawn');u.row([d],190,365,240,'condensed',775,u.C.rust);u.row([a],1050,365,240,'condensed',775,u.C.bone);u.flow(u.ids().filter(i=>i!==d&&i!==a),{x:440,y:760,width:1290,size:133});u.reveal();
 u.from(u.s.nodes[d],{rotationY:24,x:85},{rotationY:0,x:0},u.q(d),.75);u.from(u.s.nodes[a],{rotationY:-24,x:-85},{rotationY:0,x:0},u.q(a),.75);const spine=u.rect(940,180,13,555,u.C.amber);u.scaleIn(spine,'Y',u.q(a),.65);u.to(spine,{scaleY:.2,y:280},u.q(u.N-1),.7);
});
R('waters-confluence',[22],'Distributed waters acquire a common destination.','The sentence follows converging diagonals toward the emphasized ONE PLACE words.',u=>{
 const one=u.find('one'),a=Math.max(0,one);u.flow(u.ids(0,a),{x:130,y:170,width:1600,size:130,maxLines:2});u.row(u.ids(a),995,695,222,'heavy',785,u.C.amber);u.reveal();
 u.to(u.s.nodes.slice(0,a),{x:48,y:100},u.q(a),1.05);u.draw('M 80 390 C 430 435 520 805 975 828',{at:u.q(Math.max(0,a-3)),duration:1.45,width:20});u.draw('M 1820 225 C 1350 400 1700 645 1740 820',{at:u.q(a),duration:1.0,width:10,color:u.C.rust});u.camera({x:-30,y:-12,scale:1.025},u.q(a),1.2);
});
R('ground-emergence',[23,24],'Land clears the moving water field.','GROUND or LAND lifts above separating water planes while the surrounding sentence keeps its route.',u=>{
 const i=u.find(/ground|land/);u.rest(i,{beforeY:150,afterY:770,size:125});u.hero(i,{x:250,y:465,size:300,width:1440,font:'heavy'});u.reveal();u.to(u.s.nodes[i],{y:-116},u.q(i)+.15,1.1);
 const low=u.path('M 80 900 Q 465 814 910 925 T 1850 900',{width:40,color:u.C.muted}),high=u.path('M 80 730 Q 750 650 1830 730',{width:23,color:u.C.rust});u.to(low,{y:105},u.q(i),1.2);u.to(high,{y:-95,opacity:.32},u.q(i),1.2);u.draw('M 180 743 L 1740 743',{at:u.q(i)+.3,duration:1.0,width:11,color:u.C.amber});
});
R('earth-name-foundation',[25],'The name gives the exposed ground weight.','EARTH becomes a solid lower foundation receiving the naming phrase.',u=>{
 const i=u.find('earth');u.flow(u.ids(0,i),{x:220,y:170,width:1430,size:151});u.hero(i,{x:260,y:620,size:330,width:1430,font:'condensed',color:u.C.bone});u.reveal();
 u.to(u.s.nodes.slice(0,i),{y:105},u.q(i),.95);u.from(u.s.nodes[i],{y:70,scaleX:.93},{y:0,scaleX:1},u.q(i),.55);const slab=u.rect(170,947,1570,50,u.C.rust);u.from(slab,{scaleX:.16},{scaleX:1},u.q(i),1.0);u.draw('M 190 1040 L 1730 1040',{at:u.q(i)+.3,duration:1.2,width:8});
});
R('seas-basin-wrap',[26,27],'The waters find a contained basin.','SEAS descends into an open U contour; the following GOOD balances above its rim.',u=>{
 const isSea=u.s.words.some(w=>/seas/i.test(w.text)),i=u.find(isSea?'seas':'good');u.rest(i,{beforeY:155,afterY:850,size:130});u.hero(i,{x:isSea?450:560,y:isSea?430:380,size:300,width:1210,font:'condensed',color:u.C.amber});u.reveal();
 u.draw('M 190 360 C 190 1020 1730 1020 1730 360',{at:u.q(i),duration:1.55,width:29,color:u.C.rust});u.draw('M 290 432 C 290 930 1630 930 1630 432',{at:u.q(i)+.15,duration:1.65,width:8,color:u.C.muted});u.to(u.s.nodes[i],{y:isSea?85:0,scale:isSea?1:.95},u.q(i)+.2,1.05);
});
})(window.G1_REGISTER);
