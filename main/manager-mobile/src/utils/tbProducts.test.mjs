/* eslint-disable test/no-import-node-test -- this zero-dependency gate intentionally uses Node's built-in runner */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { allows, distinctProducts, needsOf, productName, productOf, TINYBOT_FEATURES, visiblePlaces, visibleTabs } from './tbProducts.mjs'

const GENERIC = ['chat', 'character', 'voiceprint', 'chat_history', 'firmware']
const PRODUCTS = [
  { productKey: 'tinybot', nameEn: 'TinyBot', nameBn: 'টাইনিবট', features: TINYBOT_FEATURES },
  { productKey: 'generic', nameEn: 'Nobix device', nameBn: 'নোবিক্স ডিভাইস', features: GENERIC },
]
const TABS = [
  { pagePath: 'pages/index/index', labelKey: 'nav.today' },
  { pagePath: 'pages/day/index', labelKey: 'nav.day', needs: 'day' },
  { pagePath: 'pages/look/index', labelKey: 'nav.look', needs: 'look' },
  { pagePath: 'pages/settings/index', labelKey: 'nav.more' },
]
const PLACES = [
  { group: 'robot', items: [{ url: '/pages/messages/index' }, { url: '/pages/robot/index' }] },
  { group: 'character', items: [{ url: '/pages/agent/index' }, { url: '/pages/voiceprint/index' }, { url: '/pages/robots/index' }, { url: '/pages/device-config/index' }] },
]

test('a device product: its own fields, then the product list, then TinyBot', () => {
  assert.deepEqual(productOf({ productKey: 'generic', productName: 'Nobix device', productNameBn: 'নোবিক্স ডিভাইস', features: GENERIC }, []),
    { productKey: 'generic', productName: 'Nobix device', productNameBn: 'নোবিক্স ডিভাইস', features: GENERIC })
  assert.deepEqual(productOf({ productKey: 'generic' }, PRODUCTS).features, GENERIC)
  const old = productOf({ id: 'd1' }, [])
  assert.equal(old.productKey, 'tinybot')
  assert.ok(old.features.includes('companion'))
  assert.deepEqual(productOf({ productKey: 'mystery' }, []).features, [])
  assert.equal(productName(productOf({ productKey: 'generic' }, PRODUCTS), 'bn'), 'নোবিক্স ডিভাইস')
  assert.equal(productName(productOf({ productKey: 'generic' }, PRODUCTS), 'en'), 'Nobix device')
})

test('feature check: no robot allows everything', () => {
  assert.equal(allows(null, 'day'), true)
  assert.equal(allows(GENERIC, 'day'), false)
  assert.equal(allows(GENERIC, 'character'), true)
  assert.equal(allows(GENERIC, ''), true)
  assert.equal(needsOf('pages/day/index?focus=a1'), 'day')
  assert.equal(needsOf('/pages/robot/index'), 'companion')
  assert.equal(needsOf('/pages/robots/index'), '')
})

test('the tab bar hides Day and Look for a generic device', () => {
  assert.deepEqual(visibleTabs(TABS, null).map(t => t.labelKey), ['nav.today', 'nav.day', 'nav.look', 'nav.more'])
  assert.deepEqual(visibleTabs(TABS, TINYBOT_FEATURES).map(t => t.labelKey), ['nav.today', 'nav.day', 'nav.look', 'nav.more'])
  assert.deepEqual(visibleTabs(TABS, GENERIC).map(t => t.labelKey), ['nav.today', 'nav.more'])
})

test('More hides Messages and Robot settings for a generic device and drops empty groups', () => {
  assert.deepEqual(visiblePlaces(PLACES, GENERIC).map(g => g.group), ['character'])
  assert.deepEqual(visiblePlaces(PLACES, GENERIC)[0].items.map(i => i.url),
    ['/pages/agent/index', '/pages/voiceprint/index', '/pages/robots/index', '/pages/device-config/index'])
  assert.equal(visiblePlaces(PLACES, null)[0].items.length, 2)
  assert.deepEqual(visiblePlaces(PLACES, ['chat']).map(g => g.items.map(i => i.url)), [['/pages/robots/index', '/pages/device-config/index']])
})

test('distinct products keep first seen order', () => {
  assert.deepEqual(distinctProducts([{ productKey: 'generic' }, {}, { productKey: 'generic' }]).map(p => p.productKey), ['generic', 'tinybot'])
})

test('the tab bar list and the feature pages are wired to the guard', () => {
  const tabs = readFileSync(new URL('../layouts/fg-tabbar/tabbarList.ts', import.meta.url), 'utf8')
  assert.match(tabs, /pagePath: 'pages\/day\/index'[^\n]*needs: 'day'/)
  assert.match(tabs, /pagePath: 'pages\/look\/index'[^\n]*needs: 'look'/)
  for (const [page, feature] of [['day', 'day'], ['look', 'look'], ['messages', 'messages'], ['robot', 'companion'], ['agent', 'character'], ['voiceprint', 'voiceprint']]) {
    const src = readFileSync(new URL(`../pages/${page}/index.vue`, import.meta.url), 'utf8')
    assert.match(src, new RegExp(`useFeatureGate\\('${feature}'\\)`), page)
    assert.match(src, /<tb-not-here v-if="notHere" \/>/, page)
  }
})
