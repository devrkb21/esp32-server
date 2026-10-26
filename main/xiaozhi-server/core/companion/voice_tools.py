"""Logic behind the companion voice tools (plugins_func/functions/companion_robot.py).

Every function takes the chat connection, acts on the talking robot's companion config and
returns a short result text for the LLM to turn into a spoken reply: the facts in English plus
a ready Bangla confirmation line, so TinyBot confirms in Bangla. Kept free of the plugin
registry so it can be tested without loading the server config.

Times and durations may come as the LLM wrote them ("07:30", "7 pm") or as the user said them
in Bangla ("সাড়ে সাতটা", "পৌনে ন'টা", "১০ মিনিট", "আধা ঘণ্টা"): see bn_parse.py. Timers and
one-time alarms/reminders are stored in the robot's alarms and reminders with a `once` date
(so the robot and the apps see them) and removed by the server after they rang.
"""

import re
from datetime import datetime, timedelta
from typing import List, Optional

from core.companion import bn_parse, schema

WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
WEEKDAYS_BN = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"]
DAY_PRESETS = {
    "every_day": 127,
    "weekdays": 0b0011111,  # Sunday-Thursday (Bangladesh work/school week)
    "weekend": 0b1100000,  # Friday, Saturday
}
DAY_PRESETS_BN = {127: "প্রতিদিন", 0b0011111: "রবি থেকে বৃহস্পতিবার", 0b1100000: "শুক্র আর শনিবার"}
ONCE_WORDS = ("once", "one_time", "today", "tomorrow", "একবার", "আজ", "কাল", "আগামীকাল")
PRAYER_BN = {"fajr": "ফজর", "dhuhr": "যোহর", "asr": "আসর", "maghrib": "মাগরিব", "isha": "এশা"}
MAX_TIMER_MIN = 24 * 60


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


def say_bn(line: str) -> str:
    return f' Confirm it to the user in Bangla, for example: "{line}"'


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


def parse_any_time(value, now: Optional[datetime] = None) -> Optional[str]:
    """HH:MM from what the LLM passed: 24 h text, "7 pm", or the user's Bangla words."""
    return parse_time(value) or bn_parse.parse_clock(value, now) if isinstance(value, str) else None


def is_once(value) -> bool:
    return isinstance(value, str) and value.strip().lower().replace(" ", "_") in ONCE_WORDS


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
        for i, name in enumerate(WEEKDAYS_BN):
            if len(part) >= 2 and name.startswith(part[:3]):
                mask |= 1 << i
    return mask or 127


def days_text(mask: int) -> str:
    if mask == 127:
        return "every day"
    for name, preset in DAY_PRESETS.items():
        if mask == preset:
            return name.replace("_", " ")
    return ", ".join(WEEKDAYS[i].title() for i in range(7) if mask & (1 << i))


def days_bn(mask: int) -> str:
    if mask in DAY_PRESETS_BN:
        return DAY_PRESETS_BN[mask]
    return ", ".join(WEEKDAYS_BN[i] for i in range(7) if mask & (1 << i))


def _bit(d) -> int:
    return 1 << ((d.weekday() + 1) % 7)  # bit 0 = Sunday


def next_occurrence(hhmm: str, now: datetime, tomorrow: bool = False) -> datetime:
    """The next time the clock shows hhmm (today, or tomorrow when it has passed or is asked)."""
    h, m = (int(x) for x in hhmm.split(":"))
    at = now.replace(hour=h, minute=m, second=0, microsecond=0)
    if tomorrow or at <= now:
        at += timedelta(days=1)
    return at


def when_bn(at: datetime, now: datetime) -> str:
    day = "আজ" if at.date() == now.date() else ("আগামীকাল" if at.date() == now.date() + timedelta(days=1)
                                               else WEEKDAYS_BN[(at.weekday() + 1) % 7])
    return f"{day} {bn_parse.bn_clock(at.strftime('%H:%M'))}"


def _wants_tomorrow(*texts) -> bool:
    return any(isinstance(t, str) and re.search(r"(tomorrow|আগামীকাল|কাল সকাল|কাল রাত|কাল দুপুর|কাল বিকেল|^কাল)",
                                                   t.strip().lower()) for t in texts)


# --- alarms ----------------------------------------------------------------------------------
async def set_alarm(conn, time: str = "", days: str = "", label: str = "", say: str = "") -> str:
    service, dev = context(conn)
    if service is None:
        return dev
    now = service.local_now()
    hhmm = parse_any_time(time, now)
    if not hhmm:
        return f"Could not understand the time '{time}'. Ask the user for the alarm time again."
    once = ""
    mask = parse_days(days)
    if is_once(days) or _wants_tomorrow(time, days):
        at = next_occurrence(hhmm, now, tomorrow=_wants_tomorrow(time, days))
        once, mask = at.date().isoformat(), _bit(at)
    try:
        alarm = await service.add_alarm(dev["id"], hhmm, mask, label or "Alarm", say or "", once=once)
    except Exception as e:
        return f"Setting the alarm failed: {e}"
    if once:
        at = next_occurrence(hhmm, now, tomorrow=once != now.date().isoformat())
        return (f"One-time alarm set for {alarm['time']} on {once}."
                + say_bn(f"ঠিক আছে, {when_bn(at, now)} অ্যালার্ম দিলাম।"))
    return (f"Alarm set for {alarm['time']} ({days_text(alarm['days'])})."
            + say_bn(f"ঠিক আছে, {days_bn(alarm['days'])} {bn_parse.bn_clock(alarm['time'])} অ্যালার্ম দিলাম।"))


async def list_alarms(conn) -> str:
    service, dev = context(conn)
    if service is None:
        return dev
    from core.companion.routines import alarm_text

    lines: List[str] = []
    for a in sorted(dev["alarms"], key=lambda x: x["time"]):
        state = "on" if a.get("enabled", True) else "off"
        when = f"once on {a['once']}" if a.get("once") else days_text(a["days"])
        lines.append(f"Alarm {a['time']} {when} ({state}) {a.get('label', '')}".strip())
    for r in dev["reminders"]:
        if not r.get("enabled", True):
            continue
        if r["mode"] == "interval":
            when = f"every {r['every_min']} min {r['from']}-{r['to']}"
        else:
            when = r.get("time", "") + (f" once on {r['once']}" if r.get("once") else "")
        lines.append(f"Reminder {r['kind']} {when} {r.get('label', '')}".strip())
    if not lines:
        return "There are no alarms or reminders set on this robot." + say_bn(alarm_text(dev))
    return ("Alarms and reminders on this robot:\n" + "\n".join(lines)
            + "\nTell them to the user in Bangla, briefly, for example: \"" + alarm_text(dev) + "\"")


async def delete_alarm(conn, time: str = "", delete_all: bool = False) -> str:
    service, dev = context(conn)
    if service is None:
        return dev
    hhmm = ""
    if not delete_all:
        hhmm = parse_any_time(time, service.local_now())
        if not hhmm:
            return "Ask the user which alarm time to delete."
    removed = await service.delete_alarms(dev["id"], time_str=hhmm)
    if not removed:
        return (f"No alarm found at {hhmm}." if hhmm else "There were no alarms to delete.") + say_bn(
            f"{bn_parse.bn_clock(hhmm)}-এ কোনো অ্যালার্ম পেলাম না।" if hhmm else "কোনো অ্যালার্ম দেওয়া ছিল না।")
    return (f"Deleted {len(removed)} alarm(s): " + ", ".join(a["time"] for a in removed) + "."
            + say_bn(f"{bn_parse.bn_digits(len(removed))}টি অ্যালার্ম বাদ দিলাম।"))


# --- reminders and timers ----------------------------------------------------------------------
def _kind_for(kind: str, *texts) -> str:
    if kind in ("water", "medicine", "custom"):
        return kind
    joined = " ".join(t for t in texts if isinstance(t, str)).lower()
    if "ওষুধ" in joined or "medicine" in joined or "ঔষধ" in joined:
        return "medicine"
    if "পানি" in joined or "water" in joined:
        return "water"
    return "custom"


def _label(label: str, kind: str, fallback: str) -> str:
    text = schema.ascii_only(label or "")
    return text or {"medicine": "Medicine", "water": "Drink water"}.get(kind, fallback)


def _say_line(say: str, what: str, kind: str) -> str:
    if say:
        return say
    if what:
        return f"সময় হয়েছে! {what}"
    return {"medicine": "ওষুধ খাওয়ার সময় হয়েছে!", "water": "পানি খাওয়ার সময় হয়েছে! এক গ্লাস পানি খেয়ে নাও।"}.get(
        kind, "সময় হয়েছে!")


async def set_timer(conn, after="", what: str = "", kind: str = "", label: str = "", say: str = "") -> str:
    """A one-time reminder after a duration: "১০ মিনিট পরে মনে করিয়ে দিও ওষুধ খেতে"."""
    service, dev = context(conn)
    if service is None:
        return dev
    minutes = bn_parse.parse_duration(after)
    if not minutes:
        return f"Could not understand the duration '{after}'. Ask the user after how long to remind them."
    if minutes > MAX_TIMER_MIN:
        return "Timers can be at most 24 hours. Suggest setting an alarm or reminder at a clock time instead."
    now = service.local_now()
    # the robot rings on the minute: round up so it never rings early
    at = (now + timedelta(minutes=minutes, seconds=59)).replace(second=0, microsecond=0)
    kind = _kind_for(kind, what, label, say)
    item = {
        "kind": kind, "mode": "time", "time": at.strftime("%H:%M"), "days": _bit(at), "enabled": True,
        "once": at.date().isoformat(), "label": _label(label, kind, "Timer"), "say": _say_line(say, what, kind),
    }
    try:
        r = await service.add_reminder(dev["id"], item)
    except Exception as e:
        return f"Setting the timer failed: {e}"
    about = f" {what} এর কথা" if what else ""
    return (f"Timer set: in {minutes} minutes, at {r['time']} ({r['once']}), the robot will remind the user."
            + say_bn(f"ঠিক আছে, {bn_parse.bn_duration(minutes)} পরে, {when_bn(at, now)},{about} মনে করিয়ে দেব।"))


async def add_reminder(conn, kind: str = "custom", time: str = "", every_min=None, label: str = "",
                       say: str = "", after: str = "", once: bool = False) -> str:
    service, dev = context(conn)
    if service is None:
        return dev
    if after or (time and bn_parse.is_relative(time) and not parse_time(time)):
        return await set_timer(conn, after or time, kind=kind, label=label, say=say)
    if kind not in ("water", "medicine", "custom"):
        kind = "custom"
    now = service.local_now()
    item = {"kind": kind, "enabled": True, "days": 127, "say": say or ""}
    if label:
        item["label"] = label
    if kind == "water" and not time:
        try:
            every = int(every_min or 60)
        except (TypeError, ValueError):
            every = bn_parse.parse_duration(str(every_min)) or 60
        item.update({"mode": "interval", "every_min": max(5, min(720, every))})
    else:
        hhmm = parse_any_time(time, now)
        if not hhmm:
            return "Ask the user at what time the reminder should be."
        item.update({"mode": "time", "time": hhmm})
        if once or _wants_tomorrow(time):
            at = next_occurrence(hhmm, now, tomorrow=_wants_tomorrow(time))
            item.update({"once": at.date().isoformat(), "days": _bit(at)})
    try:
        r = await service.add_reminder(dev["id"], item)
    except Exception as e:
        return f"Adding the reminder failed: {e}"
    if r["mode"] == "interval":
        return (f"{r['kind'].title()} reminder added every {r['every_min']} minutes."
                + say_bn(f"ঠিক আছে, প্রতি {bn_parse.bn_digits(r['every_min'])} মিনিটে মনে করিয়ে দেব।"))
    if r.get("once"):
        at = next_occurrence(r["time"], now, tomorrow=r["once"] != now.date().isoformat())
        return (f"{r['kind'].title()} reminder added once at {r['time']} on {r['once']}."
                + say_bn(f"ঠিক আছে, {when_bn(at, now)} মনে করিয়ে দেব।"))
    return (f"{r['kind'].title()} reminder added at {r['time']} every day."
            + say_bn(f"ঠিক আছে, প্রতিদিন {bn_parse.bn_clock(r['time'])} মনে করিয়ে দেব।"))


def _matches(item: dict, hhmm: str, words: List[str]) -> bool:
    if hhmm and item.get("time") != hhmm:
        return False
    if words:
        hay = " ".join(str(item.get(k, "")) for k in ("label", "say", "kind")).lower()
        return any(w in hay for w in words)
    return bool(hhmm)


async def cancel_reminder(conn, time: str = "", what: str = "", cancel_all: bool = False,
                          timers_only: bool = False) -> str:
    """Cancel reminders or timers by time, by what they are about, or all of them."""
    service, dev = context(conn)
    if service is None:
        return dev
    hhmm = parse_any_time(time, service.local_now()) if time else ""
    words = [w for w in re.split(r"[\s,]+", (what or "").lower()) if len(w) > 1]
    if not (cancel_all or hhmm or words):
        return "Ask the user which reminder or timer to cancel (its time, or what it is about)."
    pool = [r for r in dev["reminders"] if r.get("enabled", True) and (not timers_only or r.get("once"))]
    if cancel_all:
        removed = [r for r in pool if r.get("id") != "water" or r.get("once")]
    else:
        removed = [r for r in pool if _matches(r, hhmm, words)]
    if not removed:
        return "No matching reminder or timer was found." + say_bn("এমন কোনো রিমাইন্ডার পেলাম না।")
    keep = [r for r in dev["reminders"] if r not in removed]
    await service.update_config(dev["id"], {"reminders": keep})
    return (f"Cancelled {len(removed)} reminder(s): " + ", ".join(r.get("time", r["kind"]) for r in removed) + "."
            + say_bn(f"{bn_parse.bn_digits(len(removed))}টি রিমাইন্ডার বাদ দিলাম।"))


# --- focus, prayer ---------------------------------------------------------------------------
async def start_focus(conn, minutes=None) -> str:
    service, dev = context(conn)
    if service is None:
        return dev
    arg = ""
    if minutes:
        try:
            arg = str(max(1, min(120, int(minutes))))
        except (TypeError, ValueError):
            parsed = bn_parse.parse_duration(str(minutes))
            arg = str(max(1, min(120, parsed))) if parsed else ""
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


# --- routines and the library ------------------------------------------------------------------
async def run_routine(conn, name: str = "") -> str:
    """"সকালের রুটিন চালাও": run a routine; the spoken parts come back for the LLM to say."""
    service, dev = context(conn)
    if service is None:
        return dev
    from core.companion import routines

    items = routines.routines_of(dev.get("settings") or {})
    if not items:
        return "No routines are set up. Tell the user they can make one on the Day page of the app (রুটিন)."
    r = routines.find_routine(items, name)
    if r is None:
        names = ", ".join(f"'{x['name']}'" for x in items)
        return f"No routine matches '{name}'. The routines are: {names}. Ask which one to run."
    if not r.get("enabled", True):
        return (f"The routine '{r['name']}' is switched off." + say_bn(
            f"'{r['name']}' রুটিনটা এখন বন্ধ করা আছে। অ্যাপের দিন পাতা থেকে চালু করতে পারো।"))
    result = await service.routines.run(dev["id"], r, speak_on_robot=False)
    out = f"Running the routine '{r['name']}'."
    if result["say"]:
        out += (" Say this to the user now, naturally and in Bangla, without adding a list or "
                "markdown: \"" + result["say"] + "\"")
    queued = [q for q in result["queued"] if q != "play"]
    if "play" in result["queued"]:
        out += " Something will play on the robot after this chat; tell the user to listen."
    if queued:
        out += " The robot will also do: " + ", ".join(queued) + "."
    if result["missing"]:
        out += " Some library items of the routine are gone and were skipped."
    return out


async def play_library(conn, kind: str = "", title: str = "") -> str:
    """"একটা ছড়া শোনাও": pick from the robot's library (own items first, then the defaults)."""
    service, dev = context(conn)
    if service is None:
        return dev
    from core.companion.library import KIND_BN, KINDS

    kind = kind if kind in KINDS else ""
    item = service.library.pick(dev["id"], kind, title)
    if item is None:
        what = KIND_BN.get(kind, "কিছু")
        return (f"The library has no {kind or 'items'}." + say_bn(
            f"আমার লাইব্রেরিতে এখন কোনো {what} নেই। অ্যাপের লাইব্রেরিতে যোগ করে দিতে পারো।"))
    if item.get("text"):
        return (f"From the library ({item['kind']}): '{item['title']}'. Say its title in one short "
                "Bangla sentence, then read this text aloud exactly as written, with nothing added: \""
                + item["text"] + "\"")
    try:
        await service.play_library(dev["id"], item["id"])
    except schema.ValidationError as e:
        return f"Playing '{item['title']}' failed: {e}"
    return (f"'{item['title']}' ({item['kind']}) will play on the robot as soon as this chat ends."
            + say_bn(f"এই নাও, শোনো: {item['title']}।") + " Then end the chat so it can play.")

