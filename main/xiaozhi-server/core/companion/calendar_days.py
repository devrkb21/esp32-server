"""Special days: what today is for the robot's family (`today_special` in the robot snapshot).

Three sources, for the robot's local date:
- fixed national days of Bangladesh (Gregorian dates that never move): 21 February (Shaheed
  Day / International Mother Language Day), 26 March (Independence Day), 14 April (Pohela
  Boishakh), 16 December (Victory Day);
- the admin's list of dated days (manager-api module `calendar`, back-office page): Eid ul-Fitr,
  Eid ul-Adha and custom days. Lunar dates are never computed or guessed here: an Eid is only
  known when an admin has entered its date. The list is fetched from manager-api
  (`GET /config/calendar-days`, server secret) and cached in `<data_dir>/calendar_days.json`;
  a standalone server can list days in its config (`companion.calendar_days`);
- the owner's days to remember (settings.calendar.remember: birthdays and other yearly days).

settings.calendar = {special_days: bool, remember: [{id, date: "MM-DD", name, kind}]}
today_special    = {key, name_bn, name_en} | None
"""

import asyncio
import json
import os
import re
import time
from datetime import date
from typing import Dict, List, Optional

from loguru import logger

from core.companion import schema

TAG = __name__

KEYS = ("pohela_boishakh", "ekushey", "independence_day", "victory_day", "eid_ul_fitr", "eid_ul_adha",
        "birthday", "custom")
ADMIN_KEYS = ("eid_ul_fitr", "eid_ul_adha", "custom")
REMEMBER_KINDS = ("birthday", "anniversary", "custom")
MAX_REMEMBER = 30
MAX_DAY_NAME = 40
REFRESH_S = 6 * 3600

NATIONAL = {
    (2, 21): ("ekushey", "শহীদ দিবস ও আন্তর্জাতিক মাতৃভাষা দিবস", "Shaheed Day and International Mother Language Day"),
    (3, 26): ("independence_day", "স্বাধীনতা দিবস", "Independence Day"),
    (4, 14): ("pohela_boishakh", "পহেলা বৈশাখ", "Pohela Boishakh, the Bangla New Year"),
    (12, 16): ("victory_day", "বিজয় দিবস", "Victory Day"),
}
ADMIN_NAMES = {
    "eid_ul_fitr": ("ঈদুল ফিতর", "Eid ul-Fitr"),
    "eid_ul_adha": ("ঈদুল আযহা", "Eid ul-Adha"),
}
# How TinyBot should greet on the day (for the morning greeting's LLM prompt)
GREETING_HINT = {
    "ekushey": "It is a day of remembrance for the language martyrs of 1952: be gentle and respectful, "
               "say something warm about the Bangla language, no party mood.",
    "independence_day": "Wish a happy Independence Day with pride and warmth.",
    "pohela_boishakh": "Wish 'শুভ নববর্ষ' cheerfully for the Bangla New Year.",
    "victory_day": "Wish a happy Victory Day with pride and gratitude.",
    "eid_ul_fitr": "Wish 'ঈদ মোবারক' joyfully.",
    "eid_ul_adha": "Wish 'ঈদ মোবারক' joyfully.",
    "birthday": "Wish a happy birthday ('শুভ জন্মদিন') to the person named, warmly and playfully.",
    "custom": "Mention the day warmly.",
}


def default_calendar() -> Dict:
    return {"special_days": True, "remember": []}


def _month_day(value, field: str) -> str:
    if isinstance(value, str):
        v = value.strip()
        m = re.match(r"^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$", v)
        if m:
            month, day = int(m.group(1)), int(m.group(2))
            try:
                date(2024, month, day)  # a leap year: 02-29 is a valid day to remember
            except ValueError:
                raise schema.ValidationError(f"{field} is not a calendar day")
            return v
    raise schema.ValidationError(f"{field} must be MM-DD")


def remember_list(value, field: str = "calendar.remember") -> List[Dict]:
    if not isinstance(value, list):
        raise schema.ValidationError(f"{field} must be a list")
    if len(value) > MAX_REMEMBER:
        raise schema.ValidationError(f"at most {MAX_REMEMBER} days to remember")
    out, seen = [], set()
    for i, item in enumerate(value):
        f = f"{field}[{i}]"
        if not isinstance(item, dict):
            raise schema.ValidationError(f"{f} must be an object")
        kind = item.get("kind", "birthday")
        if kind not in REMEMBER_KINDS:
            raise schema.ValidationError(f"{f}.kind must be one of {', '.join(REMEMBER_KINDS)}")
        day = {
            "id": schema.clean_id(item.get("id"), "s"),
            "date": _month_day(item.get("date"), f + ".date"),
            "name": schema.text(item.get("name"), MAX_DAY_NAME, f + ".name", required=True),
            "kind": kind,
        }
        while day["id"] in seen:
            day["id"] = schema.new_id("s")
        seen.add(day["id"])
        out.append(day)
    return sorted(out, key=lambda d: d["date"])


def calendar_settings(old: Dict, patch) -> Dict:
    if not isinstance(patch, dict):
        raise schema.ValidationError("settings.calendar must be an object")
    out = dict(old)
    if "special_days" in patch:
        out["special_days"] = schema.boolean(patch["special_days"], "settings.calendar.special_days")
    if "remember" in patch:
        out["remember"] = remember_list(patch["remember"])
    return out


def clean_admin_days(raw) -> List[Dict]:
    """The admin's dated days as served by manager-api (or the local config), tolerant of junk."""
    out = []
    for item in raw if isinstance(raw, list) else []:
        if not isinstance(item, dict):
            continue
        day = str(item.get("date") or item.get("day") or "")[:10]
        key = item.get("key") or item.get("dayKey") or "custom"
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", day) or key not in ADMIN_KEYS:
            continue
        default_bn, default_en = ADMIN_NAMES.get(key, ("", ""))
        name_bn = str(item.get("name_bn") or item.get("nameBn") or default_bn)[:60]
        name_en = str(item.get("name_en") or item.get("nameEn") or default_en)[:60]
        if not name_bn and not name_en:
            continue
        out.append({"date": day, "key": key, "name_bn": name_bn or name_en, "name_en": name_en or name_bn})
    return out


def _matches(month_day: str, today: date) -> bool:
    month, day = (int(x) for x in month_day.split("-"))
    if (month, day) == (2, 29) and not _is_leap(today.year):
        return (today.month, today.day) == (2, 28)
    return (today.month, today.day) == (month, day)


def _is_leap(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def today_special(today: date, calendar: Optional[Dict], admin_days: List[Dict]) -> Optional[Dict]:
    """What today is, or None. Order when two fall together: Eid (admin list), national day,
    the family's birthdays, then other remembered or custom days."""
    cal = dict(default_calendar(), **(calendar or {}))
    if not cal.get("special_days", True):
        return None
    iso = today.isoformat()
    admin = [d for d in admin_days if d["date"] == iso]
    for d in admin:
        if d["key"] != "custom":
            return {"key": d["key"], "name_bn": d["name_bn"], "name_en": d["name_en"]}
    national = NATIONAL.get((today.month, today.day))
    if national:
        return {"key": national[0], "name_bn": national[1], "name_en": national[2]}
    remember = [d for d in cal.get("remember") or [] if _matches(d["date"], today)]
    for d in remember:
        if d["kind"] == "birthday":
            return {"key": "birthday", "name_bn": f"{d['name']}-এর জন্মদিন", "name_en": f"{d['name']}'s birthday"}
    if admin:
        return {"key": "custom", "name_bn": admin[0]["name_bn"], "name_en": admin[0]["name_en"]}
    if remember:
        return {"key": "custom", "name_bn": remember[0]["name"], "name_en": remember[0]["name"]}
    return None


def greeting_hint(special: Optional[Dict]) -> str:
    if not special:
        return ""
    return (f"Today is {special['name_en']} ({special['name_bn']}). "
            + GREETING_HINT.get(special["key"], GREETING_HINT["custom"]))


class SpecialDays:
    """The admin's dated days (Eid, custom), refreshed from manager-api every few hours."""

    def __init__(self, config: Dict, cfg: Dict, data_dir: str):
        self.path = os.path.join(data_dir, "calendar_days.json")
        manager = config.get("manager-api") if isinstance(config, dict) else None
        manager = manager if isinstance(manager, dict) else {}
        url = str(manager.get("url") or "")
        self.api_url = url.rstrip("/") if url.startswith("http") else ""
        self.secret = cfg.get("manager_secret", "")
        self.local = clean_admin_days(cfg.get("calendar_days") or [])
        self.fetched: List[Dict] = clean_admin_days(self._load())
        self.fetched_at = 0.0
        self._task: Optional[asyncio.Task] = None

    def _load(self):
        try:
            with open(self.path, encoding="utf-8") as f:
                data = json.load(f)
            return data.get("days") if isinstance(data, dict) else []
        except (OSError, ValueError):
            return []

    def _save(self):
        tmp = self.path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"fetched": int(time.time()), "days": self.fetched}, f, ensure_ascii=False, indent=1)
        os.replace(tmp, self.path)

    @property
    def days(self) -> List[Dict]:
        return self.local + self.fetched

    async def refresh(self) -> bool:
        """Fetch the list from manager-api; keeps the cached list when it cannot be reached."""
        if not self.api_url:
            return False
        try:
            import httpx

            headers = {"Authorization": "Bearer " + self.secret} if self.secret else {}
            async with httpx.AsyncClient(timeout=10, trust_env=False) as client:
                resp = await client.get(self.api_url + "/config/calendar-days", headers=headers)
            resp.raise_for_status()
            body = resp.json()
            if body.get("code") not in (0, None):
                raise ValueError(body.get("msg") or "error")
            self.fetched = clean_admin_days(body.get("data") or [])
            self.fetched_at = time.time()
            self._save()
            return True
        except Exception as e:
            logger.bind(tag=TAG).info(f"Special days not refreshed from manager-api: {e}")
            return False

    def start(self):
        if self.api_url and (self._task is None or self._task.done()):
            self._task = asyncio.get_running_loop().create_task(self._run())

    async def _run(self):
        while True:
            await self.refresh()
            await asyncio.sleep(REFRESH_S)
