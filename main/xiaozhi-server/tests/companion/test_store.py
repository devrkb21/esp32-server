import json
import os

import pytest

from core.companion import schema
from core.companion.service import bn_weather
from core.companion.store import CompanionStore

DEV = "aa:bb:cc:dd:ee:ff"


async def test_defaults_on_first_sync(make_service):
    svc = make_service()
    snap = await svc.sync(DEV, "client-1", "tinybot/2.2.4")
    assert snap["poll_s"] == 30
    assert snap["settings"]["night"] == {
        "enabled": True, "start": "21:30", "end": "06:30", "dim": True, "lullaby": True, "light": False,
    }
    assert snap["settings"]["care"] == {"enabled": True, "lonely_after_min": 180}
    assert snap["settings"]["volume"] is None
    assert snap["pomodoro"] == {"work_min": 25, "short_break_min": 5, "long_break_min": 15, "rounds": 4}
    assert snap["alarms"] == []
    water = snap["reminders"][0]
    assert water["kind"] == "water" and water["enabled"] is False and "say" not in water
    assert snap["prayer"]["enabled"] and snap["prayer"]["city"] == "Dhaka"
    assert len(snap["prayer"]["days"]) == 2
    assert set(snap["prayer"]["audio"]) == {"fajr", "dhuhr", "asr", "maghrib", "isha"}
    assert snap["weather"]["ok"] is False
    assert snap["messages"] == [] and snap["commands"] == []
    # Persisted to disk
    with open(svc.store.path, encoding="utf-8") as f:
        assert DEV in json.load(f)["devices"]


async def test_rev_bumps_on_config_change(make_service):
    svc = make_service()
    await svc.sync(DEV)
    await svc.audio.wait_idle()  # default prayer lines rendered
    snap = await svc.sync(DEV)
    rev = snap["rev"]
    assert snap["prayer"]["audio"]["asr"].endswith(".ogg")
    again = await svc.sync(DEV)
    assert again["rev"] == rev  # nothing changed

    await svc.update_config(DEV, {"pomodoro": {"work_min": 30}})
    snap2 = await svc.sync(DEV)
    assert snap2["rev"] > rev
    assert snap2["pomodoro"]["work_min"] == 30
    assert snap2["pomodoro"]["rounds"] == 4  # partial update keeps the rest

    # Rendered audio becoming available also bumps rev
    await svc.update_config(DEV, {"alarms": [{"time": "6:30", "days": 62, "label": "Wake up", "say": "ওঠো!"}]})
    first = await svc.sync(DEV)
    assert first["alarms"][0]["time"] == "06:30"
    await svc.audio.wait_idle()
    second = await svc.sync(DEV)
    assert second["alarms"][0]["say_audio"].startswith("/companion/v1/audio/")
    assert second["rev"] > first["rev"]


async def test_validation_errors(make_service):
    svc = make_service()
    await svc.sync(DEV)
    for bad in (
        {"alarms": [{"time": "25:00"}]},
        {"alarms": [{"time": "07:00", "days": 128}]},
        {"settings": {"volume": 101}},
        {"reminders": [{"kind": "pizza", "time": "07:00"}]},
        {"name": ""},
        {"alarms": "nope"},
    ):
        with pytest.raises(schema.ValidationError):
            await svc.update_config(DEV, bad)
    # Failed updates leave the device untouched
    assert svc.store.get(DEV)["alarms"] == []


async def test_ids_and_label_sanitised(make_service):
    svc = make_service()
    await svc.sync(DEV)
    dev = await svc.update_config(
        DEV, {"alarms": [{"time": "07:00", "label": "সকাল Wake up a very long label indeed"}, {"time": "08:00"}]}
    )
    a, b = dev["alarms"]
    assert a["id"] != b["id"] and a["id"].startswith("a")
    assert a["label"] == "Wake up a very long labe"  # ASCII only, 24 chars


async def test_message_and_command_ack_flow(make_service):
    svc = make_service()
    await svc.sync(DEV)
    msg = await svc.send_message(DEV, {"from": "Ammu", "text": "খেয়েছো?", "ask": True})
    cmd = await svc.send_command(DEV, {"type": "story", "arg": ""})
    snap = await svc.sync(DEV)
    assert [m["id"] for m in snap["messages"]] == [msg["id"]]
    assert snap["messages"][0]["from_ascii"] == "Ammu" and snap["messages"][0]["text_ascii"] == ""
    assert [c["id"] for c in snap["commands"]] == [cmd["id"]]

    await svc.report(DEV, {
        "acks": [msg["id"], cmd["id"]],
        "replies": [{"id": msg["id"], "answer": "yes", "ts": 1793000100}],
        "events": [{"type": "alarm_dismissed", "id": "a1", "value": 0, "ts": 1793000000}],
        "stats": {"fw": "2.2.4", "mood": "Happy", "bond_score": 72, "high_scores": {"catch": 12}},
    })
    snap = await svc.sync(DEV)
    assert snap["messages"] == [] and snap["commands"] == []
    dev = svc.store.get(DEV)
    m = dev["messages"][-1]
    assert m["status"] == "delivered" and m["answer"] == "yes"
    assert dev["events"][-1]["type"] == "alarm_dismissed"
    assert dev["stats"]["mood"] == "Happy" and dev["stats"]["high_scores"] == {"catch": 12}

    # "seen" does not override a yes/no answer
    await svc.report(DEV, {"replies": [{"id": msg["id"], "answer": "seen"}]})
    assert svc.store.get(DEV)["messages"][-1]["answer"] == "yes"


async def test_events_capped(make_service):
    svc = make_service()
    await svc.sync(DEV)
    for i in range(3):
        await svc.report(DEV, {"events": [{"type": "game_score", "id": "catch", "value": j} for j in range(100)]})
    assert len(svc.store.get(DEV)["events"]) == 200


async def test_store_reload_and_atomic_file(tmp_path):
    path = str(tmp_path / "devices.json")
    store = CompanionStore(path)
    await store.touch(DEV)
    async with store.lock:
        await store.save()
    assert not os.path.exists(path + ".tmp")
    again = CompanionStore(path)
    assert again.get(DEV)["pomodoro"]["work_min"] == 25


async def test_placeholders(make_service):
    svc = make_service()
    await svc.sync(DEV)
    await svc.update_config(DEV, {"name": "Robo", "settings": {"owner_name": "Mim"}})
    dev = svc.store.get(DEV)
    weather = {"ok": True, "kind": "rain", "temp": 29, "rain_prob": 70}
    out = svc.expand("শুভ সকাল {name}! {weather}। আজ {date}", dev, weather)
    assert "Mim" in out and "২৯" in out and "{" not in out
    assert "বৃষ্টি" in bn_weather(weather)


async def test_commands_validated(make_service):
    svc = make_service()
    await svc.sync(DEV)
    assert (await svc.send_command(DEV, {"type": "game", "arg": "SIMON"}))["arg"] == "simon"
    assert (await svc.send_command(DEV, {"type": "pomodoro", "arg": 30}))["arg"] == "30"
    with pytest.raises(schema.ValidationError):
        await svc.send_command(DEV, {"type": "selfdestruct"})
    with pytest.raises(schema.ValidationError):
        await svc.send_command(DEV, {"type": "game", "arg": "chess"})
