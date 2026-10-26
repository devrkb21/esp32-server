// Robot-to-robot messages (Messages page part, owner HOME): pure helpers, tested in tests/home.test.mjs.
// Robots of the same owner may always message each other; robots of two owners need a contact
// one owner asks for and the other accepts.
import { aliasesFromText } from './homeModel';

export const MAX_NAME = 32;
export const MAX_TEXT = 300;

/** Contacts grouped for the page: accepted, asked of me (incoming), asked by me (outgoing). */
export function groupContacts(list) {
  const out = { accepted: [], incoming: [], outgoing: [], declined: [] };
  for (const c of Array.isArray(list) ? list : []) {
    if (c.status === 'accepted') out.accepted.push(c);
    else if (c.status === 'pending' && c.direction === 'in') out.incoming.push(c);
    else if (c.status === 'pending') out.outgoing.push(c);
    else if (c.status === 'declined' && c.direction === 'out') out.declined.push(c);
  }
  return out;
}

function nameProblem(name) {
  const s = String(name || '').trim();
  if (!s) return 'rmsg.err.nameRequired';
  if (s.length > MAX_NAME) return 'rmsg.err.nameLong';
  return '';
}

function aliasProblem(text) {
  const list = aliasesFromText(text);
  if (list.length > 10) return 'rmsg.err.aliasCount';
  if (list.some((a) => a.length > MAX_NAME)) return 'rmsg.err.aliasLong';
  return '';
}

/** Ask another account: { deviceId, username, name, aliasText } -> problems (i18n keys). */
export function requestProblems(f) {
  const out = {};
  if (!f.deviceId) out.deviceId = 'rmsg.err.robot';
  if (!String(f.username || '').trim()) out.username = 'rmsg.err.username';
  const n = nameProblem(f.name);
  if (n) out.name = n;
  const a = aliasProblem(f.aliasText);
  if (a) out.aliasText = a;
  return out;
}

export function requestBody(f) {
  return { deviceId: f.deviceId, username: String(f.username || '').trim(), name: String(f.name || '').trim(), aliases: aliasesFromText(f.aliasText) };
}

/** Accept (or rename my side): { deviceId?, name, aliasText }. */
export function acceptProblems(f, needRobot = true) {
  const out = {};
  if (needRobot && !f.deviceId) out.deviceId = 'rmsg.err.robot';
  const n = nameProblem(f.name);
  if (n) out.name = n;
  const a = aliasProblem(f.aliasText);
  if (a) out.aliasText = a;
  return out;
}

export function acceptBody(f) {
  const body = { name: String(f.name || '').trim(), aliases: aliasesFromText(f.aliasText) };
  if (f.deviceId) body.deviceId = f.deviceId;
  return body;
}

/** Composer problems: a target and 1-300 characters of text. */
export function sendProblems(f) {
  const out = {};
  if (!f.target) out.target = 'rmsg.err.target';
  const t = String(f.text || '').trim();
  if (!t) out.text = 'rmsg.err.text';
  else if (t.length > MAX_TEXT) out.text = 'rmsg.err.textLong';
  return out;
}

/** The i18n key of a send result. */
export function sendResultKey(r) {
  if (r && r.ok) return r.later ? 'rmsg.send.later' : 'rmsg.send.sent';
  const code = r && r.code;
  const known = ['not_found', 'not_supported', 'too_long', 'empty', 'unreachable', 'not_registered'];
  return `rmsg.send.err.${known.includes(code) ? code : 'unreachable'}`;
}

/** The i18n key for a refused request (the server's message starts with a code). */
export function requestErrorKey(err) {
  const msg = (err && err.data && err.data.msg) || '';
  const code = (msg.match(/^([a-z_]+):/) || [])[1];
  if (['user_not_found', 'own_account', 'exists'].includes(code)) return `rmsg.err.${code}`;
  return '';
}

/** Targets as select options: own robots first, then contacts, by name. */
export function targetOptions(targets) {
  const list = Array.isArray(targets) ? targets.slice() : [];
  list.sort((a, b) => (a.kind === b.kind ? String(a.name).localeCompare(String(b.name)) : a.kind === 'own' ? -1 : 1));
  return list.map((t) => ({ value: t.key, label: t.name, kind: t.kind }));
}
