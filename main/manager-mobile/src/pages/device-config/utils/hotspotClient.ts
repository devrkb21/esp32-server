// Client for the robot's Wi-Fi setup hotspot (esp-wifi-connect portal at http://192.168.4.1).
//
// The phone joins the robot's open hotspot ("TinyBot-XXXX"), then this talks to the portal's JSON
// API: GET /scan (nearby networks), GET/POST /pair (match the pattern on the robot's face, see
// pairingUtils.mjs), POST /submit (credentials + pair token), POST /exit (leave setup mode).
//
// Things that break this on the web (H5) build, handled here:
// - An https page may not call http://192.168.4.1 at all (mixed content): detect it and offer the
//   robot's own setup page instead.
// - Older firmware sends no CORS headers: a JSON POST would need a preflight it cannot answer, so
//   credentials go as text/plain (the portal parses the body as JSON regardless), and when even
//   reading a response is blocked we fall back to an opaque `no-cors` request.

import { DEMO, demoBody } from '@/api/demo'
import { t } from '@/i18n'
import { normalizePairState } from './pairingUtils.mjs'

export const PORTAL_URL = 'http://192.168.4.1'

export interface PortalNetwork {
  ssid: string
  rssi: number
  authmode: number
  channel: number
  hidden?: boolean
}

export type PortalStatus = 'ok' | 'opaque' | 'unreachable' | 'blocked'

export interface SubmitResult {
  ok: boolean
  /** Sent, but the browser could not read the answer (older firmware without CORS). */
  unconfirmed?: boolean
  /** The robot wants the pattern on its face matched first (missing or stale pair token). */
  pairRequired?: boolean
  error?: string
}

export interface PairOption {
  id: number
  name: string
  rows: string[]
}

export interface PairState {
  /** False: this robot has no pairing step (no screen, or firmware from before it). */
  required: boolean
  success: boolean
  token: string
  attemptsLeft: number
  lockedMs: number
  options: PairOption[]
}

/** True for the web build (H5). In the demo build the portal is answered from fixtures. */
export function isWeb(): boolean {
  // #ifdef H5
  return true
  // #endif

  return false
}

/** An https page cannot reach the plain-http portal (the browser blocks mixed content). */
export function isBlockedByHttps(): boolean {
  return !DEMO && isWeb() && typeof window !== 'undefined' && window.location.protocol === 'https:'
}

function request<T = any>(options: UniApp.RequestOptions): Promise<UniApp.RequestSuccessCallbackResult & { data: T }> {
  if (DEMO) {
    // Demo build (src/api/demo/pages/m-setup.ts): the portal answers from fixtures, after a pause
    const path = String(options.url || '').replace(PORTAL_URL, '')
    const body = demoBody(path, String(options.method || 'GET'), parseJson(options.data))
    const delay = /\/submit$/.test(path) ? 1800 : 450
    return new Promise(resolve => setTimeout(() => resolve({ statusCode: 200, data: body, header: {}, cookies: [], errMsg: 'ok' } as any), delay))
  }
  return new Promise((resolve, reject) => {
    uni.request({
      ...options,
      success: res => resolve(res as any),
      fail: err => reject(err),
    })
  })
}

function parseJson(data: unknown): any {
  if (typeof data !== 'string')
    return data
  try {
    return JSON.parse(data)
  }
  catch {
    return null
  }
}

/** Reachability check that works without CORS: an opaque response still proves the portal answered. */
async function opaqueReachable(path: string, init: RequestInit, timeoutMs: number): Promise<boolean> {
  if (DEMO || !isWeb() || typeof fetch === 'undefined')
    return false
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
  try {
    await fetch(`${PORTAL_URL}${path}`, { ...init, mode: 'no-cors', cache: 'no-store', signal: controller?.signal })
    return true
  }
  catch {
    return false
  }
  finally {
    if (timer)
      clearTimeout(timer)
  }
}

/** Is the phone connected to the robot's hotspot? */
export async function probePortal(timeoutMs = 3000): Promise<PortalStatus> {
  if (isBlockedByHttps())
    return 'blocked'
  try {
    const res = await request({ url: `${PORTAL_URL}/scan`, method: 'GET', timeout: timeoutMs })
    if (res.statusCode === 200)
      return 'ok'
  }
  catch {
    // fall through to the opaque check (web build talking to firmware without CORS)
  }
  return (await opaqueReachable('/scan', { method: 'GET' }, timeoutMs)) ? 'opaque' : 'unreachable'
}

/** Networks the robot can see, strongest first, one entry per name. */
export async function scanNetworks(timeoutMs = 10000): Promise<PortalNetwork[]> {
  const res = await request({ url: `${PORTAL_URL}/scan`, method: 'GET', timeout: timeoutMs })
  if (res.statusCode !== 200)
    throw new Error(`HTTP ${res.statusCode}`)
  const data = parseJson(res.data)
  const list: any[] = Array.isArray(data?.aps)
    ? data.aps
    : Array.isArray(data?.networks)
      ? data.networks
      : Array.isArray(data)
        ? data
        : null
  if (!list)
    throw new TypeError('Unexpected scan response')
  const best = new Map<string, PortalNetwork>()
  for (const item of list) {
    const ssid = String(item?.ssid ?? '')
    if (!ssid)
      continue
    const net: PortalNetwork = {
      ssid,
      rssi: Number(item.rssi) || -100,
      authmode: Number(item.authmode) || 0,
      channel: Number(item.channel) || 0,
    }
    const prev = best.get(ssid)
    if (!prev || net.rssi > prev.rssi)
      best.set(ssid, net)
  }
  return Array.from(best.values()).sort((a, b) => b.rssi - a.rssi)
}

/**
 * Current pairing challenge; the robot puts the pattern on its face when this is first called.
 * Firmware without the step (404 or an unreadable answer) counts as "not required".
 */
export async function fetchPairState(timeoutMs = 5000): Promise<PairState> {
  try {
    const res = await request({ url: `${PORTAL_URL}/pair`, method: 'GET', timeout: timeoutMs })
    if (res.statusCode === 200)
      return normalizePairState(parseJson(res.data))
  }
  catch {
    // fall through
  }
  return normalizePairState({ required: false })
}

/** Send the pattern the person tapped. A wrong pick comes back with a new challenge (or a lockout). */
export async function answerPairing(id: number, timeoutMs = 5000): Promise<PairState> {
  const res = await request({
    url: `${PORTAL_URL}/pair`,
    method: 'POST',
    header: { 'Content-Type': 'text/plain;charset=UTF-8' },
    data: JSON.stringify({ id }),
    dataType: 'text',
    timeout: timeoutMs,
  })
  if (res.statusCode !== 200)
    throw new Error(`HTTP ${res.statusCode}`)
  return normalizePairState(parseJson(res.data))
}

/**
 * Wi-Fi password rules the robot enforces (WPA2): 8–63 characters, or a 64-digit hex key.
 * Returns an error message, or '' when the password is acceptable.
 */
export function wifiPasswordError(password: string, encrypted: boolean): string {
  if (!encrypted)
    return ''
  const pw = password || ''
  if (pw.length === 64)
    return /^[0-9a-f]{64}$/i.test(pw) ? '' : t('msetup.err.passwordHex')
  if (pw.length < 8 || pw.length > 63)
    return t('msetup.err.passwordLength')
  return ''
}

/** Wi-Fi names are at most 32 bytes (UTF-8). */
export function ssidError(ssid: string): string {
  const bytes = new TextEncoder().encode(ssid || '').length
  if (!bytes)
    return t('msetup.err.chooseNetwork')
  return bytes > 32 ? t('msetup.err.ssidLong') : ''
}

function friendlyPortalError(raw: string): string {
  if (/connect to the access point/i.test(raw))
    return t('msetup.err.couldNotJoin')
  if (/invalid ssid/i.test(raw))
    return t('msetup.err.ssidLong')
  return raw || t('msetup.err.failed')
}

/**
 * Send the home Wi-Fi to the robot. The robot tries to join before it answers, so this can take
 * up to ~15 s; a wrong password comes back as an error instead of a silent failure.
 */
export async function submitCredentials(ssid: string, password: string, hidden = false, pairToken = ''): Promise<SubmitResult> {
  const body = JSON.stringify({ ssid, password: password || '', hidden, pair_token: pairToken })
  try {
    const res = await request({
      url: `${PORTAL_URL}/submit`,
      method: 'POST',
      // text/plain keeps this a "simple" request: no CORS preflight for firmware that has none
      header: { 'Content-Type': 'text/plain;charset=UTF-8' },
      data: body,
      dataType: 'text',
      timeout: 25000,
    })
    const data = parseJson(res.data)
    if (res.statusCode === 200 && data?.success)
      return { ok: true }
    if (data?.pair_required)
      return { ok: false, pairRequired: true, error: t('msetup.err.failed') }
    return { ok: false, error: friendlyPortalError(data?.error || (res.statusCode !== 200 ? `HTTP ${res.statusCode}` : '')) }
  }
  catch (err: any) {
    // Web build + firmware without CORS: the request may have reached the robot even though the
    // browser hides the answer. Send it opaquely and let the user watch the robot.
    if (isWeb() && await opaqueReachable('/submit', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body }, 25000))
      return { ok: true, unconfirmed: true }
    const msg = String(err?.errMsg || err?.message || '')
    return { ok: false, error: /timeout/i.test(msg) ? t('msetup.err.slow') : t('msetup.err.notOnHotspot') }
  }
}

/** Leave setup mode so the robot reconnects as a normal device (best effort). */
export async function exitPortal(): Promise<void> {
  try {
    await request({
      url: `${PORTAL_URL}/exit`,
      method: 'POST',
      header: { 'Content-Type': 'text/plain;charset=UTF-8' },
      data: '{}',
      timeout: 5000,
    })
  }
  catch {
    if (isWeb())
      await opaqueReachable('/exit', { method: 'POST', body: '{}' }, 5000)
  }
}
