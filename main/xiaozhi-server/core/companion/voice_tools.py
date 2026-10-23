"""Logic behind the companion voice tools (plugins_func/functions/companion_robot.py).

Every function takes the chat connection, acts on the talking robot's companion config and
returns a short English result text for the LLM to turn into a spoken reply. Kept free of the
plugin registry so it can be tested without loading the server config.
"""

import re
from typing import List, Optional

WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
DAY_PRESETS = {
    "every_day": 127,
    "weekdays": 0b0011111,  # Sunday-Thursday (Bangladesh work/school week)
    "weekend": 0b1100000,  # Friday, Saturday
}
PRAYER_BN = {"fajr": "ফজর", "dhuhr": "যোহর", "asr": "আসর", "maghrib": "মাগরিব", "isha": "এশা"}


def context(conn):
    """(service, device) for the talking robot, or (None, reason text)."""
    try:
        from core.companion import get_service

        service = get_service(conn.config)
    except Exception:
        service = None
    if service is None:
        return None, "The companion feature is not enabled on the server, so this cannot be done."
    headers = getattr(conn, "headers", None) or {}
    device_id = (getattr(conn, "device_id", None) or headers.get("device-id") or "").lower()
    dev = service.store.get(device_id) if device_id else None
    if dev is None:
        return None, (
            "This robot is not registered with the companion service yet (it registers on its "
            "first schedule sync), so this cannot be done right now."
        )
    return service, dev


def parse_time(value) -> Optional[str]:
    if not isinstance(value, str):
        return None
    s = value.strip().lower().replace(".", ":").replace(" ", "")
    m = re.match(r"^(\d{1,2})(?::(\d{2}))?(am|pm|a|p)?$", s)
    if not m:
        return None
    h, mi, ampm = int(m.group(1)), int(m.group(2) or 0), m.group(3)
    if ampm:
        if h < 1 or h > 12:
            return None
        h = h % 12 + (12 if ampm.startswith("p") else 0)
    if h > 23 or mi > 59:
        return None
    return f"{h:02d}:{mi:02d}"


def parse_days(value) -> int:
    if not value or not isinstance(value, str):
        return 127
    v = value.strip().lower().replace(" ", "_")
    if v in DAY_PRESETS:
        return DAY_PRESETS[v]
    mask = 0
    for part in re.split(r"[,;/_\s]+", value.lower()):
        part = part.strip()
        if len(part) < 2:
            continue
        for i, name in enumerate(WEEKDAYS):
            if name.startswith(part[:3]):
                mask |= 1 << i
    return mask or 127


def days_text(mask: int) -> str:
    if mask == 127:
        return "every day"
    for name, preset in DAY_PRESETS.items():
        if mask == preset:
            return name.replace("_", " ")
    return ", ".join(WEEKDAYS[i].title() for i in range(7) if mask & (1 << i))


async def set_alarm(conn, time: str = "", days: str = "", label: str = "", say: str = "") -> str:
    service, dev = context(conn)
    if service is None:
        return dev
    hhmm = parse_time(time)
    if not hhmm:
        return f"Could not understand the time '{time}'. Ask the user for the alarm time again."
    try:
        alarm = await service.add_alarm(dev["id"], hhmm, parse_days(days), label or "Alarm", say or "")
    except Exception as e:
        return f"Setting the alarm failed: {e}"
    return f"Alarm set for {alarm['time']} ({days_text(alarm['days'])}). Confirm this to the user briefly."


async def list_alarms(conn) -> str:
    service, dev = context(conn)
    if service is None:
        return dev
    lines: List[str] = []
    for a in sorted(dev["alarms"], key=lambda x: x["time"]):
        state = "on" if a.get("enabled", True) else "off"
        lines.append(f"Alarm {a['time']} {days_text(a['days'])} ({state}) {a.get('label', '')}".strip())
    for r in dev["reminders"]:
        if not r.get("enabled", True):
            continue
        if r["mode"] == "interval":
            when = f"every {r['every_min']} min {r['from']}-{r['to']}"
        else:
            when = r.get("time", "")
        lines.append(f"Reminder {r['kind']} {when} {r.get('label', '')}".strip())
    if not lines:
        return "There are no alarms or reminders set on this robot."
    return "Alarms and reminders on this robot:\n" + "\n".join(lines)


async def delete_alarm(conn, time: str = "", delete_all: bool = False) -> str:
    service, dev = context(conn)
    if service is None:
        return dev
    hhmm = ""
    if not delete_all:
        hhmm = parse_time(time)
        if not hhmm:
            return "Ask the user which alarm time to delete."
    removed = await service.delete_alarms(dev["id"], time_str=hhmm)
    if not removed:
        return f"No alarm found at {hhmm}." if hhmm else "There were no alarms to delete."
    return f"Deleted {len(removed)} alarm(s): " + ", ".join(a["time"] for a in removed)


async def add_reminder(conn, kind: str = "custom", time: str = "", every_min=None, label: str = "",
                       say: str = "") -> str:
    service, dev = context(conn)
    if service is None:
        return dev
    if kind not in ("water", "medicine", "custom"):
        kind = "custom"
    item = {"kind": kind, "enabled": True, "days": 127, "say": say or ""}
    if label:
        item["label"] = label
    if kind == "water" and not time:
        try:
            every = int(every_min or 60)
        except (TypeError, ValueError):
            every = 60
        item.update({"mode": "interval", "every_min": max(5, min(720, every))})
    else:
        hhmm = parse_time(time)
        if not hhmm:
            return "Ask the user at what time the reminder should be."
        item.update({"mode": "time", "time": hhmm})
    try:
        r = await service.add_reminder(dev["id"], item)
    except Exception as e:
        return f"Adding the reminder failed: {e}"
    when = f"every {r['every_min']} minutes" if r["mode"] == "interval" else f"at {r['time']} every day"
    return f"{r['kind'].title()} reminder added {when}. Confirm this to the user briefly."


async def start_focus(conn, minutes=None) -> str:
    service, dev = context(conn)
    if service is None:
        return dev
    arg = ""
    if minutes:
        try:
            arg = str(max(1, min(120, int(minutes))))
        except (TypeError, ValueError):
            arg = ""
    await service.send_command(dev["id"], {"type": "pomodoro", "arg": arg})
    work = arg or str(dev["pomodoro"].get("work_min", 25))
    return (
        f"A {work} minute focus timer will start on the robot in a moment. "
        "Encourage the user briefly and end the chat so they can focus."
    )


async def prayer_times(conn) -> str:
    service, dev = context(conn)
    if service is None:
        return dev
    p = dev.get("prayer") or {}
    lat = float(p.get("lat", service.cfg["default_lat"]))
    lon = float(p.get("lon", service.cfg["default_lon"]))
    today = service.prayer_days(lat, lon, 1)[0]
    parts = [f"{PRAYER_BN[k]} ({k.title()}) {today[k]}" for k in PRAYER_BN]
    return (
        f"Today's prayer times for {p.get('city') or 'the robot city'} ({today['date']}), "
        f"sunrise {today['sunrise']}: " + "; ".join(parts) + ". Say them in the user's language."
    )
