#!/usr/bin/env python3
"""Continuum drift guard (photorealistic setting, "chain": "continuum"; opt-in only, its trial failed 2026-10-15).

    python3 photoreal/lib/chainmatch.py --generated joined.mp4 --bounds '[[0,124],[124,243]]' --out matched.mp4
                                        [--proxy proxy.mp4] [--report chainmatch.json]

H3-Continuum chunks drift: contrast, brightness and sharpness climb from chunk to chunk (Continuum
Issue #13; ~25-35% over three 5 s chunks in the 2026-10-14 KoG T01 test). This matches each chunk's
colour and contrast (per-channel mean and standard deviation) back to the take's first chunk. With
--proxy (the code render H3 was steered by) the target follows the code picture's own light: if the code
scene brightens by a stop, the match lets H3's picture brighten with it, so only the drift is removed.
The correction is a gain and offset per channel, eased between chunk centres so it never steps at a
seam, and clamped (gain 0.7-1.3, offset +-25 levels) so a bad measurement cannot wreck a take.
Sharpness drift is not corrected here. If takes still look harsh at their ends, Continuum is the suspect:
set "photorealistic": { "chain": "bridges" } in film.json.
"""
import argparse
import json
import subprocess

import numpy as np


def probe(path):
    out = subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                                   'stream=width,height', '-of', 'csv=p=0', path], text=True)
    w, h = (int(v) for v in out.strip().split(',')[:2])
    return w, h


def frames(path, w, h, scale=None):
    vf = ['-vf', f'scale={scale[0]}:{scale[1]}:flags=area'] if scale else []
    if scale:
        w, h = scale
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', path, *vf, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         stdout=subprocess.PIPE)
    size = w * h * 3
    while True:
        buf = p.stdout.read(size)
        if len(buf) < size:
            break
        yield np.frombuffer(buf, np.uint8).reshape(h, w, 3)
    p.wait()


def chunk_stats(path, bounds):
    """per chunk: (mean[3], std[3]) over its frames, measured small"""
    sums = [[np.zeros(3), np.zeros(3), 0] for _ in bounds]
    for i, f in enumerate(frames(path, 0, 0, scale=(240, 136))):
        x = f.reshape(-1, 3).astype(np.float64)
        for k, (a, b) in enumerate(bounds):
            if a <= i < b:
                sums[k][0] += x.mean(0)
                sums[k][1] += (x ** 2).mean(0)
                sums[k][2] += 1
    out = []
    for s1, s2, n in sums:
        if not n:
            out.append(None)
            continue
        m = s1 / n
        out.append((m, np.sqrt(np.maximum(s2 / n - m ** 2, 1e-6))))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--generated', required=True)
    ap.add_argument('--bounds', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--proxy')
    ap.add_argument('--report')
    a = ap.parse_args()
    bounds = json.loads(a.bounds)
    gen = chunk_stats(a.generated, bounds)
    prx = chunk_stats(a.proxy, bounds) if a.proxy else None
    g1 = gen[0]
    corr = []
    for k, g in enumerate(gen):
        # a chunk too flat to measure (a fade to black, fog) is left alone
        if k == 0 or g is None or g1 is None or g[1].mean() < 4 or g1[1].mean() < 4:
            corr.append((np.ones(3), np.zeros(3)))
            continue
        mean_t, std_t = g1[0].copy(), g1[1].copy()
        if prx and prx[0] is not None and prx[k] is not None:
            p1, pk = prx[0], prx[k]
            mean_t = g1[0] + (pk[0] - p1[0]) * (g1[1] / np.maximum(p1[1], 1.0))
            std_t = g1[1] * (pk[1] / np.maximum(p1[1], 1.0))
        gain = np.clip(std_t / np.maximum(g[1], 1.0), 0.7, 1.3)
        off = np.clip(mean_t - gain * g[0], -25, 25)
        corr.append((gain, off))
    centres = [(lo + hi) / 2 for lo, hi in bounds]

    def at(i):
        if i <= centres[0]:
            return corr[0]
        for k in range(1, len(centres)):
            if i <= centres[k]:
                t = (i - centres[k - 1]) / max(centres[k] - centres[k - 1], 1)
                t = t * t * (3 - 2 * t)
                return (corr[k - 1][0] * (1 - t) + corr[k][0] * t, corr[k - 1][1] * (1 - t) + corr[k][1] * t)
        return corr[-1]

    w, h = probe(a.generated)
    enc = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}',
                            '-r', '24', '-i', '-', '-c:v', 'libx264', '-crf', '10', '-pix_fmt', 'yuv420p', a.out],
                           stdin=subprocess.PIPE)
    for i, f in enumerate(frames(a.generated, w, h)):
        gain, off = at(i)
        enc.stdin.write(np.clip(f.astype(np.float32) * gain + off, 0, 255).astype(np.uint8).tobytes())
    enc.stdin.close()
    if enc.wait():
        raise SystemExit('chainmatch: encode failed')
    if a.report:
        json.dump({'bounds': bounds, 'chunks': [
            {'mean': None if g is None else g[0].round(2).tolist(), 'std': None if g is None else g[1].round(2).tolist(),
             'gain': c[0].round(3).tolist(), 'offset': c[1].round(2).tolist()} for g, c in zip(gen, corr)],
            'proxy_followed': bool(prx)}, open(a.report, 'w'), indent=1)


if __name__ == '__main__':
    main()
