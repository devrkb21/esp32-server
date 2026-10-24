/* eslint-disable test/no-import-node-test -- this zero-dependency gate intentionally uses Node's built-in runner */
// Firmware card: version comparison and the "Update now" flow (Node fake timers)
import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import {
  compareVersions,
  createUpdateFlow,
  currentFirmware,
  latestFirmware,
  observeUpdate,
  PHASE,
  UPDATE_COMMAND,
  UPDATE_POLL_MS,
  UPDATE_TIMEOUT_MS,
  updateAvailable,
  updateSent,
} from './firmwareUpdate.mjs'

const T0 = 1_000_000

function view(fw, { online = true, uptime = 600, statsAt = 1000, commands = [] } = {}) {
  return { online, stats: { fw, uptime_s: uptime }, stats_updated: statsAt, commands }
}

/** Let resolved promises run (setImmediate is not faked) */
async function flush() {
  for (let i = 0; i < 5; i++)
    await new Promise(resolve => setImmediate(resolve))
}

async function advance(ms) {
  mock.timers.tick(ms)
  await flush()
}

test('compares versions like manager-api', () => {
  assert.equal(compareVersions('2.5.10', '2.5.9'), 1)
  assert.equal(compareVersions('2.5.9', '2.5.10'), -1)
  assert.equal(compareVersions('2.5', '2.5.0'), 0)
  assert.equal(compareVersions('tinybot/2.5.5', 'v2.5.5'), 0)
  assert.equal(compareVersions('', '2.5.5'), null)
  assert.equal(updateAvailable('2.5.5', '2.5.6'), true)
  assert.equal(updateAvailable('2.5.6', '2.5.6'), false)
  assert.equal(updateAvailable(undefined, '2.5.6'), null)
})

test('current and latest firmware', () => {
  assert.equal(currentFirmware({ stats: { fw: '2.5.5' } }, '2.4.0'), '2.5.5')
  assert.equal(currentFirmware({ stats: {}, user_agent: 'tinybot/2.5.1' }), '2.5.1')
  assert.equal(currentFirmware({ stats: {} }, '2.4.0'), '2.4.0')
  const latest = latestFirmware([
    { type: 'tinybot', version: '2.5.4', updateDate: '2026-10-01 10:00:00' },
    { type: 'other', version: '9.0.0', updateDate: '2026-10-30 10:00:00' },
    { type: 'tinybot', version: '2.5.6', updateDate: '2026-10-22 10:00:00' },
  ])
  assert.equal(latest.version, '2.5.6')
  assert.equal(latestFirmware([]), null)
})

test('state machine: sent -> waiting -> updated / current / timeout', () => {
  let s = updateSent(view('2.5.5'), T0, { commandId: 'c1' })
  assert.equal(s.phase, PHASE.sent)
  assert.equal(observeUpdate(s, view('2.5.5'), T0 + 5000).phase, PHASE.sent)
  s = observeUpdate(s, view('2.5.5', { commands: [{ id: 'c1', status: 'done' }] }), T0 + 5000)
  assert.equal(s.phase, PHASE.waiting)

  const updated = observeUpdate(s, view('2.5.6', { uptime: 5, statsAt: 1090 }), T0 + 70000)
  assert.equal(updated.phase, PHASE.updated)
  assert.equal(updated.toVersion, '2.5.6')

  const early = observeUpdate(s, view('2.5.5', { uptime: 10, statsAt: 1030 }), T0 + 30000)
  assert.equal(early.phase, PHASE.waiting)
  const same = observeUpdate(s, view('2.5.5', { uptime: 30, statsAt: 1050 }), T0 + 50000)
  assert.equal(same.phase, PHASE.current)
  assert.equal(same.toVersion, '2.5.5')

  assert.equal(observeUpdate(s, null, T0 + UPDATE_TIMEOUT_MS - 1).phase, PHASE.waiting)
  assert.equal(observeUpdate(s, null, T0 + UPDATE_TIMEOUT_MS).phase, PHASE.timeout)
})

test('flow sends {type: "update"} and polls until TinyBot is back', async (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: T0 })
  t.after(() => mock.timers.reset())
  assert.deepEqual(UPDATE_COMMAND, { type: 'update' })

  const sent = []
  const views = [view('2.5.5', { online: false }), view('2.5.6', { uptime: 3, statsAt: 1070 })]
  let i = 0
  const phases = []
  const flow = createUpdateFlow({
    sendCommand: (cmd) => {
      sent.push(cmd)
      return Promise.resolve({ id: 'cmd-1' })
    },
    fetchView: () => Promise.resolve(views[Math.min(i++, views.length - 1)]),
    onChange: s => phases.push(s.phase),
  })
  assert.equal(await flow.start(view('2.5.5')), true)
  assert.deepEqual(sent, [{ type: 'update' }])
  assert.equal(flow.state.phase, PHASE.sent)
  await advance(UPDATE_POLL_MS)
  assert.equal(flow.state.phase, PHASE.waiting)
  await advance(UPDATE_POLL_MS)
  assert.equal(flow.state.phase, PHASE.updated)
  assert.equal(flow.state.toVersion, '2.5.6')
  assert.deepEqual(phases.slice(0, 2), [PHASE.sending, PHASE.sent])
  const asked = i
  await advance(UPDATE_POLL_MS * 3)
  assert.equal(i, asked)
})

test('flow times out after 4 minutes', async (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: T0 })
  t.after(() => mock.timers.reset())
  const flow = createUpdateFlow({
    sendCommand: () => Promise.resolve({}),
    fetchView: () => Promise.resolve(view('2.5.5', { online: false })),
  })
  await flow.start(view('2.5.5'))
  for (let ms = 0; ms < UPDATE_TIMEOUT_MS - UPDATE_POLL_MS; ms += UPDATE_POLL_MS)
    await advance(UPDATE_POLL_MS)
  assert.equal(flow.state.phase, PHASE.waiting)
  await advance(UPDATE_POLL_MS)
  assert.equal(flow.state.phase, PHASE.timeout)
  assert.equal(flow.isBusy(), false)
})

test('flow fails without polling when the command is refused', async () => {
  let asked = 0
  const flow = createUpdateFlow({
    sendCommand: () => Promise.reject(new Error('nope')),
    fetchView: () => {
      asked++
      return Promise.resolve(null)
    },
    pollMs: 1,
  })
  assert.equal(await flow.start(view('2.5.5')), false)
  assert.equal(flow.state.phase, PHASE.failed)
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(asked, 0)
})
