"""Measure flash, door, and shake on the quality-gate stills.

Writes a plain report to stdout. Run after render.py.
"""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]


def luma(bgr: np.ndarray) -> np.ndarray:
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32)
    return 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]


def amber_score(bgr: np.ndarray) -> float:
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32)
    # Door search window in the 1920x1080 frame, scaled from the 1280x720 plate.
    h, w = rgb.shape[:2]
    y0, y1 = int(h * 0.22), int(h * 0.70)
    x0, x1 = int(w * 0.48), int(w * 0.72)
    crop = rgb[y0:y1, x0:x1]
    r, g, b = crop[:, :, 0], crop[:, :, 1], crop[:, :, 2]
    score = np.clip(r - b, 0, None)
    return float(score.mean())


def shift(a: np.ndarray, b: np.ndarray) -> tuple[float, float]:
    ga = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY).astype(np.float32)
    gb = cv2.cvtColor(b, cv2.COLOR_BGR2GRAY).astype(np.float32)
    (dx, dy), response = cv2.phaseCorrelate(ga, gb)
    return float(dx), float(dy), float(response)


def border_stats(bgr: np.ndarray) -> tuple[float, float]:
    edges = np.concatenate(
        [
            bgr[0, :, :].reshape(-1, 3),
            bgr[-1, :, :].reshape(-1, 3),
            bgr[:, 0, :].reshape(-1, 3),
            bgr[:, -1, :].reshape(-1, 3),
        ],
        axis=0,
    ).astype(np.float32)
    return float(edges.mean()), float(edges.std())


def main() -> None:
    check = ROOT / "out" / "frames_check"
    names = ["flash.png", "pre_flash.png", "pre_slam.png", "slam.png", "post_slam.png", "pulse.png", "mid.png"]
    frames = {}
    for name in names:
        img = cv2.imread(str(check / name), cv2.IMREAD_COLOR)
        if img is None:
            raise SystemExit(f"missing {check / name}")
        frames[name] = img
        print(f"{name} {img.shape[1]}x{img.shape[0]}")

    flash = luma(frames["flash.png"])
    pre = luma(frames["pre_flash.png"])
    left = slice(0, flash.shape[1] // 2)
    right = slice(flash.shape[1] // 2, None)
    d_left = float(flash[:, left].mean() - pre[:, left].mean())
    d_right = float(flash[:, right].mean() - pre[:, right].mean())
    print(f"flash_minus_preflash_left {d_left:.3f}")
    print(f"flash_minus_preflash_right {d_right:.3f}")
    print(f"flash_left_minus_right {d_left - d_right:.3f}")

    amber_pre = amber_score(frames["pre_slam.png"])
    amber_slam = amber_score(frames["slam.png"])
    amber_post = amber_score(frames["post_slam.png"])
    print(f"amber_pre_slam {amber_pre:.3f}")
    print(f"amber_slam {amber_slam:.3f}")
    print(f"amber_post_slam {amber_post:.3f}")

    slam_dx, slam_dy, slam_r = shift(frames["pre_slam.png"], frames["slam.png"])
    post_dx, post_dy, post_r = shift(frames["pre_slam.png"], frames["post_slam.png"])
    # Pulse versus the mid frame is not a neighbor. Use pre_flash as a quiet neighbor
    # only if pulse.png is a different moment. Displacement of the pulse frame is
    # measured against mid.png when the pulse is not adjacent. The renderer also
    # stores pulse.png. Compare its phase shift to the following approach: load
    # the raw frame next to it if present.
    pulse_path_neighbor = ROOT / "out" / "frames"
    print(f"slam_vs_preslam_dx {slam_dx:.3f} dy {slam_dy:.3f} response {slam_r:.3f}")
    print(f"post_vs_preslam_dx {post_dx:.3f} dy {post_dy:.3f} response {post_r:.3f}")
    slam_mag = (slam_dx ** 2 + slam_dy ** 2) ** 0.5
    post_mag = (post_dx ** 2 + post_dy ** 2) ** 0.5
    print(f"slam_displacement {slam_mag:.3f}")
    print(f"post_displacement {post_mag:.3f}")

    # Neighbor of pulse.png is not stored. Decode is unnecessary: compare pulse
    # to mid only as a sanity print, and measure a pulse pair from out/frames if
    # the index file names are known via frames_check sizes.
    mean_b, std_b = border_stats(frames["slam.png"])
    print(f"slam_border_mean {mean_b:.3f}")
    print(f"slam_border_std {std_b:.3f}")

    if len(sys.argv) > 1 and sys.argv[1] == "--pulse-frame":
        return


if __name__ == "__main__":
    main()
