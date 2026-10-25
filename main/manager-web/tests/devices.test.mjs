import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';

vi.mock('@/apis/api', () => ({
  default: {
    agent: { getDeviceConfig: vi.fn(), getAgentList: vi.fn() },
    device: {
      getAgentBindDevices: vi.fn(), getDeviceStatus: vi.fn(), updateDeviceInfo: vi.fn(), unbindDevice: vi.fn(),
      rebootDevice: vi.fn(), setDeviceVolume: vi.fn(), bindDevice: vi.fn(), manualAddDevice: vi.fn(),
    },
    companion: { getCompanion: vi.fn() },
    dict: { getDictDataByType: vi.fn() },
  },
}));

import Api from '@/apis/api';
import kit from '@/kit';
import { confirmState, settle } from '@/kit/confirm';
import { toastState } from '@/kit/toast';
import { robot } from '@/shell/robot';
import pages from '@/i18n/pages/devices.js';
import shell from '@/i18n/pages/shell.js';
import Devices from '@/views/devices/Devices.vue';

const ok = (data, msg = 'success') => ({ data: { code: 0, msg, data } });
const devices = [
  { id: 'dev1', alias: 'Desk', macAddress: '28:84:85:00:00:01', board: 'tinybot', appVersion: '2.5.5', autoUpdate: 1, createDateTimestamp: 1000, lastConnectedAtTimestamp: Date.now() - 120000 },
  { id: 'dev2', alias: '', macAddress: '28:84:85:00:00:02', board: 'tinybot', appVersion: '1.9.0', autoUpdate: 0, createDateTimestamp: 2000 },
];
const status = { 'tinybot@@@28_84_85_00_00_01@@@28_84_85_00_00_01': { isAlive: true } };

async function setup(query = '?agentId=agent1') {
  const Blank = { template: '<div />' };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/device-management', component: Devices },
      { path: '/today', component: Blank },
      { path: '/robots', component: Blank },
      { path: '/theme-generator', name: 'ThemeGenerator', component: Blank },
    ],
  });
  router.push(`/device-management${query}`);
  await router.isReady();
  const i18n = createI18n({ legacy: true, allowComposition: true, locale: 'en', fallbackLocale: 'en', messages: { en: { ...shell.en, ...pages.en } } });
  const w = mount(Devices, { global: { plugins: [router, i18n, kit], stubs: { teleport: true } } });
  await flushPromises();
  return { w, router };
}

describe('devices strings', () => {
  it('has every key in both Bangla and English, with no em dash', () => {
    expect(Object.keys(pages.bn).sort()).toEqual(Object.keys(pages.en).sort());
    for (const v of [...Object.values(pages.bn), ...Object.values(pages.en)]) {
      expect(v).not.toMatch(/—/);
      expect(v.trim()).not.toBe('');
    }
  });
});

describe('Devices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toastState.items.splice(0);
    robot.deviceId = ''; robot.agentId = ''; robot.loaded = true; robot.list = [];
    Api.agent.getDeviceConfig.mockImplementation((id, cb) => cb(ok({ agentName: 'Kitchen buddy' })));
    Api.device.getAgentBindDevices.mockImplementation((id, cb) => cb(ok(devices.map((d) => ({ ...d })))));
    Api.device.getDeviceStatus.mockImplementation((id, cb) => cb(ok(JSON.stringify(status))));
    Api.companion.getCompanion.mockImplementation((id, cb) => cb(ok(id === 'dev1'
      ? { online: true, stats: { volume: 45, state: 'idle' }, settings: { volume: 60 } }
      : { online: false, settings: { volume: 30 } })));
    Api.dict.getDictDataByType.mockResolvedValue({ code: 0, data: [{ key: 'tinybot', name: 'TinyBot board' }] });
    Api.device.updateDeviceInfo.mockImplementation((id, payload, cb) => cb(ok(null)));
    Api.device.unbindDevice.mockImplementation((id, cb) => cb(ok(null)));
    Api.device.rebootDevice.mockImplementation((id, cb) => cb(ok(null)));
    Api.device.setDeviceVolume.mockImplementation((id, v, cb) => cb(ok(null, 'Volume saved; TinyBot changes it when it is online')));
  });

  it('loads the character, its robots and their state', async () => {
    const { w } = await setup();
    expect(Api.agent.getDeviceConfig).toHaveBeenCalledWith('agent1', expect.any(Function), expect.any(Function));
    expect(Api.device.getAgentBindDevices).toHaveBeenCalledWith('agent1', expect.any(Function), expect.any(Function));
    expect(Api.device.getDeviceStatus).toHaveBeenCalledWith('agent1', expect.any(Function), expect.any(Function));
    expect(Api.dict.getDictDataByType).toHaveBeenCalledWith('FIRMWARE_TYPE');
    expect(w.find('h1').text()).toBe('Kitchen buddy');
    expect(w.text()).toContain('Desk');
    expect(w.text()).toContain('Unnamed robot');
    expect(w.text()).toContain('TinyBot board');
    const states = w.findAll('.dv-state').map((s) => s.text());
    expect(states).toEqual(['Online', 'Offline']);
    expect(w.text()).toContain('online: 1');
  });

  it('shows the no-character state without an agent id', async () => {
    const { w } = await setup('');
    expect(Api.device.getAgentBindDevices).not.toHaveBeenCalled();
    expect(w.text()).toContain('Pick a character first');
  });

  it('opens a robot on Today: selects it, then goes to /today', async () => {
    const { w, router } = await setup();
    const btn = w.findAll('.dv-act .tb-btn').find((b) => b.text() === 'Open on Today');
    await btn.trigger('click');
    await flushPromises();
    expect(robot.deviceId).toBe('dev1');
    expect(robot.agentId).toBe('agent1');
    expect(router.currentRoute.value.path).toBe('/today');
  });

  it('renames inline and saves the alias with updateDeviceInfo', async () => {
    const { w } = await setup();
    await w.find('.dv-bot__name').trigger('click');
    const input = w.find('.dv-bot input');
    await input.setValue('  Kitchen  ');
    await input.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(Api.device.updateDeviceInfo).toHaveBeenCalledWith('dev1', { alias: 'Kitchen' }, expect.any(Function), expect.any(Function));
    expect(w.text()).toContain('Kitchen');
  });

  it('toggles auto update and rolls back on failure', async () => {
    Api.device.updateDeviceInfo.mockImplementation((id, payload, cb) => cb({ data: { code: 500, msg: 'nope' } }));
    const { w } = await setup();
    const sw = w.findAll('[role="switch"]')[0];
    expect(sw.attributes('aria-checked')).toBe('true');
    await sw.trigger('click');
    await flushPromises();
    expect(Api.device.updateDeviceInfo).toHaveBeenCalledWith('dev1', { autoUpdate: 0 }, expect.any(Function), expect.any(Function));
    expect(w.findAll('[role="switch"]')[0].attributes('aria-checked')).toBe('true');
    expect(toastState.items.at(-1)).toMatchObject({ kind: 'error', message: 'nope' });
  });

  it('filters by board or MAC and shows the no-match state', async () => {
    const { w } = await setup();
    await w.find('.dv__search input').setValue('00:02');
    expect(w.findAll('.dv-bot').length).toBe(1);
    await w.find('.dv__search input').setValue('zzz');
    expect(w.text()).toContain('No robots match');
  });

  it('unbinds after a danger confirm', async () => {
    const { w } = await setup();
    w.vm.$.setupState.onMenu('unbind', w.vm.$.setupState.rows[0]);
    await flushPromises();
    expect(confirmState.current).toMatchObject({ danger: true });
    settle(true);
    await flushPromises();
    expect(Api.device.unbindDevice).toHaveBeenCalledWith('dev1', expect.any(Function), expect.any(Function));
    expect(Api.device.getAgentBindDevices).toHaveBeenCalledTimes(2);
  });

  it('reboots after a confirm', async () => {
    const { w } = await setup();
    w.vm.$.setupState.onMenu('reboot', w.vm.$.setupState.rows[0]);
    await flushPromises();
    settle(true);
    await flushPromises();
    expect(Api.device.rebootDevice).toHaveBeenCalledWith('dev1', expect.any(Function));
    expect(toastState.items.at(-1)).toMatchObject({ kind: 'success', message: 'Restart command sent' });
  });

  it('opens volume on the robot reported volume and saves it with the offline outcome', async () => {
    const { w } = await setup();
    w.vm.$.setupState.onMenu('volume', w.vm.$.setupState.rows[0]);
    await flushPromises();
    expect(Api.companion.getCompanion).toHaveBeenCalledWith('dev1', expect.any(Function), expect.any(Function));
    expect(w.find('.dv-vol__big').text()).toContain('45');
    expect(w.text()).toContain('TinyBot now: 45%');
    const save = w.findAll('.tb-sheet .tb-btn').find((b) => b.text() === 'Save');
    await save.trigger('click');
    await flushPromises();
    expect(Api.device.setDeviceVolume).toHaveBeenCalledWith('dev1', 45, expect.any(Function));
    expect(toastState.items.at(-1).message).toBe('Volume set to 45%. TinyBot changes it as soon as it is back online.');
  });
});
