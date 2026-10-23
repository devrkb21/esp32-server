"""Wake word matching must ignore case, spaces and punctuation."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from core.utils.util import is_wakeup_word, remove_punctuation_and_length


WORDS = ["Hi ESP", "你好小智", "Hello Xiaozhi"]


def _filtered(text):
    return remove_punctuation_and_length(text)[1]


def test_device_spellings_match():
    for text in ("Hi,ESP", "hi esp", "HiESP", "你好小智", "Hello Xiaozhi"):
        assert is_wakeup_word(_filtered(text), WORDS), text


def test_normal_speech_is_not_a_wake_word():
    assert not is_wakeup_word(_filtered("what time is it"), WORDS)
    assert not is_wakeup_word("", WORDS)


def test_semicolon_string_from_manager_api():
    assert is_wakeup_word("hiesp", "Hello Xiaozhi;Hi ESP")
