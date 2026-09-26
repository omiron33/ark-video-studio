"""Seam stays lit after the slam, and the figure warp is small but real."""

import numpy as np

from arkpipe.door import seam_level, seam_mask
from arkpipe.figure import apply_figure_life, figure_displacement


def test_seam_stays_above_a_floor_after_slam():
    opening = np.zeros((120, 90), np.float32)
    opening[15:100, 40:58] = 1.0
    slam = 190.46
    at_slam = seam_mask(opening, slam, slam)
    at_end = seam_mask(opening, 192.9, slam)
    assert seam_level(slam, slam) > 0.5
    assert seam_level(192.9, slam) == seam_level(slam + 0.2, slam)
    assert at_slam.max() > 0.5
    assert at_end.max() > 0.5
    assert abs(at_end.max() - at_slam.max()) < 1e-5
    assert seam_level(187.0, slam) == 0.0


def test_figure_warp_moves_a_little():
    h, w = 90, 48
    rgb = np.zeros((h, w, 3), np.uint8)
    rgb[12:78, 18:30] = (48, 36, 28)
    mask = np.zeros((h, w), np.float32)
    mask[12:78, 14:34] = 1.0
    a = apply_figure_life(rgb, mask, t=0.0, amp=3.0)
    b = apply_figure_life(rgb, mask, t=1.4, amp=3.0)
    moved = np.abs(a.astype(np.int16) - b.astype(np.int16)).sum()
    assert moved > 0
    dx0, dy0 = figure_displacement(h, w, 0.0, amp=3.0)
    dx1, dy1 = figure_displacement(h, w, 1.4, amp=3.0)
    assert abs(dx0[0, 0] - dx1[0, 0]) > 0.4
    assert abs(float(dx0[0].max())) < 4.0
    assert abs(float(dx0[-1].max())) < 0.4
    # Outside the mask the source pixels stay put.
    assert np.array_equal(a[0, 0], rgb[0, 0])
    assert np.array_equal(b[0, 0], rgb[0, 0])
