import fs from 'node:fs';
import {officialPhraseRetryWindow} from '../../../engine/audio-review.mjs';
const dir=new URL('./alignment/',import.meta.url);const read=f=>JSON.parse(fs.readFileSync(new URL(f,dir),'utf8'));
const timing=JSON.parse(fs.readFileSync(new URL('../sources/words.json',import.meta.url),'utf8'));const windows=read('windows.json');
const checkpoints={'whisper-base':'25a8566e1d0c1e2231d1c762132cd20e0f96a85d16145c3a00adf5d1ac670ead','whisper-small':'f953ad0fd29cacd07d5a9eda5624af0f6bcf2258be67c92b79389873d91e0872','whisper-medium':'d7440d1dc186f76616474e0ff0b3b6b879abc9d1a4926b7adfa41db2d497ab4f'};
const retries=[];
for(const phrase of timing.phrases){
 const words=timing.words.filter(w=>w.phraseId===phrase.id);if(words.every(w=>w.provenance.sourceAcousticSupported))continue;
 const window=windows.find(w=>w.lineIds.includes(phrase.id));const passes=Object.entries(checkpoints).map(([name,id])=>({checkpointId:id,role:'source',words:read(`${window.id}-${name}.json`).words})).filter(p=>p.words.length);
 const retry=officialPhraseRetryWindow(words,passes,{start:window.start,end:window.end,duration:219.96});
 retries.push({...retry,id:phrase.id,text:phrase.text,lyrics:new URL(`${phrase.id}-lyrics.txt`,dir).pathname});
}
fs.writeFileSync(new URL('final-retry-windows.json',dir),JSON.stringify(retries,null,2)+'\n');console.log(JSON.stringify({retries:retries.length,recognized:retries.filter(r=>r.method==='complete-exact-recognized-phrase').length}));
