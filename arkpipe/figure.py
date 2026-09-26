"""Subtle life for small cloaked figures.

The warp is local to a mask. Feet stay put. The cloak sways a few pixels.
"""

from __future__ import annotations

import math

import cv2
import numpy as np


def figure_displacement(height: int, width: int, t: float, amp: float = 2.4, freq: float = 0.33) -> tuple[np.ndarray, np.ndarray]:
    """Pixel offsets. Larger toward the shoulders, near zero at the feet."""
    yy = np.linspace(0.0, 1.0, height, dtype=np.float32)
    # 0 at the feet (bottom), 1 at the hood.
    rise = (1.0 - yy) ** 1.15
    sway = math.sin(2.0 * math.pi * freq * t) * amp * rise
    breathe = math.sin(2.0 * math.pi * freq * 0.55 * t + 0.6) * (amp * 0.22) * np.sin(np.pi * yy)
    dx = np.broadcast_to(sway[:, None], (height, width)).astype(np.float32).copy()
    dy = np.broadcast_to(breathe[:, None], (height, width)).astype(np.float32).copy()
    xx = np.linspace(-1.0, 1.0, width, dtype=np.float32)
    dx += (math.sin(2.0 * math.pi * freq * t + 0.4) * amp * 0.15) * xx[None, :] * rise[:, None]
    return dx, dy


def apply_figure_life(rgb: np.ndarray, mask: np.ndarray, t: float, amp: float = 2.4) -> np.ndarray:
    """Return rgb with a small warp inside mask. Outside the mask is unchanged."""
    if mask is None or float(np.max(mask)) < 0.2:
        return rgb
    src = rgb
    as_float = src.dtype != np.uint8
    if as_float:
        src_u8 = np.clip(src * 255.0 + 0.5, 0, 255).astype(np.uint8)
    else:
        src_u8 = src
    m = mask.astype(np.float32)
    ys, xs = np.nonzero(m > 0.35)
    if len(xs) < 12:
        return rgb
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    pad = 4
    h, w = src_u8.shape[:2]
    y0, x0 = max(0, y0 - pad), max(0, x0 - pad)
    y1, x1 = min(h, y1 + pad), min(w, x1 + pad)
    crop = src_u8[y0:y1, x0:x1]
    local = m[y0:y1, x0:x1]
    ch, cw = crop.shape[:2]
    dx, dy = figure_displacement(ch, cw, t, amp=amp)
    grid_x, grid_y = np.meshgrid(np.arange(cw, dtype=np.float32), np.arange(ch, dtype=np.float32))
    map_x = grid_x - dx * local
    map_y = grid_y - dy * local
    warped = cv2.remap(crop, map_x, map_y, interpolation=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    soft = cv2.GaussianBlur(local, (0, 0), 1.2)[..., None]
    blended = (warped.astype(np.float32) * soft + crop.astype(np.float32) * (1.0 - soft)).astype(np.uint8)
    out = src_u8.copy()
    out[y0:y1, x0:x1] = blended
    if as_float:
        return out.astype(np.float32) / 255.0
    return out


def detect_figure_mask(rgb: np.ndarray) -> np.ndarray:
    """Small tall dark cloaks in the lower frame. Empty if none are found."""
    if rgb.dtype != np.uint8:
        u8 = np.clip(rgb * 255.0, 0, 255).astype(np.uint8)
    else:
        u8 = rgb
    h, w = u8.shape[:2]
    luma = (0.2126 * u8[:, :, 0] + 0.7152 * u8[:, :, 1] + 0.0722 * u8[:, :, 2]).astype(np.float32)
    region = np.zeros((h, w), np.uint8)
    y_start = int(h * 0.42)
    band = luma[y_start:]
    # Darker than the local ground, but not a huge wall.
    blur = cv2.GaussianBlur(band, (0, 0), 18)
    dark = ((blur - band) > 8.0) & (band < 70) & (band > 8)
    region[y_start:] = dark.astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(region, connectivity=8)
    mask = np.zeros((h, w), np.float32)
    for i in range(1, n):
        x, y, bw, bh, area = stats[i]
        if bh < 28 or bh > int(h * 0.38):
            continue
        if bw < 8 or bw > int(w * 0.18):
            continue
        if bh < bw * 1.15:
            continue
        if area < 80 or area > h * w * 0.04:
            continue
        mask[labels == i] = 1.0
    if mask.max() > 0:
        mask = cv2.GaussianBlur(mask, (0, 0), 1.4)
    return mask
