import json
from config.logger import setup_logging
from core.utils.util import check_model_key

TAG = __name__
logger = setup_logging()


def get_hass_config_dict(conn):
    """Dynamically resolve Home Assistant credentials and device list.
    Prioritizes per-agent configuration from API, with fallback to global config.
    """
    plugins_config = getattr(conn, "config", {}).get("plugins", {})
    if not isinstance(plugins_config, dict):
        plugins_config = {}

    ha_config = {}
    candidate_keys = ["hass_state", "home_assistant", "hass_set_state", "hass_get_state"]

    # 1. Check agent-specific / connection-specific plugin configurations
    for key in candidate_keys:
        cfg = plugins_config.get(key)
        if isinstance(cfg, str):
            try:
                cfg = json.loads(cfg)
            except Exception:
                pass
        if isinstance(cfg, dict):
            base_url = cfg.get("base_url")
            api_key = cfg.get("api_key")
            devices = cfg.get("devices")
            if base_url and "your" not in str(api_key).lower() and str(api_key).strip():
                ha_config["base_url"] = str(base_url).rstrip("/")
                ha_config["api_key"] = str(api_key).strip()
                if devices:
                    ha_config["devices"] = devices
                break
            elif devices and not ha_config.get("devices"):
                ha_config["devices"] = devices

    # 2. Fallback to common/global configuration
    common_plugins = getattr(conn, "common_config", {}).get("plugins", {})
    if not isinstance(common_plugins, dict):
        common_plugins = {}

    all_sources = [
        plugins_config.get("hass_state"),
        plugins_config.get("home_assistant"),
        common_plugins.get("hass_state"),
        common_plugins.get("home_assistant"),
    ]

    for source in all_sources:
        if isinstance(source, dict):
            b_url = source.get("base_url")
            a_key = source.get("api_key")
            devs = source.get("devices")
            if b_url and not ha_config.get("base_url"):
                ha_config["base_url"] = str(b_url).rstrip("/")
            if a_key and not ha_config.get("api_key"):
                ha_config["api_key"] = str(a_key).strip()
            if devs and not ha_config.get("devices"):
                ha_config["devices"] = devs

    return ha_config


def append_devices_to_prompt(conn):
    """Append smart home devices and bilingual (Bengali & English) control instructions to LLM system prompt."""
    intent_type = getattr(conn, "intent_type", "")
    load_plugins = getattr(conn, "load_function_plugin", False)

    if intent_type in ["function_call", "intent_llm"] or load_plugins:
        selected_intent = conn.config.get("selected_module", {}).get("Intent", "")
        intent_map = conn.config.get("Intent", {})
        funcs = intent_map.get(selected_intent, {}).get("functions", [])

        # Check if any Home Assistant functions or modules are registered
        has_hass = any(
            f in funcs
            for f in ["hass_get_state", "hass_set_state", "hass_state", "home_assistant"]
        )
        if not has_hass and load_plugins:
            plugins_config = getattr(conn, "config", {}).get("plugins", {})
            has_hass = any(
                k in plugins_config
                for k in ["hass_state", "home_assistant", "hass_get_state", "hass_set_state"]
            )

        if has_hass:
            # Prevent duplicate prompt injection
            if hasattr(conn, "prompt") and conn.prompt and "Home Assistant Smart Home Devices" in conn.prompt:
                return

            ha_config = get_hass_config_dict(conn)
            raw_devices = ha_config.get("devices", "")

            # Normalize device list from string, list, or multiline format
            device_lines = []
            if isinstance(raw_devices, list):
                for d in raw_devices:
                    if d and str(d).strip():
                        device_lines.append(str(d).strip())
            elif isinstance(raw_devices, str):
                items = raw_devices.replace(";", "\n").split("\n")
                for item in items:
                    if item.strip():
                        device_lines.append(item.strip())

            device_list_text = (
                "\n".join(f"- {d}" for d in device_lines)
                if device_lines
                else "- Living Room, Light, switch.living_room\n- Bedroom, Fan, fan.bedroom"
            )

            prompt = f"""
### Home Assistant Smart Home Devices (স্মার্ট হোম ডিভাইস তালিকা)
Controllable devices (Location, Device Name, entity_id):
{device_list_text}

Natural Language Device Control Instructions (বাংলা ও ইংরেজি নির্দেশিকা):
1. The user can control devices or query state in Bengali (বাংলা) or English.
2. Device & Entity Mapping:
   - বাতি / লাইট / আলো -> light or switch domain (e.g. 'turn_on', 'turn_off', 'brightness_value', 'set_color')
   - ফ্যান / পাখা -> fan domain (e.g. 'turn_on', 'turn_off', 'set_percentage', 'speed_up', 'speed_down')
   - এসি / শীতাতপ নিয়ন্ত্রণ / হিটার -> climate domain (e.g. 'turn_on', 'turn_off', 'set_temperature', 'set_hvac_mode')
   - সুইচ / প্লাগ / সকেট -> switch domain (e.g. 'turn_on', 'turn_off', 'toggle')
   - পর্দা / কার্টেন -> cover domain (e.g. 'open_cover', 'close_cover', 'stop_cover')
   - তালা / লক -> lock domain (e.g. 'lock', 'unlock')
   - টিভি / স্পিকার / গান -> media_player domain (e.g. 'volume_up', 'volume_down', 'volume_set', 'volume_mute', 'pause', 'continue')
3. Command Synonyms:
   - জ্বালাও / চালু করো / অন করো / খোলো -> type: 'turn_on' (or 'unlock' for locks)
   - নিভাও / বন্ধ করো / অফ করো / লক করো -> type: 'turn_off' (or 'lock' for locks)
   - আলো বাড়াও / কমাও -> type: 'brightness_up' / 'brightness_down'
   - উজ্জ্বলতা [X]% করো -> type: 'brightness_value' with input: X
   - ফ্যানের স্পিড [X]% করো -> type: 'set_percentage' with input: X
   - তাপমাত্রা [X] ডিগ্রি করো -> type: 'set_temperature' with input: X
   - সাউন্ড / ভলিউম বাড়াও / কমাও / [X]% করো -> type: 'volume_up' / 'volume_down' / 'volume_set'
   - মিউট / আনমিউট করো -> type: 'volume_mute' with is_muted: 'true' / 'false'
   - থামাও / পজ করো -> type: 'pause'
   - আবার চালাও -> type: 'continue'
4. Status queries (যেমন: "লিভিং রুমের লাইট কি অন?", "ফ্যান চলছে কি না?", "ঘরের তাপমাত্রা কত?"):
   - Call `hass_get_state` with matching entity_id.
5. Always respond in the language used by the user (Bengali when spoken in Bengali, English when spoken in English).
"""
            if not hasattr(conn, "prompt") or conn.prompt is None:
                conn.prompt = ""
            conn.prompt += prompt + "\n"

            # Update dialogue system prompt if initialized
            if hasattr(conn, "dialogue") and hasattr(conn.dialogue, "update_system_message"):
                conn.dialogue.update_system_message(conn.prompt)


def initialize_hass_handler(conn):
    """Initialize Home Assistant connection parameters with dynamic agent config resolution."""
    ha_config = get_hass_config_dict(conn)

    # Check API key
    if ha_config.get("api_key"):
        model_key_msg = check_model_key("home_assistant", ha_config.get("api_key"))
        if model_key_msg:
            logger.bind(tag=TAG).error(model_key_msg)

    return ha_config

