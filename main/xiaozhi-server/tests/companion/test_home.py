"""Smart home by voice (HOME): Bangla/English alias matching, actions from speech, and the voice
tool against a fake manager-api that switches devices on a fake Home Assistant."""

import pytest

from core.companion import home_api, home_tools, hooks
from core.companion.home_match import match_device, best_matches, normalize, parse_action, tokens

DEVICES = [
    {"id": "1", "source": "ha", "entityId": "light.living_room", "domain": "light", "name": "Living Room Light",
     "aliases": ["বসার ঘরের বাতি"], "enabled": True},
    {"id": "2", "source": "ha", "entityId": "light.bedroom", "domain": "light", "name": "শোবার ঘরের লাইট",
     "aliases": [], "enabled": True},
    {"id": "3", "source": "ha", "entityId": "fan.bedroom", "domain": "fan", "name": "Bedroom Fan",
     "aliases": [], "enabled": True},
    {"id": "4", "source": "ha", "entityId": "climate.ac", "domain": "climate", "name": "AC",
     "aliases": ["এসি"], "enabled": True},
    {"id": "5", "source": "mqtt", "entityId": "", "domain": "switch", "name": "Kettle", "aliases": ["কেটলি", "পানির কেটলি"],
     "enabled": True},
]


def pick(phrase, devices=DEVICES):
    found, several = match_device(phrase, devices)
    return found["id"] if found else [d["id"] for d in several]


# ----------------------------------------------------------------------------- matching
def test_normalize_folds_bangla_digits_and_punctuation():
    assert normalize("এসি ২৪ ডিগ্রি।") == "এসি 24 ডিগ্রি"
    assert tokens("বসার ঘরের লাইটটা বন্ধ করো") == ["living", "room", "light"]
    assert tokens("Turn off the living room lights") == ["living", "room", "light"]


@pytest.mark.parametrize("phrase,expected", [
    ("বসার ঘরের লাইট", "1"),          # Bangla speech, English device name
    ("বসার ঘরের বাতি বন্ধ করো", "1"),  # the alias itself
    ("living room light", "1"),
    ("ড্রয়িং রুমের লাইট", "1"),         # another word for the living room
    ("শোবার ঘরের লাইট", "2"),
    ("bedroom light", "2"),            # English speech, Bangla device name
    ("বেডরুমের ফ্যান", "3"),
    ("ফ্যান চালাও", "3"),               # the only fan
    ("পাখা", "3"),
    ("এসি", "4"),
    ("এয়ার কন্ডিশনার", "4"),
    ("পানির কেটলিটা চালু করো", "5"),
])
def test_spoken_names_find_their_device(phrase, expected):
    assert pick(phrase) == expected


def test_a_bare_kind_with_several_devices_asks_which():
    assert sorted(pick("লাইট বন্ধ করো")) == ["1", "2"]


def test_unknown_names_find_nothing():
    assert pick("রান্নাঘরের লাইট") in ([], ["1", "2"])
    assert pick("গাড়ির হর্ন") == []
    assert pick("") == []


def test_contacts_match_with_bangla_endings():
    targets = [
        {"key": "c:1", "name": "বাবার রোবট", "aliases": ["বাবা", "Abbu"]},
        {"key": "c:2", "name": "Nanu", "aliases": ["নানু", "নানির রোবট"]},
        {"key": "d:aa", "name": "Kitchen", "aliases": []},
    ]
    assert best_matches("বাবার রোবটকে", targets)[0]["key"] == "c:1"
    assert best_matches("আব্বুকে", targets)[0]["key"] == "c:1"
    assert best_matches("abbu", targets)[0]["key"] == "c:1"
    assert best_matches("নানুকে", targets)[0]["key"] == "c:2"
    assert best_matches("kitchen robot", targets)[0]["key"] == "d:aa"
    assert best_matches("মামার রোবট", targets) == (None, [])


@pytest.mark.parametrize("text,expected", [
    ("বসার ঘরের লাইট বন্ধ করো", ("off", None)),
    ("ফ্যান চালাও", ("on", None)),
    ("লাইট জ্বালাও", ("on", None)),
    ("লাইট নিভাও", ("off", None)),
    ("এসি ২৪ ডিগ্রি", ("set_temperature", 24.0)),
    ("এসি 23.5 ডিগ্রিতে দাও", ("set_temperature", 23.5)),
    ("set the AC to 22", ("set_temperature", 22.0)),
    ("পর্দা খুলে দাও", ("open", None)),
    ("turn on the kettle", ("on", None)),
    ("অনেক গরম লাগছে", (None, None)),  # "অন" inside a word is not "on"
])
def test_actions_from_speech(text, expected):
    assert parse_action(text) == expected


# ----------------------------------------------------------------------------- the voice tool
class FakeHomeAssistant:
    """Records the service calls manager-api would make (same table as HomeActions.java)."""

    SERVICES = {
        ("light", "on"): "light.turn_on", ("light", "off"): "light.turn_off",
        ("fan", "on"): "fan.turn_on", ("fan", "off"): "fan.turn_off",
        ("switch", "on"): "switch.turn_on", ("switch", "off"): "switch.turn_off",
        ("climate", "set_temperature"): "climate.set_temperature", ("climate", "off"): "climate.turn_off",
    }

    def __init__(self):
        self.calls = []
        self.reachable = True


class FakeManagerApi:
    """manager-api's /config/home/* and /config/contacts/* for one robot (aa:bb)."""

    def __init__(self, devices=DEVICES, targets=None, refuse=None):
        self.devices = devices
        self.targets = targets or []
        self.refuse = refuse
        self.ha = FakeHomeAssistant()
        self.sent = []
        self.down = False

    async def home_devices(self, mac):
        if self.down:
            raise home_api.HomeApiUnavailable("down")
        if self.refuse:
            return {"ok": False, "code": self.refuse}
        return {"ok": True, "code": "ok", "devices": self.devices,
                "integration": {"ha": {"baseUrl": "http://ha.local:8123", "tokenSaved": True}, "mqtt": {"host": ""}}}

    async def home_action(self, mac, device_id, action, value=None):
        dev = next((d for d in self.devices if d["id"] == device_id), None)
        if dev is None:
            return {"ok": False, "code": "not_found"}
        if not self.ha.reachable:
            return {"ok": False, "code": "unreachable"}
        if dev["source"] == "mqtt":
            self.ha.calls.append(("mqtt", dev["name"], action))
            return {"ok": True, "code": "ok"}
        service = self.ha.SERVICES.get((dev["domain"], action))
        if service is None:
            return {"ok": False, "code": "unsupported"}
        data = {"entity_id": dev["entityId"]}
        if value is not None:
            data["temperature"] = value
        self.ha.calls.append((service, data))
        return {"ok": True, "code": "ok", "service": service}

    async def contact_targets(self, mac):
        return {"ok": True, "code": "ok", "targets": self.targets}

    async def contact_send(self, mac, target, text):
        self.sent.append((target, text))
        return {"ok": True, "code": "ok", "later": target == "c:night"}


@pytest.fixture
def api():
    fake = FakeManagerApi()
    home_api.set_api(fake)
    home_tools.clear_cache()
    yield fake
    home_api.set_api(None)
    home_tools.clear_cache()


async def test_living_room_light_off_calls_light_turn_off(api):
    r = await home_tools.control("AA:BB", device="বসার ঘরের লাইট", action="off")
    assert r["ok"] is True
    assert api.ha.calls == [("light.turn_off", {"entity_id": "light.living_room"})]
    assert r["say"] == "Living Room Light নিভিয়ে দিলাম।"


async def test_ac_24_degrees_from_the_spoken_command(api):
    r = await hooks.smart_home("aa:bb", "এসি ২৪ ডিগ্রি")
    assert r["ok"] is True
    assert api.ha.calls == [("climate.set_temperature", {"entity_id": "climate.ac", "temperature": 24.0})]
    assert "২৪ ডিগ্রি" in r["say"]


async def test_fan_on_through_the_hook_with_a_dict(api):
    r = await hooks.smart_home({"device_id": "aa:bb"}, {"device": "ফ্যান", "action": "on"})
    assert r["ok"] and api.ha.calls == [("fan.turn_on", {"entity_id": "fan.bedroom"})]
    assert r["say"] == "Bedroom Fan চালু করে দিলাম।"


async def test_mqtt_device(api):
    r = await home_tools.control("aa:bb", device="কেটলি", action="on")
    assert r["ok"] and api.ha.calls == [("mqtt", "Kettle", "on")]


async def test_device_not_found_is_said_clearly(api):
    r = await home_tools.control("aa:bb", device="গাড়ির হর্ন", action="on")
    assert r["ok"] is False and r["code"] == "not_found"
    assert "খুঁজে পেলাম না" in r["say"] and "Living Room Light" in r["say"]
    assert api.ha.calls == []


async def test_ambiguous_name_asks_which(api):
    r = await home_tools.control("aa:bb", device="লাইট", action="off")
    assert r["code"] == "ambiguous" and "কোনটা" in r["say"]
    assert api.ha.calls == []


async def test_unreachable_hub_is_said_clearly(api):
    api.ha.reachable = False
    r = await home_tools.control("aa:bb", device="এসি", action="off")
    assert r["ok"] is False and r["code"] == "unreachable"
    assert "হাবের সাথে যোগাযোগ করতে পারছি না" in r["say"]


async def test_manager_down_and_feature_off(api):
    api.down = True
    r = await home_tools.control("aa:bb", device="এসি", action="off")
    assert r["code"] == "manager"
    home_tools.clear_cache()
    home_api.set_api(FakeManagerApi(refuse="not_supported"))
    r = await home_tools.control("aa:bb", device="এসি", action="off")
    assert r["code"] == "not_supported" and "স্মার্ট হোম চালু নেই" in r["say"]


async def test_temperature_on_a_light_is_refused(api):
    r = await home_tools.control("aa:bb", device="বসার ঘরের লাইট", action="set_temperature", value=24)
    assert r["code"] == "unsupported" and api.ha.calls == []


async def test_no_action_asks(api):
    r = await home_tools.control("aa:bb", device="বসার ঘরের লাইট")
    assert r["code"] == "no_action"


async def test_hook_without_a_robot():
    r = await hooks.smart_home("", "ফ্যান চালাও")
    assert r["ok"] is False and r["code"] == "no_robot"


def test_mac_of_reads_connections():
    class Conn:
        device_id = "AA:BB:CC"

    assert home_tools.mac_of(Conn()) == "aa:bb:cc"
    assert home_tools.mac_of({"mac": "X"}) == "x"
