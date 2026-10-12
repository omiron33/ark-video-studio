// Post-encode integration only. Critic owns analysis; Ark retains render/review authority.
import {spawn} from 'node:child_process';
import {readFile,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {atomicJson,fileHash} from './project.mjs';
import {computeRevision} from './gauntlet.mjs';
const engineRoot=path.dirname(fileURLToPath(import.meta.url));
async function execute(python,args,onProgress){
 return await new Promise((resolve,reject)=>{
  const child=spawn(python,args,{stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
  onProgress({type:'critic-worker',pid:child.pid,startedAt:new Date().toISOString(),owner:'Ark encoded-artifact critic',command:[python,...args]});
  child.stdout.on('data',d=>{stdout=(stdout+d).slice(-4*1024*1024);onProgress({type:'critic-progress',detail:String(d).slice(-400)})});
  child.stderr.on('data',d=>{stderr=(stderr+d).slice(-10000)});
  child.once('error',reject);child.once('close',code=>resolve({code,stdout,stderr}));
 });
}
export async function reviewRenderedArtifact(receipt,{root=process.env.ARK_CRITIC_ROOT||'/Volumes/Code/studio-critic',python=process.env.ARK_CRITIC_PYTHON,viewer=process.env.ARK_CRITIC_URL,archive=process.env.ARK_CRITIC_ARCHIVE||root,onProgress=()=>{},executeWorker=execute,revision=computeRevision,hash=fileHash}={}){
 let result;const receiptPath=`${receipt.output}.render.json`;
 try{
  if(await hash(receipt.output)!==receipt.sha256)throw Error('Encoded artifact changed after render');
  const before=await revision(receipt.projectPath);
  if(!receipt.sourceRevision?.revisionHash||before.revisionHash!==receipt.sourceRevision.revisionHash)throw Error('Rendered source revision is stale; review cannot bind current sources to this film');
  let settings={};try{settings=JSON.parse(await readFile(path.join(root,'integration-settings.json'),'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;}
  python ||= settings.python || (process.platform==='darwin'?'/opt/homebrew/bin/python3':'python3');viewer ||= settings.viewerUrl || 'http://127.0.0.1:4327';
  const worker=path.join(root,'scripts/ark_run.py');if(!(await stat(worker)).isFile())throw Error('Studio Critic runtime is unavailable');
  onProgress({type:'critic-review',output:receipt.output});
  const run=await executeWorker(python,[worker,'--receipt',receiptPath,'--engine-root',engineRoot,'--archive',archive],onProgress);
  await writeFile(`${receipt.output}.critic.log`,run.stdout+'\n'+run.stderr);
  const lines=run.stdout.trim().split('\n');result=JSON.parse(lines.at(-1));
  if(run.code!==0||!result.integrity?.valid||result.binding?.videoSha256!==receipt.sha256)throw Error(result.error||'Critic returned unverified evidence');
  const after=await revision(receipt.projectPath);
  if(after.revisionHash!==before.revisionHash||await hash(receipt.output)!==receipt.sha256)throw Error('Video or source changed during critic review');
  result.reviewUrl=viewer.replace(/\/$/,'')+'/#'+encodeURIComponent(result.reportId);
  result.renderRevision=before.revisionHash;
 }catch(error){result={schemaVersion:1,status:'unavailable',error:error.message,aestheticApproval:false,nextAction:'Automatic review could not verify this artifact; restore the recorded source/runtime and repeat the run.'};}
 // Keep prior attempts for audit; the current pointer is only for this exact rendered artifact.
 const sidecar=`${receipt.output}.critic.json`;let history=[];
 try{const previous=JSON.parse(await readFile(sidecar,'utf8'));history=[...(previous.history||[]),previous.current]}catch(e){if(e.code!=='ENOENT')throw e;}
 await atomicJson(sidecar,{schemaVersion:1,current:result,history,checkedAt:new Date().toISOString()});
 onProgress({type:'critic-complete',status:result.status,reviewUrl:result.reviewUrl,error:result.error});
 return result;
}
