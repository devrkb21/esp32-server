// Pure helpers shared by the account screens (sign in, new account, new password, More).
// No Vue, no uni: everything here is covered by authKit.test.mjs.

// Bangladesh is the rule. After +880 a mobile number is 1[3-9] and eight more digits; people
// type it as 1712345678, with the local 0 as 01712345678, or in full as +8801712345678.
export const PHONE_RE = /^1[3-9]\d{8}$/

// Only the digits of what was typed; Bangla digits (০-৯) count as digits.
function phoneDigits(value) {
  return String(value ?? '').replace(/[\u09E6-\u09EF]/g, d => String(d.charCodeAt(0) - 0x09E6)).replace(/\D/g, '')
}

// A Bangladeshi number without the local leading 0 or a typed 880 prefix.
function bdLocal(digits) {
  if (/^8801[3-9]\d{8}$/.test(digits))
    return digits.slice(3)
  if (/^01[3-9]\d{8}$/.test(digits))
    return digits.slice(1)
  return digits
}

// Valid mobile for the area code: the Bangladeshi rule for +880 (the default), a plain length
// check (5 to 15 digits) for any other code the server offers.
export function isPhone(value, areaCode = '+880') {
  const digits = phoneDigits(value)
  if (areaCode === '+880')
    return PHONE_RE.test(bdLocal(digits))
  return /^\d{5,15}$/.test(digits)
}

// The number the server receives: code + digits, without the Bangladeshi local 0
// ('+880', '01712345678' gives '+8801712345678').
export function fullPhone(areaCode, value) {
  let digits = phoneDigits(value)
  if (areaCode === '+880')
    digits = bdLocal(digits)
  return `${areaCode || ''}${digits}`
}

// The country codes the server offers, or Bangladesh alone.
export function areaList(list) {
  return Array.isArray(list) && list.length ? list : [{ name: 'Bangladesh', key: '+880' }]
}

// The code a phone field starts on: Bangladesh when the server offers it, else the first one.
export function defaultAreaCode(list) {
  const items = areaList(list)
  if (items.some(i => i && i.key === '+880'))
    return '+880'
  return (items[0] && items[0].key) || '+880'
}

// Nobix Industries' support contact. It replaces "{{CONTACT}}" in the last sentence of the terms
// and the privacy policy; when empty, that sentence ends without the ": {{CONTACT}}" part.
export const LEGAL_CONTACT = 'support@nobixindustries.com'

// Puts the contact into a sentence, or drops ": {{CONTACT}}" when there is none yet, so the
// sentence ends on its own full stop ('।' in Bangla, '.' in English).
export function withContact(text, contact = LEGAL_CONTACT) {
  const s = String(text ?? '')
  const c = String(contact || '').trim()
  if (c)
    return s.split('{{CONTACT}}').join(c)
  return s.replace(/\s*:\s*\{\{CONTACT\}\}/g, '').split('{{CONTACT}}').join('')
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

// Nobix's terms of use and privacy policy; each page shows Bangla or English by the language.
export function legalPath(page) {
  const p = String(page || '')
  return p === 'privacy' || p === 'privacy-policy' ? '/pages/legal/privacy' : '/pages/legal/terms'
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
