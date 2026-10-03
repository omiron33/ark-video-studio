#!/usr/bin/env python3
"""What a recording says, as text (local Whisper; never downloads a model). For story mode's spoken-text
check, which compares words, not timings, so it does not need (or trust) word intervals.
usage: hear.py <audio> <model.pt> <out.json>"""
import json, sys
import whisper

audio, model_path, out = sys.argv[1:4]
model = whisper.load_model(model_path, device='cpu')
r = model.transcribe(audio, language='en', temperature=0.0, condition_on_previous_text=False, fp16=False)
json.dump({'transcript': r['text'].strip(), 'model': model_path, 'segments': [{'start': s['start'], 'end': s['end'], 'text': s['text']} for s in r['segments']]}, open(out, 'w'), indent=1)
