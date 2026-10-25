// Day page fixtures (owner: web-day). Synthetic data only.
// - City search for prayer times (GET /device/companion/geocode): a few Bangladesh cities.
// - Config saves (PUT /device/companion/{id}/config) made from the Day page update the shared
//   demo robot (DEMO_COMPANION of zz-base.js) like the server would, so a change stays after the
//   next poll. Scoped to the Day page so other pages keep their own fixtures for the same call.
import { DEMO_COMPANION } from './zz-base';

const CITIES = [
  { name: 'Dhaka', country: 'Bangladesh', admin1: 'Dhaka Division', lat: 23.81, lon: 90.41, timezone: 'Asia/Dhaka' },
  { name: 'Sylhet', country: 'Bangladesh', admin1: 'Sylhet Division', lat: 24.90, lon: 91.87, timezone: 'Asia/Dhaka' },
  { name: 'Chattogram', country: 'Bangladesh', admin1: 'Chattogram Division', lat: 22.34, lon: 91.83, timezone: 'Asia/Dhaka' },
  { name: 'Rajshahi', country: 'Bangladesh', admin1: 'Rajshahi Division', lat: 24.37, lon: 88.60, timezone: 'Asia/Dhaka' },
  { name: 'Khulna', country: 'Bangladesh', admin1: 'Khulna Division', lat: 22.82, lon: 89.55, timezone: 'Asia/Dhaka' },
];

// Fields the shared demo robot leaves out that the Day page shows (synthetic values).
if (!DEMO_COMPANION.settings.care) DEMO_COMPANION.settings.care = { enabled: true, lonely_after_min: 180 };
if (DEMO_COMPANION.stats.pomodoros_today === undefined) DEMO_COMPANION.stats.pomodoros_today = 2;

function onDayPage() {
  try { return /^#\/day(\?|$)/.test(window.location.hash); } catch (e) { return false; }
}

// A path pattern that only matches while the Day page is open.
class DayOnly extends RegExp {
  test(path) { return super.test(path) && onDayPage(); }
}

let seq = 100;
const withIds = (list, prefix) => (list || []).map((x) => (x.id ? x : { ...x, id: `${prefix}${++seq}` }));

function applyPatch(patch) {
  const v = DEMO_COMPANION;
  const p = patch || {};
  if (p.alarms) v.alarms = withIds(p.alarms, 'a');
  if (p.reminders) v.reminders = withIds(p.reminders, 'r');
  if (p.pomodoro) v.pomodoro = { ...v.pomodoro, ...p.pomodoro };
  if (p.prayer) v.prayer = { ...v.prayer, ...p.prayer };
  if (p.weather) v.weather = { ...v.weather, ...p.weather };
  if (p.settings) {
    const s = { ...v.settings };
    for (const [k, val] of Object.entries(p.settings)) {
      s[k] = val && typeof val === 'object' && !Array.isArray(val) ? { ...(s[k] || {}), ...val } : val;
    }
    v.settings = s;
  }
  v.rev = (v.rev || 0) + 1;
  return v;
}

export default [
  {
    method: 'GET',
    url: /\/device\/companion\/geocode$/,
    reply: (req) => {
      const q = String(req.query.q || '').trim().toLowerCase();
      return { results: q.length < 2 ? [] : CITIES.filter((c) => c.name.toLowerCase().startsWith(q)) };
    },
  },
  { method: 'PUT', url: new DayOnly('/device/companion/[^/]+/config$'), reply: (req) => applyPatch(req.data) },
];
