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
