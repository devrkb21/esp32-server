import asyncio
import hashlib
from datetime import date

from core.companion.mqtt_push import MqttPush
from tests.companion.test_handler import DEV, HDRS, _client

CID = "tinybot@@@28_84_85_68_FE_98@@@28_84_85_68_FE_98"


class FakeGateway:
    def __init__(self, online=True, fail=False):
        self.is_online = online
        self.fail = fail
        self.calls = []

    async def online(self, ids):
        return {i: self.is_online for i in ids}

    async def call(self, client_id, tool, arguments=None):
        if self.fail:
            raise RuntimeError("device not connected")
        self.calls.append((client_id, tool, arguments or {}))
        return {"content": [{"type": "text", "text": "true"}]}


async def _settle(svc):
    # tests/conftest.py makes asyncio.sleep return at once, so wait for the push tasks instead
    tasks = [t for t in svc._push_tasks.values() if not t.done()]
    if tasks:
        await asyncio.wait(tasks, timeout=5)


def test_config_and_token():
    assert MqttPush.from_config({"mqtt_api": "null", "mqtt_signature_key": "k"}) is None
    assert MqttPush.from_config({"mqtt_api": "gw:8007", "mqtt_signature_key": ""}) is None
    push = MqttPush.from_config({"mqtt_api": "gw:8007", "mqtt_signature_key": "k"})
    assert push.api_url == "http://gw:8007"
    day = date(2026, 10, 24)
    assert push._token(day) == hashlib.sha256(b"2026-10-24k").hexdigest()


async def test_command_is_pushed_and_acked(make_service):
    svc = make_service()
    svc.mqtt = FakeGateway()
    client = await _client(svc)
    try:
        hdrs = dict(HDRS, **{"Mqtt-Client-Id": CID})
        snap = await (await client.get("/companion/v1/device/sync", headers=hdrs)).json()
        assert snap["push"] == "mqtt"
        await svc.send_command(DEV, {"type": "game", "arg": "dice"})
        await _settle(svc)
        tools = [c[1] for c in svc.mqtt.calls]
        assert ("self.companion.command") in tools
        call = next(c for c in svc.mqtt.calls if c[1] == "self.companion.command")
        assert call[0] == CID and call[2]["type"] == "game" and call[2]["arg"] == "dice"
        # Delivered over MQTT: no longer pending for the HTTP sync
        snap = await (await client.get("/companion/v1/device/sync", headers=hdrs)).json()
        assert snap["commands"] == []
    finally:
        await client.close()


async def test_config_change_asks_for_sync_once(make_service):
    svc = make_service()
    svc.mqtt = FakeGateway()
    client = await _client(svc)
    try:
        hdrs = dict(HDRS, **{"Mqtt-Client-Id": CID})
        await client.get("/companion/v1/device/sync", headers=hdrs)
        await svc.update_config(DEV, {"settings": {"pages": {"games": False}}})
        await _settle(svc)
        assert [c[1] for c in svc.mqtt.calls] == ["self.companion.sync"]
        svc.notify(DEV)  # nothing new since: no second push
        await _settle(svc)
        assert [c[1] for c in svc.mqtt.calls] == ["self.companion.sync"]
    finally:
        await client.close()


async def test_offline_robot_keeps_long_poll(make_service):
    svc = make_service()
    svc.mqtt = FakeGateway(online=False)
    client = await _client(svc)
    try:
        hdrs = dict(HDRS, **{"Mqtt-Client-Id": CID})
        snap = await (await client.get("/companion/v1/device/sync", headers=hdrs)).json()
        assert "push" not in snap
        await svc.send_command(DEV, {"type": "stop"})
        await _settle(svc)
        assert svc.mqtt.calls == []
        snap = await (await client.get("/companion/v1/device/sync", headers=hdrs)).json()
        assert [c["type"] for c in snap["commands"]] == ["stop"]
    finally:
        await client.close()


async def test_failed_push_leaves_command_for_http(make_service):
    svc = make_service()
    svc.mqtt = FakeGateway(fail=True)
    client = await _client(svc)
    try:
        hdrs = dict(HDRS, **{"Mqtt-Client-Id": CID})
        await client.get("/companion/v1/device/sync", headers=hdrs)
        await svc.send_command(DEV, {"type": "ring"})
        await _settle(svc)
        snap = await (await client.get("/companion/v1/device/sync", headers=hdrs)).json()
        assert [c["type"] for c in snap["commands"]] == ["ring"]
    finally:
        await client.close()
