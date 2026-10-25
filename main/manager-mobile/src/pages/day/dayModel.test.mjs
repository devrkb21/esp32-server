/* eslint-disable test/no-import-node-test -- runs with Node's built-in runner, no dependency */
import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  daysPreset,
  daysText,
  dayTimeline,
  firesOn,
  focusProblem,
  nextRow,
  nowActivity,
  nowIndex,
  previewActivity,
  reminderProblem,
  routineOfKey,
  tabOfKey,
} from './dayModel.mjs'

const t = (k, p) => (p ? `${k}:${JSON.stringify(p)}` : k)
// a Monday
const monday = new Date(2026, 9, 26, 10, 0)

const view = {
  online: true,
  stats: { activity: '' },
  settings: {
    night: { enabled: true, start: '22:30', end: '06:30' },
    routine: { enabled: true, items: [{ start: '08:00', end: '08:15', activity: 'exercise' }, { start: '23:30', end: '00:30', activity: 'book' }] },
    proactive: { enabled: true, morning_on: true, morning: '07:30', evening_on: false, evening: '19:30' },
  },
  alarms: [
    { id: 'a1', time: '06:45', days: 62, label: 'Wake up', enabled: true },
    { id: 'a2', time: '09:00', days: 64, label: 'Sat only', enabled: true },
    { id: 'a3', time: '21:00', days: 127, label: '', enabled: false },
  ],
  reminders: [
    { id: 'r1', kind: 'water', mode: 'interval', every_min: 90, from: '09:00', to: '21:00', days: 127, enabled: true },
    { id: 'r2', kind: 'medicine', mode: 'time', time: 'bad', days: 127, enabled: true },
  ],
  prayer: { enabled: true, remind: true, days: [{ date: '2026-10-26', fajr: '04:46', sunrise: '06:05', dhuhr: '11:43', asr: '15:46', maghrib: '17:25', isha: '18:40' }] },
}

it('firesOn reads the weekday bit, a missing mask is every day', () => {
  assert.equal(firesOn(62, monday), true)
  assert.equal(firesOn(64, monday), false)
  assert.equal(firesOn(undefined, monday), true)
})

it('dayTimeline lists every timed row of the day with its ink and sync', () => {
  const rows = dayTimeline(view, monday, t, x => x, { alarms: true })
  const keys = rows.map(r => r.key)
  assert.deepEqual(keys.filter(k => k.startsWith('p-')), ['p-fajr', 'p-dhuhr', 'p-asr', 'p-maghrib', 'p-isha'])
  assert.ok(keys.includes('a-a1'))
  assert.ok(!keys.includes('a-a2'), 'a Saturday alarm is not on Monday')
  assert.equal(rows.find(r => r.key === 'a-a1').sync, 'pending')
  assert.equal(rows.find(r => r.key === 'a-a3').sync, 'off')
  assert.equal(rows.find(r => r.key === 'r-r1').time, '09:00')
  assert.ok(!keys.includes('r-r2'), 'a reminder without a valid time has no row')
  assert.ok(keys.includes('l-08:00-exercise'))
  assert.ok(keys.includes('talk-morning'))
  assert.ok(!keys.includes('talk-evening'))
  assert.ok(keys.includes('night'))
  assert.equal(rows.find(r => r.key === 'p-fajr').ink, 'prayer')
})

it('dayTimeline skips switched-off areas', () => {
  const off = { ...view, prayer: { ...view.prayer, enabled: false }, settings: { ...view.settings, routine: { enabled: false, items: [] }, proactive: { enabled: false }, night: { enabled: false } } }
  const keys = dayTimeline(off, monday, t).map(r => r.key)
  assert.ok(!keys.some(k => k.startsWith('p-') || k.startsWith('l-') || k.startsWith('talk-') || k === 'night'))
  assert.deepEqual(dayTimeline(null, monday, t), [])
})

it('tabOfKey and routineOfKey map row keys to areas', () => {
  assert.equal(tabOfKey('a-x'), 'alarms')
  assert.equal(tabOfKey('r-x'), 'reminders')
  assert.equal(tabOfKey('p-fajr'), 'prayer')
  assert.equal(tabOfKey('l-08:00-tea'), 'routine')
  assert.equal(tabOfKey('talk-evening'), 'talk')
  assert.equal(tabOfKey('night'), 'night')
  assert.equal(tabOfKey('zzz'), '')
  assert.deepEqual(routineOfKey('l-08:00-tea'), { start: '08:00', activity: 'tea' })
  assert.equal(routineOfKey('a-1'), null)
})

it('nextRow is the first row on after now', () => {
  const rows = dayTimeline(view, monday, t)
  assert.equal(nextRow(rows, 10 * 60).key, 'p-dhuhr')
  assert.equal(nextRow([{ time: '11:00', sync: 'off' }], 600), null)
})

it('now and preview activity follow the robot, then the routine', () => {
  assert.equal(nowActivity(view, 8 * 60 + 5), 'exercise')
  assert.equal(nowActivity({ ...view, stats: { activity: 'tea' } }, 8 * 60 + 5), 'tea')
  assert.equal(nowActivity(view, 12 * 60), '')
  const routine = view.settings.routine
  assert.equal(previewActivity('art', null, routine, 0), 'art')
  assert.equal(previewActivity('', null, routine, 12 * 60), 'exercise')
  assert.equal(previewActivity('', null, routine, 23 * 60 + 45), 'book')
  assert.equal(nowIndex(routine, 8 * 60 + 1), 0)
  assert.equal(nowIndex(routine, 15), 1, 'an item crossing midnight covers the early hours')
  assert.equal(nowIndex(routine, 12 * 60), -1)
})

it('form problems follow the legacy limits', () => {
  assert.equal(reminderProblem({ mode: 'interval', from: '09:00', to: '21:00' }), '')
  assert.equal(reminderProblem({ mode: 'interval', from: '9', to: '21:00' }), 'time')
  assert.equal(reminderProblem({ mode: 'time', time: '' }), 'time')
  assert.equal(focusProblem({ work_min: 25, rounds: 4, short_break_min: 5, long_break_min: 15 }), null)
  assert.deepEqual(focusProblem({ work_min: 121, rounds: 4, short_break_min: 5, long_break_min: 15 }), { field: 'work_min', min: 1, max: 120 })
})

it('days text names presets, then the days', () => {
  assert.equal(daysPreset(127), 'everyDay')
  assert.equal(daysPreset(0), 'once')
  assert.equal(daysText(31, t), 'day.preset.sunToThu')
  assert.equal(daysText(5, t), 'day.weekday.0, day.weekday.2')
})
