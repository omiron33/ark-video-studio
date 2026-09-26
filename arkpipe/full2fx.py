"""Pure timing, camera, and type for the full2 preview.

The renderer reads shotlist.json plus timeline/full2_fx.json and calls these
functions. Adding a later shot is a config entry, not a new code path.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from arkpipe.camera import CameraPose
from arkpipe.composite import layer_affine, sample_corners_inside

FPS = 24
CUTS = (0.0, 6.084, 10.588, 17.369, 24.102)
PREVIEW_END = 24.102
PLATE_W = 2304
PLATE_H = 1296
OUT_W = 1920
OUT_H = 1080
LAYER_NAMES = ("clouds", "dust", "grass", "fog", "godrays", "motes", "lightning")

ROOT = Path(__file__).resolve().parents[1]
FONT_HERO = ROOT / "assets" / "fonts" / "Cinzel-Variable.ttf"
FONT_VERSE = ROOT / "assets" / "fonts" / "EBGaramond-Italic-Variable.ttf"


def load_fx(path: Path | None = None) -> dict:
    src = path or (ROOT / "timeline" / "full2_fx.json")
    return json.loads(src.read_text())


def load_preview_shots(path: Path | None = None) -> list[dict]:
    src = path or (ROOT.parent / "full2" / "shotlist.json")
    data = json.loads(src.read_text())
    shots = data["shots"] if isinstance(data, dict) else data
    wanted = [s for s in shots if s["id"] in {"s01", "s02", "s03", "s04"}]
    wanted.sort(key=lambda s: float(s["in"]))
    return wanted


def load_bars(path: Path | None = None) -> list[float]:
    src = path or (ROOT.parent / "audio.json")
    audio = json.loads(src.read_text())
    return [float(b) for b in audio["bars_4_4"]]


def load_beats(path: Path | None = None) -> list[float]:
    src = path or (ROOT.parent / "audio.json")
    audio = json.loads(src.read_text())
    return [float(b) for b in audio["beats"]]


def cut_frames(fps: int = FPS, cuts: tuple[float, ...] = CUTS) -> list[int]:
    """Frame index of each boundary, including the preview end."""
    return [int(round(t * fps)) for t in cuts]


def shot_frame_span(shots: list[dict], fps: int = FPS) -> list[tuple[int, int]]:
    """Half-open frame spans. The last edge covers the preview end."""
    edges = cut_frames(fps, tuple(float(s["in"]) for s in shots) + (PREVIEW_END,))
    end = edges[-1]
    if end / fps < PREVIEW_END - 1e-9:
        end = int(math.ceil(PREVIEW_END * fps))
        edges[-1] = end
    return [(edges[i], edges[i + 1]) for i in range(len(shots))]


def _clean_word(word: str) -> str:
    return word.strip().strip(",.;:").strip()


def word_spec(shots: list[dict], name: str) -> dict:
    """Timing for one lyric word. Holds until the next word or the shot end."""
    key = _clean_word(name).lower()
    for shot in shots:
        words = shot.get("words") or []
        for index, word in enumerate(words):
            if _clean_word(word["word"]).lower() != key:
                continue
            later = [float(w["start"]) for w in words[index + 1 :]]
            hold = min(later) if later else float(shot["out"])
            return {
                "word": _clean_word(word["word"]),
                "shot_id": shot["id"],
                "start": float(word["start"]),
                "end": float(word["end"]),
                "hold_until": hold,
            }
    raise KeyError(name)


def word_visible(t: float, spec: dict) -> bool:
    """On from the word start until the next word or the shot end. Off before."""
    return float(spec["start"]) <= t < float(spec["hold_until"])


def frames_since_word(t: float, start: float, fps: int = FPS) -> int:
    return int(math.floor((t - start) * fps + 1e-6))


def resolve_shot(shot_id: str, config: dict) -> dict:
    """Same lookup for s01 and for any later id added to the config."""
    if shot_id not in config:
        raise KeyError(shot_id)
    return config[shot_id]


def treatment_name(shot_id: str, config: dict) -> str:
    return resolve_shot(shot_id, config)["text"]["treatment"]


def verse_lines(shot_id: str, config: dict) -> tuple[str, str]:
    text = resolve_shot(shot_id, config)["text"]
    return text["verse_ref"], text["verse_line"]


def layer_params(shot_id: str, config: dict) -> dict[str, dict]:
    found = {}
    for layer in resolve_shot(shot_id, config)["layers"]:
        found[layer["name"]] = dict(layer["params"])
    return found


def configured_layer_names(shots: list[dict], config: dict) -> set[str]:
    names: set[str] = set()
    for shot in shots:
        names.update(layer_params(shot["id"], config))
    return names


def downbeat_kick(t: float, bars: list[float], fps: int = FPS) -> float:
    """1 on the frame of a bar downbeat, else 0."""
    half = 0.5 / fps
    for bar in bars:
        if abs(t - bar) <= half:
            return 1.0
    return 0.0


def camera_at(
    t: float,
    shot: dict,
    config: dict,
    bars: list[float],
    *,
    frame: int = 0,
    fps: int = FPS,
) -> CameraPose:
    """Parallax pose for one preview time, with a small downbeat accent."""
    spec = resolve_shot(shot["id"], config)["camera"]
    move = spec["move"]
    dolly_amt = float(spec["dolly"])
    drift_amt = float(spec["drift"])
    t0 = float(shot["in"])
    t1 = float(shot["out"])
    span = max(1e-6, t1 - t0)
    u = min(1.0, max(0.0, (t - t0) / span))
    dolly = 0.012
    drift_x = 0.0
    drift_y = 0.0
    roll = 0.0
    if move == "push":
        dolly = 0.012 + dolly_amt * u
        drift_x = drift_amt * 0.25 * math.sin(u * math.pi)
    elif move == "slide":
        dolly = 0.02 + dolly_amt * 0.3
        drift_x = -drift_amt * 0.5 + drift_amt * u
        drift_y = 3.0 * math.sin(u * math.pi)
    elif move == "crane":
        dolly = 0.015 + dolly_amt * u
        drift_y = drift_amt * (0.55 - u)
        drift_x = drift_amt * 0.12 * math.sin(u * 2.2)
    elif move == "tilt":
        dolly = 0.018 + dolly_amt * u * 0.4
        drift_y = drift_amt * u
        roll = 0.35 * u
    else:
        raise ValueError(f"unknown camera move {move}")
    kick = downbeat_kick(t, bars, fps)
    return CameraPose(
        frame=frame,
        time=t,
        dolly=dolly + 0.008 * kick,
        drift_x=drift_x,
        drift_y=drift_y,
        roll=roll,
        shake_x=7.0 * kick,
        shake_y=2.4 * kick,
        shake_roll=0.08 * kick,
    )


def move_stays_inside(
    move: str,
    *,
    plate_w: int = PLATE_W,
    plate_h: int = PLATE_H,
    out_w: int = OUT_W,
    out_h: int = OUT_H,
) -> bool:
    """True when the configured move, including a downbeat kick, stays on the plate."""
    shot = {"id": "probe", "in": 0.0, "out": 6.0}
    config = {
        "probe": {
            "camera": {"move": move, "dolly": 0.05, "drift": 56.0},
            "layers": [],
            "text": {},
        }
    }
    for u in (0.0, 0.35, 0.7, 1.0):
        t = u * 6.0
        for kick_bar in ([], [t]):
            pose = camera_at(t, shot, config, kick_bar, frame=int(u * 10))
            for parallax in (0.08, 0.54, 1.0):
                matrix = layer_affine(pose, parallax, plate_w, plate_h, out_w, out_h)
                if not sample_corners_inside(matrix, plate_w, plate_h, out_w, out_h):
                    return False
    return True


def hero_color(treatment: str, frames_since_on: int) -> tuple[int, int, int, int]:
    """RGBA. Lightning is pure white for two frames, then a decaying teal."""
    if frames_since_on < 0:
        return (0, 0, 0, 0)
    if treatment == "lightning_flash":
        if frames_since_on < 2:
            return (255, 255, 255, 255)
        amp = math.exp(-(frames_since_on - 2) / 5.0)
        return (int(36 * amp), int(196 * amp), int(176 * amp), int(255 * amp))
    if treatment == "condense_fog":
        return (232, 224, 206, 255)
    if treatment == "shaft_descend":
        return (246, 236, 214, 255)
    if treatment == "chisel_rock":
        return (214, 206, 190, 255)
    return (230, 226, 214, 255)


def _font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def hero_raster(treatment: str, frames_since_on: int, text: str, size: int = 120) -> np.ndarray:
    """RGBA raster of one hero word. Empty before the word starts."""
    if frames_since_on < 0 or not text:
        return np.zeros((8, 8, 4), np.uint8)
    color = hero_color(treatment, frames_since_on)
    font = _font(FONT_HERO, size)
    probe = Image.new("L", (8, 8))
    draw = ImageDraw.Draw(probe)
    box = draw.textbbox((0, 0), text, font=font)
    width = max(8, box[2] - box[0] + 24)
    height = max(8, box[3] - box[1] + 24)
    alpha = Image.new("L", (width, height), 0)
    ImageDraw.Draw(alpha).text((12 - box[0], 12 - box[1]), text, font=font, fill=255)
    mask = np.array(alpha, dtype=np.uint8)
    rgba = np.zeros((height, width, 4), np.uint8)
    rgba[:, :, 0] = color[0]
    rgba[:, :, 1] = color[1]
    rgba[:, :, 2] = color[2]
    fade = color[3] / 255.0
    if treatment == "chisel_rock":
        # Inner shadow: shift a dark copy up-left, then the face color.
        dark = np.zeros_like(rgba)
        dark[:, :, 0] = 12
        dark[:, :, 1] = 10
        dark[:, :, 2] = 8
        dark[:, :, 3] = mask
        shifted = np.zeros_like(dark)
        shifted[4:, 4:] = dark[:-4, :-4]
        face = rgba.copy()
        face[:, :, 3] = (mask.astype(np.float32) * fade).astype(np.uint8)
        out = shifted
        cover = face[:, :, 3:4].astype(np.float32) / 255.0
        out = (out.astype(np.float32) * (1.0 - cover) + face.astype(np.float32) * cover).astype(np.uint8)
        return out
    rgba[:, :, 3] = (mask.astype(np.float32) * fade).astype(np.uint8)
    return rgba


def condense_offsets(count: int, gather: float, spread: float = 36.0) -> list[float]:
    """Horizontal letter offsets. gather 0 is dust, gather 1 is the word."""
    gather = min(1.0, max(0.0, gather))
    gap = spread * (1.0 - gather)
    mid = (count - 1) / 2.0
    return [(i - mid) * gap for i in range(count)]


def descend_anchor(u: float, origin: tuple[float, float] = (0.2, 0.14)) -> tuple[float, float]:
    """Word falls through the upper light and stops clear of the figure."""
    u = min(1.0, max(0.0, u))
    eased = 1.0 - (1.0 - u) ** 2
    x = origin[0] + 0.08 * eased
    y = origin[1] + 0.16 * eased
    return x, y


def verse_reveal(u: float) -> float:
    """0 to 1. The line is complete early so it is readable while the hero word is up."""
    return min(1.0, max(0.0, u / 0.22))
