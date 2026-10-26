import type { DemoHandler } from '../index'
import { onPage } from '../index'
import { DEMO_COMPANION } from './zz-base'

// Robot screen fixtures (owner: m-robot), scoped to /pages/robot/ so they never answer another
// screen. Synthetic sample data: the demo robot with a full status report, a few memory notes,
// events and sent commands; saves and commands change this copy so the screen reacts.
const nowS = () => Math.floor(Date.now() / 1000)
function day(offset: number) {
  const d = new Date(Date.now() + offset * 86400000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Unix seconds of the local time hhmm today, plus dayOffset days. */
function at(hhmm: string, dayOffset = 0) {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(h, m, 0, 0)
  return Math.floor(d.getTime() / 1000)
}
/** The latest past occurrence of hhmm: today once it has passed, otherwise yesterday. */
function lastAt(hhmm: string) {
  const today = at(hhmm)
  return today <= nowS() ? today : at(hhmm, -1)
}
function ev(e: Record<string, any>) {
  return { ...e, rx: e.ts }
}

const view: any = JSON.parse(JSON.stringify(DEMO_COMPANION))
view.stats = {
  ...view.stats,
  ip: '192.168.0.42',
  rssi: -58,
  uptime_s: 2 * 86400 + 5 * 3600 + 12 * 60,
  pomodoros_today: 2,
  last_touch_s: 340,
  high_scores: { catch: 18, simon: 9, reaction_ms: 312 },
}
view.stats_updated = nowS() - 20
// Tap shortcuts (settings.gestures): two taps start the focus timer, three taps start a chat
view.settings.gestures = { double_tap: 'focus', triple_tap: 'talk' }
view.settings.pages = { clock: true, weather: true, prayer: true, focus: true, games: true, breathe: true, story: true, night: true, status: false, bond: true }
view.memories = [
  // `person`: per-person memory (the voiceprint check knew who was talking; owner ai)
  { id: 'n1', text: 'বৃহস্পতিবার ডাক্তারের কাছে যাবেন', kind: 'event', person: 'বাবা', created: `${day(-2)}T19:40`, updated: `${day(-2)}T19:40`, until: day(3) },
  { id: 'n2', text: 'সন্ধ্যায় আদা দেওয়া চা পছন্দ করে', kind: 'like', person: 'বাবা', created: `${day(-9)}T18:05`, updated: `${day(-4)}T20:12` },
  { id: 'n3', text: 'বোনের নাম নীলা', kind: 'person', created: `${day(-20)}T21:30`, updated: `${day(-20)}T21:30` },
  { id: 'n4', text: 'জোরে অ্যালার্ম পছন্দ করে না', kind: 'dislike', person: 'নীলা', created: `${day(-31)}T07:02`, updated: `${day(-31)}T07:02` },
  { id: 'n5', text: 'বেশিরভাগ দিন ফজরের পর হাঁটে', kind: 'routine', created: `${day(-40)}T06:15`, updated: `${day(-12)}T06:20` },
]
// Times follow the shared schedules (alarm a1 06:45, reminder r1 Medicine 21:30, dhuhr 11:43),
// newest first, so no event claims a time its schedule never had
view.events = [
  ev({ type: 'reminder_done', id: 'r1', ts: at('21:30', -1) }),
  ev({ type: 'pomodoro_done', value: 4, ts: nowS() - 5400 }),
  ev({ type: 'game_score', id: 'catch', value: 18, ts: nowS() - 9000 }),
  ev({ type: 'prayer_reminded', id: 'dhuhr', ts: lastAt('11:43') }),
  ev({ type: 'alarm_snoozed', id: 'a1', ts: lastAt('06:50') }),
  ev({ type: 'streak', value: 12, ts: nowS() - 32000 }),
  ev({ type: 'alarm_missed', id: 'a1', ts: at('06:45', -2) }),
].sort((a: any, b: any) => b.ts - a.ts)
view.commands = [
  { id: 'c2', type: 'pomodoro', arg: '25', ts: nowS() - 7000, status: 'done', done_ts: nowS() - 6990 },
  { id: 'c1', type: 'story', arg: 'সাহসী বিড়াল', ts: nowS() - 86000, status: 'done', done_ts: nowS() - 85990 },
]

const DEVICE = /\/device\/companion\/[^/]+$/
const CONFIG = /\/device\/companion\/[^/]+\/config$/
const COMMANDS = /\/device\/companion\/[^/]+\/commands$/
const EVENTS = /\/device\/companion\/[^/]+\/events$/

function merge(target: any, patch: any) {
  for (const [k, v] of Object.entries(patch || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object')
      merge(target[k], v)
    else target[k] = v
  }
}

function applyPatch(patch: any) {
  const p = { ...(patch || {}) }
  const mem = p.memories
  delete p.memories
  if (mem?.clear)
    view.memories = []
  else if (Array.isArray(mem?.delete))
    view.memories = view.memories.filter((m: any) => !mem.delete.includes(m.id))
  merge(view, p)
  view.rev += 1
  return JSON.parse(JSON.stringify(view))
}

let seq = 10
const handlers: DemoHandler[] = [
  { method: 'GET', url: onPage('/pages/robot/', DEVICE), reply: () => ({ ...JSON.parse(JSON.stringify(view)), last_seen: nowS() - 20 }) },
  { method: 'PUT', url: onPage('/pages/robot/', CONFIG), reply: (req: any) => applyPatch(req.data) },
  {
    method: 'POST',
    url: onPage('/pages/robot/', COMMANDS),
    reply: (req: any) => {
      const cmd = { id: `c${++seq}`, type: req.data?.type, arg: req.data?.arg || '', ts: nowS(), status: 'pending' }
      view.commands = [cmd, ...view.commands].slice(0, 20)
      return cmd
    },
  },
  { method: 'GET', url: onPage('/pages/robot/', EVENTS), reply: () => ({ events: [...view.events, { type: 'lonely', ts: nowS() - 200000, rx: nowS() - 200000 }, { type: 'reminder_missed', id: 'r1', ts: nowS() - 260000, rx: nowS() - 260000 }] }) },
  {
    method: 'GET',
    url: onPage('/pages/robot/', /\/otaMag$/),
    reply: { total: 2, list: [
      { id: 'ota-2', firmwareName: 'TinyBot', type: 'tinybot', version: '2.5.6', updateDate: '2026-10-20 10:00:00' },
      { id: 'ota-1', firmwareName: 'TinyBot', type: 'tinybot', version: '2.5.5', updateDate: '2026-09-02 10:00:00' },
    ] },
  },
  { method: 'PUT', url: onPage('/pages/robot/', /\/device\/update\/[^/]+$/), reply: true },
]

export default handlers
