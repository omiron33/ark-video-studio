from pathlib import Path
import hashlib,json,time,subprocess
import torch,whisper
ROOT=Path('/Volumes/Code/ark-video-studio');P=ROOT/'projects/genesis1-beginning';O=P/'analysis';audio=P/'intake/source.mp3';modelpath=Path('/Volumes/DATA/AI/Models/Whisper/medium.en.pt')
torch.set_num_threads(4);model=whisper.load_model(str(modelpath),device='cpu');model.set_alignment_heads(whisper._ALIGNMENT_HEADS['medium.en'])
# The ordinary worker rejected the whole pass for invalid intervals. Save exact raw
# diagnostics this time; never substitute guessed endpoints for zero-length words.
sha=hashlib.sha256(audio.read_bytes()).hexdigest();start=time.monotonic();result=model.transcribe(str(audio),language='en',word_timestamps=True,fp16=False,verbose=False,no_speech_threshold=None,condition_on_previous_text=False)
raw={'source':str(audio),'audioSha256':sha,'model':str(modelpath),'checkpointId':hashlib.sha256(modelpath.read_bytes()).hexdigest(),'seconds':time.monotonic()-start,'rawWhisper':result}
(O/'full-medium-raw-diagnostic.json').write_text(json.dumps(raw,indent=2)+'\n')
words=[];invalid=[]
for s in result['segments']:
 for w in s.get('words',[]):
  text=w['word'].strip();a=w['start'];b=w['end'];confidence=w.get('probability')
  if not text or not 0<=a<b<=304.721:invalid.append(w);continue
  words.append({'id':f'diagnostic-{len(words)+1:04d}','text':text,'start':a,'end':b,'phraseId':'diagnostic','confidence':'machine_estimate','provenance':{'method':'local-openai-whisper-diagnostic','model':modelpath.name,'tokenProbability':confidence,'timingVerified':False}})
record={'version':1,'timebase':'source','status':'partial_recognition_diagnostic' if invalid else 'machine_estimate','role':'source','audioSha256':sha,'checkpointId':raw['checkpointId'],'artifact':str(O/'full-whisper-medium-diagnostic.json'),'source':{'audio':str(audio),'duration':304.72,'offset':0},'transcript':result['text'],'words':words,'invalidRawWords':invalid,'warning':'Raw invalid words remain diagnostics. No invented timestamps and no automatic strict evidence pass.'}
(O/'full-whisper-medium-diagnostic.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'validWords':len(words),'invalidWords':len(invalid),'seconds':raw['seconds']}),flush=True)
