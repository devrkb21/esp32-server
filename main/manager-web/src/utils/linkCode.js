// Linking a robot to the account: the 6-digit code it shows (or the QR link that carries it),
// the safe "come back here after sign-in" redirect, and what to do with the user's characters.
// Pure helpers, unit tested in tests/link.test.mjs.

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/** Bangla (০-৯) and full-width (０-９) digits as ASCII digits; everything else unchanged. */
export function asciiDigits(text) {
  return String(text ?? '')
    .replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
    .replace(/[０-９]/g, (d) => String(d.charCodeAt(0) - 0xff10));
}

// Looks like a link rather than a typed code: a scheme, a "www." host or a hash route.
const URL_LIKE = /^(?:[a-z][a-z0-9+.-]*:\/\/|www\.)|\/#\/|^#?\/link\b/i;

/**
 * The code as far as it is typed (0 to 6 digits) from whatever was typed or pasted: digits with
 * spaces or dashes, Bangla digits, or the robot's full link (`.../#/link?code=123456`). A link
 * without a code gives ''.
 */
export function codeFromText(text) {
  const s = asciiDigits(text).trim();
  const param = s.match(/[?&#]code=([\d\s-]+)/i);
  if (param) return param[1].replace(/\D/g, '').slice(0, 6);
  if (URL_LIKE.test(s)) return '';
  return s.replace(/\D/g, '').slice(0, 6);
}

/** The complete 6-digit code in the text, or '' when there is none. */
export function linkCodeOf(text) {
  const code = codeFromText(text);
  return /^\d{6}$/.test(code) ? code : '';
}

/** The app's own link page for a code (a hash path, for the router or a redirect query). */
export function linkPath(code) {
  return code ? `/link?code=${code}` : '/link';
}

const AUTH_PAGES = /^\/(?:login|register|retrieve-password)(?:[/?#]|$)/i;

/**
 * Where to go after signing in, from a `?redirect=` query: only a path inside this app ("/link?code=1",
 * "#/today"), never another site ("//evil.example", "https://...", "/\\evil"), never a sign-in page
 * (that would loop). Returns `fallback` when the value is not safe.
 */
export function safeRedirect(raw, fallback = '') {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return fallback;
  let s = value.trim();
  if (s.startsWith('#')) s = s.slice(1);
  if (!s.startsWith('/') || s.startsWith('//')) return fallback;
  if (s.length > 512 || /[\\\s\u0000-\u001f\u007f]/.test(s)) return fallback;
  if (/^\/[^?#]*:/.test(s)) return fallback; // "/javascript:..." style paths
  if (AUTH_PAGES.test(s)) return fallback;
  return s;
}

/** The query to carry a redirect between the sign-in pages ({} when there is none). */
export function redirectQuery(raw) {
  const r = safeRedirect(raw);
  return r ? { redirect: r } : {};
}

/**
 * With 0 or 1 characters the robot is linked right away (the server uses the only one, or makes
 * a first one); with more, the owner picks which character the robot should be.
 */
export function linkPlan(agentCount) {
  return Number(agentCount) > 1 ? 'choose' : 'auto';
}

/** What went wrong, from the server's error code (see ErrorCode.java). */
export function linkErrorKind(code) {
  switch (Number(code)) {
    case 10212: return 'format';
    case 10213: case 10061: case 10062: return 'expired';
    case 10063: return 'taken';
    case 10214: return 'choose';
    case 10169: return 'denied';
    case 401: return 'auth';
    default: return 'failed';
  }
}
