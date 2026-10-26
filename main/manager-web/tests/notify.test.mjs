import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const api = vi.hoisted(() => ({
  notify: {
    getList: vi.fn(), getUnreadCount: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn(), getPrefs: vi.fn(), savePrefs: vi.fn(),
    getVapidKey: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), sendTest: vi.fn(),
  },
  family: { getInvites: vi.fn() },
}));
vi.mock('@/apis/api', () => ({ default: api }));

import kit from '@/kit';
import i18n from '@/i18n';
import { bucketed, groupOf, inkOf, linkOf, mergeList, prefsForm, textOf } from '@/views/notify/notifyModel';
import { badgeText, inbox, refreshInbox } from '@/shell/inbox';
import { keyBytes, pushSupport, subscriptionBody } from '@/utils/webPush';
import Notifications from '@/views/notify/Notifications.vue';

const ok = (data) => ({ data: { code: 0, msg: 'ok', data } });

describe('notification rules', () => {
  it('finds the group of a notification by its type', () => {
    expect(groupOf({ type: 'care_fall' })).toBe('care');
    expect(groupOf({ type: 'robot_offline' })).toBe('offline');
    expect(groupOf({ type: 'whatever', group: 'summary' })).toBe('summary');
    expect(groupOf({ type: 'test' })).toBe('other');
    expect(inkOf('alarm')).toBe('alarm');
    expect(inkOf('other')).toBe('ink-2');
  });

  it('opens the right page for a notification', () => {
    expect(linkOf({ type: 'family_invite' })).toBe('/invitations');
    expect(linkOf({ type: 'daily_summary' })).toBe('/summary');
    expect(linkOf({ type: 'care_medicine' })).toBe('/robot?tab=care');
    expect(linkOf({ type: 'test' })).toBe('');
  });

  it('speaks the reader\'s language and falls back to the other', () => {
    expect(textOf({ titleBn: 'বাংলা', titleEn: 'English' }, 'bn').title).toBe('বাংলা');
    expect(textOf({ titleBn: 'বাংলা', titleEn: 'English' }, 'en').title).toBe('English');
    expect(textOf({ titleBn: 'বাংলা' }, 'en').title).toBe('বাংলা');
  });

  it('buckets by day and merges pages without duplicates', () => {
    const now = new Date(2026, 9, 26, 15, 0).getTime();
    const list = [
      { id: 1, createdAt: now - 3600000 },
      { id: 2, createdAt: now - 20 * 3600000 },
      { id: 3, createdAt: now - 60 * 3600000 },
    ];
    expect(bucketed(list, now).map((b) => [b.key, b.items.length])).toEqual([['today', 1], ['yesterday', 1], ['earlier', 1]]);
    expect(mergeList([list[0]], [list[0], list[2]]).map((n) => n.id)).toEqual([1, 3]);
  });

  it('fills the prefs form with every group on by default', () => {
    expect(prefsForm({ types: { care: false }, offlineMinutes: 5 })).toEqual({
      types: { offline: true, alarm: true, reminder: true, care: false, summary: true, family: true },
      offlineMinutes: 30, summaryPush: true,
    });
    expect(prefsForm({ offlineMinutes: 120, summaryPush: false })).toMatchObject({ offlineMinutes: 120, summaryPush: false });
  });

  it('caps the bell number', () => {
    expect(badgeText(0)).toBe('');
    expect(badgeText(7)).toBe('7');
    expect(badgeText(150)).toBe('99+');
  });

  it('turns a VAPID key into bytes and a subscription into the API body', () => {
    const bytes = keyBytes('AQID_-8');
    expect(Array.from(bytes)).toEqual([1, 2, 3, 255, 239]);
    const sub = { toJSON: () => ({ endpoint: 'https://push.example/x', keys: { p256dh: 'p', auth: 'a' } }) };
    expect(subscriptionBody(sub)).toEqual({ endpoint: 'https://push.example/x', keys: { p256dh: 'p', auth: 'a' }, platform: 'web' });
  });

  it('says honestly when push cannot work here', () => {
    expect(pushSupport(null)).toBe('unsupported');
    expect(pushSupport({ isSecureContext: false, navigator: {} })).toBe('insecure');
    expect(pushSupport({ isSecureContext: true, navigator: {} })).toBe('unsupported');
  });

  it('refreshes the inbox counts', async () => {
    api.notify.getUnreadCount.mockImplementation((cb) => cb(ok({ unread: 4 })));
    api.family.getInvites.mockImplementation((cb) => cb(ok([{ id: 1 }])));
    await refreshInbox();
    expect(inbox.unread).toBe(4);
    expect(inbox.invites).toBe(1);
  });
});

describe('Notifications page', () => {
  it('lists, marks read on open, marks all and saves prefs', async () => {
    i18n.global.locale = 'en';
    const now = Date.now();
    api.notify.getList.mockImplementation((q, cb) => cb(ok({ total: 2, unread: 1, list: [
      { id: 'a', type: 'care_fall', titleBn: 'পড়ে গেছে', titleEn: 'TinyBot fell', bodyEn: 'Check in', robotName: 'Nanu', createdAt: now - 60000, read: false },
      { id: 'b', type: 'daily_summary', titleEn: 'Summary', createdAt: now - 2 * 86400000, read: true },
    ] })));
    api.notify.getPrefs.mockImplementation((cb) => cb(ok({ types: { offline: true }, offlineMinutes: 30, summaryPush: true })));
    api.notify.markRead.mockImplementation((id, cb) => cb(ok(true)));
    api.notify.markAllRead.mockImplementation((cb) => cb(ok(true)));
    api.notify.savePrefs.mockImplementation((p, cb) => cb(ok(p)));
    const push = vi.fn();
    const message = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() });
    const wrapper = mount(Notifications, {
      attachTo: document.body,
      global: { plugins: [i18n, kit], mocks: { $message: message, $router: { push } }, stubs: { RouterLink: true } },
    });
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('TinyBot fell');
    expect(text).toContain('Nanu');
    expect(text).toContain('Today');
    expect(text).toContain('Earlier');

    wrapper.vm.open(wrapper.vm.list[0]);
    expect(api.notify.markRead).toHaveBeenCalledWith('a', expect.any(Function), expect.any(Function));
    expect(wrapper.vm.unread).toBe(0);
    expect(push).toHaveBeenCalled();

    wrapper.vm.markAll();
    await flushPromises();
    expect(api.notify.markAllRead).toHaveBeenCalled();

    wrapper.vm.form.types.care = false;
    expect(wrapper.vm.prefsDirty).toBe(true);
    wrapper.vm.savePrefs();
    await flushPromises();
    expect(api.notify.savePrefs.mock.calls[0][0].types.care).toBe(false);
    expect(wrapper.vm.prefsDirty).toBe(false);
    wrapper.unmount();
  });
});
