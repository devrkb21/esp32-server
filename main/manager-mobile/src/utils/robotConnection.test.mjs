/* eslint-disable test/no-import-node-test -- this zero-dependency gate intentionally uses Node's built-in runner */
import assert from 'node:assert/strict'
import test from 'node:test'
import { COMPANION_EVERY_MS, COMPANION_MAX, companionErrorKind, companionsToAsk, connectionOf, isLive, rawErrorText, shouldPoll, STALE_S, STATES, statusInk, statusKeys, toMs } from './robotConnection.mjs'

const NOW = 1_800_000_000_000
const fresh = { ok: true, view: { last_seen: NOW / 1000 - 20 } }
const stale = { ok: true, view: { last_seen: NOW / 1000 - STALE_S - 60 } }

test('alova failures map to error kinds', () => {
  assert.equal(companionErrorKind(new Error('Request error [500]: device not found')), 'not_registered')
  assert.equal(companionErrorKind({ code: 500, msg: 'device not found' }), 'not_registered')
  assert.equal(companionErrorKind({ data: { code: 500, msg: 'Device not found' } }), 'not_registered')
  assert.equal(companionErrorKind('device not found'), 'not_registered')
  assert.equal(companionErrorKind(new Error('Request error [10211]: feature companion')), 'no_companion')
  assert.equal(companionErrorKind(new Error('Request error [500]: Companion server is not reachable')), 'server')
  assert.equal(companionErrorKind(new Error('Request error [10194]: Device does not exist')), 'server')
  assert.equal(companionErrorKind(new Error('HTTP request error [502]：bad gateway')), 'server')
  assert.equal(companionErrorKind({ errMsg: 'request:fail timeout' }), 'network')
  assert.equal(companionErrorKind(new Error('request:fail')), 'network')
  assert.equal(companionErrorKind(null), 'network')
})

test('raw text is kept for the console', () => {
  assert.equal(rawErrorText(new Error('Request error [500]: device not found')), 'Request error [500]: device not found')
  assert.equal(rawErrorText('device not found'), 'device not found')
})

test('online when the last sync is fresh, whatever MQTT says', () => {
  assert.equal(connectionOf({ mqtt: true, companion: fresh, now: NOW }).state, 'online')
  assert.equal(connectionOf({ mqtt: false, companion: fresh, now: NOW }).state, 'online')
  assert.equal(connectionOf({ mqtt: null, companion: fresh, now: NOW }).state, 'online')
})

test('waiting_companion: on MQTT but unknown to the companion server', () => {
  const s = connectionOf({ mqtt: true, companion: { ok: false, kind: 'not_registered' }, now: NOW })
  assert.equal(s.state, 'waiting_companion')
  assert.equal(shouldPoll(s.state), true)
  assert.equal(connectionOf({ mqtt: null, companion: { ok: false, kind: 'not_registered' }, now: NOW }).state, 'waiting_companion')
  assert.equal(connectionOf({ mqtt: true, companion: { ok: true, view: { last_seen: 0, online: false } }, now: NOW }).state, 'not_syncing')
  assert.equal(connectionOf({ mqtt: false, companion: { ok: true, view: { online: true } }, now: NOW }).state, 'online')
})

test('not_syncing: known, on MQTT, last sync old', () => {
  const s = connectionOf({ mqtt: true, companion: stale, now: NOW })
  assert.equal(s.state, 'not_syncing')
  assert.equal(s.lastSeen, stale.view.last_seen * 1000)
})

test('offline, with the newest last seen time', () => {
  const s = connectionOf({ mqtt: false, companion: stale, lastConnectedAt: NOW - 60_000, now: NOW })
  assert.equal(s.state, 'offline')
  assert.equal(s.lastSeen, NOW - 60_000)
  assert.equal(connectionOf({ mqtt: false, companion: { ok: false, kind: 'not_registered' }, now: NOW }).state, 'offline')
  assert.equal(connectionOf({ mqtt: false, now: NOW }).state, 'offline')
  assert.equal(connectionOf({ mqtt: null, companion: stale, now: NOW }).state, 'offline')
})

test('server_error for our server or network failures', () => {
  const s = connectionOf({ mqtt: true, companion: { ok: false, kind: 'server' }, now: NOW })
  assert.equal(s.state, 'server_error')
  assert.equal(s.reason, 'server')
  const n = connectionOf({ mqtt: true, companion: { ok: false, kind: 'network' }, now: NOW })
  assert.equal(n.reason, 'network')
  assert.equal(statusKeys(n.state, n.reason).why, 'status.server_error.whyNetwork')
})

test('checking before anything is known', () => {
  assert.equal(connectionOf({ now: NOW }).state, 'checking')
  assert.equal(connectionOf({ mqtt: true, now: NOW }).state, 'checking')
})

test('a product without the companion module only uses MQTT', () => {
  assert.equal(connectionOf({ hasCompanion: false, mqtt: true, now: NOW }).state, 'online')
  assert.equal(connectionOf({ hasCompanion: false, mqtt: false, now: NOW }).state, 'offline')
  assert.equal(connectionOf({ hasCompanion: false, mqtt: null, now: NOW }).state, 'offline')
  assert.equal(connectionOf({ hasCompanion: false, now: NOW }).state, 'checking')
  assert.equal(connectionOf({ mqtt: true, companion: { ok: false, kind: 'no_companion' }, now: NOW }).state, 'online')
})

test('keys, inks and helpers', () => {
  for (const s of STATES) {
    const k = statusKeys(s)
    assert.equal(k.label, `status.${s}.label`)
    assert.equal(k.next, `status.${s}.next`)
  }
  assert.equal(statusKeys('nonsense').label, 'status.checking.label')
  assert.equal(statusInk('online'), 'ok')
  assert.equal(statusInk('waiting_companion'), 'warn')
  assert.equal(statusInk('server_error'), 'danger')
  assert.equal(statusInk('offline'), 'ink-2')
  assert.equal(isLive('online'), true)
  assert.equal(isLive('not_syncing'), false)
  assert.equal(toMs(1_700_000_000), 1_700_000_000_000)
  assert.ok(Number.isNaN(toMs(null)))
})

test('list screens ask companion views only for online companion robots, once per 30 s, capped', () => {
  const devs = [
    { id: 'on', hasCompanion: true, mqtt: true, askedAt: 0 },
    { id: 'nomap', hasCompanion: true, mqtt: null, askedAt: 0 },
    { id: 'off', hasCompanion: true, mqtt: false, askedAt: 0 },
    { id: 'unasked', hasCompanion: true, askedAt: 0 },
    { id: 'generic', hasCompanion: false, mqtt: true, askedAt: 0 },
    { id: 'recent', hasCompanion: true, mqtt: true, askedAt: NOW - 1000 },
    { id: 'old', hasCompanion: true, mqtt: true, askedAt: NOW - COMPANION_EVERY_MS },
  ]
  assert.deepEqual(companionsToAsk(devs, NOW), ['on', 'nomap', 'old'])
  const many = Array.from({ length: 20 }, (_, i) => ({ id: `d${i}`, hasCompanion: true, mqtt: true }))
  assert.equal(companionsToAsk(many, NOW).length, COMPANION_MAX)
  assert.deepEqual(companionsToAsk(null, NOW), [])
})
