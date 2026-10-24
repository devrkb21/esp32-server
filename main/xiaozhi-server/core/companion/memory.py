"""TinyBot's memory: short notes about its family that it keeps between chats.

After a voice session ends, the session's LLM reads the chat together with the current notes and
says what to add, change or drop (learn()). The notes go into the next chats' system prompt
(context()), so TinyBot can ask how the exam went or remember a favourite colour. The app lists
them and can delete one or all; settings.memory.enabled switches the whole thing off.
"""

import json
import os
import re
import threading
import time
from datetime import date, timedelta
from typing import Callable, Dict, List, Optional

from loguru import logger

from core.companion import schema

TAG = __name__
KINDS = ("person", "like", "dislike", "event", "fact", "routine")
MAX_ITEMS = 60
MAX_TEXT = 200
# Chats shorter than this (user words) teach nothing worth keeping
MIN_USER_CHARS = 12

LEARN_PROMPT = """You keep the memory notebook of TinyBot, a small companion robot that lives with a family.
You get the notes TinyBot already has and the transcript of the chat that just ended. Decide what
TinyBot should remember for future chats.

Keep only lasting, useful things about the family members: names and who is who, ages, school or
work, likes and dislikes, pets, health or care needs they mention, regular habits, and upcoming
events with their date (exam on Tuesday, grandma visiting next week). Also keep feelings worth a
follow-up later (was sad because a friend moved away).
Do NOT keep: small talk, questions to TinyBot, what TinyBot itself said or did, jokes, stories it
told, passwords, phone numbers, home addresses, or anything the user asks not to remember.
If the user asks TinyBot to forget something, remove the matching notes. If something changed,
update the note instead of adding a second one. Do not add a note that repeats an existing one.

Write each note as one short sentence in the language the user spoke, naming the person when
known. For events give "until" as the last date (YYYY-MM-DD) the note matters, from today's date.

Answer with JSON only, no other text:
{"add": [{"text": "...", "kind": "person|like|dislike|event|fact|routine", "until": "YYYY-MM-DD or empty"}],
 "update": [{"id": "...", "text": "..."}],
 "remove": ["id", ...]}
Use empty lists when nothing changes (most short chats change nothing)."""


def _clean_text(value) -> str:
    text = " ".join(str(value or "").split())
    return text[:MAX_TEXT]


def _parse_json(raw: str) -> Optional[Dict]:
    if not raw:
        return None
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.S)
    start, end = raw.find("{"), raw.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        data = json.loads(raw[start:end + 1])
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


def transcript(messages) -> str:
    """The user / assistant turns of a session as plain lines (system prompts and the robot's
    own start-of-chat instructions left out)."""
    lines = []
    for m in messages:
        role = getattr(m, "role", None)
        content = getattr(m, "content", None)
        if role not in ("user", "assistant") or not isinstance(content, str) or not content.strip():
            continue
        text = content.strip()
        if text.startswith("{") and text.endswith("}"):
            try:
                data = json.loads(text)
                text = str(data.get("content", text)) if isinstance(data, dict) else text
            except ValueError:
                pass
        if role == "user" and text.startswith("[TinyBot starts this chat by itself"):
            lines.append("(TinyBot greeted first)")
            continue
        if role == "user" and text.startswith("Please tell me a short bedtime-style children's story"):
            lines.append("User: (asked for a story)")
            continue
        lines.append(("User: " if role == "user" else "TinyBot: ") + text[:600])
    return "\n".join(lines[-40:])


class MemoryBook:
    """Per-device notes in data_dir/memories.json. Thread-safe: learn() runs in a worker thread."""

    def __init__(self, data_dir: str, today: Callable[[], date] = date.today):
        self.path = os.path.join(data_dir, "memories.json")
        self.today = today
        self._lock = threading.Lock()
        self._data: Dict[str, List[Dict]] = self._load()

    def _load(self) -> Dict:
        try:
            with open(self.path, encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else {}
        except (OSError, ValueError):
            return {}

    def _save(self):
        tmp = self.path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self._data, f, ensure_ascii=False, indent=1)
        os.replace(tmp, self.path)

    def _expire(self, items: List[Dict]) -> List[Dict]:
        today = self.today().isoformat()
        return [m for m in items if not m.get("until") or m["until"] >= today]

    # --- reading ---------------------------------------------------------------------------
    def items(self, device_id: str) -> List[Dict]:
        with self._lock:
            return [dict(m) for m in self._expire(self._data.get(device_id, []))]

    def context(self, device_id: str) -> str:
        """The notes as a system prompt block ('' when there are none)."""
        items = self.items(device_id)
        if not items:
            return ""
        lines = [
            "<tinybot_memory>",
            "Things you remember about your family from earlier chats (date noted in brackets):",
        ]
        lines += [f"- {m['text']} [{m['created'][:10]}]" for m in items]
        lines.append(
            "Use these naturally when they fit (ask how the exam went, use their names), never read "
            "the list out, and do not pretend to remember anything that is not here. If asked what "
            "you remember, tell a few things briefly. If asked to forget something, say you will."
        )
        lines.append("</tinybot_memory>")
        return "\n".join(lines)

    # --- changes ---------------------------------------------------------------------------
    def delete(self, device_id: str, ids: List[str]) -> int:
        with self._lock:
            items = self._data.get(device_id, [])
            keep = [m for m in items if m["id"] not in set(ids)]
            self._data[device_id] = keep
            self._save()
            return len(items) - len(keep)

    def clear(self, device_id: str):
        with self._lock:
            self._data.pop(device_id, None)
            self._save()

    def apply(self, device_id: str, ops: Dict) -> Dict[str, int]:
        """Apply the LLM's add / update / remove answer; returns how many of each were done."""
        now = time.strftime("%Y-%m-%dT%H:%M:%S")
        done = {"add": 0, "update": 0, "remove": 0}
        with self._lock:
            items = self._expire(self._data.get(device_id, []))
            by_id = {m["id"]: m for m in items}
            for mid in ops.get("remove") or []:
                if isinstance(mid, str) and by_id.pop(mid, None) is not None:
                    done["remove"] += 1
            for up in ops.get("update") or []:
                if not isinstance(up, dict):
                    continue
                m, text = by_id.get(up.get("id")), _clean_text(up.get("text"))
                if m is not None and text:
                    m.update(text=text, updated=now)
                    done["update"] += 1
            known = {m["text"].casefold() for m in by_id.values()}
            for add in ops.get("add") or []:
                if not isinstance(add, dict):
                    continue
                text = _clean_text(add.get("text"))
                if not text or text.casefold() in known:
                    continue
                kind = add.get("kind") if add.get("kind") in KINDS else "fact"
                until = str(add.get("until") or "")
                if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", until):
                    until = ""
                if kind == "event" and not until:
                    until = (self.today() + timedelta(days=14)).isoformat()
                item = {"id": schema.new_id("m"), "text": text, "kind": kind, "created": now, "updated": now}
                if until:
                    item["until"] = until
                by_id[item["id"]] = item
                known.add(text.casefold())
                done["add"] += 1
            # Oldest notes go first when the notebook is full
            kept = sorted(by_id.values(), key=lambda m: m["updated"])[-MAX_ITEMS:]
            self._data[device_id] = sorted(kept, key=lambda m: m["created"])
            self._save()
        return done

    def learn(self, device_id: str, messages, llm) -> Optional[Dict[str, int]]:
        """Read a finished chat and update the notes (blocking: run it in a worker thread)."""
        text = transcript(messages)
        user_chars = sum(len(l) - 6 for l in text.splitlines() if l.startswith("User: "))
        if llm is None or user_chars < MIN_USER_CHARS:
            return None
        notes = "\n".join(f"{m['id']}: {m['text']}" for m in self.items(device_id)) or "(none yet)"
        prompt = (f"Today is {self.today().isoformat()}.\n\nCurrent notes:\n{notes}\n\n"
                  f"Chat that just ended:\n{text}")
        raw = llm.response_no_stream(LEARN_PROMPT, prompt, max_tokens=800, temperature=0.2)
        ops = _parse_json(raw)
        if ops is None:
            logger.bind(tag=TAG).warning(f"Memory answer was not JSON: {str(raw)[:120]}")
            return None
        done = self.apply(device_id, ops)
        logger.bind(tag=TAG).info(f"TinyBot memory for {device_id}: {done}")
        return done
