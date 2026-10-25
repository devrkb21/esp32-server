// Pure helpers of the SMS gateway page (back office). The server sends verification SMS through
// REVE SMS (Bangladesh); its settings are system params, edited here through the params API.

export const SMS_PARAMS = {
  baseUrl: { code: 'reve.sms.base_url', valueType: 'string', remark: 'REVE SMS gateway address', fallback: 'https://smpp.revesms.com:7790' },
  apiKey: { code: 'reve.sms.api_key', valueType: 'string', remark: 'REVE SMS API key', secret: true },
  secretKey: { code: 'reve.sms.secret_key', valueType: 'string', remark: 'REVE SMS secret key', secret: true },
  callerId: { code: 'reve.sms.caller_id', valueType: 'string', remark: 'REVE SMS sender ID (callerID)' },
  codeMessage: {
    code: 'reve.sms.code_message', valueType: 'string', remark: 'Verification SMS text; {code} is the code',
    fallback: 'আপনার টাইনিবট যাচাই কোড {code}। কোডটি কাউকে জানাবেন না।',
  },
  maxCount: { code: 'server.sms_max_send_count', valueType: 'number', remark: 'Max daily SMS messages per phone number' },
};
// Saved last, after every other field: the server refuses to turn it on while the gateway is incomplete.
export const REGISTER_PARAM = { code: 'server.enable_mobile_register', valueType: 'boolean', remark: 'Whether to enable mobile phone registration' };

export const FIELD_ORDER = ['baseUrl', 'callerId', 'apiKey', 'secretKey', 'codeMessage', 'maxCount'];
export const SECRET_MASK = '••••••';
export const SAMPLE_CODE = '482913';

const blank = (v) => v == null || String(v).trim() === '';

/**
 * Reads the params list into the page state. Secret values are never kept: only whether one is
 * saved. `rows` is the list from admin/params/page.
 */
export function readState(rows) {
  const byCode = {};
  (rows || []).forEach((r) => { if (r && r.paramCode) byCode[r.paramCode] = r; });
  const params = {};
  const form = {};
  for (const [key, def] of Object.entries(SMS_PARAMS)) {
    const row = byCode[def.code];
    params[key] = row
      ? { id: row.id, exists: true, valueType: row.valueType || def.valueType, remark: row.remark || def.remark }
      : { id: null, exists: false, valueType: def.valueType, remark: def.remark };
    if (def.secret) {
      params[key].saved = !!row && !blank(row.paramValue) && String(row.paramValue).trim() !== 'null';
      form[key] = '';
    } else {
      const v = row ? row.paramValue : def.fallback;
      form[key] = v == null || String(v) === 'null' ? '' : String(v);
    }
  }
  const reg = byCode[REGISTER_PARAM.code];
  params.register = reg
    ? { id: reg.id, exists: true, valueType: reg.valueType || 'boolean', remark: reg.remark || REGISTER_PARAM.remark }
    : { id: null, exists: false, valueType: 'boolean', remark: REGISTER_PARAM.remark };
  form.register = !!reg && String(reg.paramValue).trim().toLowerCase() === 'true';
  // What is stored now (missing params count as empty, so a filled default gets added).
  const baseline = {};
  for (const [key, def] of Object.entries(SMS_PARAMS)) {
    if (def.secret) continue;
    baseline[key] = params[key].exists ? form[key] : '';
  }
  baseline.register = form.register;
  return { params, form, baseline };
}

/** Fields whose value has to be sent, in save order. Secrets only when a new one was typed. */
export function changedFields(form, baseline) {
  return FIELD_ORDER.filter((key) => {
    if (SMS_PARAMS[key].secret) return !blank(form[key]);
    return String(form[key] ?? '').trim() !== String(baseline[key] ?? '').trim();
  });
}

export function registerChanged(form, baseline) {
  return !!form.register !== !!baseline.register;
}

/** Field problems (i18n keys) for the fields about to be sent. */
export function fieldProblems(form, keys) {
  const out = {};
  for (const key of keys) {
    const v = String(form[key] ?? '').trim();
    if (!v) { out[key] = 'sms.err.required'; continue; }
    if (key === 'baseUrl' && !/^https?:\/\/[^\s/]+/i.test(v)) out[key] = 'sms.err.url';
    if (key === 'codeMessage' && !v.includes('{code}')) out[key] = 'sms.err.code';
    if (key === 'maxCount' && !(/^\d+$/.test(v) && Number(v) >= 1))out[key] = 'sms.err.count';
  }
  return out;
}

/** Whether the gateway has every value the server asks for before mobile sign-up can go on. */
export function gatewayReady(form, params) {
  const filled = (key) => (SMS_PARAMS[key].secret ? params[key].saved || !blank(form[key]) : !blank(form[key]));
  return ['baseUrl', 'apiKey', 'secretKey', 'callerId', 'maxCount'].every(filled);
}

/** The body of addParam / updateParam for one field. */
export function paramBody(key, value, params) {
  const def = key === 'register' ? REGISTER_PARAM : SMS_PARAMS[key];
  const p = params[key];
  const body = { paramCode: def.code, paramValue: String(value).trim(), valueType: p.valueType || def.valueType, remark: p.remark || def.remark };
  if (key === 'codeMessage') body.paramValue = String(value).replace(/\r\n/g, '\n').trim();
  if (p.exists) body.id = p.id;
  return body;
}

// GSM 03.38: the basic set counts one, the extension set two (escape + char).
const GSM_BASIC = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXT = '^{}\\[~]|€\f';

/**
 * How many SMS parts a text takes. Latin text that fits the GSM alphabet: 160 characters in one
 * SMS, 153 per part when longer. Anything else (Bangla) goes as Unicode: 70, then 67 per part.
 */
export function smsParts(text) {
  const s = String(text ?? '');
  let gsm = true;
  let gsmLen = 0;
  for (const ch of s) {
    if (GSM_BASIC.includes(ch)) gsmLen += 1;
    else if (GSM_EXT.includes(ch)) gsmLen += 2;
    else { gsm = false; break; }
  }
  const encoding = gsm ? 'gsm' : 'unicode';
  const length = gsm ? gsmLen : s.length; // Unicode counts UTF-16 units, as the network does
  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;
  const parts = length === 0 ? 0 : length <= single ? 1 : Math.ceil(length / multi);
  const perPart = parts > 1 ? multi : single;
  return { encoding, length, parts, perPart, single, multi, left: Math.max(0, Math.max(parts, 1) * perPart - length) };
}

/** The SMS as a person receives it, with a sample code. */
export function previewText(template, code = SAMPLE_CODE) {
  return String(template ?? '').replace(/\r\n/g, '\n').trim().split('{code}').join(code);
}

/** Wraps a callback-style admin call (data, ok, fail) into a promise of { ok, msg }. */
export function callParam(fn, body, ms = 15000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (!done) { done = true; clearTimeout(t); resolve(r); } };
    const t = setTimeout(() => finish({ ok: false, msg: '' }), ms);
    fn(body, (res) => {
      const data = res && res.data;
      finish(data && data.code === 0 ? { ok: true } : { ok: false, msg: (data && data.msg) || '' });
    }, (res) => {
      const data = res && res.data;
      finish({ ok: false, msg: (data && data.msg) || '' });
    });
  });
}
