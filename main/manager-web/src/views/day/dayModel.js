// The Day page's rules (pure: no Vue, unit tested in tests/day.test.mjs).
// Field rules and API patches are the legacy companion page's, unchanged:
//   alarms and reminders are sent as whole lists, settings sections as partial patches.
// days bitmask: bit 0 = Sunday ... bit 6 = Saturday (docs/companion-api.md).
import {
  ACTIVITIES,
  MAX_ROUTINE,
  NIGHT_LIGHT_MAX,
  PRAYER_KEYS,
  isMinutes,
  isTime,
  minuteOfDay,
  normalizeRoutine,
  routinePayload,
  routineProblem,
  scheduledActivity,
  FOCUS_PRESETS,
  parseMinutes,
} from '@/utils/companion.mjs';

export const TABS = ['alarms', 'reminders', 'prayer', 'routine', 'focus', 'night', 'routines', 'library', 'days'];

// The area ink of each tab (one ink per area).
export const TAB_INK = { alarms: 'alarm', reminders: 'alarm', prayer: 'prayer', routine: 'routine', focus: '', night: 'message', routines: 'routine', library: 'message', days: 'prayer' };

// Focus timer limits (the legacy number inputs' min/max).
export const FOCUS_LIMITS = {
  work_min: [1, 120],
  rounds: [1, 12],
  short_break_min: [1, 60],
  long_break_min: [1, 90],
};
// Focus "start now": preset chips plus a custom minutes box (1..120, Bangla digits accepted).
export { FOCUS_PRESETS, parseMinutes };

/** The picker state for a minutes value: a preset chip, or 'custom' with the value in the box. */
export function focusPick(minutes) {
  const n = parseMinutes(minutes);
  if (n !== null && FOCUS_PRESETS.includes(n)) return { choice: n, custom: '' };
  return { choice: 'custom', custom: n === null ? '' : String(n) };
}

/** The minutes the picker stands for (a chip, or the custom box), or null when the box is not 1..120. */
export function pickedMinutes(choice, custom) {
  return choice === 'custom' ? parseMinutes(custom) : parseMinutes(choice);
}

// Care: lonely after 10..1440 minutes, in steps of 10 (legacy input).
export const LONELY_LIMITS = [10, 1440];
// Reminders "every N minutes": 5..720, steps of 5 (legacy input).
export const EVERY_LIMITS = [5, 720];
// Alarm snooze: 0..60 minutes (legacy input).
export const SNOOZE_LIMITS = [0, 60];

function clone(value) {
  return JSON.parse(JSON.stringify(value === undefined ? null : value));
}

function inRange(value, [lo, hi]) {
  return typeof value === 'number' && Number.isInteger(value) && value >= lo && value <= hi;
}

export function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function firesOn(days, date) {
  const mask = days === undefined || days === null ? 127 : Number(days);
  return Boolean(mask & (1 << date.getDay()));
}

// ------------------------------------------------------------------ editable sections

/** The editable copy of a settings section, from the companion view (legacy serverForm). */
export function serverForm(view, section) {
  const dev = view || {};
  const settings = dev.settings || {};
  switch (section) {
    case 'pomodoro':
      return clone(dev.pomodoro || {});
    case 'routine':
      // missing on older servers and robots: the default day
      return normalizeRoutine(settings.routine);
    case 'night': {
      const night = clone(settings.night || {});
      // 0 = until the night ends (missing on older servers)
      if (!isMinutes(night.light_minutes, NIGHT_LIGHT_MAX)) night.light_minutes = 0;
      return night;
    }
    case 'care':
      return clone(settings.care || {});
    default:
      return {};
  }
}

/** The config patch of a section (legacy sectionPatch). */
export function sectionPatch(section, form) {
  switch (section) {
    case 'pomodoro':
      return { pomodoro: { ...form } };
    case 'routine':
      // the server replaces the whole list
      return { settings: { routine: routinePayload(form) } };
    case 'night':
      return { settings: { night: { ...form } } };
    case 'care':
      return { settings: { care: { ...form } } };
    default:
      return {};
  }
}

/**
 * Why a section can't be saved: null, or { key, params } of an i18n text (day.problem.*).
 * Night and routine are the legacy rules; focus and care check the legacy inputs' limits.
 */
export function sectionProblem(section, form) {
  const f = form || {};
  if (section === 'night') {
    if (!isTime(f.start) || !isTime(f.end)) return { key: 'day.problem.time' };
    if (!isMinutes(f.light_minutes, NIGHT_LIGHT_MAX)) return { key: 'day.problem.lightRange', params: { max: NIGHT_LIGHT_MAX } };
  }
  if (section === 'routine') {
    const problem = routineProblem(f);
    if (problem && problem.code === 'tooMany') return { key: 'day.problem.tooMany', params: { max: MAX_ROUTINE } };
    if (problem && problem.code === 'sameTime') return { key: 'day.problem.sameTime' };
    if (problem && problem.code === 'activity') return { key: 'day.problem.activity' };
    if (problem) return { key: 'day.problem.time' };
  }
  if (section === 'pomodoro') {
    for (const [field, range] of Object.entries(FOCUS_LIMITS)) {
      if (!inRange(f[field], range)) return { key: `day.problem.focus.${field}`, params: { min: range[0], max: range[1] } };
    }
  }
  if (section === 'care') {
    if (!inRange(f.lonely_after_min, LONELY_LIMITS)) return { key: 'day.problem.lonely', params: { min: LONELY_LIMITS[0], max: LONELY_LIMITS[1] } };
  }
  return null;
}

/** Same JSON as the baseline (the legacy "dirty" rule). */
export function isDirty(form, baseline) {
  return baseline !== undefined && JSON.stringify(form) !== baseline;
}

// ------------------------------------------------------------------ alarms and reminders

/** What is wrong with an alarm form: null or an i18n key. */
export function alarmProblem(form) {
  if (!form || !isTime(form.time)) return 'day.problem.time';
  if (!inRange(Number(form.snooze_min), SNOOZE_LIMITS)) return 'day.problem.snooze';
  return null;
}

/** What is wrong with a reminder form: null or an i18n key. */
export function reminderProblem(form) {
  if (!form) return 'day.problem.time';
  const times = form.mode === 'interval' ? [form.from, form.to] : [form.time];
  if (!times.every(isTime)) return 'day.problem.time';
  if (form.mode === 'interval' && !inRange(Number(form.every_min), EVERY_LIMITS)) return 'day.problem.every';
  return null;
}

export function sortByTime(list) {
  return (list || []).slice().sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
}

// ------------------------------------------------------------------ the day as a timeline

/** The prayer times of a date (today by date, else the first day), or null. */
export function prayerDay(view, date) {
  const days = (view && view.prayer && Array.isArray(view.prayer.days)) ? view.prayer.days : [];
  return days.find((d) => d.date === isoDate(date)) || days[0] || null;
}

/**
 * Every row of the day that has a time, for TbDayTable:
 * [{ key, area, time, title, note, ink, stateText, sync }]. Keys are the ones Today links with
 * (?focus=): p-<prayer>, a-<alarm id>, r-<reminder id>, l-<start>-<activity>, night.
 * `t(key, params)` translates, `fmt(hhmm)` writes a time in the reader's numerals,
 * `pending` is the set of areas being saved (their rows are drawn dashed).
 */
export function dayTimeline(view, date, t, fmt = (x) => x, pending = {}) {
  if (!view) return [];
  const rows = [];
  const sync = (area) => (pending[area] ? 'pending' : undefined);
  const prayer = view.prayer || {};
  const today = prayerDay(view, date);
  if (prayer.enabled && today) {
    for (const k of PRAYER_KEYS) {
      if (!isTime(today[k])) continue;
      rows.push({ key: `p-${k}`, area: 'prayer', time: today[k], title: t(`day.prayer.${k}`), ink: 'prayer',
        stateText: prayer.remind ? t('day.row.willRemind') : '', sync: sync('prayer') });
    }
  }
  for (const a of view.alarms || []) {
    if (!isTime(a.time) || !firesOn(a.days, date) || (a.once && a.once !== isoDate(date))) continue;
    rows.push({ key: `a-${a.id}`, area: 'alarms', time: a.time, title: a.label || t('day.alarm.defaultLabel'), ink: 'alarm',
      stateText: a.enabled ? t('day.row.alarm') : t('day.row.off'), sync: a.enabled ? sync('alarms') : 'off' });
  }
  for (const r of view.reminders || []) {
    if (!firesOn(r.days, date) || (r.once && r.once !== isoDate(date))) continue;
    const time = r.mode === 'interval' ? r.from : r.time;
    if (!isTime(time)) continue;
    rows.push({ key: `r-${r.id}`, area: 'reminders', time, title: r.label || t(`day.reminder.kind.${r.kind}`), ink: 'alarm',
      note: r.mode === 'interval' ? t('day.row.every', { n: r.every_min, to: fmt(r.to) }) : '',
      stateText: r.enabled ? t('day.row.reminder') : t('day.row.off'), sync: r.enabled ? sync('reminders') : 'off' });
  }
  const routine = normalizeRoutine(view.settings && view.settings.routine);
  if (routine.enabled) {
    for (const it of routine.items) {
      rows.push({ key: `l-${it.start}-${it.activity}`, area: 'routine', time: it.start, title: t(`day.activity.${it.activity}`),
        note: t('day.row.until', { time: fmt(it.end) }), ink: 'routine', stateText: t('day.row.routine'), sync: sync('routine') });
    }
  }
  const night = view.settings && view.settings.night;
  if (night && night.enabled && isTime(night.start)) {
    rows.push({ key: 'night', area: 'night', time: night.start, title: t('day.night.title'), ink: 'message',
      note: isTime(night.end) ? t('day.row.quietUntil', { time: fmt(night.end) }) : '', stateText: t('day.row.night'), sync: sync('night') });
  }
  return rows;
}

/** The tab a ?focus=<row key> belongs to, or ''. */
export function tabOfKey(key) {
  const k = String(key || '');
  if (k.startsWith('a-')) return 'alarms';
  if (k.startsWith('r-')) return 'reminders';
  if (k.startsWith('p-')) return 'prayer';
  if (k.startsWith('l-')) return 'routine';
  if (k === 'night') return 'night';
  if (['routines', 'library', 'days'].includes(k)) return k;
  return '';
}

/** "l-08:00-exercise" -> { start: '08:00', activity: 'exercise' } (null for other keys). */
export function routineOfKey(key) {
  const m = /^l-(\d{2}:\d{2})-(\w+)$/.exec(String(key || ''));
  return m ? { start: m[1], activity: m[2] } : null;
}

/** The first row after the minute `now` that is on (for "next"), or null. */
export function nextRow(rows, now) {
  return (rows || [])
    .filter((r) => r.sync !== 'off' && minuteOfDay(r.time) > now)
    .sort((a, b) => minuteOfDay(a.time) - minuteOfDay(b.time))[0] || null;
}

/**
 * What the preview shows (legacy previewActivity): the picked activity, else what TinyBot
 * reports doing, else what the day has scheduled now, else exercise.
 */
export function previewActivity(picked, stats, routine, minute) {
  const shown = stats && ACTIVITIES.includes(stats.activity) ? stats.activity : '';
  return picked || shown || scheduledActivity(routine, minute) || 'exercise';
}

/** Index of the routine row covering `minute` (legacy dayNowIndex), or -1. */
export function nowIndex(routine, minute) {
  if (!scheduledActivity(routine, minute)) return -1;
  return (routine.items || []).findIndex((item) => {
    const s = minuteOfDay(item.start);
    const e = minuteOfDay(item.end);
    return s < e ? minute >= s && minute < e : s > e && (minute >= s || minute < e);
  });
}
