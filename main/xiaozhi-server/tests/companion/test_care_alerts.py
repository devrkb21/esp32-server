"""Care alert settings (settings.care) and the robot's fall event (FAMILY wave).

manager-api reads these from the companion view to send care alerts to the robot's family; the
robot itself only uses `enabled` and `lonely_after_min`.
"""

import pytest

from core.companion import schema

DEV = "aa:bb:cc:dd:ee:01"


async def test_care_alert_keys_are_stored(make_service):
    svc = make_service()
    await svc.sync(DEV)
    dev = await svc.update_config(
        DEV,
        {"settings": {"care": {"no_activity_hours": 4, "fall_alert": False, "missed_medicine_alert": True}}},
    )
    care = dev["settings"]["care"]
    assert care["no_activity_hours"] == 4
    assert care["fall_alert"] is False
    assert care["missed_medicine_alert"] is True
    # Existing keys are merged, not replaced
    assert care["enabled"] is True and care["lonely_after_min"] == 180


async def test_care_alert_keys_reach_the_snapshot_unchanged(make_service):
    svc = make_service()
    await svc.sync(DEV)
    await svc.update_config(DEV, {"settings": {"care": {"no_activity_hours": 0}}})
    snap = await svc.sync(DEV)
    assert snap["settings"]["care"]["no_activity_hours"] == 0


@pytest.mark.parametrize(
    "bad",
    [
        {"no_activity_hours": 13},
        {"no_activity_hours": -1},
        {"no_activity_hours": "four"},
        {"fall_alert": "yes"},
    ],
)
async def test_bad_care_alert_values_are_rejected(make_service, bad):
    svc = make_service()
    await svc.sync(DEV)
    with pytest.raises(schema.ValidationError):
        await svc.update_config(DEV, {"settings": {"care": bad}})


async def test_fall_event_is_kept(make_service):
    svc = make_service()
    await svc.sync(DEV)
    await svc.report(DEV, {"events": [{"type": "fall", "id": "", "value": 0, "ts": 1793000000}]})
    view = svc.device_detail(svc.store.get(DEV))
    assert view["events"][0]["type"] == "fall"
    assert "fall" in schema.EVENT_TYPES
