// Demo fixtures of products (owner: products). The two seeded products of the server (TinyBot and
// the generic Nobix device) plus one switched-off sample, so the back-office page, the product
// tags and the feature filtering all show. Changes made in the demo live until the page reloads.
const now = Date.now();
const day = 86400000;
const stamp = (ms) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19);

export const TINYBOT_FEATURES = ['chat', 'character', 'voiceprint', 'chat_history', 'memory', 'companion', 'day', 'prayer', 'look',
  'screen', 'messages', 'commands', 'proactive', 'firmware', 'pairing_pattern'];
export const GENERIC_FEATURES = ['chat', 'character', 'voiceprint', 'chat_history', 'firmware'];
export const PRODUCT_FIELDS = {
  tinybot: { productKey: 'tinybot', productName: 'TinyBot', productNameBn: 'টাইনিবট', features: TINYBOT_FEATURES },
  generic: { productKey: 'generic', productName: 'Nobix device', productNameBn: 'নোবিক্স ডিভাইস', features: GENERIC_FEATURES },
};

const products = [
  { id: 1, productKey: 'tinybot', nameEn: 'TinyBot', nameBn: 'টাইনিবট', description: 'The Bangla desk companion robot.',
    iconUrl: null, boardTypes: 'tinybot,tinybot-*', features: TINYBOT_FEATURES, sort: 1, status: 1,
    createDate: stamp(now - 90 * day), updateDate: stamp(now - 3 * day) },
  { id: 2, productKey: 'generic', nameEn: 'Nobix device', nameBn: 'নোবিক্স ডিভাইস', description: 'Any other Nobix voice device.',
    iconUrl: null, boardTypes: '*', features: GENERIC_FEATURES, sort: 99, status: 1,
    createDate: stamp(now - 90 * day), updateDate: stamp(now - 90 * day) },
  { id: 3, productKey: 'sample_speaker', nameEn: 'Sample speaker', nameBn: 'নমুনা স্পিকার', description: 'A sample product, switched off.',
    iconUrl: null, boardTypes: 'sample-speaker-*', features: ['chat', 'character', 'firmware'], sort: 10, status: 0,
    createDate: stamp(now - 12 * day), updateDate: stamp(now - 12 * day) },
];
let nextId = 4;

const KEY_RE = /^[a-z][a-z0-9_-]{1,49}$/;
const FEATURE_RE = /^[a-z_]+$/;
const BOARD_RE = /^(\*|[a-z0-9][a-z0-9_.:-]*\*?)$/;
const fail = (code, msg) => ({ code, msg, data: null });
const ok = (data = null) => ({ code: 0, msg: 'success', data });

// The server's own checks (ProductServiceImpl), with its messages.
function check(body, id) {
  const key = String(body.productKey || '').trim();
  if (!KEY_RE.test(key)) return fail(10206, 'Product key must be 2-50 characters of lower-case letters, digits, _ or -, starting with a letter');
  if (!String(body.nameEn || '').trim()) return fail(10031, 'nameEn cannot be empty');
  const boards = String(body.boardTypes || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!boards.length || !boards.every((b) => BOARD_RE.test(b))) {
    return fail(10209, 'Board types must be comma-separated patterns of lower-case letters, digits, _, -, . or :, optionally ending with *, or * alone');
  }
  if (!(body.features || []).every((f) => FEATURE_RE.test(f))) return fail(10208, 'Features must be feature keys made of lower-case letters and _');
  if (products.some((p) => p.productKey === key && p.id !== id)) return fail(10207, 'Product key already exists');
  return null;
}

const listItem = (p) => ({ productKey: p.productKey, nameEn: p.nameEn, nameBn: p.nameBn, iconUrl: p.iconUrl, features: p.features, sort: p.sort });

export default [
  { method: 'GET', url: '/product/list',
    reply: () => products.filter((p) => p.status === 1).sort((a, b) => a.sort - b.sort).map(listItem) },
  { method: 'GET', url: '/product/page', reply: (req) => {
    const q = String(req.query.keywords || '').trim().toLowerCase();
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const all = products.filter((p) => !q || [p.productKey, p.nameEn, p.nameBn].some((v) => String(v || '').toLowerCase().includes(q)))
      .sort((a, b) => a.sort - b.sort);
    return { total: all.length, list: all.slice((page - 1) * limit, page * limit) };
  } },
  { method: 'POST', url: /\/product$/, body: (req) => {
    const b = req.data || {};
    const bad = check(b, null);
    if (bad) return bad;
    products.push({ ...b, id: nextId++, productKey: b.productKey.trim(), createDate: stamp(Date.now()), updateDate: stamp(Date.now()) });
    return ok();
  } },
  { method: 'PUT', url: /\/product$/, body: (req) => {
    const b = req.data || {};
    const p = products.find((x) => x.id === b.id);
    if (!p) return fail(10205, 'Product does not exist');
    if (p.productKey === 'generic' && b.productKey !== 'generic') return fail(10210, 'The generic product cannot be deleted or renamed');
    const bad = check(b, p.id);
    if (bad) return bad;
    Object.assign(p, b, { updateDate: stamp(Date.now()) });
    return ok();
  } },
  { method: 'DELETE', url: /\/product$/, body: (req) => {
    const ids = Array.isArray(req.data) ? req.data : [];
    if (products.some((p) => ids.includes(p.id) && p.productKey === 'generic')) return fail(10210, 'The generic product cannot be deleted or renamed');
    for (const id of ids) { const i = products.findIndex((p) => p.id === id); if (i >= 0) products.splice(i, 1); }
    return ok();
  } },
];
