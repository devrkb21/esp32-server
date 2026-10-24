// Pure helpers for the TinyBot companion screens (no Vue, no i18n: unit tested).
// Field rules mirror xiaozhi-server core/companion/schema.py.

export const EVERY_DAY = 127;
export const MAX_LABEL = 24;
export const MAX_SAY = 300;
export const MAX_MESSAGE = 300;
export const MAX_NAME = 32;
export const MAX_ALARMS = 20;
export const MAX_REMINDERS = 20;

// Weekday bitmask: bit 0 = Sunday ... bit 6 = Saturday
export const DAY_PRESETS = [
  { key: 'everyDay', mask: 127 },
  { key: 'sunToThu', mask: 31 },
  { key: 'monToFri', mask: 62 },
  { key: 'friSat', mask: 96 },
];

export const PRAYER_KEYS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const PRAYER_ROWS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const REMINDER_KINDS = ['water', 'medicine', 'custom'];
export const GAMES = ['catch', 'simon', 'dice', 'reaction'];

export function hasDay(mask, day) {
  return ((Number(mask) || 0) >> day & 1) === 1;
}

export function toggleDay(mask, day) {
  return ((Number(mask) || 0) ^ (1 << day)) & EVERY_DAY;
}

/** Indexes (0 = Sunday) of the days set in the mask. */
export function daysOf(mask) {
  return [0, 1, 2, 3, 4, 5, 6].filter((day) => hasDay(mask, day));
}

/** Preset key matching the mask, 'once' for 0, or null for a custom set of days. */
export function daysPreset(mask) {
  const value = Number(mask) || 0;
  if (value === 0) return 'once';
  const preset = DAY_PRESETS.find((item) => item.mask === value);
  return preset ? preset.key : null;
}

/** The OLED fonts are ASCII only: keep printable ASCII, collapse spaces, at most 24 chars. */
export function asciiLabel(text, limit = MAX_LABEL) {
  if (typeof text !== 'string') return '';
  return text.replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').slice(0, limit);
}

export function isAsciiText(text) {
  return typeof text === 'string' && /^[\x20-\x7e]*$/.test(text);
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isTime(value) {
  return typeof value === 'string' && TIME_RE.test(value);
}

export function newAlarm() {
  return { time: '06:30', days: EVERY_DAY, label: 'Wake up', enabled: true, snooze_min: 5, say: '' };
}

/** Alarm as the config API accepts it (drops server-only fields such as say_audio). */
export function alarmPayload(alarm) {
  const out = {
    time: alarm.time,
    days: Number(alarm.days) || 0,
    label: asciiLabel(alarm.label || '').trim(),
    enabled: !!alarm.enabled,
    snooze_min: Number(alarm.snooze_min) || 0,
    say: (alarm.say || '').trim(),
  };
  if (alarm.id) out.id = alarm.id;
  return out;
}

const REMINDER_DEFAULTS = {
  water: {
    kind: 'water', label: 'Drink water', mode: 'interval', every_min: 60, from: '09:00', to: '21:00',
    say: 'পানি খাওয়ার সময় হয়েছে! এক গ্লাস পানি খেয়ে নাও।',
  },
  medicine: { kind: 'medicine', label: 'Medicine', mode: 'time', time: '21:00', say: 'ওষুধ খাওয়ার সময় হয়েছে।' },
  custom: { kind: 'custom', label: 'Reminder', mode: 'time', time: '17:00', say: '' },
};

export function newReminder(kind = 'water') {
  const base = REMINDER_DEFAULTS[kind] || REMINDER_DEFAULTS.custom;
  return {
    enabled: true, days: EVERY_DAY, every_min: 60, from: '09:00', to: '21:00', time: '21:00',
    ...base,
  };
}

/** Reminder as the config API accepts it: only the fields of its mode, no say_audio. */
export function reminderPayload(reminder) {
  const out = {
    kind: reminder.kind,
    label: asciiLabel(reminder.label || '').trim(),
    enabled: !!reminder.enabled,
    mode: reminder.mode,
    days: Number(reminder.days) || 0,
    say: (reminder.say || '').trim(),
  };
  if (reminder.id) out.id = reminder.id;
  if (reminder.mode === 'interval') {
    out.every_min = Number(reminder.every_min) || 60;
    out.from = reminder.from;
    out.to = reminder.to;
  } else {
    out.time = reminder.time;
  }
  return out;
}

/**
 * New full list (alarms and reminders are replaced as a whole) with `item` added (no id) or
 * replacing the entry with the same id.
 */
export function upsertById(list, item, toPayload) {
  const items = (list || []).map(toPayload);
  const payload = toPayload(item);
  if (!payload.id) return [...items, payload];
  return items.map((entry) => (entry.id === payload.id ? payload : entry));
}

export function removeById(list, id, toPayload) {
  return (list || []).filter((entry) => entry.id !== id).map(toPayload);
}

export function setEnabled(list, id, enabled, toPayload) {
  return (list || []).map((entry) => {
    const payload = toPayload(entry);
    if (payload.id === id) payload.enabled = enabled;
    return payload;
  });
}

function pad(n) {
  return (n < 10 ? '0' : '') + n;
}

export function hhmmOf(date) {
  return pad(date.getHours()) + ':' + pad(date.getMinutes());
}

/** Next prayer from prayer.days (today first, then tomorrow): {key, time, tomorrow}. */
export function nextPrayer(days, now = new Date()) {
  if (!Array.isArray(days) || !days.length) return null;
  const current = hhmmOf(now);
  const today = days[0] || {};
  for (const key of PRAYER_KEYS) {
    if (today[key] && today[key] > current) return { key, time: today[key], tomorrow: false };
  }
  return days[1] && days[1].fajr ? { key: 'fajr', time: days[1].fajr, tomorrow: true } : null;
}

/** Epoch seconds to "HH:MM DD/MM" in local time ('-' when missing). */
export function formatClock(ts) {
  if (!ts) return '-';
  const date = new Date(Number(ts) * 1000);
  if (Number.isNaN(date.getTime())) return '-';
  return `${hhmmOf(date)} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

/** Relative age of an epoch-seconds timestamp: {unit, value}; unit is never/justNow/minutes/hours/days. */
export function ageOf(ts, nowMs = Date.now()) {
  if (!ts) return { unit: 'never', value: 0 };
  const seconds = Math.max(0, Math.floor(nowMs / 1000 - Number(ts)));
  if (seconds < 60) return { unit: 'justNow', value: 0 };
  if (seconds < 3600) return { unit: 'minutes', value: Math.floor(seconds / 60) };
  if (seconds < 86400) return { unit: 'hours', value: Math.floor(seconds / 3600) };
  return { unit: 'days', value: Math.floor(seconds / 86400) };
}

/** "245 ms" style high scores: [{game, value, ms}] sorted by name. */
export function highScores(scores) {
  if (!scores || typeof scores !== 'object') return [];
  return Object.keys(scores).sort().map((key) => ({
    game: key.replace(/_ms$/, ''),
    value: scores[key],
    ms: /_ms$/.test(key),
  }));
}

/** Message status key: yes / no / seen (answers), delivered or pending. */
export function messageStatus(message) {
  if (message && ['yes', 'no', 'seen'].includes(message.answer)) return message.answer;
  return message && message.status === 'delivered' ? 'delivered' : 'pending';
}

/** The robot's info pages, in the order the robot cycles through them. */
export const ROBOT_PAGES = ['clock', 'weather', 'prayer', 'focus', 'games', 'breathe', 'story', 'night', 'status', 'bond'];

/** Every robot page with its on/off state; missing or non-false values count as on. */
export function robotPages(pages) {
  const source = pages && typeof pages === 'object' ? pages : {};
  return ROBOT_PAGES.reduce((all, key) => ({ ...all, [key]: source[key] !== false }), {});
}

/** True when `key` is the only page still on (its switch must stay on). */
export function isLastPageOn(pages, key) {
  const all = robotPages(pages);
  return all[key] && ROBOT_PAGES.filter((k) => all[k]).length === 1;
}

// ------------------------------------------------------------------ screen and night light timeouts
// Minutes without touch or talk before the OLED dims / turns off (settings.display); 0 = never.
export const DISPLAY_DEFAULTS = { dim_after_min: 3, off_after_min: 20 };
export const DISPLAY_MAX = { dim_after_min: 120, off_after_min: 600 };
export const DIM_PRESETS = [0, 1, 3, 5, 10, 20, 30, 60];
export const OFF_PRESETS = [0, 5, 10, 20, 30, 60, 120, 240];
// Night light (settings.night.light_minutes): 0 = until the night ends (1 hour when started by hand)
export const NIGHT_LIGHT_MAX = 600;
export const NIGHT_LIGHT_PRESETS = [0, 15, 30, 45, 60, 90, 120];

/** True for a whole number of minutes in 0..max. */
export function isMinutes(value, max) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;
}

/** The display timeouts with defaults for missing or invalid values. */
export function displaySettings(display) {
  const source = display && typeof display === 'object' ? display : {};
  return Object.keys(DISPLAY_DEFAULTS).reduce((all, key) => ({
    ...all,
    [key]: isMinutes(source[key], DISPLAY_MAX[key]) ? source[key] : DISPLAY_DEFAULTS[key],
  }), {});
}

/**
 * What is wrong with the display timeouts: '' (fine), 'dimRange', 'offRange', or 'offBeforeDim'
 * (the screen would turn off before it dims).
 */
export function displayProblem(display) {
  const d = display || {};
  if (!isMinutes(d.dim_after_min, DISPLAY_MAX.dim_after_min)) return 'dimRange';
  if (!isMinutes(d.off_after_min, DISPLAY_MAX.off_after_min)) return 'offRange';
  if (d.dim_after_min > 0 && d.off_after_min > 0 && d.off_after_min <= d.dim_after_min) return 'offBeforeDim';
  return '';
}

/** The preset a minutes value matches, or 'custom'. */
export function presetChoice(value, presets) {
  return presets.includes(value) ? value : 'custom';
}

// ------------------------------------------------------------------ volume
function percentOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n) : null;
}

/**
 * The robot's volume from a companion view: what it last reported (stats.volume), else the
 * volume the app asked for (settings.volume), else null.
 */
export function companionVolume(view) {
  const v = view || {};
  const reported = percentOrNull(v.stats && v.stats.volume);
  if (reported !== null) return reported;
  return percentOrNull(v.settings && v.settings.volume);
}

/**
 * How the device Volume command went (a code-0 answer): 'now' (the robot changed it), 'offline'
 * (saved; the robot changes it when it is online) or 'other' (show the server's message as is).
 */
export function volumeSaveOutcome(data) {
  const msg = String((data && data.msg) || '').trim();
  if (/when it is online|saved/i.test(msg)) return 'offline';
  if (!msg || /^success$/i.test(msg) || /updated successfully/i.test(msg)) return 'now';
  return 'other';
}

// ---------------------------------------------------------------- TinyBot's day (settings.routine)
// Shared with the face preview (one module in both apps): see faceLook.mjs
export {
  ACTIVITIES,
  ACTIVITY_ICON,
  MAX_ROUTINE,
  cleanHHMM,
  defaultRoutine,
  minuteOfDay,
  newRoutineItem,
  normalizeRoutine,
  routineItemMinutes,
  routineItemProblem,
  routineOverlaps,
  routinePayload,
  routineProblem,
  sameRoutine,
  scheduledActivity,
  sortRoutine,
} from './faceLook.mjs';
