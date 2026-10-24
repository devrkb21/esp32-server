// Pure helpers for the companion screens (no uni / Vue imports: tested with `node --test`).

export const EVERY_DAY = 127
/** Sunday-Thursday (Bangladesh work week) */
export const SUN_TO_THU = 31
/** Friday-Saturday */
export const FRI_SAT = 96

/** Bit index -> i18n key suffix; bit 0 = Sunday */
export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export const PRAYER_KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']
const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']

export const MAX_LABEL = 24
export const MAX_SAY = 300

/**
 * @param {number} mask
 * @param {number} bit 0 = Sunday
 */
export function hasDay(mask, bit) {
  return ((mask >> bit) & 1) === 1
}

/**
 * @param {number} mask
 * @param {number} bit
 */
export function toggleDay(mask, bit) {
  return (mask ^ (1 << bit)) & EVERY_DAY
}

/**
 * Describe a weekday mask: a preset key or the list of day keys.
 * @param {number} mask
 * @returns {{ preset: 'everyDay' | 'sunToThu' | 'friSat' | 'once' | null, days: string[] }} preset
 *   is null when the mask is a custom set of days
 */
export function describeDays(mask) {
  if (mask === EVERY_DAY)
    return { preset: 'everyDay', days: [] }
  if (mask === SUN_TO_THU)
    return { preset: 'sunToThu', days: [] }
  if (mask === FRI_SAT)
    return { preset: 'friSat', days: [] }
  if (!mask)
    return { preset: 'once', days: [] }
  return { preset: null, days: DAY_KEYS.filter((_, i) => hasDay(mask, i)) }
}

/**
 * Printable ASCII only (the OLED fonts are ASCII only), whitespace collapsed, at most 24 chars.
 * Mirrors schema.ascii_only on the server, without trimming so typing a space still works.
 * @param {unknown} text
 */
export function asciiLabel(text) {
  if (typeof text !== 'string')
    return ''
  return text.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').slice(0, MAX_LABEL)
}

/** @param {number} n */
function pad(n) {
  return (n < 10 ? '0' : '') + n
}

/**
 * "HH:MM" of a Date.
 * @param {Date} date
 */
export function hhmm(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Next prayer from the server's prayer days (today, tomorrow).
 * @param {Array<any> | undefined | null} days prayer days ({date, fajr, sunrise, dhuhr, asr, maghrib, isha})
 * @param {Date} [now]
 * @returns {{ key: string, time: string, tomorrow: boolean } | null} next prayer
 */
export function nextPrayer(days, now = new Date()) {
  if (!days || !days.length)
    return null
  const cur = hhmm(now)
  const today = days[0]
  for (const key of PRAYERS) {
    if (today[key] && today[key] > cur)
      return { key, time: today[key], tomorrow: false }
  }
  return days[1] && days[1].fajr ? { key: 'fajr', time: days[1].fajr, tomorrow: true } : null
}

/**
 * Elapsed time since a unix-seconds timestamp, as an i18n key and a number.
 * @param {number | null | undefined} ts unix seconds
 * @param {number} [nowMs]
 * @returns {{ key: 'never' | 'justNow' | 'minutesAgo' | 'hoursAgo' | 'daysAgo', n: number }} parts
 */
export function agoParts(ts, nowMs = Date.now()) {
  if (!ts)
    return { key: 'never', n: 0 }
  const s = Math.max(0, Math.floor(nowMs / 1000 - ts))
  if (s < 60)
    return { key: 'justNow', n: 0 }
  if (s < 3600)
    return { key: 'minutesAgo', n: Math.floor(s / 60) }
  if (s < 86400)
    return { key: 'hoursAgo', n: Math.floor(s / 3600) }
  return { key: 'daysAgo', n: Math.floor(s / 86400) }
}

/**
 * "HH:MM DD/MM" of a unix-seconds timestamp.
 * @param {number} ts
 */
export function clockText(ts) {
  const d = new Date(ts * 1000)
  return `${hhmm(d)} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
}

/**
 * Alarm as sent back to the server (drops server-derived fields).
 * @param {Record<string, any>} a
 */
export function stripAlarm(a) {
  return {
    id: a.id,
    time: a.time,
    days: a.days,
    label: a.label || '',
    enabled: !!a.enabled,
    snooze_min: a.snooze_min ?? 5,
    say: a.say || '',
  }
}

/**
 * Reminder as sent back to the server: only the fields of its mode.
 * @param {Record<string, any>} r
 */
export function stripReminder(r) {
  const out = {
    id: r.id,
    kind: r.kind,
    label: r.label || '',
    enabled: !!r.enabled,
    mode: r.mode,
    days: r.days ?? EVERY_DAY,
    say: r.say || '',
  }
  if (r.mode === 'interval') {
    out.every_min = r.every_min ?? 60
    out.from = r.from || '09:00'
    out.to = r.to || '21:00'
  }
  else {
    out.time = r.time || '21:00'
  }
  if (!out.id)
    delete out.id
  return out
}

/** Spoken defaults are Bangla: the robot's TTS voice is Bangla. */
const REMINDER_DEFAULTS = {
  water: { kind: 'water', label: 'Drink water', mode: 'interval', every_min: 60, from: '09:00', to: '21:00', say: 'পানি খাওয়ার সময় হয়েছে! এক গ্লাস পানি খেয়ে নাও।' },
  medicine: { kind: 'medicine', label: 'Medicine', mode: 'time', time: '21:00', say: 'ওষুধ খাওয়ার সময় হয়েছে।' },
  custom: { kind: 'custom', label: 'Reminder', mode: 'time', time: '17:00', say: '' },
}

/**
 * New reminder of a kind with sensible defaults.
 * @param {'water' | 'medicine' | 'custom'} kind
 */
export function newReminder(kind) {
  return { enabled: true, days: EVERY_DAY, ...(REMINDER_DEFAULTS[kind] || REMINDER_DEFAULTS.custom) }
}

export function newAlarm() {
  return { time: '06:30', days: EVERY_DAY, label: 'Wake up', enabled: true, snooze_min: 5, say: '' }
}

/**
 * Replace (by id) or append an item, returning a new list.
 * @template {{ id?: string }} T
 * @param {T[]} list
 * @param {T} item
 */
export function upsertById(list, item) {
  if (item.id && list.some(x => x.id === item.id))
    return list.map(x => (x.id === item.id ? item : x))
  return [...list, item]
}

/**
 * @template {{ id?: string }} T
 * @param {T[]} list
 * @param {string | undefined} id
 */
export function removeById(list, id) {
  return list.filter(x => x.id !== id)
}

/**
 * Alarms sorted by time of day (a copy).
 * @template {{ time: string }} T
 * @param {T[]} alarms
 */
export function sortByTime(alarms) {
  return [...alarms].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
}

/**
 * Validate a "HH:MM" string.
 * @param {unknown} value
 */
export function isHHMM(value) {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
}

/**
 * Clamp a number into [lo, hi], falling back when it is not a number.
 * @param {unknown} value
 * @param {number} lo
 * @param {number} hi
 * @param {number} fallback
 */
export function clampInt(value, lo, hi, fallback) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n))
    return fallback
  return Math.min(hi, Math.max(lo, n))
}

/** The robot's info pages, in the order the robot cycles through them. */
export const ROBOT_PAGES = ['clock', 'weather', 'prayer', 'focus', 'games', 'breathe', 'story', 'night', 'status', 'bond']

/**
 * Every robot page with its on/off state; missing or non-false values count as on.
 * @param {Record<string, boolean> | null | undefined} pages
 * @returns {Record<string, boolean>}
 */
export function robotPages(pages) {
  const source = pages && typeof pages === 'object' ? pages : {}
  /** @type {Record<string, boolean>} */
  const all = {}
  ROBOT_PAGES.forEach((key) => {
    all[key] = source[key] !== false
  })
  return all
}

/**
 * True when `key` is the only page still on (its switch must stay on).
 * @param {Record<string, boolean> | null | undefined} pages
 * @param {string} key
 */
export function isLastPageOn(pages, key) {
  const all = robotPages(pages)
  return all[key] && ROBOT_PAGES.filter(k => all[k]).length === 1
}

// Screen timeouts (settings.display): minutes without touch or talk before the OLED dims / turns off; 0 = never.
export const DISPLAY_DEFAULTS = { dim_after_min: 3, off_after_min: 20 }
export const DISPLAY_MAX = { dim_after_min: 120, off_after_min: 600 }
export const DIM_PRESETS = [0, 1, 3, 5, 10, 20, 30, 60]
export const OFF_PRESETS = [0, 5, 10, 20, 30, 60, 120, 240]
/** Night light (settings.night.light_minutes): 0 = until the night ends (1 hour when started by hand) */
export const NIGHT_LIGHT_MAX = 600
export const NIGHT_LIGHT_PRESETS = [0, 15, 30, 45, 60, 90, 120]

/**
 * True for a whole number of minutes in 0..max.
 * @param {unknown} value
 * @param {number} max
 * @returns {boolean} whether the value is valid
 */
export function isMinutes(value, max) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max
}

/**
 * The display timeouts with defaults for missing or invalid values.
 * @param {{ dim_after_min?: number, off_after_min?: number } | null | undefined} display
 * @returns {{ dim_after_min: number, off_after_min: number }} complete settings
 */
export function displaySettings(display) {
  const source = display && typeof display === 'object' ? display : {}
  return {
    dim_after_min: isMinutes(source.dim_after_min, DISPLAY_MAX.dim_after_min) ? /** @type {number} */ (source.dim_after_min) : DISPLAY_DEFAULTS.dim_after_min,
    off_after_min: isMinutes(source.off_after_min, DISPLAY_MAX.off_after_min) ? /** @type {number} */ (source.off_after_min) : DISPLAY_DEFAULTS.off_after_min,
  }
}

/**
 * What is wrong with the display timeouts: '' (fine), 'dimRange', 'offRange', or 'offBeforeDim'
 * (the screen would turn off before it dims).
 * @param {{ dim_after_min?: number, off_after_min?: number }} display
 * @returns {'' | 'dimRange' | 'offRange' | 'offBeforeDim'} the problem
 */
export function displayProblem(display) {
  const d = display || {}
  if (!isMinutes(d.dim_after_min, DISPLAY_MAX.dim_after_min))
    return 'dimRange'
  if (!isMinutes(d.off_after_min, DISPLAY_MAX.off_after_min))
    return 'offRange'
  const dim = /** @type {number} */ (d.dim_after_min)
  const off = /** @type {number} */ (d.off_after_min)
  if (dim > 0 && off > 0 && off <= dim)
    return 'offBeforeDim'
  return ''
}

/**
 * The robot's volume from a companion view: what it last reported (stats.volume), else the
 * volume the app asked for (settings.volume), else null.
 * @param {{ stats?: { volume?: number | null }, settings?: { volume?: number | null } } | null | undefined} view
 * @returns {number | null} percent
 */
export function companionVolume(view) {
  /** @param {unknown} value */
  const percent = (value) => {
    if (value === null || value === undefined || value === '')
      return null
    const n = Number(value)
    return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n) : null
  }
  const reported = percent(view?.stats?.volume)
  return reported !== null ? reported : percent(view?.settings?.volume)
}
