/** Bounded clip QA; reuses the engine's measured PCM and native OCR implementation. */
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCanvas,loadImage,GlobalFonts} from '@napi-rs/canvas';
import {decodeAudio,compareWaveforms} from '../../engine/audio-review.mjs';
import {fileHash} from '../../engine/project.mjs';
import {reviewLyricVisibility} from '../../engine/ocr.mjs';

const run=promisify(execFile),here=path.dirname(fileURLToPath(import.meta.url));
const clip=JSON.parse(await readFile(path.join(here,'clip.json'),'utf8'));
const binding=JSON.parse(await readFile(path.join(here,'review/source-binding.json'),'utf8'));
const videoPath=path.resolve(process.argv.find((_,i,a)=>a[i-1]==='--video')??path.join(clip.metadata.outputDir,'hyperframes.mp4'));
const skipOCR=process.argv.includes('--skip-ocr');
const name=path.basename(videoPath,'.mp4'),out=path.join(clip.metadata.outputDir,'review',name);
await mkdir(out,{recursive:true});
const sources=[];
for(const name of (await readdir(here)).filter(n=>/\.(html|css|js|mjs|json)$/.test(n)))sources.push({file:name,sha256:await fileHash(path.join(here,name))});
const report={schemaVersion:1,kind:'hyperframes-clip-comparison-review',createdAt:new Date().toISOString(),videoPath,videoSha256:await fileHash(videoPath),sourceBinding:binding.source,compositionSource:sources,checks:[],limitations:['Waveform correlation measures decoded audio fidelity and lag, not subjective hearing.','Canonical cue preservation is not new acoustic verification. Prior unsupported sung-word alignment remains unsupported.','OCR proves only sampled recognition of encoded pixels, not aesthetic quality. Independent visual review is still required.']};
const add=(id,passed,measured,threshold)=>report.checks.push({id,passed:!!passed,measured,threshold});
const {stdout:probe}=await run('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',videoPath],{maxBuffer:4*1024*1024});
const media=JSON.parse(probe),v=media.streams.find(s=>s.codec_type==='video'),a=media.streams.filter(s=>s.codec_type==='audio');
report.streams=media;
add('encoded_format',v?.width===1920&&v?.height===1080&&v?.codec_name==='h264'&&Number(v?.nb_read_frames)===clip.frames&&v?.avg_frame_rate==='30/1'&&a.length===1&&a[0].codec_name==='aac',{width:v?.width,height:v?.height,codec:v?.codec_name,frames:v?.nb_read_frames,fps:v?.avg_frame_rate,audioTracks:a.length,audioCodec:a[0]?.codec_name},{width:1920,height:1080,frames:600,fps:'30/1',videoCodec:'h264',audioCodec:'aac',audioTracks:1});
await run('ffmpeg',['-v','error','-i',videoPath,'-f','null','-'],{maxBuffer:4*1024*1024});
add('full_decode',true,{frames:clip.frames});
const pcm=await decodeAudio(path.join(here,'assets/song.wav')),encoded=await decodeAudio(videoPath),wave=compareWaveforms(pcm,encoded);
report.waveform=wave;
add('decoded_audio_match',wave.correlation>=.985&&wave.minSegmentCorrelation>=.97&&Math.abs(wave.gainDb??Infinity)<=.75,{correlation:wave.correlation,minSegmentCorrelation:wave.minSegmentCorrelation,gainDb:wave.gainDb},{minCorrelation:.985,minSegmentCorrelation:.97,maxGainDb:.75});
add('audio_offset',Math.abs(wave.offsetSeconds)<=.035,{offsetSeconds:wave.offsetSeconds},{maxSeconds:.035});
add('audio_duration',Math.abs(wave.encodedDuration-20)<=.08&&Math.abs(wave.sourceDuration-20)<=.08,{encoded:wave.encodedDuration,source:wave.sourceDuration},{expected:20,maxError:.08});
const original=JSON.parse(await readFile(binding.source.projectPath,'utf8'));
const expected=original.words.filter(w=>w.end>clip.sourceStart&&w.start<clip.sourceEnd);
const cueChecks=clip.words.map(w=>{const orig=expected.find(o=>o.id===w.id);return {id:w.id,text:w.text,localStart:w.start,localEnd:w.end,sourceStart:w.sourceStart,sourceEnd:w.sourceEnd,passed:!!orig&&w.text===orig.text&&w.sourceStart===orig.start&&w.sourceEnd===orig.end&&Math.abs(w.start+clip.sourceStart-orig.start)<1e-8&&Math.abs(w.end+clip.sourceStart-orig.end)<1e-8};});
report.cues=cueChecks;add('canonical_cues_unchanged',clip.words.length===expected.length&&cueChecks.every(w=>w.passed),{count:clip.words.length,failures:cueChecks.filter(w=>!w.passed)});
const priorPath='/Users/shanefisher/Movies/Genesis4-motion-v3-work/audio/audio-review.json';
const prior=JSON.parse(await readFile(priorPath,'utf8'));
const inherited=prior.wordEvidence.filter(w=>clip.words.some(c=>c.id===w.id));
report.inheritedAcousticEvidence={sourceReport:priorPath,sourceReportSha256:await fileHash(priorPath),boundToOriginalFilm:prior.binding.videoSha256===binding.source.filmSha256,boundToOriginalAudio:prior.binding.audioSha256===clip.audio.sourceSha256,status:'inherited_not_newly_certified',verified:inherited.filter(w=>w.passed).length,unsupported:inherited.filter(w=>!w.supported).length,supportedFailures:inherited.filter(w=>w.supported&&!w.passed).length,words:inherited};
const framesDir=path.join(out,'frames');await mkdir(framesDir,{recursive:true});
await run('ffmpeg',['-v','error','-y','-i',videoPath,'-vf','select=not(mod(n\\,15))','-fps_mode','vfr','-frames:v','40',path.join(framesDir,'contact-%03d.png')],{maxBuffer:4*1024*1024});
GlobalFonts.registerFromPath(path.join(here,'assets/BebasNeue-Regular.ttf'),'Bebas Neue');
const sheet=createCanvas(1920,1469),ctx=sheet.getContext('2d');ctx.fillStyle='#111';ctx.fillRect(0,0,sheet.width,sheet.height);ctx.fillStyle='#eee';ctx.font='30px "Bebas Neue"';ctx.fillText(`${name.toUpperCase()}  /  DECODED 20 SECONDS  /  SAMPLE EVERY 0.5 SECOND`,20,37);
report.contactFrames=[];
for(let i=0;i<40;i++){
  const file=path.join(framesDir,`contact-${String(i+1).padStart(3,'0')}.png`),img=await loadImage(file),x=i%6*320,y=55+Math.floor(i/6)*202;
  ctx.drawImage(img,x,y,320,180);ctx.fillStyle='#eee';ctx.font='18px "Bebas Neue"';ctx.fillText(`${(i*.5).toFixed(1)}s  /  SOURCE ${(clip.sourceStart+i*.5).toFixed(1)}s`,x+8,y+198);
  report.contactFrames.push({time:i*.5,path:file,sha256:await fileHash(file)});
}
report.contactSheet=path.join(out,'contact-sheet.png');await writeFile(report.contactSheet,sheet.toBuffer('image/png'));
if(!skipOCR){
  const ocr=await reviewLyricVisibility({projectPath:path.join(here,'clip.json'),videoPath,outDir:path.join(out,'ocr')});
  report.lyricVisibility={status:ocr.status,coverage:ocr.coverage,reportPath:ocr.reportPath};
  add('encoded_lyric_recognition',ocr.status==='passed',ocr.coverage,{requiredRatio:1});
}
add('original_unchanged',await fileHash(binding.source.projectPath)===binding.source.projectSha256&&await fileHash(binding.source.filmPath)===binding.source.filmSha256,{source:binding.source});
const sourceState=await Promise.all(sources.map(async s=>{try{return {file:s.file,unchanged:await fileHash(path.join(here,s.file))===s.sha256};}catch(error){return {file:s.file,unchanged:false,error:error.message};}}));
add('reviewed_inputs_unchanged',await fileHash(videoPath)===report.videoSha256&&sourceState.every(s=>s.unchanged),{changedSources:sourceState.filter(s=>!s.unchanged)});
report.status=report.checks.every(c=>c.passed)?'technical_and_preservation_checks_passed':'checks_failed';
report.finalAcceptance='pending_independent_visual_review';
await writeFile(path.join(out,'review.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(path.join(here,'review',`${name}-summary.json`),JSON.stringify({...report,streams:undefined,cues:undefined,contactFrames:undefined,inheritedAcousticEvidence:{...report.inheritedAcousticEvidence,words:undefined},fullReport:path.join(out,'review.json')},null,2)+'\n');
console.log(JSON.stringify({status:report.status,checks:report.checks,lyricVisibility:report.lyricVisibility,contactSheet:report.contactSheet,reportPath:path.join(out,'review.json')},null,2));
