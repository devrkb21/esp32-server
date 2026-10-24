"""aiohttp handlers for the companion API (/companion/v1/...), used by the robot and by
manager-api (which serves manager-web and manager-mobile)."""

import hmac
import json
import os
import re
import time
from typing import Optional

from aiohttp import web
from loguru import logger

from core.api.base_handler import BaseHandler
from core.companion import get_service, schema

TAG = __name__

API = "/companion/v1"
DEVICE_ID_RE = re.compile(r"^[0-9a-z:._-]{1,64}$")
MAX_BODY = 64 * 1024
ALLOWED_METHODS = "GET, POST, PUT, DELETE, OPTIONS"


def _app(handler):
    """Decorator for token protected app endpoints with uniform error handling."""

    async def wrapper(self, request):
        if not self._authorized(request):
            return self._error(401, "unauthorized")
        try:
            return await handler(self, request)
        except schema.ValidationError as e:
            return self._error(400, str(e))
        except KeyError:
            return self._error(404, "device not found")
        except web.HTTPException as e:
            return self._error(e.status, e.reason)
        except Exception as e:
            self.logger.bind(tag=TAG).exception(f"Companion API error: {e}")
            return self._error(500, "internal error")

    return wrapper


class CompanionHandler(BaseHandler):
    def __init__(self, config: dict, service=None):
        # BaseHandler.__init__ is skipped on purpose: its setup_logging() would load the config
        # again, the server has already configured loguru
        self.config = config
        self.logger = logger
        self.service = service or get_service(config)

    # --- plumbing --------------------------------------------------------------------------
    def _add_cors_headers(self, response):
        super()._add_cors_headers(response)
        response.headers["Access-Control-Allow-Methods"] = ALLOWED_METHODS

    def _json(self, data, status: int = 200) -> web.Response:
        resp = web.json_response(data, status=status, dumps=lambda o: json.dumps(o, ensure_ascii=False))
        resp.headers["Cache-Control"] = "no-store"
        self._add_cors_headers(resp)
        return resp

    def _error(self, status: int, message: str) -> web.Response:
        return self._json({"ok": False, "error": message}, status=status)

    async def handle_options(self, request):
        response = web.Response(body=b"", content_type="text/plain")
        self._add_cors_headers(response)
        return response

    def _authorized(self, request) -> bool:
        tokens = self.service.app_tokens
        if not tokens:
            return True
        header = request.headers.get("Authorization", "")
        if not header.lower().startswith("bearer "):
            return False
        given = header[7:].strip().encode("utf-8")
        return any(hmac.compare_digest(given, t.encode("utf-8")) for t in tokens)

    async def _body(self, request) -> Optional[dict]:
        if request.content_length is not None and request.content_length > MAX_BODY:
            raise web.HTTPRequestEntityTooLarge(max_size=MAX_BODY, actual_size=request.content_length)
        raw = await request.read()
        if len(raw) > MAX_BODY:
            raise web.HTTPRequestEntityTooLarge(max_size=MAX_BODY, actual_size=len(raw))
        if not raw.strip():
            return {}
        try:
            return json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise schema.ValidationError("invalid JSON body")

    @staticmethod
    def _device_id(value: str) -> Optional[str]:
        value = (value or "").strip().lower()
        return value if DEVICE_ID_RE.match(value) else None

    def _dev_from_path(self, request):
        dev_id = self._device_id(request.match_info.get("device_id", ""))
        dev = self.service.store.get(dev_id) if dev_id else None
        if dev is None:
            raise KeyError(dev_id)
        return dev

    # --- device endpoints ------------------------------------------------------------------
    async def device_sync(self, request):
        dev_id = self._device_id(request.headers.get("Device-Id", ""))
        if not dev_id:
            return self._error(400, "missing or invalid Device-Id header")
        try:
            snap = await self.service.sync(
                dev_id, request.headers.get("Client-Id", ""), request.headers.get("User-Agent", "")
            )
        except Exception as e:
            self.logger.bind(tag=TAG).exception(f"Companion sync failed: {e}")
            return self._error(500, "internal error")
        return self._json(snap)

    async def device_report(self, request):
        dev_id = self._device_id(request.headers.get("Device-Id", ""))
        if not dev_id:
            return self._error(400, "missing or invalid Device-Id header")
        try:
            body = await self._body(request)
            return self._json(await self.service.report(dev_id, body))
        except schema.ValidationError as e:
            return self._error(400, str(e))
        except web.HTTPException as e:
            return self._error(e.status, e.reason)
        except Exception as e:
            self.logger.bind(tag=TAG).exception(f"Companion report failed: {e}")
            return self._error(500, "internal error")

    async def audio(self, request):
        filename = request.match_info.get("filename", "")
        name = filename[:-4] if filename.endswith(".ogg") else ""
        path = self.service.audio.path_for(name)
        if not path or not os.path.isfile(path):
            return self._error(404, "audio not found")
        resp = web.FileResponse(path, headers={"Content-Type": "audio/ogg", "Cache-Control": "public, max-age=31536000, immutable"})
        self._add_cors_headers(resp)
        return resp

    # --- app endpoints ---------------------------------------------------------------------
    @_app
    async def list_devices(self, request):
        return self._json({"devices": self.service.list_devices(), "server_time": _now()})

    @_app
    async def get_device(self, request):
        return self._json(self.service.device_detail(self._dev_from_path(request)))

    @_app
    async def delete_device(self, request):
        dev = self._dev_from_path(request)
        await self.service.store.delete(dev["id"])
        return self._json({"ok": True})

    @_app
    async def put_config(self, request):
        dev = self._dev_from_path(request)
        body = await self._body(request)
        updated = await self.service.update_config(dev["id"], body)
        return self._json(self.service.device_detail(updated))

    @_app
    async def post_message(self, request):
        dev = self._dev_from_path(request)
        body = await self._body(request)
        return self._json(await self.service.send_message(dev["id"], body))

    @_app
    async def get_messages(self, request):
        dev = self._dev_from_path(request)
        msgs = [self.service.message_view(m) for m in reversed(dev.get("messages", []))]
        return self._json({"messages": msgs})

    @_app
    async def post_command(self, request):
        dev = self._dev_from_path(request)
        body = await self._body(request)
        return self._json(await self.service.send_command(dev["id"], body))

    @_app
    async def get_events(self, request):
        dev = self._dev_from_path(request)
        try:
            limit = max(1, min(200, int(request.query.get("limit", 50))))
        except ValueError:
            raise schema.ValidationError("limit must be a number")
        return self._json({"events": list(reversed(dev.get("events", [])[-limit:]))})

    @_app
    async def geocode(self, request):
        q = (request.query.get("q") or "").strip()
        if len(q) < 2 or len(q) > 64:
            raise schema.ValidationError("q must be 2-64 characters")
        try:
            results = await self.service.weather.geocode(q)
        except Exception as e:
            self.logger.bind(tag=TAG).warning(f"Geocoding failed: {e}")
            return self._error(502, "geocoding service unavailable")
        return self._json({"results": results})

    # --- routes ----------------------------------------------------------------------------
    def routes(self):
        return [
            web.get(f"{API}/device/sync", self.device_sync),
            web.post(f"{API}/device/report", self.device_report),
            web.get(f"{API}/devices", self.list_devices),
            web.get(f"{API}/devices/{{device_id}}", self.get_device),
            web.delete(f"{API}/devices/{{device_id}}", self.delete_device),
            web.put(f"{API}/devices/{{device_id}}/config", self.put_config),
            web.post(f"{API}/devices/{{device_id}}/messages", self.post_message),
            web.get(f"{API}/devices/{{device_id}}/messages", self.get_messages),
            web.post(f"{API}/devices/{{device_id}}/commands", self.post_command),
            web.get(f"{API}/devices/{{device_id}}/events", self.get_events),
            web.get(f"{API}/geocode", self.geocode),
            web.get(f"{API}/audio/{{filename}}", self.audio),
            web.options(API + "/{tail:.*}", self.handle_options),
        ]


def _now() -> int:
    return int(time.time())
