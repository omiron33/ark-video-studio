import pathlib,json,re,subprocess,hashlib,sys,time
root=pathlib.Path('/Volumes/Code/ark-video-studio')
p=root/'projects/psalm23-present-day';out=p/'analysis/alignment';out.mkdir(exist_ok=True)
audio=p/'sources/32885123-f4b6-42e6-a546-f4acba404829.m4a'
lines=[];section='';section_i=0
for line in (p/'sources/canonical-lyrics.txt').read_text().splitlines():
 line=line.strip()
 if not line:continue
 if line.startswith('['):section=line.strip('[]');section_i+=1;continue
 lines.append({'id':f'p23-l{len(lines)+1:03d}','section':section,'sectionIndex':section_i,'text':line,'wordIds':[f'p23-l{len(lines)+1:03d}-w{i+1:02d}' for i in range(len(line.split()))]})
# Provider intervals choose broad search windows only; every final cue remains measured.
groups=[(0,6,12.5,44.8),(6,10,42,60),(10,17,57,89),(17,21,85.5,114.5),(21,28,111.5,144),(28,32,140.5,172.5),(32,36,169,188),(36,39,185,211)]
windows=[]
for n,(lo,hi,start,end) in enumerate(groups,1):
 lyric_path=out/f'window-{n:02d}-lyrics.txt';lyric_path.write_text('\n'.join(x['text'] for x in lines[lo:hi])+'\n')
 windows.append({'id':f'window-{n:02d}','start':start,'end':end,'lineIds':[x['id'] for x in lines[lo:hi]],'lyrics':str(lyric_path)})
(out/'canonical-line-map.json').write_text(json.dumps(lines,indent=2)+'\n');(out/'windows.json').write_text(json.dumps(windows,indent=2)+'\n')
models={'ctc-large':('/Volumes/DATA/AI/Models/TorchAudio/wav2vec2_fairseq_large_lv60k_asr_ls960.pth','7a88965716fbd598a595209bf45c1210a18a6935cfb0cf53527fc986c5543ac7'),'ctc-base':('/Volumes/DATA/AI/Models/TorchAudio/wav2vec2_fairseq_base_ls960_asr_ls960.pth','488fd4f16de84438ffc945334278c1b9fb9b7159a806c1080b16111a958c945d'),'whisper-small':('/Volumes/DATA/AI/Models/Whisper/small.en.pt','f953ad0fd29cacd07d5a9eda5624af0f6bcf2258be67c92b79389873d91e0872')}
worker=subprocess.Popen(['/opt/homebrew/Cellar/openai-whisper/20250625_3/libexec/bin/python',str(root/'engine/audio-worker.py'),str(root/'engine/align.py'),'4'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=(out/'worker-stderr.log').open('a'),text=True,bufsize=1)
results=[]
try:
 for name,(model,sha) in models.items():
  for w in windows:
   dest=out/f"{w['id']}-{name}.json"
   if dest.exists():
    print('existing',dest.name,flush=True);continue
   argv=['--audio',str(audio),'--output',str(dest),'--model',model,'--offset',str(w['start']),'--duration',str(w['end']-w['start']),'--threads','4','--language','en','--backend','torchaudio-ctc' if name.startswith('ctc') else 'openai-whisper','--task','force-align' if name.startswith('ctc') else 'transcribe']
   if name.startswith('ctc'):argv+=['--lyrics',w['lyrics']]
   else:argv+=['--relaxed-speech']
   req={'id':f"{w['id']}-{name}",'argv':argv,'checkpointId':sha,'allowPartialRecognition':not name.startswith('ctc')}
   worker.stdin.write(json.dumps(req)+'\n');worker.stdin.flush();res=json.loads(worker.stdout.readline());results.append(res);print(json.dumps(res),flush=True)
   (out/'execution.json').write_text(json.dumps({'audioSha256':hashlib.file_digest(audio.open('rb'),'sha256').hexdigest(),'results':results},indent=2)+'\n')
finally:
 worker.stdin.close();worker.wait(timeout=60)
