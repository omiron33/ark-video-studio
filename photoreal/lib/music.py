#!/usr/bin/env python3
"""What the music does, measured, for camera moves and cuts -> <song>/data/music.json.

    python3 photoreal/lib/music.py --song ../my-song [--stems demucs|auto|off] [--bpm-hint 72]

Ported from claudia-bot's slop/audio/beatmap.py and hits.py (MIT, anabology), with the same
constants. The beat map is never one BPM: local tempo is fitted in 20 s windows every 5 s on the
drum track's spectral flux, smoothed, and each beat snaps to the strongest drum hit within 30 ms.
Downbeats are a majority vote of kick energy per 32-beat block. On top of that:

  kick, snare, hat   onsets from band-limited spectral flux of the drum track (kick 30-150 Hz,
                     snare 150 Hz-5 kHz, hat 6-16 kHz; a snare or hat within 45 ms of a kick is
                     the kick's own click and dropped), with 0..1 strengths
  hits               the real hits: where the mix, drums or bass step up (the next 0.6 s against
                     the previous 1.5 s), snapped to the downbeat within 0.65 s, score 0..1
  risers             swells (other + bass rising steadily for at least 1 s) and the hit each
                     lands on ("land")
  fills              the beat before every strong hit, and bars whose second half breaks the
                     drum pattern of the four before
  vocal_entries      where the voice comes back after 0.375 s of quiet
  env24              24 fps loudness envelopes of the mix and each stem, 0..1

Stems come from media/stems/{drums,bass,other,vocals}.wav when they exist (any separator), from
Demucs when it is installed (--stems demucs, or auto), and otherwise from the mix itself
(percussive/harmonic split and band filters: rougher, and music.json says so in "stems").

The file is read by /kit/music.js (code scenes import it from '/song/data/music.json', which puts
it in only those scenes' cache keys) and by the music video's pop camera (lib/popcam.py). Writing
it never re-renders a segment of a film whose scenes don't import it.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np

SR, HOP, N = 22050, 256, 2048          # onset analysis
SR_DRUM, HOP_DRUM = 11025, 64          # beat tracking on the drum track (172 fps)


def load(path: Path, sr: int) -> np.ndarray:
    import librosa
    y, _ = librosa.load(str(path), sr=sr, mono=True)
    return y.astype(np.float32)


def lowpass(x: np.ndarray, sr: int, hz: float) -> np.ndarray:
    from scipy.signal import butter, sosfiltfilt
    return sosfiltfilt(butter(4, hz, btype='low', fs=sr, output='sos'), x).astype(np.float32)


def bandpass(x: np.ndarray, sr: int, lo: float, hi: float) -> np.ndarray:
    from scipy.signal import butter, sosfiltfilt
    return sosfiltfilt(butter(4, [lo, hi], btype='band', fs=sr, output='sos'), x).astype(np.float32)


# ---------------------------------------------------------------- stems
def stems(song: Path, mode: str) -> tuple[dict[str, np.ndarray], str]:
    wav = song / 'media' / 'song.wav'
    d = song / 'media' / 'stems'
    names = ('drums', 'bass', 'other', 'vocals')
    if all((d / f'{n}.wav').exists() for n in names):
        return {n: load(d / f'{n}.wav', SR) for n in names}, 'media/stems'
    if mode in ('demucs', 'auto'):
        try:
            import demucs  # noqa: F401
            out = song / 'out' / 'work' / 'demucs'
            subprocess.run([sys.executable, '-m', 'demucs', '-n', 'htdemucs', '-o', str(out), str(wav)], check=True)
            src = out / 'htdemucs' / wav.stem
            d.mkdir(parents=True, exist_ok=True)
            for n in names:
                shutil.copy(src / f'{n}.wav', d / f'{n}.wav')
            return {n: load(d / f'{n}.wav', SR) for n in names}, 'demucs htdemucs'
        except Exception as e:  # noqa: BLE001
            if mode == 'demucs':
                raise SystemExit(f'demucs failed: {e}')
    import librosa
    y = load(wav, SR)
    harm, perc = librosa.effects.hpss(y)
    return {'drums': perc, 'bass': lowpass(harm, SR, 180), 'other': bandpass(harm, SR, 180, 6000) * 0.5,
            'vocals': bandpass(harm, SR, 250, 3500)}, 'approximate (percussive/harmonic split of the mix)'


# ---------------------------------------------------------------- beat map
def drum_features(drums: np.ndarray):
    import librosa
    x = librosa.resample(drums, orig_sr=SR, target_sr=SR_DRUM)
    n = len(x) // HOP_DRUM
    fr = SR_DRUM / HOP_DRUM
    e = np.log1p((x[: n * HOP_DRUM].reshape(n, HOP_DRUM).astype(np.float64) ** 2).sum(1) * 1e3)
    flux = np.maximum(0, np.diff(e))
    flux -= flux.mean()
    k = lowpass(x, SR_DRUM, 150)
    kick = (k[: n * HOP_DRUM].reshape(n, HOP_DRUM).astype(np.float64) ** 2).sum(1)
    return flux, kick, fr


def estimate_bpm(y: np.ndarray, hint: float | None) -> float:
    if hint:
        return float(hint)
    import librosa
    oenv = librosa.onset.onset_strength(y=y, sr=SR, aggregate=np.median)
    try:
        bpm = float(np.atleast_1d(librosa.feature.tempo(onset_envelope=oenv, sr=SR))[0])
    except Exception:  # noqa: BLE001
        bpm = 100.0
    if not 20 <= bpm <= 400:
        return 100.0
    while bpm < 80:                       # octave errors: fold into 80-180 BPM (--bpm-hint for a slow song)
        bpm *= 2
    while bpm >= 180:
        bpm /= 2
    return bpm


def fit_window(flux, fr, a, lo, hi, L=20.0):
    seg = flux[int(a * fr):int((a + L) * fr)]
    best = (0.0, (lo + hi) / 2, a)
    if not len(seg):
        return best
    for bpm in np.arange(lo, hi, 0.05):
        per = 60 / bpm
        offs = np.arange(0, per, 0.004)
        n = int(np.ceil(L / per)) + 1
        tt = offs[:, None] + np.arange(n)[None, :] * per
        idx = (tt * fr).astype(int)
        valid = (tt < L) & (idx < len(seg))
        cnt = valid.sum(1)
        v = np.where(cnt > 0, (seg[np.where(valid, idx, 0)] * valid).sum(1) / np.maximum(cnt, 1), -np.inf)
        j = int(np.argmax(v))
        if v[j] > best[0]:
            best = (float(v[j]), float(bpm), float(a + offs[j]))
    return best


def variable_beats(flux, fr, lo, hi):
    T = len(flux) / fr
    pts = [(a + 10, *fit_window(flux, fr, a, lo, hi)) for a in np.arange(0, max(T - 20, 0.01), 5)]
    if len(pts) < 2:
        bpm = (lo + hi) / 2
        return np.arange(0, T, 60 / bpm), [{'t': 0.0, 'bpm': round(bpm, 2)}]
    tc = np.array([p[0] for p in pts]); sc = np.array([p[1] for p in pts]); bc = np.array([p[2] for p in pts])
    good = sc > np.percentile(sc, 20)
    if good.sum() < 1:
        good = np.ones(len(sc), bool)
    g05 = np.arange(0, T, 0.5)
    bm = np.interp(g05, tc[good], bc[good])
    bm = np.convolve(np.pad(bm, 10, mode='edge'), np.ones(21) / 21, mode='valid')
    tempo_at = lambda t: float(np.interp(t, g05[:len(bm)], bm))  # noqa: E731
    fmax = flux.max()

    def snap(t):
        i0, i1 = int((t - .03) * fr), int((t + .03) * fr) + 1
        w = flux[max(0, i0):i1]
        if len(w) and w.max() > 0.15 * fmax:
            return (max(0, i0) + int(np.argmax(w))) / fr, True
        return t, False

    p1 = pts[1][3]
    start = p1 - np.floor(p1 / (60 / tempo_at(0))) * (60 / tempo_at(0))
    beats, snapped = [float(start)], [False]
    while beats[-1] < T - 0.2:
        t, ok = snap(beats[-1] + 60 / tempo_at(beats[-1]))
        beats.append(float(t)); snapped.append(ok)
    lock = next((i for i in range(len(beats) - 3) if all(snapped[i:i + 4])), None)
    if lock and not all(snapped[:lock]):
        head, hits, t = [], 0, beats[lock]
        while t - 60 / tempo_at(t) >= 0:
            t, ok = snap(t - 60 / tempo_at(t))
            head.append(float(t)); hits += ok
        if head and hits >= 0.5 * len(head):
            beats = head[::-1] + beats[lock:]
    tempo = [{'t': round(float(t), 2), 'bpm': round(tempo_at(t), 2)} for t in np.arange(0, T, 5.0)]
    return np.array(beats), tempo


def window_max(env, times, fr, pre=0.01, post=0.05):
    out = np.zeros(len(times))
    for j, t in enumerate(times):
        a, b = max(0, int(round((t - pre) * fr))), min(len(env), int(round((t + post) * fr)) + 1)
        out[j] = float(env[a:b].max()) if b > a else 0.0
    return out


def downbeat_phase(beats, kick, fr):
    kb = window_max(kick, beats, fr)
    votes = [int(np.argmax([kb[p + b:min(len(beats), b + 32):4].sum() for p in range(4)])) for b in range(0, len(beats), 32)]
    return max(set(votes), key=votes.count) if votes else 0


# ---------------------------------------------------------------- hits
def stft_bands(x, bands, block=1024):
    n = 1 + (len(x) - N) // HOP if len(x) >= N else 0
    f = np.fft.rfftfreq(N, 1 / SR)
    masks = {k: (f >= lo) & (f < hi) for k, (lo, hi) in bands.items()}
    out = {k: np.zeros(n, np.float32) for k in bands}
    win = np.hanning(N).astype(np.float32)
    for i0 in range(0, n, block):
        idx = np.arange(i0, min(n, i0 + block))
        S = np.log1p(np.abs(np.fft.rfft(x[(idx * HOP)[:, None] + np.arange(N)[None, :]] * win, axis=1)).astype(np.float32) * 10)
        for k, m in masks.items():
            out[k][idx] = S[:, m].sum(1)
    return out


def flux_of(e):
    d = np.diff(e, prepend=e[0] if len(e) else 0)
    d[d < 0] = 0
    return d


def peaks(nov, min_gap_s, k=1.5, win_s=0.5, floor=0.3):
    from numpy.lib.stride_tricks import sliding_window_view
    if len(nov) < 3:
        return np.zeros(0, int)
    w = max(3, int(win_s * SR / HOP))
    V = sliding_window_view(np.pad(nov, w, mode='edge'), 2 * w + 1)
    med = np.empty(len(nov)); mad = np.empty(len(nov))
    for i0 in range(0, len(nov), 4096):
        blk = V[i0:i0 + 4096]; m = np.median(blk, axis=1)
        med[i0:i0 + 4096] = m; mad[i0:i0 + 4096] = np.median(np.abs(blk - m[:, None]), axis=1)
    thr = np.maximum(med + k * (mad + 1e-6) * 1.4826, floor * np.percentile(nov, 97))
    out, last, gap = [], -10 ** 9, int(min_gap_s * SR / HOP)
    for i in range(1, len(nov) - 1):
        if nov[i] > thr[i] and nov[i] >= nov[i - 1] and nov[i] >= nov[i + 1] and i - last >= gap:
            out.append(i); last = i
    return np.array(out, int)


def env24(x, dur):
    n = int(np.ceil(dur * 24)); hop = SR / 24
    e = np.zeros(n, np.float32)
    for i in range(n):
        a = int(i * hop); b = int(min(len(x), a + hop))
        if b > a:
            e[i] = np.sqrt(np.mean(x[a:b].astype(np.float64) ** 2))
    return e / (np.percentile(e, 99.5) + 1e-9) if n else e


def real_hits(env, beats, downbeats):
    n = len(env['mix'])
    cs = {k: np.concatenate([[0.0], np.cumsum(v, dtype=np.float64)]) for k, v in env.items()}
    mean = lambda k, i0, i1: (cs[k][min(n, i1)] - cs[k][max(0, i0)]) / (min(n, i1) - max(0, i0)) if min(n, i1) > max(0, i0) else 0.0  # noqa: E731
    d = lambda k, i: mean(k, i, i + 14) - mean(k, i - 36, i - 2)  # noqa: E731
    sc = np.array([max(d('mix', i), .9 * d('drums', i), .7 * d('bass', i)) for i in range(n)])
    out = []
    for i in range(n):
        if sc[i] < .22 or sc[i] < sc[max(0, i - 12):i + 13].max():
            continue
        t = i / 24
        if len(downbeats):
            j = int(np.argmin(np.abs(downbeats - t)))
            t = downbeats[j] if abs(downbeats[j] - t) <= .65 else (beats[int(np.argmin(np.abs(beats - t)))] if len(beats) else t)
        out.append([float(t), float(sc[i])])
    merged = []
    for o in sorted(out):
        if merged and o[0] - merged[-1][0] < 2.0:
            if o[1] > merged[-1][1]:
                merged[-1] = o
        else:
            merged.append(o)
    return [{'t': round(t, 3), 'score': round(min(1.0, s / .45), 3)} for t, s in merged]


def risers(eo, eb, hits, downbeats):
    m = np.convolve((eo + eb) / 2, np.ones(12) / 12, mode='same')
    L = 36; xs = np.arange(L) - (L - 1) / 2
    rising = np.zeros(len(m), bool)
    for i in range(0, len(m) - L):
        seg = m[i:i + L]
        sl = float((xs * (seg - seg.mean())).sum() / (xs ** 2).sum())
        r = np.corrcoef(xs, seg)[0, 1] if seg.std() > 1e-6 else 0
        if sl * L > 0.15 and r > 0.9:
            rising[i:i + L] = True
    runs, r0 = [], None
    for i, v in enumerate(np.append(rising, False)):
        if v and r0 is None:
            r0 = i
        if not v and r0 is not None:
            if i - r0 >= 24:
                runs.append((r0 / 24, i / 24))
            r0 = None
    out = []
    for a, b in runs:
        cand = [x for x in hits if a + .5 <= x['t'] <= b + 1.2]
        if cand:
            land = max(cand, key=lambda x: x['score'])['t']
        elif len(downbeats):
            j = int(np.argmin(np.abs(downbeats - b)))
            land = float(downbeats[j]) if abs(downbeats[j] - b) < .6 else b
        else:
            land = b
        out.append({'t0': round(a, 3), 't1': round(b, 3), 'land': round(float(land), 3)})
    return out


def fills(Bf, tt, beats, downbeats, env_drums, hits):
    out = []
    for x in hits:
        if x['score'] >= .5:
            j = int(np.searchsorted(beats, x['t'] - 1e-3)) - 1
            if j >= 0:
                out.append([round(float(beats[j]), 3), x['t']])

    def pat(b):
        t0 = downbeats[b]; t1 = downbeats[b + 1] if b + 1 < len(downbeats) else t0 + (t0 - downbeats[b - 1])
        v = np.zeros((16, 4))
        for s in range(16):
            t = t0 + (t1 - t0) * s / 16
            lo, hi = np.searchsorted(tt, t - .03, 'right'), np.searchsorted(tt, t + .03, 'left')
            for k in range(4):
                v[s, k] = min(1.2, Bf[k][lo:hi].max()) if hi > lo else 0
        return v

    def drum(b):
        a = int(downbeats[b] * 24); z = int((downbeats[b + 1] if b + 1 < len(downbeats) else downbeats[b] + 1.8) * 24)
        e = env_drums[a:z]
        return float(np.mean(e)) if len(e) else 0.0

    if len(downbeats) > 5:
        P = [pat(b) for b in range(len(downbeats))]
        for b in range(4, len(downbeats) - 1):
            ref = np.median(np.stack(P[b - 4:b]), axis=0)
            if np.abs(P[b][8:] - ref[8:]).sum() > 9 and min(drum(k) for k in range(b - 4, b + 2)) > .3:
                h = (downbeats[b + 1] - downbeats[b]) / 2
                out.append([round(float(downbeats[b] + h), 3), round(float(downbeats[b + 1]), 3)])
    merged = []
    for a, b in sorted(out):
        if merged and a <= merged[-1][1] + .05:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    return [{'t0': a, 't1': b} for a, b in merged]


def analyse(song: Path, stem_mode: str = 'auto', bpm_hint: float | None = None) -> dict:
    wav = song / 'media' / 'song.wav'
    if not wav.exists():
        raise SystemExit(f'no {wav}')
    mix = load(wav, SR)
    dur = len(mix) / SR
    S, stem_src = stems(song, stem_mode)
    drums = S['drums']
    # beat map
    flux, kick_e, fr = drum_features(drums)
    hint = estimate_bpm(mix, bpm_hint)
    beats, tempo = variable_beats(flux, fr, hint * .96, hint * 1.04)
    ph = downbeat_phase(beats, kick_e, fr)
    downbeats = beats[ph::4]
    # onsets
    t = lambda i: np.round(np.asarray(i) * HOP / SR + N / (2 * SR), 3)  # noqa: E731
    DB = stft_bands(drums, {'kick': (30, 150), 'sn1': (150, 5000), 'sn2': (1500, 5000), 'hat': (6000, 11000), 'mid': (150, 1500)})
    tt = np.arange(len(DB['kick'])) * HOP / SR + N / (2 * SR)
    kick_n = flux_of(DB['kick']); snare_n = flux_of(DB['sn1']) * .6 + flux_of(DB['sn2']) * .4; hat_n = flux_of(DB['hat'])
    ki, si, hi = peaks(kick_n, .16, k=3, floor=.35), peaks(snare_n, .16, k=3, floor=.4), peaks(hat_n, .08, k=3, floor=.3)
    kt = t(ki)
    near_kick = lambda idx: np.array([len(kt) > 0 and np.min(np.abs(kt - t(i))) <= .045 for i in idx], bool)  # noqa: E731
    si, hi = si[~near_kick(si)] if len(si) else si, hi[~near_kick(hi)] if len(hi) else hi
    env = {'mix': env24(mix, dur), 'drums': env24(drums, dur), 'bass': env24(S['bass'], dur), 'other': env24(S['other'], dur), 'vocals': env24(S['vocals'], dur)}
    H = real_hits(env, beats, downbeats)
    broad = flux_of(stft_bands(mix, {'all': (0, SR)})['all'])
    ii = peaks(broad, 1.0, k=6, win_s=3.0, floor=.55)
    ref90 = np.percentile(broad[ii], 90) if len(ii) else 1.0
    on, quiet = [], 0
    for i, v in enumerate(env['vocals']):
        if v < 0.06:
            quiet += 1
        else:
            if quiet >= 9:
                on.append(round(i / 24, 3))
            quiet = 0
    bandn = lambda e: (lambda fx: fx / (np.percentile(fx, 97) + 1e-9) if len(fx) else fx)(flux_of(e))  # noqa: E731
    Bf = [bandn(DB[k]) for k in ('kick', 'mid', 'sn2', 'hat')]
    norm = lambda v, idx: (v[idx] / (np.percentile(v[idx], 95) + 1e-9)).clip(0, 1).round(3).tolist() if len(idx) else []  # noqa: E731
    r3 = lambda a: [round(float(x), 3) for x in a]  # noqa: E731
    return {
        'source': 'media/song.wav', 'stems': stem_src, 'duration': round(dur, 3), 'fps': 24,
        'tempo': tempo, 'beats': r3(beats), 'downbeats': r3(downbeats), 'downbeatPhase': int(ph),
        'kick': r3(t(ki)), 'kick_s': norm(kick_n, ki), 'snare': r3(t(si)), 'snare_s': norm(snare_n, si), 'hat': r3(t(hi)),
        'hits': H, 'hits_all': [{'t': float(t(i)), 'score': round(float(min(1, broad[i] / (ref90 + 1e-9))), 3)} for i in ii],
        'risers': risers(env['other'], env['bass'], H, downbeats), 'fills': fills(Bf, tt, beats, downbeats, env['drums'], H),
        'vocal_entries': on, 'env24': {k: np.round(v, 3).tolist() for k, v in env.items()},
        'credit': 'beat map and hits ported from claudia-bot (MIT, anabology)',
    }


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--song', required=True, type=Path)
    p.add_argument('--stems', choices=['auto', 'demucs', 'off'], default='auto')
    p.add_argument('--bpm-hint', type=float)
    p.add_argument('--out', type=Path)
    a = p.parse_args()
    song = a.song.resolve()
    r = analyse(song, a.stems, a.bpm_hint)
    out = a.out or song / 'data' / 'music.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(r, separators=(',', ':')) + '\n')
    bpm = np.median([x['bpm'] for x in r['tempo']]) if r['tempo'] else 0
    print(f"wrote {out}: {len(r['beats'])} beats (about {bpm:.1f} BPM), {len(r['hits'])} hits, {len(r['risers'])} swells, "
          f"{len(r['fills'])} fills, {len(r['kick'])} kicks; stems: {r['stems']}")


if __name__ == '__main__':
    main()
