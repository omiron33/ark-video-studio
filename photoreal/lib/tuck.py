#!/usr/bin/env python3
"""Words that tuck behind what H3 paints in front of them (the photorealistic composite).

    python3 photoreal/lib/tuck.py --generated generated.mp4 --matte matte.mkv --out matte-tucked.mkv [--report tuck.json]

In the photorealistic setting the words stay code: the code render's word pixels (the matte) are
laid over H3's picture. H3 repaints everything else, so a figure, a hand, smoke or a beam it paints
in front of a word never touches the letters, and the words read as pasted on. This pass measures
depth in H3's own frames (Depth Anything V2 Small, Apache-2.0; never the Large or Base weights,
which are non-commercial) and cuts the matte where something nearer than the words' surface passes
in front of them, so the picture can hide a word's edge the way the world would.

The tuck rule (claudia-bot engine/src/occ.js, MIT, anabology: "occlusion tucks an edge, never a
glyph"): a lyric must still read in one path at the moment it is sung, so only the letter at either
end of a line may tuck, by up to `tuck` (40%) of its ink, easing back to whole between 60% and 100%
of that. Every other letter the occluder reaches is drawn whole, on top. Letters are the matte's
connected ink at half resolution; lines are letters that share a row.

The words' surface is a low percentile of the depth under each line (an occluder covering most of a
line doesn't drag it forward); anything nearer than that by `margin` occludes. Everything is per
frame, so any frame can be redone alone.
"""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

import numpy as np

MODEL = 'depth-anything/Depth-Anything-V2-Small-hf'
OPTS = {'tuck': 0.4, 'margin': 0.08, 'plane': 35, 'ink': 0.35, 'soft': 1.0}


def lines_of(boxes: list) -> list:
    """group letter boxes (x0, y0, x1, y1) into rows: a letter joins a row when their vertical spans
    overlap by more than half the shorter one"""
    rows: list[list[int]] = []
    for i in sorted(range(len(boxes)), key=lambda k: boxes[k][0]):
        b = boxes[i]
        for r in rows:
            y0 = min(boxes[k][1] for k in r); y1 = max(boxes[k][3] for k in r)
            ov = min(y1, b[3]) - max(y0, b[1])
            if ov > 0.5 * min(y1 - y0, b[3] - b[1]):
                r.append(i); break
        else:
            rows.append([i])
    return rows


def tuck_frame(M: np.ndarray, D: np.ndarray, o: dict = OPTS) -> tuple[np.ndarray, dict]:
    """M: the word matte 0..1, D: depth 0..1 (near = 1), same shape. Returns the tucked matte and
    what happened: {letters, reached, kept, tucked, cover (largest share of an end letter hidden)}."""
    from scipy import ndimage
    ink = M > o['ink']
    rec = {'letters': 0, 'reached': 0, 'kept': 0, 'tucked': 0, 'cover': 0.0}
    if not ink.any():
        return M, rec
    lab, n = ndimage.label(ink)
    rec['letters'] = int(n)
    sl = ndimage.find_objects(lab)
    boxes = [(s[1].start, s[0].start, s[1].stop, s[0].stop) for s in sl]
    cut = np.zeros_like(M)
    for row in lines_of(boxes):
        x0 = min(boxes[k][0] for k in row); x1 = max(boxes[k][2] for k in row)
        y0 = min(boxes[k][1] for k in row); y1 = max(boxes[k][3] for k in row)
        band = D[y0:y1, x0:x1]
        plane = float(np.percentile(band, o['plane']))
        occ = (D > plane + o['margin']).astype(np.float32)
        if o['soft']:
            occ = ndimage.gaussian_filter(occ, o['soft'])
        ends = {row[0], row[-1]}
        for k in row:
            m = lab == (k + 1)
            area = float(M[m].sum()) or 1.0
            share = float((M[m] * occ[m]).sum()) / area
            if share < 0.01:
                continue
            rec['reached'] += 1
            T = o['tuck']
            f = 0.0
            if k in ends and share <= T:
                f = 1.0 if share <= 0.6 * T else (T - share) / (0.4 * T)
            if f > 0:
                rec['tucked'] += 1
                rec['cover'] = max(rec['cover'], share * f)
                cut[m] = occ[m] * f
            else:
                rec['kept'] += 1
    # the anti-aliased rim around a letter follows its letter
    grown = ndimage.grey_dilation(cut, size=(3, 3))
    return M * (1 - np.clip(grown, 0, 1)), rec


class Depth:
    """Depth Anything V2 Small on whatever this machine has (MPS, CUDA, else CPU), near = 1."""
    def __init__(self, model: str = MODEL):
        if 'small' not in model.lower() or any(b in model.lower() for b in ('large', 'base', 'giant')):
            raise SystemExit('only Depth Anything V2 Small may be used (the larger weights are non-commercial)')
        import torch
        from transformers import AutoImageProcessor, AutoModelForDepthEstimation
        self.torch = torch
        self.dev = 'mps' if torch.backends.mps.is_available() else 'cuda' if torch.cuda.is_available() else 'cpu'
        self.proc = AutoImageProcessor.from_pretrained(model)
        self.net = AutoModelForDepthEstimation.from_pretrained(model).to(self.dev).eval()

    def __call__(self, rgb: np.ndarray) -> np.ndarray:
        t = self.torch
        with t.no_grad():
            x = self.proc(images=rgb, return_tensors='pt').to(self.dev)
            d = self.net(**x).predicted_depth
            d = t.nn.functional.interpolate(d[:, None], size=rgb.shape[:2], mode='bilinear', align_corners=False)[0, 0].float().cpu().numpy()
        lo, hi = np.percentile(d, 2), np.percentile(d, 98)
        return np.clip((d - lo) / (hi - lo + 1e-6), 0, 1).astype(np.float32)


def probe(f: Path):
    s = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate',
                                   '-of', 'json', str(f)], capture_output=True, text=True, check=True).stdout)['streams'][0]
    return s['width'], s['height'], s['r_frame_rate']


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--generated', required=True, type=Path)
    p.add_argument('--matte', required=True, type=Path)
    p.add_argument('--out', required=True, type=Path)
    p.add_argument('--report', type=Path)
    for k, v in OPTS.items():
        p.add_argument('--' + k, type=float, default=v)
    a = p.parse_args()
    o = {k: getattr(a, k) for k in OPTS}
    W, H, rate = probe(a.generated)
    w, h = W // 2, H // 2
    gen = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-i', str(a.generated), '-vf', f'scale={w}:{h}:flags=area', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    mat = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-i', str(a.matte), '-vf', f'scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], stdout=subprocess.PIPE)
    out = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', f'{W}x{H}', '-r', rate, '-i', '-',
                            '-c:v', 'ffv1', '-pix_fmt', 'gray', str(a.out)], stdin=subprocess.PIPE)
    depth = None
    frames, summary = 0, {'letters': 0, 'reached': 0, 'kept': 0, 'tucked': 0, 'cover': 0.0, 'framesWithWords': 0}
    while True:
        g = gen.stdout.read(w * h * 3)
        m = mat.stdout.read(W * H)
        if len(m) < W * H:
            break
        full = np.frombuffer(m, np.uint8).reshape(H, W)
        if len(g) == w * h * 3 and full.max() > o['ink'] * 255:
            depth = depth or Depth()
            M = full.reshape(h, 2, w, 2).mean(axis=(1, 3)).astype(np.float32) / 255 if H % 2 == 0 and W % 2 == 0 else full[::2, ::2].astype(np.float32) / 255
            D = depth(np.frombuffer(g, np.uint8).reshape(h, w, 3))
            T, rec = tuck_frame(M, D, o)
            # apply the cut at full size: the ratio of tucked to original, upsampled
            ratio = np.where(M > 1e-3, T / np.maximum(M, 1e-3), 1.0)
            ratio = np.repeat(np.repeat(ratio, 2, axis=0), 2, axis=1)[:H, :W]
            full = (full.astype(np.float32) * ratio).clip(0, 255).astype(np.uint8)
            summary['framesWithWords'] += 1
            for k in ('letters', 'reached', 'kept', 'tucked'):
                summary[k] += rec[k]
            summary['cover'] = max(summary['cover'], rec['cover'])
        out.stdin.write(full.tobytes())
        frames += 1
    out.stdin.close()
    if out.wait() != 0:
        raise SystemExit('tuck: writing the matte failed')
    gen.wait(); mat.wait()
    summary.update(frames=frames, model=MODEL, options=o)
    if a.report:
        a.report.write_text(json.dumps(summary, indent=1) + '\n')
    print(f"tuck: {summary['tucked']} letter-frames tucked, {summary['kept']} drawn whole over the occluder, over {summary['framesWithWords']} frames with words")


if __name__ == '__main__':
    main()
