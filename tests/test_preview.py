"""Preview timing, type, and camera call the shipped full2 functions."""

import numpy as np

from arkpipe.full2fx import (
    LAYER_NAMES,
    camera_at,
    cut_frames,
    downbeat_kick,
    hero_raster,
    load_bars,
    load_fx,
    load_preview_shots,
    move_stays_inside,
    resolve_shot,
    shot_frame_span,
    treatment_name,
    verse_lines,
    word_spec,
    word_visible,
)

WORDS = {
    "Then": 10.00,
    "the": 11.00,
    "Lord": 12.01,
    "said": 13.01,
    "to": 20.37,
    "Noah": 20.87,
}

VERSES = {
    "s01": ("Genesis 7:4", "For yet seven days, and I will cause it to rain upon the earth"),
    "s02": ("Genesis 7:4", "every living substance that I have made will I destroy"),
    "s03": ("Genesis 7:1", "And the LORD said unto Noah"),
    "s04": ("Genesis 7:1", "for thee have I seen righteous before me"),
}


def _glyph(raster: np.ndarray, thresh: int = 40) -> np.ndarray:
    return raster[raster[:, :, 3] > thresh][:, :3]


def test_cuts_land_on_the_shot_boundaries():
    cuts = (0.0, 6.084, 10.588, 17.369, 24.102)
    frames = cut_frames()
    assert frames == [int(round(t * 24)) for t in cuts]
    spans = shot_frame_span(load_preview_shots())
    assert [start for start, _stop in spans] == frames[:-1]
    assert spans[-1][1] / 24 >= 24.102 - 1e-6


def test_words_turn_on_within_a_frame_and_hold():
    shots = load_preview_shots()
    for name, start in WORDS.items():
        spec = word_spec(shots, name)
        assert abs(spec["start"] - start) < 1e-6
        assert word_visible(start - 0.05, spec) is False
        assert word_visible(start, spec) is True
        assert word_visible(start + 1 / 24, spec) is True
        assert word_visible(spec["hold_until"] - 1 / 24, spec) is True
        assert word_visible(spec["hold_until"], spec) is False


def test_lightning_hero_is_white_then_teal():
    white0 = hero_raster("lightning_flash", 0, "Then")
    white1 = hero_raster("lightning_flash", 1, "Then")
    teal_early = hero_raster("lightning_flash", 2, "Then")
    teal_late = hero_raster("lightning_flash", 8, "Then")
    before = hero_raster("lightning_flash", -1, "Then")
    assert _glyph(before).size == 0
    for raster in (white0, white1):
        glyphs = _glyph(raster, 200)
        assert len(glyphs) > 20
        assert np.all(glyphs == 255)
    early = _glyph(teal_early, 40).astype(np.float32)
    late = _glyph(teal_late, 20).astype(np.float32)
    assert early[:, 2].mean() > early[:, 0].mean() + 40
    assert late.mean() < early.mean()


def test_treatments_and_verses_differ():
    config = load_fx()
    names = [treatment_name(shot_id, config) for shot_id in ("s01", "s02", "s03", "s04")]
    assert names == ["condense_fog", "lightning_flash", "shaft_descend", "chisel_rock"]
    assert len(set(names)) == 4
    for shot_id, expected in VERSES.items():
        assert verse_lines(shot_id, config) == expected


def test_downbeat_changes_the_pose():
    shots = load_preview_shots()
    config = load_fx()
    bars = [b for b in load_bars() if 0.0 <= b <= 24.102]
    inside = [b for b in bars if any(float(s["in"]) <= b < float(s["out"]) for s in shots)]
    assert inside
    changed = False
    for bar in inside:
        shot = next(s for s in shots if float(s["in"]) <= bar < float(s["out"]))
        assert downbeat_kick(bar, bars) == 1.0
        assert downbeat_kick(bar - 1 / 24, bars) == 0.0
        on = camera_at(bar, shot, config, bars)
        off = camera_at(bar - 1 / 24, shot, config, bars)
        if on.shake_x > off.shake_x + 1.0:
            changed = True
    assert changed


def test_moves_stay_inside_the_overscan_plate():
    for move in ("push", "slide", "crane", "tilt"):
        assert move_stays_inside(move)


def test_config_layers_can_take_a_later_shot_id():
    shots = load_preview_shots()
    config = load_fx()
    names = set()
    for shot in shots:
        for layer in config[shot["id"]]["layers"]:
            names.add(layer["name"])
            assert isinstance(layer["params"], dict)
            assert layer["params"]
    for required in LAYER_NAMES:
        assert required in names
    extended = dict(config)
    extended["s05"] = config["s01"]
    assert resolve_shot("s05", extended)["camera"]["move"] == "push"
    assert "clouds" in {layer["name"] for layer in resolve_shot("s05", extended)["layers"]}
