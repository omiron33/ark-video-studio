"""Measure flash, slam, pulse, and lyric cues from the song.

Times come from the beat grid, an onset envelope, and low-band energy.
GOAL.md lyric times are recorded only so disagreements stay visible.
"""

from __future__ import annotations

import json
import math
import shutil
import subprocess
from pathlib import Path

import librosa
import numpy as np
from scipy import signal

# GOAL.md lists these pulse centers. A measured onset may replace one
# only when it lands inside 0.20 s, and the cue record keeps both times.
LISTED_PULSE_TIMES = (187.6, 188.0, 188.25, 188.8, 189.08, 189.36, 191.57)

# GOAL.md word starts for "Then the Lord shut them in". Not ground truth.
# lyrics.json is the alignment measurement. "in" is given as 190.46 to 191.8.
GOAL_WORD_TIMES = (
    ("Then", 188.02, None),
    ("the", 189.02, None),
    ("Lord", 189.54, None),
    ("shut", 189.80, None),
    ("them", 190.18, None),
    ("in", 190.46, 191.8),
)

LYRIC_LINE = "Then the Lord shut them in"


def load_mono_segment(song_path: Path, t0: float, t1: float, sr: int = 22050) -> tuple[np.ndarray, int]:
    """Decode [t0, t1) to mono float32. ffmpeg is more reliable than mp3 readers."""
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        y, file_sr = librosa.load(str(song_path), sr=sr, offset=t0, duration=t1 - t0, mono=True)
        return np.asarray(y, dtype=np.float32), sr
    cmd = [
        ffmpeg,
        "-v",
        "error",
        "-ss",
        f"{t0:.6f}",
        "-t",
        f"{t1 - t0:.6f}",
        "-i",
        str(song_path),
        "-ac",
        "1",
        "-ar",
        str(sr),
        "-f",
        "f32le",
        "-",
    ]
    raw = subprocess.check_output(cmd)
    y = np.frombuffer(raw, dtype=np.float32).copy()
    if y.size == 0:
        raise RuntimeError(f"no audio decoded from {song_path} {t0}-{t1}")
    return y, sr


def onset_and_lowband(y: np.ndarray, sr: int, t0: float) -> dict:
    """Librosa onset times plus a sub-bass energy envelope."""
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onset_frames = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, units="frames")
    onset_times = (librosa.frames_to_time(onset_frames, sr=sr) + t0).astype(float)
    onset_strengths = onset_env[np.clip(onset_frames, 0, len(onset_env) - 1)].astype(float)

    sos = signal.butter(4, 90.0, btype="low", fs=sr, output="sos")
    low = signal.sosfilt(sos, y)
    hop = 256
    win = 1024
    rms = []
    times = []
    for i in range(0, max(1, len(low) - win), hop):
        chunk = low[i : i + win]
        rms.append(float(np.sqrt(np.mean(chunk * chunk) + 1e-12)))
        times.append(t0 + (i + win / 2) / sr)
    return {
        "onset_times": [float(t) for t in onset_times],
        "onset_strengths": [float(s) for s in onset_strengths],
        "low_times": times,
        "low_rms": rms,
    }


def _nearest(times: list[float], target: float) -> tuple[float, float]:
    if not times:
        return target, math.inf
    best = min(times, key=lambda t: abs(t - target))
    return float(best), abs(best - target)


def _beats_in(audio: dict, t0: float, t1: float) -> list[float]:
    beats = []
    for b in audio["beats"]:
        t = float(b["time"] if isinstance(b, dict) else b)
        if t0 - 0.05 <= t <= t1 + 0.05:
            beats.append(t)
    return beats


def _lyric_line(lyrics: dict) -> dict:
    for section in lyrics["sections"]:
        for line in section.get("lines") or []:
            text = line.get("text", "")
            if text.lower().startswith(LYRIC_LINE.lower()):
                return line
    raise KeyError(f"lyrics.json has no line starting with {LYRIC_LINE!r}")


def _word_key(word: str) -> str:
    return word.strip().strip(".,!?;:\"'").lower()


def measure_cues(
    song_path: str | Path,
    audio_json_path: str | Path,
    lyrics_json_path: str | Path,
    t0: float = 187.0,
    t1: float = 192.0,
) -> dict:
    """Build the cue list for one shot from the audio files, not from GOAL.md alone."""
    song_path = Path(song_path)
    audio = json.loads(Path(audio_json_path).read_text())
    lyrics = json.loads(Path(lyrics_json_path).read_text())

    y, sr = load_mono_segment(song_path, t0, t1)
    measured = onset_and_lowband(y, sr, t0)
    beats = _beats_in(audio, t0, t1)
    disagreements: list[str] = []

    flash_target = 187.13
    flash_beat, flash_dist = _nearest(beats, flash_target)
    if not (187.10 <= flash_beat <= 187.20):
        raise RuntimeError(f"beat nearest {flash_target} is {flash_beat}, outside the flash window")
    flash_onset, flash_onset_dist = _nearest(measured["onset_times"], flash_beat)
    flash_strength = 0.0
    if measured["onset_times"]:
        idx = int(np.argmin([abs(t - flash_beat) for t in measured["onset_times"]]))
        if abs(measured["onset_times"][idx] - flash_beat) <= 0.08:
            flash_strength = measured["onset_strengths"][idx]
    if flash_onset_dist > 0.08:
        disagreements.append(
            f"Beat grid downbeat at {flash_beat:.3f} has no onset within 0.08 s "
            f"(nearest onset {flash_onset:.3f}, {flash_onset_dist:.3f} s away). "
            "The flash stays on the beat grid."
        )

    slam_target = 190.46
    window = [
        (t, e)
        for t, e in zip(measured["low_times"], measured["low_rms"])
        if 190.30 <= t <= 190.70
    ]
    if not window:
        raise RuntimeError("low-band envelope has no samples in 190.30 to 190.70")
    low_peak_t, low_peak_e = max(window, key=lambda pair: pair[1])
    # The bass note sustains, so the RMS maximum lags the hit. The attack is
    # the first rise through 40% of that peak after the band has been quiet.
    attack_t = None
    was_quiet = False
    for t, e in window:
        if e < low_peak_e * 0.12:
            was_quiet = True
        if was_quiet and e >= low_peak_e * 0.40 and attack_t is None:
            attack_t = float(t)
    slam_beat, _slam_beat_dist = _nearest(beats, slam_target)
    if attack_t is not None and 190.40 <= attack_t <= 190.55:
        slam_time = attack_t
        slam_source = "low-band attack"
    elif 190.40 <= slam_beat <= 190.55:
        slam_time = float(slam_beat)
        slam_source = "beat grid"
    else:
        raise RuntimeError(f"no slam in window: attack {attack_t} beat {slam_beat}")
    if abs(low_peak_t - slam_time) > 0.05:
        disagreements.append(
            f"Low-band RMS maximum is {low_peak_t:.3f} because the sub-bass note sustains. "
            f"The attack is {slam_time:.3f} ({slam_source}), next to beat grid {slam_beat:.3f}. "
            "The slam uses the attack, not the later sustain peak."
        )
    if abs(slam_time - slam_beat) > 0.05:
        disagreements.append(
            f"Low-band attack {slam_time:.3f} and beat grid {slam_beat:.3f} differ by more than 0.05 s."
        )

    pulses = []
    for listed in LISTED_PULSE_TIMES:
        onset_t, onset_dist = _nearest(measured["onset_times"], listed)
        beat_t, beat_dist = _nearest(beats, listed)
        # Snap to a measured onset inside 0.20 s. Otherwise keep the listed time.
        if onset_dist <= 0.20:
            use = onset_t
            shifted = abs(use - listed) > 0.03
            source = "onset"
        elif beat_dist <= 0.20:
            use = beat_t
            shifted = abs(use - listed) > 0.03
            source = "beat"
        else:
            use = float(listed)
            shifted = False
            source = "listed"
            disagreements.append(
                f"Pulse listed at {listed:.2f} has no onset or beat within 0.20 s "
                f"(nearest onset {onset_t:.3f}). Kept the listed time."
            )
        if shifted:
            disagreements.append(
                f"Pulse listed at {listed:.2f} moved to {use:.3f} ({source}, {abs(use - listed):.3f} s)."
            )
        pulses.append(
            {
                "type": "pulse",
                "listed": float(listed),
                "time": float(use),
                "source": source,
                "shifted": bool(shifted),
                "onset_distance": None if onset_dist is math.inf else float(onset_dist),
            }
        )

    line = _lyric_line(lyrics)
    by_word = {}
    for word in line["words"]:
        by_word.setdefault(_word_key(word["word"]), word)
    lyric_cues = []
    for goal_word, goal_start, goal_end in GOAL_WORD_TIMES:
        src = by_word[goal_word.lower()]
        chosen = float(src["start"])
        entry = {
            "word": src["word"],
            "key": goal_word.lower(),
            "time": chosen,
            "end": float(src["end"]),
            "lyrics_json_start": float(src["start"]),
            "lyrics_json_end": float(src["end"]),
            "aligned": bool(src.get("aligned", False)),
            "goal_md": float(goal_start),
            "goal_md_end": None if goal_end is None else float(goal_end),
        }
        note = (
            f"lyrics.json measures {entry['word']} at {chosen:.2f} "
            f"(aligned {str(entry['aligned']).lower()}). "
            f"GOAL.md says {goal_start:.2f}."
        )
        if abs(chosen - goal_start) > 0.05:
            disagreements.append(
                f"GOAL.md places {goal_word} at {goal_start:.2f}. "
                f"lyrics.json places {src['word']} at {chosen:.2f} to {float(src['end']):.2f} "
                f"with aligned {str(bool(src.get('aligned'))).lower()}. "
                "The cue list uses the lyrics.json time, not the GOAL.md time."
            )
        if goal_end is not None and abs(float(src["end"]) - goal_end) > 0.05:
            disagreements.append(
                f"GOAL.md ends {goal_word} at {goal_end:.2f}. "
                f"lyrics.json ends {src['word']} at {float(src['end']):.2f}."
            )
        entry["note"] = note
        lyric_cues.append(entry)

    # The slam is the sub-bass hit, even when a lyric word sits nearby.
    in_word = next(w for w in lyric_cues if _word_key(w["word"]) == "in")
    disagreements.append(
        f"Door slam stays on the {slam_source} at {slam_time:.3f} "
        f"(beat grid {slam_beat:.3f}, low-band peak {low_peak_t:.3f}, energy {low_peak_e:.5f}). "
        f"lyrics.json places in. at {in_word['lyrics_json_start']:.2f} to {in_word['lyrics_json_end']:.2f} "
        f"with aligned {str(in_word['aligned']).lower()}. "
        "The slam follows the musical hit, not the word in."
    )

    return {
        "time_in": t0,
        "time_out": t1,
        "flash": {
            "type": "flash",
            "time": float(flash_beat),
            "target": flash_target,
            "beat_grid": float(flash_beat),
            "nearest_onset": float(flash_onset),
            "onset_distance": float(flash_onset_dist),
            "onset_strength": float(flash_strength),
            "source": "beat grid downbeat nearest 187.13",
        },
        "slam": {
            "type": "slam",
            "time": float(slam_time),
            "target": slam_target,
            "beat_grid": float(slam_beat),
            "low_band_peak": float(low_peak_t),
            "low_band_energy": float(low_peak_e),
            "source": slam_source,
        },
        "pulses": pulses,
        "lyrics": lyric_cues,
        "onset_times": measured["onset_times"],
        "disagreements": disagreements,
    }


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    story = root.parent
    cues = measure_cues(story / "song.mp3", story / "audio.json", story / "lyrics.json")
    out = root / "shots" / "ark_door_187.cues.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(cues, indent=2) + "\n")
    print(f"wrote {out}")
    print(f"flash {cues['flash']['time']:.3f} slam {cues['slam']['time']:.3f}")
    for line in cues["disagreements"]:
        print(line)


if __name__ == "__main__":
    main()
