import assert from 'node:assert/strict'
// The packet asks for node:test (no vitest in this project's toolchain)
// eslint-disable-next-line test/no-import-node-test
import { it } from 'node:test'
import {
  areaList,
  defaultAreaCode,
  faceMood,
  filledCount,
  hasCode,
  isPhone,
  isValidServerUrl,
  legalParts,
  legalPath,
  normalizeServerUrl,
  storageMb,
  uuid,
} from './authKit.mjs'

it('isPhone keeps the old rule', () => {
  assert.equal(isPhone('13812345678'), true)
  assert.equal(isPhone('12812345678'), false)
  assert.equal(isPhone('1381234567'), false)
  assert.equal(isPhone(''), false)
  assert.equal(isPhone(undefined), false)
})

it('areaList falls back to one entry', () => {
  assert.deepEqual(areaList([]), [{ name: 'Mainland China', key: '+86' }])
  assert.deepEqual(areaList(null), [{ name: 'Mainland China', key: '+86' }])
  assert.equal(areaList([{ name: 'A', key: '+1' }]).length, 1)
})

it('defaultAreaCode prefers Bangladesh, then the first', () => {
  assert.equal(defaultAreaCode([{ key: '+86' }, { key: '+880' }]), '+880')
  assert.equal(defaultAreaCode([{ key: '+49' }, { key: '+86' }]), '+49')
  assert.equal(defaultAreaCode(undefined), '+86')
})

it('uuid has the v4 shape and differs', () => {
  const a = uuid()
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.notEqual(a, uuid())
})

it('faceMood follows the form', () => {
  assert.equal(faceMood({ filled: 0 }), 'sleepy')
  assert.equal(faceMood({ filled: 2 }), 'awake')
  assert.equal(faceMood({ filled: 2, outcome: 'error' }), 'confused')
  assert.equal(faceMood({ outcome: 'ok' }), 'happy')
  assert.equal(faceMood(), 'sleepy')
})

it('filledCount ignores blanks', () => {
  assert.equal(filledCount(['a', ' ', '', null, 0]), 2)
  assert.equal(filledCount(undefined), 0)
})

it('legalPath picks zh only for zh_CN', () => {
  assert.equal(legalPath('user-agreement', 'zh_CN'), '/pages/login/user-agreement-zh')
  assert.equal(legalPath('privacy-policy', 'bn'), '/pages/login/privacy-policy-en')
  assert.equal(legalPath('privacy-policy', 'zh_TW'), '/pages/login/privacy-policy-en')
})

it('legalParts splits the sentence around the two links', () => {
  assert.deepEqual(legalParts('By signing in you accept the {terms} and the {privacy}.'), [
    { text: 'By signing in you accept the ' },
    { link: 'terms' },
    { text: ' and the ' },
    { link: 'privacy' },
    { text: '.' },
  ])
  assert.deepEqual(legalParts('{terms}{privacy}'), [{ link: 'terms' }, { link: 'privacy' }])
  assert.deepEqual(legalParts(''), [])
})

it('hasCode reads the code from the message', () => {
  assert.equal(hasCode(new Error('code 10067'), 10067), true)
  assert.equal(hasCode({ message: 'x' }, '10070'), false)
  assert.equal(hasCode(undefined, 1), false)
})

it('server address helpers', () => {
  assert.equal(normalizeServerUrl('  https://a.example/xiaozhi/// '), 'https://a.example/xiaozhi')
  assert.equal(isValidServerUrl('https://a.example/xiaozhi'), true)
  assert.equal(isValidServerUrl('a.example'), false)
  assert.equal(isValidServerUrl('http:// '), false)
})

it('storageMb', () => {
  assert.equal(storageMb(2048), '2.00')
  assert.equal(storageMb(0), '0.00')
  assert.equal(storageMb('x'), '0.00')
})
