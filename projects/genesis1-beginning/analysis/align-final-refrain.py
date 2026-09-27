from pathlib import Path
import json,hashlib,subprocess,selectors
R=Path('/Volumes/Code/ark-video-studio');P=R/'projects/genesis1-beginning';O=P/'analysis';A=P/'intake/source.mp3';PY='/opt/homebrew/Cellar/openai-whisper/20250625_3/libexec/bin/python';ids=json.load(open(P/'timing/performance-provisional.json'));ws=[w for w in ids['words'] if w['phraseId']=='g1-l096'];lyric=O/'g1-l096-whisper-forced-lyrics.txt';lyric.write_text(' '.join(w['text'] for w in ws));worker=subprocess.Popen([PY,str(R/'engine/audio-worker.py'),str(R/'engine/align.py'),'4'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=(O/'last-refrain-forced.log').open('w'),text=True,bufsize=1);sel=selectors.DefaultSelector();sel.register(worker.stdout,selectors.EVENT_READ)
try:
 for model in ['small','medium']:
  name='g1-l096-whisper-forced-'+model;output=O/(name+'.json');m=Path('/Volumes/DATA/AI/Models/Whisper')/(model+'.en.pt');sha=hashlib.sha256(m.read_bytes()).hexdigest();args=['--audio',str(A),'--output',str(output),'--model',str(m),'--backend','openai-whisper','--task','force-align','--offset','289.8','--duration','6.2','--lyrics',str(lyric),'--language','en','--threads','4'];worker.stdin.write(json.dumps({'id':name,'argv':args,'checkpointId':sha})+'\n');worker.stdin.flush();assert sel.select(90);execution=json.loads(worker.stdout.readline());d=json.load(open(output));
  if len(d.get('words',[]))==len(ws):
   for w,c in zip(d['words'],ws):w['canonicalId']=c['id'];w['phraseId']=c['phraseId']
  d.update(role='source',checkpointId=sha,artifact=str(output),audioSha256=hashlib.sha256(A.read_bytes()).hexdigest(),executionEvidence=execution);output.write_text(json.dumps(d,indent=2)+'\n');print(name,[(w['text'],w['start'],w['end']) for w in d.get('words',[])],flush=True)
finally:
 worker.stdin.close();worker.wait(timeout=15)
