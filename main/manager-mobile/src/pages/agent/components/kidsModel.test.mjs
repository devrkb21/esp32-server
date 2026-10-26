/* eslint-disable test/no-import-node-test -- runs with Node's built-in runner, no dependency */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { it } from 'node:test'
import { addTopic, hasTopic, kidsSignature, MAX_TOPICS, normalizeKids, quotaView, removeTopic } from './kidsModel.mjs'

it('normalizes the API settings', () => {
  assert.deepEqual(normalizeKids(null), { enabled: false, age: 7, blockedTopics: [] })
  const k = normalizeKids({ enabled: true, age: 30, blockedTopics: [' ভূত ', 'Horror', 'horror', '', 'x'.repeat(60)] })
  assert.equal(k.age, 12)
  assert.deepEqual(k.blockedTopics, ['ভূত', 'Horror', 'x'.repeat(40)])
  assert.equal(normalizeKids({ age: 1 }).age, 3)
})

it('adds and removes topics within the limit', () => {
  let t = addTopic([], '  যুদ্ধ ')
  t = addTopic(t, 'যুদ্ধ')
  assert.deepEqual(t, ['যুদ্ধ'])
  assert.equal(hasTopic(t, 'যুদ্ধ'), true)
  assert.deepEqual(removeTopic(t, 'যুদ্ধ'), [])
  const full = Array.from({ length: MAX_TOPICS }, (_, i) => `t${i}`)
  assert.equal(addTopic(full, 'more').length, MAX_TOPICS)
  assert.equal(kidsSignature({ enabled: true, age: 7 }), kidsSignature({ enabled: true, age: '7', blockedTopics: [] }))
})

it('shows the quota only with a limit', () => {
  assert.equal(quotaView(null), null)
  assert.equal(quotaView({ limit: 0, used: 3 }), null)
  assert.deepEqual(quotaView({ limit: 200, used: 150, blocked: 0 }), { limit: 200, used: 150, left: 50, exceeded: false, blocked: 0, pct: 75 })
  assert.equal(quotaView({ limit: 100, used: 120 }).exceeded, true)
})

it('strings exist in both languages without an em dash', async () => {
  const src = readFileSync(new URL('../../../i18n/pages/m-ai.ts', import.meta.url), 'utf8')
  assert.equal(src.includes('—'), false)
  const keys = lang => [...src.split(`${lang}: {`)[1].split('\n  },')[0].matchAll(/'([\w.]+)':/g)].map(m => m[1]).sort()
  assert.deepEqual(keys('bn'), keys('en'))
  assert.ok(keys('bn').includes('kids.title'))
})

it('the character screen shows kids mode only for robots with the feature', () => {
  const edit = readFileSync(new URL('../edit.vue', import.meta.url), 'utf8')
  assert.match(edit, /hasFeature\('kids_mode'\)/)
  assert.match(edit, /<KidsSection v-if="kidsAllowed"/)
  assert.match(edit, /<QuotaNote /)
})
