/* eslint-disable test/no-import-node-test -- this zero-dependency gate intentionally uses Node's built-in runner */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clampPercent,
  dateText,
  filterRecordings,
  isNotConfigured,
  payloadOf,
  recordingsFrom,
  sameSecurity,
  securityOf,
  securityPayload,
  transcriptOf,
  validate,
  withCurrent,
} from './voiceprintModel.mjs'

test('transcriptOf reads plain text and the speaker JSON', () => {
  assert.deepEqual(transcriptOf(' hello '), { text: 'hello', speaker: '' })
  assert.deepEqual(transcriptOf('{"speaker":"Rina","content":"কেমন আছো?"}'), { text: 'কেমন আছো?', speaker: 'Rina' })
  assert.deepEqual(transcriptOf('{not json'), { text: '{not json', speaker: '' })
  assert.deepEqual(transcriptOf(null), { text: '', speaker: '' })
})

test('recordingsFrom keeps one entry per audio and only user lines', () => {
  const list = recordingsFrom([
    { audioId: 'a', content: 'one' },
    { audioId: 'a', content: 'dup' },
    { audioId: '', content: 'no audio' },
    { audioId: 'b', content: 'bot', chatType: 2 },
    { audioId: 'c', content: 'user', chatType: 1 },
  ])
  assert.deepEqual(list.map(r => r.audioId), ['a', 'c'])
  assert.deepEqual(recordingsFrom(null), [])
})

test('withCurrent puts the recording in use on top when missing', () => {
  const list = [{ audioId: 'a', text: 'x', speaker: '' }]
  assert.equal(withCurrent(list, 'a'), list)
  assert.deepEqual(withCurrent(list, 'z').map(r => r.audioId), ['z', 'a'])
  assert.equal(withCurrent(list, ''), list)
})

test('filterRecordings matches words and keeps the picked one', () => {
  const list = [{ audioId: 'a', text: 'Good morning', speaker: '' }, { audioId: 'b', text: 'tea', speaker: 'Rina' }]
  assert.deepEqual(filterRecordings(list, 'rina', '').map(r => r.audioId), ['b'])
  assert.deepEqual(filterRecordings(list, 'zzz', 'a').map(r => r.audioId), ['a'])
  assert.equal(filterRecordings(list, ' ', '').length, 2)
})

test('validate needs a recording and a name; the description is optional', () => {
  assert.deepEqual(validate({ audioId: 'a', sourceName: 'Ammu', introduce: '' }), {})
  assert.deepEqual(Object.keys(validate({ audioId: '', sourceName: '  ' })).sort(), ['audioId', 'sourceName'])
  assert.equal(validate({ audioId: 'a', sourceName: 'x'.repeat(33) }).sourceName, 'mVp.err.nameLong')
  assert.equal(validate({ audioId: 'a', sourceName: 'x', introduce: 'y'.repeat(101) }).introduce, 'mVp.err.introLong')
})

test('payloadOf builds the add and the update bodies', () => {
  assert.deepEqual(payloadOf({ audioId: 'a', sourceName: ' Ammu ', introduce: ' mother ' }, 'ag', null), { agentId: 'ag', audioId: 'a', sourceName: 'Ammu', introduce: 'mother' })
  assert.deepEqual(payloadOf({ id: '7', audioId: 'b', sourceName: 'Abbu', introduce: '' }, 'ag', { id: '7', createDate: '2026-10-01 10:00:00' }), { id: '7', createDate: '2026-10-01 10:00:00', audioId: 'b', sourceName: 'Abbu', introduce: '' })
})

test('security policy: defaults, snapping, payload, comparison', () => {
  assert.deepEqual(securityOf(null), { percent: 70, requireVoiceMatchSmartHome: false, adminSpeakerOnly: true })
  assert.equal(securityOf({ confidenceThreshold: 0.83 }).percent, 85)
  assert.equal(clampPercent(20), 50)
  assert.equal(clampPercent(120), 95)
  assert.deepEqual(securityPayload({ percent: 75, requireVoiceMatchSmartHome: 1, adminSpeakerOnly: 0 }), { confidenceThreshold: 0.75, requireVoiceMatchSmartHome: true, adminSpeakerOnly: false })
  const s = securityOf({ confidenceThreshold: 0.7, adminSpeakerOnly: true })
  assert.ok(sameSecurity(s, { ...s }))
  assert.ok(!sameSecurity(s, { ...s, percent: 80 }))
})

test('errors: not configured', () => {
  assert.ok(isNotConfigured(new Error('Request error [10054]: not configured')))
  assert.ok(!isNotConfigured(new Error('timeout')))
})

test('dateText in both languages', () => {
  assert.equal(dateText('2026-10-12 08:30:00', 'en'), '12 Oct 2026')
  assert.equal(dateText('2026-10-02T08:30:00Z', 'bn'), '২ অক্টো ২০২৬')
  assert.equal(dateText('', 'en'), '')
  assert.equal(dateText('yesterday', 'en'), 'yesterday')
})
