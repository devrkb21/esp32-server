import { describe, expect, it } from 'vitest';
import {
  cleanCode, isOnline, isValidCode, lastSeen, macError, manualErrors, maskMac, nameMatches, parseStatus, parseTime,
  pushHistory, searchTypeOf, toRobot,
} from '../src/views/robots/robotsModel.js';

describe('robots model: search', () => {
  it('searches a full MAC by mac, anything else by name (legacy home.vue)', () => {
    expect(searchTypeOf('28:84:85:00:00:01')).toBe('mac');
    expect(searchTypeOf(' 28:84:85:AA:bb:01 ')).toBe('mac');
    expect(searchTypeOf('28-84-85-00-00-01')).toBe('name');
    expect(searchTypeOf('TinyBot')).toBe('name');
  });
  it('keeps at most five recent searches, newest first, no duplicates', () => {
    let h = [];
    for (const k of ['a', 'b', 'c', 'd', 'e', 'f']) h = pushHistory(h, k);
    expect(h).toEqual(['f', 'e', 'd', 'c', 'b']);
    expect(pushHistory(h, 'd')).toEqual(h);
    expect(pushHistory(h, '  ')).toEqual(h);
  });
});

describe('robots model: add a robot', () => {
  it('cleans and validates the 6-digit code (AddDeviceDialog)', () => {
    expect(cleanCode('12a3 45-67')).toBe('123456');
    expect(isValidCode('123456')).toBe(true);
    expect(isValidCode('12345')).toBe(false);
    expect(isValidCode('12345a')).toBe(false);
  });
  it('validates the manual form like ManualAddDeviceDialog', () => {
    expect(macError('')).toBe('required');
    expect(macError('00:1A:2B:3C:4D')).toBe('invalid');
    expect(macError('00:1A:2B:3C:4D:5E')).toBe('');
    expect(macError('00-1a-2b-3c-4d-5e')).toBe('');
    expect(manualErrors({ macAddress: '', board: '', appVersion: ' ' })).toEqual({ macAddress: 'required', board: 'required', appVersion: 'required' });
    expect(manualErrors({ macAddress: '00:1A:2B:3C:4D:5E', board: 'tinybot', appVersion: '1.0.0' })).toEqual({ macAddress: '', board: '', appVersion: '' });
  });
});

describe('robots model: rows', () => {
  it('masks the middle of a MAC (MacAddressMask)', () => {
    expect(maskMac('28:84:85:00:00:01')).toMatchObject({ valid: true, prefix: '28:84', middle: ':85:00:', suffix: '00:01' });
    expect(maskMac('28-84-85-00-00-01')).toMatchObject({ prefix: '28-84', middle: '-85-00-', suffix: '00-01' });
    expect(maskMac('unknown')).toEqual({ valid: false, text: 'unknown' });
  });
  it('says how long ago like DeviceItem', () => {
    const now = Date.parse('2026-10-25T12:00:00Z');
    expect(lastSeen(null, now).kind).toBe('never');
    expect(lastSeen(now - 30000, now).kind).toBe('just');
    expect(lastSeen(now - 61000, now).kind).toBe('just');
    expect(lastSeen(now - 5 * 60000, now)).toMatchObject({ kind: 'minutes', minutes: 5 });
    expect(lastSeen(now - 125 * 60000, now)).toMatchObject({ kind: 'hours', hours: 2, minutes: 5 });
    expect(lastSeen(now - 25 * 3600000, now).kind).toBe('date');
  });
  it('parses seconds, milliseconds, ISO and space-separated times', () => {
    expect(parseTime(1761393600)).toBe(1761393600000);
    expect(parseTime(1761393600000)).toBe(1761393600000);
    expect(parseTime('2026-10-25T12:00:00Z')).toBe(Date.parse('2026-10-25T12:00:00Z'));
    expect(Number.isNaN(parseTime('2026-10-25 12:00:00'))).toBe(false);
    expect(Number.isNaN(parseTime(''))).toBe(true);
  });
  it('reads online status from the MQTT map (DeviceManagement)', () => {
    const d = { macAddress: '28:84:85:00:00:01', board: 'tinybot' };
    const key = 'tinybot@@@28_84_85_00_00_01@@@28_84_85_00_00_01';
    expect(parseStatus('not json')).toBe(null);
    expect(parseStatus(JSON.stringify({ [key]: { isAlive: true } }))).toEqual({ [key]: { isAlive: true } });
    expect(isOnline({ [key]: { isAlive: true } }, d)).toBe(true);
    expect(isOnline({ [key]: { isAlive: false, exists: true } }, d)).toBe(false);
    expect(isOnline({ [key]: { isAlive: null, exists: true } }, d)).toBe(true);
    expect(isOnline({}, d)).toBe(false);
    expect(isOnline(null, d)).toBe(false);
    expect(isOnline({ 'GID_default@@@28_84_85_00_00_01@@@28_84_85_00_00_01': { isAlive: true } }, { macAddress: d.macAddress })).toBe(true);
  });
  it('builds a robot from an agent and a device', () => {
    expect(toRobot({ id: 'a1', agentName: 'TinyBot' }, { id: 'd1', alias: 'Desk', macAddress: 'm', board: 'b', lastConnectedAtTimestamp: 5 }))
      .toEqual({ deviceId: 'd1', agentId: 'a1', agentName: 'TinyBot', name: 'Desk', macAddress: 'm', board: 'b', appVersion: '', lastConnectedAt: 5 });
  });
  it('confirms a delete only on the exact name', () => {
    expect(nameMatches('TinyBot', 'TinyBot')).toBe(true);
    expect(nameMatches('tinybot', 'TinyBot')).toBe(false);
    expect(nameMatches('TinyBot ', 'TinyBot')).toBe(false);
    expect(nameMatches('', '')).toBe(false);
  });
});
