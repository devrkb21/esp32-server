/* eslint-disable test/no-import-node-test -- this zero-dependency gate intentionally uses Node's built-in runner */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  agoParts,
  asciiLabel,
  clampInt,
  describeDays,
  hasDay,
  isHHMM,
  isLastPageOn,
  newReminder,
  nextPrayer,
  removeById,
  ROBOT_PAGES,
  robotPages,
  sortByTime,
  stripAlarm,
  stripReminder,
  toggleDay,
  upsertById,
} from './companionUtils.mjs'

test('weekday mask: bit 0 is Sunday and presets are recognised', () => {
  assert.equal(hasDay(1, 0), true)
  assert.equal(hasDay(1, 1), false)
  assert.equal(toggleDay(127, 0), 126)
  assert.equal(toggleDay(0, 6), 64)
  assert.deepEqual(describeDays(127), { preset: 'everyDay', days: [] })
  assert.deepEqual(describeDays(31), { preset: 'sunToThu', days: [] })
  assert.deepEqual(describeDays(96), { preset: 'friSat', days: [] })
  assert.deepEqual(describeDays(0), { preset: 'once', days: [] })
  assert.deepEqual(describeDays(2 | 8), { preset: null, days: ['mon', 'wed'] })
})

test('labels keep printable ASCII only, max 24 characters', () => {
  assert.equal(asciiLabel('Wake up আজ'), 'Wake up ')
  assert.equal(asciiLabel('a'.repeat(30)).length, 24)
  assert.equal(asciiLabel(null), '')
  assert.equal(asciiLabel('tab\there'), 'tabhere')
  assert.equal(asciiLabel('a   b'), 'a b')
})

test('next prayer is the first one after now, else tomorrow fajr', () => {
  const days = [
    { date: '2026-10-24', fajr: '04:48', sunrise: '06:02', dhuhr: '11:44', asr: '15:48', maghrib: '17:26', isha: '18:40' },
    { date: '2026-10-25', fajr: '04:49', sunrise: '06:02', dhuhr: '11:44', asr: '15:47', maghrib: '17:25', isha: '18:40' },
  ]
  assert.deepEqual(nextPrayer(days, new Date(2026, 9, 24, 12, 0)), { key: 'asr', time: '15:48', tomorrow: false })
  assert.deepEqual(nextPrayer(days, new Date(2026, 9, 24, 6, 30)), { key: 'dhuhr', time: '11:44', tomorrow: false })
  assert.deepEqual(nextPrayer(days, new Date(2026, 9, 24, 20, 0)), { key: 'fajr', time: '04:49', tomorrow: true })
  assert.equal(nextPrayer([], new Date()), null)
})

test('ago parts from unix seconds', () => {
  const now = 1_793_000_000_000
  assert.deepEqual(agoParts(0, now), { key: 'never', n: 0 })
  assert.deepEqual(agoParts(now / 1000 - 30, now), { key: 'justNow', n: 0 })
  assert.deepEqual(agoParts(now / 1000 - 600, now), { key: 'minutesAgo', n: 10 })
  assert.deepEqual(agoParts(now / 1000 - 7200, now), { key: 'hoursAgo', n: 2 })
  assert.deepEqual(agoParts(now / 1000 - 3 * 86400, now), { key: 'daysAgo', n: 3 })
})

test('strip helpers drop server-derived fields and keep only the reminder mode fields', () => {
  assert.deepEqual(
    stripAlarm({ id: 'a1', time: '06:30', days: 62, label: 'Up', enabled: true, snooze_min: 5, say: 'hi', say_audio: '/x.ogg' }),
    { id: 'a1', time: '06:30', days: 62, label: 'Up', enabled: true, snooze_min: 5, say: 'hi' },
  )
  const interval = stripReminder({ id: 'r1', kind: 'water', label: 'Drink water', enabled: true, mode: 'interval', every_min: 45, from: '08:00', to: '20:00', time: '09:00', days: 127, say_audio: null })
  assert.equal(interval.time, undefined)
  assert.equal(interval.every_min, 45)
  assert.equal('say_audio' in interval, false)
  const timed = stripReminder({ kind: 'medicine', label: 'Medicine', enabled: true, mode: 'time', time: '21:00', every_min: 60, days: 127 })
  assert.equal(timed.every_min, undefined)
  assert.equal(timed.time, '21:00')
  assert.equal('id' in timed, false)
})

test('list helpers', () => {
  const list = [{ id: 'a', time: '09:00' }, { id: 'b', time: '06:00' }]
  assert.deepEqual(upsertById(list, { id: 'a', time: '07:00' }).map(x => x.time), ['07:00', '06:00'])
  assert.equal(upsertById(list, { time: '05:00' }).length, 3)
  assert.deepEqual(removeById(list, 'a').map(x => x.id), ['b'])
  assert.deepEqual(sortByTime(list).map(x => x.id), ['b', 'a'])
  assert.equal(list[0].id, 'a')
})

test('validation helpers and reminder defaults', () => {
  assert.equal(isHHMM('06:30'), true)
  assert.equal(isHHMM('24:00'), false)
  assert.equal(isHHMM('6:30'), false)
  assert.equal(clampInt('200', 5, 120, 25), 120)
  assert.equal(clampInt('x', 5, 120, 25), 25)
  assert.equal(newReminder('water').mode, 'interval')
  assert.equal(newReminder('medicine').time, '21:00')
  assert.equal(newReminder('custom').kind, 'custom')
})

test('robot pages helpers', () => {
  assert.deepEqual(Object.keys(robotPages(undefined)), ROBOT_PAGES)
  assert.equal(robotPages({ games: false }).games, false)
  assert.equal(robotPages({ games: false }).bond, true)
  const one = Object.fromEntries(ROBOT_PAGES.map(k => [k, k === 'bond']))
  assert.equal(isLastPageOn(one, 'bond'), true)
  assert.equal(isLastPageOn(one, 'clock'), false)
  assert.equal(isLastPageOn({}, 'clock'), false)
})
