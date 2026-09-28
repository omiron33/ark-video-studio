import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const dir=path.dirname(fileURLToPath(import.meta.url));
const load=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
const alignment=load('sources/words.json');
const phrases=alignment.phrases.map((p,i)=>({...p,index:i+1,words:p.wordIds.map(id=>alignment.words.find(w=>w.id===id))}));
if(phrases.length!==39||phrases.some(p=>p.words.some(w=>!w||!Number.isFinite(w.start)))) throw Error('Measured complete 39-phrase words.json is required');
const duration=219.96;
const specs=[
 ['gathering-shepherd','Words gather under a crook drawn around the phrase; shepherd becomes the quiet anchor.',[3,2],125,295,1010,'left'],
 ['opening-nothing','Surrounding words open away from nothing; the emptied aperture remains spacious.',[4,1],170,335,1060,'left'],
 ['growing-grass','Individual letters grow upright from their roots into a green-grass horizon.',[4,2],120,310,1080,'left'],
 ['dwelling-threshold','A roof and doorway are built around dwell as the preceding line crosses its threshold.',[4,2],200,350,970,'left'],
 ['nourishing-bowl','The sentence is carried upward from a shallow bowl trajectory and settles as nourished expands.',[2,2],155,300,1070,'left'],
 ['resting-water','Words roll across one receding wave; the final rest settles onto an almost level waterline.',[3,2],200,350,1060,'left'],
 ['restoring-soul','Separated letters of restored and soul reunite; the sentence resolves from fractured to whole.',[3,2],170,260,1060,'left'],
 ['guided-thread','Each exact word follows a bent guide thread; the thread straightens toward the human connection.',[2,2],220,350,1070,'left'],
 ['righteous-path','A stair of tilted word planes straightens into an unbroken path beneath righteousness.',[4,1],140,295,1140,'left'],
 ['name-signature','The phrase unfolds like a signature from its center; an authored line signs beneath name.',[2,2],185,380,1100,'left'],
 ['walking-ground','Words cross the rain line in consecutive grounded steps, becoming a shared readable sentence.',[3,2],140,285,1070,'left'],
 ['withdrawing-shadow','A long cast shadow separates from shadow and death while the exact words stay in the light.',[3,2],145,330,1050,'left'],
 ['courage-expansion','No grows into a protective opening while fear moves back and the phrase becomes level.',[3,2],160,260,1050,'left'],
 ['embracing-presence','With and me approach along two curving arms and stop within a shelter contour.',[3,2],130,320,1030,'left'],
 ['staff-unfold','Rod and staff pivot from strong vertical supports into a two-line editorial statement.',[3,2],150,255,1100,'left'],
 ['comfort-cradle','The phrase lowers into a visible supporting curve, then opens its tracking into a relaxed hold.',[2,2],175,340,1060,'left'],
 ['fear-clearing','The line clears a pair of shadow shutters; no evil occupies the opening they leave.',[3,2],150,300,1110,'left'],
 ['table-setting','Words arrive at distinct places around one drawn table and gather into two generous rows.',[4,3],120,160,1370,'left'],
 ['affliction-perimeter','Those who afflict arcs around an intact protected center before returning to the full sentence.',[4,4],145,185,1340,'left'],
 ['anointing-descent','Oil-shaped vertical traces touch down over head as that word rises to meet them.',[3,4],160,210,1330,'left'],
 ['cup-overflow','The words fill an implied cup from its base, crest and spill gently into their reading positions.',[3,3,3],150,185,1390,'left'],
 ['walking-depth-stations','A shallow camera journey passes word planes at successive depths and lands with them in one plane.',[3,2],135,300,1130,'left'],
 ['shadow-passage','Two architectural shadow planes slide apart around a stable, fully readable central line.',[3,2],150,325,1080,'left'],
 ['unfastening-fear','A binding line loosens around fear; the exact letters release into a broad and level no evil.',[3,2],190,270,1100,'left'],
 ['meeting-you-me','You and me traverse opposite arcs into a shared center, the other words holding the reading order.',[3,2],155,335,1050,'left'],
 ['lifting-supports','Two vertical supports lift rod and staff into place; surrounding words bridge between them.',[3,2],165,285,1130,'left'],
 ['settling-comfort','Each word has a different damping arc that progressively becomes still beside comforted.',[2,2],175,370,1060,'left'],
 ['unbroken-declaration','After its full reading interval, the exact letters assemble into one continuous protective arch across the caregivers.',[3,2],165,315,1080,'left'],
 ['following-mercy','Mercy leads a slow travelling line; the remaining words follow its curved wake into exact order.',[2,3],120,300,1150,'left'],
 ['days-orbit','Days cross a segment of a great circular path; life becomes its stationary center of gravity.',[3,3],165,355,1100,'left'],
 ['mercy-material','Generated organic motion becomes a shared contour behind exact mercy glyphs; letter counters remain clear.',[2,3],135,280,1130,'left'],
 ['life-continuum','The phrase is drawn across an unbroken horizon; the camera settles while the horizon continues beyond it.',[3,3],165,370,1130,'left'],
 ['quiet-courage','A distant plane carrying fear approaches and becomes human-sized; no evil opens slowly beside it.',[3,2],130,300,1110,'left'],
 ['shared-shelter','With me rises together inside two nested contours that gently converge without enclosing the people.',[3,2],120,345,1090,'left'],
 ['shepherd-homeward','The Lord is my follows a returning path into shepherd, which unfolds from a deep diagonal plane.',[3,2],160,280,1140,'left'],
 ['nothing-release','The exact word nothing settles as a surrounding oval opens into an infinite-looking horizontal line.',[4,1],190,360,1040,'left'],
 ['house-doorway','House and Lord become two reading stations in a single doorway; the rest passes through then settles.',[5,5],150,210,1430,'left'],
 ['long-time','Long gently extends the space around itself while the full phrase remains intact above a growing horizon.',[3,2],175,320,1120,'left'],
 ['final-anchor','The final shepherd becomes a fixed anchor as a surrounding circle resolves into the final open threshold.',[3,2],160,285,1130,'left']
];
// Recompose around actual inspected photographic gestures, rather than
// imposing the same title position on every modern-day situation.
for(const n of [15,16,17]){specs[n-1][3]=900;specs[n-1][4]=235+(n-15)*24;specs[n-1][5]=850;}
for(const n of [18,19,20,21]){specs[n-1][3]=205;specs[n-1][4]=54;specs[n-1][5]=1460;}
for(const n of [22,23,24]){specs[n-1][3]=860;specs[n-1][4]=300+(n-22)*28;specs[n-1][5]=875;}
for(const n of [25,26,27,28]){specs[n-1][3]=250;specs[n-1][4]=68;specs[n-1][5]=1320;}
// The second embodied-Jesus insert places three faces on the left. Continue
// the verse on its dark right wall, including the answering "with me" line.
specs[24][3]=900;specs[24][4]=325;specs[24][5]=875;
for(const n of [29,30,31,32]){specs[n-1][3]=840;specs[n-1][4]=260+(n%2)*24;specs[n-1][5]=920;}
specs[36][2]=[3,2,2,3];specs[36][3]=125;specs[36][4]=205;specs[36][5]=525;
for(const n of [38,39]){specs[n-1][3]=140;specs[n-1][4]=190;specs[n-1][5]=530;}
specs[32][2]=[2,1,2];specs[32][4]=150;specs[32][5]=780;
specs[37][2]=[3,1,1];specs[37][4]=115;
specs[14][2]=[1,1,1,1,1];specs[14][5]=430;
specs[27][2]=[5];specs[27][4]=118;
specs[30][2]=[1,1,3];specs[30][3]=840;specs[30][4]=160;specs[30][5]=940;
specs[30][1]='A prominent canonical mercy shares its exact reading station with generated golden filaments, then hands off to the fully formed generated word after the sung reading interval.';
const starts=[0,phrases[0].start,phrases[4].start,phrases[6].start,phrases[10].start,phrases[14].start,phrases[17].start,phrases[21].start,phrases[24].start,phrases[28].start,phrases[32].start,phrases[36].start,duration];
const acts=starts.slice(0,-1).map((start,i)=>({id:`act-${String(i+1).padStart(2,'0')}`,photo:[4,7].includes(i)?`assets/photos/p${String(i+1).padStart(2,'0')}-jesus.png`:`assets/photos/p${String(i+1).padStart(2,'0')}.png`,start:Math.max(0,start-.38),end:starts[i+1]+(i===11?0:.38),index:i+1}));
const metricInput=[];
for(let i=0;i<phrases.length;i++){
 const p=phrases[i],spec=specs[i];
 Object.assign(p,{family:spec[0],intent:spec[1],lineCounts:spec[2],x:spec[3],y:spec[4],maxWidth:spec[5],align:spec[6],showStart:Math.max(0,p.start-.075),showEnd:i<38?phrases[i+1].start-.065:Math.max(p.end+.75,205.5)});
 p.showEnd=Math.max(p.showEnd,p.end+.04);
 p.act=acts.findLast(a=>p.start>=a.start+.1)?.id||acts[1].id;
 let wi=0;
 p.rows=p.lineCounts.map((count,ri)=>{
  const words=p.words.slice(wi,wi+count);wi+=count;
  let italic=ri===p.lineCounts.length-1||(p.index===37&&ri===1)||(p.index===15&&ri===1)||(p.index===31&&ri===1);
  if(p.index===17&&ri===1)italic=false; // Upright no/evil stays clear on small screens.
  let size=italic?156:111;
  if(p.lineCounts.length===3)size=italic?137:102;
  if(p.index>=18&&p.index<=21)size=italic?126:106;
  if(p.index===21)size=italic?108:94;
  if(p.index===37)size=italic?145:107;
  if(p.index===31)size=[105,410,126][ri];
  if(p.index===17&&ri===1)size=156;
  // The italic h in this one hospital line repeatedly reads as b to native
  // Apple OCR. Keep the lyric large, but use the clearer upright face.
  if(p.index===11&&ri===1){italic=false;size=156;}
  const row={words:words.map(w=>w.id),font:italic?'italic':'regular',size};
  metricInput.push({id:p.id+'-row'+ri,words:words.map(w=>w.text),font:row.font,size,maxWidth:p.maxWidth});
  return row;
 });
 if(wi!==p.words.length)throw Error('Wrong word row grouping: '+p.id);
}
const metricProgram=String.raw`import json,sys
from PIL import ImageFont
root=sys.argv[1]
inp=json.load(sys.stdin)
out={}
for row in inp:
 size=row['size']
 filename='EBGaramond-Italic.ttf' if row['font']=='italic' else 'CormorantGaramond.ttf'
 while True:
  f=ImageFont.truetype(root+'/assets/fonts/'+filename,size)
  try:
   axes=f.get_variation_axes()
   f.set_variation_by_axes([400 if a['name']==b'Weight' else a['default'] for a in axes])
  except Exception:pass
  widths=[f.getlength(w) for w in row['words']]
  gap=f.getlength(' ')*1.08
  total=sum(widths)+gap*(len(widths)-1)
  if total<=row['maxWidth'] or size<76:break
  size-=1
 out[row['id']]={'size':size,'widths':widths,'gap':gap,'total':total}
json.dump(out,sys.stdout)`;
const measured=spawnSync('python3',['-c',metricProgram,dir],{input:JSON.stringify(metricInput),encoding:'utf8'});
if(measured.status!==0)throw Error(measured.stderr);
const metrics=JSON.parse(measured.stdout);
for(const p of phrases){let y=p.y;p.rows.forEach((r,ri)=>{Object.assign(r,metrics[p.id+'-row'+ri]);if(p.index===37)y=[205,335,205,335][ri];if(p.index===15)y=[220,355,320,220,355][ri];if(p.index===31)y=[155,124,635][ri];r.y=y;let x=p.index===37?(ri<2?125:1255):p.index===15?[900,900,1240,1420,1415][ri]:p.index===31?[1140,842,940][ri]:p.x+(ri?35:0);r.words.forEach((id,ii)=>{const w=p.words.find(w=>w.id===id);Object.assign(w,{x,y,width:r.widths[ii]+8,size:r.size,font:r.font,row:ri});x+=r.widths[ii]+r.gap;});y+=r.size*1.13;});}
const videos=[
 {id:'shelter',src:'assets/video/shelter-motion.mp4',poster:'assets/video/shelter-last.png',start:5.2,end:10.366667,holdEnd:14.9,opacity:.44,mode:'shelter'},
 {id:'water',src:'assets/video/water-motion.mp4',poster:'assets/video/water-last.png',start:phrases[5].start+.06,end:phrases[5].start+5.226667,holdEnd:phrases[6].start,opacity:.35,mode:'water'},
 {id:'soul-repair',src:'assets/video/animation-soul-motion.mp4',poster:'assets/video/animation-soul-last.png',start:phrases[6].start,end:phrases[6].start+5.166667,holdEnd:phrases[6].start+5.166667,opacity:.46,mode:'animation',kind:'organic'},
 {id:'jesus-pov',src:'assets/video/jesus-pov-rescue.mp4',poster:'assets/video/jesus-pov-rescue-last.png',start:phrases[12].start,end:phrases[12].start+175/24,holdEnd:phrases[14].start-.01,opacity:1,mode:'jesus',kind:'narrative'},
 {id:'jesus-with-people',src:'assets/video/jesus-with-people.mp4',poster:'assets/video/jesus-with-people-last.png',start:phrases[23].start,end:phrases[23].start+175/24,holdEnd:phrases[25].start-.01,opacity:1,mode:'jesus',kind:'narrative'},
 {id:'mercy',src:'assets/video/mercy-motion.mp4',poster:'assets/video/mercy-last.png',start:phrases[30].start+.06,end:phrases[30].start+5.226667,holdEnd:phrases[30].showEnd,opacity:1,mode:'mercy'},
 {id:'life-weave',src:'assets/video/animation-life-motion.mp4',poster:'assets/video/animation-life-last.png',start:phrases[31].start,end:phrases[31].start+5.166667,holdEnd:phrases[31].start+5.166667,opacity:.46,mode:'animation',kind:'organic'}
];
const data={title:'Psalm 23',duration,fps:30,width:1920,height:1080,phrases,acts,videos,audio:'sources/32885123-f4b6-42e6-a546-f4acba404829.m4a',alignmentStatus:alignment.status};
const mercyWord=phrases[30].words.find(w=>w.text.toLowerCase()==='mercy');
const glyphMask='';
const h=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const rainPaths=seed=>Array.from({length:52},(_,k)=>{const x=(k*431+seed*167)%1920,y=(k*313+seed*47)%1320-180,length=13+(k*19+seed)%30;return `<path d="M ${x} ${y} l -${Math.round(length*.24)} ${length}"/>`;}).join('');
const ripplePaths='<ellipse cx="510" cy="800" rx="95" ry="16"/><ellipse cx="875" cy="842" rx="132" ry="19"/><ellipse cx="315" cy="885" rx="61" ry="11"/>';
const photoHTML=acts.map((a,i)=>{const n=i+1,rain=[1,5,10].includes(n),ripple=n===3,shadow=[5,8].includes(n);return `<section class="clip photo-act" id="${a.id}" data-start="${a.start}" data-duration="${a.end-a.start}" data-track-index="${i%2}" data-layout-ignore><div class="photo-wrap"><img class="photo" src="${a.photo}" alt="" /><div class="act-light" data-layout-ignore></div>${shadow?'<div class="act-shadow" data-layout-ignore></div>':''}${rain?`<svg class="act-rain" viewBox="0 0 1920 1080" data-layout-ignore>${rainPaths(n)}</svg>`:''}${ripple?`<svg class="act-ripple" viewBox="0 0 1920 1080" data-layout-ignore>${ripplePaths}</svg>`:''}</div></section>`;}).join('\n');
const pathsFor=p=>{
 const x=p.x-35,y=p.y+65,w=Math.min(1350,p.maxWidth+80),b=p.rows.at(-1).y+p.rows.at(-1).size*.93;
 const generic=[`M ${x-120} ${b+60} C ${x+120} ${b-40}, ${x+w*.48} ${b+180}, ${x+w} ${b-30}`,`M ${x-50} ${y-50} C ${x+w*.32} ${y-200}, ${x+w*.85} ${y-90}, ${x+w+250} ${y+110}`];
 const n=p.index;
 if(n===31)return ['M 840 640 C 1080 600,1220 670,1405 620 S 1700 640,1820 570','M 875 665 C 1060 615,1300 702,1520 660 S 1720 590,1820 610'];
 if(n===2)return [`M ${x-40} ${b+90} L ${x+190} ${b+90} M ${x+w-250} ${b+90} L ${x+w+160} ${b+90}`,`M ${x+w*.65} ${y-90} L ${x+w*.65} ${y+20} M ${x+w*.65} ${b+110} L ${x+w*.65} ${b+220}`];
 if(n===3)return [`M ${x-100} ${b+150} Q ${x+400} ${b+60},${x+w+200} ${b+130}`,`M ${x+30} ${b+140} Q ${x+60} ${b+10},${x+25} ${b-30} M ${x+170} ${b+110} Q ${x+100} ${b+30},${x+130} ${b-50} M ${x+w-90} ${b+100} Q ${x+w-130} ${b-30},${x+w-80} ${b-80}`];
 if(n===4)return [`M ${x-65} ${b+130} L ${x-65} ${y+20} L ${x+w*.42} ${y-140} L ${x+w*.9} ${y+20} L ${x+w*.9} ${b+130}`,`M ${x+15} ${b+150} L ${x+w*.83} ${b+150}`];
 if(n===7)return [`M ${x-40} ${b+40} Q ${x+110} ${b+140},${x+260} ${b+50} T ${x+560} ${b+50} T ${x+860} ${b+50}`,`M ${x+260} ${b+50} Q ${x+450} ${b-50},${x+660} ${b+50} T ${x+1050} ${b+50}`];
 if(n===10)return [`M ${x+120} ${b+80} C ${x+380} ${b-30},${x+640} ${b+170},${x+860} ${b+65} C ${x+760} ${b-30},${x+950} ${b+10},${x+1100} ${b+65}`,`M ${x+70} ${b+105} L ${x+850} ${b+105}`];
 if(n===18)return ['M 20 928 Q 785 752,1900 850','M 20 968 Q 815 819,1920 908'];
 if(n===19)return ['M 80 850 C 530 790,1380 830,1840 878','M 160 936 Q 1120 766,1850 945'];
 if(n===20)return ['M 1500 60 C 1510 130,1560 164,1537 199 C 1518 230,1470 215,1479 181 C 1490 142,1508 117,1500 60','M 1360 270 C 1420 340,1590 330,1690 250'];
 if(n===21)return ['M 1270 105 L 1292 204 Q 1315 302,1420 302 Q 1515 302,1536 204 L 1556 105 M 1280 127 Q 1400 173,1548 126','M 1550 151 C 1640 135,1650 256,1540 255 M 1260 324 Q 1420 352,1590 321'];
 if([1,4,14,25,34,37,39].includes(n))return [`M ${x-40} ${b+80} C ${x-140} ${y-230},${x+w*.4} ${y-350},${x+w*.79} ${y-160} S ${x+w+400} ${b-200},${x+w+170} ${b+160}`,`M ${x-100} ${b+110} C ${x+w*.3} ${b-80},${x+w*.75} ${b+170},${x+w+340} ${b-70}`];
 if([6,16,21,27].includes(n))return [`M ${x-200} ${b+10} C ${x+100} ${b-40},${x+250} ${b+210},${x+w*.6} ${b+125} S ${x+w+200} ${b+5},${x+w+400} ${b+100}`,`M ${x-200} ${b+60} C ${x+300} ${b+30},${x+w*.4} ${b+260},${x+w} ${b+160} S ${x+w+220} ${b+100},${x+w+500} ${b+190}`];
 if([8,9,11,22,29,31,32,35].includes(n))return [`M ${x-170} ${b+200} C ${x+100} ${b-40},${x+270} ${b+220},${x+w*.65} ${b+65} S ${x+w+180} ${y-90},${x+w+430} ${y-210}`,`M ${x-170} ${b+230} C ${x+70} ${b+20},${x+350} ${b+240},${x+w*.66} ${b+110} S ${x+w+200} ${y-10},${x+w+470} ${y-160}`];
 if([15,26].includes(n))return [`M ${x+80} ${b+210} L ${x+80} ${y-120} Q ${x+110} ${y-220},${x+180} ${y-140}`,`M ${x+w-60} ${b+210} L ${x+w-60} ${y-60} Q ${x+w-130} ${y-220},${x+w-240} ${y-90}`];
 if([30,36,38].includes(n))return [`M ${x-130} ${b+90} C ${x-100} ${y-230},${x+w*.5} ${y-260},${x+w+180} ${b+50} C ${x+w*.7} ${b+270},${x+w*.3} ${b+200},${x-130} ${b+90}`,`M ${x-150} ${b+165} L ${x+w+500} ${b+165}`];
 return generic;
};
const lyricHTML=phrases.map(p=>{
 const perGlyphFamilies=new Set(['growing-grass','resting-water','restoring-soul','staff-unfold','comfort-cradle','unfastening-fear','settling-comfort','long-time']);
 const words=p.words.map(w=>{const needsGlyphs=perGlyphFamilies.has(p.family)||(p.family==='walking-ground'&&w.text.toLowerCase().includes('walk'))||(p.family==='anointing-descent'&&w.text.toLowerCase().includes('oil'));const content=needsGlyphs?[...w.text].map((c,i)=>`<span class="letter" data-letter="${i}">${h(c)}</span>`).join(''):h(w.text);return `<span id="${w.id}" class="word ${w.font}" data-word-id="${w.id}" data-phrase-id="${p.id}" data-word-start="${w.start}" data-word-end="${w.end}" style="left:${w.x}px;top:${w.y}px;width:${w.width+18}px;height:${w.size*1.37}px;font-size:${w.size}px"><span class="ink">${content}</span></span>`;}).join('');
 const paths=pathsFor(p).map((d,i)=>`<path id="${p.id}-path-${i}" class="contour contour-${i}" d="${d}"/>`).join('');
 return `<section id="${p.id}" class="clip lyric-scene" data-start="${p.showStart}" data-duration="${p.showEnd-p.showStart}" data-track-index="5" aria-label="${h(p.text)}"><div class="scene-inner"><svg class="contours" viewBox="0 0 1920 1080" data-layout-ignore>${paths}</svg><div class="lens"><div class="word-world">${words}</div></div><svg class="front-contours" viewBox="0 0 1920 1080" data-layout-ignore><path class="accent-line" d="M ${p.x-20} ${p.rows.at(-1).y+p.rows.at(-1).size*1.02} Q ${p.x+p.maxWidth*.5} ${p.rows.at(-1).y+p.rows.at(-1).size*1.32},${p.x+p.maxWidth+40} ${p.rows.at(-1).y+p.rows.at(-1).size*.99}"/></svg><div class="shadow-left" data-layout-ignore></div><div class="shadow-right" data-layout-ignore></div></div></section>`;
}).join('\n');
const videoHTML=glyphMask+videos.map(v=>{const pose=v.id==='mercy'?`style="left:735px;top:145px;width:1160px;height:652.5px"`:'';const narrative=v.kind==='narrative',layer=narrative?'narrative':'organic',track=narrative?2:3;return `<video id="video-${v.id}" class="clip ${layer}-video ${v.mode}" ${pose} src="${v.src}" data-start="${v.start}" data-duration="${v.end-v.start}" data-media-start="0" data-track-index="${track}" muted playsinline preload="auto" data-layout-ignore></video><section class="clip ${layer}-still ${v.mode}" ${pose} id="poster-${v.id}" data-start="${v.end}" data-duration="${Math.max(.01,v.holdEnd-v.end)}" data-track-index="${track}" data-layout-ignore><img src="${v.poster}" alt=""/></section>`}).join('\n');
let html=fs.readFileSync(path.join(dir,'composition.html.txt'),'utf8').replace('<!--PHOTOS-->',photoHTML).replace('<!--VIDEOS-->',videoHTML).replace('<!--LYRICS-->',lyricHTML).replace('/*DATA*/',`window.P23_DATA=${JSON.stringify(data)};`).replace('/*OPENING*/',fs.readFileSync(path.join(dir,'opening.js'),'utf8')).replace('/*SEMANTIC*/',fs.existsSync(path.join(dir,'semantic-motion.js'))?fs.readFileSync(path.join(dir,'semantic-motion.js'),'utf8'):'').replace('/*CHOREOGRAPHY*/',fs.readFileSync(path.join(dir,'choreography.js'),'utf8'));
fs.writeFileSync(path.join(dir,'index.html'),html);
const inspiration={referenceIds:['internal-foreground-occlusion','internal-genesis1-whale-word-composite','external-microtype-image-world'],referenceNotes:'concepts/reference-notes.md',principle:'Read each exact word clearly; use a common contour material to connect photographic depth, generated organic motion and editable typography.',adaptation:'New amber shelter curves trace ordinary home thresholds and family gestures. Readable words share those shapes; generated water shares a clear reading plane; canonical mercy hands off at the same station to the fully formed generated word. Green glyphs sprout stems after reading, projected shadow words retreat through a soft light boundary, and declaration letters construct a continuous arch. No source scene or motion sequence is copied.',approvalScope:'Shane selected theme1 only; reference excerpts are inspiration, not individually user-approved.'};
const revisionReferences={
 'p23-l007':{referenceIds:['internal-psalm91-dust-lion'],principle:'Material gains coherent form over time.',adaptation:'Broken gold fibers repair a soul-shaped loop while exact foreground lyrics remain readable.'},
 'p23-l013':{referenceIds:['external-window-releases-subject','internal-psalm23-mercy-material-handoff'],principle:'Move the person and retreating dark boundary independently while preserving the canonical reading.',adaptation:'From Jesus’s viewpoint, a crying woman sees the offered hand, clasps it and begins to rise while warm light grows.'},
 'p23-l014':{referenceIds:['external-window-releases-subject'],principle:'Keep the rescued person present as darkness recedes.',adaptation:'Her gaze reaches the camera and she smiles while Jesus draws her toward him and warmer light.'},
 'p23-l024':{referenceIds:['external-window-releases-subject','external-microtype-image-world'],principle:'Let the human group and shadow threshold move separately, with a restrained shared light motif.',adaptation:'A deliberate cut from the underpass still moves to a present-day hospital corridor; Jesus guides a father and daughter toward its warm doorway while the lyric stays on the dark right wall.'},
 'p23-l025':{referenceIds:['external-window-releases-subject'],principle:'The people remain visible while the dark corridor falls behind them.',adaptation:'The group takes small visible steps into warmer doorway light; the responding words remain clear on the right wall.'},
 'p23-l032':{referenceIds:['internal-psalm23-mercy-material-handoff'],principle:'Generated material follows, rather than replaces, a fully read canonical word.',adaptation:'Golden life filaments travel along the modern path below editable lyrics.'}
};
const sceneInspiration=p=>revisionReferences[p.id]?{...revisionReferences[p.id],referenceNotes:'concepts/revision-v3.md',status:'implemented_pending_encoded_review',approvalScope:'Shane requested this revision; visual acceptance awaits encoded inspection.'}:inspiration;
fs.writeFileSync(path.join(dir,'scene-plan.json'),JSON.stringify({version:1,title:data.title,theme:'Held in the Ordinary',duration,width:1920,height:1080,fps:30,palette:{background:'#171c15',foreground:'#fff1d4',accent:'#d9b574'},fonts:['assets/fonts/CormorantGaramond.ttf','assets/fonts/EBGaramond-Italic.ttf'],direction:{inspiration,revision:'concepts/revision-v3.md'},acts,videos,scenes:phrases.map(p=>({id:p.id,text:p.text,start:p.showStart,end:p.showEnd,sourceStart:p.start,sourceEnd:p.end,choreography:p.family,intent:p.intent,photo:acts.find(a=>a.id===p.act)?.photo,words:p.words.map(({id,text,start,end,x,y,width,size,font})=>({id,text,start,end,x,y,width,size,font})),inspiration:sceneInspiration(p)})),assets:[data.audio,...acts.map(a=>a.photo),...videos.flatMap(v=>[v.src,v.poster]),'assets/fonts/CormorantGaramond.ttf','assets/fonts/EBGaramond-Italic.ttf','vendor/gsap.min.js'],choreographyAudit:{authoredBranches:39,maxBranchUses:1,verifiedDistinctFamilies:null,verifiedMaxFamilyUses:null,status:'awaiting_encoded_independent_motion_review',mechanismAudit:'Thirteen effective semantic handlers plus twenty-six main branches implement named relationships. Branch count is not accepted evidence of perceptual variety; independent decoded-output review must group equivalent mechanisms and verify at least30 with no group used more than3.'}},null,2)+'\n');
console.log(`Built ${phrases.length} measured phrases, ${alignment.words.length} exact words, ${acts.length} unique photographic acts, ${duration}s. All external media must exist before check/render.`);
