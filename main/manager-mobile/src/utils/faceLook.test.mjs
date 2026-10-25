/* eslint-disable test/no-import-node-test -- this zero-dependency gate intentionally uses Node's built-in runner */
// faceLook.mjs is a copy of manager-web/src/utils/faceLook.mjs (full vitest suite there: tests/faceLook.test.mjs)
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  ACTIVITIES,
  activityAnim,
  CHAT_FONT_SAMPLE,
  CHAT_FONTS,
  countPixels,
  createCanvas,
  createLiveliness,
  defaultLook,
  defaultRoutine,
  evaluateLife,
  evaluateMood,
  fillRoundRect,
  getPixel,
  H,
  isDefaultLook,
  LIFE_DURATION,
  LIFE_STILL_T,
  litBounds,
  LOOK_CHOICES,
  LOOK_KEYS,
  MAX_ROUTINE,
  normalizeLook,
  normalizeRoutine,
  renderActivityStill,
  renderFace,
  renderLife,
  renderMoodStill,
  routineOverlaps,
  routinePayload,
  routineProblem,
  scheduledActivity,
  textWidth,
  toSvgDataUri,
  W,
} from './faceLook.mjs'

const SCHEMA = fileURLToPath(new URL('../../../xiaozhi-server/core/companion/schema.py', import.meta.url))

function face(look = {}, mood = 'neutral', t = 0) {
  return renderFace(evaluateMood(mood, t), { ...defaultLook(), ...look })
}

function lit(c) {
  const out = []
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (getPixel(c, x, y))
        out.push(`${x},${y}`)
    }
  }
  return out
}

test('look: missing keys are the original face, bad values are clamped', () => {
  assert.deepEqual(normalizeLook(null), defaultLook())
  assert.deepEqual(normalizeLook({ size: 10, height: 9, eyes: 'laser' }), { ...defaultLook(), size: 75, height: 6 })
})

test('look: chat font choices and default follow the server schema', () => {
  const ids = ['pixel', 'pixel_large', 'clean_small', 'clean', 'clean_large']
  assert.deepEqual(LOOK_CHOICES.chat_font, ids)
  assert.deepEqual(CHAT_FONTS.map(f => f.id), ids)
  assert.equal(defaultLook().chat_font, 'pixel')
  assert.ok(LOOK_KEYS.includes('chat_font'))
  if (existsSync(SCHEMA)) {
    const src = readFileSync(SCHEMA, 'utf8')
    const tuple = src.match(/"chat_font":\s*\(([^)]*)\)/)[1]
    assert.deepEqual(LOOK_CHOICES.chat_font, [...tuple.matchAll(/"(\w+)"/g)].map(m => m[1]))
    const body = src.match(/def default_look\(\)[\s\S]*?return \{([\s\S]*?)\}/)[1]
    assert.match(body, /"chat_font":\s*"pixel"/)
    assert.deepEqual([...body.matchAll(/"(\w+)":/g)].map(m => m[1]).sort(), [...LOOK_KEYS].sort())
  }
})

test('look: chat font normalizes and does not touch the face drawing', () => {
  assert.equal(normalizeLook({ chat_font: 'clean_small' }).chat_font, 'clean_small')
  assert.equal(normalizeLook({ chat_font: 'comic' }).chat_font, 'pixel')
  assert.equal(isDefaultLook({ chat_font: 'clean' }), false)
  assert.deepEqual(lit(face({ chat_font: 'pixel_large' }, 'happy', 300)), lit(face({}, 'happy', 300)))
  for (const f of CHAT_FONTS) {
    assert.ok(f.strip >= f.px + 3 && f.strip <= 22)
  }
  assert.ok([...CHAT_FONT_SAMPLE].every(ch => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 127))
})

test('default neutral face = the two firmware round rects', () => {
  const expected = createCanvas()
  fillRoundRect(expected, 38, 30, 27, 29.7, 8.1)
  fillRoundRect(expected, 90, 30, 27, 29.7, 8.1)
  assert.deepEqual(lit(face()), lit(expected))
  assert.deepEqual(litBounds(face(), 0, 0, 63, 63), { x0: 24, y0: 15, x1: 51, y1: 44 })
})

test('spacing and height move the eyes', () => {
  assert.deepEqual(litBounds(face({ spacing: 4, height: -2 }), 0, 0, 63, 63), { x0: 20, y0: 13, x1: 47, y1: 42 })
  assert.deepEqual(litBounds(face({ spacing: 4 }), 64, 0, 127, 63), { x0: 80, y0: 15, x1: 107, y1: 44 })
})

test('mouths draw under the eyes; none draws nothing there', () => {
  assert.equal(countPixels(face(), 0, 46, W - 1, H - 1), 0)
  for (const mouth of ['smile', 'cat', 'dot']) {
    const box = litBounds(face({ mouth }), 0, 46, W - 1, H - 1)
    assert.ok(box && box.x0 >= 54 && box.x1 <= 73 && box.y1 <= 60, mouth)
  }
})

test('liveliness blinks after 3 s', () => {
  const live = createLiveliness(() => 0)
  assert.equal(live.apply(evaluateMood('neutral', 0), 2999, {}).l.lid_top, 0)
  assert.equal(live.apply(evaluateMood('neutral', 0), 3000, {}).l.lid_top, 0)
  assert.ok(live.apply(evaluateMood('neutral', 0), 3110, {}).l.lid_top > 0.99)
})

test('svg output is a data uri', () => {
  assert.match(toSvgDataUri(face()), /^data:image\/svg\+xml;charset=utf-8,/)
})

// Pixels the paws light that are not lit with hands off
function handPixels(pose) {
  const on = renderFace(pose, defaultLook())
  const off = renderFace(pose, { ...defaultLook(), hands: false })
  const c = createCanvas()
  for (let i = 0; i < W * H; i++) c.bits[i] = on.bits[i] && !off.bits[i] ? 1 : 0
  return { added: c, off }
}

test('hands: default on, off draws the face without paws', () => {
  assert.equal(defaultLook().hands, true)
  assert.equal(normalizeLook({ hands: false }).hands, false)
  for (const [mood, t] of [['like', 1], ['thinking', 1], ['surprised', 0.8], ['shy', 0.6], ['hello', 0.5], ['yawn', 1.6]]) {
    const pose = evaluateMood(mood, t)
    assert.deepEqual(lit(renderFace(pose, { hands: false })), lit(renderFace({ ...pose, hands: 'none' }, {})), mood)
    assert.notDeepEqual(lit(renderFace(pose, {})), lit(renderFace(pose, { hands: false })), mood)
  }
})

test('hands: each pose lights its own region', () => {
  assert.ok(litBounds(handPixels(evaluateMood('like', 1)).added).x0 > 95, 'thumbs up on the right')
  const cheeks = handPixels(evaluateMood('surprised', 0.8)).added
  assert.ok(litBounds(cheeks, 0, 0, 63, H - 1).x1 < 24 && litBounds(cheeks, 64, 0, W - 1, H - 1).x0 > 103, 'cheeks at both edges')
  const shy = handPixels(evaluateMood('shy', 0.6))
  const eyeL = litBounds(shy.off, 0, 0, 63, 46)
  assert.ok(countPixels(shy.added, eyeL.x0, eyeL.y0, eyeL.x1, eyeL.y1) > 0, 'paws over the eyes')
  const chin = handPixels(evaluateMood('thinking', 1))
  assert.ok(litBounds(chin.added, 0, 0, 100, H - 1).y0 > litBounds(chin.off, 0, 0, 100, H - 1).y1, 'chin below the eyes')
  const mouth = litBounds(handPixels(evaluateMood('yawn', 1.6)).added)
  assert.ok(mouth.x0 > 50 && mouth.x1 < 78 && mouth.y1 === H - 1, 'cover mouth bottom centre')
})

test('hands: hand_k 0 draws no hand; reduced motion still has the paw up', () => {
  const pose = { ...evaluateMood('like', 1), hand_k: 0 }
  assert.deepEqual(lit(renderFace(pose, {})), lit(renderFace({ ...pose, hands: 'none' }, {})))
  assert.notDeepEqual(lit(renderMoodStill('hello', {})), lit(renderMoodStill('hello', { hands: false })))
})

// ---------------------------------------------------------------- TinyBot's day
const LIFE_ANIMS = Object.keys(LIFE_DURATION)

test('day: activities map to the firmware animations; meals pick the three foods', () => {
  assert.equal(ACTIVITIES.length, 13)
  assert.equal(activityAnim('nap'), 'Sleeping')
  for (const meal of ['breakfast', 'lunch', 'dinner'])
    assert.deepEqual([0, 1, 2].map(v => evaluateLife(activityAnim(meal, v), 0).prop), ['bowl', 'sandwich', 'apple'])
})

test('day: every activity draws under the eyes, which stay up', () => {
  for (const anim of LIFE_ANIMS) {
    const c = renderLife(anim, defaultLook(), LIFE_STILL_T[anim])
    if (anim === 'Sleeping') {
      assert.ok(countPixels(c, 100, 0, W - 1, H - 1) > 10, 'Zzz')
      continue
    }
    assert.ok(countPixels(c, 0, 36, W - 1, H - 1) > 40, `${anim} prop`)
    for (let t = 0; t < LIFE_DURATION[anim]; t += 0.25) {
      const eyes = renderFace({ ...evaluateLife(anim, t), prop: 'none', fx: 0 }, defaultLook())
      assert.ok(litBounds(eyes).y1 <= 31, `${anim} eyes up at t=${t}`)
    }
  }
})

test('day: hands off draws no paws; the prop replaces the mouth', () => {
  for (const anim of ['LifeEatSandwich', 'LifeEatApple', 'LifeWork', 'LifeTea']) {
    const t = LIFE_STILL_T[anim]
    assert.ok(countPixels(renderLife(anim, { hands: true }, t), 0, H - 1, W - 1, H - 1) > 0, `${anim} arms`)
    assert.equal(countPixels(renderLife(anim, { hands: false }, t), 0, H - 1, W - 1, H - 1), 0, `${anim} no arms`)
  }
  assert.deepEqual(lit(renderActivityStill('work', { mouth: 'smile' })), lit(renderActivityStill('work', {})))
})

test('day: firmware life eyes Eye(15, 14, 5) at y -9 and the 3x5 text', () => {
  const p = evaluateLife('LifeExercise', 0)
  assert.deepEqual([p.l.w, p.l.h, p.l.r, p.l.x, p.l.y], [15, 14, 5, 0, -9])
  assert.equal(evaluateLife('LifeBoxing', 0).l.x, 4)
  assert.equal(textWidth('DAILY NEWS'), 39)
  const c = renderLife('LifeBoxing', {}, 0.3)
  assert.ok(countPixels(c, 70, 52, 80, 56) > 10, 'POW')
})

test('pupil rolls with the tilt (look_x / look_y)', () => {
  const pose = evaluateLife('none', 0) // the neutral eyes (20 x 22)
  const tilt = (x, y) => renderFace({ ...pose, look_x: x, look_y: y }, { eyes: 'pupil' })
  assert.equal(getPixel(tilt(0, 0), 49, 33), true)
  assert.equal(getPixel(tilt(1, 0), 49, 33), false) // pupil 0.24 w to the right
  assert.equal(getPixel(tilt(0, 0), 40, 44), true)
  assert.equal(getPixel(tilt(0, 1), 40, 44), false) // and 0.22 h down
  assert.deepEqual(lit(tilt(3, 0)), lit(tilt(1, 0)))
})

test('day: routine helpers follow the server', () => {
  assert.deepEqual(normalizeRoutine(undefined), defaultRoutine())
  assert.equal(defaultRoutine().items.length, 15)
  assert.equal(routineProblem(defaultRoutine()), null)
  assert.deepEqual(routineProblem({ items: [{ start: '09:00', end: '09:00', activity: 'tea' }] }), { code: 'sameTime', index: 0 })
  assert.equal(routineProblem({ items: Array.from({ length: MAX_ROUTINE + 1 }, () => ({ start: '09:00', end: '10:00', activity: 'tea' })) }).code, 'tooMany')
  assert.deepEqual(routineOverlaps([{ start: '23:00', end: '01:00', activity: 'tv' }, { start: '00:30', end: '02:00', activity: 'book' }]), [[0, 1]])
  assert.equal(scheduledActivity(defaultRoutine(), 13 * 60 + 45), 'nap')
  assert.deepEqual(routinePayload({ enabled: true, items: [{ start: '9:00', end: '10:00', activity: 'work' }, { start: '08:00', end: '08:30', activity: 'tea' }] }).items.map(i => i.start), ['08:00', '09:00'])
})
