import pytest

from core.companion.ogg import write_ogg_opus
from core.companion.service import CompanionService


async def fake_synthesize(text, voice):
    # Valid (silent-ish) Ogg container; no network or ffmpeg needed
    return write_ogg_opus([b"\xf8\xff\xfe"] * 3)


def make_config(tmp_path, **companion):
    cfg = {"data_dir": str(tmp_path / "companion"), "app_token": ""}
    cfg.update(companion)
    return {"companion": cfg, "server": {"timezone_offset": 6}}


async def no_weather(lat, lon):
    raise OSError("offline in tests")


@pytest.fixture
def make_service(tmp_path):
    def _make(**companion):
        svc = CompanionService(make_config(tmp_path, **companion), synthesize=fake_synthesize)
        svc.weather._fetch = no_weather
        return svc

    return _make
