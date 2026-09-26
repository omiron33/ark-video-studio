"""Render the s01-s04 Genesis Chapter 7 preview.

    .venv/bin/python render_preview.py

Does not call the full-song timeline renderer.
"""

from __future__ import annotations

import math
import subprocess
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from arkpipe.composite import _grain, _vignette, grade_teal_amber, layer_affine
from arkpipe.encode import ffmpeg_bin
from arkpipe.full2fx import (
    FONT_HERO,
    FONT_VERSE,
    OUT_H,
    OUT_W,
    PLATE_H,
    PLATE_W,
    PREVIEW_END,
    camera_at,
    condense_offsets,
    descend_anchor,
    frames_since_word,
    hero_color,
    hero_raster,
    layer_params,
    load_bars,
    load_beats,
    load_fx,
    load_preview_shots,
    shot_frame_span,
    verse_reveal,
    word_visible,
)
from arkpipe.prep import load_or_build_prep

ROOT = Path(__file__).resolve().parent
STORY = ROOT.parent
PREVIEW = STORY / "full2" / "preview"
FPS = 24


def _sky_mask(depth: np.ndarray) -> np.ndarray:
    h = depth.shape[0]
    vertical = np.linspace(1.0, 0.15, h, dtype=np.float32)[:, None]
    far = 1.0 - depth
    mask = np.clip(far * vertical, 0.0, 1.0)
    return cv2.GaussianBlur(mask, (0, 0), 8.0)


def _ground_mask(depth: np.ndarray) -> np.ndarray:
    h = depth.shape[0]
    low = np.zeros(depth.shape, np.float32)
    low[int(h * 0.55) :] = 1.0
    mask = np.clip(depth * low, 0.0, 1.0)
    return cv2.GaussianBlur(mask, (0, 0), 6.0)


def _prep(shot: dict) -> dict:
    still = STORY / "full2" / "stills" / shot["still"]
    rel = str(still.resolve().relative_to(ROOT) if False else still)
    # Keep the cache under the repo without joining an absolute path onto "/".
    import os
    rel = os.path.relpath(still, ROOT)
    cfg = {
        "id": f"full2_{shot['id']}",
        "source_image": rel,
        "plate_width": PLATE_W,
        "plate_height": PLATE_H,
        "layers": 3,
        "feather_px": 4.0,
        "reveal_px": 48,
        "depth_preview": str(PREVIEW / f"depth_{shot['id']}.png"),
    }
    prep, hit = load_or_build_prep(cfg, ROOT)
    print(f"{shot['id']} prep cache {'hit' if hit else 'miss'}", flush=True)
    print("depth model released", flush=True)
    prep["sky_mask"] = _sky_mask(prep["depth"])
    prep["ground_mask"] = _ground_mask(prep["depth"])
    return prep


def _parallax(prep: dict, pose) -> np.ndarray:
    plate_w, plate_h = prep["plate_size"]
    n_layers = len(prep["masks"])
    # A tight spread keeps the camera move, without peeling a small figure into a ghost.
    parallax = np.linspace(0.82, 1.0, n_layers)
    acc = None
    for i in range(n_layers):
        matrix = layer_affine(pose, float(parallax[i]), plate_w, plate_h, OUT_W, OUT_H)
        warped = cv2.warpAffine(
            prep["plates"][i], matrix, (OUT_W, OUT_H),
            flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_REPLICATE if i == 0 else cv2.BORDER_CONSTANT,
        ).astype(np.float32) / 255.0
        if i == 0:
            acc = warped
        else:
            alpha = cv2.warpAffine(
                prep["masks"][i].astype(np.float32), matrix, (OUT_W, OUT_H),
                flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT,
            )[..., None]
            acc = warped * alpha + acc * (1.0 - alpha)
    return acc


def _roll_clouds(rgb: np.ndarray, sky: np.ndarray, t: float, params: dict) -> np.ndarray:
    amp = float(params.get("amp", 0.0))
    if amp <= 0.0:
        return rgb
    h, w = rgb.shape[:2]
    speed = float(params.get("speed", 12.0))
    ys = np.arange(h, dtype=np.float32)
    xs = np.arange(w, dtype=np.float32)
    shift = speed * t + 10.0 * np.sin(ys * 0.01 + t * 0.4)
    map_x = np.broadcast_to(xs, (h, w)).astype(np.float32) - shift[:, None]
    map_y = np.broadcast_to(ys[:, None], (h, w)).astype(np.float32)
    moved = cv2.remap(rgb, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    mask = cv2.resize(sky, (w, h), interpolation=cv2.INTER_LINEAR)[..., None] * amp
    return rgb * (1.0 - mask) + moved * mask


def _fog(rgb: np.ndarray, t: float, params: dict, seed: int) -> np.ndarray:
    amount = float(params.get("amount", 0.0))
    if amount <= 0.0:
        return rgb
    h, w = rgb.shape[:2]
    rng = np.random.default_rng(seed + 3)
    base = rng.random((h // 8, w // 8), dtype=np.float32)
    base = cv2.GaussianBlur(base, (0, 0), 2.2)
    speed = float(params.get("speed", 8.0))
    matrix = np.array([[1, 0, t * speed], [0, 1, t * 2.0]], np.float32)
    moved = cv2.warpAffine(base, matrix, (base.shape[1], base.shape[0]), borderMode=cv2.BORDER_WRAP)
    fog = cv2.resize(moved, (w, h), interpolation=cv2.INTER_LINEAR)
    vertical = np.linspace(0.25, 1.0, h, dtype=np.float32)[:, None]
    alpha = np.clip(fog * vertical * amount, 0.0, 0.45)[..., None]
    color = np.array([0.12, 0.16, 0.17], np.float32)
    return rgb * (1.0 - alpha) + color * alpha


def _grass(rgb: np.ndarray, ground: np.ndarray, t: float, params: dict) -> np.ndarray:
    amp = float(params.get("amp", 0.0))
    if amp <= 0.0:
        return rgb
    h, w = rgb.shape[:2]
    ys = np.arange(h, dtype=np.float32)
    xs = np.arange(w, dtype=np.float32)
    weight = np.clip((ys - h * 0.45) / (h * 0.55), 0.0, 1.0)
    sway = amp * np.sin(xs * 0.035 + t * 2.4)[None, :] * weight[:, None]
    map_x = np.broadcast_to(xs, (h, w)).astype(np.float32) - sway
    map_y = np.broadcast_to(ys[:, None], (h, w)).astype(np.float32)
    moved = cv2.remap(rgb, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    mask = cv2.resize(ground, (w, h), interpolation=cv2.INTER_LINEAR)[..., None]
    return rgb * (1.0 - mask) + moved * mask


def _dust(rgb: np.ndarray, t: float, params: dict, seed: int) -> np.ndarray:
    count = int(params.get("count", 0))
    if count <= 0:
        return rgb
    h, w = rgb.shape[:2]
    rng = np.random.default_rng(seed + 9)
    x0 = rng.uniform(0, w, count)
    y0 = rng.uniform(h * 0.35, h * 0.92, count)
    speed = float(params.get("speed", 40.0)) * rng.uniform(0.6, 1.3, count)
    phase = rng.uniform(0, 6.0, count)
    xs = np.mod(x0 + t * speed, w + 20) - 10
    ys = y0 + 4.0 * np.sin(t * 1.3 + phase)
    overlay = np.zeros((h, w), np.float32)
    for i in range(count):
        x = int(xs[i])
        y = int(ys[i])
        if 1 <= x < w - 1 and 1 <= y < h - 1:
            overlay[y, x] = 0.7
            overlay[y, x - 1] = 0.25
    overlay = cv2.GaussianBlur(overlay, (0, 0), 0.8)
    color = np.array([0.72, 0.62, 0.46], np.float32)
    return np.clip(rgb + overlay[..., None] * color * 0.55, 0.0, 1.0)


def _godrays(rgb: np.ndarray, t: float, params: dict) -> np.ndarray:
    strength = float(params.get("strength", 0.0))
    if strength <= 0.0:
        return rgb
    h, w = rgb.shape[:2]
    ox = float(params.get("origin_x", 0.5)) * w
    oy = float(params.get("origin_y", 0.0)) * h
    yy, xx = np.mgrid[0:h, 0:w]
    depth = np.clip(yy - oy, 0.0, None)
    half = 22.0 + depth * 0.11
    beam = np.exp(-0.5 * ((xx - ox) / half) ** 2)
    beam *= np.clip(depth / (h * 0.08), 0.0, 1.0)
    beam *= np.exp(-depth / (h * 0.9))
    flick = 0.8 + 0.2 * math.sin(t * 7.0)
    ray = (beam * strength * flick).astype(np.float32)
    color = np.array([0.92, 0.86, 0.7], np.float32)
    return np.clip(rgb + ray[..., None] * color * 0.7, 0.0, 1.0)


def _motes(rgb: np.ndarray, t: float, params: dict, seed: int) -> np.ndarray:
    count = int(params.get("count", 0))
    if count <= 0:
        return rgb
    h, w = rgb.shape[:2]
    rng = np.random.default_rng(seed + 17)
    x0 = rng.normal(float(params.get("origin_x", 0.5)) * w, w * 0.08, count)
    y0 = rng.uniform(0, h * 0.7, count)
    overlay = np.zeros((h, w), np.float32)
    for i in range(count):
        y = int((y0[i] + t * 18.0 + i * 7) % (h * 0.75))
        x = int(x0[i] + 6.0 * math.sin(t * 1.4 + i))
        if 0 <= x < w and 0 <= y < h:
            overlay[y, x] = 1.0
    overlay = cv2.GaussianBlur(overlay, (0, 0), 1.1)
    return np.clip(rgb + overlay[..., None] * np.array([0.9, 0.84, 0.7], np.float32) * 0.45, 0.0, 1.0)


def _rain(rgb: np.ndarray, t: float, params: dict, seed: int) -> np.ndarray:
    count = int(params.get("count", 0))
    if count <= 0:
        return rgb
    h, w = rgb.shape[:2]
    rng = np.random.default_rng(seed + 5)
    x0 = rng.uniform(0, w, count)
    y0 = rng.uniform(0, 1, count)
    speed = float(params.get("speed", 480.0))
    overlay = np.zeros((h, w), np.float32)
    for i in range(count):
        y = int((y0[i] * h + t * speed) % (h + 30)) - 15
        x = int((x0[i] + t * 18.0) % w)
        y2 = y + 14
        if 0 <= x < w and y2 > 0 and y < h:
            cv2.line(overlay, (x, max(0, y)), (x + 2, min(h - 1, y2)), 0.55, 1, cv2.LINE_AA)
    return np.clip(rgb + overlay[..., None] * np.array([0.62, 0.7, 0.74], np.float32), 0.0, 1.0)


def _water(rgb: np.ndarray, t: float, params: dict) -> np.ndarray:
    amp = float(params.get("amp", 0.0))
    if amp <= 0.0:
        return rgb
    h, w = rgb.shape[:2]
    ys = np.arange(h, dtype=np.float32)
    xs = np.arange(w, dtype=np.float32)
    weight = np.clip((ys - h * 0.42) / (h * 0.58), 0.0, 1.0)
    shift = (4.0 + 10.0 * amp) * weight * np.sin(t * 1.1 + ys * 0.04)
    map_x = np.broadcast_to(xs, (h, w)).astype(np.float32) - shift[:, None]
    map_y = np.broadcast_to(ys[:, None], (h, w)).astype(np.float32)
    moved = cv2.remap(rgb, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    mask = weight[:, None, None]
    return rgb * (1.0 - mask) + moved * mask


def _lightning(rgb: np.ndarray, t: float, params: dict, beats: list[float]) -> tuple[np.ndarray, float]:
    strength = float(params.get("strength", 0.0))
    if strength <= 0.0 or not beats:
        return rgb, 0.0
    nearest = min(abs(t - b) for b in beats)
    if nearest > 0.09:
        return rgb, 0.0
    amount = (1.0 - nearest / 0.09) * strength
    h, w = rgb.shape[:2]
    band = np.zeros((h, w), np.float32)
    y0, y1 = int(h * 0.38), int(h * 0.52)
    band[y0:y1] = 1.0
    band = cv2.GaussianBlur(band, (0, 0), 12.0)
    lift = np.array([0.15, 0.55, 0.62], np.float32) * amount
    return np.clip(rgb + band[..., None] * lift, 0.0, 1.0), amount


def _paste(rgb: np.ndarray, sprite: np.ndarray, x: int, y: int) -> None:
    h, w = rgb.shape[:2]
    sh, sw = sprite.shape[:2]
    x0 = max(0, x)
    y0 = max(0, y)
    x1 = min(w, x + sw)
    y1 = min(h, y + sh)
    if x1 <= x0 or y1 <= y0:
        return
    sx0 = x0 - x
    sy0 = y0 - y
    patch = sprite[sy0 : sy0 + (y1 - y0), sx0 : sx0 + (x1 - x0)].astype(np.float32) / 255.0
    alpha = patch[:, :, 3:4]
    dest = rgb[y0:y1, x0:x1]
    rgb[y0:y1, x0:x1] = dest * (1.0 - alpha) + patch[:, :, :3] * alpha


def _blit_text(rgb: np.ndarray, text: str, font: ImageFont.FreeTypeFont, xy: tuple[int, int], fill: tuple[int, int, int, int]) -> None:
    if not text or fill[3] <= 0:
        return
    probe = ImageDraw.Draw(Image.new("L", (4, 4)))
    box = probe.textbbox((0, 0), text, font=font)
    width = box[2] - box[0] + 8
    height = box[3] - box[1] + 8
    alpha = Image.new("L", (width, height), 0)
    ImageDraw.Draw(alpha).text((4 - box[0], 4 - box[1]), text, font=font, fill=fill[3])
    mask = np.array(alpha, dtype=np.uint8)
    sprite = np.zeros((height, width, 4), np.uint8)
    sprite[:, :, 0] = fill[0]
    sprite[:, :, 1] = fill[1]
    sprite[:, :, 2] = fill[2]
    sprite[:, :, 3] = mask
    _paste(rgb, sprite, xy[0], xy[1])


def _draw_type(rgb: np.ndarray, shot: dict, fx: dict, t: float, u: float) -> np.ndarray:
    text = fx["text"]
    treatment = text["treatment"]
    hero_font = ImageFont.truetype(str(FONT_HERO), 92)
    title_font = ImageFont.truetype(str(FONT_HERO), 54)
    verse_font = ImageFont.truetype(str(FONT_VERSE), 32)
    ref_font = ImageFont.truetype(str(FONT_VERSE), 28)
    out = rgb
    title = text.get("title") or ""
    probe = ImageDraw.Draw(Image.new("L", (4, 4)))
    if title and treatment in {"condense_fog", "lightning_flash"}:
        gather = min(1.0, u / 0.45) if treatment == "condense_fog" else 1.0
        if treatment == "lightning_flash":
            gather = 1.0
        offsets = condense_offsets(len(title), gather, spread=18.0)
        alpha = int(50 + 150 * gather) if treatment == "condense_fog" else 110
        widths = []
        for ch in title:
            box = probe.textbbox((0, 0), ch, font=title_font)
            widths.append(max(8, box[2] - box[0]))
        total = sum(widths) + int(sum(abs(v) for v in offsets) * 0.15)
        base_x = int(OUT_W * 0.5 - total / 2)
        base_y = int(OUT_H * 0.08)
        cursor = 0
        for ch, extra, width in zip(title, offsets, widths):
            _blit_text(out, ch, title_font, (base_x + cursor + int(extra), base_y), (226, 214, 190, alpha))
            cursor += width + 2
    words = shot.get("words") or []
    for index, word in enumerate(words):
        spec = {
            "start": float(word["start"]),
            "hold_until": float(words[index + 1]["start"]) if index + 1 < len(words) else float(shot["out"]),
        }
        if not word_visible(t, spec):
            continue
        since = frames_since_word(t, spec["start"])
        label = word["word"].strip().strip(",").upper()
        if treatment == "lightning_flash":
            if since < 2:
                out[:] = np.clip(out * 0.72 + 0.28, 0.0, 1.0)
            sprite = hero_raster(treatment, since, label, size=140)
            x = int(OUT_W * text["hero_anchor"][0] - sprite.shape[1] / 2)
            y = int(OUT_H * text["hero_anchor"][1])
            _paste(out, sprite, x, y)
        elif treatment == "shaft_descend":
            local = min(1.0, max(0.0, (t - spec["start"]) / 0.7))
            ax, ay = descend_anchor(local, tuple(text["hero_anchor"]))
            color = hero_color(treatment, since)
            sprite = hero_raster(treatment, since, label, size=110)
            _paste(out, sprite, int(ax * OUT_W), int(ay * OUT_H))
        elif treatment == "sink_fade":
            sprite = hero_raster(treatment, since, label, size=100)
            fade = max(0.2, 1.0 - since / 40.0)
            sprite = sprite.copy()
            sprite[:, :, 3] = (sprite[:, :, 3].astype(np.float32) * fade).astype(np.uint8)
            y = int(OUT_H * text["hero_anchor"][1] + since * 3)
            _paste(out, sprite, int(OUT_W * text["hero_anchor"][0]), y)
        elif treatment == "float_bob":
            sprite = hero_raster(treatment, since, label, size=100)
            y = int(OUT_H * text["hero_anchor"][1] + 12 * math.sin(t * 1.4))
            _paste(out, sprite, int(OUT_W * text["hero_anchor"][0]), y)
        elif treatment == "slide_across":
            sprite = hero_raster(treatment, since, label, size=96)
            x = int(OUT_W * (0.12 + 0.45 * min(1.0, (t - spec["start"]) / 1.4)))
            _paste(out, sprite, x, int(OUT_H * text["hero_anchor"][1]))
        elif treatment == "chisel_rock":
            sprite = hero_raster(treatment, max(since, 0), label, size=100)
            x = int(OUT_W * text["hero_anchor"][0])
            y = int(OUT_H * text["hero_anchor"][1] + index * 70)
            _paste(out, sprite, x, y)
            if since < 8:
                rng = np.random.default_rng(index * 19 + since)
                for _ in range(6):
                    cx = x + int(rng.integers(0, max(8, sprite.shape[1])))
                    cy = y + int(rng.integers(0, max(8, sprite.shape[0]))) + since * 2
                    if 0 <= cx < OUT_W and 0 <= cy < OUT_H:
                        out[cy, cx] = np.clip(out[cy, cx] + np.array([0.45, 0.4, 0.32]), 0, 1)
        else:
            color = hero_color(treatment, since)
            _blit_text(out, label, hero_font, (int(OUT_W * 0.32), int(OUT_H * 0.22)), color)
    reveal = verse_reveal(u)
    if reveal > 0.02:
        ref_a = int(180 * reveal)
        line_a = int(150 * reveal)
        vx = int(OUT_W * text["verse_anchor"][0])
        vy = int(OUT_H * text["verse_anchor"][1])
        _blit_text(out, text["verse_ref"], ref_font, (vx, vy), (214, 196, 160, ref_a))
        shown = text["verse_line"]
        cut = max(1, int(len(shown) * reveal))
        _blit_text(out, shown[:cut], verse_font, (vx, vy + 34), (196, 188, 170, line_a))
    return out


def render_frame(prep: dict, shot: dict, fx: dict, pose, t: float, beats: list[float]) -> np.ndarray:
    layers = layer_params(shot["id"], fx if False else {shot["id"]: fx})
    # layer_params expects the whole config. Pass a one-shot map.
    rgb = _parallax(prep, pose)
    t0 = float(shot["in"])
    t1 = float(shot["out"])
    u = min(1.0, max(0.0, (t - t0) / max(1e-6, t1 - t0)))
    rgb = _roll_clouds(rgb, prep["sky_mask"], t, layers["clouds"])
    rgb = _fog(rgb, t, layers["fog"], seed=100 + int(shot["id"][1:]))
    rgb = _grass(rgb, prep["ground_mask"], t, layers["grass"])
    rgb = _dust(rgb, t, layers["dust"], seed=200 + int(shot["id"][1:]))
    rgb = _godrays(rgb, t, layers["godrays"])
    rgb = _motes(rgb, t, layers["motes"], seed=300 + int(shot["id"][1:]))
    rgb, _flash = _lightning(rgb, t, layers.get("lightning", {"strength": 0}), beats)
    rgb = _rain(rgb, t, layers.get("rain", {"count": 0}), seed=400 + int(shot["id"][1:]))
    rgb = _water(rgb, t, layers.get("water", {"amp": 0}))
    rgb = grade_teal_amber(rgb)
    vignette = prep["vignette"]
    rgb = rgb * vignette[..., None]
    rgb = _grain(rgb, 11 + int(shot["id"][1:]), pose.frame)
    rgb = _draw_type(rgb, shot, fx, t, u)
    return np.clip(rgb * 255.0 + 0.5, 0, 255).astype(np.uint8)


def _contact(frames: list[tuple[float, np.ndarray]], dest: Path) -> None:
    cols = 4
    thumb_w, thumb_h = 480, 270
    label_h = 28
    tiles = []
    for stamp, rgb in frames:
        bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        thumb = cv2.resize(bgr, (thumb_w, thumb_h), interpolation=cv2.INTER_AREA)
        cell = np.zeros((thumb_h + label_h, thumb_w, 3), np.uint8)
        cell[:thumb_h] = thumb
        cv2.putText(cell, f"{stamp:.2f}s", (8, thumb_h + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (230, 230, 230), 1, cv2.LINE_AA)
        tiles.append(cell)
    while len(tiles) % cols:
        tiles.append(np.zeros_like(tiles[0]))
    rows = []
    for i in range(0, len(tiles), cols):
        rows.append(np.concatenate(tiles[i : i + cols], axis=1))
    sheet = np.concatenate(rows, axis=0)
    dest.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(dest), sheet)


def main() -> None:
    print("preview entry render_preview.py", flush=True)
    print("not launching render_timeline", flush=True)
    started = time.perf_counter()
    shots = load_preview_shots()
    config = load_fx()
    bars = [b for b in load_bars() if 0.0 <= b <= PREVIEW_END]
    beats = [b for b in load_beats() if 0.0 <= b <= PREVIEW_END]
    spans = shot_frame_span(shots)
    total = spans[-1][1]
    print(f"frames {total} spans {spans}", flush=True)
    PREVIEW.mkdir(parents=True, exist_ok=True)
    preps = []
    for shot in shots:
        prep = _prep(shot)
        prep["vignette"] = _vignette(OUT_H, OUT_W)
        preps.append(prep)
    samples = {1.20, 3.50, 5.20, 8.20, 10.04, 10.25, 11.08, 12.08, 13.20, 18.40, 20.42, 21.00}
    held: list[tuple[float, np.ndarray]] = []
    out = PREVIEW / "s01_s04_preview.mp4"
    cmd = [
        ffmpeg_bin(), "-y", "-hide_banner", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{OUT_W}x{OUT_H}", "-r", str(FPS), "-i", "pipe:0",
        "-ss", "0", "-t", f"{PREVIEW_END:.3f}", "-i", str(STORY / "song.mp3"),
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-preset", "veryfast",
        "-c:a", "aac", "-b:a", "192k", "-shortest",
        str(out),
    ]
    print("ffmpeg: " + " ".join(cmd), flush=True)
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    assert proc.stdin is not None
    cursor = 0
    for shot, prep, (start, stop) in zip(shots, preps, spans):
        fx = config[shot["id"]]
        for frame in range(start, stop):
            t = frame / FPS
            pose = camera_at(t, shot, config, bars, frame=frame)
            rgb = render_frame(prep, shot, fx, pose, t, beats)
            proc.stdin.write(np.ascontiguousarray(rgb).tobytes())
            if any(abs(t - s) < 0.5 / FPS for s in samples):
                held.append((t, rgb.copy()))
            cursor += 1
            if cursor % 48 == 0:
                print(f"frame {cursor}/{total}", flush=True)
    proc.stdin.close()
    code = proc.wait()
    if code != 0:
        raise RuntimeError(f"ffmpeg failed ({code})")
    held.sort(key=lambda item: item[0])
    _contact(held, PREVIEW / "frames_contact.png")
    elapsed = time.perf_counter() - started
    (PREVIEW / "render_time.txt").write_text(f"{elapsed:.2f}\n")
    print(f"preview render time: {elapsed:.2f}s", flush=True)
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main()
