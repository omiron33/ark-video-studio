"""Door fire, the closed plank leaf, and the slam exposure dip.

The closed leaf is a 1:1 copy of the wall planks beside the opening, so the
courses, grain, and painted rain match. It is not an inpaint.
"""

from __future__ import annotations

import math

import cv2
import numpy as np


def opening_rect(slit: np.ndarray) -> tuple[int, int, int, int]:
    """Inner doorway on the plate, from the amber slit, kept off the ramp."""
    ys, xs = np.nonzero(slit > 0.35)
    if len(xs) < 30:
        raise RuntimeError("door slit is empty")
    x0 = int(xs.min())
    x1 = int(xs.max())
    core_x = int(np.median(xs))
    col = slit[:, max(0, core_x - 6) : core_x + 6].mean(axis=1)
    strong = np.nonzero(col > 0.45)[0]
    if strong.size < 4:
        strong = np.nonzero((slit > 0.55).any(axis=1))[0]
    span = max(8, int(strong.max()) - int(strong.min()))
    # The amber core starts below the header. Reach up to the top of the recess
    # and stop before the ramp.
    y0 = int(strong.min()) - int(span * 0.42)
    y1 = int(strong.max()) - int(span * 0.06)
    width = max(8, x1 - x0)
    # The glow sits in the right half of the recess. Reach both jambs.
    x0 = int(x0 - width * 0.28)
    x1 = int(x1 + width * 0.10)
    h, w = slit.shape
    x0 = int(np.clip(x0, 0, w - 2))
    x1 = int(np.clip(x1, x0 + 8, w))
    y0 = int(np.clip(y0, 0, h - 2))
    y1 = int(np.clip(y1, y0 + 8, h))
    return x0, y0, x1, y1


def build_closed_door(plate: np.ndarray, slit: np.ndarray) -> tuple[np.ndarray, np.ndarray, tuple[int, int, int, int]]:
    """Return a plate with the opening filled by neighboring planks, plus a soft mask.

    plate is RGB uint8. The mask is 1 inside the doorway and feathered at the jambs.
    """
    x0, y0, x1, y1 = opening_rect(slit)
    src = plate.astype(np.float32)
    height, width = y1 - y0, x1 - x0
    gap = 16
    src_x1 = x0 - gap
    src_x0 = src_x1 - width
    if src_x0 < 0:
        src_x0 = min(src.shape[1] - width, x1 + gap)
        src_x1 = src_x0 + width
    patch = src[y0:y1, src_x0:src_x1].copy()
    if patch.shape[0] != height or patch.shape[1] != width:
        raise RuntimeError("plank patch does not match the doorway")
    neighbor = src[y0:y1, max(0, x0 - 40) : max(1, x0 - 8)]
    scale = float(np.clip(neighbor.mean() / (patch.mean() + 1e-3), 0.85, 1.25)) * 1.08
    xx = np.linspace(-1.0, 1.0, width, dtype=np.float32)[None, :]
    # A little darker in the middle so the leaf sits in the recess, not as a sticker.
    shade = (0.90 + 0.10 * (xx * xx))[..., None]
    patch = np.clip(patch * scale * shade, 0, 255)

    fade = np.ones(height, np.float32)
    top = min(14, height // 5)
    bot = min(36, height // 4)
    fade[:top] = np.linspace(0.0, 1.0, top)
    fade[-bot:] = np.linspace(1.0, 0.0, bot)
    soft = np.zeros(src.shape[:2], np.float32)
    soft[y0:y1, x0:x1] = fade[:, None]
    soft = cv2.GaussianBlur(soft, (0, 0), 4.0)
    closed = src.copy()
    closed[y0:y1, x0:x1] = patch
    # Composite with the feather so the jambs stay the original frame.
    out = src * (1.0 - soft[..., None]) + closed * soft[..., None]
    return np.clip(out + 0.5, 0, 255).astype(np.uint8), soft.astype(np.float32), (x0, y0, x1, y1)


def _flicker(t: float, seed: int) -> float:
    rng = np.random.default_rng(seed + int(round(t * 24.0)) * 13)
    wobble = 0.86 + 0.10 * math.sin(t * 17.0) + 0.05 * math.sin(t * 41.0)
    if rng.random() < 0.18:
        wobble *= 0.84
    return float(np.clip(wobble, 0.62, 1.05))


def paint_fire(acc: np.ndarray, opening: np.ndarray, t: float, seed: int) -> np.ndarray:
    """Replace the flat clipped slit with fire: hot core, beams, falloff."""
    if opening is None or float(opening.max()) < 0.2:
        return acc
    h, w = opening.shape
    luma = 0.2126 * acc[:, :, 0] + 0.7152 * acc[:, :, 1] + 0.0722 * acc[:, :, 2]
    hot = luma * (opening > 0.25)
    ys, xs = np.nonzero(hot > 0.28)
    if len(xs) < 20:
        return acc
    weights = hot[ys, xs]
    cx = float(np.average(xs, weights=weights)) + 1.4 * math.sin(t * 11.0)
    flick = _flicker(t, seed)
    sigma = 17.5 * (0.94 + 0.06 * math.sin(t * 8.0))
    dist = np.arange(w, dtype=np.float32)[None, :] - np.float32(cx)
    fall = np.exp(-0.5 * (dist / np.float32(sigma)) ** 2).astype(np.float32)
    fall = np.broadcast_to(fall, (h, w)).copy()
    fall *= (opening > 0.12).astype(np.float32)
    core = np.clip(fall ** 1.7, 0.0, 1.0)
    beams = np.ones_like(fall)
    for offset, width, depth in ((-26.0, 4.6, 0.62), (-9.0, 3.6, 0.48), (11.0, 4.0, 0.55), (28.0, 5.0, 0.60)):
        beams *= 1.0 - depth * np.exp(-0.5 * ((dist - offset) / width) ** 2)
    bands = 0.84 + 0.16 * np.sin((np.arange(h, dtype=np.float32)[:, None]) * 0.045 + t * 3.0)
    rng = np.random.default_rng(seed + 91)
    noise = rng.random((h // 6, w // 6)).astype(np.float32)
    noise = cv2.resize(cv2.GaussianBlur(noise, (0, 0), 1.4), (w, h), interpolation=cv2.INTER_LINEAR)
    hot_c = np.array([0.78, 0.36, 0.09], dtype=np.float32)
    mid_c = np.array([0.55, 0.20, 0.04], dtype=np.float32)
    edge_c = np.array([0.12, 0.06, 0.025], dtype=np.float32)
    f = np.clip(fall, 0.0, 1.0)
    color = edge_c * (1.0 - f)[..., None] + mid_c * (f * (1.0 - core))[..., None] + hot_c * core[..., None]
    color *= (beams * bands * flick * (0.88 + 0.12 * noise))[..., None]
    y_norm = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None]
    bottom = np.clip((y_norm - 0.62) / 0.38, 0.0, 1.0) * (opening > 0.15)
    color *= (1.0 - bottom * 0.50)[..., None]
    # Keep a little of the unclipped photograph so the gap is not a flat fill.
    hp = acc - cv2.GaussianBlur(acc, (0, 0), 2.2)
    hp[luma > 0.82] = 0.0
    color = np.clip(color + hp * 0.18, 0.0, 0.74)
    replace = np.clip((luma - 0.16) / 0.20, 0.0, 1.0) * np.clip(fall * 1.35, 0.0, 1.0)
    blown = ((luma > 0.70) & (opening > 0.12) & (fall > 0.2)).astype(np.float32)
    replace = np.maximum(replace, blown)
    replace = cv2.GaussianBlur(replace, (0, 0), 0.8)
    return acc * (1.0 - replace[..., None]) + color * replace[..., None]


def seam_level(t: float, slam_t: float) -> float:
    """0 before the slam. After the slam the seam stays on at a steady level."""
    if t < slam_t - 1.0 / 48.0:
        return 0.0
    return 0.72


def seam_mask(opening: np.ndarray, t: float, slam_t: float) -> np.ndarray:
    """Razor warm seam. It does not fade out after the slam."""
    amount = seam_level(t, slam_t)
    if amount <= 0.0 or opening.max() < 0.2:
        return np.zeros_like(opening)
    h, w = opening.shape
    xs = np.arange(w, dtype=np.float32)
    weight = opening + 1e-6
    cx = float((weight * xs).sum() / weight.sum())
    dist = xs[None, :] - cx
    line = np.exp(-0.5 * (dist / 1.05) ** 2).astype(np.float32)
    # Only the solid part of the leaf. The feather below the threshold is not a seam.
    return line * (opening > 0.78).astype(np.float32) * amount


def door_is_shut(t: float, slam_t: float) -> bool:
    return (t - slam_t) >= -1.0 / 48.0


def slam_exposure(t: float, slam_t: float) -> float:
    """One hard dip on the slam frame and a smaller one on the next."""
    dt = t - slam_t
    if dt < -1.0 / 48.0:
        return 1.0
    if dt < 1.0 / 24.0:
        return 0.70
    if dt < 2.0 / 24.0:
        return 0.84
    return 1.0


def cut_puddle(acc: np.ndarray, ground: np.ndarray, shut: bool, flicker: float) -> np.ndarray:
    """Ramp and puddle light follows the fire, and cuts off when the door shuts."""
    h = acc.shape[0]
    warm = np.clip((acc[:, :, 0] - acc[:, :, 2] - 0.04) / 0.16, 0.0, 1.0)
    warm[: int(h * 0.58)] = 0.0
    spill = np.maximum(ground, warm)
    spill = cv2.dilate((spill > 0.12).astype(np.uint8), np.ones((5, 5), np.uint8))
    spill = cv2.GaussianBlur(spill.astype(np.float32), (0, 0), 1.6)
    if shut:
        # Pull the orange reflection toward the wet ground. Do not punch a black hole.
        acc[:, :, 0] = acc[:, :, 0] * (1.0 - spill * 0.75) + acc[:, :, 2] * spill * 0.20
        acc[:, :, 1] = acc[:, :, 1] * (1.0 - spill * 0.28)
        return np.clip(acc, 0.0, 1.0)
    # Breathe with the fire while the door is open.
    gain = 0.55 + 0.45 * flicker
    acc = acc * (1.0 - spill[..., None] * (1.0 - gain) * 0.55)
    return np.clip(acc, 0.0, 1.0)
