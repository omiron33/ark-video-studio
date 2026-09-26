"""Cue measurement must read the real song, beat grid, and lyrics."""

import json
from pathlib import Path

from arkpipe.cues import LISTED_PULSE_TIMES, measure_cues

ROOT = Path(__file__).resolve().parents[1]
STORY = ROOT.parent


def test_measure_cues_from_song_and_lyrics():
    cues = measure_cues(
        STORY / "song.mp3",
        STORY / "audio.json",
        STORY / "lyrics.json",
        t0=187.0,
        t1=192.0,
    )
    assert cues["onset_times"], "onset analysis returned no onsets"
    assert 187.10 <= cues["flash"]["time"] <= 187.20
    assert cues["flash"]["beat_grid"] == cues["flash"]["time"]
    assert 190.40 <= cues["slam"]["time"] <= 190.55
    assert "low_band_peak" in cues["slam"]
    assert 190.30 <= cues["slam"]["low_band_peak"] <= 190.70

    pulse_times = [p["time"] for p in cues["pulses"]]
    assert len(pulse_times) == len(LISTED_PULSE_TIMES)
    for listed, pulse in zip(LISTED_PULSE_TIMES, cues["pulses"]):
        assert abs(pulse["time"] - listed) <= 0.20 or pulse["shifted"]

    lyrics = json.loads((STORY / "lyrics.json").read_text())
    line = next(
        line
        for section in lyrics["sections"]
        for line in section.get("lines") or []
        if line["text"].lower().startswith("then the lord shut them in")
    )
    file_words = {w["word"].strip(".,").lower(): w for w in line["words"]}
    got = {w["key"]: w for w in cues["lyrics"]}
    for key in ("then", "the", "lord", "shut", "them", "in"):
        assert got[key]["aligned"] == file_words[key]["aligned"]
        assert got[key]["lyrics_json_start"] == file_words[key]["start"]
        assert "goal_md" in got[key]
        assert "GOAL.md" in got[key]["note"]
        assert "lyrics.json" in got[key]["note"]
        if file_words[key]["aligned"]:
            assert got[key]["time"] == file_words[key]["start"]
            assert got[key]["time_source"] == "lyrics.json"
        else:
            assert got[key]["time"] == got[key]["goal_md"]
            assert got[key]["time_source"] == "GOAL.md"
    assert file_words["then"]["start"] == 188.5
    assert file_words["then"]["aligned"] is False
    assert got["then"]["goal_md"] == 188.02
    assert got["then"]["time"] == 188.02
    assert got["the"]["time"] == 189.02
    assert got["lord"]["time"] == 189.54
    assert got["them"]["time"] == 190.18
    assert got["in"]["time"] == 190.46
    assert file_words["shut"]["aligned"] is True
    assert got["shut"]["time"] == file_words["shut"]["start"]
    joined = " ".join(cues["disagreements"])
    assert "188.02" in joined and "188.5" in joined
    assert "interpolated" in joined
    assert "slam" in joined.lower() or "Slam" in joined or "Door slam" in joined
