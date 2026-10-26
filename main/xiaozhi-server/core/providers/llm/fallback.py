"""LLM fallback: when the agent's model fails, retry once, then try the next model in line.

The ordered list comes from manager-api (sys param `llm.fallback_chain`, a comma list of model
ids, sent with the agent config as `fallback.LLM`). Errors that are worth another try are
timeouts, rate limits (429), server errors (5xx) and auth errors (401/403): a transient error is
retried once on the same model, an auth error goes straight to the next model (the same key fails
again). Any other error also moves on to the next model, without a retry.

A model can only be swapped before it has streamed anything: once the first words reached the
robot, a broken stream is raised as before (the reply cannot be stitched from two models).

`usage_sink(model_id, usage)` is called after every finished request, with the token counts when
the provider reported them (`provider.last_usage`, a dict with prompt_tokens/completion_tokens)
or None. Keys never reach the log: error texts pass through `redact()`.
"""

import re
import time
from typing import Callable, Iterable, List, Optional, Sequence, Tuple

from config.logger import setup_logging
from core.providers.llm.base import LLMProviderBase

TAG = __name__
logger = setup_logging()

TRANSIENT = ("timeout", "rate_limit", "server")
RETRY_KINDS = TRANSIENT  # auth errors skip the retry: the same key fails again

# (pattern, replacement): the prefix group is kept, the secret becomes ***
_SECRET_PATTERNS = [
    (re.compile(r"(?i)(bearer\s+)[A-Za-z0-9._\-]{6,}"), r"\1***"),
    (re.compile(r"(?i)((?:api[_-]?key|token|secret|authorization)[\"']?\s*[:=]\s*[\"']?)[^\s\"',}]{4,}"), r"\1***"),
    (re.compile(r"\b(?:sk|gsk|pk|rk|xai|AIza)[-_A-Za-z0-9]{10,}"), "***"),
]


def redact(text) -> str:
    """An error text with anything that looks like a key masked (and cut to 300 characters)."""
    out = str(text or "")
    for pattern, repl in _SECRET_PATTERNS:
        out = pattern.sub(repl, out)
    return out[:300]


def _status_of(exc) -> Optional[int]:
    for attr in ("status_code", "status", "http_status"):
        value = getattr(exc, attr, None)
        if isinstance(value, int):
            return value
    response = getattr(exc, "response", None)
    value = getattr(response, "status_code", None)
    return value if isinstance(value, int) else None


def classify_error(exc) -> Optional[str]:
    """'timeout' | 'rate_limit' | 'server' | 'auth' for the errors a fallback helps with, else None."""
    if exc is None:
        return None
    name = type(exc).__name__.lower()
    if isinstance(exc, TimeoutError) or "timeout" in name or "timedout" in name:
        return "timeout"
    status = _status_of(exc)
    if status is not None:
        if status == 429:
            return "rate_limit"
        if status in (401, 403):
            return "auth"
        if status == 408 or status == 504:
            return "timeout"
        if 500 <= status < 600:
            return "server"
    if "ratelimit" in name:
        return "rate_limit"
    if "authentication" in name or "permissiondenied" in name:
        return "auth"
    if "internalserver" in name or "serviceunavailable" in name:
        return "server"
    if "connection" in name or "connecterror" in name or "networkerror" in name:
        return "server"
    text = str(exc).lower()
    if "timed out" in text or "timeout" in text:
        return "timeout"
    if re.search(r"\b429\b", text) or "rate limit" in text or "too many requests" in text:
        return "rate_limit"
    if re.search(r"\b40[13]\b", text) or "unauthorized" in text or "invalid api key" in text:
        return "auth"
    if re.search(r"\b50[0-9]\b", text) or "service unavailable" in text or "bad gateway" in text:
        return "server"
    return None


class FallbackLLM(LLMProviderBase):
    """Wraps the agent's LLM and its fallbacks: [(model_id, provider), ...], first one primary."""

    def __init__(self, entries: Sequence[Tuple[str, object]], retries: int = 1,
                 usage_sink: Optional[Callable[[str, Optional[dict]], None]] = None,
                 sleep: Callable[[float], None] = time.sleep, retry_delay: float = 0.4):
        if not entries:
            raise ValueError("FallbackLLM needs at least one model")
        self.entries: List[Tuple[str, object]] = list(entries)
        self.retries = max(0, int(retries))
        self.usage_sink = usage_sink
        self.last_model: Optional[str] = None
        self._sleep = sleep
        self._retry_delay = retry_delay

    # The primary's own attributes (model_name, ...) stay reachable for code that reads them
    def __getattr__(self, item):
        if item.startswith("__") or item in ("entries",):
            raise AttributeError(item)
        return getattr(self.entries[0][1], item)

    @property
    def primary(self):
        return self.entries[0][1]

    @property
    def primary_id(self) -> str:
        return self.entries[0][0]

    @property
    def model_ids(self) -> List[str]:
        return [m for m, _ in self.entries]

    def _attempts(self) -> Iterable[Tuple[int, str, object]]:
        for index, (model_id, provider) in enumerate(self.entries):
            yield index, model_id, provider

    def _report(self, model_id: str, provider):
        if self.usage_sink is None:
            return
        usage = getattr(provider, "last_usage", None)
        try:
            self.usage_sink(model_id, dict(usage) if isinstance(usage, dict) else None)
        except Exception as e:  # metering must never break a reply
            logger.bind(tag=TAG).debug(f"usage sink failed: {e}")

    def _stream(self, method: str, *args, **kwargs):
        last_error = None
        for index, model_id, provider in self._attempts():
            attempt = 0
            while True:
                attempt += 1
                fn = getattr(provider, method, None)
                if fn is None:
                    break
                try:
                    if hasattr(provider, "last_usage"):
                        provider.last_usage = None
                    stream = fn(*args, **kwargs)
                    iterator = iter(stream)
                    try:
                        first = next(iterator)
                    except StopIteration:
                        self._done(index, model_id, provider)
                        return
                except Exception as e:
                    last_error = e
                    kind = classify_error(e)
                    logger.bind(tag=TAG).warning(
                        f"LLM {model_id} failed ({kind or 'error'}, try {attempt}): {redact(e)}")
                    if kind in RETRY_KINDS and attempt <= self.retries:
                        self._sleep(self._retry_delay)
                        continue
                    break
                # Streaming has started on this model: no switching from here on
                yield first
                for chunk in iterator:
                    yield chunk
                self._done(index, model_id, provider)
                return
        if last_error is not None:
            raise last_error
        raise RuntimeError("no LLM could answer")

    def _done(self, index: int, model_id: str, provider):
        self.last_model = model_id
        if index == 0:
            logger.bind(tag=TAG).debug(f"LLM answered by {model_id}")
        else:
            logger.bind(tag=TAG).warning(f"LLM answered by fallback {model_id} (primary {self.primary_id} failed)")
        self._report(model_id, provider)

    def response(self, session_id, dialogue, **kwargs):
        return self._stream("response", session_id, dialogue, **kwargs)

    def response_with_functions(self, session_id, dialogue, functions=None, **kwargs):
        return self._stream("response_with_functions", session_id, dialogue, functions=functions, **kwargs)


def parse_chain(value) -> List[str]:
    """A fallback chain from the sys param: "a, b,,c" or a list -> ["a", "b", "c"] ('null'/empty: [])."""
    if value is None:
        return []
    items = value if isinstance(value, (list, tuple)) else str(value).split(",")
    out = []
    for item in items:
        s = str(item).strip()
        if s and s.lower() not in ("null", "none") and s not in out:
            out.append(s)
    return out


def fallback_entries(config: dict, kind: str) -> List[Tuple[str, dict]]:
    """[(model_id, model_config)] of the fallbacks the agent config carries for `kind` (LLM/ASR).

    manager-api sends `fallback: {"LLM": [{"id": ..., "config": {...}}, ...], "ASR": [...]}`.
    The primary model itself and duplicates are skipped."""
    primary = (config.get("selected_module") or {}).get(kind)
    out, seen = [], {primary}
    for item in ((config.get("fallback") or {}).get(kind) or []):
        if not isinstance(item, dict):
            continue
        mid, cfg = item.get("id"), item.get("config")
        if not mid or mid in seen or not isinstance(cfg, dict):
            continue
        seen.add(mid)
        out.append((mid, cfg))
    return out
