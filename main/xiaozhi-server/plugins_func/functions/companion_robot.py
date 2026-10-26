"""TinyBot companion voice tools: alarms, reminders, timers, focus timer, prayer times,
routines and the library (stories, rhymes, music, recitations).

They act on the companion config of the robot that is talking (its Device-Id); changes reach
the robot on its next companion sync. The logic lives in core/companion/voice_tools.py.
"""

from typing import TYPE_CHECKING

from plugins_func.register import register_function, ToolType, ActionResponse, Action
from core.companion import voice_tools

if TYPE_CHECKING:
    from core.connection import ConnectionHandler

TAG = __name__

_TIME_DESC = (
    "Time of day: 24 h HH:MM (e.g. 06:30 or 21:00), or the user's own words in Bangla, e.g. "
    "'সকাল সাড়ে সাতটা', 'পৌনে নটা', 'রাত ১০টা' (the server understands them). Add "
    "'tomorrow' / 'আগামীকাল' when the user says tomorrow."
)
_AFTER_DESC = (
    "How long from now, as the user said it, e.g. '১০ মিনিট', 'আধা ঘণ্টা', 'দেড় ঘণ্টা', "
    "'2 hours 15 minutes' or a number of minutes"
)

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
                    "description": "every_day (default), weekdays (Sun-Thu), weekend (Fri-Sat), once (only the next time), or comma separated English day names, e.g. 'monday,wednesday'",
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
        "description": "List the alarms, reminders and timers set on this robot (e.g. 'সব অ্যালার্ম বলো').",
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
            "or a custom reminder at a time (daily, or once). For 'in 10 minutes' use companion_set_timer."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "kind": {"type": "string", "enum": ["water", "medicine", "custom"], "description": "Reminder kind"},
                "time": {"type": "string", "description": "For medicine/custom: " + _TIME_DESC},
                "every_min": {"type": "integer", "description": "For water: interval in minutes (default 60)"},
                "label": {"type": "string", "description": "Short English label shown on screen, max 24 ASCII characters"},
                "say": {"type": "string", "description": "Sentence the robot speaks, in the user's language"},
                "once": {"type": "boolean", "description": "true: only the next time (not every day)"},
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


companion_set_timer_desc = {
    "type": "function",
    "function": {
        "name": "companion_set_timer",
        "description": (
            "Remind the user once after some time: '১০ মিনিট পরে মনে করিয়ে দিও ওষুধ খেতে', "
            "'set a timer for half an hour'. The robot speaks the reminder when the time is up."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "after": {"type": "string", "description": _AFTER_DESC},
                "what": {"type": "string", "description": "What to remind about, in the user's language, e.g. 'ওষুধ খাও'"},
                "kind": {"type": "string", "enum": ["medicine", "water", "custom"],
                         "description": "medicine, water or custom (default: guessed from what)"},
                "label": {"type": "string", "description": "Short English label for the screen, max 24 ASCII characters"},
                "say": {"type": "string", "description": "Optional full sentence the robot speaks when it rings, in the user's language"},
            },
            "required": ["after"],
        },
    },
}

companion_cancel_reminder_desc = {
    "type": "function",
    "function": {
        "name": "companion_cancel_reminder",
        "description": "Cancel reminders or timers on this robot by their time, by what they are about, or all of them.",
        "parameters": {
            "type": "object",
            "properties": {
                "time": {"type": "string", "description": "The reminder's time: " + _TIME_DESC},
                "what": {"type": "string", "description": "Words of what it is about, e.g. 'ওষুধ', 'medicine'"},
                "all": {"type": "boolean", "description": "true to cancel every reminder and timer"},
                "timers_only": {"type": "boolean", "description": "true to touch only one-time timers"},
            },
            "required": [],
        },
    },
}

companion_run_routine_desc = {
    "type": "function",
    "function": {
        "name": "companion_run_routine",
        "description": (
            "Run one of the user's routines (a set of steps like a greeting, the weather, prayer "
            "times, playing something), e.g. 'সকালের রুটিন চালাও', 'run my bedtime routine'."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "The routine's name as the user said it, e.g. 'সকালের রুটিন'"},
            },
            "required": ["name"],
        },
    },
}

companion_play_library_desc = {
    "type": "function",
    "function": {
        "name": "companion_play_library",
        "description": (
            "Play or tell something from the robot's library: a story, a rhyme, music or a "
            "recitation, e.g. 'একটা ছড়া শোনাও', 'গল্প শোনাও', 'play the song I added'. Use this "
            "before making up a story yourself."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "kind": {"type": "string", "enum": ["story", "rhyme", "music", "recitation"], "description": "What kind (empty: any)"},
                "title": {"type": "string", "description": "Words of the title when the user names one"},
            },
            "required": [],
        },
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
                                 every_min: int = None, label: str = "", say: str = "", once: bool = False):
    return _reply(await voice_tools.add_reminder(conn, kind, time, every_min, label, say, once=bool(once)))


@register_function("companion_set_timer", companion_set_timer_desc, ToolType.SYSTEM_CTL)
async def companion_set_timer(conn: "ConnectionHandler", after: str = "", what: str = "", kind: str = "",
                              label: str = "", say: str = ""):
    return _reply(await voice_tools.set_timer(conn, after, what, kind, label, say))


@register_function("companion_cancel_reminder", companion_cancel_reminder_desc, ToolType.SYSTEM_CTL)
async def companion_cancel_reminder(conn: "ConnectionHandler", time: str = "", what: str = "", all: bool = False,
                                    timers_only: bool = False):
    return _reply(await voice_tools.cancel_reminder(conn, time, what, bool(all), bool(timers_only)))


@register_function("companion_run_routine", companion_run_routine_desc, ToolType.SYSTEM_CTL)
async def companion_run_routine(conn: "ConnectionHandler", name: str = ""):
    return _reply(await voice_tools.run_routine(conn, name))


@register_function("companion_play_library", companion_play_library_desc, ToolType.SYSTEM_CTL)
async def companion_play_library(conn: "ConnectionHandler", kind: str = "", title: str = ""):
    return _reply(await voice_tools.play_library(conn, kind, title))


@register_function("companion_start_focus", companion_start_focus_desc, ToolType.SYSTEM_CTL)
async def companion_start_focus(conn: "ConnectionHandler", minutes: int = None):
    return _reply(await voice_tools.start_focus(conn, minutes))


@register_function("companion_prayer_times", companion_prayer_times_desc, ToolType.SYSTEM_CTL)
async def companion_prayer_times(conn: "ConnectionHandler"):
    return _reply(await voice_tools.prayer_times(conn))
