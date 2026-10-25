// Messages and conversations (owner: m-messages): pure helpers, no uni / Vue imports, tested with
// `node --test src/pages/messages/messagesModel.test.mjs`. Same rules as manager-web
// src/views/messages/messagesModel.js, with the phone app's legacy numbers (10 sessions a page,
// a time mark after a pause of 5 minutes).
import { digits } from '../../utils/calendar.mjs'

export const MAX_MESSAGE = 300 // legacy composer: 300 characters
export const MAX_NAME = 32 // legacy "from" field: 32 characters
export const MAX_TOPIC = 64 // legacy story topic: 64 characters
export const SESSIONS_PAGE = 10 // legacy chat history page size
export const TIME_GAP_MS = 5 * 60 * 1000 // legacy detail: a time mark after a 5 minute pause
export const TOOL_FOLD = 80 // tool results longer than this start folded

/** Epoch seconds of a message (`ts` from the API; `created` in older snapshots). */
export function messageTs(m) {
  return Number((m && (m.ts || m.created)) || 0)
}

/** Newest first. */
export function sortMessages(list) {
  return [...(list || [])].sort((a, b) => messageTs(b) - messageTs(a))
}

/** pending | delivered | seen | yes | no: an answer wins over the delivery status (legacy rule). */
export function statusOf(m) {
  if (m && ['yes', 'no', 'seen'].includes(m.answer))
    return m.answer
  return m && m.status === 'delivered' ? 'delivered' : 'pending'
}

/** The tb-sync rule of a message: dashed while it waits, solid once TinyBot has it. */
export function syncOf(m) {
  return statusOf(m) === 'pending' ? 'pending' : 'applied'
}

/** The tb-sync rule of a command: done is solid, anything else waits. */
export function commandSync(c) {
  return c && c.status === 'done' ? 'applied' : 'pending'
}

/** "just now", "5 min ago"... as an i18n key and its number (legacy agoParts). */
export function agoParts(ts, nowMs = Date.now()) {
  if (!ts)
    return { key: 'never', n: 0 }
  const s = Math.max(0, Math.floor(nowMs / 1000 - ts))
  if (s < 60)
    return { key: 'justNow', n: 0 }
  if (s < 3600)
    return { key: 'minutesAgo', n: Math.floor(s / 60) }
  if (s < 86400)
    return { key: 'hoursAgo', n: Math.floor(s / 3600) }
  return { key: 'daysAgo', n: Math.floor(s / 86400) }
}

/** Focus minutes of the "Focus" command: the saved work minutes, else 25 (legacy rule). */
export function focusMinutes(pomodoro) {
  const work = Number(pomodoro && pomodoro.work_min)
  return work > 0 ? work : 25
}

/**
 * The text of a chat line. The server stores plain text, a JSON object with `content`
 * (and maybe `speaker`), or a JSON array of parts [{ type: text|tool|tool_result, text }].
 * Returns { parts: [{ type, text }], speaker }.
 */
export function lineContent(content) {
  const raw = content == null ? '' : String(content)
  if (raw.trim()) {
    try {
      const v = JSON.parse(raw)
      if (Array.isArray(v)) {
        return { speaker: '', parts: v.map(p => ({ type: (p && p.type) || 'text', text: p && p.text != null ? String(p.text) : '' })) }
      }
      if (v && typeof v === 'object' && v.content) {
        return { speaker: v.speaker ? String(v.speaker) : '', parts: [{ type: 'text', text: String(v.content) }] }
      }
    }
    catch (e) { /* plain text */ }
  }
  return { speaker: '', parts: [{ type: 'text', text: raw }] }
}

/** A folded long tool result: its first line, an ellipsis when something was cut. */
export function firstLine(text, max = TOOL_FOLD) {
  if (!text)
    return ''
  const s = String(text)
  let line = s.split('\n')[0]
  if (line.trim().length < 12)
    line = s.replace(/\s+/g, ' ').trim()
  if (line.length > max)
    line = line.slice(0, max).trimEnd()
  return line.length < s.length ? `${line}...` : s
}

/** Who said a line: 'person' (chatType 1), 'tool' (chatType 3) or 'bot'. */
export function speakerOf(line) {
  const t = Number(line && line.chatType)
  if (t === 1)
    return 'person'
  if (t === 3)
    return 'tool'
  return 'bot'
}

/** "2026-10-25 10:30:00" or ISO to a Date (Safari needs the T). */
export function toDate(value) {
  if (value instanceof Date)
    return value
  return new Date(String(value || '').replace(' ', 'T'))
}

/**
 * Lines with time marks: one before the first line and one wherever the next line comes at
 * least `gap` after the previous one (oldest line first).
 */
export function withTimeMarks(lines, gap = TIME_GAP_MS) {
  const out = [];
  (lines || []).forEach((line, i) => {
    const at = toDate(line.createdAt).getTime()
    const prev = i > 0 ? toDate(lines[i - 1].createdAt).getTime() : Number.NaN
    if (i === 0 || (at - prev >= gap))
      out.push({ mark: true, at: line.createdAt, key: `t-${i}` })
    out.push({ mark: false, line, index: i, key: `l-${i}` })
  })
  return out
}

function locale(lang) {
  return lang === 'bn' ? 'bn-BD' : String(lang || 'en').replace('_', '-')
}

function hhmm(d, lang) {
  return digits(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, lang)
}

/** 'today' | 'yesterday' | 'older' for a date, against `now`. */
export function dayWord(date, now = new Date()) {
  const d = toDate(date)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (d >= start)
    return 'today'
  const y = new Date(start)
  y.setDate(y.getDate() - 1)
  return d >= y ? 'yesterday' : 'older'
}

/** The parts of a dated row: { day: '২৫', month: 'অক্টো', time: '১০:৩০', word }. */
export function dateParts(value, lang, now = new Date()) {
  const d = toDate(value)
  if (Number.isNaN(d.getTime()))
    return { day: '', month: '', time: '', word: 'older' }
  let month = ''
  try {
    month = new Intl.DateTimeFormat(locale(lang), { month: 'short' }).format(d)
  }
  catch (e) { month = String(d.getMonth() + 1) }
  return { day: digits(d.getDate(), lang), month: digits(month, lang), time: hhmm(d, lang), word: dayWord(d, now) }
}

/** A full stamp: "আজ ১০:৩০", "গতকাল ২১:০৫" or "২৩ অক্টোবর ২০২৬, ১০:৩০"; '' when unreadable. */
export function stampText(value, lang, words, now = new Date()) {
  const d = toDate(value)
  if (Number.isNaN(d.getTime()))
    return ''
  const w = dayWord(d, now)
  if (w !== 'older')
    return `${words[w]} ${hhmm(d, lang)}`
  let date = ''
  try {
    date = new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
  }
  catch (e) { date = d.toDateString() }
  return `${digits(date, lang)}, ${hhmm(d, lang)}`
}

/** The clock of an epoch-seconds stamp, with its short date when it is not today or yesterday. */
export function messageWhen(ts, lang, now = new Date()) {
  if (!ts)
    return { time: '', date: '', word: 'older' }
  const d = new Date(Number(ts) * 1000)
  if (Number.isNaN(d.getTime()))
    return { time: '', date: '', word: 'older' }
  const w = dayWord(d, now)
  let date = ''
  if (w === 'older') {
    try {
      date = digits(new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short' }).format(d), lang)
    }
    catch (e) { date = '' }
  }
  return { time: hhmm(d, lang), date, word: w }
}

/** Append a page of sessions (no duplicates when a page is fetched twice). */
export function mergeSessions(list, page) {
  const seen = new Set((list || []).map(s => s.sessionId))
  return [...(list || []), ...(page || []).filter(s => !seen.has(s.sessionId))]
}

/**
 * The legacy refresh on return: the fresh first page replaces the first `size` rows, the
 * older pages already loaded stay below it.
 */
export function refreshFirstPage(list, page, size = SESSIONS_PAGE) {
  const rest = (list || []).slice(size)
  return mergeSessions(page || [], rest)
}
