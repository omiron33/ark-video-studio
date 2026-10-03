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
import numpy as np
# Long recordings are heard in pieces of at most 24 s, each cut in the quietest moment near its end:
# Whisper's own 30 s windows can split a word or repeat a phrase across their seam ("he said. he said.")
SR = 16000
def pieces(x, most=24.0, least=8.0):
    out, a = [], 0
    hop = int(0.02 * SR)
    while len(x) - a > most * SR:
        lo, hi = a + int(least * SR), a + int(most * SR)
        seg = x[lo:hi]
        win = int(0.35 * SR)   # the quietest third of a second: a real pause, not a stop consonant
        e = np.sqrt(np.convolve(seg ** 2, np.ones(win) / win, mode="same"))
        cut = lo + int(np.argmin(e[::hop]) * hop)
        out.append(x[a:cut]); a = cut
    out.append(x[a:])
    return out
results = []
for m in model_paths:
    model = whisper.load_model(m, device='cpu')
    text = ' '.join(model.transcribe(p, language='en', temperature=0.0, condition_on_previous_text=False, fp16=False)['text'].strip() for p in pieces(audio) if len(p) > 0.2 * SR)
    results.append({'model': m, 'transcript': text})
json.dump({'results': results}, open(out, 'w'), indent=1)
