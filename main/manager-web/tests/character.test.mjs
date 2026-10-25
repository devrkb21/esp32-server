// Character & voice: the page's rules (from the legacy roleConfig.vue) and the page itself.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';

vi.mock('@/apis/api', () => ({
  default: {
    agent: {
      getDeviceConfig: vi.fn(), getAgentTags: vi.fn(), updateAgentConfig: vi.fn(), getAgentTemplate: vi.fn(),
      getAgentMcpAccessAddress: vi.fn(), getAgentMcpToolsList: vi.fn(), getAgentSnapshots: vi.fn(),
      getAgentSnapshot: vi.fn(), restoreAgentSnapshot: vi.fn(), deleteAgentSnapshot: vi.fn(), getAgentList: vi.fn(),
    },
    model: { getModelNames: vi.fn(), getLlmModelCodeList: vi.fn(), getModelVoices: vi.fn(), getPluginFunctionList: vi.fn() },
    device: { getAgentBindDevices: vi.fn() },
  },
  getServiceUrl: () => '/api',
}));
vi.mock('@/apis/httpRequest', () => ({ default: { sendRequest: vi.fn() } }));
vi.mock('@/apis/module/correctWord', () => ({ default: { selectAll: vi.fn((cb) => cb({ data: { code: 0, data: [{ id: 'cw-1', fileName: 'Names' }] } })) } }));
vi.mock('@/utils/featureManager', () => ({
  default: { waitForInitialization: vi.fn(() => Promise.resolve(true)), getConfig: vi.fn(() => ({ vad: false, asr: false, addressBook: false, mcpAccessPoint: false })) },
}));
vi.mock('v-code-diff/vue3', () => ({ CodeDiff: { name: 'CodeDiff', render: () => null }, hljs: { registerLanguage: () => {} } }));

import Api from '@/apis/api';
import kit from '@/kit';
import pages from '@/i18n/pages/character.js';
import shell from '@/i18n/pages/shell.js';
import en from '@/i18n/en.js';
import RoleConfig from '@/views/character/RoleConfig.vue';
import {
  applyMemoryChange, buildSaveData, buildTtsDraft, emptyForm, intentVisibility, providerOf, providersFromRows, rowsFromProviders, voiceAudioUrl,
} from '@/views/character/characterModel';

const ok = (data) => ({ data: { code: 0, msg: 'ok', data } });

describe('character strings', () => {
  it('has every key in both Bangla and English, with no em dash', () => {
    expect(Object.keys(pages.bn).sort()).toEqual(Object.keys(pages.en).sort());
    for (const v of [...Object.values(pages.bn), ...Object.values(pages.en)]) {
      expect(v).not.toMatch(/—/);
      expect(v.trim()).not.toBe('');
    }
  });
});

describe('character rules', () => {
  const voices = [
    { id: 'bn1', name: 'Bn one', languages: 'বাংলা' },
    { id: 'bn2', name: 'Bn two', languages: 'বাংলা, English' },
    { id: 'en1', name: 'En one', languages: 'English' },
    { id: 'any', name: 'Any', languages: '' },
  ];

  it('keeps the saved voice and its language when the voices arrive', () => {
    const d = buildTtsDraft('TTS_X', voices, { preferredLanguage: 'English', preferredVoiceId: 'en1' }, {});
    expect(d.language).toBe('English');
    expect(d.voiceId).toBe('en1');
    expect(d.languageOptions.map((o) => o.value)).toEqual(['বাংলা', 'English']);
    expect(d.voiceOptions.map((o) => o.value)).toEqual(['bn2', 'en1', 'any']);
  });

  it('picks the first voice of the language when asked to, and gives up on an empty model', () => {
    const d = buildTtsDraft('TTS_X', voices, { autoSelectVoice: true, preferredLanguage: 'বাংলা' }, { ttsVoiceId: 'gone' });
    expect(d.voiceId).toBe('bn1');
    expect(buildTtsDraft('TTS_X', [], {}, {})).toBeNull();
  });

  it('sends exactly the legacy body, with optional fields only when touched or set', () => {
    const form = { ...emptyForm(), agentName: 'TinyBot', ttsVoiceId: 'v1', ttsRate: 10, model: { ...emptyForm().model, memModelId: 'Memory_nomem' } };
    const base = {
      form, selectedLanguage: 'বাংলা', currentFunctions: [{ id: 'P1', params: '{"a":1}' }], currentContextProviders: [],
      checkedReplacementWordIds: ['cw-1'], dynamicTags: [{ tagName: 'home' }], originalTagNames: ['home'],
      ttsLanguageTouched: false, ttsVoiceTouched: false,
    };
    const data = buildSaveData(base);
    expect(data.functions).toEqual([{ pluginId: 'P1', paramInfo: { a: 1 } }]);
    expect(data.correctWordFileIds).toEqual(['cw-1']);
    expect(data.ttsRate).toBe(10);
    expect('ttsVolume' in data).toBe(false);
    expect('tagNames' in data).toBe(false);
    expect('ttsLanguage' in data).toBe(false);
    const touched = buildSaveData({ ...base, ttsLanguageTouched: true, ttsVoiceTouched: true, dynamicTags: [{ tagName: 'desk' }] });
    expect(touched).toMatchObject({ ttsLanguage: 'বাংলা', ttsVoiceId: 'v1', tagNames: ['desk'] });
  });

  it('turns chat history off and parks the summary when memory is switched off', () => {
    const off = applyMemoryChange({ summaryMemory: 'likes tea' }, 'Memory_nomem', '');
    expect(off).toEqual({ chatHistoryConf: 0, summaryMemory: '', tempSummary: 'likes tea' });
    const back = applyMemoryChange({ summaryMemory: '' }, 'Memory_mem_local_short', 'likes tea');
    expect(back).toEqual({ chatHistoryConf: 2, summaryMemory: 'likes tea', tempSummary: '' });
  });

  it('hides function calling for LLMs that cannot do it and moves the choice', () => {
    const options = [{ value: 'Intent_nointent' }, { value: 'Intent_function_call' }];
    const r = intentVisibility(options, 'dify', 'Intent_function_call');
    expect(r.options.find((o) => o.value === 'Intent_function_call').isHidden).toBe(true);
    expect(r.intentModelId).toBe('Intent_nointent');
    expect(intentVisibility(options, 'openai', 'Intent_function_call').intentModelId).toBe('Intent_function_call');
  });

  it('names providers and finds voice samples', () => {
    expect(providerOf('ASR', { value: 'ASR_FunASR', label: 'Fun' })).toBe('FunASR');
    expect(providerOf('LLM', { value: 'L1' }, { L1: 'openai' })).toBe('openai');
    expect(providerOf('Memory', { value: 'Memory_x' })).toBe('');
    expect(voiceAudioUrl({ voiceDemo: 'voice-demos/a.mp3' }, 'x')).toBe('/voice-demos/a.mp3');
    expect(voiceAudioUrl({ ttsVoice: 'bn-BD-NabanitaNeural' }, 'x')).toBe('/voice-demos/bn-BD-NabanitaNeural.mp3');
    expect(voiceAudioUrl({ id: 'TTS_1' }, 'TTS_1')).toBe('');
  });

  it('drops blank context sources and trims header names', () => {
    const rows = rowsFromProviders([{ url: ' https://a.example ', headers: { ' X-Key ': 'v' } }]);
    rows.push({ url: '  ', headers: [] });
    rows[0].headers.push({ key: '', value: 'lost' });
    expect(providersFromRows(rows)).toEqual([{ url: 'https://a.example', headers: { 'X-Key': 'v' } }]);
    expect(rowsFromProviders([])).toEqual([{ url: '', headers: [{ key: '', value: '' }] }]);
  });
});

describe('RoleConfig', () => {
  const config = {
    agentCode: 'TinyBot', agentName: 'Desk friend', systemPrompt: 'You are kind.', summaryMemory: 'Likes tea', ttsModelId: 'TTS_E', ttsVoiceId: 'v1',
    ttsLanguage: 'English', llmModelId: 'L1', slmModelId: 'L1', vllmModelId: '', memModelId: 'Memory_mem_local_short', intentModelId: 'Intent_function_call',
    chatHistoryConf: 2, functions: [{ pluginId: 'P1', paramInfo: { city: 'Dhaka' } }], contextProviders: [], correctWordFileIds: [], currentVersionNo: 3,
  };
  beforeEach(() => {
    vi.clearAllMocks();
    Api.agent.getDeviceConfig.mockImplementation((id, cb) => cb(ok(JSON.parse(JSON.stringify(config)))));
    Api.agent.getAgentTags.mockImplementation((id, cb) => cb(ok([{ id: 't1', tagName: 'home' }])));
    Api.agent.getAgentTemplate.mockImplementation((cb) => cb(ok([{ id: 'tpl', agentName: 'Storyteller', systemPrompt: 'Tell stories.' }])));
    Api.agent.updateAgentConfig.mockImplementation((id, data, cb) => cb(ok(null)));
    Api.model.getModelNames.mockImplementation((type, n, cb) => cb(ok(
      type === 'Intent' ? [{ id: 'Intent_nointent', modelName: 'None' }, { id: 'Intent_function_call', modelName: 'Calls' }]
        : type === 'Memory' ? [{ id: 'Memory_nomem', modelName: 'No memory' }, { id: 'Memory_mem_local_short', modelName: 'Short' }]
          : type === 'TTS' ? [{ id: 'TTS_E', modelName: 'Edge' }] : [],
    )));
    Api.model.getLlmModelCodeList.mockImplementation((n, cb) => cb(ok([{ id: 'L1', modelName: 'Llama', type: 'openai' }])));
    Api.model.getModelVoices.mockImplementation((id, n, cb) => cb(ok([{ id: 'v1', name: 'Aria', languages: 'English' }, { id: 'v2', name: 'Nabanita', languages: 'বাংলা' }])));
    Api.model.getPluginFunctionList.mockImplementation((p, cb) => cb(ok([
      { id: 'P1', name: 'Weather', fields: JSON.stringify([{ key: 'city', label: 'City', type: 'string', default: 'Dhaka' }]) },
      { id: 'P2', name: 'Music', fields: '[]' },
    ])));
  });

  function setup() {
    const i18n = createI18n({ legacy: true, locale: 'en', fallbackLocale: 'en', messages: { en: { ...en, ...shell.en, ...pages.en } } });
    const confirm = vi.fn(() => Promise.resolve('confirm'));
    const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
    const w = mount(RoleConfig, {
      global: {
        plugins: [i18n, kit],
        mocks: { $confirm: confirm, $message: message, $route: { query: { agentId: 'a1' } } },
        stubs: { teleport: true, RouterLink: true },
      },
    });
    return { w, confirm, message };
  }

  it('loads the character with the legacy calls and shows it', async () => {
    const { w } = setup();
    await flushPromises();
    expect(Api.agent.getDeviceConfig).toHaveBeenCalledWith('a1', expect.any(Function), expect.any(Function));
    expect(Api.agent.getAgentTags).toHaveBeenCalledWith('a1', expect.any(Function), expect.any(Function));
    expect(Api.model.getModelVoices).toHaveBeenCalledWith('TTS_E', '', expect.any(Function), expect.any(Function));
    expect(w.find('#ch-name').element.value).toBe('Desk friend');
    expect(w.find('#ch-prompt').element.value).toBe('You are kind.');
    expect(w.text()).toContain('home');
    expect(w.text()).toContain('Weather');
    expect(w.text()).toContain('Version 3');
    expect(w.find('.ch-save').exists()).toBe(false);
  });

  it('shows the save bar after an edit, and saves the legacy body', async () => {
    const { w, message } = setup();
    await flushPromises();
    await w.find('#ch-name').setValue('Tiny');
    expect(w.find('.ch-save').exists()).toBe(true);
    await w.findAll('.ch-save .tb-btn').at(1).trigger('click');
    await flushPromises();
    const [id, body] = Api.agent.updateAgentConfig.mock.calls[0];
    expect(id).toBe('a1');
    expect(body).toMatchObject({ agentName: 'Tiny', llmModelId: 'L1', memModelId: 'Memory_mem_local_short', functions: [{ pluginId: 'P1', paramInfo: { city: 'Dhaka' } }] });
    expect('tagNames' in body).toBe(false);
    expect(message.success).toHaveBeenCalled();
    expect(w.find('.ch-save').exists()).toBe(false);
  });

  it('undo puts back the last saved state', async () => {
    const { w } = setup();
    await flushPromises();
    await w.find('#ch-prompt').setValue('Something else');
    await w.findAll('.ch-save .tb-btn').at(0).trigger('click');
    await flushPromises();
    expect(w.find('#ch-prompt').element.value).toBe('You are kind.');
    expect(w.find('.ch-save').exists()).toBe(false);
  });

  it('turns tools off with intent recognition off, and memory off clears the summary', async () => {
    const { w } = setup();
    await flushPromises();
    await w.find('#ch-m-intentModelId').setValue('Intent_nointent');
    expect(w.text()).toContain('Tools are off');
    await w.find('#ch-m-mem').setValue('Memory_nomem');
    expect(w.find('#ch-summary').element.value).toBe('');
    expect(w.find('#ch-summary').attributes('disabled')).toBeDefined();
  });

  it('asks before clearing every field', async () => {
    const { w, confirm } = setup();
    await flushPromises();
    const clear = w.findAll('.tb-btn--danger').find((b) => b.text() === 'Clear');
    await clear.trigger('click');
    await flushPromises();
    expect(confirm).toHaveBeenCalled();
    expect(w.find('#ch-name').element.value).toBe('');
  });
});
