// Usage and cost (back office): pure helpers of the page, unit tested in tests/ai.test.mjs.
import { digits } from '../../kit/calendar.js';

export const RANGES = [7, 30, 90];

const pad = (n) => String(n).padStart(2, '0');
export function ymd(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The last `days` days up to `today` (a Date or yyyy-MM-dd), both ends included. */
export function rangeFor(days, today = new Date()) {
  const end = typeof today === 'string' ? new Date(`${today}T12:00:00`) : new Date(today.getTime());
  const start = new Date(end.getTime());
  start.setDate(start.getDate() - (Math.max(1, Number(days) || 7) - 1));
  return { from: ymd(start), to: ymd(end) };
}

/** A whole number with thousands grouped, in Bangla digits in Bangla mode. */
export function count(n, lang) {
  const v = Math.round(Number(n) || 0);
  return digits(v.toLocaleString('en-US'), lang);
}

/** A big count shortened for the totals band: 12.4K, 3.1M (exact under ten thousand). */
export function compact(n, lang) {
  const v = Number(n) || 0;
  if (Math.abs(v) < 10000) return count(v, lang);
  const [div, unit] = Math.abs(v) >= 1e6 ? [1e6, 'M'] : [1e3, 'K'];
  const s = (v / div).toFixed(v / div >= 100 ? 0 : 1).replace(/\.0$/, '');
  return digits(s, lang) + unit;
}

/** ASR seconds as minutes with one decimal ("0" when none). */
export function minutes(seconds, lang) {
  const m = (Number(seconds) || 0) / 60;
  if (!m) return digits('0', lang);
  return digits(m < 10 ? m.toFixed(1).replace(/\.0$/, '') : Math.round(m).toLocaleString('en-US'), lang);
}

/** An estimated cost with its currency, or '' when no price is known (null). */
export function money(value, currency, lang) {
  if (value === null || value === undefined || value === '') return '';
  const v = Number(value) || 0;
  const s = v === 0 ? '0' : v < 0.01 ? v.toFixed(4) : v < 100 ? v.toFixed(2) : Math.round(v).toLocaleString('en-US');
  return `${digits(s, lang)} ${currency || ''}`.trim();
}

/** The largest value of `key` among rows (at least 1, for bar widths). */
export function maxOf(rows, key) {
  return Math.max(1, ...(rows || []).map((r) => Number(r && r[key]) || 0));
}

/** A bar width in percent of the largest value (a visible sliver for any non-zero value). */
export function barPct(value, max) {
  const v = Number(value) || 0;
  if (v <= 0) return 0;
  return Math.max(2, Math.round((v / Math.max(1, max)) * 100));
}

/** Did anything get used in the range? */
export function hasUsage(summary) {
  const t = (summary && summary.totals) || {};
  return ['llmRequests', 'tokens', 'asrSeconds', 'ttsChars', 'quotaBlocked'].some((k) => Number(t[k]) > 0);
}

/** A robot's name for the table: its alias, else its MAC. */
export function robotName(row) {
  return (row && (row.alias || row.macAddress)) || '';
}

/** The date of a day row in the page's language (e.g. "২৬ অক্টো"). */
export function dayText(date, lang) {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(date || '');
  try {
    return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', weekday: 'short' }).format(d);
  } catch (e) {
    return String(date);
  }
}
