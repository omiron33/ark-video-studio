"""Render the v3 kinetic-type film. Does not write v1, v2, plates, or segments."""

from __future__ import annotations

import gc
import math
import subprocess
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from arkpipe.composite import _vignette, layer_affine
from arkpipe.encode import ffmpeg_bin
from arkpipe.full2fx import (
    FONT_HERO,
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
from arkpipe.v3type import build_sentences_v3, motion_v3
from render_full2 import FULL, _ffprobe, _frame_count
from render_preview import _prep, render_frame

ROOT = Path(__file__).resolve().parent
OUT_DIR = FULL / "segments_v3"
SENTENCE_PATH = ROOT / "timeline" / "sentences_v3.json"
FILM = FULL / "genesis7_full_v3.mp4"
CONTACT = FULL / "genesis7_contact_v3.png"
FPS = 24
FONT_PATHS = {
    "bebas": ROOT / "assets" / "fonts" / "BebasNeue-Regular.ttf",
    "cinzel": FONT_HERO,
    "cormorant": ROOT / "assets" / "fonts" / "CormorantGaramond.ttf",
    "archivo": ROOT / "assets" / "fonts" / "ArchivoBlack-Regular.ttf",
    "stencil": ROOT / "assets" / "fonts" / "StardosStencil-Bold.ttf",
    "dirt": ROOT / "assets" / "fonts" / "RubikDirt-Regular.ttf",
}
_FONT_CACHE: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}
_SPRITES: dict[int, np.ndarray] = {}


def _face(name: str, size: int) -> ImageFont.FreeTypeFont:
    key = (name, size)
    font = _FONT_CACHE.get(key)
    if font is None:
        font = ImageFont.truetype(str(FONT_PATHS[name]), size)
        _FONT_CACHE[key] = font
    return font


def glyph_covers(font: ImageFont.FreeTypeFont, char: str) -> bool:
    if not char or char.isspace():
        return True
    mask = font.getmask(char)
    ink = np.array(mask)
    return ink.size > 0 and int((ink > 0).sum()) >= 6


def glyph_sprite(font_name: str, text: str, size: int = 80) -> np.ndarray:
    """RGBA sample of `text` in one face, with a per-glyph fallback."""
    font = _face(font_name, size)
    fallback = _face("cormorant", size)
    probe = ImageDraw.Draw(Image.new("L", (4, 4)))
    width = 8
    ascent = 4
    descent = 4
    for char in text:
        use = font if glyph_covers(font, char) else fallback
        box = probe.textbbox((0, 0), char, font=use, anchor="ls")
        width += max(1, box[2] - box[0]) + 1
        ascent = max(ascent, int(-box[1]) + 2)
        descent = max(descent, int(box[3]) + 2)
    image = Image.new("RGBA", (max(16, width + 8), ascent + descent + 8), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    x = 4
    baseline = ascent + 2
    for char in text:
        use = font if glyph_covers(font, char) else fallback
        draw.text((x, baseline), char, font=use, fill=(236, 228, 210, 255), anchor="ls")
        box = probe.textbbox((0, 0), char, font=use, anchor="ls")
        x += max(1, box[2] - box[0]) + 1
    return np.array(image)


def _draw_on_baseline(draw, probe, x: float, baseline: int, word: str, font, fallback, fill) -> float:
    for char in word:
        use = font if glyph_covers(font, char) else fallback
        draw.text((x + 2, baseline + 2), char, font=use, fill=(0, 0, 0, 160), anchor="ls")
        draw.text((x, baseline), char, font=use, fill=fill, anchor="ls")
        box = probe.textbbox((0, 0), char, font=use, anchor="ls")
        x += max(1, box[2] - box[0]) + 1
    return x


def _raster(sentence: dict) -> np.ndarray:
    cached = _SPRITES.get(sentence["index"])
    if cached is not None:
        return cached
    emphasis = set()
    for key in sentence.get("emphasis") or []:
        emphasis.update(key.split())
    body = int(max(28, min(110, round(54 * float(sentence["size"])))))
    accent_px = int(body * 1.28)
    body_font = _face(sentence["font"], body)
    accent_font = _face(sentence["fonts"][-1], accent_px)
    fallback = _face("cormorant", body)
    fallback_accent = _face("cormorant", accent_px)
    probe = ImageDraw.Draw(Image.new("L", (4, 4)))
    gap = int(body * 0.34)
    line_rows = []
    for line in sentence["lines"]:
        words = line.split()
        pieces = []
        width = 0
        ascent = body
        descent = int(body * 0.28)
        for word in words:
            use_accent = word.strip(".,;:").lower() in emphasis
            font = accent_font if use_accent else body_font
            fall = fallback_accent if use_accent else fallback
            box = probe.textbbox((0, 0), word, font=font, anchor="ls")
            pieces.append((word, font, fall, use_accent))
            width += max(1, box[2] - box[0]) + int(body * 0.22)
            ascent = max(ascent, int(-box[1]) + 4)
            descent = max(descent, int(box[3]) + 4)
        line_rows.append((pieces, max(1, width), ascent, descent))
    block_w = max(row[1] for row in line_rows) + 48
    block_h = sum(row[2] + row[3] for row in line_rows) + gap * max(0, len(line_rows) - 1) + 16
    image = Image.new("RGBA", (max(64, block_w), max(32, block_h)), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    y = 8
    for pieces, width, ascent, descent in line_rows:
        x = max(16, (image.size[0] - width) / 2)
        baseline = y + ascent
        for word, font, fall, use_accent in pieces:
            fill = (248, 236, 206, 255) if use_accent else (236, 228, 210, 255)
            end = _draw_on_baseline(draw, probe, x, baseline, word, font, fall, fill)
            x = end + int(body * 0.18)
        y = baseline + descent + gap
    sprite = np.array(image)
    if sentence["layout"] == "diagonal":
        angle = -5.0
        rad = abs(angle) * math.pi / 180.0
        height, width = sprite.shape[:2]
        new_w = int(width * math.cos(rad) + height * math.sin(rad)) + 8
        new_h = int(height * math.cos(rad) + width * math.sin(rad)) + 8
        canvas = np.zeros((new_h, new_w, 4), np.uint8)
        y0 = (new_h - height) // 2
        x0 = (new_w - width) // 2
        canvas[y0 : y0 + height, x0 : x0 + width] = sprite
        matrix = cv2.getRotationMatrix2D((new_w / 2, new_h / 2), angle, 1.0)
        sprite = cv2.warpAffine(canvas, matrix, (new_w, new_h))
    if sprite.shape[1] > 1680:
        scale = 1680 / sprite.shape[1]
        sprite = cv2.resize(sprite, (1680, max(1, int(sprite.shape[0] * scale))), interpolation=cv2.INTER_AREA)
    _SPRITES[sentence["index"]] = sprite
    return sprite


def _affect(sprite: np.ndarray, motion: dict, sentence: dict, t: float) -> np.ndarray:
    spr = sprite.copy()
    reveal = float(motion["reveal"])
    if reveal < 0.999:
        cut = max(1, int(spr.shape[1] * reveal))
        spr[:, cut:, 3] = 0
    if motion["glitch"] > 0.08:
        shift = max(1, int(round(motion["glitch"] * 3)))

        def _slide(channel: np.ndarray, dx: int) -> np.ndarray:
            moved = np.zeros_like(channel)
            if dx > 0:
                moved[:, dx:] = channel[:, :-dx]
            elif dx < 0:
                moved[:, :dx] = channel[:, -dx:]
            else:
                return channel
            return moved

        spr[:, :, 0] = _slide(spr[:, :, 0], shift)
        spr[:, :, 2] = _slide(spr[:, :, 2], -shift)
        band = max(3, spr.shape[0] // 10)
        for y0 in range(band, spr.shape[0], band * 2):
            spr[y0 : y0 + 1] = _slide(spr[y0 : y0 + 1], shift)
    sweep = float(motion["sweep"])
    if sweep >= 0.0:
        centre = int(sweep * spr.shape[1])
        xs = np.arange(spr.shape[1])
        band = np.exp(-((xs - centre) ** 2) / (2 * 26.0**2))
        spr[:, :, :3] = np.clip(spr[:, :, :3].astype(np.float32) + band[None, :, None] * 90.0, 0, 255).astype(np.uint8)
    if motion["embers"] > 0.05:
        rng = np.random.default_rng(sentence["index"] * 97 + int(t * 12))
        height, width = spr.shape[:2]
        for _ in range(16):
            x = int(rng.integers(0, width))
            y = int(rng.integers(0, max(1, height // 2)))
            if spr[min(height - 1, y + 6), x, 3] > 30:
                spr[y, x] = (255, 150, 40, 230)
    alpha = float(motion["alpha"])
    spr[:, :, 3] = (spr[:, :, 3].astype(np.float32) * alpha).astype(np.uint8)
    scale = float(motion["scale"])
    if abs(scale - 1.0) > 0.015:
        spr = cv2.resize(spr, (max(1, int(spr.shape[1] * scale)), max(1, int(spr.shape[0] * scale))), interpolation=cv2.INTER_LINEAR)
    blur = float(motion["blur"])
    if blur > 0.4:
        spr = cv2.GaussianBlur(spr, (0, 0), blur)
    return spr


def solid_mask(depth: np.ndarray, sky: np.ndarray | None, rgb: np.ndarray | None, limit: float) -> np.ndarray:
    """Near rock, hull, or cloak. Sky, cloud, and a bright shaft do not occlude type."""
    near = depth > float(limit)
    if sky is not None:
        sky_s = sky if sky.shape[:2] == depth.shape[:2] else cv2.resize(sky.astype(np.float32), (depth.shape[1], depth.shape[0]))
        near = near & (sky_s < 0.35)
    if rgb is not None:
        luma = rgb.mean(axis=2).astype(np.float32)
        if float(luma.max()) > 1.5:
            luma = luma / 255.0
        near = near & (luma < 0.72)
    return near


def _paste(rgb: np.ndarray, sprite: np.ndarray, x: int, y: int, depth: np.ndarray | None, limit: float, sky: np.ndarray | None = None) -> None:
    height, width = rgb.shape[:2]
    sh, sw = sprite.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(width, x + sw), min(height, y + sh)
    if x1 <= x0 or y1 <= y0:
        return
    patch = sprite[y0 - y : y1 - y, x0 - x : x1 - x].astype(np.float32)
    alpha = patch[:, :, 3:4] / 255.0
    if depth is not None:
        local = depth[y0:y1, x0:x1]
        sky_local = None if sky is None else sky[y0:y1, x0:x1]
        blocked = solid_mask(local, sky_local, rgb[y0:y1, x0:x1], limit)
        alpha *= (~blocked).astype(np.float32)[..., None]
    dest = rgb[y0:y1, x0:x1].astype(np.float32)
    rgb[y0:y1, x0:x1] = (dest * (1.0 - alpha) + patch[:, :, :3] * alpha).astype(np.uint8)


def _active(sentences: list[dict], t: float) -> dict | None:
    for sent in sentences:
        if sent["start"] <= t < sent["end"]:
            return sent
    return None


def _warp_depth(prep: dict, pose) -> np.ndarray:
    plate_w, plate_h = prep["plate_size"]
    matrix = layer_affine(pose, 0.91, plate_w, plate_h, OUT_W, OUT_H)
    return cv2.warpAffine(prep["depth"].astype(np.float32), matrix, (OUT_W, OUT_H))


def paint_sentence(rgb: np.ndarray, prep: dict, pose, sentences: list[dict], t: float) -> np.ndarray:
    sent = _active(sentences, t)
    if sent is None:
        return rgb
    motion = motion_v3(sent, t)
    if motion["alpha"] <= 0.02:
        return rgb
    sprite = _affect(_raster(sent), motion, sent, t)
    max_w = OUT_W - 96
    if sprite.shape[1] > max_w:
        scale = max_w / sprite.shape[1]
        sprite = cv2.resize(sprite, (max_w, max(1, int(sprite.shape[0] * scale))), interpolation=cv2.INTER_AREA)
    ax, ay = sent["anchor"]
    if sent["layout"] in {"left", "diagonal", "bottom"}:
        x = int(ax * OUT_W + motion["dx"])
    elif sent["layout"] == "right":
        x = int(ax * OUT_W - sprite.shape[1] + motion["dx"])
    else:
        x = int(ax * OUT_W - sprite.shape[1] / 2 + motion["dx"])
    y = int(ay * OUT_H + motion["dy"] + motion["shake"] * 7.0)
    x = int(np.clip(x, 24, max(24, OUT_W - sprite.shape[1] - 24)))
    y = int(np.clip(y, 16, max(16, OUT_H - sprite.shape[0] - 16)))
    depth = None
    sky = None
    if float(sent["depth"]) < 0.8:
        depth = _warp_depth(prep, pose)
        if prep.get("sky_mask") is not None:
            plate_w, plate_h = prep["plate_size"]
            matrix = layer_affine(pose, 0.91, plate_w, plate_h, OUT_W, OUT_H)
            sky = cv2.warpAffine(prep["sky_mask"].astype(np.float32), matrix, (OUT_W, OUT_H))
    if depth is not None:
        for _ in range(8):
            covered = _covered(sprite, x, y, depth, float(sent["depth"]), sky)
            if covered <= 0.18 or x > OUT_W - sprite.shape[1] - 24:
                break
            x = min(x + 28, OUT_W - sprite.shape[1] - 24)
        if _covered(sprite, x, y, depth, float(sent["depth"]), sky) > 0.40:
            # A near surface that covers the whole line would hide the lyric.
            depth = None
    _paste(rgb, sprite, x, y, depth, float(sent["depth"]), sky)
    return rgb


def _covered(sprite: np.ndarray, x: int, y: int, depth: np.ndarray, limit: float, sky: np.ndarray | None = None) -> float:
    height, width = depth.shape
    sh, sw = sprite.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(width, x + sw), min(height, y + sh)
    if x1 <= x0 or y1 <= y0:
        return 1.0
    ink = sprite[y0 - y : y1 - y, x0 - x : x1 - x, 3] > 40
    if not np.any(ink):
        return 0.0
    sky_local = None if sky is None else sky[y0:y1, x0:x1]
    blocked = solid_mask(depth[y0:y1, x0:x1], sky_local, None, limit)
    return float((ink & blocked).sum()) / float(ink.sum())


def _encode(sentences: list[dict], shots, config, bars, beats) -> None:
    spans = segment_frames(shots)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for shot, (start, stop) in zip(shots, spans):
        n = stop - start
        dest = OUT_DIR / f"{shot['id']}.mp4"
        if dest.exists() and _frame_count(dest) == n:
            print(f"{shot['id']} v3 skip {n}", flush=True)
            continue
        t0 = time.perf_counter()
        prep = _prep(shot)
        prep["vignette"] = _vignette(OUT_H, OUT_W)
        fx = config[shot["id"]]
        cmd = [
            ffmpeg_bin(), "-y", "-hide_banner", "-loglevel", "error",
            "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{OUT_W}x{OUT_H}", "-r", str(FPS), "-i", "pipe:0",
            "-frames:v", str(n), "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p",
            "-preset", "veryfast", "-an", str(dest),
        ]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        assert proc.stdin is not None
        fade = "fade" in (shot.get("camera") or "").lower() or "fade" in (shot.get("motion") or "").lower()
        for frame in range(start, stop):
            t = frame / FPS
            pose = camera_at(t, shot, config, bars, frame=frame)
            rgb = render_frame(prep, shot, fx, pose, t, beats, draw_hero=False)
            rgb = paint_sentence(rgb, prep, pose, sentences, t)
            if fade and frame > stop - 48:
                scale = max(0.0, (stop - frame) / 48.0)
                rgb = (rgb.astype(np.float32) * scale).astype(np.uint8)
            proc.stdin.write(np.ascontiguousarray(rgb).tobytes())
            local = frame - start
            if local % 48 == 0:
                print(f"{shot['id']} v3 {local + 1}/{n}", flush=True)
        proc.stdin.close()
        code = proc.wait()
        del prep
        gc.collect()
        if code != 0:
            raise RuntimeError(f"ffmpeg failed for {shot['id']} ({code})")
        elapsed = time.perf_counter() - t0
        print(f"{shot['id']} v3 {elapsed:.2f}s ({n} frames)", flush=True)


def _concat(shots) -> None:
    listing = FULL / "concat_v3.txt"
    listing.write_text("".join(f"file '{(OUT_DIR / (shot['id'] + '.mp4')).resolve()}'\n" for shot in shots))
    subprocess.run(
        [
            ffmpeg_bin(), "-y", "-hide_banner", "-loglevel", "error",
            "-f", "concat", "-safe", "0", "-i", str(listing),
            "-i", str(ROOT.parent / "song.mp3"),
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", "-preset", "veryfast",
            "-c:a", "aac", "-b:a", "192k",
            str(FILM),
        ],
        check=True,
    )


def _contact(shots) -> None:
    spans = segment_frames(shots)
    cols = 8
    thumb_w, thumb_h = 240, 135
    label_h = 22
    tiles = []
    for shot, (start, stop) in zip(shots, spans):
        local = max(0, (stop - start) // 2)
        raw = subprocess.run(
            [
                ffmpeg_bin(), "-v", "error", "-i", str(OUT_DIR / f"{shot['id']}.mp4"),
                "-vf", f"select=eq(n\\,{local})", "-vframes", "1",
                "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
            ],
            capture_output=True,
            check=True,
        )
        frame = np.frombuffer(raw.stdout, dtype=np.uint8).reshape((OUT_H, OUT_W, 3))
        bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        thumb = cv2.resize(bgr, (thumb_w, thumb_h), interpolation=cv2.INTER_AREA)
        cell = np.zeros((thumb_h + label_h, thumb_w, 3), np.uint8)
        cell[:thumb_h] = thumb
        cv2.putText(cell, f"{shot['id']} {(start + local) / FPS:.1f}s", (4, thumb_h + 16), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (230, 230, 230), 1, cv2.LINE_AA)
        tiles.append(cell)
    while len(tiles) % cols:
        tiles.append(np.zeros_like(tiles[0]))
    rows = [np.concatenate(tiles[i : i + cols], axis=1) for i in range(0, len(tiles), cols)]
    cv2.imwrite(str(CONTACT), np.concatenate(rows, axis=0))
    print(f"wrote {CONTACT}", flush=True)


def spot_frames(sentences, shots, config, bars, beats) -> None:
    """A few frames before the long render, written under v3_checks."""
    dest = FULL / "v3_checks"
    dest.mkdir(parents=True, exist_ok=True)
    glitch = next(sent for sent in sentences if sent["fx"] == "glitch")
    behind = next(sent for sent in sentences if sent["depth"] <= 0.5 and sent["end"] - sent["start"] > 1.0)
    picks = {
        "spot_gap.png": 4.0,
        "spot_hold.png": next(sent["start"] for sent in sentences if len(sent["lines"]) >= 2) + 1.2,
        "spot_glitch.png": glitch["hit_times"][0] if glitch["hit_times"] else glitch["start"] + 0.1,
        "spot_behind.png": (behind["start"] + behind["end"]) / 2,
    }
    by_id = {}
    for shot, (start, stop) in zip(shots, segment_frames(shots)):
        by_id[shot["id"]] = (shot, start, stop)
    preps = {}
    for name, t in picks.items():
        shot = next(item for item in shots if float(item["in"]) <= t < float(item["out"]))
        if shot["id"] not in preps:
            preps[shot["id"]] = _prep(shot)
            preps[shot["id"]]["vignette"] = _vignette(OUT_H, OUT_W)
        prep = preps[shot["id"]]
        frame = int(round(t * FPS))
        pose = camera_at(t, shot, config, bars, frame=frame)
        rgb = render_frame(prep, shot, config[shot["id"]], pose, t, beats, draw_hero=False)
        rgb = paint_sentence(rgb, prep, pose, sentences, t)
        cv2.imwrite(str(dest / name), cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
        print(f"spot {name} t={t:.2f} {shot['id']}", flush=True)


def recheck_frames(sentences, shots, config, bars, beats) -> None:
    dest = FULL / "v3_checks"
    dest.mkdir(parents=True, exist_ok=True)
    picks = {}
    for shot in shots:
        if shot["id"] not in {f"s0{i}" for i in range(1, 7)}:
            continue
        t0, t1 = float(shot["in"]), float(shot["out"])
        inside = [sent for sent in sentences if sent["start"] < t1 and sent["end"] > t0]
        t = inside[0]["start"] + 0.45 if inside else (t0 + t1) / 2
        t = min(max(t, t0 + 0.05), t1 - 0.05)
        picks[f"{shot['id']}.png"] = t
    glitch = next(sent for sent in sentences if sent["fx"] == "glitch" and sent["hit_times"])
    picks["powerful.png"] = glitch["hit_times"][0]
    lantern = next(shot for shot in shots if "lantern" in (shot.get("still") or ""))
    picks["lantern.png"] = (float(lantern["in"]) + float(lantern["out"])) / 2
    preps = {}
    for name, t in picks.items():
        shot = next(item for item in shots if float(item["in"]) <= t < float(item["out"]))
        if shot["id"] not in preps:
            preps[shot["id"]] = _prep(shot)
            preps[shot["id"]]["vignette"] = _vignette(OUT_H, OUT_W)
        frame = int(round(t * FPS))
        pose = camera_at(t, shot, config, bars, frame=frame)
        rgb = render_frame(preps[shot["id"]], shot, config[shot["id"]], pose, t, beats, draw_hero=False)
        rgb = paint_sentence(rgb, preps[shot["id"]], pose, sentences, t)
        cv2.imwrite(str(dest / name), cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
        print(f"recheck {name} t={t:.2f} {shot['id']}", flush=True)


def main() -> None:
    import json
    import sys

    print("v3 render_v3.py", flush=True)
    started = time.perf_counter()
    sentences = build_sentences_v3()
    SENTENCE_PATH.write_text(json.dumps(sentences, indent=2) + "\n")
    print(f"sentences_v3 {len(sentences)}", flush=True)
    shots = load_all_shots()
    locked = {key: load_fx()[key] for key in ("s01", "s02", "s03", "s04") if key in load_fx()}
    config = build_fx(shots, locked)
    bars = [item for item in load_bars() if 0.0 <= item <= SONG_END]
    beats = [item for item in load_beats() if 0.0 <= item <= SONG_END]
    if "--spot" in sys.argv:
        spot_frames(sentences, shots, config, bars, beats)
        return
    if "--recheck" in sys.argv:
        recheck_frames(sentences, shots, config, bars, beats)
        return
    _encode(sentences, shots, config, bars, beats)
    _concat(shots)
    _contact(shots)
    print(f"v3 pass {time.perf_counter() - started:.2f}s", flush=True)
    print(_ffprobe(), flush=True)


if __name__ == "__main__":
    main()
