import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ROBOT_PAGES,
  ageOf,
  alarmPayload,
  asciiLabel,
  daysOf,
  daysPreset,
  formatClock,
  hasDay,
  highScores,
  isLastPageOn,
  messageStatus,
  newReminder,
  nextPrayer,
  reminderPayload,
  removeById,
  robotPages,
  setEnabled,
  toggleDay,
  upsertById,
} from '../src/utils/companion.mjs';

// The API module talks through RequestService's fluent builder: record every request instead.
const sent = [];
vi.mock('../src/apis/api', () => ({ getServiceUrl: () => 'http://api.test/xiaozhi' }));
vi.mock('../src/apis/httpRequest', () => {
  function sendRequest() {
    const req = { method: 'GET', data: undefined };
    const builder = {
      url(u) { req.url = u; return builder; },
      method(m) { req.method = m; return builder; },
      data(d) { req.data = d; return builder; },
      success(cb) { req.success = cb; return builder; },
      fail(cb) { req.fail = cb; return builder; },
      networkFail(cb) { req.networkFail = cb; return builder; },
      send() { sent.push(req); return builder; },
    };
    return builder;
  }
  return { default: { sendRequest, clearRequestTime() {}, reAjaxFun() {} } };
});

const { default: companionApi } = await import('../src/apis/module/companion.js');

describe('weekday mask helpers', () => {
  it('uses bit 0 for Sunday', () => {
    expect(hasDay(1, 0)).toBe(true);
    expect(hasDay(1, 1)).toBe(false);
    expect(daysOf(62)).toEqual([1, 2, 3, 4, 5]);
  });

  it('toggles a single day and stays within 0-127', () => {
    expect(toggleDay(127, 0)).toBe(126);
    expect(toggleDay(0, 6)).toBe(64);
    expect(toggleDay(64, 6)).toBe(0);
  });

  it('names presets, once and custom sets', () => {
    expect(daysPreset(127)).toBe('everyDay');
    expect(daysPreset(31)).toBe('sunToThu');
    expect(daysPreset(0)).toBe('once');
    expect(daysPreset(5)).toBeNull();
  });
});

describe('payloads', () => {
  it('keeps OLED labels printable ASCII and at most 24 chars', () => {
    expect(asciiLabel('ঘুম Wake  up!')).toBe(' Wake up!');
    expect(asciiLabel('x'.repeat(40))).toHaveLength(24);
    expect(asciiLabel(null)).toBe('');
  });

  it('strips server-only alarm fields and omits the id of new alarms', () => {
    const stored = {
      id: 'a1', time: '06:30', days: 62, label: 'Wake', enabled: true, snooze_min: 5,
      say: ' শুভ সকাল ', say_audio: '/companion/v1/audio/x.ogg',
    };
    expect(alarmPayload(stored)).toEqual({
      id: 'a1', time: '06:30', days: 62, label: 'Wake', enabled: true, snooze_min: 5, say: 'শুভ সকাল',
    });
    expect(alarmPayload({ time: '07:00', days: 127, label: '', enabled: false })).not.toHaveProperty('id');
  });

  it('sends only the fields of the reminder mode', () => {
    const interval = reminderPayload({ ...newReminder('water'), id: 'r1', say_audio: 'x' });
    expect(interval).toMatchObject({ id: 'r1', kind: 'water', mode: 'interval', every_min: 60, from: '09:00', to: '21:00' });
    expect(interval).not.toHaveProperty('time');
    expect(interval).not.toHaveProperty('say_audio');

    const atTime = reminderPayload({ ...newReminder('water'), mode: 'time', time: '08:15' });
    expect(atTime).toMatchObject({ mode: 'time', time: '08:15' });
    expect(atTime).not.toHaveProperty('every_min');
    expect(atTime).not.toHaveProperty('from');
  });

  it('replaces whole lists: add, update, toggle and delete by id', () => {
    const list = [
      { id: 'a1', time: '06:30', days: 127, label: 'A', enabled: true, snooze_min: 5, say: '', say_audio: null },
      { id: 'a2', time: '07:30', days: 127, label: 'B', enabled: true, snooze_min: 5, say: '' },
    ];
    expect(upsertById(list, { time: '08:00', days: 1, label: 'C', enabled: true }, alarmPayload)).toHaveLength(3);
    const updated = upsertById(list, { ...list[1], time: '09:00' }, alarmPayload);
    expect(updated.map((a) => a.time)).toEqual(['06:30', '09:00']);
    expect(setEnabled(list, 'a1', false, alarmPayload)[0].enabled).toBe(false);
    expect(removeById(list, 'a1', alarmPayload).map((a) => a.id)).toEqual(['a2']);
    expect(updated[0]).not.toHaveProperty('say_audio');
  });
});

describe('display helpers', () => {
  const days = [
    { date: '2026-10-24', fajr: '04:48', sunrise: '06:02', dhuhr: '11:44', asr: '15:48', maghrib: '17:26', isha: '18:40' },
    { date: '2026-10-25', fajr: '04:49', sunrise: '06:02', dhuhr: '11:44', asr: '15:47', maghrib: '17:25', isha: '18:40' },
  ];

  it('finds the next prayer today or tomorrow', () => {
    expect(nextPrayer(days, new Date(2026, 9, 24, 12, 0))).toEqual({ key: 'asr', time: '15:48', tomorrow: false });
    expect(nextPrayer(days, new Date(2026, 9, 24, 20, 0))).toEqual({ key: 'fajr', time: '04:49', tomorrow: true });
    expect(nextPrayer([], new Date())).toBeNull();
  });

  it('formats ages and clock times of epoch seconds', () => {
    const now = 1793000000 * 1000;
    expect(ageOf(0, now)).toEqual({ unit: 'never', value: 0 });
    expect(ageOf(1793000000 - 30, now).unit).toBe('justNow');
    expect(ageOf(1793000000 - 600, now)).toEqual({ unit: 'minutes', value: 10 });
    expect(ageOf(1793000000 - 2 * 86400, now)).toEqual({ unit: 'days', value: 2 });
    expect(formatClock(0)).toBe('-');
    expect(formatClock(1793000000)).toMatch(/^\d\d:\d\d \d\d\/\d\d$/);
  });

  it('lists high scores and message states', () => {
    expect(highScores({ simon: 7, reaction_ms: 245 })).toEqual([
      { game: 'reaction', value: 245, ms: true },
      { game: 'simon', value: 7, ms: false },
    ]);
    expect(messageStatus({ status: 'delivered', answer: 'no' })).toBe('no');
    expect(messageStatus({ status: 'delivered', answer: null })).toBe('delivered');
    expect(messageStatus({ status: 'pending' })).toBe('pending');
  });
});

describe('companion API module', () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it('reads and updates the companion of a manager-api device id', () => {
    companionApi.getCompanion('dev 1', () => {});
    companionApi.updateCompanionConfig('dev1', { alarms: [] }, () => {});
    expect(sent[0]).toMatchObject({ method: 'GET', url: 'http://api.test/xiaozhi/device/companion/dev%201' });
    expect(sent[1]).toMatchObject({
      method: 'PUT', url: 'http://api.test/xiaozhi/device/companion/dev1/config', data: { alarms: [] },
    });
  });

  it('sends messages and commands with the documented bodies', () => {
    companionApi.sendCompanionMessage('dev1', { from: 'Ammu', text: 'খেয়েছো?', ask: 1 }, () => {});
    companionApi.sendCompanionCommand('dev1', 'pomodoro', 25, () => {});
    companionApi.sendCompanionCommand('dev1', 'ring', undefined, () => {});
    companionApi.getCompanionMessages('dev1', () => {});
    expect(sent[0]).toMatchObject({
      method: 'POST', url: 'http://api.test/xiaozhi/device/companion/dev1/messages',
      data: { from: 'Ammu', text: 'খেয়েছো?', ask: true },
    });
    expect(sent[1]).toMatchObject({ method: 'POST', url: 'http://api.test/xiaozhi/device/companion/dev1/commands', data: { type: 'pomodoro', arg: '25' } });
    expect(sent[2].data).toEqual({ type: 'ring', arg: '' });
    expect(sent[3]).toMatchObject({ method: 'GET', url: 'http://api.test/xiaozhi/device/companion/dev1/messages' });
  });

  it('builds the events and geocode queries', () => {
    companionApi.getCompanionEvents('dev1', 100, () => {});
    companionApi.geocodeCity('Cox Bazar', () => {});
    expect(sent[0].url).toBe('http://api.test/xiaozhi/device/companion/dev1/events?limit=100');
    expect(sent[1].url).toBe('http://api.test/xiaozhi/device/companion/geocode?q=Cox+Bazar');
  });

  it('passes the Result to callbacks and errors to the fail callback', () => {
    const ok = vi.fn();
    const fail = vi.fn();
    companionApi.getCompanion('dev1', ok, fail);
    sent[0].success({ data: { code: 0, data: { id: 'aa:bb' } } });
    sent[0].fail({ data: { code: 500, msg: 'Companion server is not reachable' } });
    sent[0].networkFail({ status: 502 });
    expect(ok).toHaveBeenCalledWith({ data: { code: 0, data: { id: 'aa:bb' } } });
    expect(fail).toHaveBeenCalledTimes(2);
  });
});

describe('robot pages', () => {
  it('fills every page in order, missing ones shown', () => {
    expect(Object.keys(robotPages(null))).toEqual(ROBOT_PAGES);
    expect(robotPages({ games: false, clock: true })).toMatchObject({ clock: true, games: false, bond: true });
  });

  it('flags only the last page that is still on', () => {
    const one = Object.fromEntries(ROBOT_PAGES.map((k) => [k, k === 'clock']));
    expect(isLastPageOn(one, 'clock')).toBe(true);
    expect(isLastPageOn(one, 'games')).toBe(false);
    expect(isLastPageOn({ games: false }, 'clock')).toBe(false);
  });
});
