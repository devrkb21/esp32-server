"""The listen/detect handler routes [companion:story] to the LLM and keeps the other branches."""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest


@pytest.fixture
def listen(monkeypatch):
    from config import settings

    monkeypatch.setattr(settings, "config_file_valid", True)
    from core.handle.textHandler import listenMessageHandler as mod

    calls = []

    async def fake_start(conn, text, display_text=None):
        calls.append(text)

    monkeypatch.setattr(mod, "startToChat", fake_start)
    monkeypatch.setattr(mod, "enqueue_asr_report", lambda *a, **k: None)
    conn = SimpleNamespace(
        config={"companion": {"story_topics": ["টুনটুনি পাখি"]}, "wakeup_words": ["hey tinybot"]},
        logger=MagicMock(),
        reset_audio_states=lambda: None,
        client_have_voice=True,
        last_activity_time=0,
        just_woken_up=False,
    )
    return mod.ListenTextMessageHandler(), conn, calls


async def test_story_request_starts_chat_with_prompt(listen):
    handler, conn, calls = listen
    await handler.handle(conn, {"type": "listen", "state": "detect", "text": "[companion:story]"})
    assert len(calls) == 1
    assert "টুনটুনি পাখি" in calls[0] and "story" in calls[0]
    assert conn.just_woken_up is True


async def test_plain_text_still_goes_to_chat(listen):
    handler, conn, calls = listen
    await handler.handle(conn, {"type": "listen", "state": "detect", "text": "কেমন আছো"})
    assert calls == ["কেমন আছো"]
