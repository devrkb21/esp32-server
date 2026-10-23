"""Companion service: ties the store, prayer times, weather and TTS audio together."""

import hashlib
import json
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from core.companion import schema
from core.companion.audio import AudioRenderer
from core.companion.prayer import PrayTimes
from core.companion.settings import companion_config
from core.companion.store import CompanionStore
from core.companion.weather import KIND_BN, WeatherService

PRAYER_NAMES = ("fajr", "dhuhr", "asr", "maghrib", "isha")
PRAYER_SAY = {
    "fajr": "ফজরের নামাজের সময় হয়েছে।",
    "dhuhr": "যোহরের নামাজের সময় হয়েছে।",
    "asr": "আসরের নামাজের সময় হয়েছে।",
    "maghrib": "মাগরিবের নামাজের সময় হয়েছে।",
    "isha": "এশার নামাজের সময় হয়েছে।",
}
RAIN_SAY = "আজ বৃষ্টি হতে পারে, বাইরে গেলে ছাতা নিও!"
RAIN_PROB_MIN = 60

BN_DIGITS = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")
BN_MONTHS = (
    "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
    "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
)
BN_WEEKDAYS = ("সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার", "রবিবার")


def bn_number(n) -> str:
    return str(n).translate(BN_DIGITS)


def bn_date(d) -> str:
    return f"{bn_number(d.day)} {BN_MONTHS[d.month - 1]}, {BN_WEEKDAYS[d.weekday()]}"


def bn_weather(w: Optional[Dict]) -> str:
    if not w or not w.get("ok"):
        return "আজকের আবহাওয়ার খবর এখন জানা নেই"
    out = f"আজ আবহাওয়া {KIND_BN.get(w.get('kind'), 'মেঘলা')}"
    if w.get("temp") is not None:
        out += f", তাপমাত্রা {bn_number(w['temp'])} ডিগ্রি"
    if (w.get("rain_prob") or 0) >= RAIN_PROB_MIN:
        out += ", বৃষ্টি হতে পারে"
    return out


class CompanionService:
    def __init__(self, config: Dict, synthesize=None):
        self.config = config
        self.cfg = companion_config(config)
        data_dir = self.cfg["data_dir"]
        os.makedirs(data_dir, exist_ok=True)
        self.store = CompanionStore(os.path.join(data_dir, "devices.json"), self.cfg)
        self.weather = WeatherService(cache_s=int(self.cfg.get("weather_cache_s", 1200)))
        self.audio = AudioRenderer(os.path.join(data_dir, "audio"), self.cfg["voice"], synthesize=synthesize)
        self.praytimes = PrayTimes(
            self.cfg.get("prayer_method", "Karachi"),
            self.cfg.get("asr_method", "Hanafi"),
            self.cfg.get("prayer_offsets") or {},
        )
        self.prayer_say = dict(PRAYER_SAY)
        self.prayer_say.update(self.cfg.get("prayer_say") or {})
        self.rain_say = self.cfg.get("rain_say") or RAIN_SAY
        self._prayer_cache: Dict[tuple, Dict] = {}
        self._last_url: Dict[tuple, str] = {}

    # --- helpers ---------------------------------------------------------------------------
    @property
    def enabled(self) -> bool:
        return bool(self.cfg.get("enabled", True))

    @property
    def app_token(self) -> str:
        return self.cfg.get("app_token", "")

    def local_now(self) -> datetime:
        tz = timezone(timedelta(hours=self.cfg["timezone_offset"]))
        return datetime.now(tz)

    def prayer_days(self, lat: float, lon: float, count: int = 2) -> List[Dict]:
        today = self.local_now().date()
        out = []
        for i in range(count):
            day = today + timedelta(days=i)
            key = (day, round(lat, 4), round(lon, 4))
            if key not in self._prayer_cache:
                if len(self._prayer_cache) > 500:
                    self._prayer_cache.clear()
                self._prayer_cache[key] = self.praytimes.compute(day, lat, lon, self.cfg["timezone_offset"])
            out.append(dict(self._prayer_cache[key]))
        return out

    def expand(self, text: str, dev: Dict, weather: Optional[Dict]) -> str:
        if not text:
            return ""
        if "{weather}" in text:
            text = text.replace("{weather}", bn_weather(weather))
        if "{date}" in text:
            text = text.replace("{date}", bn_date(self.local_now().date()))
        if "{name}" in text:
            name = (dev.get("settings") or {}).get("owner_name") or dev.get("name") or ""
            text = text.replace("{name}", name)
        return text

    def _audio_url(self, dev_id: str, key: str, text: str) -> Optional[str]:
        """URL for spoken text; while a changed text renders, keep serving the previous one."""
        if not text:
            self._last_url.pop((dev_id, key), None)
            return None
        url = self.audio.url(text)
        if url:
            self._last_url[(dev_id, key)] = url
            return url
        return self._last_url.get((dev_id, key))

    def weather_for(self, dev: Dict) -> Optional[Dict]:
        w = dev.get("weather") or {}
        return self.weather.peek(w.get("lat", self.cfg["default_lat"]), w.get("lon", self.cfg["default_lon"]))

    # --- device snapshot -------------------------------------------------------------------
    def _schedule(self, dev: Dict, weather: Optional[Dict]) -> Dict:
        dev_id = dev["id"]
        alarms = []
        for a in dev.get("alarms", []):
            say = self.expand(a.get("say", ""), dev, weather)
            alarms.append(
                {
                    "id": a["id"], "time": a["time"], "days": a["days"], "label": a.get("label", ""),
                    "enabled": a.get("enabled", True), "snooze_min": a.get("snooze_min", 5),
                    "say_audio": self._audio_url(dev_id, "a:" + a["id"], say),
                }
            )
        reminders = []
        for r in dev.get("reminders", []):
            item = {k: v for k, v in r.items() if k != "say"}
            say = self.expand(r.get("say", ""), dev, weather) if r.get("enabled", True) else ""
            item["say_audio"] = self._audio_url(dev_id, "r:" + r["id"], say)
            reminders.append(item)
        p = dev.get("prayer") or {}
        lat = float(p.get("lat", self.cfg["default_lat"]))
        lon = float(p.get("lon", self.cfg["default_lon"]))
        prayer = {
            "enabled": bool(p.get("enabled", True)),
            "remind": bool(p.get("remind", True)),
            "city": p.get("city", ""),
            "days": self.prayer_days(lat, lon) if p.get("enabled", True) else [],
            "audio": {
                k: (self.audio.url(self.prayer_say[k]) if p.get("enabled", True) and p.get("remind", True) else None)
                for k in PRAYER_NAMES
            },
        }
        return {"alarms": alarms, "reminders": reminders, "prayer": prayer}

    def _weather_block(self, dev: Dict, weather: Optional[Dict]) -> Dict:
        city = (dev.get("weather") or {}).get("city", "")
        if not weather:
            return {"ok": False, "city": city}
        out = dict(weather)
        out["city"] = city
        out["rain_audio"] = self.audio.url(self.rain_say) if (out.get("rain_prob") or 0) >= RAIN_PROB_MIN else None
        return out

    async def sync(self, device_id: str, client_id: str = "", user_agent: str = "") -> Dict:
        dev = await self.store.touch(device_id, client_id, user_agent)
        weather = self.weather_for(dev)
        sched = self._schedule(dev, weather)
        # rev also changes when derived schedule data changes (audio rendered, new prayer day)
        sig = hashlib.sha1(json.dumps(sched, sort_keys=True).encode("utf-8")).hexdigest()
        if sig != dev.get("derived_sig"):
            await self.store.bump_rev(device_id, sig)
            dev = self.store.get(device_id)
        s = dev["settings"]
        return {
            "rev": dev["rev"],
            "server_time": int(time.time()),
            "poll_s": self.cfg["poll_s"],
            "settings": {
                "volume": s.get("volume"),
                "sounds": s.get("sounds", True),
                "night": dict(s.get("night", {})),
                "care": dict(s.get("care", {})),
            },
            "pomodoro": dict(dev["pomodoro"]),
            "alarms": sched["alarms"],
            "reminders": sched["reminders"],
            "prayer": sched["prayer"],
            "weather": self._weather_block(dev, weather),
            "messages": [
                {
                    "id": m["id"], "from": m["from"], "from_ascii": m.get("from_ascii", ""),
                    "text": m["text"], "text_ascii": m.get("text_ascii", ""),
                    "audio": self.audio.url(m.get("say") or m["text"]),
                    "ask": m.get("ask", False), "ts": m["ts"],
                }
                for m in dev["messages"]
                if m["status"] == "pending"
            ],
            "commands": [
                {"id": c["id"], "type": c["type"], "arg": c.get("arg", "")}
                for c in dev["commands"]
                if c["status"] == "pending"
            ],
        }

    async def report(self, device_id: str, body: Dict) -> Dict:
        await self.store.touch(device_id)
        await self.store.apply_report(device_id, body)
        return {"ok": True}

    # --- app views -------------------------------------------------------------------------
    def device_summary(self, dev: Dict) -> Dict:
        return {
            "id": dev["id"],
            "name": dev.get("name", ""),
            "online": self.store.is_online(dev),
            "last_seen": dev.get("last_seen", 0),
            "stats": dev.get("stats", {}),
            "stats_updated": dev.get("stats_updated", 0),
        }

    def list_devices(self) -> List[Dict]:
        devs = sorted(self.store.devices.values(), key=lambda d: -(d.get("last_seen") or 0))
        return [self.device_summary(d) for d in devs]

    def message_view(self, m: Dict) -> Dict:
        out = {k: v for k, v in m.items() if k != "say"}
        out["audio"] = self.audio.url(m.get("say") or m["text"], render=False)
        return out

    def device_detail(self, dev: Dict) -> Dict:
        weather = self.weather_for(dev)
        sched = self._schedule(dev, weather)
        alarms = []
        for a, view in zip(dev.get("alarms", []), sched["alarms"]):
            alarms.append(dict(a, say_audio=view["say_audio"]))
        reminders = []
        for r, view in zip(dev.get("reminders", []), sched["reminders"]):
            reminders.append(dict(r, say_audio=view["say_audio"]))
        p = dev.get("prayer") or {}
        prayer = dict(sched["prayer"])
        prayer.update({"lat": p.get("lat"), "lon": p.get("lon")})
        w = dev.get("weather") or {}
        weather_view = self._weather_block(dev, weather)
        weather_view.update({"lat": w.get("lat"), "lon": w.get("lon")})
        out = self.device_summary(dev)
        out.update(
            {
                "rev": dev.get("rev", 0),
                "created": dev.get("created", 0),
                "settings": dev["settings"],
                "pomodoro": dev["pomodoro"],
                "alarms": alarms,
                "reminders": reminders,
                "prayer": prayer,
                "weather": weather_view,
                "events": list(reversed(dev.get("events", [])[-30:])),
                "messages": [self.message_view(m) for m in reversed(dev.get("messages", [])[-30:])],
                "commands": [c for c in reversed(dev.get("commands", [])[-20:])],
            }
        )
        return out

    async def update_config(self, device_id: str, patch: Dict) -> Dict:
        dev = await self.store.update_config(device_id, patch)
        self.prerender(dev)
        return dev

    def prerender(self, dev: Dict):
        """Start rendering every spoken line of the device's config in the background."""
        weather = self.weather_for(dev)
        self._schedule(dev, weather)
        if (weather or {}).get("rain_prob", 0) >= RAIN_PROB_MIN:
            self.audio.url(self.rain_say)

    async def send_message(self, device_id: str, body: Dict) -> Dict:
        if not isinstance(body, dict):
            raise schema.ValidationError("body must be an object")
        sender = schema.text(body.get("from", ""), schema.MAX_NAME, "from")
        text = schema.text(body.get("text"), schema.MAX_MESSAGE, "text", required=True)
        ask = schema.boolean(body.get("ask", False), "ask")
        dev = self.store.get(device_id)
        if dev is None:
            raise KeyError(device_id)
        spoken = self.expand(text, dev, self.weather_for(dev))
        say = f"{sender} বলেছে, {spoken}" if sender else spoken
        msg = await self.store.add_message(
            device_id, sender, text, ask, say,
            sender_ascii=body.get("from_ascii") if isinstance(body.get("from_ascii"), str) else None,
            text_ascii=body.get("text_ascii") if isinstance(body.get("text_ascii"), str) else None,
        )
        self.audio.schedule(say)
        return self.message_view(msg)

    async def send_command(self, device_id: str, body: Dict) -> Dict:
        cmd = schema.command(body)
        if self.store.get(device_id) is None:
            raise KeyError(device_id)
        return await self.store.add_command(device_id, cmd)

    # --- voice tool helpers ----------------------------------------------------------------
    async def add_alarm(self, device_id: str, time_str: str, days: int = 127, label: str = "",
                        say: str = "") -> Dict:
        dev = self.store.get(device_id)
        if dev is None:
            raise KeyError(device_id)
        alarms = [dict(a) for a in dev["alarms"]] + [
            {"time": time_str, "days": days, "label": label, "say": say, "enabled": True}
        ]
        dev = await self.update_config(device_id, {"alarms": alarms})
        return dev["alarms"][-1]

    async def delete_alarms(self, device_id: str, alarm_id: str = "", time_str: str = "") -> List[Dict]:
        dev = self.store.get(device_id)
        if dev is None:
            raise KeyError(device_id)
        if time_str:
            time_str = schema.hhmm(time_str, "time")
        removed = [
            a for a in dev["alarms"]
            if (alarm_id and a["id"] == alarm_id) or (time_str and a["time"] == time_str)
            or (not alarm_id and not time_str)
        ]
        if removed:
            keep = [a for a in dev["alarms"] if a not in removed]
            await self.update_config(device_id, {"alarms": keep})
        return removed

    async def add_reminder(self, device_id: str, reminder: Dict) -> Dict:
        dev = self.store.get(device_id)
        if dev is None:
            raise KeyError(device_id)
        items = [dict(r) for r in dev["reminders"]] + [reminder]
        dev = await self.update_config(device_id, {"reminders": items})
        return dev["reminders"][-1]
