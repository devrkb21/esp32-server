import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIRMWARE_TYPE,
  PHASE,
  SETTLE_S,
  UPDATE_COMMAND,
  UPDATE_POLL_MS,
  UPDATE_TIMEOUT_MS,
  compareVersions,
  createUpdateFlow,
  currentFirmware,
  initialUpdateState,
  isUpdateBusy,
  latestFirmware,
  observeUpdate,
  parseVersion,
  updateAvailable,
  updateSent,
  versionFromUserAgent,
} from '../src/utils/firmwareUpdate.mjs';

// A companion view as GET /device/companion/{id} returns it (only the fields the flow reads)
function view(fw, { online = true, uptime = 600, statsAt = 1000, commands = [] } = {}) {
  return { online, stats: { fw, uptime_s: uptime }, stats_updated: statsAt, commands };
}

describe('firmware versions', () => {
  it('parses versions out of plain, prefixed and user-agent texts', () => {
    expect(parseVersion('2.5.5')).toEqual([2, 5, 5]);
    expect(parseVersion('v2.5.10')).toEqual([2, 5, 10]);
    expect(parseVersion('tinybot/2.5.5')).toEqual([2, 5, 5]);
    expect(parseVersion('2.6.0-rc1')).toEqual([2, 6, 0]);
    expect(parseVersion('')).toBeNull();
    expect(parseVersion(null)).toBeNull();
    expect(parseVersion('unknown')).toBeNull();
  });

  it('compares like manager-api: numeric parts, missing parts are 0', () => {
    expect(compareVersions('2.5.10', '2.5.9')).toBe(1);
    expect(compareVersions('2.5.9', '2.5.10')).toBe(-1);
    expect(compareVersions('2.5', '2.5.0')).toBe(0);
    expect(compareVersions('v3.0.0', '2.99.99')).toBe(1);
    expect(compareVersions('tinybot/2.5.5', '2.5.5')).toBe(0);
    expect(compareVersions('', '2.5.5')).toBeNull();
    expect(compareVersions('2.5.5', undefined)).toBeNull();
  });

  it('knows when an update is available', () => {
    expect(updateAvailable('2.5.5', '2.5.6')).toBe(true);
    expect(updateAvailable('2.5.6', '2.5.6')).toBe(false);
    expect(updateAvailable('2.6.0', '2.5.6')).toBe(false);
    expect(updateAvailable('', '2.5.6')).toBeNull();
  });

  it('reads the version from the user agent', () => {
    expect(versionFromUserAgent('tinybot/2.5.5')).toBe('2.5.5');
    expect(versionFromUserAgent('tinybot/v2.6.0')).toBe('2.6.0');
    expect(versionFromUserAgent('')).toBe('');
    expect(versionFromUserAgent('curl')).toBe('');
  });

  it('takes the current firmware from stats, then the device list, then the user agent', () => {
    expect(currentFirmware({ stats: { fw: '2.5.5' }, user_agent: 'tinybot/2.0.0' }, '2.4.0')).toBe('2.5.5');
    expect(currentFirmware({ stats: {}, user_agent: 'tinybot/2.0.0' }, '2.4.0')).toBe('2.4.0');
    expect(currentFirmware({ stats: {}, user_agent: 'tinybot/2.0.0' })).toBe('2.0.0');
    expect(currentFirmware(null)).toBe('');
  });

  it('picks the firmware the server offers: newest update date of type tinybot', () => {
    expect(FIRMWARE_TYPE).toBe('tinybot');
    const list = [
      { type: 'tinybot', version: '2.5.4', updateDate: '2026-10-01 10:00:00' },
      { type: 'bread-compact-wifi', version: '9.9.9', updateDate: '2026-10-23 10:00:00' },
      { type: 'tinybot', version: '2.5.6', updateDate: '2026-10-22 10:00:00' },
      { type: 'tinybot', version: '2.5.5', updateDate: '2026-10-10 10:00:00' },
    ];
    expect(latestFirmware(list).version).toBe('2.5.6');
    // no dates: the higher version
    expect(latestFirmware([{ type: 'tinybot', version: '2.5.4' }, { type: 'tinybot', version: '2.5.10' }]).version).toBe('2.5.10');
    expect(latestFirmware([{ type: 'other', version: '1.0.0' }])).toBeNull();
    expect(latestFirmware(null)).toBeNull();
  });
});

describe('update state machine', () => {
  const T0 = 1_000_000;

  it('starts idle and records where it started', () => {
    expect(initialUpdateState()).toEqual({ phase: PHASE.idle });
    const s = updateSent(view('2.5.5'), T0, { commandId: 'c1' });
    expect(s).toMatchObject({ phase: PHASE.sent, sentAt: T0, commandId: 'c1', fromVersion: '2.5.5', baseStatsAt: 1000, baseUptime: 600 });
    expect(isUpdateBusy(s)).toBe(true);
    expect(isUpdateBusy(initialUpdateState())).toBe(false);
  });

  it('stays sent while nothing changed', () => {
    const s = updateSent(view('2.5.5'), T0, { commandId: 'c1' });
    const next = observeUpdate(s, view('2.5.5'), T0 + 5000);
    expect(next.phase).toBe(PHASE.sent);
  });

  it('waits once TinyBot took the command or went away', () => {
    const s = updateSent(view('2.5.5'), T0, { commandId: 'c1' });
    const taken = observeUpdate(s, view('2.5.5', { commands: [{ id: 'c1', status: 'done' }] }), T0 + 5000);
    expect(taken.phase).toBe(PHASE.waiting);
    const offline = observeUpdate(s, view('2.5.5', { online: false }), T0 + 5000);
    expect(offline.phase).toBe(PHASE.waiting);
    expect(offline.sawOffline).toBe(true);
  });

  it('is back with the new version', () => {
    let s = updateSent(view('2.5.5'), T0);
    s = observeUpdate(s, view('2.5.5', { online: false }), T0 + 10000);
    s = observeUpdate(s, view('2.5.6', { uptime: 5, statsAt: 1090 }), T0 + 70000);
    expect(s).toMatchObject({ phase: PHASE.updated, fromVersion: '2.5.5', toVersion: '2.5.6' });
    expect(isUpdateBusy(s)).toBe(false);
  });

  it('is already up to date after a restart with the same version that settled', () => {
    let s = updateSent(view('2.5.5'), T0);
    // restarted 10 s ago (uptime < time since the command): could still go to the updater
    s = observeUpdate(s, view('2.5.5', { uptime: 10, statsAt: 1030 }), T0 + 30000);
    expect(s.phase).toBe(PHASE.waiting);
    // up for SETTLE_S with the same version: nothing to install
    s = observeUpdate(s, view('2.5.5', { uptime: SETTLE_S, statsAt: 1050 }), T0 + 50000);
    expect(s).toMatchObject({ phase: PHASE.current, toVersion: '2.5.5' });
  });

  it('does not take old stats for a restart', () => {
    // same stats report as before the command, with a tiny uptime (just booted before the command)
    let s = updateSent(view('2.5.5', { uptime: 40 }), T0);
    s = observeUpdate(s, view('2.5.5', { uptime: 40 }), T0 + 60000);
    expect(s.phase).toBe(PHASE.sent);
  });

  it('times out after 4 minutes', () => {
    expect(UPDATE_TIMEOUT_MS).toBe(4 * 60 * 1000);
    let s = updateSent(view('2.5.5'), T0);
    s = observeUpdate(s, view('2.5.5', { online: false }), T0 + UPDATE_TIMEOUT_MS - 1);
    expect(s.phase).toBe(PHASE.waiting);
    s = observeUpdate(s, null, T0 + UPDATE_TIMEOUT_MS);
    expect(s.phase).toBe(PHASE.timeout);
  });

  it('leaves finished states alone', () => {
    const done = { phase: PHASE.updated, toVersion: '2.5.6' };
    expect(observeUpdate(done, view('2.5.7'), T0)).toBe(done);
  });
});

describe('update flow (fake timers)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(views) {
    const states = [];
    const sendCommand = vi.fn(() => Promise.resolve({ id: 'cmd-1', type: 'update', status: 'pending' }));
    let i = 0;
    const fetchView = vi.fn(() => Promise.resolve(views[Math.min(i++, views.length - 1)]));
    const flow = createUpdateFlow({ sendCommand, fetchView, onChange: (s) => states.push(s.phase) });
    return { flow, states, sendCommand, fetchView };
  }

  it('sends exactly {type: "update"}', async () => {
    expect(UPDATE_COMMAND).toEqual({ type: 'update' });
    const { flow, sendCommand } = setup([view('2.5.5')]);
    expect(await flow.start(view('2.5.5'))).toBe(true);
    expect(sendCommand).toHaveBeenCalledTimes(1);
    expect(sendCommand).toHaveBeenCalledWith({ type: 'update' });
    flow.destroy();
  });

  it('runs idle -> sending -> sent -> waiting -> updated', async () => {
    const { flow, states, fetchView } = setup([
      view('2.5.5', { commands: [{ id: 'cmd-1', status: 'done' }] }),
      view('2.5.5', { online: false }),
      view('2.5.6', { uptime: 4, statsAt: 1080 }),
    ]);
    expect(flow.state.phase).toBe(PHASE.idle);
    await flow.start(view('2.5.5'));
    expect(flow.state.phase).toBe(PHASE.sent);
    expect(flow.isBusy()).toBe(true);

    await vi.advanceTimersByTimeAsync(UPDATE_POLL_MS);
    expect(flow.state.phase).toBe(PHASE.waiting);
    await vi.advanceTimersByTimeAsync(UPDATE_POLL_MS);
    expect(flow.state.phase).toBe(PHASE.waiting);
    await vi.advanceTimersByTimeAsync(UPDATE_POLL_MS);
    expect(flow.state).toMatchObject({ phase: PHASE.updated, fromVersion: '2.5.5', toVersion: '2.5.6' });
    expect(states[0]).toBe(PHASE.sending);
    expect(states).toContain(PHASE.sent);
    expect(states).toContain(PHASE.waiting);

    // finished: no more requests
    const calls = fetchView.mock.calls.length;
    await vi.advanceTimersByTimeAsync(UPDATE_POLL_MS * 5);
    expect(fetchView.mock.calls.length).toBe(calls);
  });

  it('ends "already up to date" when TinyBot comes back with the same version', async () => {
    const { flow } = setup([
      view('2.5.5', { online: false }),
      view('2.5.5', { uptime: 8, statsAt: 1020 }),
      view('2.5.5', { uptime: 40, statsAt: 1050 }),
    ]);
    await flow.start(view('2.5.5'));
    await vi.advanceTimersByTimeAsync(UPDATE_POLL_MS * 2);
    expect(flow.state.phase).toBe(PHASE.waiting);
    // up 40 s only counts as "restarted after the command" once more than 40 s have passed
    await vi.advanceTimersByTimeAsync(UPDATE_POLL_MS);
    expect(flow.state.phase).toBe(PHASE.waiting);
    await vi.advanceTimersByTimeAsync(UPDATE_POLL_MS * 7);
    expect(flow.state).toMatchObject({ phase: PHASE.current, toVersion: '2.5.5' });
  });

  it('times out after 4 minutes and keeps asking until then, also through failed requests', async () => {
    const sendCommand = vi.fn(() => Promise.resolve({ id: 'x' }));
    let n = 0;
    const fetchView = vi.fn(() => (n++ % 2 ? Promise.reject(new Error('net')) : Promise.resolve(view('2.5.5', { online: false }))));
    const flow = createUpdateFlow({ sendCommand, fetchView });
    await flow.start(view('2.5.5'));
    await vi.advanceTimersByTimeAsync(UPDATE_TIMEOUT_MS - UPDATE_POLL_MS);
    expect(flow.state.phase).toBe(PHASE.waiting);
    await vi.advanceTimersByTimeAsync(UPDATE_POLL_MS);
    expect(flow.state.phase).toBe(PHASE.timeout);
    expect(flow.isBusy()).toBe(false);
    const calls = fetchView.mock.calls.length;
    await vi.advanceTimersByTimeAsync(UPDATE_POLL_MS * 3);
    expect(fetchView.mock.calls.length).toBe(calls);
  });

  it('fails when the command cannot be sent, and does not poll', async () => {
    const fetchView = vi.fn();
    const flow = createUpdateFlow({ sendCommand: () => Promise.reject(new Error('offline')), fetchView });
    expect(await flow.start(view('2.5.5'))).toBe(false);
    expect(flow.state.phase).toBe(PHASE.failed);
    await vi.advanceTimersByTimeAsync(UPDATE_POLL_MS * 3);
    expect(fetchView).not.toHaveBeenCalled();
  });

  it('does not send twice while busy; reset goes back to idle', async () => {
    const { flow, sendCommand } = setup([view('2.5.5')]);
    await flow.start(view('2.5.5'));
    expect(await flow.start(view('2.5.5'))).toBe(false);
    expect(sendCommand).toHaveBeenCalledTimes(1);
    flow.reset();
    expect(flow.state.phase).toBe(PHASE.idle);
    flow.destroy();
  });

  it('uses views the page polls anyway', async () => {
    const { flow } = setup([view('2.5.5')]);
    await flow.start(view('2.5.5'));
    flow.observe(view('2.5.6', { uptime: 3, statsAt: 2000 }));
    expect(flow.state).toMatchObject({ phase: PHASE.updated, toVersion: '2.5.6' });
  });
});

describe('shared copy', () => {
  it('keeps the shared copy in manager-mobile identical', () => {
    const web = readFileSync(resolve(process.cwd(), 'src/utils/firmwareUpdate.mjs'), 'utf8');
    const mobile = readFileSync(resolve(process.cwd(), '../manager-mobile/src/utils/firmwareUpdate.mjs'), 'utf8');
    expect(mobile).toBe(web);
  });
});
