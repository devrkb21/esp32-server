import assert from 'node:assert/strict'
import { test } from 'node:test'
import { banglaDate, banglaDateText, digits, minutesOf, timeText } from './calendar.mjs'

const d = (y, m, day) => new Date(y, m - 1, day)

test('Bangla year starts on 14 April', () => {
  assert.deepEqual(banglaDate(d(2026, 4, 14)), { year: 1433, month: 0, day: 1 })
  assert.deepEqual(banglaDate(d(2026, 4, 13)), { year: 1432, month: 11, day: 30 })
})
test('fixed national dates', () => {
  assert.deepEqual(banglaDate(d(2025, 12, 16)), { year: 1432, month: 8, day: 1 })
  assert.deepEqual(banglaDate(d(2026, 2, 21)), { year: 1432, month: 10, day: 8 })
  assert.deepEqual(banglaDate(d(2026, 10, 17)), { year: 1433, month: 6, day: 1 })
})
test('Bangla numerals', () => {
  assert.equal(banglaDateText(d(2026, 10, 25), 'bn'), '৯ কার্তিক ১৪৩৩')
  assert.equal(digits('10:42', 'bn'), '১০:৪২')
  assert.equal(timeText('15:45', 'bn', true), '৩:৪৫')
  assert.equal(minutesOf('07:30'), 450)
})

test('Bangla day parts keep 12-hour times unambiguous', async () => {
  const { dayPart, timeWithPart } = await import('./calendar.mjs')
  assert.equal(dayPart('04:46', 'bn'), 'ভোর')
  assert.equal(dayPart('09:00', 'bn'), 'সকাল')
  assert.equal(dayPart('21:00', 'bn'), 'রাত')
  assert.equal(dayPart('17:25', 'bn'), 'সন্ধ্যা')
  assert.equal(dayPart('00:30', 'bn'), 'রাত')
  assert.equal(dayPart('15:46', 'bn'), 'বিকেল')
  assert.equal(timeWithPart('21:00', 'bn'), 'রাত ৯:০০')
  assert.equal(dayPart('21:00', 'en'), '')
  assert.equal(timeText('15:45', 'bn', true), '৩:৪৫')
})
