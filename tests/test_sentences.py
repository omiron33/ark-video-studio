"""Sentence timing comes from the real lyric lines, not a copied table."""

from arkpipe.full2fx import (
    HOLD,
    build_sentences,
    load_bars,
    load_lyric_lines,
    sentence_motion,
    sentence_visible,
)


def test_sentences_hold_without_overlap_or_repeated_entrances():
    lines = load_lyric_lines()
    bars = load_bars()
    sentences = build_sentences(lines, bars)
    assert len(sentences) >= 8
    assert sentences[0]["text"].lower().startswith("then the lord")
    for index, sent in enumerate(sentences):
        assert sentence_visible(sent["start"] - 0.05, sent) is False
        assert sentence_visible(sent["start"], sent) is True
        if sent["end"] > sent["start"] + 0.02:
            assert sentence_visible(sent["end"] - 0.01, sent) is True
        if index + 1 == len(sentences) or sentences[index + 1]["start"] >= sent["last_end"] + HOLD - 1e-6:
            assert abs(sent["end"] - (sent["last_end"] + HOLD)) < 1e-6
            assert sentence_visible(sent["end"] - 0.01, sent) is True
        else:
            assert sent["end"] <= sentences[index + 1]["start"] + 1e-9
        assert sentence_visible(sent["end"], sent) is False
        if index:
            assert sent["entrance"] != sentences[index - 1]["entrance"]
            assert sent["start"] >= sentences[index - 1]["end"] - 1e-9
        assert len(sent["lines"]) <= 2
        assert "\u2014" not in sent["text"]
    # A quiet intro has no lyric.
    assert not any(sentence_visible(2.0, sent) for sent in sentences)
    shaken = [sent for sent in sentences if sent["entrance"] == "shake"]
    assert shaken
    motion = sentence_motion(shaken[0], shaken[0]["shake_time"])
    later = sentence_motion(shaken[0], shaken[0]["shake_time"] + 0.3)
    assert motion["shake"] > later["shake"]
    assert "spin" not in shaken[0]["entrance"]
