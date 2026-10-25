// Linking a robot to the account: the 6-digit code it shows, the link its QR carries
// (`<server>/#/link?code=123456`), the "come back after sign-in" page, and what to do with the
// owner's characters. Pure helpers, unit tested in linkCode.test.mjs. Same rules as manager-web
// src/utils/linkCode.js.

const BN_DIGITS = '০১২৩৪৫৬৭৮৯'

/** Bangla (০-৯) and full-width (０-９) digits as ASCII digits; everything else unchanged. */
export function asciiDigits(text) {
  return Array.from(String(text ?? ''), (ch) => {
    const bn = BN_DIGITS.indexOf(ch)
    if (bn >= 0)
      return String(bn)
    const wide = ch.charCodeAt(0) - 0xFF10
    return wide >= 0 && wide <= 9 ? String(wide) : ch
  }).join('')
}

// Looks like a link rather than a typed code: a scheme, a "www." host or a hash route.
const URL_LIKE = /^(?:[a-z][a-z0-9+.-]*:\/\/|www\.)|\/#\/|^#?\/link\b/i

/**
 * The code as far as it is typed (0 to 6 digits) from whatever was typed or pasted: digits with
 * spaces or dashes, Bangla digits, or the robot's whole link. A link without a code gives ''.
 */
export function codeFromText(text) {
  const s = asciiDigits(text).trim()
  const param = s.match(/[?&#]code=([\d\s-]+)/i)
  if (param)
    return param[1].replace(/\D/g, '').slice(0, 6)
  if (URL_LIKE.test(s))
    return ''
  return s.replace(/\D/g, '').slice(0, 6)
}

/** The complete 6-digit code in the text, or '' when there is none. */
export function linkCodeOf(text) {
  const code = codeFromText(text)
  return /^\d{6}$/.test(code) ? code : ''
}

/**
 * What a scanned QR means: our link (any host, `.../link?code=123456`) or a bare 6-digit code give
 * the code; anything else (another app's QR, a Wi-Fi QR, a link without a code) gives ''.
 */
export function codeFromScan(result) {
  const s = asciiDigits(result).trim()
  if (/^\d{6}$/.test(s))
    return s
  const m = s.match(/^\S*?\/link\?(?:[^#\s]*&)?code=(\d{6})(?:[&#]\S*)?$/i)
  return m ? m[1] : ''
}

/** The app's link page for a code. */
export function linkPagePath(code) {
  return code ? `/pages/link/index?code=${code}` : '/pages/link/index'
}

const AUTH_PAGES = /^\/pages\/(?:login|register|forgot-password)\//

/**
 * Where to go after signing in, from a `redirect` page option (possibly URI-encoded): only a page
 * of this app (`/pages/...`), never a sign-in page (that would loop), never anything else.
 * Returns `fallback` when the value is not safe.
 */
export function safePagePath(raw, fallback = '') {
  if (typeof raw !== 'string' || !raw)
    return fallback
  let s = raw.trim()
  try {
    if (/%2F|%3F|%3D/i.test(s))
      s = decodeURIComponent(s)
  }
  catch {
    return fallback
  }
  if (!/^\/pages\/[\w-]+(?:\/[\w-]+)*(?:\?[\w%.=&-]*)?$/.test(s))
    return fallback
  if (s.length > 300 || AUTH_PAGES.test(s))
    return fallback
  return s
}

/** With 0 or 1 characters the robot is linked right away; with more, the owner picks one. */
export function linkPlan(agentCount) {
  return Number(agentCount) > 1 ? 'choose' : 'auto'
}

/** The server's error code from a request error ("Request error [10213]: ..."), or 0. */
export function errorCodeOf(error) {
  const text = typeof error === 'string' ? error : (error && error.message) || ''
  const m = String(text).match(/\[(\d{3,6})\]/)
  return m ? Number(m[1]) : 0
}

/** What went wrong, from the server's error code (see ErrorCode.java). */
export function linkErrorKind(code) {
  switch (Number(code)) {
    case 10212: return 'format'
    case 10213: case 10061: case 10062: return 'expired'
    case 10063: return 'taken'
    case 10214: return 'choose'
    case 10169: return 'denied'
    case 401: return 'auth'
    default: return 'failed'
  }
}
