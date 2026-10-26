"""TinyBot's library: stories, rhymes, music and recitations the robot can play.

Kept on the server, not in the robot's settings: `<data_dir>/library.json`, one list per robot
(the robot's owner adds them in the app), plus a small shared default set that every robot has.
An item has either an `audio_url` (an http(s) link the owner adds, or a companion audio path) or
a `text` that TinyBot speaks (rendered to audio with core/companion/audio.py when played).

The default set holds only short Bangla children's rhymes and stories written for TinyBot
(original texts, no copyrighted audio, no religious text). Recitations are only what the owner
adds himself.
"""

import json
import os
import random
import re
import threading
import time
from typing import Dict, List, Optional

from loguru import logger

from core.companion import schema

TAG = __name__

KINDS = ("story", "rhyme", "music", "recitation")
MAX_TITLE = 60
MAX_TEXT = 500  # the companion TTS renders at most 500 characters (audio.MAX_TEXT)
MAX_URL = schema.MAX_PLAY_ARG
MAX_ITEMS = 100
URL_RE = re.compile(r"^(https?://[^\s]+|/companion/v1/audio/[0-9a-f]{40}\.ogg)$")

KIND_BN = {"story": "গল্প", "rhyme": "ছড়া", "music": "গান", "recitation": "তিলাওয়াত"}

# Original texts written for TinyBot (not taken from any book or recording).
DEFAULT_ITEMS: List[Dict] = [
    {
        "id": "d-rhyme-sun",
        "kind": "rhyme",
        "title": "রোদের ছড়া",
        "text": (
            "জানালা দিয়ে রোদ এসেছে, সোনার মতো রং,\n"
            "বিছানা ছেড়ে উঠে পড়ো, বাজছে ঘড়ির টং।\n"
            "দাঁত মেজে মুখটি ধুয়ে খেয়ে নাও নাস্তা,\n"
            "টাইনিবট বলে, হাসিমুখে ধরো আজকের রাস্তা।"
        ),
    },
    {
        "id": "d-rhyme-water",
        "kind": "rhyme",
        "title": "পানির ছড়া",
        "text": (
            "ঢকঢক ঢকঢক এক গ্লাস পানি,\n"
            "খেলে পরে শরীর থাকে ভালো, জানি জানি।\n"
            "খেলার পরে, পড়ার ফাঁকে, একটু করে খাও,\n"
            "টাইনিবটের সাথে মিলে সুস্থ থেকে যাও।"
        ),
    },
    {
        "id": "d-rhyme-night",
        "kind": "rhyme",
        "title": "ঘুমের ছড়া",
        "text": (
            "তারারা সব মিটমিট, চোখ দুটো বুজে আসে,\n"
            "বালিশটা নরম নরম, স্বপ্ন এসে পাশে বসে।\n"
            "টাইনিবট আলো নিভিয়ে চুপটি করে থাকে,\n"
            "কাল সকালে আবার দেখা, শুভ রাত্রি তোমাকে।"
        ),
    },
    {
        "id": "d-story-pencil",
        "kind": "story",
        "title": "টাইনিবট আর হারানো পেনসিল",
        "text": (
            "একদিন টাইনিবটের বন্ধু মিতুর লাল পেনসিলটা হারিয়ে গেল। মিতুর খুব মন খারাপ। "
            "টাইনিবট বলল, চলো, খুঁজে দেখি! ওরা টেবিলের নিচে দেখল, ব্যাগের ভেতর দেখল, কোথাও নেই। "
            "তখন টাইনিবট বলল, শেষবার কোথায় বসে আঁকছিলে, মনে করো তো। মিতু ভেবে বলল, বারান্দায়! "
            "গিয়ে দেখে, ফুলের টবের পাশে পেনসিলটা চুপটি করে শুয়ে আছে। মিতু হেসে বলল, ধন্যবাদ টাইনিবট! "
            "টাইনিবট বলল, মাথা ঠান্ডা রেখে ভাবলেই হারানো জিনিস খুঁজে পাওয়া যায়।"
        ),
    },
    {
        "id": "d-story-sparrow",
        "kind": "story",
        "title": "চড়ুই আর কাঠবিড়ালি",
        "text": (
            "একটা ছোট্ট চড়ুই আমগাছের ডালে বাসা বানাচ্ছিল। হঠাৎ আকাশ কালো করে বৃষ্টি এলো। "
            "চড়ুই ভয় পেয়ে গেল, তার বাসা তো এখনো অর্ধেক! পাশের ডালের কাঠবিড়ালি ডেকে বলল, "
            "এসো, আমার গর্তে বসো। বৃষ্টি থামলে দুজনে মিলে খড় আর পাতা এনে বাসাটা শেষ করল। "
            "চড়ুই বলল, তুমি না থাকলে কী যে হতো! কাঠবিড়ালি হেসে বলল, "
            "বন্ধুর বিপদে পাশে থাকাই তো বন্ধুত্ব।"
        ),
    },
]
for _item in DEFAULT_ITEMS:
    _item["source"] = "default"


def validate_item(raw) -> Dict:
    """A new owner item from the app: {kind, title, audio_url | text}."""
    if not isinstance(raw, dict):
        raise schema.ValidationError("library item must be an object")
    kind = raw.get("kind")
    if kind not in KINDS:
        raise schema.ValidationError(f"library.kind must be one of {', '.join(KINDS)}")
    title = schema.text(raw.get("title"), MAX_TITLE, "library.title", required=True)
    url = schema.text(raw.get("audio_url"), MAX_URL + 1, "library.audio_url")
    body = raw.get("text")
    body = schema.text(body, MAX_TEXT + 1, "library.text") if body is not None else ""
    if len(url) > MAX_URL:
        raise schema.ValidationError(f"library.audio_url is longer than {MAX_URL} characters")
    if len(body) > MAX_TEXT:
        raise schema.ValidationError(f"library.text is longer than {MAX_TEXT} characters")
    if bool(url) == bool(body):
        raise schema.ValidationError("library item needs either audio_url or text")
    if url and not URL_RE.match(url):
        raise schema.ValidationError("library.audio_url must be an http(s) link")
    item = {"id": schema.new_id("l"), "kind": kind, "title": title, "source": "owner", "added": int(time.time())}
    if url:
        item["audio_url"] = url
    else:
        item["text"] = body
    return item


def _words(text: str) -> List[str]:
    return [w for w in re.split(r"[\s,.;:!?।'\"-]+", (text or "").lower()) if len(w) > 1]


class LibraryStore:
    def __init__(self, data_dir: str):
        self.path = os.path.join(data_dir, "library.json")
        self._lock = threading.Lock()
        self.devices: Dict[str, List[Dict]] = self._load()

    def _load(self) -> Dict[str, List[Dict]]:
        try:
            with open(self.path, encoding="utf-8") as f:
                data = json.load(f)
            devices = data.get("devices") if isinstance(data, dict) else None
            return {k: v for k, v in (devices or {}).items() if isinstance(v, list)}
        except FileNotFoundError:
            return {}
        except (OSError, ValueError) as e:
            logger.bind(tag=TAG).error(f"Failed to load library {self.path}: {e}")
            return {}

    def _save(self):
        os.makedirs(os.path.dirname(self.path) or ".", exist_ok=True)
        tmp = self.path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"version": 1, "devices": self.devices}, f, ensure_ascii=False, indent=1)
        os.replace(tmp, self.path)

    # --- reading ---------------------------------------------------------------------------
    def items(self, device_id: str) -> List[Dict]:
        """The robot's own items (newest first), then the shared default set."""
        own = list(reversed(self.devices.get(device_id, [])))
        return [dict(i) for i in own] + [dict(i) for i in DEFAULT_ITEMS]

    def get(self, device_id: str, item_id: str) -> Optional[Dict]:
        return next((i for i in self.items(device_id) if i["id"] == item_id), None)

    def pick(self, device_id: str, kind: str = "", query: str = "") -> Optional[Dict]:
        """An item for "গল্প শোনাও" / "ছড়া শোনাও": the best title match for the query, else a
        random one of the kind (the owner's own items first)."""
        pool = [i for i in self.items(device_id) if not kind or i["kind"] == kind]
        if not pool:
            return None
        words = _words(query)
        if words:
            scored = [(sum(1 for w in words if w in i["title"].lower()), i) for i in pool]
            best = max(s for s, _ in scored)
            if best > 0:
                return next(i for s, i in scored if s == best)
        own = [i for i in pool if i.get("source") == "owner"]
        return random.choice(own or pool)

    # --- editing (from the app) ------------------------------------------------------------
    def edit(self, device_id: str, patch) -> None:
        """{"add": item} | {"delete": [ids]}; raises schema.ValidationError."""
        if not isinstance(patch, dict):
            raise schema.ValidationError("library must be an object")
        add = patch.get("add")
        ids = patch.get("delete", [])
        if not isinstance(ids, list) or not all(isinstance(i, str) for i in ids):
            raise schema.ValidationError("library.delete must be a list of ids")
        if any(i.startswith("d-") for i in ids):
            raise schema.ValidationError("the default library items cannot be deleted")
        item = validate_item(add) if add is not None else None
        with self._lock:
            own = [i for i in self.devices.get(device_id, []) if i["id"] not in set(ids)]
            if item is not None:
                if len(own) >= MAX_ITEMS:
                    raise schema.ValidationError(f"at most {MAX_ITEMS} library items")
                own.append(item)
            self.devices[device_id] = own
            self._save()

    def forget(self, device_id: str) -> None:
        with self._lock:
            if self.devices.pop(device_id, None) is not None:
                self._save()
