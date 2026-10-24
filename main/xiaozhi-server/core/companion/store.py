"""JSON file store for companion devices (one file, atomic writes, one asyncio lock)."""

import asyncio
import copy
import json
import os
import time
from typing import Dict, List, Optional

from loguru import logger

from core.companion import schema

TAG = __name__

MAX_EVENTS = 200
MAX_MESSAGES = 100
MAX_COMMANDS = 50
ONLINE_S = 90
TOUCH_FLUSH_S = 120

STAT_KEYS = {
    "fw": str,
    "ip": str,
    "rssi": int,
    "uptime_s": int,
    "state": str,
    "volume": int,
    "bond_score": int,
    "bond_level": int,
    "mood": str,
    "streak": int,
    "pomodoros_today": int,
    "last_touch_s": int,
}


def default_device(device_id: str, defaults: Optional[Dict] = None) -> Dict:
    d = defaults or {}
    city = d.get("default_city", "Dhaka")
    lat = float(d.get("default_lat", 23.8103))
    lon = float(d.get("default_lon", 90.4125))
    now = int(time.time())
    return {
        "id": device_id,
        "name": "TinyBot",
        "created": now,
        "last_seen": 0,
        "rev": 1,
        "client_id": "",
        "user_agent": "",
        "settings": {
            "volume": None,
            "sounds": True,
            "owner_name": "",
            "night": {
                "enabled": True,
                "start": "21:30",
                "end": "06:30",
                "dim": True,
                "lullaby": True,
                "light": False,
                "light_minutes": 0,
            },
            "care": {"enabled": True, "lonely_after_min": 180},
            "pages": {page: True for page in schema.PAGES},
            "look": schema.default_look(),
            "display": schema.default_display(),
            "routine": schema.default_routine(),
            "proactive": schema.default_proactive(),
            "memory": schema.default_memory(),
        },
        "pomodoro": {"work_min": 25, "short_break_min": 5, "long_break_min": 15, "rounds": 4},
        "alarms": [],
        "reminders": [
            {
                "id": "water",
                "kind": "water",
                "label": "Drink water",
                "enabled": False,
                "mode": "interval",
                "every_min": 60,
                "from": "09:00",
                "to": "21:00",
                "days": 127,
                "say": "পানি খাওয়ার সময় হয়েছে! এক গ্লাস পানি খেয়ে নাও।",
            }
        ],
        "prayer": {"enabled": True, "remind": True, "city": city, "lat": lat, "lon": lon},
        "weather": {"city": city, "lat": lat, "lon": lon},
        "stats": {},
        "stats_updated": 0,
        "events": [],
        "messages": [],
        "commands": [],
        "derived_sig": "",
    }


def _clean_stats(raw: Dict) -> Dict:
    out = {}
    for key, typ in STAT_KEYS.items():
        if key in raw and raw[key] is not None:
            try:
                out[key] = typ(raw[key]) if typ is int else str(raw[key])[:32]
            except (TypeError, ValueError):
                pass
    hs = raw.get("high_scores")
    if isinstance(hs, dict):
        clean = {}
        for k, v in list(hs.items())[:16]:
            try:
                clean[str(k)[:24]] = int(v)
            except (TypeError, ValueError):
                pass
        out["high_scores"] = clean
    return out


class CompanionStore:
    def __init__(self, path: str, defaults: Optional[Dict] = None):
        self.path = path
        self.defaults = defaults or {}
        self.lock = asyncio.Lock()
        self.devices: Dict[str, Dict] = {}
        self._last_flush = 0.0
        self._dirty = False
        self._load()

    # --- persistence -----------------------------------------------------------------------
    def _load(self):
        if not os.path.exists(self.path):
            return
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                data = json.load(f)
            for dev in (data.get("devices") or {}).values():
                base = default_device(dev.get("id", ""), self.defaults)
                base.update(dev)
                self.devices[base["id"]] = base
        except Exception as e:
            logger.bind(tag=TAG).error(f"Failed to load companion store {self.path}: {e}")
            try:
                os.replace(self.path, self.path + f".corrupt-{int(time.time())}")
            except OSError:
                pass

    def _write(self):
        os.makedirs(os.path.dirname(self.path) or ".", exist_ok=True)
        tmp = f"{self.path}.tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"version": 1, "devices": self.devices}, f, ensure_ascii=False, indent=1)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, self.path)
        self._last_flush = time.time()
        self._dirty = False

    async def save(self):
        """Write the store; callers must hold self.lock."""
        await asyncio.get_running_loop().run_in_executor(None, self._write)

    async def flush_if_due(self):
        if self._dirty and time.time() - self._last_flush > TOUCH_FLUSH_S:
            async with self.lock:
                await self.save()

    # --- devices ---------------------------------------------------------------------------
    def get(self, device_id: str) -> Optional[Dict]:
        return self.devices.get(device_id)

    @staticmethod
    def is_online(dev: Dict) -> bool:
        return time.time() - (dev.get("last_seen") or 0) < ONLINE_S

    async def touch(self, device_id: str, client_id: str = "", user_agent: str = "",
                    mqtt_client_id: str = "") -> Dict:
        """Record a device poll, creating the device with defaults on first contact."""
        async with self.lock:
            dev = self.devices.get(device_id)
            created = dev is None
            if created:
                dev = default_device(device_id, self.defaults)
                self.devices[device_id] = dev
                logger.bind(tag=TAG).info(f"Companion device created: {device_id}")
            dev["last_seen"] = int(time.time())
            if client_id:
                dev["client_id"] = client_id[:64]
            if user_agent:
                dev["user_agent"] = user_agent[:128]
            if mqtt_client_id:
                dev["mqtt_client_id"] = mqtt_client_id[:160]
            self._dirty = True
            if created or time.time() - self._last_flush > TOUCH_FLUSH_S:
                await self.save()
            return dev

    async def delete(self, device_id: str) -> bool:
        async with self.lock:
            if self.devices.pop(device_id, None) is None:
                return False
            await self.save()
            return True

    async def update_config(self, device_id: str, patch: Dict) -> Dict:
        """Apply a validated partial update; raises schema.ValidationError. Bumps rev."""
        if not isinstance(patch, dict):
            raise schema.ValidationError("body must be an object")
        async with self.lock:
            dev = self.devices.get(device_id)
            if dev is None:
                raise KeyError(device_id)
            new = copy.deepcopy(dev)
            if "name" in patch:
                new["name"] = schema.text(patch["name"], schema.MAX_NAME, "name", required=True)
            if "settings" in patch:
                new["settings"] = schema.settings(new["settings"], patch["settings"])
            if "pomodoro" in patch:
                new["pomodoro"] = schema.pomodoro(new["pomodoro"], patch["pomodoro"])
            if "alarms" in patch:
                new["alarms"] = schema.alarm_list(patch["alarms"], new["alarms"])
            if "reminders" in patch:
                new["reminders"] = schema.reminder_list(patch["reminders"], new["reminders"])
            if "prayer" in patch:
                new["prayer"] = schema.location(
                    new["prayer"],
                    patch["prayer"],
                    "prayer",
                    {"enabled": schema.boolean, "remind": schema.boolean},
                )
            if "weather" in patch:
                new["weather"] = schema.location(new["weather"], patch["weather"], "weather")
            new["rev"] = int(dev.get("rev", 0)) + 1
            self.devices[device_id] = new
            await self.save()
            return new

    async def mutate(self, device_id: str, fn) -> Dict:
        """Run fn(dev) under the lock; when it returns True the config changed (bump rev)."""
        async with self.lock:
            dev = self.devices.get(device_id)
            if dev is None:
                raise KeyError(device_id)
            if fn(dev):
                dev["rev"] = int(dev.get("rev", 0)) + 1
            await self.save()
            return dev

    async def bump_rev(self, device_id: str, sig: Optional[str] = None):
        async with self.lock:
            dev = self.devices.get(device_id)
            if dev is None:
                return
            if sig is not None:
                if dev.get("derived_sig") == sig:
                    return
                dev["derived_sig"] = sig
            dev["rev"] = int(dev.get("rev", 0)) + 1
            await self.save()

    # --- messages / commands ---------------------------------------------------------------
    async def add_message(self, device_id: str, sender: str, text: str, ask: bool, say: str,
                          sender_ascii: str = None, text_ascii: str = None) -> Dict:
        msg = {
            "id": schema.new_id("m"),
            "from": sender,
            "from_ascii": schema.ascii_only(sender if sender_ascii is None else sender_ascii),
            "text": text,
            "text_ascii": (
                schema.ascii_only(text_ascii, 120)
                if text_ascii is not None
                else (text[:120] if schema.is_ascii(text) else "")
            ),
            "say": say,
            "ask": bool(ask),
            "ts": int(time.time()),
            "status": "pending",
            "delivered_ts": None,
            "answer": None,
            "answer_ts": None,
        }

        def fn(dev):
            dev["messages"].append(msg)
            del dev["messages"][:-MAX_MESSAGES]
            return False

        await self.mutate(device_id, fn)
        return msg

    async def add_command(self, device_id: str, cmd: Dict) -> Dict:
        item = {"id": schema.new_id("c"), "type": cmd["type"], "arg": cmd.get("arg", ""),
                "ts": int(time.time()), "status": "pending", "done_ts": None}

        def fn(dev):
            dev["commands"].append(item)
            # Drop the oldest finished commands first, then the oldest pending ones
            while len(dev["commands"]) > MAX_COMMANDS:
                done = [c for c in dev["commands"] if c["status"] != "pending"]
                dev["commands"].remove(done[0] if done else dev["commands"][0])
            return False

        await self.mutate(device_id, fn)
        return item

    async def apply_report(self, device_id: str, report: Dict) -> Dict:
        if not isinstance(report, dict):
            raise schema.ValidationError("body must be an object")
        acks = report.get("acks") or []
        replies = report.get("replies") or []
        events = report.get("events") or []
        stats = report.get("stats")
        if not isinstance(acks, list) or not isinstance(replies, list) or not isinstance(events, list):
            raise schema.ValidationError("acks, replies and events must be lists")
        now = int(time.time())
        ack_ids = {a for a in acks[:200] if isinstance(a, str)}

        def fn(dev):
            for m in dev["messages"]:
                if m["id"] in ack_ids and m["status"] == "pending":
                    m["status"] = "delivered"
                    m["delivered_ts"] = now
            for c in dev["commands"]:
                if c["id"] in ack_ids and c["status"] == "pending":
                    c["status"] = "done"
                    c["done_ts"] = now
            by_id = {m["id"]: m for m in dev["messages"]}
            for r in replies[:50]:
                if not isinstance(r, dict):
                    continue
                m = by_id.get(r.get("id"))
                answer = r.get("answer")
                if m is None or answer not in schema.ANSWERS:
                    continue
                if m["status"] == "pending":
                    m["status"] = "delivered"
                    m["delivered_ts"] = now
                # "seen" never overrides a real yes/no answer
                if answer != "seen" or m.get("answer") in (None, "seen"):
                    m["answer"] = answer
                    m["answer_ts"] = _int(r.get("ts"), now)
            for e in events[:100]:
                if not isinstance(e, dict) or not isinstance(e.get("type"), str):
                    continue
                dev["events"].append(
                    {
                        "type": e["type"][:32],
                        "id": str(e.get("id", ""))[:32],
                        "value": _int(e.get("value"), 0),
                        "ts": _int(e.get("ts"), now),
                        "rx": now,
                    }
                )
            del dev["events"][:-MAX_EVENTS]
            if isinstance(stats, dict):
                dev["stats"] = _clean_stats(stats)
                dev["stats_updated"] = now
            dev["last_seen"] = now
            return False

        return await self.mutate(device_id, fn)


def _int(value, default):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default
