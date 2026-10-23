import struct

import numpy as np
import pytest

from core.companion.ogg import ogg_crc, read_ogg_pages, write_ogg_opus

opuslib = pytest.importorskip("opuslib_next")
if not hasattr(opuslib, "Decoder") or not hasattr(opuslib.Encoder, "encode"):
    pytest.skip("opuslib_next not available", allow_module_level=True)


def test_crc_known_value():
    # CRC of an all-zero Ogg page header region is 0; any change must alter it
    assert ogg_crc(b"") == 0
    assert ogg_crc(b"OggS") != ogg_crc(b"OggT")


def test_empty_stream_is_valid():
    pages = read_ogg_pages(write_ogg_opus([]))
    assert pages[0][0] == 0x02 and pages[-1][0] == 0x04


def test_roundtrip_decodes():
    from core.companion.audio import pcm_to_ogg_opus

    rate = 16000
    t = np.arange(int(rate * 1.0)) / rate  # 1 s, 440 Hz
    pcm = (np.sin(2 * np.pi * 440 * t) * 8000).astype(np.int16).tobytes()
    data = pcm_to_ogg_opus(pcm)

    pages = read_ogg_pages(data)  # raises on bad CRC / structure
    assert pages[0][0] == 0x02  # BOS
    assert pages[-1][0] == 0x04  # EOS
    head = pages[0][3][0]
    magic, version, channels, pre_skip, input_rate = struct.unpack_from("<8sBBHI", head)
    assert (magic, version, channels, input_rate) == (b"OpusHead", 1, 1, 16000)
    assert pages[1][3][0].startswith(b"OpusTags")

    packets = [p for page in pages[2:] for p in page[3]]
    assert len(packets) == 17  # ceil(1000 ms / 60 ms)
    # Granule positions increase and the last one trims the padding of the final frame
    granules = [g for _, g, _, _ in pages[2:]]
    assert granules == sorted(granules)
    assert granules[-1] == pre_skip + 48000

    dec = opuslib.Decoder(rate, 1)
    out = b"".join(dec.decode(p, 960) for p in packets)
    assert len(out) == 17 * 960 * 2
    samples = np.frombuffer(out, dtype=np.int16)
    assert np.abs(samples[2000:14000]).max() > 3000  # tone survived


def test_large_packets_use_lacing():
    pkts = [bytes([i % 256]) * 600 for i in range(40)]
    pages = read_ogg_pages(write_ogg_opus(pkts))
    got = [p for page in pages[2:] for p in page[3]]
    assert got == pkts
