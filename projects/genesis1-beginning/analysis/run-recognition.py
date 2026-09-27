from pathlib import Path
import hashlib,json,subprocess,time,selectors
ROOT=Path('/Volumes/Code/ark-video-studio');PROJECT=ROOT/'projects/genesis1-beginning';OUT=PROJECT/'analysis';AUDIO=PROJECT/'intake/source.mp3'
PYTHON='/opt/homebrew/Cellar/openai-whisper/20250625_3/libexec/bin/python'
assert hashlib.sha256(AUDIO.read_bytes()).hexdigest()=='196c6f8183eb18bc530f4ebb83b1af44532d210deecfacaa465eb6592046bbc2'
models={k:Path('/Volumes/DATA/AI/Models/Whisper')/(k+'.en.pt') for k in ['small','medium']}
identities={k:hashlib.sha256(p.read_bytes()).hexdigest() for k,p in models.items()}
jobs=[('opening-whisper-small','small',0,35),('opening-whisper-medium','medium',0,35),('full-whisper-small','small',0,304.72),('full-whisper-medium','medium',0,304.72)]
worker=subprocess.Popen([PYTHON,str(ROOT/'engine/audio-worker.py'),str(ROOT/'engine/align.py'),'4'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=(OUT/'recognition-worker.log').open('w'),text=True,bufsize=1)
selector=selectors.DefaultSelector();selector.register(worker.stdout,selectors.EVENT_READ);progress=[]
try:
 for name,model,start,duration in jobs:
  out=OUT/(name+'.json')
  args=['--audio',str(AUDIO),'--output',str(out),'--model',str(models[model]),'--backend','openai-whisper','--task','transcribe','--offset',str(start),'--duration',str(duration),'--language','en','--threads','4','--relaxed-speech']
  request={'id':name,'argv':args,'checkpointId':identities[model],'allowPartialRecognition':True}
  worker.stdin.write(json.dumps(request)+'\n');worker.stdin.flush()
  if not selector.select(timeout=180):raise TimeoutError('Bounded acoustic request exceeded180seconds: '+name)
  response=worker.stdout.readline()
  if not response:raise RuntimeError('Audio worker exited unexpectedly')
  execution=json.loads(response);result=json.loads(out.read_text()) if out.exists() else {'status':'failed','words':[]}
  result.update(checkpointId=identities[model],role='source',artifact=str(out),executionEvidence=execution,audioSha256=hashlib.sha256(AUDIO.read_bytes()).hexdigest())
  out.write_text(json.dumps(result,indent=2)+'\n')
  record={'job':name,'status':result['status'],'words':len(result.get('words',[])),'execution':execution,'artifact':str(out)};progress.append(record);(OUT/'recognition-progress.json').write_text(json.dumps(progress,indent=2)+'\n');print(json.dumps(record),flush=True)
finally:
 worker.stdin.close()
 try:worker.wait(timeout=15)
 except subprocess.TimeoutExpired:worker.terminate();worker.wait(timeout=10)
