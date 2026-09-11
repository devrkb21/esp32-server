import re
from config.logger import setup_logging

TAG = __name__
logger = setup_logging()

EMOTION_EMOJI_MAP = {
    "HAPPY": "🙂",
    "SAD": "😔",
    "ANGRY": "😡",
    "NEUTRAL": "😶",
    "FEARFUL": "😰",
    "DISGUSTED": "🤢",
    "SURPRISED": "😲",
    "EMO_UNKNOWN": "😶",  # Unknown emotion defaults to neutral face
}
# EVENT_EMOJI_MAP = {
#     "<|BGM|>": "🎼",
#     "<|Speech|>": "",
#     "<|Applause|>": "👏",
#     "<|Laughter|>": "😀",
#     "<|Cry|>": "😭",
#     "<|Sneeze|>": "🤧",
#     "<|Breath|>": "",
#     "<|Cough|>": "🤧",
# # }

def lang_tag_filter(text: str) -> dict:
    """
    Parse FunASR recognition result, extracting tags and plain text in order.

    Args:
        text: Raw text recognized by ASR, which may contain multiple tags.

    Returns:
        dict: {"language": "en", "emotion": "SAD", "emoji": "😔", "content": "Hello"} if tags exist,
              {"content": "plain text"} if no tags exist.

    Examples:
        FunASR output format: <|language|><|emotion|><|event|><|other|>raw text
        >>> lang_tag_filter("<|en|><|SAD|><|Speech|><|withitn|>Hello there, test test.")
        {"language": "en", "emotion": "SAD", "emoji": "😔", "content": "Hello there, test test."}
        >>> lang_tag_filter("<|en|><|HAPPY|><|Speech|><|withitn|>Hello hello.")
        {"language": "en", "emotion": "HAPPY", "emoji": "🙂", "content": "Hello hello."}
        >>> lang_tag_filter("plain text")
        {"content": "plain text"}
    """
    # Extract all tags (in order)
    tag_pattern = r"<\|([^|]+)\|>"
    all_tags = re.findall(tag_pattern, text)

    # Remove all <|...|> formatted tags to obtain plain text
    clean_text = re.sub(tag_pattern, "", text).strip()

    # Maintain consistent return structure so callers don't access plain text as dict
    if not all_tags:
        return {"content": clean_text}

    # Extract tags according to FunASR fixed order, return dict
    language = all_tags[0] if len(all_tags) > 0 else "zh"
    emotion = all_tags[1] if len(all_tags) > 1 else "NEUTRAL"
    # event = all_tags[2] if len(all_tags) > 2 else "Speech"  # Event tags unused for now

    result = {
        "content": clean_text,
        "language": language,
        "emotion": emotion,
        # "event": event,
    }

    # Add emoji mapping
    if emotion in EMOTION_EMOJI_MAP:
        result["emotion"] = EMOTION_EMOJI_MAP[emotion]
    # Event tags unused for now
    # if event in EVENT_EMOJI_MAP:
    #     result["event"] = EVENT_EMOJI_MAP[event]

    return result
