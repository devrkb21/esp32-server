from datetime import datetime

import pytest

from core.companion import schema
from core.companion.proactive import (
    PROACTIVE_TAG, build_prompt, due_kind, is_proactive_request, request_kind,
)
from core.companion.schema import ValidationError

MON_0740 = datetime(2026, 10, 26, 7, 40)  # a Monday
NIGHT = {"enabled": True, "start": "21:30", "end": "06:30"}


def test_request_tag():
    assert is_proactive_request(PROACTIVE_TAG + "evening")
    assert request_kind(PROACTIVE_TAG + "evening") == "evening"
    assert request_kind(PROACTIVE_TAG + "bogus") == "morning"
    assert not is_proactive_request("[device_call]hi")


def test_morning_is_due_once_inside_its_window():
    s = {"night": NIGHT}
    assert due_kind(s, MON_0740, {}) == "morning"
    assert due_kind(s, MON_0740, {"morning": "2026-10-26"}) is None
    assert due_kind(s, MON_0740, {"morning": "2026-10-25"}) == "morning"
    assert due_kind(s, datetime(2026, 10, 26, 7, 29), {}) is None
    assert due_kind(s, datetime(2026, 10, 26, 9, 30), {}) is None  # window over


def test_evening_and_switches():
    s = {"night": NIGHT, "proactive": {"evening": "20:00"}}
    assert due_kind(s, datetime(2026, 10, 26, 20, 5), {}) == "evening"
    s["proactive"]["evening_on"] = False
    assert due_kind(s, datetime(2026, 10, 26, 20, 5), {}) is None
    assert due_kind({"proactive": {"enabled": False}}, MON_0740, {}) is None


def test_no_greeting_in_night_hours():
    s = {"night": NIGHT, "proactive": {"morning": "06:00"}}
    assert due_kind(s, datetime(2026, 10, 26, 6, 10), {}) is None
    s["night"] = dict(NIGHT, enabled=False)
    assert due_kind(s, datetime(2026, 10, 26, 6, 10), {}) == "morning"


def test_settings_validation():
    out = schema.settings({}, {"proactive": {"morning": "06:45", "evening_on": False}})
    assert out["proactive"]["morning"] == "06:45"
    assert out["proactive"]["evening_on"] is False
    assert out["proactive"]["evening"] == "19:30"
    with pytest.raises(ValidationError):
        schema.settings({}, {"proactive": {"morning": "25:00"}})


class _Store:
    def __init__(self, dev):
        self.dev = dev

    def get(self, _id):
        return self.dev


class _Svc:
    def __init__(self, dev):
        self.store = _Store(dev)

    def local_now(self):
        return MON_0740

    def weather_for(self, dev):
        return {"ok": True, "kind": "sunny", "temp": 28, "rain_prob": 10}


def test_morning_prompt_has_the_day():
    dev = {
        "settings": {"owner_name": "Rafi"},
        "alarms": [{"time": "09:00", "days": 127, "label": "School", "enabled": True},
                   {"time": "07:00", "days": 127, "label": "Past", "enabled": True}],
        "reminders": [{"time": "13:00", "mode": "time", "days": 0, "label": "Not today"}],
    }
    p = build_prompt(_Svc(dev), {}, "aa", "morning")
    assert "Rafi" in p and "09:00 School" in p and "২৮" in p
    assert "Past" not in p and "Not today" not in p
    assert "how their day went" in build_prompt(_Svc(dev), {}, "aa", "evening")
