"""The daily LLM quota in the chat flow: TinyBot says the polite line instead of asking the LLM."""

import asyncio
import queue
import types

from core.handle import receiveAudioHandle
from core.utils.dialogue import Dialogue
from core.utils.usage_meter import QUOTA_LINE, UsageMeter


class FakeTTS:
    def __init__(self):
        self.tts_text_queue = queue.Queue()
        self.stored = {}

    def store_tts_text(self, sid, text):
        self.stored[sid] = text

    def tts_one_sentence(self, conn, content_type, content_detail=None, **kw):
        self.tts_text_queue.put(content_detail)


def fake_conn(meter, limit):
    log = types.SimpleNamespace(info=lambda *a, **k: None, warning=lambda *a, **k: None)
    return types.SimpleNamespace(
        usage_meter=meter, usage_user_id="7", usage_limit=limit, device_id="aa:bb",
        client_is_speaking=False, client_listen_mode="auto", client_abort=True, sentence_id=None,
        tts=FakeTTS(), dialogue=Dialogue(), loop=None,
        logger=types.SimpleNamespace(bind=lambda **k: log),
    )


def test_quota_reached_only_with_a_limit_and_a_meter():
    meter = UsageMeter(6)
    assert not receiveAudioHandle.quota_reached(types.SimpleNamespace())
    conn = fake_conn(meter, 0)
    meter.set_used_today("7", 500)
    assert not receiveAudioHandle.quota_reached(conn)  # 0 = unlimited
    conn.usage_limit = 500
    assert receiveAudioHandle.quota_reached(conn)


def test_quota_exceeded_speaks_the_line_and_counts_the_refusal():
    meter = UsageMeter(6)
    conn = fake_conn(meter, 1)
    asyncio.run(receiveAudioHandle.quota_exceeded(conn))
    spoken = [conn.tts.tts_text_queue.get_nowait() for _ in range(conn.tts.tts_text_queue.qsize())]
    assert QUOTA_LINE in spoken
    assert conn.dialogue.dialogue[-1].content == QUOTA_LINE
    assert conn.client_abort is False
    rows = meter.take_rows()
    assert rows[0]["quotaBlocked"] == 1 and rows[0]["modelId"] == "quota"
