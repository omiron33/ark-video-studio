// Immediate, developing opening: a shelter is traced, opens toward the hand,
// and becomes the first guide line. Only the real song title appears here.
const openingEnd=P23_DATA.phrases[0].showStart;
document.querySelector('#opening').dataset.duration=openingEnd;
const oChars=[...document.querySelectorAll('.title-word .title-char')];
oChars.forEach((el,i)=>tl.fromTo(el,{y:110-i*9,rotation:7-i*2,opacity:0},{y:0,rotation:0,opacity:1,duration:.72,ease:'power3.out',immediateRender:false},.03+i*.072));
document.querySelectorAll('.title-number .title-char').forEach((el,i)=>{
 tl.fromTo(el,{x:i?135:-75,y:80,rotation:i?9:-11,opacity:0},{x:0,y:0,rotation:0,opacity:1,duration:1.25,ease:'power3.out',immediateRender:false},.26+i*.13);
 tl.to(el,{y:i?-22:18,rotation:i?-2.4:1.5,duration:4.2,ease:'sine.inOut'},3.4+i*.35);
 tl.to(el,{y:0,rotation:0,duration:3.8,ease:'sine.inOut'},8.2+i*.25);
});
tl.fromTo('.title-rule',{scaleX:0},{scaleX:1,duration:2.2,ease:'power2.out',immediateRender:false},.3);
const openingDraws=[['#opening-shelter',.02,3.3],['#opening-threshold',1.5,4.8],['#opening-thread',4.2,6.8],['#opening-echo',7.8,5.6]];
for(const [selector,start,span]of openingDraws){
 const el=document.querySelector(selector),len=el.getTotalLength();el.style.strokeDasharray=len;el.style.strokeDashoffset=len;
 tl.fromTo(el,{strokeDashoffset:len,opacity:.8},{strokeDashoffset:0,opacity:.8,duration:span,ease:'sine.inOut',immediateRender:false},start);
}
tl.to('#opening-shelter',{x:100,y:-35,rotation:3,transformOrigin:'45% 50%',duration:8,ease:'sine.inOut'},5.7);
tl.to('#opening-thread',{x:-90,y:38,duration:4.7,ease:'sine.inOut'},9.2);
tl.fromTo('.opening-inner',{opacity:1},{opacity:0,duration:.4,ease:'power2.in',immediateRender:false},openingEnd-.4);

// Final title is not a new lyric. The contour continues to an open home,
// instead of dying into a black frame after the final sung phrase.
const endingStart=Math.max(205.5,P23_DATA.phrases.at(-1).showEnd+.03);
document.querySelector('#ending').dataset.start=endingStart;
document.querySelector('#ending').dataset.duration=P23_DATA.duration-endingStart;
tl.fromTo('.ending-title',{y:60,opacity:0},{y:0,opacity:1,duration:1.1,ease:'power3.out',immediateRender:false},endingStart+.04);
tl.fromTo('.ending-number',{x:-55,rotation:-5,opacity:0},{x:0,rotation:0,opacity:1,duration:1.6,ease:'power3.out',immediateRender:false},endingStart+.22);
['#ending-path','#ending-return','#ending-horizon'].forEach((selector,i)=>{
 const el=document.querySelector(selector),len=el.getTotalLength();el.style.strokeDasharray=len;el.style.strokeDashoffset=len;
 tl.fromTo(el,{strokeDashoffset:len},{strokeDashoffset:0,duration:6.2+i*1.5,ease:'sine.inOut',immediateRender:false},endingStart+.1+i*1.8);
});
tl.fromTo('.ending-aperture',{scaleX:.75,scaleY:.82,opacity:0},{scaleX:1,scaleY:1,opacity:.5,duration:4.1,ease:'power2.out',immediateRender:false},endingStart+2.1);
tl.to('.ending-aperture',{x:110,scaleX:1.18,opacity:.18,duration:7.5,ease:'sine.inOut'},endingStart+6.2);
tl.to('.ending-number',{y:-24,duration:8.4,ease:'sine.inOut'},endingStart+4.1);
tl.to('#ending-path',{x:90,y:-20,duration:5.2,ease:'sine.inOut'},P23_DATA.duration-5.22);
