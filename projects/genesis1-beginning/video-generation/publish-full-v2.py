"""Publish the root-authorized corrected full film only after bound visual-delta acceptance."""
from pathlib import Path
import datetime,hashlib,json,urllib.request
from h3_jobs import remote,copy
ROOT=Path(__file__).resolve().parent;HOST='https://omipc.taild60b4e.ts.net'
src=Path('/Volumes/DATA/ArkRender/genesis1/genesis1-breath-earth-v2.mp4')
review=src.parent/'visual-v2/independent-visual-review.json';audio=src.parent/'review-v2/audio/bounded-summary.json'
expected='bd147120463a4852418e1ca76ab4d4bfefceff80d9ac8c4ec67ac3f93d6e6f45'
raw=src.read_bytes();sha=hashlib.sha256(raw).hexdigest();md5=hashlib.md5(raw).hexdigest();assert sha==expected
vr=json.loads(review.read_text());ar=json.loads(audio.read_text());assert vr['sha256']==sha and vr['changedRegionStatus']=='accepted' and vr['wholeFilmInheritance']['verified'] is True
assert ar['binding']['videoSha256']==sha and ar['correctedCue']['passed'] is True
assert ar['wordCounts']=={'total':462,'passed':149,'unsupported':299,'supportedOutsideTolerance':14}
prefix='C:/Users/sjfis/Videos/Genesis1/full-v2-'+sha[:12];rp=prefix.replace('/','\\');thumb=ROOT/'full-v2-thumbnail.jpg';assert thumb.exists()
notes=f"Final corrected Genesis 1 lyric film, 304.733333 seconds / 9142 frames, 1080p30. Approved theme 3: restrained charcoal, bone, rust and amber; 63 authored animation families, four generated motion inserts, and active foreground words/graphics. V2 moves the supported first 'the' in 'the greater to command the day' from157.700 to158.016318 seconds; all other461word records and choreography remain unchanged. Independent encoded delta review accepted; prior full-film visual acceptance is carried forward with a documented manual visual-continuation exception: source inputs differ only for this cue, outside-region SSIM minimum0.989555 and worst/representative paired frames show no semantic regression. Native pixel identity failed and remains a recorded failure; its cause is not established. PCM correlation0.998748, minimum segment0.996351, zero global lag, gain-0.067581dB. Corrected cue passes the bounded acoustic check. STRICT SINGING SYNC IS NOT CERTIFIED:149/462 words passed,299unsupported,14supported outside tolerance; the unchanged 'He' is a model-disagreement case. Prior full OCR found458/462 automatically; four remaining words were visually confirmed and remain documented manual exceptions, not automatic passes. The intentional final5.4-second compositional hold is retained as a reviewed exception. No perfect-sync or full automatic-gauntlet-pass claim. Pending Shane review. Supersedes full-film V1 vid-20260927-d43880e9, preserving its file/history and all preview candidates. SHA256 {sha}."
metadata={'project':'Genesis1 - The Beginning','title':'Genesis 1 — Breath & Earth — Final Full Film v2','version':'Final Full Film v2','sourceAgent':'Codex','sourceMachine':'Mac mini','sourcePath':str(src),'notes':notes,'status':'pending_review','path':rp+'.mp4','thumbnail':rp+'.jpg','expectedMd5':md5,'supersedes':'vid-20260927-d43880e9'}
meta=ROOT/'full-v2-app-metadata.json';meta.write_text(json.dumps(metadata,indent=2)+'\n')
rsha=remote(f"(Get-FileHash -Algorithm SHA256 '{rp}.mp4').Hash").lower();assert rsha==sha
copy(thumb,prefix+'.jpg');copy(meta,prefix+'.json')
result=json.loads(remote(f"$body=Get-Content -Raw '{rp}.json';Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4317/api/admin/videos/ingest -ContentType 'application/json' -Body $body|ConvertTo-Json -Depth 20"))
(ROOT/'full-v2-app-ingest.json').write_text(json.dumps(result,indent=2)+'\n')
vid=result['video']['id'];assert result['video']['supersedes']=='vid-20260927-d43880e9'
watch=HOST+'/api/admin/videos/'+vid+'/media';download=watch+'?download=1';h=hashlib.sha256();count=0
with urllib.request.urlopen(download,timeout=60) as res:
 headers={'httpStatus':res.status,'contentType':res.headers.get('Content-Type'),'contentDisposition':res.headers.get('Content-Disposition')}
 while True:
  block=res.read(1024*1024)
  if not block:break
  h.update(block);count+=len(block)
dsha=h.hexdigest();assert dsha==sha and count==len(raw)
with urllib.request.urlopen(urllib.request.Request(watch,headers={'Range':'bytes=0-1023'}),timeout=30) as res:
 status=res.status;crange=res.headers.get('Content-Range');block=res.read()
assert status==206 and len(block)==1024
ledger=json.loads(remote("$r=Invoke-RestMethod http://127.0.0.1:4317/api/admin/videos; @($r.videos | Where-Object {$_.project -eq 'Genesis1 - The Beginning'} | Select-Object id,title,status,supersedes,supersededBy) | ConvertTo-Json -Depth 4"))
byid={v['id']:v for v in ledger};old=byid['vid-20260927-d43880e9'];assert old['status']=='superseded' and old['supersededBy']==vid
previews=['vid-20260927-e6050c02','vid-20260927-eee760b7','vid-20260927-e0aa88b1','vid-20260927-6eed3523'];assert all(p in byid and byid[p]['supersededBy'] is None for p in previews)
record={'id':'full-v2','title':metadata['title'],'candidateId':vid,'status':result['video']['status'],'reviewUrl':HOST+'/studio#videos','watchUrl':watch,'downloadUrl':download,'localFile':str(src),'localSha256':sha,'remoteCopiedSha256':rsha,'remoteDownloadSha256':dsha,'bytes':count,'rangeStatus':status,'contentRange':crange,'duplicate':result.get('duplicate'),'thumbnail':str(thumb),'thumbnailAtSeconds':2,'thumbnailSha256':hashlib.sha256(thumb.read_bytes()).hexdigest(),'visualReview':str(review),'visualReviewSha256':hashlib.sha256(review.read_bytes()).hexdigest(),'audioEvidence':str(audio),'audioEvidenceSha256':hashlib.sha256(audio.read_bytes()).hexdigest(),'supersedes':'vid-20260927-d43880e9','oldCandidateAfterIngest':old,'preservedPreviewCandidates':[byid[p]for p in previews],'finalAuditUpdatePending':False,'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),**headers}
(ROOT/'full-v2-app-delivery.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
