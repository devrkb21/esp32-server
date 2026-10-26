"""ASR fallback (core/providers/asr/fallback.py) with fake recognizers: no network."""

import asyncio

from core.providers.asr.dto.dto import InterfaceType
from core.providers.asr.fallback import FallbackASR, wrap_asr


class HttpError(Exception):
    def __init__(self, status):
        super().__init__(f"API request failed: {status}")
        self.status_code = status


class FakeASR:
    """Reports the given errors first (via last_error, like the Groq Whisper provider), then text."""

    def __init__(self, text="আমি ভালো আছি", errors=(), raises=False, kind=InterfaceType.NON_STREAM):
        self.text = text
        self.errors = list(errors)
        self.raises = raises
        self.calls = 0
        self.last_error = None
        self.interface_type = kind
        self.output_dir = "tmp/"
        self.closed = False

    async def speech_to_text_wrapper(self, pcm, session_id):
        self.calls += 1
        if self.errors:
            err = self.errors.pop(0)
            if self.raises:
                raise err
            self.last_error = err
            return "", None
        return self.text, None

    async def speech_to_text(self, *a, **k):
        return self.text, None

    async def close(self):
        self.closed = True


def run(coro):
    return asyncio.run(coro)


def test_groq_rate_limit_retries_then_falls_back():
    groq = FakeASR(errors=[HttpError(429), HttpError(429)])
    other = FakeASR("দ্বিতীয়")
    asr = FallbackASR([("ASR_Groq", groq), ("ASR_Other", other)], retry_delay=0)
    text, _ = run(asr.speech_to_text_wrapper([b"\0\0"], "s"))
    assert text == "দ্বিতীয়"
    assert (groq.calls, other.calls) == (2, 1)
    assert asr.last_model == "ASR_Other"


def test_one_retry_is_enough():
    groq = FakeASR("প্রথম", errors=[HttpError(503)])
    asr = FallbackASR([("ASR_Groq", groq), ("ASR_Other", FakeASR())], retry_delay=0)
    assert run(asr.speech_to_text_wrapper([b"\0\0"], "s"))[0] == "প্রথম"
    assert asr.last_model == "ASR_Groq"


def test_raised_auth_error_moves_on_without_retry():
    groq = FakeASR(errors=[HttpError(401)], raises=True)
    other = FakeASR("ok")
    asr = FallbackASR([("ASR_Groq", groq), ("ASR_Other", other)], retry_delay=0)
    assert run(asr.speech_to_text_wrapper([b"\0\0"], "s"))[0] == "ok"
    assert groq.calls == 1


def test_silence_is_not_an_error():
    groq = FakeASR("")
    other = FakeASR("never")
    asr = FallbackASR([("ASR_Groq", groq), ("ASR_Other", other)], retry_delay=0)
    assert run(asr.speech_to_text_wrapper([b"\0\0"], "s"))[0] == ""
    assert other.calls == 0


def test_everything_failing_gives_empty_text_and_last_error():
    asr = FallbackASR([("A", FakeASR(errors=[HttpError(500)] * 2)), ("B", FakeASR(errors=[HttpError(500)] * 2))],
                      retry_delay=0)
    assert run(asr.speech_to_text_wrapper([b"\0\0"], "s")) == ("", None)
    assert isinstance(asr.last_error, HttpError)


def test_wrap_only_whole_utterance_recognizers():
    primary = FakeASR()
    stream = FakeASR(kind=InterfaceType.STREAM)
    assert wrap_asr("A", primary, []) is primary
    assert wrap_asr("A", primary, [("S", stream)]) is primary
    assert wrap_asr("S", stream, [("A", primary)]) is stream
    wrapped = wrap_asr("A", primary, [("S", stream), ("B", FakeASR())])
    assert isinstance(wrapped, FallbackASR) and wrapped.model_ids == ["A", "B"]
    assert wrapped.interface_type == InterfaceType.NON_STREAM
    run(wrapped.close())
    assert primary.closed
