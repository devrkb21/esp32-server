"""Validation and normalisation of companion config coming from the app or voice tools."""

import re
import uuid
from typing import Any, Dict, List, Optional

TIME_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")

MAX_NAME = 32
MAX_LABEL = 24  # shown on the OLED
MAX_SAY = 300
MAX_MESSAGE = 300
MAX_ALARMS = 20
MAX_REMINDERS = 20
MAX_ARG = 64

REMINDER_KINDS = ("water", "medicine", "custom")
REMINDER_MODES = ("interval", "time")
COMMAND_TYPES = ("story", "pomodoro", "lullaby", "ring", "breathe", "night_light", "game", "stop", "night")
# Info pages on the robot (hold the head 3 s); each can be switched off from the app
PAGES = ("clock", "weather", "prayer", "focus", "games", "breathe", "story", "night", "status", "bond")
GAMES = ("catch", "simon", "dice", "reaction")
ANSWERS = ("yes", "no", "seen")
EVENT_TYPES = (
    "alarm_dismissed",
    "alarm_snoozed",
    "alarm_missed",
    "reminder_done",
    "reminder_missed",
    "prayer_reminded",
    "pomodoro_done",
    "game_score",
    "streak",
    "dropped",
    "lonely",
)


class ValidationError(ValueError):
    pass


def new_id(prefix: str) -> str:
    return prefix + uuid.uuid4().hex[:8]


def clean_id(value, prefix: str) -> str:
    if isinstance(value, str) and re.match(r"^[A-Za-z0-9_-]{1,32}$", value):
        return value
    return new_id(prefix)


def ascii_only(text: Any, limit: int = MAX_LABEL) -> str:
    """Printable ASCII subset of text (the OLED fonts are ASCII only)."""
    if not isinstance(text, str):
        return ""
    out = "".join(ch for ch in text if 32 <= ord(ch) < 127)
    return re.sub(r"\s+", " ", out).strip()[:limit]


def is_ascii(text: str) -> bool:
    return all(ord(ch) < 128 for ch in text)


def text(value: Any, limit: int, field: str, required: bool = False) -> str:
    if value is None:
        value = ""
    if not isinstance(value, str):
        raise ValidationError(f"{field} must be a string")
    value = value.strip()
    if required and not value:
        raise ValidationError(f"{field} is required")
    return value[:limit]


def hhmm(value: Any, field: str) -> str:
    if isinstance(value, str):
        value = value.strip()
        if re.match(r"^\d:[0-5]\d$", value):
            value = "0" + value
        if TIME_RE.match(value):
            return value
    raise ValidationError(f"{field} must be HH:MM")


def boolean(value: Any, field: str) -> bool:
    if isinstance(value, bool):
        return value
    if value in (0, 1):
        return bool(value)
    raise ValidationError(f"{field} must be true/false")


def integer(value: Any, lo: int, hi: int, field: str) -> int:
    if isinstance(value, bool):
        raise ValidationError(f"{field} must be a number")
    try:
        if isinstance(value, str):
            value = value.strip()
        ivalue = int(float(value))
    except (TypeError, ValueError):
        raise ValidationError(f"{field} must be a number")
    if ivalue < lo or ivalue > hi:
        raise ValidationError(f"{field} must be between {lo} and {hi}")
    return ivalue


def number(value: Any, lo: float, hi: float, field: str) -> float:
    try:
        fvalue = float(value)
    except (TypeError, ValueError):
        raise ValidationError(f"{field} must be a number")
    if not (lo <= fvalue <= hi):
        raise ValidationError(f"{field} out of range")
    return fvalue


def days(value: Any, field: str = "days") -> int:
    return integer(value, 0, 127, field)


def alarm(raw: Dict, old: Optional[Dict] = None) -> Dict:
    if not isinstance(raw, dict):
        raise ValidationError("alarm must be an object")
    base = dict(old or {})
    base.update(raw)
    return {
        "id": clean_id(base.get("id"), "a"),
        "time": hhmm(base.get("time"), "alarm.time"),
        "days": days(base.get("days", 127), "alarm.days"),
        "label": ascii_only(base.get("label", "")),
        "enabled": boolean(base.get("enabled", True), "alarm.enabled"),
        "snooze_min": integer(base.get("snooze_min", 5), 0, 60, "alarm.snooze_min"),
        "say": text(base.get("say", ""), MAX_SAY, "alarm.say"),
    }


def reminder(raw: Dict, old: Optional[Dict] = None) -> Dict:
    if not isinstance(raw, dict):
        raise ValidationError("reminder must be an object")
    base = dict(old or {})
    base.update(raw)
    kind = base.get("kind", "custom")
    if kind not in REMINDER_KINDS:
        raise ValidationError(f"reminder.kind must be one of {', '.join(REMINDER_KINDS)}")
    mode = base.get("mode") or ("interval" if kind == "water" else "time")
    if mode not in REMINDER_MODES:
        raise ValidationError("reminder.mode must be interval or time")
    default_label = {"water": "Drink water", "medicine": "Medicine"}.get(kind, "Reminder")
    out = {
        "id": clean_id(base.get("id"), "r"),
        "kind": kind,
        "label": ascii_only(base.get("label", default_label)) if base.get("label") is not None else default_label,
        "enabled": boolean(base.get("enabled", True), "reminder.enabled"),
        "mode": mode,
        "days": days(base.get("days", 127), "reminder.days"),
        "say": text(base.get("say", ""), MAX_SAY, "reminder.say"),
    }
    if mode == "interval":
        out["every_min"] = integer(base.get("every_min", 60), 5, 720, "reminder.every_min")
        out["from"] = hhmm(base.get("from", "09:00"), "reminder.from")
        out["to"] = hhmm(base.get("to", "21:00"), "reminder.to")
    else:
        out["time"] = hhmm(base.get("time"), "reminder.time")
    return out


def _merge_section(old: Dict, patch: Any, field: str, rules: Dict) -> Dict:
    if not isinstance(patch, dict):
        raise ValidationError(f"{field} must be an object")
    out = dict(old)
    for key, value in patch.items():
        if key not in rules:
            continue
        out[key] = rules[key](value, f"{field}.{key}")
    return out


def default_pages() -> Dict[str, bool]:
    return {page: True for page in PAGES}


def settings(old: Dict, patch: Any) -> Dict:
    if not isinstance(patch, dict):
        raise ValidationError("settings must be an object")
    out = dict(old)
    if "volume" in patch:
        out["volume"] = None if patch["volume"] is None else integer(patch["volume"], 0, 100, "settings.volume")
    if "sounds" in patch:
        out["sounds"] = boolean(patch["sounds"], "settings.sounds")
    if "owner_name" in patch:
        out["owner_name"] = text(patch["owner_name"], MAX_NAME, "settings.owner_name")
    if "night" in patch:
        out["night"] = _merge_section(
            old.get("night", {}),
            patch["night"],
            "settings.night",
            {
                "enabled": boolean,
                "start": hhmm,
                "end": hhmm,
                "dim": boolean,
                "lullaby": boolean,
                "light": boolean,
            },
        )
    if "pages" in patch:
        out["pages"] = _merge_section(
            dict(default_pages(), **(old.get("pages") or {})),
            patch["pages"],
            "settings.pages",
            {page: boolean for page in PAGES},
        )
    if "care" in patch:
        out["care"] = _merge_section(
            old.get("care", {}),
            patch["care"],
            "settings.care",
            {
                "enabled": boolean,
                "lonely_after_min": lambda v, f: integer(v, 10, 1440, f),
            },
        )
    return out


def pomodoro(old: Dict, patch: Any) -> Dict:
    return _merge_section(
        old,
        patch,
        "pomodoro",
        {
            "work_min": lambda v, f: integer(v, 1, 120, f),
            "short_break_min": lambda v, f: integer(v, 1, 60, f),
            "long_break_min": lambda v, f: integer(v, 1, 90, f),
            "rounds": lambda v, f: integer(v, 1, 12, f),
        },
    )


def location(old: Dict, patch: Any, field: str, extra: Optional[Dict] = None) -> Dict:
    rules = {
        "city": lambda v, f: text(v, 64, f),
        "lat": lambda v, f: number(v, -90, 90, f),
        "lon": lambda v, f: number(v, -180, 180, f),
    }
    rules.update(extra or {})
    return _merge_section(old, patch, field, rules)


def alarm_list(raw: Any, old_list: List[Dict]) -> List[Dict]:
    if not isinstance(raw, list):
        raise ValidationError("alarms must be a list")
    if len(raw) > MAX_ALARMS:
        raise ValidationError(f"at most {MAX_ALARMS} alarms")
    old_by_id = {a["id"]: a for a in old_list}
    out, seen = [], set()
    for item in raw:
        a = alarm(item, old_by_id.get(item.get("id")) if isinstance(item, dict) else None)
        while a["id"] in seen:
            a["id"] = new_id("a")
        seen.add(a["id"])
        out.append(a)
    return out


def reminder_list(raw: Any, old_list: List[Dict]) -> List[Dict]:
    if not isinstance(raw, list):
        raise ValidationError("reminders must be a list")
    if len(raw) > MAX_REMINDERS:
        raise ValidationError(f"at most {MAX_REMINDERS} reminders")
    old_by_id = {r["id"]: r for r in old_list}
    out, seen = [], set()
    for item in raw:
        old = old_by_id.get(item.get("id")) if isinstance(item, dict) else None
        if old and isinstance(item, dict) and item.get("mode") and item.get("mode") != old.get("mode"):
            old = {k: v for k, v in old.items() if k not in ("time", "every_min", "from", "to")}
        r = reminder(item, old)
        while r["id"] in seen:
            r["id"] = new_id("r")
        seen.add(r["id"])
        out.append(r)
    return out


def command(raw: Any) -> Dict:
    if not isinstance(raw, dict):
        raise ValidationError("command must be an object")
    ctype = raw.get("type")
    if ctype not in COMMAND_TYPES:
        raise ValidationError(f"type must be one of {', '.join(COMMAND_TYPES)}")
    arg = raw.get("arg", "")
    if arg is None:
        arg = ""
    if isinstance(arg, (int, float)) and not isinstance(arg, bool):
        arg = str(int(arg))
    arg = text(arg, MAX_ARG, "arg")
    if ctype == "pomodoro" and arg:
        arg = str(integer(arg, 1, 120, "arg"))
    elif ctype in ("night_light", "night"):
        arg = arg.lower() or "on"
        if arg not in ("on", "off"):
            raise ValidationError("arg must be on or off")
    elif ctype == "game":
        arg = arg.lower() or "catch"
        if arg not in GAMES:
            raise ValidationError(f"arg must be one of {', '.join(GAMES)}")
    elif ctype in ("lullaby", "ring", "breathe", "stop"):
        arg = ""
    return {"type": ctype, "arg": arg}
