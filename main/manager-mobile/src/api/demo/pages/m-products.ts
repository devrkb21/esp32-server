import type { DemoHandler } from '../index'

// The product catalog (owner: products). The two seeded products of the server: TinyBot and the
// generic Nobix device, so the product tags and the feature filtering show. Synthetic data.
export const TINYBOT_FEATURES = ['chat', 'character', 'voiceprint', 'chat_history', 'memory', 'companion', 'day', 'prayer', 'look', 'screen', 'messages', 'commands', 'proactive', 'firmware', 'pairing_pattern', 'family', 'care', 'summary']
export const GENERIC_FEATURES = ['chat', 'character', 'voiceprint', 'chat_history', 'firmware', 'family']
export const PRODUCT_FIELDS = {
  tinybot: { productKey: 'tinybot', productName: 'TinyBot', productNameBn: 'টাইনিবট', features: TINYBOT_FEATURES },
  generic: { productKey: 'generic', productName: 'Nobix device', productNameBn: 'নোবিক্স ডিভাইস', features: GENERIC_FEATURES },
}

const handlers: DemoHandler[] = [
  { method: 'GET', url: '/product/list', reply: [
    { productKey: 'tinybot', nameEn: 'TinyBot', nameBn: 'টাইনিবট', iconUrl: null, features: TINYBOT_FEATURES, sort: 1 },
    { productKey: 'generic', nameEn: 'Nobix device', nameBn: 'নোবিক্স ডিভাইস', iconUrl: null, features: GENERIC_FEATURES, sort: 99 },
  ] },
]

export default handlers
