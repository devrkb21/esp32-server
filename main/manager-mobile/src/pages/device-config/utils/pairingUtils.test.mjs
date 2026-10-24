import assert from 'node:assert/strict'
import test from 'node:test'
import { litCells, normalizePairState } from './pairingUtils.mjs'

const HEART = [
  '............',
  '.XXX....XXX.',
  'XXXXX..XXXXX',
  'XXXXXXXXXXXX',
  'XXXXXXXXXXXX',
  'XXXXXXXXXXXX',
  '.XXXXXXXXXX.',
  '..XXXXXXXX..',
  '...XXXXXX...',
  '....XXXX....',
  '.....XX.....',
  '............',
]

test('a challenge from the robot keeps only well-formed options', () => {
  const state = normalizePairState({
    required: true,
    attempts_left: 3,
    locked_ms: 0,
    options: [
      { id: 0, name: 'heart', rows: HEART },
      { id: 1, name: 'broken', rows: ['XX'] },
      { id: -1, name: 'bad id', rows: HEART },
    ],
  })
  assert.equal(state.required, true)
  assert.equal(state.attemptsLeft, 3)
  assert.deepEqual(state.options.map(o => o.name), ['heart'])
})

test('boards without a screen, lockouts and a correct pick', () => {
  assert.equal(normalizePairState({ required: false }).required, false)
  const locked = normalizePairState({ required: true, success: false, locked_ms: 30000, options: [] })
  assert.equal(locked.lockedMs, 30000)
  assert.equal(locked.options.length, 0)
  const paired = normalizePairState({ success: true, pair_token: 'abc123' })
  assert.equal(paired.success, true)
  assert.equal(paired.token, 'abc123')
})

test('lit cells follow the rows', () => {
  const cells = litCells(HEART)
  assert.deepEqual(cells[0], [1, 1])
  assert.equal(cells.length, HEART.join('').split('').filter(c => c === 'X').length)
  assert.deepEqual(litCells(['X']), [])
})
