"""Draw full lyric sentences over the textless plates. Motion is not rendered here."""

from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from arkpipe.encode import ffmpeg_bin
from arkpipe.full2fx import (
    FONT_HERO,
    OUT_H,
    OUT_W,
    SONG_END,
    build_sentences,
    load_all_shots,
    load_bars,
    load_lyric_lines,
    segment_frames,
    sentence_motion,
    sentence_visible,
)
from render_full2 import FULL, _concat, _contact, _ffprobe, _frame_count

ROOT = Path(__file__).resolve().parent
PLATES = FULL / "plates"
OUT_DIR = FULL / "sent_segments"
FPS = 24
SENTENCE_PATH = ROOT / "timeline" / "sentences.json"


def save_sentences() -> list[dict]:
    sentences = build_sentences(load_lyric_lines(), load_bars())
    SENTENCE_PATH.write_text(json.dumps(sentences, indent=2) + "\n")
    return sentences


def load_sentences() -> list[dict]:
    if not SENTENCE_PATH.exists():
        return save_sentences()
    return json.loads(SENTENCE_PATH.read_text())


def _sprite(sentence: dict, motion: dict) -> np.ndarray:
    lines = [line.rstrip(" ,;:") for line in sentence["lines"]]
    font = ImageFont.truetype(str(FONT_HERO), 54)
    probe = ImageDraw.Draw(Image.new("L", (8, 8)))
    track = float(motion["track"])
    gap = 14
    measured = []
    for line in lines:
        shown = line if track < 0.5 else " ".join(line)
        box = probe.textbbox((0, 0), shown or "A", font=font)
        measured.append((shown, box[2] - box[0] + int(track * max(1, len(shown))), box[3] - box[1]))
    block_w = max(item[1] for item in measured) + 160
    block_h = sum(item[2] for item in measured) + gap * (len(measured) - 1) + 48
    image = Image.new("RGBA", (max(64, block_w), max(32, block_h)), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    y = 16
    for shown, width, height in measured:
        if track >= 0.5:
            x = 40.0
            for ch in shown:
                box = probe.textbbox((0, 0), ch, font=font)
                draw.text((x + 1, y + 2), ch, font=font, fill=(0, 0, 0, 150))
                draw.text((x, y), ch, font=font, fill=(236, 228, 210, 255))
                x += max(box[2] - box[0], font.getlength(ch)) + track
        else:
            box = probe.textbbox((0, 0), shown, font=font)
            x = (image.size[0] - (box[2] - box[0])) / 2 - box[0]
            draw.text((x + 2, y - box[1] + 2), shown, font=font, fill=(0, 0, 0, 150))
            draw.text((x, y - box[1]), shown, font=font, fill=(236, 228, 210, 255))
        y += height + gap
    sprite = np.array(image)
    alpha = float(motion["alpha"])
    sprite[:, :, 3] = (sprite[:, :, 3].astype(np.float32) * alpha).astype(np.uint8)
    wipe = float(motion["wipe"])
    if wipe < 0.999:
        cut = max(1, int(sprite.shape[1] * wipe))
        sprite[:, cut:, 3] = 0
    scale = float(motion["scale"])
    if abs(scale - 1.0) > 0.01:
        sprite = cv2.resize(sprite, (max(1, int(sprite.shape[1] * scale)), max(1, int(sprite.shape[0] * scale))), interpolation=cv2.INTER_LINEAR)
    blur = float(motion["blur"])
    if blur > 0.4:
        sprite = cv2.GaussianBlur(sprite, (0, 0), blur)
    max_w = 1600
    if sprite.shape[1] > max_w:
        scale = max_w / sprite.shape[1]
        sprite = cv2.resize(
            sprite,
            (max_w, max(1, int(sprite.shape[0] * scale))),
            interpolation=cv2.INTER_AREA,
        )
    return sprite


def _paste(rgb: np.ndarray, sprite: np.ndarray, x: int, y: int) -> None:
    h, w = rgb.shape[:2]
    sh, sw = sprite.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(w, x + sw), min(h, y + sh)
    if x1 <= x0 or y1 <= y0:
        return
    patch = sprite[y0 - y : y1 - y, x0 - x : x1 - x].astype(np.float32)
    alpha = patch[:, :, 3:4] / 255.0
    dest = rgb[y0:y1, x0:x1].astype(np.float32)
    rgb[y0:y1, x0:x1] = (dest * (1.0 - alpha) + patch[:, :, :3] * alpha).astype(np.uint8)


def draw_lyric(rgb: np.ndarray, sentences: list[dict], t: float) -> np.ndarray:
    active = next((sent for sent in sentences if sentence_visible(t, sent)), None)
    if active is None:
        return rgb
    motion = sentence_motion(active, t)
    if motion["shake"] > 0.08:
        shift = int(round(motion["shake"] * 5.0))
        matrix = np.array([[1, 0, shift], [0, 1, shift * 0.3]], np.float32)
        rgb = cv2.warpAffine(rgb, matrix, (rgb.shape[1], rgb.shape[0]), borderMode=cv2.BORDER_REFLECT)
    if motion["alpha"] <= 0.02:
        return rgb
    sprite = _sprite(active, motion)
    x = int(OUT_W * 0.5 - sprite.shape[1] / 2 + motion["dx"])
    y = int(OUT_H * 0.16 + motion["dy"])
    _paste(rgb, sprite, x, y)
    return rgb


def _encode(sentences: list[dict]) -> None:
    shots = load_all_shots()
    spans = segment_frames(shots)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for shot, (start, stop) in zip(shots, spans):
        n = stop - start
        dest = OUT_DIR / f"{shot['id']}.mp4"
        if dest.exists() and _frame_count(dest) == n:
            print(f"{shot['id']} sentence skip {n}", flush=True)
            continue
        src = PLATES / f"{shot['id']}.mp4"
        decode = [
            ffmpeg_bin(), "-v", "error", "-i", str(src),
            "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
        ]
        encode = [
            ffmpeg_bin(), "-y", "-hide_banner", "-loglevel", "error",
            "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{OUT_W}x{OUT_H}", "-r", str(FPS), "-i", "pipe:0",
            "-frames:v", str(n), "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p",
            "-preset", "veryfast", "-an", str(dest),
        ]
        reader = subprocess.Popen(decode, stdout=subprocess.PIPE)
        writer = subprocess.Popen(encode, stdin=subprocess.PIPE)
        assert reader.stdout is not None and writer.stdin is not None
        frame_bytes = OUT_W * OUT_H * 3
        for frame in range(start, stop):
            raw = reader.stdout.read(frame_bytes)
            if len(raw) < frame_bytes:
                break
            rgb = np.frombuffer(raw, dtype=np.uint8).reshape((OUT_H, OUT_W, 3)).copy()
            rgb = draw_lyric(rgb, sentences, frame / FPS)
            writer.stdin.write(np.ascontiguousarray(rgb).tobytes())
        writer.stdin.close()
        reader.stdout.close()
        writer.wait()
        reader.wait()
        print(f"{shot['id']} sentence overlay {n}", flush=True)


def main() -> None:
    print("sentence overlay render_sentences.py", flush=True)
    started = time.perf_counter()
    sentences = save_sentences()
    print(f"sentences {len(sentences)}", flush=True)
    _encode(sentences)
    shots = load_all_shots()
    listing = FULL / "concat.txt"
    listing.write_text(
        "\n".join(f"file '{(OUT_DIR / (shot['id'] + '.mp4')).resolve()}'" for shot in shots) + "\n"
    )
    # Re-encode so the 72 segments become one continuous 24 fps timeline.
    subprocess.run(
        [
            ffmpeg_bin(), "-y", "-hide_banner", "-loglevel", "error",
            "-f", "concat", "-safe", "0", "-i", str(listing),
            "-i", str(ROOT.parent / "song.mp3"),
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", "-preset", "veryfast",
            "-c:a", "aac", "-b:a", "192k",
            str(FULL / "genesis7_full_v2.mp4"),
        ],
        check=True,
    )
    import render_full2
    saved_segments = render_full2.SEGMENTS
    render_full2.SEGMENTS = OUT_DIR
    _contact(shots, segment_frames(shots), FULL / "genesis7_contact_v2.png")
    render_full2.SEGMENTS = saved_segments
    print(f"sentence pass {time.perf_counter() - started:.2f}s", flush=True)


if __name__ == "__main__":
    main()
