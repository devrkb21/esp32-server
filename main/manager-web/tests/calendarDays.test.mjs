// Special days back office (src/views/calendar): rules and the page's calls.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

const api = vi.hoisted(() => ({
  calendar: { getCalendarDays: vi.fn(), saveCalendarDay: vi.fn(), deleteCalendarDays: vi.fn() },
}));
vi.mock('@/apis/api', () => ({ default: api }));

import Kit from '@/kit';
import i18n from '@/i18n';
import CalendarDays from '@/views/calendar/CalendarDays.vue';
import { dayPayload, dayProblem, newDay, withState } from '@/views/calendar/calendarModel';

enableAutoUnmount(afterEach);

const DAYS = [
  { id: '7', date: '2027-03-10', key: 'eid_ul_fitr', nameBn: 'ঈদুল ফিতর', nameEn: 'Eid ul-Fitr' },
  { id: '8', date: '2026-01-02', key: 'custom', nameBn: 'পিকনিক', nameEn: 'Picnic' },
];
const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const ok = (data) => (cb) => cb({ data: { code: 0, data } });

function mountPage() {
  return mount(CalendarDays, {
    global: {
      plugins: [Kit, i18n],
      stubs: { teleport: true, RouterLink: true },
      mocks: { $message: message, $confirm: vi.fn(() => Promise.resolve('confirm')) },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  i18n.global.locale = 'en';
  api.calendar.getCalendarDays.mockImplementation(ok(DAYS));
  api.calendar.saveCalendarDay.mockImplementation((d, cb) => cb({ data: { code: 0, data: d } }));
  api.calendar.deleteCalendarDays.mockImplementation((ids, cb) => cb({ data: { code: 0, data: null } }));
});

describe('calendarModel', () => {
  it('checks dates, keys and names like manager-api', () => {
    expect(dayProblem({ date: '2027-03-10', key: 'eid_ul_fitr' })).toBe('');
    expect(dayProblem({ date: '2027-02-30', key: 'eid_ul_fitr' })).toBe('calendar.problem.date');
    expect(dayProblem({ date: '2027-03-10', key: 'victory_day' })).toBe('calendar.problem.key');
    expect(dayProblem({ date: '2027-03-10', key: 'custom' })).toBe('calendar.problem.name');
    expect(dayProblem({ date: '2027-03-10', key: 'custom', nameEn: 'x'.repeat(61) })).toBe('calendar.problem.nameLong');
    expect(dayPayload({ id: '1', date: '2027-03-10', key: 'custom', nameBn: ' a ', nameEn: '' }))
      .toEqual({ id: '1', date: '2027-03-10', key: 'custom', nameBn: 'a', nameEn: '' });
    expect(newDay(new Date(2027, 0, 5)).date).toBe('2027-01-05');
    expect(withState(DAYS, '2026-06-01').map((d) => [d.id, d.state])).toEqual([['8', 'past'], ['7', 'upcoming']]);
  });
});

describe('CalendarDays page', () => {
  it('lists, adds, edits and deletes days', async () => {
    const w = mountPage();
    await flushPromises();
    expect(api.calendar.getCalendarDays).toHaveBeenCalled();
    expect(w.text()).toContain('Eid ul-Fitr');
    w.vm.openAdd();
    w.vm.sheet.form.key = 'custom';
    w.vm.save();
    expect(api.calendar.saveCalendarDay).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledWith('Give the other day a name');
    w.vm.sheet.form.nameEn = 'Sports day';
    w.vm.save();
    expect(api.calendar.saveCalendarDay.mock.calls[0][0]).toMatchObject({ key: 'custom', nameEn: 'Sports day' });
    expect(api.calendar.saveCalendarDay.mock.calls[0][0]).not.toHaveProperty('id');
    w.vm.openEdit(DAYS[0]);
    w.vm.save();
    expect(api.calendar.saveCalendarDay.mock.calls[1][0]).toMatchObject({ id: '7', key: 'eid_ul_fitr' });
    await w.vm.remove(DAYS[1]);
    await flushPromises();
    expect(api.calendar.deleteCalendarDays.mock.calls[0][0]).toEqual(['8']);
  });

  it('shows the failure state with a retry', async () => {
    api.calendar.getCalendarDays.mockImplementation((cb, fail) => fail(new Error('down')));
    const w = mountPage();
    await flushPromises();
    expect(w.text()).toContain('The list could not be loaded');
  });
});
