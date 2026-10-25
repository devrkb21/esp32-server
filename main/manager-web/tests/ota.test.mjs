import { describe, expect, it } from 'vitest';
import {
  dateText, emptyForm, fieldError, fileError, formErrors, newestIds, sizeText, typeName, typeOptions, wasEdited,
} from '../src/views/ota/otaModel.js';

describe('firmware form rules (legacy FirmwareDialog)', () => {
  it('requires name, type and an x.x.x version', () => {
    const f = emptyForm();
    expect(formErrors(f)).toEqual({
      firmwareName: 'ota.err.nameRequired', type: 'ota.err.typeRequired',
      version: 'ota.err.versionRequired', firmwarePath: 'ota.err.fileRequired',
    });
    expect(fieldError('version', { version: '2.5' })).toBe('ota.err.versionFormat');
    expect(fieldError('version', { version: 'v2.5.5' })).toBe('ota.err.versionFormat');
    expect(fieldError('version', { version: '2.5.5' })).toBe('');
  });

  it('needs an uploaded file only for a new build', () => {
    const base = { firmwareName: 'tinybot-1.0.0', type: 'tinybot', version: '1.0.0' };
    expect(formErrors({ ...emptyForm(), ...base })).toEqual({ firmwarePath: 'ota.err.fileRequired' });
    expect(formErrors({ ...emptyForm(), ...base, firmwarePath: 'x.bin' })).toEqual({});
    expect(formErrors({ ...emptyForm(), ...base, id: 'fw-1' })).toEqual({});
  });

  it('accepts .bin and .apk under 100 MB only', () => {
    expect(fileError({ name: 'TinyBot.BIN', size: 2e6 })).toBe('');
    expect(fileError({ name: 'app.apk', size: 2e6 })).toBe('');
    expect(fileError({ name: 'sound.wav', size: 2e6 })).toBe('ota.err.fileType');
    expect(fileError({ name: 'big.bin', size: 100 * 1024 * 1024 })).toBe('ota.err.fileSize');
    expect(fileError(null)).toBe('ota.err.fileRequired');
  });
});

describe('labels', () => {
  const types = [{ name: 'TinyBot (ESP32-S3 SuperMini)', key: 'tinybot' }];
  it('names a type from the FIRMWARE_TYPE dictionary, falling back to its key', () => {
    expect(typeName(types, 'tinybot')).toBe('TinyBot (ESP32-S3 SuperMini)');
    expect(typeName(types, 'esp-box')).toBe('esp-box');
    expect(typeOptions(types)).toEqual([{ value: 'tinybot', label: 'TinyBot (ESP32-S3 SuperMini)' }]);
  });
  it('writes sizes and dates in Bangla digits in Bangla mode', () => {
    expect(sizeText(2187264, 'en')).toBe('2.09 MB');
    expect(sizeText(2187264, 'bn')).toBe('২.০৯ MB');
    expect(dateText('', 'bn')).toBe('');
    expect(dateText('2026-10-01T10:00:00', 'bn')).toMatch(/[০-৯]/);
    expect(dateText('2026-10-01T10:20:00', 'bn')).not.toMatch(/AM|PM/);
    expect(dateText('2026-10-01T10:20:00', 'en')).toMatch(/am|AM/);
  });
  it('flags a build saved again after its upload', () => {
    expect(wasEdited({ createDate: '2026-10-01T10:00:00', updateDate: '2026-10-01T10:00:20' })).toBe(false);
    expect(wasEdited({ createDate: '2026-10-01T10:00:00', updateDate: '2026-10-03T10:00:00' })).toBe(true);
  });
});

describe('newest of its type (manager-api getLatestOta: latest update_date per type)', () => {
  const rows = [
    { id: 'a', type: 'tinybot', version: '2.5.5', createDate: '2026-10-20', updateDate: '2026-10-20' },
    { id: 'b', type: 'tinybot', version: '2.5.4', createDate: '2026-10-01', updateDate: '2026-10-22' },
    { id: 'c', type: 'esp-box', version: '1.0.0', createDate: '2026-09-01', updateDate: '2026-09-01' },
  ];
  it('picks the most recently saved row per type, not the highest version', () => {
    expect([...newestIds(rows, true)].sort()).toEqual(['b', 'c']);
  });
  it('names nothing when not every build is on screen', () => {
    expect(newestIds(rows, false).size).toBe(0);
  });
});
