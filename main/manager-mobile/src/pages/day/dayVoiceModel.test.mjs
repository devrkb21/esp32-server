/* eslint-disable test/no-import-node-test -- runs with Node's built-in runner, no dependency */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  calendarOf,
  daysUntil,
  libraryOf,
  libraryPayload,
  libraryProblem,
  monthDay,
  moveStep,
  newRoutine,
  onceDate,
  rememberProblem,
  routinePayload,
  routineProblem,
  sortRemember,
  triggerText,
} from './dayVoiceModel.mjs'

test('a new routine needs a name and a spoken line', () => {
  const r = newRoutine()
  assert.equal(routineProblem(r), 'dayVoice.problem.name')
  r.name = 'সকালের রুটিন'
  assert.equal(routineProblem(r), 'dayVoice.problem.say')
  r.steps[0].arg = 'শুভ সকাল!'
  assert.equal(routineProblem(r), '')
})

test('routine payload drops args of steps without one and keeps the id', () => {
  const p = routinePayload({ id: 'morning', name: ' x ', enabled: false, trigger: { type: 'time', time: '07:00', days: 31, phrase: '' }, steps: [{ type: 'weather', arg: 'junk' }] })
  assert.deepEqual(p, { id: 'morning', name: 'x', enabled: false, trigger: { type: 'time', phrase: '', days: 31, time: '07:00' }, steps: [{ type: 'weather', arg: '' }] })
  const v = routinePayload({ name: 'y', trigger: { type: 'voice', phrase: 'চালাও' }, steps: [] })
  assert.equal(v.trigger.time, undefined)
  assert.equal(v.enabled, true)
})

test('routine problems mirror the server', () => {
  const base = { name: 'x', enabled: true, trigger: { type: 'voice' }, steps: [{ type: 'weather' }] }
  assert.equal(routineProblem(base), '')
  assert.equal(routineProblem({ ...base, name: 'a'.repeat(41) }), 'dayVoice.problem.nameLong')
  assert.equal(routineProblem({ ...base, trigger: { type: 'time', time: '7:00' } }), 'dayVoice.problem.time')
  assert.equal(routineProblem({ ...base, steps: [] }), 'dayVoice.problem.noSteps')
  assert.equal(routineProblem({ ...base, steps: Array.from({ length: 13 }, () => ({ type: 'weather' })) }), 'dayVoice.problem.tooManySteps')
  assert.equal(routineProblem({ ...base, steps: [{ type: 'play', arg: '' }] }), 'dayVoice.problem.play')
  assert.equal(routineProblem({ ...base, steps: [{ type: 'play', arg: 'd-rhyme-sun' }] }, ['d-rhyme-sun']), '')
  assert.equal(routineProblem({ ...base, steps: [{ type: 'play', arg: 'gone' }] }, ['d-rhyme-sun']), 'dayVoice.problem.play')
  assert.equal(routineProblem({ ...base, steps: [{ type: 'command', arg: 'update' }] }), 'dayVoice.problem.command')
  assert.equal(routineProblem({ ...base, steps: [{ type: 'command', arg: 'night_light:on' }] }), '')
  assert.equal(routineProblem({ ...base, steps: [{ type: 'smart_home', arg: '' }] }), 'dayVoice.problem.smartHome')
})

test('steps move up and down', () => {
  const s = [{ type: 'say' }, { type: 'weather' }, { type: 'play' }]
  assert.deepEqual(moveStep(s, 1, -1).map(x => x.type), ['weather', 'say', 'play'])
  assert.deepEqual(moveStep(s, 1, 1).map(x => x.type), ['say', 'play', 'weather'])
  assert.deepEqual(moveStep(s, 0, -1).map(x => x.type), ['say', 'weather', 'play'])
})

test('trigger text keys', () => {
  assert.equal(triggerText({ trigger: { type: 'time', time: '07:00' } }).key, 'dayVoice.trigger.atTime')
  assert.equal(triggerText({ trigger: { type: 'tap' } }).key, 'dayVoice.trigger.tapSoon')
  assert.equal(triggerText({ name: 'ঘুম', trigger: { type: 'voice' } }).params.phrase, 'ঘুম')
})

test('library items need a title and a link or a text', () => {
  assert.equal(libraryProblem({ title: '', kind: 'story', source: 'text', text: 'x' }), 'dayVoice.problem.title')
  assert.equal(libraryProblem({ title: 'x', kind: 'poem', source: 'text', text: 'x' }), 'dayVoice.problem.kind')
  assert.equal(libraryProblem({ title: 'x', kind: 'music', source: 'link', url: 'ftp://a/b' }), 'dayVoice.problem.url')
  assert.equal(libraryProblem({ title: 'x', kind: 'music', source: 'link', url: 'https://example.com/a.mp3' }), '')
  assert.equal(libraryProblem({ title: 'x', kind: 'story', source: 'text', text: 'অ'.repeat(501) }), 'dayVoice.problem.textLong')
  assert.deepEqual(libraryPayload({ title: ' x ', kind: 'story', source: 'text', text: ' y ', url: 'z' }), { kind: 'story', title: 'x', text: 'y' })
  assert.deepEqual(libraryPayload({ title: 'x', kind: 'music', source: 'link', url: 'https://a.b/c' }), { kind: 'music', title: 'x', audio_url: 'https://a.b/c' })
  const view = { library: [{ id: 'l1', kind: 'music' }, { id: 'd-1', kind: 'rhyme' }] }
  assert.deepEqual(libraryOf(view, 'rhyme').map(i => i.id), ['d-1'])
  assert.equal(libraryOf(null).length, 0)
})

test('days to remember', () => {
  assert.equal(monthDay(2, 29), '02-29')
  assert.equal(monthDay(2, 30), '')
  assert.equal(monthDay(13, 1), '')
  assert.equal(rememberProblem({ name: 'মা', date: '05-05', kind: 'birthday' }), '')
  assert.equal(rememberProblem({ name: '', date: '05-05', kind: 'birthday' }), 'dayVoice.problem.dayName')
  assert.equal(rememberProblem({ name: 'x', date: '04-31', kind: 'birthday' }), 'dayVoice.problem.date')
  assert.equal(rememberProblem({ name: 'x', date: '04-30', kind: 'party' }), 'dayVoice.problem.dayKind')
  assert.deepEqual(sortRemember([{ date: '12-01' }, { date: '01-05' }]).map(d => d.date), ['01-05', '12-01'])
  const today = new Date(2026, 9, 26)
  assert.equal(daysUntil('10-26', today), 0)
  assert.equal(daysUntil('10-27', today), 1)
  assert.equal(daysUntil('10-25', today), 364)
  assert.deepEqual(calendarOf({ settings: {} }), { special_days: true, remember: [] })
  assert.equal(calendarOf({ settings: { calendar: { special_days: false } } }).special_days, false)
})

test('one-time items', () => {
  assert.equal(onceDate({ once: '2026-10-26' }), '2026-10-26')
  assert.equal(onceDate({ once: '' }), '')
  assert.equal(onceDate({}), '')
})
