from pathlib import Path
import subprocess,json,numpy as np
root=Path(__file__).resolve().parent.parent
src=root/'sources/32885123-f4b6-42e6-a546-f4acba404829.m4a'
r=subprocess.run(['ffmpeg','-v','error','-i',str(src),'-map','0:a:0','-ar','22050','-ac','1','-f','f32le','-'],capture_output=True,check=True)
a=np.frombuffer(r.stdout,dtype=np.float32);sr=22050;hop=441;win=1024
frames=np.lib.stride_tricks.sliding_window_view(a,win)[::hop]
spec=np.abs(np.fft.rfft(frames*np.hanning(win),axis=1))
flux=np.sum(np.maximum(0,np.diff(np.log1p(10*spec),axis=0)),axis=1)
cand=np.where((flux[1:-1]>flux[:-2])&(flux[1:-1]>=flux[2:])&(flux[1:-1]>np.quantile(flux,.9)))[0]+1
selected=[]
for i in sorted(cand,key=lambda i:float(flux[i]),reverse=True):
 t=float((i+1)*hop/sr)
 if all(abs(t-z['time'])>.4 for z in selected):selected.append({'time':round(t,3),'strengthRelativeToMax':round(float(flux[i]/flux.max()),4),'kind':'spectral_flux_attack_not_vocal_or_beat'})
selected.sort(key=lambda z:z['time'])
bounds=[('Opening / first caption at 15.16s',0,15.16),('Verse 1',15.16,43.803),('Verse 2',43.803,58.803),('Chorus 1',58.803,87.447),('Verse 3',87.447,113.298),('Chorus 2',113.298,142.181),('Mercy bridge',142.181,170.904),('Final chorus',170.904,186.622),('Outro vocals',186.622,202.660),('Ending / instrumental tail',202.660,219.960)]
sections=[]
for label,start,end in bounds:
 q=a[int(start*sr):int(end*sr)];rr=float(np.sqrt(np.mean(q*q)))
 sections.append({'label':label,'start':start,'end':end,'boundaryBasis':'Suno embedded caption estimates; unverified approximate hints, not acoustically reviewed','rmsDbFS':round(float(20*np.log10(rr+1e-12)),2),'peakDbFS':round(float(20*np.log10(float(abs(q).max())+1e-12)),2),'attackCount':sum(start<=z['time']<end for z in selected)})
result={'version':1,'method':'Full source decoded to mono 22050Hz float; RMS per source-caption region; 1024-sample Hann log spectral positive flux / 441-sample hop; strongest local peaks above 90th percentile separated by 400ms.','listened':False,'durationSeconds':len(a)/sr,'measuredTempoBpm':None,'tempoPromptBpm':68,'meterPrompt':'6/8','cautions':['Attacks include accompaniment and percussion, not vocal onsets or a verified beat grid.','Embedded captions are approximate source timing hints only; suspicious first chorus I will fear no evil at 64.069-64.947 and for you are with me at 64.947-73.324 require independent acoustic alignment after theme choice.','RMS quantifies loudness/energy, not emotional intensity or genre.'],'sectionEnergy':sections,'attacks':selected,'rmsOneSecond':[{'time':i,'rmsDbFS':round(float(20*np.log10(float(np.sqrt(np.mean(a[i*sr:(i+1)*sr]**2)))+1e-12)),2)} for i in range(int(len(a)/sr))]}
(root/'analysis/audio-energy-attacks.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'durationSeconds':result['durationSeconds'],'sectionEnergy':sections,'strongestAttacks':sorted(selected,key=lambda z:z['strengthRelativeToMax'],reverse=True)[:10]},indent=2))
