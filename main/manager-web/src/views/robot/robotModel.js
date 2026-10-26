// The Robot page's rules (pure: unit tested in tests/robot.test.mjs). Field rules come from
// src/utils/companion.mjs (which mirrors xiaozhi-server core/companion/schema.py); this file only
// says how the page reads a companion view into its forms and writes them back as patches.
import {
  DIM_PRESETS,
  DISPLAY_MAX,
  GAMES,
  MAX_NAME,
  OFF_PRESETS,
  companionVolume,
  displayProblem,
  GESTURE_ACTIONS,
  GESTURE_KEYS,
  displaySettings,
  focusMinutes,
  gestureSettings,
  memorySettings,
  presetChoice,
  proactiveProblem,
  proactiveSettings,
} from '@/utils/companion.mjs';

/** The editable sections of the page, each saved on its own. */
export const FORM_SECTIONS = ['sound', 'display', 'proactive', 'memory', 'gestures', 'robot', 'care'];

/** Hours without touch or talk before a care alert (0 = off; server allows 0..12). */
export const NO_ACTIVITY_CHOICES = [0, 2, 3, 4, 6, 8];

/** The care settings with their defaults (settings.care; the alert keys belong to family care alerts). */
export function careSettings(raw) {
  const c = raw || {};
  const hours = Number(c.no_activity_hours);
  return {
    enabled: c.enabled !== false,
    lonely_after_min: Number.isFinite(Number(c.lonely_after_min)) && c.lonely_after_min !== null && c.lonely_after_min !== undefined ? Number(c.lonely_after_min) : 180,
    no_activity_hours: Number.isFinite(hours) && hours >= 0 && hours <= 12 ? Math.round(hours) : 0,
    fall_alert: c.fall_alert !== false,
    missed_medicine_alert: c.missed_medicine_alert !== false,
  };
}

export { GESTURE_KEYS, focusMinutes };

/**
 * The tap shortcut picker's options: [{ value, label }] and one group for the games, with
 * `t(key)` translating the labels (robot.gesture.<action>, robot.gesture.games).
 */
export function gestureOptions(t) {
  const plain = GESTURE_ACTIONS.filter((a) => a.indexOf('game_') !== 0);
  const games = GESTURE_ACTIONS.filter((a) => a.indexOf('game_') === 0);
  const opt = (a) => ({ value: a, label: t(`robot.gesture.${a}`) });
  const head = plain.slice(0, plain.indexOf('story') + 1).map(opt);
  const tail = plain.slice(plain.indexOf('story') + 1).map(opt);
  return [...head, { group: t('robot.gesture.games'), options: games.map(opt) }, ...tail];
}

/** Minute pickers with presets (+ Custom): which form field each one edits. */
export const MINUTE_PICKERS = {
  dim: { section: 'display', field: 'dim_after_min', presets: DIM_PRESETS, max: DISPLAY_MAX.dim_after_min },
  off: { section: 'display', field: 'off_after_min', presets: OFF_PRESETS, max: DISPLAY_MAX.off_after_min },
};

/** Volume the app shows before the robot has reported one. */
export const DEFAULT_VOLUME = 70;

/** The "demo" command's face sets (schema.py DEMO_SETS). */
export const DEMO_SETS = ['all', 'life', 'emotions', 'hands'];

/**
 * The jobs TinyBot can be given from here, in groups. `type` and `arg` are the companion command;
 * `focus: true` sends the saved focus minutes. The story (with a topic) and the firmware update
 * have their own controls.
 */
export const JOB_GROUPS = [
  {
    key: 'calm',
    jobs: [
      { key: 'lullaby', type: 'lullaby', arg: '', icon: 'lullaby', label: 'companion.action.lullaby' },
      { key: 'breathe', type: 'breathe', arg: '', icon: 'breathe', label: 'companion.action.breathe' },
      { key: 'focus', type: 'pomodoro', arg: '', icon: 'focus', label: 'companion.action.focus', focus: true },
      { key: 'light-on', type: 'night_light', arg: 'on', icon: 'light', label: 'companion.action.nightLightOn' },
      { key: 'light-off', type: 'night_light', arg: 'off', icon: 'moon', label: 'companion.action.nightLightOff' },
      { key: 'ring', type: 'ring', arg: '', icon: 'robot', label: 'companion.action.ring' },
    ],
  },
  {
    key: 'games',
    jobs: GAMES.map((g) => ({ key: `game-${g}`, type: 'game', arg: g, icon: 'game', label: `companion.game.${g}` })),
  },
  {
    key: 'demo',
    jobs: DEMO_SETS.map((s) => ({ key: `demo-${s}`, type: 'demo', arg: s, icon: 'look', label: `robot.demo.${s}` })),
  },
  {
    key: 'stop',
    jobs: [{ key: 'stop', type: 'stop', arg: '', icon: 'stop', label: 'companion.action.stop' }],
  },
];

/** Every job of every group, flat. */
export const JOBS = JOB_GROUPS.flatMap((g) => g.jobs);

/** The command argument of a job. */
export function jobArg(job, view) {
  return job.focus ? String(focusMinutes(view)) : job.arg;
}

/** The editable copy of one section, read from a companion view. */
export function serverForm(view, section) {
  const v = view || {};
  const settings = v.settings || {};
  switch (section) {
    case 'sound': {
      const manual = settings.volume !== null && settings.volume !== undefined;
      // set from here: the stored value; else what the robot reports (companionVolume), else 70
      const known = manual ? Number(settings.volume) : companionVolume(v);
      return { controlVolume: manual, volume: known === null || !Number.isFinite(known) ? DEFAULT_VOLUME : known, sounds: settings.sounds !== false };
    }
    case 'display':
      return displaySettings(settings.display);
    case 'proactive':
      return proactiveSettings(settings.proactive);
    case 'memory':
      return memorySettings(settings.memory);
    case 'gestures':
      return gestureSettings(settings.gestures);
    case 'robot':
      return { name: v.name || '', owner_name: settings.owner_name || '' };
    case 'care':
      return careSettings(settings.care);
    default:
      return {};
  }
}

/** The partial config update (PUT /device/companion/{id}/config) that saves a section. */
export function sectionPatch(section, form) {
  const f = form || {};
  switch (section) {
    case 'sound':
      return { settings: { volume: f.controlVolume ? f.volume : null, sounds: !!f.sounds } };
    case 'display':
      return { settings: { display: { dim_after_min: f.dim_after_min, off_after_min: f.off_after_min } } };
    case 'proactive':
      return {
        settings: {
          proactive: {
            enabled: !!f.enabled,
            morning_on: !!f.morning_on,
            morning: f.morning,
            evening_on: !!f.evening_on,
            evening: f.evening,
          },
        },
      };
    case 'memory':
      return { settings: { memory: { enabled: !!f.enabled } } };
    case 'gestures':
      return { settings: { gestures: gestureSettings(f) } };
    case 'robot':
      return {
        name: String(f.name || '').trim().slice(0, MAX_NAME) || 'TinyBot',
        settings: { owner_name: String(f.owner_name || '').trim().slice(0, MAX_NAME) },
      };
    case 'care': {
      const c = careSettings(f);
      // only the alert keys: `enabled` and `lonely_after_min` are edited on the Day page
      return { settings: { care: { no_activity_hours: c.no_activity_hours, fall_alert: c.fall_alert, missed_medicine_alert: c.missed_medicine_alert } } };
    }
    default:
      return {};
  }
}

/** Why a section cannot be saved yet: { key, params } of the message, or null. */
export function sectionProblem(section, form) {
  if (section === 'display') {
    const p = displayProblem(form);
    if (p === 'dimRange') return { key: 'companion.display.dimRange', params: { max: DISPLAY_MAX.dim_after_min } };
    if (p === 'offRange') return { key: 'companion.display.offRange', params: { max: DISPLAY_MAX.off_after_min } };
    if (p === 'offBeforeDim') return { key: 'companion.display.offBeforeDim', params: {} };
  }
  if (section === 'proactive') {
    const p = proactiveProblem(form);
    if (p === 'morningTime') return { key: 'companion.proactive.morningTime', params: {} };
    if (p === 'eveningTime') return { key: 'companion.proactive.eveningTime', params: {} };
  }
  return null;
}

/** The choice a minute picker shows: a preset value, or 'custom'. */
export function pickerChoice(form, key, custom) {
  const picker = MINUTE_PICKERS[key];
  if (custom) return 'custom';
  return presetChoice(form && form[picker.field], picker.presets);
}

/**
 * The toast after saving Sound: { key, n } naming the new volume when it changed, or null for
 * the generic "saved" (legacy rule: only when the app sets the volume and the value moved).
 */
export function soundSavedNote(form, before, online) {
  const b = before || {};
  if (!form || !form.controlVolume || (b.controlVolume && b.volume === form.volume)) return null;
  return { key: online === false ? 'companion.sound.volumeSetOffline' : 'companion.sound.volumeSetTo', n: form.volume };
}

/** The robot's real speaker volume as it last reported it, or null. */
export function reportedVolume(view) {
  const s = view && view.stats;
  if (!s || s.volume === undefined || s.volume === null || s.volume === '') return null;
  const n = Number(s.volume);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Wi-Fi strength word for an RSSI in dBm: 'good' | 'fair' | 'weak', or '' when unknown. */
export function wifiQuality(rssi) {
  const n = Number(rssi);
  if (rssi === undefined || rssi === null || rssi === '' || !n || !Number.isFinite(n)) return '';
  if (n >= -60) return 'good';
  if (n >= -72) return 'fair';
  return 'weak';
}

/** Uptime in seconds as { d, h, m }, or null when unknown. */
export function uptimeParts(seconds) {
  const n = Number(seconds);
  if (seconds === undefined || seconds === null || seconds === '' || !Number.isFinite(n) || n < 0) return null;
  const total = Math.floor(n / 60);
  return { d: Math.floor(total / 1440), h: Math.floor((total % 1440) / 60), m: total % 60 };
}

const MOODS = ['happy', 'sad', 'sleepy', 'bored', 'excited', 'angry', 'lonely', 'love', 'calm'];

/** The i18n key of a mood the robot reports, or '' for one we have no word for. */
export function moodKey(mood) {
  const m = String(mood || '').trim().toLowerCase();
  return MOODS.includes(m) ? `robot.mood.${m}` : '';
}

/** TbFace mood for the name plate. */
export function faceMood(view) {
  if (!view || view.online === false) return 'offline';
  const m = String((view.stats && view.stats.mood) || '').toLowerCase();
  if (m === 'happy' || m === 'excited' || m === 'love') return 'happy';
  if (m === 'sleepy') return 'sleepy';
  if (m === 'sad' || m === 'lonely' || m === 'bored' || m === 'angry') return 'confused';
  return 'awake';
}

/** Whole days since the robot was first set up (`created`, epoch seconds), or null. */
export function daysTogether(view, nowMs = Date.now()) {
  const c = Number(view && view.created);
  if (!c) return null;
  return Math.max(1, Math.floor((nowMs / 1000 - c) / 86400) + 1);
}

/** Area ink of a timeline event (one ink per area), or '' for plain ink. */
export function eventInk(event) {
  const type = (event && event.type) || '';
  if (type === 'dropped' || /missed$/.test(type)) return 'danger';
  if (type.indexOf('alarm') === 0 || type.indexOf('reminder') === 0) return 'alarm';
  if (type.indexOf('prayer') === 0) return 'prayer';
  if (type === 'pomodoro_done') return 'routine';
  return '';
}

/** A command's i18n label key (type and arg), for the recent jobs list. */
export function commandLabel(command) {
  const c = command || {};
  if (c.type === 'game') return GAMES.includes(c.arg) ? `companion.game.${c.arg}` : 'companion.command.game';
  if (c.type === 'demo') return DEMO_SETS.includes(c.arg) ? `robot.demo.${c.arg}` : 'robot.demo.all';
  if (c.type === 'night_light') return c.arg === 'off' ? 'companion.action.nightLightOff' : 'companion.action.nightLightOn';
  if (c.type === 'update') return 'robot.fw.updateCommand';
  const known = ['story', 'pomodoro', 'lullaby', 'ring', 'breathe', 'stop', 'night'];
  return known.includes(c.type) ? `companion.command.${c.type}` : '';
}
