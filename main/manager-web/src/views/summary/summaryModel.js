// Daily summary rules (pure: unit tested in tests/summary.test.mjs). Rows come from manager-api
// GET /summary/device/{id}?days=30, newest first: {day: 'YYYY-MM-DD', talkCount, focusMinutes,
// pomodoros, gamesPlayed, highScores, remindersDone, remindersMissed, alarmsMissed, newMemories,
// mood, bondScore, bondLevel, textBn, textEn, final}.

/** The moods the robot reports (firmware EmotionState names). */
export const MOODS = ['happy', 'excited', 'curious', 'shy', 'sad', 'annoyed', 'sleepy', 'affectionate', 'neutral'];

/** A mood as an i18n key part ('' when there is none, 'other' when it is not one we know). */
export function moodKey(mood) {
  if (!mood) return '';
  const k = String(mood).trim().toLowerCase();
  return MOODS.includes(k) ? k : 'other';
}

/** 'YYYY-MM-DD' of a date in local time. */
export function isoDay(d) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/** Rows sorted newest first, one per day (the later one wins), at most `days`. */
export function cleanRows(rows, days = 30) {
  const byDay = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (r && /^\d{4}-\d{2}-\d{2}$/.test(String(r.day))) byDay.set(r.day, r);
  }
  return [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, days);
}

/**
 * The last `days` calendar days ending `today`, oldest first: [{ day, row }] where row is null
 * for a day without a summary (so the chart shows a gap, never an invented zero).
 */
export function dayAxis(rows, today = new Date(), days = 30) {
  const map = new Map(cleanRows(rows, 400).map((r) => [r.day, r]));
  const out = [];
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
    const day = isoDay(d);
    out.push({ day, date: d, row: map.get(day) || null });
  }
  return out;
}

/** A value as a number or null (missing stays missing). */
export function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** A round axis top for values up to `max` and the ticks under it (4 steps). */
export function niceScale(max, steps = 4) {
  const m = Math.max(1, Number(max) || 0);
  const raw = m / steps;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) || 10 * mag;
  const top = step * Math.ceil(m / step);
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return { top, ticks };
}

/**
 * A round value range around [min, max] for a line (a line need not start at zero): { lo, top, ticks }.
 * Bars always use niceScale (their length must start at zero).
 */
export function niceRange(min, max, steps = 4) {
  const lo0 = Math.max(0, Number(min) || 0);
  const hi0 = Math.max(lo0 + 1, Number(max) || 0);
  const raw = (hi0 - lo0) / steps;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) || 10 * mag;
  const lo = Math.floor(lo0 / step) * step;
  const top = Math.max(lo + step, Math.ceil(hi0 / step) * step);
  const ticks = [];
  for (let v = lo; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return { lo, top, ticks };
}

/**
 * The SVG path of a line over evenly spaced slots; null values break the line into pieces.
 * values: numbers or null; box: { x, y, w, h }; top: the value at the top of the box.
 */
export function linePath(values, box, top, lo = 0) {
  const n = values.length;
  if (!n) return '';
  const dx = n > 1 ? box.w / (n - 1) : 0;
  let d = '';
  let pen = false;
  values.forEach((v, i) => {
    if (v === null || v === undefined) { pen = false; return; }
    const x = box.x + i * dx;
    const y = box.y + box.h - ((Math.min(Math.max(v, lo), top) - lo) / (top - lo)) * box.h;
    d += `${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    pen = true;
  });
  return d;
}

/** A bar with a 4px rounded top anchored to the baseline (`r` shrinks for short bars). */
export function barPath(x, base, w, h, r = 4) {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x} ${base}V${base - h + rr}Q${x} ${base - h} ${x + rr} ${base - h}H${x + w - rr}Q${x + w} ${base - h} ${x + w} ${base - h + rr}V${base}Z`;
}

/** The summary text in the reader's language (falls back to the other one). */
export function summaryText(row, lang) {
  if (!row) return '';
  return (lang === 'en' ? row.textEn || row.textBn : row.textBn || row.textEn) || '';
}

/** Totals over the rows shown: talk, focus minutes, reminders done and missed, new memories. */
export function totals(rows) {
  const t = { talk: 0, focus: 0, done: 0, missed: 0, memories: 0, days: 0 };
  for (const r of rows || []) {
    t.days += 1;
    t.talk += num(r.talkCount) || 0;
    t.focus += num(r.focusMinutes) || 0;
    t.done += num(r.remindersDone) || 0;
    t.missed += num(r.remindersMissed) || 0;
    t.memories += num(r.newMemories) || 0;
  }
  return t;
}
