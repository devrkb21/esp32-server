import assert from 'node:assert/strict'
// The packet asks for node:test (no vitest in this project's toolchain)
// eslint-disable-next-line test/no-import-node-test
import { it } from 'node:test'
import {
  areaList,
  defaultAreaCode,
  faceMood,
  filledCount,
  fullPhone,
  hasCode,
  isPhone,
  isValidServerUrl,
  LEGAL_CONTACT,
  legalParts,
  legalPath,
  normalizeServerUrl,
  storageMb,
  uuid,
  withContact,
} from './authKit.mjs'

it('isPhone takes a Bangladeshi mobile with or without the local 0, or in full', () => {
  assert.equal(isPhone('1712345678'), true)
  assert.equal(isPhone('01712345678'), true)
  assert.equal(isPhone('+8801712345678'), true)
  assert.equal(isPhone('017 1234 5678', '+880'), true)
  assert.equal(isPhone('০১৭১২৩৪৫৬৭৮', '+880'), true)
  assert.equal(isPhone('01312345678', '+880'), true)
  assert.equal(isPhone('01912345678', '+880'), true)
})

it('isPhone refuses short, long, landline and foreign shapes for +880', () => {
  assert.equal(isPhone('017'), false)
  assert.equal(isPhone('0171234567'), false)
  assert.equal(isPhone('017123456789'), false)
  assert.equal(isPhone('01212345678'), false)
  assert.equal(isPhone('0221234567'), false)
  assert.equal(isPhone('13812345678'), false)
  assert.equal(isPhone(''), false)
  assert.equal(isPhone(undefined), false)
})

it('isPhone only checks the length for other area codes', () => {
  assert.equal(isPhone('7911123456', '+44'), true)
  assert.equal(isPhone('1234', '+44'), false)
  assert.equal(isPhone('1234567890123456', '+91'), false)
})

it('fullPhone sends +880 numbers without the local 0', () => {
  assert.equal(fullPhone('+880', '01712345678'), '+8801712345678')
  assert.equal(fullPhone('+880', '1712345678'), '+8801712345678')
  assert.equal(fullPhone('+880', '+8801712345678'), '+8801712345678')
  assert.equal(fullPhone('+44', '07911 123456'), '+4407911123456')
})

it('areaList falls back to Bangladesh alone', () => {
  assert.deepEqual(areaList([]), [{ name: 'Bangladesh', key: '+880' }])
  assert.deepEqual(areaList(null), [{ name: 'Bangladesh', key: '+880' }])
  assert.equal(areaList([{ name: 'A', key: '+1' }]).length, 1)
})

it('defaultAreaCode prefers Bangladesh, then the first', () => {
  assert.equal(defaultAreaCode([{ key: '+91' }, { key: '+880' }]), '+880')
  assert.equal(defaultAreaCode([{ key: '+49' }, { key: '+44' }]), '+49')
  assert.equal(defaultAreaCode(undefined), '+880')
})

it('legal contact is Nobix support, and without one the sentence still ends cleanly', () => {
  assert.equal(LEGAL_CONTACT, 'support@nobixindustries.com')
  assert.equal(withContact('contact Nobix Industries, Bangladesh: {{CONTACT}}.'), 'contact Nobix Industries, Bangladesh: support@nobixindustries.com.')
  assert.equal(withContact('contact Nobix Industries, Bangladesh: {{CONTACT}}.', ''), 'contact Nobix Industries, Bangladesh.')
  assert.equal(withContact('যোগাযোগ করুন: {{CONTACT}}।', ''), 'যোগাযোগ করুন।')
  assert.equal(withContact('Bangladesh: {{CONTACT}}.', 'help@example.com'), 'Bangladesh: help@example.com.')
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

it('legalPath opens the Nobix legal pages', () => {
  assert.equal(legalPath('terms'), '/pages/legal/terms')
  assert.equal(legalPath('privacy'), '/pages/legal/privacy')
  assert.equal(legalPath('user-agreement'), '/pages/legal/terms')
  assert.equal(legalPath('privacy-policy'), '/pages/legal/privacy')
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
