/* Original opening: a count becomes a world, then the command cleaves darkness. */
window.buildGenesisOpening=function({tl,stage,E,rect,path,theme:C}){
 const world=E('div','g1-camera',stage),title=E('div','g1-form',world,{left:'146px',top:'248px',fontFamily:'Bebas',fontSize:'270px',letterSpacing:'10px',color:C.bone});title.textContent='GENESIS';
 const numeral=E('div','g1-form',world,{left:'1380px',top:'100px',fontFamily:'Archivo',fontSize:'710px',lineHeight:'1',color:C.rust});numeral.textContent='1';
 const sub=E('div','g1-form',world,{left:'165px',top:'555px',fontFamily:'Elegy',fontStyle:'italic',fontSize:'83px',letterSpacing:'3px'});sub.textContent='The Beginning';
 const seam=rect(world,144,717,1630,13,C.amber);tl.fromTo(seam,{scaleX:0},{scaleX:1,duration:.48,ease:'expo.out'},.03);
 tl.fromTo(title,{x:-100,opacity:0},{x:0,opacity:1,duration:.48,ease:'power4.out'},.08);tl.fromTo(numeral,{y:180,rotation:-9,opacity:0},{y:0,rotation:0,opacity:1,duration:.75,ease:'power4.out'},.14);tl.fromTo(sub,{y:40,opacity:0},{y:0,opacity:1,duration:.55},.48);
 for(let k=0;k<6;k++){const line=path(world,`M -100 ${815+k*40} Q 670 ${665+k*55} 980 ${875+k*30} T 2020 ${815+k*45}`,{stroke:k%2?C.muted:C.rust,width:k===0?13:4});const L=line.getTotalLength();tl.fromTo(line,{strokeDasharray:L,strokeDashoffset:L},{strokeDashoffset:0,duration:1.4+k*.08,ease:'sine.inOut'},.35+k*.07);tl.to(line,{y:-50-k*9,duration:2.8,ease:'sine.inOut'},.65);}
 tl.to(world,{scale:1.045,x:-20,duration:2.55,ease:'sine.inOut'},.8);tl.to([title,sub,numeral],{y:-140,opacity:0,stagger:.045,duration:.4,ease:'power3.in'},3.65);tl.to(stage,{opacity:0,duration:.2},4.08);
};
(function(R){
 R('before-the-first-count',[1],'Time gains measure before the first day.','A moving measurement rail passes through the large count while the sentence resolves.',u=>{
  u.row([0,1],135,160,143,'serif',1550);u.row([2],140,340,247,'condensed',1100,u.C.bone);u.row([3],740,364,263,'heavy',1010,u.C.rust);u.row([4,5],1020,744,145,'serif',745,u.C.bone);u.reveal();
  const rail=u.rect(135,655,1640,8,u.C.amber);u.scaleIn(rail,'X',u.q(0),.8);for(let k=0;k<18;k++){const t=u.rect(152+k*94,645,k%3?3:7,k%3?31:75,k%3?u.C.muted:u.C.bone);u.from(t,{scaleY:0},{scaleY:1},u.q(2)+k*.024,.22);}
  u.to(u.s.nodes[3],{x:45,y:-38},u.q(3)+.13,.8);u.camera({x:-32,y:-22,scale:1.035},u.q(3),1.3);
 });
 R('heaven-earth-into-being',[2],'The first making gives upper and lower realms distinct weight.','Heaven rises, Earth grounds, and BEING forms between authored strata.',u=>{
  u.row([0,1],130,105,125,'serif',1550);u.row([2],160,355,220,'condensed',960,u.C.bone);u.row([3],1000,346,98,'serif',290);u.row([4],1200,575,201,'heavy',570,u.C.rust);u.row([5,6],185,800,147,'serif',1400);u.reveal();
  u.draw('M 90 583 Q 710 438 1770 566',{at:u.q(2),duration:1.1,width:13});u.draw('M 110 762 Q 1030 920 1810 752',{at:u.q(4),duration:1.1,width:34,color:u.C.rust});u.to(u.s.nodes[2],{y:-60},u.q(2)+.18,.75);u.to(u.s.nodes[4],{y:38},u.q(4)+.13,.65);u.camera({rotation:-1.5,scale:1.025},u.q(5),.9);
 });
 R('earth-unfinished',[3],'Bare ground exists with its outline still incomplete.','EARTH rests on broken heavy strata; UNFINISHED leaves a deliberate unclosed contour.',u=>{
  u.row([0],135,255,315,'heavy',1430,u.C.rust);u.row([1,2],900,647,149,'serif',870);u.row([3],135,800,170,'condensed',1510,u.C.bone);u.reveal();
  for(let k=0;k<5;k++){u.draw(`M ${90+k*60} ${640+k*30} L ${600+k*110} ${620+k*22} L ${1050+k*40} ${657+k*21}`,{at:u.q(0)+k*.07,duration:.9,width:k===0?28:5,color:k%2?u.C.muted:u.C.amber});}u.to(u.s.nodes[0],{y:32,scaleX:1.03},u.q(1),.9);u.draw('M 1780 905 L 1780 120 L 1400 120',{at:u.q(3),duration:1.0,width:16});
 });
 R('blackness-over-deep',[4],'The darkness is material, not empty filler.','A heavy dark field descends between BLACKNESS and the lower DEEP.',u=>{
  u.row([0],125,148,265,'condensed',1600,u.C.muted);u.row([1,2],140,464,149,'serif',1640);u.row([3],1030,691,270,'heavy',750,u.C.bone);u.reveal();const shade=u.rect(-100,364,2120,200,'#060606',u.s.back);u.from(shade,{scaleY:0},{scaleY:1.8},u.q(1),.85);u.draw('M 70 985 C 700 830 1260 1090 1890 924',{at:u.q(3),duration:.85,width:17,color:u.C.rust});u.camera({y:22},u.q(1),1.1);
 });
 R('spirit-over-waters',[5],'Movement across water is expressed through the sentence itself.','Across follows a current, then SPIRIT stays clear above a moving water contour.',u=>{
  u.row([0,1,2],130,173,147,'serif',1650);u.row([3,4],145,396,148,'condensed',810);u.row([5],750,445,223,'heavy',990,u.C.bone);u.row([6,7],1280,744,141,'serif',490);u.reveal();
  for(let k=0;k<5;k++){const p=u.draw(`M -130 ${702+k*47} C 300 ${492+k*68} 520 ${968+k*14} 1120 ${704+k*38} S 1650 ${617+k*60} 2080 ${811+k*25}`,{at:u.q(0)+k*.09,duration:1.1,width:k===1?13:3,color:k%2?u.C.amber:u.C.muted});u.to(p,{x:90,y:-15-k*5},u.q(3),1.25);}
  u.to(u.s.nodes.slice(0,3),{x:70,y:22},u.q(3),1.1);u.to(u.s.nodes[5],{y:-32},u.q(5)+.13,1.2);u.camera({x:-15,y:12,scale:1.015},u.q(5),1.2);
 });
 R('command-light-cleavage',[6],'A divine command becomes a physical rupture of the dark.','LIGHT lands into an opening seam while a warm wedge reveals the words COME FORTH.',u=>{
  const l=u.find('light'),c=u.find('come');u.flow(u.ids(0,l),{x:135,y:143,width:1500,size:129});u.hero(l,{x:130,y:362,size:360,width:1635,font:'heavy',color:u.C.bone});u.row(u.ids(c),920,815,180,'condensed',865,u.C.amber);u.reveal(u.ids(0,l));u.s.reveal(l,{from:{scale:1.15,y:12},duration:.12});u.reveal(u.ids(l+1));
  const seam=u.rect(948,-100,15,1280,u.C.amber,u.s.back);u.from(seam,{scaleY:0,rotation:9,opacity:0},{scaleY:1,rotation:9,opacity:1},u.q(l)-.06,.13);u.to(seam,{scaleX:20,opacity:.25},u.q(l)+.08,.32,'expo.out');u.to(seam,{scaleX:65,x:250,opacity:.13},u.q(c),.85);u.draw('M 110 786 L 1810 786',{at:u.q(l),duration:.28,width:17,color:u.C.amber});u.camera({x:-24,scale:1.025},u.q(c),.6);
 });
 R('brightness-answer',[7],'Brightness answers with a clean confident expansion.','Two words lock onto opposing illuminated planes.',u=>{
  u.row([0],125,220,278,'condensed',1650,u.C.bone);u.row([1],635,609,246,'serif',1180,u.C.amber);u.reveal();const beam=u.rect(-200,550,2300,21,u.C.amber);u.from(beam,{scaleX:0,rotation:-4},{scaleX:1,rotation:-4},u.q(0),.4);u.to(beam,{scaleY:3,opacity:.35},u.q(1),.8);u.to(u.s.nodes[0],{x:25,y:-15},u.q(1),.75);u.to(u.s.nodes[1],{x:-25,y:15},u.q(1),.75);
 });
 R('sixth-day-return',[96],'The final boundary resolves creation rather than adding an unrelated title.','DUSK contracts; DAWN opens the final clear horizon with the sixth-day words.',u=>{
  u.row([0],135,192,252,'heavy',850,u.C.muted);u.row([1],1050,450,260,'condensed',750,u.C.amber);u.row(u.ids(2),170,800,150,'serif',1550,u.C.bone);u.reveal();u.draw('M -60 719 Q 960 395 2000 719',{at:u.q(1),duration:1.25,width:22,color:u.C.rust});u.draw('M 120 996 L 1800 996',{at:u.q(u.N-1),duration:.8,width:7,color:u.C.amber});u.to(u.s.nodes[0],{y:40},u.q(1),1.0);u.to(u.s.nodes[1],{y:-30},u.q(u.N-1),.8);
  const finish=u.q(u.N-1)+.9;u.camera({scale:.87,y:-40,x:-25},finish,2.6);
  for(let k=0;k<7;k++){const r=u.ring(790-k*58,45-k*58,800+k*116,k===0?14:3,k%2?u.C.rust:u.C.muted);r.style.borderLeftColor='transparent';r.style.borderBottomColor='transparent';u.from(r,{rotation:70+k*12,opacity:0},{rotation:140+k*12,opacity:.3},finish+k*.16,7.8-k*.2);}
  for(let k=0;k<5;k++)u.draw(`M -100 ${1130+k*40} Q 690 ${700+k*90} 2020 ${1080+k*30}`,{at:finish+k*.22,duration:5.8,width:k===0?15:4,color:k%2?u.C.rust:u.C.amber});
  u.to(u.s.scene,{opacity:0},u.end-.62,.60,'sine.in');
 });
})(window.G1_REGISTER);
