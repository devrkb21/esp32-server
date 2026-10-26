// Notifications on the phone: pure helpers (unit tested in notifyModel.test.mjs).

/** The groups an owner can switch on or off, in the order the settings list them. */
export const GROUPS = ['offline', 'alarm', 'reminder', 'care', 'summary', 'family']

const GROUP_OF = {
  robot_offline: 'offline',
  alarm_missed: 'alarm',
  reminder_missed: 'reminder',
  care_no_activity: 'care',
  care_fall: 'care',
  care_medicine: 'care',
  daily_summary: 'summary',
  family_invite: 'family',
  family_joined: 'family',
}

/** The switchable group of a notification type ('' for a test or an unknown type). */
export function groupOf(type) {
  return GROUP_OF[type] || ''
}

/**
 * The ink a notification's square mark takes: alarms and reminders keep their area ink (red),
 * a fall is said in danger, no activity in warn, everything else in the second ink.
 */
export function inkOf(type) {
  if (type === 'alarm_missed' || type === 'reminder_missed' || type === 'care_medicine')
    return 'alarm'
  if (type === 'care_fall')
    return 'danger'
  if (type === 'care_no_activity')
    return 'warn'
  return 'ink-2'
}

/** Title and body in the reader's language, falling back to the other one. */
export function textOf(n, lang) {
  const x = n || {}
  const bn = lang === 'bn'
  return {
    title: (bn ? x.titleBn || x.titleEn : x.titleEn || x.titleBn) || '',
    body: (bn ? x.bodyBn || x.bodyEn : x.bodyEn || x.bodyBn) || '',
  }
}

/** The number on a badge: nothing for 0, "9+" above nine. */
export function badgeCount(n) {
  const v = Number(n) || 0
  if (v <= 0)
    return ''
  return v > 9 ? '9+' : String(v)
}

/** Settings with every group present (missing groups are on). */
export function prefsWithDefaults(p) {
  const src = (p && p.types) || {}
  const types = {}
  for (const g of GROUPS) types[g] = src[g] !== false
  const mins = Number(p && p.offlineMinutes)
  return {
    types,
    offlineMinutes: clampMinutes(Number.isFinite(mins) && mins > 0 ? mins : 30),
    summaryPush: !(p && p.summaryPush === false),
    webPush: (p && p.webPush) || null,
  }
}

/** Offline minutes as the server takes them: 10 to 720. */
export function clampMinutes(v) {
  const n = Math.round(Number(v) || 0)
  return Math.min(720, Math.max(10, n))
}

/** How long ago a time in ms was, as an i18n key and number: justNow, minutes, hours, days, date. */
export function agoOf(ms, now) {
  const t = Number(ms) || 0
  const diff = Math.max(0, (now || Date.now()) - t)
  const m = Math.floor(diff / 60000)
  if (m < 1)
    return { key: 'justNow', n: 0 }
  if (m < 60)
    return { key: 'minutes', n: m }
  const h = Math.floor(m / 60)
  if (h < 24)
    return { key: 'hours', n: h }
  const d = Math.floor(h / 24)
  if (d < 7)
    return { key: 'days', n: d }
  return { key: 'date', n: t }
}

/** The page a notification opens. */
export function targetOf(n) {
  const type = (n && n.type) || ''
  if (type === 'daily_summary')
    return '/pages/summary/index'
  if (type === 'family_invite')
    return '/pages/invitations/index'
  if (type.startsWith('care_') || type === 'family_joined')
    return '/pages/robot/index'
  if (type === 'alarm_missed' || type === 'reminder_missed')
    return '/pages/day/index'
  return ''
}

/** A VAPID key in base64url as the bytes PushManager.subscribe takes. */
export function base64UrlToBytes(text) {
  const s = String(text || '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('binary')
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** A key of a PushSubscription (ArrayBuffer) as base64url. */
export function bytesToBase64Url(buf) {
  const bytes = new Uint8Array(buf || [])
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
