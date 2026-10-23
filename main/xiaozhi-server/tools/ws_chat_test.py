"""Talk to xiaozhi-server like a TinyBot does, without a microphone.

Speaks `--text` with Edge TTS (or reads `--wav`), sends it as 16 kHz Opus over the device
WebSocket protocol, prints every server message (stt, llm emotion, tts sentences) and saves the
spoken reply to a WAV file.

    .venv\\Scripts\\python.exe tools\\ws_chat_test.py --text "তুমি কেমন আছো?"

Needs ffmpeg on PATH (or --ffmpeg) to decode the TTS mp3.
"""

import argparse
import asyncio
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
import wave

import edge_tts
import opuslib_next
import websockets

SAMPLE_RATE = 16000
FRAME_MS = 60
FRAME_SAMPLES = SAMPLE_RATE * FRAME_MS // 1000


def speech_pcm(text: str, voice: str, ffmpeg: str) -> bytes:
    """Edge TTS -> mp3 -> 16 kHz mono s16le PCM."""
    with tempfile.TemporaryDirectory() as tmp:
        mp3 = os.path.join(tmp, "q.mp3")
        asyncio.run(edge_tts.Communicate(text, voice).save(mp3))
        return wav_pcm(mp3, ffmpeg)


def wav_pcm(path: str, ffmpeg: str) -> bytes:
    out = subprocess.run(
        [ffmpeg, "-v", "error", "-i", path, "-f", "s16le", "-ac", "1", "-ar", str(SAMPLE_RATE), "-"],
        check=True, capture_output=True)
    return out.stdout


async def chat(args, pcm: bytes) -> int:
    headers = {
        "Device-Id": args.device_id,
        "Client-Id": str(uuid.uuid4()),
        "Protocol-Version": "1",
    }
    encoder = opuslib_next.Encoder(SAMPLE_RATE, 1, opuslib_next.APPLICATION_VOIP)
    decoder = None
    reply_pcm = bytearray()
    out_rate = 24000
    got_stt = got_tts = False

    async with websockets.connect(args.url, additional_headers=headers, max_size=None) as ws:
        await ws.send(json.dumps({
            "type": "hello", "version": 1, "transport": "websocket",
            "features": {"mcp": True},
            "audio_params": {"format": "opus", "sample_rate": SAMPLE_RATE, "channels": 1,
                             "frame_duration": FRAME_MS},
        }))
        hello = json.loads(await asyncio.wait_for(ws.recv(), 10))
        session = hello.get("session_id", "")
        out_rate = hello.get("audio_params", {}).get("sample_rate", out_rate)
        print(f"[hello] session={session} server_rate={out_rate}")
        decoder = opuslib_next.Decoder(out_rate, 1)

        await ws.send(json.dumps({"session_id": session, "type": "listen", "state": "start", "mode": "manual"}))
        # Speech followed by a little silence, paced like a real microphone
        padded = pcm + b"\x00\x00" * (SAMPLE_RATE // 2)
        step = FRAME_SAMPLES * 2
        for i in range(0, len(padded) - step + 1, step):
            await ws.send(encoder.encode(padded[i:i + step], FRAME_SAMPLES))
            await asyncio.sleep(FRAME_MS / 1000)
        await ws.send(json.dumps({"session_id": session, "type": "listen", "state": "stop"}))
        t_stop = time.time()

        deadline = t_stop + args.timeout
        while time.time() < deadline:
            try:
                msg = await asyncio.wait_for(ws.recv(), deadline - time.time())
            except asyncio.TimeoutError:
                break
            if isinstance(msg, bytes):
                reply_pcm += decoder.decode(msg, out_rate * 120 // 1000)
                continue
            data = json.loads(msg)
            kind = data.get("type")
            dt = time.time() - t_stop
            if kind == "mcp":
                # Answer tool discovery so the server is not left waiting
                req = data.get("payload", {})
                if req.get("method") == "initialize":
                    result = {"protocolVersion": "2024-11-05", "capabilities": {"tools": {}},
                              "serverInfo": {"name": "ws_chat_test", "version": "1"}}
                elif req.get("method") == "tools/list":
                    result = {"tools": []}
                else:
                    continue
                await ws.send(json.dumps({"session_id": session, "type": "mcp",
                                          "payload": {"jsonrpc": "2.0", "id": req.get("id"), "result": result}}))
                continue
            if kind == "stt":
                got_stt = True
                print(f"[{dt:5.2f}s stt] {data.get('text')}")
            elif kind == "llm":
                print(f"[{dt:5.2f}s llm] emotion={data.get('emotion')} text={data.get('text')}")
            elif kind == "tts":
                got_tts = True
                state = data.get("state")
                print(f"[{dt:5.2f}s tts] {state} {data.get('text', '')}")
                if state == "stop":
                    break
            else:
                print(f"[{dt:5.2f}s {kind}] {json.dumps(data, ensure_ascii=False)[:200]}")

    if reply_pcm:
        with wave.open(args.out, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(out_rate)
            w.writeframes(bytes(reply_pcm))
        print(f"[saved] {args.out} ({len(reply_pcm) / 2 / out_rate:.1f} s of reply audio)")
    if not got_stt:
        print("[fail] no speech-to-text result")
        return 1
    if not got_tts:
        print("[fail] no TTS reply")
        return 1
    return 0


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--url", default="ws://127.0.0.1:8000/xiaozhi/v1/")
    p.add_argument("--text", default="তুমি কেমন আছো?")
    p.add_argument("--voice", default="bn-BD-PradeepNeural", help="Edge TTS voice that speaks the question")
    p.add_argument("--wav", help="use this audio file instead of --text")
    p.add_argument("--device-id", default="aa:bb:cc:dd:ee:01")
    p.add_argument("--out", default="tmp/ws_chat_reply.wav")
    p.add_argument("--timeout", type=float, default=40)
    p.add_argument("--ffmpeg", default=shutil.which("ffmpeg") or "ffmpeg")
    args = p.parse_args()

    pcm = wav_pcm(args.wav, args.ffmpeg) if args.wav else speech_pcm(args.text, args.voice, args.ffmpeg)
    print(f"[send] {len(pcm) / 2 / SAMPLE_RATE:.1f} s of speech: {args.wav or args.text}")
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    return asyncio.run(chat(args, pcm))


if __name__ == "__main__":
    sys.exit(main())
