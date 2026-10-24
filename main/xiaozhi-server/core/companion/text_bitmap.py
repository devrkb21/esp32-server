"""Draw a chat line as a 1-bit bitmap for TinyBot's OLED.

The robot's fonts cannot shape Bangla (conjuncts, vowel signs placed before the consonant), so
the server shapes the line with HarfBuzz, rasterises the glyph outlines with Pillow and sends the
pixels. The firmware shows them in its chat strip ("text_bitmap" next to the text of tts / stt
messages) and scrolls lines wider than the screen.
"""

import base64
import os
import re
from functools import lru_cache

try:
    import numpy as np
    import uharfbuzz as hb
    from PIL import Image, ImageDraw
except ImportError:  # optional: without them the robot shows the plain text
    hb = None

FONT_PATH = os.path.join(os.path.dirname(__file__), "fonts", "NotoSansBengali.ttf")
LINE_HEIGHT = 20  # pixels; the OLED chat strip with the large font is about as tall
MAX_WIDTH = 2000  # pixels; longer lines are cut (the firmware rejects wider ones)
SUPERSAMPLE = 4
INK_THRESHOLD = 0.4  # share of a pixel that must be covered; a bit under half keeps strokes solid

# Scripts the robot's own fonts cannot draw properly
_NEEDS_BITMAP = re.compile(r"[ঀ-৿]")


def needs_bitmap(text: str) -> bool:
    return bool(text) and _NEEDS_BITMAP.search(text) is not None


class _PolygonPen:
    """Collects glyph contours as point lists, flattening the curves."""

    STEPS = 6

    def __init__(self):
        self.contours = []
        self._cur = []

    def moveTo(self, p):
        self._cur = [p]

    def lineTo(self, p):
        self._cur.append(p)

    def qCurveTo(self, *points):
        # TrueType quadratic spline: implied on-curve points between consecutive off-curve ones
        start = self._cur[-1]
        offs, end = list(points[:-1]), points[-1]
        for i, c in enumerate(offs):
            nxt = end if i == len(offs) - 1 else ((c[0] + offs[i + 1][0]) / 2, (c[1] + offs[i + 1][1]) / 2)
            for s in range(1, self.STEPS + 1):
                t = s / self.STEPS
                a, b = (1 - t) ** 2, 2 * (1 - t) * t
                self._cur.append((a * start[0] + b * c[0] + t * t * nxt[0], a * start[1] + b * c[1] + t * t * nxt[1]))
            start = nxt

    def curveTo(self, c1, c2, end):
        p0 = self._cur[-1]
        for s in range(1, self.STEPS + 1):
            t = s / self.STEPS
            u = 1 - t
            self._cur.append(tuple(
                u ** 3 * p0[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t ** 3 * end[k] for k in range(2)
            ))

    def closePath(self):
        if len(self._cur) > 2:
            self.contours.append(self._cur)
        self._cur = []

    endPath = closePath


@lru_cache(maxsize=1)
def _font():
    with open(FONT_PATH, "rb") as f:
        face = hb.Face(f.read())
    font = hb.Font(face)
    font.set_variations({"wght": 500})  # a little heavier than regular reads better on the OLED
    return font


@lru_cache(maxsize=1024)
def _glyph_contours(gid):
    pen = _PolygonPen()
    _font().draw_glyph_with_pen(gid, pen)
    return pen.contours


def render_line(text: str, height: int = LINE_HEIGHT):
    """Return (width, height, bits) with rows of (width + 7) // 8 bytes, MSB = left pixel; None if empty."""
    if hb is None or not text.strip():
        return None
    font = _font()
    buf = hb.Buffer()
    buf.add_str(" ".join(text.split()))
    buf.guess_segment_properties()
    hb.shape(font, buf, {"kern": True, "liga": True})

    ext = font.get_font_extents("ltr")
    scale = height * SUPERSAMPLE / (ext.ascender - ext.descender)
    baseline = ext.ascender * scale
    advance = sum(p.x_advance for p in buf.glyph_positions) * scale
    width_ss = min(int(advance) + SUPERSAMPLE * 2, MAX_WIDTH * SUPERSAMPLE)
    width_ss -= width_ss % SUPERSAMPLE
    height_ss = height * SUPERSAMPLE

    # Non-zero winding: every contour adds +1 or -1 by its direction, ink where the sum is not 0
    winding = np.zeros((height_ss, width_ss), dtype=np.int16)
    pen_x = SUPERSAMPLE  # one pixel margin on the left
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        ox, oy = pen_x + pos.x_offset * scale, pos.y_offset * scale
        for contour in _glyph_contours(info.codepoint):
            pts = [(ox + x * scale, baseline - (oy + y * scale)) for x, y in contour]
            # Draw the contour only within its own box, clipped to the canvas
            x0 = max(int(min(p[0] for p in pts)), 0)
            y0 = max(int(min(p[1] for p in pts)), 0)
            x1 = min(int(max(p[0] for p in pts)) + 2, width_ss)
            y1 = min(int(max(p[1] for p in pts)) + 2, height_ss)
            if x0 >= x1 or y0 >= y1:
                continue
            area = sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts)))
            mask = Image.new("1", (x1 - x0, y1 - y0), 0)
            ImageDraw.Draw(mask).polygon([(x - x0, y - y0) for x, y in pts], fill=1)
            winding[y0:y1, x0:x1] += np.asarray(mask, dtype=np.int16) * (1 if area > 0 else -1)
        pen_x += pos.x_advance * scale

    ink = (winding != 0).reshape(height, SUPERSAMPLE, width_ss // SUPERSAMPLE, SUPERSAMPLE).mean(axis=(1, 3))
    pixels = ink >= INK_THRESHOLD
    cols = np.flatnonzero(pixels.any(axis=0))
    if cols.size == 0:
        return None
    pixels = pixels[:, : cols[-1] + 2]
    w = pixels.shape[1]
    bits = np.packbits(pixels, axis=1)  # pads each row to whole bytes, MSB first
    return w, height, bits.tobytes()


def bitmap_payload(text: str):
    """The "text_bitmap" message field for text the robot cannot draw itself, else None."""
    if not needs_bitmap(text):
        return None
    try:
        drawn = render_line(text)
    except Exception:
        return None
    if drawn is None:
        return None
    w, h, bits = drawn
    return {"w": w, "h": h, "data": base64.b64encode(bits).decode("ascii")}
