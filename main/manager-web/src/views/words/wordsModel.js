// Replacement words: pure helpers (unit tested in tests/words.test.mjs).
// The rules come from the legacy ReplacementWordDialog: one "original|replacement" pair per
// line, blank lines ignored, at most 4000 pairs, exactly one "|" per line, neither side empty,
// and neither side may hold one of the legacy's forbidden symbols.

export const MAX_PAIRS = 4000;
export const PAGE_SIZES = [10, 20, 50, 100];
// The legacy dialog's character rule, unchanged.
export const SPECIAL_CHARS = /[!@#$%^&*()_+=[\]{};':"\\<>?/`~]/;

/** The content as one string, whether the API sent an array of lines or a string. */
export function contentText(content) {
  if (!content) return '';
  return Array.isArray(content) ? content.join('\n') : String(content);
}

/** The content as an array of lines, for the table preview. */
export function contentLines(content) {
  if (!content) return [];
  if (Array.isArray(content)) return content.map(String).filter((l) => l.trim());
  return String(content).split(/\r?\n/).filter((l) => l.trim());
}

/**
 * The non-blank lines with their line number in the text as typed: [{ n, text }].
 * The saved content is these lines' text, as the legacy dialog sent it.
 */
export function numberedLines(content) {
  return contentText(content).split(/\r?\n/)
    .map((text, i) => ({ n: i + 1, text }))
    .filter((l) => l.text.trim());
}

export function validLines(content) {
  return numberedLines(content).map((l) => l.text);
}

/** How many lines hold a pair (the legacy counter counted lines that contain "|"). */
export function pairCount(content) {
  return validLines(content).filter((l) => l.includes('|')).length;
}

/** One line split for the preview: { original, replacement }. */
export function splitPair(line) {
  const i = String(line).indexOf('|');
  if (i < 0) return { original: String(line).trim(), replacement: '' };
  return { original: line.slice(0, i).trim(), replacement: line.slice(i + 1).trim() };
}

/** The problem of one line, or '' when it is a good pair. */
export function lineProblem(text) {
  const pipes = (text.match(/\|/g) || []).length;
  if (pipes !== 1) return 'pipe';
  const [original, replacement] = text.split('|');
  if (!original || !original.trim()) return 'emptyOriginal';
  if (!replacement || !replacement.trim()) return 'emptyReplacement';
  if (SPECIAL_CHARS.test(original)) return 'originalChar';
  if (SPECIAL_CHARS.test(replacement)) return 'replacementChar';
  return '';
}

/**
 * The first problem of the whole content, in the legacy order, or null when it can be saved:
 * { code: 'required' | 'tooMany' | 'pipe' | 'emptyOriginal' | 'emptyReplacement' |
 *   'originalChar' | 'replacementChar', line?, max? }.
 */
export function checkContent(content) {
  const text = contentText(content);
  if (!text.trim()) return { code: 'required' };
  const lines = numberedLines(text);
  if (lines.length > MAX_PAIRS) return { code: 'tooMany', max: MAX_PAIRS };
  for (const l of lines) {
    const code = lineProblem(l.text);
    if (code) return { code, line: l.n };
  }
  return null;
}

/** The file name rule of the legacy dialog: required. */
export function checkFileName(name) {
  return String(name || '').trim() ? null : { code: 'fileNameRequired' };
}

/** Rows of the editor's preview: the first `limit` lines, each with its problem. */
export function previewRows(content, limit = 12) {
  return numberedLines(content).slice(0, limit).map((l) => ({ ...l, ...splitPair(l.text), problem: lineProblem(l.text) }));
}

/** Rows whose file name holds the query (the legacy search filters the page it has). */
export function filterFiles(rows, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => String(r.fileName || '').toLowerCase().includes(q));
}

/** A date the API sent ("2026-10-20 10:00:00", ISO or a timestamp) in the reader's language. */
export function dateTimeText(value, lang) {
  if (value === null || value === undefined || value === '') return '';
  let d;
  if (typeof value === 'number') d = new Date(value);
  else {
    const s = String(value).trim();
    d = new Date(/^\d{4}-\d{2}-\d{2} \d/.test(s) ? s.replace(' ', 'T') : s);
  }
  if (Number.isNaN(d.getTime())) return String(value);
  const locale = lang === 'bn' ? 'bn-BD' : (lang || 'en').replace('_', '-');
  try {
    // 24-hour clock in Bangla, where Intl would print a Latin "AM/PM"
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: lang !== 'bn' }).format(d);
  } catch (e) {
    return d.toLocaleString();
  }
}

/** True when the download answer is an API error body rather than the file's text. */
export function isErrorBody(data) {
  return !!data && typeof data === 'object' && !(data instanceof ArrayBuffer) && !(typeof Blob !== 'undefined' && data instanceof Blob)
    && 'code' in data && data.code !== 0;
}
