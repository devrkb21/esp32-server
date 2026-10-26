"""manager-api calls of the smart-home and robot-message voice tools.

The secrets (Home Assistant token, MQTT password) live in manager-api only; this server asks it,
with the shared server secret (ManageApiClient), for the robot owner's device list and contacts,
and asks it to run an action or deliver a message. Every answer is {ok, code, ...}.
"""

from typing import Dict, Optional


class HomeApiUnavailable(Exception):
    """manager-api is not configured on this server (standalone mode) or did not answer."""


class ManagerHomeApi:
    """The real client; tests pass a fake with the same four coroutines."""

    async def _post(self, endpoint: str, payload: Dict) -> Dict:
        try:
            from config.manage_api_client import ManageApiClient
        except Exception as e:  # pragma: no cover - import guard for stripped installs
            raise HomeApiUnavailable(str(e))
        instance = ManageApiClient._get_instance()
        if instance is None:
            raise HomeApiUnavailable("manager-api is not configured")
        try:
            data = await instance._execute_async_request("POST", endpoint, json=payload)
        except Exception as e:
            raise HomeApiUnavailable(str(e))
        return data if isinstance(data, dict) else {"ok": False, "code": "error"}

    async def home_devices(self, mac: str) -> Dict:
        return await self._post("/config/home/devices", {"mac": mac})

    async def home_action(self, mac: str, device_id: str, action: str, value: Optional[float] = None) -> Dict:
        body = {"mac": mac, "deviceId": str(device_id), "action": action}
        if value is not None:
            body["value"] = value
        return await self._post("/config/home/action", body)

    async def contact_targets(self, mac: str) -> Dict:
        return await self._post("/config/contacts/targets", {"mac": mac})

    async def contact_send(self, mac: str, target: str, text: str) -> Dict:
        return await self._post("/config/contacts/send", {"mac": mac, "target": target, "text": text})


_api = None


def get_api():
    global _api
    if _api is None:
        _api = ManagerHomeApi()
    return _api


def set_api(api) -> None:
    """Install a fake (tests) or None to go back to the real client."""
    global _api
    _api = api
