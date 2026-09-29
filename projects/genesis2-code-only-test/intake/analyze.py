"""Measure beats, onsets and loudness envelopes for the relief film (numpy only)."""
import json, wave, numpy as np
w = wave.open('genesis2-the-garden.wav'); sr = w.getframerate(); n = w.getnframes()
x = np.frombuffer(w.readframes(n), dtype=np.int16).reshape(-1, w.getnchannels()).mean(1) / 32768.0
hop = sr // 100  # 10 ms
win = 2048
frames = np.lib.stride_tricks.sliding_window_view(np.pad(x, (win // 2, win)), win)[::hop][: len(x) // hop]
spec = np.abs(np.fft.rfft(frames * np.hanning(win), axis=1))
freqs = np.fft.rfftfreq(win, 1 / sr)
logs = np.log1p(spec * 10)
flux = np.maximum(0, np.diff(logs, axis=0, prepend=logs[:1])).sum(1)
low = spec[:, freqs < 150].sum(1); mid = spec[:, (freqs >= 150) & (freqs < 2000)].sum(1); high = spec[:, freqs >= 2000].sum(1)
rms = np.sqrt((frames ** 2).mean(1))
def norm(v, k=25):
    v = np.convolve(v, np.ones(k) / k, mode='same'); return v / (np.percentile(v, 99) + 1e-9)
onset = flux - np.convolve(flux, np.ones(50) / 50, mode='same'); onset = np.maximum(onset, 0); onset /= onset.max()
# Tempo by autocorrelation in 70-140 BPM.
ac = np.correlate(onset, onset, mode='full')[len(onset) - 1:]
lags = np.arange(len(ac)); bpm_range = (60 / (lags[1:] / 100))
cand = [(ac[l], l) for l in range(int(100 * 60 / 140), int(100 * 60 / 70))]
lag = max(cand)[1]; period = lag / 100
# Phase: choose offset maximising onset energy on the grid.
best = max(((onset[np.arange(int(p), len(onset), lag)].sum(), p) for p in range(lag)))[1]
beats = []
t = best / 100
while t < len(x) / sr:
    i = int(round(t * 100)); lo, hi = max(0, i - 4), min(len(onset), i + 5)
    j = lo + int(np.argmax(onset[lo:hi]))  # snap within 40 ms to the actual attack
    beats.append({'time': round(j / 100, 3), 'strength': round(float(min(1, onset[j] * 2)), 3), 'kind': 'beat'})
    t = j / 100 + period
kicks = [round(i / 100, 3) for i in range(1, len(low) - 1) if (lowd := np.diff(norm(low, 3)))[i - 1] > .12 and norm(low, 3)[i] > .35 and np.argmax(norm(low, 3)[max(0, i - 8):i + 8]) == min(i, 8)]
env = lambda v: [round(float(a), 3) for a in norm(v, 15)[::5]]  # 20 Hz
out = {'version': 1, 'source': 'genesis2-the-garden.wav', 'method': 'numpy spectral flux + autocorrelation tempo; beats snapped to attacks', 'bpm': round(60 / period, 2), 'beats': beats, 'kicks': kicks, 'envelopeRate': 20, 'rms': env(rms), 'low': env(low), 'mid': env(mid), 'high': env(high), 'duration': len(x) / sr}
json.dump(out, open('analysis.json', 'w'))
print(out['bpm'], len(beats), len(kicks), beats[:4])
