import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { components } from '../src/kit/index.js';
import ModelSheet from '../src/views/models/ModelSheet.vue';

// Ported from tests/legacy/modelAddDialog.test.mjs and modelEditDialog.test.mjs: the dictionary
// rules of the add and edit forms, now in the one model sheet.
vi.mock('@/apis/api', () => ({ default: { model: { getModelProviders: vi.fn(), getModelConfig: vi.fn() } } }));

function make(mode, props = {}) {
  const $message = { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const wrapper = mount(ModelSheet, {
    props: { open: false, mode, modelType: 'tts', ...props },
    global: { components, mocks: { $t: (k) => k, $message }, stubs: { teleport: true } },
  });
  return { wrapper, vm: wrapper.vm, $message };
}

describe('add sheet: dictionary fields', () => {
  let vm; let wrapper; let $message;
  beforeEach(() => {
    ({ vm, wrapper, $message } = make('add'));
    vm.fields = [
      { label: 'Volume', prop: 'volume', type: 'json-textarea', placeholder: 'volume' },
      { label: 'Key', prop: 'api_key', type: 'password', placeholder: 'api_key' },
    ];
    vm.form.supplier = 'test-provider';
  });
  const submitted = () => { vm.confirm(); const e = wrapper.emitted('confirm'); return e ? e[0][0] : undefined; };

  it('parses valid JSON dict input into an object before submit', () => {
    vm.form.configJson = { volume: '{"speed":1,"volume":10}', api_key: 'sk-xxx' };
    const data = submitted();
    expect(data.configJson.volume).toEqual({ speed: 1, volume: 10 });
    expect(data.configJson.api_key).toBe('sk-xxx');
    expect(data.configJson.type).toBe('test-provider');
    expect($message.error).not.toHaveBeenCalled();
  });

  it('blocks invalid JSON input and does not emit confirm', () => {
    vm.form.configJson = { volume: '{bad json', api_key: 'sk-xxx' };
    expect(submitted()).toBeUndefined();
    expect($message.error).toHaveBeenCalled();
    expect(vm.showAdvanced).toBe(true);
  });

  it.each(['[1,2]', 'null', '"text"', '1'])('blocks non-object JSON %s', (value) => {
    vm.form.configJson = { volume: value, api_key: 'sk-xxx' };
    expect(submitted()).toBeUndefined();
    expect($message.error).toHaveBeenCalled();
  });

  it('leaves empty strings and existing object values untouched', () => {
    const obj = { speed: 2 };
    vm.form.configJson = { volume: obj, api_key: '' };
    const data = submitted();
    expect(data.configJson.volume).toEqual(obj);
    expect(data.configJson.api_key).toBe('');
    expect($message.error).not.toHaveBeenCalled();
  });

  it('needs a provider and a valid model ID', () => {
    vm.form.supplier = '';
    vm.form.id = 'letters';
    expect(submitted()).toBeUndefined();
    expect(vm.errors.supplier).toBeTruthy();
    expect(vm.errors.id).toBeTruthy();
  });
});

describe('edit sheet: stored dictionary fields', () => {
  let vm; let wrapper; let $message;
  const saved = () => wrapper.emitted('save') || [];
  const openModel = (value) => vm.processModelData({
    id: 'test-model', modelName: 'Test model', configJson: { type: 'test-provider', prosody: value },
  });
  beforeEach(() => {
    vi.useFakeTimers();
    ({ vm, wrapper, $message } = make('edit', { model: { id: 'test-model' } }));
    vm.fields = [{ prop: 'prosody', type: 'json-textarea' }];
  });
  afterEach(() => { wrapper.unmount(); vi.clearAllTimers(); vi.useRealTimers(); });

  it('opens a JSON string as an editable dictionary instead of a quoted string', () => {
    openModel('{"speed":1,"volume":10}');
    expect(JSON.parse(vm.fieldJsonMap.prosody)).toEqual({ speed: 1, volume: 10 });
    expect(vm.form.configJson.prosody).toEqual({ speed: 1, volume: 10 });
  });

  it('preserves a stored JSON string when saving without changes', () => {
    openModel('{"speed":1,"volume":10}');
    vm.handleSave();
    expect($message.error).not.toHaveBeenCalled();
    expect(saved()[0][0].formData.configJson.prosody).toEqual({ speed: 1, volume: 10 });
    expect(saved()[0][0].provideCode).toBe('test-provider');
  });

  it('keeps edits after saving and reopening the returned object', () => {
    openModel('{"speed":1,"volume":10}');
    vm.fieldJsonMap.prosody = '{"speed":2,"volume":5}';
    vm.handleSave();
    const config = saved()[0][0].formData.configJson;
    vm.resetForm();
    openModel(JSON.parse(JSON.stringify(config.prosody)));
    vm.handleSave();
    expect(JSON.parse(vm.fieldJsonMap.prosody)).toEqual({ speed: 2, volume: 5 });
    expect(saved()[1][0].formData.configJson.prosody).toEqual({ speed: 2, volume: 5 });
    expect($message.error).not.toHaveBeenCalled();
  });

  it('preserves nested values and masked secrets in existing dictionary objects', () => {
    const value = { speed: 0, enabled: false, nested: { api_key: 'ab****yz' }, tags: ['a'] };
    openModel(value);
    vm.handleSave();
    expect(saved()[0][0].formData.configJson.prosody).toEqual(value);
    expect($message.error).not.toHaveBeenCalled();
  });

  it.each(['not json', 'null', '[]', '1', 'true', '"text"'])('does not reinterpret %s as a dictionary', (value) => {
    openModel(value);
    expect(JSON.parse(vm.fieldJsonMap.prosody)).toBe(value);
    expect(vm.validateJson(vm.fieldJsonMap.prosody)).toBeNull();
    expect($message.error).toHaveBeenCalled();
  });

  it('a masked secret clears on focus and comes back when left empty', () => {
    vm.fields = [{ prop: 'api_key', type: 'text' }];
    vm.processModelData({ id: 'm', configJson: { type: 't', api_key: 'sk-a****z' } });
    vm.onSecretFocus('api_key');
    expect(vm.form.configJson.api_key).toBe('');
    vm.onSecretBlur('api_key');
    expect(vm.form.configJson.api_key).toBe('sk-a****z');
  });
});
