import base64

import pytest

from core.companion import text_bitmap
from core.companion.text_bitmap import LINE_HEIGHT, bitmap_payload, needs_bitmap, render_line

pytestmark = pytest.mark.skipif(text_bitmap.hb is None, reason="uharfbuzz / Pillow not installed")


def test_only_bangla_needs_a_bitmap():
    assert needs_bitmap("আমি টিনিবট")
    assert needs_bitmap("Hello বন্ধু")
    assert not needs_bitmap("Hello friend")
    assert not needs_bitmap("你好")
    assert bitmap_payload("Hello friend") is None


def test_rows_are_packed_msb_first():
    w, h, bits = render_line("আমি টিনিবট")
    assert h == LINE_HEIGHT
    assert 40 < w < 200
    assert len(bits) == (w + 7) // 8 * h
    assert any(bits)


def test_conjuncts_are_shaped():
    # A shaped conjunct is narrower than its letters drawn side by side
    assert render_line("ক্ষ")[0] < render_line("ক ষ")[0]


def test_payload_matches_the_firmware_format():
    p = bitmap_payload("তোমার বন্ধু!")
    data = base64.b64decode(p["data"])
    assert p["h"] == LINE_HEIGHT
    assert len(data) == (p["w"] + 7) // 8 * p["h"]


def test_long_lines_are_capped():
    w, _, _ = render_line("আমি টিনিবট " * 200)
    assert w <= text_bitmap.MAX_WIDTH + 1
