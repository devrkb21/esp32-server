// Products (back office): pure helpers of the list and the add/edit sheet, unit tested in
// tests/products.test.mjs. The rules mirror the server (ProductServiceImpl) so most mistakes are
// caught before the request; the server's own message is still shown when it refuses.
import { KNOWN_FEATURES } from '@/shell/products';

export { KNOWN_FEATURES };
export const GENERIC_KEY = 'generic';
export const KEY_RE = /^[a-z][a-z0-9_-]{1,49}$/;
export const FEATURE_RE = /^[a-z_]+$/;
export const BOARD_RE = /^(\*|[a-z0-9][a-z0-9_.:-]*\*?)$/;
export const PAGE_SIZE = 10;

// Server error codes of the product module (ErrorCode.java) and the field each one is about.
export const ERROR_FIELDS = { 10206: 'productKey', 10207: 'productKey', 10208: 'features', 10209: 'boardTypes', 10210: 'productKey' };

export function emptyProduct() {
  return {
    id: null, productKey: '', nameEn: '', nameBn: '', description: '', iconUrl: '',
    boardTypes: '', features: [], extraFeatures: '', sort: 0, status: true,
  };
}

/** Comma (or space) separated text as a clean list, lower-cased like the server stores it. */
export function splitList(text) {
  return String(text || '').split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/** A ProductVO from the page as the sheet's form. Unknown feature keys go to the free-text box. */
export function toForm(vo) {
  const p = { ...emptyProduct(), ...(vo || {}) };
  const features = Array.isArray(p.features) ? p.features : [];
  return {
    id: p.id ?? null,
    productKey: p.productKey || '',
    nameEn: p.nameEn || '',
    nameBn: p.nameBn || '',
    description: p.description || '',
    iconUrl: p.iconUrl || '',
    boardTypes: p.boardTypes || '',
    features: features.filter((f) => KNOWN_FEATURES.includes(f)),
    extraFeatures: features.filter((f) => !KNOWN_FEATURES.includes(f)).join(', '),
    sort: Number.isFinite(Number(p.sort)) ? Number(p.sort) : 0,
    status: vo ? p.status !== 0 && p.status !== false : true,
  };
}

/** Every feature of the form: the ticked known keys, then the extra keys, without repeats. */
export function featuresOf(form) {
  const out = [];
  for (const f of [...(form.features || []), ...splitList(form.extraFeatures)]) if (!out.includes(f)) out.push(f);
  return out;
}

/**
 * The form's problems by field (codes, '' when fine): productKey required|format, nameEn
 * required, boardTypes required|format, features format (an extra key that is not [a-z_]+),
 * iconUrl format, sort format.
 */
export function validate(form) {
  const key = String(form.productKey || '').trim();
  const boards = splitList(form.boardTypes);
  const extras = splitList(form.extraFeatures);
  const icon = String(form.iconUrl || '').trim();
  const sort = form.sort === '' || form.sort === null || form.sort === undefined ? 0 : Number(form.sort);
  return {
    productKey: !key ? 'required' : (KEY_RE.test(key) ? '' : 'format'),
    nameEn: String(form.nameEn || '').trim() ? '' : 'required',
    boardTypes: !boards.length ? 'required' : (boards.every((b) => BOARD_RE.test(b)) ? '' : 'format'),
    features: extras.every((f) => FEATURE_RE.test(f)) ? '' : 'format',
    iconUrl: !icon || /^(https?:\/\/|\/)\S+$/i.test(icon) ? '' : 'format',
    sort: Number.isInteger(sort) ? '' : 'format',
  };
}

export function isValid(errors) {
  return Object.values(errors).every((v) => !v);
}

/** The ProductDTO to send: no id on create, the id on update (a full replace). */
export function toPayload(form) {
  const body = {
    productKey: String(form.productKey || '').trim(),
    nameEn: String(form.nameEn || '').trim(),
    nameBn: String(form.nameBn || '').trim() || null,
    description: String(form.description || '').trim() || null,
    iconUrl: String(form.iconUrl || '').trim() || null,
    boardTypes: [...new Set(splitList(form.boardTypes))].join(','),
    features: featuresOf(form),
    sort: form.sort === '' || form.sort === null || form.sort === undefined ? 0 : Number(form.sort),
    status: form.status ? 1 : 0,
  };
  return form.id ? { id: form.id, ...body } : body;
}

/** The generic product is the catch-all: it can be edited but not deleted or re-keyed. */
export function isProtected(p) {
  return !!p && p.productKey === GENERIC_KEY;
}

/** Board patterns as a short list for the table ('tinybot, tinybot-*'). */
export function boardsText(boardTypes) {
  return splitList(boardTypes).join(', ');
}
