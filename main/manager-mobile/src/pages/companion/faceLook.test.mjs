/* eslint-disable test/no-import-node-test -- this zero-dependency gate intentionally uses Node's built-in runner */
// faceLook.mjs is a copy of manager-web/src/utils/faceLook.mjs (full vitest suite there: tests/faceLook.test.mjs)
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  countPixels,
  createCanvas,
  createLiveliness,
  defaultLook,
  evaluateMood,
  fillRoundRect,
  getPixel,
  H,
  litBounds,
  normalizeLook,
  renderFace,
  renderMoodStill,
  toSvgDataUri,
  W,
} from './faceLook.mjs'

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
