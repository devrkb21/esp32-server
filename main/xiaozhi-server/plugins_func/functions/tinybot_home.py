"""TinyBot voice tools for the smart home and robot-to-robot messages.

smart_home_control: "বসার ঘরের লাইট বন্ধ করো", "ফ্যান চালাও", "এসি ২৪ ডিগ্রি" (Home Assistant or
MQTT devices the owner set up in the app's স্মার্ট হোম page).
robot_send_message: "বাবার রোবটকে বলো আমি আসছি" (the owner's other robots and accepted contacts).
Both answer with TinyBot's own Bangla line (direct response). Logic: core/companion/home_tools.py.
"""

from typing import TYPE_CHECKING

from plugins_func.register import register_function, ToolType, ActionResponse, Action
from core.companion import home_tools

if TYPE_CHECKING:
    from core.connection import ConnectionHandler

TAG = __name__

smart_home_control_desc = {
    "type": "function",
    "function": {
        "name": "smart_home_control",
        "description": (
            "Turn a smart home device on or off, open or close it, or set an air conditioner's "
            "temperature: lights, fans, switches, AC, curtains. Use for requests like "
            "'বসার ঘরের লাইট বন্ধ করো', 'ফ্যান চালাও', 'এসি ২৪ ডিগ্রি', 'turn off the bedroom light'."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "device": {
                    "type": "string",
                    "description": "The device exactly as the user named it, in the user's words and language, e.g. 'বসার ঘরের লাইট', 'ফ্যান', 'এসি'",
                },
                "action": {
                    "type": "string",
                    "enum": ["on", "off", "toggle", "open", "close", "stop", "set_temperature", "set_brightness", "set_speed"],
                    "description": "on (চালাও, জ্বালাও, চালু), off (বন্ধ, নিভাও), open/close for curtains, set_temperature for 'এসি ২৪ ডিগ্রি'",
                },
                "value": {
                    "type": "number",
                    "description": "Degrees for set_temperature (e.g. 24), percent for set_brightness / set_speed",
                },
            },
            "required": ["device", "action"],
        },
    },
}

robot_send_message_desc = {
    "type": "function",
    "function": {
        "name": "robot_send_message",
        "description": (
            "Send a spoken message to another TinyBot robot: the user's other robots or family "
            "robots added as contacts. Use for 'বাবার রোবটকে বলো আমি আসছি', 'আম্মুকে বলো খাবার তৈরি', "
            "'tell grandma's robot I miss her'. The other robot speaks the message aloud."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "to": {
                    "type": "string",
                    "description": "The robot or person as the user named it, in the user's words, e.g. 'বাবার রোবট', 'আম্মু'",
                },
                "text": {
                    "type": "string",
                    "description": "The message to deliver, in the user's language and words, without 'বলো'/'tell', e.g. 'আমি আসছি'",
                },
            },
            "required": ["to", "text"],
        },
    },
}


def _mac(conn) -> str:
    return home_tools.mac_of(conn)


@register_function("smart_home_control", smart_home_control_desc, ToolType.SYSTEM_CTL)
async def smart_home_control(conn: "ConnectionHandler", device: str = "", action: str = "", value=None):
    result = await home_tools.control(_mac(conn), device=device, action=action, value=value, command=device)
    return ActionResponse(Action.RESPONSE, result.get("code"), result.get("say"))


@register_function("robot_send_message", robot_send_message_desc, ToolType.SYSTEM_CTL)
async def robot_send_message(conn: "ConnectionHandler", to: str = "", text: str = ""):
    result = await home_tools.send_robot_message(_mac(conn), to=to, text=text)
    return ActionResponse(Action.RESPONSE, result.get("code"), result.get("say"))
