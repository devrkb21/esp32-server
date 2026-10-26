import assert from 'node:assert/strict'
import test from 'node:test'
import { agoOf, badgeCount, base64UrlToBytes, bytesToBase64Url, clampMinutes, GROUPS, groupOf, inkOf, prefsWithDefaults, targetOf, textOf } from './notifyModel.mjs'

test('types fall into the switchable groups', () => {
  assert.equal(groupOf('robot_offline'), 'offline')
  assert.equal(groupOf('care_fall'), 'care')
  assert.equal(groupOf('family_invite'), 'family')
  assert.equal(groupOf('test'), '')
  assert.deepEqual(GROUPS, ['offline', 'alarm', 'reminder', 'care', 'summary', 'family'])
})

test('marks keep area inks and states', () => {
  assert.equal(inkOf('alarm_missed'), 'alarm')
  assert.equal(inkOf('care_fall'), 'danger')
  assert.equal(inkOf('care_no_activity'), 'warn')
  assert.equal(inkOf('daily_summary'), 'ink-2')
})

test('text follows the language, then falls back', () => {
  const n = { titleBn: 'শিরোনাম', titleEn: 'Title', bodyBn: '', bodyEn: 'Body' }
  assert.deepEqual(textOf(n, 'bn'), { title: 'শিরোনাম', body: 'Body' })
  assert.deepEqual(textOf(n, 'en'), { title: 'Title', body: 'Body' })
  assert.deepEqual(textOf(null, 'en'), { title: '', body: '' })
})

test('badge count', () => {
  assert.equal(badgeCount(0), '')
  assert.equal(badgeCount(3), '3')
  assert.equal(badgeCount(12), '9+')
})

test('prefs get defaults and clamps', () => {
  const p = prefsWithDefaults({ types: { care: false }, offlineMinutes: 5 })
  assert.equal(p.types.care, false)
  assert.equal(p.types.offline, true)
  assert.equal(p.offlineMinutes, 10)
  assert.equal(p.summaryPush, true)
  assert.equal(prefsWithDefaults(null).offlineMinutes, 30)
  assert.equal(clampMinutes(9999), 720)
})

test('ago', () => {
  const now = 10 * 86400000
  assert.deepEqual(agoOf(now - 10000, now), { key: 'justNow', n: 0 })
  assert.deepEqual(agoOf(now - 5 * 60000, now), { key: 'minutes', n: 5 })
  assert.deepEqual(agoOf(now - 3 * 3600000, now), { key: 'hours', n: 3 })
  assert.deepEqual(agoOf(now - 2 * 86400000, now), { key: 'days', n: 2 })
  assert.equal(agoOf(now - 9 * 86400000, now).key, 'date')
})

test('targets', () => {
  assert.equal(targetOf({ type: 'daily_summary' }), '/pages/summary/index')
  assert.equal(targetOf({ type: 'care_fall' }), '/pages/robot/index')
  assert.equal(targetOf({ type: 'test' }), '')
})

test('base64url round trip', () => {
  const bytes = new Uint8Array([0, 251, 255, 62, 63, 1])
  const s = bytesToBase64Url(bytes.buffer)
  assert.ok(!/[+/=]/.test(s))
  assert.deepEqual([...base64UrlToBytes(s)], [...bytes])
})
