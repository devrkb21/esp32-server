"""Smart home and robot-to-robot messages by voice (HOME).

"বসার ঘরের লাইট বন্ধ করো", "ফ্যান চালাও", "এসি ২৪ ডিগ্রি": the spoken name is matched against
the owner's devices (names and aliases, home_match.py) and manager-api switches the device
(Home Assistant service or MQTT publish; the secrets never leave manager-api).
"বাবার রোবটকে বলো আমি আসছি": the contact is matched the same way and manager-api hands the text
to the other robot's companion messages (spoken there, held through its night mode).

Every function returns {"ok", "code", "say"}: `say` is TinyBot's Bangla line (তুমি form).
"""

import time
from typing import Dict, List, Optional, Tuple

from core.companion import home_api
from core.companion.home_match import bn_number, match_device, best_matches, parse_action

DEVICE_CACHE_S = 20.0
_device_cache: Dict[str, Tuple[float, Dict]] = {}

DONE_SAY = {
    "on": "{name} চালু করে দিলাম।",
    "off": "{name} বন্ধ করে দিলাম।",
    "toggle": "{name} উল্টে দিলাম।",
    "open": "{name} খুলে দিলাম।",
    "close": "{name} বন্ধ করে দিলাম।",
    "stop": "{name} থামিয়ে দিলাম।",
    "set_temperature": "{name} {value} ডিগ্রিতে দিলাম।",
    "set_brightness": "{name} {value} শতাংশ আলোতে দিলাম।",
    "set_speed": "{name} {value} শতাংশ গতিতে দিলাম।",
}
LIGHT_SAY = {"on": "{name} জ্বালিয়ে দিলাম।", "off": "{name} নিভিয়ে দিলাম।"}

FAIL_SAY = {
    "unreachable": "স্মার্ট হোমের হাবের সাথে যোগাযোগ করতে পারছি না। হাবটা চালু আর নেটওয়ার্কে আছে কি না একটু দেখো।",
    "unauthorized": "স্মার্ট হোমের হাব আমার চাবি মানছে না। অ্যাপের স্মার্ট হোম পাতায় টোকেনটা আবার দিতে হবে।",
    "not_configured": "স্মার্ট হোম এখনো সেট করা হয়নি। অ্যাপের স্মার্ট হোম পাতা থেকে সেট করে নাও।",
    "unsupported": "{name} এই কাজটা পারে না।",
    "bad_value": "এসি ১৬ থেকে ৩০ ডিগ্রির মধ্যে দিতে পারি।",
    "not_supported": "এই রোবটে স্মার্ট হোম চালু নেই।",
    "not_bound": "এই রোবট এখনো কোনো অ্যাকাউন্টে যুক্ত হয়নি, তাই স্মার্ট হোম চালাতে পারছি না।",
    "manager": "এখন সার্ভারের সাথে কথা বলতে পারছি না, একটু পরে আবার বলো।",
    "error": "{name} চালাতে গিয়ে একটা সমস্যা হলো, একটু পরে আবার চেষ্টা করো।",
}

MSG_SAY = {
    "ok": "{name}-কে বার্তাটা পাঠিয়ে দিলাম।",
    "later": "{name} এখন রাতের ঘুমে আছে। সকালে উঠলেই বার্তাটা শুনিয়ে দেবে।",
    "not_found": "'{phrase}' নামে কোনো রোবট আমার ঠিকানা খাতায় নেই। অ্যাপের বার্তা পাতায় যোগাযোগটা যোগ করে নাও।",
    "no_targets": "আমার ঠিকানা খাতায় এখনো কোনো রোবট নেই। অ্যাপের বার্তা পাতা থেকে যোগ করে নাও।",
    "which": "কোন রোবটকে বলবো? {names}?",
    "empty": "কী বলবো, সেটা আরেকবার বলো তো।",
    "too_long": "বার্তাটা একটু লম্বা হয়ে গেলো, ছোট করে বলো।",
    "not_supported": "এই রোবট থেকে অন্য রোবটে বার্তা পাঠানো যায় না।",
    "not_bound": "এই রোবট এখনো কোনো অ্যাকাউন্টে যুক্ত হয়নি, তাই বার্তা পাঠাতে পারছি না।",
    "not_registered": "{name} এখনো সার্ভারে আসেনি, তাই বার্তাটা পৌঁছাতে পারলাম না।",
    "unreachable": "বার্তাটা পৌঁছাতে পারলাম না, একটু পরে আবার চেষ্টা করো।",
    "manager": "এখন সার্ভারের সাথে কথা বলতে পারছি না, একটু পরে আবার বলো।",
}


def _out(ok: bool, code: str, say: str, **extra) -> Dict:
    d = {"ok": ok, "code": code, "say": say}
    d.update(extra)
    return d


def _value_text(value) -> str:
    if value is None:
        return ""
    v = float(value)
    return bn_number(int(v) if v == int(v) else v)


def _names(items: List[Dict], limit: int = 3) -> str:
    names = [i.get("name", "") for i in items[:limit] if i.get("name")]
    if len(names) <= 1:
        return "".join(names)
    return ", ".join(names[:-1]) + " নাকি " + names[-1]


def done_say(device: Dict, action: str, value=None) -> str:
    name = device.get("name") or "যন্ত্রটা"
    table = LIGHT_SAY if device.get("domain") == "light" and action in LIGHT_SAY else DONE_SAY
    return table.get(action, DONE_SAY["on"]).format(name=name, value=_value_text(value))


def not_found_say(phrase: str, devices: List[Dict]) -> str:
    base = f"'{phrase}' নামে কোনো যন্ত্র খুঁজে পেলাম না।" if phrase else "কোন যন্ত্রটা বলছো, বুঝতে পারলাম না।"
    if devices:
        return base + " আমি চিনি: " + _names(devices, 4) + "।"
    return base + " অ্যাপের স্মার্ট হোম পাতায় যন্ত্র যোগ করে নাও।"


async def _devices(mac: str, fresh: bool = False) -> Dict:
    now = time.monotonic()
    hit = _device_cache.get(mac)
    if hit and not fresh and now - hit[0] < DEVICE_CACHE_S:
        return hit[1]
    data = await home_api.get_api().home_devices(mac)
    if data.get("ok"):
        _device_cache[mac] = (now, data)
    return data


def clear_cache() -> None:
    _device_cache.clear()


async def control(mac: str, device: str = "", action: str = "", value=None, command: str = "") -> Dict:
    """Switch the owner's device that `device` (or the spoken `command`) names.

    `action`: on, off, toggle, open, close, stop, set_temperature, set_brightness, set_speed; when
    empty it is read from `command` ("এসি ২৪ ডিগ্রি"). `value`: degrees or percent.
    """
    mac = (mac or "").strip().lower()
    phrase = (device or command or "").strip()
    act = (action or "").strip().lower()
    if not act or (act == "set_temperature" and value is None):
        parsed, parsed_value = parse_action(command or device)
        act = act or parsed or ""
        if value is None:
            value = parsed_value
    if not act:
        return _out(False, "no_action", "কী করবো, চালু না বন্ধ, সেটা বলো তো।")
    try:
        if value is not None:
            value = float(value)
    except (TypeError, ValueError):
        value = None
    try:
        data = await _devices(mac)
    except home_api.HomeApiUnavailable:
        return _out(False, "manager", FAIL_SAY["manager"])
    if not data.get("ok"):
        code = data.get("code") or "error"
        return _out(False, code, FAIL_SAY.get(code, FAIL_SAY["error"]).format(name="স্মার্ট হোম"))
    devices = data.get("devices") or []
    integration = data.get("integration") or {}
    if not devices:
        ha = integration.get("ha") or {}
        if not ha.get("tokenSaved") and not (integration.get("mqtt") or {}).get("host"):
            return _out(False, "not_configured", FAIL_SAY["not_configured"])
        return _out(False, "not_found", not_found_say(phrase, []))
    found, several = match_device(phrase, devices)
    if found is None and several:
        return _out(False, "ambiguous", f"কোনটা বলছো? {_names(several)}?", candidates=[d.get("name") for d in several])
    if found is None:
        return _out(False, "not_found", not_found_say(phrase, devices))
    if act == "set_temperature" and found.get("domain") != "climate":
        return _out(False, "unsupported", FAIL_SAY["unsupported"].format(name=found.get("name")))
    try:
        result = await home_api.get_api().home_action(mac, found["id"], act, value)
    except home_api.HomeApiUnavailable:
        return _out(False, "manager", FAIL_SAY["manager"])
    code = result.get("code") or ("ok" if result.get("ok") else "error")
    if result.get("ok"):
        return _out(True, "ok", done_say(found, act, value), device=found.get("name"), action=act)
    if code == "not_found":
        _device_cache.pop(mac, None)  # the list changed in the app
        return _out(False, code, not_found_say(phrase, devices))
    return _out(False, code, FAIL_SAY.get(code, FAIL_SAY["error"]).format(name=found.get("name")), device=found.get("name"))


async def send_robot_message(mac: str, to: str = "", text: str = "") -> Dict:
    """Send `text` from the talking robot to the robot `to` names (own robots or contacts)."""
    mac = (mac or "").strip().lower()
    phrase = (to or "").strip()
    body = (text or "").strip()
    if not body:
        return _out(False, "empty", MSG_SAY["empty"])
    try:
        data = await home_api.get_api().contact_targets(mac)
    except home_api.HomeApiUnavailable:
        return _out(False, "manager", MSG_SAY["manager"])
    if not data.get("ok"):
        code = data.get("code") or "unreachable"
        return _out(False, code, MSG_SAY.get(code, MSG_SAY["unreachable"]).format(name="", phrase=phrase))
    targets = data.get("targets") or []
    if not targets:
        return _out(False, "no_targets", MSG_SAY["no_targets"])
    found, several = best_matches(phrase, targets)
    if found is None and several:
        return _out(False, "ambiguous", MSG_SAY["which"].format(names=_names(several)))
    if found is None:
        if len(targets) == 1 and not phrase:
            found = targets[0]
        else:
            return _out(False, "not_found", MSG_SAY["not_found"].format(phrase=phrase))
    try:
        result = await home_api.get_api().contact_send(mac, found["key"], body)
    except home_api.HomeApiUnavailable:
        return _out(False, "manager", MSG_SAY["manager"])
    name = found.get("name") or "রোবট"
    if result.get("ok"):
        key = "later" if result.get("later") else "ok"
        return _out(True, "ok", MSG_SAY[key].format(name=name), to=name, later=bool(result.get("later")))
    code = result.get("code") or "unreachable"
    return _out(False, code, MSG_SAY.get(code, MSG_SAY["unreachable"]).format(name=name, phrase=phrase))


def mac_of(user) -> str:
    """The robot's MAC from whatever a caller has: a MAC string, a dict, or a connection."""
    if isinstance(user, str):
        return user.strip().lower()
    if isinstance(user, dict):
        for k in ("device_id", "mac", "deviceId", "id"):
            if user.get(k):
                return str(user[k]).strip().lower()
        return ""
    for attr in ("device_id", "mac"):
        v = getattr(user, attr, None)
        if v:
            return str(v).strip().lower()
    headers = getattr(user, "headers", None) or {}
    return str(headers.get("device-id", "")).strip().lower()


def as_command(action) -> Tuple[str, str, Optional[float], str]:
    """(device, action, value, spoken command) from a hook argument (text or dict)."""
    if isinstance(action, dict):
        return (
            str(action.get("device") or action.get("name") or ""),
            str(action.get("action") or ""),
            action.get("value"),
            str(action.get("command") or action.get("text") or ""),
        )
    text = str(action or "")
    return text, "", None, text
