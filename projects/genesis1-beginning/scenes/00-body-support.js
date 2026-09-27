/* Shared authoring utilities only. Every scene below supplies its own semantics. */
window.G1_SCENES=window.G1_SCENES||{};
window.G1_SCENE_META=window.G1_SCENE_META||{};
window.G1_BODY=function(s){
 const {tl,words,nodes,start,end,theme:C}=s,N=words.length;
 const ids=(a=0,b=N)=>Array.from({length:Math.max(0,Math.min(N,b)-Math.max(0,a))},(_,i)=>Math.max(0,a)+i);
 const clean=t=>String(t).toLowerCase().replace(/[^a-z0-9]/g,'');
 const find=(term,occurrence=0,fallback=Math.floor(N/2))=>{const re=term instanceof RegExp?term:new RegExp('^'+clean(term)+'$');const found=ids().filter(i=>re.test(clean(words[i].text)));return found[occurrence]??Math.max(0,Math.min(N-1,fallback));};
 const q=(i=0,offset=0)=>(words[Math.max(0,Math.min(N-1,i))]?.start??start)+offset;
 const duration=(at,d)=>Math.max(0,Math.min(d,end-at-.025));
 const to=(target,props,at=start,d=.55,ease='power2.inOut')=>{const length=duration(at,d);if(target&&(!Array.isArray(target)||target.length)&&length>.015)tl.to(target,{...props,duration:length,ease},at);};
 const from=(target,a,b,at=start,d=.55,ease='power3.out')=>{const length=duration(at,d);if(target&&(!Array.isArray(target)||target.length)&&length>.015)tl.fromTo(target,a,{...b,duration:length,ease,immediateRender:false},at);};
 const row=(list,x,y,size=150,font='condensed',width=1640,color=C.bone)=>s.row(list,{x,y,size,font,maxWidth:width,color,gap:Math.max(18,size*.16)});
 function flow(list,{x=140,y=180,width=1640,size=118,font='serif',color=C.bone,maxLines=3,step=1.23}={}){
  if(!list.length)return[];let sz=size,groups=[];
  for(let pass=0;pass<7;pass++){
   groups=[];let current=[],used=0;
   for(const i of list){const node=s.place(i,0,0,sz,{font,color});const w=node._width||words[i].text.length*sz*.53,gap=Math.max(17,sz*.17);if(current.length&&used+gap+w>width){groups.push(current);current=[];used=0;}current.push(i);used+=w+(current.length>1?gap:0);}
   if(current.length)groups.push(current);if(groups.length<=maxLines||sz<=76)break;sz=Math.max(76,sz*.89);
  }
  groups.forEach((g,j)=>row(g,x,y+j*sz*step,sz,font,width,color));return groups;
 }
 const hero=(i,{x=190,y=385,size=255,width=1510,font='heavy',color=C.rust}={})=>row([i],x,y,size,font,width,color)[0];
 const rest=(i,{beforeY=150,afterY=790,x=150,width=1620,size=112}={})=>{flow(ids(0,i),{x,y:beforeY,width,size,maxLines:2});flow(ids(i+1),{x,y:afterY,width,size,maxLines:2});};
 const reveal=(list=ids(),fromPose={y:12},d=.10)=>list.forEach(i=>s.reveal(i,{from:fromPose,duration:d}));
 const rect=(x,y,w,h,color=C.rust,parent=s.front)=>s.rect(parent,x,y,w,h,color);
 const ring=(x,y,d,width=12,color=C.muted,parent=s.back)=>s.ring(parent,x,y,d,width,color);
 const path=(d,{color=C.muted,width=8,fill='none',parent=s.front}={})=>s.path(parent,d,{stroke:color,width,fill});
 const draw=(d,{at=start,duration:len=.9,color=C.muted,width=8,parent=s.front}={})=>{const p=path(d,{color,width,parent});p.setAttribute('pathLength','1');p.setAttribute('stroke-dasharray','1');p.setAttribute('stroke-dashoffset','1');to(p,{attr:{'stroke-dashoffset':0}},at,len,'sine.inOut');return p;};
 const show=(shape,at=start,d=.5)=>from(shape,{opacity:0},{opacity:1},at,d,'sine.out');
 const scaleIn=(shape,axis='Y',at=start,d=.6)=>from(shape,{['scale'+axis]:0},{['scale'+axis]:1},at,d);
 const camera=(props,at=start,d=.7)=>to(s.camera,props,at,d,'sine.inOut');
 const glyphCurve=(i,amplitude,at=q(i)+.16,d=.75)=>{const gs=s.glyphs(i),mid=(gs.length-1)/2;gs.forEach((g,j)=>to(g,{y:-amplitude*(1-Math.pow((j-mid)/(mid||1),2))},at+j*.008,d));return gs;};
 const span=(i)=>({x:parseFloat(nodes[i].style.left)||0,y:parseFloat(nodes[i].style.top)||0,w:nodes[i]._width||150,h:nodes[i]._height||150});
 const settle=(at=end-.65)=>camera({x:0,y:0,scale:1,rotation:0},at,.6);
 return {s,tl,C,N,ids,find,q,to,from,row,flow,hero,rest,reveal,rect,ring,path,draw,show,scaleIn,camera,glyphCurve,span,settle};
};
window.G1_REGISTER=function(id,lines,principle,distinctMechanic,fn){
 window.G1_SCENES[id]=function(ctx){if(!ctx.words.length)return;ctx.scene.dataset.bodyFamily=id;fn(window.G1_BODY(ctx));};
 window.G1_SCENE_META[id]={intakeLineNumbers:lines,principle,lyrics:[],distinctMechanic,status:'authored-awaiting-runtime-review'};
};
