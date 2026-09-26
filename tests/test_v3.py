"""v3 sentences and localized light, driven by the shipped functions."""

import numpy as np

from arkpipe.full2fx import load_bars, load_beats, load_lyric_lines
from arkpipe.v3type import FX_NAMES, FONTS, HOLD_MOTIONS, build_sentences_v3, motion_v3
from render_preview import find_light_sources, motivated_light
from render_v3 import glyph_sprite, solid_mask


def test_v3_sentences_hold_through_gaps_and_split_on_periods():
    lines = load_lyric_lines()
    bars = load_bars()
    beats = load_beats()
    sentences = build_sentences_v3(lines, bars, beats)
    texts = [sent["text"] for sent in sentences]
    assert not any(text.strip().lower() == "noah was" for text in texts)
    gap = [
        sent
        for sent in sentences
        if "six hundred years old" in sent["text"].lower() and "waters came" in sent["text"].lower()
    ]
    assert len(gap) == 1
    assert "when the waters" in gap[0]["text"]
    assert "When the waters" not in gap[0]["text"]
    assert gap[0]["start"] < 100 < gap[0]["last_end"]
    made = [sent for sent in sentences if sent["text"].lower().rstrip(".").endswith("that i have made")]
    did = [sent for sent in sentences if sent["text"].lower().startswith("and noah did")]
    assert len(made) == 1 and len(did) == 1
    assert made[0]["end"] <= did[0]["start"] + 1e-9
    fonts = {sent["font"] for sent in sentences}
    assert len(fonts) >= 5
    assert fonts <= set(FONTS)
    moving = [sent for sent in sentences if sent["hold_motion"] != "still"]
    assert 0.33 <= len(moving) / len(sentences) <= 0.50
    assert set(sent["hold_motion"] for sent in moving) <= set(HOLD_MOTIONS)
    assert sum(1 for sent in sentences if sent["fx"] == "glitch") >= 3
    assert set(FX_NAMES) <= {sent["fx"] for sent in sentences}
    powerful_size = max(sent["size"] for sent in sentences if sent["fx"] == "glitch")
    quiet_size = min(sent["size"] for sent in sentences if sent["fx"] == "ink")
    assert powerful_size > quiet_size
    layouts = {sent["layout"] for sent in sentences}
    assert "center" in layouts and len(layouts) >= 4
    assert any(sent["depth"] <= 0.5 for sent in sentences)
    marked = [sent for sent in sentences if "lord" in sent["text"].lower()]
    assert marked and all("lord" in sent["emphasis"] for sent in marked)
    for index, sent in enumerate(sentences):
        assert len(sent["lines"]) <= 3
        assert sent["lines"]
        assert "\u2014" not in sent["text"]
        assert sent["end"] >= sent["last_end"] - 1e-9
        if index:
            prev = sentences[index - 1]
            assert sent["start"] >= prev["end"] - 1e-9
            assert (sent["font"], sent["layout"], sent["entrance"]) != (prev["font"], prev["layout"], prev["entrance"])
        for hit in sent["hit_times"]:
            assert sent["start"] - 1e-6 <= hit <= sent["last_end"] + 1e-6
            assert any(abs(hit - item) < 1e-6 for item in list(beats) + list(bars))
        if sent["last_end"] - sent["start"] >= 1.2:
            assert sent["hit_times"]
        assert "font" in sent and "anchor" in sent and "fx" in sent and "hold_motion" in sent
    drift = next(sent for sent in sentences if sent["hold_motion"] == "drift")
    early = motion_v3(drift, drift["start"] + 1.0)
    later = motion_v3(drift, drift["start"] + 2.0)
    assert early["reveal"] == 1.0
    assert abs(later["dx"] - early["dx"]) <= 12.0
    assert not any(motion_v3(sent, 2.0)["alpha"] > 0 for sent in sentences)
    clauses = [
        "Then the Lord said to Noah,",
        "Come into the ark, you and all your household,",
        "For I have seen you walking rightly before Me in this generation.",
    ]
    positions = [texts.index(clause) for clause in clauses]
    assert positions == sorted(positions)
    for sent in sentences:
        assert len(sent["lines"]) <= 2
        assert len(sent["emphasis"]) <= 3
        assert len(sent["text"]) <= 78
        assert motion_v3(sent, sent["start"] - 0.35)["alpha"] == 0.0
        if len(sent["text"].split()) > 4:
            assert sent["end"] - sent["start"] >= 1.45


def test_beat_does_not_paint_a_full_width_centre_strip():
    height, width = 180, 320
    base = np.full((height, width, 3), 0.2, np.float32)
    beats = [1.0]
    flat = motivated_light(base.copy(), 1.0, beats, sources=[], bolts=False)
    assert np.max(np.abs(flat - base)) < 0.02
    bolted = motivated_light(base.copy(), 1.0, beats, sources=[], bolts=True)
    delta = bolted - base
    band = delta[int(height * 0.38) : int(height * 0.52)]
    lifted = (band.mean(axis=(0, 2)) > 0.04).mean()
    assert lifted < 0.75


def test_warm_source_and_storm_stay_local_and_depth_masked():
    height, width = 160, 240
    base = np.full((height, width, 3), 0.15, np.float32)
    depth = np.full((height, width), 0.3, np.float32)
    depth[:, 70:100] = 0.95
    source = [{"x": 40, "y": 36, "kind": "warm", "depth": 0.3}]
    lit = motivated_light(base.copy(), 0.5, [], sources=source, depth=depth, bolts=False)
    delta = lit - base
    near = delta[20:52, 20:60].mean()
    blocked = delta[20:52, 70:100].mean()
    far_corner = delta[120:150, 180:230].mean()
    assert near > blocked + 0.02
    assert near > far_corner + 0.02
    centre = delta[int(height * 0.38) : int(height * 0.52)]
    assert (centre.mean(axis=(0, 2)) > 0.04).mean() < 0.75
    sky = np.zeros((height, width), np.float32)
    sky[:40, 80:150] = 1.0
    storm = motivated_light(base.copy(), 0.2, [0.2], sources=[], sky=sky, bolts=False)
    storm_delta = storm - base
    assert storm_delta[:40, 90:140].mean() > storm_delta[100:150].mean() + 0.01
    band = storm_delta[int(height * 0.38) : int(height * 0.52)]
    assert (band.mean(axis=(0, 2)) > 0.04).mean() < 0.75


def test_me_apostrophe_and_quote_are_intact_in_each_face():
    for face in ("bebas", "cinzel", "cormorant", "archivo", "stencil", "dirt"):
        me = glyph_sprite(face, "Me", 90)
        ink = me[:, :, 3] > 40
        assert ink.any()
        height, width = ink.shape
        left = ink[:, : int(width * 0.55)]
        # The top of M is present, so Me is not a clipped "l\\e".
        assert left[: max(1, height // 3)].sum() > 8
        assert left[height // 3 :].sum() > 8
        quoted = glyph_sprite(face, "Noah's “For", 72)
        assert (quoted[:, :, 3] > 40).sum() > 30


def test_horizon_band_is_not_the_light_and_only_solid_depth_occludes():
    height, width = 180, 320
    image = np.full((height, width, 3), 0.08, np.float32)
    image[100:112, :, 0] = 0.95
    image[100:112, :, 1] = 0.4
    image[100:112, :, 2] = 0.12
    image[36:50, 28:44, 0] = 1.0
    image[36:50, 28:44, 1] = 0.35
    image[36:50, 28:44, 2] = 0.08
    sources = find_light_sources((image * 255).astype(np.uint8))
    assert sources
    assert all(item["y"] < 90 for item in sources)
    lit = motivated_light(image.copy(), 0.4, [0.4], sources=sources, bolts=False)
    horizon = (lit - image)[100:112].mean()
    lantern = (lit - image)[28:58, 16:56].mean()
    assert lantern > horizon + 0.02
    depth = np.full((48, 80), 0.2, np.float32)
    depth[:, 20:40] = 0.95
    sky = np.zeros_like(depth)
    sky[:, 20:30] = 0.95
    rgb = np.full((48, 80, 3), 0.15, np.float32)
    rgb[:, 30:40] = 0.9
    mask = solid_mask(depth, sky, rgb, 0.6)
    assert not mask[:, 20:40].any()
    rock_depth = np.full((48, 80), 0.2, np.float32)
    rock_depth[12:36, 8:24] = 0.95
    rock = solid_mask(rock_depth, np.zeros_like(rock_depth), np.full((48, 80, 3), 0.12, np.float32), 0.6)
    assert rock[12:36, 8:24].all()
