"""ASR fallback: when the agent's speech recognizer fails (Groq Whisper rate limit, timeout,
5xx, auth), retry once and then hand the same audio to the next recognizer in line.

The order comes from manager-api (sys param `asr.fallback_chain`, sent as `fallback.ASR` with the
agent config). Only whole-utterance (non-streaming) recognizers can be chained: the audio of one
utterance is kept and replayed to the next one. A provider reports a failure either by raising
or by setting `last_error` (the base class and the OpenAI-compatible provider do; they return an
empty text on failure). An empty text without an error is a real silence and is not retried.
"""

import asyncio
from typing import List, Optional, Sequence, Tuple

from config.logger import setup_logging
from core.providers.asr.base import ASRProviderBase
from core.providers.asr.dto.dto import InterfaceType
from core.providers.llm.fallback import RETRY_KINDS, classify_error, redact

TAG = __name__
logger = setup_logging()


class FallbackASR(ASRProviderBase):
    def __init__(self, entries: Sequence[Tuple[str, ASRProviderBase]], retries: int = 1,
                 retry_delay: float = 0.3):
        super().__init__()
        if not entries:
            raise ValueError("FallbackASR needs at least one recognizer")
        self.entries: List[Tuple[str, ASRProviderBase]] = list(entries)
        self.retries = max(0, int(retries))
        self.retry_delay = retry_delay
        self.last_model: Optional[str] = None
        self.last_error = None
        primary = self.entries[0][1]
        self.interface_type = getattr(primary, "interface_type", InterfaceType.NON_STREAM)
        self.output_dir = getattr(primary, "output_dir", None)
        self.delete_audio_file = getattr(primary, "delete_audio_file", True)

    @property
    def primary(self) -> ASRProviderBase:
        return self.entries[0][1]

    @property
    def model_ids(self) -> List[str]:
        return [m for m, _ in self.entries]

    def __getattr__(self, item):
        if item.startswith("__") or item == "entries":
            raise AttributeError(item)
        return getattr(self.entries[0][1], item)

    async def _one(self, provider, pcm_data, session_id):
        if hasattr(provider, "last_error"):
            provider.last_error = None
        try:
            text, path = await provider.speech_to_text_wrapper(pcm_data, session_id)
        except Exception as e:
            return None, None, e
        return text, path, getattr(provider, "last_error", None)

    async def speech_to_text_wrapper(self, pcm_data: List[bytes], session_id: str):
        self.last_error = None
        error = None
        for index, (model_id, provider) in enumerate(self.entries):
            attempt = 0
            while True:
                attempt += 1
                text, path, error = await self._one(provider, pcm_data, session_id)
                if error is None:
                    self.last_model = model_id
                    if index:
                        logger.bind(tag=TAG).warning(
                            f"ASR answered by fallback {model_id} (primary {self.entries[0][0]} failed)")
                    return text, path
                kind = classify_error(error)
                logger.bind(tag=TAG).warning(f"ASR {model_id} failed ({kind or 'error'}, try {attempt}): {redact(error)}")
                if kind in RETRY_KINDS and attempt <= self.retries:
                    await asyncio.sleep(self.retry_delay)
                    continue
                break
        self.last_error = error
        return "", None

    async def speech_to_text(self, opus_data, session_id, artifacts=None):
        return await self.primary.speech_to_text(opus_data, session_id, artifacts)

    async def close(self):
        for _, provider in self.entries:
            try:
                await provider.close()
            except Exception:
                pass


def wrap_asr(primary_id: str, primary, fallbacks: Sequence[Tuple[str, object]]):
    """The primary alone, or a FallbackASR when it and at least one fallback are whole-utterance
    recognizers (streaming ones keep their own connection and cannot be replayed)."""
    if primary is None or getattr(primary, "interface_type", None) != InterfaceType.NON_STREAM:
        return primary
    usable = [(m, p) for m, p in fallbacks if getattr(p, "interface_type", None) == InterfaceType.NON_STREAM]
    if not usable:
        return primary
    return FallbackASR([(primary_id, primary)] + usable)
