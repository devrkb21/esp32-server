// The Robot screen's own rules (pure: tested in robotModel.test.mjs with `node --test`).
// Field rules (display, proactive, memory, pages) stay in ../companion/companionUtils.mjs and the
// update flow in ../companion/firmwareUpdate.mjs; this file says how the screen reads a companion
// view: jobs, status rows, sync words. Mirrors manager-web/src/views/robot/robotModel.js.

/** Longest robot name and owner name the screen accepts (legacy input maxlength). */
export const MAX_NAME = 32

/** Longest story topic (legacy input maxlength). */
export const MAX_TOPIC = 64

/** The games TinyBot can start (companion command {type: 'game', arg}). */
export const GAMES = ['catch', 'simon', 'dice', 'reaction']

/** Volume the screen shows before the robot has reported one (legacy default). */
export const DEFAULT_VOLUME = 70

/** How often the screen asks for the companion view while it is open (legacy POLL_MS). */
export const POLL_MS = 10000

/**
 * The quick jobs, as in the legacy Actions panel: `type` and `arg` are the companion command;
 * `focus: true` sends the saved focus minutes. Icons come from src/utils/tbIcons.mjs.
 */
export const JOBS = [
  { key: 'lullaby', type: 'lullaby', arg: '', icon: 'lullaby', label: 'companion.act.lullaby' },
  { key: 'breathe', type: 'breathe', arg: '', icon: 'breathe', label: 'companion.act.breathe' },
  { key: 'focus', type: 'pomodoro', arg: '', icon: 'focus', label: 'companion.act.focus', focus: true },
  { key: 'light-on', type: 'night_light', arg: 'on', icon: 'light', label: 'companion.act.lightOn' },
  { key: 'light-off', type: 'night_light', arg: 'off', icon: 'moon', label: 'companion.act.lightOff' },
  { key: 'ring', type: 'ring', arg: '', icon: 'reminder', label: 'companion.act.ring' },
]

/** The stop job (drawn apart, in the danger ink). */
export const STOP_JOB = { key: 'stop', type: 'stop', arg: '', icon: 'stop', label: 'companion.act.stop' }

/** Work minutes the focus job starts with: the saved value, else 25. */
export function focusMinutes(view) {
  const work = Number(view && view.pomodoro && view.pomodoro.work_min)
  return work > 0 ? work : 25
}

/** The command argument of a job. */
export function jobArg(job, view) {
  return job.focus ? String(focusMinutes(view)) : job.arg
}

/** The i18n key of a sent command's name for the recent list, or '' for an unknown type. */
export function commandLabel(command) {
  const c = command || {}
  if (c.type === 'game')
    return GAMES.includes(c.arg) ? `companion.game.${c.arg}` : 'companion.cmd.game'
  if (c.type === 'night_light')
    return c.arg === 'off' ? 'companion.act.lightOff' : 'companion.act.lightOn'
  if (c.type === 'update')
    return 'mrobot.fw.updateCommand'
  const known = ['story', 'pomodoro', 'lullaby', 'ring', 'breathe', 'stop', 'night']
  return known.includes(c.type) ? `companion.cmd.${c.type}` : ''
}

/** True when the app sets the volume (settings.volume is a number); null means the robot keeps its own. */
export function volumeFromPhone(view) {
  const v = view && view.settings && view.settings.volume
  return v !== null && v !== undefined
}

/** The robot's real speaker volume as it last reported it, or null. */
export function reportedVolume(view) {
  const s = view && view.stats
  if (!s || s.volume === undefined || s.volume === null || s.volume === '')
    return null
  const n = Number(s.volume)
  return Number.isFinite(n) ? Math.round(n) : null
}

/** The slider's value: the stored one, else what the robot reports, else 70. */
export function sliderVolume(view) {
  const set = view && view.settings && view.settings.volume
  const n = set !== null && set !== undefined ? Number(set) : reportedVolume(view)
  return n === null || !Number.isFinite(n) ? DEFAULT_VOLUME : Math.min(100, Math.max(0, Math.round(n)))
}

/** Wi-Fi strength word for an RSSI in dBm: 'good' | 'fair' | 'weak', or '' when unknown. */
export function wifiQuality(rssi) {
  const n = Number(rssi)
  if (rssi === undefined || rssi === null || rssi === '' || !n || !Number.isFinite(n))
    return ''
  if (n >= -60)
    return 'good'
  if (n >= -72)
    return 'fair'
  return 'weak'
}

/** Uptime in seconds as { d, h, m }, or null when unknown. */
export function uptimeParts(seconds) {
  const n = Number(seconds)
  if (seconds === undefined || seconds === null || seconds === '' || !Number.isFinite(n) || n < 0)
    return null
  const total = Math.floor(n / 60)
  return { d: Math.floor(total / 1440), h: Math.floor((total % 1440) / 60), m: total % 60 }
}

const MOODS = ['happy', 'sad', 'sleepy', 'bored', 'excited', 'angry', 'lonely', 'love', 'calm']

/** The i18n key of a mood the robot reports, or '' for one there is no word for. */
export function moodKey(mood) {
  const m = String(mood || '').trim().toLowerCase()
  return MOODS.includes(m) ? `mrobot.mood.${m}` : ''
}

/** tb-face mood for the name plate. */
export function faceMood(view) {
  if (!view || view.online === false)
    return 'offline'
  const m = String((view.stats && view.stats.mood) || '').toLowerCase()
  if (m === 'happy' || m === 'excited' || m === 'love')
    return 'happy'
  if (m === 'sleepy')
    return 'sleepy'
  if (m === 'sad' || m === 'lonely' || m === 'bored' || m === 'angry')
    return 'confused'
  return 'awake'
}

/** Whole days since the robot was first set up (`created`, epoch seconds), or null. */
export function daysTogether(view, nowMs = Date.now()) {
  const c = Number(view && view.created)
  if (!c)
    return null
  return Math.max(1, Math.floor((nowMs / 1000 - c) / 86400) + 1)
}

/** Area ink of an event (one ink per area): 'danger', 'alarm', 'prayer', 'routine' or ''. */
export function eventInk(event) {
  const type = (event && event.type) || ''
  if (type === 'dropped' || type.endsWith('missed'))
    return 'danger'
  if (type.indexOf('alarm') === 0 || type.indexOf('reminder') === 0)
    return 'alarm'
  if (type.indexOf('prayer') === 0)
    return 'prayer'
  if (type === 'pomodoro_done')
    return 'routine'
  return ''
}

/** High scores as a list: { key, game, value, ms } ('catch_ms' is a time in milliseconds). */
export function highScores(scores) {
  if (!scores || typeof scores !== 'object')
    return []
  return Object.keys(scores).map((key) => {
    const ms = key.endsWith('_ms')
    return { key, game: ms ? key.slice(0, -3) : key, value: scores[key], ms }
  })
}

/** The choice a minutes row shows: the value when it is a preset, else 'custom'. */
export function presetChoice(value, presets, custom = false) {
  if (custom)
    return 'custom'
  return presets.includes(value) ? value : 'custom'
}

/** A number typed in a minutes field: a whole number, or NaN. */
export function typedMinutes(text) {
  const s = String(text ?? '').trim()
  if (!/^\d+$/.test(s))
    return Number.NaN
  return Number(s)
}

/**
 * Has the last change of an area reached TinyBot? The tb-sync state: 'pending' while a save is
 * open or the robot is offline, 'error' after a failed save, else 'applied'.
 */
export function syncState(saving, failed, online) {
  if (saving)
    return 'pending'
  if (failed)
    return 'error'
  if (online === false)
    return 'pending'
  return 'applied'
}
