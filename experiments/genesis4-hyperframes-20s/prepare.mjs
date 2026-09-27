/** Prepare a separate, immutable-source 20-second comparison. Never changes the film/project. */
import {readFile,writeFile,mkdir,copyFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const run=promisify(execFile);
const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../..');
const sourceProject=path.join(repo,'projects/genesis4-motion-v3/project.json');
const sourceFilm='/Users/shanefisher/Movies/Genesis4-motion-v3-work/film.mp4';
const outputDir='/Users/shanefisher/Movies/Genesis4-hyperframes-20s-work';
const fps=30,startFrame=7527,frames=600,start=startFrame/fps,duration=frames/fps,end=start+duration;
const hash=async file=>{const sha=createHash('sha256');for await(const chunk of createReadStream(file))sha.update(chunk);return sha.digest('hex');};
const json=async(file,value)=>writeFile(file,JSON.stringify(value,null,2)+'\n');
const local=t=>Number((t-start).toFixed(9));
await mkdir(path.join(here,'assets'),{recursive:true});
await mkdir(path.join(here,'review'),{recursive:true});
await mkdir(outputDir,{recursive:true});
const sourceBinding={projectPath:sourceProject,projectSha256:await hash(sourceProject),filmPath:sourceFilm,filmSha256:await hash(sourceFilm)};
const bindingPath=path.join(here,'review/source-binding.json');
try {
  const prior=JSON.parse(await readFile(bindingPath,'utf8'));
  if(prior.source.projectSha256!==sourceBinding.projectSha256||prior.source.filmSha256!==sourceBinding.filmSha256)throw Error('Source differs from original experiment binding; refusing to silently rebaseline.');
} catch(error){if(error.code!=='ENOENT')throw error;}
const project=JSON.parse(await readFile(sourceProject,'utf8'));
if(project.fps!==fps)throw Error('Source frame rate changed');
const audio=path.resolve(path.dirname(sourceProject),project.audio.src);
const offset=project.audio.offset??0;
const words=project.words.filter(w=>w.end>start&&w.start<end).map(w=>({...w,sourceStart:w.start,sourceEnd:w.end,start:local(w.start),end:local(w.end)}));
const ids=new Set(words.map(w=>w.id));
const phrases=project.phrases.filter(p=>p.wordIds.some(id=>ids.has(id))).map(p=>({...p,sourceStart:p.start,sourceEnd:p.end,start:local(p.start),end:local(p.end),wordIds:p.wordIds.filter(id=>ids.has(id))}));
const beats=project.beats.filter(b=>b.time>=start&&b.time<end).map(b=>({...b,sourceTime:b.time,time:local(b.time)}));
const clip={
  schemaVersion:1,id:'genesis4-hyperframes-20s',title:'Genesis 4 — Vengeance to Mercy: HyperFrames comparison',
  width:1920,height:1080,fps,duration,frames,startFrame,sourceStart:start,sourceEnd:end,
  audio:{src:'assets/song.wav',offset:0,sourcePath:audio,sourceSha256:await hash(audio),sourceOffset:offset+start},
  words,phrases,beats,
  sections:project.sections.filter(s=>s.end>start&&s.start<end).map(s=>({...s,sourceStart:s.start,sourceEnd:s.end,start:local(s.start),end:local(s.end)})),
  metadata:{sourceProjectId:project.id,source:sourceBinding,timebase:'clip',sourceTimebase:'original project seconds',timingEdits:[],note:'Exact source words, IDs, provenance and acoustic cue times; subtract 250.9 only. Beats remain separate measured onsets. This comparison preserves the accepted source and does not certify previously uncertain sung-word alignment.',outputDir}
};
await json(path.join(here,'clip.json'),clip);
await writeFile(path.join(here,'data.js'),'// Prepared from the accepted source; timing/provenance retained.\nwindow.CLIP = '+JSON.stringify(clip,null,2)+';\n');
for(const name of ['BebasNeue-Regular.ttf','ArchivoBlack-Regular.ttf','EBGaramond-Italic-Variable.ttf','christ-mercy.png'])await copyFile(path.join(path.dirname(sourceProject),'assets',name),path.join(here,'assets',name));
await run('ffmpeg',['-v','error','-y','-i',audio,'-af',`atrim=start=${offset+start}:duration=${duration},asetpts=PTS-STARTPTS`,'-vn','-c:a','pcm_s24le',path.join(here,'assets/song.wav')],{maxBuffer:4*1024*1024});
await run('ffmpeg',['-v','error','-y','-i',sourceFilm,'-vf',`trim=start_frame=${startFrame}:end_frame=${startFrame+frames},setpts=PTS-STARTPTS`,'-af',`atrim=start=${start}:duration=${duration},asetpts=PTS-STARTPTS`,'-frames:v',String(frames),'-c:v','libx264','-preset','fast','-crf','16','-pix_fmt','yuv420p','-c:a','aac','-b:a','256k','-movflags','+faststart',path.join(outputDir,'baseline.mp4')],{maxBuffer:4*1024*1024});
const after={projectSha256:await hash(sourceProject),filmSha256:await hash(sourceFilm)};
if(after.projectSha256!==sourceBinding.projectSha256||after.filmSha256!==sourceBinding.filmSha256)throw Error('Original source changed while preparation ran');
const report={schemaVersion:1,createdAt:new Date().toISOString(),source:sourceBinding,after,originalUnchanged:true,interval:{sourceStart:start,sourceEnd:end,startFrame,frames,fps,duration},clip:{words:words.length,phrases:phrases.length,beats:beats.length},artifacts:{data:'data.js',canonicalData:'clip.json',song:'assets/song.wav',baseline:path.join(outputDir,'baseline.mp4')},hashes:{songSha256:await hash(path.join(here,'assets/song.wav')),baselineSha256:await hash(path.join(outputDir,'baseline.mp4')),clipSha256:await hash(path.join(here,'clip.json'))}};
await json(bindingPath,report);
console.log(JSON.stringify(report,null,2));
