"""Deliver root-authorized exact final film as a new pending-review candidate."""
from pathlib import Path
import datetime,hashlib,json,urllib.request,subprocess
from h3_jobs import remote,copy
ROOT=Path(__file__).resolve().parent
HOST='https://omipc.taild60b4e.ts.net'
src=Path('/Volumes/DATA/ArkRender/genesis1/genesis1-breath-earth-v1.mp4')
review=src.parent/'visual-v1/independent-visual-review.json'
raw=src.read_bytes();sha=hashlib.sha256(raw).hexdigest();md5=hashlib.md5(raw).hexdigest()
assert sha=='b946c097f0902c0f3b4eda3a330aceca2ef893c29bd5a7eb511cc34101d130db'
visual=json.loads(review.read_text());assert visual['sha256']==sha and visual['blockingIssues']==[]
prefix='C:/Users/sjfis/Videos/Genesis1/full-v1-'+sha[:12];rp=prefix.replace('/','\\')
thumb=ROOT/'full-v1-thumbnail.jpg';assert thumb.exists()
metadata={'project':'Genesis1 - The Beginning','title':'Genesis 1 — Breath & Earth — Full Film v1','version':'Full Film v1','sourceAgent':'Codex','sourceMachine':'Mac mini','sourcePath':str(src),'notes':f"Complete Genesis 1 lyric film, 304.733333 seconds / 9142 frames, 1080p30. Approved theme 3: restrained charcoal, bone, rust and amber. 63 authored animation families, four generated motion inserts, and active foreground words/graphics throughout the supporting media. Independent encoded visual review accepted with no blocking issues (legibility 9.1, semantic motion 8.6, photorealism 8.8, composition 8.9, continuity 9.2). Source-versus-encoded PCM correlation 0.998748, minimum segment correlation 0.996351, zero measured global lag, as reported by root review. Audio transport verification does not certify every sung word. Full word-OCR and strict singing-recognition results are still pending; no perfect-sync or complete-gauntlet-pass claim. Pending Shane review. Prior preview candidates preserved. SHA256 {sha}.",'status':'pending_review','path':rp+'.mp4','thumbnail':rp+'.jpg','expectedMd5':md5}
meta=ROOT/'full-app-metadata.json';meta.write_text(json.dumps(metadata,indent=2)+'\n')
subprocess.run(['scp','-o','HostKeyAlias=omipc',str(src),'sjfis@omipc.taild60b4e.ts.net:'+prefix+'.mp4'],check=True,capture_output=True,timeout=180)
copy(thumb,prefix+'.jpg');copy(meta,prefix+'.json')
rsha=remote(f"(Get-FileHash -Algorithm SHA256 '{rp}.mp4').Hash").lower();assert rsha==sha
result=json.loads(remote(f"$body=Get-Content -Raw '{rp}.json';Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4317/api/admin/videos/ingest -ContentType 'application/json' -Body $body|ConvertTo-Json -Depth 20"))
(ROOT/'full-app-ingest.json').write_text(json.dumps(result,indent=2)+'\n')
vid=result['video']['id'];watch=HOST+'/api/admin/videos/'+vid+'/media';download=watch+'?download=1'
h=hashlib.sha256();count=0
with urllib.request.urlopen(download,timeout=60) as res:
 headers={'httpStatus':res.status,'contentType':res.headers.get('Content-Type'),'contentDisposition':res.headers.get('Content-Disposition')}
 while True:
  chunk=res.read(1024*1024)
  if not chunk:break
  h.update(chunk);count+=len(chunk)
dsha=h.hexdigest();assert dsha==sha and count==len(raw)
with urllib.request.urlopen(urllib.request.Request(watch,headers={'Range':'bytes=0-1023'}),timeout=30) as res:
 status=res.status;crange=res.headers.get('Content-Range');chunk=res.read()
assert status==206 and len(chunk)==1024
record={'id':'full-v1','title':metadata['title'],'candidateId':vid,'status':result['video']['status'],'reviewUrl':HOST+'/studio#videos','watchUrl':watch,'downloadUrl':download,'localFile':str(src),'localSha256':sha,'remoteCopiedSha256':rsha,'remoteDownloadSha256':dsha,'bytes':count,'rangeStatus':status,'contentRange':crange,'duplicate':result.get('duplicate'),'thumbnail':str(thumb),'thumbnailAtSeconds':2,'thumbnailSha256':hashlib.sha256(thumb.read_bytes()).hexdigest(),'visualReview':str(review),'visualReviewSha256':hashlib.sha256(review.read_bytes()).hexdigest(),'audioTransportEvidence':'Root reported PCM correlation0.998748 / min segment0.996351 / zero global lag. Word OCR and strict recognition still pending at ingestion.','preservesPreviewCandidates':True,'finalAuditUpdatePending':True,'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),**headers}
(ROOT/'full-app-delivery.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
