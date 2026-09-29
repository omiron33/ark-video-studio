"""Build the Genesis 2 Garden project: sections from lyric lines, scenes, layouts, music analysis."""
import json
I = 'intake/'
ws = json.load(open(I + 'words.json'))['words']
lines = json.load(open(I + 'lines.json'))
A = json.load(open(I + 'analysis.json'))
DUR = round(A['duration'] * 60) / 60
# "shame" was force-aligned across the instrumental outro; its sung note ends near 273.6 s.
ws[-1] = {**ws[-1], 'end': 273.6, 'provenance': {**(ws[-1].get('provenance') or {}), 'note': 'end clamped from 283.32 to 273.6: forced alignment spilled into the instrumental outro'}}
words, k = [], 0
for L in lines:
    seg = ws[k:k + L['n']]; k += L['n']
    for w in seg: words.append({**w, 'line': L['i']})
beats = [b for b in A['beats'] if b['time'] < DUR]
def snap(t, tol=.22):
    b = min(beats, key=lambda b: abs(b['time'] - t)); return b['time'] if abs(b['time'] - t) <= tol else t
# (first line, last line, scene, layout, speaker words)
PLAN = [(0,1,'finished','bl',0),(2,3,'sixDays','tl',0),(4,5,'ceased','bc',0),(6,7,'holy','tl',0),(8,9,'unwind','bl',0),
 (10,11,'strata','tl',0),(12,13,'range','bl',0),(14,15,'barren','tl',0),(16,17,'drought','bl',0),(18,19,'fountain','tl',0),
 (20,20,'dust','tl',0),(21,21,'breath','bl',0),(22,22,'soul','tl',0),(23,24,'garden','tl',0),(25,26,'placed','bc',0),
 (27,28,'orchard','tl',0),(29,29,'lifeTree','bl',0),(30,30,'knowing','tl',0),(31,32,'river','tl',0),(33,34,'fourHeads','bl',0),
 (35,37,'gold','tl',0),(38,40,'gems','bl',0),(41,42,'geon','tl',0),(43,45,'twinRivers','bl',0),(46,47,'wall','tl',0),
 (48,48,'furrows','bl',0),(49,51,'freely','tl',0),(52,53,'forbidden','bl',0),(54,55,'die','tl',0),(56,57,'alone','tl',0),
 (58,59,'helper','bl',0),(60,61,'beasts','tl',0),(62,62,'drain','tl',0),(63,64,'naming','tl',0),(65,66,'parade','tl',0),
 (67,68,'noHelper','bl',0),(69,69,'trance','tl',0),(70,71,'rib','bl',0),(72,72,'woman','tl',0),(73,73,'brought','bl',0),
 (74,75,'bone','tl',1),(76,77,'bone','bl',1),(78,82,'oneFlesh','tl',3),(83,86,'noShame','tl',3)]
INSTRUMENTAL = {12: 'calmWater', 14: 'calmWater'}  # after these PLAN rows, a gap long enough for its own scene
sections = []
def lw(a, b): return [w for w in words if a <= w['line'] <= b]
first = lw(0, 0)[0]['start']
sections.append({'id': 'title', 'start': 0, 'end': None, 'style': 'garden', 'wordIds': [], 'assetIds': ['serif', 'caps'], 'direction': {'scene': 'title'}, 'seed': 1})
bounds = []
for n, (a, b, scene, pos, spk) in enumerate(PLAN):
    ws_ = lw(a, b)
    start = ws_[0]['start']; prev_end = sections[-1].get('_lastEnd', 0)
    cut = snap(start - .45) if n else snap(first - .5)
    sections[-1]['end'] = cut
    counts = []
    for li in range(a, b + 1):
        c = sum(1 for w in ws_ if w['line'] == li)
        if li == a: c -= spk
        if c: counts.append(c)
    spkText = ' '.join(w['text'].rstrip(':') for w in ws_[:spk]) if spk else None
    size = 96 if sum(counts) > 12 else 108 if sum(counts) > 7 else 124
    sec = {'id': f'{n+1:02d}-{scene}', 'start': cut, 'end': None, 'style': 'garden', 'wordIds': [w['id'] for w in ws_], 'assetIds': ['serif', 'caps'],
           'direction': {'scene': scene, 'layout': pos, 'lines': counts, 'size': size, **({'speaker': spkText} if spk else {})}, 'seed': n + 2, '_lastEnd': ws_[-1]['end']}
    sections.append(sec)
    if n in INSTRUMENTAL:
        gapStart = snap(ws_[-1]['end'] + 1.2)
        nextStart = lw(PLAN[n+1][0], PLAN[n+1][0])[0]['start']
        if nextStart - gapStart > 2.5:
            sec['end'] = gapStart
            sections.append({'id': f'{n+1:02d}b-{INSTRUMENTAL[n]}', 'start': gapStart, 'end': None, 'style': 'garden', 'wordIds': [], 'assetIds': ['serif', 'caps'], 'direction': {'scene': INSTRUMENTAL[n]}, 'seed': 100 + n, '_lastEnd': gapStart})
outro = snap(273.6 + 1.2)
sections[-1]['end'] = outro
sections.append({'id': 'outro', 'start': outro, 'end': DUR, 'style': 'garden', 'wordIds': [], 'assetIds': ['serif', 'caps'], 'direction': {'scene': 'outro'}, 'seed': 999})
for s in sections: s.pop('_lastEnd', None); s['start'] = round(s['start'], 4); s['end'] = round(s['end'], 4)
# The renderer assigns frames by section start; keep every boundary frame aligned.
for s in sections: s['start'] = round(s['start'] * 60) / 60; s['end'] = round(s['end'] * 60) / 60
for a, b in zip(sections, sections[1:]): a['end'] = b['start']
p = {'version': 1, 'id': 'genesis2-garden', 'title': 'Genesis 2 — The Garden', 'width': 1920, 'height': 1080, 'fps': 60, 'duration': DUR,
     'audio': {'src': 'intake/genesis2-the-garden.wav', 'offset': 0},
     'assets': {'serif': {'type': 'font', 'src': 'assets/EBGaramond-Italic-Variable.ttf', 'family': 'EB Garamond Italic'}, 'caps': {'type': 'font', 'src': 'assets/BebasNeue-Regular.ttf', 'family': 'Bebas Neue'}},
     'words': [{k2: v for k2, v in w.items() if k2 != 'line'} for w in words], 'beats': beats, 'palette': {'ink': '#2A211A', 'paper': '#F1E8D8', 'accent': '#9AD6BE'},
     'sections': sections,
     'analysis': {'envelopeRate': A['envelopeRate'], 'rms': A['rms'], 'low': A['low'], 'kicks': A['kicks'], 'bpm': A['bpm'], 'method': A['method']},
     'creation': {'mode': 'code-only', 'stylePrompt': 'Genesis 2 as living topographic clay relief; lighter umber; creatures, trees, rivers and people rise from one contour field; modern, not preachy',
                  'themeChoice': {'status': 'chosen', 'choice': 'relief (take 2), a touch lighter', 'instruction': 'Shane, 2026-09-29: "that\'s great except need it just a bit lighter... generate the entire video."'}},
     'render': {'motionBlur': {'samples': 12, 'shutter': .2}, 'crf': 16, 'preset': 'slow'},
     'source': {'suno': 'https://suno.com/s/VCB6c2tqTTwI0juR', 'sunoSongId': '185c9425-6e80-42ae-8904-fc00cda3e189', 'audioSha256': 'a9ce7b64af9abe9d0f6124eaf45a46158e87d029a2591162b884c5290c198309', 'lyrics': 'intake/lyrics.txt'}}
json.dump(p, open('project.json', 'w'), indent=1)
print(len(sections), 'sections;', 'duration', DUR)
for s in sections: print(f"{s['start']:7.2f} {s['end']:7.2f} {s['id']:18s} {len(s['wordIds'])}")
