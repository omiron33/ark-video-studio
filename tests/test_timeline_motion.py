"""Dissolves keep the timeline length. Water flow is not a rigid slide."""

import numpy as np

from arkpipe.camera import CameraPose
from arkpipe.composite import RainField, layer_affine, sample_corners_inside
from render_timeline import DISSOLVE_FRAMES, HEIGHT, WIDTH, blend_dissolve, calm, flow_water, load_shots, water_mask


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


def test_overscan_keeps_shake_off_the_plate_edge():
    plate_w, plate_h = 2304, 1296
    poses = [
        CameraPose(0, 0.0, 0.012, 8.0, 3.0, 0.18, 22.0, 6.2, 0.16),
        CameraPose(0, 190.46, 0.010, 10.5, 4.2, 0.30, 34.0, 12.0, 0.31),
    ]
    for pose in poses:
        for parallax in (0.08, 0.54, 1.0):
            matrix = layer_affine(pose, parallax, plate_w, plate_h, WIDTH, HEIGHT)
            assert sample_corners_inside(matrix, plate_w, plate_h, WIDTH, HEIGHT)


def test_no_rain_draws_nothing():
    rain = RainField(32, 48, seed=3, density=0.0)
    assert rain.far(1.2).sum() == 0
    assert rain.near(1.2).sum() == 0
    assert rain.splashes(0.05).sum() == 0
