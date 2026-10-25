// The Day page (src/views/day): the checks of tests/legacy/companionView.test.mjs for the
// alarms, reminders, prayer, focus, day (routine) and night tabs, ported to the new page,
// plus the page's own rules (timeline, ?focus, sync states).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

const api = vi.hoisted(() => ({
  companion: {
    getCompanion: vi.fn(),
    updateCompanionConfig: vi.fn(),
    sendCompanionCommand: vi.fn(),
    geocodeCity: vi.fn(),
  },
  agent: { getAgentList: vi.fn((ok) => ok({ data: { data: [] } })) },
  device: { getAgentBindDevices: vi.fn((id, ok) => ok({ data: { data: [] } })) },
}));
vi.mock('@/apis/api', () => ({ default: api }));

import Kit from '@/kit';
import i18n from '@/i18n';
import * as utils from '@/utils/companion.mjs';
import Day from '@/views/day/Day.vue';
import DayAlarms from '@/views/day/DayAlarms.vue';
import DayReminders from '@/views/day/DayReminders.vue';
import DayRoutine from '@/views/day/DayRoutine.vue';
import DayFocus from '@/views/day/DayFocus.vue';
import DayNight from '@/views/day/DayNight.vue';
import DayPrayer from '@/views/day/DayPrayer.vue';
import {
  dayTimeline, firesOn, previewActivity, nowIndex, routineOfKey, sectionPatch, sectionProblem, serverForm, tabOfKey,
} from '@/views/day/dayModel';
import { daysText, durationText, reminderWhen } from '@/views/day/dayText';
import { resetRobotStatus } from '@/shell/robotStatus';

// pages poll every 10 s: a page left mounted by one test must not answer in the next
enableAutoUnmount(afterEach);

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

async function mountDay(view, query = {}) {
  api.companion.getCompanion.mockImplementation((id, ok) => ok({ data: { data: view } }));
  const wrapper = mount(Day, {
    global: {
      plugins: [Kit, i18n],
      stubs: { teleport: true, RouterLink: true },
      mocks: {
        $route: { query: { deviceId: 'dev1', ...query } },
        $router: { push: vi.fn(), replace: vi.fn() },
        $message: message,
        $confirm: vi.fn(() => Promise.resolve('confirm')),
      },
    },
  });
  await flushPromises();
  return wrapper;
}

async function panel(wrapper, tab, Comp) {
  wrapper.vm.tab = tab;
  await flushPromises();
  return wrapper.findComponent(Comp).vm;
}

beforeEach(() => {
  resetRobotStatus();
  vi.clearAllMocks();
  i18n.global.locale = 'en';
  HTMLCanvasElement.prototype.getContext = () => null;
});

describe('Day: alarms (whole list patches)', () => {
  it('sends the whole alarm list without server-only fields when adding an alarm', async () => {
    const w = await mountDay(deviceView());
    const alarms = await panel(w, 'alarms', DayAlarms);
    alarms.openAlarm(null);
    alarms.sheet.form.time = '07:15';
    alarms.saveAlarm();
    const [deviceId, patch] = api.companion.updateCompanionConfig.mock.calls[0];
    expect(deviceId).toBe('dev1');
    expect(patch.alarms).toHaveLength(2);
    expect(patch.alarms[0]).toEqual({ id: 'a1', time: '06:30', days: 62, label: 'Wake up', enabled: true, snooze_min: 5, say: '' });
    expect(patch.alarms[1]).toMatchObject({ time: '07:15', days: 127 });
    expect(patch.alarms[1]).not.toHaveProperty('id');
  });

  it('refuses to save an alarm without a time', async () => {
    const w = await mountDay(deviceView());
    const alarms = await panel(w, 'alarms', DayAlarms);
    alarms.openAlarm(null);
    alarms.sheet.form.time = null;
    alarms.saveAlarm();
    expect(api.companion.updateCompanionConfig).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledWith('Please pick a time');
  });

  it('switches one alarm and deletes one after asking', async () => {
    const w = await mountDay(deviceView());
    const alarms = await panel(w, 'alarms', DayAlarms);
    alarms.toggleAlarm(alarms.alarms[0], false);
    expect(api.companion.updateCompanionConfig.mock.calls[0][1].alarms[0]).toMatchObject({ id: 'a1', enabled: false });
    expect(api.companion.updateCompanionConfig.mock.calls[0][1].alarms[0]).not.toHaveProperty('say_audio');
    alarms.deleteAlarm(alarms.alarms[0]);
    await flushPromises();
    expect(w.vm.$confirm).toHaveBeenCalled();
    expect(api.companion.updateCompanionConfig.mock.calls[1][1]).toEqual({ alarms: [] });
  });

  it('keeps alarm labels in ASCII for the OLED', () => {
    expect(utils.asciiLabel('সকাল Wake  up')).toBe(' Wake up');
  });
});

describe('Day: reminders', () => {
  it('saves an interval reminder with only its mode fields and refuses a missing time', async () => {
    const w = await mountDay(deviceView());
    const r = await panel(w, 'reminders', DayReminders);
    r.openReminder(null, 'water');
    r.sheet.form.from = '';
    r.saveReminder();
    expect(api.companion.updateCompanionConfig).not.toHaveBeenCalled();
    r.sheet.form.from = '08:00';
    r.saveReminder();
    const item = api.companion.updateCompanionConfig.mock.calls[0][1].reminders[0];
    expect(item).toMatchObject({ kind: 'water', mode: 'interval', every_min: 60, from: '08:00', to: '21:00', days: 127 });
    expect(item).not.toHaveProperty('time');
  });

  it('refuses an interval outside 5 to 720 minutes', async () => {
    const w = await mountDay(deviceView());
    const r = await panel(w, 'reminders', DayReminders);
    r.openReminder(null, 'water');
    r.sheet.form.every_min = 2;
    r.saveReminder();
    expect(api.companion.updateCompanionConfig).not.toHaveBeenCalled();
  });

  it('writes when a reminder fires', () => {
    const t = (k, p) => (k === 'day.reminder.whenInterval' ? `every ${p.every} min, ${p.from} to ${p.to}` : k === 'day.preset.everyDay' ? 'Every day' : k);
    expect(reminderWhen({ mode: 'interval', every_min: 90, from: '09:00', to: '21:00', days: 127 }, t)).toBe('every 90 min, 09:00 to 21:00, Every day');
    expect(daysText(5, (k) => k)).toBe('day.weekday.0, day.weekday.2');
  });
});

describe('Day: prayer', () => {
  it('saves the switches and a chosen city (for the weather too)', async () => {
    const w = await mountDay(deviceView({ prayer: { enabled: true, remind: true, city: 'Dhaka', days: [] } }));
    const p = await panel(w, 'prayer', DayPrayer);
    p.savePrayer({ remind: false });
    expect(api.companion.updateCompanionConfig.mock.calls[0][1]).toEqual({ prayer: { remind: false } });
    p.query = 'S';
    p.searchCity();
    expect(api.companion.geocodeCity).not.toHaveBeenCalled();
    p.query = 'Sylhet';
    p.searchCity();
    expect(api.companion.geocodeCity.mock.calls[0][0]).toBe('Sylhet');
    p.chooseCity({ name: 'Sylhet', lat: '24.9', lon: '91.87' });
    expect(api.companion.updateCompanionConfig.mock.calls[1][1]).toEqual({
      prayer: { city: 'Sylhet', lat: 24.9, lon: 91.87 }, weather: { city: 'Sylhet', lat: 24.9, lon: 91.87 },
    });
  });
});

describe('Day: focus timer', () => {
  it('saves the pomodoro section and starts with the work minutes', async () => {
    const w = await mountDay(deviceView({ pomodoro: { work_min: 40, short_break_min: 5, long_break_min: 15, rounds: 4 } }));
    const f = await panel(w, 'focus', DayFocus);
    expect(f.isDirty('pomodoro')).toBe(false);
    f.forms.pomodoro.rounds = 6;
    expect(f.isDirty('pomodoro')).toBe(true);
    f.saveSection('pomodoro');
    expect(api.companion.updateCompanionConfig.mock.calls[0][1]).toEqual({ pomodoro: { work_min: 40, short_break_min: 5, long_break_min: 15, rounds: 6 } });
    w.vm.command('pomodoro', f.forms.pomodoro.work_min, 'ok');
    expect(api.companion.sendCompanionCommand.mock.calls[0].slice(0, 3)).toEqual(['dev1', 'pomodoro', 40]);
  });

  it('refuses minutes outside the limits', async () => {
    const w = await mountDay(deviceView());
    const f = await panel(w, 'focus', DayFocus);
    f.forms.pomodoro.work_min = 121;
    f.saveSection('pomodoro');
    expect(api.companion.updateCompanionConfig).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledWith('Work: 1 to 120 minutes');
  });

  it('keeps unsaved edits when switching tabs', async () => {
    const w = await mountDay(deviceView());
    const f = await panel(w, 'focus', DayFocus);
    f.forms.pomodoro.rounds = 7;
    await panel(w, 'alarms', DayAlarms);
    const again = await panel(w, 'focus', DayFocus);
    expect(again.forms.pomodoro.rounds).toBe(7);
    expect(again.isDirty('pomodoro')).toBe(true);
  });

  it('keeps unsaved edits when the background refresh brings new data', async () => {
    const w = await mountDay(deviceView());
    const f = await panel(w, 'focus', DayFocus);
    f.forms.pomodoro.work_min = 50;
    w.vm.apply(deviceView({ pomodoro: { work_min: 30, short_break_min: 5, long_break_min: 15, rounds: 4 } }));
    await flushPromises();
    expect(f.forms.pomodoro.work_min).toBe(50);
    expect(f.isDirty('pomodoro')).toBe(true);
  });
});

describe('Day: night and care', () => {
  it('saves the night light minutes with the night section', async () => {
    const w = await mountDay(deviceView());
    const n = await panel(w, 'night', DayNight);
    expect(n.forms.night.light_minutes).toBe(0);
    expect(n.lightChoice).toBe(0);
    n.pickLight(45);
    n.saveSection('night');
    expect(api.companion.updateCompanionConfig.mock.calls[0][1].settings.night).toMatchObject({ light: false, light_minutes: 45 });
  });

  it('refuses night light minutes above the limit and a missing time', async () => {
    const w = await mountDay(deviceView());
    const n = await panel(w, 'night', DayNight);
    n.forms.night.light_minutes = 700;
    n.saveSection('night');
    n.forms.night.light_minutes = 0;
    n.forms.night.start = '';
    n.saveSection('night');
    expect(api.companion.updateCompanionConfig).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledTimes(2);
  });

  it('switches odd night light values to Custom and back on undo', async () => {
    const view = deviceView();
    view.settings.night.light_minutes = 25;
    const w = await mountDay(view);
    const n = await panel(w, 'night', DayNight);
    expect(n.lightChoice).toBe('custom');
    n.pickLight(30);
    expect(n.lightChoice).toBe(30);
    n.undo('night');
    expect(n.forms.night.light_minutes).toBe(25);
  });

  it('saves care as its own patch and sends the night commands', async () => {
    const w = await mountDay(deviceView());
    const n = await panel(w, 'night', DayNight);
    n.forms.care.lonely_after_min = 240;
    n.saveSection('care');
    expect(api.companion.updateCompanionConfig.mock.calls[0][1]).toEqual({ settings: { care: { enabled: true, lonely_after_min: 240 } } });
    w.vm.command('night', 'on', 'ok', 'night:on');
    expect(api.companion.sendCompanionCommand.mock.calls[0].slice(0, 3)).toEqual(['dev1', 'night', 'on']);
  });
});

describe('Day: TinyBot\'s routine', () => {
  const day = (items, enabled = true) => deviceView({ settings: { ...deviceView().settings, routine: { enabled, items } } });

  it('shows the default day when the server sends none, without unsaved changes', async () => {
    const w = await mountDay(deviceView());
    const r = await panel(w, 'routine', DayRoutine);
    expect(r.forms.routine).toEqual(utils.defaultRoutine());
    expect(r.isDirty('routine')).toBe(false);
    expect(r.isDefaultDay).toBe(true);
  });

  it('adds, edits and removes activities locally, then saves the whole sorted list', async () => {
    const w = await mountDay(day([{ start: '09:00', end: '10:00', activity: 'work' }]));
    const r = await panel(w, 'routine', DayRoutine);
    r.openDayItem(-1);
    expect(r.sheet.form).toEqual({ start: '10:00', end: '10:30', activity: 'tea' });
    r.sheet.form.start = '07:00';
    r.sheet.form.end = '07:20';
    r.sheet.form.activity = 'exercise';
    r.applyDayItem();
    expect(r.forms.routine.items.map((i) => i.activity)).toEqual(['exercise', 'work']);
    expect(r.isDirty('routine')).toBe(true);
    expect(r.picked).toBe('exercise');
    r.openDayItem(1);
    r.sheet.form.activity = 'art';
    r.applyDayItem();
    r.removeDayItem(0);
    r.saveSection('routine');
    expect(api.companion.updateCompanionConfig.mock.calls[0][1]).toEqual({
      settings: { routine: { enabled: true, items: [{ start: '09:00', end: '10:00', activity: 'art' }] } },
    });
  });

  it('refuses an item that starts and ends at the same time', async () => {
    const w = await mountDay(day([]));
    const r = await panel(w, 'routine', DayRoutine);
    r.openDayItem(-1);
    r.sheet.form.end = r.sheet.form.start;
    expect(r.sheetProblem).toBe('Start and end must be different times');
    r.applyDayItem();
    expect(r.forms.routine.items).toEqual([]);
  });

  it('warns about overlaps, undoes, resets to the default day and refuses too many items', async () => {
    const w = await mountDay(day([
      { start: '09:00', end: '10:00', activity: 'work' },
      { start: '09:30', end: '09:45', activity: 'tea' },
    ], false));
    const r = await panel(w, 'routine', DayRoutine);
    expect(r.overlaps).toEqual([[0, 1]]);
    expect(r.overlapRows).toEqual({ 0: true, 1: true });
    r.resetDay();
    expect(r.forms.routine.items).toEqual(utils.defaultRoutine().items);
    expect(r.forms.routine.enabled).toBe(false);
    expect(r.isDirty('routine')).toBe(true);
    r.revertSection('routine');
    expect(r.forms.routine.items).toHaveLength(2);
    r.forms.routine.items = Array.from({ length: 25 }, () => ({ start: '09:00', end: '10:00', activity: 'tea' }));
    r.saveSection('routine');
    expect(api.companion.updateCompanionConfig).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledWith('At most 24 activities per day');
  });

  it('previews what TinyBot is doing, else what is scheduled now', () => {
    expect(previewActivity('', { activity: 'tea' }, { enabled: true, items: [] }, 600)).toBe('tea');
    const routine = { enabled: true, items: [{ start: '10:00', end: '11:00', activity: 'book' }] };
    expect(previewActivity('', {}, routine, 630)).toBe('book');
    expect(nowIndex(routine, 630)).toBe(0);
    expect(previewActivity('boxing', {}, routine, 630)).toBe('boxing');
    expect(previewActivity('', {}, { ...routine, enabled: false }, 630)).toBe('exercise');
    expect(nowIndex({ ...routine, enabled: false }, 630)).toBe(-1);
  });

  it('writes durations, through midnight too', () => {
    const t = (k, p) => `${k}:${JSON.stringify(p || {})}`;
    expect(durationText({ start: '09:00', end: '10:30', activity: 'work' }, t)).toBe('day.routine.durationHours:{"h":1,"m":30}');
    expect(durationText({ start: '23:30', end: '00:15', activity: 'tv' }, t)).toBe('day.routine.durationMin:{"n":45}, day.routine.nextDay:{}');
  });
});

describe('Day: the page', () => {
  it('lays out the day as a timeline with the keys Today links to', () => {
    const view = deviceView({
      prayer: { enabled: true, remind: true, days: [{ date: '2026-10-25', fajr: '04:46', sunrise: '06:05', dhuhr: '11:43', asr: '15:46', maghrib: '17:25', isha: '18:40' }] },
      reminders: [
        { id: 'r1', kind: 'medicine', label: 'Medicine', enabled: true, mode: 'time', time: '11:30', days: 127 },
        { id: 'w', kind: 'water', label: 'Water', enabled: false, mode: 'interval', every_min: 90, from: '09:00', to: '21:00', days: 127 },
      ],
    });
    view.settings.routine = { enabled: true, items: [{ start: '08:00', end: '08:15', activity: 'exercise' }] };
    const sunday = new Date(2026, 9, 25, 12, 0);
    const rows = dayTimeline(view, sunday, (k) => k, (x) => x, { routine: true });
    const keys = rows.map((r) => r.key);
    expect(keys).toEqual(expect.arrayContaining(['p-fajr', 'p-isha', 'r-r1', 'r-w', 'l-08:00-exercise', 'night']));
    expect(keys).not.toContain('p-sunrise');
    // a1 rings Monday to Friday (62): not on a Sunday
    expect(keys).not.toContain('a-a1');
    expect(rows.find((r) => r.key === 'r-w').sync).toBe('off');
    expect(rows.find((r) => r.key === 'l-08:00-exercise').sync).toBe('pending');
    expect(firesOn(62, new Date(2026, 9, 26))).toBe(true);
    expect(firesOn(1, sunday)).toBe(true);
  });

  it('maps row keys to tabs', () => {
    expect(['a-1', 'r-x', 'p-asr', 'l-08:00-tea', 'night', 'zzz'].map(tabOfKey)).toEqual(['alarms', 'reminders', 'prayer', 'routine', 'night', '']);
    expect(routineOfKey('l-08:00-tea')).toEqual({ start: '08:00', activity: 'tea' });
  });

  it('opens the row named by ?focus', async () => {
    const w = await mountDay(deviceView(), { focus: 'a-a1' });
    expect(w.vm.tab).toBe('alarms');
    const alarms = w.findComponent(DayAlarms).vm;
    expect(alarms.sheet.open).toBe(true);
    expect(alarms.sheet.form.time).toBe('06:30');

    const view = deviceView();
    view.settings.routine = { enabled: true, items: [{ start: '09:00', end: '10:00', activity: 'work' }] };
    const w2 = await mountDay(view, { focus: 'l-09:00-work' });
    expect(w2.vm.tab).toBe('routine');
    expect(w2.findComponent(DayRoutine).vm.sheet.form).toEqual({ start: '09:00', end: '10:00', activity: 'work' });
  });

  it('shows pending while saving, applied after, and says an offline robot gets it later', async () => {
    const w = await mountDay(deviceView());
    let answer;
    api.companion.updateCompanionConfig.mockImplementation((id, patch, ok) => { answer = ok; });
    const alarms = await panel(w, 'alarms', DayAlarms);
    alarms.toggleAlarm(alarms.alarms[0], false);
    expect(w.vm.syncOf('alarms').state).toBe('pending');
    answer({ data: { data: deviceView() } });
    expect(w.vm.syncOf('alarms').state).toBe('applied');

    w.vm.apply(deviceView({ online: false }));
    alarms.toggleAlarm(alarms.alarms[0], true);
    answer({ data: { data: deviceView({ online: false }) } });
    expect(w.vm.syncOf('alarms')).toEqual({ state: 'pending', text: 'Arrives when online' });
    expect(message.success).toHaveBeenLastCalledWith('Saved. TinyBot gets it when it is back online.');
  });

  it('shows the error state of a failed save', async () => {
    const w = await mountDay(deviceView());
    api.companion.updateCompanionConfig.mockImplementation((id, patch, ok, fail) => fail({ data: { msg: 'nope' } }));
    const p = await panel(w, 'prayer', DayPrayer);
    p.savePrayer({ enabled: true });
    expect(w.vm.syncOf('prayer').state).toBe('error');
    expect(message.error).toHaveBeenCalledWith('nope');
  });

  it('asks for a robot when there is none', async () => {
    api.companion.getCompanion.mockImplementation(() => {});
    const w = mount(Day, {
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
});

describe('Day: section rules', () => {
  it('reads and patches sections like the legacy page', () => {
    const view = deviceView();
    expect(serverForm(view, 'night').light_minutes).toBe(0);
    expect(sectionPatch('care', { enabled: false, lonely_after_min: 60 })).toEqual({ settings: { care: { enabled: false, lonely_after_min: 60 } } });
    expect(sectionProblem('care', { enabled: true, lonely_after_min: 5 })).toMatchObject({ key: 'day.problem.lonely' });
    expect(sectionProblem('night', { start: '21:00', end: '06:00', light_minutes: 601 })).toMatchObject({ key: 'day.problem.lightRange' });
    expect(sectionProblem('night', { start: '21:00', end: '06:00', light_minutes: 600 })).toBeNull();
  });
});
