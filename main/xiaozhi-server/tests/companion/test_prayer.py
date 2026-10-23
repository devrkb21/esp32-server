from datetime import date

import pytest

from core.companion.prayer import PrayTimes

DHAKA = (23.8103, 90.4125)


def _minutes(hhmm):
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


# Published Dhaka times for late October (Karachi angles, Hanafi Asr), +-4 min tolerance
@pytest.mark.parametrize(
    "key,expected",
    [
        ("fajr", "04:45"),
        ("sunrise", "06:01"),
        ("dhuhr", "11:44"),
        ("asr", "15:50"),
        ("maghrib", "17:25"),
        ("isha", "18:40"),
    ],
)
def test_dhaka_late_october(key, expected):
    times = PrayTimes("Karachi", "Hanafi").compute(date(2026, 10, 24), *DHAKA, 6)
    assert abs(_minutes(times[key]) - _minutes(expected)) <= 4, times


def test_order_and_format():
    times = PrayTimes().compute(date(2026, 6, 21), *DHAKA, 6)
    values = [_minutes(times[k]) for k in ("fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha")]
    assert values == sorted(values)
    assert times["date"] == "2026-06-21"


def test_hanafi_asr_later_than_standard():
    hanafi = PrayTimes(asr="Hanafi").compute(date(2026, 10, 24), *DHAKA, 6)
    standard = PrayTimes(asr="Standard").compute(date(2026, 10, 24), *DHAKA, 6)
    assert _minutes(hanafi["asr"]) - _minutes(standard["asr"]) > 30


def test_offsets_applied():
    base = PrayTimes().compute(date(2026, 10, 24), *DHAKA, 6)
    shifted = PrayTimes(offsets={"dhuhr": 3}).compute(date(2026, 10, 24), *DHAKA, 6)
    assert _minutes(shifted["dhuhr"]) - _minutes(base["dhuhr"]) == 3
    assert shifted["fajr"] == base["fajr"]
