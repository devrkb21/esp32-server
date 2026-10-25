// The Day screen's rules (pure: no uni, no Vue; tested in dayModel.test.mjs).
// Field rules and API patches are the legacy companion panels', unchanged: alarms and reminders
// go to the server as whole lists, settings sections as partial patches. Same model as
// manager-web/src/views/day/dayModel.js, plus the proactive talk rows.
// days bitmask: bit 0 = Sunday ... bit 6 = Saturday (docs/companion-api.md).
import { EVERY_DAY, FOCUS_PRESETS, FRI_SAT, isHHMM, parseMinutes, PRAYER_KEYS, proactiveSettings, SUN_TO_THU } from '../../utils/companionUtils.mjs'
import { ACTIVITIES, minuteOfDay, normalizeRoutine, scheduledActivity } from '../../utils/faceLook.mjs'

/** The parts of the day, in the order of the area tabs. */
export const TABS = ['alarms', 'reminders', 'prayer', 'routine', 'focus', 'night', 'talk']

/** The ink of each area (one ink per area; focus has none). */
export const TAB_INK = { alarms: 'alarm', reminders: 'alarm', prayer: 'prayer', routine: 'routine', focus: '', night: 'message', talk: 'message' }

/** The icon of each area (src/utils/tbIcons.mjs). */
export const TAB_ICON = { alarms: 'alarm', reminders: 'reminder', prayer: 'prayer', routine: 'day', focus: 'focus', night: 'night', talk: 'chat' }

/** The five prayers that get a row (sunrise is a time, not a prayer). */
export const PRAYERS = PRAYER_KEYS.filter(k => k !== 'sunrise')

// Legacy limits (the old number inputs' min / max / fallback).
export const MAX_ALARMS = 20
export const MAX_REMINDERS = 20
export const SNOOZE_LIMITS = [0, 60]
export const EVERY_LIMITS = [5, 720]
export const LONELY_LIMITS = [10, 1440]
export const FOCUS_LIMITS = {
  work_min: [1, 120],
  rounds: [1, 12],
  short_break_min: [1, 60],
  long_break_min: [1, 90],
}

/** The quick picks of the weekday chooser. */
export const DAY_PRESETS = [
  { key: 'everyDay', mask: EVERY_DAY },
  { key: 'sunToThu', mask: SUN_TO_THU },
  { key: 'friSat', mask: FRI_SAT },
]

export function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Does a days mask fire on this date? A missing mask means every day. */
export function firesOn(days, date) {
  const mask = days === undefined || days === null ? EVERY_DAY : Number(days)
  return Boolean(mask & (1 << date.getDay()))
}

function inRange(value, [lo, hi]) {
  return typeof value === 'number' && Number.isInteger(value) && value >= lo && value <= hi
}

/** The prayer times of a date (by date, else the first day), or null. */
export function prayerDay(view, date) {
  const days = view && view.prayer && Array.isArray(view.prayer.days) ? view.prayer.days : []
  return days.find(d => d.date === isoDate(date)) || days[0] || null
}

/**
 * Every row of the day that has a time, for <tb-day-table>:
 * [{ key, area, time, title, note, ink, stateText, sync }]. Keys are the ones Today links with
 * (?focus=): p-<prayer>, a-<alarm id>, r-<reminder id>, l-<start>-<activity>, night, and
 * talk-morning / talk-evening. `t(key, params)` translates, `fmt(hhmm)` writes a time in the
 * reader's numerals, `pending` holds the areas being saved (their rows are drawn dashed).
 */
export function dayTimeline(view, date, t, fmt = x => x, pending = {}) {
  if (!view)
    return []
  const rows = []
  const sync = area => (pending[area] ? 'pending' : undefined)
  const prayer = view.prayer || {}
  const today = prayerDay(view, date)
  if (prayer.enabled && today) {
    for (const k of PRAYERS) {
      if (!isHHMM(today[k]))
        continue
      rows.push({ key: `p-${k}`, area: 'prayer', time: today[k], title: t(`day.prayer.${k}`), ink: 'prayer', stateText: prayer.remind ? t('day.row.willRemind') : '', sync: sync('prayer') })
    }
  }
  for (const a of view.alarms || []) {
    if (!isHHMM(a.time) || !firesOn(a.days, date))
      continue
    rows.push({ key: `a-${a.id}`, area: 'alarms', time: a.time, title: a.label || t('day.alarm.defaultLabel'), ink: 'alarm', stateText: a.enabled ? t('day.row.alarm') : t('day.row.off'), sync: a.enabled ? sync('alarms') : 'off' })
  }
  for (const r of view.reminders || []) {
    if (!firesOn(r.days, date))
      continue
    const time = r.mode === 'interval' ? r.from : r.time
    if (!isHHMM(time))
      continue
    rows.push({
      key: `r-${r.id}`,
      area: 'reminders',
      time,
      title: r.label || t(`day.reminder.kind.${r.kind}`),
      ink: 'alarm',
      note: r.mode === 'interval' ? t('day.row.every', { n: r.every_min, to: fmt(r.to) }) : '',
      stateText: r.enabled ? t('day.row.reminder') : t('day.row.off'),
      sync: r.enabled ? sync('reminders') : 'off',
    })
  }
  const routine = normalizeRoutine(view.settings && view.settings.routine)
  if (routine.enabled) {
    for (const it of routine.items)
      rows.push({ key: `l-${it.start}-${it.activity}`, area: 'routine', time: it.start, title: t(`day.activity.${it.activity}`), note: t('day.row.until', { time: fmt(it.end) }), ink: 'routine', stateText: t('day.row.routine'), sync: sync('routine') })
  }
  const talk = proactiveSettings(view.settings && view.settings.proactive)
  if (talk.enabled) {
    for (const part of ['morning', 'evening']) {
      if (talk[`${part}_on`])
        rows.push({ key: `talk-${part}`, area: 'talk', time: talk[part], title: t(`day.talk.${part}Row`), ink: 'message', stateText: t('day.row.talk'), sync: sync('talk') })
    }
  }
  const night = view.settings && view.settings.night
  if (night && night.enabled && isHHMM(night.start))
    rows.push({ key: 'night', area: 'night', time: night.start, title: t('day.night.title'), note: isHHMM(night.end) ? t('day.row.quietUntil', { time: fmt(night.end) }) : '', ink: 'message', stateText: t('day.row.night'), sync: sync('night') })
  return rows
}

/** The area tab a row key (?focus=<key>) belongs to, or ''. */
export function tabOfKey(key) {
  const k = String(key || '')
  if (k.startsWith('a-'))
    return 'alarms'
  if (k.startsWith('r-'))
    return 'reminders'
  if (k.startsWith('p-'))
    return 'prayer'
  if (k.startsWith('l-'))
    return 'routine'
  if (k.startsWith('talk-'))
    return 'talk'
  if (k === 'night')
    return 'night'
  return ''
}

/** "l-08:00-exercise" -> { start: '08:00', activity: 'exercise' } (null for other keys). */
export function routineOfKey(key) {
  const m = /^l-(\d{2}:\d{2})-(\w+)$/.exec(String(key || ''))
  return m ? { start: m[1], activity: m[2] } : null
}

/** The first row after the minute `now` that is on (for "next"), or null. */
export function nextRow(rows, now) {
  return (rows || [])
    .filter(r => r.sync !== 'off' && minuteOfDay(r.time) > now)
    .sort((a, b) => minuteOfDay(a.time) - minuteOfDay(b.time))[0] || null
}

/** What TinyBot shows now: the activity it reports, else what its routine has now, else ''. */
export function nowActivity(view, minute) {
  const s = view && view.stats
  if (s && ACTIVITIES.includes(s.activity))
    return s.activity
  return scheduledActivity(normalizeRoutine(view && view.settings && view.settings.routine), minute)
}

/**
 * What the routine preview shows (legacy): the picked activity, else what TinyBot reports doing,
 * else what the edited day has scheduled now, else exercise.
 */
export function previewActivity(picked, stats, routine, minute) {
  const shown = stats && ACTIVITIES.includes(stats.activity) ? stats.activity : ''
  return picked || shown || scheduledActivity(routine, minute) || 'exercise'
}

/** Index of the routine row covering `minute` (legacy nowIndex), or -1. */
export function nowIndex(routine, minute) {
  if (!scheduledActivity(routine, minute))
    return -1
  return (routine.items || []).findIndex((item) => {
    const s = minuteOfDay(item.start)
    const e = minuteOfDay(item.end)
    return s < e ? minute >= s && minute < e : s > e && (minute >= s || minute < e)
  })
}

/** What is wrong with a reminder form (legacy submit rule): '' or 'time'. */
export function reminderProblem(form) {
  if (!form)
    return 'time'
  const times = form.mode === 'interval' ? [form.from, form.to] : [form.time]
  return times.every(isHHMM) ? '' : 'time'
}

/** Why the focus form can't be saved: null or { field, min, max }. */
export function focusProblem(form) {
  const f = form || {}
  for (const [field, range] of Object.entries(FOCUS_LIMITS)) {
    if (!inRange(f[field], range))
      return { field, min: range[0], max: range[1] }
  }
  return null
}

/** The weekday mask's preset key ('everyDay' | 'sunToThu' | 'friSat' | 'once') or ''. */
export function daysPreset(mask) {
  if (!mask)
    return 'once'
  const p = DAY_PRESETS.find(x => x.mask === mask)
  return p ? p.key : ''
}

/** Weekday indexes (0 = Sunday) set in a mask. */
export function daysOf(mask) {
  return [0, 1, 2, 3, 4, 5, 6].filter(d => (mask >> d) & 1)
}

/** "Every day", "Sun to Thu", "Once", or the days in order ("Sun, Tue"). */
export function daysText(mask, t) {
  const preset = daysPreset(mask)
  if (preset)
    return t(`day.preset.${preset}`)
  return daysOf(mask).map(d => t(`day.weekday.${d}`)).join(', ')
}

// Focus "start now": preset chips plus a custom minutes box (1..120, Bangla digits accepted).
export { FOCUS_PRESETS, parseMinutes }

/**
 * The picker state for a minutes value: a preset chip, or 'custom' with the value in the box.
 * @param {unknown} minutes
 * @returns {{ choice: number | 'custom', custom: string }} picker state
 */
export function focusPick(minutes) {
  const n = parseMinutes(minutes)
  if (n !== null && FOCUS_PRESETS.includes(n))
    return { choice: n, custom: '' }
  return { choice: 'custom', custom: n === null ? '' : String(n) }
}

/**
 * The minutes the picker stands for (a chip, or the custom box), or null when the box is not 1..120.
 * @param {number | 'custom'} choice
 * @param {string} custom
 * @returns {number | null} minutes
 */
export function pickedMinutes(choice, custom) {
  return choice === 'custom' ? parseMinutes(custom) : parseMinutes(choice)
}
