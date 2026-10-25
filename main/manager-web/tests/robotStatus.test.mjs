// The robot's connection status: the pure rules (src/shell/connection.mjs), the shared store
// (src/shell/robotStatus.js) and the kit panel (src/kit/TbRobotStatus.vue).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('@/apis/api', () => ({ default: {} }));

import {
  COMPANION_EVERY_MS, COMPANION_MAX, STALE_S, STATES, companionErrorKind, companionsToAsk, connectionOf, isLive, rawErrorText, shouldPoll, statusInk, statusKeys, toMs,
} from '@/shell/connection.mjs';
import {
  friendlyError, noteCompanionError, noteCompanionView, noteMqtt, noteMqttMap, resetRobotStatus, statusOf,
} from '@/shell/robotStatus';
import { robot } from '@/shell/robot';
import TbRobotStatus from '@/kit/TbRobotStatus.vue';
import strings from '@/i18n/pages/status.js';

const NOW = Date.UTC(2026, 9, 25, 6, 0, 0);
const S = Math.floor(NOW / 1000);
const fresh = { ok: true, view: { online: true, last_seen: S - 20 } };
const stale = { ok: true, view: { online: false, last_seen: S - 25 * 60 } };
const notFound = { ok: false, kind: 'not_registered' };

describe('connectionOf: the states', () => {
  it('checking until something is known', () => {
    expect(connectionOf({ now: NOW }).state).toBe('checking');
    expect(connectionOf({ mqtt: true, now: NOW }).state).toBe('checking');
  });

  it('online: a recent sync, whatever the gateway says', () => {
    expect(connectionOf({ mqtt: true, companion: fresh, now: NOW })).toMatchObject({ state: 'online', lastSeen: (S - 20) * 1000 });
    expect(connectionOf({ mqtt: false, companion: fresh, now: NOW }).state).toBe('online');
    expect(connectionOf({ mqtt: null, companion: fresh, now: NOW }).state).toBe('online');
    // within STALE_S even when the companion server's own 90 s flag is off
    expect(connectionOf({ mqtt: true, companion: { ok: true, view: { online: false, last_seen: S - (STALE_S - 10) } }, now: NOW }).state).toBe('online');
  });

  it('waiting_companion: on MQTT but "device not found" on the companion server', () => {
    const s = connectionOf({ mqtt: true, companion: notFound, now: NOW });
    expect(s.state).toBe('waiting_companion');
    expect(shouldPoll(s.state)).toBe(true);
    expect(connectionOf({ mqtt: null, companion: notFound, now: NOW }).state).toBe('waiting_companion');
    expect(connectionOf({ mqtt: undefined, companion: notFound, now: NOW }).state).toBe('waiting_companion');
  });

  it('not_syncing: known, on MQTT, but the last sync is old', () => {
    const s = connectionOf({ mqtt: true, companion: stale, now: NOW });
    expect(s.state).toBe('not_syncing');
    expect(s.lastSync).toBe((S - 25 * 60) * 1000);
    expect(shouldPoll(s.state)).toBe(false);
    // the gateway saw it a minute ago, the companion server 25 minutes ago: both are kept
    const both = connectionOf({ mqtt: true, companion: stale, lastConnectedAt: NOW - 60000, now: NOW });
    expect(both).toMatchObject({ state: 'not_syncing', lastSeen: NOW - 60000, lastSync: (S - 25 * 60) * 1000 });
  });

  it('offline: not on MQTT and no recent sync, with the last time it was seen', () => {
    const s = connectionOf({ mqtt: false, companion: stale, lastConnectedAt: NOW - 3600000, now: NOW });
    expect(s.state).toBe('offline');
    expect(s.lastSeen).toBe((S - 25 * 60) * 1000);
    expect(connectionOf({ mqtt: false, now: NOW }).state).toBe('offline');
    expect(connectionOf({ mqtt: false, companion: notFound, now: NOW }).state).toBe('offline');
    expect(connectionOf({ mqtt: undefined, companion: { ok: true, view: { online: false } }, now: NOW }).state).toBe('offline');
  });

  it('server_error: our server failed, or could not be reached', () => {
    const s = connectionOf({ mqtt: true, companion: { ok: false, kind: 'server' }, now: NOW });
    expect(s).toMatchObject({ state: 'server_error', reason: 'server' });
    expect(connectionOf({ mqtt: false, companion: { ok: false, kind: 'network' }, now: NOW }))
      .toMatchObject({ state: 'server_error', reason: 'network' });
    expect(statusKeys('server_error', 'network').why).toBe('status.server_error.whyNetwork');
    expect(statusKeys('server_error', 'server').why).toBe('status.server_error.why');
  });

  it('a product without the companion module: the gateway alone decides', () => {
    expect(connectionOf({ hasCompanion: false, mqtt: true, now: NOW }).state).toBe('online');
    expect(connectionOf({ hasCompanion: false, mqtt: false, lastConnectedAt: NOW - 60000, now: NOW }))
      .toMatchObject({ state: 'offline', lastSeen: NOW - 60000 });
    expect(connectionOf({ hasCompanion: false, mqtt: null, now: NOW }).state).toBe('offline');
    expect(connectionOf({ hasCompanion: false, now: NOW }).state).toBe('checking');
    // a companion answer is never asked for, and ignored when there is one
    expect(connectionOf({ hasCompanion: false, mqtt: true, companion: notFound, now: NOW }).state).toBe('online');
    // the server says the product lacks the module (10211): same as no companion
    expect(connectionOf({ mqtt: true, companion: { ok: false, kind: 'no_companion' }, now: NOW }).state).toBe('online');
  });

  it('every state has its words, ink and liveness', () => {
    for (const s of STATES) {
      const k = statusKeys(s);
      for (const key of [k.label, k.why, k.next]) {
        expect(strings.bn[key], `bn ${key}`).toBeTruthy();
        expect(strings.en[key], `en ${key}`).toBeTruthy();
        expect(strings.bn[key]).not.toContain('—');
      }
    }
    expect(strings.bn['status.waiting_companion.label']).toBe('সার্ভারে যুক্ত হচ্ছে');
    expect(strings.bn['status.not_syncing.label']).toBe('সার্ভারের সাথে সংযোগ নেই');
    expect(strings.bn['status.server_error.label']).toBe('সার্ভারে সমস্যা');
    expect(statusInk('online')).toBe('ok');
    expect(statusInk('waiting_companion')).toBe('warn');
    expect(statusInk('not_syncing')).toBe('warn');
    expect(statusInk('server_error')).toBe('danger');
    expect(statusInk('offline')).toBe('ink-2');
    expect(isLive('online')).toBe(true);
    expect(isLive('not_syncing')).toBe(false);
    expect(statusKeys('nonsense').label).toBe('status.checking.label');
  });
});

describe('companionErrorKind', () => {
  it('reads the manager-api forward of a xiaozhi-server 404 as not registered', () => {
    expect(companionErrorKind({ status: 200, data: { code: 500, msg: 'device not found' } })).toBe('not_registered');
    expect(companionErrorKind({ code: 500, msg: 'Device not found' })).toBe('not_registered');
  });
  it('tells a product without the module, other server answers and no answer apart', () => {
    expect(companionErrorKind({ data: { code: 10211, msg: 'feature not supported' } })).toBe('no_companion');
    expect(companionErrorKind({ data: { code: 500, msg: 'Companion server is not reachable' } })).toBe('server');
    expect(companionErrorKind({ data: { code: 10194, msg: 'Device does not exist' } })).toBe('server');
    expect(companionErrorKind({ data: { msg: 'down' } })).toBe('network');
    expect(companionErrorKind({ status: 502 })).toBe('network');
    expect(companionErrorKind(new Error('timeout'))).toBe('network');
    expect(companionErrorKind(null)).toBe('network');
  });
  it('keeps the raw text for the console, and toasts only words meant for people', () => {
    expect(rawErrorText({ data: { code: 500, msg: 'device not found' } })).toBe('device not found');
    expect(friendlyError({ data: { code: 500, msg: 'device not found' } }, 'Could not save')).toBe('Could not save');
    expect(friendlyError({ data: { code: 500, msg: 'Companion server is not reachable' } }, 'Could not save')).toBe('Could not save');
    expect(friendlyError({ data: { code: 500, msg: 'Alarm time is invalid' } }, 'Could not save')).toBe('Alarm time is invalid');
    expect(friendlyError(null, 'Could not save')).toBe('Could not save');
  });
  it('reads times in every shape the servers send', () => {
    expect(toMs(S)).toBe(S * 1000);
    expect(toMs(NOW)).toBe(NOW);
    expect(toMs(new Date(NOW).toISOString())).toBe(NOW);
    expect(Number.isNaN(toMs(null))).toBe(true);
    expect(Number.isNaN(toMs(0))).toBe(true);
  });
});

describe('the shared store', () => {
  beforeEach(() => {
    resetRobotStatus();
    robot.list = [
      { deviceId: 'd1', agentId: 'a1', macAddress: '28:84:85:00:00:01', board: 'tinybot', features: ['companion'] },
      { deviceId: 'g1', agentId: 'a1', macAddress: '28:84:85:00:00:09', board: 'box', features: ['chat'] },
    ];
  });
  afterEach(() => { robot.list = []; });

  it('combines what the pages learn into one status', () => {
    expect(statusOf('d1').state).toBe('checking');
    noteMqttMap({ 'tinybot@@@28_84_85_00_00_01@@@28_84_85_00_00_01': { isAlive: true } }, robot.list);
    expect(statusOf('d1').state).toBe('checking');
    expect(statusOf('g1').state).toBe('offline');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(noteCompanionError('d1', { data: { code: 500, msg: 'device not found' } })).toBe('not_registered');
    expect(warn.mock.calls[0].join(' ')).toContain('device not found');
    warn.mockRestore();
    expect(statusOf('d1').state).toBe('waiting_companion');
    noteCompanionView('d1', { online: true, last_seen: Math.floor(Date.now() / 1000) });
    expect(statusOf('d1').state).toBe('online');
    noteMqtt('g1', true);
    expect(statusOf('g1').state).toBe('online');
  });
});

describe('TbRobotStatus', () => {
  const t = (key, p) => (p ? `${key}${JSON.stringify(p)}` : key);
  const mountIt = (props) => mount(TbRobotStatus, {
    props, global: { mocks: { $t: t, $i18n: { locale: 'en' } }, stubs: { TbIcon: true } },
  });
  afterEach(() => { vi.useRealTimers(); });

  it('compact: the mark and the word', () => {
    const w = mountIt({ compact: true, status: { state: 'waiting_companion' } });
    expect(w.classes()).toContain('is-compact');
    expect(w.classes()).toContain('ink-warn');
    expect(w.text()).toBe('status.waiting_companion.label');
    expect(w.attributes('title')).toBe('status.waiting_companion.why');
  });

  it('panel: word, explanation, next step, last seen and a refresh button', async () => {
    const w = mountIt({ status: { state: 'offline', lastSeen: Date.now() - 5 * 60000 }, hint: 'page hint' });
    expect(w.attributes('role')).toBe('status');
    const text = w.text();
    expect(text).toContain('status.offline.label');
    expect(text).toContain('status.offline.why');
    expect(text).toContain('status.offline.next');
    expect(text).toContain('status.lastSeen');
    expect(text).toContain('page hint');
    await w.find('button').trigger('click');
    expect(w.emitted('refresh')).toHaveLength(1);
  });

  it('not syncing: says when it last synced with the companion server', () => {
    const w = mountIt({ status: { state: 'not_syncing', lastSeen: Date.now() - 30000, lastSync: Date.now() - 25 * 60000 } });
    expect(w.text()).toContain('status.lastSync{"when":"companion.ago.minutes{\\"n\\":\\"25\\"}"}');
  });

  it('online needs no button, and can hide itself', () => {
    expect(mountIt({ status: { state: 'online' } }).find('button').exists()).toBe(false);
    expect(mountIt({ status: { state: 'online' }, hideOnline: true }).html()).not.toContain('tb-rstat');
  });

  it('asks again by itself every 15 s while the robot joins the server, and stops when it has', async () => {
    vi.useFakeTimers();
    const w = mountIt({ status: { state: 'waiting_companion' } });
    expect(w.text()).toContain('status.auto');
    vi.advanceTimersByTime(15000);
    expect(w.emitted('refresh')).toHaveLength(1);
    vi.advanceTimersByTime(15000);
    expect(w.emitted('refresh')).toHaveLength(2);
    await w.setProps({ status: { state: 'online' } });
    vi.advanceTimersByTime(60000);
    expect(w.emitted('refresh')).toHaveLength(2);
  });

  it('does not ask while the page is hidden', () => {
    vi.useFakeTimers();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const w = mountIt({ status: { state: 'waiting_companion' } });
    vi.advanceTimersByTime(45000);
    expect(w.emitted('refresh')).toBeUndefined();
    hidden.mockRestore();
    w.unmount();
  });
});

describe('companionsToAsk', () => {
  it('asks only online companion robots, once per 30 s, capped', () => {
    const devs = [
      { id: 'on', hasCompanion: true, mqtt: true, askedAt: 0 },
      { id: 'nomap', hasCompanion: true, mqtt: null, askedAt: 0 },
      { id: 'off', hasCompanion: true, mqtt: false, askedAt: 0 },
      { id: 'unasked', hasCompanion: true, askedAt: 0 },
      { id: 'generic', hasCompanion: false, mqtt: true, askedAt: 0 },
      { id: 'recent', hasCompanion: true, mqtt: true, askedAt: NOW - 1000 },
      { id: 'old', hasCompanion: true, mqtt: true, askedAt: NOW - COMPANION_EVERY_MS },
    ];
    expect(companionsToAsk(devs, NOW)).toEqual(['on', 'nomap', 'old']);
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `d${i}`, hasCompanion: true, mqtt: true }));
    expect(companionsToAsk(many, NOW)).toHaveLength(COMPANION_MAX);
  });
});
