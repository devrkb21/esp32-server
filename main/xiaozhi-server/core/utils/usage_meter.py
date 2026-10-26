"""Usage metering and the daily LLM quota.

Every connection counts what its robot used, per day and model: LLM requests and tokens (when the
provider reports them), seconds of audio sent to speech recognition and characters sent to speech
synthesis. The counts are kept in one process-wide meter and sent to manager-api in batches
(POST /config/usage/report, authenticated with the server secret), at most once a minute and when
a connection closes. A failed send keeps the rows for the next one.

Quota: manager-api sends the robot owner's daily LLM request limit with the agent config
(`usage: {user_id, llm_daily_limit, llm_used_today}`; limit 0 = unlimited). The meter counts on
from the day's total it was told about and from what it reported itself, so several robots of one
owner on this server share the count. When the limit is reached the robot says QUOTA_LINE instead
of asking the LLM, and the refusal is counted (`quotaBlocked`) so the app can show it.
"""

import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Callable, Dict, List, Optional, Tuple

from loguru import logger

TAG = __name__

# What TinyBot says when today's limit is used up (TinyBot's own words use তুমি)
QUOTA_LINE = "আজকে আমি অনেক কথা বলে ফেলেছি, তাই একটু বিশ্রাম নিচ্ছি। কাল আবার তোমার সাথে গল্প করব, কেমন?"

FLUSH_INTERVAL_S = 60
MAX_PENDING_ROWS = 5000

Key = Tuple[str, str, str, str]  # (date, device_id, model_type, model_id)


def _new_row() -> Dict:
    return {"llmRequests": 0, "promptTokens": 0, "completionTokens": 0, "asrSeconds": 0.0, "ttsChars": 0,
            "quotaBlocked": 0}


class UsageMeter:
    def __init__(self, tz_offset_hours: float = 6, clock: Callable[[], float] = time.time):
        self._lock = threading.Lock()
        self._rows: Dict[Key, Dict] = {}
        self._users: Dict[str, Dict] = {}  # user_id -> {"date": d, "used": n}
        self._clock = clock
        self.tz = timezone(timedelta(hours=float(tz_offset_hours or 0)))
        self._last_flush = clock()
        self._flushing = False

    # --- days ------------------------------------------------------------------------------
    def today(self) -> str:
        return datetime.fromtimestamp(self._clock(), self.tz).date().isoformat()

    def _row(self, device_id: str, model_type: str, model_id: str) -> Dict:
        key = (self.today(), (device_id or "unknown").lower(), model_type, model_id or model_type)
        row = self._rows.get(key)
        if row is None:
            row = self._rows[key] = _new_row()
        return row

    # --- counting --------------------------------------------------------------------------
    def record_llm(self, device_id: str, model_id: str, usage: Optional[Dict] = None, user_id=None):
        with self._lock:
            row = self._row(device_id, "LLM", model_id)
            row["llmRequests"] += 1
            if isinstance(usage, dict):
                row["promptTokens"] += max(0, int(usage.get("prompt_tokens") or 0))
                row["completionTokens"] += max(0, int(usage.get("completion_tokens") or 0))
            if user_id is not None:
                self._user(str(user_id))["used"] += 1

    def record_asr(self, device_id: str, model_id: str, seconds: float, user_id=None):
        if seconds <= 0:
            return
        with self._lock:
            self._row(device_id, "ASR", model_id)["asrSeconds"] += round(float(seconds), 2)

    def record_tts(self, device_id: str, model_id: str, chars: int, user_id=None):
        if chars <= 0:
            return
        with self._lock:
            self._row(device_id, "TTS", model_id)["ttsChars"] += int(chars)

    def record_quota_block(self, device_id: str):
        with self._lock:
            self._row(device_id, "LLM", "quota")["quotaBlocked"] += 1

    # --- quota -----------------------------------------------------------------------------
    def _user(self, user_id: str) -> Dict:
        today = self.today()
        u = self._users.get(user_id)
        if u is None or u["date"] != today:
            u = self._users[user_id] = {"date": today, "used": 0}
        return u

    def set_used_today(self, user_id, used: int):
        """What manager-api says the owner used today (the meter keeps the larger count)."""
        if user_id is None:
            return
        with self._lock:
            u = self._user(str(user_id))
            u["used"] = max(u["used"], int(used or 0))

    def used_today(self, user_id) -> int:
        if user_id is None:
            return 0
        with self._lock:
            return self._user(str(user_id))["used"]

    def over_quota(self, user_id, limit) -> bool:
        try:
            limit = int(limit or 0)
        except (TypeError, ValueError):
            limit = 0
        if user_id is None or limit <= 0:
            return False
        return self.used_today(user_id) >= limit

    # --- reporting -------------------------------------------------------------------------
    def take_rows(self) -> List[Dict]:
        """The pending rows as report items (and forget them)."""
        with self._lock:
            rows, self._rows = self._rows, {}
        out = []
        for (day, device, model_type, model_id), r in rows.items():
            item = {"date": day, "macAddress": device, "modelType": model_type, "modelId": model_id}
            item.update(r)
            item["asrSeconds"] = round(item["asrSeconds"], 2)
            out.append(item)
        return out

    def put_back(self, items: List[Dict]):
        """Rows a failed report could not deliver go back into the next batch."""
        with self._lock:
            for item in items:
                key = (item["date"], item["macAddress"], item["modelType"], item["modelId"])
                row = self._rows.get(key)
                if row is None:
                    if len(self._rows) >= MAX_PENDING_ROWS:
                        continue
                    row = self._rows[key] = _new_row()
                for k in row:
                    row[k] += item.get(k) or 0

    def due(self) -> bool:
        return not self._flushing and self._rows and self._clock() - self._last_flush >= FLUSH_INTERVAL_S

    async def flush(self, send=None) -> bool:
        """Send the pending rows (send: async fn(rows) -> {"users": {id: used}}; default manager-api)."""
        if self._flushing:
            return False
        self._flushing = True
        self._last_flush = self._clock()
        items = self.take_rows()
        try:
            if not items:
                return True
            if send is None:
                from config.manage_api_client import report_usage as send
            answer = await send(items)
            if answer is None:
                raise RuntimeError("usage report was not accepted")
            for uid, used in ((answer or {}).get("users") or {}).items():
                self.set_used_today(uid, used)
            return True
        except Exception as e:
            self.put_back(items)
            logger.bind(tag=TAG).warning(f"Usage report failed, kept {len(items)} rows for later: {e}")
            return False
        finally:
            self._flushing = False

    def maybe_flush(self, loop, force: bool = False):
        """Schedule a flush on the event loop when one is due (or forced), from any thread."""
        if loop is None or self._flushing or not self._rows:
            return
        if not force and not self.due():
            return
        try:
            import asyncio

            asyncio.run_coroutine_threadsafe(self.flush(), loop)
        except Exception as e:
            logger.bind(tag=TAG).debug(f"usage flush not scheduled: {e}")


_meter: Optional[UsageMeter] = None
_meter_lock = threading.Lock()


def get_meter(config: Optional[Dict] = None) -> UsageMeter:
    global _meter
    with _meter_lock:
        if _meter is None:
            tz = ((config or {}).get("server") or {}).get("timezone_offset", 6)
            try:
                tz = float(tz)
            except (TypeError, ValueError):
                tz = 6
            _meter = UsageMeter(tz)
        return _meter


def usage_info(config: Dict) -> Dict:
    """The `usage` block manager-api sends with the agent config, normalized."""
    raw = (config or {}).get("usage") or {}
    if not isinstance(raw, dict):
        raw = {}

    def as_int(v):
        try:
            return max(0, int(v or 0))
        except (TypeError, ValueError):
            return 0

    uid = raw.get("user_id")
    return {
        "user_id": str(uid) if uid not in (None, "") else None,
        "llm_daily_limit": as_int(raw.get("llm_daily_limit")),
        "llm_used_today": as_int(raw.get("llm_used_today")),
    }
