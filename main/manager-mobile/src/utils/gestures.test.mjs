/* eslint-disable test/no-import-node-test -- runs with Node's built-in runner, no dependency */
// Tap shortcuts (settings.gestures) and the focus timer minutes: the rules both the Robot screen
// and the Day / Today screens read, and the strings they show.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { it } from 'node:test'
import { focusPick, pickedMinutes } from '../pages/day/dayModel.mjs'
import {
  FOCUS_PRESETS,
  focusMinutes,
  GESTURE_ACTIONS,
  GESTURE_DEFAULTS,
  GESTURE_KEYS,
  gestureSettings,
  isGestureAction,
  parseMinutes,
} from './companionUtils.mjs'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')

it('has the firmware gesture actions and defaults', () => {
  assert.deepEqual([...GESTURE_KEYS], ['double_tap', 'triple_tap'])
  assert.deepEqual([...GESTURE_ACTIONS], [
    'none',
    'talk',
    'focus',
    'breathe',
    'night_light',
    'lullaby',
    'story',
    'game_catch',
    'game_simon',
    'game_dice',
    'game_reaction',
    'game_random',
    'pages',
    'status',
  ])
  assert.deepEqual(GESTURE_DEFAULTS, { double_tap: 'none', triple_tap: 'talk' })
  assert.equal(isGestureAction('game_random'), true)
  assert.equal(isGestureAction('dance'), false)
})

it('reads the gestures with defaults for missing or unknown actions', () => {
  assert.deepEqual(gestureSettings(undefined), { double_tap: 'none', triple_tap: 'talk' })
  assert.deepEqual(gestureSettings({ double_tap: 'focus' }), { double_tap: 'focus', triple_tap: 'talk' })
  assert.deepEqual(gestureSettings({ double_tap: 'dance', triple_tap: 'status' }), { double_tap: 'none', triple_tap: 'status' })
})

it('reads typed minutes in Latin or Bangla digits, 1 to 120 only', () => {
  assert.equal(parseMinutes('25'), 25)
  assert.equal(parseMinutes('৪৫'), 45)
  assert.equal(parseMinutes(' ১২০ '), 120)
  assert.equal(parseMinutes(90), 90)
  for (const bad of ['', '0', '121', '১২১', '2.5', 'abc', '-5', null, undefined, 0, 7.5])
    assert.equal(parseMinutes(bad), null, String(bad))
})

it('turns minutes into a chip or the custom box and back', () => {
  assert.deepEqual(FOCUS_PRESETS, [15, 25, 45, 60])
  assert.deepEqual(focusPick(25), { choice: 25, custom: '' })
  assert.deepEqual(focusPick(50), { choice: 'custom', custom: '50' })
  assert.equal(pickedMinutes(45, ''), 45)
  assert.equal(pickedMinutes('custom', '৯০'), 90)
  assert.equal(pickedMinutes('custom', '200'), null)
})

it('uses the saved default minutes, else 25', () => {
  assert.equal(focusMinutes({ pomodoro: { work_min: 45 } }), 45)
  assert.equal(focusMinutes({ pomodoro: { work_min: 0 } }), 25)
  assert.equal(focusMinutes(null), 25)
})

it('names every action and the tap rows in Bangla and English, without the em dash', () => {
  const src = read('../i18n/pages/m-robot.ts')
  const [bn, en] = src.split(/\n {2}en: \{/)
  const keys = [
    'mrobot.sec.gestures',
    'mrobot.gestures.intro',
    'mrobot.gestures.hint',
    'mrobot.gestures.focusNote',
    ...GESTURE_KEYS.flatMap(k => [`mrobot.gestures.${k}`, `mrobot.gestures.${k}Line`]),
    ...GESTURE_ACTIONS.map(a => `mrobot.gesture.${a}`),
  ]
  for (const k of keys) {
    assert.ok(bn.includes(`'${k}':`), `bn ${k}`)
    assert.ok(en.includes(`'${k}':`), `en ${k}`)
  }
  assert.ok(bn.includes('\'mrobot.sec.gestures\': \'টোকা দিয়ে কাজ\''))
  assert.ok(bn.includes('মাথায় ঠিক দুবার বা তিনবার টোকা দিন; চারবার দিলে কিছু হবে না।'))
  for (const label of ['কিছু না', 'কথা বলা', 'ফোকাস টাইমার', 'শ্বাসের ব্যায়াম', 'রাতের আলো', 'ঘুমপাড়ানি গান', 'গল্প', 'খেলা: ক্যাচ', 'খেলা: সাইমন', 'খেলা: ছক্কা', 'খেলা: রিঅ্যাকশন', 'খেলা: যেকোনো একটা', 'তথ্যের পাতা', 'অবস্থা'])
    assert.ok(bn.includes(`'${label}'`), label)
  assert.doesNotMatch(src, /—/)
  assert.doesNotMatch(read('../i18n/pages/m-day.ts'), /—/)
})

it('the Robot screen shows the tap shortcuts and saves them as a settings patch', () => {
  const page = read('../pages/robot/index.vue')
  assert.match(page, /<RobotGestures id="rb-gestures" class="rb-anchor" \/>/)
  assert.match(page, /'gestures'/)
  assert.match(page, /useFeatureGate\('companion'\)/)
  const sec = read('../pages/robot/components/RobotGestures.vue')
  assert.match(sec, /r\.save\(\{ settings: \{ gestures: \{ \.\.\.form\.value \} \} \}, 'gestures'\)/)
  assert.match(sec, /r\.syncOf\('gestures'\)/)
})

it('Today\'s focus chip and the Day screen use the chosen and saved minutes', () => {
  const today = read('../pages/index/index.vue')
  assert.match(today, /focusMinutes\(view\.value\)/)
  assert.doesNotMatch(today, /arg: 25/)
  const focus = read('../pages/day/components/DayFocus.vue')
  assert.match(focus, /day\.command\('pomodoro', String\(n\)/)
  assert.match(focus, /day\.save\(\{ pomodoro: \{ work_min: n \} \}/)
  assert.match(focus, /inputmode="numeric"/)
})
