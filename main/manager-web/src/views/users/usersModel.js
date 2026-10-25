// Pure helpers of the Users page (owner: web-users). No Vue, no API: tested in tests/usersModel.test.mjs.
import { digits } from '@/kit/calendar';

/** "2026-03-14 10:22:05" (the API's date-format), an ISO string or a timestamp → Date, or null. */
export function parseCreated(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return new Date(value);
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The registration date as { date, time } in the page language (Bangla digits in Bangla). */
export function createdText(value, lang) {
  const d = parseCreated(value);
  if (!d) return { date: '', time: '' };
  const locale = lang === 'bn' ? 'bn-BD' : 'en-GB';
  let date;
  try {
    date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  } catch (e) {
    date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { date: digits(date, lang), time: digits(time, lang) };
}

/** The legacy guard before a status change: every id must be numeric. */
export function hasInvalidId(ids) {
  return ids.some((id) => id === null || id === undefined || id === '' || Number.isNaN(Number(id)));
}

/** After removing `removed` rows, the page to show so the list is never an empty page past the end. */
export function pageAfterDelete(page, pageSize, total, removed = 1) {
  const maxPage = Math.max(1, Math.ceil(Math.max(0, total - removed) / pageSize));
  return Math.min(page, maxPage);
}

/** How a batch of deletions ended: 'all' | 'none' | 'some'. */
export function batchOutcome(results) {
  const ok = results.filter((r) => r.success).length;
  const fail = results.length - ok;
  return { ok, fail, kind: fail === 0 ? 'all' : ok === 0 ? 'none' : 'some' };
}

/**
 * Calls a callback-style API and resolves with its response, or with null after `ms` (the API layer
 * never calls back on a server error, it shows its own notice; a batch must still finish).
 */
export function callWithTimeout(call, ms = 20000) {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; resolve(null); } }, ms);
    call((res) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(res);
    });
  });
}

export const isSuperAdmin = (row) => row?.superAdmin === 1 || row?.superAdmin === true;
export const isActive = (row) => Number(row?.status) === 1;
