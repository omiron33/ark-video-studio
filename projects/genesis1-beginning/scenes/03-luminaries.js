/* The lights establish an ordered, readable spatial system. */
(function(R){
 R('lights-suspended-points',[39],'A material world can suspend type without making it microscopic.','LIGHTS hangs from a broad arc; the remaining phrase descends through two widely separated hanging points.',h=>{
  const {s,C,ids,find,q,row,reveal,to,draw,ring,from}=h,l=find('lights');
  row([l],170,205,323,'condensed',1170,C.bone);row(ids(l+1),605,655,170,'serif',1150);reveal(ids(),{y:-60},.15);
  draw('M 140 140 Q 1035 80 1740 520',{at:q(l),duration:1.4,color:C.muted,width:15});
  [285,850,1600].forEach((x,k)=>{const r=ring(x,95+k*90,24,7,C.amber);from(r,{scale:0},{scale:1},q(Math.min(k,h.N-1)),.5);});
  to(s.nodes[l],{y:55,x:45},q(l)+.2,1.2);to(s.type,{rotation:-1.2,transformOrigin:'960px 450px'},q(1)+.18,1.1);
 });
 R('day-night-counterweight',[40],'The relationship between words carries the explanation.','DIVIDE is a vertical fulcrum; DAY rises as NIGHT descends on an unequal diagonal.',h=>{
  const {s,C,ids,find,q,row,reveal,to,draw}=h,d=find('day'),n=find('night'),f=find('from');
  row([0],140,130,162,'serif',1550,C.bone);row([d],175,430,315,'condensed',625,C.amber);row([f],860,505,106,'serif',330);row([n],1175,430,288,'condensed',610,C.bone);reveal(ids(),{y:25},.09);
  to(s.nodes[d],{y:-100},q(n)+.13,.95);to(s.nodes[n],{y:135},q(n)+.13,.95);
  draw('M 220 855 L 1640 740 M 940 770 L 1050 980 L 850 980 Z',{at:q(d),duration:1.15,color:C.muted,width:12});
 });
 R('time-scale-word-journey',[41],'The camera connects meaningful stations in a world larger than the frame.','A 1,710px camera journey follows SIGNS → SEASONS → DAYS → YEARS, then opens into a complete readable overview.',h=>{
  const {s,C,ids,find,q,row,reveal,to,draw}=h,sg=find('signs'),se=find('seasons'),dy=find('days'),yr=find('years');
  s.camera.style.transformOrigin='0 0';
  for(const layer of [s.camera,s.back,s.front,s.type])Object.assign(layer.style,{width:'3600px',height:'1500px'});
  s.camera.dataset.layoutAllowOverflow=''; // Explicit traveling world; individual word bounds remain checked.
  row(ids(0,sg),160,160,186,'serif',1480);row([sg],160,390,276,'condensed',750);row([se],1060,435,205,'heavy',750,C.rust);row(ids(se+1,yr),1890,370,270,'condensed',770);row([yr],2770,600,298,'condensed',690,C.amber);
  reveal(ids(),{y:18},.08);
  draw('M 140 800 L 970 800 L 970 850 L 1815 850 L 1815 730 L 2660 730 L 2660 990 L 3510 990',{at:q(sg),duration:Math.max(1,s.end-s.start-.25),color:C.muted,width:18});
  const retire=(list,at)=>list.forEach(i=>to(s.nodes[i],{opacity:0},Math.max(at,s.words[i].end+.015),.10,'sine.out'));
  // Each incoming station is already inside the previous view at its vocal cue.
  to(s.camera,{x:-785,y:-45,scale:1},q(se),Math.min(.52,Math.max(.2,q(dy)-q(se)-.12)),'power2.inOut');retire(ids(0,se),q(se));
  to(s.camera,{x:-1710,y:-130,scale:1},q(dy),Math.min(.40,Math.max(.2,q(yr)-q(dy)-.1)),'power2.inOut');retire([se],q(dy));
  const overview=q(yr),length=Math.min(.38,Math.max(.2,s.end-overview-.10));
  to(s.camera,{x:85,y:110,scale:.50},overview,length,'power2.inOut');
  s.tl.set(s.nodes,{opacity:1},Math.min(s.end-.045,overview+length));
 });
 R('shine-downward-cascade',[42,43],'Direction belongs to the word plane itself.','SHINE advances down a large diagonal toward EARTH; the next command closes the ray into a grounded joint.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,draw,rect,from}=h,shine=s.words.some(w=>/shine/i.test(w.text));
  if(shine){
   const sh=find('shine'),earth=find('earth');flow(ids(0,sh),{x:155,y:140,width:1575,size:133,maxLines:1});row([sh],365,330,275,'condensed',1040,C.amber);row(ids(sh+1,earth),1120,465,123,'serif',635);row([earth],1050,780,174,'heavy',740,C.bone);
   reveal(ids(),{y:-25},.11);to(s.nodes[sh],{x:135,y:145},q(sh)+.18,1.15);
   draw('M 150 350 L 300 925 M 795 270 L 1010 720 M 1580 250 L 1765 805',{at:q(sh),duration:1.4,color:C.muted,width:14});
  }else{
   row(ids(),190,435,202,'serif',1535);reveal(ids(),{y:-70},.14);to(s.type,{y:65},q(h.N-1)+.1,.7);
   const b=rect(160,860,1600,25,C.amber);from(b,{scaleX:0},{scaleX:1},q(h.N-1),.75);
   draw('M 960 100 L 960 325 M 910 325 L 1010 325',{at:s.start,duration:.8,color:C.muted,width:9});
  }
 });
 R('paired-luminary-scales',[44,45,46],'Physical scale carries an explicit comparison.','TWO introduces paired orbits, then GREATER and LESSER take different diameter word fields without shrinking the reading type.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,ring,from}=h;
  const greater=s.words.some(w=>/greater/i.test(w.text)),lesser=s.words.some(w=>/lesser/i.test(w.text));
  if(!greater&&!lesser){
   row(ids(0,2),160,180,240,'condensed',1590,C.bone);row(ids(2),630,705,166,'serif',1150);reveal(ids(),{x:-25},.11);
   const a=ring(175,450,460,24,C.rust),b=ring(1080,245,230,16,C.amber);from(a,{scale:.5},{scale:1},q(0),1.3);from(b,{y:180},{y:0},q(2),1.2);to(s.type,{x:40},q(2)+.15,1.0);
  }else{
   const key=find(greater?'greater':'lesser'),last=h.N-1;
   row(ids(0,key),140,145,125,'serif',1400);row([key],greater?140:650,345,greater?272:247,'condensed',greater?1500:1070,C.amber);flow(ids(key+1,last),{x:greater?400:140,y:745,width:1050,size:127,maxLines:1});row([last],greater?1355:1250,785,168,'condensed',470);
   reveal(ids(),{y:25},.09);const r=ring(greater?180:875,greater?-175:110,greater?1270:745,greater?34:19,C.muted);r.dataset.layoutAllowOverflow='';from(r,{rotation:0,scale:.86},{rotation:55,scale:1},q(key),Math.max(.8,s.end-s.start-.1));r.style.borderRightColor=C.rust;r.style.borderTopColor='transparent';
   to(s.nodes[key],{x:greater?60:-85,y:greater?-35:60},q(key)+.2,1.25);
  }
 });
 R('star-letter-constellation',[47],'Tiny image material stays distinct from readable primary type.','STARS separates its large letters into a constellation, then returns to a complete word while the supporting phrase stays still.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,draw}=h,star=find('stars');
  flow(ids(0,star),{x:170,y:180,width:1550,size:139,maxLines:1});row([star],380,395,330,'condensed',1180,C.bone);row(ids(star+1),1080,805,130,'serif',690);reveal(ids(),{y:18},.1);
  const gs=s.glyphs(star);gs.forEach((g,i)=>{const offset=(i-(gs.length-1)/2)*23;to(g,{x:offset,y:i%2?-70:35},q(star)+.18,.75);to(g,{x:0,y:0},Math.max(q(star)+1,s.end-.7),.6);});
  draw('M 205 740 L 570 710 L 875 275 L 1240 640 L 1650 230',{at:q(star),duration:1.35,color:C.muted,width:3});
  [205,570,875,1240,1650].forEach((x,k)=>{const y=[740,710,275,640,230][k];const r=s.ring(s.back,x-8,y-8,16,5,C.amber);h.show(r,q(star)+k*.09,.3);});
 });
 R('heaven-to-earth-rays',[48,49],'A repeated material changes its spatial function with the lyric.','The first phrase hangs on an upper rail; the next phrase descends in three broad angled reading steps.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,draw}=h,earth=s.words.some(w=>/^earth/i.test(w.text));
  if(!earth){
   const heaven=find('heavens');row(ids(0,heaven),155,190,165,'serif',1570);row(ids(heaven),650,565,219,'condensed',1110,C.bone);reveal(ids(),{y:-40},.13);
   draw('M 115 850 Q 700 900 1815 310',{at:s.start,duration:1.5,color:C.rust,width:19});to(s.type,{y:55},q(heaven)+.13,1.0);
  }else{
   const light=find('light'),e=find('earth');row(ids(0,light),160,165,148,'serif',1430);row(ids(light,e),490,475,188,'condensed',1230,C.amber);row([e],1110,805,196,'heavy',680,C.bone);reveal(ids(),{y:-22},.09);
   to(s.nodes[light],{y:55},q(light)+.15,.75);draw('M 180 400 L 380 885 M 1230 300 L 1405 715',{at:q(light),duration:1.3,color:C.muted,width:15});
  }
 });
 R('bright-dark-gates',[50,51],'Separation can be shown through spatially held type.','NIGHT and DAY cross on parallel lanes; BRIGHT and DARK are held apart by two heavy gates.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,rect,from}=h,bright=s.words.some(w=>/^bright/i.test(w.text));
  if(!bright){
   const night=find('night'),day=find('day');row(ids(0,night),135,150,137,'serif',1450);row([night],185,365,292,'condensed',1190);row(ids(night+1,day),975,510,133,'serif',530);row([day],1280,715,206,'heavy',520,C.amber);reveal(ids(),{x:-30},.10);to(s.nodes[night],{x:100,y:50},q(day),.9);to(s.nodes[day],{x:-160},q(day)+.14,.9);
  }else{
   const b=find('bright'),d=find('dark');row(ids(0,b),145,160,132,'serif',1480);row([b],160,435,260,'condensed',775,C.amber);row(ids(b+1,d),935,760,128,'serif',730);row([d],1200,315,265,'condensed',605,C.bone);reveal(ids(),{x:30},.10);
   const a=rect(995,280,28,480,C.rust),z=rect(1050,310,13,510,C.muted);from(a,{scaleY:0},{scaleY:1},q(b),.8);from(z,{scaleY:0},{scaleY:1},q(d),.7);to(s.nodes[b],{x:-35},q(d)+.1,.7);to(s.nodes[d],{x:35},q(d)+.1,.7);
  }
 });
 R('fourth-day-orbital-roll',[52,53],'The day boundary resolves the preceding orbit system.','GOOD becomes the center of an open ellipse; DUSK and DAWN travel along its broad near and far sides.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,ring,from}=h;
  if(s.words.some(w=>/good/i.test(w.text))){const g=find('good');row([g],510,350,335,'condensed',1030);flow(ids(0,g),{x:165,y:795,width:1540,size:134,maxLines:1});reveal();const r=ring(190,155,1420,13,C.muted);r.style.height='655px';from(r,{rotation:-12,scale:.8},{rotation:12,scale:1},s.start,s.end-s.start-.1);to(s.nodes[g],{y:45},q(g)+.15,.9);}
  else{const dawn=find('dawn');row([0],150,260,267,'condensed',730,C.bone);row([dawn],1190,675,221,'heavy',565,C.amber);row(ids(dawn+1),535,915,100,'serif',1200);reveal();to(s.nodes[0],{x:110,y:85},q(dawn),1.0);to(s.nodes[dawn],{x:-110,y:-85},q(dawn)+.12,1.0);const r=ring(220,170,1450,18,C.muted);r.style.height='650px';r.style.borderLeftColor='transparent';from(r,{rotation:12},{rotation:-16},s.start,s.end-s.start-.1);}
 });
})(window.G1_REGISTER);
