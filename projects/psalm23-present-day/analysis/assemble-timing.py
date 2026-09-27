import pathlib,json,re,hashlib,math
root=pathlib.Path('/Volumes/Code/ark-video-studio');p=root/'projects/psalm23-present-day';a=p/'analysis/alignment';audio=p/'sources/32885123-f4b6-42e6-a546-f4acba404829.m4a'
lines=json.loads((a/'canonical-line-map.json').read_text());windows=json.loads((a/'windows.json').read_text());bounds={w['id']:w for w in json.loads((a/'phrase-retry-windows.json').read_text())};byid={l['id']:l for l in lines}
sha={'ctc-large':'7a88965716fbd598a595209bf45c1210a18a6935cfb0cf53527fc986c5543ac7','ctc-base':'488fd4f16de84438ffc945334278c1b9fb9b7159a806c1080b16111a958c945d','whisper-small':'f953ad0fd29cacd07d5a9eda5624af0f6bcf2258be67c92b79389873d91e0872','whisper-base':'25a8566e1d0c1e2231d1c762132cd20e0f96a85d16145c3a00adf5d1ac670ead','whisper-medium':'d7440d1dc186f76616474e0ff0b3b6b879abc9d1a4926b7adfa41db2d497ab4f'}
words=[{'id':wid,'text':text,'phraseId':l['id']} for l in lines for wid,text in zip(l['wordIds'],l['text'].split())];byword={w['id']:w for w in words};candidates={w['id']:[] for w in words};recognition={w['id']:[] for w in words};passes={'ctc':[],'recognition':[]}
def norm(x):return re.sub('[^a-z0-9]','',x.lower())
def matches(expected,observed):
 aa=[norm(w['text']) for w in expected];bb=[norm(w['text']) for w in observed];dp=[[0]*(len(bb)+1) for _ in range(len(aa)+1)]
 for i in range(len(aa)+1):dp[i][0]=i
 for j in range(len(bb)+1):dp[0][j]=j
 for i in range(1,len(aa)+1):
  for j in range(1,len(bb)+1):dp[i][j]=min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(aa[i-1]!=bb[j-1]))
 i,j=len(aa),len(bb);out=[None]*len(aa)
 while i or j:
  if i and j and dp[i][j]==dp[i-1][j-1]+(aa[i-1]!=bb[j-1]):
   if aa[i-1]==bb[j-1]:out[i-1]=observed[j-1]
   i-=1;j-=1
  elif i and dp[i][j]==dp[i-1][j]+1:i-=1
  else:j-=1
 return out
for win in windows:
 expected=[byword[wid] for lid in win['lineIds'] for wid in byid[lid]['wordIds']]
 for model in sha:
  f=a/f"{win['id']}-{model}.json";d=json.loads(f.read_text());obs=d['words'];acoustic=model.startswith('ctc')
  aligned=obs if acoustic else matches(expected,obs)
  if acoustic:assert [w['text'] for w in obs]==[w['text'] for w in expected]
  tagged=[]
  for exp,w in zip(expected,aligned):
   if not w:continue
   rec={**w,'canonicalId':exp['id'],'checkpointId':sha[model],'model':model,'artifact':str(f),'context':'broad'}
   (candidates if acoustic else recognition)[exp['id']].append(rec);tagged.append({**w,**({'canonicalId':exp['id']} if acoustic else {})})
  passes['ctc' if acoustic else 'recognition'].append({'checkpointId':sha[model],'role':'source','artifact':str(f),'words':tagged if acoustic else obs})
for l in lines:
 for model in ['ctc-large','ctc-base']:
  f=a/f"{l['id']}-retry-{model}.json";d=json.loads(f.read_text());obs=d['words'];assert [w['text'] for w in obs]==l['text'].split();tagged=[]
  for wid,w in zip(l['wordIds'],obs):
   candidates[wid].append({**w,'canonicalId':wid,'checkpointId':sha[model],'model':model,'artifact':str(f),'context':'phrase-retry'});tagged.append({**w,'canonicalId':wid})
  passes['ctc'].append({'checkpointId':sha[model],'role':'source','artifact':str(f),'words':tagged})

for l in lines:
 for model in ['ctc-large','ctc-base']:
  f=a/f"{l['id']}-final-{model}.json"
  if not f.exists():continue
  d=json.loads(f.read_text());obs=d['words'];assert [w['text'] for w in obs]==l['text'].split();tagged=[]
  for wid,w in zip(l['wordIds'],obs):
   candidates[wid].append({**w,'canonicalId':wid,'checkpointId':sha[model],'model':model,'artifact':str(f),'context':'final-phrase-retry'});tagged.append({**w,'canonicalId':wid})
  passes['ctc'].append({'checkpointId':sha[model],'role':'source','artifact':str(f),'words':tagged})

def evidence(w,c):
 prob=c['provenance']['tokenProbability'];others=[v for v in candidates[w['id']] if v['checkpointId']!=c['checkpointId'] and abs(v['start']-c['start'])<=.08 and abs(v['end']-c['end'])<=.12]
 asr=[v for v in recognition[w['id']] if v['provenance']['tokenProbability']>=.6 and abs(v['start']-c['start'])<=.25 and abs(v['end']-c['end'])<=.25]
 dual=prob>=.7 and any(v['provenance']['tokenProbability']>=.7 for v in others) and (c['end']-c['start']<=1.5 or asr)
 route='source_dual_ctc' if dual else 'source_ctc_asr' if prob>=.2 and others and asr else None
 # AAC stability is deliberately not inferred. This ranks source-only observations.
 legal=c['start']>=bounds[w['phraseId']]['start'] and c['end']<=bounds[w['phraseId']]['end']+.02
 score=50*bool(route)+12*bool(asr)+5*bool(others)+4*prob+1.5*(c['model']=='ctc-large')+.3*(c['context']=='phrase-retry')
 if c['end']-c['start']>1.5 and not asr:score-=15
 if not legal:score-=100
 return score,route,others,asr
selected={};all_evidence=[]
for w in words:
 ranked=sorted(candidates[w['id']],key=lambda c:evidence(w,c)[0],reverse=True)
 selected[w['id']]=ranked[0]
# Preserve actual intervals and source order. Never synthesize midpoint endpoints.
for l in lines:
 # Dynamic programming selects compatible actual observed intervals for every phrase.
 paths=[([],0,-float('inf'))]
 for wid in l['wordIds']:
  new=[]
  for c in candidates[wid]:
   compatible=[path for path in paths if path[2]<=c['start']+.000001]
   if compatible:
    path=max(compatible,key=lambda t:t[1]);new.append((path[0]+[c],path[1]+evidence(byword[wid],c)[0],c['end']))
  assert new, l['id'];paths=new
 best=max(paths,key=lambda t:t[1])[0]
 for wid,c in zip(l['wordIds'],best):selected[wid]=c
for w in words:
 c=selected[w['id']];score,route,paired,asr=evidence(w,c)
 w.update({'start':c['start'],'end':c['end'],'confidence':'machine_estimate','provenance':{'method':'local-torchaudio-ctc; canonical forced alignment selected from measured source passes','model':pathlib.Path(json.loads(pathlib.Path(c['artifact']).read_text())['source']['model']).name,'checkpointId':c['checkpointId'],'tokenProbability':c['provenance']['tokenProbability'],'timingVerified':False,'sourceAcousticSupported':bool(route),'sourceEvidenceRoute':route,'independentRecognitionSupport':bool(asr),'encodedReview':'pending','artifact':c['artifact'],'note':'One actual measured interval selected intact. Canonical text unchanged; source-level support is not encoded-audio gate acceptance.'}})
 all_evidence.append({'id':w['id'],'text':w['text'],'selectedArtifact':c['artifact'],'start':c['start'],'end':c['end'],'sourceRoute':route,'paired':paired,'recognized':recognition[w['id']],'sourceCandidates':candidates[w['id']]})
phrases=[]
for l in lines:
 ww=[byword[wid] for wid in l['wordIds']];phrases.append({'id':l['id'],'text':l['text'],'start':ww[0]['start'],'end':ww[-1]['end'],'wordIds':l['wordIds'],'words':[{k:w[k] for k in ('id','text','start','end')} for w in ww],'sourceSection':l['section'],'sourceSectionIndex':l['sectionIndex'],'confidence':'machine_estimate','sourceSupportedWordCount':sum(w['provenance']['sourceAcousticSupported'] for w in ww)})
overlaps=[{'before':x['id'],'after':y['id'],'seconds':x['end']-y['start']} for x,y in zip(words,words[1:]) if x['end']>y['start']+.000001]
summary={'wordCount':len(words),'phraseCount':len(phrases),'sourceSupported':sum(w['provenance']['sourceAcousticSupported'] for w in words),'unsupported':sum(not w['provenance']['sourceAcousticSupported'] for w in words),'overlaps':overlaps,'firstVocalStart':words[0]['start'],'lastVocalEnd':words[-1]['end'],'encodedReview':'pending','listened':False}
doc={'version':1,'timebase':'source','title':'Psalm 23 (LXX 22) The Lord Is My Shepherd','duration':219.96,'status':'machine_estimate','method':'local paired CTC source alignment with original-mix Whisper base/small/medium corroboration and bounded complete-phrase retries; no fabricated beat timing','source':{'audio':str(audio),'sha256':hashlib.file_digest(audio.open('rb'),'sha256').hexdigest(),'duration':219.96,'offset':0,'canonicalLyrics':'canonical-lyrics.txt','canonicalLyricsSha256':hashlib.file_digest((p/'sources/canonical-lyrics.txt').open('rb'),'sha256').hexdigest(),'providerTiming':'suno-embedded-lyrics.srt','providerTimingUsedAsFinalCues':False},'words':words,'phrases':phrases,'summary':summary}
(p/'sources/words.json').write_text(json.dumps(doc,indent=2)+'\n');(p/'sources/phrases.json').write_text(json.dumps({'version':1,'timebase':'source','duration':219.96,'status':'machine_estimate','phrases':phrases,'summary':summary},indent=2)+'\n');(a/'source-review-passes.json').write_text(json.dumps(passes,indent=2)+'\n');(a/'source-word-evidence.json').write_text(json.dumps({'version':1,'status':'source_review_only','summary':summary,'words':all_evidence},indent=2)+'\n')
print(json.dumps(summary,indent=2))
for l in phrases:print(l['id'],f"{l['start']:.3f}-{l['end']:.3f}",l['text'])
