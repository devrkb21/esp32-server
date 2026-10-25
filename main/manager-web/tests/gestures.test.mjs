// Tap shortcuts (Robot page, settings.gestures) and the focus timer's start-now / default minutes
// (Day page, Today's focus chip): the page behaviour and the pure rules behind them.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

const api = vi.hoisted(() => ({
  companion: {
    getCompanion: vi.fn(),
    updateCompanionConfig: vi.fn(),
    sendCompanionCommand: vi.fn(),
    getCompanionEvents: vi.fn(),
    geocodeCity: vi.fn(),
  },
  agent: { getAgentList: vi.fn((ok) => ok({ data: { data: [] } })) },
  device: { getAgentBindDevices: vi.fn((id, ok) => ok({ data: { code: 0, data: [] } })), updateDeviceInfo: vi.fn() },
  ota: { getOtaList: vi.fn() },
}));
vi.mock('@/apis/api', () => ({ default: api }));

import Kit from '@/kit';
import i18n from '@/i18n';
import RobotSettings from '@/views/robot/RobotSettings.vue';
import RobotGestures from '@/views/robot/RobotGestures.vue';
import Day from '@/views/day/Day.vue';
import DayFocus from '@/views/day/DayFocus.vue';
import { gestureOptions, sectionPatch, serverForm } from '@/views/robot/robotModel';
import { focusPick, pickedMinutes } from '@/views/day/dayModel';
import {
  FOCUS_PRESETS, GESTURE_ACTIONS, GESTURE_DEFAULTS, focusMinutes, gestureSettings, parseMinutes,
} from '@/utils/companion.mjs';
import { robot } from '@/shell/robot';
import { resetRobotStatus } from '@/shell/robotStatus';

enableAutoUnmount(afterEach);
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

function deviceView(overrides = {}) {
  return {
    id: 'aa:bb:cc:dd:ee:ff', name: 'TinyBot', online: true, last_seen: 0, stats: { volume: 60 },
    settings: { volume: null, sounds: true, owner_name: '', night: { enabled: true, start: '21:30', end: '06:30' } },
    pomodoro: { work_min: 25, short_break_min: 5, long_break_min: 15, rounds: 4 },
    alarms: [], reminders: [], prayer: { enabled: false, days: [] }, weather: { ok: false },
    events: [], messages: [], commands: [],
    ...overrides,
  };
}

const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const mocks = (query) => ({
  $route: { query: { deviceId: 'dev1', agentId: 'agent1', ...query } },
  $router: { push: vi.fn(), replace: vi.fn() },
  $store: { getters: { getUserInfo: { superAdmin: 0 } } },
  $message: message,
  $confirm: vi.fn(() => Promise.resolve('confirm')),
});

async function mountPage(Page, view, query = {}) {
  api.companion.getCompanion.mockImplementation((id, ok) => ok({ data: { data: view } }));
  const wrapper = mount(Page, { global: { plugins: [Kit, i18n], stubs: { teleport: true, RouterLink: true }, mocks: mocks(query) } });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  resetRobotStatus();
  vi.clearAllMocks();
  api.companion.updateCompanionConfig.mockReset();
  api.companion.sendCompanionCommand.mockReset();
  i18n.global.locale = 'en';
  robot.deviceId = ''; robot.list = []; robot.features = [];
  HTMLCanvasElement.prototype.getContext = () => null;
});

describe('Tap shortcuts: rules', () => {
  it('has the firmware actions and defaults', () => {
    expect(GESTURE_ACTIONS).toEqual([
      'none', 'talk', 'focus', 'breathe', 'night_light', 'lullaby', 'story',
      'game_catch', 'game_simon', 'game_dice', 'game_reaction', 'game_random', 'pages', 'status',
    ]);
    expect(GESTURE_DEFAULTS).toEqual({ double_tap: 'none', triple_tap: 'talk' });
  });

  it('reads the gestures with defaults for missing or unknown actions', () => {
    expect(gestureSettings(undefined)).toEqual({ double_tap: 'none', triple_tap: 'talk' });
    expect(gestureSettings({ double_tap: 'focus', triple_tap: 'dance' })).toEqual({ double_tap: 'focus', triple_tap: 'talk' });
    expect(serverForm({ settings: { gestures: { triple_tap: 'game_random' } } }, 'gestures')).toEqual({ double_tap: 'none', triple_tap: 'game_random' });
    expect(sectionPatch('gestures', { double_tap: 'breathe', triple_tap: 'talk', extra: 1 })).toEqual({ settings: { gestures: { double_tap: 'breathe', triple_tap: 'talk' } } });
  });

  it('offers every action once, the games in their own group, with Bangla labels', () => {
    i18n.global.locale = 'bn';
    const opts = gestureOptions((k) => i18n.global.t(k));
    const flat = opts.flatMap((o) => (o.group ? o.options : [o]));
    expect(flat.map((o) => o.value).sort()).toEqual([...GESTURE_ACTIONS].sort());
    const games = opts.find((o) => o.group);
    expect(games.group).toBe('খেলা');
    expect(games.options.map((o) => o.label)).toEqual(['খেলা: ক্যাচ', 'খেলা: সাইমন', 'খেলা: ছক্কা', 'খেলা: রিঅ্যাকশন', 'খেলা: যেকোনো একটা']);
    expect(flat.find((o) => o.value === 'none').label).toBe('কিছু না');
    expect(flat.find((o) => o.value === 'pages').label).toBe('তথ্যের পাতা');
    expect(flat.find((o) => o.value === 'status').label).toBe('অবস্থা');
  });
});

describe('Tap shortcuts: Robot page', () => {
  it('shows two pickers, saves them through the config PUT and shows the sync state', async () => {
    const w = await mountPage(RobotSettings, deviceView({ settings: { gestures: { double_tap: 'none', triple_tap: 'talk' } } }));
    const sec = w.findComponent(RobotGestures);
    expect(sec.exists()).toBe(true);
    expect(sec.findAll('select')).toHaveLength(2);
    expect(sec.text()).toContain('Tap the head exactly two or three times; four taps do nothing.');
    expect(w.vm.isDirty('gestures')).toBe(false);

    let answer;
    api.companion.updateCompanionConfig.mockImplementation((id, patch, ok) => { answer = ok; });
    await sec.findAll('select')[0].setValue('focus');
    expect(w.vm.forms.gestures).toEqual({ double_tap: 'focus', triple_tap: 'talk' });
    expect(w.vm.isDirty('gestures')).toBe(true);
    w.vm.saveSection('gestures');
    expect(api.companion.updateCompanionConfig.mock.calls[0].slice(0, 2)).toEqual(['dev1', { settings: { gestures: { double_tap: 'focus', triple_tap: 'talk' } } }]);
    expect(w.vm.syncOf('gestures').state).toBe('pending');
    answer({ data: { data: deviceView({ settings: { gestures: { double_tap: 'focus', triple_tap: 'talk' } } }) } });
    await flushPromises();
    expect(w.vm.syncOf('gestures').state).toBe('applied');
    expect(w.vm.isDirty('gestures')).toBe(false);
  });

  it('names the focus minutes when a tap starts the focus timer', async () => {
    const w = await mountPage(RobotSettings, deviceView({ settings: { gestures: { double_tap: 'focus' } }, pomodoro: { work_min: 45 } }));
    expect(w.findComponent(RobotGestures).text()).toContain('The focus timer runs for 45 minutes');
  });

  it('is hidden for a product without the companion module', async () => {
    robot.list = [{ deviceId: 'dev1', features: ['chat'] }];
    const w = await mountPage(RobotSettings, deviceView());
    expect(w.findComponent(RobotGestures).exists()).toBe(false);
    expect(w.vm.sections).not.toContain('gestures');
  });

  it('every new string exists in Bangla and English, without the em dash', async () => {
    const { default: t } = await import('@/i18n/pages/robot.js');
    const mine = Object.keys(t.en).filter((k) => /^robot\.(gesture|gestures|sec\.gestures)/.test(k));
    expect(mine.length).toBeGreaterThan(20);
    for (const k of mine) {
      expect(t.bn[k]).toBeTruthy();
      expect(t.bn[k] + t.en[k]).not.toMatch(/—/);
    }
    expect(t.bn['robot.sec.gestures']).toBe('টোকা দিয়ে কাজ');
    expect(t.bn['robot.gestures.hint']).toBe('মাথায় ঠিক দুবার বা তিনবার টোকা দিন; চারবার দিলে কিছু হবে না।');
  });
});

describe('Focus timer: rules', () => {
  it('reads typed minutes in Latin or Bangla digits, 1 to 120 only', () => {
    expect(parseMinutes('25')).toBe(25);
    expect(parseMinutes('৪৫')).toBe(45);
    expect(parseMinutes(' ১২০ ')).toBe(120);
    expect(parseMinutes(90)).toBe(90);
    for (const bad of ['', '0', '121', '১২১', '2.5', 'abc', '-5', null, undefined, 0, 7.5]) expect(parseMinutes(bad)).toBe(null);
  });

  it('turns minutes into a chip or the custom box and back', () => {
    expect(FOCUS_PRESETS).toEqual([15, 25, 45, 60]);
    expect(focusPick(25)).toEqual({ choice: 25, custom: '' });
    expect(focusPick(50)).toEqual({ choice: 'custom', custom: '50' });
    expect(pickedMinutes(45, '')).toBe(45);
    expect(pickedMinutes('custom', '৯০')).toBe(90);
    expect(pickedMinutes('custom', '200')).toBe(null);
  });

  it('uses the saved default minutes, else 25', () => {
    expect(focusMinutes({ pomodoro: { work_min: 45 } })).toBe(45);
    expect(focusMinutes({ pomodoro: { work_min: 0 } })).toBe(25);
    expect(focusMinutes(null)).toBe(25);
  });
});

describe('Focus timer: Day page', () => {
  async function focusPanel(view) {
    const w = await mountPage(Day, view);
    w.vm.tab = 'focus';
    await flushPromises();
    return { w, f: w.findComponent(DayFocus) };
  }

  it('starts with the saved minutes, a chip or a typed number, right away', async () => {
    const { w, f } = await focusPanel(deviceView({ pomodoro: { work_min: 45, short_break_min: 5, long_break_min: 15, rounds: 4 } }));
    expect(f.vm.chosen).toBe(45);
    expect(f.vm.pick.choice).toBe(45);
    const chips = f.findAll('.tb-choice__opt');
    expect(chips.map((c) => c.text())).toEqual(['15 min', '25 min', '45 min', '60 min']);
    await chips[0].trigger('click');
    expect(f.vm.chosen).toBe(15);
    const start = f.findAll('button').find((b) => b.text() === 'Start now');
    await start.trigger('click');
    expect(api.companion.sendCompanionCommand.mock.calls[0].slice(0, 3)).toEqual(['dev1', 'pomodoro', '15']);
    // no answer yet: one at a time
    await start.trigger('click');
    expect(api.companion.sendCompanionCommand).toHaveBeenCalledTimes(1);
    w.vm.busy = '';

    i18n.global.locale = 'bn';
    await f.find('#day-focus-custom').setValue('৯০');
    expect(f.vm.pick.choice).toBe('custom');
    expect(f.vm.chosen).toBe(90);
    f.vm.startNow();
    expect(api.companion.sendCompanionCommand.mock.calls[1].slice(0, 3)).toEqual(['dev1', 'pomodoro', '90']);
  });

  it('will not start with minutes out of range', async () => {
    const { f } = await focusPanel(deviceView());
    await f.find('#day-focus-custom').setValue('150');
    expect(f.vm.chosen).toBe(null);
    const start = f.findAll('button').find((b) => b.text() === 'Start now');
    expect(start.attributes('disabled')).toBeDefined();
    f.vm.startNow();
    expect(api.companion.sendCompanionCommand).not.toHaveBeenCalled();
    expect(f.text()).toContain('Type a number from 1 to 120 minutes.');
  });

  it('saves the chosen minutes as the default and keeps unsaved round edits', async () => {
    const view = deviceView();
    const { f } = await focusPanel(view);
    expect(f.findAll('button').some((b) => b.text().startsWith('Make'))).toBe(false);
    f.vm.forms.pomodoro.rounds = 6;
    await f.findAll('.tb-choice__opt')[3].trigger('click');
    const make = f.findAll('button').find((b) => b.text() === 'Make 60 min the default');
    expect(make).toBeTruthy();
    api.companion.updateCompanionConfig.mockImplementation((id, patch, ok) => ok({ data: { data: deviceView({ pomodoro: { ...view.pomodoro, work_min: 60 } }) } }));
    await make.trigger('click');
    await flushPromises();
    expect(api.companion.updateCompanionConfig.mock.calls[0][1]).toEqual({ pomodoro: { work_min: 60 } });
    expect(f.vm.forms.pomodoro).toMatchObject({ work_min: 60, rounds: 6 });
    expect(f.vm.isDirty('pomodoro')).toBe(true);
    f.vm.saveSection('pomodoro');
    expect(api.companion.updateCompanionConfig.mock.calls[1][1]).toEqual({ pomodoro: { work_min: 60, short_break_min: 5, long_break_min: 15, rounds: 6 } });
    expect(f.vm.savedWork).toBe(60);
    expect(f.text()).toContain('This is the default');
  });

  it('keeps the rounds and breaks settings', async () => {
    const { f } = await focusPanel(deviceView());
    for (const id of ['rounds', 'short_break_min', 'long_break_min']) expect(f.find(`#day-focus-${id}`).exists()).toBe(true);
  });
});

describe('Focus timer: Today chip', () => {
  it('sends and names the saved default minutes', () => {
    const src = read('../src/views/today/Today.vue');
    expect(src).toMatch(/focusMinutes\(view\.value\)/);
    expect(src).toMatch(/label: 'today\.cmd\.focus', arg: focusMin\.value/);
    expect(src).not.toMatch(/arg: 25/);
    expect(i18n.global.t('today.cmd.focus', { n: 45 })).toBe('Focus 45 min');
  });
});
