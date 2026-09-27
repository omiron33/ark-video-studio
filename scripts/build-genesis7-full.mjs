#!/usr/bin/env node
/** Author the complete Genesis 7 film without changing any source lyric or cue.
 * node scripts/build-genesis7-full.mjs --input projects/genesis7-full/project.json \
 *   --output projects/genesis7-full/film.json --report research/fullsong-scene-plan.md
 * --plan-only writes only an explicitly provisional report; it never writes a manifest.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { atomicJson, validateProject } from '../engine/project.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const KEY=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
const pid=(s,l)=>`g7-s${String(s).padStart(2,'0')}-l${String(l).padStart(2,'0')}`;
const range=(s,a,b=a)=>Array.from({length:b-a+1},(_,i)=>pid(s,a+i));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clone=value=>structuredClone(value);
const BOX={
 wide:{x:150,y:190,w:1620,h:650}, left:{x:170,y:235,w:1260,h:600},
 right:{x:520,y:205,w:1220,h:635}, upper:{x:180,y:150,w:1560,h:570},
 lower:{x:175,y:335,w:1550,h:570}, slim:{x:300,y:190,w:1320,h:640},
 tall:{x:210,y:150,w:1500,h:720}, horizon:{x:160,y:165,w:1600,h:460},
};
const PHOTO_FILES={
 'ark-before':'ark-before-gpt.png',household:'household-threshold-gpt.png',animals:'animal-pairs-gpt.png',
 interior:'ark-interior-gpt.png','ark-afloat':'ark-afloat-gpt.png',door:'door-seam-gpt.png',
 fields:'drowned-fields-gpt.png',endless:'ark-endless-gpt.png',timber:'rain-timber-gpt.png',
};
function spec(id,s,a,b,mode,layout,extra={}) {return {id,phraseIds:range(s,a,b),mode,layout,...extra};}

// Every entry is a continuing composition, not a generic title card per lyric line.
export const SCENE_PLAN=[
 spec('the-voice',1,0,0,'names','left',{hero:['lord','noah'],rows:[['Then the Lord','said to Noah']]}),
 spec('come-household',1,1,2,'gateway','left',{photo:'household',hero:['come','ark','household'],pan:-1,exitThrough:{x:1280,y:620},rows:[['Come into the ark'],['You and all','your household']]}),
 spec('walking-rightly',1,3,4,'gateway','right',{hero:['rightly','generation'],light:true}),
 spec('seven-pairs',1,5,6,'pairs','upper',{number:7,hero:['clean','seven','pairs'],rows:[['Take with you','the clean animals'],['Seven pairs','of every kind']]}),
 spec('together',1,7,7,'pairs','lower',{photo:'animals',number:2,hero:['male','female','together'],rows:[['Male and female','together']]}),
 spec('one-pair',1,8,10,'pairs','left',{number:1,hero:['one','pair'],rows:[['Of the animals','not counted clean'],['Take one pair'],['Male and female']]}),
 spec('bird-pairs',1,11,11,'birds','upper',{photo:'animals',pan:1,zoom:1.2,hero:['seven','pairs','birds'],rows:[['Take also seven pairs','of the birds']]}),
 spec('continuation',1,12,13,'birds','horizon',{hero:['continue','across','earth'],light:true}),
 spec('seven-more-days',3,0,0,'calendar','wide',{number:7,hero:['seven','days'],rows:[['God said For after','seven more days']]}),
 spec('rain-will-fall',3,1,1,'rain','left',{photo:'timber',rain:true,hero:['rain','fall'],rows:[['Rain will fall','upon the earth']]}),
 spec('forty-days-sweep',3,2,5,'sweep','wide',{number:40,hero:['forty','nights','sweep','away','ground'],rows:[['For forty days'],['And forty nights'],['I will sweep away'],['From the face of the ground']]}),
 spec('made-and-commanded',3,6,9,'enclosure','right',{hero:['living','made','noah','commanded'],rows:[['Every living thing'],['That I have made'],['And Noah did'],['Everything the Lord commanded']]}),
 spec('six-hundred-years',5,0,0,'calendar','wide',{number:600,hero:['six','hundred','years'],layoutSpecial:'age',rows:[['Noah was','six hundred','years old']]}),
 spec('waters-came',5,1,1,'rain','left',{photo:'timber',rain:true,hero:['waters','earth'],rows:[['When the waters came','upon the earth']]}),
 spec('sons-enter',5,2,6,'names','wide',{hero:['noah','entered','shem','ham','japheth'],layoutSpecial:'names',rows:[['Noah entered the ark'],['And with him came his sons'],['Shem'],['Ham'],['And Japheth']]}),
 spec('wives-enter',5,7,8,'family','right',{photo:'household',pan:1,zoom:1.18,number:4,hero:['wife','wives','sons']}),
 spec('all-creature-paths',5,9,13,'birds','left',{hero:['animals','unclean','birds','ground'],rows:[['The animals came also'],['Clean and unclean Birds of the air'],['And every creature'],['That moved along the ground']]}),
 spec('ordered-entry',5,14,16,'pairs','upper',{photo:'animals',pan:-1,hero:['pairs','male','female','commanded'],number:7}),
 spec('seven-days-passed',7,0,1,'calendar','wide',{light:true,number:7,hero:['seven','passed','waters'],rows:[['Seven days passed'],['Then the waters came']]}),
 spec('the-date',7,2,5,'calendar','left',{number:17,hero:['hundredth','second','seventeenth'],rows:[['In the six hundredth year'],['Of Noah’s life'],['In the second month'],['On the seventeenth day']]}),
 spec('deep-breaks-open',7,6,8,'rupture','wide',{hero:['deep','broke','open','beneath','burst'],trigger:'broke',rows:[['The great deep','broke open'],['The fountains beneath the earth'],['Burst from their places']]}),
 spec('heavens-open',7,9,9,'rupture','upper',{photo:'timber',rain:true,hero:['heavens','opened','above'],trigger:'opened',rows:[['And the heavens','opened above']]}),
 spec('rain-poured',7,10,12,'rain','wide',{light:true,number:40,hero:['rain','poured','forty'],rows:[['Rain poured upon the earth'],['For forty days'],['And forty nights']]}),
 spec('same-day-family',9,0,3,'names','lower',{photo:'household',pan:-1,hero:['noah','entered','shem','ham','japheth'],rows:[['That same day Noah','entered the ark'],['With Shem Ham','And Japheth']]}),
 spec('household-together',9,4,5,'family','right',{number:4,hero:['wife','wives'],light:true}),
 spec('every-kind',9,6,7,'pairs','left',{photo:'animals',pan:1,number:7,hero:['beast','animal','kind']}),
 spec('ground-and-wing',9,8,9,'birds','upper',{hero:['ground','bird','winged'],rows:[['Every creature','moving on the ground'],['Every bird','and every winged thing']]}),
 spec('two-by-two',9,10,11,'pairs','wide',{number:2,hero:['two','noah'],layoutSpecial:'pairs',rows:[['They came to Noah'],['Two by two']]}),
 spec('breath-of-life',9,12,12,'breath','lower',{photo:'interior',hero:['breath','life'],rows:[['All carrying','the breath of life']]}),
 spec('within-the-hull',9,13,15,'shelter','left',{hero:['entered','ark','commanded']}),
 spec('the-door-seals',9,16,16,'seal','wide',{photo:'door',pan:0,tilt:0,hero:['lord','shut','in'],trigger:'shut',rows:[['Then the Lord','shut them in']]}),
 spec('flood-rises-forty',12,0,0,'calendar','wide',{number:40,hero:['flood','rose','forty'],rows:[['The Flood rose','for forty days']]}),
 spec('lifted-the-ark',12,1,3,'lift','left',{photo:'ark-afloat',waterline:.76,rain:true,hero:['increased','lifted','ark','high'],trigger:'lifted',rows:[['The waters increased'],['And lifted the ark'],['High above the earth']]}),
 spec('higher-stronger',12,4,5,'lift','tall',{light:true,hero:['higher','stronger'],trigger:'higher',rows:[['Higher they climbed'],['Stronger they became']]}),
 spec('across-the-water',12,6,7,'drift','upper',{photo:'ark-afloat',waterline:.76,rain:true,pan:-1,zoom:1.15,hero:['moved','across','waters'],rows:[['Until the ark moved'],['Across the face','of the waters']]}),
 spec('mountains-covered',12,8,11,'engulf','wide',{hero:['greatly','mountain','heaven','covered'],rows:[['The floodwaters grew greatly'],['And every high mountain'],['Beneath the whole heaven'],['Was covered']]}),
 {id:'approved-waters-rise',climax:0,phraseIds:range(12,12)},
 {id:'approved-highest-ground',climax:1,phraseIds:range(12,13)},
 {id:'approved-disappeared-below',climax:2,phraseIds:range(12,14)},
 spec('creatures-died',14,0,1,'absence','left',{hero:['creature','died'],rows:[['Then every creature'],['That moved upon','the earth died']]}),
 spec('categories-of-life',14,2,6,'absence','wide',{hero:['birds','livestock','beasts','things','mankind'],layoutSpecial:'categories',rows:[['Birds Livestock'],['Wild beasts'],['Creeping things'],['And mankind']]}),
 spec('breath-ends',14,7,9,'breath','right',{hero:['dry','breath','life','end'],rows:[['Everything on dry land'],['That carried the breath of life'],['Came to its end']]}),
 spec('fields-covered',14,10,11,'map','upper',{photo:'fields',water:true,hero:['covered','fields'],rows:[['The waters covered'],['What once had been fields']]}),
 spec('roads-homes-ground',14,12,14,'map','left',{photo:'fields',water:true,hero:['roads','homes','ground'],layoutSpecial:'map',rows:[['Roads'],['Homes'],['And living ground']]}),
 spec('swept-away',16,0,2,'sweep','wide',{light:true,hero:['living','earth','swept','away'],rows:[['Every living thing'],['Upon the face of the earth'],['Was swept away']]}),
 spec('taken-from-land',16,3,5,'absence','right',{hero:['man','beast','bird','taken','land'],rows:[['Man and beast'],['Creeping thing and bird'],['All were taken from the land']]}),
 spec('only-noah-within',16,6,7,'shelter','left',{photo:'interior',hero:['only','noah','with'],rows:[['Only Noah remained'],['And those who were with him']]}),
 spec('above-them',16,8,10,'horizon','upper',{hero:['inside','ark','above','waters','moved'],rows:[['Inside the ark'],['Above them'],['The waters still moved']]}),
 spec('old-world-gone',16,11,12,'absence','lower',{hero:['around','world','gone'],rows:[['Around them'],['The old world was gone']]}),
 spec('hundred-fifty-days',18,0,0,'calendar','wide',{number:150,hero:['hundred','fifty','days'],rows:[['For one hundred','and fifty days']]}),
 spec('waters-remain-strong',18,1,2,'horizon','horizon',{photo:'endless',waterline:.77,hero:['remained','strong','earth'],rows:[['The waters remained strong'],['Upon the earth']]}),
 spec('no-mountain-field',18,3,4,'absence','left',{hero:['no','mountain','field'],light:true,rows:[['No mountain stood','above them'],['No field broke through']]}),
 spec('no-road-voice',18,5,6,'absence','wide',{hero:['no','road','voice','outside'],rows:[['No road returned'],['No human voice','answered outside']]}),
 spec('only-the-ark',18,7,8,'horizon','upper',{photo:'endless',waterline:.77,pan:-1,hero:['only','ark','remained','endless'],rows:[['Only the ark remained'],['Upon the endless waters']]}),
 spec('preserved-within',18,9,12,'shelter','left',{photo:'interior',pan:1,hero:['noah','household','creatures','preserved','within'],rows:[['Carrying Noah His household'],['And the living creatures'],['God had preserved within']]}),
 spec('fallen-covered',18,13,14,'rain','right',{hero:['rain','fallen','earth','covered'],rows:[['The rain had fallen'],['The earth was covered']]}),
 spec('judgment-darkened',18,15,16,'absence','wide',{hero:['judgment','darkened','heaven'],rows:[['The judgment had come'],['And beneath','a darkened heaven']]}),
 spec('waters-prevailed',18,17,17,'horizon','upper',{photo:'endless',waterline:.77,hero:['waters','still','prevailed'],rows:[['The waters','still prevailed']]}),
];

function phraseWords(p,ids) {const wanted=new Set(ids);return p.words.filter(w=>wanted.has(w.phraseId||w.id.replace(/-w\d+$/,'')));}
function splitRows(words,rows) {
 if(rows){
  const patterns=rows.flat().map(line=>line.split(/\s+/).map(KEY));
  const expected=patterns.flat(); const actual=words.map(w=>KEY(w.text));
  if(expected.join('|')!==actual.join('|'))throw new Error(`Authored rows differ from canonical lyrics: ${words.map(w=>w.text).join(' ')}`);
  let index=0;return patterns.map(row=>words.slice(index,index+=row.length).map(w=>w.id));
 }
 const groups=[];for(const word of words){const last=groups.at(-1);if(!last||last.pid!==word.phraseId)groups.push({pid:word.phraseId,words:[word]});else last.words.push(word)}
 return groups.flatMap(({words:ws})=>{
  const chars=ws.reduce((n,w)=>n+w.text.length+1,0);if(chars<=34)return [ws.map(w=>w.id)];
  let charsLeft=0,cut=1;for(let i=0;i<ws.length-1;i++){charsLeft+=ws[i].text.length+1;if(charsLeft<chars*.55)cut=i+1;}
  return [ws.slice(0,cut).map(w=>w.id),ws.slice(cut).map(w=>w.id)];
 });
}
function specialPositions(type,ws){
 const pos={};const get=(key,n=0)=>ws.filter(w=>KEY(w.text)===key)[n];
 const set=(word,x,y,size,rotate=0,family='Bebas Neue')=>{if(word)pos[word.id]={x,y,size,rotate,family};};
 if(type==='names'){
  // The sentence occupies the upper two rows. Three actual names form one lower row.
  set(get('shem'),430,835,160);set(get('ham'),960,835,160);set(get('and'),1300,835,82,0,'Cormorant Garamond');set(get('japheth'),1500,835,160);
  // Use the final And, not the earlier connector in "And with him".
  const ands=ws.filter(w=>KEY(w.text)==='and');if(ands.length>1){delete pos[ands[0].id];set(ands.at(-1),1260,835,82,0,'Cormorant Garamond');}
 }
 if(type==='pairs'){set(get('two'),600,760,270);set(get('by'),960,750,110,0,'Cormorant Garamond');set(get('two',1),1320,760,270);}
 if(type==='map'){set(get('roads'),580,390,190,-.035);set(get('homes'),1320,580,200,.025);const others=ws.filter(w=>!['roads','homes'].includes(KEY(w.text)));for(let i=0;i<others.length;i++)set(others[i],580+i*340,860,i===0?95:160,0,i===0?'Cormorant Garamond':'Bebas Neue');}
 if(type==='age'){set(get('noah'),600,315,170);set(get('was'),895,315,95,0,'Cormorant Garamond');set(get('six'),450,650,285);set(get('hundred'),1230,650,285);set(get('years'),745,880,160);set(get('old'),1220,880,160);}
 if(type==='categories'){set(get('birds'),460,350,165);set(get('livestock'),1310,350,175);set(get('wild'),560,550,150);set(get('beasts'),1020,550,180);set(get('creeping'),610,750,155);set(get('things'),1250,750,165);set(get('and'),655,920,95,0,'Cormorant Garamond');set(get('mankind'),1100,920,180);}
 // Other scenes use deliberately aligned rows: fitting preserves the actual font metrics.
 return pos;
}
function choreography(id,ws,lines){
 const actions=[],ids=ws.map(w=>w.id),find=k=>ws.find(w=>KEY(w.text)===k),last=ws.at(-1);
 const act=(trigger,targetIds,from,to,extra={})=>{if(trigger&&targetIds.length)actions.push({triggerId:trigger.id,targetIds,duration:.85,from,to,...extra});};
 const names=keys=>ws.filter(w=>keys.includes(KEY(w.text))).map(w=>w.id);
 switch(id){
  case 'come-household': act(find('come'),lines[0],{dx:-120},{dx:0});act(find('household'),lines.slice(1).flat(),{dx:100},{dx:0},{duration:1});break;
  case 'walking-rightly':act(find('rightly'),ids,{dx:-95},{dx:0});break;
  case 'seven-pairs':act(find('seven'),lines.slice(2).flat(),{dy:90},{dy:0},{duration:1.05});break;
  case 'together':act(find('together'),names(['male']),{dx:-100},{dx:0});act(find('together'),names(['female']),{dx:100},{dx:0});break;
  case 'one-pair':act(find('one'),lines.slice(2).flat(),{dx:120},{dx:0});break;
  case 'bird-pairs':act(find('birds'),ids,{dy:70},{dy:-45},{after:'end',duration:1.2});break;
  case 'continuation':act(find('across'),lines.slice(-1).flat(),{dx:-100},{dx:40},{duration:1.5});break;
  case 'seven-more-days':act(find('seven'),ids,{scale:.88},{scale:1},{origin:{x:960,y:540},duration:1.1});break;
  case 'sons-enter':{
   const group=ws.slice(10).map(w=>w.id);act(find('japheth'),group,{scale:1},{scale:.76},{origin:{x:960,y:835},after:'end',delay:.16,duration:.75});break;
  }
  case 'wives-enter':act(find('wives'),ids,{dx:105},{dx:0});break;
  case 'ordered-entry':act(find('pairs'),lines[0],{dx:-100},{dx:0});act(find('female'),lines[1],{dx:100},{dx:0});break;
  case 'the-date':act(find('seventeenth'),lines.at(-1),{dy:90},{dy:0});break;
  case 'deep-breaks-open':act(find('open'),lines[0],{dx:0},{dx:-105},{after:'end'});act(find('open'),lines[1],{dx:0},{dx:105},{after:'end'});break;
  case 'heavens-open':act(find('opened'),ids,{dy:0},{dy:-105},{after:'end'});break;
  case 'rain-poured':act(find('poured'),lines[0],{dy:-110},{dy:0},{duration:.7});break;
  case 'household-together':act(find('wives'),lines.at(-1),{dx:100},{dx:0});break;
  case 'every-kind':act(find('animal'),lines.at(-1),{dx:125},{dx:0});break;
  case 'ground-and-wing':act(find('winged'),lines.slice(-2).flat(),{dy:0},{dy:-75},{after:'end'});break;
  case 'two-by-two':act(find('two'),[find('two').id],{dx:-110},{dx:0});act(last,[last.id],{dx:110},{dx:0});break;
  case 'breath-of-life':act(find('breath'),ids,{scale:.9},{scale:1},{origin:{x:960,y:610},duration:1.1});break;
  case 'within-the-hull':act(find('entered'),ids,{dx:120},{dx:0});break;
  case 'lifted-the-ark':act(find('lifted'),ids,{dy:20},{dy:-80},{duration:1.3});break;
  case 'higher-stronger':act(find('higher'),lines[0],{dy:45},{dy:-55},{duration:1.15});act(find('stronger'),lines[1],{scale:.88},{scale:1},{origin:{x:960,y:700},duration:1.1});break;
  case 'across-the-water':act(find('across'),ids,{dx:-85},{dx:75},{duration:1.6});break;
  case 'fields-covered':act(find('covered'),lines.at(-1),{dy:0},{dy:75},{after:'end',duration:1.1});break;
  case 'only-noah-within':act(find('noah'),ids,{dx:-110},{dx:0},{duration:1});break;
  case 'above-them':act(find('above'),lines[1],{dy:0},{dy:-50},{after:'end'});break;
  case 'hundred-fifty-days':act(find('fifty'),ids,{scale:.89},{scale:1},{origin:{x:960,y:580},duration:1.2});break;
  case 'preserved-within':act(find('within'),ids,{dx:65},{dx:0},{duration:1.2});break;
 }
 return actions;
}
function storySection(p,plan){
 const ws=phraseWords(p,plan.phraseIds);if(!ws.length)throw new Error(`No words for ${plan.id}`);
 const lines=splitRows(ws,plan.rows);const direction={mode:plan.mode==='enclosure'?'shelter':plan.mode,label:'',marker:'',phraseIds:plan.phraseIds,lines,textBox:clone(BOX[plan.layout]),align:plan.layout==='left'?'left':plan.layout==='right'?'right':'center',typeSize:lines.length>=4?175:lines.length===3?225:285,heroIds:ws.filter(w=>plan.hero?.includes(KEY(w.text))).map(w=>w.id)};
 for(const key of ['photo','water','waterline','rain','pan','tilt','number','light','zoom','exitThrough'])if(plan[key]!==undefined)direction[key]=plan[key];
 if(plan.trigger)direction.triggerId=ws.find(w=>KEY(w.text)===plan.trigger)?.id;
 if(plan.layoutSpecial==='names'){
  direction.lines=[ws.slice(0,4).map(w=>w.id),ws.slice(4,10).map(w=>w.id),ws.slice(10).map(w=>w.id)];direction.textBox={x:170,y:150,w:1580,h:650};direction.typeSize=175;
 }
 const positions=specialPositions(plan.layoutSpecial,ws);if(Object.keys(positions).length)direction.positions=positions;
 const actions=choreography(plan.id,ws,direction.lines);if(actions.length)direction.actions=actions;
 return {id:`g7-${plan.id}`,style:'story',wordIds:ws.map(w=>w.id),assetIds:plan.photo?[plan.photo]:[],seed:Number.parseInt(hash(plan.id).slice(0,7),16),direction,_first:Math.min(...ws.map(w=>w.start)),_last:Math.max(...ws.map(w=>w.end))};
}
const instrumental=(id,start,end,d)=>({id:`g7-${id}`,start,end,style:'story',wordIds:[],assetIds:d.photo?[d.photo]:[],seed:Number.parseInt(hash(id).slice(0,7),16),direction:{label:'',marker:'',...d}});
function remap(value,ids){if(typeof value==='string')return ids.get(value)||value;if(Array.isArray(value))return value.map(x=>remap(x,ids));if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,remap(v,ids)]));return value;}

export function buildFilm(input,demo,{strict=true}={}){
 const p=clone(input),fps=p.fps,frame=t=>Math.round(t*fps)/fps,warnings=[];
 if(fps!==30)throw new Error('Approved Genesis 7 choreography requires 30fps');
 p.duration=Math.ceil((p.source?.audioDuration??p.duration)*fps-1e-7)/fps;
 const wordsBefore=hash(p.words),phrasesBefore=hash(p.phrases),offset=demo.source?.start??221.45;
 const expectedPhrases=SCENE_PLAN.flatMap(s=>s.phraseIds),found=new Set(p.words.map(w=>w.phraseId||w.id.replace(/-w\d+$/,'')));
 if(new Set(expectedPhrases).size!==expectedPhrases.length)throw new Error('Scene plan repeats a phrase');
 for(const id of found)if(!expectedPhrases.includes(id))throw new Error(`Unplanned phrase ${id}`);
 for(const id of expectedPhrases)if(!found.has(id))throw new Error(`Missing phrase ${id}`);
 const ids=new Map(); const climaxWords=phraseWords(p,range(12,12,14));
 if(climaxWords.length!==demo.words.length)throw new Error('Approved climax must contain exactly twelve original words');
 demo.words.forEach((old,i)=>{const w=climaxWords[i];if(KEY(old.text)!==KEY(w.text))throw new Error(`Climax word mismatch ${old.text}/${w.text}`);ids.set(old.id,w.id);if(Math.abs(w.start-old.start-offset)>1e-5||Math.abs(w.end-old.end-offset)>1e-5)warnings.push(`Climax cue differs from approved sample: ${w.id}`);});
 const scenes=SCENE_PLAN.map(plan=>{
  if(plan.climax===undefined)return storySection(p,plan);
  const old=demo.sections[plan.climax],s=remap(clone(old),ids),ws=phraseWords(p,plan.phraseIds);
  s.id=`g7-${plan.id}`;s.start=frame(old.start+offset);s.end=frame(old.end+offset);s.direction.label='';s.direction.marker='';s.direction.phraseIds=plan.phraseIds;
  for(const key of ['portalAt','submergeAt'])if(Number.isFinite(s.direction[key]))s.direction[key]+=offset;
  s._first=Math.min(...ws.map(w=>w.start));s._last=Math.max(...ws.map(w=>w.end));s._fixed=true;return s;
 });
 // Cut on a frame in the actual pause. Long rests anticipate the following tableau.
 function cut(a,b){
  const low=Math.ceil((a._last-1e-8)*fps)/fps,high=Math.floor((b._first+1e-8)*fps)/fps;
  if(low>high){warnings.push(`Speech overlaps scene cut ${a.id} -> ${b.id}: ${a._last.toFixed(3)} > ${b._first.toFixed(3)}`);return frame((a._last+b._first)/2);}
  const desired=b._first-a._last>1.6?a._last+.65:(a._last+b._first)/2;return Math.max(low,Math.min(high,frame(desired)));
 }
 for(let i=0;i<scenes.length-1;i++){
  const a=scenes[i],b=scenes[i+1],t=a._fixed?a.end:b._fixed?b.start:cut(a,b);
  if(!a._fixed)a.end=t;if(!b._fixed)b.start=t;
 }
 const first=scenes[0],introEnd=frame(Math.max(0,first._first-.15));first.start=introEnd;
 const sections=[];
 if(introEnd>=12){const a=frame(introEnd*.345),b=frame(introEnd*.70);sections.push(instrumental('opening-world',0,a,{mode:'overture',photo:'ark-before',pan:-1}),instrumental('opening-title',a,b,{mode:'overture',title:'GENESIS 7',titleSize:290,subtitle:'',fadeOut:false}),instrumental('opening-threshold',b,introEnd,{mode:'gateway'}));}
 else{warnings.push(`First lyric starts at ${first._first.toFixed(2)}s; expected the corrected approximately 19s introduction`);sections.push(instrumental('opening-world',0,introEnd,{mode:'overture',photo:'ark-before',title:'GENESIS 7',titleSize:290}));}
 const breakAfter=new Map([['g7-made-and-commanded',{id:'approach-between-verses',photo:'ark-before',mode:'gateway',pan:1}],['g7-the-door-seals',{id:'pressure-inside',photo:'interior',mode:'shelter',pan:-1}]]);
 for(let i=0;i<scenes.length;i++){
  const s=scenes[i],rest=breakAfter.get(s.id),next=scenes[i+1];
  if(rest&&next&&next._first-s._last>3.0){
   const start=frame(s._last+.7),end=frame(next._first-.25);s.end=start;next.start=end;
   sections.push(s,instrumental(rest.id,start,end,{...rest,photo:rest.photo}));
  }else sections.push(s);
 }
 const last=scenes.at(-1),outroStart=frame(Math.min(p.duration-6,last._last+.65));last.end=outroStart;
 const remaining=p.duration-outroStart,a=frame(outroStart+remaining*.21),b=frame(outroStart+remaining*.62);
 sections.push(instrumental('ending-near-water',outroStart,a,{mode:'horizon',photo:'flood',water:true}),instrumental('ending-unbroken-horizon',a,b,{mode:'horizon',title:'PREVAILED',titleSize:250,titleToHorizon:true,ark:true,horizonTravel:true}),instrumental('ending-ark-alone',b,p.duration,{mode:'horizon',photo:'endless',waterline:.77,pan:-1,zoom:1.03,fadeOut:true}));
 const seen=new Set();let cursor=0;for(const s of sections){
  if(Math.abs(s.start-cursor)>1e-6||!(s.end>s.start))throw new Error(`Invalid continuous coverage at ${s.id}`);
  for(const id of s.wordIds){if(seen.has(id))throw new Error(`Repeated lyric word ${id}`);seen.add(id);const w=p.words.find(x=>x.id===id);if(w.start<s.start-1/fps-1e-6||w.end>s.end+1e-6)warnings.push(`Scene truncates ${id}: word ${w.start.toFixed(3)}–${w.end.toFixed(3)}, scene ${s.start.toFixed(3)}–${s.end.toFixed(3)}`);}
  if(s.direction.lines?.length>4)warnings.push(`${s.id} has ${s.direction.lines.length} rows; inspect full-size legibility`);
  delete s._first;delete s._last;delete s._fixed;cursor=s.end;
 }
 if(seen.size!==p.words.length)throw new Error(`Word coverage ${seen.size}/${p.words.length}`);
 if(hash(p.words)!==wordsBefore||hash(p.phrases)!==phrasesBefore)throw new Error('Builder changed source lyric data');
 p.sections=sections;
 const errors=warnings.filter(w=>/Climax cue|Speech overlaps|Scene truncates|First lyric/.test(w));
 if(strict&&errors.length)throw new Error(`Timing handoff is not ready; no manifest written:\n${errors.join('\n')}`);
 const photoSeconds=sections.filter(s=>s.direction.photo).reduce((n,s)=>n+s.end-s.start,0);
 const report={sceneCount:sections.length,wordCount:seen.size,duration:p.duration,frames:Math.round(p.duration*fps),actionCount:sections.reduce((n,s)=>n+(s.direction.actions?.length||0),0),photoSeconds,graphicSeconds:p.duration-photoSeconds,photoPercent:photoSeconds/p.duration*100,wordDataSha256:wordsBefore,phraseDataSha256:phrasesBefore,warnings,sections:sections.map(s=>({id:s.id,start:s.start,end:s.end,seconds:s.end-s.start,mode:s.style==='story'?s.direction.mode:s.style,photo:s.direction.photo||null,layout:s.direction.align||'custom',rows:s.direction.lines?.length||0,phraseIds:s.direction.phraseIds||[],text:s.wordIds.map(id=>p.words.find(w=>w.id===id).text).join(' ')}))};
 p.artDirection={builder:'scripts/build-genesis7-full.mjs',version:1,reference:'research/fullsong-art-direction.md',wordsSha256:wordsBefore,phrasesSha256:phrasesBefore,photoCoverageSeconds:photoSeconds,graphicCoverageSeconds:p.duration-photoSeconds,coverageMethod:'Dominant photographic backdrop duration; the short photographic reveal inside terrain is conservatively counted as graphic.'};
 return {project:p,report};
}
function rebase(src,fromDir,toDir){return path.relative(toDir,path.resolve(fromDir,src)).split(path.sep).join('/')||'.';}
export function resolveAssets(project,{inputPath,outputPath,demo,demoPath,assetDir}){
 const p=clone(project),from=path.dirname(inputPath),to=path.dirname(outputPath);
 p.audio.src=rebase(p.audio.src,from,to);
 for(const a of Object.values(p.assets))a.src=rebase(a.src,from,to);
 for(const key of ['originalLyrics','originalTiming','originalBeats'])if(p.intake?.[key])p.intake[key]=rebase(p.intake[key],from,to);
 for(const [id,file]of Object.entries(PHOTO_FILES))p.assets[id]={type:'image',src:rebase(file,assetDir,to)};
 for(const id of ['flood','wave'])p.assets[id]={...demo.assets[id],src:rebase(demo.assets[id].src,path.dirname(demoPath),to)};
 return p;
}
export function markdownReport(report,{inputPath,outputPath,provisional=false}={}){
 const f=n=>n.toFixed(2),lines=['# Genesis 7 — generated scene plan','',provisional?'**Provisional plan only. No project manifest was written. Timing issues below must be resolved before production.**':'Authored from the corrected input manifest; every original word/cue is preserved.',`Input: \`${inputPath}\`. Output: \`${outputPath}\`.`,`${report.sceneCount} scenes; ${report.actionCount} cue-triggered group actions; ${report.wordCount} words; ${report.frames} frames / ${f(report.duration)} s. Dominant photo: ${f(report.photoSeconds)} s (${f(report.photoPercent)}%); graphic/line art: ${f(report.graphicSeconds)} s. Intro/outro count in this full-film ratio. Terrain's brief photographic aperture is conservatively counted as graphic.`,`Word data SHA256: \`${report.wordDataSha256}\`. Phrase data SHA256: \`${report.phraseDataSha256}\`.`, '', '| # | Time | Mode | Photo | Alignment / rows | Lyrics |','|---:|---|---|---|---|---|'];
 report.sections.forEach((s,i)=>lines.push(`| ${i+1} | ${f(s.start)}–${f(s.end)} | ${s.mode} | ${s.photo||'—'} | ${s.layout} / ${s.rows} | ${s.text.replaceAll('|','/')} |`));
 lines.push('','## Checks','',...report.warnings.map(w=>`- ${w}`));if(!report.warnings.length)lines.push('- Complete, continuous frame-aligned coverage; every word once; approved climax cues preserved; no speech cut.');
 lines.push('','This report verifies the plan, not the rendered visual quality. Root must inspect actual representative frames/motion and run the full-film gauntlet.','');return lines.join('\n');
}
async function main(){
 const args=process.argv.slice(2),opts={};for(let i=0;i<args.length;i++){if(['--plan-only','--allow-missing-assets','--in-place'].includes(args[i]))opts[args[i].slice(2)]=true;else if(['--input','--output','--demo','--asset-dir','--report'].includes(args[i])){if(!args[i+1]||args[i+1].startsWith('--'))throw new Error(`Missing value for ${args[i]}`);opts[args[i].slice(2)]=args[++i];}else throw new Error(`Unknown argument ${args[i]}`);}
 const inputPath=path.resolve(opts.input||path.join(ROOT,'projects/genesis7-full/project.json')),outputPath=path.resolve(opts.output||path.join(path.dirname(inputPath),'film.json')),demoPath=path.resolve(opts.demo||path.join(ROOT,'projects/genesis7/project.json'));
 if(inputPath===outputPath&&!opts['in-place'])throw new Error('Use a distinct output path or explicitly pass --in-place after timing handoff');
 const [input,demo]=await Promise.all([fs.readFile(inputPath,'utf8').then(JSON.parse),fs.readFile(demoPath,'utf8').then(JSON.parse)]);
 const {project,report}=buildFilm(input,demo,{strict:!opts['plan-only']}),resolved=resolveAssets(project,{inputPath,outputPath,demo,demoPath,assetDir:path.resolve(opts['asset-dir']||path.join(path.dirname(inputPath),'assets'))});
 const validation=await validateProject(resolved,outputPath,{checkFiles:!opts['plan-only']&&!opts['allow-missing-assets']});if(!validation.valid)throw new Error(validation.errors.join('\n'));
 if(!opts['plan-only'])await atomicJson(outputPath,resolved);
 if(opts.report){const dest=path.resolve(opts.report);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,markdownReport(report,{inputPath,outputPath,provisional:!!opts['plan-only']}));}
 console.log(JSON.stringify({wrote:!opts['plan-only'],outputPath,sceneCount:report.sceneCount,frames:report.frames,photoPercent:report.photoPercent,warnings:report.warnings},null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
