import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=new URL('./',import.meta.url);
const read=async name=>JSON.parse(await readFile(new URL(name,root),'utf8'));
const args=process.argv.slice(2),arg=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
const provider=await read('sources/phrases-provider.json');
const canonical=await read('sources/words.json');
const words=Array.isArray(canonical)?canonical:canonical.words;
if(!Array.isArray(words)||!words.length)throw new Error('Canonical words are missing');
const byId=new Map(words.map(w=>[w.id,w]));
let canonicalPhrases;try{canonicalPhrases=await read('sources/phrases.json')}catch{}
const phraseOverrides=new Map((Array.isArray(canonicalPhrases)?canonicalPhrases:canonicalPhrases?.phrases||[]).map(p=>[p.id,p]));
const providerById=new Map(provider.phrases.map(p=>[p.id,p]));
const phraseSource=Array.isArray(canonical.phrases)&&canonical.phrases.length?canonical.phrases:provider.phrases;
const phrases=phraseSource.map(p=>{const base=providerById.get(p.id)||providerById.get(p.performanceRepeatOf)||{};const override=phraseOverrides.get(p.id);const ids=(override?.wordIds||p.wordIds);const pw=ids.map(id=>byId.get(id)).filter(Boolean);if(pw.length!==ids.length)throw new Error(`Missing canonical words for ${p.id}`);return {...base,...p,...override,wordIds:ids,start:Math.min(...pw.map(w=>w.start)),end:Math.max(...pw.map(w=>w.end)),words:pw};}).sort((a,b)=>a.start-b.start);
const measured=await read('sources/measured-audio-events.json');
let assets={};try{const a=await read('asset-map.json');assets=a.assets||a;}catch{}
const duration=Number(arg('--duration')||327.6);
if(!(duration>0&&duration<=327.614))throw new Error('Invalid duration');
const data={duration,sourceDuration:327.6,words,phrases,beats:measured.beats||[],assets};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const media=Object.entries(assets).map(([id,spec])=>{const a=typeof spec==='string'?{src:spec}:spec;if(!a.src)return '';const phrase=phrases.find(p=>p.id===id);const p=phrase||(Number.isFinite(a.start)?{start:a.start,end:a.start+Number(a.duration||0)}:null);if(!p||p.start>=duration)return '';if(a.type==='video'){const mediaStart=Number.isFinite(a.start)?a.start:p.start;const available=Math.max(.1,Math.min(a.duration||p.end-p.start,duration-mediaStart));return `<video id="${esc(id)}-art" class="clip" src="${esc(a.src)}" data-start="${mediaStart}" data-duration="${available}" data-track-index="2" muted playsinline></video>`;}return `<img id="${esc(id)}-art" src="${esc(a.src)}" alt="${esc(a.alt||'Photorealistic supporting scene')}">`;}).join('\n');
// The archived project is authoritative. Intake is only a recovery path for a
// fresh project that has not archived its source audio yet.
const song=new URL('assets/song.m4a',root),expectedAudioSha256='b444350b68359bc06f17a90ace1b6d7bba9255a0358b308acec9cdccf3103420';
let sourceAudio;
try{sourceAudio=await readFile(song)}catch(error){
 if(error.code!=='ENOENT')throw error;
 const intake=new URL('../../output/psalm91-theme-intake/source.m4a',root);
 sourceAudio=await readFile(intake);
 if(createHash('sha256').update(sourceAudio).digest('hex')!==expectedAudioSha256)throw new Error('Intake audio does not match the approved Psalm 91 song');
 await writeFile(song,sourceAudio);
}
const actualAudioSha256=createHash('sha256').update(sourceAudio).digest('hex');
if(actualAudioSha256!==expectedAudioSha256)throw new Error(`Archived audio SHA256 mismatch: expected ${expectedAudioSha256}, received ${actualAudioSha256}`);
const [html,opening,narrative]=await Promise.all(['composition.html.txt','opening.js','narrative.js'].map(f=>readFile(new URL(f,root),'utf8')));
const output=html.replaceAll('__DURATION__',String(duration)).replace('__MEDIA__',media).replace('__DATA__',JSON.stringify(data).replaceAll('</','<\\/')).replace('__OPENING__',opening).replace('__NARRATIVE__',narrative);
await writeFile(new URL('index.html',root),output);
console.log(JSON.stringify({output:fileURLToPath(new URL('index.html',root)),duration,words:words.length,phrases:phrases.length,assets:Object.keys(assets).length}));
