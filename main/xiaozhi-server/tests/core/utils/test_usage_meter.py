"""Usage metering and the daily quota (core/utils/usage_meter.py)."""

import asyncio

from core.utils.usage_meter import QUOTA_LINE, UsageMeter, usage_info

# 2026-10-26 23:30 in Dhaka (UTC+6) = 17:30 UTC
T0 = 1793035800.0


class Clock:
    def __init__(self, t):
        self.t = t

    def __call__(self):
        return self.t


def meter(t=T0):
    clock = Clock(t)
    return UsageMeter(6, clock=clock), clock


def test_rows_per_day_device_and_model():
    m, _ = meter()
    m.record_llm("AA:BB", "LLM_Groq", {"prompt_tokens": 100, "completion_tokens": 20}, user_id=7)
    m.record_llm("aa:bb", "LLM_Groq", None, user_id=7)
    m.record_llm("aa:bb", "LLM_Gemini", {"prompt_tokens": 50, "completion_tokens": 5}, user_id=7)
    m.record_asr("aa:bb", "ASR_Groq", 2.5)
    m.record_asr("aa:bb", "ASR_Groq", 0)
    m.record_tts("aa:bb", "TTS_Edge", 42)
    rows = {(r["modelType"], r["modelId"]): r for r in m.take_rows()}
    assert rows[("LLM", "LLM_Groq")]["llmRequests"] == 2
    assert rows[("LLM", "LLM_Groq")]["promptTokens"] == 100
    assert rows[("LLM", "LLM_Groq")]["date"] == "2026-10-26"
    assert rows[("LLM", "LLM_Groq")]["macAddress"] == "aa:bb"
    assert rows[("LLM", "LLM_Gemini")]["completionTokens"] == 5
    assert rows[("ASR", "ASR_Groq")]["asrSeconds"] == 2.5
    assert rows[("TTS", "TTS_Edge")]["ttsChars"] == 42
    assert m.take_rows() == []


def test_day_changes_at_local_midnight():
    m, clock = meter()
    m.record_tts("d", "T", 1)
    clock.t += 3600  # 00:30 next day in Dhaka
    m.record_tts("d", "T", 1)
    assert sorted(r["date"] for r in m.take_rows()) == ["2026-10-26", "2026-10-27"]


def test_quota_counts_from_the_api_total_and_resets_next_day():
    m, clock = meter()
    assert not m.over_quota(7, 0)  # 0 = unlimited
    m.set_used_today(7, 8)
    m.set_used_today(7, 3)  # a smaller count never lowers it
    assert m.used_today(7) == 8
    m.record_llm("d", "L", None, user_id=7)
    assert not m.over_quota(7, 10)
    m.record_llm("d", "L", None, user_id="7")
    assert m.over_quota(7, 10)
    assert not m.over_quota(None, 10)
    clock.t += 3600
    assert not m.over_quota(7, 10)


def test_flush_sends_rows_updates_used_and_keeps_rows_on_failure():
    m, _ = meter()
    m.record_llm("d", "L", None, user_id=7)
    m.record_quota_block("d")
    sent = []

    async def fail(rows):
        sent.append(rows)
        return None

    assert asyncio.run(m.flush(send=fail)) is False
    assert len(sent[0]) == 2
    rows = m.take_rows()
    assert sum(r["llmRequests"] for r in rows) == 1 and sum(r["quotaBlocked"] for r in rows) == 1
    m.put_back(rows)

    async def ok(rows):
        sent.append(rows)
        return {"users": {"7": 25}}

    assert asyncio.run(m.flush(send=ok)) is True
    assert m.take_rows() == []
    assert m.used_today(7) == 25


def test_due_after_a_minute():
    m, clock = meter()
    assert not m.due()
    m.record_tts("d", "T", 3)
    assert not m.due()
    clock.t += 61
    assert m.due()


def test_usage_info_normalizes():
    assert usage_info({}) == {"user_id": None, "llm_daily_limit": 0, "llm_used_today": 0}
    assert usage_info({"usage_quota": {"user_id": 5, "llm_daily_limit": "100", "llm_used_today": -3}}) == {
        "user_id": "5", "llm_daily_limit": 100, "llm_used_today": 0}


def test_quota_line_is_bangla_and_uses_tumi():
    assert "তোমার" in QUOTA_LINE and "—" not in QUOTA_LINE
