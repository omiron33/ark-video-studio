/** Measured local audio QA: codec round-trip, recognized lyrics, acoustic forced alignment.
 * No subjective hearing claim. Missing evidence fails; supported timing changes can be repaired.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, stat, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { loadProject, resolveSource, digest, fileHash, atomicJson, validateProject } from './project.mjs';
import { computeRevision } from './gauntlet.mjs';

const run = promisify(execFile), finite = n => typeof n === 'number' && Number.isFinite(n);
const root = path.dirname(fileURLToPath(import.meta.url));
const modelsRoot = '/Volumes/DATA/AI/Models';
const defaults = Object.freeze({ minCorrelation: .985, minSegmentCorrelation: .97, maxOffsetSeconds: .035, maxDurationError: .08, maxGainDb: .75, minLyricSimilarity: 1, minWordAcousticConfidence: .2, minMeanAcousticConfidence: .55, maxCodecAlignmentSpread: .12, maxCueDelta: .04, maxEndDelta: .08, maxCrossModelBoundaryDelta: .45 });
const rounded = n => Number.isFinite(n) ? Math.round(n * 1e6) / 1e6 : null;
const mean = rows => rows.reduce((s, n) => s + n, 0) / Math.max(1, rows.length);
const lexical = text => String(text).normalize('NFKD').toLowerCase().replace(/[’]/g, "'").replace(/[^\p{L}\p{N}']/gu, '');
const exists = async file => { try { return (await stat(file)).isFile(); } catch { return false; } };

/** Hash exactly the 16 kHz mono PCM format consumed by align.py, independently of video pixels. */
export async function fingerprintAudioWindow(file, { sourceOffset = 0, duration }) {
  const { stdout } = await run('ffmpeg', ['-v','error','-i',path.resolve(file),'-ss',String(sourceOffset),'-t',String(duration),'-vn','-ar','16000','-ac','1','-c:a','pcm_s16le','-f','s16le','-'], {encoding:'buffer',maxBuffer:256*1024*1024});
  if (!stdout.length || stdout.length % 2) throw Error('Cannot fingerprint an empty or malformed decoded audio window');
  return { sha256:digest(stdout), format:'mono-s16le-16000', samples:stdout.length/2 };
}

function validPass(result, identity) {
  if (!result || result.version!==1 || result.timebase!=='source' || result.status!=='machine_estimate' || result.task!==identity.task || result.source?.backend!==identity.backend || result.source?.model!==identity.model.path || result.source?.language!==identity.settings.language || result.source?.offset!==identity.offset || !Array.isArray(result.words) || !result.words.length) return false;
  if (!finite(result.source.duration) || Math.abs(result.source.duration-identity.duration)>.05) return false;
  let last=-Infinity; const ids=new Set();
  for(const word of result.words){
    const probability=word?.provenance?.tokenProbability;
    if(typeof word?.id!=='string'||!word.id||ids.has(word.id)||typeof word.text!=='string'||!word.text.trim()||!finite(word.start)||!finite(word.end)||word.start<identity.offset-.001||word.end>identity.offset+identity.duration+.05||word.end<=word.start||word.start<last||!finite(probability)||probability<0||probability>1)return false;
    ids.add(word.id);last=word.start;
  }
  return identity.task!=='force-align'||result.words.map(w=>w.text).join(' ')===identity.lyrics.trim().replace(/\s+/g,' ');
}

/** Atomic cache entries are reusable only after their identity, payload digest and schema validate. */
export async function cachedAudioPass({ cacheDir, identity, generate }) {
  const key=digest(identity),entryPath=path.join(cacheDir,`${key}.json`);let rejectedEntry=false;
  try{
    const entry=JSON.parse(await readFile(entryPath,'utf8'));
    if(entry.schemaVersion===1&&entry.key===key&&digest(entry.identity)===key&&entry.resultSha256===digest(entry.result)&&validPass(entry.result,identity))return {result:entry.result,key,entryPath,cacheHit:true,rejectedEntry:false,resultSha256:entry.resultSha256};
    rejectedEntry=true;
  }catch(error){if(error.code!=='ENOENT')rejectedEntry=true;}
  const result=await generate();
  if(!validPass(result,identity))throw Error(result?.reason??'Local audio pass returned unsuccessful or invalid evidence; no cache entry was written');
  const resultSha256=digest(result);
  await atomicJson(entryPath,{schemaVersion:1,key,identity,resultSha256,result,createdAt:new Date().toISOString()});
  return {result,key,entryPath,cacheHit:false,rejectedEntry,resultSha256};
}

async function runtimeIdentity(python) {
  const script="import sys,json,platform,importlib.metadata as m; sys.path.insert(0,'/Volumes/DATA/AI/Tools/ark-audio-review/python'); names=['openai-whisper','torch','torchaudio','numpy','numba']; versions={};\nfor name in names:\n try: versions[name]=m.version(name)\n except m.PackageNotFoundError: versions[name]=None\nprint(json.dumps({'executable':sys.executable,'python':sys.version,'platform':platform.platform(),'packages':versions}))";
  const [py,ffmpeg]=await Promise.all([run(python,['-c',script],{timeout:15000}),run('ffmpeg',['-version'],{timeout:15000})]);
  const environment=JSON.parse(py.stdout);
  return {...environment,pythonExecutableSha256:await fileHash(environment.executable),ffmpeg:ffmpeg.stdout.split('\n')[0]};
}

export async function decodeAudio(file, { sourceOffset = 0, duration, sampleRate = 8000 } = {}) {
  const args = ['-v', 'error', '-i', path.resolve(file), '-ss', String(sourceOffset)];
  if (duration !== undefined) args.push('-t', String(duration));
  args.push('-vn', '-ac', '1', '-ar', String(sampleRate), '-f', 'f32le', '-');
  const { stdout } = await run('ffmpeg', args, { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 });
  return new Float32Array(stdout.buffer, stdout.byteOffset, stdout.length / 4).slice();
}

function moments(reference, encoded, lag, stride = 1, begin = 0, stop = reference.length) {
  let xy = 0, xx = 0, yy = 0, sx = 0, sy = 0, n = 0;
  const start = Math.max(begin, 0, -lag), end = Math.min(stop, reference.length, encoded.length - lag);
  for (let i = start; i < end; i += stride) { const x = reference[i], y = encoded[i + lag]; xy += x*y; xx += x*x; yy += y*y; sx += x; sy += y; n++; }
  const covariance = xy - sx * sy / n, varianceX = xx - sx*sx/n, varianceY = yy - sy*sy/n;
  return { correlation: n > 2 && varianceX > 1e-12 && varianceY > 1e-12 ? covariance / Math.sqrt(varianceX * varianceY) : 0, gainDb: xx > 0 && yy > 0 ? 10 * Math.log10(yy / xx) : null, rms: Math.sqrt(xx / Math.max(1,n)), samples: n };
}

export function compareWaveforms(reference, encoded, { sampleRate = 8000, maxSearchSeconds = .5 } = {}) {
  if (!(reference instanceof Float32Array) || !(encoded instanceof Float32Array) || reference.length < sampleRate / 4 || encoded.length < sampleRate / 4) throw Error('Waveform comparison requires at least 250ms of decoded Float32 PCM');
  const search = Math.round(maxSearchSeconds * sampleRate), step = 8;
  let best = { correlation: -2, lag: 0 };
  for (let lag = -search; lag <= search; lag += step) { const m = moments(reference, encoded, lag, 8); if (m.correlation > best.correlation) best = { ...m, lag }; }
  const coarse = best.lag;
  best = { correlation: -2, lag: coarse };
  for (let lag = coarse - step; lag <= coarse + step; lag++) { const m = moments(reference, encoded, lag, 1); if (m.correlation > best.correlation) best = { ...m, lag }; }
  best = { ...moments(reference, encoded, best.lag), lag: best.lag };
  const segments = [];
  for (let start = 0; start < reference.length; start += 2 * sampleRate) {
    const segment = moments(reference, encoded, best.lag, 1, start, Math.min(reference.length, start + 2 * sampleRate));
    if (segment.rms > 1e-5) segments.push({ start: start / sampleRate, correlation: rounded(segment.correlation), gainDb: rounded(segment.gainDb) });
  }
  return { correlation: rounded(best.correlation), offsetSeconds: rounded(best.lag / sampleRate), gainDb: rounded(best.gainDb), sourceDuration: reference.length / sampleRate, encodedDuration: encoded.length / sampleRate, sourceRms: rounded(best.rms), segments, minSegmentCorrelation: segments.length ? Math.min(...segments.map(s => s.correlation)) : 0 };
}

/** Measured attack events, never an invented tempo grid. */
export function extractOnsets(samples, { sampleRate = 16000, sourceOffset = 0 } = {}) {
  const hop = Math.round(sampleRate * .01), window = hop * 2, rms = [], low = [], times = [];
  let filtered = 0; const lowSamples = new Float32Array(samples.length), alpha = 1 - Math.exp(-2*Math.PI*120/sampleRate);
  for (let i=0;i<samples.length;i++) { filtered += alpha * (samples[i] - filtered); lowSamples[i] = filtered; }
  for (let i=0;i+window<=samples.length;i+=hop) { let e=0,l=0; for(let j=i;j<i+window;j++){e+=samples[j]**2;l+=lowSamples[j]**2;} rms.push(Math.sqrt(e/window)); low.push(Math.sqrt(l/window)); times.push(sourceOffset+(i+window/2)/sampleRate); }
  const attacks = rms.map((e,i) => i ? Math.max(0, Math.log((e+1e-5)/(rms[i-1]+1e-5))) + .5*Math.max(0,Math.log((low[i]+1e-5)/(low[i-1]+1e-5))) : 0);
  const sorted = [...attacks].sort((a,b)=>a-b), cutoff = Math.max(.14, sorted[Math.floor(sorted.length*.82)] || 0), peak = Math.max(cutoff,...attacks);
  const chosen=[];
  for (const i of attacks.map((_,i)=>i).sort((a,b)=>attacks[b]-attacks[a])) {
    if(attacks[i]<cutoff) break;
    if(rms[i]<.004) continue;
    if(chosen.some(j=>Math.abs(times[j]-times[i])<.23))continue;
    if(i && attacks[i]<attacks[i-1] || i<attacks.length-1 && attacks[i]<attacks[i+1])continue;
    chosen.push(i);
  }
  return chosen.sort((a,b)=>a-b).map(i=>({time:rounded(times[i]),strength:rounded(Math.min(1,attacks[i]/peak)),kind:'measured_onset',confidence:rounded(Math.min(1,attacks[i]/Math.max(cutoff*2,1e-6))),provenance:{method:'20ms RMS and 120Hz low-band positive log-energy attack; 10ms hop',rms:rounded(rms[i]),lowBandRms:rounded(low[i]),attack:rounded(attacks[i]),threshold:rounded(cutoff),tempoGrid:false}}));
}

export async function detectAudioEvents({audioPath,sourceOffset=0,duration,outPath}) {
  const pcm=await decodeAudio(audioPath,{sourceOffset,duration,sampleRate:16000});
  const result={timebase:'source',beats:extractOnsets(pcm,{sourceOffset}),analysis:{method:'measured energy attacks, not beat phase inference',duration:pcm.length/16000,sampleRate:16000,sourceOffset,sourceSha256:await fileHash(audioPath)}};
  if(outPath)await atomicJson(outPath,result);
  return result;
}

export function alignLexicalWords(expected, observed) {
  const a=expected.map(w=>lexical(w.text??w)),b=observed.map(w=>lexical(w.text??w));
  const table=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
  for(let i=0;i<=a.length;i++)table[i][0]=i;
  for(let j=0;j<=b.length;j++)table[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)table[i][j]=Math.min(table[i-1][j]+1,table[i][j-1]+1,table[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  let i=a.length,j=b.length;const matches=Array(a.length).fill(null);
  while(i||j){if(i&&j&&table[i][j]===table[i-1][j-1]+(a[i-1]===b[j-1]?0:1)){if(a[i-1]===b[j-1])matches[i-1]=observed[j-1];i--;j--;}else if(i&&table[i][j]===table[i-1][j]+1)i--;else j--;}
  return {similarity:1-table[a.length][b.length]/Math.max(1,a.length,b.length),errors:table[a.length][b.length],matches};
}

export function assessWordEvidence(expected, acousticSource, acousticEncoded, recognitionPasses, thresholds=defaults) {
  const source=alignLexicalWords(expected,acousticSource).matches,encoded=alignLexicalWords(expected,acousticEncoded).matches;
  const recognized=recognitionPasses.map(pass=>alignLexicalWords(expected,pass).matches);
  return expected.map((word,i)=>{
    const a=source[i],b=encoded[i],probability=a?.provenance?.tokenProbability??0;
    const corroboration=recognized.flatMap((pass,k)=>pass[i]?[{pass:k,startDelta:rounded(Math.abs(pass[i].start-a?.start)),endDelta:rounded(Math.abs(pass[i].end-a?.end)),matchedText:pass[i].text}]:[]);
    const boundaryDelta=Math.min(...corroboration.flatMap(p=>[p.startDelta??Infinity,p.endDelta??Infinity]));
    const spread=a&&b?Math.max(Math.abs(a.start-b.start),Math.abs(a.end-b.end)):Infinity;
    const supported=!!a&&!!b&&probability>=thresholds.minWordAcousticConfidence&&spread<=thresholds.maxCodecAlignmentSpread&&boundaryDelta<=thresholds.maxCrossModelBoundaryDelta;
    const cueDelta=a?Math.abs(word.start-a.start):Infinity;
    const endDelta=a?Math.abs(word.end-a.end):Infinity;
    return {id:word.id,text:word.text,currentStart:word.start,currentEnd:word.end,acousticStart:a?.start,acousticEnd:a?.end,acousticConfidence:rounded(probability),codecAlignmentSpread:rounded(spread),crossModelBoundaryDelta:rounded(boundaryDelta),corroboration,supported,cueDelta:rounded(cueDelta),endDelta:rounded(endDelta),passed:supported&&cueDelta<=thresholds.maxCueDelta&&endDelta<=thresholds.maxEndDelta,repair:supported&&(cueDelta>.00001||endDelta>.00001)?{id:word.id,start:a.start,end:a.end,previousStart:word.start,previousEnd:word.end}:null};
  });
}

async function pythonRuntime(requested) {
  if(requested)return requested;
  if(process.env.ARK_AUDIO_PYTHON)return process.env.ARK_AUDIO_PYTHON;
  const known='/opt/homebrew/Cellar/openai-whisper/20250625_3/libexec/bin/python';
  if(await exists(known))return known;
  return 'python3';
}
function reviewWindows(words,duration){
  if(duration<=24)return [{start:0,end:duration,words}];
  const groups=[];let current=[];
  for(const word of words){if(current.length&&word.end-current[0].start>22){groups.push(current);current=[];}current.push(word);}if(current.length)groups.push(current);
  return groups.map(group=>({start:Math.max(0,group[0].start-.8),end:Math.min(duration,group.at(-1).end+.8),words:group}));
}

export async function reviewAudio(options) {
  const projectPath=path.resolve(options.projectPath),videoPath=path.resolve(options.videoPath),outDir=path.resolve(options.outDir??options.outputDir??`${videoPath}.audio-review`);
  const {project}=await loadProject(projectPath),audioPath=resolveSource(projectPath,project.audio.src),thresholds={...defaults,...options.thresholds};
  const maxAttempts=Math.max(1,Math.min(3,options.maxAttempts??3));
  await mkdir(path.join(outDir,'passes'),{recursive:true});
  const initialManifestDigest=digest(project);
  const binding={videoSha256:await fileHash(videoPath),projectHash:(await computeRevision(projectPath)).projectHash,audioSha256:await fileHash(audioPath)};
  const report={schemaVersion:1,kind:'machine-audio-review',binding,status:'failed',createdAt:new Date().toISOString(),methods:['Decoded mono PCM correlation and lag search across the exact source interval','Independent local Whisper base.en and small.en lyric recognition','Official local wav2vec2 CTC forced alignment with explicit instrumental blank states','Source versus AAC-decoded acoustic alignment stability'],limitations:['Machine evidence assesses content, sample alignment and word boundaries; it does not claim subjective hearing or mathematical perfection.','CTC model is English speech trained; low-confidence sung words fail and trigger bounded retries.'],checks:[],wordEvidence:[],repairs:[],attempts:[],projectChanged:false};
  const add=(id,passed,measured,threshold)=>report.checks.push({id,passed:!!passed,measured,threshold});
  const pcm=await decodeAudio(audioPath,{sourceOffset:project.audio.offset??0,duration:project.duration});
  const encoded=await decodeAudio(videoPath);
  const wave=compareWaveforms(pcm,encoded);
  add('decoded_audio_match',wave.correlation>=thresholds.minCorrelation&&wave.minSegmentCorrelation>=thresholds.minSegmentCorrelation&&Math.abs(wave.gainDb??Infinity)<=thresholds.maxGainDb,{correlation:wave.correlation,minSegmentCorrelation:wave.minSegmentCorrelation,gainDb:wave.gainDb,segments:wave.segments},{minCorrelation:thresholds.minCorrelation,minSegmentCorrelation:thresholds.minSegmentCorrelation,maxAbsoluteGainDb:thresholds.maxGainDb});
  add('audio_offset',Math.abs(wave.offsetSeconds)<=thresholds.maxOffsetSeconds,{offsetSeconds:wave.offsetSeconds},{maxAbsoluteSeconds:thresholds.maxOffsetSeconds});
  add('audio_duration',Math.abs(wave.encodedDuration-project.duration)<=thresholds.maxDurationError&&Math.abs(wave.sourceDuration-project.duration)<=thresholds.maxDurationError,{encodedSeconds:wave.encodedDuration,sourceSeconds:wave.sourceDuration,expectedSeconds:project.duration},{maxErrorSeconds:thresholds.maxDurationError});
  const expected=structuredClone(project.words),originalWords=structuredClone(project.words);
  const officialPath=options.lyricsPath??(project.intake?.originalLyrics?resolveSource(projectPath,project.intake.originalLyrics):null);
  let canonicalMismatch=false;
  if(officialPath){const canonical=(await readFile(officialPath,'utf8')).trim().split(/\s+/);if(canonical.length===expected.length){canonical.forEach((text,i)=>{if(text!==expected[i].text)canonicalMismatch=true;expected[i].text=text;});}else{report.canonicalLyricIssue='Official lyric word count differs from project; reimport with exact-lyric forced alignment before directing scenes.';}}
  const python=await pythonRuntime(options.python),alignCodeHash=await fileHash(path.join(root,'align.py'));
  const cacheDir=path.join(path.dirname(projectPath),'.review-cache','audio');
  report.cache={directory:cacheDir,hits:0,misses:0,rejectedEntries:0};
  let runtime;
  const modelHashes=new Map(),audioFingerprints=new Map();
  const modelPaths={base:options.baseModel??`${modelsRoot}/Whisper/base.en.pt`,small:options.model??`${modelsRoot}/Whisper/small.en.pt`,strong:options.strongModel??`${modelsRoot}/Whisper/medium.en.pt`,ctc:options.ctcModel??`${modelsRoot}/TorchAudio/wav2vec2_fairseq_base_ls960_asr_ls960.pth`};
  const runPass=async({input,inputHash,window,model,backend,task,lyrics,variant='original'})=>{
    const sourceOffset=(input===audioPath?(project.audio.offset??0):0)+window.start,duration=window.end-window.start;
    runtime??=await runtimeIdentity(python);
    if(!modelHashes.has(model))modelHashes.set(model,await fileHash(model));
    const audioKey=digest({input,sourceOffset,duration});
    if(!audioFingerprints.has(audioKey))audioFingerprints.set(audioKey,await fingerprintAudioWindow(input,{sourceOffset,duration}));
    const identity={schemaVersion:1,audio:audioFingerprints.get(audioKey),offset:sourceOffset,duration,model:{path:path.resolve(model),sha256:modelHashes.get(model)},backend,task,lyrics:task==='force-align'?lyrics:null,alignCodeHash,runtime,settings:{language:'en',threads:options.threads??4,device:'cpu',relaxedSpeech:variant.startsWith('recognition-retry')}};
    const cached=await cachedAudioPass({cacheDir,identity,generate:async()=>{
      const nonce=randomUUID(),rawPath=path.join(outDir,'passes',`inference-${nonce}.json`),textPath=path.join(outDir,'passes',`inference-${nonce}.txt`);
      if(task==='force-align')await writeFile(textPath,lyrics,{flag:'wx'});
      const args=[path.join(root,'align.py'),'--audio',input,'--output',rawPath,'--model',model,'--backend',backend,'--task',task,'--offset',String(sourceOffset),'--duration',String(duration),'--language','en','--threads',String(options.threads??4)];
      if(task==='force-align')args.push('--lyrics',textPath);
      if(identity.settings.relaxedSpeech)args.push('--relaxed-speech');
      try{await run(python,args,{maxBuffer:4*1024*1024,timeout:options.passTimeoutMs??180000});}catch(error){if(!await exists(rawPath))throw error;}
      const result=JSON.parse(await readFile(rawPath,'utf8'));
      if(digest(await fingerprintAudioWindow(input,{sourceOffset,duration}))!==digest(identity.audio)||await fileHash(model)!==identity.model.sha256)throw Error('Audio or model bytes changed during inference; refusing to cache stale evidence');
      if(validPass(result,identity)){await rm(rawPath);if(task==='force-align')await rm(textPath);}
      return result;
    }});
    const {result,key,cacheHit}=cached,target=path.join(outDir,'passes',`${String(report.attempts.length+1).padStart(4,'0')}-${randomUUID()}-${key}.json`);
    report.cache[cacheHit?'hits':'misses']++;if(cached.rejectedEntry)report.cache.rejectedEntries++;
    await atomicJson(target,{...result,cacheEvidence:{key,cacheHit,entryPath:cached.entryPath,resultSha256:cached.resultSha256,currentInput:input,currentInputSha256:inputHash,decodedAudio:identity.audio,model:identity.model,runtimeSha256:digest(runtime)}});
    report.attempts.push({task,backend,model:path.basename(model),input:input===audioPath?'source':'encoded',start:window.start,end:window.end,status:result.status,artifact:target,artifactSha256:await fileHash(target),variant,cacheHit,cacheKey:key,decodedAudioSha256:identity.audio.sha256,modelSha256:identity.model.sha256});
    const origin=input===audioPath?(project.audio.offset??0):0;
    return {...result,words:result.words.map(w=>({...w,start:w.start-origin,end:w.end-origin}))};
  };
  const phraseResults=[];let failure=null;
  try{
    if(!expected.length)throw Error('No canonical lyric words exist; perform song transcription before lyric review');
    if(report.canonicalLyricIssue)throw Error(report.canonicalLyricIssue);
    for(const window of reviewWindows(expected,project.duration)){
      let lyrics=window.words.map(w=>w.text).join(' ');const sourceArg={input:audioPath,inputHash:binding.audioSha256,window,lyrics},encodedArg={input:videoPath,inputHash:binding.videoSha256,window,lyrics};
      const base=await runPass({...sourceArg,model:modelPaths.base,backend:'openai-whisper',task:'transcribe'});
      const small=await runPass({...sourceArg,model:modelPaths.small,backend:'openai-whisper',task:'transcribe'});
      let output=await runPass({...encodedArg,model:modelPaths.base,backend:'openai-whisper',task:'transcribe'});
      let strong=null;
      const sourceDisagreement=alignLexicalWords(base.words,small.words).similarity<1;
      if(!officialPath&&sourceDisagreement){
        if(maxAttempts<2||!await exists(modelPaths.strong))throw Error('Independent ASR models disagree on lyric content; a bounded stronger local checkpoint retry is required. No ambiguous lyric was accepted.');
        strong=await runPass({...sourceArg,model:modelPaths.strong,backend:'openai-whisper',task:'transcribe',variant:'recognition-retry-strong-model'});
        report.methods.push('Conditional official Whisper medium.en retry to arbitrate independent recognition disagreement');
      }
      let acoustic=await runPass({...sourceArg,model:modelPaths.ctc,backend:'torchaudio-ctc',task:'force-align'});
      // With audio alone, independent recognizers can disagree. Compare the disputed words
      // acoustically; do not canonize whichever recognizer happened to run first.
      if(!officialPath){
        for(const candidate of strong?[strong]:[base,small]){
          if(candidate.words.length!==window.words.length)continue;
          const disputed=window.words.map((w,i)=>lexical(w.text)!==lexical(candidate.words[i].text)?i:-1).filter(i=>i>=0);
          if(!disputed.length)continue;
          const candidateLyrics=candidate.words.map(w=>w.text).join(' ');
          const measured=await runPass({...sourceArg,lyrics:candidateLyrics,model:modelPaths.ctc,backend:'torchaudio-ctc',task:'force-align',variant:'content-candidate'});
          if(measured.words.length!==window.words.length)continue;
          const oldConfidence=mean(disputed.map(i=>acoustic.words[i]?.provenance?.tokenProbability??0));
          const newConfidence=mean(disputed.map(i=>measured.words[i]?.provenance?.tokenProbability??0));
          const recognitionVotes=disputed.map(i=>[base,small,strong].filter(Boolean).filter(pass=>pass.words.length===candidate.words.length&&lexical(pass.words[i].text)===lexical(candidate.words[i].text)).length);
          const strongerProbabilities=disputed.map(i=>candidate.words[i]?.provenance?.tokenProbability??0);
          const independentConsensus=strong&&recognitionVotes.every(n=>n>=2)&&strongerProbabilities.every(p=>p>=.6);
          if(newConfidence>=thresholds.minWordAcousticConfidence&&(independentConsensus||!sourceDisagreement&&newConfidence>=oldConfidence*1.5)){
            report.lyricCandidateDecisions??=[];report.lyricCandidateDecisions.push({oldText:lyrics,selectedText:candidateLyrics,disputedWordIds:disputed.map(i=>window.words[i].id),previousAcousticConfidence:oldConfidence,selectedAcousticConfidence:newConfidence,recognitionVotes,strongerModelTokenProbabilities:strongerProbabilities,selectionRule:independentConsensus?'At least 2 of 3 distinct checkpoints, stronger model token probability >= 0.6, and acoustic confidence >= 0.2':'Acoustic likelihood ratio >= 1.5 with no recognition disagreement'});
            for(const i of disputed)window.words[i].text=candidate.words[i].text;
            lyrics=window.words.map(w=>w.text).join(' ');sourceArg.lyrics=lyrics;encodedArg.lyrics=lyrics;canonicalMismatch=true;acoustic=measured;report.requiresDirectorReplan=true;
          }
        }
        if(strong&&alignLexicalWords(window.words,strong.words).similarity<1)throw Error('Stronger local ASR and acoustic evidence did not resolve the lyric disagreement; no ambiguous candidate was accepted');
      }
      const acousticOutput=await runPass({...encodedArg,model:modelPaths.ctc,backend:'torchaudio-ctc',task:'force-align'});
      if(alignLexicalWords(window.words,output.words).similarity<1&&maxAttempts>=2)output=await runPass({...encodedArg,model:strong?modelPaths.strong:modelPaths.small,backend:'openai-whisper',task:'transcribe',variant:'recognition-retry-encoded'});
      const recognitionPasses=[base.words,small.words,...(strong?[strong.words]:[]),output.words];
      const phrase={start:window.start,end:window.end,sourceSimilarity:Math.max(...[base,small,strong].filter(Boolean).map(pass=>alignLexicalWords(window.words,pass.words).similarity)),encodedSimilarity:alignLexicalWords(window.words,output.words).similarity};
      phraseResults.push(phrase);
      let evidence=assessWordEvidence(window.words,acoustic.words,acousticOutput.words,recognitionPasses,thresholds);
      // Retry uncertain boundaries in narrower acoustic windows; never substitute a fabricated timestamp.
      for(let attempt=1;attempt<maxAttempts&&evidence.some(w=>!w.supported);attempt++){
        for(const item of evidence.filter(w=>!w.supported)){
          const index=window.words.findIndex(w=>w.id===item.id),startIndex=Math.max(0,index-1),endIndex=Math.min(window.words.length,index+2),phraseWords=window.words.slice(startIndex,endIndex);
          const retry={start:Math.max(window.start,phraseWords[0].start-.6*attempt),end:Math.min(window.end,phraseWords.at(-1).end+.6*attempt),words:phraseWords};
          const retryLyrics=phraseWords.map(w=>w.text).join(' ');
          const a=await runPass({...sourceArg,window:retry,lyrics:retryLyrics,model:modelPaths.ctc,backend:'torchaudio-ctc',task:'force-align',variant:`retry-${attempt}-${item.id}`});
          const b=await runPass({...encodedArg,window:retry,lyrics:retryLyrics,model:modelPaths.ctc,backend:'torchaudio-ctc',task:'force-align',variant:`retry-${attempt}-${item.id}`});
          const replacement=assessWordEvidence(phraseWords,a.words,b.words,recognitionPasses,thresholds).find(w=>w.id===item.id);
          if(replacement?.supported)evidence=evidence.map(w=>w.id===item.id?{...replacement,retry:attempt}:w);
        }
      }
      report.wordEvidence.push(...evidence);
    }
  }catch(error){failure=error.message;report.error=failure;}
  const phrasePass=!failure&&phraseResults.length>0&&phraseResults.every(p=>p.sourceSimilarity>=thresholds.minLyricSimilarity&&p.encodedSimilarity>=thresholds.minLyricSimilarity);
  add('lyric_phrase_match',phrasePass,{windows:phraseResults,error:failure,canonicalTextReconciled:canonicalMismatch},{minSourceAndEncodedSimilarity:thresholds.minLyricSimilarity});
  const average=mean(report.wordEvidence.map(w=>w.acousticConfidence??0));
  const syncPass=!failure&&report.wordEvidence.length===expected.length&&report.wordEvidence.every(w=>w.passed)&&average>=thresholds.minMeanAcousticConfidence&&!canonicalMismatch;
  report.repairs=report.wordEvidence.flatMap(w=>w.repair?[w.repair]:[]);
  if(canonicalMismatch&&phrasePass&&report.wordEvidence.every(w=>w.supported))expected.forEach((word,i)=>{if(word.text!==originalWords[i].text){const r=report.repairs.find(r=>r.id===word.id);if(r)r.text=word.text;else report.repairs.push({id:word.id,text:word.text,start:word.start,end:word.end,previousText:originalWords[i].text,previousStart:word.start,previousEnd:word.end});}});
  add('word_sync',syncPass,{wordCount:expected.length,verifiedWords:report.wordEvidence.filter(w=>w.passed).length,unsupportedWords:report.wordEvidence.filter(w=>!w.supported).map(w=>w.id),maxCueDelta:Math.max(0,...report.wordEvidence.map(w=>w.cueDelta??Infinity)),maxEndDelta:Math.max(0,...report.wordEvidence.map(w=>w.endDelta??Infinity)),meanAcousticConfidence:rounded(average),repairs:report.repairs,error:failure},{maxCueDelta:thresholds.maxCueDelta,maxEndDelta:thresholds.maxEndDelta,minWordAcousticConfidence:thresholds.minWordAcousticConfidence,minMeanAcousticConfidence:thresholds.minMeanAcousticConfidence,maxCodecAlignmentSpread:thresholds.maxCodecAlignmentSpread,maxCrossModelBoundaryDelta:thresholds.maxCrossModelBoundaryDelta});
  const stableChecks=report.checks.filter(c=>c.id!=='word_sync').every(c=>c.passed);
  const repairable=stableChecks&&report.repairs.length>0&&report.wordEvidence.every(w=>w.supported)&&average>=thresholds.minMeanAcousticConfidence;
  report.status=report.checks.every(c=>c.passed)?'passed':repairable?'needs_repair':'failed';
  if(repairable&&options.repair){
    report.status='needs_repair';
    if(digest(JSON.parse(await readFile(projectPath,'utf8')))!==initialManifestDigest)throw Error('Project changed during audio review; refusing to overwrite concurrent edits');
    for(const repair of report.repairs){const word=project.words.find(w=>w.id===repair.id);word.provenance={...word.provenance,audioReview:{previous:{text:word.text,start:word.start,end:word.end},method:'acoustic CTC alignment corroborated by independent ASR and AAC round-trip',confidence:report.wordEvidence.find(w=>w.id===word.id)?.acousticConfidence,evidence:digest(report.wordEvidence),createdAt:report.createdAt}};word.start=repair.start;word.end=repair.end;if(repair.text)word.text=repair.text;word.confidence='machine_acoustic_verified';}
    const validation=await validateProject(project,projectPath);if(!validation.valid)throw Error(`Audio repair rejected: ${validation.errors.join('; ')}`);
    const backup=path.join(path.dirname(projectPath),'.revisions',`audio-${Date.now()}-${randomUUID().slice(0,8)}.json`);await mkdir(path.dirname(backup),{recursive:true});await copyFile(projectPath,backup);await atomicJson(projectPath,project);report.projectChanged=true;report.revision=backup;report.repairedProjectHash=(await computeRevision(projectPath)).projectHash;report.nextAction='Rerender the repaired project, then rerun audio review to bind acceptance to the new encoded artifact.';
  }
  report.reportPath=path.join(outDir,'audio-review.json');
  await atomicJson(report.reportPath,report);
  if(report.status==='passed')await atomicJson(`${videoPath}.audio-review.json`,report);
  return report;
}
