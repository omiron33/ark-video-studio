"""Song-wide flash, shake, and pulse cues from the beat grid and the mp3."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from arkpipe.cues import load_mono_segment, measure_cues, onset_and_lowband

LOUD_NAMES = (
    "verse 1",
    "chorus 1",
    "dub bass",
    "bridge 1",
    "pro-verse",
    "pro-chorus",
    "pro-bridge",
    "pro verse",
    "pro chorus",
    "pro bridge",
)


def _sections(audio: dict) -> list[dict]:
    rows = []
    for section in audio.get("sections") or []:
        name = str(section.get("name") or "")
        rows.append({"name": name, "start": float(section["start"]), "end": float(section["end"])})
    return rows


def _is_loud(name: str) -> bool:
    low = name.lower()
    return any(token in low for token in LOUD_NAMES)


def _is_intro(name: str) -> bool:
    return "intro" in name.lower()


def _pick_peaks(times: np.ndarray, values: np.ndarray, threshold: float, gap: float) -> list[float]:
    order = np.argsort(values)[::-1]
    chosen: list[float] = []
    for idx in order:
        if values[idx] < threshold:
            break
        t = float(times[idx])
        if any(abs(t - prev) < gap for prev in chosen):
            continue
        chosen.append(t)
    chosen.sort()
    return chosen


def select_cues(
    onset_times: list[float],
    onset_strengths: list[float],
    low_times: list[float],
    low_rms: list[float],
    beats: list[float],
    sections: list[dict],
    door_slam: float,
) -> dict:
    """Choose musical hits. Flashes are a minority of the beats, denser in loud sections."""
    strengths = np.asarray(onset_strengths, dtype=np.float64)
    otimes = np.asarray(onset_times, dtype=np.float64)
    if strengths.size == 0:
        raise RuntimeError("no onsets")
    loud_cut = float(np.quantile(strengths, 0.72))
    quiet_cut = float(np.quantile(strengths, 0.90))
    pulse_cut = float(np.quantile(strengths, 0.62))

    def section_at(t: float) -> str:
        for section in sections:
            if section["start"] <= t < section["end"]:
                return section["name"]
        return ""

    flash_times: list[float] = []
    for t, strength in zip(onset_times, onset_strengths):
        name = section_at(t)
        cut = loud_cut if _is_loud(name) else quiet_cut
        if _is_intro(name):
            cut = max(cut, float(np.quantile(strengths, 0.94)))
        if strength < cut:
            continue
        if flash_times and t - flash_times[-1] < (0.42 if _is_loud(name) else 0.85):
            continue
        flash_times.append(float(t))

    low_t = np.asarray(low_times, dtype=np.float64)
    low_v = np.asarray(low_rms, dtype=np.float64)
    shake_cut = float(np.quantile(low_v, 0.92)) if low_v.size else 1.0
    shake_times = _pick_peaks(low_t, low_v, shake_cut, gap=1.1)
    # The door slam is the measured sub-bass attack, not a later sustain peak.
    if not any(abs(t - door_slam) < 0.08 for t in shake_times):
        shake_times.append(door_slam)
        shake_times.sort()

    pulse_times = []
    for t, strength in zip(onset_times, onset_strengths):
        if strength < pulse_cut or strength >= loud_cut:
            continue
        if any(abs(t - f) < 0.2 for f in flash_times):
            continue
        if pulse_times and t - pulse_times[-1] < 0.38:
            continue
        pulse_times.append(float(t))

    return {
        "flashes": [{"time": t, "type": "flash"} for t in flash_times],
        "shakes": [{"time": t, "type": "shake"} for t in shake_times],
        "pulses": [{"time": t, "type": "pulse"} for t in pulse_times],
        "door_slam": door_slam,
        "sections": sections,
        "beat_count": len(beats),
        "onset_count": len(onset_times),
    }


def flash_rate(cues: dict, start: float, end: float) -> float:
    n = sum(1 for item in cues["flashes"] if start <= item["time"] < end)
    span = max(1e-3, end - start)
    return n / span


def measure_timeline_cues(song_path: Path, audio_json_path: Path, lyrics_json_path: Path) -> dict:
    audio = json.loads(Path(audio_json_path).read_text())
    duration = float(audio.get("duration") or 367.2)
    y, sr = load_mono_segment(song_path, 0.0, duration, sr=22050)
    measured = onset_and_lowband(y, sr, 0.0)
    beats = [float(b["time"] if isinstance(b, dict) else b) for b in audio["beats"]]
    door = measure_cues(song_path, audio_json_path, lyrics_json_path, t0=187.0, t1=192.0)
    cues = select_cues(
        measured["onset_times"],
        measured["onset_strengths"],
        measured["low_times"],
        measured["low_rms"],
        beats,
        _sections(audio),
        door_slam=float(door["slam"]["time"]),
    )
    cues["door"] = {"flash": door["flash"], "slam": door["slam"], "pulses": door["pulses"]}
    return cues
