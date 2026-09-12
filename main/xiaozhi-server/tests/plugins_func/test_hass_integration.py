import sys
import os
import asyncio
from pathlib import Path

_SERVER_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVER_ROOT))

import unittest.mock as mock
from unittest.mock import AsyncMock, MagicMock
from plugins_func.functions.hass_init import get_hass_config_dict, append_devices_to_prompt, initialize_hass_handler
from plugins_func.functions.hass_state import handle_hass_set_state, handle_hass_get_state


class DummyDialogue:
    def __init__(self):
        self.messages = []

    def update_system_message(self, prompt):
        self.messages.append(prompt)


class DummyConnection:
    def __init__(self, plugins_config=None, common_plugins=None, funcs=None):
        self.intent_type = "function_call"
        self.load_function_plugin = True
        self.prompt = "You are a helpful assistant."
        self.dialogue = DummyDialogue()
        self.config = {
            "selected_module": {"Intent": "Intent_default"},
            "Intent": {
                "Intent_default": {
                    "functions": funcs or ["hass_get_state", "hass_set_state"]
                }
            },
            "plugins": plugins_config or {}
        }
        self.common_config = {
            "plugins": common_plugins or {}
        }


def test_dynamic_agent_ha_config_resolution():
    # Per-agent config with trailing slash and array devices
    conn = DummyConnection(
        plugins_config={
            "hass_state": {
                "base_url": "http://192.168.1.150:8123/",
                "api_key": "secret_token_123",
                "devices": [
                    "Living Room, Main Light, light.living_room",
                    "Bedroom, Ceiling Fan, fan.bedroom"
                ]
            }
        },
        common_plugins={
            "home_assistant": {
                "base_url": "http://homeassistant.local:8123",
                "api_key": "your_home_assistant_api_token"
            }
        }
    )

    ha_cfg = initialize_hass_handler(conn)
    # Must pick the agent's real credentials and strip trailing slash
    assert ha_cfg["base_url"] == "http://192.168.1.150:8123"
    assert ha_cfg["api_key"] == "secret_token_123"
    assert len(ha_cfg["devices"]) == 2


def test_append_devices_to_prompt_bilingual():
    conn = DummyConnection(
        plugins_config={
            "hass_state": {
                "base_url": "http://192.168.1.150:8123",
                "api_key": "secret_token_123",
                "devices": [
                    "লিভিং রুম, বাতি, light.living_room",
                    "শোবার ঘর, পাখা, fan.bedroom"
                ]
            }
        }
    )

    append_devices_to_prompt(conn)

    assert "Home Assistant Smart Home Devices" in conn.prompt
    assert "বাতি / লাইট / আলো" in conn.prompt
    assert "ফ্যান / পাখা" in conn.prompt
    assert "light.living_room" in conn.prompt
    assert "fan.bedroom" in conn.prompt
    # Must not duplicate if called again
    initial_len = len(conn.prompt)
    append_devices_to_prompt(conn)
    assert len(conn.prompt) == initial_len


async def test_handle_hass_set_state_domains():
    conn = DummyConnection(
        plugins_config={
            "hass_state": {
                "base_url": "http://192.168.1.150:8123",
                "api_key": "secret_token_123"
            }
        }
    )

    mock_response = MagicMock()
    mock_response.status_code = 200

    # 1. Fan percentage
    with mock.patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response
        res = await handle_hass_set_state(
            conn, "fan.bedroom", {"type": "set_percentage", "input": 75}
        )
        assert "75%" in res
        assert "ফ্যানের গতি" in res
        mock_post.assert_called_once()
        call_url = mock_post.call_args[0][0]
        call_json = mock_post.call_args[1]["json"]
        assert call_url == "http://192.168.1.150:8123/api/services/fan/set_percentage"
        assert call_json == {"entity_id": "fan.bedroom", "percentage": 75}

    # 2. Climate temperature
    with mock.patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response
        res = await handle_hass_set_state(
            conn, "climate.living_room", {"type": "set_temperature", "input": 22}
        )
        assert "22" in res
        assert "তাপমাত্রা" in res
        call_url = mock_post.call_args[0][0]
        call_json = mock_post.call_args[1]["json"]
        assert call_url == "http://192.168.1.150:8123/api/services/climate/set_temperature"
        assert call_json == {"entity_id": "climate.living_room", "temperature": 22.0}

    # 3. Lock / Unlock
    with mock.patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response
        res = await handle_hass_set_state(conn, "lock.front_door", {"type": "lock"})
        assert "locked" in res.lower() or "লক" in res
        call_url = mock_post.call_args[0][0]
        assert call_url == "http://192.168.1.150:8123/api/services/lock/lock"

    with mock.patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response
        res = await handle_hass_set_state(conn, "lock.front_door", {"type": "unlock"})
        assert "unlocked" in res.lower() or "আনলক" in res
        call_url = mock_post.call_args[0][0]
        assert call_url == "http://192.168.1.150:8123/api/services/lock/unlock"


async def test_handle_hass_get_state_bilingual():

    conn = DummyConnection(
        plugins_config={
            "hass_state": {
                "base_url": "http://192.168.1.150:8123",
                "api_key": "secret_token_123"
            }
        }
    )

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "state": "on",
        "attributes": {
            "brightness": 204,
            "color_temp_kelvin": 3000
        }
    }

    with mock.patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response
        res = await handle_hass_get_state(conn, "light.living_room")
        assert "চালু" in res
        assert "Brightness: 80%" in res
        assert "উজ্জ্বলতা: 80%" in res


if __name__ == "__main__":
    test_dynamic_agent_ha_config_resolution()
    print("✓ test_dynamic_agent_ha_config_resolution PASSED")
    test_append_devices_to_prompt_bilingual()
    print("✓ test_append_devices_to_prompt_bilingual PASSED")
    asyncio.run(test_handle_hass_set_state_domains())
    print("✓ test_handle_hass_set_state_domains PASSED")
    asyncio.run(test_handle_hass_get_state_bilingual())
    print("✓ test_handle_hass_get_state_bilingual PASSED")
    print("\nALL 4 HOME ASSISTANT INTEGRATION TESTS PASSED!")

