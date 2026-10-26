// Smart home page: pure helpers (no Vue), unit tested in tests/home.test.mjs.
// The integration view never carries a secret: only tokenSaved / passwordSaved. A secret is sent
// only when the owner typed a new one, exactly like the SMS gateway page.

export const DOMAINS = ['light', 'switch', 'fan', 'climate', 'cover'];
export const MAX_ALIASES = 10;
export const MAX_ALIAS = 40;
export const SECRET_MASK = '••••••';

const blank = (v) => v == null || String(v).trim() === '';

/** The form state from GET /home/integration (secrets always empty on the form). */
export function readIntegration(view) {
  const ha = (view && view.ha) || {};
  const mqtt = (view && view.mqtt) || {};
  return {
    form: {
      haBaseUrl: ha.baseUrl || '',
      haToken: '',
      mqttHost: mqtt.host || '',
      mqttPort: mqtt.port ? String(mqtt.port) : '1883',
      mqttUsername: mqtt.username || '',
      mqttPassword: '',
      mqttTls: !!mqtt.tls,
    },
    saved: { token: !!ha.tokenSaved, password: !!mqtt.passwordSaved },
    deviceCount: Number((view && view.deviceCount) || 0),
  };
}

/** Problems (i18n keys) of one part of the form: 'ha' or 'mqtt'. */
export function integrationProblems(form, part, saved = {}) {
  const out = {};
  if (part === 'ha') {
    const url = String(form.haBaseUrl || '').trim();
    if (!url) out.haBaseUrl = 'home.err.urlRequired';
    else if (!/^https?:\/\/[^\s/?#]+/i.test(url)) out.haBaseUrl = 'home.err.url';
    if (blank(form.haToken) && !saved.token) out.haToken = 'home.err.tokenRequired';
    else if (!blank(form.haToken) && /\s/.test(String(form.haToken).trim())) out.haToken = 'home.err.token';
  } else {
    const host = String(form.mqttHost || '').trim();
    if (!host) out.mqttHost = 'home.err.hostRequired';
    else if (!/^[A-Za-z0-9._:[\]-]+$/.test(host)) out.mqttHost = 'home.err.host';
    const port = Number(form.mqttPort);
    if (!/^\d+$/.test(String(form.mqttPort || '').trim()) || port < 1 || port > 65535) out.mqttPort = 'home.err.port';
  }
  return out;
}

/** The body of PUT /home/integration for one part; a secret only when one was typed. */
export function integrationBody(form, part) {
  if (part === 'ha') {
    const body = { haBaseUrl: String(form.haBaseUrl || '').trim() };
    if (!blank(form.haToken)) body.haToken = String(form.haToken).trim();
    return body;
  }
  const body = {
    mqttHost: String(form.mqttHost || '').trim(),
    mqttPort: Number(form.mqttPort),
    mqttUsername: String(form.mqttUsername || '').trim(),
    mqttTls: !!form.mqttTls,
  };
  if (!blank(form.mqttPassword)) body.mqttPassword = form.mqttPassword;
  return body;
}

/** The server refuses to send a saved token to a new address: is that what this error says? */
export function needsSecretAgain(err) {
  const msg = (err && err.data && err.data.msg) || (err && err.message) || '';
  if (/^token_required/.test(msg)) return 'haToken';
  if (/^password_required/.test(msg)) return 'mqttPassword';
  return '';
}

/** "বাতি, বসার ঘরের লাইট\nliving room" -> ['বাতি', 'বসার ঘরের লাইট', 'living room'] (unique, trimmed). */
export function aliasesFromText(text) {
  const seen = new Set();
  const out = [];
  for (const part of String(text || '').split(/[,\n،;।]+/)) {
    const s = part.trim().replace(/\s+/g, ' ');
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

export function aliasesToText(list) {
  return (list || []).join(', ');
}

/** Problems of a device edit (i18n keys). `mqtt`: the MQTT fields are checked too. */
export function deviceProblems(d, mqtt) {
  const out = {};
  const name = String(d.name || '').trim();
  if (!name) out.name = 'home.err.nameRequired';
  else if (name.length > 100) out.name = 'home.err.nameLong';
  const aliases = aliasesFromText(d.aliasText);
  if (aliases.length > MAX_ALIASES) out.aliasText = 'home.err.aliasCount';
  else if (aliases.some((a) => a.length > MAX_ALIAS)) out.aliasText = 'home.err.aliasLong';
  if (mqtt) {
    const topic = String(d.topic || '').trim();
    if (!topic) out.topic = 'home.err.topicRequired';
    else if (/[#+]/.test(topic)) out.topic = 'home.err.topicWildcard';
    if (!DOMAINS.includes(d.domain)) out.domain = 'home.err.domain';
  }
  return out;
}

/** The body of POST /home/devices or PUT /home/devices/{id}. */
export function deviceBody(d, mqtt) {
  const body = { name: String(d.name || '').trim(), aliases: aliasesFromText(d.aliasText), enabled: d.enabled !== false };
  if (mqtt) {
    body.domain = d.domain;
    body.topic = String(d.topic || '').trim();
    body.payloadOn = String(d.payloadOn || '').trim() || 'ON';
    body.payloadOff = String(d.payloadOff || '').trim() || 'OFF';
  }
  return body;
}

/** A device row as the edit sheet holds it. */
export function editState(device) {
  const d = device || {};
  return {
    id: d.id || null,
    source: d.source || 'mqtt',
    domain: d.domain || 'switch',
    name: d.name || '',
    aliasText: aliasesToText(d.aliases),
    enabled: d.enabled !== false,
    topic: d.topic || '',
    payloadOn: d.payloadOn || 'ON',
    payloadOff: d.payloadOff || 'OFF',
    entityId: d.entityId || '',
  };
}

/** The two test buttons of a device: covers open and close, everything else turns on and off. */
export function testActions(domain) {
  if (domain === 'cover') return [{ action: 'open', label: 'home.act.open' }, { action: 'close', label: 'home.act.close' }];
  return [{ action: 'on', label: 'home.act.on' }, { action: 'off', label: 'home.act.off' }];
}

/** The i18n key of a test / action result code. */
export function resultKey(code) {
  const known = ['ok', 'not_configured', 'unreachable', 'unauthorized', 'bad_url', 'not_found', 'unsupported', 'bad_value', 'error'];
  return `home.result.${known.includes(code) ? code : 'error'}`;
}

/** Devices grouped for the list: enabled first in their order, then the ones off for voice. */
export function sortDevices(list) {
  const arr = Array.isArray(list) ? list.slice() : [];
  return arr.filter((d) => d.enabled !== false).concat(arr.filter((d) => d.enabled === false));
}

/** What the robot would say it controls, for the voice hint ("যেমন: বসার ঘরের বাতি"). */
export function sampleNames(list, n = 3) {
  return sortDevices(list).filter((d) => d.enabled !== false).slice(0, n)
    .map((d) => (d.aliases && d.aliases[0]) || d.name).filter(Boolean);
}
