"""Minimal Ogg Opus (RFC 7845) writer and reader, no external tools needed."""

import struct
from typing import Iterable, List, Tuple

OPUS_GRANULE_RATE = 48000  # Ogg Opus granule positions always count 48 kHz samples
DEFAULT_PRE_SKIP = 312  # libopus encoder lookahead at 48 kHz (6.5 ms)
VENDOR = b"xiaozhi-companion"


def _make_crc_table():
    table = []
    for i in range(256):
        r = i << 24
        for _ in range(8):
            r = ((r << 1) ^ 0x04C11DB7) if (r & 0x80000000) else (r << 1)
        table.append(r & 0xFFFFFFFF)
    return table


_CRC_TABLE = _make_crc_table()


def ogg_crc(data: bytes) -> int:
    crc = 0
    for b in data:
        crc = ((crc << 8) & 0xFFFFFFFF) ^ _CRC_TABLE[((crc >> 24) & 0xFF) ^ b]
    return crc


def _lacing(packet_len: int) -> List[int]:
    values = [255] * (packet_len // 255)
    values.append(packet_len % 255)
    return values


def _page(header_type: int, granule: int, serial: int, seq: int, packets: List[bytes]) -> bytes:
    segments = []
    for p in packets:
        segments.extend(_lacing(len(p)))
    header = struct.pack(
        "<4sBBqIIIB",
        b"OggS",
        0,
        header_type,
        granule,
        serial,
        seq,
        0,
        len(segments),
    ) + bytes(segments)
    page = bytearray(header + b"".join(packets))
    struct.pack_into("<I", page, 22, ogg_crc(bytes(page)))
    return bytes(page)


def opus_head(channels: int = 1, input_rate: int = 16000, pre_skip: int = DEFAULT_PRE_SKIP) -> bytes:
    return struct.pack("<8sBBHIhB", b"OpusHead", 1, channels, pre_skip, input_rate, 0, 0)


def opus_tags(vendor: bytes = VENDOR) -> bytes:
    return b"OpusTags" + struct.pack("<I", len(vendor)) + vendor + struct.pack("<I", 0)


def write_ogg_opus(
    packets: Iterable[bytes],
    frame_ms: int = 60,
    input_rate: int = 16000,
    channels: int = 1,
    serial: int = 0x54696E79,
    pre_skip: int = DEFAULT_PRE_SKIP,
    packets_per_page: int = 16,
    total_samples: int = None,
) -> bytes:
    """Wrap raw Opus packets (all frame_ms long) into an Ogg Opus stream.

    total_samples: real PCM length at input_rate; when given, the last granule position trims
    the zero padding of the final frame.
    """
    packets = [bytes(p) for p in packets]
    samples_per_packet = OPUS_GRANULE_RATE * frame_ms // 1000
    out = [
        _page(0x02, 0, serial, 0, [opus_head(channels, input_rate, pre_skip)]),
        _page(0x00, 0, serial, 1, [opus_tags()]),
    ]
    seq = 2
    granule = 0
    final_granule = None
    if total_samples is not None:
        final_granule = pre_skip + total_samples * OPUS_GRANULE_RATE // input_rate

    if not packets:
        out.append(_page(0x04, 0, serial, seq, []))
        return b"".join(out)

    start = 0
    while start < len(packets):
        chunk = packets[start : start + packets_per_page]
        # A page holds at most 255 lacing values
        while len(chunk) > 1 and sum(len(_lacing(len(p))) for p in chunk) > 255:
            chunk = chunk[:-1]
        granule += samples_per_packet * len(chunk)
        start += len(chunk)
        last = start >= len(packets)
        g = granule
        if last and final_granule is not None:
            # Trim the padding of the last frame, but never go below the previous page
            g = min(granule, max(final_granule, granule - samples_per_packet + 1))
        out.append(_page(0x04 if last else 0x00, g, serial, seq, chunk))
        seq += 1
    return b"".join(out)


def read_ogg_pages(data: bytes) -> List[Tuple[int, int, int, List[bytes]]]:
    """Parse pages, verifying the CRC. Returns (header_type, granule, seq, packets)."""
    pages = []
    pos = 0
    pending = b""
    while pos < len(data):
        if data[pos : pos + 4] != b"OggS":
            raise ValueError(f"bad capture pattern at {pos}")
        (_, version, htype, granule, serial, seq, crc, nseg) = struct.unpack_from("<4sBBqIIIB", data, pos)
        if version != 0:
            raise ValueError("bad ogg version")
        lacing = data[pos + 27 : pos + 27 + nseg]
        body_len = sum(lacing)
        end = pos + 27 + nseg + body_len
        page = bytearray(data[pos:end])
        struct.pack_into("<I", page, 22, 0)
        if ogg_crc(bytes(page)) != crc:
            raise ValueError(f"bad crc on page {seq}")
        body = data[pos + 27 + nseg : end]
        packets = []
        off = 0
        for lv in lacing:
            pending += body[off : off + lv]
            off += lv
            if lv < 255:
                packets.append(pending)
                pending = b""
        pages.append((htype, granule, seq, packets))
        pos = end
    return pages
