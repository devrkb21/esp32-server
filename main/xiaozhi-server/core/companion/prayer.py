"""Islamic prayer times computed locally (no network).

A compact port of the PrayTimes.org v2 algorithm (Hamid Zarrabi-Zadeh, LGPL), limited to what
the companion needs: angle based Fajr/Isha methods, Shafi/Hanafi Asr, minute based Maghrib, and
the "night middle" high latitude adjustment.
"""

import math
from datetime import date, timedelta
from typing import Dict, Optional

# Fajr/Isha angles in degrees; "isha_min" means Isha is a fixed number of minutes after Maghrib.
METHODS = {
    "Karachi": {"fajr": 18.0, "isha": 18.0},  # University of Islamic Sciences, Karachi (Bangladesh)
    "MWL": {"fajr": 18.0, "isha": 17.0},
    "ISNA": {"fajr": 15.0, "isha": 15.0},
    "Egypt": {"fajr": 19.5, "isha": 17.5},
    "Makkah": {"fajr": 18.5, "isha_min": 90},
    "Tehran": {"fajr": 17.7, "isha": 14.0, "maghrib": 4.5},
    "Jafari": {"fajr": 16.0, "isha": 14.0, "maghrib": 4.0},
}
ASR_FACTORS = {"Standard": 1, "Shafi": 1, "Hanafi": 2}

PRAYER_KEYS = ("fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha")

_RISE_SET_ANGLE = 0.833  # refraction + solar disc radius


def _dsin(d):
    return math.sin(math.radians(d))


def _dcos(d):
    return math.cos(math.radians(d))


def _dtan(d):
    return math.tan(math.radians(d))


def _darcsin(x):
    return math.degrees(math.asin(x))


def _darccos(x):
    return math.degrees(math.acos(max(-1.0, min(1.0, x))))


def _darctan2(y, x):
    return math.degrees(math.atan2(y, x))


def _darccot(x):
    return math.degrees(math.atan(1.0 / x))


def _fix(a, b):
    a = a - b * math.floor(a / b)
    return a + b if a < 0 else a


def _julian(year, month, day):
    if month <= 2:
        year -= 1
        month += 12
    a = math.floor(year / 100)
    b = 2 - a + math.floor(a / 4)
    return math.floor(365.25 * (year + 4716)) + math.floor(30.6001 * (month + 1)) + day + b - 1524.5


class PrayTimes:
    def __init__(self, method: str = "Karachi", asr: str = "Hanafi", offsets: Optional[Dict] = None):
        params = METHODS.get(method) or METHODS["Karachi"]
        self.fajr_angle = float(params["fajr"])
        self.isha_angle = params.get("isha")
        self.isha_min = params.get("isha_min")
        self.maghrib_angle = params.get("maghrib")  # None: Maghrib = sunset
        self.asr_factor = ASR_FACTORS.get(asr, 2)
        self.offsets = {k: float(v) for k, v in (offsets or {}).items() if k in PRAYER_KEYS}

    # --- astronomy -------------------------------------------------------------------------
    def _sun_position(self, jd):
        d = jd - 2451545.0
        g = _fix(357.529 + 0.98560028 * d, 360)
        q = _fix(280.459 + 0.98564736 * d, 360)
        L = _fix(q + 1.915 * _dsin(g) + 0.020 * _dsin(2 * g), 360)
        e = 23.439 - 0.00000036 * d
        ra = _fix(_darctan2(_dcos(e) * _dsin(L), _dcos(L)) / 15.0, 24)
        eqt = q / 15.0 - ra
        decl = _darcsin(_dsin(e) * _dsin(L))
        return decl, eqt

    def _mid_day(self, t):
        _, eqt = self._sun_position(self._jdate + t)
        return _fix(12 - eqt, 24)

    def _sun_angle_time(self, angle, t, ccw=False):
        decl, _ = self._sun_position(self._jdate + t)
        noon = self._mid_day(t)
        x = (-_dsin(angle) - _dsin(decl) * _dsin(self._lat)) / (_dcos(decl) * _dcos(self._lat))
        if x < -1 or x > 1:
            return float("nan")
        hours = _darccos(x) / 15.0
        return noon + (-hours if ccw else hours)

    def _asr_time(self, factor, t):
        decl, _ = self._sun_position(self._jdate + t)
        angle = -_darccot(factor + _dtan(abs(self._lat - decl)))
        return self._sun_angle_time(angle, t)

    # --- public ----------------------------------------------------------------------------
    def compute_hours(self, day: date, lat: float, lon: float, tz_hours: float) -> Dict[str, float]:
        """Return prayer times as fractional local hours for the given date."""
        self._lat = float(lat)
        self._lon = float(lon)
        self._jdate = _julian(day.year, day.month, day.day) - self._lon / (15 * 24.0)

        # Initial guesses as day portions, single iteration (as PrayTimes does)
        t = {"fajr": 5, "sunrise": 6, "dhuhr": 12, "asr": 13, "sunset": 18, "maghrib": 18, "isha": 18}
        t = {k: v / 24.0 for k, v in t.items()}
        times = {
            "fajr": self._sun_angle_time(self.fajr_angle, t["fajr"], ccw=True),
            "sunrise": self._sun_angle_time(_RISE_SET_ANGLE, t["sunrise"], ccw=True),
            "dhuhr": self._mid_day(t["dhuhr"]),
            "asr": self._asr_time(self.asr_factor, t["asr"]),
            "sunset": self._sun_angle_time(_RISE_SET_ANGLE, t["sunset"]),
            "maghrib": (
                self._sun_angle_time(self.maghrib_angle, t["maghrib"])
                if self.maghrib_angle is not None
                else None
            ),
            "isha": (
                self._sun_angle_time(self.isha_angle, t["isha"])
                if self.isha_angle is not None
                else None
            ),
        }
        # Convert from UT at the longitude to local time
        shift = tz_hours - self._lon / 15.0
        for k, v in times.items():
            if v is not None:
                times[k] = v + shift
        if times["maghrib"] is None:
            times["maghrib"] = times["sunset"]
        if times["isha"] is None:
            times["isha"] = times["maghrib"] + (self.isha_min or 0) / 60.0

        # High latitude adjustment (night middle): clamp Fajr/Isha to half the night
        night = _fix(times["sunrise"] - times["sunset"], 24)
        portion = night / 2.0
        if math.isnan(times["fajr"]) or _fix(times["sunrise"] - times["fajr"], 24) > portion:
            times["fajr"] = times["sunrise"] - portion
        if math.isnan(times["isha"]) or _fix(times["isha"] - times["sunset"], 24) > portion:
            times["isha"] = times["sunset"] + portion

        for k, v in self.offsets.items():
            times[k] = times[k] + v / 60.0
        return times

    def compute(self, day: date, lat: float, lon: float, tz_hours: float) -> Dict[str, str]:
        hours = self.compute_hours(day, lat, lon, tz_hours)
        out = {"date": day.isoformat()}
        for key in PRAYER_KEYS:
            out[key] = format_hhmm(hours[key])
        return out

    def days(self, start: date, count: int, lat: float, lon: float, tz_hours: float):
        return [self.compute(start + timedelta(days=i), lat, lon, tz_hours) for i in range(count)]


def format_hhmm(hours: float) -> str:
    if hours is None or math.isnan(hours):
        return "--:--"
    minutes = int(math.floor(_fix(hours + 0.5 / 60.0, 24) * 60))
    return f"{minutes // 60:02d}:{minutes % 60:02d}"
