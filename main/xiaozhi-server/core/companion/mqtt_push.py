"""Push companion updates to robots through the xiaozhi MQTT gateway.

The gateway's management API (`server.mqtt_manager_api`, port 8007) forwards an MCP `tools/call`
to a connected robot over MQTT and returns its answer. The robot registers two user-only tools
(firmware companion_cloud.cc): `self.companion.command` {id, type, arg} runs a command at once,
and `self.companion.sync` makes it fetch the snapshot (config, messages) over HTTP right away.
Everything else (the snapshot itself, reports) stays on HTTP; the MQTT payload limit is 8 KB.
"""

import hashlib
from datetime import date, timedelta
from typing import Dict, Iterable, List, Optional

import aiohttp

from loguru import logger

TAG = __name__

CALL_TIMEOUT_S = 8


class MqttPush:
    def __init__(self, api_url: str, signature_key: str):
        self.api_url = api_url.rstrip("/")
        self.signature_key = signature_key

    @classmethod
    def from_config(cls, cfg: Dict) -> Optional["MqttPush"]:
        api = str(cfg.get("mqtt_api") or "").strip()
        key = str(cfg.get("mqtt_signature_key") or "").strip()
        if not api or not key or api.lower() == "null" or key.lower() == "null":
            return None
        if not api.startswith("http"):
            api = "http://" + api
        return cls(api, key)

    def _token(self, day: date) -> str:
        # The gateway accepts sha256("<YYYY-MM-DD><signature key>") for its local date
        return hashlib.sha256((day.isoformat() + self.signature_key).encode("utf-8")).hexdigest()

    async def _post(self, path: str, body: Dict) -> Dict:
        today = date.today()
        timeout = aiohttp.ClientTimeout(total=CALL_TIMEOUT_S)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            # Around midnight the gateway's date may differ from ours by a day
            for day in (today, today - timedelta(days=1), today + timedelta(days=1)):
                headers = {"Authorization": "Bearer " + self._token(day)}
                async with session.post(self.api_url + path, json=body, headers=headers) as resp:
                    if resp.status == 401:
                        continue
                    data = await resp.json(content_type=None)
                    if resp.status != 200 or not isinstance(data, dict):
                        raise RuntimeError(f"gateway HTTP {resp.status}: {str(data)[:120]}")
                    return data
        raise RuntimeError("gateway rejected the signature key")

    async def online(self, client_ids: Iterable[str]) -> Dict[str, bool]:
        ids: List[str] = [c for c in client_ids if c]
        if not ids:
            return {}
        data = await self._post("/api/devices/status", {"clientIds": ids})
        out = {}
        for cid, state in (data.get("data") or data).items():
            if isinstance(state, dict):
                # "exists": connected over MQTT ("isAlive" only means a voice session is open)
                out[cid] = bool(state.get("exists"))
            else:
                out[cid] = bool(state)
        return out

    async def call(self, client_id: str, tool: str, arguments: Optional[Dict] = None) -> Dict:
        """Call an MCP tool on the robot; raises when it is not connected or the tool failed."""
        payload = {
            "type": "mcp",
            "payload": {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {"name": tool, "arguments": arguments or {}},
            },
        }
        data = await self._post("/api/commands/" + client_id, payload)
        result = data.get("data") or {}
        if not data.get("success") or (isinstance(result, dict) and result.get("isError")):
            raise RuntimeError(f"{tool} failed: {str(data)[:160]}")
        return result
