"""Hooks other companion features call into (see .bunshin/features-contract.md).

smart_home(user, action) -> {"ok": bool, "code": str, "say": str}
    HOME's integration: switches the owner's smart-home device through manager-api, the same way
    the voice tool does. A routine's smart_home step (core/companion/routines.py) calls it through
    call_smart_home, which only needs the Bangla line. Another implementation can be installed by
    assigning `hooks.smart_home` at start-up; it may be sync or async and may return the dict above
    or just the sentence.

    user:   the robot: its MAC / device id string, a dict with "device_id" (or "mac"), or a
            connection object with `device_id`.
    action: spoken-style text ("বসার ঘরের লাইট বন্ধ করো", "এসি ২৪ ডিগ্রি") or a dict
            {"device": "বসার ঘরের লাইট", "action": "on|off|toggle|open|close|set_temperature|...",
             "value": 24}.
    `say` is TinyBot's Bangla line for the result (confirmation, "not found", "hub unreachable",
    ...). Never raises for an unreachable hub.
"""

import inspect
from typing import Any, Dict

NOT_CONNECTED_BN = "স্মার্ট হোম এখনো যুক্ত করা হয়নি।"


async def smart_home(user: Any, action: Any) -> Dict:
    """Run one smart-home command for the robot `user`."""
    from core.companion import home_tools

    mac = home_tools.mac_of(user)
    if not mac:
        return {"ok": False, "code": "no_robot", "say": "কোন রোবট থেকে চালাবো, বুঝতে পারলাম না।"}
    device, act, value, command = home_tools.as_command(action)
    return await home_tools.control(mac, device=device, action=act, value=value, command=command)


async def call_smart_home(user: Dict, action: str) -> str:
    """Run the installed smart_home hook (looked up at call time, so a replacement is used) and
    return the sentence TinyBot may speak ("" = say nothing)."""
    result = smart_home_impl()(user, action)
    if inspect.isawaitable(result):
        result = await result
    if isinstance(result, dict):
        return result.get("say") or ""
    return result if isinstance(result, str) else ""


def smart_home_impl():
    return globals()["smart_home"]
