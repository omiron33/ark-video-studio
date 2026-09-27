from pathlib import Path
import hashlib,json,subprocess,selectors,sys
ROOT=Path('/Volumes/Code/ark-video-studio');PROJECT=ROOT/'projects/genesis1-beginning';OUT=PROJECT/'analysis';AUDIO=PROJECT/'intake/source.mp3'
PYTHON='/opt/homebrew/Cellar/openai-whisper/20250625_3/libexec/bin/python'
jobs=json.loads(Path(sys.argv[1]).read_text());prefix=sys.argv[2] if len(sys.argv)>2 else 'ctc'
models={'base':Path('/Volumes/DATA/AI/Models/TorchAudio/wav2vec2_fairseq_base_ls960_asr_ls960.pth'),'large':Path('/Volumes/DATA/AI/Models/TorchAudio/wav2vec2_fairseq_large_lv60k_asr_ls960.pth')}
identities={k:hashlib.sha256(p.read_bytes()).hexdigest() for k,p in models.items()};source_sha=hashlib.sha256(AUDIO.read_bytes()).hexdigest()
worker=subprocess.Popen([PYTHON,str(ROOT/'engine/audio-worker.py'),str(ROOT/'engine/align.py'),'4'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=(OUT/(prefix+'-worker.log')).open('w'),text=True,bufsize=1)
selector=selectors.DefaultSelector();selector.register(worker.stdout,selectors.EVENT_READ);progress=[]
try:
 for w in jobs:
  for model in ['base','large']:
   name=w['id']+'-'+prefix+'-'+model;out=OUT/(name+'.json');lyric=OUT/(w['id']+'-'+prefix+'-lyrics.txt');lyric.write_text(' '.join(x['text'] for x in w['words']))
   if out.exists():
    previous=json.loads(out.read_text())
    if previous.get('status')=='machine_estimate' and previous.get('audioSha256')==source_sha:continue
   args=['--audio',str(AUDIO),'--output',str(out),'--model',str(models[model]),'--backend','torchaudio-ctc','--task','force-align','--offset',str(w['start']),'--duration',str(round(w['end']-w['start'],6)),'--language','en','--threads','4','--lyrics',str(lyric)]
   worker.stdin.write(json.dumps({'id':name,'argv':args,'checkpointId':identities[model]})+'\n');worker.stdin.flush()
   if not selector.select(timeout=180):raise TimeoutError('CTC request exceeded180seconds: '+name)
   line=worker.stdout.readline()
   if not line:raise RuntimeError('Audio worker exited unexpectedly')
   execution=json.loads(line);result=json.loads(out.read_text()) if out.exists() else {'status':'failed','words':[]}
   if len(result.get('words',[]))==len(w['words']):
    for token,canonical in zip(result['words'],w['words']):token['canonicalId']=canonical['id'];token['phraseId']=canonical['phraseId']
   result.update(checkpointId=identities[model],role='source',artifact=str(out),executionEvidence=execution,audioSha256=source_sha)
   out.write_text(json.dumps(result,indent=2)+'\n');record={'job':name,'status':result['status'],'words':len(result.get('words',[])),'execution':execution,'artifact':str(out)};progress.append(record);(OUT/(prefix+'-progress.json')).write_text(json.dumps(progress,indent=2)+'\n');print(json.dumps(record),flush=True)
finally:
 worker.stdin.close()
 try:worker.wait(timeout=15)
 except subprocess.TimeoutExpired:worker.terminate();worker.wait(timeout=10)
