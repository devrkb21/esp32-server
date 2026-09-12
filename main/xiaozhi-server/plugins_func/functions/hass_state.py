import httpx
from config.logger import setup_logging
from plugins_func.functions.hass_init import initialize_hass_handler
from plugins_func.register import register_function, ToolType, ActionResponse, Action
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from core.connection import ConnectionHandler

TAG = __name__
logger = setup_logging()

hass_get_state_function_desc = {
    "type": "function",
    "function": {
        "name": "hass_get_state",
        "description": "Get device state in Home Assistant, including light brightness, fan speed, switch status, climate temperature, door lock status, and media player volume. Supports both Bengali and English queries (যেমন: বাতি, ফ্যান, এসি, লক, সুইচ).",
        "parameters": {
            "type": "object",
            "properties": {
                "entity_id": {
                    "type": "string",
                    "description": "Device ID to query, entity_id in Home Assistant (e.g. light.living_room, fan.bedroom, climate.living_room, switch.plug)",
                }
            },
            "required": ["entity_id"],
        },
    },
}

hass_set_state_function_desc = {
    "type": "function",
    "function": {
        "name": "hass_set_state",
        "description": "Set device state in Home Assistant, including turn on/off, toggle, adjust brightness, fan speed percentage, climate temperature, lock/unlock, media volume, mute, pause, resume. Supports both Bengali and English voice requests.",
        "parameters": {
            "type": "object",
            "properties": {
                "state": {
                    "type": "object",
                    "properties": {
                        "type": {
                            "type": "string",
                            "description": "Action to perform: turn_on, turn_off, toggle, brightness_up, brightness_down, brightness_value, set_percentage, speed_up, speed_down, set_temperature, set_hvac_mode, lock, unlock, volume_up, volume_down, volume_set, set_kelvin, set_color, pause, continue, volume_mute",
                        },
                        "input": {
                            "type": "integer",
                            "description": "Numeric parameter value: 1-100 for brightness, fan speed percentage, or volume; or target temperature in Celsius.",
                        },
                        "temperature": {
                            "type": "number",
                            "description": "Target temperature in Celsius when operating climate/thermostat.",
                        },
                        "hvac_mode": {
                            "type": "string",
                            "description": "HVAC mode for climate/AC: 'cool', 'heat', 'auto', 'off', 'fan_only'.",
                        },
                        "is_muted": {
                            "type": "string",
                            "description": "Required when setting mute operation: 'true' to mute, 'false' to unmute.",
                        },
                        "rgb_color": {
                            "type": "array",
                            "items": {"type": "integer"},
                            "description": "Required when setting color. Target color RGB array [R, G, B].",
                        },
                    },
                    "required": ["type"],
                },
                "entity_id": {
                    "type": "string",
                    "description": "Device ID to operate, entity_id in Home Assistant (e.g. light.living_room, fan.bedroom, climate.ac, lock.front_door)",
                },
            },
            "required": ["state", "entity_id"],
        },
    },
}


@register_function("hass_get_state", hass_get_state_function_desc, ToolType.SYSTEM_CTL)
async def hass_get_state(conn: "ConnectionHandler", entity_id=""):
    try:
        ha_response = await handle_hass_get_state(conn, entity_id)
        return ActionResponse(Action.REQLLM, ha_response, None)
    except httpx.TimeoutException:
        logger.bind(tag=TAG).error("Home Assistant get state timed out")
        return ActionResponse(Action.ERROR, "Request timed out (অনুরোধের সময় শেষ হয়েছে)", None)
    except Exception as e:
        error_msg = f"Failed to execute Home Assistant operation: {e}"
        logger.bind(tag=TAG).error(error_msg)
        return ActionResponse(Action.ERROR, "Failed to execute Home Assistant operation (হোম অ্যাসিস্ট্যান্ট অপারেশন ব্যর্থ হয়েছে)", None)


@register_function("hass_set_state", hass_set_state_function_desc, ToolType.SYSTEM_CTL)
async def hass_set_state(conn: "ConnectionHandler", entity_id="", state=None):
    if state is None:
        state = {}
    try:
        ha_response = await handle_hass_set_state(conn, entity_id, state)
        return ActionResponse(Action.REQLLM, ha_response, None)
    except httpx.TimeoutException:
        logger.bind(tag=TAG).error("Home Assistant set state timed out")
        return ActionResponse(Action.ERROR, "Request timed out (অনুরোধের সময় শেষ হয়েছে)", None)
    except Exception as e:
        error_msg = f"Failed to execute Home Assistant operation: {e}"
        logger.bind(tag=TAG).error(error_msg)
        return ActionResponse(Action.ERROR, "Failed to execute Home Assistant operation (হোম অ্যাসিস্ট্যান্ট অপারেশন ব্যর্থ হয়েছে)", None)


async def handle_hass_get_state(conn: "ConnectionHandler", entity_id):
    ha_config = initialize_hass_handler(conn)
    api_key = ha_config.get("api_key")
    base_url = ha_config.get("base_url")

    if not base_url or not api_key:
        return "Home Assistant is not configured. Please provide server URL and token. (হোম অ্যাসিস্ট্যান্ট কনফিগার করা নেই। দয়া করে সার্ভার URL ও টোকেন প্রদান করুন।)"

    url = f"{base_url}/api/states/{entity_id}"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=3.0)) as client:
        response = await client.get(url, headers=headers)

    if response.status_code == 200:
        data = response.json()
        raw_state = data.get("state", "unknown")
        attrs = data.get("attributes", {})

        # Friendly state mapping
        state_map = {
            "on": "on (চালু)",
            "off": "off (বন্ধ)",
            "locked": "locked (লক করা)",
            "unlocked": "unlocked (আনলক করা)",
            "open": "open (খোলা)",
            "closed": "closed (বন্ধ)",
            "playing": "playing (চলছে)",
            "paused": "paused (থামানো)",
            "idle": "idle (নিষ্ক্রিয়)",
        }
        friendly_state = state_map.get(raw_state, raw_state)
        responsetext = f"Device state: {friendly_state}. "

        if "brightness" in attrs:
            pct = int(attrs["brightness"] / 255 * 100)
            responsetext += f"Brightness: {pct}% (উজ্জ্বলতা: {pct}%). "
        if "percentage" in attrs:
            responsetext += f"Fan speed: {attrs['percentage']}% (ফ্যানের গতি: {attrs['percentage']}%). "
        if "current_temperature" in attrs:
            responsetext += f"Current temperature: {attrs['current_temperature']}°C (বর্তমান তাপমাত্রা: {attrs['current_temperature']}°C). "
        if "temperature" in attrs:
            responsetext += f"Target temperature: {attrs['temperature']}°C (নির্ধারিত তাপমাত্রা: {attrs['temperature']}°C). "
        if "hvac_action" in attrs:
            responsetext += f"Climate status: {attrs['hvac_action']}. "
        if "media_title" in attrs:
            responsetext += f"Now playing: {attrs['media_title']} (বাজছে: {attrs['media_title']}). "
        if "volume_level" in attrs:
            vol_pct = int(float(attrs["volume_level"]) * 100)
            responsetext += f"Volume: {vol_pct}% (ভলিউম: {vol_pct}%). "
        if "color_temp_kelvin" in attrs:
            responsetext += f"Color temperature: {attrs['color_temp_kelvin']}K (রঙ তাপমাত্রা: {attrs['color_temp_kelvin']}K). "
        if "rgb_color" in attrs:
            responsetext += f"RGB color: {attrs['rgb_color']} (আলোর রঙ: {attrs['rgb_color']}). "

        logger.bind(tag=TAG).info(f"Home Assistant query returned: {responsetext}")
        return responsetext
    else:
        return f"Operation failed, error code: {response.status_code} (ডিভাইসের অবস্থা জানা যায়নি, কোড: {response.status_code})"


async def handle_hass_set_state(conn: "ConnectionHandler", entity_id, state):
    ha_config = initialize_hass_handler(conn)
    api_key = ha_config.get("api_key")
    base_url = ha_config.get("base_url")

    if not base_url or not api_key:
        return "Home Assistant is not configured. Please provide server URL and token. (হোম অ্যাসিস্ট্যান্ট কনফিগার করা নেই। দয়া করে সার্ভার URL ও টোকেন প্রদান করুন।)"

    domains = entity_id.split(".")
    if len(domains) > 1:
        domain = domains[0]
    else:
        return "Execution failed, invalid device ID (ত্রুটি: ভুল ডিভাইস আইডি)"

    action = ""
    arg = ""
    value = None
    target_domain = domain

    action_type = state.get("type", "")

    # Domain-specific and generic intent routing
    if action_type == "turn_on":
        if domain == "cover":
            action = "open_cover"
            description = "Cover opened (পর্দা খোলা হয়েছে)"
        elif domain == "vacuum":
            action = "start"
            description = "Vacuum started (ভ্যাকুয়াম চালু করা হয়েছে)"
        elif domain == "lock":
            action = "unlock"
            description = "Door unlocked (দরজা আনলক করা হয়েছে)"
        else:
            action = "turn_on"
            description = "Device turned on (ডিভাইস চালু করা হয়েছে)"

    elif action_type == "turn_off":
        if domain == "cover":
            action = "close_cover"
            description = "Cover closed (পর্দা বন্ধ করা হয়েছে)"
        elif domain == "vacuum":
            action = "stop"
            description = "Vacuum stopped (ভ্যাকুয়াম বন্ধ করা হয়েছে)"
        elif domain == "lock":
            action = "lock"
            description = "Door locked (দরজা লক করা হয়েছে)"
        else:
            action = "turn_off"
            description = "Device turned off (ডিভাইস বন্ধ করা হয়েছে)"

    elif action_type == "toggle":
        action = "toggle"
        description = "Device toggled (ডিভাইসের অবস্থা পরিবর্তন করা হয়েছে)"

    elif action_type == "lock":
        target_domain = "lock"
        action = "lock"
        description = "Door locked (দরজা লক করা হয়েছে)"

    elif action_type == "unlock":
        target_domain = "lock"
        action = "unlock"
        description = "Door unlocked (দরজা আনলক করা হয়েছে)"

    elif action_type == "brightness_up":
        action = "turn_on"
        arg = "brightness_step_pct"
        value = 10
        description = "Light brightened (আলোর উজ্জ্বলতা বাড়ানো হয়েছে)"

    elif action_type == "brightness_down":
        action = "turn_on"
        arg = "brightness_step_pct"
        value = -10
        description = "Light dimmed (আলোর উজ্জ্বলতা কমানো হয়েছে)"

    elif action_type == "brightness_value":
        input_val = int(state.get("input", 50))
        if domain == "fan":
            action = "set_percentage"
            arg = "percentage"
            value = input_val
            description = f"Fan speed set to {input_val}% (ফ্যানের গতি {input_val}% এ সেট করা হয়েছে)"
        elif domain == "climate":
            action = "set_temperature"
            arg = "temperature"
            value = float(input_val)
            description = f"Temperature set to {input_val}°C (তাপমাত্রা {input_val}°C নির্ধারণ করা হয়েছে)"
        else:
            action = "turn_on"
            arg = "brightness_pct"
            value = input_val
            description = f"Brightness adjusted to {input_val}% (উজ্জ্বলতা {input_val}% নির্ধারণ করা হয়েছে)"

    elif action_type == "set_percentage":
        target_domain = "fan"
        action = "set_percentage"
        arg = "percentage"
        value = int(state.get("input", state.get("percentage", 50)))
        description = f"Fan speed set to {value}% (ফ্যানের গতি {value}% নির্ধারণ করা হয়েছে)"

    elif action_type == "speed_up":
        target_domain = "fan"
        action = "increase_speed"
        description = "Fan speed increased (ফ্যানের গতি বাড়ানো হয়েছে)"

    elif action_type == "speed_down":
        target_domain = "fan"
        action = "decrease_speed"
        description = "Fan speed decreased (ফ্যানের গতি কমানো হয়েছে)"

    elif action_type == "set_temperature":
        target_domain = "climate"
        action = "set_temperature"
        arg = "temperature"
        temp_val = state.get("temperature", state.get("input", 24))
        value = float(temp_val)
        description = f"Temperature set to {value}°C (তাপমাত্রা {value}°C নির্ধারণ করা হয়েছে)"

    elif action_type == "set_hvac_mode":
        target_domain = "climate"
        action = "set_hvac_mode"
        arg = "hvac_mode"
        value = state.get("hvac_mode", "cool")
        description = f"HVAC mode set to {value} (এসি মোড {value} নির্ধারণ করা হয়েছে)"

    elif action_type == "set_color":
        action = "turn_on"
        arg = "rgb_color"
        value = state.get("rgb_color", [255, 255, 255])
        description = f"Color adjusted to RGB {value} (আলোর রঙ পরিবর্তন করা হয়েছে)"

    elif action_type == "set_kelvin":
        action = "turn_on"
        arg = "kelvin"
        value = int(state.get("input", 3000))
        description = f"Color temperature adjusted to {value}K (আলোর তাপমাত্রা {value}K নির্ধারণ করা হয়েছে)"

    elif action_type == "volume_up":
        action = "volume_up"
        description = "Volume increased (শব্দ/ভলিউম বাড়ানো হয়েছে)"

    elif action_type == "volume_down":
        action = "volume_down"
        description = "Volume decreased (শব্দ/ভলিউম কমানো হয়েছে)"

    elif action_type == "volume_set":
        action = "volume_set"
        arg = "volume_level"
        raw_vol = float(state.get("input", 50))
        value = raw_vol / 100.0 if raw_vol >= 1.0 else raw_vol
        description = f"Volume adjusted to {int(raw_vol)}% (ভলিউম {int(raw_vol)}% নির্ধারণ করা হয়েছে)"

    elif action_type == "volume_mute":
        action = "volume_mute"
        arg = "is_volume_muted"
        is_muted = str(state.get("is_muted", "true")).lower() == "true"
        value = is_muted
        description = "Device muted (শব্দ বন্ধ/মিউট করা হয়েছে)" if is_muted else "Device unmuted (শব্দ চালু/আনমিউট করা হয়েছে)"

    elif action_type == "pause":
        if domain == "media_player":
            action = "media_pause"
        elif domain == "cover":
            action = "stop_cover"
        elif domain == "vacuum":
            action = "pause"
        else:
            action = "turn_off"
        description = "Device paused (থামানো হয়েছে)"

    elif action_type == "continue":
        if domain == "media_player":
            action = "media_play"
        elif domain == "vacuum":
            action = "start"
        else:
            action = "turn_on"
        description = "Device resumed (চালু করা হয়েছে)"

    else:
        return f"{domain} {action_type} feature is not yet supported ({domain} এ {action_type} সমর্থন নেই)"

    # Build payload
    data = {"entity_id": entity_id}
    if arg and value is not None:
        data[arg] = value

    url = f"{base_url}/api/services/{target_domain}/{action}"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=3.0)) as client:
        response = await client.post(url, headers=headers, json=data)

    logger.bind(tag=TAG).info(
        f"Home Assistant set state: {description}, URL: {url}, return_code: {response.status_code}"
    )
    if response.status_code == 200:
        return description
    else:
        return f"Failed to set state, error code: {response.status_code} (ডিভাইস নিয়ন্ত্রণ ব্যর্থ হয়েছে, কোড: {response.status_code})"

