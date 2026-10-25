import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

const NOW = new Date().toISOString();
const AGENTS = [
  { id: 'a1', agentName: 'TinyBot', llmModelName: 'Groq', ttsModelName: 'EdgeTTS', ttsVoiceName: 'Nabanita', deviceCount: 2, lastConnectedAt: NOW },
  { id: 'a2', agentName: 'Empty one', deviceCount: 0, lastConnectedAt: null },
];
const DEVICES = {
  a1: [
    { id: 'd1', alias: 'Desk', macAddress: '28:84:85:00:00:01', board: 'tinybot', lastConnectedAt: NOW },
    { id: 'd2', alias: '', macAddress: '28:84:85:00:00:02', board: 'tinybot', lastConnectedAt: null },
  ],
  a2: [],
};

const api = vi.hoisted(() => ({
  agent: { getAgentList: vi.fn(), searchAgent: vi.fn(), addAgent: vi.fn(), deleteAgent: vi.fn() },
  device: { getAgentBindDevices: vi.fn(), getDeviceStatus: vi.fn(), bindDevice: vi.fn(), manualAddDevice: vi.fn() },
  dict: { getDictDataByType: vi.fn() },
}));
vi.mock('@/apis/api', () => ({ default: api, getServiceUrl: () => '' }));
vi.mock('@/utils/featureManager', () => ({
  default: { waitForInitialization: async () => true, getConfig: () => ({ voiceprintRecognition: true }) },
}));

const { default: i18n } = await import('@/i18n');
const { default: kit } = await import('@/kit');
const { robot } = await import('@/shell/robot');
const { default: Robots } = await import('@/views/robots/Robots.vue');

function wire({ agents = AGENTS } = {}) {
  api.agent.getAgentList.mockImplementation((cb) => cb({ data: { code: 0, data: agents } }));
  api.device.getAgentBindDevices.mockImplementation((id, cb) => cb({ data: { code: 0, data: DEVICES[id] || [] } }));
  api.device.getDeviceStatus.mockImplementation((id, cb) => cb({ data: { code: 0, data: JSON.stringify({
    'tinybot@@@28_84_85_00_00_01@@@28_84_85_00_00_01': { isAlive: true },
  }) } }));
}

async function mountPage() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }] });
  router.push('/robots');
  await router.isReady();
  const w = mount(Robots, { attachTo: document.body, global: { plugins: [i18n, kit, router] } });
  await flushPromises();
  return { w, router };
}

describe('My robots page', () => {
  beforeEach(() => {
    i18n.global.locale = 'en';
    localStorage.clear();
    Object.assign(robot, { deviceId: '', agentId: '', name: '', list: [], loaded: false, loading: false });
    vi.clearAllMocks();
  });
  afterEach(() => { document.body.innerHTML = ''; });

  it('lists each character with its robots, MAC masked, online state, and picks a robot', async () => {
    wire();
    const { w } = await mountPage();
    const text = w.text();
    expect(text).toContain('TinyBot');
    expect(text).toContain('Empty one');
    expect(text).toContain('Desk');
    expect(text).toContain('Unnamed robot');
    expect(text).toContain('No robot runs this character yet.');
    expect(w.findAll('.rb-row:not(.rb-row--note)')).toHaveLength(2);
    expect(w.find('.rb-mac__mask').text()).toBe(':85:00:');
    // masked bytes are drawn as dots, the real bytes swap in on hover or focus (CSS)
    expect(w.find('.rb-mac__dots').text()).toBe(':••:••:');
    // the voice by its display name, no provider or model IDs
    expect(w.find('.rb-group__models').text()).toBe('Voice: Nabanita');
    expect(text).not.toContain('EdgeTTS');
    expect(text).not.toContain('Groq');
    expect(w.find('.rb-row__acts').exists()).toBe(true);
    expect(w.find('.rb-row__state.is-online').exists()).toBe(true);
    // the shell's robot falls back to the first one, marked as current
    expect(robot.deviceId).toBe('d1');
    expect(w.find('.rb-row.is-current .rb-now').exists()).toBe(true);
    const pick = w.findAll('.rb-row')[1].findAll('button').find((b) => b.text().includes('Make this my robot'));
    await pick.trigger('click');
    expect(robot.deviceId).toBe('d2');
    expect(robot.agentId).toBe('a1');
  });

  it('shows the first-run path when the account has no character', async () => {
    wire({ agents: [] });
    const { w } = await mountPage();
    expect(w.text()).toContain('No robot yet');
    expect(w.text()).toContain('6-digit code');
    expect(w.find('#robots-search').exists()).toBe(false);
  });

  it('refuses a bind code that is not six digits and binds a valid one', async () => {
    wire();
    api.device.bindDevice.mockImplementation((agentId, code, cb) => cb({ data: { code: 0 } }));
    const { w } = await mountPage();
    const add = w.findAll('button').find((b) => b.text() === 'Add robot');
    await add.trigger('click');
    await flushPromises();
    const input = document.querySelector('#rb-add-code');
    input.value = '12a34';
    input.dispatchEvent(new Event('input'));
    await flushPromises();
    const submit = [...document.querySelectorAll('.tb-sheet__foot button')].find((b) => b.textContent.includes('Add robot'));
    submit.click();
    await flushPromises();
    expect(api.device.bindDevice).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Type the 6-digit code');
    input.value = '123456';
    input.dispatchEvent(new Event('input'));
    await flushPromises();
    submit.click();
    await flushPromises();
    expect(api.device.bindDevice).toHaveBeenCalledWith('a1', '123456', expect.any(Function), expect.any(Function));
  });

  it('deletes a character only after its exact name is typed', async () => {
    wire();
    api.agent.deleteAgent.mockImplementation((id, cb) => cb({ data: { code: 0 } }));
    const { w } = await mountPage();
    // open the menu of the first character and choose delete
    await w.find('.rb-group__act .tb-menu button').trigger('click');
    const del = w.findAll('.tb-menu__item').find((b) => b.text().includes('Delete character'));
    await del.trigger('click');
    await flushPromises();
    const confirmBtn = () => [...document.querySelectorAll('.tb-sheet__foot button')].find((b) => b.textContent.includes('Delete'));
    expect(confirmBtn().disabled).toBe(true);
    const input = document.querySelector('#rb-del-input');
    input.value = 'tinybot';
    input.dispatchEvent(new Event('input'));
    await flushPromises();
    expect(confirmBtn().disabled).toBe(true);
    expect(document.body.textContent).toContain('The name does not match');
    input.value = 'TinyBot';
    input.dispatchEvent(new Event('input'));
    await flushPromises();
    expect(confirmBtn().disabled).toBe(false);
    confirmBtn().click();
    await flushPromises();
    expect(api.agent.deleteAgent).toHaveBeenCalledWith('a1', expect.any(Function));
  });

  it('searches by MAC through the agent search API', async () => {
    wire();
    api.agent.searchAgent.mockImplementation((q, type, cb) => cb({ data: { code: 0, data: [] } }));
    const { w } = await mountPage();
    const input = w.find('#robots-search');
    await input.setValue('28:84:85:00:00:01');
    await w.find('form[role="search"]').trigger('submit');
    await flushPromises();
    expect(api.agent.searchAgent).toHaveBeenCalledWith('28:84:85:00:00:01', 'mac', expect.any(Function));
    expect(w.text()).toContain('Nothing matches');
    expect(JSON.parse(localStorage.getItem('agent_search_history'))).toEqual(['28:84:85:00:00:01']);
  });
});
