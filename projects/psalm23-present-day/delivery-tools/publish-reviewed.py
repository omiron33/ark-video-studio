#!/usr/bin/env python3
"""Hash-bound, idempotent Psalm 23 review-candidate delivery. Default is read-only."""
from pathlib import Path
import argparse,datetime,hashlib,json,subprocess,urllib.request,uuid
from remote_helpers import remote,copy,psquote
HERE=Path(__file__).resolve().parent;PROJECT=HERE.parent
HOST='https://omipc.taild60b4e.ts.net';WORKFLOW='psalm-23-lxx-22-shepherd';SONG='32885123-f4b6-42e6-a546-f4acba404829'
AUDIO_SHA='3669040e797c9d2bf8b4136dc4c029c6e1ed51f302ccc411d1888ae50da80c8f';LYRICS_SHA='021492487b56a3ac1dac962cc4c75658b250d8a05ac925f0aebc9a72a09f385a'
REPO='C:/Users/sjfis/Documents/Codex/orthodox-songbook';ARCHIVE=f'{REPO}/media/suno/workflows/{WORKFLOW}/{SONG}.m4a'
def digest(p,kind='sha256'):
 h=hashlib.new(kind)
 with Path(p).open('rb') as f:
  for chunk in iter(lambda:f.read(8*1024*1024),b''):h.update(chunk)
 return h.hexdigest()
def api(path):
 with urllib.request.urlopen(HOST+path,timeout=30) as r:return json.load(r)
def rjson(script,timeout=90):return json.loads(remote(script,timeout))
def snapshot():
 health=api('/api/health');assert health.get('ok') is True,'App health failed'
 workflow=api('/api/admin/suno/workflows/'+WORKFLOW);workflow=workflow.get('workflow',workflow)
 assert workflow['id']==WORKFLOW and workflow['lyricsSha256']==LYRICS_SHA,'Workflow identity/lyrics changed'
 assert any('https://suno.com/song/'+SONG in t.get('songUrls',[])for t in workflow.get('takes',[])),'Selected song missing from workflow'
 assert workflow['lyrics'].strip()==(PROJECT/'sources/canonical-lyrics.txt').read_text().strip(),'Canonical lyrics differ'
 source=rjson("$f="+psquote(ARCHIVE)+";@{sha256=(Get-FileHash -Algorithm SHA256 $f).Hash.ToLower();bytes=(Get-Item $f).Length}|ConvertTo-Json",30)
 assert source['sha256']==AUDIO_SHA,'Remote source audio differs'
 videos=api('/api/admin/videos')['videos']
 return {'health':health,'workflow':workflow,'source':source,'videos':videos}
def summary(state):
 return {'health':state['health'],'workflowId':state['workflow']['id'],'workflowLyricsSha256':state['workflow']['lyricsSha256'],'songId':SONG,'source':state['source'],'videoCount':len(state['videos']),'existingPsalm23Candidates':[{k:v.get(k)for k in ('id','title','status','sha256')}for v in state['videos'] if v.get('project')=='Psalm 23 (LXX 22) lyric film']}
def contains(value,wanted):
 if value==wanted:return True
 if isinstance(value,dict):return any(contains(v,wanted)for v in value.values())
 if isinstance(value,list):return any(contains(v,wanted)for v in value)
 return False
def validate_report(report_path,video,poster):
 report=json.loads(report_path.read_text());sha=digest(video);psha=digest(poster)
 assert report.get('status')=='accepted_for_user_review','Report must explicitly accept this reviewed candidate, not user approval'
 assert report.get('videoSha256')==sha and report.get('posterSha256')==psha,'Artifact hashes differ from review disposition'
 assert report.get('sourceAudioSha256')==AUDIO_SHA,'Report source song differs'
 assert isinstance(report.get('auditNote'),str) and report['auditNote'].strip(),'Concrete audit note required'
 assert len(report['auditNote'])<=3300,'Audit note exceeds safe app notes budget'
 evidence=[]
 for kind in ['technical','visual','audio']:
  gate=report.get(kind,{});allowed={'technical':['passed'],'visual':['accepted'],'audio':['passed','documented_exception']}[kind]
  assert gate.get('status') in allowed,f'{kind} disposition is not review-ready'
  if gate['status']=='documented_exception':assert isinstance(gate.get('exception'),str) and gate['exception'].strip(),'Audio exception must be explicit'
  ep=Path(gate['reportPath']);ep=ep if ep.is_absolute()else report_path.parent/ep
  assert digest(ep)==gate['reportSha256'],f'{kind} evidence bytes changed'
  ed=json.loads(ep.read_text());assert contains(ed,sha),f'{kind} evidence must bind exact video SHA'
  evidence.append({'kind':kind,'path':str(ep.resolve()),'sha256':digest(ep),'status':gate['status']})
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(video)],text=True))
 assert any(s['codec_type']=='video'for s in probe['streams'])and any(s['codec_type']=='audio'for s in probe['streams']),'Movie requires both picture and source audio'
 assert abs(float(probe['format']['duration'])-219.96)<=.08,'Full-song duration differs from exact source'
 assert poster.suffix.lower() in ('.jpg','.jpeg','.png','.webp'),'Unsupported poster format'
 return report,sha,psha,evidence,probe

def remote_hash(path):
 return rjson("$p="+psquote(path)+";if(Test-Path -LiteralPath $p){@{exists=$true;sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $p).Hash.ToLower()}|ConvertTo-Json}else{@{exists=$false}|ConvertTo-Json}",60)
def ensure_copy(source,destination):
 expected=digest(source);state=remote_hash(destination)
 if state['exists']:
  assert state['sha256']==expected,'Refusing to overwrite different remote bytes: '+destination
  return {'sha256':expected,'reused':True}
 stage=destination+'.uploading-'+uuid.uuid4().hex
 copy(source,stage,timeout=600)
 assert remote_hash(stage)['sha256']==expected,'Remote upload hash mismatch'
 remote("$src="+psquote(stage)+";$dest="+psquote(destination)+";if(Test-Path -LiteralPath $dest){throw 'Destination appeared during upload; preserving both'};Move-Item -LiteralPath $src -Destination $dest",60)
 assert remote_hash(destination)['sha256']==expected,'Final remote file hash mismatch'
 return {'sha256':expected,'reused':False}
def post_local(payload_path,uri):
 return rjson("$body=Get-Content -Raw -LiteralPath "+psquote(payload_path)+";Invoke-RestMethod -Method Post -Uri "+psquote('http://127.0.0.1:4317'+uri)+" -ContentType 'application/json' -Body $body|ConvertTo-Json -Depth 30",120)
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--check-readiness',action='store_true');ap.add_argument('--video',type=Path);ap.add_argument('--poster',type=Path);ap.add_argument('--report',type=Path);ap.add_argument('--version',default='Held in the Ordinary - full film v1');ap.add_argument('--execute',action='store_true',help='Perform reviewed candidate copy/registration; absent means read-only dry run')
 args=ap.parse_args()
 if args.check_readiness:
  assert not args.execute,'Readiness mode never mutates';print(json.dumps(summary(snapshot()),indent=2));return
 if not all([args.video,args.poster,args.report]):ap.error('--video, --poster, --report are required')
 video=args.video.resolve();poster=args.poster.resolve();report_path=args.report.resolve()
 report,sha,psha,evidence,probe=validate_report(report_path,video,poster);state=snapshot()
 matches=[v for v in state['videos'] if v.get('sha256')==sha]
 if matches:assert len(matches)==1 and matches[0].get('project')=='Psalm 23 (LXX 22) lyric film','Same movie belongs to another project; preserve and inspect'
 prefix='C:/Users/sjfis/Videos/Psalm23/held-in-ordinary-'+sha[:16];remote_video=prefix+'.mp4';remote_poster=prefix+poster.suffix.lower();remote_report=prefix+'-review-'+digest(report_path)[:12]+'.json'
 plan={'mode':'execute' if args.execute else 'read_only_dry_run','video':str(video),'sha256':sha,'posterSha256':psha,'remoteVideo':remote_video,'remotePoster':remote_poster,'remoteReport':remote_report,'existingCandidateId':matches[0]['id']if matches else None,'statusOnIngest':'pending_review','workflow':WORKFLOW,'noSuperseding':True,'evidence':evidence,'app':summary(state)}
 if not args.execute:print(json.dumps(plan,indent=2));return
 run=HERE/'runs'/sha;run.mkdir(parents=True,exist_ok=True);(run/'plan.json').write_text(json.dumps(plan,indent=2)+'\n');(run/'workflow-before.json').write_text(json.dumps(state['workflow'],indent=2)+'\n')
 remote("New-Item -ItemType Directory -Force -Path 'C:/Users/sjfis/Videos/Psalm23'|Out-Null",30)
 copies={'video':ensure_copy(video,remote_video),'poster':ensure_copy(poster,remote_poster),'report':ensure_copy(report_path,remote_report)}
 notes='Psalm 23 (LXX 22) The Lord Is My Shepherd. Full 219.96-second source, selected Suno take '+SONG+'. Shane chose theme 1, Held in the Ordinary: contemporary protection and lyric-led animation. '+report['auditNote'].strip()+' Pending Shane review; not user approved. Video SHA256 '+sha+'. Review report SHA256 '+digest(report_path)+'.'
 if report['audio']['status']=='documented_exception':notes+=' Audio exception: '+report['audio']['exception']
 assert len(notes)<=5000,'Combined notes exceed app limit'
 metadata={'path':remote_video.replace('/','\\'),'thumbnail':remote_poster.replace('/','\\'),'project':'Psalm 23 (LXX 22) lyric film','title':'Psalm 23 — Held in the Ordinary','version':args.version,'sourceAgent':'Codex','sourceMachine':'Mac mini / OmiPC','sourcePath':str(video),'notes':notes,'status':'pending_review','expectedMd5':digest(video,'md5')}
 mf=run/'ingest-metadata.json';mf.write_text(json.dumps(metadata,indent=2)+'\n');remote_meta=prefix+'-metadata-'+digest(mf)[:12]+'.json';ensure_copy(mf,remote_meta)
 result=post_local(remote_meta,'/api/admin/videos/ingest');candidate=result['video'];assert candidate['sha256']==sha,'Registered bytes differ';vid=candidate['id']
 (run/'ingest-result.json').write_text(json.dumps(result,indent=2)+'\n')
 watch=HOST+'/api/admin/videos/'+vid+'/media';download=watch+'?download=1&master=1';h=hashlib.sha256();count=0
 with urllib.request.urlopen(download,timeout=120) as response:
  http_status=response.status;ctype=response.headers.get('Content-Type')
  for chunk in iter(lambda:response.read(8*1024*1024),b''):h.update(chunk);count+=len(chunk)
 assert h.hexdigest()==sha and count==video.stat().st_size,'App master download differs'
 with urllib.request.urlopen(urllib.request.Request(watch,headers={'Range':'bytes=0-1023'}),timeout=30) as response:range_status=response.status;crange=response.headers.get('Content-Range');chunk=response.read()
 assert range_status==206 and len(chunk)==1024,'Range playback failed'
 with urllib.request.urlopen(HOST+'/api/admin/videos/'+vid+'/thumbnail',timeout=30) as response:thumbnail_data=response.read()
 assert hashlib.sha256(thumbnail_data).hexdigest()==psha,'App thumbnail differs'
 # Call the existing saveWorkflow directly in one synchronous Node operation.
 # It reads the current workflow, preserves every current field/history, and appends once.
 marker='[Ark Psalm23 candidate '+sha+']'
 wf_note=marker+' Theme 1 chosen by Shane: Held in the Ordinary. Reviewed candidate '+vid+'; awaiting Shane review. '+watch+' . SHA256 '+sha+'. Review report: '+remote_report+'.'
 payload={'workflowId':WORKFLOW,'songId':SONG,'lyricsSha256':LYRICS_SHA,'marker':marker,'note':wf_note}
 payload_file=run/'workflow-registration.json';payload_file.write_text(json.dumps(payload,indent=2)+'\n');remote_payload=prefix+'-workflow-'+digest(payload_file)[:12]+'.json';ensure_copy(payload_file,remote_payload)
 js="""import fs from 'node:fs';import {pathToFileURL} from 'node:url';const [repo,payloadPath]=process.argv.slice(2);const {listWorkflows,saveWorkflow}=await import(pathToFileURL(repo+'/api/suno-workflows.mjs'));const p=JSON.parse(fs.readFileSync(payloadPath,'utf8'));const before=listWorkflows();const w=before.workflows.find(x=>x.id===p.workflowId);if(!w||w.lyricsSha256!==p.lyricsSha256||!w.takes.some(t=>t.songUrls.includes('https://suno.com/song/'+p.songId)))throw Error('Workflow identity changed');if(w.notes.includes(p.marker)){console.log(JSON.stringify({changed:false,workflow:w}));}else{const notes=w.notes+'\\n\\n'+p.note;if(notes.length>4000)throw Error('Workflow notes would exceed4000characters; existing notes preserved');const updated=saveWorkflow(w.id,{...w,notes});const after=listWorkflows();for(const old of before.workflows){if(old.id!==w.id&&JSON.stringify(old)!==JSON.stringify(after.workflows.find(x=>x.id===old.id)))throw Error('Unrelated workflow changed');}for(const key of Object.keys(w)){if(!['notes','updatedAt'].includes(key)&&JSON.stringify(w[key])!==JSON.stringify(updated[key]))throw Error('Unexpected workflow field changed:'+key);}console.log(JSON.stringify({changed:true,workflow:updated}));}"""
 jf=run/'register-workflow.mjs';jf.write_text(js+'\n');remote_js=prefix+'-register-'+digest(jf)[:12]+'.mjs';ensure_copy(jf,remote_js)
 workflow_result=rjson("& 'C:/Program Files/nodejs/node.exe' "+psquote(remote_js)+' '+psquote(REPO)+' '+psquote(remote_payload),60)
 after=api('/api/admin/videos')['videos'];byid={v['id']:v for v in after}
 for old in state['videos']:
  assert old['id']in byid,'Existing video disappeared'
  if old['id']!=vid:assert old==byid[old['id']],'Existing candidate changed during delivery: '+old['id']
 record={'status':'verified_review_candidate_delivery','candidateId':vid,'candidateStatus':candidate['status'],'duplicate':result.get('duplicate'),'sha256':sha,'remoteDownloadSha256':h.hexdigest(),'posterSha256':psha,'copies':copies,'bytes':count,'httpStatus':http_status,'contentType':ctype,'rangeStatus':range_status,'contentRange':crange,'watchUrl':watch,'downloadUrl':download,'reviewUrl':HOST+'/studio#videos','workflowUrl':HOST+'/studio#workflows','workflowRegistered':workflow_result['workflow']['notes'].count(marker)==1,'workflowChanged':workflow_result['changed'],'priorCandidatesPreserved':len(state['videos']),'reviewReport':str(report_path),'reviewReportSha256':digest(report_path),'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 (run/'app-delivery.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record,indent=2))
if __name__=='__main__':main()
