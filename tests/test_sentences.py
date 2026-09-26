"""Sentence timing comes from the real lyric lines, not a copied table."""

from arkpipe.full2fx import (
    ENTRANCES,
    GAP_SPLIT,
    HOLD,
    LONG_TEXT,
    MAX_LINE_PX,
    MIN_ON_SCREEN,
    NARRATIVE_ENTRANCES,
    QUIET_ENTRANCES,
    build_sentences,
    hero_px,
    line_width,
    load_bars,
    load_lyric_lines,
    sentence_motion,
    sentence_visible,
    wants_shake,
)

FORBIDDEN = ("Shem,", "Ham,", "Birds,", "Roads,", "Man and beast,")
POWERFUL = (
    ("great deep",),
    ("fountain",),
    ("heavens opened",),
    ("shut them in",),
    ("flood",),
    ("creature", "died"),
    ("swept away",),
)


def _sentences():
    return build_sentences(load_lyric_lines(), load_bars())


def _ends_thought(word: str, following: list[dict]) -> bool:
    token = word.rstrip().rstrip("\"'”’")
    if token.endswith((".", "!", "?", ";")):
        return True
    if not token.endswith(":"):
        return False
    sample = following[:6]
    commas = sum(1 for item in sample if item["word"].rstrip().endswith(","))
    short = sum(1 for item in sample if len(item["word"].strip(" ,.:;")) <= 8)
    return not (commas >= 1 or short >= 3)


def _assign(lines, sentences):
    """Map each lyric word onto the sentence that drew it."""
    words = [word for line in lines for word in line["words"]]
    pieces = [sent["text"].split() for sent in sentences]
    assigned = []
    sent_i = 0
    pos = 0
    for word in words:
        token = " ".join(word["word"].replace("\u2014", ",").split())
        while sent_i < len(pieces) and pos >= len(pieces[sent_i]):
            sent_i += 1
            pos = 0
        assert sent_i < len(pieces), token
        assert pieces[sent_i][pos] == token
        assigned.append(sent_i)
        pos += 1
    assert sent_i == len(pieces) - 1
    assert pos == len(pieces[-1])
    return assigned


def _is_round_robin(seq: list[str], palette: tuple[str, ...] | list[str]) -> bool:
    if len(seq) < len(palette):
        return False
    size = len(palette)
    for offset in range(size):
        if all(seq[i] == palette[(offset + i) % size] for i in range(len(seq))):
            return True
    return False


def test_real_lyrics_form_sentences_not_comma_fragments():
    lines = load_lyric_lines()
    bars = load_bars()
    sentences = build_sentences(lines, bars)
    texts = [sent["text"] for sent in sentences]
    assert not any(text in FORBIDDEN for text in texts)
    sons = [
        sent for sent in sentences
        if "sons:" in sent["text"] and all(name in sent["text"] for name in ("Shem", "Ham", "Japheth"))
    ]
    with_shem = [
        sent for sent in sentences
        if "With Shem" in sent["text"] and "Ham" in sent["text"] and "Japheth" in sent["text"]
    ]
    assert len(sons) == 1
    assert len(with_shem) == 1
    assert sons[0] is not with_shem[0]
    noah = [sent for sent in sentences if sent["text"].startswith("Then the Lord said to Noah")]
    assert len(noah) == 1
    assert "Come into the ark" not in noah[0]["text"]
    assert not any("Come into the ark" in sent["text"] and "said to Noah" in sent["text"] for sent in sentences)
    assigned = _assign(lines, sentences)
    cursor = 0
    flat = [word for line in lines for word in line["words"]]
    for index, line in enumerate(lines[:-1]):
        count = len(line["words"])
        gap = float(lines[index + 1]["words"][0]["start"]) - float(line["words"][-1]["end"])
        following = flat[cursor + count : cursor + count + 8]
        thought = _ends_thought(line["words"][-1]["word"], following)
        left = assigned[cursor + count - 1]
        right = assigned[cursor + count]
        cursor += count
        if gap <= GAP_SPLIT and not thought and left != right:
            assert sentences[left]["text"].rstrip().endswith(",")
            assert right == left + 1
            assert sentences[left]["last_end"] - sentences[left]["start"] >= MIN_ON_SCREEN - 1e-6
            assert sentences[right]["last_end"] - sentences[right]["start"] >= MIN_ON_SCREEN - 1e-6
            joined = sentences[left]["text"]
            end = left
            while (
                end + 1 < len(sentences)
                and sentences[end]["text"].rstrip().endswith(",")
                and sentences[end + 1]["start"] - sentences[end]["last_end"] <= GAP_SPLIT
            ):
                end += 1
                joined = joined + " " + sentences[end]["text"]
            assert len(joined) > LONG_TEXT
            assert end >= right
    for sent in sentences:
        assert sent["last_end"] - sent["start"] >= MIN_ON_SCREEN - 1e-6
        assert sent["end"] - sent["start"] >= MIN_ON_SCREEN - 1e-6
        assert "\u2014" not in sent["text"]
        words = sent["text"].split()
        assert len(sent["lines"]) == (1 if len(words) < 2 else 2 if _two_lines_fit(words) else 3)
        if len(sent["lines"]) == 3:
            assert not _two_lines_fit(words)
            assert hero_px(3) < hero_px(2)
        else:
            assert all(line_width(line) <= MAX_LINE_PX + 1e-6 for line in sent["lines"])


def _two_lines_fit(words: list[str]) -> bool:
    if len(words) < 2:
        return True
    for index in range(1, len(words)):
        widest = max(line_width(" ".join(words[:index])), line_width(" ".join(words[index:])))
        if widest <= MAX_LINE_PX:
            return True
    return False


def test_sentences_hold_without_overlap_or_repeated_entrances():
    lines = load_lyric_lines()
    bars = load_bars()
    sentences = build_sentences(lines, bars)
    assert sentences[0]["text"].lower().startswith("then the lord")
    entrances = [sent["entrance"] for sent in sentences]
    assert not _is_round_robin(entrances, QUIET_ENTRANCES + NARRATIVE_ENTRANCES)
    assert not _is_round_robin(entrances, ENTRANCES)
    non_shake = [name for name in entrances if name != "shake"]
    assert not _is_round_robin(non_shake, QUIET_ENTRANCES + NARRATIVE_ENTRANCES)
    for index, sent in enumerate(sentences):
        assert sentence_visible(sent["start"] - 0.05, sent) is False
        assert sentence_visible(sent["start"], sent) is True
        if sent["end"] > sent["start"] + 0.02:
            assert sentence_visible(sent["end"] - 0.01, sent) is True
        nxt = sentences[index + 1]["start"] if index + 1 < len(sentences) else None
        if nxt is None or nxt >= sent["last_end"] + HOLD - 1e-6:
            assert abs(sent["end"] - (sent["last_end"] + HOLD)) < 1e-6
        else:
            assert abs(sent["end"] - max(sent["last_end"], min(sent["last_end"] + HOLD, nxt))) < 1e-6
        assert sent["end"] >= sent["last_end"] - 1e-9
        assert sentence_visible(sent["end"], sent) is False
        if index:
            assert sent["entrance"] != sentences[index - 1]["entrance"]
            assert sent["start"] >= sentences[index - 1]["end"] - 1e-9
        assert sent["entrance"] in ENTRANCES
        assert sent["exit"] in QUIET_ENTRANCES + NARRATIVE_ENTRANCES
        assert "spin" not in sent["entrance"] and "bounce" not in sent["entrance"]
        previous_shake = index and sentences[index - 1]["entrance"] == "shake"
        if wants_shake(sent["text"]):
            assert sent["shake_time"] is not None
            assert sent["entrance"] == ("shake" if not previous_shake else sent["entrance"])
            if previous_shake:
                assert sent["entrance"] != "shake"
            else:
                assert sent["entrance"] == "shake"
        else:
            assert sent["shake_time"] is None
            assert sent["entrance"] != "shake"
        mid = (sent["start"] + sent["end"]) / 2
        if sent["start"] + 0.22 < mid < sent["end"] - 0.18:
            motion = sentence_motion(sent, mid)
            assert motion["alpha"] == 1.0
            assert motion["dx"] == 0.0
            assert motion["scale"] == 1.0
            assert motion["blur"] == 0.0
            assert motion["wipe"] == 1.0
    assert not any(sentence_visible(2.0, sent) for sent in sentences)
    for keys in POWERFUL:
        matches = [sent for sent in sentences if all(key in sent["text"].lower() for key in keys)]
        assert matches, keys
        for sent in matches:
            window = [bar for bar in bars if sent["start"] - 0.05 <= bar <= sent["last_end"] + 0.2]
            pool = window or bars
            nearest = min(pool, key=lambda bar: abs(bar - sent["start"]))
            assert sent["shake_time"] == nearest
    shaken = next(sent for sent in sentences if sent["entrance"] == "shake")
    hit = sentence_motion(shaken, shaken["shake_time"])
    later = sentence_motion(shaken, shaken["shake_time"] + 0.3)
    assert hit["shake"] > later["shake"] > 0


def test_three_line_sprite_is_smaller_than_two_line_hero():
    import numpy as np

    from render_sentences import _sprite

    motion = {"alpha": 1.0, "dx": 0.0, "dy": 0.0, "scale": 1.0, "blur": 0.0, "track": 0.0, "wipe": 1.0, "shake": 0.0}
    two = _sprite({"lines": ["Then the Lord", "said to Noah"]}, motion)
    three = _sprite({"lines": ["Then", "the Lord", "said"]}, motion)

    def ink_rows(sprite):
        rows = np.where(sprite[:, :, 3].max(axis=1) > 10)[0]
        return int(rows[-1] - rows[0])

    # Gap between lines is fixed, so a smaller face makes each band shorter.
    assert hero_px(3) < hero_px(2)
    assert ink_rows(three) / 3 < ink_rows(two) / 2
