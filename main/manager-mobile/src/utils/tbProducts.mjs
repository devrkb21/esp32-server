// Products: TinyBot is the first of several Nobix devices. Each device belongs to one product,
// and the product's `features` decide which screens that device shows. Pure helpers (unit tested
// in tbProducts.test.mjs); same rules as manager-web src/shell/products.js.

/** Every feature key the platform knows today. */
export const KNOWN_FEATURES = [
  'chat', 'character', 'voiceprint', 'chat_history', 'memory', 'companion', 'day', 'prayer', 'look',
  'screen', 'messages', 'commands', 'proactive', 'firmware', 'pairing_pattern',
]

/** TinyBot's features as seeded on the server: the fallback when nothing else is known. */
export const TINYBOT_FEATURES = KNOWN_FEATURES.slice()
export const FALLBACK_PRODUCT = 'tinybot'
const FALLBACK_NAMES = { tinybot: { en: 'TinyBot', bn: 'টাইনিবট' }, generic: { en: 'Nobix device', bn: 'নোবিক্স ডিভাইস' } }

/** The feature each place needs (pages without an entry are for every device). */
export const PAGE_NEEDS = {
  '/pages/day/index': 'day',
  '/pages/look/index': 'look',
  '/pages/messages/index': 'messages',
  '/pages/robot/index': 'companion',
  '/pages/agent/index': 'character',
  '/pages/voiceprint/index': 'voiceprint',
}

/**
 * The product facts of one device list item: its own fields first, then the product list by key,
 * then TinyBot (devices from before products existed are TinyBots).
 */
export function productOf(item, products) {
  const d = item || {}
  const list = Array.isArray(products) ? products : []
  const key = d.productKey || FALLBACK_PRODUCT
  const p = list.find(x => x && x.productKey === key) || null
  let features = Array.isArray(d.features) ? d.features : null
  if (!features && p && Array.isArray(p.features))
    features = p.features
  if (!features && key === FALLBACK_PRODUCT)
    features = TINYBOT_FEATURES
  const names = FALLBACK_NAMES[key] || {}
  return {
    productKey: key,
    productName: d.productName || (p && p.nameEn) || names.en || key,
    productNameBn: d.productNameBn || (p && p.nameBn) || names.bn || d.productName || (p && p.nameEn) || key,
    features: features ? features.slice() : [],
  }
}

/** Does a feature list allow `name`? `null` (no robot chosen) allows everything. */
export function allows(features, name) {
  if (!name)
    return true
  if (!Array.isArray(features))
    return true
  return features.includes(name)
}

/** The product's name in the app's language. */
export function productName(p, lang) {
  if (!p)
    return ''
  return (lang === 'bn' ? p.productNameBn || p.nameBn : p.productName || p.nameEn) || p.productName || p.nameEn || p.productKey || ''
}

/** The feature a page path needs ('' for every device). Accepts '/pages/x/index' or 'pages/x/index?q'. */
export function needsOf(path) {
  const p = `/${String(path || '').replace(/^\//, '').split('?')[0]}`
  return PAGE_NEEDS[p] || ''
}

/** The tab bar entries the chosen robot can use (`features` null: every tab). */
export function visibleTabs(list, features) {
  return (list || []).filter(item => allows(features, item.needs || needsOf(item.pagePath || item.path || item.url)))
}

/** The More page groups, without the places the chosen robot cannot use; empty groups drop out. */
export function visiblePlaces(groups, features) {
  return (groups || [])
    .map(g => ({ ...g, items: (g.items || []).filter(i => allows(features, i.needs || needsOf(i.url))) }))
    .filter(g => g.items.length)
}

/** Distinct products of a list of robots (by key, first seen order). */
export function distinctProducts(items) {
  const seen = new Map()
  for (const it of items || []) {
    const k = (it && it.productKey) || FALLBACK_PRODUCT
    if (!seen.has(k))
      seen.set(k, it)
  }
  return [...seen.entries()].map(([productKey, it]) => ({ productKey, productName: it.productName, productNameBn: it.productNameBn }))
}
