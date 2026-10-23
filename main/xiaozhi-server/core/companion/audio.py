"""Renders spoken text to cached Ogg Opus files (mono, 16 kHz, 60 ms frames).

Edge TTS produces MP3; it is decoded with pydub (ffmpeg, already needed by the server's TTS
pipeline), encoded with opuslib_next the same way the chat audio is, and wrapped into Ogg in
pure Python (core.companion.ogg).
"""

import asyncio
import hashlib
import os
import re
import time
from io import BytesIO
from typing import Awaitable, Callable, Dict, Optional

from loguru import logger
from core.companion.ogg import write_ogg_opus

TAG = __name__

SAMPLE_RATE = 16000
FRAME_MS = 60
URL_PREFIX = "/companion/v1/audio/"
NAME_RE = re.compile(r"^[0-9a-f]{40}$")
MAX_TEXT = 500


def audio_name(voice: str, text: str) -> str:
    return hashlib.sha1(f"{voice}\n{text}".encode("utf-8")).hexdigest()


def pcm_to_ogg_opus(pcm: bytes, sample_rate: int = SAMPLE_RATE, frame_ms: int = FRAME_MS) -> bytes:
    """Encode 16-bit mono PCM to an Ogg Opus file."""
    import numpy as np
    import opuslib_next

    encoder = opuslib_next.Encoder(sample_rate, 1, opuslib_next.APPLICATION_AUDIO)
    try:
        encoder.bitrate = 24000
        encoder.signal = opuslib_next.constants.SIGNAL_VOICE
    except Exception:
        pass
    frame_size = sample_rate * frame_ms // 1000
    frame_bytes = frame_size * 2
    packets = []
    for i in range(0, len(pcm), frame_bytes):
        chunk = pcm[i : i + frame_bytes]
        if len(chunk) < frame_bytes:
            chunk += b"\x00" * (frame_bytes - len(chunk))
        packets.append(encoder.encode(np.frombuffer(chunk, dtype=np.int16).tobytes(), frame_size))
    return write_ogg_opus(
        packets, frame_ms=frame_ms, input_rate=sample_rate, total_samples=len(pcm) // 2
    )


def decode_to_pcm(audio_bytes: bytes, fmt: str = "mp3", sample_rate: int = SAMPLE_RATE) -> bytes:
    from pydub import AudioSegment
    from core.utils.util import ffmpeg_path_override

    with ffmpeg_path_override():
        seg = AudioSegment.from_file(BytesIO(audio_bytes), format=fmt, parameters=["-nostdin"])
    seg = seg.set_channels(1).set_frame_rate(sample_rate).set_sample_width(2)
    return seg.raw_data


async def edge_tts_mp3(text: str, voice: str) -> bytes:
    import edge_tts

    communicate = edge_tts.Communicate(text, voice=voice)
    data = bytearray()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            data += chunk["data"]
    if not data:
        raise RuntimeError("Edge TTS returned no audio")
    return bytes(data)


class AudioRenderer:
    """Lazily renders text to <audio_dir>/<sha1>.ogg; at most `concurrency` jobs at a time."""

    def __init__(
        self,
        audio_dir: str,
        voice: str,
        synthesize: Optional[Callable[[str, str], Awaitable[bytes]]] = None,
        concurrency: int = 2,
        on_rendered: Optional[Callable[[str], None]] = None,
    ):
        self.audio_dir = audio_dir
        self.voice = voice
        self.logger = logger
        # synthesize(text, voice) -> Ogg bytes; replaceable in tests
        self._synthesize = synthesize or self._edge_synthesize
        self._sem = asyncio.Semaphore(concurrency)
        self._jobs: Dict[str, asyncio.Task] = {}
        self._failed: Dict[str, tuple] = {}  # name -> (failures, last failure time)
        self.on_rendered = on_rendered
        os.makedirs(audio_dir, exist_ok=True)

    async def _edge_synthesize(self, text: str, voice: str) -> bytes:
        mp3 = await edge_tts_mp3(text, voice)
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: pcm_to_ogg_opus(decode_to_pcm(mp3, "mp3")))

    def path_for(self, name: str) -> Optional[str]:
        if not NAME_RE.match(name or ""):
            return None
        return os.path.join(self.audio_dir, name + ".ogg")

    def url(self, text: Optional[str], render: bool = True) -> Optional[str]:
        """URL of the rendered text, or None (rendering is started in the background)."""
        if not text or not text.strip():
            return None
        text = text.strip()[:MAX_TEXT]
        name = audio_name(self.voice, text)
        if os.path.exists(os.path.join(self.audio_dir, name + ".ogg")):
            return URL_PREFIX + name + ".ogg"
        if render:
            self.schedule(text)
        return None

    def schedule(self, text: str) -> Optional[asyncio.Task]:
        text = text.strip()[:MAX_TEXT]
        name = audio_name(self.voice, text)
        if name in self._jobs:
            return self._jobs[name]
        failures, last = self._failed.get(name, (0, 0.0))
        if failures and time.time() - last < min(3600, 60 * 2 ** failures):
            return None  # back off after failures (e.g. no internet for Edge TTS)
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return None
        task = loop.create_task(self._render(name, text))
        self._jobs[name] = task
        return task

    async def render_now(self, text: str) -> Optional[str]:
        """Render (or reuse) and wait; returns the URL or None on failure."""
        task = self.schedule(text)
        if task:
            await task
        return self.url(text, render=False)

    async def _render(self, name: str, text: str):
        path = os.path.join(self.audio_dir, name + ".ogg")
        try:
            async with self._sem:
                if os.path.exists(path):
                    return
                data = await self._synthesize(text, self.voice)
                tmp = path + ".tmp"
                with open(tmp, "wb") as f:
                    f.write(data)
                os.replace(tmp, path)
                self._failed.pop(name, None)
                self.logger.bind(tag=TAG).info(f"Rendered companion audio {name} ({len(data)} B)")
            if self.on_rendered:
                try:
                    self.on_rendered(name)
                except Exception:
                    pass
        except Exception as e:
            self._failed[name] = (self._failed.get(name, (0, 0.0))[0] + 1, time.time())
            self.logger.bind(tag=TAG).warning(f"Companion TTS failed for {text[:30]!r}: {e}")
        finally:
            self._jobs.pop(name, None)

    async def wait_idle(self):
        while self._jobs:
            await asyncio.gather(*list(self._jobs.values()), return_exceptions=True)
