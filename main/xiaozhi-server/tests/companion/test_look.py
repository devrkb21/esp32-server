import pytest

from core.companion import schema
from tests.companion.test_handler import DEV, HDRS, _client


def test_look_defaults_and_merge():
    out = schema.settings({}, {"look": {"shape": "round", "size": 120, "blush": True, "mouth": "cat"}})
    look = out["look"]
    assert look["shape"] == "round" and look["size"] == 120 and look["blush"] is True
    assert look["mouth"] == "cat" and look["blink"] == "normal" and look["spacing"] == 0
    # Partial updates keep the rest
    look = schema.settings(out, {"look": {"energy": "playful"}})["look"]
    assert look["energy"] == "playful" and look["shape"] == "round" and look["hands"] is True
    assert schema.settings(out, {"look": {"hands": False}})["look"]["hands"] is False


@pytest.mark.parametrize("bad", [
    {"shape": "triangle"}, {"size": 130}, {"size": 70}, {"spacing": 11}, {"height": -7},
    {"eyes": "laser"}, {"mouth": "fangs"}, {"blink": "never"}, {"energy": "wild"}, {"blush": "yes"}, {"hands": "sometimes"},
])
def test_look_rejects_bad_values(bad):
    with pytest.raises(schema.ValidationError):
        schema.settings({}, {"look": bad})


async def test_look_in_snapshot(make_service):
    svc = make_service()
    client = await _client(svc)
    try:
        snap = await (await client.get("/companion/v1/device/sync", headers=HDRS)).json()
        assert snap["settings"]["look"] == schema.default_look()
        rev = snap["rev"]
        await svc.update_config(DEV, {"settings": {"look": {"eyes": "pupil"}}})
        snap = await (await client.get("/companion/v1/device/sync", headers=HDRS)).json()
        assert snap["settings"]["look"]["eyes"] == "pupil" and snap["rev"] != rev
    finally:
        await client.close()


def test_display_and_light_minutes():
    out = schema.settings({}, {"display": {"off_after_min": 0}, "night": {"light_minutes": 45}})
    assert out["display"] == {"dim_after_min": 3, "off_after_min": 0}
    assert out["night"]["light_minutes"] == 45
    for bad in ({"display": {"dim_after_min": -1}}, {"display": {"off_after_min": 601}},
                {"night": {"light_minutes": 601}}):
        with pytest.raises(schema.ValidationError):
            schema.settings({}, bad)


async def test_display_in_snapshot(make_service):
    svc = make_service()
    client = await _client(svc)
    try:
        snap = await (await client.get("/companion/v1/device/sync", headers=HDRS)).json()
        assert snap["settings"]["display"] == schema.default_display()
        assert snap["settings"]["night"]["light_minutes"] == 0
    finally:
        await client.close()
