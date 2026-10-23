from types import SimpleNamespace

import pytest

from core.companion import set_service, voice_tools
from core.companion.story import STORY_TAG, build_story_prompt, is_story_request

DEV = "aa:bb:cc:dd:ee:02"


@pytest.fixture
def svc(make_service):
    service = make_service()
    set_service(service)
    yield service
    set_service(None)


def _conn(device_id=DEV):
    return SimpleNamespace(config={}, device_id=device_id, headers={"device-id": device_id})


@pytest.mark.parametrize(
    "raw,expected",
    [("06:30", "06:30"), ("6:30", "06:30"), ("7pm", "19:00"), ("7:15 PM", "19:15"), ("12am", "00:00"),
     ("21.00", "21:00"), ("25:00", None), ("soon", None)],
)
def test_parse_time(raw, expected):
    assert voice_tools.parse_time(raw) == expected


def test_parse_days():
    assert voice_tools.parse_days("") == 127
    assert voice_tools.parse_days("weekdays") == 31
    assert voice_tools.parse_days("monday, wednesday") == 0b0001010
    assert voice_tools.parse_days("Fri,Sat") == 96


async def test_unknown_device_is_harmless(svc):
    text = await voice_tools.set_alarm(_conn("11:22:33:44:55:66"), "07:00")
    assert "not registered" in text
    assert svc.store.get("11:22:33:44:55:66") is None


async def test_disabled_service_is_harmless():
    set_service(None)
    conn = SimpleNamespace(config={"companion": {"enabled": False}}, device_id=DEV, headers={})
    assert "not enabled" in await voice_tools.list_alarms(conn)


async def test_alarm_reminder_focus_prayer(svc):
    await svc.sync(DEV)
    conn = _conn()
    assert "07:30" in await voice_tools.set_alarm(conn, "7:30 am", "weekdays", "School")
    assert svc.store.get(DEV)["alarms"][0]["days"] == 31
    listing = await voice_tools.list_alarms(conn)
    assert "07:30" in listing and "School" in listing

    assert "every 45 minutes" in await voice_tools.add_reminder(conn, "water", every_min=45)
    assert "21:00" in await voice_tools.add_reminder(conn, "medicine", "9pm", label="Napa")

    assert "25 minute" in await voice_tools.start_focus(conn)
    snap = await svc.sync(DEV)
    assert snap["commands"][-1]["type"] == "pomodoro"

    text = await voice_tools.prayer_times(conn)
    assert "আসর" in text and "Dhaka" in text

    assert "Deleted 1" in await voice_tools.delete_alarm(conn, "07:30")
    assert svc.store.get(DEV)["alarms"] == []


def test_story_prompt_uses_topic_and_language():
    config = {"selected_module": {"TTS": "EdgeTTS"}, "TTS": {"EdgeTTS": {"type": "edge", "language": "Bangla"}},
              "companion": {"story_topics": ["চাঁদের বুড়ি"]}}
    assert is_story_request(STORY_TAG + "x") and not is_story_request("[device_call]x")
    prompt = build_story_prompt(config, STORY_TAG)
    assert "চাঁদের বুড়ি" in prompt and "Bangla" in prompt and "6 to 8" in prompt
    prompt = build_story_prompt(config, STORY_TAG + "  সাহসী বিড়াল ")
    assert "সাহসী বিড়াল" in prompt and "চাঁদের বুড়ি" not in prompt
