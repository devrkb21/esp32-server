/* eslint-disable test/no-import-node-test -- this zero-dependency gate intentionally uses Node's built-in runner */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  aliasChange,
  characterNameError,
  cleanCode,
  clientId,
  companionVolume,
  hasErrors,
  isOnline,
  isValidCode,
  keepSelection,
  lastSeen,
  manualErrors,
  nameMatches,
  parseStatus,
  parseTime,
  toRobot,
  versionText,
} from './robotsModel.mjs'

test('the bind code keeps six digits, Bangla digits included', () => {
  assert.equal(cleanCode('12a3 45678'), '123456')
  assert.equal(cleanCode('১২৩৪৫৬'), '123456')
  assert.equal(cleanCode(null), '')
  assert.equal(isValidCode('123456'), true)
  assert.equal(isValidCode('12345'), false)
})

test('a character needs a name of 1 to 64 characters', () => {
  assert.equal(characterNameError('  '), 'required')
  assert.equal(characterNameError('TinyBot'), '')
  assert.equal(characterNameError('x'.repeat(65)), 'tooLong')
})

test('add by MAC checks every field', () => {
  assert.deepEqual(manualErrors({ macAddress: '', board: '', appVersion: ' ' }), { macAddress: 'required', board: 'required', appVersion: 'required' })
  assert.equal(manualErrors({ macAddress: '00:1A:2B:3C:4D', board: 'b', appVersion: '1' }).macAddress, 'invalid')
  const ok = manualErrors({ macAddress: '00-1a-2b-3c-4d-5e', board: 'b', appVersion: '1.0.0' })
  assert.equal(hasErrors(ok), false)
})

test('delete needs the exact name', () => {
  assert.equal(nameMatches('TinyBot', 'TinyBot'), true)
  assert.equal(nameMatches('tinybot', 'TinyBot'), false)
  assert.equal(nameMatches('', ''), false)
})

test('device times: string ms, seconds, ISO', () => {
  assert.equal(parseTime('1783689702000'), 1783689702000)
  assert.equal(parseTime(1783689702), 1783689702000)
  assert.equal(parseTime('2026-01-02T03:04:05Z'), Date.UTC(2026, 0, 2, 3, 4, 5))
  assert.ok(Number.isNaN(parseTime(null)))
})

test('last seen falls in the right bucket', () => {
  const now = 1_800_000_000_000
  assert.equal(lastSeen(null, now).kind, 'never')
  assert.equal(lastSeen(String(now - 30_000), now).kind, 'just')
  assert.deepEqual(lastSeen(String(now - 5 * 60_000), now), { kind: 'minutes', n: 5, at: now - 5 * 60_000 })
  assert.equal(lastSeen(String(now - 3 * 3_600_000), now).n, 3)
  assert.equal(lastSeen(String(now - 2 * 86_400_000), now).kind, 'days')
  assert.equal(lastSeen(String(now - 9 * 86_400_000), now).kind, 'date')
})

test('online map from the gateway', () => {
  const device = { macAddress: '28:84:85:00:00:01', board: 'tinybot' }
  assert.equal(clientId(device), 'tinybot@@@28_84_85_00_00_01@@@28_84_85_00_00_01')
  const map = parseStatus(JSON.stringify({ [clientId(device)]: { isAlive: null, exists: true } }))
  assert.equal(isOnline(map, device), true)
  assert.equal(isOnline({ [clientId(device)]: { isAlive: false, exists: true } }, device), false)
  assert.equal(isOnline(null, device), false)
  assert.equal(parseStatus('not json'), null)
  assert.equal(parseStatus(''), null)
})

test('robots and the kept selection', () => {
  const r = toRobot({ id: 'a', agentName: 'TinyBot' }, { id: 'd', alias: '', macAddress: 'm', lastConnectedAtTimestamp: '1' })
  assert.deepEqual(r, { deviceId: 'd', agentId: 'a', agentName: 'TinyBot', name: '', macAddress: 'm', lastConnectedAt: '1' })
  assert.equal(keepSelection([], 'd'), null)
  assert.equal(keepSelection([r, { ...r, deviceId: 'e' }], 'e').deviceId, 'e')
  assert.equal(keepSelection([r], 'gone').deviceId, 'd')
})

test('version, volume and alias', () => {
  assert.equal(versionText('2.5.5'), 'v2.5.5')
  assert.equal(versionText('V1'), 'V1')
  assert.equal(versionText(''), '')
  assert.equal(companionVolume({ stats: { volume: 61.4 }, settings: { volume: 20 } }), 61)
  assert.equal(companionVolume({ settings: { volume: 20 } }), 20)
  assert.equal(companionVolume({ stats: { volume: 140 } }), null)
  assert.deepEqual(aliasChange('A', ' A '), { ok: false, text: 'A', reason: 'same' })
  assert.equal(aliasChange('', 'x'.repeat(65)).reason, 'tooLong')
  assert.deepEqual(aliasChange('', 'Desk'), { ok: true, text: 'Desk' })
})
