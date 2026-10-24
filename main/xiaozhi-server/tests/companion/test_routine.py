from datetime import datetime, timedelta, timezone

import pytest

from core.companion import schema
from tests.companion.test_handler import DEV, HDRS, _client


def test_default_routine_is_valid_and_sorted():
    routine = schema.default_routine()
    assert routine["enabled"] is True
    items = schema.routine_items(routine["items"], "items")
    assert items == routine["items"]
    assert {r["activity"] for r in items} == set(schema.ACTIVITIES)


def test_routine_replaces_items_and_sorts():
    out = schema.settings({}, {"routine": {"items": [
        {"start": "20:00", "end": "21:00", "activity": "book"},
        {"start": "08:00", "end": "08:30", "activity": "exercise"},
    ]}})
    assert out["routine"]["enabled"] is True
    assert [r["activity"] for r in out["routine"]["items"]] == ["exercise", "book"]
    off = schema.settings(out, {"routine": {"enabled": False}})["routine"]
    assert off["enabled"] is False and len(off["items"]) == 2


@pytest.mark.parametrize("bad", [
    {"items": "work"},
    {"items": [{"start": "08:00", "end": "08:00", "activity": "work"}]},
    {"items": [{"start": "8", "end": "09:00", "activity": "work"}]},
    {"items": [{"start": "08:00", "end": "09:00", "activity": "skydiving"}]},
    {"items": [{"start": "08:00", "end": "09:00", "activity": "work"}] * 25},
    {"enabled": "yes"},
])
def test_routine_rejects_bad_values(bad):
    with pytest.raises(schema.ValidationError):
        schema.settings({}, {"routine": bad})


async def test_routine_in_snapshot(make_service):
    svc = make_service()
    client = await _client(svc)
    try:
        snap = await (await client.get("/companion/v1/device/sync", headers=HDRS)).json()
        assert snap["settings"]["routine"] == schema.default_routine()
    finally:
        await client.close()


async def test_ai_context_tells_what_tinybot_is_doing(make_service):
    svc = make_service()
    await svc.sync(DEV)
    tz = timezone(timedelta(hours=svc.cfg["timezone_offset"]))
    svc.local_now = lambda: datetime(2026, 10, 24, 14, 20, tzinfo=tz)
    text = svc.ai_context(DEV.upper())
    assert text.startswith("<tinybot_day>") and text.endswith("</tinybot_day>")
    assert "working on your laptop" in text and "(until 15:30)" in text
    assert "Earlier today you: 08:00 doing morning exercise" in text
    assert "taking an afternoon nap" in text            # 13:30-14:00 is done
    assert "Later today: 15:30 having afternoon tea" in text

    svc.local_now = lambda: datetime(2026, 10, 24, 12, 30, tzinfo=tz)
    assert "you have free time" in svc.ai_context(DEV)

    await svc.update_config(DEV, {"settings": {"routine": {"enabled": False}}})
    assert svc.ai_context(DEV) == ""
    assert svc.ai_context("aa:bb:cc:dd:ee:99") == ""
