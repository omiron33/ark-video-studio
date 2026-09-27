/* Plants: growth belongs to the words, not a decorative preset. */
(function(R){
 R('seed-grass-sprouting',[28,29],'Common material acquires a living structure.','Successive words rise from separate soil slots; the kind phrase locks their root spacing.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,draw,rect,from}=h;
  const grass=s.words.some(w=>/grass/i.test(w.text));
  if(grass){
   const g=find('grass'),seed=find('seed-bearing'),prefix=ids(0,seed);
   flow(prefix,{x:160,y:155,width:1590,size:143,maxLines:1});
   row([seed],150,475,211,'condensed',1050,C.bone);row([g],1170,555,257,'condensed',630,C.amber);
   prefix.forEach(i=>s.reveal(i,{from:{y:30},duration:.13}));
   s.reveal(seed,{from:{y:130,scaleY:.58},duration:.16});s.reveal(g,{from:{y:130,scaleY:.55},duration:.16});
   to(s.nodes[seed],{y:-65},q(seed)+.19,.9);to(s.nodes[g],{y:-135},q(g)+.18,.8);
   [280,560,810,1330,1510,1690].forEach((x,k)=>draw(`M ${x} 920 Q ${x-65} 780 ${x+15} ${735-k%2*80}`,{at:q(seed)+k*.08,duration:1.1,color:k%2?C.muted:C.rust,width:7}));
   const soil=rect(125,941,1670,18,C.muted);from(soil,{scaleX:0},{scaleX:1},s.start,.8);
  }else{
   row(ids(),210,440,195,'serif',1530);reveal(ids(),{y:65},.15);
   ids().forEach((i,k)=>{const n=s.nodes[i],x=parseFloat(n.style.left)+n._width*.5;draw(`M ${x} 690 L ${x} 780 Q ${x-45} 845 ${x-90} 880`,{at:q(i),duration:1.1,color:C.muted,width:9});});
   to(s.type,{y:-75},q(0)+.25,Math.max(.8,s.end-s.start-.4));
  }
 });
 R('fruit-seed-nesting',[30,31],'A living enclosure preserves an independent readable center.','FRUIT occupies a broad bowl while SEED nests in its open center; kind resolves to a sealed root.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,draw,ring,from}=h;
  if(s.words.some(w=>/fruit/i.test(w.text))){
   const f=find('fruit'),seed=find('seed');flow(ids(0,f),{x:130,y:160,width:1500,size:142,maxLines:1});
   row([f],140,465,292,'condensed',735,C.rust);row(ids(f+1,seed),890,350,112,'serif',690);row(ids(seed),890,575,166,'heavy',890,C.bone);
   reveal(ids(),{y:22},.09);to(s.nodes[f],{x:65,y:25},q(f)+.14,.8);
   draw('M 760 300 C 1390 170 1790 480 1715 790 Q 1290 1000 840 785',{at:q(f),duration:1.45,color:C.rust,width:20});
   const r=ring(810,505,340,8,C.muted);from(r,{scale:.35,opacity:0},{scale:1,opacity:.7},q(seed),.85);
  }else{
   row(ids(),190,395,192,'serif',1550);reveal(ids(),{x:-38},.12);
   draw('M 185 760 Q 910 940 1760 710 M 930 750 L 930 875',{at:s.start,duration:1.4,width:14,color:C.rust});
   to(s.type,{y:65},q(0)+.22,1.0);
  }
 });
 R('root-lock-green-upwelling',[32,33],'A command becomes structure in the same material world.','HOLD fastens into a root joint; GREEN rises against an immovable SOIL.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,draw,rect,from}=h;
  const green=s.words.some(w=>/^green/i.test(w.text));
  if(green){
   const g=find('green'),soil=find('soil');row([g],140,580,320,'condensed',1160,C.bone);
   flow(ids(g+1,soil),{x:190,y:150,width:1570,size:140,maxLines:1});row([soil],1170,770,200,'heavy',590,C.rust);
   reveal(ids(),{y:15},.08);s.reveal(g,{from:{y:100,scaleY:.72},duration:.17});to(s.nodes[g],{y:-235},q(g)+.19,1.3);
   const ground=rect(130,946,1670,22,C.rust);from(ground,{scaleX:.45},{scaleX:1},q(g),1.35);
   draw('M 480 920 C 630 830 485 710 680 680 M 480 920 Q 410 860 275 830 M 480 920 Q 695 930 820 835',{at:q(g),duration:1.3,color:C.muted,width:9});
  }else{
   row(ids(0,3),180,225,194,'serif',1420);row(ids(3),660,590,295,'heavy',1090,C.rust);reveal(ids(),{y:-25},.10);
   const hld=find('hold');to(s.nodes[hld],{y:75},q(hld)+.15,.42,'power4.out');
   draw('M 935 922 L 935 1000 M 935 960 L 800 1010 M 935 970 L 1090 1015',{at:q(hld),duration:.65,width:18,color:C.muted});
  }
 });
 R('grass-typographic-reeds',[34],'Material rhythm continues through a complete readable phrase.','A tall GRASS leads two alternating-height phrase banks, then their baselines converge.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,draw}=h,g=find('grass');
  row([g],140,270,345,'condensed',610,C.rust);flow(ids(g+1),{x:805,y:320,width:955,size:140,maxLines:3,step:1.42});
  reveal(ids(),{y:45},.13);to(s.nodes[g],{y:-85,scaleY:1.08},q(g)+.15,1.1);
  ids(g+1).forEach((i,j)=>to(s.nodes[i],{y:j%2?20:-20},q(i)+.2,.5));
  [175,365,550,705].forEach((x,j)=>draw(`M ${x} 960 Q ${x+90} 805 ${x+35} ${725-j%2*85}`,{at:q(Math.min(j+1,h.N-1)),duration:1.2,color:C.muted,width:9}));
 });
 R('fruit-word-envelope',[35],'The surrounding shape makes a meaningful relationship visible.','FRUIT bends slightly into an envelope; SEED remains upright in a second, lower reading chamber.',h=>{
  const {s,C,ids,find,q,row,reveal,to,draw,glyphCurve}=h,f=find('fruit'),seed=find('seed');
  row([f],130,185,315,'condensed',1430,C.rust);row(ids(f+1,seed),530,550,133,'serif',1170);row([seed],890,755,188,'heavy',790,C.bone);
  reveal(ids(),{x:25},.09);glyphCurve(f,-42,q(f)+.18,1.05);
  draw('M 250 480 Q 400 920 1470 990 Q 1810 850 1765 615',{at:q(find('wrapped')),duration:1.4,color:C.rust,width:18});
  to(s.nodes[seed],{x:-65,y:-30},q(seed)+.17,.85);
 });
 R('tree-word-branching',[36],'The camera follows semantic junctions rather than an ornamental path.','The two TREE words occupy successive branch levels; the two KIND words grow into a parallel crown.',h=>{
  const {s,C,ids,find,q,row,reveal,to,draw,camera}=h,t1=find('tree',0),t2=find('tree',1),k1=find('kind',0),k2=find('kind',1);
  row(ids(0,t2),150,235,187,'condensed',745,C.bone);row(ids(t2,k1),840,415,172,'serif',890);row(ids(k1),720,750,165,'heavy',1080,C.amber);
  reveal(ids(),{x:-35,y:25},.12);
  draw('M 245 940 L 245 550 L 970 550 L 970 690 L 1520 690',{at:q(t1),duration:Math.max(1,s.end-s.start-.35),color:C.muted,width:16});
  to(s.nodes[t1],{y:-40},q(t2),.65);to(s.nodes[t2],{y:-35},q(k1),.65);
  camera({x:-38,y:-25,scale:1.015},q(t2),.8);camera({x:0,y:0,scale:1},q(k2),.6);
 });
 R('third-day-canopy-turn',[37,38],'A shared organic material changes orientation at a day boundary.','GOOD rests under a deep canopy; DUSK and DAWN reveal the dark and lit sides of a broad circular turn.',h=>{
  const {s,C,ids,find,q,row,flow,reveal,to,draw,ring,from}=h;
  if(s.words.some(w=>/good/i.test(w.text))){
   const g=find('good');flow(ids(0,g),{x:190,y:720,width:1530,size:132,maxLines:1});row([g],505,315,335,'condensed',1040,C.bone);reveal();
   draw('M 135 675 Q 340 110 1010 130 Q 1545 110 1790 645',{at:s.start,duration:1.8,color:C.rust,width:24});to(s.nodes[g],{y:45},q(g)+.12,.85);
  }else{
   const dawn=find('dawn');row([0],170,285,257,'heavy',780,C.bone);row([dawn],1090,525,253,'condensed',660,C.amber);row(ids(dawn+1),460,845,103,'serif',1230);reveal(ids(),{y:25},.1);
   const canopy=ring(360,-45,1110,36,C.muted);canopy.style.borderRightColor=C.amber;canopy.style.borderBottomColor='transparent';canopy.dataset.layoutAllowOverflow='';from(canopy,{rotation:-70},{rotation:48},s.start,s.end-s.start-.1,'sine.inOut');
   to(s.nodes[0],{y:100},q(dawn),.9);to(s.nodes[dawn],{y:-140},q(dawn)+.15,.9);
  }
 });
})(window.G1_REGISTER);
