"""LLM fallback chain (core/providers/llm/fallback.py) with fake providers: no network."""

import pytest

from core.providers.llm.fallback import (
    FallbackLLM, classify_error, fallback_entries, parse_chain, redact,
)


class HttpError(Exception):
    def __init__(self, status, msg="error"):
        super().__init__(f"Error code: {status} - {msg}")
        self.status_code = status


class FakeLLM:
    """Fails with the given errors first (one per call), then streams `reply` word by word."""

    def __init__(self, reply="hello there", errors=(), usage=None, mid_stream_error=None):
        self.reply = reply
        self.errors = list(errors)
        self.usage = usage
        self.mid_stream_error = mid_stream_error
        self.calls = 0
        self.last_usage = None
        self.model_name = "fake"

    def _gen(self):
        self.calls += 1
        if self.errors:
            raise self.errors.pop(0)
        words = self.reply.split(" ")
        for i, w in enumerate(words):
            if self.mid_stream_error and i == 1:
                raise self.mid_stream_error
            yield w if i == 0 else " " + w
        self.last_usage = self.usage

    def response(self, session_id, dialogue, **kwargs):
        return self._gen()

    def response_with_functions(self, session_id, dialogue, functions=None, **kwargs):
        return ((c, None) for c in self._gen())


def text_of(stream):
    return "".join(c if isinstance(c, str) else c[0] for c in stream)


def make(*providers, **kw):
    sink = []
    llm = FallbackLLM([(f"LLM_{i}", p) for i, p in enumerate(providers)],
                      usage_sink=lambda m, u: sink.append((m, u)), sleep=lambda s: None, **kw)
    return llm, sink


def test_primary_answers_and_usage_is_reported():
    a = FakeLLM("hi friend", usage={"prompt_tokens": 12, "completion_tokens": 3})
    llm, sink = make(a, FakeLLM("never"))
    assert text_of(llm.response("s", [])) == "hi friend"
    assert llm.last_model == "LLM_0"
    assert sink == [("LLM_0", {"prompt_tokens": 12, "completion_tokens": 3})]


def test_rate_limit_is_retried_once_then_succeeds_on_same_model():
    a = FakeLLM("ok then", errors=[HttpError(429, "rate limit")])
    b = FakeLLM("backup")
    llm, sink = make(a, b)
    assert text_of(llm.response("s", [])) == "ok then"
    assert a.calls == 2 and b.calls == 0
    assert sink == [("LLM_0", None)]  # no usage reported by the provider: requests still counted


def test_two_server_errors_fall_back_to_the_next_model():
    a = FakeLLM(errors=[HttpError(503), HttpError(502)])
    b = FakeLLM("from backup", usage={"prompt_tokens": 5, "completion_tokens": 2})
    llm, sink = make(a, b)
    assert text_of(llm.response_with_functions("s", [], functions=[])) == "from backup"
    assert a.calls == 2 and b.calls == 1
    assert llm.last_model == "LLM_1"
    assert sink == [("LLM_1", {"prompt_tokens": 5, "completion_tokens": 2})]


def test_auth_error_skips_the_retry():
    a = FakeLLM(errors=[HttpError(401, "invalid api key")])
    b = FakeLLM("second")
    llm, _ = make(a, b)
    assert text_of(llm.response("s", [])) == "second"
    assert a.calls == 1


def test_timeout_then_chain_of_three():
    a = FakeLLM(errors=[TimeoutError("read timed out"), TimeoutError("read timed out")])
    b = FakeLLM(errors=[HttpError(500), HttpError(500)])
    c = FakeLLM("third one")
    llm, _ = make(a, b, c)
    assert text_of(llm.response("s", [])) == "third one"
    assert (a.calls, b.calls, c.calls) == (2, 2, 1)


def test_all_failing_raises_the_last_error():
    llm, sink = make(FakeLLM(errors=[HttpError(500)] * 2), FakeLLM(errors=[HttpError(429)] * 2))
    with pytest.raises(HttpError):
        text_of(llm.response("s", []))
    assert sink == []


def test_error_after_streaming_started_is_not_swapped():
    a = FakeLLM("one two three", mid_stream_error=HttpError(500))
    b = FakeLLM("backup")
    llm, _ = make(a, b)
    out = []
    with pytest.raises(HttpError):
        for chunk in llm.response("s", []):
            out.append(chunk)
    assert out == ["one"] and b.calls == 0


def test_no_fallback_configured_behaves_like_the_provider():
    a = FakeLLM(errors=[HttpError(500), HttpError(500)])
    llm, _ = make(a)
    with pytest.raises(HttpError):
        text_of(llm.response("s", []))
    assert llm.model_name == "fake"  # primary attributes stay reachable


def test_response_no_stream_goes_through_the_chain():
    llm, _ = make(FakeLLM(errors=[HttpError(401)]), FakeLLM("note text"))
    assert llm.response_no_stream("sys", "user") == "note text"


def test_classify_error():
    assert classify_error(HttpError(429)) == "rate_limit"
    assert classify_error(HttpError(503)) == "server"
    assert classify_error(HttpError(403)) == "auth"
    assert classify_error(TimeoutError()) == "timeout"
    assert classify_error(Exception("Request timed out.")) == "timeout"
    assert classify_error(Exception("Error code: 429 - too many requests")) == "rate_limit"
    assert classify_error(ValueError("bad json")) is None


def test_redact_hides_keys():
    msg = "401 Unauthorized: Incorrect API key provided: gsk_abcdefghijklmnopqrstuv; Bearer sk-1234567890abcdef api_key=secretvalue123"
    out = redact(msg)
    assert "gsk_abcdefghijklmnopqrstuv" not in out
    assert "sk-1234567890abcdef" not in out
    assert "secretvalue123" not in out
    assert "Unauthorized" in out


def test_parse_chain_and_fallback_entries():
    assert parse_chain(" LLM_A, LLM_B,,LLM_A ,null") == ["LLM_A", "LLM_B"]
    assert parse_chain("null") == [] and parse_chain(None) == []
    cfg = {"selected_module": {"LLM": "LLM_A"},
           "fallback": {"LLM": [{"id": "LLM_A", "config": {}}, {"id": "LLM_B", "config": {"type": "openai"}},
                                {"id": "LLM_C"}, "junk", {"id": "LLM_B", "config": {}}]}}
    assert fallback_entries(cfg, "LLM") == [("LLM_B", {"type": "openai"})]
    assert fallback_entries({}, "ASR") == []


def test_initialize_llm_fallback_builds_the_chain(monkeypatch):
    from core.utils import modules_initialize

    built = []

    def fake_create(type_name, cfg):
        if cfg.get("broken"):
            raise ValueError("bad config api_key=topsecret999")
        built.append(type_name)
        return FakeLLM(cfg.get("reply", "x"))

    monkeypatch.setattr(modules_initialize.llm, "create_instance", fake_create)
    config = {"selected_module": {"LLM": "LLM_A"},
              "fallback": {"LLM": [{"id": "LLM_B", "config": {"type": "openai", "reply": "b"}},
                                   {"id": "LLM_C", "config": {"type": "openai", "broken": True}}]}}
    primary = FakeLLM(errors=[HttpError(500), HttpError(500)])
    wrapped = modules_initialize.initialize_llm_fallback(config, "LLM_A", primary)
    assert wrapped.model_ids == ["LLM_A", "LLM_B"]
    assert text_of(wrapped.response("s", [])) == "b"
