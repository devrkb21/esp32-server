// Robots and their devices: pure helpers (unit tested in robotsModel.test.mjs). The rules come from
// the legacy screens (legacy/pages/index/index.vue, the old pages/device/index.vue) and match
// manager-web src/views/robots/robotsModel.js and src/views/devices/devicesModel.js.
import { codeFromText } from '../../utils/linkCode.mjs'

export const NAME_MAX = 64
export const ALIAS_MAX = 64
export const MAC_RE = /^(?:[0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/i

/**
 * The 6-digit code TinyBot shows: digits only (Bangla digits become 0-9), at most six; the robot's
 * whole link (its QR URL) gives its code.
 */
export function cleanCode(value) {
  return codeFromText(value)
}

export function isValidCode(value) {
  return /^\d{6}$/.test(String(value ?? ''))
}

/** A new character's name: 1 to 64 characters once trimmed (legacy prompt /^.{1,64}$/). */
export function characterNameError(value) {
  const name = String(value ?? '').trim()
  if (!name)
    return 'required'
  if (name.length > NAME_MAX)
    return 'tooLong'
  return ''
}

/** Add by MAC: errors per field ('' when the field is fine). */
export function manualErrors(form) {
  const mac = String(form?.macAddress ?? '').trim()
  return {
    macAddress: !mac ? 'required' : (MAC_RE.test(mac) ? '' : 'invalid'),
    board: form?.board ? '' : 'required',
    appVersion: String(form?.appVersion ?? '').trim() ? '' : 'required',
  }
}

export function hasErrors(errors) {
  return Object.values(errors || {}).some(Boolean)
}

/** Delete a character: the typed name must match exactly. */
export function nameMatches(typed, name) {
  return Boolean(name) && typed === name
}

/**
 * Milliseconds from a device time: the API's Long timestamp sent as a string ("1783689702000"),
 * a number (seconds or ms), an ISO string or 'YYYY-MM-DD HH:mm:ss'. NaN when unknown.
 */
export function parseTime(value) {
  if (value === null || value === undefined || value === '')
    return Number.NaN
  if (typeof value === 'number' || /^\d+$/.test(String(value).trim())) {
    const n = Number(value)
    return n < 1e12 ? n * 1000 : n
  }
  const s = String(value)
  const t = Date.parse(s)
  if (!Number.isNaN(t))
    return t
  return Date.parse(s.replace(' ', 'T'))
}

/**
 * How long ago (the old device page): never, just now (< 1 min), minutes (< 1 h), hours (< 1 day),
 * days (< 7 days), else the date itself.
 */
export function lastSeen(value, now = Date.now()) {
  const at = parseTime(value)
  if (Number.isNaN(at))
    return { kind: 'never' }
  const diff = Math.max(0, now - at)
  if (diff < 60000)
    return { kind: 'just', at }
  if (diff < 3600000)
    return { kind: 'minutes', n: Math.floor(diff / 60000), at }
  if (diff < 86400000)
    return { kind: 'hours', n: Math.floor(diff / 3600000), at }
  if (diff < 604800000)
    return { kind: 'days', n: Math.floor(diff / 86400000), at }
  return { kind: 'date', at }
}

/**
 * The online map of POST /device/bind/{agentId}: a JSON string (or object) keyed by MQTT client
 * id. null when the gateway gave nothing usable (the state is then unknown, not offline).
 */
export function parseStatus(raw) {
  if (raw && typeof raw === 'object')
    return raw
  if (typeof raw !== 'string' || !raw)
    return null
  try {
    const map = JSON.parse(raw)
    return map && typeof map === 'object' ? map : null
  }
  catch {
    return null
  }
}

/** The MQTT client id a robot reports under: board@@@mac@@@mac, with ':' written as '_'. */
export function clientId(device) {
  const mac = device?.macAddress ? device.macAddress.replace(/:/g, '_') : 'unknown'
  const group = device?.board ? device.board.replace(/:/g, '_') : 'GID_default'
  return `${group}@@@${mac}@@@${mac}`
}

/** Online when isAlive is true, or isAlive is null and the client exists. */
export function isOnline(map, device) {
  const info = map && device ? map[clientId(device)] : null
  if (!info)
    return false
  return info.isAlive === true || (info.isAlive === null && info.exists === true)
}

/** One robot of "this robot" (utils/tbRobot) from an agent and one of its devices. */
export function toRobot(agent, device) {
  return {
    deviceId: device.id,
    agentId: agent.id,
    agentName: agent.agentName || '',
    name: device.alias || '',
    macAddress: device.macAddress || '',
    lastConnectedAt: device.lastConnectedAtTimestamp ?? device.lastConnectedAt ?? undefined,
  }
}

/** The robot the account should show after a reload: the saved one when it still exists, else the first. */
export function keepSelection(list, deviceId) {
  if (!list.length)
    return null
  return list.find(r => r.deviceId === deviceId) || list[0]
}

/** "2.5.5" -> "v2.5.5" (a version that already starts with v stays). */
export function versionText(version) {
  if (!version)
    return ''
  return /^v/i.test(version) ? version : `v${version}`
}

/** The robot's volume from its companion view: what it last reported, else the one asked for. */
export function companionVolume(view) {
  const percent = (value) => {
    if (value === null || value === undefined || value === '')
      return null
    const n = Number(value)
    return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n) : null
  }
  const reported = percent(view?.stats?.volume)
  return reported !== null ? reported : percent(view?.settings?.volume)
}

/** The alias to save, or why not: { ok, text, reason: 'tooLong' | 'same' }. */
export function aliasChange(current, value) {
  const text = String(value ?? '').trim()
  if (text.length > ALIAS_MAX)
    return { ok: false, text, reason: 'tooLong' }
  if (text === (current || ''))
    return { ok: false, text, reason: 'same' }
  return { ok: true, text }
}

const VOICE_BN = { Nabanita: 'নবনীতা', Pradeep: 'প্রদীপ', Tanishaa: 'তানিশা', Bashkar: 'ভাস্কর' }

/**
 * The person name of a TTS voice, in plain words: an Edge voice id (bn-BD-NabanitaNeural) becomes
 * its speaker (Nabanita, or নবনীতা in Bangla); any other voice name passes through; '' when none.
 */
export function voiceName(voice, lang) {
  const raw = String(voice ?? '').trim()
  if (!raw)
    return ''
  const parts = raw.split('-')
  let name = raw
  if (parts.length >= 3) {
    const rest = parts.slice(2).join('-')
    const m = /^(.+?)(?:Multilingual)?Neural$/.exec(rest)
    if (m)
      name = m[1]
  }
  return lang === 'bn' && VOICE_BN[name] ? VOICE_BN[name] : name
}
