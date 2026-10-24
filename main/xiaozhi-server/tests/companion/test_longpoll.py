import asyncio
import time

import pytest

from core.companion import schema
from tests.companion.test_handler import DEV, HDRS, _client


async def test_long_poll_wakes_on_command(make_service):
    svc = make_service()
    client = await _client(svc)
    try:
        first = await (await client.get("/companion/v1/device/sync", headers=HDRS)).json()
        assert first["long_poll"] > 0
        rev = first["rev"]

        async def send_later():
            await asyncio.sleep(0.3)
            await svc.send_command(DEV, {"type": "stop"})

        start = time.monotonic()
        task = asyncio.create_task(send_later())
        resp = await client.get(f"/companion/v1/device/sync?wait=10&rev={rev}", headers=HDRS)
        snap = await resp.json()
        await task
        assert time.monotonic() - start < 3
        assert [c["type"] for c in snap["commands"]] == ["stop"]
    finally:
        await client.close()


async def test_long_poll_times_out_without_news(make_service):
    svc = make_service()
    client = await _client(svc)
    try:
        rev = (await (await client.get("/companion/v1/device/sync", headers=HDRS)).json())["rev"]
        start = time.monotonic()
        snap = await (await client.get(f"/companion/v1/device/sync?wait=1&rev={rev}", headers=HDRS)).json()
        assert 0.9 <= time.monotonic() - start < 3
        assert snap["commands"] == []
    finally:
        await client.close()


async def test_long_poll_returns_at_once_when_rev_differs(make_service):
    svc = make_service()
    client = await _client(svc)
    try:
        await client.get("/companion/v1/device/sync", headers=HDRS)
        start = time.monotonic()
        await client.get("/companion/v1/device/sync?wait=10&rev=-1", headers=HDRS)
        assert time.monotonic() - start < 2
    finally:
        await client.close()


async def test_pages_setting_and_new_commands(make_service):
    svc = make_service()
    client = await _client(svc)
    try:
        snap = await (await client.get("/companion/v1/device/sync", headers=HDRS)).json()
        assert snap["settings"]["pages"] == {p: True for p in schema.PAGES}
        await svc.update_config(DEV, {"settings": {"pages": {"games": False, "story": False}}})
        snap = await (await client.get("/companion/v1/device/sync", headers=HDRS)).json()
        assert snap["settings"]["pages"]["games"] is False
        assert snap["settings"]["pages"]["clock"] is True
        with pytest.raises(schema.ValidationError):
            schema.settings({}, {"pages": {"games": "yes"}})
        assert schema.command({"type": "night", "arg": "off"}) == {"type": "night", "arg": "off"}
        with pytest.raises(schema.ValidationError):
            schema.command({"type": "night", "arg": "later"})
        assert schema.command({"type": "stop", "arg": "x"}) == {"type": "stop", "arg": ""}
    finally:
        await client.close()
