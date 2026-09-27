import pathlib,json,subprocess
root=pathlib.Path('/Volumes/Code/ark-video-studio');p=root/'projects/psalm23-present-day';out=p/'analysis/alignment';audio=p/'sources/32885123-f4b6-42e6-a546-f4acba404829.m4a';windows=json.loads((out/'windows.json').read_text())
worker=subprocess.Popen(['/opt/homebrew/Cellar/openai-whisper/20250625_3/libexec/bin/python',str(root/'engine/audio-worker.py'),str(root/'engine/align.py'),'4'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=(out/'final-worker-stderr.log').open('a'),text=True,bufsize=1)
results=[]
def run(w,name,model,sha):
 dest=out/f"{w['id']}-{'final-' if name.startswith('ctc') else ''}{name}.json"
 if dest.exists():return
 argv=['--audio',str(audio),'--output',str(dest),'--model',model,'--offset',str(w['start']),'--duration',str(w['end']-w['start']),'--threads','4','--language','en','--backend','torchaudio-ctc' if name.startswith('ctc') else 'openai-whisper','--task','force-align' if name.startswith('ctc') else 'transcribe']
 if name.startswith('ctc'):argv+=['--lyrics',w['lyrics']]
 else:argv+=['--relaxed-speech']
 worker.stdin.write(json.dumps({'id':dest.stem,'argv':argv,'checkpointId':sha,'allowPartialRecognition':name.startswith('whisper')})+'\n');worker.stdin.flush();res=json.loads(worker.stdout.readline());results.append(res);print(json.dumps(res),flush=True);(out/'final-execution.json').write_text(json.dumps(results,indent=2)+'\n')
try:
 for w in windows:run(w,'whisper-medium','/Volumes/DATA/AI/Models/Whisper/medium.en.pt','d7440d1dc186f76616474e0ff0b3b6b879abc9d1a4926b7adfa41db2d497ab4f')
 subprocess.run(['node',str(p/'analysis/prepare-final-retries.mjs')],check=True)
 retries=json.loads((out/'final-retry-windows.json').read_text())
 for name,model,sha in [('ctc-large','/Volumes/DATA/AI/Models/TorchAudio/wav2vec2_fairseq_large_lv60k_asr_ls960.pth','7a88965716fbd598a595209bf45c1210a18a6935cfb0cf53527fc986c5543ac7'),('ctc-base','/Volumes/DATA/AI/Models/TorchAudio/wav2vec2_fairseq_base_ls960_asr_ls960.pth','488fd4f16de84438ffc945334278c1b9fb9b7159a806c1080b16111a958c945d')]:
  for w in retries:run(w,name,model,sha)
finally:
 worker.stdin.close();worker.wait(timeout=60)
