/* eslint-disable test/no-import-node-test -- runs with Node's built-in runner, no dependency */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { it } from 'node:test'
import { memoryList } from '../../../utils/companionUtils.mjs'
import { groupByPerson, hasPeople } from './memoryGroups.mjs'

const notes = [
  { id: '1', text: 'a', person: 'নীলা' },
  { id: '2', text: 'b' },
  { id: '3', text: 'c', person: 'Baba' },
  { id: '4', text: 'd', person: 'নীলা' },
]

it('groups notes by person, most notes first, the rest last', () => {
  const g = groupByPerson(notes)
  assert.deepEqual(g.map(x => x.person), ['নীলা', 'Baba', ''])
  assert.deepEqual(g[0].notes.map(n => n.id), ['1', '4'])
  assert.deepEqual(groupByPerson([]), [])
})

it('old notes without a person stay one plain list', () => {
  assert.equal(hasPeople(notes), true)
  assert.equal(hasPeople([{ id: 'x', text: 'old' }]), false)
  const src = readFileSync(new URL('./RobotMemory.vue', import.meta.url), 'utf8')
  assert.match(src, /grouped\.value \? groupByPerson\(notes\.value\)/)
})

it('the companion view keeps the person of a note (and older notes have none)', () => {
  const list = memoryList([
    { id: 'a', text: 'x', kind: 'like', created: '2026-10-01T10:00:00', updated: '2026-10-01T10:00:00', person: '  নীলা ' },
    { id: 'b', text: 'y', kind: 'fact', created: '2026-10-01T10:00:00', updated: '2026-10-01T10:00:00' },
  ])
  assert.equal(list[0].person, 'নীলা')
  assert.equal('person' in list[1], false)
})
