"""Bangla (and plain English) numbers, clock times and durations from speech, for the voice tools.

Covers what people say to TinyBot: Bangla digits (০-৯), number words (এক, দুই, পনেরো, পঁচিশ...),
the clock forms with টা/টায়/টার (সাতটায়, ন'টা, দুটো), fractions of the hour (সাড়ে সাতটা = 7:30,
পৌনে ন'টা = 8:45, সোয়া দশটা = 10:15, দেড়টা = 1:30, আড়াইটা = 2:30), parts of the day (ভোর, সকাল,
দুপুর, বিকেল, সন্ধ্যা, রাত) and durations (১০ মিনিট, আধা ঘণ্টা, দেড় ঘণ্টা, ২ ঘণ্টা ১৫ মিনিট).
Pure functions, no server imports (unit tested in tests/companion/test_bn_parse.py).
"""

import math
import re
import unicodedata
from datetime import datetime
from typing import Optional, Tuple

BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
TO_BN_DIGITS = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")


def _norm(text: str) -> str:
    """One spelling for matching: NFC (which keeps য় ড় ঢ় decomposed), ASCII digits, no
    apostrophes, lower case, single spaces."""
    if not isinstance(text, str):
        return ""
    s = unicodedata.normalize("NFC", text).translate(BN_DIGITS).lower()
    s = re.sub(r"['’‘`]", "", s)
    s = s.replace("ঃ", ":").replace("।", " ")
    # a dental na in ঘন্টা is a common spelling of ঘণ্টা
    s = s.replace("ঘন্টা", "ঘণ্টা")
    return re.sub(r"\s+", " ", s).strip()


_WORDS = {
    0: ["শূন্য", "zero"],
    1: ["এক", "one"],
    2: ["দুই", "দু", "two"],
    3: ["তিন", "three"],
    4: ["চার", "four"],
    5: ["পাঁচ", "five"],
    6: ["ছয়", "ছয়", "ছ", "six"],
    7: ["সাত", "seven"],
    8: ["আট", "eight"],
    9: ["নয়", "নয়", "ন", "nine"],
    10: ["দশ", "ten"],
    11: ["এগারো", "এগার", "eleven"],
    12: ["বারো", "বার", "twelve"],
    13: ["তেরো", "তের", "thirteen"],
    14: ["চৌদ্দ", "fourteen"],
    15: ["পনেরো", "পনের", "fifteen"],
    16: ["ষোলো", "ষোল", "sixteen"],
    17: ["সতেরো", "সতের", "seventeen"],
    18: ["আঠারো", "আঠার", "eighteen"],
    19: ["উনিশ", "nineteen"],
    20: ["বিশ", "কুড়ি", "কুড়ি", "twenty"],
    21: ["একুশ"], 22: ["বাইশ"], 23: ["তেইশ"], 24: ["চব্বিশ"], 25: ["পঁচিশ", "twenty five"],
    26: ["ছাব্বিশ"], 27: ["সাতাশ"], 28: ["আটাশ"], 29: ["ঊনত্রিশ", "উনত্রিশ"],
    30: ["ত্রিশ", "তিরিশ", "thirty"], 31: ["একত্রিশ"], 32: ["বত্রিশ"], 33: ["তেত্রিশ"],
    34: ["চৌত্রিশ"], 35: ["পঁয়ত্রিশ", "পঁয়ত্রিশ"], 36: ["ছত্রিশ"], 37: ["সাঁইত্রিশ"],
    38: ["আটত্রিশ"], 39: ["ঊনচল্লিশ", "উনচল্লিশ"], 40: ["চল্লিশ", "forty"], 41: ["একচল্লিশ"],
    42: ["বিয়াল্লিশ", "বিয়াল্লিশ"], 43: ["তেতাল্লিশ"], 44: ["চুয়াল্লিশ", "চুয়াল্লিশ"],
    45: ["পঁয়তাল্লিশ", "পঁয়তাল্লিশ", "forty five"], 46: ["ছেচল্লিশ"], 47: ["সাতচল্লিশ"],
    48: ["আটচল্লিশ"], 49: ["ঊনপঞ্চাশ", "উনপঞ্চাশ"], 50: ["পঞ্চাশ", "fifty"], 51: ["একান্ন"],
    52: ["বায়ান্ন", "বায়ান্ন"], 53: ["তিপ্পান্ন"], 54: ["চুয়ান্ন", "চুয়ান্ন"], 55: ["পঞ্চান্ন"],
    56: ["ছাপ্পান্ন"], 57: ["সাতান্ন"], 58: ["আটান্ন"], 59: ["ঊনষাট", "উনষাট"],
    60: ["ষাট", "sixty"], 70: ["সত্তর", "seventy"], 80: ["আশি", "eighty"], 90: ["নব্বই", "ninety"],
    100: ["একশ", "একশো", "এক শ", "hundred"],
}
WORD_VALUE = {}
for _n, _ws in _WORDS.items():
    for _w in _ws:
        WORD_VALUE[_norm(_w)] = _n
# Fractions said on their own: আধা ঘণ্টা, দেড় ঘণ্টা, আড়াইটা
WHOLE_FRACTIONS = {_norm(k): v for k, v in {
    "আধা": 0.5, "আধ": 0.5, "half": 0.5, "দেড়": 1.5, "আড়াই": 2.5,
}.items()}
# Fractions before a number: সাড়ে সাত = 7.5, পৌনে নয় = 8.75, সোয়া দশ = 10.25
PREFIX_FRACTIONS = {_norm(k): v for k, v in {"সাড়ে": 0.5, "সোয়া": 0.25, "পৌনে": -0.25}.items()}

_WORD_ALT = "|".join(re.escape(w) for w in sorted(WORD_VALUE, key=len, reverse=True))
_NUM = rf"(?:\d+(?:\.\d+)?|{_WORD_ALT})"
_PREFIX_ALT = "|".join(re.escape(w) for w in PREFIX_FRACTIONS)
_WHOLE_ALT = "|".join(re.escape(w) for w in sorted(WHOLE_FRACTIONS, key=len, reverse=True))
# What may follow a clock number: টা, টায়, টার, টো, টে (with or without a space)
_O_CLOCK = "(?:" + "|".join(re.escape(_norm(s)) for s in ("টায়", "টার", "টা", "টো", "টে")) + ")"
_BOUNDARY = r"(?![ঀ-৿a-z0-9])"
_START = r"(?<![ঀ-৿a-z0-9])"

HOUR_WORDS = tuple(_norm(w) for w in ("ঘণ্টা", "hours", "hour", "hrs", "hr", "h"))
MINUTE_WORDS = tuple(_norm(w) for w in ("মিনিট", "minutes", "minute", "mins", "min", "m"))
SECOND_WORDS = tuple(_norm(w) for w in ("সেকেন্ড", "seconds", "second", "secs", "sec", "s"))

DAY_PARTS = [  # (words, part); checked longest first
    (("ভোর",), "dawn"),
    (("সকাল", "morning"), "morning"),
    (("দুপুর", "noon", "afternoon"), "noon"),
    (("বিকেল", "বিকাল", "বিকেলে", "বিকালে"), "afternoon"),
    (("সন্ধ্যা", "সন্ধে", "সন্ধ্যায়", "evening"), "evening"),
    (("রাত", "রাতে", "night", "tonight"), "night"),
]


def number_value(token: str) -> Optional[float]:
    """The value of one number token: digits (Bangla or ASCII) or a number word."""
    t = _norm(token)
    if not t:
        return None
    if re.fullmatch(r"\d+(?:\.\d+)?", t):
        return float(t)
    if t in WORD_VALUE:
        return float(WORD_VALUE[t])
    return None


def parse_number(text: str) -> Optional[float]:
    """The first number said in the text, fractions included (সাড়ে তিন = 3.5, দেড় = 1.5)."""
    s = _norm(text)
    m = re.search(rf"{_START}(?:({_PREFIX_ALT})\s*)?({_NUM}){_BOUNDARY}", s)
    whole = re.search(rf"{_START}({_WHOLE_ALT}){_BOUNDARY}", s)
    if whole and (not m or whole.start() < m.start()):
        return WHOLE_FRACTIONS[whole.group(1)]
    if not m:
        return None
    value = number_value(m.group(2))
    if value is None:
        return None
    if m.group(1):
        value += PREFIX_FRACTIONS[m.group(1)]
    return value


def _unit_amount(s: str, units: Tuple[str, ...]) -> Optional[float]:
    """The amount before one of the unit words (e.g. `২ ঘণ্টা`, `আধা ঘণ্টা`, `সাড়ে তিন ঘণ্টা`)."""
    alt = "|".join(re.escape(u) for u in sorted(units, key=len, reverse=True))
    m = re.search(
        rf"{_START}(?:(?:({_PREFIX_ALT})\s*)?({_NUM})|({_WHOLE_ALT}))\s*(?:{alt})[ঀ-৿]*(?![a-z0-9])", s)
    if not m:
        return None
    if m.group(3):
        return WHOLE_FRACTIONS[m.group(3)]
    value = number_value(m.group(2))
    if value is None:
        return None
    return value + (PREFIX_FRACTIONS[m.group(1)] if m.group(1) else 0)


def parse_duration(text) -> Optional[int]:
    """Minutes in a spoken duration: `১০ মিনিট` 10, `আধা ঘণ্টা` 30, `দেড় ঘণ্টা` 90,
    `২ ঘণ্টা ১৫ মিনিট` 135, `30 sec` 1, a bare number = minutes. None when nothing is said."""
    if isinstance(text, (int, float)) and not isinstance(text, bool):
        return int(text) if text > 0 else None
    s = _norm(text).replace("half an hour", "half hour").replace("an hour", "1 hour")
    if not s:
        return None
    m = re.fullmatch(r"(\d{1,2})h(?:(\d{1,2})m)?|(\d{1,3})m", s.replace(" ", ""))
    if m:
        mins = int(m.group(1) or 0) * 60 + int(m.group(2) or 0) + int(m.group(3) or 0)
        return mins or None
    hours = _unit_amount(s, HOUR_WORDS)
    minutes = _unit_amount(s, MINUTE_WORDS)
    seconds = _unit_amount(s, SECOND_WORDS) if hours is None and minutes is None else None
    if hours is None and minutes is None and seconds is None:
        bare = re.sub(r"\b(পরে|পর|after|in|later)\b", " ", s).strip()
        value = parse_number(bare)
        if value is None or value < 1:
            return None
        return int(round(value))
    total = (hours or 0) * 60 + (minutes or 0) + (seconds or 0) / 60.0
    if total <= 0:
        return None
    return max(1, int(math.ceil(total - 1e-9)))


def day_part(text: str) -> Optional[str]:
    s = _norm(text)
    found = []
    for words, part in DAY_PARTS:
        for w in words:
            m = re.search(rf"{_START}{re.escape(_norm(w))}", s)
            if m:
                found.append((m.start(), part))
    if re.search(r"\d\s*(?:p\.?m\.?|pm)\b", s) or re.search(r"\bpm\b", s):
        found.append((0, "pm"))
    if re.search(r"\d\s*(?:a\.?m\.?|am)\b", s) or re.search(r"\bam\b", s):
        found.append((0, "am"))
    return sorted(found)[0][1] if found else None


def _apply_part(h: int, part: Optional[str]) -> int:
    """24-hour hour for a 12-hour clock hour said with a part of the day."""
    if part in ("dawn", "morning", "am"):
        return 0 if h == 12 and part == "am" else h
    if part == "noon":
        return h + 12 if 1 <= h <= 5 else h
    if part in ("afternoon", "evening", "pm"):
        return h + 12 if 1 <= h <= 11 else h
    if part == "night":
        if 6 <= h <= 11:
            return h + 12
        return 0 if h == 12 else h
    return h


_CLOCK_RE = re.compile(
    rf"{_START}(?:({_PREFIX_ALT})\s*)?({_NUM})\s*({_O_CLOCK}|বাজে|বাজলে|বেজে|o ?clock|a\.?m\.?|p\.?m\.?)?"
    rf"(?:\s*({_NUM})\s*(?:মিনিট[ঀ-৿]*|minutes?|mins?)?)?{_BOUNDARY}"
)


_UNIT_AFTER = re.compile(
    r"\s*(?:" + "|".join(re.escape(u) for u in HOUR_WORDS + MINUTE_WORDS + SECOND_WORDS if len(u) > 1) + ")"
)


def _clock_parts(s: str) -> Optional[Tuple[int, int, bool]]:
    """(hour, minute, said_24h) from a normalised text, or None."""
    # 07:30, 7.30, 19:05
    m = re.search(r"(?<!\d)(\d{1,2})[:.](\d{2})(?!\d)", s)
    if m:
        h, mi = int(m.group(1)), int(m.group(2))
        if h <= 23 and mi <= 59:
            return h, mi, h > 12 or m.group(1).startswith("0")
        return None
    # দেড়টা 1:30, আড়াইটা 2:30
    m = re.search(rf"{_START}({_WHOLE_ALT})\s*{_O_CLOCK}", s)
    if m and WHOLE_FRACTIONS[m.group(1)] > 1:
        v = WHOLE_FRACTIONS[m.group(1)]
        return int(v), int(round((v - int(v)) * 60)), False
    # (সাড়ে|সোয়া|পৌনে)? <hour>(টা|টায়|বাজে|am...)? (<minutes> মিনিট?)?
    for m in _CLOCK_RE.finditer(s):
        prefix, hour_tok, oclock, min_tok = m.group(1), m.group(2), m.group(3), m.group(4)
        h = number_value(hour_tok)
        # a bare number is a clock hour only with টা / বাজে / am / a fraction word around it
        if h is None or not (oclock or prefix) or h != int(h) or not 0 <= h <= 24:
            continue
        if not oclock and _UNIT_AFTER.match(s[m.end():]):
            continue  # সাড়ে তিন ঘণ্টা is a duration, not half past three
        h = int(h) % 24
        mi = 0
        if prefix:
            frac = PREFIX_FRACTIONS[prefix]
            if frac < 0:  # পৌনে: a quarter to
                h, mi = (h - 1) if h > 1 else 12, 45
            else:
                mi = int(frac * 60)
        elif min_tok:
            mv = number_value(min_tok)
            if mv is not None and 0 <= mv <= 59 and mv == int(mv):
                mi = int(mv)
        return h, mi, h > 12 or h == 0
    return None


def parse_clock(text, now: Optional[datetime] = None) -> Optional[str]:
    """A spoken clock time as 24-hour "HH:MM", or None.

    With a part of the day (সকাল ৭টা, রাত ১০টা, 7 pm) the hour is fixed. Without one, a 12-hour
    figure (৭টায়) means its next occurrence after `now` (07:00 or 19:00), when `now` is given.
    """
    s = _norm(text)
    if not s:
        return None
    parts = _clock_parts(s)
    if not parts:
        return None
    h, mi, said_24h = parts
    part = day_part(s)
    if part and not said_24h:
        h = _apply_part(h, part)
    elif not part and not said_24h and 1 <= h <= 12 and now is not None:
        options = [h % 12, h % 12 + 12]
        cur = now.hour * 60 + now.minute
        h = min(options, key=lambda x: ((x * 60 + mi) - cur - 1) % 1440)
    if not (0 <= h <= 23 and 0 <= mi <= 59):
        return None
    return f"{h:02d}:{mi:02d}"


def is_relative(text) -> bool:
    """Whether the text says "after/in some time" (১০ মিনিট পরে) rather than a clock time."""
    s = _norm(text)
    if not s:
        return False
    if re.search(r"(পরে|পর|after|later)(?![ঀ-৿])", s) or re.match(r"^in\b", s):
        return parse_duration(s) is not None
    has_unit = _unit_amount(s, HOUR_WORDS) is not None or _unit_amount(s, MINUTE_WORDS) is not None
    return has_unit and _clock_parts(s) is None


# --- Bangla wording for confirmations --------------------------------------------------------

def bn_digits(n) -> str:
    return str(n).translate(TO_BN_DIGITS)


def bn_part(h: int) -> str:
    if 4 <= h < 6:
        return "ভোর"
    if 6 <= h < 12:
        return "সকাল"
    if 12 <= h < 15:
        return "দুপুর"
    if 15 <= h < 18:
        return "বিকেল"
    if 18 <= h < 20:
        return "সন্ধ্যা"
    return "রাত"


def bn_clock(hhmm: str) -> str:
    """'07:30' -> 'সকাল ৭টা ৩০ মিনিট', '21:00' -> 'রাত ৯টা' (for spoken confirmations)."""
    try:
        h, m = (int(x) for x in hhmm.split(":"))
    except (AttributeError, ValueError):
        return hhmm or ""
    h12 = h % 12 or 12
    out = f"{bn_part(h)} {bn_digits(h12)}টা"
    if m:
        out += f" {bn_digits(m)} মিনিট"
    return out


def bn_duration(minutes: int) -> str:
    """90 -> '১ ঘণ্টা ৩০ মিনিট', 30 -> '৩০ মিনিট'."""
    h, m = divmod(int(minutes), 60)
    parts = []
    if h:
        parts.append(f"{bn_digits(h)} ঘণ্টা")
    if m or not h:
        parts.append(f"{bn_digits(m)} মিনিট")
    return " ".join(parts)
