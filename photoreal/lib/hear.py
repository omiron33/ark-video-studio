#!/usr/bin/env python3
"""What a recording says, as text (local Whisper; never downloads a model). For story mode's spoken-text
check, which compares words, not timings, so it does not need (or trust) word intervals. Each model is
run independently so the caller can require them all to agree.
usage: hear.py <audio> <out.json> <model.pt> [<model.pt> ...] [--start s] [--end s]"""
import json, sys
import whisper

args = sys.argv[1:]
def opt(k):
    if k in args:
        i = args.index(k); v = float(args[i + 1]); del args[i:i + 2]; return v
    return None
start, end = opt('--start'), opt('--end')
audio_path, out, model_paths = args[0], args[1], args[2:]
audio = whisper.load_audio(audio_path)
if start is not None or end is not None:
    audio = audio[int((start or 0) * 16000):int(end * 16000) if end is not None else None]
results = []
for m in model_paths:
    model = whisper.load_model(m, device='cpu')
    r = model.transcribe(audio, language='en', temperature=0.0, condition_on_previous_text=False, fp16=False)
    results.append({'model': m, 'transcript': r['text'].strip()})
json.dump({'results': results}, open(out, 'w'), indent=1)
