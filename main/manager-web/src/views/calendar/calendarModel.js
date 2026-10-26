// Special days (admin back office): the rules of the dated list (pure; tested in
// tests/calendarDays.test.mjs). They mirror manager-api CalendarDayServiceImpl: a real date, a key
// of eid_ul_fitr / eid_ul_adha / custom, names at most 60 characters, a custom day needs a name.

export const KEYS = ['eid_ul_fitr', 'eid_ul_adha', 'custom'];
export const MAX_NAME = 60;

/** A fresh day for the sheet. */
export function newDay(today = new Date()) {
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return { date: iso, key: 'eid_ul_fitr', nameBn: '', nameEn: '' };
}

function realDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

/** Why a day cannot be saved: '' or an i18n key (calendar.problem.*). */
export function dayProblem(day) {
  const d = day || {};
  if (!realDate(d.date)) return 'calendar.problem.date';
  if (!KEYS.includes(d.key)) return 'calendar.problem.key';
  const bn = String(d.nameBn || '').trim();
  const en = String(d.nameEn || '').trim();
  if (d.key === 'custom' && !bn && !en) return 'calendar.problem.name';
  if (bn.length > MAX_NAME || en.length > MAX_NAME) return 'calendar.problem.nameLong';
  return '';
}

/** The request body (names trimmed; Eid names may stay empty: the server fills them in). */
export function dayPayload(day) {
  const out = { date: day.date, key: day.key, nameBn: String(day.nameBn || '').trim(), nameEn: String(day.nameEn || '').trim() };
  if (day.id) out.id = day.id;
  return out;
}

/** Days by date, each marked past / today / upcoming against `today` (YYYY-MM-DD). */
export function withState(days, todayIso) {
  return (days || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((d) => ({ ...d, state: d.date < todayIso ? 'past' : (d.date === todayIso ? 'today' : 'upcoming') }));
}
