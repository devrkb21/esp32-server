// TinyBot assets.bin builder (runs in the browser, no dependencies).
//
// Byte layout, as read by the firmware (xiaozhi-esp32 main/assets.cc, LvglStrategy):
//
//   offset 0   uint32 LE  file count N
//   offset 4   uint32 LE  checksum  = (sum of every byte after the 12-byte header) & 0xFFFF
//   offset 8   uint32 LE  length    = bytes after the 12-byte header (table + data)
//   offset 12  N x mmap_assets_table, 44 bytes each:
//                char     name[32]   NUL padded (the firmware reads it as a C string, so <= 31 bytes)
//                uint32   size       payload size, without the 2-byte magic
//                uint32   offset     from the start of the data area (= 12 + 44 * N)
//                uint16   width, uint16 height   (0 for non-images)
//   data area: for each file "ZZ" (0x5A 0x5A) followed by the payload.
//
// The firmware rejects the partition when length is 0 or > partition size - 12, or when the
// checksum differs; GetAssetData() checks the "ZZ" magic. Assets::Download() also refuses a file
// larger than the partition (TinyBot 4 MB layout: `assets` = 0x100000 bytes).
//
// srmodels.bin is the esp-sr packed model format (esp-sr model/pack_model.py, srmodel_load()):
//
//   uint32 model count M
//   M x { char model_name[32]; uint32 file_count F; F x { char file_name[32]; uint32 start; uint32 len } }
//   file data, concatenated; `start` is counted from the start of srmodels.bin.

export const ASSETS_PARTITION_SIZE = 0x100000;
export const HEADER_SIZE = 12;
export const TABLE_ENTRY_SIZE = 44;
export const NAME_FIELD_SIZE = 32;
// asset_name is used as a C string: 31 visible bytes + NUL
export const MAX_NAME_BYTES = 31;
export const ASSET_MAGIC = 0x5a; // "Z", written twice before each file
export const ASSETS_VERSION = 1; // firmware refuses index.json "version" > 1
export const SRMODELS_FILE = 'srmodels.bin';
export const INDEX_FILE = 'index.json';

const MODEL_ENTRY_SIZE = 36; // name[32] + file count
const MODEL_FILE_ENTRY_SIZE = 40; // name[32] + start + len

// Order used by esp-sr's own packer for a WakeNet9 directory (matches the factory TinyBot image).
export const WAKENET_FILES = ['wn9_data', 'wn9_index', '_MODEL_INFO_'];

// ------------------------------------------------------------------ catalog

// WakeNet9 models that ESP32-S3 + AFE can load (wn9s_* are for C3/C6, wn7/wn8 are older formats,
// MultiNet models are 2.6 MB+ and do not fit the 1 MB partition). `size` is the total bytes of the
// three model files in public/generator/static/wakenet_model/<id>/ (used for the size meter before
// the files are downloaded).
export const DEFAULT_WAKE_WORD = 'wn9_hiesp';

export const WAKE_WORDS = [
  { id: 'wn9_hiesp', phrase: 'Hi ESP', lang: 'en', size: 290982 },
  { id: 'wn9_alexa', phrase: 'Alexa', lang: 'en', size: 290874 },
  { id: 'wn9_jarvis_tts', phrase: 'Jarvis', lang: 'en', size: 291010 },
  { id: 'wn9_computer_tts', phrase: 'Computer', lang: 'en', size: 290879 },
  { id: 'wn9_sophia_tts', phrase: 'Sophia', lang: 'en', size: 291011 },
  { id: 'wn9_mycroft_tts', phrase: 'Mycroft', lang: 'en', size: 290878 },
  { id: 'wn9_heywillow_tts', phrase: 'Hey Willow', lang: 'en', size: 290881 },
  { id: 'wn9_heywanda_tts', phrase: 'Hey Wanda', lang: 'en', size: 290880 },
  { id: 'wn9_heyivy_tts2', phrase: 'Hey Ivy', lang: 'en', size: 290905 },
  { id: 'wn9_heyily_tts2', phrase: 'Hey Ily', lang: 'en', size: 290906 },
  { id: 'wn9_heyprinter_tts', phrase: 'Hey Printer', lang: 'en', size: 291011 },
  { id: 'wn9_hiandy_tts2', phrase: 'Hi Andy', lang: 'en', size: 290905 },
  { id: 'wn9_hijason_tts2', phrase: 'Hi Jason', lang: 'en', size: 290880 },
  { id: 'wn9_hijoy_tts', phrase: 'Hi Joy', lang: 'en', size: 290877 },
  { id: 'wn9_hijolly_tts2', phrase: 'Hi Jolly', lang: 'en', size: 290906 },
  { id: 'wn9_hifairy_tts2', phrase: 'Hi Fairy', lang: 'en', size: 290906 },
  { id: 'wn9_hilili_tts', phrase: 'Hi Lily', lang: 'en', size: 290891 },
  { id: 'wn9_hitelly_tts', phrase: 'Hi Telly', lang: 'en', size: 290880 },
  { id: 'wn9_himfive', phrase: 'Hi M Five', lang: 'en', size: 290878 },
  { id: 'wn9_histackchan_tts3', phrase: 'Hi Stack Chan', lang: 'en', size: 290911 },
  { id: 'wn9_hiwalle_tts2', phrase: 'Hi Wall-E', lang: 'en', size: 290894 },
  { id: 'wn9_astrolabe_tts', phrase: 'Astrolabe', lang: 'en', size: 290880 },
  { id: 'wn9_bluechip_tts2', phrase: 'BlueChip', lang: 'en', size: 290906 },
  { id: 'wn9_nihaoxiaozhi', phrase: 'Ni hao Xiaozhi', native: '你好小智', lang: 'zh', size: 290392 },
  { id: 'wn9_hilexin', phrase: 'Hi Lexin', native: '嗨，乐鑫', lang: 'zh', size: 290989 },
  { id: 'wn9_xiaoaitongxue', phrase: 'Xiao Ai tongxue', native: '小爱同学', lang: 'zh', size: 290990 },
  { id: 'wn9_haixiaowu_tts', phrase: 'Hi Xiaowu', native: 'Hi,小巫', lang: 'zh', size: 290880 },
  { id: 'wn9_himiaomiao_tts', phrase: 'Hi Miaomiao', native: 'Hi,喵喵', lang: 'zh', size: 290880 },
  { id: 'wn9_hixiaoxing_tts', phrase: 'Hi Xiaoxing', native: 'Hi,小星', lang: 'zh', size: 290880 },
  { id: 'wn9_hai1xiao3ou1_tts3', phrase: 'Hai Xiao Ou', native: '嗨小欧', lang: 'zh', size: 290907 },
  { id: 'wn9_miaomiaotongxue_tts', phrase: 'Miaomiao tongxue', native: '喵喵同学', lang: 'zh', size: 291015 },
  { id: 'wn9_nihaoxiaoxin_tts', phrase: 'Ni hao Xiaoxin', native: '你好小鑫', lang: 'zh', size: 291015 },
  { id: 'wn9_nihaoxiaoyi_tts2', phrase: 'Ni hao Xiaoyi', native: '你好小益', lang: 'zh', size: 290911 },
  { id: 'wn9_nihaoxiaoan_tts2', phrase: 'Ni hao Xiaoan', lang: 'zh', size: 290909 },
  { id: 'wn9_nihaobaiying_tts2', phrase: 'Ni hao Baiying', native: '你好百应', lang: 'zh', size: 290911 },
  { id: 'wn9_nihaodongdong_tts2', phrase: 'Ni hao Dongdong', native: '你好东东', lang: 'zh', size: 290910 },
  { id: 'wn9_nihaomiaoban_tts2', phrase: 'Ni hao Miaoban', native: '你好喵伴', lang: 'zh', size: 290910 },
  { id: 'wn9_ni3hao3xiao3mai4_tts2', phrase: 'Ni hao Xiaomai', native: '你好小脉', lang: 'zh', size: 290910 },
  { id: 'wn9_ni3hao3xiao3rui4_tts3', phrase: 'Ni hao Xiaorui', lang: 'zh', size: 290912 },
  { id: 'wn9_xiao3feng1xiao3feng1_tts3', phrase: 'Xiaofeng Xiaofeng', native: '小峰小峰', lang: 'zh', size: 290910 },
  { id: 'wn9_xiao3jia1xiao3jia1_tts3', phrase: 'Xiaojia Xiaojia', native: '小珈小珈', lang: 'zh', size: 290910 },
  { id: 'wn9_xiaobinxiaobin_tts', phrase: 'Xiaobin Xiaobin', native: '小滨小滨', lang: 'zh', size: 290896 },
  { id: 'wn9_xiaojianxiaojian_tts2', phrase: 'Xiaojian Xiaojian', native: '小箭小箭', lang: 'zh', size: 290911 },
  { id: 'wn9_xiaolongxiaolong_tts', phrase: 'Xiaolong Xiaolong', native: '小龙小龙', lang: 'zh', size: 290883 },
  { id: 'wn9_xiaoluxiaolu_tts2', phrase: 'Xiaolu Xiaolu', native: '小鹿小鹿', lang: 'zh', size: 290910 },
  { id: 'wn9_xiaotexiaote_tts2', phrase: 'Xiaote Xiaote', native: '小特小特', lang: 'zh', size: 290911 },
  { id: 'wn9_xiaoyaxiaoya_tts2', phrase: 'Xiaoya Xiaoya', native: '小鸭小鸭', lang: 'zh', size: 290883 },
  { id: 'wn9_xiaokangtongxue_tts2', phrase: 'Xiaokang tongxue', native: '小康同学', lang: 'zh', size: 290884 },
  { id: 'wn9_xiaomeitongxue_tts', phrase: 'Xiaomei tongxue', native: '小美同学', lang: 'zh', size: 291015 },
  { id: 'wn9_xiaomingtongxue_tts2', phrase: 'Xiaoming tongxue', native: '小明同学', lang: 'zh', size: 290884 },
  { id: 'wn9_xiaoyutongxue_tts2', phrase: 'Xiaoyu tongxue', native: '小宇同学', lang: 'zh', size: 290882 },
  { id: 'wn9_xiaosurou_tts2', phrase: 'Xiao Surou', native: '小酥肉', lang: 'zh', size: 290881 },
  { id: 'wn9_linaiban_tts2', phrase: 'Linaiban', lang: 'zh', size: 290880 },
];

// Chat text fonts. TinyBot draws its subtitle in an 11 px strip with the built-in 8 px pixel font
// (CONFIG_LV_FONT_UNSCII_8), and TinyBotDisplay::SetTextFont() refuses replacement fonts, so the
// prebuilt 14 px cbin fonts are listed but marked unsupported: packing one would only cost flash.
// Flip `tinybot` to true once the firmware accepts a custom text font.
export const BUILTIN_FONT = 'builtin';

export const TEXT_FONTS = [
  { id: BUILTIN_FONT, file: null, px: 8, bpp: 1, size: 0, tinybot: true },
  {
    id: 'font_puhui_deepseek_14_1',
    file: 'font_puhui_deepseek_14_1.bin',
    px: 14,
    bpp: 1,
    charset: 'deepseek',
    size: 272172,
    tinybot: false,
  },
  {
    id: 'font_noto_qwen_14_1',
    file: 'font_noto_qwen_14_1.bin',
    px: 14,
    bpp: 1,
    charset: 'qwen',
    size: 641408,
    tinybot: false,
  },
];

export function findWakeWord(id) {
  return WAKE_WORDS.find((w) => w.id === id) || null;
}

export function findFont(id) {
  return TEXT_FONTS.find((f) => f.id === id) || null;
}

// ------------------------------------------------------------------ helpers

const encoder = new TextEncoder();

function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (typeof data === 'string') return encoder.encode(data);
  throw new TypeError('Asset data must be bytes or a string');
}

function writeName(view, bytes, offset, name, maxBytes) {
  const encoded = encoder.encode(name);
  if (encoded.length === 0) throw new Error('Asset name is empty');
  if (encoded.length > maxBytes) {
    throw new Error(`Name "${name}" is ${encoded.length} bytes; the limit is ${maxBytes}`);
  }
  bytes.set(encoded, offset); // rest of the field stays 0 (NUL padding)
}

export function checksum16(bytes, start = 0, end = bytes.length) {
  let sum = 0;
  for (let i = start; i < end; i++) sum = (sum + bytes[i]) & 0xffff; // same as (total & 0xFFFF)
  return sum;
}

// Sort like the firmware's packer (scripts/build_default_assets.py sort_key): extension, then name
export function sortAssetFiles(files) {
  const key = (name) => {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? [name.slice(dot), name.slice(0, dot)] : ['', name];
  };
  return files.slice().sort((a, b) => {
    const [ea, ba] = key(a.name);
    const [eb, bb] = key(b.name);
    if (ea !== eb) return ea < eb ? -1 : 1;
    if (ba !== bb) return ba < bb ? -1 : 1;
    return 0;
  });
}

// ------------------------------------------------------------------ srmodels.bin

export function srmodelsSize(models) {
  let size = 4;
  for (const model of models) {
    size += MODEL_ENTRY_SIZE + model.files.length * MODEL_FILE_ENTRY_SIZE;
    for (const file of model.files) size += file.size !== undefined ? file.size : toBytes(file.data).length;
  }
  return size;
}

// models: [{ name: 'wn9_hiesp', files: [{ name: 'wn9_data', data }, ...] }]
export function packSrmodels(models) {
  if (!Array.isArray(models) || models.length === 0) throw new Error('No speech model to pack');
  const prepared = models.map((model) => ({
    name: model.name,
    files: model.files.map((file) => ({ name: file.name, data: toBytes(file.data) })),
  }));
  let headerLen = 4;
  for (const model of prepared) headerLen += MODEL_ENTRY_SIZE + model.files.length * MODEL_FILE_ENTRY_SIZE;
  const total = prepared.reduce((sum, m) => sum + m.files.reduce((s, f) => s + f.data.length, 0), headerLen);

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let pos = 0;
  view.setUint32(pos, prepared.length, true);
  pos += 4;
  let dataPos = headerLen;
  for (const model of prepared) {
    writeName(view, out, pos, model.name, NAME_FIELD_SIZE);
    pos += NAME_FIELD_SIZE;
    view.setUint32(pos, model.files.length, true);
    pos += 4;
    for (const file of model.files) {
      writeName(view, out, pos, file.name, NAME_FIELD_SIZE);
      pos += NAME_FIELD_SIZE;
      view.setUint32(pos, dataPos, true);
      view.setUint32(pos + 4, file.data.length, true);
      pos += 8;
      out.set(file.data, dataPos);
      dataPos += file.data.length;
    }
  }
  return out;
}

export function parseSrmodels(input) {
  const bytes = toBytes(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(0, true);
  const models = [];
  let pos = 4;
  for (let i = 0; i < count; i++) {
    const name = readName(bytes, pos);
    const fileCount = view.getUint32(pos + NAME_FIELD_SIZE, true);
    pos += MODEL_ENTRY_SIZE;
    const files = [];
    for (let j = 0; j < fileCount; j++) {
      const start = view.getUint32(pos + NAME_FIELD_SIZE, true);
      const len = view.getUint32(pos + NAME_FIELD_SIZE + 4, true);
      files.push({ name: readName(bytes, pos), start, len, data: bytes.subarray(start, start + len) });
      pos += MODEL_FILE_ENTRY_SIZE;
    }
    models.push({ name, files });
  }
  return models;
}

// ------------------------------------------------------------------ index.json

export function buildIndexJson({ srmodels = null, textFont = null, display = null } = {}) {
  const index = { version: ASSETS_VERSION, chip_model: 'esp32s3' };
  if (display) {
    index.display_config = { width: display.width, height: display.height, monochrome: !!display.monochrome };
  }
  if (srmodels) index.srmodels = srmodels;
  if (textFont && textFont.file) {
    index.text_font = textFont.file;
    index.text_font_meta = { size: textFont.px, bpp: textFont.bpp };
    if (textFont.charset) index.text_font_meta.charset = textFont.charset;
  }
  return index;
}

// ------------------------------------------------------------------ assets.bin

export function assetsSize(sizes) {
  return HEADER_SIZE + sizes.reduce((sum, size) => sum + TABLE_ENTRY_SIZE + 2 + size, 0);
}

// files: [{ name, data, width?, height? }] -> Uint8Array in the firmware's partition format
export function packAssets(files, { limit = ASSETS_PARTITION_SIZE } = {}) {
  if (!Array.isArray(files) || files.length === 0) throw new Error('No files to pack');
  const names = new Set();
  const sorted = sortAssetFiles(files).map((file) => {
    if (names.has(file.name)) throw new Error(`Duplicate asset name "${file.name}"`);
    names.add(file.name);
    return { ...file, data: toBytes(file.data) };
  });

  const total = assetsSize(sorted.map((f) => f.data.length));
  if (limit && total > limit) {
    const err = new Error(`assets.bin is ${total} bytes; the partition holds ${limit}`);
    err.code = 'TOO_LARGE';
    err.size = total;
    err.limit = limit;
    throw err;
  }

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  const tableStart = HEADER_SIZE;
  const dataStart = HEADER_SIZE + sorted.length * TABLE_ENTRY_SIZE;
  let dataOffset = 0;
  sorted.forEach((file, i) => {
    const entry = tableStart + i * TABLE_ENTRY_SIZE;
    writeName(view, out, entry, file.name, MAX_NAME_BYTES);
    view.setUint32(entry + 32, file.data.length, true);
    view.setUint32(entry + 36, dataOffset, true);
    view.setUint16(entry + 40, file.width || 0, true);
    view.setUint16(entry + 42, file.height || 0, true);
    out[dataStart + dataOffset] = ASSET_MAGIC;
    out[dataStart + dataOffset + 1] = ASSET_MAGIC;
    out.set(file.data, dataStart + dataOffset + 2);
    dataOffset += 2 + file.data.length;
  });

  view.setUint32(0, sorted.length, true);
  view.setUint32(4, checksum16(out, HEADER_SIZE), true);
  view.setUint32(8, total - HEADER_SIZE, true);
  return out;
}

function readName(bytes, offset) {
  let end = offset;
  while (end < offset + NAME_FIELD_SIZE && bytes[end] !== 0) end++;
  return new TextDecoder().decode(bytes.subarray(offset, end));
}

// Reads assets.bin the way the firmware does; throws on anything the firmware would reject.
export function parseAssets(input, { partitionSize = ASSETS_PARTITION_SIZE } = {}) {
  const bytes = toBytes(input);
  if (bytes.length < HEADER_SIZE) throw new Error('File is shorter than the header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(0, true);
  const storedChecksum = view.getUint32(4, true);
  const length = view.getUint32(8, true);
  if (length === 0 || length > partitionSize - HEADER_SIZE) throw new Error('Length does not fit the partition');
  if (HEADER_SIZE + length !== bytes.length) throw new Error('Length does not match the file size');
  const calculated = checksum16(bytes, HEADER_SIZE);
  if (calculated !== storedChecksum) throw new Error('Checksum mismatch');
  const dataStart = HEADER_SIZE + count * TABLE_ENTRY_SIZE;
  const files = [];
  for (let i = 0; i < count; i++) {
    const entry = HEADER_SIZE + i * TABLE_ENTRY_SIZE;
    const size = view.getUint32(entry + 32, true);
    const offset = view.getUint32(entry + 36, true);
    const at = dataStart + offset;
    if (bytes[at] !== ASSET_MAGIC || bytes[at + 1] !== ASSET_MAGIC) throw new Error('Missing ZZ magic');
    if (at + 2 + size > bytes.length) throw new Error('Asset runs past the end of the file');
    files.push({
      name: readName(bytes, entry),
      size,
      offset,
      width: view.getUint16(entry + 40, true),
      height: view.getUint16(entry + 42, true),
      data: bytes.subarray(at + 2, at + 2 + size),
    });
  }
  return { count, checksum: storedChecksum, length, files };
}

// ------------------------------------------------------------------ TinyBot theme

// Bytes the finished file will take, from catalog sizes (before any model is downloaded).
export function estimateTinybotAssets({ wakeWord, font, display } = {}) {
  const parts = [];
  const ww = wakeWord ? findWakeWord(wakeWord) : null;
  if (ww) {
    const sr = 4 + MODEL_ENTRY_SIZE + WAKENET_FILES.length * MODEL_FILE_ENTRY_SIZE + ww.size;
    parts.push({ name: SRMODELS_FILE, size: sr });
  }
  const f = font ? findFont(font) : null;
  if (f && f.file) parts.push({ name: f.file, size: f.size });
  const index = buildIndexJson({ srmodels: ww ? SRMODELS_FILE : null, textFont: f, display });
  parts.push({ name: INDEX_FILE, size: encoder.encode(JSON.stringify(index)).length });
  return { parts, total: assetsSize(parts.map((p) => p.size)) };
}

// wakeModel: { name, files: [{ name, data }] } or null; font: catalog font + { data } or null
export function buildTinybotAssets({ wakeModel = null, font = null, display = null, limit = ASSETS_PARTITION_SIZE } = {}) {
  const files = [];
  if (wakeModel) files.push({ name: SRMODELS_FILE, data: packSrmodels([wakeModel]) });
  const useFont = font && font.file && font.data ? font : null;
  if (useFont) files.push({ name: useFont.file, data: useFont.data });
  const index = buildIndexJson({ srmodels: wakeModel ? SRMODELS_FILE : null, textFont: useFont, display });
  files.push({ name: INDEX_FILE, data: JSON.stringify(index) });
  const bytes = packAssets(files, { limit });
  return { bytes, index, size: bytes.length, files: files.map((f) => ({ name: f.name, size: toBytes(f.data).length })) };
}

// ------------------------------------------------------------------ device tool results

// /device/tools/call returns either the parsed JSON, a string, or the raw MCP result
export function parseToolData(data) {
  if (data == null) return null;
  if (typeof data === 'string') {
    const text = data.trim();
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        return JSON.parse(text);
      } catch (e) {
        return text;
      }
    }
    return text;
  }
  if (typeof data === 'object' && Array.isArray(data.content) && data.content[0] && data.content[0].type === 'text') {
    return parseToolData(data.content[0].text);
  }
  return data;
}

// Assets partition size from self.get_system_info, else the TinyBot default
export function assetsPartitionSize(systemInfo) {
  const table = systemInfo && Array.isArray(systemInfo.partition_table) ? systemInfo.partition_table : [];
  const part = table.find((p) => p && p.label === 'assets');
  return part && Number(part.size) > 0 ? Number(part.size) : ASSETS_PARTITION_SIZE;
}

export function isTinybot({ systemInfo = null, screen = null, board = '' } = {}) {
  const boardInfo = systemInfo && systemInfo.board ? systemInfo.board : {};
  const names = [board, boardInfo.type, boardInfo.name].filter(Boolean).join(' ').toLowerCase();
  if (names.includes('tinybot')) return true;
  return !!(screen && screen.width === 128 && screen.height === 64 && screen.monochrome);
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '–';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
