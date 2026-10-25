// Messages page: pure helpers (no Vue), unit tested in tests/messagesModel.test.mjs.
// Two sources: the companion API's messages (what the owner tells TinyBot, spoken by the robot)
// and the agent's chat history (what was said aloud, per session).
import { messageStatus } from '@/utils/companion.mjs';
import { digits } from '@/kit/calendar';

export const SESSIONS_PAGE = 20;      // the legacy dialog's page size
export const TIME_GAP_MS = 60 * 1000; // a time mark between lines more than a minute apart
export const TOOL_FOLD = 80;          // tool results longer than this start folded

/** The message list from either reply shape: `[...]` or `{ messages: [...] }`. */
export function messageList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.messages)) return data.messages;
  return null;
}

/** Epoch seconds of a message (`ts` from the API; `created` in older snapshots). */
export function messageTs(m) {
  return Number((m && (m.ts || m.created)) || 0);
}

/** Newest first, as the API sends them; a list that came unsorted is put in order. */
export function sortMessages(list) {
  return [...(list || [])].sort((a, b) => messageTs(b) - messageTs(a));
}

/** pending | delivered | seen | yes | no (the legacy rule: an answer wins over the status). */
export function statusOf(m) {
  return messageStatus(m);
}

/** The TbSync rule for a message state: dashed while it waits, solid once TinyBot has it. */
export function syncOf(m) {
  return statusOf(m) === 'pending' ? 'pending' : 'applied';
}

/**
 * The text of a chat line. The server stores plain text, a JSON object with `content`
 * (and maybe `speaker`), or a JSON array of parts [{ type: text|tool|tool_result, text }].
 * Returns { parts: [{ type, text }], speaker }.
 */
export function lineContent(content) {
  const raw = content == null ? '' : String(content);
  if (raw.trim()) {
    try {
      const v = JSON.parse(raw);
      if (Array.isArray(v)) {
        return { speaker: '', parts: v.map((p) => ({ type: (p && p.type) || 'text', text: p && p.text != null ? String(p.text) : '' })) };
      }
      if (v && typeof v === 'object' && v.content) {
        return { speaker: v.speaker ? String(v.speaker) : '', parts: [{ type: 'text', text: String(v.content) }] };
      }
    } catch (e) { /* plain text */ }
  }
  return { speaker: '', parts: [{ type: 'text', text: raw }] };
}

/**
 * A folded long tool result: its first line (the legacy rule), or, when that line says next to
 * nothing (a lone "{" of pretty JSON), the start of the text on one line. An ellipsis marks a cut.
 */
export function firstLine(text, max = TOOL_FOLD) {
  if (!text) return '';
  const s = String(text);
  let line = s.split('\n')[0];
  if (line.trim().length < 12) line = s.replace(/\s+/g, ' ').trim();
  if (line.length > max) line = line.slice(0, max).trimEnd();
  return line.length < s.length ? `${line}...` : s;
}

/** Who said a line: 'person' (chatType 1), 'tool' (chatType 3) or 'bot'. */
export function speakerOf(line) {
  const t = Number(line && line.chatType);
  if (t === 1) return 'person';
  if (t === 3) return 'tool';
  return 'bot';
}

/**
 * Lines with time marks: one before the first line and one wherever the next line comes more
 * than `gap` after the previous one (the legacy dialog's rule, oldest line first).
 */
export function withTimeMarks(lines, gap = TIME_GAP_MS) {
  const out = [];
  (lines || []).forEach((line, i) => {
    const at = new Date(line.createdAt).getTime();
    const prev = i > 0 ? new Date(lines[i - 1].createdAt).getTime() : NaN;
    if (i === 0 || (at - prev > gap)) out.push({ mark: true, at: line.createdAt, key: `t-${i}` });
    out.push({ mark: false, line, key: line.id != null ? `l-${line.id}` : `l-${i}` });
  });
  return out;
}

function locale(lang) { return lang === 'bn' ? 'bn-BD' : String(lang || 'en').replace('_', '-'); }

function hhmm(d, lang) {
  return digits(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, lang);
}

/** 'today' | 'yesterday' | 'older' for a date, against `now`. */
export function dayWord(date, now = new Date()) {
  const d = new Date(date);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d >= start) return 'today';
  const y = new Date(start); y.setDate(y.getDate() - 1);
  return d >= y ? 'yesterday' : 'older';
}

/**
 * The parts of a dated row: { day: '২৫', month: 'অক্টো', time: '১০:৩০', word }.
 * `word` is today/yesterday/older so the page can say "আজ" or "গতকাল".
 */
export function dateParts(value, lang, now = new Date()) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { day: '', month: '', time: '', word: 'older' };
  let month = '';
  try { month = new Intl.DateTimeFormat(locale(lang), { month: 'short' }).format(d); } catch (e) { month = String(d.getMonth() + 1); }
  return { day: digits(d.getDate(), lang), month: digits(month, lang), time: hhmm(d, lang), word: dayWord(d, now) };
}

/** A full stamp for a time mark: "আজ ১০:৩০", "গতকাল ২১:০৫" or "২৩ অক্টোবর ২০২৬, ১০:৩০". */
export function stampText(value, lang, words, now = new Date()) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const w = dayWord(d, now);
  if (w !== 'older') return `${words[w]} ${hhmm(d, lang)}`;
  let date = '';
  try { date = new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'long', year: 'numeric' }).format(d); } catch (e) { date = d.toDateString(); }
  return `${digits(date, lang)}, ${hhmm(d, lang)}`;
}

/** The clock of an epoch-seconds stamp, with its date when it is not today. */
export function messageWhen(ts, lang, now = new Date()) {
  if (!ts) return { time: '', date: '', word: 'older' };
  const d = new Date(Number(ts) * 1000);
  if (Number.isNaN(d.getTime())) return { time: '', date: '', word: 'older' };
  const w = dayWord(d, now);
  let date = '';
  if (w === 'older') {
    try { date = digits(new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short' }).format(d), lang); } catch (e) { date = ''; }
  }
  return { time: hhmm(d, lang), date, word: w };
}

/** A MAC address split so its middle bytes can be hidden: { head, middle, tail } or null. */
export function macParts(mac) {
  if (!/^(?:[0-9A-Z]{2}[:-]){5}[0-9A-Z]{2}$/i.test(String(mac || ''))) return null;
  const sep = mac.indexOf('-') !== -1 ? '-' : ':';
  const s = mac.split(/[:-]/);
  return { head: s.slice(0, 2).join(sep), middle: sep + s.slice(2, 4).join(sep) + sep, tail: s.slice(4).join(sep) };
}

/** The server's own error text when it sent one, else the fallback. */
export function errorText(err, fallback) {
  return (err && err.data && err.data.msg) || fallback;
}

/** Merge a new page of sessions into the list (no duplicates when a page is fetched twice). */
export function mergeSessions(list, page) {
  const seen = new Set((list || []).map((s) => s.sessionId));
  return [...(list || []), ...(page || []).filter((s) => !seen.has(s.sessionId))];
}
