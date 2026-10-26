import type { DemoHandler } from '../index'
import { onPage } from '../index'
import { DEMO_COMPANION } from './zz-base'

// Day (owner: m-day): the companion view with every area of the day filled in, and config saves
// that apply their patch, so the demo shows the screen working. Scoped to /pages/day/ only.
// Alarms, reminders and the doing-now activity come from zz-base, so Day and Today describe the
// same day. Synthetic sample data.
const state: any = JSON.parse(JSON.stringify(DEMO_COMPANION))
state.stats = { ...state.stats, pomodoros_today: 2 }
state.settings.care = { enabled: true, lonely_after_min: 180 }
// Routines, the library and special days (feature wave 1): the server's seeded example plus one
// of the owner's, the shared sample rhymes and stories, and two generic family birthdays.
state.settings.routines = [
  { id: 'morning', name: 'সকালের রুটিন', enabled: false, trigger: { type: 'time', time: '07:00', days: 127, phrase: '' }, steps: [
    { type: 'say', arg: 'শুভ সকাল {name}! নতুন দিনটা শুরু করি চলো।' },
    { type: 'weather', arg: '' },
    { type: 'prayer_times', arg: '' },
    { type: 'day_summary', arg: '' },
  ] },
  { id: 'rt-bed', name: 'ঘুমের রুটিন', enabled: true, trigger: { type: 'voice', phrase: 'ঘুমাতে যাব', days: 127 }, steps: [
    { type: 'say', arg: 'শুভ রাত্রি! কাল আবার দেখা হবে।' },
    { type: 'alarm_list', arg: '' },
    { type: 'play', arg: 'd-rhyme-night' },
    { type: 'command', arg: 'night_light:on' },
  ] },
]
state.settings.calendar = { special_days: true, remember: [
  { id: 's-1', date: '03-14', name: 'মা', kind: 'birthday' },
  { id: 's-2', date: '11-02', name: 'ছোট ভাই', kind: 'birthday' },
] }
state.today_special = null
state.library = [
  { id: 'l-demo-1', kind: 'music', title: 'বিকেলের গান', audio_url: 'https://example.com/audio/song.mp3', source: 'owner' },
  { id: 'd-rhyme-sun', kind: 'rhyme', title: 'রোদের ছড়া', text: 'জানালা দিয়ে রোদ এসেছে, সোনার মতো রং।', source: 'default' },
  { id: 'd-rhyme-water', kind: 'rhyme', title: 'পানির ছড়া', text: 'ঢকঢক ঢকঢক এক গ্লাস পানি।', source: 'default' },
  { id: 'd-rhyme-night', kind: 'rhyme', title: 'ঘুমের ছড়া', text: 'তারারা সব মিটমিট, চোখ দুটো বুজে আসে।', source: 'default' },
  { id: 'd-story-pencil', kind: 'story', title: 'টাইনিবট আর হারানো পেনসিল', text: 'একদিন টাইনিবটের বন্ধু মিতুর লাল পেনসিলটা হারিয়ে গেল।', source: 'default' },
  { id: 'd-story-sparrow', kind: 'story', title: 'চড়ুই আর কাঠবিড়ালি', text: 'একটা ছোট্ট চড়ুই আমগাছের ডালে বাসা বানাচ্ছিল।', source: 'default' },
]

let seq = 10
function apply(patch: any) {
  if (!patch || typeof patch !== 'object')
    return
  if (Array.isArray(patch.alarms))
    state.alarms = patch.alarms.map((a: any) => ({ ...a, id: a.id || `a${++seq}` }))
  if (Array.isArray(patch.reminders))
    state.reminders = patch.reminders.map((r: any) => ({ ...r, id: r.id || `r${++seq}` }))
  if (patch.pomodoro)
    state.pomodoro = { ...state.pomodoro, ...patch.pomodoro }
  if (patch.prayer)
    state.prayer = { ...state.prayer, ...patch.prayer }
  if (patch.weather)
    state.weather = { ...state.weather, ...patch.weather }
  if (patch.library && typeof patch.library === 'object') {
    const del: string[] = Array.isArray(patch.library.delete) ? patch.library.delete : []
    let lib = state.library.filter((i: any) => !del.includes(i.id))
    if (patch.library.add)
      lib = [{ ...patch.library.add, id: `l${++seq}`, source: 'owner' }, ...lib]
    state.library = lib
  }
  if (patch.settings && Array.isArray(patch.settings.routines))
    patch.settings.routines = patch.settings.routines.map((r: any) => ({ ...r, id: r.id || `rt${++seq}` }))
  if (patch.settings?.calendar && Array.isArray(patch.settings.calendar.remember))
    patch.settings.calendar.remember = patch.settings.calendar.remember.map((d: any) => ({ ...d, id: d.id || `s${++seq}` }))
  for (const [k, v] of Object.entries(patch.settings || {})) {
    const cur = state.settings[k]
    state.settings[k] = v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object' ? { ...cur, ...v } : v
  }
}
const copy = () => JSON.parse(JSON.stringify(state))

const CITIES = [
  { name: 'Sylhet', admin1: 'Sylhet Division', country: 'Bangladesh', lat: 24.8949, lon: 91.8687, timezone: 'Asia/Dhaka' },
  { name: 'Chattogram', admin1: 'Chattogram Division', country: 'Bangladesh', lat: 22.3384, lon: 91.8317, timezone: 'Asia/Dhaka' },
  { name: 'Khulna', admin1: 'Khulna Division', country: 'Bangladesh', lat: 22.8098, lon: 89.5644, timezone: 'Asia/Dhaka' },
  { name: 'Rajshahi', admin1: 'Rajshahi Division', country: 'Bangladesh', lat: 24.3740, lon: 88.6011, timezone: 'Asia/Dhaka' },
]

const handlers: DemoHandler[] = [
  { method: 'GET', url: onPage('/pages/day/', /\/device\/companion\/geocode$/), reply: (req: any) => {
    const q = String(req.query.q || '').toLowerCase()
    return { results: CITIES.filter(c => c.name.toLowerCase().startsWith(q.slice(0, 3))) }
  } },
  { method: 'GET', url: onPage('/pages/day/', /\/device\/companion\/[^/]+$/), reply: (req: any) => (/\/geocode$/.test(req.path) ? undefined : copy()) },
  { method: 'PUT', url: onPage('/pages/day/', /\/device\/companion\/[^/]+\/config$/), reply: (req: any) => {
    let patch = req.data
    try {
      patch = typeof patch === 'string' ? JSON.parse(patch) : patch
    }
    catch {}
    apply(patch)
    return copy()
  } },
  // Run a routine / play a library item: the server runs routines itself and answers 'running'
  { method: 'POST', url: onPage('/pages/day/', /\/device\/companion\/[^/]+\/commands$/), reply: (req: any) => {
    let body = req.data
    try {
      body = typeof body === 'string' ? JSON.parse(body) : body
    }
    catch {}
    return { id: `c${++seq}`, ...body, status: body?.type === 'routine' ? 'running' : 'pending' }
  } },
]

export default handlers
