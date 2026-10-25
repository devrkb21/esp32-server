// The Robot page (src/views/robot): the checks of tests/legacy/companionView.test.mjs for the
// status, sound, display, robot pages, proactive talk, memory and quick actions parts, and of
// tests/legacy/companionContract.test.mjs (API routes, route, polling), ported to the new page,
// plus the firmware card (src/legacy/components/TinyBotFirmwareCard.vue) and the page's own rules.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

const api = vi.hoisted(() => ({
  companion: {
    getCompanion: vi.fn(),
    updateCompanionConfig: vi.fn(),
    sendCompanionCommand: vi.fn(),
    getCompanionEvents: vi.fn(),
  },
  agent: { getAgentList: vi.fn((ok) => ok({ data: { data: [] } })) },
  device: {
    getAgentBindDevices: vi.fn(),
    updateDeviceInfo: vi.fn(),
  },
  ota: { getOtaList: vi.fn() },
}));
vi.mock('@/apis/api', () => ({ default: api }));

import Kit from '@/kit';
import i18n from '@/i18n';
import RobotSettings from '@/views/robot/RobotSettings.vue';
import RobotStatus from '@/views/robot/RobotStatus.vue';
import RobotJobs from '@/views/robot/RobotJobs.vue';
import RobotFirmware from '@/views/robot/RobotFirmware.vue';
import {
  JOBS, commandLabel, daysTogether, eventInk, faceMood, focusMinutes, jobArg, moodKey, pickerChoice, sectionPatch,
  sectionProblem, serverForm, soundSavedNote, uptimeParts, wifiQuality,
} from '@/views/robot/robotModel';
import { PHASE } from '@/utils/firmwareUpdate.mjs';
import { resetRobotStatus } from '@/shell/robotStatus';

// pages poll every 10 s: a page left mounted by one test must not answer in the next
enableAutoUnmount(afterEach);
import { robot } from '@/shell/robot';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

function deviceView(overrides = {}) {
  return {
    id: 'aa:bb:cc:dd:ee:ff',
    name: 'TinyBot',
    online: true,
    last_seen: 0,
    stats: { volume: 60 },
    settings: {
      volume: null, sounds: true, owner_name: '',
      night: { enabled: true, start: '21:30', end: '06:30', dim: true, lullaby: true, light: false },
      care: { enabled: true, lonely_after_min: 180 },
    },
    pomodoro: { work_min: 25, short_break_min: 5, long_break_min: 15, rounds: 4 },
    alarms: [{ id: 'a1', time: '06:30', days: 62, label: 'Wake up', enabled: true, snooze_min: 5, say: '', say_audio: null }],
    reminders: [],
    prayer: { enabled: false, days: [] },
    weather: { ok: false },
    events: [],
    messages: [],
    commands: [],
    ...overrides,
  };
}

const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

async function mountRobot(view, { query = {}, user = { superAdmin: 0 }, devices = null } = {}) {
  api.companion.getCompanion.mockImplementation((id, ok) => ok({ data: { data: view } }));
  api.device.getAgentBindDevices.mockImplementation((id, ok) => ok({ data: { code: 0, data: devices || [] } }));
  const wrapper = mount(RobotSettings, {
    global: {
      plugins: [Kit, i18n],
      stubs: { teleport: true, RouterLink: true },
      mocks: {
        $route: { query: { deviceId: 'dev1', agentId: 'agent1', ...query } },
        $router: { push: vi.fn(), replace: vi.fn() },
        $store: { getters: { getUserInfo: user } },
        $message: message,
        $confirm: vi.fn(() => Promise.resolve('confirm')),
      },
    },
  });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  resetRobotStatus();
  vi.clearAllMocks();
  api.companion.updateCompanionConfig.mockReset();
  api.companion.sendCompanionCommand.mockReset();
  i18n.global.locale = 'en';
});

describe('Robot: forms from the server', () => {
  it('fills the forms from the server and derives the volume mode', async () => {
    const w = await mountRobot(deviceView());
    expect(w.vm.forms.sound).toEqual({ controlVolume: false, volume: 60, sounds: true });
    expect(w.vm.forms.robot).toEqual({ name: 'TinyBot', owner_name: '' });
    expect(w.vm.isDirty('sound')).toBe(false);
  });

  it('keeps unsaved edits when the background refresh brings new data', async () => {
    const w = await mountRobot(deviceView());
    w.vm.forms.sound.controlVolume = true;
    w.vm.forms.sound.volume = 85;
    w.vm.apply(deviceView({ name: 'Bot2', stats: { volume: 30 } }));
    expect(w.vm.forms.sound).toMatchObject({ controlVolume: true, volume: 85 });
    expect(w.vm.isDirty('sound')).toBe(true);
    expect(w.vm.forms.robot.name).toBe('Bot2');
  });

  it('saves a section as a partial config update', async () => {
    const w = await mountRobot(deviceView());
    w.vm.forms.sound.controlVolume = true;
    w.vm.forms.sound.volume = 80;
    w.vm.saveSection('sound');
    const [deviceId, patch] = api.companion.updateCompanionConfig.mock.calls[0];
    expect(deviceId).toBe('dev1');
    expect(patch).toEqual({ settings: { volume: 80, sounds: true } });
  });

  it('saves the robot name and owner name, trimmed, with TinyBot for an empty name', async () => {
    const w = await mountRobot(deviceView());
    w.vm.forms.robot.name = '   ';
    w.vm.forms.robot.owner_name = '  Rimi ';
    w.vm.saveSection('robot');
    expect(api.companion.updateCompanionConfig.mock.calls[0][1]).toEqual({ name: 'TinyBot', settings: { owner_name: 'Rimi' } });
  });
});

describe('Robot: robot pages and jobs', () => {
  it('hides a page optimistically and puts it back when the save fails', async () => {
    const w = await mountRobot(deviceView());
    expect(w.vm.pages.games).toBe(true);
    w.vm.setPage('games', false);
    expect(w.vm.pages.games).toBe(false);
    const [, patch, , fail] = api.companion.updateCompanionConfig.mock.calls[0];
    expect(patch).toEqual({ settings: { pages: { games: false } } });
    fail({ data: { msg: 'nope' } });
    await flushPromises();
    expect(w.vm.pages.games).toBe(true);
    expect(message.error).toHaveBeenCalledWith('nope');
    expect(w.vm.syncOf('pages').state).toBe('error');
  });

  it('never turns off the last page that is still on', async () => {
    const pages = { clock: true, weather: false, prayer: false, focus: false, games: false,
      breathe: false, story: false, night: false, status: false, bond: false };
    const w = await mountRobot(deviceView({ settings: { ...deviceView().settings, pages } }));
    expect(w.vm.isLastPageOn('clock')).toBe(true);
    w.vm.setPage('clock', false);
    expect(api.companion.updateCompanionConfig).not.toHaveBeenCalled();
  });

  it('has a stop job and sends it, and keeps the sent job at the top of the recent list', async () => {
    const w = await mountRobot(deviceView());
    const stop = JOBS.find((j) => j.type === 'stop');
    expect(stop).toMatchObject({ icon: 'stop' });
    api.companion.sendCompanionCommand.mockImplementation((id, type, arg, ok) => ok({ data: { data: { id: 'c9', type, arg, ts: 1, status: 'pending' } } }));
    w.vm.runJob(stop);
    expect(api.companion.sendCompanionCommand.mock.calls[0].slice(0, 3)).toEqual(['dev1', 'stop', '']);
    expect(w.vm.commands[0]).toMatchObject({ id: 'c9', type: 'stop' });
    expect(message.success).toHaveBeenCalledWith('Sent to TinyBot');
  });

  it('starts the Focus job with the saved work minutes', async () => {
    const w = await mountRobot(deviceView({ pomodoro: { work_min: 40, short_break_min: 5, long_break_min: 15, rounds: 4 } }));
    const focus = JOBS.find((j) => j.focus);
    expect(focus.type).toBe('pomodoro');
    expect(focusMinutes(w.vm.view)).toBe(40);
    w.vm.runJob(focus);
    expect(api.companion.sendCompanionCommand.mock.calls[0].slice(0, 3)).toEqual(['dev1', 'pomodoro', '40']);
  });

  it('sends games, face shows and a story with its topic, one at a time', async () => {
    const w = await mountRobot(deviceView());
    w.vm.runJob(JOBS.find((j) => j.key === 'game-simon'));
    w.vm.runJob(JOBS.find((j) => j.key === 'demo-emotions'));
    expect(api.companion.sendCompanionCommand).toHaveBeenCalledTimes(1);
    expect(api.companion.sendCompanionCommand.mock.calls[0].slice(0, 3)).toEqual(['dev1', 'game', 'simon']);
    w.vm.busy = '';
    w.vm.runJob(JOBS.find((j) => j.key === 'demo-emotions'));
    expect(api.companion.sendCompanionCommand.mock.calls[1].slice(0, 3)).toEqual(['dev1', 'demo', 'emotions']);
    w.vm.busy = '';
    w.vm.storyTopic = '  a brave cat ';
    w.vm.sendStory();
    expect(api.companion.sendCompanionCommand.mock.calls[2].slice(0, 3)).toEqual(['dev1', 'story', 'a brave cat']);
    expect(w.vm.storyTopic).toBe('');
  });

  it('says a job waits for an offline robot', async () => {
    const w = await mountRobot(deviceView({ online: false }));
    api.companion.sendCompanionCommand.mockImplementation((id, type, arg, ok) => ok({ data: { data: {} } }));
    w.vm.runJob(JOBS.find((j) => j.key === 'lullaby'));
    expect(message.success).toHaveBeenCalledWith('Sent, TinyBot does it when it is back online');
    expect(w.findComponent(RobotJobs).text()).toContain('TinyBot is offline. Commands wait until it is back online.');
  });
});

describe('Robot: volume, display and proactive talk', () => {
  it('shows the robot volume read-only when the app does not set it', async () => {
    const w = await mountRobot(deviceView({ stats: { volume: 45 } }));
    expect(w.text()).toContain('TinyBot now: 45%');
    expect(w.vm.forms.sound).toMatchObject({ controlVolume: false, volume: 45 });
  });

  it('uses the stored volume when the app sets it and names it in the saved toast', async () => {
    const view = deviceView({ stats: { volume: 100 } });
    view.settings.volume = 50;
    const w = await mountRobot(view);
    expect(w.vm.forms.sound).toMatchObject({ controlVolume: true, volume: 50 });
    w.vm.forms.sound.volume = 80;
    w.vm.saveSection('sound');
    const [, patch, ok] = api.companion.updateCompanionConfig.mock.calls[0];
    expect(patch).toEqual({ settings: { volume: 80, sounds: true } });
    const saved = deviceView({ stats: { volume: 80 } });
    saved.settings.volume = 80;
    ok({ data: { data: saved } });
    expect(message.success).toHaveBeenCalledWith('Volume set to 80%');
  });

  it('keeps the generic saved toast when only the sound effects change', async () => {
    const w = await mountRobot(deviceView());
    w.vm.forms.sound.sounds = false;
    w.vm.saveSection('sound');
    api.companion.updateCompanionConfig.mock.calls[0][2]({ data: { data: deviceView() } });
    expect(message.success).toHaveBeenCalledWith('Saved, TinyBot has it');
  });

  it('fills the display timeouts with defaults and saves them', async () => {
    const w = await mountRobot(deviceView());
    expect(w.vm.forms.display).toEqual({ dim_after_min: 3, off_after_min: 20 });
    expect(w.vm.isDirty('display')).toBe(false);
    w.vm.pickMinutes('dim', 0);
    w.vm.pickMinutes('off', 60);
    expect(w.vm.isDirty('display')).toBe(true);
    w.vm.saveSection('display');
    expect(api.companion.updateCompanionConfig.mock.calls[0][1])
      .toEqual({ settings: { display: { dim_after_min: 0, off_after_min: 60 } } });
  });

  it('reads saved display values and switches odd values to Custom', async () => {
    const view = deviceView();
    view.settings.display = { dim_after_min: 7, off_after_min: 0 };
    const w = await mountRobot(view);
    expect(w.vm.pickerChoice('dim')).toBe('custom');
    expect(w.vm.pickerChoice('off')).toBe(0);
    w.vm.pickMinutes('off', 'custom');
    expect(w.vm.pickerChoice('off')).toBe('custom');
    expect(w.vm.forms.display.off_after_min).toBe(0);
    w.vm.revertSection('display');
    expect(w.vm.pickerChoice('off')).toBe(0);
  });

  it('refuses display timeouts out of range or turning off before dimming', async () => {
    const w = await mountRobot(deviceView());
    w.vm.forms.display.off_after_min = 601;
    w.vm.saveSection('display');
    w.vm.forms.display.off_after_min = 2;
    w.vm.saveSection('display');
    w.vm.forms.display.off_after_min = undefined;
    w.vm.saveSection('display');
    expect(api.companion.updateCompanionConfig).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledTimes(3);
    expect(message.warning).toHaveBeenNthCalledWith(1, 'Turn off after: choose 0 to 600 minutes');
  });

  it('fills proactive talk with defaults and saves it', async () => {
    const w = await mountRobot(deviceView());
    expect(w.vm.forms.proactive).toEqual({ enabled: true, morning_on: true, morning: '07:30', evening_on: true, evening: '19:30' });
    expect(w.vm.isDirty('proactive')).toBe(false);
    w.vm.forms.proactive.morning = '06:45';
    w.vm.forms.proactive.evening_on = false;
    expect(w.vm.isDirty('proactive')).toBe(true);
    w.vm.saveSection('proactive');
    expect(api.companion.updateCompanionConfig.mock.calls[0][1]).toEqual({
      settings: { proactive: { enabled: true, morning_on: true, morning: '06:45', evening_on: false, evening: '19:30' } },
    });
  });

  it('reads saved proactive talk values and undoes edits', async () => {
    const view = deviceView();
    view.settings.proactive = { enabled: false, morning_on: true, morning: '08:00', evening_on: false, evening: '21:15' };
    const w = await mountRobot(view);
    expect(w.vm.forms.proactive).toEqual(view.settings.proactive);
    w.vm.forms.proactive.enabled = true;
    expect(w.vm.isDirty('proactive')).toBe(true);
    w.vm.revertSection('proactive');
    expect(w.vm.forms.proactive.enabled).toBe(false);
    expect(w.vm.isDirty('proactive')).toBe(false);
  });

  it('refuses proactive talk without valid times', async () => {
    const w = await mountRobot(deviceView());
    w.vm.forms.proactive.morning = '';
    w.vm.saveSection('proactive');
    w.vm.forms.proactive.morning = '07:00';
    w.vm.forms.proactive.evening = '25:00';
    w.vm.saveSection('proactive');
    expect(api.companion.updateCompanionConfig).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenNthCalledWith(1, 'Morning greeting: choose a time (HH:MM)');
    expect(message.warning).toHaveBeenNthCalledWith(2, 'Evening chat: choose a time (HH:MM)');
  });
});

describe('Robot: memory', () => {
  const notes = [
    { id: 'm2', text: 'two', kind: 'fact', created: '2026-10-20T18:00:00', updated: '2026-10-20T18:00:00' },
    { id: 'm1', text: 'one', kind: 'fact', created: '2026-10-01T09:00:00', updated: '2026-10-01T09:00:00' },
  ];

  it('lists the memory notes from the device detail', async () => {
    const w = await mountRobot(deviceView({
      memories: [
        { id: 'm2', text: 'রিমির শুক্রবার গণিত পরীক্ষা', kind: 'event', created: '2026-10-20T18:00:00', updated: '2026-10-20T18:00:00', until: '2026-10-30' },
        { id: '', text: 'broken' },
        { id: 'm1', text: 'Rimi likes mangoes', kind: 'like', created: '2026-10-01T09:00:00', updated: '2026-10-01T09:00:00' },
      ],
    }));
    expect(w.vm.memories.map((m) => m.id)).toEqual(['m2', 'm1']);
    expect(w.vm.memories[0].until).toBe('2026-10-30');
    expect(w.text()).toContain('Likes');
    expect(w.text()).toContain('Rimi likes mangoes');
    expect(w.vm.forms.memory).toEqual({ enabled: true });
    const empty = await mountRobot(deviceView());
    expect(empty.vm.memories).toEqual([]);
    expect(empty.text()).toContain('Nothing noted yet');
  });

  it('saves the memory switch as a settings patch', async () => {
    const view = deviceView();
    view.settings.memory = { enabled: true };
    const w = await mountRobot(view);
    expect(w.vm.isDirty('memory')).toBe(false);
    w.vm.forms.memory.enabled = false;
    expect(w.vm.isDirty('memory')).toBe(true);
    w.vm.saveSection('memory');
    expect(api.companion.updateCompanionConfig.mock.calls[0][1]).toEqual({ settings: { memory: { enabled: false } } });
  });

  it('deletes one memory note and reloads the device from the answer', async () => {
    const w = await mountRobot(deviceView({ memories: notes }));
    w.vm.deleteMemory(w.vm.memories[0]);
    const [deviceId, patch, ok] = api.companion.updateCompanionConfig.mock.calls[0];
    expect(deviceId).toBe('dev1');
    expect(patch).toEqual({ memories: { delete: ['m2'] } });
    expect(w.vm.syncOf('memories').state).toBe('pending');
    ok({ data: { data: deviceView({ memories: [notes[1]] }) } });
    expect(w.vm.memories.map((m) => m.id)).toEqual(['m1']);
    expect(message.success).toHaveBeenCalledWith('Note deleted');
  });

  it('asks before forgetting everything, as a danger question, and then clears the notes', async () => {
    const w = await mountRobot(deviceView({ memories: notes.slice(1) }));
    w.vm.$confirm.mockImplementation(() => Promise.reject(new Error('cancel')));
    await w.vm.forgetMemories();
    expect(w.vm.$confirm).toHaveBeenCalledTimes(1);
    expect(w.vm.$confirm.mock.calls[0][0]).toBe('TinyBot will forget all 1 notes. This cannot be undone.');
    expect(w.vm.$confirm.mock.calls[0][2]).toMatchObject({ danger: true });
    expect(api.companion.updateCompanionConfig).not.toHaveBeenCalled();

    w.vm.$confirm.mockImplementation(() => Promise.resolve('confirm'));
    await w.vm.forgetMemories();
    expect(api.companion.updateCompanionConfig.mock.calls[0][1]).toEqual({ memories: { clear: true } });
  });
});

describe('Robot: status', () => {
  it('shows the name plate and the stat table, bond as a plain row', async () => {
    const w = await mountRobot(deviceView({
      created: Math.floor(Date.now() / 1000) - 3 * 86400,
      settings: { ...deviceView().settings, owner_name: 'Rimi' },
      stats: { volume: 60, mood: 'Happy', state: 'idle', bond_score: 64, bond_level: 3, streak: 12, fw: '2.5.5', uptime_s: 90061,
        rssi: -66, ip: '192.168.1.42', high_scores: { catch: 14, reaction_ms: 245 } },
    }));
    const s = w.findComponent(RobotStatus).text();
    expect(s).toContain('Owner: Rimi');
    expect(s).toContain('4 days together');
    expect(s).toContain('Happy');
    expect(s).toContain('Bond level 3');
    expect(s).toContain('12 days');
    expect(s).toContain('-66 dBm');
    expect(s).toContain('Fair signal');
    expect(s).toContain('1 d 1 h');
    expect(s).toContain('Catch 14, Reaction 245 ms');
    expect(w.find('[role="progressbar"]').exists()).toBe(false);
    expect(s).toContain('State: Idle');
  });

  it('names only the robot states it has words for', async () => {
    const w = await mountRobot(deviceView({ stats: { mood: 'Happy', state: 'boot_wait' } }));
    expect(w.findComponent(RobotStatus).text()).not.toContain('State:');
    expect(w.findComponent(RobotStatus).text()).not.toContain('boot_wait');
  });

  it('loads more events on request', async () => {
    const w = await mountRobot(deviceView({ events: [{ type: 'lonely', ts: 1, rx: 1 }] }));
    expect(w.findComponent(RobotStatus).text()).toContain('The robot felt lonely');
    api.companion.getCompanionEvents.mockImplementation((id, limit, ok) => ok({ data: { data: { events: [
      { type: 'streak', value: 5, ts: 2, rx: 2 }, { type: 'lonely', ts: 1, rx: 1 },
    ] } } }));
    w.vm.loadMoreEvents();
    await flushPromises();
    expect(api.companion.getCompanionEvents.mock.calls[0].slice(0, 2)).toEqual(['dev1', 100]);
    expect(w.vm.events).toHaveLength(2);
    expect(w.findComponent(RobotStatus).text()).toContain('Streak: 5 days');
  });

  it('asks for a robot when there is none', async () => {
    api.companion.getCompanion.mockImplementation(() => {});
    const w = mount(RobotSettings, {
      global: {
        plugins: [Kit, i18n],
        stubs: { teleport: true, RouterLink: true },
        mocks: { $route: { query: {} }, $router: { push: vi.fn() }, $message: message },
      },
    });
    await flushPromises();
    expect(api.companion.getCompanion).not.toHaveBeenCalled();
    expect(w.text()).toContain('No robot connected yet');
  });

  it('shows the status panel (never the raw server text) and keeps the last view on a failed background poll', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    api.companion.getCompanion.mockImplementation((id, ok, fail) => fail({ data: { msg: 'down' } }));
    api.device.getAgentBindDevices.mockImplementation(() => {});
    const w = mount(RobotSettings, {
      global: {
        plugins: [Kit, i18n],
        stubs: { teleport: true, RouterLink: true },
        mocks: { $route: { query: { deviceId: 'dev1' } }, $router: { push: vi.fn() }, $message: message },
      },
    });
    await flushPromises();
    expect(w.find('.tb-rstat').exists()).toBe(true);
    expect(w.text()).toContain('Server problem');
    expect(w.text()).toContain('Check again');
    expect(w.text()).not.toContain('down');
    api.companion.getCompanion.mockImplementation((id, ok) => ok({ data: { data: deviceView() } }));
    w.vm.refresh(false);
    await flushPromises();
    expect(w.vm.view).toBeTruthy();
    api.companion.getCompanion.mockImplementation((id, ok, fail) => fail({ data: { msg: 'down' } }));
    w.vm.refresh(true);
    expect(w.vm.loadError).toBe('');
    expect(w.vm.view).toBeTruthy();
    warn.mockRestore();
  });

  it('a robot on MQTT but unknown to the companion server: waiting panel, auto refresh, no raw text', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    api.companion.getCompanion.mockImplementation((id, ok, fail) => fail({ status: 200, data: { code: 500, msg: 'device not found' } }));
    api.device.getAgentBindDevices.mockImplementation(() => {});
    robot.list = [{ deviceId: 'dev1', agentId: 'ag1', macAddress: 'aa:bb:cc:dd:ee:ff', board: 'tinybot', features: ['companion'] }];
    api.device.getDeviceStatus = vi.fn((id, cb) => cb({ data: { code: 0, data: JSON.stringify({
      'tinybot@@@aa_bb_cc_dd_ee_ff@@@aa_bb_cc_dd_ee_ff': { isAlive: true },
    }) } }));
    const w = mount(RobotSettings, {
      global: {
        plugins: [Kit, i18n],
        stubs: { teleport: true, RouterLink: true },
        mocks: { $route: { query: { deviceId: 'dev1' } }, $router: { push: vi.fn() }, $message: message },
      },
    });
    await flushPromises();
    expect(w.vm.status.state).toBe('waiting_companion');
    expect(w.text()).toContain('Joining the server');
    expect(w.text()).toContain('switch the robot off and on again');
    expect(w.text()).not.toContain('device not found');
    const calls = api.companion.getCompanion.mock.calls.length;
    vi.advanceTimersByTime(15000);
    await flushPromises();
    expect(api.companion.getCompanion.mock.calls.length).toBeGreaterThan(calls);
    // the robot reaches the server: the page fills in
    api.companion.getCompanion.mockImplementation((id, ok) => ok({ data: { data: deviceView() } }));
    await w.find('.tb-rstat button').trigger('click');
    await flushPromises();
    expect(w.vm.status.state).toBe('online');
    expect(w.vm.view).toBeTruthy();
    w.unmount();
    robot.list = [];
    delete api.device.getDeviceStatus;
    warn.mockRestore();
    vi.useRealTimers();
  });

  it('shows pending while saving, applied after, and says an offline robot gets it later', async () => {
    const w = await mountRobot(deviceView());
    let answer;
    api.companion.updateCompanionConfig.mockImplementation((id, patch, ok) => { answer = ok; });
    w.vm.forms.sound.sounds = false;
    w.vm.saveSection('sound');
    expect(w.vm.syncOf('sound').state).toBe('pending');
    answer({ data: { data: deviceView() } });
    expect(w.vm.syncOf('sound').state).toBe('applied');
    w.vm.apply(deviceView({ online: false }));
    expect(w.vm.syncOf('sound')).toEqual({ state: 'pending', text: 'Arrives when online' });
  });
});

describe('Robot: firmware', () => {
  const dev = { id: 'dev1', appVersion: '2.5.4', autoUpdate: 1 };

  it('reads the installed version, the newest build for super admins, and switches auto update', async () => {
    api.ota.getOtaList.mockImplementation((params, ok) => ok({ data: { code: 0, data: { list: [
      { type: 'tinybot', version: '2.5.5', updateDate: '2026-10-20 10:00:00' },
      { type: 'esp-box', version: '9.9.9', updateDate: '2026-10-21 10:00:00' },
    ] } } }));
    api.device.updateDeviceInfo.mockImplementation((id, payload, ok) => ok({ data: { code: 0 } }));
    const w = await mountRobot(deviceView({ stats: { fw: '2.5.4' } }), { user: { superAdmin: 1 }, devices: [dev] });
    expect(api.device.getAgentBindDevices.mock.calls[0][0]).toBe('agent1');
    const fw = w.findComponent(RobotFirmware);
    expect(fw.vm.installed).toBe('2.5.4');
    expect(fw.vm.latest.version).toBe('2.5.5');
    expect(fw.text()).toContain('Update available');
    w.vm.setAutoUpdate(false);
    expect(api.device.updateDeviceInfo.mock.calls[0].slice(0, 2)).toEqual(['dev1', { autoUpdate: 0 }]);
    expect(w.vm.fwDevice.autoUpdate).toBe(0);
    expect(message.success).toHaveBeenCalledWith('Auto update disabled');
  });

  it('puts auto update back when the save fails, and hides the newest build from other users', async () => {
    api.device.updateDeviceInfo.mockImplementation((id, payload, ok) => ok({ data: { code: 500, msg: 'no' } }));
    const w = await mountRobot(deviceView(), { devices: [dev] });
    expect(api.ota.getOtaList).not.toHaveBeenCalled();
    w.vm.setAutoUpdate(false);
    expect(w.vm.fwDevice.autoUpdate).toBe(1);
    expect(message.error).toHaveBeenCalledWith('no');
    expect(w.vm.syncOf('auto').state).toBe('error');
  });

  it('asks before Update now, sends the update command, then waits for TinyBot', async () => {
    api.companion.sendCompanionCommand.mockImplementation((id, type, arg, ok) => ok({ data: { data: { id: 'cu', type } } }));
    const w = await mountRobot(deviceView({ stats: { fw: '2.5.4' } }), { devices: [dev] });
    const fw = w.findComponent(RobotFirmware);
    expect(fw.vm.canUpdate).toBe(true);
    await w.vm.confirmUpdate();
    await flushPromises();
    expect(w.vm.$confirm).toHaveBeenCalled();
    expect(w.vm.$confirm.mock.calls[0][0]).not.toMatch(/—/);
    expect(api.companion.sendCompanionCommand.mock.calls[0].slice(0, 3)).toEqual(['dev1', 'update', '']);
    expect(w.vm.fwUpdate.phase).toBe(PHASE.sent);
    expect(fw.vm.busy).toBe(true);
    w.vm.apply(deviceView({ stats: { fw: '2.5.5' } }));
    expect(w.vm.fwUpdate.phase).toBe(PHASE.updated);
    await flushPromises();
    expect(fw.text()).toContain('Updated to 2.5.5');
    w.vm.dismissUpdate();
    expect(w.vm.fwUpdate.phase).toBe(PHASE.idle);
  });

  it('cannot update an offline robot or one with auto update off', async () => {
    const off = await mountRobot(deviceView({ online: false }), { devices: [dev] });
    expect(off.findComponent(RobotFirmware).vm.canUpdate).toBe(false);
    const noAuto = await mountRobot(deviceView(), { devices: [{ ...dev, autoUpdate: 0 }] });
    expect(noAuto.findComponent(RobotFirmware).vm.canUpdate).toBe(false);
    expect(noAuto.findComponent(RobotFirmware).text()).toContain('Auto update is off');
  });
});

describe('Robot: page rules (pure)', () => {
  it('reads and patches sections like the legacy page', () => {
    const view = deviceView();
    expect(serverForm(view, 'display')).toEqual({ dim_after_min: 3, off_after_min: 20 });
    expect(serverForm({ settings: {} }, 'sound')).toEqual({ controlVolume: false, volume: 70, sounds: true });
    expect(sectionPatch('memory', { enabled: 1 })).toEqual({ settings: { memory: { enabled: true } } });
    expect(sectionProblem('display', { dim_after_min: 5, off_after_min: 5 })).toMatchObject({ key: 'companion.display.offBeforeDim' });
    expect(sectionProblem('display', { dim_after_min: 0, off_after_min: 0 })).toBe(null);
    expect(sectionProblem('sound', {})).toBe(null);
    expect(pickerChoice({ dim_after_min: 10 }, 'dim', false)).toBe(10);
    expect(pickerChoice({ dim_after_min: 10 }, 'dim', true)).toBe('custom');
  });

  it('names the volume in the toast only when the app sets a new one', () => {
    expect(soundSavedNote({ controlVolume: false, volume: 50 }, {}, true)).toBe(null);
    expect(soundSavedNote({ controlVolume: true, volume: 50 }, { controlVolume: true, volume: 50 }, true)).toBe(null);
    expect(soundSavedNote({ controlVolume: true, volume: 50 }, { controlVolume: false, volume: 50 }, true)).toEqual({ key: 'companion.sound.volumeSetTo', n: 50 });
    expect(soundSavedNote({ controlVolume: true, volume: 40 }, {}, false)).toEqual({ key: 'companion.sound.volumeSetOffline', n: 40 });
  });

  it('reads status values', () => {
    expect(wifiQuality(-55)).toBe('good');
    expect(wifiQuality(-70)).toBe('fair');
    expect(wifiQuality(-80)).toBe('weak');
    expect(wifiQuality(undefined)).toBe('');
    expect(uptimeParts(90061)).toEqual({ d: 1, h: 1, m: 1 });
    expect(uptimeParts(null)).toBe(null);
    expect(moodKey('Happy')).toBe('robot.mood.happy');
    expect(moodKey('weird')).toBe('');
    expect(faceMood({ online: false })).toBe('offline');
    expect(faceMood({ online: true, stats: { mood: 'Sleepy' } })).toBe('sleepy');
    expect(daysTogether({ created: 1000 }, 1000 * 1000 + 86400 * 1000 * 2)).toBe(3);
    expect(eventInk({ type: 'alarm_missed' })).toBe('danger');
    expect(eventInk({ type: 'prayer_reminded' })).toBe('prayer');
  });

  it('labels jobs and recent commands', () => {
    expect(jobArg(JOBS.find((j) => j.focus), { pomodoro: { work_min: 0 } })).toBe('25');
    expect(commandLabel({ type: 'game', arg: 'dice' })).toBe('companion.game.dice');
    expect(commandLabel({ type: 'demo', arg: 'hands' })).toBe('robot.demo.hands');
    expect(commandLabel({ type: 'night_light', arg: 'off' })).toBe('companion.action.nightLightOff');
    expect(commandLabel({ type: 'zzz' })).toBe('');
    expect(JOBS.filter((j) => j.type === 'demo').map((j) => j.arg)).toEqual(['all', 'life', 'emotions', 'hands']);
  });

  it('every string of the page exists in Bangla and English, without the em dash', async () => {
    const { default: robotI18n } = await import('@/i18n/pages/robot.js');
    expect(Object.keys(robotI18n.bn).sort()).toEqual(Object.keys(robotI18n.en).sort());
    for (const table of [robotI18n.bn, robotI18n.en]) {
      for (const text of Object.values(table)) expect(text).not.toMatch(/—/);
    }
  });
});

describe('Robot: contract (API routes, route, polling)', () => {
  const apiSource = read('../src/apis/module/companion.js');
  const apiIndexSource = read('../src/apis/api.js');
  const routerSource = read('../src/router/index.js');
  const pageSource = read('../src/views/robot/RobotSettings.vue');

  it('uses the manager-api /device/companion routes', () => {
    expect(apiSource).toMatch(/\$\{getServiceUrl\(\)\}\/device\/companion\$\{path\}/);
    for (const [method, suffix] of [['PUT', "'/config'"], ['GET', "'/messages'"], ['POST', "'/messages'"], ['POST', "'/commands'"]]) {
      expect(apiSource).toMatch(new RegExp(`companionRequest\\('${method}', devicePath\\(deviceId, ${suffix}\\)`));
    }
    expect(apiSource).toMatch(/\/events\?\$\{query\}/);
    expect(apiSource).toMatch(/`\/geocode\?\$\{params\}`/);
  });

  it('is registered and routed, and old companion links still land', () => {
    expect(apiIndexSource).toMatch(/import companion from '\.\/module\/companion\.js'/);
    expect(apiIndexSource).toMatch(/^\s*companion\s*$/m);
    expect(routerSource).toMatch(/path: '\/robot', name: 'RobotSettings'/);
    expect(routerSource).toMatch(/import\('\.\.\/views\/robot\/RobotSettings\.vue'\)/);
    expect(routerSource).toMatch(/path: '\/companion-management'[^\n]*query: to\.query/);
  });

  it('takes the device id from the route (or the chosen robot), polls every 10 s and stops when left', () => {
    expect(pageSource).toMatch(/deviceIdFrom\(this\.\$route\)/);
    expect(pageSource).toMatch(/const REFRESH_MS = 10000;/);
    expect(pageSource).toMatch(/beforeUnmount\(\) \{[\s\S]*clearInterval\(this\.timer\)/);
  });
});
