#!/usr/bin/env python3
"""The music video's pop camera: the frame answers the track, laid over the finished picture.

    python3 photoreal/lib/popcam.py --song ../my-video --video out/work/mv-picture.mp4 --out out/work/mv-camera.mp4
    python3 photoreal/lib/popcam.py --song ../my-video --plan out/work/popcam.json   (the curve only, no video)

Only for "mode": "musicvideo" films. Every other film keeps shake off, with at most one or two
opted-in violent moments (photoreal/README.md#shake). Here Shane asked for pop-video camera work:
punches on the kick, shake riding the drums, a push into every swell, an impact on every big hit
and a whip into the cut after a fill. The moves and their defaults are claudia-bot's hits-driven
camera (docs/70-motion-design.md section 9, MIT, anabology), driven by data/music.json
(lib/music.py):

  punch    each kick: zoom up by amp (0.02) in 0.03 s, decaying with tau 0.13 s; gated by the drum
           envelope, so no punch where the drums are out
  shake    the drum envelope: 6 px and 0.002 rad of smooth 7 Hz noise, scaled by envelope^1.6
  ride     a swell: zoom up to 0.06 along t^2.2 into the hit it lands on, snapping back in 0.09 s
  impact   a real hit (score >= 0.6): zoom kick 0.06 x score (attack 0.035 s, tau 0.3 s) and a
           14 px shake burst decaying over 0.22 s
  whip     a cut that lands on a hit or ends a fill: a directional blur sweep (180 px) and a short
           slide over 0.24 s centred on the cut

Rules kept from the source: a move answers a sound you can hear; the camera holds still where the
song breathes (no drums, no move); the frame's edges never show (the picture is scaled to cover
every offset and rotation). Each scene in film.json may set "camera": { "energy": 0..1.5 (1 by
default), "punch", "shake", "ride", "impact", "whip": false to turn one off } or "camera": false to
leave the scene alone; film.json "popcam": { "energy" } scales the whole film. Every frame is a pure
function of its time, so any frame can be redrawn alone.
"""
from __future__ import annotations

import argparse
import bisect
import json
import math
import subprocess
from pathlib import Path

import numpy as np

DEFAULTS = {
    'punch': {'amp': 0.02, 'attack': 0.03, 'tau': 0.13},
    'shake': {'px': 6.0, 'rot': 0.002, 'hz': 7.0, 'power': 1.6},
    'ride': {'amp': 0.06, 'curve': 2.2, 'release': 0.09},
    'impact': {'min': 0.6, 'zoom': 0.06, 'attack': 0.035, 'tau': 0.3, 'burst': 14.0, 'burstTau': 0.22, 'rot': 0.006},
    'whip': {'blur': 180.0, 'slide': 60.0, 'dur': 0.24},
}
MOVES = ('punch', 'shake', 'ride', 'impact', 'whip')


def _noise(t: float, seed: float) -> float:
    """smooth deterministic noise in about -1..1 (three detuned sines with fixed phases)"""
    return (math.sin(t * 1.00 + seed * 12.9898) * 0.55 + math.sin(t * 1.73 + seed * 78.233) * 0.3
            + math.sin(t * 2.61 + seed * 37.719) * 0.15)


def _env(m: dict, name: str, t: float) -> float:
    e = m.get('env24', {}).get(name) or []
    if not e:
        return 0.0
    x = t * 24
    i = int(x)
    if i >= len(e) - 1:
        return float(e[-1])
    return float(e[i] + (e[i + 1] - e[i]) * (x - i))


def _pulse(t: float, at: float, attack: float, tau: float) -> float:
    """0 before `at`, rising to 1 over `attack`, then decaying with time constant `tau`"""
    d = t - at
    if d < 0:
        return 0.0
    if d < attack:
        u = d / attack
        return u * u * (3 - 2 * u)
    return math.exp(-(d - attack) / tau)


def scene_at(scenes: list, t: float):
    for s in scenes:
        if s['from'] - 1e-6 <= t < s['to']:
            return s
    return scenes[-1] if scenes else None


def settings(film: dict, scene: dict | None) -> dict | None:
    """the moves on for a scene, with their energy; None leaves the scene alone"""
    cam = (scene or {}).get('camera', {})
    if cam is False:
        return None
    cam = cam if isinstance(cam, dict) else {}
    energy = float(cam.get('energy', 1.0)) * float((film.get('popcam') or {}).get('energy', 1.0))
    return {'energy': max(0.0, min(1.5, energy)), **{k: cam.get(k, True) is not False for k in MOVES}}


def camera_at(t: float, m: dict, film: dict, W: int = 1920, H: int = 1080, C: dict = DEFAULTS) -> dict:
    """The camera at song time t: zoom (fraction), x and y (px), rot (rad), blur (px vector)."""
    scenes = film.get('scenes', [])
    s = scene_at(scenes, t)
    on = settings(film, s)
    out = {'zoom': 0.0, 'x': 0.0, 'y': 0.0, 'rot': 0.0, 'blur': (0.0, 0.0)}
    if not on or on['energy'] <= 0:
        return out
    E = on['energy']
    drums = _env(m, 'drums', t)
    if on['punch']:
        P = C['punch']
        gate = min(1.0, 0.35 + drums * 1.2) if drums > 0.08 else 0.0
        kicks, ks = m.get('kick', []), m.get('kick_s') or []
        z, k = 0.0, bisect.bisect_right(kicks, t) - 1
        while k >= 0 and t - kicks[k] < 1.0:
            z = max(z, _pulse(t, kicks[k], P['attack'], P['tau']) * (0.5 + 0.5 * (ks[k] if k < len(ks) else 1.0)))
            k -= 1
        out['zoom'] += P['amp'] * z * gate * E
    if on['shake']:
        S = C['shake']
        a = (max(0.0, drums) ** S['power']) * E
        w = 2 * math.pi * S['hz'] / 3
        out['x'] += S['px'] * a * _noise(t * w, 1.0)
        out['y'] += S['px'] * a * _noise(t * w, 2.0)
        out['rot'] += S['rot'] * a * _noise(t * w, 3.0)
    if on['ride']:
        R = C['ride']
        for r in m.get('risers', []):
            t0, land = r['t0'], r['land']
            if t0 <= t < land and land > t0:
                out['zoom'] += R['amp'] * ((t - t0) / (land - t0)) ** R['curve'] * E
            elif land <= t < land + R['release']:
                out['zoom'] += R['amp'] * (1 - (t - land) / R['release']) * E
    if on['impact']:
        I = C['impact']
        for h in m.get('hits', []):
            if h['score'] < I['min'] or h['t'] > t or t - h['t'] > 2.0:
                continue
            p = _pulse(t, h['t'], I['attack'], I['tau'])
            out['zoom'] += I['zoom'] * h['score'] * p * E
            b = math.exp(-(t - h['t']) / I['burstTau']) * E * h['score']
            out['x'] += I['burst'] * b * _noise(t * 90, 4.0)
            out['y'] += I['burst'] * b * _noise(t * 90, 5.0)
            out['rot'] += I['rot'] * b * _noise(t * 90, 6.0)
    if on['whip']:
        Wp = C['whip']
        for c in _whips(film, m):
            d = (t - c['t']) / (Wp['dur'] / 2)
            if -1 < d < 1:
                k = (1 - abs(d)) ** 2 * E
                out['blur'] = (out['blur'][0] + Wp['blur'] * k * c['dir'], out['blur'][1])
                out['x'] += Wp['slide'] * k * c['dir'] * (-1 if d < 0 else 1) * (1 - abs(d))
    return out


_WHIPS: dict = {}


def _whips(film: dict, m: dict) -> list:
    key = (id(film), id(m))
    if key not in _WHIPS:
        _WHIPS[key] = whip_cuts(film, m)
    return _WHIPS[key]


def whip_cuts(film: dict, m: dict) -> list:
    """cuts that land within 2 frames of a strong hit or the end of a fill, alternating direction"""
    marks = [h['t'] for h in m.get('hits', []) if h['score'] >= 0.5] + [f['t1'] for f in m.get('fills', [])]
    out = []
    for i, s in enumerate(film.get('scenes', [])[1:], 1):
        if any(abs(s['from'] - x) <= 2 / 24 for x in marks):
            on = settings(film, s)
            if on and on['whip']:
                out.append({'t': s['from'], 'dir': 1 if len(out) % 2 == 0 else -1})
    return out


def cover_scale(c: dict, W: int, H: int) -> float:
    """the scale that keeps every edge outside the frame under this offset and rotation"""
    th = abs(c['rot'])
    rot = math.cos(th) + math.sin(th) * max(W / H, H / W)
    return (1 + c['zoom']) * (rot + 2 * max(abs(c['x']) / W, abs(c['y']) / H))


def plan(m: dict, film: dict, fps: float, frames: int, t0: float = 0.0, W: int = 1920, H: int = 1080) -> list:
    rows = []
    for i in range(frames):
        t = t0 + i / fps
        c = camera_at(t, m, film, W, H)
        rows.append({'t': round(t, 4), 'scale': round(cover_scale(c, W, H), 5), 'x': round(c['x'], 2), 'y': round(c['y'], 2),
                     'rot': round(c['rot'], 5), 'blur': [round(c['blur'][0], 1), round(c['blur'][1], 1)]})
    return rows


def _blur(img, bx: float, by: float):
    import cv2
    L = int(round(math.hypot(bx, by)))
    if L < 3:
        return img
    k = np.zeros((L | 1, L | 1), np.float32)
    c = (L | 1) // 2
    ang = math.atan2(by, bx)
    for j in range(L | 1):
        u = j - c
        x, y = int(round(c + u * math.cos(ang))), int(round(c + u * math.sin(ang)))
        k[y, x] = 1
    return cv2.filter2D(img, -1, k / k.sum(), borderType=cv2.BORDER_REFLECT)


def apply(video: Path, out: Path, rows: list, W: int, H: int, fps: float, crf: str = '12'):
    import cv2
    rd = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-i', str(video), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    wr = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(fps), '-i', '-',
                           '-i', str(video), '-map', '0:v', '-map', '1:a?', '-c:a', 'copy', '-c:v', 'libx264', '-preset', 'slow', '-crf', crf,
                           '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', str(out)],
                          stdin=subprocess.PIPE)
    n = W * H * 3
    i = 0
    while True:
        buf = rd.stdout.read(n)
        if len(buf) < n:
            break
        img = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
        r = rows[min(i, len(rows) - 1)]
        if r['scale'] != 1 or r['x'] or r['y'] or r['rot']:
            M = cv2.getRotationMatrix2D((W / 2, H / 2), math.degrees(r['rot']), r['scale'])
            M[0, 2] += r['x']
            M[1, 2] += r['y']
            img = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT)
        if r['blur'][0] or r['blur'][1]:
            img = _blur(img, r['blur'][0], r['blur'][1])
        wr.stdin.write(np.ascontiguousarray(img).tobytes())
        i += 1
    wr.stdin.close()
    rd.wait()
    if wr.wait() != 0 or rd.returncode != 0:
        raise SystemExit('popcam: ffmpeg failed')
    return i


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--song', required=True, type=Path)
    p.add_argument('--video', type=Path)
    p.add_argument('--out', type=Path)
    p.add_argument('--plan', type=Path, help='write the per-frame camera as JSON')
    p.add_argument('--from', dest='t0', type=float, default=0.0, help='song time of the video\'s first frame')
    p.add_argument('--crf', default='12')
    a = p.parse_args()
    song = a.song.resolve()
    film = json.loads((song / 'film.json').read_text())
    m = json.loads((song / 'data' / 'music.json').read_text())
    if a.video:
        pr = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries',
                                        'stream=width,height,r_frame_rate,nb_read_packets', '-of', 'json', str(a.video)], capture_output=True, text=True, check=True).stdout)['streams'][0]
        W, H, frames = pr['width'], pr['height'], int(pr['nb_read_packets'])
        num, den = map(int, pr['r_frame_rate'].split('/'))
        fps = num / den
    else:
        W, H, fps = 1920, 1080, float(film.get('fps', 24))
        frames = int(round((film['scenes'][-1]['to'] - a.t0) * fps))
    rows = plan(m, film, fps, frames, a.t0, W, H)
    if a.plan:
        a.plan.write_text(json.dumps({'fps': fps, 'width': W, 'height': H, 'rows': rows}) + '\n')
        print(f'wrote {a.plan}: {len(rows)} frames')
    if a.video and a.out:
        n = apply(a.video, a.out, rows, W, H, fps, a.crf)
        print(f'wrote {a.out}: {n} frames with the pop camera')


if __name__ == '__main__':
    main()
