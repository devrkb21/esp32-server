import { describe, expect, it } from 'vitest';
import {
  aliasChange, canGenerateLook, cleanCode, filterRows, macParts, manualProblems, mqttClientId, onlineFrom, pageOf,
  parseStatusMap, rowState, toRows,
} from '../src/views/devices/devicesModel.js';

const list = [
  { id: 'b', alias: 'Desk', macAddress: '28:84:85:00:00:02', board: 'tinybot', appVersion: '2.5.1', autoUpdate: 1, createDateTimestamp: 2000, lastConnectedAtTimestamp: 5000 },
  { id: 'a', alias: null, macAddress: '28:84:85:00:00:01', board: 'bread-board', appVersion: '1.9.0', autoUpdate: 0, createDateTimestamp: 1000 },
];

describe('devices model', () => {
  it('maps the device list to rows sorted by bind time', () => {
    const rows = toRows(list);
    expect(rows.map((r) => r.device_id)).toEqual(['a', 'b']);
    expect(rows[1]).toMatchObject({ model: 'tinybot', firmwareVersion: '2.5.1', autoUpdate: true, alias: 'Desk', originalAlias: 'Desk', lastConnectedRaw: 5000 });
    expect(rows[0].alias).toBe('');
    expect(rows[0].lastConnectedRaw).toBeNull();
  });

  it('reads online status from the gateway map like the old page', () => {
    const [a, b] = toRows(list);
    expect(mqttClientId(b)).toBe('tinybot@@@28_84_85_00_00_02@@@28_84_85_00_00_02');
    const map = parseStatusMap({ code: 0, data: JSON.stringify({ [mqttClientId(b)]: { isAlive: null, exists: true }, [mqttClientId(a)]: { isAlive: false } }) });
    expect(onlineFrom(map, b)).toBe('online');
    expect(onlineFrom(map, a)).toBe('offline');
    expect(onlineFrom({}, a)).toBe('offline');
    expect(parseStatusMap({ code: 0, data: 'not json' })).toBeNull();
    expect(parseStatusMap({ code: 500 })).toBeNull();
  });

  it('refines an online robot with its own state', () => {
    expect(rowState('online', 'sleeping')).toBe('sleeping');
    expect(rowState('online', 'updating')).toBe('updating');
    expect(rowState('online', 'offline')).toBe('online');
    expect(rowState('offline', 'updating')).toBe('offline');
  });

  it('filters by name, board or MAC and pages', () => {
    const rows = toRows(list);
    expect(filterRows(rows, 'desk').length).toBe(1);
    expect(filterRows(rows, 'BREAD').length).toBe(1);
    expect(filterRows(rows, '00:01').map((r) => r.device_id)).toEqual(['a']);
    expect(filterRows(rows, '  ').length).toBe(2);
    expect(pageOf([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]);
  });

  it('checks alias changes', () => {
    const row = { originalAlias: 'Desk' };
    expect(aliasChange(row, ' Desk ')).toMatchObject({ ok: false, reason: 'same' });
    expect(aliasChange(row, 'x'.repeat(65))).toMatchObject({ ok: false, reason: 'tooLong' });
    expect(aliasChange(row, ' Kitchen ')).toEqual({ ok: true, text: 'Kitchen' });
  });

  it('masks the middle of a MAC address', () => {
    expect(macParts('28:84:85:00:00:01')).toEqual({ ok: true, head: '28:84', middle: ':85:00:', tail: '00:01' });
    expect(macParts('28-84-85-00-00-01').middle).toBe('-85-00-');
    expect(macParts('nope').ok).toBe(false);
  });

  it('keeps the bind code to six digits, Bangla digits included', () => {
    expect(cleanCode('12a 34-56789')).toBe('123456');
    expect(cleanCode('১২৩৪৫৬')).toBe('123456');
  });

  it('validates the add-by-MAC form', () => {
    expect(manualProblems({ macAddress: '', board: '', appVersion: ' ' })).toEqual({
      macAddress: 'manual.requiredMac', board: 'manual.requiredBoard', appVersion: 'manual.requiredVersion',
    });
    expect(manualProblems({ macAddress: '00:1A:2B:3C:4D', board: 'b', appVersion: '1' })).toEqual({ macAddress: 'manual.invalidMac' });
    expect(manualProblems({ macAddress: '00:1A:2B:3C:4D:5E', board: 'b', appVersion: '1.0' })).toEqual({});
  });

  it('offers the generated look from firmware 2.0.0', () => {
    expect(canGenerateLook('2.0.0')).toBe(true);
    expect(canGenerateLook('1.9.9')).toBe(false);
    expect(canGenerateLook('')).toBe(false);
  });
});
