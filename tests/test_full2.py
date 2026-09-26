"""The 72-shot film uses the shipped span, word, and config functions."""

from arkpipe.full2fx import (
    SONG_END,
    active_layer_names,
    build_fx,
    classify_move,
    load_all_shots,
    load_bars,
    load_fx,
    segment_frames,
    treatment_name,
    word_spec,
    word_visible,
    word_window,
)


def test_seventy_two_spans_cover_the_song():
    shots = load_all_shots()
    assert len(shots) == 72
    assert [shot["id"] for shot in shots] == [f"s{i:02d}" for i in range(1, 73)]
    assert float(shots[0]["in"]) == 0.0
    assert float(shots[-1]["out"]) == SONG_END
    spans = segment_frames(shots)
    assert len(spans) == 72
    total = spans[-1][1] - spans[0][0]
    assert abs(total - SONG_END * 24) <= 1
    for shot, (start, stop) in zip(shots, spans):
        expect = (float(shot["out"]) - float(shot["in"])) * 24
        assert abs((stop - start) - expect) <= 1.0


def test_words_hold_from_the_real_shotlist():
    shots = load_all_shots()
    early = word_spec(shots, "Then")
    assert early["shot_id"] == "s02"
    assert word_visible(early["start"] - 0.05, early) is False
    assert word_visible(early["start"], early) is True
    assert word_visible(early["start"] + 1 / 24, early) is True
    assert word_visible(early["hold_until"] - 1 / 24, early) is True
    later_shot = next(shot for shot in shots if shot["id"] > "s04" and shot.get("words"))
    later = word_window(later_shot, 0)
    assert later["shot_id"] > "s04"
    assert word_visible(later["start"] - 0.05, later) is False
    assert word_visible(later["start"] + 1 / 24, later) is True
    assert word_visible(later["hold_until"] - 1 / 24, later) is True


def test_every_shot_has_a_move_layers_and_its_own_neighbor():
    shots = load_all_shots()
    config = build_fx(shots, {key: load_fx()[key] for key in ("s01", "s02", "s03", "s04")})
    assert len(config) == 72
    names = []
    for shot in shots:
        spec = config[shot["id"]]
        assert spec["camera"]["move"] in {"push", "slide", "crane", "tilt"}
        assert classify_move(shot["camera"]) == spec["camera"]["move"] or shot["id"] in {"s01", "s02", "s03", "s04"}
        assert active_layer_names(shot["id"], config)
        names.append(treatment_name(shot["id"], config))
    assert any(names[i] != names[i + 1] for i in range(len(names) - 1))
    bars = load_bars()
    assert any(0.0 <= bar <= SONG_END for bar in bars)
