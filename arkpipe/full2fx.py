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


def word_window(shot: dict, index: int = 0) -> dict:
    """Timing for one word on one shot. Holds until the next word or the shot end."""
    words = shot.get("words") or []
    word = words[index]
    later = [float(item["start"]) for item in words[index + 1 :]]
    hold = min(later) if later else float(shot["out"])
    return {
        "word": _clean_word(word["word"]),
        "shot_id": shot["id"],
        "start": float(word["start"]),
        "end": float(word["end"]),
        "hold_until": hold,
    }


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
    if treatment == "sink_fade":
        return (206, 198, 184, 255)
    if treatment == "float_bob":
        return (232, 226, 210, 255)
    if treatment == "slide_across":
        return (220, 214, 196, 255)
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


SONG_END = 367.2
TREATMENT_CYCLE = (
    "condense_fog",
    "lightning_flash",
    "shaft_descend",
    "chisel_rock",
    "sink_fade",
    "float_bob",
    "slide_across",
)


def load_all_shots(path: Path | None = None) -> list[dict]:
    src = path or (ROOT.parent / "full2" / "shotlist.json")
    data = json.loads(src.read_text())
    shots = data["shots"] if isinstance(data, dict) else data
    return sorted(shots, key=lambda shot: float(shot["in"]))


def segment_frames(shots: list[dict], fps: int = FPS, end: float | None = None) -> list[tuple[int, int]]:
    """Half-open frame spans for every shot. The last edge covers the song end."""
    end_t = float(shots[-1]["out"]) if end is None else float(end)
    starts = [int(round(float(shot["in"]) * fps)) for shot in shots]
    last = int(round(end_t * fps))
    if last / fps < end_t - 1e-9:
        last = int(math.ceil(end_t * fps))
    spans = []
    for index, start in enumerate(starts):
        stop = starts[index + 1] if index + 1 < len(starts) else last
        if stop <= start:
            stop = start + 1
        spans.append((start, stop))
    return spans


def classify_move(camera: str) -> str:
    text = camera.lower()
    if "crane" in text:
        return "crane"
    if "tilt" in text:
        return "tilt"
    if any(word in text for word in ("slider", "slide", "lateral", "pan", "orbit", "rotation", "tracking")):
        return "slide"
    return "push"


def classify_treatment(text_treatment: str) -> str:
    text = text_treatment.lower()
    rules = (
        ("condens", "condense_fog"),
        ("out of fog", "condense_fog"),
        ("lightning", "lightning_flash"),
        ("strobe", "lightning_flash"),
        ("thunder", "lightning_flash"),
        ("white for two", "lightning_flash"),
        ("descend", "shaft_descend"),
        ("shaft", "shaft_descend"),
        ("feather", "shaft_descend"),
        ("drop from the top", "shaft_descend"),
        ("chisel", "chisel_rock"),
        ("carv", "chisel_rock"),
        ("engrav", "chisel_rock"),
        ("scratch", "chisel_rock"),
        ("stamp", "chisel_rock"),
        ("hammer", "chisel_rock"),
        ("pitch", "chisel_rock"),
        ("tally", "chisel_rock"),
        ("numeral", "chisel_rock"),
        ("stone", "chisel_rock"),
        ("sink", "sink_fade"),
        ("erod", "sink_fade"),
        ("wash", "sink_fade"),
        ("bleed", "sink_fade"),
        ("dissolv", "sink_fade"),
        ("fade", "sink_fade"),
        ("below the frame", "sink_fade"),
        ("float", "float_bob"),
        ("bob", "float_bob"),
        ("buoy", "float_bob"),
        ("foam", "float_bob"),
        ("scroll", "slide_across"),
        ("slide", "slide_across"),
        ("walk", "slide_across"),
        ("herd", "slide_across"),
        ("drift", "slide_across"),
    )
    for key, name in rules:
        if key in text:
            return name
    return "shaft_descend"


def avoid_repeat(name: str, previous: str | None) -> str:
    if previous is None or name != previous:
        return name
    index = TREATMENT_CYCLE.index(name) if name in TREATMENT_CYCLE else 0
    return TREATMENT_CYCLE[(index + 1) % len(TREATMENT_CYCLE)]


def split_verse(verse: str) -> tuple[str, str]:
    parts = verse.split(" ", 2)
    if len(parts) >= 3 and parts[0] == "Gen":
        return "Genesis " + parts[1], parts[2].replace("\u2014", "-")
    return verse.replace("\u2014", "-"), ""


def _layers_from_motion(motion: str) -> list[dict]:
    text = motion.lower()
    clouds = 0.4 if "cloud" in text else 0.1
    fog = 0.24 if ("fog" in text or "mist" in text) else 0.05
    dust = 64 if any(word in text for word in ("dust", "ember", "smoke", "spark")) else 0
    grass = 6.5 if any(word in text for word in ("grass", "wool", "mane")) else 0.0
    rays = 0.5 if any(word in text for word in ("god", "beam", "ray")) else 0.0
    motes = 32 if any(word in text for word in ("mote", "ember", "spark")) else 0
    lightning = 0.55 if "lightning" in text else 0.0
    rain = 70 if any(word in text for word in ("rain", "drizzle", "drop")) else 0
    water = 1.3 if any(word in text for word in ("water", "wave", "flood", "swell", "spray", "geyser", "current")) else 0.0
    if max(dust, rain, motes) == 0 and grass == 0 and rays == 0 and water == 0:
        dust = 28
    return [
        {"name": "clouds", "params": {"speed": 16.0, "amp": clouds}},
        {"name": "fog", "params": {"amount": fog, "speed": 8.0}},
        {"name": "dust", "params": {"count": dust, "speed": 80.0}},
        {"name": "grass", "params": {"amp": grass}},
        {"name": "godrays", "params": {"strength": rays, "origin_x": 0.5, "origin_y": 0.02}},
        {"name": "motes", "params": {"count": motes, "origin_x": 0.48, "origin_y": 0.08}},
        {"name": "lightning", "params": {"strength": lightning}},
        {"name": "rain", "params": {"count": rain, "speed": 520.0}},
        {"name": "water", "params": {"amp": water}},
    ]


def derive_config(shot: dict, index: int = 0, previous: str | None = None) -> dict:
    """Map one shotlist row onto the shared camera, layer, and type set."""
    move = classify_move(shot.get("camera") or "slow push")
    treatment = avoid_repeat(classify_treatment(shot.get("text_treatment") or ""), previous)
    ref, line = split_verse(shot.get("verse") or "")
    if index % 2 == 0:
        hero, verse = [0.18, 0.16], [0.06, 0.84]
    else:
        hero, verse = [0.56, 0.18], [0.4, 0.84]
    drift = 48.0 if move == "slide" else 28.0
    dolly = 0.05 if "push" in move or move == "push" else 0.035
    if "shake" in (shot.get("camera") or "").lower() or "slam" in (shot.get("camera") or "").lower():
        drift = 36.0
    return {
        "camera": {"move": move, "dolly": dolly, "drift": drift},
        "layers": _layers_from_motion(shot.get("motion") or ""),
        "text": {
            "treatment": treatment,
            "title": "GENESIS 7" if shot["id"] in {"s01", "s72"} else "",
            "verse_ref": ref,
            "verse_line": line,
            "hero_anchor": hero,
            "verse_anchor": verse,
        },
    }


def build_fx(shots: list[dict], locked: dict | None = None) -> dict:
    """Full config. Locked ids, such as the approved s01-s04 preview, stay as given."""
    locked = locked or {}
    config: dict = {}
    previous = None
    for index, shot in enumerate(shots):
        if shot["id"] in locked:
            config[shot["id"]] = locked[shot["id"]]
            previous = locked[shot["id"]]["text"]["treatment"]
            continue
        made = derive_config(shot, index, previous)
        config[shot["id"]] = made
        previous = made["text"]["treatment"]
    return config


HOLD = 0.40
GAP_SPLIT = 2.0
MIN_ON_SCREEN = 1.5
LONG_TEXT = 90
HERO_PX = 54
HERO_PX_3 = 40
MAX_SPRITE_W = 1600
SPRITE_PAD = 160
MAX_LINE_PX = MAX_SPRITE_W - SPRITE_PAD
QUIET_ENTRANCES = ("fade", "blur", "tracking")
NARRATIVE_ENTRANCES = ("slide_left", "slide_right", "slide_below", "wipe", "scale")
ENTRANCES = QUIET_ENTRANCES + NARRATIVE_ENTRANCES + ("shake",)
EXITS = ("fade", "blur", "slide_left", "slide_right", "slide_below", "wipe", "scale")
SHAKE_KEYS = (
    "great deep",
    "fountain",
    "heavens opened",
    "shut them in",
    "shut him",
    "flood",
    "swept away",
    "earth died",
    "creature",
)


def load_lyric_lines(path: Path | None = None) -> list[dict]:
    src = path or (ROOT.parent / "lyrics.json")
    data = json.loads(src.read_text())
    lines = []
    for section in data.get("sections") or []:
        for line in section.get("lines") or []:
            if isinstance(line, dict) and line.get("words"):
                lines.append(line)
    lines.sort(key=lambda item: float(item["words"][0]["start"]))
    return lines


_FONT_CACHE: dict[int, ImageFont.FreeTypeFont] = {}


def _font(size: int) -> ImageFont.FreeTypeFont:
    font = _FONT_CACHE.get(size)
    if font is None:
        font = ImageFont.truetype(str(FONT_HERO), size)
        _FONT_CACHE[size] = font
    return font


def line_width(text: str, size: int = HERO_PX) -> float:
    if not text:
        return 0.0
    probe = ImageDraw.Draw(Image.new("L", (4, 4)))
    box = probe.textbbox((0, 0), text, font=_font(size))
    return float(box[2] - box[0])


def hero_px(line_count: int) -> int:
    """Three lines use a smaller hero size than the two-line face."""
    return HERO_PX_3 if line_count >= 3 else HERO_PX


def wrap_lines(text: str) -> list[str]:
    """Two centred lines. A third line only when two lines cannot fit."""
    words = text.split()
    if not words:
        return []
    if len(words) == 1:
        return [words[0]]
    best_index = None
    best_balance = None
    for index in range(1, len(words)):
        left = " ".join(words[:index])
        right = " ".join(words[index:])
        widest = max(line_width(left), line_width(right))
        if widest <= MAX_LINE_PX:
            balance = abs(len(left) - len(right))
            if best_balance is None or balance < best_balance:
                best_balance = balance
                best_index = index
    if best_index is not None or len(words) < 3:
        cut = best_index if best_index is not None else 1
        return [" ".join(words[:cut]), " ".join(words[cut:])]
    first = _balanced_cut(words, 3)
    rest = words[first:]
    second = _balanced_cut(rest, 2)
    return [" ".join(words[:first]), " ".join(rest[:second]), " ".join(rest[second:])]


def _balanced_cut(words: list[str], parts: int) -> int:
    """Index that starts the last `parts-1` chunks, balanced by characters."""
    if len(words) <= 1:
        return len(words)
    target = len(" ".join(words)) / parts
    best = 1
    best_score = 10**9
    for index in range(1, len(words)):
        score = abs(len(" ".join(words[:index])) - target)
        if score < best_score:
            best = index
            best_score = score
    return best


def wants_shake(text: str) -> bool:
    low = text.lower()
    if "creature" in low and "died" not in low and "end" not in low:
        return False
    return any(key in low for key in SHAKE_KEYS)


def _nearest_bar(t: float, bars: list[float], start: float, end: float) -> float | None:
    inside = [bar for bar in bars if start - 0.05 <= bar <= end + 0.2]
    pool = inside or bars
    if not pool:
        return None
    return min(pool, key=lambda bar: abs(bar - t))


def _clean_token(word: str) -> str:
    return word.replace("\u2014", ",").replace("\u00a0", " ").strip()


def _flatten_words(lines: list[dict]) -> list[dict]:
    words = []
    for line in lines:
        for word in line["words"]:
            words.append(
                {
                    "word": _clean_token(word["word"]),
                    "start": float(word["start"]),
                    "end": float(word["end"]),
                }
            )
    words.sort(key=lambda item: (item["start"], item["end"]))
    return words


def _is_list_colon(word: dict, following: list[dict]) -> bool:
    token = word["word"].rstrip().rstrip("\"'”’")
    if not token.endswith(":"):
        return False
    sample = following[:6]
    if not sample:
        return False
    commas = sum(1 for item in sample if item["word"].rstrip().endswith(","))
    short = sum(1 for item in sample if len(item["word"].strip(",.:;")) <= 8)
    return commas >= 1 or short >= 3


def _ends_thought(word: dict, following: list[dict]) -> bool:
    token = word["word"].rstrip().rstrip("\"'”’")
    if token.endswith((".", "!", "?", ";")):
        return True
    if token.endswith(":"):
        return not _is_list_colon(word, following)
    return False


def _span_until(words: list[dict], index: int, swallow_short: bool) -> float:
    """Duration from words[index] until the next real boundary."""
    if index >= len(words):
        return MIN_ON_SCREEN
    end = words[index]["end"]
    chunk_start = words[index]["start"]
    cursor = index
    while cursor + 1 < len(words):
        thought = _ends_thought(words[cursor], words[cursor + 1 : cursor + 8])
        gap = words[cursor + 1]["start"] - words[cursor]["end"]
        chunk = words[cursor]["end"] - chunk_start
        stop = thought or gap > GAP_SPLIT
        if stop and (not swallow_short or chunk >= MIN_ON_SCREEN):
            break
        cursor += 1
        end = words[cursor]["end"]
        if stop:
            chunk_start = words[cursor]["start"]
    return end - words[index]["start"]


def _group_words(words: list[dict]) -> list[list[dict]]:
    if not words:
        return []
    groups = []
    current = [words[0]]
    for index in range(1, len(words)):
        previous = words[index - 1]
        nxt = words[index]
        gap = nxt["start"] - previous["end"]
        if gap < 0:
            current.append(nxt)
            continue
        boundary = _ends_thought(previous, words[index : index + 8]) or gap > GAP_SPLIT
        if boundary:
            left = previous["end"] - current[0]["start"]
            # A pause inside one clause must not peel off a short tail.
            # A finished thought may keep the following short words with the next clause.
            swallow = _ends_thought(previous, words[index : index + 8])
            right = _span_until(words, index, swallow_short=swallow)
            if left >= MIN_ON_SCREEN and right >= MIN_ON_SCREEN:
                groups.append(current)
                current = [nxt]
                continue
        current.append(nxt)
    groups.append(current)
    return groups


def _split_long(group: list[dict]) -> list[list[dict]]:
    text = " ".join(item["word"] for item in group)
    if len(text) <= LONG_TEXT:
        return [group]
    options = []
    for index in range(len(group) - 1):
        if not group[index]["word"].rstrip().endswith(","):
            continue
        left = group[index]["end"] - group[0]["start"]
        right = group[-1]["end"] - group[index + 1]["start"]
        if left < MIN_ON_SCREEN or right < MIN_ON_SCREEN:
            continue
        left_text = " ".join(item["word"] for item in group[: index + 1])
        options.append((abs(len(left_text) - len(text) / 2), index))
    if not options:
        return [group]
    cut = min(options)[1]
    return _split_long(group[: cut + 1]) + _split_long(group[cut + 1 :])


def _mood(text: str) -> str:
    if wants_shake(text):
        return "powerful"
    low = text.lower()
    quiet_keys = (
        "only noah",
        "only the ark",
        "remained",
        "was gone",
        "still moved",
        "still prevailed",
        "no mountain",
        "no field",
        "no road",
        "no human",
        "judgment",
        "preserved",
    )
    if any(key in low for key in quiet_keys) or len(text.split()) <= 6:
        return "quiet"
    return "narrative"


def _pick(palette: tuple[str, ...], text: str, previous: str | None, salt: int) -> str:
    start = (sum(ord(char) for char in text) + salt) % len(palette)
    for offset in range(len(palette)):
        choice = palette[(start + offset) % len(palette)]
        if choice != previous:
            return choice
    return palette[0]


def build_sentences(lines: list[dict], bars: list[float] | None = None) -> list[dict]:
    """Merge lyric words into complete thoughts. Comma lists stay together."""
    bars = list(bars or [])
    groups = []
    for group in _group_words(_flatten_words(lines)):
        groups.extend(_split_long(group))
    raw = []
    for group in groups:
        text = " ".join(item["word"] for item in group)
        text = " ".join(text.replace("\u2014", ",").split())
        raw.append(
            {
                "text": text,
                "start": group[0]["start"],
                "last_end": group[-1]["end"],
                "lines": wrap_lines(text),
            }
        )
    for index, sent in enumerate(raw):
        nxt = raw[index + 1]["start"] if index + 1 < len(raw) else None
        end = sent["last_end"] + HOLD
        if nxt is not None and nxt >= sent["last_end"]:
            end = min(end, nxt)
        elif nxt is not None and nxt > sent["start"]:
            end = max(sent["last_end"], min(end, nxt))
        sent["end"] = end
    previous = None
    for index, sent in enumerate(raw):
        mood = _mood(sent["text"])
        if mood == "powerful" and previous != "shake":
            entrance = "shake"
        elif mood == "powerful":
            entrance = _pick(NARRATIVE_ENTRANCES, sent["text"], previous, 3)
        elif mood == "quiet":
            entrance = _pick(QUIET_ENTRANCES, sent["text"], previous, 1)
        else:
            entrance = _pick(NARRATIVE_ENTRANCES, sent["text"], previous, 2)
        sent["entrance"] = entrance
        previous = entrance
        exit_palette = QUIET_ENTRANCES if mood == "quiet" else NARRATIVE_ENTRANCES
        sent["exit"] = _pick(exit_palette, sent["text"], entrance, 11)
        sent["shake_time"] = None
        if mood == "powerful":
            sent["shake_time"] = _nearest_bar(sent["start"], bars, sent["start"], sent["last_end"])
        sent["index"] = index
    return raw


def sentence_visible(t: float, sentence: dict) -> bool:
    return float(sentence["start"]) <= t < float(sentence["end"])


def sentence_motion(sentence: dict, t: float) -> dict:
    """Entrance, still hold, and exit. No spin. Shake decays and does not bounce."""
    start = float(sentence["start"])
    end = float(sentence["end"])
    hidden = {"alpha": 0.0, "dx": 0.0, "dy": 0.0, "scale": 1.0, "blur": 0.0, "track": 0.0, "wipe": 1.0, "shake": 0.0}
    if t < start or t >= end:
        return hidden
    enter = 0.22
    exit_d = 0.18
    if t < start + enter:
        phase = "in"
        kind = sentence["entrance"]
        u = (t - start) / enter
    elif t > end - exit_d and (end - start) > enter + exit_d:
        phase = "out"
        kind = sentence["exit"]
        u = max(0.0, (end - t) / exit_d)
    else:
        phase = "hold"
        kind = "hold"
        u = 1.0
    alpha = 1.0
    dx = dy = 0.0
    scale = 1.0
    blur = 0.0
    track = 0.0
    wipe = 1.0
    if phase != "hold":
        if kind == "fade":
            alpha = u
        elif kind == "slide_left":
            dx = (1.0 - u) * -80.0
        elif kind == "slide_right":
            dx = (1.0 - u) * 80.0
        elif kind == "slide_below":
            dy = (1.0 - u) * 48.0
        elif kind == "scale":
            scale = 0.92 + 0.08 * u
        elif kind == "blur":
            blur = (1.0 - u) * 6.0
        elif kind == "tracking":
            track = (1.0 - u) * 18.0
        elif kind == "wipe":
            wipe = u
        elif kind == "shake":
            alpha = min(1.0, u * 1.4)
    shake = 0.0
    when = sentence.get("shake_time")
    if when is not None:
        dt = t - float(when)
        if 0.0 <= dt <= 0.45:
            shake = math.exp(-dt / 0.12)
    return {"alpha": alpha, "dx": dx, "dy": dy + shake * 6.0, "scale": scale, "blur": blur, "track": track, "wipe": wipe, "shake": shake}


def active_layer_names(shot_id: str, config: dict) -> list[str]:
    """Layers whose parameters actually ask for motion."""
    names = []
    for layer in resolve_shot(shot_id, config)["layers"]:
        params = layer["params"]
        if any(float(params.get(key, 0) or 0) > 0 for key in ("amp", "amount", "count", "strength", "speed")):
            # speed alone on a zero cloud amp still counts as present; require a real amount
            if float(params.get("amp", 0) or 0) > 0 or float(params.get("amount", 0) or 0) > 0 or int(params.get("count", 0) or 0) > 0 or float(params.get("strength", 0) or 0) > 0:
                names.append(layer["name"])
    return names
