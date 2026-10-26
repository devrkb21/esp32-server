import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const api = vi.hoisted(() => ({
  summary: { getSummaries: vi.fn(), buildToday: vi.fn() },
  agent: { getAgentList: vi.fn((cb) => cb({ data: { code: 0, data: [] } })) },
  device: { getAgentBindDevices: vi.fn() },
  product: { getProductList: vi.fn((cb) => cb({ data: { code: 0, data: [] } })) },
  family: { getSharedRobots: vi.fn((cb) => cb({ data: { code: 0, data: [] } })) },
}));
vi.mock('@/apis/api', () => ({ default: api }));

import kit from '@/kit';
import i18n from '@/i18n';
import {
  barPath, cleanRows, dayAxis, isoDay, linePath, moodKey, niceRange, niceScale, summaryText, totals,
} from '@/views/summary/summaryModel';
import Summary from '@/views/summary/Summary.vue';
import { demoSummaryRow } from '@/apis/demo/pages/summary';

const ok = (data) => ({ data: { code: 0, msg: 'ok', data } });

describe('summary rules', () => {
  it('keeps one row per day, newest first', () => {
    const rows = cleanRows([{ day: '2026-10-01', a: 1 }, { day: '2026-10-03' }, { day: '2026-10-01', a: 2 }, { day: 'bad' }]);
    expect(rows.map((r) => r.day)).toEqual(['2026-10-03', '2026-10-01']);
    expect(rows[1].a).toBe(2);
  });

  it('leaves days without a summary empty on the axis', () => {
    const today = new Date(2026, 9, 26);
    const axis = dayAxis([{ day: '2026-10-26', bondScore: 5 }, { day: '2026-10-24', bondScore: 4 }], today, 5);
    expect(axis.map((a) => a.day)).toEqual(['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26']);
    expect(axis.map((a) => (a.row ? a.row.bondScore : null))).toEqual([null, null, 4, null, 5]);
    expect(isoDay(today)).toBe('2026-10-26');
  });

  it('rounds axes', () => {
    expect(niceScale(87)).toEqual({ top: 100, ticks: [0, 25, 50, 75, 100] });
    expect(niceScale(0).top).toBeGreaterThan(0);
    const r = niceRange(463, 642);
    expect(r.lo).toBeLessThanOrEqual(463);
    expect(r.top).toBeGreaterThanOrEqual(642);
    expect(r.lo).toBeGreaterThan(0);
  });

  it('draws lines with gaps and bars with rounded tops', () => {
    const box = { x: 0, y: 0, w: 30, h: 10 };
    expect(linePath([0, 10, null, 5], box, 10)).toBe('M0.0 10.0L10.0 0.0M30.0 5.0');
    expect(linePath([50, 60], box, 60, 50)).toBe('M0.0 10.0L30.0 0.0');
    expect(barPath(0, 100, 10, 0)).toBe('');
    expect(barPath(0, 100, 10, 20)).toMatch(/^M0 100V84Q0 80 4 80H6Q10 80 10 84V100Z$/);
  });

  it('names moods and totals the days', () => {
    expect(moodKey('Happy')).toBe('happy');
    expect(moodKey('Grumpy')).toBe('other');
    expect(moodKey(null)).toBe('');
    expect(totals([{ talkCount: 2, focusMinutes: 25, remindersDone: 1, remindersMissed: 1 }, { talkCount: 3 }]))
      .toEqual({ talk: 5, focus: 25, done: 1, missed: 1, memories: 0, days: 2 });
    expect(summaryText({ textBn: 'বাংলা', textEn: 'English' }, 'en')).toBe('English');
  });
});

describe('Summary page', () => {
  it('shows the newest day, both charts and the day rows', async () => {
    i18n.global.locale = 'en';
    const rows = [0, 1, 2, 5].map((i) => demoSummaryRow(i));
    api.summary.getSummaries.mockImplementation((id, days, cb) => cb(ok(rows)));
    const wrapper = mount(Summary, {
      attachTo: document.body,
      global: {
        plugins: [i18n, kit],
        mocks: { $route: { query: { deviceId: 'dev-1' } }, $message: { success: vi.fn(), error: vi.fn() } },
        stubs: { RouterLink: true },
      },
    });
    await flushPromises();
    expect(api.summary.getSummaries).toHaveBeenCalledWith('dev-1', 30, expect.any(Function), expect.any(Function));
    const text = wrapper.text();
    expect(text).toContain('Today');
    expect(text).toContain(rows[0].textEn);
    expect(wrapper.findAll('svg.sc__svg')).toHaveLength(2);
    expect(wrapper.findAll('.sm__day')).toHaveLength(4);
    expect(wrapper.find('.sc__line path').attributes('d')).toMatch(/^M/);
    wrapper.unmount();
  });
});
