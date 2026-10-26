// Daily summary on the phone: pure helpers for the screen and its two small charts (unit tested
// in summaryModel.test.mjs). Rows come newest first from GET /summary/device/{id}.

/** The moods the robot reports (stats.mood), as i18n keys. */
export const MOODS = ['happy', 'excited', 'curious', 'shy', 'sad', 'annoyed', 'sleepy', 'affectionate', 'neutral']

export function moodKey(mood) {
  const k = String(mood || '').trim().toLowerCase()
  return MOODS.includes(k) ? k : ''
}

/** YYYY-MM-DD of a local date. */
export function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * The last `days` calendar days ending `today` (oldest first), each with its row or null, so the
 * charts keep a day without a summary as a gap instead of closing it up.
 */
export function timeline(rows, days, today) {
  const byDay = new Map((rows || []).filter(r => r && r.day).map(r => [r.day, r]))
  const end = today instanceof Date ? new Date(today) : new Date()
  const out = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i)
    const day = isoDay(d)
    out.push({ day, row: byDay.get(day) || null })
  }
  return out
}

/** A nice axis range around the values (whole tens), at least 10 wide. */
export function axisRange(values) {
  const v = (values || []).filter(x => typeof x === 'number' && Number.isFinite(x))
  if (!v.length)
    return { min: 0, max: 100 }
  let min = Math.floor(Math.min(...v) / 10) * 10
  let max = Math.ceil(Math.max(...v) / 10) * 10
  if (max - min < 10) {
    max = min + 10
  }
  if (min < 0)
    min = 0
  return { min, max }
}

/**
 * The bond line in a box W x H (px): points (x, y) of the days that have a score, and the
 * segments between neighbouring days that both have one (a missing day breaks the line).
 * A segment is drawn as a 2px rule rotated about its left end: { x, y, length, angle (deg) }.
 */
export function bondLine(days, W, H) {
  const n = (days || []).length
  const values = days.map(d => (d.row && typeof d.row.bondScore === 'number' ? d.row.bondScore : null))
  const range = axisRange(values)
  const step = n > 1 ? W / (n - 1) : 0
  const yOf = v => H - ((v - range.min) / (range.max - range.min || 1)) * H
  const points = []
  values.forEach((v, i) => {
    if (v !== null)
      points.push({ i, day: days[i].day, value: v, x: n > 1 ? i * step : W / 2, y: yOf(v) })
  })
  const segments = []
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1]
    const b = points[k]
    if (b.i !== a.i + 1)
      continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    segments.push({ x: a.x, y: a.y, length: Math.sqrt(dx * dx + dy * dy), angle: (Math.atan2(dy, dx) * 180) / Math.PI })
  }
  return { range, points, segments }
}

/** Focus bars: one per day, height as a share (0..1) of the busiest day. */
export function focusBars(days) {
  const mins = (days || []).map(d => (d.row ? Math.max(0, Number(d.row.focusMinutes) || 0) : 0))
  const max = Math.max(0, ...mins)
  return {
    max,
    bars: (days || []).map((d, i) => ({ day: d.day, minutes: mins[i], share: max ? mins[i] / max : 0, has: Boolean(d.row) })),
  }
}

/** Totals over the rows shown. */
export function totals(rows) {
  const t = { talkCount: 0, focusMinutes: 0, remindersDone: 0, remindersMissed: 0, days: 0 }
  for (const r of rows || []) {
    if (!r)
      continue
    t.days++
    t.talkCount += Number(r.talkCount) || 0
    t.focusMinutes += Number(r.focusMinutes) || 0
    t.remindersDone += Number(r.remindersDone) || 0
    t.remindersMissed += Number(r.remindersMissed) || 0
  }
  return t
}

/** The summary text in the reader's language. */
export function summaryText(row, lang) {
  if (!row)
    return ''
  return (lang === 'bn' ? row.textBn || row.textEn : row.textEn || row.textBn) || ''
}

/** The best game score of a row as [game, score], or null. */
export function bestGame(row) {
  const hs = (row && row.highScores) || {}
  const games = Object.entries(hs).filter(([k, v]) => k !== 'reaction_ms' && Number(v) > 0)
  if (!games.length)
    return null
  games.sort((a, b) => b[1] - a[1])
  return games[0]
}
