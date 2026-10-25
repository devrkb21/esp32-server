/* eslint-disable test/no-import-node-test -- runs with Node's built-in runner, no dependency */
import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  commandLabel,
  daysTogether,
  eventInk,
  faceMood,
  focusMinutes,
  highScores,
  jobArg,
  JOBS,
  moodKey,
  presetChoice,
  reportedVolume,
  sliderVolume,
  syncState,
  typedMinutes,
  uptimeParts,
  volumeFromPhone,
  wifiQuality,
} from './robotModel.mjs'

it('focus job sends the saved work minutes, else 25', () => {
  const focus = JOBS.find(j => j.focus)
  assert.equal(jobArg(focus, { pomodoro: { work_min: 40 } }), '40')
  assert.equal(jobArg(focus, null), '25')
  assert.equal(focusMinutes({ pomodoro: { work_min: 0 } }), 25)
  assert.equal(jobArg(JOBS.find(j => j.key === 'light-off'), null), 'off')
})

it('command labels', () => {
  assert.equal(commandLabel({ type: 'game', arg: 'dice' }), 'companion.game.dice')
  assert.equal(commandLabel({ type: 'game', arg: 'chess' }), 'companion.cmd.game')
  assert.equal(commandLabel({ type: 'night_light', arg: 'off' }), 'mrobot.jobs.lightOff')
  assert.equal(commandLabel({ type: 'update' }), 'mrobot.fw.updateCommand')
  assert.equal(commandLabel({ type: 'story' }), 'companion.cmd.story')
  assert.equal(commandLabel({ type: 'dance' }), '')
})

it('volume: from phone, reported, slider', () => {
  assert.equal(volumeFromPhone({ settings: { volume: null } }), false)
  assert.equal(volumeFromPhone({ settings: { volume: 0 } }), true)
  assert.equal(reportedVolume({ stats: { volume: '55' } }), 55)
  assert.equal(reportedVolume({ stats: {} }), null)
  assert.equal(sliderVolume({ settings: { volume: 40 }, stats: { volume: 60 } }), 40)
  assert.equal(sliderVolume({ settings: { volume: null }, stats: { volume: 60 } }), 60)
  assert.equal(sliderVolume({ settings: {}, stats: {} }), 70)
})

it('wifi, uptime, mood, face', () => {
  assert.equal(wifiQuality(-50), 'good')
  assert.equal(wifiQuality(-70), 'fair')
  assert.equal(wifiQuality(-80), 'weak')
  assert.equal(wifiQuality(0), '')
  assert.deepEqual(uptimeParts(90061), { d: 1, h: 1, m: 1 })
  assert.equal(uptimeParts(undefined), null)
  assert.equal(moodKey('Happy'), 'mrobot.mood.happy')
  assert.equal(moodKey('zany'), '')
  assert.equal(faceMood({ online: false }), 'offline')
  assert.equal(faceMood({ online: true, stats: { mood: 'Sleepy' } }), 'sleepy')
  assert.equal(faceMood({ online: true, stats: {} }), 'awake')
})

it('days together and event ink', () => {
  const now = 1_000_000_000_000
  assert.equal(daysTogether({ created: now / 1000 - 86400 * 3 }, now), 4)
  assert.equal(daysTogether({}, now), null)
  assert.equal(eventInk({ type: 'alarm_missed' }), 'danger')
  assert.equal(eventInk({ type: 'alarm_snoozed' }), 'alarm')
  assert.equal(eventInk({ type: 'prayer_reminded' }), 'prayer')
  assert.equal(eventInk({ type: 'streak' }), '')
})

it('high scores, presets, typed minutes, sync', () => {
  assert.deepEqual(highScores({ reaction_ms: 240, dice: 6 }), [
    { key: 'reaction_ms', game: 'reaction', value: 240, ms: true },
    { key: 'dice', game: 'dice', value: 6, ms: false },
  ])
  assert.deepEqual(highScores(null), [])
  assert.equal(presetChoice(5, [0, 5, 10]), 5)
  assert.equal(presetChoice(7, [0, 5, 10]), 'custom')
  assert.equal(presetChoice(5, [0, 5, 10], true), 'custom')
  assert.equal(typedMinutes(' 12 '), 12)
  assert.ok(Number.isNaN(typedMinutes('1.5')))
  assert.ok(Number.isNaN(typedMinutes('')))
  assert.equal(syncState(true, false, true), 'pending')
  assert.equal(syncState(false, true, true), 'error')
  assert.equal(syncState(false, false, false), 'pending')
  assert.equal(syncState(false, false, true), 'applied')
})
