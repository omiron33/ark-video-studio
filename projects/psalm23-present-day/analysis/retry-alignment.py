import pathlib,json,subprocess,hashlib,re,difflib
root=pathlib.Path('/Volumes/Code/ark-video-studio');p=root/'projects/psalm23-present-day';out=p/'analysis/alignment';audio=p/'sources/32885123-f4b6-42e6-a546-f4acba404829.m4a'
lines=json.loads((out/'canonical-line-map.json').read_text());byid={l['id']:l for l in lines};windows=json.loads((out/'windows.json').read_text())
for w in windows:
 d=json.loads((out/f"{w['id']}-ctc-large.json").read_text());i=0
 for lid in w['lineIds']:
  l=byid[lid];ww=d['words'][i:i+len(l['wordIds'])];i+=len(ww);l['broadStart']=ww[0]['start'];l['broadEnd']=ww[-1]['end']
requests=[]
for idx,l in enumerate(lines):
 start=max(0,l['broadStart']-.65);end=lines[idx+1]['broadStart']-.18 if idx+1<len(lines) else 207.5
 if end<=start:raise Exception(l)
 lyric=out/f"{l['id']}-lyrics.txt";lyric.write_text(l['text']+'\n')
 requests.append({'id':l['id'],'start':start,'end':end,'lyrics':str(lyric),'reason':'Complete literal phrase window bounded by broad acoustic onset measurements, never provider guessed word timing.'})
(out/'phrase-retry-windows.json').write_text(json.dumps(requests,indent=2)+'\n')
models={'ctc-large':('/Volumes/DATA/AI/Models/TorchAudio/wav2vec2_fairseq_large_lv60k_asr_ls960.pth','7a88965716fbd598a595209bf45c1210a18a6935cfb0cf53527fc986c5543ac7'),'ctc-base':('/Volumes/DATA/AI/Models/TorchAudio/wav2vec2_fairseq_base_ls960_asr_ls960.pth','488fd4f16de84438ffc945334278c1b9fb9b7159a806c1080b16111a958c945d'),'whisper-base':('/Volumes/DATA/AI/Models/Whisper/base.en.pt','25a8566e1d0c1e2231d1c762132cd20e0f96a85d16145c3a00adf5d1ac670ead')}
worker=subprocess.Popen(['/opt/homebrew/Cellar/openai-whisper/20250625_3/libexec/bin/python',str(root/'engine/audio-worker.py'),str(root/'engine/align.py'),'4'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=(out/'retry-worker-stderr.log').open('a'),text=True,bufsize=1)
results=[]
try:
 for name,(model,sha) in models.items():
  for w in (windows if name.startswith('whisper') else requests):
   dest=out/f"{w['id']}-{'retry-' if name.startswith('ctc') else ''}{name}.json"
   if dest.exists():continue
   argv=['--audio',str(audio),'--output',str(dest),'--model',model,'--offset',str(w['start']),'--duration',str(w['end']-w['start']),'--threads','4','--language','en','--backend','torchaudio-ctc' if name.startswith('ctc') else 'openai-whisper','--task','force-align' if name.startswith('ctc') else 'transcribe']
   if name.startswith('ctc'):argv+=['--lyrics',w['lyrics']]
   else:argv+=['--relaxed-speech']
   worker.stdin.write(json.dumps({'id':dest.stem,'argv':argv,'checkpointId':sha,'allowPartialRecognition':name.startswith('whisper')})+'\n');worker.stdin.flush();res=json.loads(worker.stdout.readline());results.append(res);print(json.dumps(res),flush=True)
   (out/'retry-execution.json').write_text(json.dumps(results,indent=2)+'\n')
finally:
 worker.stdin.close();worker.wait(timeout=60)
