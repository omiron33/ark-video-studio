"""Feathered depth layers and inpainted backfill.

Masks are soft and sum to 1. Farther plates are filled under nearer
occluders so a parallax shift does not open a hole.
"""

from __future__ import annotations

import cv2
import numpy as np


def split_depth_layers(
    depth: np.ndarray,
    n_layers: int = 4,
    feather_px: float = 3.0,
) -> list[np.ndarray]:
    """Split a closeness map into n_layers soft masks, far to near.

    depth is relative closeness (larger means closer). Values are ranked,
    so the absolute scale does not matter.
    """
    if n_layers < 3 or n_layers > 4:
        raise ValueError("this shot pipeline uses 3 or 4 depth layers")
    d = np.asarray(depth, dtype=np.float32)
    if d.ndim != 2:
        raise ValueError("depth must be HxW")
    flat = d.reshape(-1)
    # Rank so plateaus still separate. Quantile edges on the raw values
    # collapse when large regions share one depth.
    order = np.argsort(flat, kind="mergesort")
    rank = np.empty_like(order, dtype=np.float32)
    rank[order] = np.linspace(0.0, 1.0, flat.size, dtype=np.float32)
    ranked = rank.reshape(d.shape)

    edges = np.linspace(0.0, 1.0, n_layers + 1, dtype=np.float32)
    masks = []
    for i in range(n_layers):
        lo = float(edges[i])
        hi = float(edges[i + 1])
        mid = 0.5 * (lo + hi)
        half = max(0.5 * (hi - lo), 1e-4)
        # Overlap neighboring bands so the value-space edge is already soft.
        weight = np.clip(1.0 - np.abs(ranked - mid) / (half * 1.35), 0.0, 1.0)
        masks.append(weight.astype(np.float32))
    stack = np.stack(masks, axis=0)
    stack /= np.maximum(stack.sum(axis=0, keepdims=True), 1e-6)

    feathered = []
    sigma = float(feather_px)
    for i in range(n_layers):
        if sigma > 0.05:
            blurred = cv2.GaussianBlur(stack[i], (0, 0), sigmaX=sigma, sigmaY=sigma)
        else:
            blurred = stack[i]
        feathered.append(np.clip(blurred, 0.0, None))
    stack = np.stack(feathered, axis=0)
    stack /= np.maximum(stack.sum(axis=0, keepdims=True), 1e-6)
    return [stack[i] for i in range(n_layers)]


def _rim_mask(nearer: np.ndarray, reveal_px: int) -> np.ndarray:
    """Pixels covered by a nearer layer, within reveal_px of its boundary."""
    occ = (nearer > 0.45).astype(np.uint8)
    radius = max(1, int(reveal_px))
    k = radius * 2 + 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    eroded = cv2.erode(occ, kernel)
    rim = (occ == 1) & (eroded == 0)
    return (rim.astype(np.uint8) * 255)


def inpaint_layer_backfill(
    rgb: np.ndarray,
    masks: list[np.ndarray],
    reveal_px: int = 12,
    radius: int = 4,
) -> list[np.ndarray]:
    """RGB plate per layer. Nearer footprints are filled on the layers behind them.

    The nearest layer keeps the original image. Farther layers keep their own
    pixels and Telea-fill the rim that parallax can uncover.
    """
    src = np.asarray(rgb)
    if src.dtype != np.uint8:
        src = np.clip(src, 0, 255).astype(np.uint8)
    if src.ndim != 3 or src.shape[2] != 3:
        raise ValueError("rgb must be HxWx3")
    n = len(masks)
    plates: list[np.ndarray] = []
    h, w = src.shape[:2]
    # Large plates are filled at half resolution. Small fixtures stay native
    # so a unit test can see the fill a few pixels inside the occluder.
    down = 2 if max(h, w) >= 400 else 1
    for i in range(n):
        if i == n - 1:
            plates.append(src.copy())
            continue
        nearer = np.zeros((h, w), dtype=np.float32)
        for mask in masks[i + 1 :]:
            nearer = np.maximum(nearer, mask)
        hole = _rim_mask(nearer, reveal_px)
        if int(hole.max()) == 0:
            plates.append(src.copy())
            continue
        if down == 1:
            filled = cv2.inpaint(src, hole, radius, cv2.INPAINT_TELEA)
        else:
            small = cv2.resize(src, (w // down, h // down), interpolation=cv2.INTER_AREA)
            hole_s = cv2.resize(hole, (w // down, h // down), interpolation=cv2.INTER_NEAREST)
            filled_s = cv2.inpaint(small, hole_s, max(2, radius // down + 1), cv2.INPAINT_TELEA)
            filled = cv2.resize(filled_s, (w, h), interpolation=cv2.INTER_LINEAR)
        plate = src.copy()
        plate[hole > 0] = filled[hole > 0]
        plates.append(plate)
    return plates
