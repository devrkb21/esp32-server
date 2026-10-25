import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dayRows, nextIntervalTime } from './todayModel.mjs'

const t = (k, p) => (p ? `${k}|${JSON.stringify(p)}` : k)
const water = { id: 'water', kind: 'water', label: 'Drink water', enabled: true, mode: 'interval', every_min: 90, from: '09:00', to: '21:00', days: 127 }

test('interval reminder shows its next time, capped at the last one', () => {
  assert.equal(nextIntervalTime(water, 8 * 60), '09:00')
  assert.equal(nextIntervalTime(water, 9 * 60 + 1), '10:30')
  assert.equal(nextIntervalTime(water, 10 * 60 + 30), '10:30')
  assert.equal(nextIntervalTime(water, 22 * 60), '21:00')
  assert.equal(nextIntervalTime({ ...water, to: '20:00' }, 22 * 60), '19:30')
  assert.equal(nextIntervalTime(water, -1), '09:00')
})

test('today lists what Day lists: interval reminders and greetings too', () => {
  const view = {
    alarms: [],
    reminders: [water, { id: 'r1', label: 'Medicine', enabled: true, mode: 'time', time: '21:30', days: 127 }],
    settings: {
      proactive: { enabled: true, morning_on: true, morning: '07:30', evening_on: false, evening: '19:30' },
      routine: { enabled: true, items: [{ start: '08:00', end: '08:15', activity: 'exercise' }] },
    },
  }
  const rows = dayRows(view, new Date(2026, 9, 25), t, { lang: 'bn', nowMinutes: 9 * 60 + 5 })
  const keys = rows.map(r => r.key)
  assert.deepEqual(keys, ['r-water', 'r-r1', 'g-morning', 'l-08:00-exercise'])
  assert.equal(rows[0].time, '10:30')
  assert.equal(rows[0].note, 'today.every|{"n":"৯০","to":"৯:০০"}')
  assert.equal(rows[3].title, 'today.slot.exercise')
})
