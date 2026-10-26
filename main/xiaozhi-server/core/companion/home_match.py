"""Fuzzy Bangla/English name matching for the smart-home and robot-message voice tools.

Pure functions, no I/O: "বসার ঘরের লাইট" finds the device named "Living Room Light" or the one
whose alias is "বসার ঘরের বাতি"; "বাবার রোবটকে" finds the contact "বাবার রোবট". Words are compared
after case folding, Bangla digit folding and synonym folding (লাইট/বাতি/আলো/light are one word),
and a heard word may carry a short Bangla ending the name lacks ("ঘরের" ~ "ঘর", "রোবটকে" ~ "রোবট").
"""

import re
import unicodedata
from difflib import SequenceMatcher
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
ASCII_TO_BN = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")

# Words that mean the same thing, folded to one canonical token (the first of each group).
SYNONYMS: Sequence[Sequence[str]] = (
    ("light", "lights", "lamp", "লাইট", "বাতি", "আলো", "বাল্ব", "bulb", "লাইটটা", "বাতিটা"),
    ("fan", "fans", "ফ্যান", "পাখা", "ফ্যানটা", "পাখাটা"),
    ("ac", "a/c", "aircon", "এসি", "এ.সি", "এয়ারকন্ডিশনার", "এয়ার কন্ডিশনার", "climate", "airconditioner", "কুলার"),
    ("switch", "সুইচ", "plug", "প্লাগ", "socket", "সকেট"),
    ("cover", "curtain", "curtains", "blind", "blinds", "পর্দা", "শাটার", "shutter"),
    ("living", "বসার", "লিভিং", "ড্রয়িং", "drawing", "বৈঠক", "বৈঠকখানা"),
    ("bed", "bedroom", "শোবার", "শোয়ার", "বেড", "বেডরুম"),
    ("kitchen", "রান্নাঘর", "রান্না", "কিচেন"),
    ("bath", "bathroom", "বাথরুম", "গোসলখানা", "টয়লেট", "washroom"),
    ("room", "ঘর", "রুম", "কামরা", "কক্ষ"),
    ("dining", "ডাইনিং", "খাবার"),
    ("study", "পড়ার", "স্টাডি"),
    ("veranda", "বারান্দা", "balcony", "ব্যালকনি"),
    ("tv", "টিভি", "television", "টেলিভিশন"),
    ("robot", "রোবট", "tinybot", "টাইনিবট", "রোবো"),
    ("father", "বাবা", "আব্বা", "আব্বু", "abbu", "baba", "dad", "আব্বুর"),
    ("mother", "মা", "আম্মা", "আম্মু", "ammu", "mom", "maa", "আম্মুর"),
    ("grandfather", "দাদা", "নানা", "dada", "nana"),
    ("grandmother", "দাদি", "দাদু", "নানি", "dadi", "nani"),
)
_CANON: Dict[str, str] = {}
for _group in SYNONYMS:
    for _w in _group:
        _CANON[_w.lower()] = _group[0]

# Domain words: a device kind named on its own ("ফ্যান চালাও") picks the only device of that kind.
DOMAIN_OF_TOKEN = {"light": "light", "fan": "fan", "ac": "climate", "switch": "switch", "cover": "cover"}

# Short Bangla endings a heard word may have and a stored name may not.
BN_ENDINGS = (
    "গুলোকে", "গুলিকে", "দেরকে", "টাকে", "টিকে", "গুলো", "গুলি", "দের", "য়ের", "য়ে", "টার", "টির",
    "ের", "কে", "টা", "টি", "টো", "খানা", "খানি", "তে", "র", "এ", "য়",
)

# Words of the command itself (not of the name): actions, fillers, politeness.
STOPWORDS = {
    "করো", "কর", "করুন", "করে", "দাও", "দিন", "দে", "দিয়ে", "দিও", "তো", "একটু", "প্লিজ", "please", "দয়া", "করে",
    "চালাও", "চালু", "চালিয়ে", "চালান", "জ্বালাও", "জ্বালো", "জ্বালিয়ে", "জ্বালান", "অন", "on", "turn", "switch on",
    "বন্ধ", "নিভাও", "নেভাও", "নিভিয়ে", "অফ", "off", "খোলো", "খোল", "খুলে", "লাগাও", "লাগিয়ে", "open", "close",
    "ডিগ্রি", "ডিগ্রিতে", "degree", "degrees", "তাপমাত্রা", "টেম্পারেচার", "temperature", "set", "to", "the", "a",
    "of", "in", "at", "my", "আমার", "আমাদের", "ওই", "এই", "সেই", "please", "now", "এখন", "বলো", "বলে", "জানাও",
    "জানিয়ে", "কে", "যে", "tell", "say", "message", "বার্তা", "পাঠাও", "পাঠিয়ে",
}


def bn_digits_to_ascii(text: str) -> str:
    return (text or "").translate(BN_DIGITS)


def bn_number(n) -> str:
    return str(n).translate(ASCII_TO_BN)


def normalize(text: str) -> str:
    s = unicodedata.normalize("NFC", str(text or "")).lower()
    s = bn_digits_to_ascii(s)
    s = s.replace("এয়ার কন্ডিশনার", "এয়ারকন্ডিশনার").replace("air conditioner", "airconditioner")
    s = s.replace("a/c", "ac")
    s = re.sub(r"[।,!?;:\"'()\[\]{}<>/\\|_\-–—]+", " ", s)
    s = re.sub(r"(?<!\d)\.|\.(?!\d)", " ", s)  # keep 23.5, drop full stops
    return re.sub(r"\s+", " ", s).strip()


def _fold(word: str) -> str:
    """The canonical form of one word: synonym fold, else synonym fold after a Bangla ending."""
    if word in _CANON:
        return _CANON[word]
    for end in BN_ENDINGS:
        if len(word) > len(end) + 1 and word.endswith(end):
            stem = word[: -len(end)]
            if stem in _CANON:
                return _CANON[stem]
    if word.endswith("s") and len(word) > 3 and word[:-1] in _CANON:
        return _CANON[word[:-1]]
    return word


def tokens(text: str, drop_stopwords: bool = True) -> List[str]:
    out = []
    for w in normalize(text).split(" "):
        if not w:
            continue
        if drop_stopwords and w in STOPWORDS:
            continue
        if drop_stopwords and re.fullmatch(r"\d+(\.\d+)?", w):
            continue
        out.append(_fold(w))
    return out


def word_match(heard: str, name: str) -> bool:
    """A heard word fits a name word: equal, or the heard word is the name word plus a short ending."""
    if heard == name:
        return True
    if heard.startswith(name) and len(name) >= 2:
        rest = heard[len(name):]
        return rest in BN_ENDINGS or (len(rest) <= 2 and name.isascii())
    if name.startswith(heard) and len(heard) >= 3:
        rest = name[len(heard):]
        return rest in BN_ENDINGS or (len(rest) <= 2 and heard.isascii())
    return False


def name_score(query_tokens: Sequence[str], name: str) -> float:
    """0..1: how well the heard words name `name` (all of the name's words heard scores 1)."""
    name_tokens = tokens(name)
    if not name_tokens or not query_tokens:
        return 0.0
    hit = sum(1 for n in name_tokens if any(word_match(q, n) for q in query_tokens))
    score = hit / len(name_tokens)
    if score < 1.0:
        # Close spellings ASR may produce ("লাইটি", "ফেন"): compare the whole strings too
        ratio = SequenceMatcher(None, " ".join(query_tokens), " ".join(name_tokens)).ratio()
        score = max(score, ratio * 0.9 if ratio >= 0.8 else 0.0)
    # Prefer names that use more of what was said ("bedroom light" over "light")
    extra = len([q for q in query_tokens if not any(word_match(q, n) for n in name_tokens)])
    return max(0.0, score - 0.05 * extra)


def best_matches(phrase: str, items: Iterable[Dict], names_of=None, threshold: float = 0.6
                 ) -> Tuple[Optional[Dict], List[Dict]]:
    """Find the item a spoken phrase names.

    `items` are dicts with "name" and "aliases" (or use `names_of(item) -> list of names`).
    Returns (item, []) for a clear winner, (None, [candidates]) when several fit equally well,
    (None, []) when nothing fits.
    """
    items = list(items)
    q = tokens(phrase)
    if not q:
        return None, []
    names_of = names_of or (lambda it: [it.get("name", "")] + list(it.get("aliases") or []))
    scored = []
    for it in items:
        s = max((name_score(q, n) for n in names_of(it) if n), default=0.0)
        if s >= threshold:
            scored.append((s, it))
    if scored:
        scored.sort(key=lambda x: -x[0])
        top = scored[0][0]
        best = [it for s, it in scored if top - s < 0.01]
        if len(best) == 1:
            return best[0], []
        return None, best
    return None, []


def match_device(phrase: str, devices: Sequence[Dict]) -> Tuple[Optional[Dict], List[Dict]]:
    """A device by name or alias; a bare kind word ("ফ্যান") picks the only device of that kind."""
    found, several = best_matches(phrase, devices)
    if found or several:
        if several:
            # "লাইট" with several lights: if only one is of a named kind, take it
            kinds = {DOMAIN_OF_TOKEN[t] for t in tokens(phrase) if t in DOMAIN_OF_TOKEN}
            narrowed = [d for d in several if d.get("domain") in kinds] if kinds else several
            if len(narrowed) == 1:
                return narrowed[0], []
            return None, narrowed or several
        return found, []
    kinds = [DOMAIN_OF_TOKEN[t] for t in tokens(phrase) if t in DOMAIN_OF_TOKEN]
    if kinds:
        same = [d for d in devices if d.get("domain") == kinds[0]]
        if len(same) == 1:
            return same[0], []
        if len(same) > 1:
            return None, same
    return None, []


# --------------------------------------------------------------------- actions from speech
# Whole words only ("অন" must not fire inside "অনেক", "on" not inside "online").
_OFF = {"বন্ধ", "নিভাও", "নেভাও", "নিভিয়ে", "নিভাও", "অফ", "off"}
_ON = {"চালাও", "চালু", "চালিয়ে", "চালান", "জ্বালাও", "জ্বালো", "জ্বালিয়ে", "অন", "on", "start"}
_OPEN = {"খোলো", "খুলে", "খোল", "open"}
_CLOSE = {"লাগাও", "লাগিয়ে", "close"}


def parse_action(text: str) -> Tuple[Optional[str], Optional[float]]:
    """(action, value) from a spoken command: "এসি ২৪ ডিগ্রি" -> ("set_temperature", 24.0)."""
    s = normalize(text)
    words = set(s.split(" "))
    m = re.search(r"(\d{2}(?:\.\d)?)\s*(?:ডিগ্রি|degree|°)", s)
    if m is None and words & {"তাপমাত্রা", "টেম্পারেচার", "temperature", "এসি", "ac"}:
        m = re.search(r"\b(\d{2}(?:\.\d)?)\b", s)
    if m:
        return "set_temperature", float(m.group(1))
    if words & _OPEN:
        return "open", None
    if words & _CLOSE:
        return "close", None
    if words & _OFF:
        return "off", None
    if words & _ON:
        return "on", None
    return None, None
