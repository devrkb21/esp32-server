/* eslint-disable test/no-import-node-test -- this zero-dependency gate intentionally uses Node's built-in runner */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  agoParts,
  asciiLabel,
  clampInt,
  companionVolume,
  describeDays,
  DIM_PRESETS,
  DISPLAY_DEFAULTS,
  displayProblem,
  displaySettings,
  hasDay,
  isHHMM,
  isLastPageOn,
  isMinutes,
  MEMORY_DEFAULTS,
  MEMORY_KINDS,
  memoryDay,
  memoryKindKey,
  memoryList,
  memorySettings,
  newReminder,
  nextPrayer,
  NIGHT_LIGHT_MAX,
  NIGHT_LIGHT_PRESETS,
  OFF_PRESETS,
  PROACTIVE_DEFAULTS,
  proactiveProblem,
  proactiveSettings,
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

test('display, night light and volume helpers', () => {
  assert.deepEqual(displaySettings(undefined), DISPLAY_DEFAULTS)
  assert.deepEqual(displaySettings({ dim_after_min: 0, off_after_min: 600 }), { dim_after_min: 0, off_after_min: 600 })
  assert.deepEqual(displaySettings({ dim_after_min: 121, off_after_min: 2.5 }), DISPLAY_DEFAULTS)
  assert.equal(isMinutes(600, NIGHT_LIGHT_MAX), true)
  assert.equal(isMinutes(601, NIGHT_LIGHT_MAX), false)
  assert.equal(displayProblem({ dim_after_min: 3, off_after_min: 20 }), '')
  assert.equal(displayProblem({ dim_after_min: 10, off_after_min: 0 }), '')
  assert.equal(displayProblem({ dim_after_min: 10, off_after_min: 5 }), 'offBeforeDim')
  assert.equal(displayProblem({ dim_after_min: -1, off_after_min: 5 }), 'dimRange')
  assert.equal(displayProblem({ dim_after_min: 1, off_after_min: 700 }), 'offRange')
  assert.equal(DIM_PRESETS.includes(DISPLAY_DEFAULTS.dim_after_min), true)
  assert.equal(OFF_PRESETS.includes(DISPLAY_DEFAULTS.off_after_min), true)
  assert.equal(NIGHT_LIGHT_PRESETS[0], 0)
  assert.equal(companionVolume({ stats: { volume: 100 }, settings: { volume: 50 } }), 100)
  assert.equal(companionVolume({ stats: {}, settings: { volume: 50 } }), 50)
  assert.equal(companionVolume({ stats: { volume: null }, settings: { volume: null } }), null)
  assert.equal(companionVolume(null), null)
})

test('proactive talk helpers', () => {
  assert.deepEqual(PROACTIVE_DEFAULTS, { enabled: true, morning_on: true, morning: '07:30', evening_on: true, evening: '19:30' })
  assert.deepEqual(proactiveSettings(undefined), PROACTIVE_DEFAULTS)
  assert.deepEqual(
    proactiveSettings({ enabled: false, morning_on: false, morning: '06:05', evening_on: false, evening: '23:59' }),
    { enabled: false, morning_on: false, morning: '06:05', evening_on: false, evening: '23:59' },
  )
  assert.deepEqual(proactiveSettings({ enabled: 'no', morning_on: 0, morning: '7:30', evening_on: null, evening: '24:00' }), PROACTIVE_DEFAULTS)
  assert.deepEqual(Object.keys(proactiveSettings({ extra: 1 })), Object.keys(PROACTIVE_DEFAULTS))
  assert.equal(proactiveProblem({ morning: '07:30', evening: '19:30' }), '')
  assert.equal(proactiveProblem({ morning: '7:30', evening: '19:30' }), 'morningTime')
  assert.equal(proactiveProblem({ morning: '07:30', evening: '' }), 'eveningTime')
  assert.equal(proactiveProblem(undefined), 'morningTime')
})

test('memory helpers', () => {
  assert.deepEqual(MEMORY_DEFAULTS, { enabled: true })
  assert.deepEqual(memorySettings(undefined), { enabled: true })
  assert.deepEqual(memorySettings({ enabled: false }), { enabled: false })
  assert.deepEqual(memorySettings({ enabled: 'no' }), { enabled: true })

  const notes = memoryList([
    { id: 'm3', text: 'রিমির শুক্রবার গণিত পরীক্ষা', kind: 'event', created: '2026-10-20T18:01:02', updated: '2026-10-21T08:00:00', until: '2026-10-30' },
    null,
    'text',
    { id: '', text: 'no id', kind: 'fact' },
    { id: 'm4', text: '   ', kind: 'fact' },
    { id: 'm2', text: ' Likes mangoes ', kind: 'strange', created: 'yesterday', updated: 5, until: '30/10' },
    { id: 'm3', text: 'duplicate id', kind: 'fact' },
    { id: 7, text: 'number id' },
    { id: 'm1', text: 'Rimi is 9', kind: 'person', created: '2026-10-01T09:00:00', updated: '2026-10-01T09:00:00' },
  ])
  assert.deepEqual(notes.map(n => n.id), ['m3', 'm2', 'm1'])
  assert.deepEqual(notes[0], { id: 'm3', text: 'রিমির শুক্রবার গণিত পরীক্ষা', kind: 'event', created: '2026-10-20T18:01:02', updated: '2026-10-21T08:00:00', until: '2026-10-30' })
  assert.deepEqual(notes[1], { id: 'm2', text: 'Likes mangoes', kind: 'fact', created: '', updated: '' })
  assert.deepEqual(memoryList(undefined), [])
  assert.deepEqual(memoryList({ id: 'x' }), [])

  assert.deepEqual([...MEMORY_KINDS], ['person', 'like', 'dislike', 'event', 'fact', 'routine'])
  assert.equal(memoryKindKey('dislike'), 'companion.memory.kind.dislike')
  assert.equal(memoryKindKey('other'), 'companion.memory.kind.fact')
  assert.equal(memoryDay({ created: '2026-10-01T09:00:00', updated: '2026-10-21T08:00:00' }), '2026-10-21')
  assert.equal(memoryDay({ created: '2026-10-01T09:00:00', updated: '' }), '2026-10-01')
  assert.equal(memoryDay({ created: 'bad' }), '')
  assert.equal(memoryDay(null), '')
})
