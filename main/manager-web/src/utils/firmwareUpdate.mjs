// TinyBot firmware: versions and the "Update now" flow of the companion screens.
//
// How TinyBot updates: at start-up it asks manager-api's OTA endpoint for its version. When a
// newer firmware of type `tinybot` is published in OTA management and the device's Auto update
// switch is on, it reboots into a small updater, installs the new firmware (about a minute,
// offline meanwhile) and boots the new version. The companion command {type: 'update'} makes
// the robot restart now so that the check runs immediately.
//
// The same file lives in manager-web (src/utils/firmwareUpdate.mjs) and manager-mobile
// (src/utils/firmwareUpdate.mjs). Keep the two copies identical.
//
// Pure functions only: no DOM, no Vue, no uni. Timers and the clock are injected so the flow can
// be tested with fake timers.

/** OTA firmware type of TinyBot (FIRMWARE_TYPE dictionary entry) */
export const FIRMWARE_TYPE = 'tinybot'
/** The companion command that restarts TinyBot into its update check */
export const UPDATE_COMMAND = Object.freeze({ type: 'update' })
/** Ask the companion server this often while an update runs */
export const UPDATE_POLL_MS = 5000
/** Give up waiting after this long */
export const UPDATE_TIMEOUT_MS = 4 * 60 * 1000
/**
 * A restart with the same version only counts as "already up to date" once TinyBot has been up
 * this long: the OTA check runs right at start-up, so by then it would have gone to the updater.
 */
export const SETTLE_S = 30

/** Phases of the flow */
export const PHASE = Object.freeze({
  idle: 'idle',
  /** the command is on its way to the server */
  sending: 'sending',
  /** the server queued the command; TinyBot has not picked it up yet */
  sent: 'sent',
  /** TinyBot took the command (or went away) and is restarting / installing */
  waiting: 'waiting',
  /** back with a different version */
  updated: 'updated',
  /** back with the same version: already up to date */
  current: 'current',
  /** not back within UPDATE_TIMEOUT_MS */
  timeout: 'timeout',
  /** the command could not be sent */
  failed: 'failed',
})

const BUSY = [PHASE.sending, PHASE.sent, PHASE.waiting]

/** True while an update is being sent or awaited */
export function isUpdateBusy(state) {
  return !!state && BUSY.includes(state.phase)
}

// ---------------------------------------------------------------------------------- versions

/**
 * Numeric parts of a version: '2.5.5', 'v2.5.5', 'tinybot/2.5.5', '2.5.5-rc1' -> [2, 5, 5].
 * null when there is no version in the text.
 */
export function parseVersion(version) {
  if (version === undefined || version === null)
    return null
  const match = String(version).match(/(\d+(?:\.\d+)*)/)
  if (!match)
    return null
  return match[1].split('.').map(part => Number(part))
}

/**
 * Compare two versions like manager-api does (dot-separated numbers, missing parts = 0):
 * 1 when a is newer, -1 when b is newer, 0 when equal, null when either has no version.
 */
export function compareVersions(a, b) {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa || !pb)
    return null
  const length = Math.max(pa.length, pb.length)
  for (let i = 0; i < length; i++) {
    const x = pa[i] || 0
    const y = pb[i] || 0
    if (x > y)
      return 1
    if (x < y)
      return -1
  }
  return 0
}

/** Version out of a user agent like 'tinybot/2.5.5' ('' when none) */
export function versionFromUserAgent(userAgent) {
  if (!userAgent)
    return ''
  const match = String(userAgent).match(/\/\s*v?(\d+(?:\.\d+)+)/)
  return match ? match[1] : ''
}

/**
 * The firmware TinyBot runs: its own report (stats.fw) first, then the device list's app
 * version, then the version in its user agent. '' when unknown.
 * @param {object|null} view companion view ({stats, user_agent})
 * @param {string} [appVersion] appVersion of the device list (manager-api)
 */
export function currentFirmware(view, appVersion) {
  const fw = view && view.stats && view.stats.fw
  if (fw && parseVersion(fw))
    return String(fw).trim()
  if (appVersion && parseVersion(appVersion))
    return String(appVersion).trim()
  return versionFromUserAgent(view && view.user_agent)
}

function dateValue(value) {
  if (value === undefined || value === null || value === '')
    return Number.NaN
  if (typeof value === 'number')
    return value
  return Date.parse(String(value).replace(' ', 'T'))
}

/**
 * The firmware the server offers TinyBot: like manager-api (getLatestOta), the most recently
 * updated OTA entry of the type. Ties and missing dates fall back to the higher version.
 * @param {Array<object>} list OTA management entries ({type, version, updateDate})
 * @returns {object|null} the entry, or null when none of that type is published
 */
export function latestFirmware(list, type = FIRMWARE_TYPE) {
  if (!Array.isArray(list))
    return null
  let best = null
  for (const item of list) {
    if (!item || item.type !== type || !parseVersion(item.version))
      continue
    if (!best) {
      best = item
      continue
    }
    const a = dateValue(item.updateDate)
    const b = dateValue(best.updateDate)
    if (Number.isFinite(a) && Number.isFinite(b) && a !== b) {
      if (a > b)
        best = item
    }
    else if (compareVersions(item.version, best.version) > 0) {
      best = item
    }
  }
  return best
}

/** true / false when the published version is newer than the current one, null when unknown */
export function updateAvailable(current, latest) {
  const cmp = compareVersions(latest, current)
  return cmp === null ? null : cmp > 0
}

// ------------------------------------------------------------------------------ state machine

export function initialUpdateState() {
  return { phase: PHASE.idle }
}

function statsOf(view) {
  return (view && view.stats) || {}
}

function uptimeOf(view) {
  const raw = statsOf(view).uptime_s
  const n = Number(raw)
  return raw === undefined || raw === null || raw === '' || !Number.isFinite(n) ? null : n
}

/**
 * The server queued the update command.
 * @param {object|null} view the companion view when the command was sent
 * @param {number} now ms
 * @param {object} [extra] {commandId, appVersion}
 */
export function updateSent(view, now, extra = {}) {
  return {
    phase: PHASE.sent,
    sentAt: now,
    commandId: extra.commandId || '',
    fromVersion: currentFirmware(view, extra.appVersion),
    toVersion: '',
    baseStatsAt: view ? view.stats_updated : undefined,
    baseUptime: uptimeOf(view),
    sawOffline: false,
  }
}

/** The command could not be sent */
export function updateFailed(error) {
  return { phase: PHASE.failed, error: error === undefined ? null : error }
}

function commandTaken(view, commandId) {
  if (!commandId || !view || !Array.isArray(view.commands))
    return false
  const cmd = view.commands.find(c => c && c.id === commandId)
  return !!cmd && cmd.status !== 'pending'
}

/**
 * Next state after a fresh companion view (or null when the request failed).
 * - sent -> waiting: TinyBot took the command, went offline or restarted.
 * - -> updated: online with a different version.
 * - -> current: restarted after the command, same version, and up for SETTLE_S.
 * - -> timeout: nothing of that within UPDATE_TIMEOUT_MS.
 */
export function observeUpdate(state, view, now, options = {}) {
  if (!state || (state.phase !== PHASE.sent && state.phase !== PHASE.waiting))
    return state
  const timeoutMs = options.timeoutMs ?? UPDATE_TIMEOUT_MS
  const settleS = options.settleS ?? SETTLE_S
  const elapsed = now - state.sentAt
  const next = { ...state }

  if (view) {
    const online = view.online !== false
    if (!online)
      next.sawOffline = true
    // stats TinyBot sent after the command (not the ones we already had)
    const fresh = view.stats_updated !== undefined && view.stats_updated !== state.baseStatsAt
    const uptime = uptimeOf(view)
    // started after the command: it has been up for less time than has passed since
    const restarted = fresh && uptime !== null && uptime * 1000 < elapsed
    const fw = currentFirmware(view, options.appVersion)

    if (next.phase === PHASE.sent && (!online || restarted || commandTaken(view, state.commandId)))
      next.phase = PHASE.waiting

    if (online && fw && state.fromVersion && compareVersions(fw, state.fromVersion) !== 0) {
      return { ...next, phase: PHASE.updated, toVersion: fw }
    }
    if (online && fresh) {
      const settled = restarted && uptime >= settleS
      // old firmware without uptime: back after having been offline
      const backWithoutUptime = uptime === null && next.sawOffline
      if (settled || backWithoutUptime)
        return { ...next, phase: PHASE.current, toVersion: fw || state.fromVersion }
    }
  }

  if (elapsed >= timeoutMs)
    return { ...next, phase: PHASE.timeout }
  return next
}

// --------------------------------------------------------------------------------- controller

/**
 * Runs the flow: sends the command, then asks for the companion view every pollMs until TinyBot
 * is back (or the time is up).
 * @param {object} options
 * @param {(command: {type: string}) => Promise<any>} options.sendCommand resolves with the queued
 *   command ({id, ...}) or anything
 * @param {() => Promise<object>} options.fetchView resolves with the companion view
 * @param {(state: object) => void} [options.onChange]
 * @param {() => string} [options.appVersion] the device list's app version, if known
 * @param {{setTimeout, clearTimeout}} [options.timers]
 * @param {() => number} [options.now]
 * @param {number} [options.pollMs]
 * @param {number} [options.timeoutMs]
 * @param {number} [options.settleS]
 */
export function createUpdateFlow(options) {
  const sendCommand = options.sendCommand
  const fetchView = options.fetchView
  const onChange = options.onChange || (() => {})
  const appVersion = options.appVersion || (() => '')
  const timers = options.timers || { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: id => clearTimeout(id) }
  const now = options.now || (() => Date.now())
  const pollMs = options.pollMs ?? UPDATE_POLL_MS
  const timeoutMs = options.timeoutMs ?? UPDATE_TIMEOUT_MS
  const settleS = options.settleS ?? SETTLE_S

  let state = initialUpdateState()
  let timer = null
  let gen = 0
  let destroyed = false

  function emit() {
    onChange({ ...state })
  }

  function clearTimer() {
    if (timer !== null) {
      timers.clearTimeout(timer)
      timer = null
    }
  }

  function waiting() {
    return state.phase === PHASE.sent || state.phase === PHASE.waiting
  }

  function apply(view) {
    const before = state.phase
    state = observeUpdate(state, view, now(), { timeoutMs, settleS, appVersion: appVersion() })
    if (!waiting())
      clearTimer()
    if (state.phase !== before || view)
      emit()
  }

  function schedule() {
    clearTimer()
    if (destroyed || !waiting())
      return
    const id = gen
    timer = timers.setTimeout(() => {
      timer = null
      Promise.resolve()
        .then(() => fetchView())
        .then(view => view, () => null)
        .then((view) => {
          if (id !== gen || destroyed || !waiting())
            return
          apply(view || null)
          schedule()
        })
    }, pollMs)
  }

  return {
    get state() {
      return { ...state }
    },
    isBusy() {
      return isUpdateBusy(state)
    },
    /**
     * Send the update command.
     * @param {object|null} view the companion view right now
     * @returns {Promise<boolean>} true when the server queued it
     */
    start(view) {
      if (destroyed || isUpdateBusy(state))
        return Promise.resolve(false)
      const id = ++gen
      clearTimer()
      state = { phase: PHASE.sending }
      emit()
      return Promise.resolve()
        .then(() => sendCommand({ ...UPDATE_COMMAND }))
        .then((res) => {
          if (id !== gen || destroyed)
            return false
          const commandId = res && typeof res === 'object' && res.id ? res.id : ''
          state = updateSent(view, now(), { commandId, appVersion: appVersion() })
          emit()
          schedule()
          return true
        }, (error) => {
          if (id !== gen || destroyed)
            return false
          state = updateFailed(error)
          emit()
          return false
        })
    },
    /** A companion view the page loaded anyway (its own polling) */
    observe(view) {
      if (destroyed || !waiting() || !view)
        return
      apply(view)
    },
    /** Back to idle (closes the result note) */
    reset() {
      gen++
      clearTimer()
      state = initialUpdateState()
      emit()
    },
    destroy() {
      destroyed = true
      gen++
      clearTimer()
    },
  }
}
