"""Weather and geocoding through Open-Meteo (free, no API key)."""

import asyncio
import time
from typing import Dict, List, Optional

import httpx

from loguru import logger

TAG = __name__

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"

# WMO weather interpretation codes -> (kind, short ASCII text)
WMO_CODES = {
    0: ("clear", "Clear"),
    1: ("partly", "Mostly clear"),
    2: ("partly", "Partly cloudy"),
    3: ("cloudy", "Cloudy"),
    45: ("fog", "Fog"),
    48: ("fog", "Icy fog"),
    51: ("drizzle", "Light drizzle"),
    53: ("drizzle", "Drizzle"),
    55: ("drizzle", "Heavy drizzle"),
    56: ("drizzle", "Icy drizzle"),
    57: ("drizzle", "Icy drizzle"),
    61: ("rain", "Light rain"),
    63: ("rain", "Rain"),
    65: ("rain", "Heavy rain"),
    66: ("rain", "Icy rain"),
    67: ("rain", "Icy rain"),
    71: ("snow", "Light snow"),
    73: ("snow", "Snow"),
    75: ("snow", "Heavy snow"),
    77: ("snow", "Snow grains"),
    80: ("rain", "Showers"),
    81: ("rain", "Showers"),
    82: ("rain", "Heavy showers"),
    85: ("snow", "Snow showers"),
    86: ("snow", "Snow showers"),
    95: ("storm", "Thunderstorm"),
    96: ("storm", "Storm + hail"),
    99: ("storm", "Storm + hail"),
}

# Spoken Bangla words per kind, used for the {weather} placeholder
KIND_BN = {
    "clear": "পরিষ্কার, রোদেলা",
    "partly": "আংশিক মেঘলা",
    "cloudy": "মেঘলা",
    "fog": "কুয়াশাচ্ছন্ন",
    "drizzle": "গুঁড়ি গুঁড়ি বৃষ্টির",
    "rain": "বৃষ্টিমুখর",
    "storm": "ঝড়ো",
    "snow": "তুষারপাতের",
}


def describe_code(code) -> Dict[str, str]:
    try:
        code = int(code)
    except (TypeError, ValueError):
        code = -1
    kind, text = WMO_CODES.get(code, ("cloudy", "Unknown"))
    return {"kind": kind, "text": text}


def _round(v):
    try:
        return int(round(float(v)))
    except (TypeError, ValueError):
        return None


def parse_forecast(data: dict) -> dict:
    cur = data.get("current") or {}
    daily = data.get("daily") or {}

    def first(key):
        values = daily.get(key) or []
        return values[0] if values else None

    code = cur.get("weather_code")
    desc = describe_code(code)
    return {
        "ok": True,
        "temp": _round(cur.get("temperature_2m")),
        "feels": _round(cur.get("apparent_temperature")),
        "hi": _round(first("temperature_2m_max")),
        "lo": _round(first("temperature_2m_min")),
        "humidity": _round(cur.get("relative_humidity_2m")),
        "rain_prob": _round(first("precipitation_probability_max")) or 0,
        "code": int(code) if code is not None else None,
        "kind": desc["kind"],
        "text": desc["text"],
        "is_day": bool(cur.get("is_day", 1)),
        "updated": int(time.time()),
    }


class WeatherService:
    def __init__(self, cache_s: int = 1200, timeout_s: float = 8.0):
        self.cache_s = cache_s
        self.timeout_s = timeout_s
        self.logger = logger
        self._cache: Dict[str, dict] = {}  # key -> {"ts":..., "data":...}
        self._inflight: Dict[str, asyncio.Task] = {}

    @staticmethod
    def _key(lat, lon) -> str:
        return f"{float(lat):.2f},{float(lon):.2f}"

    async def _fetch(self, lat, lon) -> dict:
        params = {
            "latitude": f"{float(lat):.4f}",
            "longitude": f"{float(lon):.4f}",
            "current": "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day",
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
            "timezone": "auto",
            "forecast_days": 1,
        }
        async with httpx.AsyncClient(timeout=self.timeout_s) as client:
            resp = await client.get(FORECAST_URL, params=params)
            resp.raise_for_status()
            return parse_forecast(resp.json())

    async def _refresh(self, key, lat, lon):
        try:
            data = await self._fetch(lat, lon)
            self._cache[key] = {"ts": time.time(), "data": data}
        except Exception as e:
            self.logger.bind(tag=TAG).warning(f"Weather fetch failed for {key}: {e}")
            entry = self._cache.get(key)
            if entry:
                # Retry later than a full cache period, but not immediately
                entry["ts"] = time.time() - self.cache_s + 120
        finally:
            self._inflight.pop(key, None)

    def peek(self, lat, lon) -> Optional[dict]:
        """Return the cached value (possibly stale) and refresh in the background if needed."""
        key = self._key(lat, lon)
        entry = self._cache.get(key)
        if (entry is None or time.time() - entry["ts"] > self.cache_s) and key not in self._inflight:
            try:
                self._inflight[key] = asyncio.get_running_loop().create_task(self._refresh(key, lat, lon))
            except RuntimeError:
                pass
        return dict(entry["data"]) if entry else None

    async def get(self, lat, lon, wait_s: float = 0.0) -> Optional[dict]:
        """Like peek(), but wait up to wait_s for a fetch when nothing is cached yet."""
        data = self.peek(lat, lon)
        if data is None and wait_s > 0:
            task = self._inflight.get(self._key(lat, lon))
            if task:
                try:
                    await asyncio.wait_for(asyncio.shield(task), wait_s)
                except Exception:
                    pass
            data = self.peek(lat, lon)
        return data

    async def geocode(self, query: str, count: int = 8) -> List[dict]:
        params = {"name": query, "count": count, "language": "en", "format": "json"}
        async with httpx.AsyncClient(timeout=self.timeout_s) as client:
            resp = await client.get(GEOCODE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
        results = []
        for r in data.get("results") or []:
            results.append(
                {
                    "name": r.get("name"),
                    "country": r.get("country"),
                    "admin1": r.get("admin1"),
                    "lat": r.get("latitude"),
                    "lon": r.get("longitude"),
                    "timezone": r.get("timezone"),
                }
            )
        return results
