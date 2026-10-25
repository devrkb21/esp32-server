// Which server the robot should talk to after setup.
//
// TinyBot's firmware has a built-in OTA address (the production server). A robot set up from a LAN
// or test server would otherwise go to production, so the hotspot flow writes the app's own server
// into the robot (POST /advanced/submit {ota_url}). The robot asks that address for its settings,
// so it ends up on the same server as the app. The sound (AFSK) path carries only the Wi-Fi.

/** The firmware's built-in OTA address (CONFIG_OTA_URL). */
export const PRODUCTION_OTA_URL = 'https://esp.czbd.app/xiaozhi/ota/'

// The portal reads the saved address back into a 256-byte buffer (wifi_configuration_ap.cc)
const MAX_OTA_URL = 255

/**
 * OTA address for an app API base URL: the base path plus '/ota/'.
 * 'http://192.168.0.123:18002/xiaozhi' -> 'http://192.168.0.123:18002/xiaozhi/ota/'.
 * A relative base (the H5 dev proxy, '/xiaozhi') resolves against `origin` when given.
 * Returns '' when no absolute http(s) address can be made (the robot then keeps its own).
 * @param {string} base
 * @param {string} [origin]
 * @returns {string}
 */
export function otaUrlFromBase(base, origin = '') {
  let raw = String(base || '').trim()
  if (!raw)
    return ''
  if (!/^https?:\/\//i.test(raw)) {
    if (!origin || !raw.startsWith('/'))
      return ''
    raw = String(origin).replace(/\/+$/, '') + raw
  }
  let u
  try {
    u = new URL(raw)
  }
  catch {
    return ''
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:')
    return ''
  if (!u.hostname)
    return ''
  let path = u.pathname.replace(/\/+$/, '')
  if (!/\/ota$/i.test(path))
    path += '/ota'
  const url = `${u.protocol}//${u.host}${path}/`
  return url.length > MAX_OTA_URL ? '' : url
}

/** Same address apart from case and trailing slashes. */
export function sameOtaUrl(a, b) {
  const norm = s => String(s || '').trim().toLowerCase().replace(/\/+$/, '')
  return Boolean(norm(a)) && norm(a) === norm(b)
}

/** True when the app's server is not the one robots use out of the box. */
export function differsFromProduction(otaUrl) {
  return Boolean(otaUrl) && !sameOtaUrl(otaUrl, PRODUCTION_OTA_URL)
}
