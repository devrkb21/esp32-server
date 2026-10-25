import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';

vi.mock('@/apis/api', () => ({
  default: { admin: { getParamsList: vi.fn(), addParam: vi.fn(), updateParam: vi.fn() } },
}));

import Api from '@/apis/api';
import kit from '@/kit';
import pages from '@/i18n/pages/sms.js';
import shell from '@/i18n/pages/shell.js';
import { NAV } from '@/shell/nav.js';
import { routes } from '@/router/index.js';
import SmsSettings from '@/views/system/SmsSettings.vue';
import { changedFields, previewText, readState, smsParts } from '@/views/system/smsModel.js';

const API_KEY = 'real-api-key-XYZ-123';
const SECRET = 'real-secret-ABC-987';
const BN_TEXT = 'আপনার নোবিক্স যাচাই কোড {code}। কোডটি কাউকে জানাবেন না।';

const ok = (data) => ({ data: { code: 0, msg: 'ok', data } });
const err = (msg) => ({ data: { code: 10000, msg, data: null } });

function fullRows() {
  return [
    { id: 620, paramCode: 'reve.sms.base_url', paramValue: 'https://smpp.revesms.com:7790', valueType: 'string', remark: 'REVE SMS gateway address' },
    { id: 621, paramCode: 'reve.sms.api_key', paramValue: API_KEY, valueType: 'string', remark: 'REVE SMS API key' },
    { id: 622, paramCode: 'reve.sms.secret_key', paramValue: SECRET, valueType: 'string', remark: 'REVE SMS secret key' },
    { id: 623, paramCode: 'reve.sms.caller_id', paramValue: 'TINYBOT', valueType: 'string', remark: 'sender' },
    { id: 624, paramCode: 'reve.sms.code_message', paramValue: BN_TEXT, valueType: 'string', remark: 'text' },
    { id: 112, paramCode: 'server.sms_max_send_count', paramValue: '10', valueType: 'number', remark: 'max' },
    { id: 111, paramCode: 'server.enable_mobile_register', paramValue: 'false', valueType: 'boolean', remark: 'reg' },
    { id: 1, paramCode: 'log.log_level', paramValue: 'INFO', valueType: 'string', remark: '' },
  ];
}

let rows;
let calls;

function setup() {
  const i18n = createI18n({ legacy: true, locale: 'en', fallbackLocale: 'en', messages: { en: { ...shell.en, ...pages.en } } });
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const w = mount(SmsSettings, {
    attachTo: document.body,
    global: { plugins: [i18n, kit], mocks: { $message: message }, stubs: { teleport: true, RouterLink: true } },
  });
  return { w, message };
}
const input = (w, id) => w.find(`#${id}`);
async function submit(w) { await w.find('form').trigger('submit'); await flushPromises(); }

beforeEach(() => {
  vi.clearAllMocks();
  rows = fullRows();
  calls = [];
  Api.admin.getParamsList.mockImplementation((q, cb) => cb(ok({ total: rows.length, list: rows.map((r) => ({ ...r })) })));
  const store = (kind) => (body, cb) => {
    calls.push({ kind, ...body });
    if (kind === 'add') rows.push({ ...body, id: 900 + calls.length });
    else Object.assign(rows.find((r) => r.id === body.id) || {}, body);
    cb(ok(null));
  };
  Api.admin.addParam.mockImplementation(store('add'));
  Api.admin.updateParam.mockImplementation(store('update'));
});

describe('sms strings', () => {
  it('has every key in both Bangla and English, Bangla first, without the em dash', () => {
    expect(Object.keys(pages)[0]).toBe('bn');
    expect(Object.keys(pages.bn).sort()).toEqual(Object.keys(pages.en).sort());
    for (const v of [...Object.values(pages.bn), ...Object.values(pages.en)]) {
      expect(v).not.toMatch(/—/);
      expect(v.trim()).not.toBe('');
    }
    expect(pages.bn['nav.sms']).toBe('এসএমএস গেটওয়ে');
    expect(pages.en['nav.sms']).toBe('SMS gateway');
  });

  it('is in the back-office nav and an admin route', () => {
    const office = NAV.find((g) => g.group === 'nav.group.backoffice');
    expect(office.admin).toBe(true);
    expect(office.items.find((i) => i.to === '/sms-settings')).toMatchObject({ label: 'nav.sms', icon: 'send' });
    expect(routes.find((r) => r.path === '/sms-settings').meta).toMatchObject({ admin: true, title: 'nav.sms' });
  });
});

describe('sms part counting', () => {
  it('counts Latin text against 160, then 153 per part', () => {
    expect(smsParts('')).toMatchObject({ parts: 0, length: 0 });
    expect(smsParts('a'.repeat(160))).toMatchObject({ encoding: 'gsm', length: 160, parts: 1, left: 0 });
    expect(smsParts('a'.repeat(161))).toMatchObject({ encoding: 'gsm', parts: 2, perPart: 153 });
    expect(smsParts('a'.repeat(306))).toMatchObject({ parts: 2, left: 0 });
    expect(smsParts('a'.repeat(307))).toMatchObject({ parts: 3 });
    expect(smsParts('{}')).toMatchObject({ encoding: 'gsm', length: 4 }); // extension characters take two
  });

  it('counts Bangla as Unicode against 70, then 67 per part', () => {
    const bn = 'ক'.repeat(70);
    expect(smsParts(bn)).toMatchObject({ encoding: 'unicode', length: 70, parts: 1 });
    expect(smsParts(`${bn}ক`)).toMatchObject({ encoding: 'unicode', parts: 2, perPart: 67 });
    expect(smsParts('ক'.repeat(134))).toMatchObject({ parts: 2, left: 0 });
    expect(smsParts('ক'.repeat(135))).toMatchObject({ parts: 3 });
    expect(smsParts('Code 123 ক')).toMatchObject({ encoding: 'unicode', length: 10 });
  });

  it('previews with the sample code', () => {
    expect(previewText('Code {code}.', '111222')).toBe('Code 111222.');
    const t = previewText(BN_TEXT);
    expect(t).toContain('482913');
    expect(t).not.toContain('{code}');
  });
});

describe('SmsSettings', () => {
  it('loads the params once and fills the form', async () => {
    const { w } = setup();
    await flushPromises();
    expect(Api.admin.getParamsList).toHaveBeenCalledTimes(1);
    expect(Api.admin.getParamsList).toHaveBeenCalledWith({ page: 1, limit: 500, paramCode: '' }, expect.any(Function));
    expect(input(w, 'sms-base-url').element.value).toBe('https://smpp.revesms.com:7790');
    expect(input(w, 'sms-caller-id').element.value).toBe('TINYBOT');
    expect(input(w, 'sms-max-count').element.value).toBe('10');
    expect(w.text()).toContain('REVE SMS');
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false');
    // the live preview and its count: Bangla, one Unicode SMS
    expect(w.find('.sms__bubble').text()).toContain('482913');
    expect(w.find('[data-test="sms-enc"]').text()).toContain('Unicode');
    expect(w.findAll('.sms__count dt').map((d) => d.text())).toEqual([String(previewText(BN_TEXT).length), '1']);
    w.unmount();
  });

  it('never renders a saved secret, only a mask and the saved state', async () => {
    const { w } = setup();
    await flushPromises();
    const html = document.body.innerHTML;
    expect(html).not.toContain(API_KEY);
    expect(html).not.toContain(SECRET);
    for (const id of ['sms-apiKey', 'sms-secretKey']) {
      const el = input(w, id);
      expect(el.attributes('type')).toBe('password');
      expect(el.element.value).toBe('');
      expect(el.attributes('placeholder')).toBe('••••••');
    }
    expect(w.findAll('[data-saved]').map((s) => s.text())).toEqual(['Saved', 'Saved']);
    // nor is it kept in the component state
    expect(JSON.stringify(w.vm.$data)).not.toContain(API_KEY);
    expect(JSON.stringify(w.vm.$data)).not.toContain(SECRET);
    w.unmount();
  });

  it('sends only what changed, a secret only when typed', async () => {
    const { w, message } = setup();
    await flushPromises();
    await submit(w);
    expect(calls).toEqual([]);
    expect(message.info).toHaveBeenCalled();

    await input(w, 'sms-caller-id').setValue('NOBIX');
    await input(w, 'sms-apiKey').setValue('new-key-1');
    await submit(w);
    expect(calls).toEqual([
      { kind: 'update', id: 623, paramCode: 'reve.sms.caller_id', paramValue: 'NOBIX', valueType: 'string', remark: 'sender' },
      { kind: 'update', id: 621, paramCode: 'reve.sms.api_key', paramValue: 'new-key-1', valueType: 'string', remark: 'REVE SMS API key' },
    ]);
    expect(message.success).toHaveBeenCalled();
    // the typed key leaves the form; the saved state stays
    expect(input(w, 'sms-apiKey').element.value).toBe('');
    expect(w.findAll('[data-saved]').length).toBe(2);
    expect(Api.admin.getParamsList).toHaveBeenCalledTimes(1);
    w.unmount();
  });

  it('adds a missing param with the params payload shape', async () => {
    rows = fullRows().filter((r) => r.paramCode !== 'reve.sms.caller_id' && r.paramCode !== 'reve.sms.secret_key');
    const { w } = setup();
    await flushPromises();
    expect(input(w, 'sms-secretKey').attributes('placeholder')).toBe('Not set yet');
    await input(w, 'sms-caller-id').setValue('TINYBOT');
    await submit(w);
    expect(calls).toEqual([
      { kind: 'add', paramCode: 'reve.sms.caller_id', paramValue: 'TINYBOT', valueType: 'string', remark: 'REVE SMS sender ID (callerID)' },
    ]);
    w.unmount();
  });

  it('checks the fields before sending', async () => {
    const { w, message } = setup();
    await flushPromises();
    await input(w, 'sms-code-message').setValue('Your code');
    await input(w, 'sms-base-url').setValue('smpp.revesms.com');
    await input(w, 'sms-max-count').setValue('0');
    await submit(w);
    expect(calls).toEqual([]);
    expect(message.error).toHaveBeenCalledWith('Fix the marked fields');
    expect(w.text()).toContain('Keep {code} in the text');
    expect(w.text()).toContain('The address starts with http:// or https://');
    expect(w.text()).toContain('Enter a whole number, 1 or more');
    w.unmount();
  });

  it('saves the mobile sign-up switch last, after the other fields', async () => {
    const { w } = setup();
    await flushPromises();
    await w.find('[role="switch"]').trigger('click');
    await input(w, 'sms-max-count').setValue('5');
    await input(w, 'sms-secretKey').setValue('s3');
    await submit(w);
    expect(calls.map((c) => c.paramCode)).toEqual(['reve.sms.secret_key', 'server.sms_max_send_count', 'server.enable_mobile_register']);
    expect(calls[2]).toMatchObject({ kind: 'update', id: 111, paramValue: 'true', valueType: 'boolean' });
    w.unmount();
  });

  it('does not save the switch when a field fails, and shows the server message under it', async () => {
    Api.admin.updateParam.mockImplementation((body, cb, fail) => {
      calls.push(body);
      if (body.paramCode === 'reve.sms.caller_id') fail(err('Sender ID rejected'));
      else cb(ok(null));
    });
    const { w, message } = setup();
    await flushPromises();
    await input(w, 'sms-caller-id').setValue('X');
    await w.find('[role="switch"]').trigger('click');
    await submit(w);
    expect(calls.map((c) => c.paramCode)).toEqual(['reve.sms.caller_id']);
    expect(message.error).toHaveBeenCalledWith('Sender ID rejected');
    expect(w.text()).toContain('Sender ID rejected');
    expect(w.find('.tb-sync').text()).toBe('Could not save');
    w.unmount();
  });

  it('shows the server refusal of mobile sign-up under the switch and turns it back off', async () => {
    Api.admin.updateParam.mockImplementation((body, cb, fail) => {
      calls.push(body);
      fail(err('reve.sms.api_key,reve.sms.caller_idThese parameters cannot be empty'));
    });
    const { w, message } = setup();
    await flushPromises();
    await w.find('[role="switch"]').trigger('click');
    await submit(w);
    const msg = 'reve.sms.api_key,reve.sms.caller_idThese parameters cannot be empty';
    expect(message.error).toHaveBeenCalledWith(msg);
    expect(w.find('[data-test="register-error"]').text()).toBe(msg);
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false');
    w.unmount();
  });

  it('adds a missing switch off first, then turns it on through an update', async () => {
    rows = fullRows().filter((r) => r.paramCode !== 'server.enable_mobile_register');
    const { w } = setup();
    await flushPromises();
    await w.find('[role="switch"]').trigger('click');
    await submit(w);
    expect(calls.map((c) => [c.kind, c.paramCode, c.paramValue])).toEqual([
      ['add', 'server.enable_mobile_register', 'false'],
      ['update', 'server.enable_mobile_register', 'true'],
    ]);
    w.unmount();
  });
});

describe('sms state helpers', () => {
  it('treats a missing param with a default as a change to add', () => {
    const s = readState([]);
    expect(s.form.baseUrl).toBe('https://smpp.revesms.com:7790');
    expect(changedFields(s.form, s.baseline)).toEqual(['baseUrl', 'codeMessage']);
    expect(s.params.apiKey.saved).toBe(false);
  });
});
