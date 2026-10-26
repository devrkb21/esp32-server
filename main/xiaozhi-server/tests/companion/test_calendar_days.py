"""Special days (core/companion/calendar_days.py) in the snapshot and the greeting."""

from datetime import date, datetime, timedelta, timezone

import pytest

from core.companion import calendar_days as cd
from core.companion import schema
from core.companion.proactive import build_prompt
from core.companion.schema import ValidationError

DEV = "aa:bb:cc:dd:ee:41"
TZ = timezone(timedelta(hours=6))
EID = [{"date": "2027-03-10", "key": "eid_ul_fitr", "name_bn": "ঈদুল ফিতর", "name_en": "Eid ul-Fitr"}]


@pytest.mark.parametrize("day,key", [
    (date(2027, 2, 21), "ekushey"), (date(2027, 3, 26), "independence_day"),
    (date(2027, 4, 14), "pohela_boishakh"), (date(2027, 12, 16), "victory_day"),
])
def test_national_days(day, key):
    special = cd.today_special(day, None, [])
    assert special["key"] == key and special["name_bn"] and special["name_en"]


def test_ordinary_day_and_switch_off():
    assert cd.today_special(date(2027, 5, 5), None, []) is None
    assert cd.today_special(date(2027, 12, 16), {"special_days": False}, []) is None


def test_eid_only_from_the_admin_list():
    assert cd.today_special(date(2027, 3, 10), None, []) is None  # never guessed
    assert cd.today_special(date(2027, 3, 10), None, EID) == {
        "key": "eid_ul_fitr", "name_bn": "ঈদুল ফিতর", "name_en": "Eid ul-Fitr"}


def test_birthdays_and_other_days_to_remember():
    cal = cd.calendar_settings(cd.default_calendar(), {"remember": [
        {"date": "05-05", "name": "মা", "kind": "birthday"},
        {"date": "06-01", "name": "বিয়েবার্ষিকী", "kind": "anniversary"},
        {"date": "02-29", "name": "লিপ", "kind": "birthday"},
    ]})
    assert [d["date"] for d in cal["remember"]] == ["02-29", "05-05", "06-01"]
    assert cd.today_special(date(2027, 5, 5), cal, [])["name_bn"] == "মা-এর জন্মদিন"
    assert cd.today_special(date(2027, 6, 1), cal, []) == {"key": "custom", "name_bn": "বিয়েবার্ষিকী",
                                                           "name_en": "বিয়েবার্ষিকী"}
    assert cd.today_special(date(2027, 2, 28), cal, [])["key"] == "birthday"  # 29 Feb in a common year
    # a national day wins over a birthday on the same date, Eid wins over both
    cal2 = cd.calendar_settings(cd.default_calendar(), {"remember": [{"date": "12-16", "name": "বাবা"}]})
    assert cd.today_special(date(2027, 12, 16), cal2, [])["key"] == "victory_day"
    eid = [dict(EID[0], date="2027-12-16")]
    assert cd.today_special(date(2027, 12, 16), cal2, eid)["key"] == "eid_ul_fitr"


@pytest.mark.parametrize("patch", [
    {"special_days": "yes"},
    {"remember": [{"date": "13-01", "name": "x"}]},
    {"remember": [{"date": "02-30", "name": "x"}]},
    {"remember": [{"date": "01-01", "name": ""}]},
    {"remember": [{"date": "01-01", "name": "x", "kind": "party"}]},
    {"remember": [{"date": "01-01", "name": "x"}] * 31},
])
def test_calendar_validation(patch):
    with pytest.raises(ValidationError):
        schema.settings({}, {"calendar": patch})


def test_admin_list_cleaning():
    raw = [
        {"day": "2027-03-10", "dayKey": "eid_ul_fitr", "nameBn": "", "nameEn": ""},  # manager-api names
        {"date": "2027-05-17", "key": "eid_ul_adha"},
        {"date": "2027-01-01", "key": "custom", "name_en": "School picnic"},
        {"date": "2027-01-02", "key": "custom"},  # no name
        {"date": "bad", "key": "eid_ul_fitr"},
        {"date": "2027-01-03", "key": "victory_day"},  # fixed days are not taken from the list
        "junk",
    ]
    out = cd.clean_admin_days(raw)
    assert [d["key"] for d in out] == ["eid_ul_fitr", "eid_ul_adha", "custom"]
    assert out[0]["name_bn"] == "ঈদুল ফিতর" and out[2]["name_bn"] == "School picnic"


async def test_snapshot_detail_and_greeting(make_service):
    svc = make_service(calendar_days=EID)
    svc.local_now = lambda: datetime(2027, 3, 10, 7, 40, tzinfo=TZ)
    snap = await svc.sync(DEV)
    assert snap["today_special"]["key"] == "eid_ul_fitr"
    view = svc.device_detail(svc.store.get(DEV))
    assert view["today_special"]["key"] == "eid_ul_fitr"
    assert view["settings"]["calendar"] == {"special_days": True, "remember": []}
    prompt = build_prompt(svc, {}, DEV, "morning")
    assert "Eid ul-Fitr" in prompt and "ঈদ মোবারক" in prompt
    assert "<special_day>" in svc.ai_context(DEV)

    await svc.update_config(DEV, {"settings": {"calendar": {"special_days": False}}})
    assert (await svc.sync(DEV))["today_special"] is None
    assert "Eid" not in build_prompt(svc, {}, DEV, "morning")


async def test_refresh_without_manager_api_keeps_the_list(make_service):
    svc = make_service()
    assert await svc.special_days.refresh() is False
    assert svc.special_days.days == []
