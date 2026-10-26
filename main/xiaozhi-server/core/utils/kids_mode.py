"""Kids mode: TinyBot talking with a child.

The character (agent) settings in manager-api carry `kids: {enabled, age (3-12), blocked_topics}`
and arrive with the agent config. When it is on, the voice chat's system prompt gets a
child-safety block (age-appropriate words, nothing scary, violent or adult, gentle refusals in
Bangla), and replies are watched for the blocked topics: a question about one gets the gentle
refusal without asking the LLM, and a reply that drifts into one is cut there and ends with it.
"""

import re
import unicodedata
from typing import Dict, Optional

MIN_AGE, MAX_AGE, DEFAULT_AGE = 3, 12, 7
MAX_TOPICS = 30
MAX_TOPIC_LEN = 40

# TinyBot's own words (তুমি): a gentle refusal that moves the chat somewhere nicer
REFUSAL = "এটা নিয়ে আমরা বরং বড়দের সাথে কথা বলি। চলো, অন্য কিছু নিয়ে গল্প করি? তুমি কি একটা মজার ধাঁধা শুনতে চাও?"


def normalize(raw) -> Optional[Dict]:
    """{enabled, age, blocked_topics} from the agent config, or None when kids mode is off."""
    if not isinstance(raw, dict) or raw.get("enabled") not in (True, 1, "1", "true", "True"):
        return None
    try:
        age = int(raw.get("age") or DEFAULT_AGE)
    except (TypeError, ValueError):
        age = DEFAULT_AGE
    age = min(MAX_AGE, max(MIN_AGE, age))
    topics = raw.get("blocked_topics") or []
    if isinstance(topics, str):
        topics = re.split(r"[,\n،]", topics)
    clean = []
    for t in topics if isinstance(topics, (list, tuple)) else []:
        s = " ".join(str(t or "").split())[:MAX_TOPIC_LEN]
        if s and s.casefold() not in {c.casefold() for c in clean}:
            clean.append(s)
    return {"enabled": True, "age": age, "blocked_topics": clean[:MAX_TOPICS]}


def system_prompt(cfg: Optional[Dict]) -> str:
    """The child-safety block for the system prompt ('' when kids mode is off)."""
    if not cfg:
        return ""
    age = cfg["age"]
    lines = [
        "<kids_mode>",
        f"You are talking with a child about {age} years old. Everything you say must suit a child of that age:",
        "- Use short, simple sentences and everyday words a child of that age knows. Be warm, patient and encouraging.",
        "- Never talk about anything scary, violent, gory, sexual, about drugs, alcohol, smoking, gambling, weapons, "
        "self-harm or dangerous stunts, and never describe accidents, crime or death in detail.",
        "- No horror stories, no ghosts that frighten, no bad words, no mocking. Stories end kindly.",
        "- Do not ask for or repeat personal details (full name, address, school name, phone numbers, passwords).",
        "- If the child asks about something unsuitable, do not explain it: gently say it is a topic for a grown-up, "
        f"in Bangla, like \"{REFUSAL}\", and suggest something fun instead.",
        "- If the child sounds hurt, scared or in danger, tell them kindly to go to a parent or a grown-up they trust right now.",
    ]
    if cfg.get("blocked_topics"):
        lines.append("- The parents asked you to avoid these topics completely, even if the child asks: "
                     + ", ".join(cfg["blocked_topics"]) + ".")
    lines.append("</kids_mode>")
    return "\n".join(lines)


def _fold(text: str) -> str:
    return unicodedata.normalize("NFC", str(text or "")).casefold()


def find_blocked(text: str, cfg: Optional[Dict]) -> Optional[str]:
    """The first blocked topic that `text` mentions, or None. Latin-script topics match whole
    words (so "war" does not hit "award"); Bangla and other scripts match as substrings."""
    if not cfg or not text:
        return None
    folded = _fold(text)
    for topic in cfg.get("blocked_topics") or []:
        t = _fold(topic).strip()
        if not t:
            continue
        if re.fullmatch(r"[a-z0-9 '\-]+", t):
            if re.search(r"(?<![a-z0-9])" + re.escape(t) + r"(?![a-z0-9])", folded):
                return topic
        elif t in folded:
            return topic
    return None


class ReplyGuard:
    """Watches a streamed reply: feed() each piece; it answers the part that may be spoken, or
    None once the reply reached a blocked topic (the caller then speaks REFUSAL and stops)."""

    def __init__(self, cfg: Optional[Dict]):
        self.cfg = cfg
        self.text = ""
        self.blocked: Optional[str] = None

    def feed(self, piece: str) -> Optional[str]:
        if self.blocked is not None:
            return None
        if not self.cfg or not piece:
            self.text += piece or ""
            return piece
        hit = find_blocked(self.text + piece, self.cfg)
        if hit is not None:
            self.blocked = hit
            return None
        self.text += piece
        return piece
