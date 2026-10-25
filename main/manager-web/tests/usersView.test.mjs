import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';

vi.mock('@/apis/api', () => ({
  default: {
    admin: { getUserList: vi.fn(), deleteUser: vi.fn(), resetUserPassword: vi.fn() },
    user: { changeUserStatus: vi.fn() },
  },
}));

import Api from '@/apis/api';
import kit from '@/kit';
import pages from '@/i18n/pages/users.js';
import shell from '@/i18n/pages/shell.js';
import UserManagement from '@/views/users/UserManagement.vue';

const ok = (data) => ({ data: { code: 0, msg: 'ok', data } });
const rows = [
  { userid: '1001', mobile: 'demo', deviceCount: '2', status: 1, createDate: '2026-03-14 10:22:05' },
  { userid: '1002', mobile: '01000000002', deviceCount: '0', status: 0, createDate: '2026-04-01 08:00:00' },
];

function setup() {
  const i18n = createI18n({ legacy: true, locale: 'en', fallbackLocale: 'en', messages: { en: { ...shell.en, ...pages.en } } });
  const confirm = vi.fn(() => Promise.resolve('confirm'));
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const w = mount(UserManagement, {
    global: { plugins: [i18n, kit], mocks: { $confirm: confirm, $message: message }, stubs: { teleport: true } },
  });
  return { w, confirm, message };
}

describe('users strings', () => {
  it('has every key in both Bangla and English', () => {
    expect(Object.keys(pages.bn).sort()).toEqual(Object.keys(pages.en).sort());
    for (const v of [...Object.values(pages.bn), ...Object.values(pages.en)]) {
      expect(v).not.toMatch(/—/);
      expect(v.trim()).not.toBe('');
    }
  });
});

describe('UserManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Api.admin.getUserList.mockImplementation((params, cb) => cb(ok({ list: rows, total: 2 })));
    Api.user.changeUserStatus.mockImplementation((status, ids, cb) => cb(ok(null)));
    Api.admin.deleteUser.mockImplementation((id, cb) => cb(ok(null)));
    Api.admin.resetUserPassword.mockImplementation((id, cb) => cb(ok('Xy7#pQ2mLk9a')));
  });

  it('loads the first page with the legacy parameters and shows the rows', async () => {
    const { w } = setup();
    await flushPromises();
    expect(Api.admin.getUserList).toHaveBeenCalledWith({ page: 1, limit: 10, mobile: '' }, expect.any(Function));
    expect(w.text()).toContain('demo');
    expect(w.text()).toContain('01000000002');
    expect(w.text()).toContain('Disabled');
    expect(w.text()).toContain('2 users');
  });

  it('searches by username or mobile from page one', async () => {
    const { w } = setup();
    await flushPromises();
    await w.find('#users-q').setValue(' 0100 ');
    await w.find('form').trigger('submit');
    expect(Api.admin.getUserList).toHaveBeenLastCalledWith({ page: 1, limit: 10, mobile: '0100' }, expect.any(Function));
  });

  it('shows the filtered-empty state with a way out', async () => {
    const { w } = setup();
    await flushPromises();
    Api.admin.getUserList.mockImplementation((params, cb) => cb(ok({ list: [], total: 0 })));
    await w.find('#users-q').setValue('nobody');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(w.text()).toContain('No one matches "nobody"');
  });

  it('disables one account after confirming', async () => {
    const { w, confirm, message } = setup();
    await flushPromises();
    await w.findAll('[role="switch"]')[0].trigger('click');
    await flushPromises();
    expect(confirm).toHaveBeenCalled();
    expect(Api.user.changeUserStatus).toHaveBeenCalledWith(0, ['1001'], expect.any(Function));
    expect(message.success).toHaveBeenCalledWith('The account of demo is disabled');
  });

  it('changes nothing when the question is cancelled', async () => {
    const { w, confirm } = setup();
    await flushPromises();
    confirm.mockImplementationOnce(() => Promise.reject('cancel'));
    await w.findAll('[role="switch"]')[1].trigger('click');
    await flushPromises();
    expect(Api.user.changeUserStatus).not.toHaveBeenCalled();
  });

  it('enables the selected users together', async () => {
    const { w } = setup();
    await flushPromises();
    w.vm.toggleAll(true);
    await flushPromises();
    await w.vm.batchEnable();
    await flushPromises();
    expect(Api.user.changeUserStatus).toHaveBeenCalledWith(1, ['1001', '1002'], expect.any(Function));
  });

  it('warns when a batch action has nobody selected', async () => {
    const { w, message } = setup();
    await flushPromises();
    w.vm.batchDisable();
    expect(message.warning).toHaveBeenCalled();
    expect(Api.user.changeUserStatus).not.toHaveBeenCalled();
  });

  it('resets a password and shows the new one once', async () => {
    const { w } = setup();
    await flushPromises();
    await w.vm.resetPassword(rows[0]);
    await flushPromises();
    expect(Api.admin.resetUserPassword).toHaveBeenCalledWith('1001', expect.any(Function));
    expect(w.find('#users-pw').element.value).toBe('Xy7#pQ2mLk9a');
    w.vm.closePassword();
    await new Promise((r) => setTimeout(r, 250));
    expect(w.vm.currentPassword).toBe('');
  });

  it('deletes one user after a danger confirmation', async () => {
    const { w, confirm, message } = setup();
    await flushPromises();
    await w.vm.deleteUser(rows[1]);
    await flushPromises();
    expect(confirm.mock.calls[0][2].danger).toBe(true);
    expect(Api.admin.deleteUser).toHaveBeenCalledWith('1002', expect.any(Function));
    expect(message.success).toHaveBeenCalledWith('User deleted');
  });

  it('deletes the selected users and reports a partial result', async () => {
    const { w, message } = setup();
    await flushPromises();
    Api.admin.deleteUser.mockImplementation((id, cb) => cb(id === '1001' ? ok(null) : { data: { code: 500, msg: 'no' } }));
    w.vm.toggleAll(true);
    await w.vm.batchDelete();
    await flushPromises();
    expect(Api.admin.deleteUser).toHaveBeenCalledTimes(2);
    expect(message.warning).toHaveBeenCalledWith('1 deleted, 1 could not be deleted');
  });

  it('pages with the chosen size', async () => {
    const { w } = setup();
    await flushPromises();
    w.vm.onPage({ page: 1, pageSize: 20 });
    expect(Api.admin.getUserList).toHaveBeenLastCalledWith({ page: 1, limit: 20, mobile: '' }, expect.any(Function));
  });
});
