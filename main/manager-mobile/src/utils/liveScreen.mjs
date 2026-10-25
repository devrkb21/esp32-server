// Live screen: the robot's real OLED, fetched with the user-only MCP tool `self.screen.preview`.
//
// The firmware answers {"width":128,"height":64,"jpeg":"<base64 JPEG>"} (about 2 KB, ~100 ms over
// MQTT). manager-api POST /xiaozhi/device/tools/call/{deviceId} returns that result either
// already parsed, as a JSON string, or as the raw MCP result (JSON text in content[0].text).
//
// The same file lives in manager-web (src/utils/liveScreen.mjs) and manager-mobile
// (src/utils/liveScreen.mjs). Keep the two copies identical.
//
// Pure functions only: no DOM, no Vue, no uni. Timers and the clock are injected so the polling
// can be tested with fake timers.

export const SCREEN_TOOL = 'self.screen.preview'
export const SCREEN_W = 128
export const SCREEN_H = 64
export const DEFAULT_QUALITY = 90
/** Next request this long after the previous answer */
export const POLL_DELAY_MS = 700
/** After this many failures in a row, ask only every BACKOFF_DELAY_MS */
export const BACKOFF_AFTER = 3
export const BACKOFF_DELAY_MS = 5000
/** A frame older than this no longer counts as "live" */
export const LIVE_MAX_AGE_MS = 3000

/** Tool arguments: quality 1..100 (whole number), 90 when missing or not a number */
export function screenToolArgs(quality) {
  const q = Number(quality)
  if (quality === undefined || quality === null || quality === '' || !Number.isFinite(q))
    return { quality: DEFAULT_QUALITY }
  return { quality: Math.min(100, Math.max(1, Math.round(q))) }
}

/** A tool result as data: parsed JSON, the JSON text of an MCP result, or the value itself */
export function parseToolResult(data) {
  if (data === null || data === undefined)
    return null
  if (typeof data === 'string') {
    const text = data.trim()
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        const v = JSON.parse(text)
        // a string holding a whole MCP result
        return v && typeof v === 'object' && Array.isArray(v.content) && !v.isError ? parseToolResult(v) : v
      }
      catch {
        return text
      }
    }
    return text
  }
  if (typeof data === 'object' && Array.isArray(data.content)) {
    const first = data.content[0]
    if (first && first.type === 'text' && typeof first.text === 'string')
      return parseToolResult(first.text)
  }
  return data
}

/** The error text of an MCP error result ({isError: true, content: [{text}]}), else '' */
export function toolErrorText(data) {
  if (!data || typeof data !== 'object' || data.isError !== true)
    return ''
  const first = Array.isArray(data.content) ? data.content[0] : null
  return first && typeof first.text === 'string' ? first.text.trim() : ''
}

const BASE64_RE = /^[A-Z0-9+/]+={0,2}$/i
const DATA_URI_PREFIX = /^data:image\/jpe?g;base64,/i

function dimension(value, fallback) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 && n <= 4096 ? n : fallback
}

/**
 * The screen frame of a `self.screen.preview` result, or null when it is not one.
 * @returns {{width: number, height: number, jpeg: string, src: string} | null}
 */
export function parseScreenFrame(data) {
  if (data && typeof data === 'object' && data.isError === true)
    return null
  const r = parseToolResult(data)
  if (r && typeof r === 'object' && r.isError === true)
    return null
  if (!r || typeof r !== 'object' || typeof r.jpeg !== 'string')
    return null
  const jpeg = r.jpeg.replace(DATA_URI_PREFIX, '').replace(/\s+/g, '')
  if (jpeg.length < 8 || jpeg.length % 4 !== 0 || !BASE64_RE.test(jpeg))
    return null
  return {
    width: dimension(r.width, SCREEN_W),
    height: dimension(r.height, SCREEN_H),
    jpeg,
    src: `data:image/jpeg;base64,${jpeg}`,
  }
}

/** Frame age for "updated …": {key: 'now' | 'seconds' | 'minutes' | 'hours', n} */
export function frameAgeParts(frameAt, now) {
  if (!frameAt)
    return null
  const s = Math.max(0, Math.floor((now - frameAt) / 1000))
  if (s < 2)
    return { key: 'now', n: 0 }
  if (s < 60)
    return { key: 'seconds', n: s }
  if (s < 3600)
    return { key: 'minutes', n: Math.floor(s / 60) }
  return { key: 'hours', n: Math.floor(s / 3600) }
}

/** True while the last answer was a frame and it is still fresh */
export function isLive(state, now) {
  return !!state && state.status === 'live' && !!state.frameAt && now - state.frameAt <= LIVE_MAX_AGE_MS
}

/**
 * Polls the robot's screen one request at a time.
 *
 * It asks only while started, not paused, the component is visible and the page is visible.
 * The next request goes out POLL_DELAY_MS after the previous answer; after BACKOFF_AFTER failures
 * in a row only every BACKOFF_DELAY_MS, until a frame arrives again.
 *
 * status: 'idle' (not asking: stopped or hidden), 'paused', 'connecting' (no answer yet), 'live'
 * (last answer was a frame), 'retrying' (failed, fewer than BACKOFF_AFTER times in a row),
 * 'offline' (backing off). `result` is the last answer's status even while idle or paused.
 *
 * @param {object} options
 * @param {() => Promise<any>} options.fetchFrame resolves with a frame (parseScreenFrame) or rejects
 * @param {(state: object) => void} [options.onUpdate] called with a fresh snapshot on every change
 * @param {{setTimeout: Function, clearTimeout: Function}} [options.timers]
 * @param {() => number} [options.now]
 */
export function createScreenPoller(options) {
  const fetchFrame = options.fetchFrame
  const onUpdate = options.onUpdate || (() => {})
  const timers = options.timers || { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: id => clearTimeout(id) }
  const now = options.now || (() => Date.now())
  const delayMs = options.delayMs ?? POLL_DELAY_MS
  const backoffMs = options.backoffMs ?? BACKOFF_DELAY_MS
  const backoffAfter = options.backoffAfter ?? BACKOFF_AFTER

  let started = false
  let paused = false
  let visible = true
  let pageVisible = true
  let destroyed = false
  let inFlight = false
  let timer = null
  let gen = 0
  const state = {
    status: 'idle',
    frame: null,
    frameAt: 0,
    failures: 0,
    error: null,
    requests: 0,
  }

  function active() {
    return started && !paused && visible && pageVisible && !destroyed
  }

  // status as shown: paused / idle (not asking: hidden or stopped) / the last result
  function snapshot() {
    const status = paused ? 'paused' : active() ? state.status : 'idle'
    return { ...state, status, result: state.status, paused, active: active(), inFlight }
  }

  function emit() {
    onUpdate(snapshot())
  }

  function clearTimer() {
    if (timer !== null) {
      timers.clearTimeout(timer)
      timer = null
    }
  }

  function schedule() {
    clearTimer()
    if (!active() || inFlight)
      return
    const wait = state.failures >= backoffAfter ? backoffMs : delayMs
    timer = timers.setTimeout(() => {
      timer = null
      request()
    }, wait)
  }

  function request() {
    if (!active() || inFlight)
      return
    inFlight = true
    state.requests++
    if (!state.frame && state.failures === 0)
      state.status = 'connecting'
    const my = gen
    emit()
    let p
    try {
      p = Promise.resolve(fetchFrame())
    }
    catch (e) {
      p = Promise.reject(e)
    }
    const fail = (error) => {
      if (my !== gen)
        return
      inFlight = false
      state.failures++
      state.error = error || {}
      state.status = state.failures >= backoffAfter ? 'offline' : 'retrying'
      finish()
    }
    p.then((frame) => {
      if (my !== gen)
        return
      if (!frame || typeof frame !== 'object' || typeof frame.src !== 'string') {
        fail({ noFrame: true })
        return
      }
      inFlight = false
      state.frame = frame
      state.frameAt = now()
      state.failures = 0
      state.error = null
      state.status = 'live'
      finish()
    }, fail)
  }

  function finish() {
    if (active())
      schedule()
    emit()
  }

  /** Asks right away when it may (no request in flight); otherwise just updates the state */
  function kick() {
    clearTimer()
    if (active() && !inFlight)
      request()
    else
      emit()
  }

  return {
    start() {
      if (destroyed || started)
        return
      started = true
      kick()
    },
    stop() {
      started = false
      clearTimer()
      emit()
    },
    pause() {
      if (paused)
        return
      paused = true
      clearTimer()
      emit()
    },
    resume() {
      if (!paused)
        return
      paused = false
      kick()
    },
    /** The component scrolled into / out of view */
    setVisible(v) {
      v = !!v
      if (v === visible)
        return
      visible = v
      if (v) {
        kick()
      }
      else {
        clearTimer()
        emit()
      }
    },
    /** The browser tab / app page became visible or hidden */
    setPageVisible(v) {
      v = !!v
      if (v === pageVisible)
        return
      pageVisible = v
      if (v) {
        kick()
      }
      else {
        clearTimer()
        emit()
      }
    },
    /** Ask now (e.g. a Retry button) without waiting for the back-off */
    retry() {
      kick()
    },
    destroy() {
      destroyed = true
      started = false
      gen++
      inFlight = false
      clearTimer()
    },
    getState: snapshot,
    isActive: active,
  }
}
