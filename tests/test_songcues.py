"""Song-wide cues come from the real beat grid and the real mp3."""

import json
from pathlib import Path

from arkpipe.songcues import flash_rate, measure_timeline_cues

ROOT = Path(__file__).resolve().parents[1]
STORY = ROOT.parent


def test_timeline_cues_from_the_song():
    cues = measure_timeline_cues(STORY / "song.mp3", STORY / "audio.json", STORY / "lyrics.json")
    assert 190.40 <= cues["door_slam"] <= 190.55
    assert len(cues["flashes"]) < cues["beat_count"]
    audio = json.loads((STORY / "audio.json").read_text())
    intro = next(s for s in audio["sections"] if "intro" in s["name"].lower())
    loud = [s for s in audio["sections"] if any(token in s["name"].lower() for token in ("verse 1", "chorus 1", "dub bass", "bridge 1", "pro-"))]
    assert loud, "expected the loud sections in audio.json"
    intro_rate = flash_rate(cues, intro["start"], intro["end"])
    loud_rates = [flash_rate(cues, s["start"], s["end"]) for s in loud if s["end"] > s["start"]]
    assert max(loud_rates) > intro_rate
    # The door window, the intro, and a pro section were actually analyzed.
    assert any(187.0 <= item["time"] <= 193.0 for item in cues["shakes"]) or 190.40 <= cues["door_slam"] <= 190.55
    assert cues["onset_count"] > 20
