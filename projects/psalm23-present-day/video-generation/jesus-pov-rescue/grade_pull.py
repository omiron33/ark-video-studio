"""Finish the existing POV rescue shot with a measured warm pull into light.

This changes only color and a tiny smooth photographic push in the latter half
of the existing generated footage. It creates no additional scene or frames.
"""

from pathlib import Path
import argparse
import hashlib
import json
import subprocess

import numpy as np
from PIL import Image


WIDTH, HEIGHT, FPS = 960, 540, 24
FRAME_BYTES = WIDTH * HEIGHT * 3


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read_exact(stream, count):
    chunks = []
    size = 0
    while size < count:
        chunk = stream.read(count - size)
        if not chunk:
            break
        chunks.append(chunk)
        size += len(chunk)
    return b"".join(chunks)


def run(source, target, mode):
    source, target = Path(source), Path(target)
    probe = json.loads(subprocess.run(
        ["ffprobe", "-v", "error", "-count_frames", "-show_streams", "-of", "json", str(source)],
        check=True, capture_output=True, text=True).stdout)
    stream = next(s for s in probe["streams"] if s["codec_type"] == "video")
    assert (int(stream["width"]), int(stream["height"])) == (WIDTH, HEIGHT)
    count = int(stream["nb_read_frames"])
    decoder = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", str(source), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    encoder = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{WIDTH}x{HEIGHT}",
         "-r", str(FPS), "-i", "pipe:0", "-an", "-c:v", "libx264", "-crf", "17", "-preset", "slow",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(target)],
        stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    yy, xx = np.mgrid[0:HEIGHT, 0:WIDTH].astype(np.float32)
    if mode == "pov":
        spread = np.exp(-0.5 * (((xx - 355) / 640) ** 2 + ((yy - 485) / 460) ** 2)).astype(np.float32)
        warm = np.array([25, 16, 5], dtype=np.float32)
    else:
        spread = np.exp(-0.5 * (((xx - 130) / 430) ** 2 + ((yy - 430) / 450) ** 2)).astype(np.float32)
        warm = np.array([23, 14, 4], dtype=np.float32)
    try:
        for index in range(count):
            data = read_exact(decoder.stdout, FRAME_BYTES)
            if len(data) != FRAME_BYTES:
                raise RuntimeError(f"Decoded only {index}/{count} frames")
            time = index / FPS
            if mode == "pov":
                progress = np.clip((time - 2.9) / (7.15 - 2.9), 0, 1)
            else:
                progress = np.clip((time - 0.8) / (7.15 - 0.8), 0, 1)
            progress = progress * progress * (3 - 2 * progress)
            frame = np.frombuffer(data, dtype=np.uint8).reshape(HEIGHT, WIDTH, 3)
            if progress:
                scale = 1 + (0.045 if mode == "pov" else 0.035) * progress
                center_x, center_y = (520, 300) if mode == "pov" else (310, 300)
                slide_x = 0 if mode == "pov" else 8 * progress
                slide_y = 13 * progress if mode == "pov" else 0
                frame = np.asarray(Image.fromarray(frame).transform(
                    (WIDTH, HEIGHT), Image.Transform.AFFINE,
                    (1 / scale, 0, center_x * (1 - 1 / scale) + slide_x / scale,
                     0, 1 / scale, center_y * (1 - 1 / scale) + slide_y / scale),
                    resample=Image.Resampling.BICUBIC))
                frame = np.clip(frame.astype(np.float32) + progress * spread[..., None] * warm, 0, 255).astype(np.uint8)
            encoder.stdin.write(frame.tobytes())
    finally:
        decoder.stdout.close()
        encoder.stdin.close()
    decoder_error = decoder.stderr.read().decode(errors="replace")
    encoder_error = encoder.stderr.read().decode(errors="replace")
    if decoder.wait() or encoder.wait():
        raise RuntimeError(f"FFmpeg failure: {decoder_error}\n{encoder_error}")
    full_decode = subprocess.run(["ffmpeg", "-v", "error", "-i", str(target), "-f", "null", "-"], capture_output=True, text=True)
    if full_decode.returncode:
        raise RuntimeError(full_decode.stderr)
    final_probe = json.loads(subprocess.run(
        ["ffprobe", "-v", "error", "-count_frames", "-show_streams", "-of", "json", str(target)],
        check=True, capture_output=True, text=True).stdout)
    actual = int(next(s for s in final_probe["streams"] if s["codec_type"] == "video")["nb_read_frames"])
    assert actual == count, (actual, count)
    print(json.dumps({"source": str(source), "sourceSha256": digest(source), "target": str(target),
                      "targetSha256": digest(target), "frames": actual, "fps": FPS,
                      "durationSeconds": actual / FPS, "fullDecode": "pass",
                      "treatment": ("2.9–7.15s smooth light diffusion from Jesus hand/camera plus 4.5% push and 13px upward movement"
                                    if mode == "pov" else "0.8–7.15s warm doorway and Jesus figure light progression plus 3.5% push and 8px lateral drift")}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("target")
    parser.add_argument("--mode", choices=["pov", "guidance"], default="pov")
    args = parser.parse_args()
    run(args.source, args.target, args.mode)
