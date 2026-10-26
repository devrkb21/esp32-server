// Routines, the library and special days on the Day page (pure: no Vue; tested in
// tests/dayVoice.test.mjs). The same rules as manager-mobile src/pages/day/dayVoiceModel.mjs and
// the server (xiaozhi-server core/companion/routines.py, library.py, calendar_days.py): routines
// go to the server as a whole list, library items one at a time, days to remember as a whole
// list. See docs/companion-api.md.

export const MAX_ROUTINES = 10
export const MAX_STEPS = 12
export const MAX_ROUTINE_NAME = 40
export const MAX_PHRASE = 60
export const MAX_SAY = 300
export const MAX_SMART_HOME = 120
export const MAX_TITLE = 60
export const MAX_TEXT = 500
export const MAX_URL = 300
export const MAX_REMEMBER = 30
export const MAX_DAY_NAME = 40

export const TRIGGERS = ['voice', 'time', 'tap']
export const STEP_TYPES = ['say', 'weather', 'prayer_times', 'day_summary', 'alarm_list', 'play', 'command', 'smart_home']
export const NO_ARG_STEPS = ['weather', 'prayer_times', 'day_summary', 'alarm_list']
// Robot commands a step may send (type or type:arg), as the server accepts them
export const COMMAND_PRESETS = ['story', 'lullaby', 'breathe', 'night_light:on', 'night_light:off', 'game:catch', 'pomodoro:25', 'stop']
export const LIBRARY_KINDS = ['story', 'rhyme', 'music', 'recitation']
export const REMEMBER_KINDS = ['birthday', 'anniversary', 'custom']
// Fixed national days the server knows (MM-DD), shown as a note
export const NATIONAL_DAYS = ['02-21', '03-26', '04-14', '12-16']

const HHMM = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const ID = /^[\w-]{1,32}$/
const URL_RE = /^https?:\/\/\S+$/

/** A fresh routine for the editor. */
export function newRoutine() {
  return { name: '', enabled: true, trigger: { type: 'voice', phrase: '', time: '07:00', days: 127 }, steps: [{ type: 'say', arg: '' }] }
}

/** A routine as the server takes it (no editor-only fields; arg empty where it has none). */
export function routinePayload(r) {
  const tr = (r && r.trigger) || {}
  const type = TRIGGERS.includes(tr.type) ? tr.type : 'voice'
  const trigger = { type, phrase: String(tr.phrase || '').trim(), days: tr.days ?? 127 }
  if (type === 'time' || tr.time)
    trigger.time = tr.time
  const out = {
    name: String(r.name || '').trim(),
    enabled: r.enabled !== false,
    trigger,
    steps: (r.steps || []).map(s => ({ type: s.type, arg: NO_ARG_STEPS.includes(s.type) ? '' : String(s.arg || '').trim() })),
  }
  if (r.id)
    out.id = r.id
  return out
}

/**
 * The first problem of a routine, as an i18n key ('' = fine). `libraryIds`: the ids a play step
 * may name (when given).
 */
export function routineProblem(r, libraryIds) {
  const p = routinePayload(r)
  if (!p.name)
    return 'dayVoice.problem.name'
  if (p.name.length > MAX_ROUTINE_NAME)
    return 'dayVoice.problem.nameLong'
  if (p.trigger.type === 'time' && !HHMM.test(p.trigger.time || ''))
    return 'dayVoice.problem.time'
  if (p.trigger.phrase.length > MAX_PHRASE)
    return 'dayVoice.problem.phrase'
  if (!p.steps.length)
    return 'dayVoice.problem.noSteps'
  if (p.steps.length > MAX_STEPS)
    return 'dayVoice.problem.tooManySteps'
  for (const s of p.steps) {
    if (!STEP_TYPES.includes(s.type))
      return 'dayVoice.problem.stepType'
    if (s.type === 'say' && (!s.arg || s.arg.length > MAX_SAY))
      return 'dayVoice.problem.say'
    if (s.type === 'play' && (!ID.test(s.arg) || (libraryIds && !libraryIds.includes(s.arg))))
      return 'dayVoice.problem.play'
    if (s.type === 'command' && !COMMAND_PRESETS.includes(s.arg))
      return 'dayVoice.problem.command'
    if (s.type === 'smart_home' && (!s.arg || s.arg.length > MAX_SMART_HOME))
      return 'dayVoice.problem.smartHome'
  }
  return ''
}

/** The steps with one moved up (-1) or down (+1); unchanged at the ends. */
export function moveStep(steps, i, dir) {
  const j = i + dir
  if (i < 0 || j < 0 || i >= steps.length || j >= steps.length)
    return steps.slice()
  const out = steps.slice()
  const tmp = out[i]
  out[i] = out[j]
  out[j] = tmp
  return out
}

/** How a routine starts, for its row: { key, params } for t(). */
export function triggerText(r) {
  const tr = (r && r.trigger) || {}
  if (tr.type === 'time')
    return { key: 'dayVoice.trigger.atTime', params: { time: tr.time || '', days: tr.days ?? 127 } }
  if (tr.type === 'tap')
    return { key: 'dayVoice.trigger.tapSoon', params: {} }
  return { key: 'dayVoice.trigger.byVoice', params: { phrase: String(tr.phrase || '').trim() || String((r && r.name) || '') } }
}

// ------------------------------------------------------------------ library

/** The first problem of a new library item ('' = fine). `source` is 'link' or 'text'. */
export function libraryProblem(form) {
  const title = String(form.title || '').trim()
  if (!title)
    return 'dayVoice.problem.title'
  if (title.length > MAX_TITLE)
    return 'dayVoice.problem.titleLong'
  if (!LIBRARY_KINDS.includes(form.kind))
    return 'dayVoice.problem.kind'
  if (form.source === 'text') {
    const text = String(form.text || '').trim()
    if (!text)
      return 'dayVoice.problem.text'
    if (text.length > MAX_TEXT)
      return 'dayVoice.problem.textLong'
    return ''
  }
  const url = String(form.url || '').trim()
  if (!URL_RE.test(url) || url.length > MAX_URL)
    return 'dayVoice.problem.url'
  return ''
}

/** The `library.add` body for the server. */
export function libraryPayload(form) {
  const out = { kind: form.kind, title: String(form.title || '').trim() }
  if (form.source === 'text')
    out.text = String(form.text || '').trim()
  else
    out.audio_url = String(form.url || '').trim()
  return out
}

/** Own items first (as the server sends them), then the shared ones; optional kind filter. */
export function libraryOf(view, kind) {
  const items = (view && Array.isArray(view.library) ? view.library : [])
  return kind ? items.filter(i => i.kind === kind) : items.slice()
}

// ------------------------------------------------------------------ special days

/** "MM-DD" from a month (1-12) and a day; '' when the day does not exist (29 Feb is allowed). */
export function monthDay(month, day) {
  const m = Number(month)
  const d = Number(day)
  if (!Number.isInteger(m) || !Number.isInteger(d) || m < 1 || m > 12 || d < 1)
    return ''
  const last = new Date(2024, m, 0).getDate() // 2024 is a leap year
  if (d > last)
    return ''
  return `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** The first problem of a day to remember ('' = fine). */
export function rememberProblem(d) {
  const name = String(d.name || '').trim()
  if (!name)
    return 'dayVoice.problem.dayName'
  if (name.length > MAX_DAY_NAME)
    return 'dayVoice.problem.dayNameLong'
  if (!/^\d{2}-\d{2}$/.test(d.date || '') || !monthDay(d.date.slice(0, 2), d.date.slice(3)))
    return 'dayVoice.problem.date'
  if (!REMEMBER_KINDS.includes(d.kind))
    return 'dayVoice.problem.dayKind'
  return ''
}

/** The remembered days sorted by date, as the server keeps them. */
export function sortRemember(list) {
  return (list || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

/** Days until a "MM-DD" comes round again from `today` (0 = today). */
export function daysUntil(mmdd, today) {
  const m = Number(mmdd.slice(0, 2))
  const d = Number(mmdd.slice(3))
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let next = new Date(today.getFullYear(), m - 1, d)
  if (next.getMonth() !== m - 1) // 29 Feb in a common year: the 28th
    next = new Date(today.getFullYear(), 1, 28)
  if (next < start)
    next = new Date(today.getFullYear() + 1, m - 1, d)
  return Math.round((next.getTime() - start.getTime()) / 86400000)
}

/** The settings.calendar section with defaults. */
export function calendarOf(view) {
  const c = (view && view.settings && view.settings.calendar) || {}
  return { special_days: c.special_days !== false, remember: Array.isArray(c.remember) ? c.remember : [] }
}

/** Is an alarm or reminder a one-time item (a voice timer)? Its date, else ''. */
export function onceDate(item) {
  return item && typeof item.once === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.once) ? item.once : ''
}

/** 'YYYY-MM-DD' as a short local date ('27 Oct' / '২৭ অক্টো'); the text itself when it is not a date. */
export function shortDate(iso, lang) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''))
  if (!m)
    return String(iso || '')
  try {
    return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  }
  catch (e) {
    return String(iso)
  }
}
