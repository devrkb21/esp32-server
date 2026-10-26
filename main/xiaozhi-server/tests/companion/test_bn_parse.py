from datetime import datetime

import pytest

from core.companion.bn_parse import (
    bn_clock, bn_duration, is_relative, parse_clock, parse_duration, parse_number,
)

MON_10 = datetime(2026, 10, 26, 10, 0)  # 10:00 in the morning
MON_22 = datetime(2026, 10, 26, 22, 0)


@pytest.mark.parametrize("text,expected", [
    ("৭", 7), ("১২", 12), ("সাত", 7), ("পনেরো", 15), ("পঁচিশ", 25), ("ন", 9), ("দুই", 2),
    ("আধা", 0.5), ("দেড়", 1.5), ("আড়াই", 2.5), ("সাড়ে তিন", 3.5), ("পৌনে দুই", 1.75), ("সোয়া এক", 1.25),
    ("forty five", 45), ("কিছু না", None),
])
def test_numbers(text, expected):
    assert parse_number(text) == expected


@pytest.mark.parametrize("text,expected", [
    ("সকাল সাড়ে সাতটায়", "07:30"),
    ("সাড়ে সাতটা", "19:30"),          # no part of day: the next 7:30 after 10:00
    ("পৌনে ন'টা", "20:45"),
    ("সকাল পৌনে নটায়", "08:45"),
    ("সোয়া দশটা", "10:15"),
    ("রাত ১০টা", "22:00"),
    ("সকাল ৭টায়", "07:00"),
    ("বিকেল ৫টা", "17:00"),
    ("দুপুর ২টায়", "14:00"),
    ("সন্ধ্যা সাতটায়", "19:00"),
    ("ভোর ৫টা", "05:00"),
    ("রাত ১২টা", "00:00"),
    ("দুপুর ১২টা", "12:00"),
    ("দেড়টা", "13:30"),
    ("আড়াইটা", "14:30"),
    ("পৌনে একটা", "12:45"),
    ("সাতটা বিশ মিনিটে", "19:20"),
    ("সকাল ৭টা ৩০ মিনিটে", "07:30"),
    ("০৭:৩০", "07:30"),
    ("19:05", "19:05"),
    ("7 pm", "19:00"),
    ("7:15 am", "07:15"),
    ("১০ মিনিট পরে", None),
    ("সাড়ে তিন ঘণ্টা", None),
    ("", None),
])
def test_clock(text, expected):
    assert parse_clock(text, MON_10) == expected


def test_clock_without_part_of_day_picks_the_next_occurrence():
    assert parse_clock("৭টায়", MON_10) == "19:00"
    assert parse_clock("৭টায়", MON_22) == "07:00"
    assert parse_clock("৭টায়") == "07:00"  # no clock to compare with: as said


@pytest.mark.parametrize("text,expected", [
    ("১০ মিনিট", 10), ("১০ মিনিট পরে", 10), ("পাঁচ মিনিট পর", 5), ("পনেরো মিনিটের মধ্যে", 15),
    ("আধা ঘণ্টা", 30), ("আধ ঘন্টা পরে", 30), ("দেড় ঘণ্টা", 90), ("আড়াই ঘণ্টা", 150),
    ("এক ঘণ্টা", 60), ("২ ঘণ্টা ১৫ মিনিট", 135), ("সাড়ে তিন ঘণ্টা", 210), ("পৌনে এক ঘণ্টা", 45),
    ("30 sec", 1), ("10", 10), ("half an hour", 30), ("an hour", 60), ("1h30m", 90), (25, 25),
    ("কখন জানি না", None), ("", None), (0, None),
])
def test_duration(text, expected):
    assert parse_duration(text) == expected


def test_relative_or_clock():
    assert is_relative("১০ মিনিট পরে")
    assert is_relative("আধা ঘণ্টা")
    assert is_relative("সাড়ে তিন ঘণ্টা")
    assert not is_relative("সকাল ৭টায়")
    assert not is_relative("৭টা ৩০ মিনিটে")
    assert not is_relative("উপরে রাখো")


def test_bangla_wording():
    assert bn_clock("07:30") == "সকাল ৭টা ৩০ মিনিট"
    assert bn_clock("21:00") == "রাত ৯টা"
    assert bn_clock("13:05") == "দুপুর ১টা ৫ মিনিট"
    assert bn_duration(90) == "১ ঘণ্টা ৩০ মিনিট"
    assert bn_duration(30) == "৩০ মিনিট"
    assert bn_duration(120) == "২ ঘণ্টা"
