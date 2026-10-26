"""Kids mode (core/utils/kids_mode.py)."""

from core.utils import kids_mode
from core.utils.kids_mode import REFUSAL, ReplyGuard, find_blocked, normalize, system_prompt


def test_normalize():
    assert normalize(None) is None
    assert normalize({"enabled": False, "age": 5}) is None
    cfg = normalize({"enabled": True, "age": 40, "blocked_topics": [" ভূত ", "Horror", "horror", "", "x" * 99]})
    assert cfg["age"] == 12
    assert cfg["blocked_topics"] == ["ভূত", "Horror", "x" * 40]
    assert normalize({"enabled": 1, "age": 1})["age"] == 3
    assert normalize({"enabled": "true", "age": "abc"})["age"] == kids_mode.DEFAULT_AGE
    assert normalize({"enabled": True, "blocked_topics": "যুদ্ধ, অস্ত্র"})["blocked_topics"] == ["যুদ্ধ", "অস্ত্র"]


def test_system_prompt_mentions_age_and_topics():
    assert system_prompt(None) == ""
    p = system_prompt(normalize({"enabled": True, "age": 6, "blocked_topics": ["ভূত", "war"]}))
    assert "about 6 years old" in p
    assert "ভূত, war" in p
    assert REFUSAL in p
    assert p.startswith("<kids_mode>") and p.endswith("</kids_mode>")


def test_find_blocked_whole_words_for_latin_substrings_for_bangla():
    cfg = normalize({"enabled": True, "blocked_topics": ["war", "ভূত"]})
    assert find_blocked("Tell me about the war", cfg) == "war"
    assert find_blocked("She won an award", cfg) is None
    assert find_blocked("ভূতের গল্প বলো", cfg) == "ভূত"
    assert find_blocked("একটা গল্প বলো", cfg) is None
    assert find_blocked("anything", None) is None


def test_reply_guard_stops_at_the_blocked_topic_even_across_pieces():
    g = ReplyGuard(normalize({"enabled": True, "blocked_topics": ["ভূত"]}))
    assert g.feed("একদিন রাতে ") == "একদিন রাতে "
    assert g.feed("একটা ভূ") == "একটা ভূ"
    assert g.feed("ত এলো") is None
    assert g.blocked == "ভূত"
    assert g.feed("আর") is None


def test_reply_guard_is_transparent_when_off():
    g = ReplyGuard(None)
    assert g.feed("anything at all") == "anything at all"
    assert g.blocked is None


def test_refusal_is_gentle_bangla_without_em_dash():
    assert "তুমি" in REFUSAL and "—" not in REFUSAL
