from core.companion.store import _clean_stats


def test_battery_is_kept_and_clamped():
    out = _clean_stats({"fw": "2.6.1", "battery": {"level": 130, "charging": 1}})
    assert out["battery"] == {"level": 100, "charging": True}


def test_no_battery_or_bad_battery_is_left_out():
    assert "battery" not in _clean_stats({"fw": "2.6.0"})
    assert "battery" not in _clean_stats({"battery": {"level": "x"}})
    assert "battery" not in _clean_stats({"battery": 50})
