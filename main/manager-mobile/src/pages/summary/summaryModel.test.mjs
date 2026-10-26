import assert from 'node:assert/strict'
import test from 'node:test'
import { axisRange, bestGame, bondLine, focusBars, moodKey, summaryText, timeline, totals } from './summaryModel.mjs'

const today = new Date(2026, 9, 26)
const rows = [
  { day: '2026-10-26', bondScore: 64, focusMinutes: 50, talkCount: 12, remindersDone: 2, remindersMissed: 1, textBn: 'বাংলা', textEn: 'English', highScores: { catch: 18, simon: 9, reaction_ms: 300 } },
  { day: '2026-10-25', bondScore: 60, focusMinutes: 25, talkCount: 4 },
  { day: '2026-10-23', bondScore: 58, focusMinutes: 0, talkCount: 1 },
]

test('timeline keeps missing days as gaps, oldest first', () => {
  const t = timeline(rows, 5, today)
  assert.deepEqual(t.map(d => d.day), ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26'])
  assert.equal(t[0].row, null)
  assert.equal(t[2].row, null)
  assert.equal(t[4].row.bondScore, 64)
})

test('axis range is whole tens and at least 10 wide', () => {
  assert.deepEqual(axisRange([58, 64]), { min: 50, max: 70 })
  assert.deepEqual(axisRange([60, 60]), { min: 60, max: 70 })
  assert.deepEqual(axisRange([null]), { min: 0, max: 100 })
})

test('bond line breaks at a missing day', () => {
  const t = timeline(rows, 5, today)
  const line = bondLine(t, 400, 100)
  assert.equal(line.points.length, 3)
  assert.equal(line.segments.length, 1) // only 25 -> 26 are neighbours
  const s = line.segments[0]
  assert.equal(Math.round(s.x), 300)
  assert.ok(s.angle < 0) // the score went up: the line rises
  assert.equal(line.points[0].y, 100 - ((58 - 50) / 20) * 100)
})

test('focus bars share the busiest day', () => {
  const f = focusBars(timeline(rows, 5, today))
  assert.equal(f.max, 50)
  assert.deepEqual(f.bars.map(b => b.share), [0, 0, 0, 0.5, 1])
  assert.equal(f.bars[0].has, false)
})

test('totals, text, mood and best game', () => {
  assert.deepEqual(totals(rows), { talkCount: 17, focusMinutes: 75, remindersDone: 2, remindersMissed: 1, days: 3 })
  assert.equal(summaryText(rows[0], 'bn'), 'বাংলা')
  assert.equal(summaryText(rows[0], 'en'), 'English')
  assert.equal(summaryText(null, 'en'), '')
  assert.equal(moodKey('Happy'), 'happy')
  assert.equal(moodKey('Grumpy'), '')
  assert.deepEqual(bestGame(rows[0]), ['catch', 18])
  assert.equal(bestGame(rows[1]), null)
})
