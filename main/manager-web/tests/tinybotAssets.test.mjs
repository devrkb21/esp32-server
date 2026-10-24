import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as assets from '../src/utils/tinybotAssets.mjs';
import {
  ASSETS_PARTITION_SIZE,
  DEFAULT_WAKE_WORD,
  HEADER_SIZE,
  TABLE_ENTRY_SIZE,
  WAKENET_FILES,
  WAKE_WORDS,
  assetsPartitionSize,
  buildIndexJson,
  buildTinybotAssets,
  checksum16,
  estimateTinybotAssets,
  isTinybot,
  packAssets,
  packSrmodels,
  parseAssets,
  parseSrmodels,
  parseToolData,
} from '../src/utils/tinybotAssets.mjs';

const STATIC = path.resolve(process.cwd(), 'public/generator/static') + '/';
const bytes = (...values) => new Uint8Array(values);
const u32 = (buf, at) => new DataView(buf.buffer, buf.byteOffset).getUint32(at, true);
const u16 = (buf, at) => new DataView(buf.buffer, buf.byteOffset).getUint16(at, true);
const nameAt = (buf, at) => new TextDecoder().decode(buf.subarray(at, at + 32)).replace(/\0+$/, '');

function readModel(id) {
  return {
    name: id,
    files: WAKENET_FILES.map((name) => ({ name, data: new Uint8Array(fs.readFileSync(`${STATIC}wakenet_model/${id}/${name}`)) })),
  };
}

describe('packAssets', () => {
  const files = [
    { name: 'index.json', data: '{"version":1}' },
    { name: 'b.bin', data: bytes(1, 2, 3) },
    { name: 'a.bin', data: bytes(0xff, 0x80) },
  ];
  const out = packAssets(files);

  it('writes the 12-byte header: count, checksum, length', () => {
    expect(u32(out, 0)).toBe(3);
    expect(u32(out, 8)).toBe(out.length - HEADER_SIZE);
    expect(u32(out, 4)).toBe(checksum16(out, HEADER_SIZE));
  });

  it('checksum is the unsigned byte sum after the header, masked to 16 bits', () => {
    let sum = 0;
    for (let i = HEADER_SIZE; i < out.length; i++) sum += out[i];
    expect(u32(out, 4)).toBe(sum & 0xffff);
    expect(u32(out, 4)).toBeLessThanOrEqual(0xffff);
  });

  it('sorts entries by extension then name and writes 44-byte table rows', () => {
    const names = [0, 1, 2].map((i) => nameAt(out, HEADER_SIZE + i * TABLE_ENTRY_SIZE));
    expect(names).toEqual(['a.bin', 'b.bin', 'index.json']);
    const row = HEADER_SIZE + TABLE_ENTRY_SIZE; // b.bin
    expect(u32(out, row + 32)).toBe(3); // size without magic
    expect(u32(out, row + 36)).toBe(2 + 2); // after a.bin (ZZ + 2 bytes)
    expect(u16(out, row + 40)).toBe(0);
    expect(u16(out, row + 42)).toBe(0);
    expect(out[row + 31]).toBe(0); // NUL padded name field
  });

  it('offsets count from the end of the table and every file starts with ZZ', () => {
    const dataStart = HEADER_SIZE + 3 * TABLE_ENTRY_SIZE;
    const row = HEADER_SIZE + TABLE_ENTRY_SIZE;
    const at = dataStart + u32(out, row + 36);
    expect([out[at], out[at + 1]]).toEqual([0x5a, 0x5a]);
    expect(Array.from(out.subarray(at + 2, at + 5))).toEqual([1, 2, 3]);
    expect(out[dataStart]).toBe(0x5a);
  });

  it('round-trips through the firmware-style parser', () => {
    const parsed = parseAssets(out);
    expect(parsed.files.map((f) => [f.name, f.size])).toEqual([['a.bin', 2], ['b.bin', 3], ['index.json', 13]]);
    expect(new TextDecoder().decode(parsed.files[2].data)).toBe('{"version":1}');
  });

  it('rejects names the firmware cannot read and duplicates', () => {
    expect(() => packAssets([{ name: 'x'.repeat(32), data: bytes(1) }])).toThrow(/limit is 31/);
    expect(() => packAssets([{ name: 'a.bin', data: bytes(1) }, { name: 'a.bin', data: bytes(2) }])).toThrow(/Duplicate/);
    expect(() => packAssets([])).toThrow();
  });

  it('parser rejects a corrupted checksum', () => {
    const copy = out.slice();
    copy[copy.length - 1] ^= 0xff;
    expect(() => parseAssets(copy)).toThrow(/Checksum/);
  });
});

describe('1 MB partition limit', () => {
  it('accepts a file of exactly the partition size', () => {
    const payload = ASSETS_PARTITION_SIZE - HEADER_SIZE - TABLE_ENTRY_SIZE - 2;
    const out = packAssets([{ name: 'fill.bin', data: new Uint8Array(payload) }]);
    expect(out.length).toBe(ASSETS_PARTITION_SIZE);
    expect(() => parseAssets(out)).not.toThrow();
  });

  it('refuses one byte more', () => {
    const payload = ASSETS_PARTITION_SIZE - HEADER_SIZE - TABLE_ENTRY_SIZE - 1;
    let error = null;
    try {
      packAssets([{ name: 'fill.bin', data: new Uint8Array(payload) }]);
    } catch (e) {
      error = e;
    }
    expect(error && error.code).toBe('TOO_LARGE');
    expect(error.size).toBe(ASSETS_PARTITION_SIZE + 1);
    expect(error.limit).toBe(ASSETS_PARTITION_SIZE);
  });

  it('uses the partition size the robot reports', () => {
    expect(assetsPartitionSize({ partition_table: [{ label: 'assets', size: 2097152 }] })).toBe(2097152);
    expect(assetsPartitionSize({})).toBe(ASSETS_PARTITION_SIZE);
  });
});

describe('packSrmodels (esp-sr format)', () => {
  const packed = packSrmodels([{ name: 'wn9_test', files: [{ name: 'wn9_data', data: bytes(9, 8, 7) }, { name: '_MODEL_INFO_', data: 'hi' }] }]);

  it('writes count, model entry, file entries with absolute starts', () => {
    expect(u32(packed, 0)).toBe(1);
    expect(nameAt(packed, 4)).toBe('wn9_test');
    expect(u32(packed, 36)).toBe(2);
    const headerLen = 4 + 36 + 2 * 40;
    expect(nameAt(packed, 40)).toBe('wn9_data');
    expect(u32(packed, 72)).toBe(headerLen);
    expect(u32(packed, 76)).toBe(3);
    expect(u32(packed, 112)).toBe(headerLen + 3);
    expect(u32(packed, 116)).toBe(2);
    expect(packed.length).toBe(headerLen + 5);
  });

  it('round-trips', () => {
    const [model] = parseSrmodels(packed);
    expect(model.files.map((f) => [f.name, Array.from(f.data)])).toEqual([['wn9_data', [9, 8, 7]], ['_MODEL_INFO_', [104, 105]]]);
  });
});

describe('index.json', () => {
  it('has version 1 and the speech model', () => {
    const index = buildIndexJson({ srmodels: 'srmodels.bin', display: { width: 128, height: 64, monochrome: true } });
    expect(index.version).toBe(1);
    expect(index.srmodels).toBe('srmodels.bin');
    expect(index.display_config).toEqual({ width: 128, height: 64, monochrome: true });
    expect(index).not.toHaveProperty('text_font');
    expect(index).not.toHaveProperty('emoji_collection');
    expect(index).not.toHaveProperty('skin');
  });

  // TinyBot itself no longer takes a text font (its chat fonts are built in), but the builder
  // still can, for other boards
  it('adds text_font and its meta only for a real font file', () => {
    const font = { file: 'font_puhui_deepseek_14_1.bin', px: 14, bpp: 1, charset: 'deepseek' };
    expect(buildIndexJson({ textFont: font }))
      .toMatchObject({ text_font: font.file, text_font_meta: { size: 14, bpp: 1, charset: 'deepseek' } });
    expect(buildIndexJson({ textFont: { file: null, px: 8, bpp: 1 } })).not.toHaveProperty('text_font');
  });
});

describe('buildTinybotAssets with the real Hi ESP model', () => {
  const display = { width: 128, height: 64, monochrome: true };
  const result = buildTinybotAssets({ wakeModel: readModel(DEFAULT_WAKE_WORD), display });
  const parsed = parseAssets(result.bytes);

  it('contains srmodels.bin and index.json only', () => {
    expect(parsed.files.map((f) => f.name)).toEqual(['srmodels.bin', 'index.json']);
    const index = JSON.parse(new TextDecoder().decode(parsed.files[1].data));
    expect(index).toEqual(result.index);
    expect(index.srmodels).toBe('srmodels.bin');
  });

  it('carries the WakeNet model byte for byte', () => {
    const [model] = parseSrmodels(parsed.files[0].data);
    expect(model.name).toBe('wn9_hiesp');
    const source = readModel(DEFAULT_WAKE_WORD);
    model.files.forEach((file, i) => {
      expect(file.name).toBe(source.files[i].name);
      expect(Buffer.compare(Buffer.from(file.data), Buffer.from(source.files[i].data))).toBe(0);
    });
  });

  it('matches the catalog estimate and fits 1 MB', () => {
    expect(estimateTinybotAssets({ wakeWord: DEFAULT_WAKE_WORD, display }).total).toBe(result.size);
    expect(result.size).toBeLessThan(ASSETS_PARTITION_SIZE);
  });

  it('can still pack a font file when one is given', () => {
    const data = new Uint8Array(fs.readFileSync(`${STATIC}fonts/font_puhui_deepseek_14_1.bin`));
    const font = { file: 'font_puhui_deepseek_14_1.bin', px: 14, bpp: 1, size: data.length, data };
    const withFont = buildTinybotAssets({ wakeModel: readModel(DEFAULT_WAKE_WORD), font, display });
    expect(parseAssets(withFont.bytes).files.map((f) => f.name).sort()).toEqual([font.file, 'index.json', 'srmodels.bin']);
    expect(withFont.index.text_font).toBe(font.file);
    expect(estimateTinybotAssets({ wakeWord: DEFAULT_WAKE_WORD, font, display }).total).toBe(withFont.size);
  });
});

describe('catalog', () => {
  it('only lists WakeNet9 models that exist in public/generator/static', () => {
    WAKE_WORDS.forEach((w) => {
      expect(w.id.startsWith('wn9_')).toBe(true);
      const size = WAKENET_FILES.reduce((sum, f) => sum + fs.statSync(`${STATIC}wakenet_model/${w.id}/${f}`).size, 0);
      expect(size).toBe(w.size);
    });
    expect(new Set(WAKE_WORDS.map((w) => w.id)).size).toBe(WAKE_WORDS.length);
  });

  it('offers no text fonts: TinyBot picks its chat font from settings.look.chat_font', () => {
    expect(assets).not.toHaveProperty('TEXT_FONTS');
    expect(assets).not.toHaveProperty('BUILTIN_FONT');
    expect(assets).not.toHaveProperty('findFont');
    expect(estimateTinybotAssets({ wakeWord: DEFAULT_WAKE_WORD }).parts.map((p) => p.name)).toEqual(['srmodels.bin', 'index.json']);
  });
});

describe('device helpers', () => {
  it('parses tool results in every shape the API returns', () => {
    expect(parseToolData('{"width":128}')).toEqual({ width: 128 });
    expect(parseToolData({ content: [{ type: 'text', text: '{"a":1}' }] })).toEqual({ a: 1 });
    expect(parseToolData({ width: 1 })).toEqual({ width: 1 });
    expect(parseToolData('ok')).toBe('ok');
    expect(parseToolData(null)).toBe(null);
  });

  it('recognises TinyBot by board or screen', () => {
    expect(isTinybot({ systemInfo: { board: { type: 'tinybot' } } })).toBe(true);
    expect(isTinybot({ screen: { width: 128, height: 64, monochrome: true } })).toBe(true);
    expect(isTinybot({ screen: { width: 240, height: 240, monochrome: false } })).toBe(false);
  });
});
