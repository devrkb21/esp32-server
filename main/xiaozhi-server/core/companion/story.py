"""Story requests from the robot: listen/detect text `[companion:story]<topic>`."""

import random
from typing import Dict

from core.companion.settings import companion_config, tts_language

STORY_TAG = "[companion:story]"


def is_story_request(text: str) -> bool:
    return isinstance(text, str) and text.startswith(STORY_TAG)


def pick_topic(config: Dict, arg: str = "") -> str:
    topic = (arg or "").strip()[:120]
    if topic:
        return topic
    topics = companion_config(config).get("story_topics") or []
    return random.choice(topics) if topics else "a kind little robot and its friends"


def build_story_prompt(config: Dict, text: str) -> str:
    arg = text[len(STORY_TAG):] if is_story_request(text) else text
    topic = pick_topic(config, arg)
    language = tts_language(config)
    return (
        f"Please tell me a short bedtime-style children's story about: {topic}.\n"
        f"Write it in {language}. Use 6 to 8 short sentences with simple words a 5-8 year old "
        "understands, a warm and gentle tone, friendly characters, a happy ending and one small "
        "lesson about kindness, honesty, sharing or courage. Nothing scary or violent. "
        "Start directly with the story (a one-line title is fine). No lists, no markdown, "
        "no emoji, and do not ask a question afterwards."
    )
