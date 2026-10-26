"""Routines / scenes (core/companion/routines.py), the library and the voice tools that use them."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from core.companion import hooks, routines, schema, set_service, voice_tools
from core.companion.schema import ValidationError

DEV = "aa:bb:cc:dd:ee:31"
TZ = timezone(timedelta(hours=6))
MON_0700 = datetime(2026, 10, 26, 7, 0, 20, tzinfo=TZ)  # a Monday

BEDTIME = {
    "id": "bed", "name": "ঘুমের রুটিন", "enabled": True,
    "trigger": {"type": "voice", "phrase": "ঘুমাতে যাব"},
    "steps": [
        {"type": "say", "arg": "শুভ রাত্রি {name}!"},
        {"type": "alarm_list"},
        {"type": "play", "arg": "d-rhyme-night"},
        {"type": "command", "arg": "night_light:on"},
        {"type": "smart_home", "arg": "বসার ঘরের লাইট বন্ধ করো"},
    ],
}


@pytest.fixture
def svc(make_service):
    service = make_service()
    service.local_now = lambda: MON_0700
    set_service(service)
    yield service
    set_service(None)


def _conn():
    return SimpleNamespace(config={}, device_id=DEV, headers={"device-id": DEV})


# --- validation ------------------------------------------------------------------------------
def test_routine_validation():
    r = routines.routine(BEDTIME)
    assert r["trigger"] == {"type": "voice", "phrase": "ঘুমাতে যাব", "days": 127}
    assert r["steps"][1] == {"type": "alarm_list", "arg": ""}
    assert r["steps"][3]["arg"] == "night_light:on"
    t = routines.routine({"name": "x", "trigger": {"type": "time", "time": "6:30", "days": 31},
                          "steps": [{"type": "weather", "arg": "ignored"}]})
    assert t["trigger"]["time"] == "06:30" and t["steps"][0]["arg"] == "" and t["id"].startswith("rt")
    bad = [
        {"name": "", "steps": [{"type": "weather"}]},
        {"name": "x", "steps": []},
        {"name": "x", "steps": [{"type": "dance"}]},
        {"name": "x", "steps": [{"type": "say", "arg": ""}]},
        {"name": "x", "steps": [{"type": "command", "arg": "update"}]},
        {"name": "x", "steps": [{"type": "command", "arg": "routine:bed"}]},
        {"name": "x", "steps": [{"type": "command", "arg": "game:chess"}]},
        {"name": "x", "steps": [{"type": "play", "arg": "not an id!"}]},
        {"name": "x", "trigger": {"type": "time"}, "steps": [{"type": "weather"}]},
        {"name": "x", "trigger": {"type": "wink"}, "steps": [{"type": "weather"}]},
        {"name": "x", "steps": [{"type": "weather"}] * 13},
    ]
    for raw in bad:
        with pytest.raises(ValidationError):
            routines.routine(raw)


def test_settings_section_and_the_seeded_example(svc):
    out = schema.settings({}, {"routines": [BEDTIME, dict(BEDTIME, name="দুই")]})
    assert [r["name"] for r in out["routines"]] == ["ঘুমের রুটিন", "দুই"]
    assert out["routines"][0]["id"] != out["routines"][1]["id"]  # ids kept unique
    with pytest.raises(ValidationError):
        schema.settings({}, {"routines": [BEDTIME] * 11})
    example = routines.default_routines()[0]
    assert example["name"] == "সকালের রুটিন" and example["enabled"] is False
    routines.routine(example)  # the seed itself is valid


def test_find_routine_by_spoken_name():
    items = [routines.routine(BEDTIME), routines.default_routines()[0]]
    assert routines.find_routine(items, "সকালের রুটিন চালাও")["id"] == "morning"
    assert routines.find_routine(items, "ঘুমাতে যাব")["id"] == "bed"
    assert routines.find_routine(items, "ঘুমের")["id"] == "bed"
    assert routines.find_routine(items, "অফিসের") is None


# --- running ---------------------------------------------------------------------------------
async def test_run_on_robot_queues_speech_play_and_commands(svc):
    await svc.sync(DEV)
    await svc.update_config(DEV, {"settings": {"owner_name": "রনি", "routines": [BEDTIME]}})
    calls = []

    async def fake_home(user, action):
        calls.append((user["device_id"], action))
        return "লাইট বন্ধ করেছি।"

    old = hooks.smart_home
    hooks.smart_home = fake_home
    try:
        result = await svc.routines.run(DEV, "bed")
    finally:
        hooks.smart_home = old
    assert calls == [(DEV, "বসার ঘরের লাইট বন্ধ করো")]
    cmds = [c for c in svc.store.get(DEV)["commands"] if c["status"] == "pending"]
    # spoken intro, the rhyme (rendered text), the night light, then the smart-home reply
    assert [c["type"] for c in cmds] == ["play", "play", "night_light", "play"]
    assert all(c["arg"].startswith("/companion/v1/audio/") for c in cmds if c["type"] == "play")
    assert cmds[2]["arg"] == "on"
    assert result["queued"] == ["play", "play", "night_light", "play"] and result["say"] == ""


async def test_run_from_voice_returns_the_words(svc):
    await svc.sync(DEV)
    await svc.update_config(DEV, {"settings": {"owner_name": "রনি", "routines": [BEDTIME]}})
    text = await voice_tools.run_routine(_conn(), "ঘুমের রুটিন চালাও")
    assert "শুভ রাত্রি রনি!" in text and "কোনো অ্যালার্ম" in text
    assert "স্মার্ট হোম এখনো যুক্ত করা হয়নি" in text  # the no-op hook
    assert "night_light" in text
    types = [c["type"] for c in svc.store.get(DEV)["commands"] if c["status"] == "pending"]
    assert types == ["play", "night_light"]  # only the rhyme and the command go to the robot


async def test_voice_run_of_a_switched_off_or_unknown_routine(svc):
    await svc.sync(DEV)
    assert "বন্ধ করা আছে" in await voice_tools.run_routine(_conn(), "সকালের রুটিন")
    assert "No routine matches" in await voice_tools.run_routine(_conn(), "অফিসের রুটিন")


async def test_morning_example_speaks_weather_prayer_and_day(svc):
    await svc.sync(DEV)
    morning = dict(routines.default_routines()[0], enabled=True)
    result = await svc.routines.run(DEV, morning, speak_on_robot=False)
    assert "শুভ সকাল" in result["say"]
    assert "আবহাওয়া" in result["say"] and "ফজর" in result["say"] and "আজ ২৬ অক্টোবর" in result["say"]


async def test_app_run_now_is_a_routine_command(svc):
    await svc.sync(DEV)
    await svc.update_config(DEV, {"settings": {"routines": [BEDTIME]}})
    out = await svc.send_command(DEV, {"type": "routine", "arg": "bed"})
    assert out["status"] == "running"
    with pytest.raises(ValidationError):
        await svc.send_command(DEV, {"type": "routine", "arg": "nope"})
    await svc.routines._running[(DEV, "bed")]
    assert any(c["type"] == "night_light" for c in svc.store.get(DEV)["commands"])
    assert not any(c["type"] == "routine" for c in svc.store.get(DEV)["commands"])


async def test_time_trigger_runs_once_a_day_when_online(svc):
    await svc.sync(DEV)
    seed = dict(routines.default_routines()[0], enabled=True)
    await svc.update_config(DEV, {"settings": {"routines": [seed]}})
    dev = svc.store.get(DEV)
    assert [r["id"] for r in svc.routines.due(dev, MON_0700)] == ["morning"]
    assert svc.routines.due(dev, MON_0700 + timedelta(minutes=5)) == []  # window over
    await svc.routines.tick()
    await svc.routines._running[(DEV, "morning")]
    assert svc.routines.due(svc.store.get(DEV), MON_0700) == []  # ran today
    assert any(c["type"] == "play" for c in svc.store.get(DEV)["commands"])


async def test_switched_off_seed_never_runs(svc):
    await svc.sync(DEV)
    assert svc.routines.due(svc.store.get(DEV), MON_0700) == []
    view = svc.device_detail(svc.store.get(DEV))
    assert view["settings"]["routines"][0]["name"] == "সকালের রুটিন"


# --- library ---------------------------------------------------------------------------------
async def test_library_defaults_add_play_delete(svc):
    await svc.sync(DEV)
    view = svc.device_detail(svc.store.get(DEV))
    defaults = [i for i in view["library"] if i["source"] == "default"]
    assert 3 <= len(defaults) <= 5
    assert all(i["kind"] in ("story", "rhyme") and len(i["text"]) <= 500 for i in defaults)
    assert not any(i["kind"] == "recitation" for i in defaults)

    view = await svc.update_config(DEV, {"library": {"add": {
        "kind": "music", "title": "আমার গান", "audio_url": "https://example.com/song.mp3"}}})
    lib = svc.library.items(DEV)
    assert lib[0]["title"] == "আমার গান" and lib[0]["source"] == "owner"
    out = await svc.send_command(DEV, {"type": "play", "arg": lib[0]["id"]})
    assert out["arg"] == "https://example.com/song.mp3"
    out = await svc.send_command(DEV, {"type": "play", "arg": "d-rhyme-sun"})
    assert out["arg"].startswith("/companion/v1/audio/")
    with pytest.raises(ValidationError):
        await svc.send_command(DEV, {"type": "play", "arg": "l-missing"})

    await svc.update_config(DEV, {"library": {"delete": [lib[0]["id"]]}})
    assert all(i["source"] == "default" for i in svc.library.items(DEV))
    with pytest.raises(ValidationError):
        await svc.update_config(DEV, {"library": {"delete": ["d-rhyme-sun"]}})


@pytest.mark.parametrize("item", [
    {"kind": "poem", "title": "x", "text": "y"},
    {"kind": "story", "title": "", "text": "y"},
    {"kind": "story", "title": "x"},
    {"kind": "story", "title": "x", "text": "y", "audio_url": "https://a.b/c.mp3"},
    {"kind": "music", "title": "x", "audio_url": "ftp://a.b/c.mp3"},
    {"kind": "story", "title": "x", "text": "অ" * 501},
])
async def test_library_rejects_bad_items(svc, item):
    await svc.sync(DEV)
    with pytest.raises(ValidationError):
        await svc.update_config(DEV, {"library": {"add": item}})


async def test_voice_library_pick(svc):
    await svc.sync(DEV)
    text = await voice_tools.play_library(_conn(), "rhyme", "পানির")
    assert "পানির ছড়া" in text and "ঢকঢক" in text  # text items are read out in the chat
    text = await voice_tools.play_library(_conn(), "recitation")
    assert "লাইব্রেরিতে এখন কোনো তিলাওয়াত নেই" in text
    await svc.update_config(DEV, {"library": {"add": {
        "kind": "recitation", "title": "Owner's recitation", "audio_url": "https://example.com/r.mp3"}}})
    text = await voice_tools.play_library(_conn(), "recitation")
    assert "will play on the robot" in text
    assert svc.store.get(DEV)["commands"][-1]["arg"] == "https://example.com/r.mp3"


def test_play_command_validation():
    assert schema.command({"type": "play", "arg": "https://example.com/" + "a" * 200})["type"] == "play"
    with pytest.raises(ValidationError):
        schema.command({"type": "play", "arg": ""})
    with pytest.raises(ValidationError):
        schema.command({"type": "routine"})
