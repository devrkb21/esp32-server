// Pure helpers shared by the Voices and Voice clone pages (no Vue, no DOM), unit-tested in
// tests/voices.test.mjs.

// The training state of a voice slot, as the server reports it: hasVoice false means no sample
// has been uploaded yet; trainStatus 0 waiting, 1 training, 2 ready, 3 failed.
export function trainState(row) {
  if (!row || !row.hasVoice) return 'upload';
  switch (row.trainStatus) {
    case 0: return 'waiting';
    case 1: return 'training';
    case 2: return 'ready';
    case 3: return 'failed';
    default: return 'unknown';
  }
}

// The tag ink for each state (always shown with its word).
export const STATE_INK = {
  upload: 'ink-2',
  waiting: 'warn',
  training: 'message',
  ready: 'ok',
  failed: 'danger',
  unknown: 'ink-2',
};

// The i18n key of each state's word.
export const STATE_KEY = {
  upload: 'voices.state.upload',
  waiting: 'voices.state.waiting',
  training: 'voices.state.training',
  ready: 'voices.state.ready',
  failed: 'voices.state.failed',
  unknown: 'voices.state.unknown',
};

// Where a voice resource's sample lives: its own demo URL, else the bundled demo by voice key.
export function sampleUrl(row) {
  if (!row) return '';
  const own = row.voiceDemo || row.voice_demo;
  if (own) return own;
  const key = row.ttsVoice || row.voiceId || row.id;
  return key ? `/voice-demos/${key}.mp3` : '';
}

// Sample length the server accepts for cloning, in seconds (from the legacy dialog: 8 to 60).
export const MIN_SECONDS = 8;
export const MAX_SECONDS = 60;
export function durationOk(seconds) {
  return Number.isFinite(seconds) && seconds >= MIN_SECONDS && seconds <= MAX_SECONDS;
}

// Seconds covered by a selection given as two fractions (0..1) of a clip; the whole clip when
// nothing is selected.
export function selectionSeconds(start, end, duration) {
  if (!duration) return 0;
  if (start === null || start === undefined || end === null || end === undefined) return duration;
  return Math.abs(end - start) * duration;
}

// Mean absolute amplitude of `count` equal slices of one channel: the waveform's bars.
export function peaks(channel, count) {
  const out = [];
  if (!channel || !count) return out;
  const step = Math.max(1, Math.floor(channel.length / count));
  for (let i = 0; i < count; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) sum += Math.abs(channel[i * step + j] || 0);
    out.push(sum / step);
  }
  return out;
}

// Encode an AudioBuffer-like object ({ numberOfChannels, sampleRate, length, getChannelData })
// as 16-bit PCM WAV, the format the trimmed or recorded sample is uploaded in.
export function encodeWav(buffer) {
  const channels = buffer.numberOfChannels;
  const length = buffer.length * channels * 2 + 44;
  const out = new ArrayBuffer(length);
  const view = new DataView(out);
  let pos = 0;
  const u16 = (v) => { view.setUint16(pos, v, true); pos += 2; };
  const u32 = (v) => { view.setUint32(pos, v, true); pos += 4; };
  u32(0x46464952); u32(length - 8); u32(0x45564157); // "RIFF" <size> "WAVE"
  u32(0x20746d66); u32(16); u16(1); u16(channels); // "fmt " PCM
  u32(buffer.sampleRate); u32(buffer.sampleRate * 2 * channels); u16(channels * 2); u16(16);
  u32(0x61746164); u32(length - pos - 4); // "data" <size>
  const data = [];
  for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c));
  let offset = 0;
  while (pos < length) {
    for (let c = 0; c < channels; c++) {
      let s = Math.max(-1, Math.min(1, data[c][offset] || 0));
      s = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(pos, s, true);
      pos += 2;
    }
    offset++;
  }
  return out;
}

// "2025-03-02 14:05:00" (the server's format) or an ISO string, as a Date; null when unusable.
export function parseServerDate(value) {
  if (!value) return null;
  const d = new Date(typeof value === 'string' && /^\d{4}-\d\d-\d\d \d/.test(value) ? value.replace(' ', 'T') : value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// A short date and time in the reader's language (Bangla digits in Bangla).
export function dateText(value, lang) {
  const d = parseServerDate(value);
  if (!d) return '';
  const locale = lang === 'bn' ? 'bn-BD' : 'en-GB';
  try {
    // 24-hour clock in Bangla, where Intl would print a Latin "AM/PM".
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: lang !== 'bn' }).format(d);
  } catch (e) {
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }
}

// Seconds as m:ss.
export function clockText(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// The i18n key for a language name the server stores as free text ("Bangla, English"); null
// when the name is not one we translate, so the raw value is shown.
const LANG_KEY = {
  bangla: 'voices.lang.bangla', bengali: 'voices.lang.bangla', 'বাংলা': 'voices.lang.bangla', bn: 'voices.lang.bangla',
  english: 'voices.lang.english', 'ইংরেজি': 'voices.lang.english', en: 'voices.lang.english',
};
export function languageKey(name) {
  return LANG_KEY[String(name || '').trim().toLowerCase()] || null;
}

// The languages field in the reader's language: each comma-separated name translated through
// `t` when known, else kept as the server sent it.
export function languagesText(value, t) {
  if (!value) return '';
  return String(value).split(',').map((s) => s.trim()).filter(Boolean)
    .map((name) => { const key = languageKey(name); return key ? t(key) : name; })
    .join(', ');
}
