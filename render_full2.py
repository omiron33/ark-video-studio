"""Render the full 72-shot Genesis Chapter 7 video.

    .venv/bin/python render_full2.py

Each shot is written to ~/storybook/full/segments/<id>.mp4 and skipped when
that file already has the right frame count. Does not delete out/genesis7_full.mp4.
"""

from __future__ import annotations

import gc
import shutil
import subprocess
import time
from pathlib import Path

import cv2
import numpy as np

from arkpipe.composite import _vignette
from arkpipe.encode import ffmpeg_bin
from arkpipe.full2fx import (
    OUT_H,
    OUT_W,
    SONG_END,
    build_fx,
    camera_at,
    load_all_shots,
    load_bars,
    load_beats,
    load_fx,
    segment_frames,
)
from render_preview import _prep, render_frame

ROOT = Path(__file__).resolve().parent
STORY = ROOT.parent
FULL = STORY / "full"
SEGMENTS = FULL / "segments"
FPS = 24
CRF = "20"


def _ffprobe() -> str:
    found = shutil.which("ffprobe")
    if found:
        return found
    raise RuntimeError("ffprobe is not on PATH")


def _frame_count(path: Path) -> int:
    probe = subprocess.run(
        [_ffprobe(), "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=nb_frames", "-of", "csv=p=0", str(path)],
        capture_output=True,
        text=True,
    )
    try:
        return int((probe.stdout or "0").strip() or "0")
    except ValueError:
        return 0


def _encode_shot(shot: dict, span: tuple[int, int], config: dict, bars: list[float], beats: list[float], *, draw_hero: bool = True, dest_dir: Path | None = None) -> float:
    start, stop = span
    n = stop - start
    folder = dest_dir or SEGMENTS
    dest = folder / f"{shot['id']}.mp4"
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and _frame_count(dest) == n:
        print(f"{shot['id']} resume skip {n} frames", flush=True)
        return 0.0
    t0 = time.perf_counter()
    prep = _prep(shot)
    prep["vignette"] = _vignette(OUT_H, OUT_W)
    fx = config[shot["id"]]
    cmd = [
        ffmpeg_bin(), "-y", "-hide_banner", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{OUT_W}x{OUT_H}", "-r", str(FPS), "-i", "pipe:0",
        "-frames:v", str(n), "-c:v", "libx264", "-crf", CRF, "-pix_fmt", "yuv420p",
        "-preset", "veryfast", "-an", str(dest),
    ]
    print("ffmpeg: " + " ".join(cmd), flush=True)
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    assert proc.stdin is not None
    fade = "fade" in (shot.get("camera") or "").lower() or "fade" in (shot.get("motion") or "").lower()
    for frame in range(start, stop):
        t = frame / FPS
        pose = camera_at(t, shot, config, bars, frame=frame)
        rgb = render_frame(prep, shot, fx, pose, t, beats, draw_hero=draw_hero)
        if fade and frame > stop - 48:
            scale = max(0.0, (stop - frame) / 48.0)
            rgb = (rgb.astype(np.float32) * scale).astype(np.uint8)
        proc.stdin.write(np.ascontiguousarray(rgb).tobytes())
        local = frame - start
        if local % 48 == 0:
            print(f"{shot['id']} frame {local + 1}/{n}", flush=True)
    proc.stdin.close()
    code = proc.wait()
    del prep
    gc.collect()
    if code != 0:
        raise RuntimeError(f"ffmpeg failed for {shot['id']} ({code})")
    elapsed = time.perf_counter() - t0
    (folder / f"{shot['id']}.time").write_text(f"{elapsed:.2f}\n")
    print(f"{shot['id']} frame render time: {elapsed:.2f}s ({n} frames)", flush=True)
    return elapsed


def _concat(shots: list[dict], dest: Path) -> None:
    listing = FULL / "concat.txt"
    lines = []
    for shot in shots:
        path = (SEGMENTS / f"{shot['id']}.mp4").resolve()
        lines.append(f"file '{path}'")
    listing.write_text("\n".join(lines) + "\n")
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        ffmpeg_bin(), "-y", "-hide_banner", "-loglevel", "error",
        "-f", "concat", "-safe", "0", "-i", str(listing),
        "-i", str(STORY / "song.mp3"),
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
        str(dest),
    ]
    print("ffmpeg: " + " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)
    print(f"wrote {dest}", flush=True)


def _contact(shots: list[dict], spans: list[tuple[int, int]], dest: Path) -> None:
    cols = 8
    thumb_w, thumb_h = 240, 135
    label_h = 22
    tiles = []
    for shot, (start, stop) in zip(shots, spans):
        mid = start + max(0, (stop - start) // 2)
        # Pull the middle of the segment, not the global timeline index.
        local = max(0, (stop - start) // 2)
        raw = subprocess.run(
            [ffmpeg_bin(), "-v", "error", "-i", str(SEGMENTS / f"{shot['id']}.mp4"), "-vf", f"select=eq(n\\,{local})", "-vframes", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"],
            capture_output=True,
            check=True,
        )
        frame = np.frombuffer(raw.stdout, dtype=np.uint8).reshape((OUT_H, OUT_W, 3))
        bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        thumb = cv2.resize(bgr, (thumb_w, thumb_h), interpolation=cv2.INTER_AREA)
        cell = np.zeros((thumb_h + label_h, thumb_w, 3), np.uint8)
        cell[:thumb_h] = thumb
        stamp = mid / FPS
        cv2.putText(cell, f"{shot['id']} {stamp:.1f}s", (4, thumb_h + 16), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (230, 230, 230), 1, cv2.LINE_AA)
        tiles.append(cell)
    while len(tiles) % cols:
        tiles.append(np.zeros_like(tiles[0]))
    rows = [np.concatenate(tiles[i : i + cols], axis=1) for i in range(0, len(tiles), cols)]
    sheet = np.concatenate(rows, axis=0)
    dest.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(dest), sheet)
    print(f"wrote {dest}", flush=True)


def main() -> None:
    import sys
    plates = "--plates" in sys.argv
    print("full2 entry render_full2.py", flush=True)
    print("plates" if plates else "segments", flush=True)
    print("not launching render_timeline", flush=True)
    started = time.perf_counter()
    shots = load_all_shots()
    locked = {key: load_fx()[key] for key in ("s01", "s02", "s03", "s04") if key in load_fx()}
    config = build_fx(shots, locked)
    bars = [b for b in load_bars() if 0.0 <= b <= SONG_END]
    beats = [b for b in load_beats() if 0.0 <= b <= SONG_END]
    spans = segment_frames(shots)
    folder = FULL / "plates" if plates else SEGMENTS
    total_time = 0.0
    for shot, span in zip(shots, spans):
        total_time += _encode_shot(
            shot, span, config, bars, beats, draw_hero=not plates, dest_dir=folder,
        )
    if plates:
        elapsed = time.perf_counter() - started
        print(f"plate render time: {elapsed:.2f}s", flush=True)
        return
    out = FULL / "genesis7_full.mp4"
    _concat(shots, out)
    _contact(shots, spans, FULL / "genesis7_contact.png")
    elapsed = time.perf_counter() - started
    (FULL / "render_time.txt").write_text(f"segments {total_time:.2f}\nwall {elapsed:.2f}\n")
    print(f"full2 render time: segments {total_time:.2f}s wall {elapsed:.2f}s", flush=True)


if __name__ == "__main__":
    main()
