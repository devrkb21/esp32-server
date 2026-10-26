// AI wave on the web: the usage page (back office), kids mode and the quota notice on the
// character page, and Robot > memory grouped by person.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

const aiApi = vi.hoisted(() => ({
  getUsageSummary: vi.fn(),
  getQuota: vi.fn(),
  getKids: vi.fn(),
  saveKids: vi.fn(),
}));
vi.mock('@/apis/module/ai', () => ({ default: aiApi }));

import Kit from '@/kit';
import i18n from '@/i18n';
import pages from '@/i18n/pages/ai.js';
import UsagePage from '@/views/usage/UsagePage.vue';
import KidsSection from '@/views/character/KidsSection.vue';
import QuotaNote from '@/views/character/QuotaNote.vue';
import RobotMemory from '@/views/robot/RobotMemory.vue';
import {
  barPct, compact, count, hasUsage, maxOf, minutes, money, rangeFor, robotName,
} from '@/views/usage/usageModel';
import {
  MAX_TOPICS, addTopic, hasTopic, kidsSignature, normalizeKids, quotaView, removeTopic,
} from '@/views/character/kidsModel';
import { groupByPerson, hasPeople } from '@/views/robot/memoryGroups';
import { memoryList } from '@/utils/companion.mjs';
import { NAV } from '@/shell/nav';
import { routes } from '@/router';

enableAutoUnmount(afterEach);
const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const global = { plugins: [Kit, i18n], stubs: { teleport: true, RouterLink: true }, mocks: { $message: message } };

describe('usage model', () => {
  it('builds ranges ending today', () => {
    expect(rangeFor(7, '2026-11-01')).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    expect(rangeFor(1, '2026-11-01')).toEqual({ from: '2026-11-01', to: '2026-11-01' });
  });
  it('formats counts, minutes and money in both languages', () => {
    expect(count(12345, 'en')).toBe('12,345');
    expect(count(12345, 'bn')).toBe('১২,৩৪৫');
    expect(compact(9999, 'en')).toBe('9,999');
    expect(compact(123456, 'en')).toBe('123K');
    expect(compact(2500000, 'bn')).toBe('২.৫M');
    expect(minutes(90, 'en')).toBe('1.5');
    expect(minutes(0, 'bn')).toBe('০');
    expect(money(null, 'USD', 'en')).toBe('');
    expect(money(1.234, 'USD', 'en')).toBe('1.23 USD');
    expect(money(0.00042, 'USD', 'en')).toBe('0.0004 USD');
  });
  it('bars, empty ranges and robot names', () => {
    expect(maxOf([{ a: 3 }, { a: 9 }], 'a')).toBe(9);
    expect(maxOf([], 'a')).toBe(1);
    expect(barPct(0, 10)).toBe(0);
    expect(barPct(0.01, 1000)).toBe(2);
    expect(barPct(5, 10)).toBe(50);
    expect(hasUsage({ totals: { llmRequests: 0, tokens: 0 } })).toBe(false);
    expect(hasUsage({ totals: { asrSeconds: 3 } })).toBe(true);
    expect(robotName({ alias: '', macAddress: 'aa' })).toBe('aa');
  });
});

describe('kids model', () => {
  it('normalizes the API settings', () => {
    expect(normalizeKids(null)).toEqual({ enabled: false, age: 7, blockedTopics: [] });
    const k = normalizeKids({ enabled: true, age: 30, blockedTopics: [' ভূত ', 'Horror', 'horror', '', 'x'.repeat(60)] });
    expect(k.age).toBe(12);
    expect(k.blockedTopics).toEqual(['ভূত', 'Horror', 'x'.repeat(40)]);
    expect(normalizeKids({ age: 1 }).age).toBe(3);
  });
  it('adds and removes topics within the limit', () => {
    let t = addTopic([], '  যুদ্ধ ');
    t = addTopic(t, 'যুদ্ধ');
    expect(t).toEqual(['যুদ্ধ']);
    expect(hasTopic(t, 'যুদ্ধ')).toBe(true);
    expect(removeTopic(t, 'যুদ্ধ')).toEqual([]);
    const full = Array.from({ length: MAX_TOPICS }, (_, i) => `t${i}`);
    expect(addTopic(full, 'more')).toHaveLength(MAX_TOPICS);
    expect(kidsSignature({ enabled: true, age: 7 })).toBe(kidsSignature({ enabled: true, age: '7', blockedTopics: [] }));
  });
  it('shows the quota only with a limit', () => {
    expect(quotaView(null)).toBeNull();
    expect(quotaView({ limit: 0, used: 5 })).toBeNull();
    expect(quotaView({ limit: 200, used: 150, blocked: 0 })).toMatchObject({ left: 50, exceeded: false, pct: 75 });
    expect(quotaView({ limit: 100, used: 120, exceeded: true, blocked: 2 })).toMatchObject({ left: 0, exceeded: true, pct: 100, blocked: 2 });
  });
});

describe('memory groups', () => {
  const notes = [
    { id: '1', text: 'a', person: 'নীলা' }, { id: '2', text: 'b' }, { id: '3', text: 'c', person: 'Baba' },
    { id: '4', text: 'd', person: 'নীলা' },
  ];
  it('groups by person, most notes first, the rest last', () => {
    const g = groupByPerson(notes);
    expect(g.map((x) => x.person)).toEqual(['নীলা', 'Baba', '']);
    expect(g[0].notes.map((n) => n.id)).toEqual(['1', '4']);
    expect(hasPeople(notes)).toBe(true);
    expect(hasPeople([{ id: 'x', text: 'old note' }])).toBe(false);
    expect(groupByPerson([])).toEqual([]);
  });
  it('the companion view keeps the person of a note (and older notes have none)', () => {
    const list = memoryList([
      { id: 'a', text: 'x', kind: 'like', created: '2026-10-01T10:00:00', updated: '2026-10-01T10:00:00', person: '  নীলা ' },
      { id: 'b', text: 'y', kind: 'fact', created: '2026-10-01T10:00:00', updated: '2026-10-01T10:00:00' },
    ]);
    expect(list[0].person).toBe('নীলা');
    expect('person' in list[1]).toBe(false);
  });
});

describe('routes, nav and strings', () => {
  it('the usage page is a back office page', () => {
    const r = routes.find((x) => x.path === '/usage');
    expect(r.meta).toMatchObject({ admin: true, title: 'nav.usage' });
    const office = NAV.find((g) => g.admin);
    expect(office.items.some((i) => i.to === '/usage')).toBe(true);
  });
  it('has every key in both languages, no em dash', () => {
    expect(Object.keys(pages.bn).sort()).toEqual(Object.keys(pages.en).sort());
    for (const table of [pages.bn, pages.en]) {
      for (const v of Object.values(table)) expect(v).not.toContain('—');
    }
    expect(pages.bn['nav.usage']).toBe('ব্যবহার ও খরচ');
    expect(pages.bn['kids.title']).toBe('শিশু মোড');
  });
});

const SUMMARY = {
  from: '2026-10-26', to: '2026-11-01', today: '2026-11-01', currency: 'USD', dailyLimit: 200, priced: true,
  totals: { llmRequests: 840, tokens: 573000, asrSeconds: 3528, ttsChars: 80640, quotaBlocked: 3, cost: 0.31 },
  days: [
    { date: '2026-10-31', llmRequests: 0, tokens: 0, asrSeconds: 0, ttsChars: 0, cost: null },
    { date: '2026-11-01', llmRequests: 120, tokens: 81000, asrSeconds: 500, ttsChars: 11000, cost: 0.05 },
  ],
  models: [{ modelType: 'LLM', modelId: 'LLM_GroqLLM', modelName: 'Groq Llama', llmRequests: 800, tokens: 560000, pricePer1k: 0.0006, cost: 0.31 }],
  users: [{ userId: 1, username: 'demo', robots: 2, llmRequests: 600, tokens: 400000, quotaBlocked: 3, cost: 0.2 }],
  robots: [{ macAddress: 'aa:bb', alias: 'Desk', username: 'demo', llmRequests: 600, tokens: 400000, asrSeconds: 100, ttsChars: 9000, cost: 0.2 }],
};

describe('UsagePage', () => {
  it('loads the last 7 days and shows totals, tables and the limit', async () => {
    i18n.global.locale = 'en';
    aiApi.getUsageSummary.mockImplementation((p, ok) => ok({ data: { code: 0, data: SUMMARY } }));
    const w = mount(UsagePage, { global });
    await flushPromises();
    const params = aiApi.getUsageSummary.mock.calls[0][0];
    expect(Object.keys(params)).toEqual(['from', 'to']);
    expect(w.text()).toContain('840');
    expect(w.text()).toContain('0.31 USD');
    expect(w.text()).toContain('Daily limit per user: 200 LLM requests');
    expect(w.text()).toContain('Groq Llama');
    expect(w.text()).toContain('Desk');
    expect(w.text()).toContain('Busiest robots');
  });
  it('shows the empty and failed states', async () => {
    i18n.global.locale = 'en';
    aiApi.getUsageSummary.mockImplementation((p, ok) => ok({ data: { code: 0, data: { ...SUMMARY, totals: {}, dailyLimit: 0, priced: false } } }));
    const w = mount(UsagePage, { global });
    await flushPromises();
    expect(w.text()).toContain('No usage in this range');
    expect(w.text()).toContain('Daily limit off');
    expect(w.text()).toContain('usage.price_per_1k');
    aiApi.getUsageSummary.mockImplementation((p, ok, fail) => fail({}));
    const f = mount(UsagePage, { global });
    await flushPromises();
    expect(f.text()).toContain('Could not load usage');
  });
});

describe('KidsSection', () => {
  it('loads, edits and saves kids mode on its own', async () => {
    i18n.global.locale = 'bn';
    aiApi.getKids.mockImplementation((id, ok) => ok({ data: { code: 0, data: { enabled: true, age: 6, blockedTopics: ['ভূত'] } } }));
    aiApi.saveKids.mockImplementation((id, body, ok) => ok({ data: { code: 0, data: body } }));
    const w = mount(KidsSection, { props: { agentId: 'agent1' }, global });
    await flushPromises();
    expect(aiApi.getKids.mock.calls[0][0]).toBe('agent1');
    expect(w.text()).toContain('শিশু মোড');
    expect(w.text()).toContain('ভূত');
    expect(w.find('.ch-kids__foot').exists()).toBe(false);
    // a suggestion chip adds its topic and the save bar appears
    const suggest = w.findAll('.ch-kids__suggest button');
    expect(suggest.length).toBeGreaterThan(0);
    await suggest[0].trigger('click');
    expect(w.find('.ch-kids__foot').exists()).toBe(true);
    await w.find('.ch-kids__foot .tb-btn--primary, .ch-kids__foot button:last-child').trigger('click');
    await flushPromises();
    const [id, body] = aiApi.saveKids.mock.calls[0];
    expect(id).toBe('agent1');
    expect(body.enabled).toBe(true);
    expect(body.age).toBe(6);
    expect(body.blockedTopics.length).toBe(2);
    expect(message.success).toHaveBeenCalled();
    expect(w.find('.ch-kids__foot').exists()).toBe(false);
  });
});

describe('QuotaNote', () => {
  it('stays hidden without a limit and explains a reached limit', async () => {
    i18n.global.locale = 'en';
    aiApi.getQuota.mockImplementation((ok) => ok({ data: { code: 0, data: { limit: 0, used: 10 } } }));
    const none = mount(QuotaNote, { global });
    await flushPromises();
    expect(none.find('.ch-quota').exists()).toBe(false);
    aiApi.getQuota.mockImplementation((ok) => ok({ data: { code: 0, data: { limit: 100, used: 100, exceeded: true, blocked: 2 } } }));
    const over = mount(QuotaNote, { global });
    await flushPromises();
    expect(over.find('.ch-quota.is-over').exists()).toBe(true);
    expect(over.text()).toContain('limit is used up');
    expect(over.text()).toContain('2 times');
  });
});

describe('RobotMemory by person', () => {
  function robotStub(memories) {
    return {
      forms: { memory: { enabled: true } }, memories, saving: {}, lang: 'en',
      isDirty: () => false, syncOf: () => ({ state: 'applied', text: '' }), num: (n) => String(n),
      revertSection: vi.fn(), saveSection: vi.fn(), deleteMemory: vi.fn(), forgetMemories: vi.fn(),
    };
  }
  it('groups notes under people and keeps old notes in one list', async () => {
    i18n.global.locale = 'en';
    const r = robotStub([
      { id: '1', text: 'Loves drawing birds', kind: 'like', person: 'Nila', created: '2026-10-20T10:00:00' },
      { id: '2', text: 'Has a cat', kind: 'fact', created: '2026-10-01T10:00:00' },
    ]);
    const w = mount(RobotMemory, { global: { ...global, provide: { robot: r } } });
    const heads = w.findAll('.rb-memory__person');
    expect(heads.map((h) => h.find('b').text())).toEqual(['Nila', 'Everyone']);
    expect(w.text()).toContain('Known by voice');
    await w.findAll('.rb-memory__item button')[0].trigger('click');
    expect(r.deleteMemory).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));

    const old = mount(RobotMemory, { global: { ...global, provide: { robot: robotStub([{ id: '9', text: 'Old note', kind: 'fact' }]) } } });
    expect(old.find('.rb-memory__person').exists()).toBe(false);
    expect(old.text()).toContain('Old note');
  });
});
