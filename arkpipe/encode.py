"""ffmpeg mux, contact sheet, and the quality-gate stills."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import cv2
import numpy as np


def ffmpeg_bin() -> str:
    path = shutil.which("ffmpeg")
    if path is None:
        raise RuntimeError("ffmpeg is not on PATH")
    return path


def encode_shot(
    frames_dir: Path,
    song_path: Path,
    output: Path,
    *,
    time_in: float,
    duration: float,
    fps: int,
    n_frames: int,
) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    fade_in = 0.12
    fade_out = 0.15
    fade_out_start = max(0.0, duration - fade_out)
    cmd = [
        ffmpeg_bin(),
        "-y",
        "-framerate",
        str(fps),
        "-start_number",
        "0",
        "-i",
        str(frames_dir / "%06d.png"),
        "-ss",
        f"{time_in:.3f}",
        "-t",
        f"{duration:.3f}",
        "-i",
        str(song_path),
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-frames:v",
        str(n_frames),
        "-c:v",
        "libx264",
        "-crf",
        "16",
        "-pix_fmt",
        "yuv420p",
        "-preset",
        "medium",
        "-x264-params",
        "frame-threads=1:sliced-threads=0",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-af",
        f"afade=t=in:st=0:d={fade_in:.2f},afade=t=out:st={fade_out_start:.3f}:d={fade_out:.2f}",
        "-t",
        f"{duration:.3f}",
        "-movflags",
        "+faststart",
        str(output),
    ]
    print("ffmpeg: " + " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)


def write_contact_sheet(frames_dir: Path, items: list[tuple[int, str]], dest: Path, cols: int = 4) -> None:
    """items are (frame index, timestamp label). The grid includes flash and slam."""
    cells = []
    for index, label in items:
        bgr = cv2.imread(str(frames_dir / f"{index:06d}.png"), cv2.IMREAD_COLOR)
        if bgr is None:
            raise FileNotFoundError(frames_dir / f"{index:06d}.png")
        thumb = cv2.resize(bgr, (480, 270), interpolation=cv2.INTER_AREA)
        cell = np.zeros((296, 480, 3), np.uint8)
        cell[:270] = thumb
        cv2.putText(
            cell,
            label,
            (8, 288),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.48,
            (235, 235, 235),
            1,
            cv2.LINE_AA,
        )
        cells.append(cell)
    rows = []
    for i in range(0, len(cells), cols):
        row = cells[i : i + cols]
        while len(row) < cols:
            row.append(np.zeros_like(cells[0]))
        rows.append(np.concatenate(row, axis=1))
    sheet = np.concatenate(rows, axis=0)
    dest.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(dest), sheet)


def write_check_frames(frames_dir: Path, named: dict[str, int], dest_dir: Path) -> None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    for name, index in named.items():
        src = frames_dir / f"{index:06d}.png"
        bgr = cv2.imread(str(src), cv2.IMREAD_COLOR)
        if bgr is None:
            raise FileNotFoundError(src)
        if bgr.shape[1] != 1920 or bgr.shape[0] != 1080:
            raise RuntimeError(f"{name} is {bgr.shape[1]}x{bgr.shape[0]}, expected 1920x1080")
        cv2.imwrite(str(dest_dir / name), bgr)
