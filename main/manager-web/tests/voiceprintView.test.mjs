import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

const PRINTS = [
  { id: 'v1', agentId: 'ag1', audioId: 'au1', sourceName: 'Ammu', introduce: 'Mother', createDate: '2026-10-01 09:00:00' },
  { id: 'v2', agentId: 'ag1', audioId: 'au-old', sourceName: 'Apu', introduce: 'Sister', createDate: '2026-10-10 09:00:00' },
];
const RECENT = [
  { audioId: 'au1', content: 'Hello TinyBot' },
  { audioId: 'au2', content: '{"speaker":"Apu","content":"Good morning"}' },
];

const api = vi.hoisted(() => ({
  getServiceUrl: () => '',
  agent: {
    getAgentList: vi.fn(), getAgentVoicePrintList: vi.fn(), addAgentVoicePrint: vi.fn(), updateAgentVoicePrint: vi.fn(),
    deleteAgentVoicePrint: vi.fn(), getRecentlyFiftyByAgentId: vi.fn(), getContentByAudioId: vi.fn(), getAudioId: vi.fn(),
  },
  device: { getAgentBindDevices: vi.fn() },
}));
vi.mock('@/apis/api', () => ({ default: api, getServiceUrl: () => '' }));

const { default: i18n } = await import('@/i18n');
const { default: kit } = await import('@/kit');
const { robot } = await import('@/shell/robot');
const { confirmState, settle } = await import('@/kit/confirm');
const { default: VoicePrint } = await import('@/views/voiceprint/VoicePrint.vue');

const ok = (data) => ({ data: { code: 0, msg: 'ok', data } });

function wire({ prints = PRINTS } = {}) {
  api.agent.getAgentVoicePrintList.mockImplementation((id, cb) => cb(ok(prints)));
  api.agent.getRecentlyFiftyByAgentId.mockImplementation((id, cb) => cb(ok(RECENT)));
  api.agent.getContentByAudioId.mockImplementation((id, cb) => cb(ok(id === 'au-old' ? 'An older sentence' : '')));
  api.agent.addAgentVoicePrint.mockImplementation((body, cb) => cb(ok(null)));
  api.agent.updateAgentVoicePrint.mockImplementation((body, cb) => cb(ok(null)));
  api.agent.deleteAgentVoicePrint.mockImplementation((id, cb) => cb(ok(null)));
  api.agent.getAgentList.mockImplementation((cb) => cb(ok([])));
}

async function mountPage(path = '/voice-print?agentId=ag1') {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }] });
  router.push(path);
  await router.isReady();
  const w = mount(VoicePrint, { attachTo: document.body, global: { plugins: [i18n, kit, router] } });
  await flushPromises();
  return w;
}

describe('Voiceprints page', () => {
  beforeEach(() => {
    i18n.global.locale = 'en';
    localStorage.clear();
    Object.assign(robot, { deviceId: '', agentId: '', name: '', list: [], loaded: false, loading: false });
    vi.clearAllMocks();
  });
  afterEach(() => { document.body.innerHTML = ''; });

  it('lists the people of the agent in the query, each with the words of its recording', async () => {
    wire();
    const w = await mountPage();
    expect(api.agent.getAgentVoicePrintList).toHaveBeenCalledWith('ag1', expect.any(Function));
    const rows = w.findAll('.vp__rows .vp-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('Ammu');
    expect(rows[0].text()).toContain('Mother');
    expect(rows[0].text()).toContain('Hello TinyBot');
    // the older recording is not in the recent list: its words are asked by audio id
    expect(api.agent.getContentByAudioId).toHaveBeenCalledWith('au-old', expect.any(Function));
    expect(rows[1].text()).toContain('An older sentence');
    expect(rows[0].find('.vp-play').exists()).toBe(true);
  });

  it('falls back to the chosen robot\'s agent', async () => {
    wire();
    Object.assign(robot, { agentId: 'ag9', deviceId: 'd9', loaded: true });
    await mountPage('/voice-print');
    expect(api.agent.getAgentVoicePrintList).toHaveBeenCalledWith('ag9', expect.any(Function));
  });

  it('shows the way to the robots page when there is no robot', async () => {
    wire();
    const w = await mountPage('/voice-print');
    expect(w.text()).toContain('No robot connected yet');
    expect(api.agent.getAgentVoicePrintList).not.toHaveBeenCalled();
  });

  it('shows the empty state with the add action', async () => {
    wire({ prints: [] });
    const w = await mountPage();
    expect(w.text()).toContain('TinyBot does not know anyone’s voice yet');
  });

  it('adds a voice from a recent recording, refusing an incomplete form', async () => {
    wire();
    const w = await mountPage();
    await w.find('.tb-pagehead__actions button').trigger('click');
    await flushPromises();
    const sheet = document.querySelector('.tb-sheet');
    expect(sheet).not.toBeNull();
    expect(sheet.textContent).toContain('Good morning');
    expect(sheet.textContent).toContain('TinyBot thought: Apu');

    sheet.querySelector('#vp-form').dispatchEvent(new Event('submit'));
    await flushPromises();
    expect(api.agent.addAgentVoicePrint).not.toHaveBeenCalled();
    expect(sheet.textContent).toContain('Choose a recording of this person.');

    const radios = sheet.querySelectorAll('input[type="radio"]');
    radios[1].checked = true;
    radios[1].dispatchEvent(new Event('change'));
    const name = sheet.querySelector('#vps-name');
    name.value = 'Apu'; name.dispatchEvent(new Event('input'));
    const intro = sheet.querySelector('#vps-intro');
    intro.value = 'Sister'; intro.dispatchEvent(new Event('input'));
    await flushPromises();
    sheet.querySelector('#vp-form').dispatchEvent(new Event('submit'));
    await flushPromises();
    expect(api.agent.addAgentVoicePrint).toHaveBeenCalledWith(
      { agentId: 'ag1', audioId: 'au2', sourceName: 'Apu', introduce: 'Sister' }, expect.any(Function));
    expect(api.agent.getAgentVoicePrintList).toHaveBeenCalledTimes(2);
  });

  it('edits a voice and sends the saved row with the new values', async () => {
    wire();
    const w = await mountPage();
    await w.findAll('.vp__rows .vp-row')[0].findAll('.vp-row__act button')[0].trigger('click');
    await flushPromises();
    const sheet = document.querySelector('.tb-sheet');
    expect(sheet.querySelector('#vps-name').value).toBe('Ammu');
    const name = sheet.querySelector('#vps-name');
    name.value = 'Ammu jaan'; name.dispatchEvent(new Event('input'));
    await flushPromises();
    sheet.querySelector('#vp-form').dispatchEvent(new Event('submit'));
    await flushPromises();
    expect(api.agent.updateAgentVoicePrint).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'v1', audioId: 'au1', sourceName: 'Ammu jaan', introduce: 'Mother' }), expect.any(Function));
  });

  it('deletes only after the owner confirms', async () => {
    wire();
    const w = await mountPage();
    await w.findAll('.vp__rows .vp-row')[1].findAll('.vp-row__act button')[1].trigger('click');
    await flushPromises();
    expect(api.agent.deleteAgentVoicePrint).not.toHaveBeenCalled();
    expect(confirmState.open).toBe(true);
    expect(confirmState.current.message).toContain('Apu');
    expect(confirmState.current.danger).toBe(true);
    settle(true);
    await flushPromises();
    expect(api.agent.deleteAgentVoicePrint).toHaveBeenCalledWith('v2', expect.any(Function));
  });
});
