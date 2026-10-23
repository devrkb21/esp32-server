"""TinyBot companion voice tools: alarms, reminders, focus timer and prayer times.

They act on the companion config of the robot that is talking (its Device-Id); changes reach
the robot on its next companion sync. The logic lives in core/companion/voice_tools.py.
"""

from typing import TYPE_CHECKING

from plugins_func.register import register_function, ToolType, ActionResponse, Action
from core.companion import voice_tools

if TYPE_CHECKING:
    from core.connection import ConnectionHandler

TAG = __name__

_TIME_DESC = "Time of day, 24 h HH:MM (e.g. 06:30 or 21:00). Convert spoken times to 24 h, e.g. 7 in the evening -> 19:00."

companion_set_alarm_desc = {
    "type": "function",
    "function": {
        "name": "companion_set_alarm",
        "description": "Set an alarm on this robot. Use when the user asks to wake them up or ring at a time.",
        "parameters": {
            "type": "object",
            "properties": {
                "time": {"type": "string", "description": _TIME_DESC},
                "days": {
                    "type": "string",
                    "description": "every_day (default), weekdays (Sun-Thu), weekend (Fri-Sat), or comma separated English day names, e.g. 'monday,wednesday'",
                },
                "label": {"type": "string", "description": "Short English label shown on screen, max 24 ASCII characters, e.g. 'Wake up'"},
                "say": {"type": "string", "description": "Optional sentence the robot speaks when the alarm rings, in the user's language"},
            },
            "required": ["time"],
        },
    },
}

companion_list_alarms_desc = {
    "type": "function",
    "function": {
        "name": "companion_list_alarms",
        "description": "List the alarms and reminders set on this robot.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
}

companion_delete_alarm_desc = {
    "type": "function",
    "function": {
        "name": "companion_delete_alarm",
        "description": "Delete an alarm on this robot by its time (or delete all alarms when all is true).",
        "parameters": {
            "type": "object",
            "properties": {
                "time": {"type": "string", "description": "Alarm time HH:MM to delete"},
                "all": {"type": "boolean", "description": "true to delete every alarm"},
            },
            "required": [],
        },
    },
}

companion_add_reminder_desc = {
    "type": "function",
    "function": {
        "name": "companion_add_reminder",
        "description": (
            "Add a reminder on this robot: drink water every N minutes, take medicine at a time, "
            "or a custom daily reminder at a time."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "kind": {"type": "string", "enum": ["water", "medicine", "custom"], "description": "Reminder kind"},
                "time": {"type": "string", "description": "For medicine/custom: " + _TIME_DESC},
                "every_min": {"type": "integer", "description": "For water: interval in minutes (default 60)"},
                "label": {"type": "string", "description": "Short English label shown on screen, max 24 ASCII characters"},
                "say": {"type": "string", "description": "Sentence the robot speaks, in the user's language"},
            },
            "required": ["kind"],
        },
    },
}

companion_start_focus_desc = {
    "type": "function",
    "function": {
        "name": "companion_start_focus",
        "description": "Start a focus (pomodoro) timer on this robot now, e.g. for study or work.",
        "parameters": {
            "type": "object",
            "properties": {
                "minutes": {"type": "integer", "description": "Work minutes (default: the robot's pomodoro setting)"},
            },
            "required": [],
        },
    },
}

companion_prayer_times_desc = {
    "type": "function",
    "function": {
        "name": "companion_prayer_times",
        "description": "Tell today's Islamic prayer times (Fajr, Dhuhr, Asr, Maghrib, Isha) for this robot's city.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
}


def _reply(text: str) -> ActionResponse:
    return ActionResponse(Action.REQLLM, text, None)


@register_function("companion_set_alarm", companion_set_alarm_desc, ToolType.SYSTEM_CTL)
async def companion_set_alarm(conn: "ConnectionHandler", time: str = "", days: str = "", label: str = "", say: str = ""):
    return _reply(await voice_tools.set_alarm(conn, time, days, label, say))


@register_function("companion_list_alarms", companion_list_alarms_desc, ToolType.SYSTEM_CTL)
async def companion_list_alarms(conn: "ConnectionHandler"):
    return _reply(await voice_tools.list_alarms(conn))


@register_function("companion_delete_alarm", companion_delete_alarm_desc, ToolType.SYSTEM_CTL)
async def companion_delete_alarm(conn: "ConnectionHandler", time: str = "", all: bool = False):
    return _reply(await voice_tools.delete_alarm(conn, time, bool(all)))


@register_function("companion_add_reminder", companion_add_reminder_desc, ToolType.SYSTEM_CTL)
async def companion_add_reminder(conn: "ConnectionHandler", kind: str = "custom", time: str = "",
                                 every_min: int = None, label: str = "", say: str = ""):
    return _reply(await voice_tools.add_reminder(conn, kind, time, every_min, label, say))


@register_function("companion_start_focus", companion_start_focus_desc, ToolType.SYSTEM_CTL)
async def companion_start_focus(conn: "ConnectionHandler", minutes: int = None):
    return _reply(await voice_tools.start_focus(conn, minutes))


@register_function("companion_prayer_times", companion_prayer_times_desc, ToolType.SYSTEM_CTL)
async def companion_prayer_times(conn: "ConnectionHandler"):
    return _reply(await voice_tools.prayer_times(conn))
