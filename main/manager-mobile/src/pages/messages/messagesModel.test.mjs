import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- run with node --test (packet rule)
import { it } from 'node:test'
import {
  agoParts,
  commandSync,
  convPart,
  dateParts,
  dayWord,
  firstLine,
  focusMinutes,
  lineContent,
  mergeSessions,
  messageWhen,
  refreshFirstPage,
  sortMessages,
  speakerOf,
  stampText,
  statusOf,
  syncOf,
  withTimeMarks,
} from './messagesModel.mjs'

it('an answer wins over the delivery status', () => {
  assert.equal(statusOf({ status: 'pending' }), 'pending')
  assert.equal(statusOf({ status: 'delivered' }), 'delivered')
  assert.equal(statusOf({ status: 'delivered', answer: 'yes' }), 'yes')
  assert.equal(statusOf({ status: 'pending', answer: 'seen' }), 'seen')
  assert.equal(statusOf({ status: 'delivered', answer: null }), 'delivered')
  assert.equal(syncOf({ status: 'pending' }), 'pending')
  assert.equal(syncOf({ status: 'delivered' }), 'applied')
  assert.equal(commandSync({ status: 'done' }), 'applied')
  assert.equal(commandSync({ status: 'pending' }), 'pending')
})

it('messages sort newest first, old snapshots use created', () => {
  const list = sortMessages([{ id: 'a', ts: 10 }, { id: 'b', created: 30 }, { id: 'c', ts: 20 }])
  assert.deepEqual(list.map(m => m.id), ['b', 'c', 'a'])
})

it('ago parts follow the legacy steps', () => {
  const now = 1_000_000 * 1000
  assert.deepEqual(agoParts(0, now), { key: 'never', n: 0 })
  assert.deepEqual(agoParts(1_000_000 - 30, now), { key: 'justNow', n: 0 })
  assert.deepEqual(agoParts(1_000_000 - 300, now), { key: 'minutesAgo', n: 5 })
  assert.deepEqual(agoParts(1_000_000 - 7200, now), { key: 'hoursAgo', n: 2 })
  assert.deepEqual(agoParts(1_000_000 - 3 * 86400, now), { key: 'daysAgo', n: 3 })
})

it('focus uses the saved work minutes, else 25', () => {
  assert.equal(focusMinutes({ work_min: 40 }), 40)
  assert.equal(focusMinutes({ work_min: 0 }), 25)
  assert.equal(focusMinutes(null), 25)
})

it('line content reads plain text, an object and an array of parts', () => {
  assert.deepEqual(lineContent('hello'), { speaker: '', parts: [{ type: 'text', text: 'hello' }] })
  assert.deepEqual(lineContent('{"speaker":"Rina","content":"hi"}'), { speaker: 'Rina', parts: [{ type: 'text', text: 'hi' }] })
  const arr = lineContent('[{"type":"text","text":"a"},{"type":"tool","text":"get_weather"}]')
  assert.equal(arr.parts.length, 2)
  assert.equal(arr.parts[1].type, 'tool')
  assert.deepEqual(lineContent(null).parts, [{ type: 'text', text: '' }])
})

it('first line folds long tool results', () => {
  assert.equal(firstLine('short'), 'short')
  assert.equal(firstLine('first line of the result\nsecond'), 'first line of the result...')
  assert.ok(firstLine('x'.repeat(200)).endsWith('...'))
})

it('speaker of a line', () => {
  assert.equal(speakerOf({ chatType: 1 }), 'person')
  assert.equal(speakerOf({ chatType: 2 }), 'bot')
  assert.equal(speakerOf({ chatType: 3 }), 'tool')
})

it('time marks before the first line and after a 5 minute pause', () => {
  const lines = [
    { createdAt: '2026-10-25 10:00:00' },
    { createdAt: '2026-10-25 10:01:00' },
    { createdAt: '2026-10-25 10:07:00' },
  ]
  const out = withTimeMarks(lines)
  assert.deepEqual(out.map(x => (x.mark ? 'm' : 'l')), ['m', 'l', 'l', 'm', 'l'])
})

it('day words, parts and stamps', () => {
  const now = new Date(2026, 9, 25, 12, 0)
  assert.equal(dayWord(new Date(2026, 9, 25, 8, 0), now), 'today')
  assert.equal(dayWord(new Date(2026, 9, 24, 23, 0), now), 'yesterday')
  assert.equal(dayWord(new Date(2026, 9, 20, 8, 0), now), 'older')
  const p = dateParts('2026-10-25 09:05:00', 'bn', now)
  assert.equal(p.day, '২৫')
  assert.equal(p.time, '০৯:০৫')
  assert.equal(stampText('2026-10-25 09:05:00', 'en', { today: 'Today', yesterday: 'Yesterday' }, now), 'Today 09:05')
  assert.equal(stampText('nonsense', 'en', {}, now), '')
  const w = messageWhen(new Date(2026, 9, 20, 8, 0).getTime() / 1000, 'en', now)
  assert.equal(w.word, 'older')
  assert.equal(w.time, '08:00')
  assert.ok(w.date.length > 0)
})

it('sessions merge without duplicates and a refresh replaces the first page', () => {
  const a = [{ sessionId: '1' }, { sessionId: '2' }]
  assert.deepEqual(mergeSessions(a, [{ sessionId: '2' }, { sessionId: '3' }]).map(s => s.sessionId), ['1', '2', '3'])
  const loaded = [{ sessionId: '1' }, { sessionId: '2' }, { sessionId: '3' }]
  const fresh = refreshFirstPage(loaded, [{ sessionId: '0' }, { sessionId: '1' }], 2)
  assert.deepEqual(fresh.map(s => s.sessionId), ['0', '1', '3'])
})

it('convPart names an untitled conversation by the hour it started', () => {
  assert.equal(convPart('2026-10-25 05:00:00'), 'morning')
  assert.equal(convPart('2026-10-25 11:59:00'), 'morning')
  assert.equal(convPart('2026-10-25 12:00:00'), 'noon')
  assert.equal(convPart('2026-10-25 14:30:00'), 'noon')
  assert.equal(convPart('2026-10-25 15:00:00'), 'afternoon')
  assert.equal(convPart('2026-10-25 17:59:00'), 'afternoon')
  assert.equal(convPart('2026-10-25 18:00:00'), 'evening')
  assert.equal(convPart('2026-10-25 19:59:00'), 'evening')
  assert.equal(convPart('2026-10-25 20:00:00'), 'night')
  assert.equal(convPart('2026-10-25 04:59:00'), 'night')
  assert.equal(convPart('not a date'), '')
})
