import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';

vi.mock('@/apis/module/agent', () => ({
  default: {
    getAgentTemplatesPage: vi.fn(),
    getAgentTemplate: vi.fn(),
    getAgentTemplateById: vi.fn(),
    addAgentTemplate: vi.fn(),
    updateAgentTemplate: vi.fn(),
    deleteAgentTemplate: vi.fn(),
    batchDeleteAgentTemplate: vi.fn(),
  },
}));

import agentApi from '@/apis/module/agent';
import kit from '@/kit';
import pages from '@/i18n/pages/templates.js';
import shell from '@/i18n/pages/shell.js';
import {
  DEFAULT_MODEL_CONFIG, emptyForm, formFromTemplate, nextSort, payloadOf, validate,
} from '@/views/templates/templateModel.js';
import AgentTemplateManagement from '@/views/templates/AgentTemplateManagement.vue';
import TemplateQuickConfig from '@/views/templates/TemplateQuickConfig.vue';

const ok = (data) => ({ data: { code: 0, msg: 'ok', data } });
const rows = [
  { id: 't1', agentName: 'Study buddy', systemPrompt: 'Ask one question at a time.', sort: 1 },
  { id: 't2', agentName: 'Bedtime storyteller', systemPrompt: '', sort: 2 },
];

function setup(component, query = {}) {
  const i18n = createI18n({ legacy: true, locale: 'en', fallbackLocale: 'en', messages: { en: { ...shell.en, ...pages.en } } });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/agent-template-management', component: { template: '<div />' } },
      { path: '/template-quick-config', component: { template: '<div />' } },
    ],
  });
  const confirm = vi.fn(() => Promise.resolve());
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  return { router, confirm, message, mountIt: async () => {
    await router.push({ path: '/template-quick-config', query });
    await router.isReady();
    const w = mount(component, {
      global: { plugins: [i18n, router, kit], mocks: { $confirm: confirm, $message: message }, stubs: { teleport: true } },
    });
    await flushPromises();
    return w;
  } };
}

describe('template model', () => {
  it('builds the payload the API expects, flat model ids and empty functions', () => {
    const p = payloadOf({ ...emptyForm('A', 3), systemPrompt: 'x' });
    expect(p).toEqual({ id: '', agentCode: 'Xiaozhi', agentName: 'A', systemPrompt: 'x', sort: 3, functions: [], ...DEFAULT_MODEL_CONFIG });
  });
  it('fills missing model ids with the defaults', () => {
    const f = formFromTemplate({ id: 'x', agentName: 'N', systemPrompt: 'P', llmModelId: 'LLM_Other' });
    expect(f.model.llmModelId).toBe('LLM_Other');
    expect(f.model.ttsModelId).toBe('TTS_EdgeTTS');
    expect(f.agentCode).toBe('Xiaozhi');
  });
  it('places a new template after the highest sort', () => {
    expect(nextSort([])).toBe(1);
    expect(nextSort([{ sort: 4 }, { sort: 2 }, {}])).toBe(5);
  });
  it('requires a name and a prompt', () => {
    expect(validate({ agentName: ' ', systemPrompt: '' })).toEqual({ agentName: 'templates.err.name', systemPrompt: 'templates.err.prompt' });
    expect(validate({ agentName: 'A', systemPrompt: 'B' })).toEqual({});
  });
});

describe('AgentTemplateManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agentApi.getAgentTemplatesPage.mockImplementation((params, cb) => cb(ok({ list: rows, total: 2 })));
  });

  it('loads the first page and lists the templates', async () => {
    const w = await setup(AgentTemplateManagement).mountIt();
    expect(agentApi.getAgentTemplatesPage).toHaveBeenCalledWith({ page: 1, limit: 10 }, expect.any(Function));
    expect(w.text()).toContain('Study buddy');
    expect(w.text()).toContain('Bedtime storyteller');
  });

  it('searches by agentName on enter', async () => {
    const w = await setup(AgentTemplateManagement).mountIt();
    const input = w.find('input[type="text"]');
    await input.setValue('study');
    await input.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(agentApi.getAgentTemplatesPage).toHaveBeenLastCalledWith({ page: 1, limit: 10, agentName: 'study' }, expect.any(Function));
  });

  it('shows the error state with a retry when the list fails', async () => {
    agentApi.getAgentTemplatesPage.mockImplementation((params, cb) => cb({ data: { code: 500, msg: 'boom' } }));
    const w = await setup(AgentTemplateManagement).mountIt();
    expect(w.text()).toContain('Could not load the templates');
    expect(w.text()).toContain('Try again');
  });

  it('batch deletes the selected ids after confirming', async () => {
    agentApi.batchDeleteAgentTemplate.mockImplementation((ids, cb) => cb(ok(null)));
    const s = setup(AgentTemplateManagement);
    const w = await s.mountIt();
    await w.findAll('tbody input[type="checkbox"]')[0].setValue(true);
    await w.findAll('tbody input[type="checkbox"]')[1].setValue(true);
    const del = w.findAll('button').find((b) => b.text().includes('Delete selected'));
    await del.trigger('click');
    await flushPromises();
    expect(s.confirm).toHaveBeenCalled();
    expect(agentApi.batchDeleteAgentTemplate).toHaveBeenCalledWith(['t1', 't2'], expect.any(Function));
  });

  it('deletes one template after confirming', async () => {
    agentApi.deleteAgentTemplate.mockImplementation((id, cb) => cb(ok(null)));
    const s = setup(AgentTemplateManagement);
    const w = await s.mountIt();
    await w.find('button[aria-label="Delete Study buddy"]').trigger('click');
    await flushPromises();
    expect(agentApi.deleteAgentTemplate).toHaveBeenCalledWith('t1', expect.any(Function));
  });

  it('refuses to save an empty prompt and sends the full payload otherwise', async () => {
    agentApi.addAgentTemplate.mockImplementation((data, cb) => cb(ok('new')));
    const w = await setup(AgentTemplateManagement).mountIt();
    await w.findAll('button').find((b) => b.text().includes('New template')).trigger('click');
    await flushPromises();
    await w.find('#tpl-form').trigger('submit');
    expect(agentApi.addAgentTemplate).not.toHaveBeenCalled();
    expect(w.text()).toContain('Enter a character prompt');
    await w.find('#tpl-prompt').setValue('You are kind.');
    await w.find('#tpl-form').trigger('submit');
    await flushPromises();
    expect(agentApi.addAgentTemplate).toHaveBeenCalledWith(
      { id: '', agentCode: 'Xiaozhi', agentName: 'New template', systemPrompt: 'You are kind.', sort: 1, functions: [], ...DEFAULT_MODEL_CONFIG },
      expect.any(Function),
    );
  });
});

describe('TemplateQuickConfig', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads a template by id and updates it', async () => {
    agentApi.getAgentTemplateById.mockImplementation((id, cb) => cb(ok({ id: 't1', agentName: 'Study buddy', systemPrompt: 'P', sort: 2 })));
    agentApi.updateAgentTemplate.mockImplementation((d, cb) => cb(ok(null)));
    const w = await setup(TemplateQuickConfig, { templateId: 't1' }).mountIt();
    expect(agentApi.getAgentTemplateById).toHaveBeenCalledWith('t1', expect.any(Function));
    await w.find('#tq-name').setValue('Study buddy 2');
    await w.find('#tq-form').trigger('submit');
    await flushPromises();
    expect(agentApi.updateAgentTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', agentName: 'Study buddy 2', sort: 2, functions: [] }), expect.any(Function));
  });

  it('in create mode asks for the list to set the sort, then adds', async () => {
    agentApi.getAgentTemplate.mockImplementation((cb) => cb(ok([{ sort: 3 }, { sort: 7 }])));
    agentApi.addAgentTemplate.mockImplementation((d, cb) => cb(ok('n')));
    const w = await setup(TemplateQuickConfig).mountIt();
    await w.find('#tq-prompt').setValue('Hello');
    await w.find('#tq-form').trigger('submit');
    await flushPromises();
    expect(agentApi.addAgentTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: '', sort: 8, systemPrompt: 'Hello' }), expect.any(Function));
  });

  it('shows not found when the template is missing', async () => {
    agentApi.getAgentTemplateById.mockImplementation((id, cb) => cb({ data: { code: 404, msg: 'Template not found' } }));
    const w = await setup(TemplateQuickConfig, { templateId: 'gone' }).mountIt();
    expect(w.text()).toContain('Template not found');
  });
});
