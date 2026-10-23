import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

from core.companion.handler import CompanionHandler

DEV = "aa:bb:cc:dd:ee:01"
HDRS = {"Device-Id": DEV.upper(), "Client-Id": "c0ffee", "User-Agent": "tinybot/2.2.4"}


async def _client(service):
    app = web.Application()
    app.add_routes(CompanionHandler({}, service=service).routes())
    client = TestClient(TestServer(app))
    await client.start_server()
    return client


@pytest.fixture
async def client(make_service):
    c = await _client(make_service())
    yield c
    await c.close()


async def test_sync_creates_device(client):
    resp = await client.get("/companion/v1/device/sync", headers=HDRS)
    assert resp.status == 200
    snap = await resp.json()
    assert snap["rev"] >= 1 and snap["poll_s"] == 30

    resp = await client.get("/companion/v1/devices")
    devices = (await resp.json())["devices"]
    assert devices[0]["id"] == DEV and devices[0]["online"] is True

    resp = await client.get(f"/companion/v1/devices/{DEV}")
    detail = await resp.json()
    assert detail["prayer"]["lat"] == pytest.approx(23.8103)
    assert detail["settings"]["night"]["start"] == "21:30"


async def test_sync_requires_device_id(client):
    resp = await client.get("/companion/v1/device/sync")
    assert resp.status == 400


async def test_report_acks_remove_messages(client):
    await client.get("/companion/v1/device/sync", headers=HDRS)
    resp = await client.post(f"/companion/v1/devices/{DEV}/messages", json={"from": "Ammu", "text": "Hi!", "ask": True})
    assert resp.status == 200
    msg = await resp.json()
    assert msg["status"] == "pending" and msg["text_ascii"] == "Hi!"
    resp = await client.post(f"/companion/v1/devices/{DEV}/commands", json={"type": "ring"})
    cmd = await resp.json()

    snap = await (await client.get("/companion/v1/device/sync", headers=HDRS)).json()
    assert [m["id"] for m in snap["messages"]] == [msg["id"]]
    assert [c["id"] for c in snap["commands"]] == [cmd["id"]]

    resp = await client.post(
        "/companion/v1/device/report",
        headers=HDRS,
        json={"acks": [msg["id"], cmd["id"]], "replies": [{"id": msg["id"], "answer": "no", "ts": 1}],
              "events": [{"type": "pomodoro_done", "id": "", "value": 4, "ts": 1}], "stats": {"mood": "Sleepy"}},
    )
    assert (await resp.json()) == {"ok": True}

    snap = await (await client.get("/companion/v1/device/sync", headers=HDRS)).json()
    assert snap["messages"] == [] and snap["commands"] == []

    msgs = (await (await client.get(f"/companion/v1/devices/{DEV}/messages")).json())["messages"]
    assert msgs[0]["status"] == "delivered" and msgs[0]["answer"] == "no"
    events = (await (await client.get(f"/companion/v1/devices/{DEV}/events?limit=5")).json())["events"]
    assert events[0]["type"] == "pomodoro_done" and events[0]["value"] == 4


async def test_config_put_and_validation(client):
    await client.get("/companion/v1/device/sync", headers=HDRS)
    rev = (await (await client.get(f"/companion/v1/devices/{DEV}")).json())["rev"]
    resp = await client.put(
        f"/companion/v1/devices/{DEV}/config",
        json={"name": "Robo", "alarms": [{"time": "06:30", "days": 62, "label": "Wake up"}],
              "prayer": {"city": "Chittagong", "lat": 22.3569, "lon": 91.7832}},
    )
    assert resp.status == 200
    detail = await resp.json()
    assert detail["rev"] > rev and detail["name"] == "Robo"
    assert detail["alarms"][0]["id"] and detail["prayer"]["city"] == "Chittagong"

    resp = await client.put(f"/companion/v1/devices/{DEV}/config", json={"alarms": [{"time": "6.30pm"}]})
    assert resp.status == 400
    resp = await client.put(f"/companion/v1/devices/{DEV}/config", data=b"{not json")
    assert resp.status == 400
    resp = await client.put("/companion/v1/devices/00:00:00:00:00:00/config", json={})
    assert resp.status == 404


async def test_token_check(make_service):
    client = await _client(make_service(app_token="s3cret"))
    try:
        assert (await client.get("/companion/v1/devices")).status == 401
        bad = {"Authorization": "Bearer nope"}
        assert (await client.get("/companion/v1/devices", headers=bad)).status == 401
        good = {"Authorization": "Bearer s3cret"}
        assert (await client.get("/companion/v1/devices", headers=good)).status == 200
        # Device endpoints and CORS preflight stay open
        assert (await client.get("/companion/v1/device/sync", headers=HDRS)).status == 200
        resp = await client.options("/companion/v1/devices")
        assert resp.status == 200
        assert "PUT" in resp.headers["Access-Control-Allow-Methods"]
        assert "authorization" in resp.headers["Access-Control-Allow-Headers"]
    finally:
        await client.close()


async def test_audio_and_app_static(make_service):
    svc = make_service()
    client = await _client(svc)
    try:
        url = await svc.audio.render_now("হ্যালো")
        resp = await client.get(url)
        assert resp.status == 200 and resp.headers["Content-Type"] == "audio/ogg"
        assert (await resp.read()).startswith(b"OggS")
        assert (await client.get("/companion/v1/audio/..%2F..%2Fdevices.json")).status == 404
        assert (await client.get("/companion/v1/audio/" + "0" * 40 + ".ogg")).status == 404

        resp = await client.get("/app/")
        assert resp.status == 200 and "text/html" in resp.headers["Content-Type"]
        for name in ("app.js", "app.css", "manifest.webmanifest", "sw.js", "icon.svg"):
            assert (await client.get("/app/" + name)).status == 200, name
        assert (await client.get("/app/..%2Fhandler.py")).status == 404
        resp = await client.get("/app", allow_redirects=False)
        assert resp.status == 302
    finally:
        await client.close()
