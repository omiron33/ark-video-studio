/** Spatial lyric sets. Every word and construction line lives in the same fixed
 * coordinate system; an absolute-time camera visits the vocal phrase stations.
 * This module never edits cues and never draws text before its canonical onset. */
export const CAMERA_CATALOG = Object.freeze({
 'camera-switchback':'A continuous contour route changes direction at each phrase; the camera follows its switchbacks.',
 'camera-stairwell':'A descending crane passes suspended words on an architectural staircase.',
 'camera-runway':'A low longitudinal dolly advances through paired words above a perspective runway.',
 'camera-rail':'A lateral tracking shot visits widely separated word stations on a red rail.',
 'camera-hinge':'A lateral camera turns through hinged typographic leaves, leaving folded pages behind.',
 'camera-spiral':'An overhead camera follows outward-growing spiral word stations.',
 'camera-dolly':'A depth dolly threads staggered suspended word planes and their portal edges.',
 'camera-braid':'The camera follows two interwoven word trails which cross between phrases.',
 'camera-canyon':'A descending diagonal flight follows words along a contour-cut canyon.',
 'camera-arc':'A broad crane arc circles the edge of a monumental circular word arrangement.',
 'camera-rack':'A close phrase landmark gives way to its full measured phrase, then the next level.',
 'camera-tunnel':'A camera advances through successive square word gates and their receding frames.',
 'camera-horizon':'A restrained banking camera follows a rising diagonal horizon of words.',
 'camera-wall':'An upward crane discovers stacked word columns on a vast architectural wall.',
 'camera-pullback':'The camera begins at one phrase and progressively reveals the complete spatial stanza.',
 'camera-micro':'A large first word becomes the anchor of a growing typographic atlas as the camera pulls out.'
});
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
const TAU=Math.PI*2;
const vec=(x=0,y=0,z=0)=>({x,y,z});
const plus=(a,b)=>vec(a.x+b.x,a.y+b.y,a.z+b.z);
const plain=w=>String(w.text).replace(/[.,]$/,'').toUpperCase();
const ids=new Set(Object.keys(CAMERA_CATALOG));
const compactModes=new Set(['camera-stairwell','camera-spiral','camera-dolly','camera-braid','camera-canyon','camera-arc','camera-tunnel']);
const spatialModes=new Set(['camera-runway','camera-dolly','camera-tunnel','camera-horizon','camera-canyon']);

export function cameraWords(e){
 const selected=new Set(e.s.wordIds||[]);
 return e.p.words.filter(w=>selected.has(w.id)).sort((a,b)=>a.start-b.start||a.end-b.end);
}

/** A phrase, rather than every syllable, is a camera stop. The camera can turn
 * toward the next empty station during a gap, but its words remain unrevealed. */
export function cameraStations(ws,mode,authoredGroups){
 if(authoredGroups?.length){
  const byId=new Map(ws.map(w=>[w.id,w])),used=new Set(),result=[];
  for(const source of authoredGroups){
   let row=[],letters=0;
   for(const id of source){const w=byId.get(id);if(!w||used.has(id))continue;
    if(row.length&&(row.length>=6||letters+w.text.length>40)){result.push(row);row=[];letters=0}
    row.push(w);used.add(id);letters+=w.text.length+1;
   }
   if(row.length)result.push(row);
  }
  for(const w of ws)if(!used.has(w.id))result.push([w]);
  return result.sort((a,b)=>a[0].start-b[0].start);
 }
 const count=compactModes.has(mode)?3:4,groups=[];
 for(let i=0;i<ws.length;){
  const next=[];let letters=0;
  while(i<ws.length&&next.length<count){
   const w=ws[i];if(next.length&&letters+w.text.length>27)break;
   next.push(w);letters+=w.text.length+1;i++;
   if(/[;?!]$/.test(w.text))break;
  }
  groups.push(next);
 }
 return groups;
}

/** Fixed world positions: changing time changes only the camera (and opacity),
 * never the coordinates at which a lyric was authored. */
export function cameraStationPosition(mode,g,n=4){
 switch(mode){
 case 'camera-switchback':return vec(g%2?780:-780,g*660,0);
 case 'camera-stairwell':return vec(g*430,g*570,g*45);
 case 'camera-runway':return vec(Math.sin(g*.9)*110,0,g*1170);
 case 'camera-rail':return vec(g*1840,(g%2)*90,0);
 case 'camera-hinge':return vec(g*1400,Math.sin(g*Math.PI/2)*270,g*100);
 case 'camera-spiral':{const a=g*.9-1.7,r=650+g*185;return vec(Math.cos(a)*r,Math.sin(a)*r,g*20)}
 case 'camera-dolly':return vec(g%2?320:-320,(g%3-1)*210,g*1030);
 case 'camera-braid':return vec(Math.sin(g*1.8)*700,g*620,g*90);
 case 'camera-canyon':return vec(g*830,g*500,g*390);
 case 'camera-arc':{const a=g*.65-1.8;return vec(Math.cos(a)*1800,Math.sin(a)*980,Math.sin(g*.4)*180)}
 case 'camera-rack':return vec((g%2?1:-1)*220,g*670,0);
 case 'camera-tunnel':return vec(Math.sin(g*.75)*200,Math.cos(g*.5)*70,g*920);
 case 'camera-horizon':return vec(g*740,-g*160,g*520);
 case 'camera-wall':return vec((g%2?1:-1)*350,-g*670,0);
 case 'camera-pullback':return vec((g%2-.5)*1580,Math.floor(g/2)*600,0);
 case 'camera-micro':{const col=g%2,row=Math.floor(g/2);return vec(col*1430,row*630,0)}
 default:return vec(g*1500,0,0);
 }
}

/** The view matrix is shared by type and world geometry. Positive z points
 * into the image. No animation state or browser time enters this calculation. */
export function projectCameraPoint(point,camera){
 const dx=point.x-camera.x,dy=point.y-camera.y,dz=point.z-camera.z;
 const cy=Math.cos(camera.yaw||0),sy=Math.sin(camera.yaw||0);
 const cp=Math.cos(camera.pitch||0),sp=Math.sin(camera.pitch||0);
 const x=cy*dx-sy*dz,z0=sy*dx+cy*dz,y=cp*dy-sp*z0,z=sp*dy+cp*z0;
 if(z<75)return null;
 const f=(camera.focal||1180)/z,cr=Math.cos(camera.roll||0),sr=Math.sin(camera.roll||0);
 return {x:960+(x*cr-y*sr)*f+(camera.shiftX||0),y:570+(x*sr+y*cr)*f+(camera.shiftY||0),scale:f,depth:z};
}
function cameraAtStation(mode,g,n){
 const p=cameraStationPosition(mode,g,n);
 const base={x:p.x,y:p.y,z:p.z-1250,focal:1180,yaw:0,pitch:0,roll:0};
 switch(mode){
 case 'camera-switchback':base.x+=g%2?-115:115;base.y-=75;base.roll=g%2?.035:-.035;break;
 case 'camera-stairwell':base.x+=145;base.y+=15;base.pitch=.04;base.roll=.055;break;
 case 'camera-runway':base.y=175;base.pitch=-.15;base.yaw=Math.sin(g*.9)*.018;break;
 case 'camera-rail':base.x+=200;base.y-=90;break;
 case 'camera-hinge':base.x+=110;base.yaw=.075*(g%2?1:-1);base.roll=g%2?-.025:.025;break;
 case 'camera-spiral':base.x+=Math.cos(g*.9)*100;base.y+=Math.sin(g*.9)*80;base.roll=Math.sin(g*.9)*.065;break;
 case 'camera-dolly':base.x-=90;base.y-=45;base.yaw=-.055;break;
 case 'camera-braid':base.x+=Math.cos(g*1.8)*90;base.roll=Math.sin(g*1.8)*.06;break;
 case 'camera-canyon':base.x+=135;base.y-=70;base.pitch=.04;base.roll=-.08;break;
 case 'camera-arc':base.x+=Math.cos(g*.65)*150;base.y+=Math.sin(g*.65)*90;base.roll=Math.sin(g*.65)*.075;break;
 case 'camera-rack':base.y-=85;base.focal=1250;break;
 case 'camera-tunnel':base.z=p.z-1410;base.focal=1310;break;
 case 'camera-horizon':base.y+=100;base.pitch=-.08;base.roll=g%2?-.06:.06;break;
 case 'camera-wall':base.x-=90;base.y-=30;base.pitch=.025;break;
 case 'camera-pullback':{const q=g/Math.max(1,n-1),middleY=(Math.ceil(n/2)-1)*270;base.x=p.x*(1-q*.9);base.y=lerp(p.y,middleY,q*.9)-65;base.z=-1250-650*q;break;}
 case 'camera-micro':{const q=g/Math.max(1,n-1);base.x=p.x*(1-q*.55);base.y=p.y*(1-q*.45)-50;base.z=-1120-q*740;base.roll=-.04*(1-q);break;}
 }
 return base;
}

export function cameraAtTime(mode,groups,t,start=0,end=1,{settleAtOnset=false}={}){
 if(!groups.length){
  const travel=smooth((t-start)/Math.max(.01,end-start))*1.65,index=Math.floor(travel),part=smooth(travel-index);
  const a=cameraAtStation(mode,index,4),b=cameraAtStation(mode,index+1,4),result={station:travel};
  for(const field of ['x','y','z','focal','yaw','pitch','roll'])result[field]=lerp(a[field],b[field],part);
  result.z-=180;return result;
 }
 let current=0,blend=0;
 for(let i=1;i<groups.length;i++){
  const at=groups[i][0].start,prior=groups[i-1].at(-1),travel=Math.min(.58,Math.max(.24,(at-prior.start)*.42));
  const finish=at+(settleAtOnset?0:.055),begin=Math.min(finish-.02,Math.max(prior.start+.11,at-travel));
  if(t<begin)break;
  current=i-1;blend=smooth((t-begin)/(finish-begin));
  if(t>=finish){current=i;blend=0;}else break;
 }
 const a=cameraAtStation(mode,current,groups.length),b=cameraAtStation(mode,Math.min(current+1,groups.length-1),groups.length),camera={};
 for(const field of ['x','y','z','focal','yaw','pitch','roll'])camera[field]=lerp(a[field],b[field],blend);
 const arrival=1-smooth((t-start)/Math.min(.55,Math.max(.24,groups[0].at(-1).end-start)));
 // One entrance move per scene; never an oscillating per-word camera effect.
 if(spatialModes.has(mode))camera.z-=arrival*210;
 else if(['camera-stairwell','camera-wall'].includes(mode))camera.y+=(mode==='camera-wall'?1:-1)*arrival*190;
 else if(['camera-spiral','camera-arc'].includes(mode)){camera.x-=arrival*155;camera.y+=arrival*95;}
 else camera.x-=arrival*210;
 const last=groups.at(-1).at(-1),out=smooth((t-last.end-.12)/Math.max(.35,end-last.end-.12));
 // A calm final reveal gives the viewer the spatial relationship after singing.
 if(['camera-switchback','camera-spiral','camera-canyon','camera-arc','camera-braid'].includes(mode))camera.z-=out*330;
 if(mode==='camera-rack'){
  const group=groups[current],q=smooth((t-group[0].start)/Math.max(.3,group.at(-1).end-group[0].start));
  camera.focal*=lerp(1.10,.91,q);
 }
 if(mode==='camera-micro')camera.focal*=lerp(1.05,.94,smooth((t-groups[0][0].start)/.65));
 return {...camera,station:current+blend};
}

function measuredWorld(c,e,h,mode,groups){
 const points=[],stations=[];
 for(let g=0;g<groups.length;g++){
  const group=groups[g],center=cameraStationPosition(mode,g,groups.length),family=e.s.direction?.fontFamily||((g%2&&['camera-hinge','camera-rack','camera-pullback','camera-micro'].includes(mode))?'Archivo Black':'Bebas Neue');
  const stacked=['camera-wall','camera-stairwell'].includes(mode);
  const raw=group.map(w=>{h.setFont(c,100,family);return Math.max(1,c.measureText(plain(w)).width)});
  const width=stacked?Math.max(...raw):raw.reduce((a,b)=>a+b,0)+36*(group.length-1);
  const size=Math.min(stacked?175:220,(stacked?830:1210)/width*100);
  let x=-width*size/200;
  for(let j=0;j<group.length;j++){
   const w=group[j],ww=raw[j]*size/100;
   let offset=vec(x+ww/2,55,0);x+=ww+36*size/100;
   if(stacked)offset=vec((j-(group.length-1)/2)*(mode==='camera-stairwell'?170:25),(j-(group.length-1)/2)*190+size*.34,0);
   if(mode==='camera-braid')offset.y+=(j%2?1:-1)*70;
   if(mode==='camera-canyon')offset.y+=offset.x*.15;
   if(mode==='camera-arc')offset.y+=Math.pow(offset.x/400,2)*24;
   if(mode==='camera-runway')offset.z=Math.abs(offset.x)*.10;
   if(mode==='camera-hinge')offset.z=offset.x*(g%2?.14:-.14);
   if(mode==='camera-horizon')offset.y-=offset.x*.10;
   if(mode==='camera-micro'&&g===0&&j===0)offset.y-=28;
   points.push({w,world:plus(center,offset),size,width:ww,family,group:g,index:j,rotation:mode==='camera-canyon'?.055:mode==='camera-horizon'?-.035:0});
  }
  stations.push(center);
 }
 return {points,stations};
}

/** Conservative projected glyph bounds include the slight camera bank. */
export function cameraReadingBounds(pose,padding=22){
 if(!Number.isFinite(pose.x+pose.y+pose.scale))return null;
 const half=pose.width*pose.scale/2,top=-pose.size*pose.scale*.94,bottom=pose.size*pose.scale*.14;
 const ca=Math.cos(pose.rotate||0),sa=Math.sin(pose.rotate||0),corners=[];
 for(const x of [-half,half])for(const y of [top,bottom])corners.push({x:pose.x+x*ca-y*sa,y:pose.y+x*sa+y*ca});
 return {left:Math.min(...corners.map(p=>p.x))-padding,right:Math.max(...corners.map(p=>p.x))+padding,top:Math.min(...corners.map(p=>p.y))-padding,bottom:Math.max(...corners.map(p=>p.y))+padding};
}
const intersects=(a,b)=>a&&b&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;

/** Adjacent curves can bring completed phrases across a new reading station.
 * Only the obstructing older group fades. The shared camera, current lyrics,
 * canonical timing and fixed world-space trail positions remain untouched. */
export function fadeCameraTrailCollisions(poses,groups,t,currentGroup){
 if(currentGroup<1||!groups[currentGroup]?.length)return poses;
 const reading=poses.filter(p=>p.group===currentGroup).map(p=>cameraReadingBounds(p)).filter(Boolean);
 const obstructing=new Set();
 for(const pose of poses){
  if(pose.group>=currentGroup||!pose.visible||pose.active||pose.w.end>t)continue;
  if(reading.some(box=>intersects(box,cameraReadingBounds(pose))))obstructing.add(pose.group);
 }
 if(!obstructing.size)return poses;
 const amount=smooth((t-groups[currentGroup][0].start)/.10);
 return poses.map(pose=>obstructing.has(pose.group)&&!pose.active&&pose.w.end<=t?
  {...pose,opacity:pose.opacity*(1-amount),occludedByCurrentPhrase:true}:pose);
}

/** The returned bounds are deliberately inspectable by the review gauntlet.
 * Safety reframes the entire camera, never detaches a word from its setting. */
export function sampleCameraChoreography(c,e,h){
 const mode=e.s.direction?.choreography;
 if(!ids.has(mode))return null;
 const ws=cameraWords(e),groups=cameraStations(ws,mode,e.s.direction?.cameraGroups),world=measuredWorld(c,e,h,mode,groups);
 if(!world.stations.length)world.stations=Array.from({length:4},(_,g)=>cameraStationPosition(mode,g,4));
 const camera=cameraAtTime(mode,groups,e.t,e.s.start,e.s.end,{settleAtOnset:e.s.direction?.lyricOnset==='immediate'});
 const active=ws.findLast(w=>w.start<=e.t),activeWorld=world.points.find(p=>p.w.id===active?.id);
 if(activeWorld){
  let q=projectCameraPoint(activeWorld.world,camera);
  if(q){
   const width=activeWorld.width*q.scale,height=activeWorld.size*q.scale;
   if(width>1430||height>285){camera.focal*=Math.min(1430/width,285/height);q=projectCameraPoint(activeWorld.world,camera)}
   const half=activeWorld.width*q.scale*.5+28;
   camera.shiftX=clamp(q.x,125+half,1795-half)-q.x;
   const top=activeWorld.size*q.scale*.88;
   camera.shiftY=clamp(q.y,185+top,920)-q.y;
  }
 }
 let poses=world.points.map(o=>{
  const p=projectCameraPoint(o.world,camera);if(!p)return {...o,visible:false};
  const tangent=projectCameraPoint(plus(o.world,vec(100,0,0)),camera),rotate=clamp((tangent?Math.atan2(tangent.y-p.y,tangent.x-p.x):0)+o.rotation,-.10,.10);
  const isActive=o.w.id===active?.id,behind=Math.max(0,camera.station-o.group);
  let opacity=isActive?1:clamp(1-behind*.18,.28,1);
  // Once the camera passes a sung plane it fades before its enlarging letters
  // can cover the next phrase. Geometry still establishes the depth travel.
  if(!isActive&&spatialModes.has(mode)&&o.group<camera.station-.25)opacity*=smooth((p.depth-450)/850)*.65;
  return {...o,x:p.x,y:p.y,scale:p.scale,rotate,depth:p.depth,opacity,active:isActive,visible:e.t>=o.w.start&&p.scale>.055&&p.x>-650&&p.x<2570&&p.y>-420&&p.y<1600};
 });
 poses=fadeCameraTrailCollisions(poses,groups,e.t,activeWorld?.group??-1);
 return {mode,words:ws,groups,stations:world.stations,camera,poses,activeId:active?.id};
}

function path(c,frame,points,color,width=1,alpha=1){
 c.save();c.globalAlpha*=Math.min(.88,alpha*1.65);c.strokeStyle=color;c.lineWidth=Math.max(1,width);c.beginPath();let begun=false;
 for(const point of points){const p=projectCameraPoint(point,frame.camera);if(!p){begun=false;continue}if(!begun){c.moveTo(p.x,p.y);begun=true}else c.lineTo(p.x,p.y)}
 c.stroke();c.restore();
}
function ring(c,f,center,rx,ry,color,alpha=.22,start=0,span=TAU,z=0){
 const points=[];for(let i=0;i<=90;i++){const a=start+i/90*span;points.push(plus(center,vec(Math.cos(a)*rx,Math.sin(a)*ry,z)))}path(c,f,points,color,1,alpha);
}
function routePoints(stations,offset=0,curve=true){
 const points=[];
 for(let i=0;i<stations.length-1;i++){
  const a=stations[i],b=stations[i+1];
  for(let j=0;j<=24;j++){const p=j/24,q=curve?smooth(p):p;points.push(vec(lerp(a.x,b.x,q)+offset,lerp(a.y,b.y,p)+145,lerp(a.z,b.z,p)))}
 }
 return points;
}

export function drawCameraBackground(c,e,h){
 const f=sampleCameraChoreography(c,e,h);if(!f)return false;
 const {mode,stations}=f,fg=e.s.direction?.light?e.ink:e.paper,red=e.accent;
 const n=Math.max(3,stations.length),last=stations.at(-1)||vec();
 c.save();
 if(mode==='camera-switchback'){
  for(let k=-8;k<=8;k++)path(c,f,routePoints(stations,k*52),k===0?red:fg,k===0?3:1,k===0?.8:.12);
  for(const p of stations)ring(c,f,plus(p,vec(0,145,0)),750,245,fg,.15,.2,Math.PI*1.65);
 }else if(mode==='camera-stairwell'){
  for(let g=0;g<n;g++){const p=cameraStationPosition(mode,g,n);path(c,f,[plus(p,vec(-750,300)),plus(p,vec(670,300)),plus(p,vec(670,870))],g%2?fg:red,2,.4);for(let k=1;k<7;k++)path(c,f,[plus(p,vec(-750,300+k*20,160)),plus(p,vec(670,300+k*20,160))],fg,.7,.11)}
 }else if(mode==='camera-runway'){
  for(let k=-7;k<=7;k++)path(c,f,[vec(k*210,380,-300),vec(k*210,380,last.z+5000)],k===0?red:fg,k===0?2:1,k===0?.55:.18);
  for(let z=-200;z<last.z+5000;z+=190)path(c,f,[vec(-1500,380,z),vec(1500,380,z)],fg,1,.15);
 }else if(mode==='camera-rail'){
  for(let k=0;k<5;k++)path(c,f,[vec(-1200,210+k*26),vec(last.x+2000,210+k*26)],k===0?red:fg,k===0?3:1,k===0?.7:.12);
  for(let g=0;g<n;g++){const p=cameraStationPosition(mode,g,n);path(c,f,[plus(p,vec(-700,230)),plus(p,vec(-700,-180)),plus(p,vec(-620,-180))],red,2,.4);for(let j=0;j<9;j++)path(c,f,[plus(p,vec(-650+j*160,370)),plus(p,vec(-650+j*160,390))],fg,1,.28)}
 }else if(mode==='camera-hinge'){
  for(let g=0;g<n;g++){const p=cameraStationPosition(mode,g,n),sign=g%2?1:-1;path(c,f,[plus(p,vec(-700,-330,-98*sign)),plus(p,vec(700,-330,98*sign)),plus(p,vec(700,340,98*sign)),plus(p,vec(-700,340,-98*sign)),plus(p,vec(-700,-330,-98*sign))],g===Math.round(f.camera.station)?red:fg,1.6,.25);path(c,f,[plus(p,vec(-720,-480,-100*sign)),plus(p,vec(-720,500,-100*sign))],red,3,.6)}
 }else if(mode==='camera-spiral'){
  for(let k=0;k<11;k++){const ps=[];for(let j=0;j<190;j++){const a=-2.5+j*.04,r=550+(a+1.7)*205+k*23;ps.push(vec(Math.cos(a)*r,Math.sin(a)*r+150,0))}path(c,f,ps,k===0?red:fg,k===0?2.5:1,k===0?.75:.13)}
 }else if(mode==='camera-dolly'){
  for(let g=0;g<n+3;g++){const p=cameraStationPosition(mode,g,n);for(let side of [-1,1])path(c,f,[plus(p,vec(side*760,390)),plus(p,vec(side*760,-370)),plus(p,vec(side*410,-370))],g%2?fg:red,1.6,.38);path(c,f,[plus(p,vec(-900,420)),plus(p,vec(900,420))],fg,1,.16)}
 }else if(mode==='camera-braid'){
  for(let branch of [-1,1])for(let k=0;k<8;k++){const ps=[];for(let j=0;j<=160;j++){const g=j/160*(n-1),center=cameraStationPosition(mode,g,n);ps.push(plus(center,vec(branch*(250+Math.sin(g*2.5)*230)+k*15,130,g*10)))}path(c,f,ps,k===0?red:fg,k===0?2.5:.8,k===0?.65:.13)}
 }else if(mode==='camera-canyon'){
  for(let side of [-1,1])for(let k=0;k<18;k++){const ps=[];for(let j=0;j<=120;j++){const g=-.5+j/120*(n+1),p=cameraStationPosition(mode,g,n),rise=(170+k*36)*side;ps.push(plus(p,vec(rise,Math.sin(g*2+k*.06)*45+side*k*k*2.4+100,k*22)))}path(c,f,ps,k===0?red:fg,k===0?2.5:.75,k===0?.68:.14)}
 }else if(mode==='camera-arc'){
  for(let k=0;k<20;k++)ring(c,f,vec(0,0,0),1520+k*23,770+k*19,k===11?red:fg,k===11?.55:.13,-2.5,Math.PI*1.65);
  for(const p of stations)path(c,f,[plus(p,vec(0,160)),vec(p.x*.62,p.y*.62,0)],red,1.5,.35);
 }else if(mode==='camera-rack'){
  for(let g=0;g<n;g++){const p=cameraStationPosition(mode,g,n);path(c,f,[plus(p,vec(-750,-120)),plus(p,vec(-790,-120)),plus(p,vec(-790,180)),plus(p,vec(-750,180))],red,4,.7);path(c,f,[plus(p,vec(-660,240)),plus(p,vec(660,240))],fg,1,.24);for(let k=0;k<5;k++)path(c,f,[plus(p,vec(700+k*14,-170)),plus(p,vec(700+k*14,230))],fg,1,.1)}
 }else if(mode==='camera-tunnel'){
  for(let z=-100;z<last.z+3600;z+=280){const p=vec(Math.sin(z/920*.75)*200,Math.cos(z/920*.5)*70,z);path(c,f,[plus(p,vec(-940,-500)),plus(p,vec(940,-500)),plus(p,vec(940,480)),plus(p,vec(-940,480)),plus(p,vec(-940,-500))],z%840===740?red:fg,1.2,.25)}
  for(let side of [-1,1])path(c,f,[vec(side*940,480,-300),vec(side*940,480,last.z+5000)],red,2,.5);
 }else if(mode==='camera-horizon'){
  for(let k=0;k<17;k++){const ps=[];for(let g=-1;g<=n+4;g+=.1){const p=cameraStationPosition(mode,g,n);ps.push(plus(p,vec(0,180+k*31+Math.sin(g*.9)*25,k*25)))}path(c,f,ps,k===0?red:fg,k===0?3:.8,k===0?.6:.15)}
 }else if(mode==='camera-wall'){
  for(let x=-1300;x<=1300;x+=130)path(c,f,[vec(x,1200),vec(x,last.y-1200)],x===0?red:fg,x===0?2:1,x===0?.55:.1);
  for(let g=0;g<n;g++){const p=cameraStationPosition(mode,g,n);path(c,f,[plus(p,vec(-850,330)),plus(p,vec(850,330))],red,2,.4);path(c,f,[plus(p,vec(-850,338)),plus(p,vec(850,338))],fg,.8,.17)}
 }else if(mode==='camera-pullback'){
  for(let g=0;g<n;g++){const p=cameraStationPosition(mode,g,n);path(c,f,[plus(p,vec(-650,-210)),plus(p,vec(-690,-210)),plus(p,vec(-690,230)),plus(p,vec(650,230))],fg,1,.22);path(c,f,[plus(p,vec(-650,250)),plus(p,vec(-350,250))],red,5,.6)}
  path(c,f,routePoints(stations,0,false),red,1,.2);
 }else if(mode==='camera-micro'){
  for(let g=0;g<n;g++){const p=cameraStationPosition(mode,g,n);for(let k=0;k<4;k++)path(c,f,[plus(p,vec(-570,-230-k*12)),plus(p,vec(590,-230-k*12))],k===0?red:fg,k===0?2:1,k===0?.65:.1);path(c,f,[plus(p,vec(-580,-250)),plus(p,vec(-580,330)),plus(p,vec(610,330))],fg,1,.22)}
 }
 c.restore();return true;
}

export function drawCameraTypography(c,e,h,_layout){
 const f=sampleCameraChoreography(c,e,h);if(!f)return false;
 c.save();if(e.s.direction?.photo){c.shadowColor='rgba(0,0,0,.8)';c.shadowBlur=12;}
 // Far planes are painted first. Onset opacity comes exclusively from word().
 for(const pose of [...f.poses].sort((a,b)=>(b.depth||0)-(a.depth||0))){
  if(!pose.visible)continue;
  const color=(e.s.direction?.heroIds||[]).includes(pose.w.id)?e.accent:(e.s.direction?.light?e.ink:e.paper);
  h.word(c,pose.w,e.t,pose.x,pose.y,pose.size,{family:pose.family,color,scale:pose.scale,rotate:pose.rotate,opacity:pose.opacity,motion:'none'});
 }
 c.restore();return true;
}
