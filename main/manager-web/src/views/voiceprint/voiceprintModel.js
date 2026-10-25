// Voiceprints: pure helpers of the page (no Vue), unit tested in tests/voiceprintModel.test.mjs.
import { digits } from '@/kit/calendar';

export const INTRO_MAX = 100;
export const PAGE_SIZE = 10;

/**
 * The words of a recording as the chat history keeps them. A user line may be plain text or,
 * when TinyBot already knew the speaker, JSON like {"speaker":"Ammu","content":"..."}.
 * Returns { text, speaker }; text is '' when nothing usable came back.
 */
export function transcriptOf(content) {
  if (content == null || typeof content !== 'string') return { text: '', speaker: '' };
  const raw = content.trim();
  if (raw.startsWith('{')) {
    try {
      const o = JSON.parse(raw);
      if (o && typeof o === 'object') {
        return { text: typeof o.content === 'string' ? o.content.trim() : '', speaker: typeof o.speaker === 'string' ? o.speaker.trim() : '' };
      }
    } catch (e) { /* plain text that starts with a brace */ }
  }
  return { text: raw, speaker: '' };
}

/**
 * The recent recordings the owner can pick from: one entry per audioId, in the API's order.
 * Lines without audio, and TinyBot's own lines when the reply carries a chatType, are dropped.
 */
export function recordingsFrom(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const it of list) {
    if (!it || !it.audioId || seen.has(it.audioId)) continue;
    if (it.chatType != null && Number(it.chatType) !== 1) continue;
    seen.add(it.audioId);
    out.push({ audioId: it.audioId, ...transcriptOf(it.content) });
  }
  return out;
}

/** Trimmed form values and the error key of each invalid field ({} when valid). */
export function validate(form) {
  const errors = {};
  if (!form || !form.audioId) errors.audioId = 'vp.err.audio';
  if (!String(form?.sourceName || '').trim()) errors.sourceName = 'vp.err.name';
  const intro = String(form?.introduce || '').trim();
  if (!intro) errors.introduce = 'vp.err.intro';
  else if (intro.length > INTRO_MAX) errors.introduce = 'vp.err.introLong';
  return errors;
}

/** The body the API takes: add sends the agent, update sends the saved row with new values. */
export function payloadOf(form, agentId, original) {
  const values = {
    audioId: form.audioId,
    sourceName: String(form.sourceName || '').trim(),
    introduce: String(form.introduce || '').trim(),
  };
  if (form.id) return { ...(original || {}), id: form.id, ...values };
  return { agentId, ...values };
}

/** One page of the list (the API returns everything; the legacy page paged it in the browser). */
export function pageOf(list, page, size = PAGE_SIZE) {
  const all = Array.isArray(list) ? list : [];
  const pages = Math.max(1, Math.ceil(all.length / size));
  const p = Math.min(Math.max(1, page || 1), pages);
  return { page: p, pages, rows: all.slice((p - 1) * size, p * size) };
}

/** "12 Oct 2026" / "১২ অক্টো, ২০২৬" from the API's "2026-10-12 08:30:00" (or an ISO string). */
export function dateText(value, lang) {
  if (!value) return '';
  const d = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return digits(String(value).slice(0, 10), lang);
  const locale = lang === 'bn' ? 'bn-BD' : (lang || 'en').replace('_', '-');
  try {
    return digits(new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d), lang);
  } catch (e) {
    return digits(d.toISOString().slice(0, 10), lang);
  }
}
