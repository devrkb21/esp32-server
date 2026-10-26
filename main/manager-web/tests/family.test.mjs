import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const api = vi.hoisted(() => ({
  family: {
    getDeviceFamily: vi.fn(),
    invite: vi.fn(),
    changeRole: vi.fn(),
    removeShare: vi.fn(),
    getInvites: vi.fn(),
    acceptInvite: vi.fn(),
    declineInvite: vi.fn(),
    getSharedRobots: vi.fn(),
  },
  agent: { getAgentList: vi.fn() },
  device: { getAgentBindDevices: vi.fn() },
  product: { getProductList: vi.fn() },
}));
vi.mock('@/apis/api', () => ({ default: api }));

import kit from '@/kit';
import i18n from '@/i18n';
import { bdPhone, can, inviteTarget, mergeRobots, sharedRobot, sortMembers } from '@/utils/family.mjs';
import { careSettings, sectionPatch, serverForm, FORM_SECTIONS } from '@/views/robot/robotModel';
import RobotFamily from '@/views/robot/RobotFamily.vue';
import Invitations from '@/views/family/Invitations.vue';
import { agentRole, robot } from '@/shell/robot';

const ok = (data) => ({ data: { code: 0, msg: 'ok', data } });

describe('family rules', () => {
  it('reads Bangladeshi mobile numbers in every usual form', () => {
    expect(bdPhone('01712345678')).toBe('+8801712345678');
    expect(bdPhone('8801712345678')).toBe('+8801712345678');
    expect(bdPhone('+880 1712-345678')).toBe('+8801712345678');
    expect(bdPhone('01212345678')).toBe('');
    expect(bdPhone('0171234567')).toBe('');
  });

  it('tells usernames, phones and bad numbers apart', () => {
    expect(inviteTarget('')).toMatchObject({ problem: 'required' });
    expect(inviteTarget(' 01812345678 ')).toEqual({ kind: 'phone', value: '+8801812345678', problem: '' });
    expect(inviteTarget('0181234')).toMatchObject({ kind: 'phone', problem: 'phone' });
    expect(inviteTarget('nanu_1950')).toEqual({ kind: 'username', value: 'nanu_1950', problem: '' });
    expect(inviteTarget('x'.repeat(65)).problem).toBe('long');
  });

  it('gives each role what the contract says', () => {
    expect(can('owner', 'share')).toBe(true);
    expect(can('co_owner', 'share')).toBe(false);
    expect(can('co_owner', 'character')).toBe(true);
    expect(can('member', 'character')).toBe(false);
    expect(can('member', 'unbind')).toBe(false);
    expect(can('member', 'leave')).toBe(true);
    expect(can('owner', 'leave')).toBe(false);
    expect(can('member', 'use')).toBe(true);
  });

  it('lists accepted people before invites, newest first', () => {
    const rows = sortMembers([
      { id: 'a', status: 'pending', createdAt: 5 },
      { id: 'b', status: 'accepted', createdAt: 1 },
      { id: 'c', status: 'accepted', createdAt: 3 },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['c', 'b', 'a']);
  });

  it('merges shared robots after the own ones, without duplicates', () => {
    const s = sharedRobot({ shareId: 's1', deviceId: 'd2', agentId: 'a9', alias: 'Nanu', role: 'co_owner', ownerName: 'owner-1' });
    expect(s).toMatchObject({ deviceId: 'd2', name: 'Nanu', role: 'co_owner', sharedBy: 'owner-1', shareId: 's1' });
    expect(sharedRobot({ deviceId: 'x', role: 'boss' }).role).toBe('member');
    const list = mergeRobots([{ deviceId: 'd1' }, { deviceId: 'd2' }], [s, sharedRobot({ deviceId: 'd3' })]);
    expect(list.map((r) => [r.deviceId, r.role])).toEqual([['d1', 'owner'], ['d2', 'owner'], ['d3', 'member']]);
  });

  it('knows the role on a character from the robots that run it', () => {
    robot.list = [{ deviceId: 'd1', agentId: 'mine', role: 'owner' }, { deviceId: 'd2', agentId: 'theirs', role: 'member' }];
    expect(agentRole('mine')).toBe('owner');
    expect(agentRole('theirs')).toBe('member');
    expect(agentRole('unknown')).toBe('owner');
    robot.list = [];
  });
});

describe('care settings on the Robot page', () => {
  it('reads defaults and saves only the alert keys', () => {
    expect(FORM_SECTIONS).toContain('care');
    expect(careSettings(null)).toEqual({ enabled: true, lonely_after_min: 180, no_activity_hours: 0, fall_alert: true, missed_medicine_alert: true });
    const form = serverForm({ settings: { care: { enabled: true, lonely_after_min: 90, no_activity_hours: 4, fall_alert: false } } }, 'care');
    expect(form).toMatchObject({ no_activity_hours: 4, fall_alert: false, missed_medicine_alert: true, lonely_after_min: 90 });
    expect(sectionPatch('care', form)).toEqual({ settings: { care: { no_activity_hours: 4, fall_alert: false, missed_medicine_alert: true } } });
    expect(careSettings({ no_activity_hours: 40 }).no_activity_hours).toBe(0);
  });
});

function mountWith(Comp, props = {}) {
  const message = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() });
  const confirm = vi.fn(() => Promise.resolve());
  const wrapper = mount(Comp, {
    props,
    attachTo: document.body,
    global: {
      plugins: [i18n, kit],
      mocks: { $confirm: confirm, $message: message, $store: { getters: { getUserInfo: { id: 1 } } }, $router: { push: vi.fn() } },
      stubs: { RouterLink: { template: '<a><slot /></a>' } },
    },
  });
  return { wrapper, message, confirm };
}

describe('RobotFamily', () => {
  beforeEach(() => { Object.values(api.family).forEach((f) => f.mockReset()); i18n.global.locale = 'en'; });

  it('shows the family to the owner and sends an invite by phone', async () => {
    api.family.getDeviceFamily.mockImplementation((id, cb) => cb(ok({ role: 'owner', canShare: true, ownerName: 'me', members: [
      { id: 's1', userId: 2, name: 'cousin', role: 'member', status: 'accepted', createdAt: 1 },
      { id: 's2', userId: 3, name: 'aunt', role: 'member', status: 'pending', createdAt: 2 },
    ] })));
    api.family.invite.mockImplementation((id, target, role, cb) => cb(ok({})));
    const { wrapper, message } = mountWith(RobotFamily, { deviceId: 'dev-1', botName: 'TinyBot' });
    await flushPromises();
    expect(api.family.getDeviceFamily).toHaveBeenCalledWith('dev-1', expect.any(Function), expect.any(Function));
    const text = wrapper.text();
    expect(text).toContain('cousin');
    expect(text).toContain('Waiting for an answer');
    expect(text).toContain('Cancel invite');

    wrapper.vm.openInvite();
    wrapper.vm.target = '01712345678';
    wrapper.vm.role = 'co_owner';
    wrapper.vm.send();
    await flushPromises();
    expect(api.family.invite).toHaveBeenCalledWith('dev-1', '+8801712345678', 'co_owner', expect.any(Function), expect.any(Function));
    expect(message.success).toHaveBeenCalled();
    wrapper.unmount();
  });

  it('refuses a bad number before calling the server', async () => {
    api.family.getDeviceFamily.mockImplementation((id, cb) => cb(ok({ role: 'owner', canShare: true, members: [] })));
    const { wrapper } = mountWith(RobotFamily, { deviceId: 'dev-1' });
    await flushPromises();
    expect(wrapper.text()).toContain('Nobody added yet');
    wrapper.vm.target = '01234';
    wrapper.vm.send();
    expect(api.family.invite).not.toHaveBeenCalled();
    expect(wrapper.vm.targetError).toContain('mobile number');
    wrapper.unmount();
  });

  it('lets a member read the list and leave, without sharing controls', async () => {
    api.family.getDeviceFamily.mockImplementation((id, cb) => cb(ok({ role: 'member', canShare: false, ownerName: 'owner-1', members: [
      { id: 'mine', userId: 1, name: 'me', role: 'member', status: 'accepted', createdAt: 1 },
    ] })));
    api.family.removeShare.mockImplementation((id, cb) => cb(ok(true)));
    const { wrapper, confirm } = mountWith(RobotFamily, { deviceId: 'dev-2' });
    await flushPromises();
    expect(wrapper.text()).toContain('Owner: owner-1');
    expect(wrapper.text()).not.toContain('Add someone');
    expect(wrapper.text()).not.toContain('Remove');
    wrapper.vm.leave();
    await flushPromises();
    expect(confirm).toHaveBeenCalled();
    expect(api.family.removeShare).toHaveBeenCalledWith('mine', expect.any(Function), expect.any(Function));
    wrapper.unmount();
  });
});

describe('Invitations', () => {
  it('accepts and declines invitations', async () => {
    api.family.getInvites.mockImplementation((cb) => cb(ok([
      { id: 'i1', deviceId: 'd9', robotName: 'Nanu bot', ownerName: 'owner-1', role: 'member', createdAt: Date.now() },
      { id: 'i2', deviceId: 'd8', robotName: 'Other bot', ownerName: 'owner-2', role: 'co_owner', createdAt: Date.now() },
    ])));
    api.family.declineInvite.mockImplementation((id, cb) => cb(ok(true)));
    const { wrapper } = mountWith(Invitations);
    await flushPromises();
    expect(wrapper.text()).toContain('owner-1 wants to share Nanu bot with you');
    wrapper.vm.decline(wrapper.vm.list[1]);
    await flushPromises();
    expect(api.family.declineInvite).toHaveBeenCalledWith('i2', expect.any(Function), expect.any(Function));
    expect(wrapper.vm.list).toHaveLength(1);
    wrapper.unmount();
  });
});
