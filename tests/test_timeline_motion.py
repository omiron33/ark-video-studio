"""Dissolves keep the timeline length. Water flow is not a rigid slide."""

import numpy as np

from arkpipe.composite import RainField
from render_timeline import DISSOLVE_FRAMES, blend_dissolve, calm, flow_water, load_shots, water_mask


def test_dissolve_is_short_and_keeps_every_frame():
    assert 6 <= DISSOLVE_FRAMES <= 12
    outgoing = np.zeros((DISSOLVE_FRAMES, 4, 4, 3), np.uint8)
    incoming = np.full((DISSOLVE_FRAMES, 4, 4, 3), 200, np.uint8)
    mixed = [blend_dissolve(incoming[i], outgoing[i], i, DISSOLVE_FRAMES) for i in range(DISSOLVE_FRAMES)]
    assert len(mixed) == DISSOLVE_FRAMES
    assert float(mixed[0].mean()) < 5
    assert float(mixed[-1].mean()) > 190
    assert float(mixed[DISSOLVE_FRAMES // 2].mean()) > 40


def test_calm_pairs_are_the_dissolve_joins():
    shots = load_shots()
    assert len(shots) == 36
    by_id = {shot["id"]: shot for shot in shots}
    assert calm(by_id["s02"]["effects"])
    assert not calm(by_id["s21"]["effects"])
    dissolves = 0
    prev = None
    for shot in shots:
        if prev is not None and calm(prev["effects"]) and calm(shot["effects"]):
            dissolves += 1
        prev = shot
    assert dissolves >= 8


def test_water_flow_shears_instead_of_sliding():
    h, w = 80, 120
    rgb = np.zeros((h, w, 3), np.uint8)
    rgb[:, 40:42] = 255
    mask = np.zeros((h, w), np.float32)
    mask[20:] = 1.0
    out = flow_water(rgb, mask, t=0.4, speed=1.5)
    cols = [int(np.argmax(out[y, :, 0])) for y in (30, 50, 70)]
    assert max(cols) - min(cols) >= 2
    # Above the mask the line stays put.
    assert int(np.argmax(out[2, :, 0])) == 40


def test_brown_flood_is_water_and_the_sky_is_not():
    plate = np.zeros((40, 60, 3), np.uint8)
    plate[25:, :] = (90, 60, 30)
    depth = np.full((40, 60), 0.8, np.float32)
    mask = water_mask(plate, depth)
    assert float(mask[32].mean()) > 0.3
    assert float(mask[2].mean()) < 0.05


def test_no_rain_draws_nothing():
    rain = RainField(32, 48, seed=3, density=0.0)
    assert rain.far(1.2).sum() == 0
    assert rain.near(1.2).sum() == 0
    assert rain.splashes(0.05).sum() == 0
