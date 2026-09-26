"""Render one shot config to mp4, contact sheet, and check frames.

    .venv/bin/python render.py shots/ark_door_187.yaml
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import cv2
import yaml

from arkpipe.camera import camera_poses, frame_index_for_time
from arkpipe.door import build_closed_door
from arkpipe.figure import detect_figure_mask
from arkpipe.composite import FogField, RainField, render_frame, _vignette
from arkpipe.encode import encode_shot, write_check_frames, write_contact_sheet
from arkpipe.prep import load_or_build_prep

ROOT = Path(__file__).resolve().parent


def load_config(path: Path) -> dict:
    cfg = yaml.safe_load(path.read_text())
    if not isinstance(cfg, dict):
        raise ValueError(f"{path} is not a shot mapping")
    return cfg


def _cue_times(cues: dict) -> tuple[float, float, list[float]]:
    return float(cues["flash"]["time"]), float(cues["slam"]["time"]), [float(p["time"]) for p in cues["pulses"]]


def _sheet_items(fps: int, t0: float, n_frames: int, flash_i: int, slam_i: int) -> list[tuple[int, str]]:
    wanted = [
        0,
        flash_i,
        min(n_frames - 1, flash_i + 6),
        min(n_frames - 1, 24),
        min(n_frames - 1, 48),
        n_frames // 2,
        max(0, slam_i - 2),
        slam_i,
        min(n_frames - 1, slam_i + 6),
        min(n_frames - 1, 100),
        min(n_frames - 1, 110),
        n_frames - 1,
    ]
    # Keep order, drop duplicates, always keep flash and slam.
    seen = set()
    items = []
    for index in wanted:
        if index in seen:
            continue
        seen.add(index)
        items.append(index)
    while len(items) < 12:
        for index in range(n_frames):
            if index not in seen:
                items.append(index)
                seen.add(index)
            if len(items) == 12:
                break
    items = items[:12]
    labels = []
    for index in items:
        t = t0 + index / fps
        tag = f"{t:.2f}"
        if index == flash_i:
            tag += " flash"
        elif index == slam_i:
            tag += " slam"
        labels.append((index, tag))
    return labels


def render(config_path: Path) -> None:
    cfg = load_config(config_path)
    t0 = float(cfg["time_in"])
    t1 = float(cfg["time_out"])
    fps = int(cfg["fps"])
    out_w = int(cfg["width"])
    out_h = int(cfg["height"])
    n_frames = int(round((t1 - t0) * fps))
    if n_frames != 120:
        print(f"note: this shot is {n_frames} frames, not 120", flush=True)

    prep_started = time.perf_counter()
    prep, cache_hit = load_or_build_prep(cfg, ROOT)
    closed_plate, opening, rect = build_closed_door(prep["plate"], prep["door_slit"])
    prep["closed_plate"] = closed_plate
    prep["opening"] = opening
    prep["figure_mask"] = detect_figure_mask(prep["plate"])
    print(f"door opening rect: {rect[0]},{rect[1]} {rect[2]},{rect[3]}", flush=True)
    prep_s = time.perf_counter() - prep_started
    print(f"prep time: {prep_s:.2f}s", flush=True)
    print(f"prep cache: {'hit' if cache_hit else 'miss'}", flush=True)

    cues_path = ROOT / cfg["cues"]
    cues = json.loads(cues_path.read_text())
    flash_t, slam_t, pulse_times = _cue_times(cues)
    poses = camera_poses(
        n_frames=n_frames,
        fps=fps,
        t0=t0,
        flash_time=flash_t,
        slam_time=slam_t,
        pulse_times=pulse_times,
    )
    flash_i = frame_index_for_time(flash_t, t0, fps)
    slam_i = frame_index_for_time(slam_t, t0, fps)
    # Snap light cues to the frame the camera already treats as the hit,
    # so the brightness peak and the shake peak land on that frame.
    flash_frame_t = t0 + flash_i / fps
    slam_frame_t = t0 + slam_i / fps
    pulse_frame_times = [t0 + frame_index_for_time(p, t0, fps) / fps for p in pulse_times]

    frames_dir = ROOT / "out" / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    seed = int(cfg.get("seed", 187))
    rain = RainField(out_h, out_w, seed)
    fog = FogField(out_h, out_w, seed)
    vignette = _vignette(out_h, out_w)

    frame_started = time.perf_counter()
    for pose in poses:
        rgb = render_frame(
            prep,
            pose,
            rain,
            fog,
            out_w=out_w,
            out_h=out_h,
            seed=seed,
            flash_time=flash_frame_t,
            slam_time=slam_frame_t,
            pulse_times=pulse_frame_times,
            vignette=vignette,
        )
        bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        cv2.imwrite(str(frames_dir / f"{pose.frame:06d}.png"), bgr)
        if pose.frame % 20 == 0 or pose.frame == n_frames - 1:
            print(f"frame {pose.frame + 1}/{n_frames}", flush=True)
    frame_s = time.perf_counter() - frame_started
    print(f"frame render time: {frame_s:.2f}s", flush=True)

    song = (ROOT / cfg["song"]).resolve()
    video_path = ROOT / cfg["output"]["video"]
    encode_shot(
        frames_dir,
        song,
        video_path,
        time_in=t0,
        duration=t1 - t0,
        fps=fps,
        n_frames=n_frames,
    )
    print(f"wrote {video_path}", flush=True)

    sheet_items = _sheet_items(fps, t0, n_frames, flash_i, slam_i)
    sheet_path = ROOT / cfg["output"]["contact_sheet"]
    write_contact_sheet(frames_dir, sheet_items, sheet_path)
    print(f"wrote {sheet_path}", flush=True)

    check_dir = ROOT / cfg["output"]["frames_check"]
    named = {
        "flash.png": flash_i,
        "pre_flash.png": max(0, flash_i - 1),
        "pre_slam.png": max(0, slam_i - 2),
        "slam.png": slam_i,
        "post_slam.png": min(n_frames - 1, slam_i + 6),
        "pulse.png": frame_index_for_time(pulse_times[2], t0, fps),
        "mid.png": n_frames // 2,
    }
    write_check_frames(frames_dir, named, check_dir)
    print("frames_check:", ", ".join(f"{name}=frame {idx}" for name, idx in named.items()), flush=True)
    print(f"flash frame {flash_i} at {flash_frame_t:.3f}", flush=True)
    print(f"slam frame {slam_i} at {slam_frame_t:.3f}", flush=True)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: python render.py shots/<shot>.yaml")
    render(Path(sys.argv[1]))


if __name__ == "__main__":
    main()
