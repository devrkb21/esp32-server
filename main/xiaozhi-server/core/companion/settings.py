"""Companion configuration: the `companion:` block merged over built-in defaults.

With manager-api the server config comes from the API and has no `companion:` block, so the
block (and server.timezone_offset) is then read from the local config files instead.
"""

import os
from typing import Dict

import yaml

DEFAULT_STORY_TOPICS = [
    "একটি সাহসী ছোট্ট বিড়ালছানা",
    "চাঁদে বেড়াতে যাওয়া খরগোশ",
    "সুন্দরবনের বাঘ মামা আর তার বন্ধুরা",
    "হাতি আর পিঁপড়ার বন্ধুত্ব",
    "রংধনুর সাত রঙের রহস্য",
    "পদ্মা নদীর ছোট্ট ইলিশ মাছ",
    "জাদুর বাঁশিওয়ালা রাখাল ছেলে",
    "মেঘের দেশে ঘুরতে যাওয়া",
    "দয়ালু কাঠুরিয়া আর সোনার কুড়াল",
    "সত্যি কথা বলার পুরস্কার",
    "ছোট্ট রোবট টাইনিবটের অভিযান",
    "দাদুর বাগানের আম গাছ",
    "তারার দেশের ছোট্ট পরী",
    "অন্ধকারে ভয় পাওয়া জোনাকি পোকা",
    "চড়ুই পাখির নতুন বাসা",
]

DEFAULTS = {
    "enabled": True,
    "app_token": "",
    "data_dir": "data/companion",
    "poll_s": 30,
    "default_city": "Dhaka",
    "default_lat": 23.8103,
    "default_lon": 90.4125,
    "prayer_method": "Karachi",
    "asr_method": "Hanafi",
    "prayer_offsets": {},  # minutes per prayer, e.g. {dhuhr: 2}
    "weather_cache_s": 1200,
    "voice": "",  # empty: the Edge TTS voice from the TTS config, else bn-BD-NabanitaNeural
    "story_topics": DEFAULT_STORY_TOPICS,
}

FALLBACK_VOICE = "bn-BD-NabanitaNeural"


def _project_dir() -> str:
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _read_yaml(path: str) -> Dict:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except Exception:
        return {}


def _local_files_config() -> Dict:
    root = _project_dir()
    base = _read_yaml(os.path.join(root, "config.yaml"))
    custom_path = os.getenv("XIAOZHI_CUSTOM_CONFIG") or "data/.config.yaml"
    if not os.path.isabs(custom_path):
        custom_path = os.path.join(root, custom_path)
    custom = _read_yaml(custom_path)
    out = {"companion": dict(base.get("companion") or {}), "server": dict(base.get("server") or {})}
    out["companion"].update(custom.get("companion") or {})
    out["server"].update(custom.get("server") or {})
    return out


def companion_config(config: Dict) -> Dict:
    config = config or {}
    section = config.get("companion")
    server = config.get("server") or {}
    files = None
    if not isinstance(section, dict):
        files = _local_files_config()
        section = files["companion"]
    cfg = dict(DEFAULTS)
    cfg.update({k: v for k, v in section.items() if v is not None})
    if not cfg.get("story_topics"):
        cfg["story_topics"] = DEFAULT_STORY_TOPICS

    tz = cfg.get("timezone_offset")
    if tz is None:
        tz = server.get("timezone_offset")
    if tz is None:
        files = files or _local_files_config()
        tz = files["server"].get("timezone_offset", 6)
    cfg["timezone_offset"] = float(tz)

    data_dir = cfg.get("data_dir") or DEFAULTS["data_dir"]
    if not os.path.isabs(data_dir):
        data_dir = os.path.join(_project_dir(), data_dir)
    cfg["data_dir"] = os.path.normpath(data_dir)

    if not cfg.get("voice"):
        cfg["voice"] = FALLBACK_VOICE
        try:
            tts_name = (config.get("selected_module") or {}).get("TTS")
            tts_cfg = (config.get("TTS") or {}).get(tts_name) or {}
            if tts_cfg.get("type") == "edge" and tts_cfg.get("voice"):
                cfg["voice"] = tts_cfg.get("private_voice") or tts_cfg["voice"]
        except AttributeError:
            pass
    cfg["app_token"] = str(cfg.get("app_token") or "")
    cfg["poll_s"] = int(cfg.get("poll_s") or 30)
    return cfg


def tts_language(config: Dict) -> str:
    try:
        tts_name = (config.get("selected_module") or {}).get("TTS")
        lang = ((config.get("TTS") or {}).get(tts_name) or {}).get("language")
        if lang:
            return str(lang)
    except AttributeError:
        pass
    return "Bangla (Bengali, written in Bangla script)"
