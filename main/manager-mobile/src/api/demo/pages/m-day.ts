import type { DemoHandler } from '../index'
import { onPage } from '../index'
import { DEMO_COMPANION } from './zz-base'

// Day (owner: m-day): the companion view with every area of the day filled in, and config saves
// that apply their patch, so the demo shows the screen working. Scoped to /pages/day/ only.
// Synthetic sample data.
const state: any = JSON.parse(JSON.stringify(DEMO_COMPANION))
state.stats = { ...state.stats, activity: '', pomodoros_today: 2 }
state.settings.care = { enabled: true, lonely_after_min: 180 }
state.alarms = [
  { id: 'a1', time: '06:45', days: 31, label: 'Wake up', enabled: true, snooze_min: 5, say: 'শুভ সকাল {name}! {weather}' },
  { id: 'a2', time: '08:30', days: 96, label: 'Weekend', enabled: true, snooze_min: 10, say: '' },
  { id: 'a3', time: '21:00', days: 127, label: 'Lights low', enabled: false, snooze_min: 5, say: '' },
]
state.reminders = [
  { id: 'water', kind: 'water', label: 'Drink water', enabled: true, mode: 'interval', every_min: 90, from: '09:00', to: '21:00', days: 127, say: 'পানি খাওয়ার সময় হয়েছে! এক গ্লাস পানি খেয়ে নাও।' },
  { id: 'r1', kind: 'medicine', label: 'Medicine', enabled: true, mode: 'time', time: '21:30', days: 127, say: 'ওষুধ খাওয়ার সময় হয়েছে।' },
  { id: 'r2', kind: 'custom', label: 'Call home', enabled: true, mode: 'time', time: '18:00', days: 32, say: '' },
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
]

export default handlers
