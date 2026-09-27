"""Publish visually accepted source inserts as clearly labeled pending-review previews."""
from pathlib import Path
import datetime,hashlib,json,urllib.request
from h3_jobs import remote,copy
ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parent
HOST='https://omipc.taild60b4e.ts.net'
SHOTS=[('whale-formation','Whale from Lines','Bone strands gather into a whale on black. Fixed RGB gains restore source line brightness.'),('land-emergence-v1','Land Emerges','Shallow water recedes to reveal basalt terrain.'),('vegetation-v1','Life from the Earth','Artistically compressed tree and ground-cover growth in a fixed valley view.')]
accepted={x['id']:x for x in json.loads((ROOT/'accepted-videos.json').read_text())['accepted']}
report_path=ROOT/'preview-app-delivery.json'
report=json.loads(report_path.read_text()) if report_path.exists() else {'project':'genesis1-beginning','candidates':[],'preservedExisting':True,'fullFilmPublished':False}
remote("New-Item -ItemType Directory -Force -Path 'C:\\Users\\sjfis\\Videos\\Genesis1'|Out-Null")
for ident,label,description in SHOTS:
    item=accepted[ident];prov=json.loads((PROJECT/item['provenance']).read_text());assert prov['review']['status']=='accepted_as_source_clip'
    src=PROJECT/item['file'];data=src.read_bytes();sha=hashlib.sha256(data).hexdigest();assert sha==item['sha256'];md5=hashlib.md5(data).hexdigest();thumb=PROJECT/item['lastPoster']
    prefix='C:/Users/sjfis/Videos/Genesis1/'+ident+'-'+sha[:12];path=prefix.replace('/','\\')+'.mp4';meta_path=prefix.replace('/','\\')+'.json'
    notes=f"GENERATION SOURCE PREVIEW ONLY, not the finished Genesis1 lyric film. Silent {item['durationSeconds']:.6f}-second local MiniMax H3 insert from new GPT Image anchors. {description} Native {item['nativeFrames']} generated frames at {item['fps']}fps. No retiming, interpolation or reversal. Intended final film treatment adds active foreground lyrics and/or authored graphic motion; this standalone source preview intentionally lacks those layers. Agent reviewed chronological6fps decoded frames and endpoints; source acceptance does not certify the final composite. Pending Shane review; no user approval claimed. SHA256 {sha}."
    metadata={'project':'Genesis1 - The Beginning','title':'Genesis 1 - '+label+' (source preview)','version':'Source insert v1','sourceAgent':'Codex','sourceMachine':'OmiPC local GPU / Mac mini finishing','sourcePath':str(src),'notes':notes,'status':'pending_review','path':path,'thumbnail':prefix.replace('/','\\')+'.jpg','expectedMd5':md5}
    mf=ROOT/(ident+'-app-metadata.json');mf.write_text(json.dumps(metadata,indent=2)+'\n')
    copy(src,prefix+'.mp4');copy(thumb,prefix+'.jpg');copy(mf,prefix+'.json')
    remote_sha=remote(f"(Get-FileHash -Algorithm SHA256 '{path}').Hash").lower();assert remote_sha==sha
    result=json.loads(remote(f"$body=Get-Content -Raw '{meta_path}'; Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4317/api/admin/videos/ingest -ContentType 'application/json' -Body $body|ConvertTo-Json -Depth 20"));(ROOT/(ident+'-app-ingest.json')).write_text(json.dumps(result,indent=2)+'\n')
    candidate=result['video'];vid=candidate['id'];watch=HOST+'/api/admin/videos/'+vid+'/media';download=watch+'?download=1'
    with urllib.request.urlopen(download,timeout=60) as response:
        downloaded=response.read();headers={'httpStatus':response.status,'contentType':response.headers.get('Content-Type'),'contentDisposition':response.headers.get('Content-Disposition')}
    download_sha=hashlib.sha256(downloaded).hexdigest();assert download_sha==sha
    req=urllib.request.Request(watch,headers={'Range':'bytes=0-1023'})
    with urllib.request.urlopen(req,timeout=30) as response: status=response.status;crange=response.headers.get('Content-Range');chunk=response.read()
    assert status==206 and len(chunk)==1024
    record={'id':ident,'title':metadata['title'],'candidateId':vid,'status':candidate['status'],'reviewUrl':HOST+'/studio#videos','watchUrl':watch,'downloadUrl':download,'localFile':str(src),'localSha256':sha,'remoteCopiedSha256':remote_sha,'remoteDownloadSha256':download_sha,'bytes':len(downloaded),'rangeStatus':status,'contentRange':crange,'duplicate':result.get('duplicate'),'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),**headers}
    report['candidates']=[r for r in report['candidates'] if r['candidateId']!=vid]+[record];report_path.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(record,indent=2),flush=True)
