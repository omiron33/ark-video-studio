"""Render the full Genesis Chapter 7 timeline.

    .venv/bin/python render_timeline.py

Each shot is encoded to out/shot_video/<id>.mp4 and skipped if that file
already has the right frame count, so a rerun resumes.
"""

from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
import time
from pathlib import Path

import cv2
import numpy as np

from arkpipe.camera import CameraPose, camera_poses
from arkpipe.composite import FogField, RainField, _vignette, render_frame
from arkpipe.door import build_closed_door
from arkpipe.encode import ffmpeg_bin
from arkpipe.figure import detect_figure_mask
from arkpipe.prep import load_or_build_prep
from arkpipe.songcues import measure_timeline_cues

ROOT = Path(__file__).resolve().parent
STORY = ROOT.parent
FPS = 24
WIDTH = 1920
HEIGHT = 1080
SONG_END = 367.2
DISSOLVE_FRAMES = 8


def load_shots() -> list[dict]:
    data = json.loads((ROOT / "timeline" / "shotlist.json").read_text())
    shots = data["shots"] if isinstance(data, dict) else data
    return shots


def still_path(shot: dict) -> Path:
    source = shot.get("source") or ""
    still = shot["still"]
    if "styles/" in source:
        name = source.split("styles/")[-1].split()[0]
        return (STORY / "styles" / Path(name).name).resolve()
    if still in {"real_1", "real_3", "gritty_C3"}:
        mapping = {"real_1": "real_1.png", "real_3": "real_3.png", "gritty_C3": "gritty_C3.png"}
        return (STORY / "styles" / mapping[still]).resolve()
    return (STORY / "shots" / f"{still}.png").resolve()


def frame_span(shots: list[dict]) -> list[tuple[int, int]]:
    starts = [int(round(float(s["in_"]) * FPS)) for s in shots]
    end = int(round(SONG_END * FPS))
    spans = []
    for i, start in enumerate(starts):
        stop = starts[i + 1] if i + 1 < len(starts) else end
        spans.append((start, max(start + 1, stop)))
    return spans


def calm(effects: str) -> bool:
    text = effects.lower()
    loud = ("lightning", "heavy", "shake", "spray", "flood", "slam", "fountain")
    return not any(word in text for word in loud)


def ffprobe_bin() -> str:
    path = shutil.which("ffprobe")
    if path is None:
        raise RuntimeError("ffprobe is not on PATH")
    return path


def blend_dissolve(incoming: np.ndarray, outgoing: np.ndarray, index: int, count: int) -> np.ndarray:
    """Length-preserving mix. Index 0 is the outgoing frame. The last index is the incoming frame."""
    if count <= 1:
        return incoming
    alpha = float(index) / float(count - 1)
    mix = outgoing.astype(np.float32) * (1.0 - alpha) + incoming.astype(np.float32) * alpha
    return np.clip(mix + 0.5, 0, 255).astype(np.uint8)


def rain_density(effects: str) -> float:
    text = effects.lower()
    if "no rain" in text:
        return 0.0
    if "heavy" in text:
        return 0.55
    if "drizzle" in text or "light" in text:
        return 0.28
    if "rain" in text:
        return 0.4
    return 0.15


def nearest_hit(times: list[float], t: float, window: float = 0.08) -> float:
    if not times:
        return 0.0
    best = min(times, key=lambda hit: abs(hit - t))
    if abs(best - t) <= window:
        return 1.0 - abs(best - t) / window
    return 0.0


class ShotPainter:
    """One shot's frames, including a few frames past the out point for dissolves."""

    def __init__(self, shot: dict, span: tuple[int, int], cues: dict, prep: dict):
        self.shot = shot
        self.prep = prep
        self.start, self.stop = span
        self.n = self.stop - self.start
        self.effects = shot.get("effects") or ""
        low = self.effects.lower()
        self.seed = 1000 + int(shot["id"][1:])
        self.rain = RainField(HEIGHT, WIDTH, self.seed, density=rain_density(self.effects))
        self.fog = FogField(HEIGHT, WIDTH, self.seed)
        self.vignette = _vignette(HEIGHT, WIDTH)
        self.door = shot["id"] == "s21"
        self.slam_t = float(cues["door_slam"])
        self.flash_times = [item["time"] for item in cues["flashes"]]
        self.shake_times = [item["time"] for item in cues["shakes"]]
        self.pulse_times = [item["time"] for item in cues["pulses"]]
        self.use_water = "water" in low or "flood" in low
        self.use_lightning = "lightning" in low or self.door
        self.use_birds = "bird" in low
        self.use_spray = "spray" in low or "fountain" in low
        self.use_flicker = any(word in low for word in ("lantern", "torch", "fire", "door glow"))
        self.fast_water = "fast" in low
        self.water = prep.get("water_mask")
        self.t0 = self.start / FPS
        self.door_poses = None
        if self.door:
            self.door_poses = camera_poses(
                n_frames=self.n,
                fps=FPS,
                t0=self.t0,
                flash_time=187.153,
                slam_time=self.slam_t,
                pulse_times=[p for p in self.pulse_times if self.t0 <= p < self.t0 + self.n / FPS],
            )

    def pose_at(self, index: int) -> CameraPose:
        t = (self.start + index) / FPS
        if self.door_poses is not None and index < len(self.door_poses):
            return self.door_poses[index]
        n = max(self.n, 2)
        u = index / (n - 1)
        shake = 0.0
        for hit in self.shake_times:
            dt = t - hit
            if 0.0 <= dt < 0.28:
                shake = max(shake, 22.0 * math.exp(-dt / 0.12))
        for hit in self.pulse_times:
            dt = t - hit
            if 0.0 <= dt < 0.12:
                shake = max(shake, 3.2 * math.exp(-dt / 0.05))
        return CameraPose(
            frame=index,
            time=t,
            dolly=0.012 + 0.04 * u,
            drift_x=8.0 * math.sin(u * 3.1),
            drift_y=3.0 * math.sin(u * 2.2),
            roll=0.18 * math.sin(u * math.pi),
            shake_x=shake,
            shake_y=shake * 0.28,
            shake_roll=shake / 140.0,
        )

    def frame(self, index: int) -> np.ndarray:
        pose = self.pose_at(index)
        t = pose.time
        if self.use_lightning and self.flash_times:
            flash_time = min(self.flash_times, key=lambda hit: abs(hit - t))
        else:
            flash_time = t + 10.0
        local_pulses = [p for p in self.pulse_times if abs(p - t) < 1.0]
        rgb = render_frame(
            self.prep, pose, self.rain, self.fog,
            out_w=WIDTH, out_h=HEIGHT, seed=self.seed,
            flash_time=flash_time,
            slam_time=self.slam_t if self.door else t + 100.0,
            pulse_times=local_pulses,
            vignette=self.vignette,
        )
        if self.use_lightning:
            amount = nearest_hit(self.flash_times, t, 0.07)
            if amount > 0:
                lift = (np.linspace(1.0, 0.15, WIDTH, dtype=np.float32) * amount * 0.45)[None, :, None]
                rgb = np.clip(rgb.astype(np.float32) + lift * np.array([150, 170, 190], np.float32), 0, 255).astype(np.uint8)
        if self.use_water and self.water is not None and float(np.max(self.water)) > 0.02:
            speed = 2.2 if self.fast_water else 1.0
            rgb = flow_water(rgb, self.water, t, speed)
        if self.use_flicker:
            rgb = flicker_warm(rgb, t, self.seed)
        if self.use_birds:
            rgb = drift_birds(rgb, t, self.seed)
        if self.use_spray:
            rgb = add_spray(rgb, t, self.seed, fast=self.fast_water)
        global_i = self.start + index
        if 0 <= global_i < 18:
            rgb = (rgb.astype(np.float32) * (global_i / 18.0)).astype(np.uint8)
        song_end = int(round(SONG_END * FPS))
        if self.stop >= song_end - 1 and index > self.n - 36:
            fade = max(0.0, (self.n - index) / 36.0)
            rgb = (rgb.astype(np.float32) * fade).astype(np.uint8)
        return rgb


def render_shot(painter: ShotPainter, prev: ShotPainter | None, dissolve: bool) -> None:
    shot = painter.shot
    n = painter.n
    out_path = ROOT / "out" / "shot_video" / f"{shot['id']}.mp4"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        probe = subprocess.run(
            [ffprobe_bin(), "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=nb_frames", "-of", "csv=p=0", str(out_path)],
            capture_output=True, text=True,
        )
        try:
            have = int(probe.stdout.strip() or "0")
        except ValueError:
            have = 0
        if have == n:
            print(f"{shot['id']} resume skip {n} frames", flush=True)
            return
    cmd = [
        ffmpeg_bin(), "-y", "-hide_banner", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS), "-i", "pipe:0",
        "-frames:v", str(n), "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p",
        "-preset", "veryfast", "-x264-params", "frame-threads=1:sliced-threads=0",
        "-an", str(out_path),
    ]
    print("ffmpeg: " + " ".join(cmd), flush=True)
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    assert proc.stdin is not None
    started = time.perf_counter()
    for i in range(n):
        rgb = painter.frame(i)
        if dissolve and prev is not None and i < DISSOLVE_FRAMES:
            rgb = blend_dissolve(rgb, prev.frame(prev.n + i), i, DISSOLVE_FRAMES)
        proc.stdin.write(np.ascontiguousarray(rgb).tobytes())
        if i % 48 == 0:
            print(f"{shot['id']} frame {i + 1}/{n}", flush=True)
    proc.stdin.close()
    code = proc.wait()
    if code != 0:
        raise RuntimeError(f"ffmpeg failed for {shot['id']} ({code})")
    elapsed = time.perf_counter() - started
    print(f"{shot['id']} frame render time: {elapsed:.2f}s ({n} frames)", flush=True)
    (ROOT / "out" / "shot_video" / f"{shot['id']}.time").write_text(f"{elapsed:.2f}\n")


def flow_water(rgb: np.ndarray, mask: np.ndarray, t: float, speed: float = 1.0) -> np.ndarray:
    """Row-varying current. Not a rigid slide of the still."""
    h, w = rgb.shape[:2]
    ys = np.arange(h, dtype=np.float32)
    xs = np.arange(w, dtype=np.float32)
    depth_row = 0.25 + 0.75 * (ys / max(h - 1, 1))
    shift = (6.0 + 16.0 * float(speed)) * depth_row * np.sin(t * 1.1 + ys * 0.05)
    ripple = 3.2 * np.sin(xs * 0.03 + t * 1.6)
    map_x = np.broadcast_to(xs, (h, w)).astype(np.float32) - shift[:, None]
    map_y = (ys[:, None] + ripple[None, :] * depth_row[:, None]).astype(np.float32)
    moved = cv2.remap(rgb, map_x, map_y, interpolation=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    m = np.clip(mask, 0.0, 1.0).astype(np.float32)[..., None]
    return (rgb.astype(np.float32) * (1.0 - m) + moved.astype(np.float32) * m).astype(np.uint8)


def drift_birds(rgb: np.ndarray, t: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed + 11)
    h, w = rgb.shape[:2]
    out = rgb.copy()
    count = 16
    x0 = rng.uniform(0, w, count)
    y0 = rng.uniform(h * 0.06, h * 0.40, count)
    speed = rng.uniform(16, 42, count)
    phase = rng.uniform(0, 6.28, count)
    xs = np.mod(x0 + t * speed, w + 30) - 15
    ys = y0 + 7.0 * np.sin(t * 0.8 + phase)
    color = (16, 18, 22)
    for i in range(count):
        x = int(xs[i])
        y = int(ys[i])
        if y < 2 or y >= h - 2:
            continue
        cv2.line(out, (x - 7, y + 2), (x, y - 2), color, 1, cv2.LINE_AA)
        cv2.line(out, (x, y - 2), (x + 8, y + 3), color, 1, cv2.LINE_AA)
    return out


def add_spray(rgb: np.ndarray, t: float, seed: int, fast: bool = False) -> np.ndarray:
    rng = np.random.default_rng(seed + 19)
    h, w = rgb.shape[:2]
    count = 70
    x = rng.integers(0, w, count)
    phase = np.mod(rng.random(count) + t * (1.8 if fast else 0.9), 1.0)
    y = (h * 0.96 - phase * h * 0.62).astype(np.int32)
    overlay = np.zeros((h, w), np.float32)
    valid = (y >= 0) & (y < h)
    overlay[y[valid], x[valid]] = 0.85
    overlay = cv2.GaussianBlur(overlay, (0, 0), 1.15)
    out = rgb.astype(np.float32)
    out += overlay[..., None] * np.array([200, 214, 220], np.float32)
    return np.clip(out, 0, 255).astype(np.uint8)


def flicker_warm(rgb: np.ndarray, t: float, seed: int) -> np.ndarray:
    flick = 0.82 + 0.18 * np.sin(t * 17.0 + seed)
    f = rgb.astype(np.float32)
    warm = (f[:, :, 0] > f[:, :, 2] + 18) & (f[:, :, 0] > 90)
    f[warm] *= flick
    return np.clip(f, 0, 255).astype(np.uint8)


def water_mask(plate: np.ndarray, depth: np.ndarray) -> np.ndarray:
    """Water from color plus depth. Brown flood counts, not only blue sea. Sky stays still."""
    rgb = plate.astype(np.float32)
    h = rgb.shape[0]
    luma = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
    blueish = (rgb[:, :, 2] > rgb[:, :, 0] * 0.82) & (luma < 130)
    brown = (rgb[:, :, 0] > rgb[:, :, 2] + 6) & (rgb[:, :, 1] > 35) & (luma > 22) & (luma < 150)
    near = depth > 0.42
    low = np.zeros(luma.shape, np.float32)
    low[int(h * 0.40) :] = 1.0
    mask = ((blueish & (near | (low > 0))) | (brown & (low > 0)) | ((luma < 48) & near & (low > 0))).astype(np.float32)
    mask = cv2.GaussianBlur(mask, (0, 0), 3.0)
    if float(mask.mean()) < 0.02:
        return np.zeros_like(mask)
    return np.clip(mask, 0, 1)


def prep_for(shot: dict) -> tuple[dict, bool]:
    path = still_path(shot)
    if not path.exists():
        raise FileNotFoundError(path)
    rel = os.path.relpath(path, ROOT)
    cfg = {
        "id": shot["still"],
        "source_image": rel,
        "plate_width": 1920,
        "plate_height": 1080,
        "layers": 3,
        "feather_px": 4.0,
        "reveal_px": 48,
        "depth_preview": f"out/depth_{shot['still']}.png",
    }
    prep, hit = load_or_build_prep(cfg, ROOT)
    effects = (shot.get("effects") or "").lower()
    if shot["id"] == "s21":
        closed, opening, rect = build_closed_door(prep["plate"], prep["door_slit"])
        prep["closed_plate"] = closed
        prep["opening"] = opening
        print(f"door opening rect: {rect}", flush=True)
    else:
        prep["opening"] = None
        prep["closed_plate"] = None
    prep["figure_mask"] = detect_figure_mask(prep["plate"])
    if "water" in effects or "flood" in effects:
        prep["water_mask"] = cv2.resize(water_mask(prep["plate"], prep["depth"]), (WIDTH, HEIGHT))
    return prep, hit


def concat_and_mux(shots: list[dict]) -> None:
    listing = ROOT / "out" / "shot_video" / "concat.txt"
    lines = []
    for shot in shots:
        lines.append(f"file '{(ROOT / 'out' / 'shot_video' / (shot['id'] + '.mp4')).resolve()}'")
    listing.write_text("\n".join(lines) + "\n")
    out = ROOT / "out" / "genesis7_full.mp4"
    cmd = [
        ffmpeg_bin(), "-y", "-hide_banner", "-loglevel", "error",
        "-f", "concat", "-safe", "0", "-i", str(listing),
        "-i", str(STORY / "song.mp3"),
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p",
        "-preset", "veryfast", "-x264-params", "frame-threads=1:sliced-threads=0",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest", "-movflags", "+faststart",
        str(out),
    ]
    print("ffmpeg: " + " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)
    print(f"wrote {out}", flush=True)


def write_checks(shots: list[dict], spans: list[tuple[int, int]]) -> None:
    dest = ROOT / "out" / "shot_checks"
    dest.mkdir(parents=True, exist_ok=True)
    tiles = []
    for shot, (start, stop) in zip(shots, spans):
        video = ROOT / "out" / "shot_video" / f"{shot['id']}.mp4"
        n = stop - start
        picks = {"a": 0, "b": n // 2, "c": min(n - 1, max(0, n // 3))}
        if shot["id"] == "s21":
            picks["c"] = int(round((190.46 - 187.0) * FPS))
        for label, idx in picks.items():
            png = dest / f"{shot['id']}_{label}.png"
            subprocess.run(
                [ffmpeg_bin(), "-y", "-hide_banner", "-loglevel", "error", "-i", str(video), "-vf", f"select=eq(n\\,{idx})", "-vframes", "1", str(png)],
                check=True,
            )
        thumb = cv2.imread(str(dest / f"{shot['id']}_b.png"))
        thumb = cv2.resize(thumb, (320, 180))
        cell = np.zeros((200, 320, 3), np.uint8)
        cell[:180] = thumb
        cv2.putText(cell, f"{shot['id']} {float(shot['in_']):.1f}", (6, 196), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (230, 230, 230), 1, cv2.LINE_AA)
        tiles.append(cell)
    cols = 6
    rows = []
    for i in range(0, len(tiles), cols):
        row = tiles[i : i + cols]
        while len(row) < cols:
            row.append(np.zeros_like(tiles[0]))
        rows.append(np.concatenate(row, axis=1))
    sheet = np.concatenate(rows, axis=0)
    cv2.imwrite(str(ROOT / "out" / "contact_sheet_full.png"), sheet)


def main() -> None:
    shots = load_shots()
    spans = frame_span(shots)
    cue_path = ROOT / "timeline" / "cues.json"
    if cue_path.exists():
        cues = json.loads(cue_path.read_text())
        print("cues loaded", flush=True)
    else:
        cues = measure_timeline_cues(STORY / "song.mp3", STORY / "audio.json", STORY / "lyrics.json")
        cue_path.write_text(json.dumps(cues, indent=2) + "\n")
        print(f"wrote {cue_path}", flush=True)
    total = 0.0
    prev = None
    prev_calm = False
    for shot, span in zip(shots, spans):
        t0 = time.perf_counter()
        prep, hit = prep_for(shot)
        prep_s = time.perf_counter() - t0
        print(f"{shot['id']} prep time: {prep_s:.2f}s cache {'hit' if hit else 'miss'}", flush=True)
        painter = ShotPainter(shot, span, cues, prep)
        dissolve = prev is not None and prev_calm and calm(shot.get("effects") or "")
        if dissolve:
            print(f"{shot['id']} calm dissolve {DISSOLVE_FRAMES} frames", flush=True)
        render_shot(painter, prev if dissolve else None, dissolve)
        mark = ROOT / "out" / "shot_video" / f"{shot['id']}.time"
        if mark.exists():
            total += float(mark.read_text().strip())
        prev = painter
        prev_calm = calm(shot.get("effects") or "")
    concat_and_mux(shots)
    write_checks(shots, spans)
    print(f"total frame render time: {total:.2f}s", flush=True)


if __name__ == "__main__":
    main()
