// The robot's connection, as one honest status (pure: unit tested in robotConnection.test.mjs).
// The same rules live in manager-web/src/shell/connection.mjs: change both together. Only
// companionErrorKind differs, to read how alova (src/http/request/alova.ts) fails.
//
// Two servers know about a robot, and they can disagree:
//   (a) the MQTT gateway: is the robot connected right now? (POST /device/bind/{agentId} map)
//   (b) the companion API (xiaozhi-server, through manager-api GET /device/companion/{id}): has the
//       robot ever reached it, and when did it last sync (`last_seen`, epoch seconds; the robot
//       syncs every ~30 s and reports at least every minute)?
// Products without the companion module only have (a).
//
// States (one word, one line of explanation and one next step each, see src/i18n/pages/shell.js):
//   checking            nothing known yet
//   online              all good
//   waiting_companion   on MQTT, but the companion server has no record of it yet ('device not found')
//   not_syncing         known to the companion server, on MQTT, but its last sync is old
//   offline             not connected (with the last time it was seen, when known)
//   server_error        our server failed (or could not be reached), so nothing can be said

export const STATES = ['checking', 'online', 'waiting_companion', 'not_syncing', 'offline', 'server_error']

/** A sync older than this (seconds) means the robot is not syncing any more. */
export const STALE_S = 180

/** manager-api error codes (xiaozhi.common.exception.ErrorCode). */
export const CODE_DEVICE_NOT_EXIST = 10194
export const CODE_FEATURE_NOT_SUPPORTED = 10211

/**
 * What a failed companion call means:
 *   'not_registered'  xiaozhi-server answered 404 "device not found" (manager-api forwards it as
 *                     { code: 500, msg: 'device not found' }): the robot never reached it
 *   'no_companion'    the robot's product has no companion module (code 10211)
 *   'server'          any other answer from our servers (companion server down or not configured,
 *                     internal error, the device unknown to manager-api, an HTTP error status)
 *   'network'         no answer at all (the phone could not reach manager-api)
 * alova (src/http/request/alova.ts) fails with Error('Request error [<code>]: <msg>') for a body
 * whose code is not 0, Error('<text> [<status>]...') or Error('<text>：<errMsg>') for an HTTP error
 * status, the msg string itself with meta.isExposeError, and the uni.request failure
 * ({ errMsg: 'request:fail ...' }) when nothing answered. A plain { code, msg } body is read too.
 */
export function companionErrorKind(err) {
  if (err === null || err === undefined)
    return 'network'
  let code
  let msg = ''
  if (typeof err === 'string') {
    msg = err
    code = 'exposed'
  }
  else if (typeof err === 'object') {
    const body = err.data && typeof err.data === 'object' && 'code' in err.data ? err.data : ('code' in err ? err : null)
    if (body && body.code !== undefined && body.code !== null && /^\d+$/.test(String(body.code))) {
      code = Number(body.code)
      msg = String(body.msg || body.message || '')
    }
    else {
      const text = String(err.message || '')
      const m = /^Request error \[(\d+)\]:/.exec(text)
      if (m) {
        code = Number(m[1])
        msg = text.slice(m[0].length).trim()
      }
      else if (/\[\d{3}\]|：/.test(text) && !/request:fail/i.test(text)) {
        return 'server'
      }
    }
  }
  if (code === undefined)
    return 'network'
  if (/device not found/i.test(msg))
    return 'not_registered'
  if (code === CODE_FEATURE_NOT_SUPPORTED)
    return 'no_companion'
  return 'server'
}

/** The raw server text of an error (for the console only, never the screen). */
export function rawErrorText(err) {
  if (!err)
    return ''
  if (typeof err === 'string')
    return err
  if (err.data && typeof err.data === 'object' && err.data.msg)
    return String(err.data.msg)
  return String(err.msg || err.message || err.errMsg || '')
}

/** Milliseconds from epoch seconds, epoch ms, an ISO string or 'YYYY-MM-DD HH:mm:ss' (NaN when unknown). */
export function toMs(value) {
  if (value === null || value === undefined || value === '' || value === 0 || value === '0')
    return Number.NaN
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const n = Number(value)
    return n < 1e12 ? n * 1000 : n
  }
  const s = String(value)
  const t = Date.parse(s)
  return Number.isNaN(t) ? Date.parse(s.replace(' ', 'T')) : t
}

/**
 * The connection status of one robot.
 *   hasCompanion     does its product have the companion module?
 *   mqtt             true / false from the gateway map; null when the map is not available;
 *                    undefined when it was not asked yet
 *   companion        undefined (not asked yet), { ok: true, view } or { ok: false, kind } (kind from
 *                    companionErrorKind)
 *   lastConnectedAt  the device list's last connection time (any format toMs reads)
 * Returns { state, lastSeen (ms or null: the latest of both servers), lastSync (ms or null: the
 * companion server's last sync), reason } where reason says which rule decided it.
 * @param {{ hasCompanion?: boolean, mqtt?: boolean | null, companion?: any, lastConnectedAt?: any, now?: number }} [input]
 * @returns {{ state: string, lastSeen: number | null, lastSync: number | null, reason: string }}
 */
export function connectionOf({ hasCompanion = true, mqtt, companion, lastConnectedAt = null, now = Date.now() } = {}) {
  const view = companion && companion.ok ? companion.view || {} : null
  const seenS = view ? Number(view.last_seen) || 0 : 0
  const times = [toMs(lastConnectedAt), seenS ? seenS * 1000 : Number.NaN].filter(t => !Number.isNaN(t))
  const lastSeen = times.length ? Math.max(...times) : null
  const lastSync = seenS ? seenS * 1000 : null
  const out = (state, reason) => ({ state, lastSeen, lastSync, reason })

  // Products without the companion module: the gateway is all there is.
  if (!hasCompanion || (companion && !companion.ok && companion.kind === 'no_companion')) {
    if (mqtt === true)
      return out('online', 'mqtt')
    if (mqtt === false || mqtt === null)
      return out('offline', mqtt === null ? 'no-map' : 'mqtt')
    return out('checking', 'mqtt-pending')
  }

  if (!companion) {
    if (mqtt === false)
      return out('offline', 'mqtt')
    return out('checking', 'companion-pending')
  }

  if (!companion.ok) {
    if (companion.kind === 'not_registered') {
      return mqtt === false ? out('offline', 'never-reached') : out('waiting_companion', 'not-registered')
    }
    return out('server_error', companion.kind === 'network' ? 'network' : 'server')
  }

  // The companion view is here: the robot reached the companion server at least once. Its own
  // `online` (last sync under 90 s) or a sync under STALE_S means it is syncing now.
  const age = seenS ? now / 1000 - seenS : Infinity
  if (view.online === true || age < STALE_S)
    return out('online', 'fresh-sync')
  if (mqtt === true)
    return out('not_syncing', 'stale-sync')
  return out('offline', 'stale-sync')
}

/** List screens ask a robot's companion view at most this often (ms) ... */
export const COMPANION_EVERY_MS = 30000
/** ... and at most this many at a time. */
export const COMPANION_MAX = 8

/**
 * Which companion views a list screen (Robots, a character's robots) asks for its statuses: the
 * gateway alone cannot say "online", so it asks the companion robots the gateway calls online or
 * cannot say (mqtt true or null; offline robots need no call), each at most every
 * COMPANION_EVERY_MS and at most COMPANION_MAX at a time.
 * @param {Array<{ id: string, hasCompanion: boolean, mqtt?: boolean | null, askedAt?: number }>} devices
 * @param {number} [now]
 * @returns {string[]} the ids to ask
 */
export function companionsToAsk(devices, now = Date.now()) {
  return (devices || [])
    .filter(d => d && d.id && d.hasCompanion && (d.mqtt === true || d.mqtt === null))
    .filter(d => now - (Number(d.askedAt) || 0) >= COMPANION_EVERY_MS)
    .slice(0, COMPANION_MAX)
    .map(d => d.id)
}

/** Is the robot reachable enough that what you send is done right away? */
export function isLive(state) {
  return state === 'online'
}

/** Should a page keep asking (the robot is on its way to the companion server)? */
export function shouldPoll(state) {
  return state === 'waiting_companion'
}

/** The i18n keys of a state: label, explanation, next step (in src/i18n/pages/shell.js). */
export function statusKeys(state, reason) {
  const s = STATES.includes(state) ? state : 'checking'
  const why = s === 'server_error' && reason === 'network' ? 'status.server_error.whyNetwork' : `status.${s}.why`
  return { label: `status.${s}.label`, why, next: `status.${s}.next` }
}

/** The ink of a state's mark: ok (green), warn (ochre), danger, or ink-2 (grey). */
export function statusInk(state) {
  if (state === 'online')
    return 'ok'
  if (state === 'waiting_companion' || state === 'not_syncing')
    return 'warn'
  if (state === 'server_error')
    return 'danger'
  return 'ink-2'
}
