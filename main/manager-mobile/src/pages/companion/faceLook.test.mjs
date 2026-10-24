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
