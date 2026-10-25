// Pure helpers shared by the account screens (sign in, new account, new password, More).
// No Vue, no uni: everything here is covered by authKit.test.mjs.

// The phone rule the old screens used (mainland China mobile format), kept as it was.
export const PHONE_RE = /^1[3-9]\d{9}$/

export function isPhone(value) {
  return PHONE_RE.test(String(value ?? ''))
}

// The country codes the server offers; the old screens fell back to one entry.
export function areaList(list) {
  return Array.isArray(list) && list.length ? list : [{ name: 'Mainland China', key: '+86' }]
}

// The code a phone field starts on: Bangladesh when the server offers it, else the first one.
export function defaultAreaCode(list) {
  const items = areaList(list)
  if (items.some(i => i && i.key === '+880'))
    return '+880'
  return (items[0] && items[0].key) || '+86'
}

// A fresh id for each picture code (same format as before).
export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// TinyBot wakes up as the form fills: asleep while empty, awake once anything is typed,
// happy after a success, puzzled after an error (until the next keystroke).
export function faceMood({ filled = 0, outcome = '' } = {}) {
  if (outcome === 'ok')
    return 'happy'
  if (outcome === 'error')
    return 'confused'
  return filled > 0 ? 'awake' : 'sleepy'
}

export function filledCount(values) {
  return (values || []).filter(v => String(v ?? '').trim() !== '').length
}

// The agreement and privacy pages: Chinese for zh_CN, English for every other language (as before).
export function legalPath(page, lang) {
  return `/pages/login/${page}-${lang === 'zh_CN' ? 'zh' : 'en'}`
}

// "By signing in you accept the {terms} and the {privacy}." split into text and link pieces.
export function legalParts(sentence) {
  const out = []
  const re = /\{(terms|privacy)\}/g
  const s = String(sentence || '')
  let at = 0
  let m = re.exec(s)
  while (m) {
    if (m.index > at)
      out.push({ text: s.slice(at, m.index) })
    out.push({ link: m[1] })
    at = m.index + m[0].length
    m = re.exec(s)
  }
  if (at < s.length)
    out.push({ text: s.slice(at) })
  return out
}

// The server answered with one of its error codes (the old screens read them from the message).
export function hasCode(error, code) {
  return String((error && error.message) || '').includes(String(code))
}

// Server address: trimmed, without trailing slashes; valid when it is a full http(s) address.
export function normalizeServerUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '')
}

export function isValidServerUrl(url) {
  return /^https?:\/\/\S+$/i.test(String(url || ''))
}

// uni.getStorageInfoSync() reports kilobytes; the screen shows megabytes with two decimals.
export function storageMb(kb) {
  const n = Number(kb)
  return (Number.isFinite(n) && n > 0 ? n / 1024 : 0).toFixed(2)
}
