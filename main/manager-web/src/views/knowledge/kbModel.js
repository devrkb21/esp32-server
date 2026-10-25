// Pure helpers of the knowledge base pages (no Vue, no API): unit-tested in tests/knowledge.test.mjs.
import { digits } from '@/kit/calendar';

// Upload rules kept from the legacy page: these types, each file under 10 MB.
export const ACCEPT = '.doc,.docx,.pdf,.txt,.md,.mdx,.csv,.xls,.xlsx,.ppt,.pptx';
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const NAME_MAX = 50;
export const DESC_MAX = 300;
// The legacy name rule, unchanged: Chinese characters, Latin letters, digits, spaces, - and _.
export const NAME_PATTERN = /^[一-龥a-zA-Z0-9\s\-_]+$/;

export function isTooLarge(size) {
  return !(Number(size) / 1024 / 1024 < 10);
}

export function fileExt(name) {
  const parts = String(name || '').split('.');
  return parts.length > 1 ? parts.pop().slice(0, 4).toUpperCase() : 'FILE';
}

export function formatFileSize(bytes, lang) {
  if (!bytes) return digits('0 B', lang);
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = Number(bytes);
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return digits(`${size.toFixed(1)} ${units[i]}`, lang);
}

export function count(value, lang) {
  return digits((Number(value) || 0).toLocaleString('en-US'), lang);
}

export function dateText(value, lang) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

// Document parse states (parseStatusCode): 0 not started, 1 running, 2 cancelled, 3 done, 4 failed.
const STATES = {
  0: { key: 'notStarted', ink: 'ink-2' },
  1: { key: 'processing', ink: 'message' },
  2: { key: 'cancelled', ink: 'warn' },
  3: { key: 'done', ink: 'ok' },
  4: { key: 'failed', ink: 'danger' },
};
export function parseState(code) {
  return STATES[code] || STATES[0];
}

// The legacy progress rule: done 100%, running chunkNum/totalChunkNum or 50%, else 0%.
export function progressPercent(doc) {
  const code = doc && doc.parseStatusCode;
  if (code === 3) return 100;
  if (code === 1) {
    if (doc.chunkNum && doc.totalChunkNum) return Math.round((doc.chunkNum / doc.totalChunkNum) * 100);
    return 50;
  }
  return 0;
}

export function formatSimilarity(value, lang) {
  return digits((Number(value) || 0).toFixed(4), lang);
}

// Chunk replies come in three shapes (legacy): { list, total }, { chunks, total } or a bare array.
export function chunkPage(responseData) {
  if (responseData && Array.isArray(responseData.list)) {
    return { list: responseData.list, total: Number(responseData.total || responseData.list.length) };
  }
  if (responseData && Array.isArray(responseData.chunks)) {
    return { list: responseData.chunks, total: Number(responseData.total || responseData.chunks.length) };
  }
  if (Array.isArray(responseData)) return { list: responseData, total: responseData.length };
  return { list: [], total: 0 };
}

export function retrievalChunks(result) {
  return (result && Array.isArray(result.chunks) && result.chunks) || [];
}

export function chunkSource(chunk) {
  return (chunk && (chunk.document_keyword || chunk.documentKeyword || chunk.document_name || chunk.documentName)) || '';
}

// The knowledge base form rules (legacy dialog): returns { field: i18nKey } for every problem.
export function validateKb(form) {
  const errors = {};
  const name = String(form.name || '');
  const desc = String(form.description || '');
  if (!name.trim()) errors.name = 'kb.form.nameRequired';
  else if (name.length > NAME_MAX) errors.name = 'kb.form.nameLength';
  else if (!NAME_PATTERN.test(name)) errors.name = 'kb.form.namePattern';
  if (!desc.trim()) errors.description = 'kb.form.descRequired';
  else if (desc.length > DESC_MAX) errors.description = 'kb.form.descLength';
  if (form.ragModelId === null || form.ragModelId === undefined || form.ragModelId === '') errors.ragModelId = 'kb.form.ragRequired';
  return errors;
}

// The legacy reply check: { data: { code: 0 } } is success.
export function ok(res) {
  return Boolean(res && res.data && res.data.code === 0);
}

export function errorText(res, fallback) {
  return (res && res.data && res.data.msg) || fallback;
}
