import { describe, expect, it } from 'vitest';
import {
  addPayload, cleanFields, duplicateOf, formFields, incompleteField, isSensitiveField, looksSensitive,
  openModelConfig, parseDict, parseDictFields, providerProblem, secretPlaceholder, validModelId,
} from '../src/views/models/modelForm.js';

describe('provider field schema', () => {
  it('maps dict to a JSON field, password to a secret, everything else to text', () => {
    const f = formFields(JSON.stringify([
      { key: 'prosody', label: 'Prosody', type: 'dict' },
      { key: 'api_key', label: 'Key', type: 'password' },
      { key: 'url', label: 'URL', type: 'string' },
    ]));
    expect(f.map((x) => x.type)).toEqual(['json-textarea', 'password', 'text']);
    expect(f[0].prop).toBe('prosody');
  });
  it('treats a broken schema as no fields', () => {
    expect(formFields('{oops')).toEqual([]);
    expect(formFields('')).toEqual([]);
  });
});

describe('secrets', () => {
  it('models: exact secret names only', () => {
    expect(isSensitiveField('API_KEY')).toBe(true);
    expect(isSensitiveField('my_api_key')).toBe(false);
  });
  it('providers: any key containing a secret name', () => {
    expect(looksSensitive('my_api_key')).toBe(true);
    expect(looksSensitive('base_url')).toBe(false);
  });
  it('placeholder names the secret', () => {
    expect(secretPlaceholder('access_token')).toBe('Your Access Token');
  });
});

describe('model id', () => {
  it.each(['LLM_01', 'tts-2', 'a1'])('accepts %s', (id) => expect(validModelId(id)).toBe(true));
  it.each(['onlyletters', 'has space', 'x!y', '   '])('rejects %s', (id) => expect(validModelId(id)).toBe(false));
});

describe('dictionary text', () => {
  it('parses an object', () => expect(parseDict('{"a":1}')).toEqual({ value: { a: 1 } }));
  it.each(['[1]', 'null', '1', '"s"'])('%s is not an object', (v) => expect(parseDict(v).error).toBe('notObject'));
  it('reports a syntax error', () => expect(parseDict('{bad').error).toBe('syntax'));
  it('add form blocks the first bad dict', () => {
    const fields = [{ prop: 'p', type: 'json-textarea' }];
    expect(parseDictFields(fields, { p: '[1]' })).toEqual({ error: 'notObject', field: 'p' });
  });
});

describe('add payload', () => {
  it('stamps the provider into configJson and flags as 1/0', () => {
    const p = addPayload({ supplier: 'edge', isEnabled: true, isDefault: false, sort: 0 }, { voice: 'x' });
    expect(p).toMatchObject({ provideCode: 'edge', isEnabled: 1, isDefault: 0, sort: 1, configJson: { voice: 'x', type: 'edge' } });
  });
});

describe('edit and duplicate', () => {
  it('fills missing fields and stringifies plain values', () => {
    const { configJson } = openModelConfig({ configJson: { n: 3 } }, [{ prop: 'n', type: 'text' }, { prop: 'm', type: 'text' }]);
    expect(configJson).toEqual({ n: '3', m: '' });
  });
  it('duplicate suffixes name and code and hides stored secrets', () => {
    const c = duplicateOf({ configJson: { api_key: 'sk-****', url: 'u' } }, { modelName: 'A', modelCode: 'b' }, '_copy');
    expect(c.modelName).toBe('A_copy');
    expect(c.modelCode).toBe('b_copy');
    expect(c.configJson).toEqual({ api_key: 'Your API Key', url: 'u' });
  });
});

describe('provider editor', () => {
  it('needs category, code and name', () => {
    expect(providerProblem({ modelType: '', providerCode: 'a', name: 'b' })).toBe('category');
    expect(providerProblem({ modelType: 'TTS', providerCode: ' ', name: 'b' })).toBe('code');
    expect(providerProblem({ modelType: 'TTS', providerCode: 'a', name: '' })).toBe('name');
    expect(providerProblem({ modelType: 'TTS', providerCode: 'a', name: 'b' })).toBe('');
  });
  it('a field row needs key, label and type', () => {
    expect(incompleteField([{ key: 'a', label: '', type: 'string' }])).toBe(true);
    expect(incompleteField([{ key: 'a', label: 'A', type: 'string' }])).toBe(false);
  });
  it('stores fields without the editor flags', () => {
    expect(cleanFields([{ key: 'a', label: 'A', type: 'string', default: '', selected: true, editing: false }]))
      .toEqual([{ key: 'a', label: 'A', type: 'string', default: '' }]);
  });
});
