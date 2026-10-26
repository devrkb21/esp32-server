"""Routines (scenes): a named, ordered list of steps TinyBot runs together.

settings.routines = [{id, name, enabled, trigger: {type, phrase?, time?, days?}, steps: [{type, arg}]}]

Triggers
- time:  at trigger.time (HH:MM) on trigger.days (bitmask, bit 0 = Sunday), run by the server's
         background loop (RoutineScheduler, next to the proactive greetings) while the robot is
         online;
- voice: "সকালের রুটিন চালাও": the voice tool companion_run_routine finds it by name or phrase;
- tap:   reserved for a head-tap shortcut later (validated and stored, not run yet).
The app's "run now" sends the command {type: "routine", arg: <id>}; the server runs it itself
(the robot only ever gets what to play or do).

Steps
- say <text>        TinyBot says the text ({name}, {weather}, {date} work as in alarms)
- weather           today's weather in Bangla
- prayer_times      today's prayer times
- day_summary       the date, a special day, and what is still set for today
- alarm_list        the alarms and reminders
- play <item id>    a library item (core/companion/library.py)
- command <type[:arg]>  an existing robot command (story, pomodoro:25, night_light:on, game:catch, ...)
- smart_home <action>   core/companion/hooks.smart_home (the smart-home integration)

Run on the robot, the spoken parts are rendered to audio and sent as `play` commands, in order,
between the other commands. Run from a voice chat, the spoken parts go back to the LLM, which
says them in the chat; play and commands are still queued.
"""

import asyncio
import json
import os
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from loguru import logger

from core.companion import hooks, schema
from core.companion.bn_parse import bn_clock, bn_digits

TAG = __name__

TRIGGERS = ("voice", "time", "tap")
STEP_TYPES = ("say", "weather", "prayer_times", "day_summary", "alarm_list", "play", "command", "smart_home")
NO_ARG_STEPS = ("weather", "prayer_times", "day_summary", "alarm_list")
# Commands a routine may send (not another routine, not a firmware update)
STEP_COMMANDS = tuple(c for c in schema.COMMAND_TYPES if c not in ("routine", "update", "play"))
MAX_ROUTINES = 10
MAX_STEPS = 12
MAX_NAME = 40
MAX_PHRASE = 60
MAX_SMART_HOME = 120
WINDOW_MIN = 3  # a time routine still runs this many minutes after its time (tick is 30 s)
TICK_S = 30
SPEECH_CHUNK = 450  # spoken text per rendered clip (the TTS cache renders up to 500 chars)

PRAYER_BN = (("fajr", "ফজর"), ("dhuhr", "যোহর"), ("asr", "আসর"), ("maghrib", "মাগরিব"), ("isha", "এশা"))


def default_routines() -> List[Dict]:
    """The example every robot starts with (switched off)."""
    return [{
        "id": "morning",
        "name": "সকালের রুটিন",
        "enabled": False,
        "trigger": {"type": "time", "time": "07:00", "days": 127, "phrase": ""},
        "steps": [
            {"type": "say", "arg": "শুভ সকাল {name}! নতুন দিনটা শুরু করি চলো।"},
            {"type": "weather", "arg": ""},
            {"type": "prayer_times", "arg": ""},
            {"type": "day_summary", "arg": ""},
        ],
    }]


def routines_of(settings: Dict) -> List[Dict]:
    value = (settings or {}).get("routines")
    return default_routines() if value is None else value


# --- validation ------------------------------------------------------------------------------
def _step(raw, field: str) -> Dict:
    if not isinstance(raw, dict):
        raise schema.ValidationError(f"{field} must be an object")
    stype = raw.get("type")
    if stype not in STEP_TYPES:
        raise schema.ValidationError(f"{field}.type must be one of {', '.join(STEP_TYPES)}")
    arg = raw.get("arg", "")
    if arg is None or stype in NO_ARG_STEPS:
        arg = ""
    if not isinstance(arg, str):
        raise schema.ValidationError(f"{field}.arg must be a string")
    arg = arg.strip()
    if stype == "say":
        arg = schema.text(arg, schema.MAX_SAY, field + ".arg", required=True)
    elif stype == "play":
        if not re.match(r"^[A-Za-z0-9_-]{1,32}$", arg):
            raise schema.ValidationError(f"{field}.arg must be a library item id")
    elif stype == "command":
        ctype, _, carg = arg.partition(":")
        if ctype not in STEP_COMMANDS:
            raise schema.ValidationError(f"{field}.arg must be one of {', '.join(STEP_COMMANDS)} (type:arg)")
        cmd = schema.command({"type": ctype, "arg": carg})
        arg = cmd["type"] + (":" + cmd["arg"] if cmd["arg"] else "")
    elif stype == "smart_home":
        arg = schema.text(arg, MAX_SMART_HOME, field + ".arg", required=True)
    return {"type": stype, "arg": arg}


def _trigger(raw, field: str) -> Dict:
    if not isinstance(raw, dict):
        raise schema.ValidationError(f"{field} must be an object")
    ttype = raw.get("type", "voice")
    if ttype not in TRIGGERS:
        raise schema.ValidationError(f"{field}.type must be one of {', '.join(TRIGGERS)}")
    out = {
        "type": ttype,
        "phrase": schema.text(raw.get("phrase", ""), MAX_PHRASE, field + ".phrase"),
        "days": schema.days(raw.get("days", 127), field + ".days"),
    }
    if ttype == "time" or raw.get("time"):
        out["time"] = schema.hhmm(raw.get("time"), field + ".time")
    return out


def routine(raw, field: str = "routine") -> Dict:
    if not isinstance(raw, dict):
        raise schema.ValidationError(f"{field} must be an object")
    steps = raw.get("steps")
    if not isinstance(steps, list) or not steps:
        raise schema.ValidationError(f"{field}.steps must be a non-empty list")
    if len(steps) > MAX_STEPS:
        raise schema.ValidationError(f"{field} has more than {MAX_STEPS} steps")
    return {
        "id": schema.clean_id(raw.get("id"), "rt"),
        "name": schema.text(raw.get("name"), MAX_NAME, field + ".name", required=True),
        "enabled": schema.boolean(raw.get("enabled", True), field + ".enabled"),
        "trigger": _trigger(raw.get("trigger") or {"type": "voice"}, field + ".trigger"),
        "steps": [_step(s, f"{field}.steps[{i}]") for i, s in enumerate(steps)],
    }


def routine_list(raw, old_list: List[Dict]) -> List[Dict]:
    """The whole list from the app (like alarms): validated, ids kept unique."""
    if not isinstance(raw, list):
        raise schema.ValidationError("settings.routines must be a list")
    if len(raw) > MAX_ROUTINES:
        raise schema.ValidationError(f"at most {MAX_ROUTINES} routines")
    out, seen = [], set()
    for i, item in enumerate(raw):
        r = routine(item, f"settings.routines[{i}]")
        while r["id"] in seen:
            r["id"] = schema.new_id("rt")
        seen.add(r["id"])
        out.append(r)
    return out


# --- finding a routine by voice -------------------------------------------------------------
def _norm(text: str) -> str:
    text = re.sub(r"[\s,.;:!?।'\"-]+", " ", (text or "").lower())
    for filler in ("রুটিন", "routine", "চালাও", "চালু করো", "শুরু করো", "run", "start", "the"):
        text = text.replace(filler, " ")
    return re.sub(r"\s+", " ", text).strip()


def find_routine(items: List[Dict], query: str) -> Optional[Dict]:
    """The routine a spoken name or phrase means (exact, then contained, then most shared words)."""
    q = _norm(query)
    if not items:
        return None
    if not q:
        return items[0] if len(items) == 1 else None
    for r in items:
        if q in (_norm(r["name"]), _norm(r["trigger"].get("phrase", ""))):
            return r
    for r in items:
        names = [_norm(r["name"]), _norm(r["trigger"].get("phrase", ""))]
        if any(n and (q in n or n in q) for n in names):
            return r
    words = set(q.split())
    scored = [(len(words & set((_norm(r["name"]) + " " + _norm(r["trigger"].get("phrase", ""))).split())), r)
              for r in items]
    best = max(s for s, _ in scored)
    return next(r for s, r in scored if s == best) if best else None


# --- what the steps say ---------------------------------------------------------------------
def prayer_text(service, dev: Dict) -> str:
    p = dev.get("prayer") or {}
    lat = float(p.get("lat", service.cfg["default_lat"]))
    lon = float(p.get("lon", service.cfg["default_lon"]))
    today = service.prayer_days(lat, lon, 1)[0]
    parts = [f"{bn} {bn_clock(today[key])}" for key, bn in PRAYER_BN]
    return "আজকের নামাজের সময়: " + ", ".join(parts) + "।"


def _today_bit(now: datetime) -> int:
    return 1 << ((now.weekday() + 1) % 7)  # bit 0 = Sunday


def _mins(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def alarm_text(dev: Dict) -> str:
    alarms = sorted((a for a in dev.get("alarms", []) if a.get("enabled", True)), key=lambda a: a["time"])
    reminders = [r for r in dev.get("reminders", []) if r.get("enabled", True)]
    if not alarms and not reminders:
        return "এখন কোনো অ্যালার্ম বা রিমাইন্ডার দেওয়া নেই।"
    lines = []
    if alarms:
        lines.append(f"অ্যালার্ম {bn_digits(len(alarms))}টি: " + ", ".join(bn_clock(a["time"]) for a in alarms) + "।")
    if reminders:
        parts = []
        for r in reminders:
            if r.get("mode") == "interval":
                parts.append(f"প্রতি {bn_digits(r['every_min'])} মিনিটে {r.get('label') or 'রিমাইন্ডার'}")
            else:
                parts.append(f"{bn_clock(r['time'])} {r.get('label') or 'রিমাইন্ডার'}")
        lines.append(f"রিমাইন্ডার {bn_digits(len(reminders))}টি: " + ", ".join(parts) + "।")
    return " ".join(lines)


def day_summary_text(service, dev: Dict) -> str:
    from core.companion.service import bn_date  # service imports this module

    now = service.local_now()
    out = [f"আজ {bn_date(now.date())}।"]
    special = service.today_special(dev)
    if special:
        out.append(f"আজ {special['name_bn']}।")
    bit, minute = _today_bit(now), now.hour * 60 + now.minute
    later = sorted(
        [(a["time"], "অ্যালার্ম") for a in dev.get("alarms", [])
         if a.get("enabled", True) and a.get("days", 127) & bit and _mins(a["time"]) > minute]
        + [(r["time"], r.get("label") or "রিমাইন্ডার") for r in dev.get("reminders", [])
           if r.get("enabled", True) and r.get("mode") == "time" and r.get("days", 127) & bit
           and _mins(r["time"]) > minute]
    )
    if later:
        out.append("আজ আরও আছে: " + ", ".join(f"{bn_clock(t)} {what}" for t, what in later[:4]) + "।")
    else:
        out.append("আজ আর কোনো অ্যালার্ম বা রিমাইন্ডার বাকি নেই।")
    return " ".join(out)


def _chunks(text: str, size: int = SPEECH_CHUNK) -> List[str]:
    """Spoken text cut at sentence ends into clips the TTS cache can render."""
    text = text.strip()
    if len(text) <= size:
        return [text] if text else []
    out, cur = [], ""
    for sentence in re.split(r"(?<=[।!?.])\s+", text):
        while len(sentence) > size:
            out.append(sentence[:size])
            sentence = sentence[size:]
        if cur and len(cur) + 1 + len(sentence) > size:
            out.append(cur)
            cur = sentence
        else:
            cur = (cur + " " + sentence).strip()
    if cur:
        out.append(cur)
    return out


class RoutineRunner:
    """Runs routines for robots, and runs the time-triggered ones from a background loop."""

    def __init__(self, service, data_dir: str):
        self.service = service
        self.path = os.path.join(data_dir, "routines_state.json")
        self.last_run: Dict[str, Dict[str, str]] = self._load()
        self._task: Optional[asyncio.Task] = None
        self._running: Dict[Tuple[str, str], asyncio.Task] = {}

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
            json.dump(self.last_run, f)
        os.replace(tmp, self.path)

    # --- running ---------------------------------------------------------------------------
    async def _step_text(self, dev: Dict, step: Dict) -> str:
        svc, stype = self.service, step["type"]
        if stype == "say":
            return svc.expand(step["arg"], dev, svc.weather_for(dev))
        if stype == "weather":
            from core.companion.service import bn_weather  # service imports this module

            w = dev.get("weather") or {}
            try:
                weather = await svc.weather.get(w.get("lat", svc.cfg["default_lat"]),
                                                w.get("lon", svc.cfg["default_lon"]), wait_s=5)
            except Exception:
                weather = svc.weather_for(dev)
            return bn_weather(weather) + "।"
        if stype == "prayer_times":
            return prayer_text(svc, dev)
        if stype == "day_summary":
            return day_summary_text(svc, dev)
        if stype == "alarm_list":
            return alarm_text(dev)
        if stype == "smart_home":
            user = {"device_id": dev["id"], "owner_name": (dev.get("settings") or {}).get("owner_name", "")}
            try:
                return await hooks.call_smart_home(user, step["arg"])
            except Exception as e:
                logger.bind(tag=TAG).warning(f"smart_home step failed for {dev['id']}: {e}")
                return "স্মার্ট হোমের কাজটা এখন করা গেল না।"
        return ""

    async def run(self, device_id: str, routine_or_id, speak_on_robot: bool = True) -> Dict:
        """Run a routine now. Returns {"name", "say": text (when not spoken on the robot),
        "queued": [command types], "missing": [library ids not found]}."""
        svc = self.service
        dev = svc.store.get(device_id)
        if dev is None:
            raise KeyError(device_id)
        r = routine_or_id
        if isinstance(routine_or_id, str):
            r = next((x for x in routines_of(dev.get("settings") or {}) if x["id"] == routine_or_id), None)
            if r is None:
                raise schema.ValidationError("routine not found")
        spoken: List[str] = []
        said: List[str] = []
        queued: List[str] = []
        missing: List[str] = []

        async def flush():
            if not spoken:
                return
            text = " ".join(t for t in spoken if t)
            spoken.clear()
            if not speak_on_robot:
                said.append(text)
                return
            for chunk in _chunks(text):
                url = await svc.audio.render_now(chunk)
                if url:
                    await svc.send_command(device_id, {"type": "play", "arg": url})
                    queued.append("play")

        for step in r["steps"]:
            try:
                if step["type"] == "play":
                    await flush()
                    item = await svc.play_library(device_id, step["arg"])
                    if item is None:
                        missing.append(step["arg"])
                    else:
                        queued.append("play")
                elif step["type"] == "command":
                    await flush()
                    ctype, _, carg = step["arg"].partition(":")
                    await svc.send_command(device_id, {"type": ctype, "arg": carg})
                    queued.append(ctype)
                else:
                    text = await self._step_text(dev, step)
                    if text:
                        spoken.append(text)
            except (KeyError, schema.ValidationError) as e:
                logger.bind(tag=TAG).warning(f"Routine {r['id']} step {step['type']} skipped: {e}")
        await flush()
        logger.bind(tag=TAG).info(f"Routine {r['id']} ran on {device_id}: {queued}")
        return {"id": r["id"], "name": r["name"], "say": " ".join(said), "queued": queued, "missing": missing}

    def run_soon(self, device_id: str, routine_id: str) -> bool:
        """Start a routine in the background (the app's "run now"); False when it is already running."""
        key = (device_id, routine_id)
        task = self._running.get(key)
        if task is not None and not task.done():
            return False

        async def go():
            try:
                await self.run(device_id, routine_id)
            except Exception as e:
                logger.bind(tag=TAG).warning(f"Routine {routine_id} on {device_id} failed: {e}")
            finally:
                self._running.pop(key, None)

        self._running[key] = asyncio.get_running_loop().create_task(go())
        return True

    # --- the background loop ---------------------------------------------------------------
    def start(self):
        if self._task is None or self._task.done():
            self._task = asyncio.get_running_loop().create_task(self._loop())

    async def _loop(self):
        while True:
            try:
                await self.tick()
            except Exception as e:
                logger.bind(tag=TAG).warning(f"Routine check failed: {e}")
            await asyncio.sleep(TICK_S)

    def due(self, dev: Dict, now: datetime) -> List[Dict]:
        """Enabled time routines whose time has come (within WINDOW_MIN) and that did not run today."""
        done = self.last_run.get(dev["id"], {})
        today = now.date().isoformat()
        minute = now.hour * 60 + now.minute
        out = []
        for r in routines_of(dev.get("settings") or {}):
            t = r.get("trigger") or {}
            if not r.get("enabled") or t.get("type") != "time" or not t.get("time"):
                continue
            if not t.get("days", 127) & _today_bit(now) or done.get(r["id"]) == today:
                continue
            start = _mins(t["time"])
            if start <= minute < start + WINDOW_MIN:
                out.append(r)
        return out

    async def tick(self):
        svc = self.service
        now = svc.local_now()
        for dev_id in list(svc.store.devices):
            dev = svc.store.get(dev_id)
            if dev is None:
                continue
            await svc.expire_once(dev_id, now)
            if not svc.store.is_online(dev):
                continue
            for r in self.due(dev, now):
                self.last_run.setdefault(dev_id, {})[r["id"]] = now.date().isoformat()
                self._save()
                self.run_soon(dev_id, r["id"])
