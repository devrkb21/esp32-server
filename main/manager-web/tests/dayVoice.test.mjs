// The Day page's routines, library and special days tabs (feature wave 1, VOICE), their pure
// rules (src/views/day/dayVoiceModel.js), and one-time voice timers in the alarm/reminder rows.
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
import Day from '@/views/day/Day.vue';
import DayAlarms from '@/views/day/DayAlarms.vue';
import DayRoutines from '@/views/day/DayRoutines.vue';
import DayLibrary from '@/views/day/DayLibrary.vue';
import DaySpecial from '@/views/day/DaySpecial.vue';
import { dayTimeline, tabOfKey } from '@/views/day/dayModel';
import {
  daysUntil, libraryPayload, libraryProblem, monthDay, moveStep, newRoutine, rememberProblem, routinePayload,
  routineProblem, triggerText,
} from '@/views/day/dayVoiceModel';
import { resetRobotStatus } from '@/shell/robotStatus';

enableAutoUnmount(afterEach);

const ROUTINE = {
  id: 'bed', name: 'Bedtime', enabled: true, trigger: { type: 'voice', phrase: 'sleep', days: 127 },
  steps: [{ type: 'say', arg: 'Good night' }, { type: 'play', arg: 'd-rhyme-night' }, { type: 'command', arg: 'night_light:on' }],
};
const LIBRARY = [
  { id: 'l1', kind: 'music', title: 'Rain', audio_url: 'https://example.com/rain.mp3', source: 'owner' },
  { id: 'd-rhyme-night', kind: 'rhyme', title: 'Night rhyme', text: 'Stars...', source: 'default' },
];

function deviceView(overrides = {}) {
  return {
    id: 'aa:bb:cc:dd:ee:ff', name: 'TinyBot', online: true, last_seen: 0, stats: {},
    settings: {
      night: { enabled: false, start: '21:30', end: '06:30' },
      routines: [ROUTINE],
      calendar: { special_days: true, remember: [{ id: 's1', date: '05-05', name: 'Mum', kind: 'birthday' }] },
    },
    pomodoro: { work_min: 25, short_break_min: 5, long_break_min: 15, rounds: 4 },
    alarms: [{ id: 'a1', time: '07:00', days: 2, label: 'Timer', enabled: true, snooze_min: 5, say: '', once: '2026-10-26' }],
    reminders: [],
    prayer: { enabled: false, days: [] },
    weather: { ok: false },
    library: LIBRARY,
    today_special: { key: 'victory_day', name_bn: 'বিজয় দিবস', name_en: 'Victory Day' },
    events: [], messages: [], commands: [],
    ...overrides,
  };
}

const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

async function mountDay(view, query = {}) {
  api.companion.getCompanion.mockImplementation((id, ok) => ok({ data: { data: view } }));
  api.companion.updateCompanionConfig.mockImplementation((id, patch, ok) => ok({ data: { data: view } }));
  api.companion.sendCompanionCommand.mockImplementation((id, type, arg, ok) => ok({ data: { data: {} } }));
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

describe('dayVoiceModel', () => {
  it('validates routines like the server', () => {
    expect(routineProblem(ROUTINE)).toBe('');
    expect(routineProblem({ ...ROUTINE, name: ' ' })).toBe('dayVoice.problem.name');
    expect(routineProblem({ ...ROUTINE, trigger: { type: 'time', time: '' } })).toBe('dayVoice.problem.time');
    expect(routineProblem({ ...ROUTINE, steps: [] })).toBe('dayVoice.problem.noSteps');
    expect(routineProblem({ ...ROUTINE, steps: [{ type: 'say', arg: '' }] })).toBe('dayVoice.problem.say');
    expect(routineProblem({ ...ROUTINE, steps: [{ type: 'command', arg: 'update' }] })).toBe('dayVoice.problem.command');
    expect(routineProblem(ROUTINE, ['l1'])).toBe('dayVoice.problem.play');
    expect(routineProblem({ ...ROUTINE, steps: Array(13).fill({ type: 'weather' }) })).toBe('dayVoice.problem.tooManySteps');
    expect(routinePayload({ ...ROUTINE, steps: [{ type: 'weather', arg: 'x' }] }).steps[0]).toEqual({ type: 'weather', arg: '' });
    expect(newRoutine().steps).toHaveLength(1);
    expect(moveStep([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveStep([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(triggerText(ROUTINE)).toEqual({ key: 'dayVoice.trigger.byVoice', params: { phrase: 'sleep' } });
  });

  it('validates library items and days to remember', () => {
    expect(libraryProblem({ title: 'x', kind: 'story', source: 'text', text: 'hello' })).toBe('');
    expect(libraryProblem({ title: 'x', kind: 'story', source: 'link', url: 'ftp://x' })).toBe('dayVoice.problem.url');
    expect(libraryProblem({ title: '', kind: 'story', source: 'text', text: 'a' })).toBe('dayVoice.problem.title');
    expect(libraryProblem({ title: 'x', kind: 'story', source: 'text', text: 'a'.repeat(501) })).toBe('dayVoice.problem.textLong');
    expect(libraryPayload({ title: ' x ', kind: 'music', source: 'link', url: 'https://a.b/c.mp3' }))
      .toEqual({ kind: 'music', title: 'x', audio_url: 'https://a.b/c.mp3' });
    expect(monthDay(2, 29)).toBe('02-29');
    expect(monthDay(2, 30)).toBe('');
    expect(rememberProblem({ name: 'Mum', date: '05-05', kind: 'birthday' })).toBe('');
    expect(rememberProblem({ name: 'Mum', date: '13-01', kind: 'birthday' })).toBe('dayVoice.problem.date');
    expect(daysUntil('05-05', new Date(2026, 4, 5))).toBe(0);
    expect(daysUntil('05-04', new Date(2026, 4, 5))).toBe(364);
  });

  it('shows a one-time item only on its own date and opens the new tabs by key', () => {
    const view = deviceView();
    const t = (k) => k;
    expect(dayTimeline(view, new Date(2026, 9, 26), t).some((r) => r.key === 'a-a1')).toBe(true);
    expect(dayTimeline(view, new Date(2026, 10, 2), t).some((r) => r.key === 'a-a1')).toBe(false);
    expect(tabOfKey('library')).toBe('library');
  });
});

describe('Day: routines', () => {
  it('saves a new routine as part of the whole list', async () => {
    const w = await mountDay(deviceView());
    const p = await panel(w, 'routines', DayRoutines);
    p.openRoutine(null);
    p.sheet.form.name = 'Morning';
    p.sheet.form.trigger.type = 'time';
    p.sheet.form.trigger.time = '06:30';
    p.sheet.form.steps = [{ type: 'say', arg: 'Hello' }, { type: 'weather', arg: '' }];
    p.save();
    const patch = api.companion.updateCompanionConfig.mock.calls[0][1];
    expect(patch.settings.routines).toHaveLength(2);
    expect(patch.settings.routines[0].id).toBe('bed');
    expect(patch.settings.routines[1]).toMatchObject({ name: 'Morning', trigger: { type: 'time', time: '06:30' } });
  });

  it('refuses an unnamed routine, switches one off, deletes one and runs one now', async () => {
    const w = await mountDay(deviceView());
    const p = await panel(w, 'routines', DayRoutines);
    p.openRoutine(null);
    p.save();
    expect(api.companion.updateCompanionConfig).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledWith('Give the routine a name');
    p.toggle(p.routines[0], false);
    expect(api.companion.updateCompanionConfig.mock.calls[0][1].settings.routines[0]).toMatchObject({ id: 'bed', enabled: false });
    p.remove(p.routines[0]);
    await flushPromises();
    expect(api.companion.updateCompanionConfig.mock.calls[1][1]).toEqual({ settings: { routines: [] } });
    p.runNow(p.routines[0]);
    expect(api.companion.sendCompanionCommand.mock.calls[0].slice(0, 3)).toEqual(['dev1', 'routine', 'bed']);
  });
});

describe('Day: library', () => {
  it('adds, plays and deletes items; samples cannot be deleted', async () => {
    const w = await mountDay(deviceView());
    const p = await panel(w, 'library', DayLibrary);
    expect(w.findAll('.day-row--library')).toHaveLength(2);
    expect(w.findAll('.day-row--library')[1].find('[aria-label^="Delete"]').exists()).toBe(false);
    p.openAdd();
    Object.assign(p.sheet.form, { title: 'My story', kind: 'story', source: 'text', text: 'Once upon a time' });
    p.save();
    expect(api.companion.updateCompanionConfig.mock.calls[0][1])
      .toEqual({ library: { add: { kind: 'story', title: 'My story', text: 'Once upon a time' } } });
    p.play(LIBRARY[1]);
    expect(api.companion.sendCompanionCommand.mock.calls[0].slice(0, 3)).toEqual(['dev1', 'play', 'd-rhyme-night']);
    p.remove(LIBRARY[0]);
    await flushPromises();
    expect(api.companion.updateCompanionConfig.mock.calls[1][1]).toEqual({ library: { delete: ['l1'] } });
    p.kind = 'music';
    await flushPromises();
    expect(w.findAll('.day-row--library')).toHaveLength(1);
  });
});

describe('Day: special days', () => {
  it('shows today and adds a day to remember to the whole list', async () => {
    const w = await mountDay(deviceView(), { tab: 'days' });
    expect(w.vm.tab).toBe('days');
    const p = await panel(w, 'days', DaySpecial);
    expect(w.find('.day-special__name').text()).toBe('Victory Day');
    p.openAdd();
    Object.assign(p.sheet.form, { name: 'Dad', month: 2, day: 29, kind: 'birthday' });
    p.save();
    expect(api.companion.updateCompanionConfig.mock.calls[0][1].settings.calendar.remember).toEqual([
      { id: 's1', date: '05-05', name: 'Mum', kind: 'birthday' }, { date: '02-29', name: 'Dad', kind: 'birthday' },
    ]);
  });
});

describe('Day: one-time timers', () => {
  it('says "Once" with the date instead of the days', async () => {
    const w = await mountDay(deviceView());
    await panel(w, 'alarms', DayAlarms);
    expect(w.find('.day-row--alarm .day-row__meta').text()).toContain('Once, 26 Oct');
  });
});
