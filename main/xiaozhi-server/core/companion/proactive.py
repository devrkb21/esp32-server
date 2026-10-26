"""Proactive talk: TinyBot starts a chat by itself in the morning and in the evening.

At the times set in the app (settings.proactive) the server leaves the greeting pending on the
robot over MQTT (`self.companion.greet`). The robot does not talk to an empty room: it waits for
the first sign of someone around within the window (a touch, being picked up or moved, a voice
nearby) and only then opens a voice session with `[proactive]<kind>`; otherwise the greeting
lapses. The robot sends that text back as a listen/detect
message, the server turns it into an LLM prompt with what TinyBot knows about the day (weather,
alarms, reminders, its own routine) and the robot speaks the greeting and keeps listening for the
answer, so the chat simply goes on.
"""

import asyncio
import json
import os
from datetime import datetime
from typing import Dict, Optional, Tuple

from loguru import logger

from core.companion import schema
from core.companion.settings import tts_language

TAG = __name__
PROACTIVE_TAG = "[proactive]"
KINDS = ("morning", "evening")
# How long after its time a greeting may still happen (someone has to come by within it)
WINDOW_MIN = 120
TICK_S = 30
# The robot shows this as the user line while the greeting is generated
DISPLAY = {"morning": "শুভ সকাল!", "evening": "দিন কেমন গেল?"}


def is_proactive_request(text: str) -> bool:
    return isinstance(text, str) and text.startswith(PROACTIVE_TAG)


def request_kind(text: str) -> str:
    kind = text[len(PROACTIVE_TAG):].strip() if is_proactive_request(text) else ""
    return kind if kind in KINDS else "morning"


def _mins(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def _in_night(night: Dict, minute: int) -> bool:
    if not night.get("enabled"):
        return False
    try:
        a, b = _mins(night["start"]), _mins(night["end"])
    except (KeyError, ValueError):
        return False
    return a <= minute < b if a < b else (minute >= a or minute < b)


def due_kind(settings: Dict, now: datetime, done: Dict[str, str]) -> Optional[str]:
    """The greeting to give now ("morning" / "evening"), if any: its time has come within
    WINDOW_MIN minutes, it was not given today and the robot is not in its night hours."""
    p = dict(schema.default_proactive(), **(settings.get("proactive") or {}))
    if not p.get("enabled"):
        return None
    minute = now.hour * 60 + now.minute
    if _in_night(settings.get("night") or {}, minute):
        return None
    today = now.date().isoformat()
    for kind in KINDS:
        if not p.get(kind + "_on") or done.get(kind) == today:
            continue
        start = _mins(p[kind])
        if start <= minute < start + WINDOW_MIN:
            return kind
    return None


def _today_items(dev: Dict, now: datetime) -> Tuple[list, list]:
    bit = 1 << ((now.weekday() + 1) % 7)  # days bitmask: bit 0 = Sunday
    minute = now.hour * 60 + now.minute
    alarms = sorted(
        (a["time"], a.get("label") or "alarm") for a in dev.get("alarms", [])
        if a.get("enabled", True) and a.get("days", 127) & bit and _mins(a["time"]) > minute
    )
    reminders = sorted(
        (r["time"], r.get("label") or "reminder") for r in dev.get("reminders", [])
        if r.get("enabled", True) and r.get("mode") == "time" and r.get("days", 127) & bit
        and _mins(r["time"]) > minute
    )
    return alarms, reminders


def build_prompt(service, config: Dict, device_id: str, kind: str) -> str:
    """The LLM instruction for a greeting; TinyBot's day itself comes from ai_context()."""
    language = tts_language(config)
    dev = service.store.get((device_id or "").strip().lower()) if service else None
    now = service.local_now() if service else datetime.now()
    facts = [f"It is {now:%H:%M} on {now:%A}."]
    name = ""
    if dev is not None:
        name = (dev.get("settings") or {}).get("owner_name") or ""
        if kind == "morning":
            from core.companion.service import bn_weather  # service imports this module

            facts.append("Weather: " + bn_weather(service.weather_for(dev)) + ".")
            alarms, reminders = _today_items(dev, now)
            if alarms:
                facts.append("Alarms later today: " + ", ".join(f"{t} {l}" for t, l in alarms[:3]) + ".")
            if reminders:
                facts.append("Reminders later today: " + ", ".join(f"{t} {l}" for t, l in reminders[:3]) + ".")
        # Eid, a national day or a family birthday today (calendar_days.py): greet for it
        special = service.today_special(dev) if hasattr(service, "today_special") else None
        if special:
            from core.companion.calendar_days import greeting_hint

            facts.append(greeting_hint(special) + " Start the greeting with it.")
    who = f"your friend {name}" if name else "your friend"
    if kind == "morning":
        task = (
            f"Say a warm good morning to {who}. Mention today's weather in a few words and, if there "
            "is one, the next alarm or reminder. Then ask one short, cheerful question about their "
            "plans for today. If your notes say something is on today (an exam, a visit), wish them "
            "luck or ask about it."
        )
    else:
        task = (
            f"Greet {who} for the evening and ask how their day went. You may tell one short, fun "
            "thing about your own day first. If your notes mention something that was on today, ask "
            "how it went. Show you care and want to hear about it."
        )
    return (
        "[TinyBot starts this chat by itself; the user has not said anything yet.]\n"
        + " ".join(facts) + "\n" + task + "\n"
        f"Speak in {language}, 2 or 3 short sentences, like a small friendly robot. No lists, no "
        "markdown, no emoji. Do not say that you were asked to greet."
    )


class ProactiveScheduler:
    """Background loop that wakes robots for their morning and evening greetings."""

    def __init__(self, service, data_dir: str):
        self.service = service
        self.path = os.path.join(data_dir, "proactive.json")
        self.done: Dict[str, Dict[str, str]] = self._load()
        self._task: Optional[asyncio.Task] = None

    def _load(self) -> Dict:
        try:
            with open(self.path, encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else {}
        except (OSError, ValueError):
            return {}

    def _save(self):
        tmp = self.path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self.done, f)
        os.replace(tmp, self.path)

    def start(self):
        if self._task is None or self._task.done():
            self._task = asyncio.get_running_loop().create_task(self._run())

    async def _run(self):
        while True:
            try:
                await self.tick()
            except Exception as e:
                logger.bind(tag=TAG).warning(f"Proactive talk check failed: {e}")
            await asyncio.sleep(TICK_S)

    async def tick(self):
        svc = self.service
        if svc.mqtt is None:
            return
        now = svc.local_now()
        for summary in svc.list_devices():
            dev = svc.store.get(summary["id"])
            if dev is None:
                continue
            done = self.done.setdefault(dev["id"], {})
            settings = dev.get("settings") or {}
            kind = due_kind(settings, now, done)
            if kind is None or not await svc.mqtt_online(dev):
                continue
            p = dict(schema.default_proactive(), **(settings.get("proactive") or {}))
            wait_min = max(1, _mins(p[kind]) + WINDOW_MIN - (now.hour * 60 + now.minute))
            try:
                await svc.mqtt.call(dev["mqtt_client_id"], "self.companion.greet",
                                    {"kind": kind, "wait_min": wait_min})
            except Exception as e:
                # Just gone (or an old firmware): try again at the next tick
                logger.bind(tag=TAG).info(f"Proactive {kind} for {dev['id']} not yet: {e}")
                continue
            done[kind] = now.date().isoformat()
            self._save()
            logger.bind(tag=TAG).info(f"Proactive {kind} greeting pending on {dev['id']} for {wait_min} min")
