/* eslint-disable test/no-import-node-test -- this zero-dependency gate intentionally uses Node's built-in runner */
// Live screen: parsing of `self.screen.preview` results and the polling back-off (fake clock)
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BACKOFF_DELAY_MS,
  createScreenPoller,
  frameAgeParts,
  parseScreenFrame,
  POLL_DELAY_MS,
  SCREEN_TOOL,
  screenToolArgs,
} from './liveScreen.mjs'

const JPEG = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDA=='
const RESULT = { width: 128, height: 64, jpeg: JPEG }

test('parses the frame: parsed JSON, a JSON string or the raw MCP result', () => {
  assert.equal(SCREEN_TOOL, 'self.screen.preview')
  assert.deepEqual(screenToolArgs(), { quality: 90 })
  assert.deepEqual(screenToolArgs(500), { quality: 100 })
  const want = { width: 128, height: 64, jpeg: JPEG, src: `data:image/jpeg;base64,${JPEG}` }
  assert.deepEqual(parseScreenFrame(RESULT), want)
  assert.deepEqual(parseScreenFrame(JSON.stringify(RESULT)), want)
  assert.deepEqual(parseScreenFrame({ content: [{ type: 'text', text: JSON.stringify(RESULT) }] }), want)
  assert.deepEqual(parseScreenFrame(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(RESULT) }] })), want)
  assert.equal(parseScreenFrame({ jpeg: JPEG }).width, 128)
})

test('rejects what is not a frame', () => {
  const bads = [null, '', 'OK', '{oops', {}, { jpeg: '' }, { jpeg: 'no base64!' }, { content: [] }]
  bads.push({ isError: true, content: [{ type: 'text', text: JSON.stringify(RESULT) }] })
  for (const bad of bads) {
    assert.equal(parseScreenFrame(bad), null, JSON.stringify(bad))
  }
})

test('frame age', () => {
  assert.equal(frameAgeParts(0, 1000), null)
  assert.deepEqual(frameAgeParts(1000, 1500), { key: 'now', n: 0 })
  assert.deepEqual(frameAgeParts(1000, 31000), { key: 'seconds', n: 30 })
  assert.deepEqual(frameAgeParts(1000, 181000), { key: 'minutes', n: 3 })
})

// A tiny fake clock for the injected timers
function fakeTimers() {
  let t = 0
  let seq = 0
  const queue = new Map()
  return {
    setTimeout: (fn, ms) => {
      queue.set(++seq, { at: t + ms, fn })
      return seq
    },
    clearTimeout: id => queue.delete(id),
    async advance(ms) {
      const end = t + ms
      for (;;) {
        const next = [...queue.entries()].sort((a, b) => a[1].at - b[1].at)[0]
        if (!next || next[1].at > end)
          break
        queue.delete(next[0])
        t = next[1].at
        next[1].fn()
        await new Promise(r => setImmediate(r))
      }
      t = end
      await new Promise(r => setImmediate(r))
    },
    now: () => t,
  }
}

test('one request at a time, 700 ms after each answer, 5 s after 3 failures', async () => {
  const timers = fakeTimers()
  let calls = 0
  const pending = []
  const p = createScreenPoller({
    fetchFrame: () => {
      calls++
      return new Promise((res, rej) => pending.push({ res, rej }))
    },
    timers,
    now: timers.now,
  })
  const settle = async (ok) => {
    const a = pending.shift()
    if (ok)
      a.res(parseScreenFrame(RESULT))
    else a.rej(new Error('offline'))
    await timers.advance(0)
  }
  p.start()
  assert.equal(calls, 1)
  await timers.advance(10000)
  assert.equal(calls, 1) // still waiting for the answer
  await settle(true)
  assert.equal(p.getState().status, 'live')
  await timers.advance(POLL_DELAY_MS - 1)
  assert.equal(calls, 1)
  await timers.advance(1)
  assert.equal(calls, 2)
  for (let i = 0; i < 3; i++) {
    await settle(false)
    if (i < 2)
      await timers.advance(POLL_DELAY_MS)
  }
  assert.equal(p.getState().status, 'offline')
  await timers.advance(BACKOFF_DELAY_MS - 1)
  assert.equal(calls, 4)
  await timers.advance(1)
  assert.equal(calls, 5)
  await settle(true)
  assert.equal(p.getState().failures, 0)
  // hidden: nothing; shown again: right away
  p.setPageVisible(false)
  await timers.advance(60000)
  assert.equal(calls, 5)
  p.setPageVisible(true)
  assert.equal(calls, 6)
  await settle(true)
  p.pause()
  await timers.advance(60000)
  assert.equal(calls, 6)
  assert.equal(p.getState().status, 'paused')
  p.resume()
  assert.equal(calls, 7)
  p.destroy()
})
