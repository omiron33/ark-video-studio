"""Depth split and backfill use the shipped functions on array fixtures."""

import numpy as np

from arkpipe.layers import inpaint_layer_backfill, split_depth_layers


def test_split_covers_frame_with_soft_edges():
    width = 96
    depth = np.tile(np.linspace(0.0, 1.0, width, dtype=np.float32), (48, 1))
    masks = split_depth_layers(depth, n_layers=4, feather_px=2.5)
    assert len(masks) == 4
    total = np.sum(masks, axis=0)
    assert np.allclose(total, 1.0, atol=1e-3)
    soft = np.zeros(depth.shape, dtype=bool)
    for mask in masks:
        assert mask.dtype == np.float32
        soft |= (mask > 0.05) & (mask < 0.95)
    assert soft.any()

    masks3 = split_depth_layers(depth, n_layers=3, feather_px=2.0)
    assert len(masks3) == 3
    assert np.allclose(np.sum(masks3, axis=0), 1.0, atol=1e-3)


def test_backfill_paints_under_nearer_layer():
    h, w = 48, 64
    depth = np.zeros((h, w), np.float32)
    depth[:, w // 2 :] = 1.0
    masks = split_depth_layers(depth, n_layers=3, feather_px=1.5)
    rgb = np.zeros((h, w, 3), np.uint8)
    rgb[:, : w // 2] = (200, 20, 20)
    rgb[:, w // 2 :] = (10, 10, 180)
    plates = inpaint_layer_backfill(rgb, masks, reveal_px=8, radius=4)
    far = plates[0]
    # A column just inside the nearer half is occluded. Backfill should
    # replace the blue occluder color with the red from the visible side.
    sample = far[:, w // 2 + 2].astype(np.int16)
    assert sample[:, 0].mean() > sample[:, 2].mean()
    assert sample[:, 0].mean() > 40
