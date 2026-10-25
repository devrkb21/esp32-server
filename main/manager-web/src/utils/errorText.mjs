// What a failed request says to a person (pure: unit tested in tests/errorText.test.mjs).
// The request layer (src/apis/httpRequest.js) cleans every failed answer with it, so every error
// on screen is one plain line in the app's language (keys in src/i18n/pages/request.js), never
// raw server, HTTP or stack text; the raw text goes to the console only. Same rules as
// manager-mobile/src/http/request/errorText.mjs: change both together.

/**
 * The i18n key of an HTTP status (the server answered, but not with 200).
 * @param {number|string} status
 * @returns {string}
 */
export function httpStatusKey(status) {
  const s = Number(status)
  if (s === 401)
    return 'request.sessionEnded'
  if (s === 403)
    return 'request.forbidden'
  if (s === 404)
    return 'request.notFound'
  if (s === 408 || s === 504)
    return 'network.timeout'
  if (s === 413)
    return 'request.tooLarge'
  if (s === 429)
    return 'request.busy'
  if (s >= 500)
    return 'request.server'
  return 'request.failed'
}

/**
 * The i18n key of a request that got no answer at all (uni.request fails with
 * { errMsg: 'request:fail timeout' } and the like). '' for a request the app aborted itself.
 * @param {any} error
 * @returns {string}
 */
export function networkErrorKey(error) {
  const raw = String((error && (error.errMsg || error.message)) || error || '').toLowerCase()
  if (raw.includes('abort'))
    return ''
  if (raw.includes('timeout') || raw.includes('timed out'))
    return 'network.timeout'
  return 'network.unreachable'
}

// Words of server text that is about our infrastructure, not for the person using the app.
const INFRA = /not found|not exist|does not exist|not reachable|unreachable|not configured|internal|companion server|exception|error code|timeout|timed out|unauthori[sz]ed|forbidden|request error|http|sql|null|undefined|stack|failed to|connection|refused|gateway|server error|service unavailable|traceback|java\.|org\.|com\.|\bat\s+\S+\(|token/i

/**
 * The server's own message when it is one meant for people (a short validation answer such as
 * "This name is already used"), otherwise ''. Never infrastructure words, stack traces, markup,
 * JSON, URLs, Chinese text (the app speaks Bangla and English) or long text.
 * @param {any} msg
 * @returns {string}
 */
export function peopleText(msg) {
  if (typeof msg !== 'string')
    return ''
  const s = msg.trim()
  if (!s || s.length > 140)
    return ''
  if (/[\n\r\t{}<>[\]\\]|:\/\//.test(s) || /\p{Script=Han}/u.test(s))
    return ''
  if (INFRA.test(s))
    return ''
  return s
}

/**
 * The i18n key of a business error (HTTP 200 with { code, msg }, code not 0) whose message is not
 * for people. 401 ends the session (handled by the request layer).
 * @param {number|string} code
 * @returns {string}
 */
export function businessKey(code) {
  const c = Number(code)
  if (c === 401)
    return 'request.sessionEnded'
  if (c === 403)
    return 'request.forbidden'
  if (c === 404)
    return 'request.notFound'
  if (c === 408)
    return 'network.timeout'
  if (c === 429)
    return 'request.busy'
  if (c >= 500 && c < 600)
    return 'request.server'
  return 'request.failed'
}

/**
 * What a failed request is, from what alova.ts throws (or rejects with):
 *   Error('Request error [<code>]: <msg>') with { code, serverMsg }  a business error
 *   Error('HTTP request error [<status>]...') with { status }         an HTTP status error
 *   the msg string itself (meta.isExposeError)                        a business error
 *   { errMsg: 'request:fail ...' }                                     no answer at all
 * Returns { kind: 'business'|'http'|'network'|'local', code, status, msg }.
 * @param {any} err
 */
export function readRequestError(err) {
  if (err === null || err === undefined)
    return { kind: 'network', code: null, status: null, msg: '' }
  if (typeof err === 'string')
    return { kind: 'business', code: null, status: null, msg: err }
  if (typeof err !== 'object')
    return { kind: 'local', code: null, status: null, msg: String(err) }
  if (err.status !== undefined && err.status !== null && Number(err.status) !== 200 && /^\d+$/.test(String(err.status)))
    return { kind: 'http', code: null, status: Number(err.status), msg: '' }
  if (err.code !== undefined && err.code !== null && /^\d+$/.test(String(err.code)))
    return { kind: 'business', code: Number(err.code), status: null, msg: String(err.serverMsg ?? err.msg ?? '') }
  const text = String(err.message || err.errMsg || '')
  const m = /^\[?Request error \[(\d+)\]:(.*)$/s.exec(text)
  if (m)
    return { kind: 'business', code: Number(m[1]), status: null, msg: m[2].trim() }
  const h = /HTTP request error \[(\d{3})\]/.exec(text)
  if (h)
    return { kind: 'http', code: null, status: Number(h[1]), msg: '' }
  if (/request:fail|network|timeout/i.test(text) || (!err.message && err.errMsg !== undefined))
    return { kind: 'network', code: null, status: null, msg: text }
  return { kind: 'local', code: null, status: null, msg: text }
}

/**
 * The i18n key, or the server's own people text, for a failed request. `fallbackKey` names what
 * failed in the screen's words ("The robot could not be added") and is used for business errors
 * whose message is not for people and for anything unknown.
 * Returns { key } or { text }.
 * @param {any} err
 * @param {string} fallbackKey
 */
export function requestErrorMessage(err, fallbackKey) {
  const e = readRequestError(err)
  if (e.kind === 'network')
    return { key: networkErrorKey(err) || fallbackKey }
  if (e.kind === 'http')
    return { key: httpStatusKey(e.status) }
  if (e.kind === 'business') {
    const own = peopleText(e.msg)
    if (own)
      return { text: own }
    if (e.code !== null && [401, 403, 404, 408, 429].includes(e.code))
      return { key: businessKey(e.code) }
    return { key: fallbackKey || businessKey(e.code) }
  }
  return { key: fallbackKey || 'request.failed' }
}

/**
 * Has the request layer already shown this error (so a screen must not toast it again)?
 * @param {any} err
 */
export function wasShown(err) {
  return Boolean(err && typeof err === 'object' && err.shown === true)
}
