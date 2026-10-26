"""Robot-to-robot voice messages (HOME): the voice tool finds the contact by name, and the other
robot's companion holds a robot message through its night mode."""

import time
from datetime import datetime, timedelta, timezone

import pytest

from core.companion import home_api, home_tools
from tests.companion.test_home import FakeManagerApi

TARGETS = [
    {"key": "c:1", "name": "বাবার রোবট", "aliases": ["বাবা", "Abbu"], "kind": "contact"},
    {"key": "c:night", "name": "নানুর রোবট", "aliases": ["নানু"], "kind": "contact"},
    {"key": "d:kitchen", "name": "Kitchen", "aliases": [], "kind": "own"},
]


@pytest.fixture
def api():
    fake = FakeManagerApi(targets=TARGETS)
    home_api.set_api(fake)
    yield fake
    home_api.set_api(None)


async def test_tell_fathers_robot_i_am_coming(api):
    r = await home_tools.send_robot_message("AA:BB", to="বাবার রোবটকে", text="আমি আসছি")
    assert r["ok"] is True
    assert api.sent == [("c:1", "আমি আসছি")]
    assert r["say"] == "বাবার রোবট-কে বার্তাটা পাঠিয়ে দিলাম।"


async def test_a_sleeping_robot_gets_it_in_the_morning(api):
    r = await home_tools.send_robot_message("aa:bb", to="নানুকে", text="ভালো আছো?")
    assert r["ok"] and r["later"] is True
    assert "সকালে" in r["say"]


async def test_unknown_contact_and_empty_text(api):
    r = await home_tools.send_robot_message("aa:bb", to="মামার রোবট", text="হ্যালো")
    assert r["code"] == "not_found" and "ঠিকানা খাতায় নেই" in r["say"]
    r = await home_tools.send_robot_message("aa:bb", to="বাবা", text="  ")
    assert r["code"] == "empty"
    assert api.sent == []


async def test_no_contacts_yet():
    home_api.set_api(FakeManagerApi(targets=[]))
    try:
        r = await home_tools.send_robot_message("aa:bb", to="বাবা", text="হ্যালো")
        assert r["code"] == "no_targets"
    finally:
        home_api.set_api(None)


# ----------------------------------------------------------------------------- quiet hours
def _at(svc, hh, mm):
    tz = timezone(timedelta(hours=svc.cfg["timezone_offset"]))
    return datetime(2026, 10, 26, hh, mm, tzinfo=tz)


async def test_night_end(make_service):
    svc = make_service()
    dev = await svc.store.touch("aa:bb:cc:dd:ee:ff")
    # default night 21:30-06:30
    assert svc.night_end(dev, _at(svc, 14, 0)) is None
    late = svc.night_end(dev, _at(svc, 23, 0))
    assert late == int(_at(svc, 6, 30).timestamp()) + 86400
    early = svc.night_end(dev, _at(svc, 5, 0))
    assert early == int(_at(svc, 6, 30).timestamp())
    dev["settings"]["night"]["enabled"] = False
    assert svc.night_end(dev, _at(svc, 23, 0)) is None


async def test_robot_message_is_held_through_the_night(make_service):
    svc = make_service()
    dev_id = "aa:bb:cc:dd:ee:ff"
    await svc.store.touch(dev_id)
    svc.night_end = lambda dev, now=None: int(time.time()) + 3600  # it is night there now
    held = await svc.send_message(dev_id, {"from": "খোকার রোবট", "text": "আমি আসছি", "quiet": "later", "via": "robot"})
    assert held["not_before"] > time.time() and held["via"] == "robot"
    normal = await svc.send_message(dev_id, {"from": "Ammu", "text": "খেয়েছো?"})
    assert "not_before" not in normal

    stored = {m["id"]: m for m in svc.store.get(dev_id)["messages"]}
    assert svc._message_ready(stored[held["id"]]) is False
    # once the night is over it goes out like any other message
    stored[held["id"]]["not_before"] = int(time.time()) - 1
    stored[held["id"]]["ts"] = 0  # audio wait over
    assert svc._message_ready(stored[held["id"]]) is True
