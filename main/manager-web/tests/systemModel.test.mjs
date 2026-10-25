import { describe, expect, it } from 'vitest';
import {
  buildSections, collectAll, defaultOpen, filterParams, getSubGroup, getTopGroup, isSensitive, maskValue,
  pageAfterDelete, shortValue, subCounts, toEditValue, toSubmitValue, topCounts,
} from '../src/views/system/systemModel.js';

const list = [
  { paramCode: 'server.secret', remark: 'shared secret' },
  { paramCode: 'server.auth.enabled', remark: '' },
  { paramCode: 'server.tracing.rate', remark: '' },
  { paramCode: 'plugins.get_weather.api_key', remark: 'weather' },
  { paramCode: 'log.log_level', remark: '' },
  { paramCode: 'session_state.ttl', remark: '' },
  { paramCode: 'enable_greeting', remark: 'greet' },
];

describe('param grouping (legacy namespaces)', () => {
  it('reads the namespace and sub-namespace of a code', () => {
    expect(getTopGroup('server.secret')).toBe('server');
    expect(getTopGroup('wakeup_words')).toBe('general');
    expect(getSubGroup('server.secret')).toBe('_root');
    expect(getSubGroup('server.auth.enabled')).toBe('auth');
    expect(getSubGroup('plugins.get_weather.api_key')).toBe('get_weather');
    expect(getSubGroup('log.log_level')).toBe('_all');
  });

  it('counts namespaces among the searched rows and drops empty ones', () => {
    expect(topCounts(list, '')).toEqual([
      { key: 'all', count: 7 }, { key: 'server', count: 3 }, { key: 'plugins', count: 1 },
      { key: 'log', count: 1 }, { key: 'session_state', count: 1 }, { key: 'general', count: 1 },
    ]);
    expect(topCounts(list, 'weather')).toEqual([{ key: 'all', count: 1 }, { key: 'plugins', count: 1 }]);
  });

  it('lists sub-namespaces in the server order', () => {
    expect(subCounts(list, 'server', '').map((s) => s.key)).toEqual(['all', '_root', 'auth', 'tracing']);
    expect(subCounts(list, 'log', '')).toEqual([]);
    expect(subCounts(list, 'all', '')).toEqual([]);
  });

  it('filters by namespace, sub-namespace and code or remark', () => {
    expect(filterParams(list, { top: 'server', sub: 'auth' }).map((p) => p.paramCode)).toEqual(['server.auth.enabled']);
    expect(filterParams(list, { keyword: 'GREET' }).map((p) => p.paramCode)).toEqual(['enable_greeting']);
  });

  it('builds sections in namespace order and opens the first ones', () => {
    const keys = buildSections(list).map((s) => s.key);
    expect(keys).toEqual(['server._root', 'server.auth', 'server.tracing', 'plugins.get_weather', 'log._all', 'session_state._all', 'general._all']);
    expect(defaultOpen(keys)).toEqual(keys.slice(0, 3));
    expect(defaultOpen(keys.slice(0, 4))).toEqual(keys.slice(0, 4));
    expect(defaultOpen(keys, ['log._all', 'gone'])).toEqual(['log._all']);
  });
});

describe('sensitive values', () => {
  it('knows the legacy sensitive keys and masks like the legacy page', () => {
    expect(isSensitive('plugins.home_assistant.access_token')).toBe(true);
    expect(isSensitive('server.mqtt_signature_key')).toBe(true);
    expect(isSensitive('log.log_level')).toBe(false);
    expect(maskValue('abcdef')).toBe('ab****ef');
    expect(maskValue('abc')).toBe('****');
    expect(maskValue(null)).toBe('****');
  });

  it('shortens long values to 120 characters', () => {
    expect(shortValue('x'.repeat(130))).toBe(`${'x'.repeat(120)}…`);
    expect(shortValue(null)).toBe('');
  });
});

describe('value formats (legacy ParamDialog)', () => {
  it('shows arrays one per line and JSON pretty-printed', () => {
    expect(toEditValue('a;b;c', 'array')).toBe('a;\nb;\nc');
    expect(toEditValue('{"a":1}', 'json')).toBe('{\n  "a": 1\n}');
    expect(toEditValue('not json', 'json')).toBe('not json');
  });

  it('checks the array format and joins it with semicolons', () => {
    expect(toSubmitValue('a;\nb;\nc', 'array')).toEqual({ value: 'a;b;c' });
    expect(toSubmitValue('a\nb', 'array')).toEqual({ error: 'array' });
    expect(toSubmitValue('{\n "a": 1\n}', 'json')).toEqual({ value: '{"a":1}' });
    expect(toSubmitValue('{oops', 'json')).toEqual({ value: '{oops' });
    expect(toSubmitValue('42', 'number')).toEqual({ value: '42' });
  });
});

describe('collectAll', () => {
  it('fetches every page until the total is reached', async () => {
    const pages = { 1: { total: 3, list: [1, 2] }, 2: { total: 3, list: [3] } };
    const seen = [];
    const all = await collectAll(async (p) => { seen.push(p); return pages[p]; });
    expect(all).toEqual([1, 2, 3]);
    expect(seen).toEqual([1, 2]);
  });

  it('stops on an empty page', async () => {
    const all = await collectAll(async () => ({ total: 10, list: [] }));
    expect(all).toEqual([]);
  });
});

describe('pageAfterDelete', () => {
  it('steps back when the last page empties', () => {
    expect(pageAfterDelete(3, 10, 21, 1)).toBe(2);
    expect(pageAfterDelete(2, 10, 30, 1)).toBe(2);
    expect(pageAfterDelete(1, 10, 1, 1)).toBe(1);
  });
});
