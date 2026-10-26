"""Extension points the companion calls into, filled in by other modules.

smart_home(user, action) -> str
    Called by a routine's smart_home step (core/companion/routines.py, through call_smart_home).
    The smart-home integration (Home Assistant / MQTT, configured per user in manager-api)
    replaces the no-op default below: either edit this function, or assign another function to
    `hooks.smart_home` at start-up. It may be sync or async (an awaitable result is awaited).

    user:   {"device_id": "<robot mac, lower case>", "owner_name": "<name or ''>"}
    action: the step's free text, e.g. "বসার ঘরের লাইট জ্বালাও" or "light.living_room:on"
    return: a short Bangla sentence TinyBot may speak about the result ("" = say nothing).
    Exceptions are caught and logged by the routine runner; the routine goes on.
"""

import inspect
from typing import Dict

NOT_CONNECTED_BN = "স্মার্ট হোম এখনো যুক্ত করা হয়নি।"


def smart_home(user: Dict, action: str) -> str:
    """No-op default: nothing is connected yet."""
    return NOT_CONNECTED_BN


async def call_smart_home(user: Dict, action: str) -> str:
    """Run the installed smart_home hook (looked up at call time, so a replacement is used)."""
    result = smart_home_impl()(user, action)
    if inspect.isawaitable(result):
        result = await result
    return result if isinstance(result, str) else ""


def smart_home_impl():
    return globals()["smart_home"]
