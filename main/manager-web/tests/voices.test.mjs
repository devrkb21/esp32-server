import { describe, expect, it } from 'vitest';
import {
  durationOk, encodeWav, parseServerDate, peaks, sampleUrl, selectionSeconds, trainState, clockText,
  dateText, languageKey, languagesText,
} from '../src/views/voices/voiceModel.js';

describe('voiceModel', () => {
  it('maps the server training fields to one state', () => {
    expect(trainState({ hasVoice: false, trainStatus: 2 })).toBe('upload');
    expect(trainState({ hasVoice: true, trainStatus: 0 })).toBe('waiting');
    expect(trainState({ hasVoice: true, trainStatus: 1 })).toBe('training');
    expect(trainState({ hasVoice: true, trainStatus: 2 })).toBe('ready');
    expect(trainState({ hasVoice: true, trainStatus: 3 })).toBe('failed');
    expect(trainState({ hasVoice: true, trainStatus: 9 })).toBe('unknown');
    expect(trainState(null)).toBe('upload');
  });

  it('finds a sample the way the legacy page did', () => {
    expect(sampleUrl({ voiceDemo: 'https://x/a.mp3', voiceId: 'v' })).toBe('https://x/a.mp3');
    expect(sampleUrl({ voice_demo: '/b.mp3' })).toBe('/b.mp3');
    expect(sampleUrl({ ttsVoice: 'bn-BD-NabanitaNeural', voiceId: 'v' })).toBe('/voice-demos/bn-BD-NabanitaNeural.mp3');
    expect(sampleUrl({ voiceId: 'v1' })).toBe('/voice-demos/v1.mp3');
    expect(sampleUrl({ id: 'r1' })).toBe('/voice-demos/r1.mp3');
  });

  it('accepts 8 to 60 seconds only', () => {
    expect(durationOk(7.99)).toBe(false);
    expect(durationOk(8)).toBe(true);
    expect(durationOk(60)).toBe(true);
    expect(durationOk(60.01)).toBe(false);
    expect(durationOk(NaN)).toBe(false);
  });

  it('measures a selection, or the whole clip without one', () => {
    expect(selectionSeconds(null, null, 30)).toBe(30);
    expect(selectionSeconds(0.75, 0.25, 40)).toBe(20);
    expect(selectionSeconds(0, 1, 0)).toBe(0);
  });

  it('averages absolute amplitude per slice', () => {
    const ch = Float32Array.from([1, -1, 0.5, -0.5, 0, 0]);
    expect(peaks(ch, 3)).toEqual([1, 0.5, 0]);
    expect(peaks(null, 3)).toEqual([]);
  });

  it('writes a valid 16-bit PCM WAV header and samples', () => {
    const data = Float32Array.from([0, 1, -1, 0.5]);
    const buf = { numberOfChannels: 1, sampleRate: 16000, length: data.length, getChannelData: () => data };
    const out = new DataView(encodeWav(buf));
    expect(out.byteLength).toBe(44 + data.length * 2);
    const tag = (o) => String.fromCharCode(out.getUint8(o), out.getUint8(o + 1), out.getUint8(o + 2), out.getUint8(o + 3));
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(tag(36)).toBe('data');
    expect(out.getUint16(20, true)).toBe(1);
    expect(out.getUint32(24, true)).toBe(16000);
    expect(out.getUint32(40, true)).toBe(data.length * 2);
    expect(out.getInt16(44 + 2, true)).toBe(0x7FFF);
    expect(out.getInt16(44 + 4, true)).toBe(-0x8000);
  });

  it('reads the server date format', () => {
    const d = parseServerDate('2025-03-02 14:05:00');
    expect(d.getFullYear()).toBe(2025);
    expect(d.getHours()).toBe(14);
    expect(parseServerDate('')).toBe(null);
    expect(parseServerDate('nonsense')).toBe(null);
  });

  it('formats a clock', () => {
    expect(clockText(0)).toBe('0:00');
    expect(clockText(65.4)).toBe('1:05');
  });
});

describe('voiceModel display text', () => {
  it('uses a 24-hour clock in Bangla, with no Latin AM/PM', () => {
    const bn = dateText('2025-03-02 14:05:00', 'bn');
    expect(bn).not.toMatch(/AM|PM|am|pm/);
    expect(bn).toMatch(/১৪/);
    expect(dateText('2025-03-02 14:05:00', 'en')).toMatch(/pm/i);
    expect(dateText('', 'bn')).toBe('');
  });

  it('translates known language names and keeps the rest', () => {
    const t = (k) => ({ 'voices.lang.bangla': 'বাংলা', 'voices.lang.english': 'ইংরেজি' }[k]);
    expect(languageKey(' Bangla ')).toBe('voices.lang.bangla');
    expect(languageKey('english')).toBe('voices.lang.english');
    expect(languageKey('Hindi')).toBe(null);
    expect(languagesText('Bangla, English', t)).toBe('বাংলা, ইংরেজি');
    expect(languagesText('Bangla,Hindi', t)).toBe('বাংলা, Hindi');
    expect(languagesText('', t)).toBe('');
  });
});
