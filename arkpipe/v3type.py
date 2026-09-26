"""v3 sentence data. The v2 builder in full2fx is left alone."""

from __future__ import annotations

from arkpipe.full2fx import (
    HOLD,
    _clean_token,
    _ends_thought,
    load_bars,
    load_beats,
    load_lyric_lines,
    wants_shake,
)

FONTS = ("bebas", "cinzel", "cormorant", "archivo", "stencil", "dirt")
LAYOUTS = ("left", "right", "top", "bottom", "center", "diagonal")
ENTRANCES = (
    "fade",
    "slide_left",
    "slide_right",
    "slide_below",
    "zoom",
    "blur",
    "tracking",
    "wipe",
    "shake",
    "typewriter",
    "stamp",
)
EXITS = ("fade", "slide_left", "slide_right", "slide_below", "zoom", "blur", "wipe", "ink")
HOLD_MOTIONS = ("drift", "travel", "push", "pan")
FX_NAMES = ("glitch", "typewriter", "stamp", "ink", "light_sweep", "embers")
PROPER = {"noah", "shem", "ham", "japheth", "lord", "god", "me", "flood", "i"}
CLAUSE = {"and", "but", "when", "for", "so", "until", "then", "that", "as", "with", "from", "before", "after"}
EMPHASIS_KEYS = (
    "shut",
    "died",
    "lord",
    "noah",
    "flood",
    "deep",
    "fountains",
    "heavens",
    "ark",
    "god",
    "forty days",
)
ANCHORS = {
    "left": (0.06, 0.16),
    "right": (0.94, 0.18),
    "top": (0.50, 0.06),
    "bottom": (0.08, 0.62),
    "center": (0.50, 0.16),
    "diagonal": (0.10, 0.20),
}


def _base(token: str) -> str:
    core = token.strip().strip(",.;:!?\"'“”’")
    return core.split("'")[0].split("’")[0].lower()


def _lower_line_cap(token: str) -> str:
    if not token or not token[0].isupper():
        return token
    if _base(token) in PROPER:
        return token
    return token[0].lower() + token[1:]


def _flatten(lines: list[dict]) -> list[dict]:
    words = []
    for line in lines:
        for index, word in enumerate(line["words"]):
            words.append(
                {
                    "word": _clean_token(word["word"]),
                    "start": float(word["start"]),
                    "end": float(word["end"]),
                    "line_start": index == 0,
                }
            )
    words.sort(key=lambda item: (item["start"], item["end"]))
    return words


MAJOR = {"for", "then", "so", "until", "but"}
CHAR_CAP = 78


def _should_cut(buf: list[dict], word: dict) -> bool:
    """Start a new clause before `word` when the current one is already a full thought."""
    length = len(_phrase(buf))
    base = _base(word["word"])
    if word["line_start"] and base in MAJOR and length >= 24:
        return True
    if length > CHAR_CAP and buf[-1]["word"].rstrip().endswith(","):
        return True
    return False


def _split_overlong(group: list[dict]) -> list[list[dict]]:
    if len(_phrase(group)) <= CHAR_CAP:
        return [group]
    best = None
    for index in range(len(group) - 1):
        comma = group[index]["word"].rstrip().endswith(",")
        nxt = _base(group[index + 1]["word"])
        if not comma and nxt not in {"from", "every", "that", "and", "with", "before"}:
            continue
        left = group[: index + 1]
        right = group[index + 1 :]
        if len(_phrase(left)) < 18 or len(_phrase(right)) < 8:
            continue
        if best is None or abs(len(_phrase(left)) - 40) < abs(len(_phrase(group[: best + 1])) - 40):
            best = index
    if best is None:
        return [group]
    return _split_overlong(group[: best + 1]) + _split_overlong(group[best + 1 :])


def _merge_short(groups: list[list[dict]]) -> list[list[dict]]:
    merged: list[list[dict]] = []
    for group in groups:
        duration = group[-1]["end"] - group[0]["start"]
        punchy = len(group) <= 4
        if merged and duration < 1.5 and not punchy:
            combo = merged[-1] + group
            previous_closed = _ends_thought(merged[-1][-1], [])
            if not previous_closed and len(_phrase(combo)) <= CHAR_CAP:
                merged[-1] = combo
                continue
        merged.append(group)
    return merged


def _group(words: list[dict]) -> list[list[dict]]:
    """Clauses, not whole speeches. A pause inside one lyric line stays with that clause."""
    groups: list[list[dict]] = []
    current: list[dict] = []
    for index, word in enumerate(words):
        if current and word["line_start"] and word["start"] - current[-1]["end"] > 2.0:
            groups.append(current)
            current = []
        if current and _should_cut(current, word):
            groups.append(current)
            current = []
        current.append(word)
        if _ends_thought(word, words[index + 1 : index + 8]):
            groups.append(current)
            current = []
    if current:
        groups.append(current)
    pieces: list[list[dict]] = []
    for group in groups:
        pieces.extend(_split_overlong(group))
    return _merge_short(pieces)


def _phrase(group: list[dict]) -> str:
    parts = []
    for index, word in enumerate(group):
        token = word["word"]
        if index and word["line_start"]:
            token = _lower_line_cap(token)
        parts.append(token)
    text = " ".join(parts)
    return " ".join(text.replace("\u2014", ",").split())


def _best_cut(words: list[str]) -> int:
    if len(words) < 2:
        return len(words)
    target = len(words) / 2
    best = 1
    best_score = 10**9
    for index in range(1, len(words)):
        prev = words[index - 1]
        cur = words[index].strip(",.;:").lower()
        phrase = prev.rstrip().endswith(",") or cur in CLAUSE
        distance = abs(index - target)
        score = distance - (8 if phrase else 0)
        if score < best_score:
            best = index
            best_score = score
    return best


def wrap_lines_v3(text: str) -> list[str]:
    """Two lines at a phrase break. A third line is not used for ordinary clauses."""
    words = text.split()
    if len(words) <= 1 or len(text) <= 42:
        return [" ".join(words)] if words else []
    cut = _best_cut(words)
    return [" ".join(words[:cut]), " ".join(words[cut:])]


def _emphasis(text: str) -> list[str]:
    low = text.lower()
    found = [key for key in EMPHASIS_KEYS if key in low]
    return found[:3]


def _hash(text: str, salt: int) -> int:
    return sum(ord(char) for char in text) + salt * 17


def _pick(palette: tuple[str, ...], text: str, salt: int, blocked: str | None) -> str:
    start = _hash(text, salt) % len(palette)
    for offset in range(len(palette)):
        choice = palette[(start + offset) % len(palette)]
        if choice != blocked:
            return choice
    return palette[0]


def _font_for(text: str, powerful: bool, quiet: bool) -> str:
    if powerful:
        return _pick(("bebas", "stencil"), text, 3, None)
    if quiet:
        return _pick(("cormorant", "cinzel"), text, 5, None)
    return _pick(("archivo", "dirt", "cinzel"), text, 7, None)


def _quiet(text: str) -> bool:
    low = text.lower()
    keys = (
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
    return any(key in low for key in keys) or len(text.split()) <= 6


def _fx_for(text: str, powerful: bool, quiet: bool, index: int) -> str:
    low = text.lower()
    if any(key in low for key in ("great deep", "shut them", "swept away")):
        return "glitch"
    if "fountain" in low or "heavens opened" in low:
        return "embers"
    if "flood rose" in low or ("flood" in low and "waters" not in low):
        return "stamp"
    if "rain" in low or "heaven" in low:
        return "light_sweep"
    if quiet:
        return "ink"
    if index % 3 == 0:
        return "typewriter"
    return "fade"


def _hits(start: float, end: float, beats: list[float], bars: list[float], prefer_bar: bool) -> list[float]:
    window_beats = [item for item in beats if start - 1e-6 <= item <= end + 1e-6]
    window_bars = [item for item in bars if start - 1e-6 <= item <= end + 1e-6]
    pool = window_bars or window_beats if prefer_bar else window_beats or window_bars
    if not pool:
        return []
    return [min(pool, key=lambda item: abs(item - start))]


def build_sentences_v3(
    lines: list[dict] | None = None,
    bars: list[float] | None = None,
    beats: list[float] | None = None,
) -> list[dict]:
    """One complete thought at a time, held through pauses inside that thought."""
    lines = load_lyric_lines() if lines is None else lines
    bars = list(load_bars() if bars is None else bars)
    beats = list(load_beats() if beats is None else beats)
    raw = []
    for group in _group(_flatten(lines)):
        text = _phrase(group)
        raw.append(
            {
                "text": text,
                "start": group[0]["start"],
                "last_end": group[-1]["end"],
                "lines": wrap_lines_v3(text),
            }
        )
    for index, sent in enumerate(raw):
        if index and sent["start"] < raw[index - 1]["end"]:
            sent["start"] = raw[index - 1]["end"]
        nxt = raw[index + 1]["start"] if index + 1 < len(raw) else None
        end = sent["last_end"] + HOLD
        if nxt is not None and nxt < sent["last_end"]:
            end = sent["last_end"]
        elif nxt is not None:
            end = min(end, nxt)
        sent["end"] = max(end, sent["start"])
    previous = None
    for index, sent in enumerate(raw):
        text = sent["text"]
        powerful = wants_shake(text)
        quiet = not powerful and _quiet(text)
        font = _font_for(text, powerful, quiet)
        layout = _pick(LAYOUTS, text, 11, None)
        if powerful and (previous is None or previous[2] != "shake"):
            entrance = "shake"
        elif powerful:
            entrance = _pick(("zoom", "stamp", "wipe", "slide_below"), text, 13, None)
        elif quiet:
            entrance = _pick(("fade", "blur", "tracking", "ink"), text, 15, None)
        else:
            entrance = _pick(("slide_left", "slide_right", "typewriter", "wipe", "zoom"), text, 17, None)
        # Font, position, and entrance cannot repeat on the next sentence.
        if previous == (font, layout, entrance):
            layout = LAYOUTS[(LAYOUTS.index(layout) + 1) % len(LAYOUTS)]
        if previous == (font, layout, entrance):
            font = FONTS[(FONTS.index(font) + 1) % len(FONTS)]
        sent["font"] = font
        emphasis = _emphasis(text)
        emphasis_font = "stencil" if font == "bebas" else "bebas"
        sent["fonts"] = [font, emphasis_font] if emphasis else [font]
        sent["emphasis"] = emphasis
        if powerful and ("great deep" in text.lower() or "shut them" in text.lower()):
            size = 1.9
        elif powerful:
            size = 1.5
        elif quiet:
            size = 0.7
        else:
            size = 1.0
        sent["size"] = size
        sent["layout"] = layout
        sent["anchor"] = list(ANCHORS[layout])
        sent["depth"] = 0.42 if index % 6 == 0 or "sons:" in text.lower() else 0.90
        sent["entrance"] = entrance
        sent["exit"] = _pick(EXITS, text, 19, entrance if entrance in EXITS else None)
        sent["hold_motion"] = HOLD_MOTIONS[(index // 2) % len(HOLD_MOTIONS)] if index % 5 in (0, 2) else "still"
        sent["fx"] = _fx_for(text, powerful, quiet, index)
        sent["hit_times"] = _hits(sent["start"], sent["last_end"], beats, bars, prefer_bar=powerful)
        sent["index"] = index
        previous = (font, layout, entrance)
    return raw


def motion_v3(sentence: dict, t: float) -> dict:
    """Entrance, optional slow hold travel, exit. The built sentence stays readable."""
    start = float(sentence["start"])
    end = float(sentence["end"])
    hidden = {
        "alpha": 0.0,
        "dx": 0.0,
        "dy": 0.0,
        "scale": 1.0,
        "blur": 0.0,
        "reveal": 0.0,
        "glitch": 0.0,
        "sweep": -1.0,
        "shake": 0.0,
        "ink": 0.0,
        "embers": 0.0,
    }
    if t < start or t >= end:
        return hidden
    kind = sentence["entrance"]
    enter = 0.55 if kind in {"typewriter", "ink"} or sentence.get("fx") in {"typewriter", "ink"} else 0.24
    exit_d = 0.20
    if t < start + enter:
        phase = "in"
        u = (t - start) / enter
        active = kind
    elif t > end - exit_d and (end - start) > enter + exit_d:
        phase = "out"
        u = max(0.0, (end - t) / exit_d)
        active = sentence["exit"]
    else:
        phase = "hold"
        u = 1.0
        active = "hold"
    alpha = 1.0
    dx = dy = 0.0
    scale = 1.0
    blur = 0.0
    reveal = 1.0
    ink = 0.0
    if phase != "hold":
        if active in {"fade", "ink"}:
            alpha = u
        elif active == "slide_left":
            dx = (1.0 - u) * -90.0
        elif active == "slide_right":
            dx = (1.0 - u) * 90.0
        elif active == "slide_below":
            dy = (1.0 - u) * 50.0
        elif active == "zoom":
            scale = 0.9 + 0.1 * u
        elif active == "blur":
            blur = (1.0 - u) * 5.0
        elif active == "wipe":
            reveal = u
        elif active == "typewriter":
            reveal = u
        elif active == "stamp":
            scale = 1.28 - 0.28 * u
            alpha = min(1.0, u * 1.6)
        elif active == "tracking":
            reveal = u
        elif active == "shake":
            alpha = min(1.0, u * 1.5)
    hold = sentence.get("hold_motion") or "still"
    if phase == "hold" and hold != "still":
        elapsed = t - (start + enter)
        if hold == "drift":
            dx += elapsed * 10.0
        elif hold == "travel":
            dx += elapsed * 16.0
        elif hold == "push":
            scale += min(0.06, elapsed * 0.008)
        elif hold == "pan":
            dy += elapsed * -8.0
    glitch = 0.0
    sweep = -1.0
    shake = 0.0
    embers = 0.0
    fx = sentence.get("fx") or ""
    if fx == "glitch":
        for hit in sentence.get("hit_times") or []:
            gap = abs(t - float(hit))
            if gap < 0.14:
                glitch = max(glitch, 1.0 - gap / 0.14)
        if phase == "in":
            glitch = max(glitch, 1.0 - u)
    if fx == "light_sweep" and phase != "out":
        sweep = (t - start) / max(0.8, min(2.2, end - start))
    if fx == "embers":
        embers = 1.0 if phase == "hold" else u
    if fx == "ink" and phase == "in":
        ink = 1.0 - u
        blur = max(blur, ink * 7.0)
    if sentence.get("entrance") == "shake":
        for hit in sentence.get("hit_times") or []:
            gap = t - float(hit)
            if 0.0 <= gap <= 0.4:
                shake = max(shake, pow(2.718, -gap / 0.12))
    return {
        "alpha": alpha,
        "dx": dx,
        "dy": dy,
        "scale": scale,
        "blur": blur,
        "reveal": reveal,
        "glitch": glitch,
        "sweep": sweep,
        "shake": shake,
        "ink": ink,
        "embers": embers,
    }
