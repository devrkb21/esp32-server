import { describe, expect, it } from 'vitest';
import { WAKE_WORDS } from '../src/utils/tinybotAssets.mjs';
import { STEP_KEYS, chipName, countByLang, fillRatio, filterWakeWords, flashText } from '../src/views/theme/themeModel.js';

describe('theme model', () => {
  it('filters wake words by language and query (phrase, native or id)', () => {
    expect(filterWakeWords({ lang: 'en' }).every((w) => w.lang === 'en')).toBe(true);
    expect(filterWakeWords({ query: 'ALEXA' }).map((w) => w.id)).toEqual(['wn9_alexa']);
    expect(filterWakeWords({ query: '你好小智' }).map((w) => w.id)).toEqual(['wn9_nihaoxiaozhi']);
    expect(filterWakeWords({ query: 'hiesp' }).map((w) => w.id)).toEqual(['wn9_hiesp']);
    expect(filterWakeWords({ lang: 'zh', query: 'jarvis' })).toEqual([]);
    expect(filterWakeWords({ query: '  ' }).length).toBe(WAKE_WORDS.length);
  });

  it('counts phrases per language', () => {
    const c = countByLang();
    expect(c.en + c.zh).toBe(WAKE_WORDS.length);
  });

  it('names the chip and flash as the legacy page did', () => {
    expect(chipName({ chip_model_name: 'esp32s3' })).toBe('ESP32-S3');
    expect(chipName({ chip_model_name: 'esp32' })).toBe('ESP32');
    expect(chipName(null)).toBe('');
    expect(flashText({ flash_size: 4194304 })).toBe('4 MB');
    expect(flashText({})).toBe('');
  });

  it('clamps the meter', () => {
    expect(fillRatio(512, 1024)).toBe(0.5);
    expect(fillRatio(4096, 1024)).toBe(1);
    expect(fillRatio(0, 1024)).toBe(0);
    expect(fillRatio(10, 0)).toBe(0);
  });

  it('keeps the six install steps in order', () => {
    expect(STEP_KEYS).toEqual(['build', 'check', 'upload', 'link', 'reboot', 'install']);
  });
});
