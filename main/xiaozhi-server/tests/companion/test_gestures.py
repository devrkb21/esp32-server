import pytest

from core.companion import schema
from tests.companion.test_handler import DEV, HDRS, _client


def test_gesture_defaults():
    assert schema.default_gestures() == {"double_tap": "none", "triple_tap": "talk"}
    assert set(schema.GESTURE_ACTIONS) == {
        "none", "talk", "focus", "breathe", "night_light", "lullaby", "story", "game_catch",
        "game_simon", "game_dice", "game_reaction", "game_random", "pages", "status",
    }


def test_gestures_partial_merge():
    out = schema.settings({}, {"gestures": {"double_tap": "focus"}})
    assert out["gestures"] == {"double_tap": "focus", "triple_tap": "talk"}
    out = schema.settings(out, {"gestures": {"triple_tap": "game_random"}})
    assert out["gestures"] == {"double_tap": "focus", "triple_tap": "game_random"}
    # Empty patch keeps the values; unknown keys are ignored
    out = schema.settings(out, {"gestures": {"quad_tap": "talk"}})
    assert out["gestures"] == {"double_tap": "focus", "triple_tap": "game_random"}
    assert "quad_tap" not in out["gestures"]


@pytest.mark.parametrize("bad", [
    {"double_tap": "dance"}, {"triple_tap": ""}, {"double_tap": None}, {"triple_tap": 3},
])
def test_gestures_reject_bad_values(bad):
    with pytest.raises(schema.ValidationError):
        schema.settings({}, {"gestures": bad})


def test_gestures_must_be_object():
    with pytest.raises(schema.ValidationError):
        schema.settings({}, {"gestures": "talk"})


async def test_gestures_in_snapshot_and_detail(make_service):
    svc = make_service()
    client = await _client(svc)
    try:
        snap = await (await client.get("/companion/v1/device/sync", headers=HDRS)).json()
        assert snap["settings"]["gestures"] == {"double_tap": "none", "triple_tap": "talk"}
        rev = snap["rev"]
        await svc.update_config(DEV, {"settings": {"gestures": {"double_tap": "focus"}},
                                      "pomodoro": {"work_min": 45}})
        snap = await (await client.get("/companion/v1/device/sync", headers=HDRS)).json()
        assert snap["settings"]["gestures"] == {"double_tap": "focus", "triple_tap": "talk"}
        assert snap["pomodoro"]["work_min"] == 45
        assert snap["rev"] != rev
        detail = svc.device_detail(svc.store.get(DEV))
        assert detail["settings"]["gestures"]["double_tap"] == "focus"
    finally:
        await client.close()


async def test_gestures_default_for_old_stored_device(make_service):
    svc = make_service()
    await svc.store.touch(DEV)
    # A device saved before gestures existed has no settings.gestures
    svc.store.get(DEV)["settings"].pop("gestures", None)
    client = await _client(svc)
    try:
        snap = await (await client.get("/companion/v1/device/sync", headers=HDRS)).json()
        assert snap["settings"]["gestures"] == schema.default_gestures()
    finally:
        await client.close()
