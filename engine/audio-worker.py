#!/usr/bin/env python3
"""Local resident-checkpoint runner; alignment still executes unmodified align.py."""
import contextlib,hashlib,importlib.util,json,os,pathlib,sys,time,collections
thread_count=int(sys.argv[2]) if len(sys.argv)>2 else 4
if thread_count<1:raise ValueError('Worker thread count must be positive')
for key in ('OMP_NUM_THREADS','MKL_NUM_THREADS','VECLIB_MAXIMUM_THREADS','NUMBA_NUM_THREADS'):os.environ[key]=str(thread_count)
sys.path.insert(0,'/Volumes/DATA/AI/Tools/ark-audio-review/python')
import torch,whisper,torchaudio
align_path=pathlib.Path(sys.argv[1]);spec=importlib.util.spec_from_file_location('ark_align',align_path);align=importlib.util.module_from_spec(spec);spec.loader.exec_module(align)
models=collections.OrderedDict();verified={};current={};original_whisper=whisper.load_model;original_factory=torchaudio.models.wav2vec2_model;original_load=torch.load

def remember(key,value):
 models[key]=value;models.move_to_end(key)
 while len(models)>5:models.popitem(last=False)
 return value

def checkpoint(path):
 p=pathlib.Path(path).resolve();st=p.stat();signature=(str(p),st.st_size,st.st_mtime_ns,st.st_ctime_ns)
 if verified.get(current['sha'])!=signature:
  with p.open('rb') as f: actual=hashlib.file_digest(f,'sha256').hexdigest()
  if actual!=current['sha']:raise ValueError('Checkpoint bytes differ from the requested model identity')
  verified[current['sha']]=signature
 return current['sha']

def whisper_cached(name,*args,**kwargs):
 key=('whisper',checkpoint(name),repr(args),repr(sorted(kwargs.items())))
 if key in models:models.move_to_end(key);current['modelHit']=True;return models[key]
 return remember(key,original_whisper(name,*args,**kwargs))

def factory_cached(**kwargs):
 key=('ctc',checkpoint(current['path']),json.dumps(kwargs,sort_keys=True))
 if key in models:models.move_to_end(key);entry=models[key];current['modelHit']=True
 else:
  model=original_factory(**kwargs);entry={'model':model,'loaded':False};load=model.load_state_dict
  def load_once(state,*args,**kwargs):
   if entry['loaded']:return torch.nn.modules.module._IncompatibleKeys([],[])
   result=load(state,*args,**kwargs);entry['loaded']=True;return result
  model.load_state_dict=load_once;remember(key,entry)
 current['ctc']=entry
 return entry['model']

def load_cached(path,*args,**kwargs):
 entry=current.get('ctc')
 if isinstance(path,(str,pathlib.Path)) and pathlib.Path(path).resolve()==current.get('path') and str(path).endswith('.pth') and entry:
  if entry['loaded']:
   state=dict(entry['model'].state_dict());state['aux.weight']=entry['originalAuxWeight'];state['aux.bias']=entry['originalAuxBias'];return state
  state=original_load(path,*args,**kwargs);entry['originalAuxWeight']=state['aux.weight'];entry['originalAuxBias']=state['aux.bias'];return state
 return original_load(path,*args,**kwargs)

whisper.load_model=whisper_cached;torchaudio.models.wav2vec2_model=factory_cached;torch.load=load_cached
def partial_recognition(segments,args):
 """Keep measured tokens only for official-lyric corroboration, never invent omissions."""
 raw=[word for segment in segments for word in segment.get('words',[])];valid=[];omitted=[]
 duration=align.audio_duration(args.audio);span=min(args.duration if args.duration is not None else duration-args.offset,duration-args.offset)
 import math,re
 last=-float('inf')
 for index,w in enumerate(raw):
  text=str(w.get('text','')).strip();start=w.get('start');end=w.get('end');probability=w.get('probability')
  ok=text and all(isinstance(n,(int,float)) and math.isfinite(n) for n in (start,end,probability)) and 0<=start<end<=span+.05 and start>=last and 0<=probability<=1
  if not ok:omitted.append({'index':index,'text':text,'rawStart':start,'rawEnd':end,'rawProbability':probability,'reason':'Invalid measured token; omitted without replacement timing'});continue
  start,end=round(args.offset+start,6),round(args.offset+end,6);last=w['start']
  valid.append({'id':align.word_id(text,start,end),'text':text,'start':start,'end':end,'phraseId':'partial-0001','confidence':'machine_estimate','provenance':{'method':'local-openai-whisper','model':args.model.name,'tokenProbability':probability,'timingVerified':False,'note':'Partial recognition: invalid raw tokens were omitted and remain explicit diagnostics.'}})
 if not omitted or len(raw)<20 or len(omitted)/len(raw)>.05 or len(valid)<10:return None
 lexical=[re.sub(r'[^a-z0-9]','',w['text'].lower()) for w in valid];run=1
 for i in range(1,len(lexical)):
  run=run+1 if lexical[i]==lexical[i-1] else 1
  if run>5:return None
 return {'version':1,'timebase':'source','status':'partial_recognition','task':'transcribe','method':'local-openai-whisper-transcribe; partial diagnostic evidence','source':{'audio':args.audio.name,'offset':args.offset,'duration':span,'audioDuration':duration,'model':str(args.model.resolve()),'backend':'openai-whisper','language':args.language},'transcript':' '.join(w['text'] for w in valid),'words':valid,'phrases':[],'omittedInvalidWords':omitted,'rawWordCount':len(raw),'warnings':['Known official-lyrics corroboration only. Omitted invalid tokens provide no word or timing evidence. Audio-only lyric discovery cannot use this result.']}

original_transcribe=align.transcribe_local
raw_recognition=[]
def capture_recognition(*args,**kwargs):
 result=original_transcribe(*args,**kwargs)
 raw_recognition.clear();raw_recognition.extend(result[0])
 return result
align.transcribe_local=capture_recognition

for line in sys.stdin:
 request={};t=time.monotonic()
 try:
  request=json.loads(line);raw_recognition.clear();args=align.parser().parse_args(request['argv']);current.clear();current.update({'sha':request['checkpointId'],'path':args.model.resolve(),'modelHit':False})
  if args.output.exists():raise ValueError('Refusing to overwrite existing timing')
  try:
   with contextlib.redirect_stdout(sys.stderr):result=align.align(args)
  except Exception as error:result={'version':1,'timebase':'source','status':'unresolved','source':{'audio':args.audio.name,'offset':args.offset},'words':[],'phrases':[],'reason':str(error),'warnings':['No timing invented or model downloaded.']}
  if result.get('status')=='unresolved' and request.get('allowPartialRecognition') and args.task=='transcribe' and args.backend=='openai-whisper':
   recovered=partial_recognition(raw_recognition,args)
   if recovered is not None:result=recovered
  align.write_new(args.output,result)
  response={'id':request['id'],'output':str(args.output),'status':result['status'],'seconds':time.monotonic()-t,'modelCacheHit':current['modelHit'],'modelsHeld':len(models)}
 except (Exception,SystemExit) as error:response={'id':request.get('id'),'error':str(error)}
 print(json.dumps(response),flush=True)
