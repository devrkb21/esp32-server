// Pure helpers of the system pages (Parameters, Dictionaries, Features, Server; owner: web-system).
// Behaviour copied from the legacy ParamsManagement.vue and ParamDialog.vue: namespace grouping,
// sensitive masking, the array and JSON value formats, and the list fetch that collects every page.

export const TOP_GROUP_ORDER = ['server', 'plugins', 'log', 'session_state', 'general'];
export const SERVER_SUB_ORDER = ['_root', 'auth', 'connection', 'registry', 'resilience', 'metrics', 'tracing'];
export const FETCH_LIMIT = 500;
export const VALUE_TYPES = ['string', 'number', 'boolean', 'array', 'json'];

export const SENSITIVE_KEYS = [
  'api_key', 'personal_access_token', 'access_token', 'token', 'secret',
  'access_key_secret', 'secret_key', 'password', 'mqtt_signature_key', 'private_key',
];

export function getTopGroup(code = '') {
  const c = String(code || '');
  if (c.startsWith('server.')) return 'server';
  if (c.startsWith('plugins.')) return 'plugins';
  if (c.startsWith('log.')) return 'log';
  if (c.startsWith('session_state.')) return 'session_state';
  return 'general';
}

export function getSubGroup(code = '') {
  const top = getTopGroup(code);
  const parts = String(code || '').split('.');
  if (top === 'server' || top === 'plugins') return parts.length >= 3 ? parts[1] : '_root';
  return '_all';
}

export function orderSubKeys(keys, top) {
  if (top === 'server') {
    return [...SERVER_SUB_ORDER.filter((k) => keys.includes(k)), ...keys.filter((k) => !SERVER_SUB_ORDER.includes(k)).sort()];
  }
  return keys.slice().sort((a, b) => {
    if (a === '_root' || a === '_all') return -1;
    if (b === '_root' || b === '_all') return 1;
    return a.localeCompare(b);
  });
}

export function matchesSearch(item, keyword) {
  const k = String(keyword || '').trim().toLowerCase();
  if (!k) return true;
  return String(item.paramCode || '').toLowerCase().includes(k) || String(item.remark || '').toLowerCase().includes(k);
}

// Filter by namespace, sub-namespace and the applied search, as the legacy page did.
export function filterParams(list, { top = 'all', sub = 'all', keyword = '' } = {}) {
  return list.filter((p) => (top === 'all' || getTopGroup(p.paramCode) === top)
    && (sub === 'all' || getSubGroup(p.paramCode) === sub)
    && matchesSearch(p, keyword));
}

// Counts per namespace among the rows the search keeps. 'all' always present; empty groups dropped.
export function topCounts(list, keyword) {
  const counts = { all: 0 };
  for (const p of list) {
    if (!matchesSearch(p, keyword)) continue;
    counts.all += 1;
    const g = getTopGroup(p.paramCode);
    counts[g] = (counts[g] || 0) + 1;
  }
  return ['all', ...TOP_GROUP_ORDER].filter((k) => k === 'all' || counts[k] > 0).map((k) => ({ key: k, count: counts[k] || 0 }));
}

// Sub-namespaces of one namespace (only when it has more than one).
export function subCounts(list, top, keyword) {
  if (top === 'all') return [];
  const source = list.filter((p) => getTopGroup(p.paramCode) === top && matchesSearch(p, keyword));
  const map = {};
  source.forEach((p) => { const s = getSubGroup(p.paramCode); map[s] = (map[s] || 0) + 1; });
  const keys = Object.keys(map);
  if (keys.length <= 1) return [];
  return [{ key: 'all', count: source.length }, ...orderSubKeys(keys, top).map((k) => ({ key: k, count: map[k] }))];
}

// Rows grouped into sections (namespace, then sub-namespace), each sorted by code.
export function buildSections(items) {
  const bucket = {};
  items.forEach((item) => {
    const top = getTopGroup(item.paramCode);
    const sub = getSubGroup(item.paramCode);
    const key = `${top}.${sub}`;
    if (!bucket[key]) bucket[key] = { key, top, sub, items: [] };
    bucket[key].items.push(item);
  });
  const sections = Object.values(bucket).map((s) => ({
    ...s, items: s.items.slice().sort((a, b) => String(a.paramCode).localeCompare(String(b.paramCode))),
  }));
  sections.sort((a, b) => {
    const d = TOP_GROUP_ORDER.indexOf(a.top) - TOP_GROUP_ORDER.indexOf(b.top);
    if (d !== 0) return d;
    const order = orderSubKeys([a.sub, b.sub], a.top);
    return order.indexOf(a.sub) - order.indexOf(b.sub);
  });
  return sections;
}

// Sections open by default: all when five or fewer, else the first three.
export function defaultOpen(keys, current = []) {
  const still = current.filter((k) => keys.includes(k));
  if (still.length) return still;
  return keys.length <= 5 ? keys.slice() : keys.slice(0, 3);
}

export function isSensitive(code) {
  const c = String(code || '').toLowerCase();
  return SENSITIVE_KEYS.some((k) => c.includes(k));
}

export function maskValue(value) {
  const v = value == null ? '' : String(value);
  if (!v || v.length <= 4) return '****';
  return `${v.substring(0, 2)}****${v.substring(v.length - 2)}`;
}

export function shortValue(value) {
  if (value == null) return '';
  const t = String(value);
  return t.length > 120 ? `${t.slice(0, 120)}…` : t;
}

// Stored value -> what the editor shows: JSON pretty-printed, arrays one item per line.
export function toEditValue(value, type) {
  if (value == null || value === '') return value == null ? '' : value;
  const v = String(value);
  if (type === 'json') {
    try { return JSON.stringify(JSON.parse(v), null, 2); } catch (e) { return v; }
  }
  if (type === 'array') return v.split(';').filter((x) => x.trim()).join(';\n');
  return v;
}

// Editor -> stored value. Arrays: every line but the last must end with ';' (else { error: 'array' });
// joined with ';'. JSON: compacted when it parses, kept as typed when it does not.
export function toSubmitValue(value, type) {
  const v = value == null ? '' : String(value);
  if (type === 'array' && v) {
    const lines = v.split('\n').filter((l) => l.trim());
    for (let i = 0; i < lines.length - 1; i += 1) {
      if (!lines[i].trim().endsWith(';')) return { error: 'array' };
    }
    return { value: lines.map((l) => l.trim().replace(/;$/, '')).filter(Boolean).join(';') };
  }
  if (type === 'json' && v) {
    try { return { value: JSON.stringify(JSON.parse(v)) }; } catch (e) { return { value: v }; }
  }
  return { value: v };
}

export function emptyParam() {
  return { id: null, paramCode: '', paramValue: '', valueType: 'string', remark: '' };
}

// Calls `run(cb)` and resolves with the reply, or with null when nothing came back in `ms`
// (the API layer never calls back on a server error: it shows its own notice instead).
export function callWithTimeout(run, ms = 15000) {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(null); } }, ms);
    run((res) => { if (!done) { done = true; clearTimeout(t); resolve(res); } });
  });
}

// Every page of the parameter list, the way the legacy page collected it (stops on an empty
// page, a page past the total, or 200 pages). `getPage(page)` resolves { list, total } or rejects.
export async function collectAll(getPage) {
  const collected = [];
  let page = 1;
  let total = Infinity;
  while (collected.length < total) {
    const data = await getPage(page);
    const list = (data && data.list) || [];
    total = typeof data?.total === 'number' ? data.total : collected.length + list.length;
    collected.push(...list);
    if (!list.length) break;
    page += 1;
    if (page > 200) break;
  }
  return collected;
}

// Which page to show after deleting `removed` rows from the last page.
export function pageAfterDelete(page, size, total, removed) {
  const left = Math.max(0, total - removed);
  const last = Math.max(1, Math.ceil(left / size));
  return Math.min(page, last);
}
