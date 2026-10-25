import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';

vi.mock('@/apis/api', () => ({
  default: {
    admin: {
      getParamsList: vi.fn(), addParam: vi.fn(), updateParam: vi.fn(), deleteParam: vi.fn(),
      getWsServerList: vi.fn(), sendWsServerAction: vi.fn(),
    },
    user: { getPubConfig: vi.fn() },
  },
}));
vi.mock('@/apis/module/dict', () => ({
  default: {
    getDictTypeList: vi.fn(), addDictType: vi.fn(), updateDictType: vi.fn(), deleteDictType: vi.fn(),
    getDictDataList: vi.fn(), addDictData: vi.fn(), updateDictData: vi.fn(), deleteDictData: vi.fn(),
  },
}));
vi.mock('@/utils/featureManager.js', () => ({
  default: {
    waitForInitialization: vi.fn(() => Promise.resolve(true)),
    getAllFeatures: vi.fn(() => ({ asr: { enabled: true }, vad: { enabled: false }, knowledgeBase: { enabled: true } })),
    updateFeatures: vi.fn(),
    resetToDefault: vi.fn(),
  },
}));

import Api from '@/apis/api';
import dictApi from '@/apis/module/dict';
import featureManager from '@/utils/featureManager.js';
import kit from '@/kit';
import pages from '@/i18n/pages/system.js';
import shell from '@/i18n/pages/shell.js';
import ParamsManagement from '@/views/system/ParamsManagement.vue';
import DictManagement from '@/views/system/DictManagement.vue';
import FeatureManagement from '@/views/system/FeatureManagement.vue';
import ServerSideManager from '@/views/system/ServerSideManager.vue';

const ok = (data) => ({ data: { code: 0, msg: 'ok', data } });

function setup(component) {
  const i18n = createI18n({ legacy: true, locale: 'en', fallbackLocale: 'en', messages: { en: { ...shell.en, ...pages.en } } });
  const confirm = vi.fn(() => Promise.resolve('confirm'));
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const w = mount(component, {
    global: {
      plugins: [i18n, kit],
      mocks: { $confirm: confirm, $message: message, $router: { go: vi.fn() } },
      stubs: { teleport: true, RouterLink: true },
    },
  });
  return { w, confirm, message };
}

describe('system strings', () => {
  it('has every key in both Bangla and English, without the em dash', () => {
    expect(Object.keys(pages.bn).sort()).toEqual(Object.keys(pages.en).sort());
    for (const v of [...Object.values(pages.bn), ...Object.values(pages.en)]) {
      expect(v).not.toMatch(/—/);
      expect(v.trim()).not.toBe('');
    }
  });
});

describe('ParamsManagement', () => {
  const rows = [
    { id: 1, paramCode: 'server.secret', paramValue: 'abcdef123', valueType: 'string', remark: 'shared secret' },
    { id: 2, paramCode: 'log.log_level', paramValue: 'INFO', valueType: 'string', remark: '' },
    { id: 3, paramCode: 'wakeup_words', paramValue: 'a;b', valueType: 'array', remark: 'wake' },
  ];
  beforeEach(() => {
    vi.clearAllMocks();
    Api.admin.getParamsList.mockImplementation((params, cb) => cb(ok({ total: rows.length, list: rows })));
    Api.admin.deleteParam.mockImplementation((ids, cb) => cb(ok(null)));
    Api.admin.addParam.mockImplementation((body, cb) => cb(ok(null)));
    Api.admin.updateParam.mockImplementation((body, cb) => cb(ok(null)));
  });

  it('fetches every param with the legacy query and masks sensitive values', async () => {
    const { w } = setup(ParamsManagement);
    await flushPromises();
    expect(Api.admin.getParamsList).toHaveBeenCalledWith({ page: 1, limit: 500, paramCode: '' }, expect.any(Function));
    expect(w.text()).toContain('log.log_level');
    expect(w.text()).toContain('ab****23');
    expect(w.text()).not.toContain('abcdef123');
  });

  it('filters by code or remark as you type', async () => {
    const { w } = setup(ParamsManagement);
    await flushPromises();
    await w.find('input[type="text"]').setValue('wake');
    expect(w.text()).toContain('wakeup_words');
    expect(w.text()).not.toContain('log.log_level');
    await w.find('input[type="text"]').setValue('nothing-here');
    expect(w.text()).toContain('No matching parameters');
  });

  it('deletes one param after a danger confirm', async () => {
    const { w, confirm } = setup(ParamsManagement);
    await flushPromises();
    w.vm.deleteOne(rows[1]);
    await flushPromises();
    expect(confirm).toHaveBeenCalledWith(expect.any(String), 'Delete log.log_level?', expect.objectContaining({ danger: true }));
    expect(Api.admin.deleteParam).toHaveBeenCalledWith([2], expect.any(Function));
  });

  it('adds a list param joined with semicolons', async () => {
    const { w } = setup(ParamsManagement);
    await flushPromises();
    w.vm.save({ id: null, paramCode: 'exit_commands', paramValue: 'bye;ciao', valueType: 'array', remark: '' });
    await flushPromises();
    expect(Api.admin.addParam).toHaveBeenCalledWith(
      { id: null, paramCode: 'exit_commands', paramValue: 'bye;ciao', valueType: 'array', remark: '' },
      expect.any(Function), expect.any(Function),
    );
  });
});

describe('DictManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dictApi.getDictTypeList.mockImplementation((p, cb) => cb(ok({ total: 2, list: [
      { id: 1, dictName: 'Firmware type', dictType: 'FIRMWARE_TYPE' }, { id: 2, dictName: 'Model type', dictType: 'MODEL_TYPE' },
    ] })));
    dictApi.getDictDataList.mockImplementation((p, cb) => cb(ok({ total: 1, list: [
      { id: 9, dictTypeId: p.dictTypeId, dictLabel: 'TinyBot', dictValue: 'tinybot', sort: 1 },
    ] })));
    dictApi.deleteDictData.mockImplementation((ids, cb) => cb(ok(null)));
  });

  it('loads the types, then the values of the first type', async () => {
    const { w } = setup(DictManagement);
    await flushPromises();
    expect(dictApi.getDictTypeList).toHaveBeenCalledWith({ page: 1, limit: 100, dictName: '' }, expect.any(Function));
    expect(dictApi.getDictDataList).toHaveBeenCalledWith(
      { dictTypeId: 1, page: 1, limit: 10, dictLabel: '', dictValue: '' }, expect.any(Function),
    );
    expect(w.text()).toContain('Model type');
    expect(w.text()).toContain('tinybot');
  });

  it('switches to the values of a picked type', async () => {
    const { w } = setup(DictManagement);
    await flushPromises();
    await w.findAll('.dict__pick')[1].trigger('click');
    expect(dictApi.getDictDataList).toHaveBeenLastCalledWith(expect.objectContaining({ dictTypeId: 2, page: 1 }), expect.any(Function));
  });

  it('deletes a value after a danger confirm', async () => {
    const { w, confirm } = setup(DictManagement);
    await flushPromises();
    w.vm.deleteDataOne({ id: 9, dictLabel: 'TinyBot' });
    await flushPromises();
    expect(confirm.mock.calls[0][2]).toEqual(expect.objectContaining({ danger: true }));
    expect(dictApi.deleteDictData).toHaveBeenCalledWith([9], expect.any(Function));
  });
});

describe('ServerSideManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Api.admin.getWsServerList.mockImplementation((p, cb) => cb(ok(['ws://192.0.2.10:8000/xiaozhi/v1/'])));
    Api.admin.sendWsServerAction.mockImplementation((p, cb) => cb(ok(true)));
  });

  it('lists the servers and restarts one after a danger confirm', async () => {
    const { w, confirm, message } = setup(ServerSideManager);
    await flushPromises();
    expect(w.text()).toContain('ws://192.0.2.10:8000/xiaozhi/v1/');
    await w.vm.emitAction({ address: 'ws://192.0.2.10:8000/xiaozhi/v1/' }, 'restart');
    await flushPromises();
    expect(confirm.mock.calls[0][2]).toEqual(expect.objectContaining({ danger: true }));
    expect(Api.admin.sendWsServerAction).toHaveBeenCalledWith(
      { targetWs: 'ws://192.0.2.10:8000/xiaozhi/v1/', action: 'restart' }, expect.any(Function),
    );
    expect(message.success).toHaveBeenCalled();
  });

  it('confirms the config update with danger too and sends nothing when cancelled', async () => {
    const { w, confirm } = setup(ServerSideManager);
    await flushPromises();
    confirm.mockImplementationOnce(() => Promise.reject(new Error('cancel')));
    await w.vm.emitAction({ address: 'ws://192.0.2.10:8000/xiaozhi/v1/' }, 'update_config');
    expect(confirm.mock.calls[0][2]).toEqual(expect.objectContaining({ danger: true }));
    expect(Api.admin.sendWsServerAction).not.toHaveBeenCalled();
  });
});

describe('FeatureManagement', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows the stored states and saves every flag together', async () => {
    const { w, message } = setup(FeatureManagement);
    await flushPromises();
    expect(w.text()).toContain('Speech recognition (ASR)');
    await w.vm.handleSave();
    expect(message.info).toHaveBeenCalled(); // nothing changed yet
    w.vm.toggleFeature(w.vm.voiceManagementFeatures.find((f) => f.id === 'vad'));
    await w.vm.handleSave();
    expect(featureManager.updateFeatures).toHaveBeenCalledWith(expect.objectContaining({ vad: true, asr: true, knowledgeBase: true, voiceClone: false }));
  });
});
