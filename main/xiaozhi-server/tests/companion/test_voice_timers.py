"""Voice timers and reminders in Bangla (core/companion/voice_tools.py)."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from core.companion import set_service, voice_tools

DEV = "aa:bb:cc:dd:ee:21"
TZ = timezone(timedelta(hours=6))
MON_0930 = datetime(2026, 10, 26, 9, 30, 10, tzinfo=TZ)  # a Monday


@pytest.fixture
def svc(make_service):
    service = make_service()
    service.local_now = lambda: MON_0930
    set_service(service)
    yield service
    set_service(None)


def _conn():
    return SimpleNamespace(config={}, device_id=DEV, headers={"device-id": DEV})


async def test_timer_in_ten_minutes_is_a_one_time_reminder(svc):
    await svc.sync(DEV)
    text = await voice_tools.set_timer(_conn(), "১০ মিনিট", what="ওষুধ খাও")
    r = svc.store.get(DEV)["reminders"][-1]
    assert r["kind"] == "medicine" and r["mode"] == "time"
    assert r["time"] == "09:41"  # rounded up, never early
    assert r["once"] == "2026-10-26" and r["days"] == 0b0000010  # Monday only
    assert r["label"] == "Medicine" and "ওষুধ খাও" in r["say"]
    assert "১০ মিনিট পরে" in text and "সকাল ৯টা ৪১ মিনিট" in text
    # the robot sees it in its snapshot like any reminder
    snap = await svc.sync(DEV)
    assert any(x["id"] == r["id"] for x in snap["reminders"])


async def test_half_an_hour_and_bad_duration(svc):
    await svc.sync(DEV)
    assert "৩০ মিনিট" in await voice_tools.set_timer(_conn(), "আধা ঘণ্টা")
    assert svc.store.get(DEV)["reminders"][-1]["time"] == "10:01"
    assert "Could not understand" in await voice_tools.set_timer(_conn(), "কখন জানি না")
    assert "at most 24 hours" in await voice_tools.set_timer(_conn(), "৩০ ঘণ্টা")


async def test_timer_past_midnight_lands_on_tomorrow(svc):
    svc.local_now = lambda: datetime(2026, 10, 26, 23, 50, tzinfo=TZ)
    await svc.sync(DEV)
    await voice_tools.set_timer(_conn(), "দেড় ঘণ্টা")
    r = svc.store.get(DEV)["reminders"][-1]
    assert r["time"] == "01:20" and r["once"] == "2026-10-27" and r["days"] == 0b0000100  # Tuesday


async def test_reminder_with_bangla_time_and_relative_time(svc):
    await svc.sync(DEV)
    text = await voice_tools.add_reminder(_conn(), "medicine", "রাত সাড়ে নটা")
    assert svc.store.get(DEV)["reminders"][-1]["time"] == "21:30"
    assert "প্রতিদিন রাত ৯টা ৩০ মিনিট" in text
    # "১০ মিনিট পরে" passed as a time becomes a timer
    await voice_tools.add_reminder(_conn(), "custom", "১০ মিনিট পরে", say="রুটি উল্টাও")
    assert svc.store.get(DEV)["reminders"][-1]["once"] == "2026-10-26"
    # once, tomorrow
    await voice_tools.add_reminder(_conn(), "custom", "আগামীকাল সকাল ৮টা", label="Call")
    r = svc.store.get(DEV)["reminders"][-1]
    assert (r["time"], r["once"]) == ("08:00", "2026-10-27")


async def test_alarm_in_bangla_daily_and_once(svc):
    await svc.sync(DEV)
    text = await voice_tools.set_alarm(_conn(), "সকাল ৭টায়")
    a = svc.store.get(DEV)["alarms"][-1]
    assert (a["time"], a["days"]) == ("07:00", 127) and "once" not in a
    assert "প্রতিদিন সকাল ৭টা অ্যালার্ম দিলাম" in text
    text = await voice_tools.set_alarm(_conn(), "পৌনে ন'টা", days="once")
    a = svc.store.get(DEV)["alarms"][-1]
    assert a["time"] == "20:45" and a["once"] == "2026-10-26"
    assert "আজ রাত ৮টা ৪৫ মিনিট" in text


async def test_list_in_bangla_and_cancel(svc):
    await svc.sync(DEV)
    await voice_tools.set_alarm(_conn(), "07:00")
    await voice_tools.set_timer(_conn(), "১০ মিনিট", what="ওষুধ")
    listing = await voice_tools.list_alarms(_conn())
    assert "07:00" in listing and "once on 2026-10-26" in listing
    assert "অ্যালার্ম ১টি: সকাল ৭টা" in listing
    assert "No matching" in await voice_tools.cancel_reminder(_conn(), what="পানি")
    assert "Ask the user" in await voice_tools.cancel_reminder(_conn())
    text = await voice_tools.cancel_reminder(_conn(), what="ওষুধ")
    assert "১টি রিমাইন্ডার বাদ দিলাম" in text
    assert not any(r.get("once") for r in svc.store.get(DEV)["reminders"])
    assert "Deleted 1" in await voice_tools.delete_alarm(_conn(), "সকাল ৭টা")


async def test_one_time_items_expire_after_they_rang(svc):
    await svc.sync(DEV)
    await voice_tools.set_timer(_conn(), "১০ মিনিট")
    await voice_tools.set_alarm(_conn(), "07:00")
    assert await svc.expire_once(DEV, MON_0930 + timedelta(minutes=11)) == 0  # rings at 09:41
    assert await svc.expire_once(DEV, MON_0930 + timedelta(minutes=13)) == 1
    dev = svc.store.get(DEV)
    assert not any(r.get("once") for r in dev["reminders"])
    assert len(dev["alarms"]) == 1  # repeating alarms stay


async def test_app_can_clear_once(svc):
    await svc.sync(DEV)
    await voice_tools.set_timer(_conn(), "১০ মিনিট")
    r = dict(svc.store.get(DEV)["reminders"][-1], once="", days=127)
    dev = await svc.update_config(DEV, {"reminders": svc.store.get(DEV)["reminders"][:-1] + [r]})
    assert "once" not in dev["reminders"][-1]
