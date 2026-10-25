// Pure helpers of the Firmware (OTA) page: form rules, file checks, labels and the
// "newest of its type" mark. No Vue, no API: unit-tested in tests/ota.test.mjs.
import { digits } from '@/kit/calendar';
import { formatFileSize } from '@/utils/format';

// The version a robot compares against its own (manager-api compareVersions): x.x.x.
export const VERSION_RE = /^\d+\.\d+\.\d+$/;
// The legacy upload rules: a .bin (or .apk) under 100 MB.
export const FILE_EXTS = ['.bin', '.apk'];
export const MAX_FILE_MB = 100;
export const PAGE_SIZES = [10, 20, 50, 100];

export function emptyForm() {
  return { id: null, firmwareName: '', type: '', version: '', size: 0, remark: '', firmwarePath: '' };
}

// One field's problem as an i18n key, or '' when the value is fine.
export function fieldError(field, form) {
  const v = String(form[field] ?? '').trim();
  if (field === 'firmwareName') return v ? '' : 'ota.err.nameRequired';
  if (field === 'type') return v ? '' : 'ota.err.typeRequired';
  if (field === 'version') {
    if (!v) return 'ota.err.versionRequired';
    return VERSION_RE.test(v) ? '' : 'ota.err.versionFormat';
  }
  return '';
}

// Every problem of the form: { field: i18nKey }. A new build needs its uploaded file.
export function formErrors(form) {
  const out = {};
  for (const f of ['firmwareName', 'type', 'version']) {
    const e = fieldError(f, form);
    if (e) out[f] = e;
  }
  if (!form.id && !form.firmwarePath) out.firmwarePath = 'ota.err.fileRequired';
  return out;
}

// A picked file's problem as an i18n key, or '' when it can be uploaded.
export function fileError(file) {
  if (!file) return 'ota.err.fileRequired';
  const name = String(file.name || '').toLowerCase();
  if (!FILE_EXTS.some((ext) => name.endsWith(ext))) return 'ota.err.fileType';
  if (!(file.size / 1024 / 1024 < MAX_FILE_MB)) return 'ota.err.fileSize';
  return '';
}

// The firmware type dictionary (FIRMWARE_TYPE: [{ name, key }]) gives each type its label.
export function typeName(types, key) {
  const hit = (types || []).find((t) => t.key === key);
  return hit ? hit.name : (key || '');
}

export function typeOptions(types) {
  return (types || []).map((t) => ({ value: t.key, label: t.name }));
}

const stamp = (row) => new Date(row.updateDate || row.createDate || 0).getTime() || 0;

// The build each type serves (manager-api getLatestOta: the most recently saved row of a type).
// Only meaningful when every build is on screen: pass `complete` = all rows loaded, no search.
export function newestIds(rows, complete) {
  const ids = new Set();
  if (!complete) return ids;
  const best = new Map();
  for (const r of rows || []) {
    if (!r || !r.type) continue;
    const cur = best.get(r.type);
    if (!cur || stamp(r) > stamp(cur)) best.set(r.type, r);
  }
  for (const r of best.values()) ids.add(r.id);
  return ids;
}

export function sizeText(bytes, lang) {
  return digits(formatFileSize(Number(bytes) || 0), lang);
}

export function dateText(value, lang) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d);
}

// True when a row was saved again after its upload (shown as a second line).
export function wasEdited(row) {
  if (!row || !row.updateDate || !row.createDate) return false;
  return Math.abs(new Date(row.updateDate) - new Date(row.createDate)) > 60000;
}
