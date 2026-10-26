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

// Routines, the library and special days (feature wave 1, VOICE): the server's seeded example
// plus one more routine, the shared sample library (original texts) plus one owner item, and
// two generic days to remember. today_special stays null in the demo.
if (!DEMO_COMPANION.settings.routines) {
  DEMO_COMPANION.settings.routines = [
    { id: 'morning', name: 'সকালের রুটিন', enabled: false, trigger: { type: 'time', time: '07:00', days: 127, phrase: '' },
      steps: [{ type: 'say', arg: 'শুভ সকাল {name}! নতুন দিনটা শুরু করি চলো।' }, { type: 'weather', arg: '' },
        { type: 'prayer_times', arg: '' }, { type: 'day_summary', arg: '' }] },
    { id: 'rt-bed', name: 'ঘুমের রুটিন', enabled: true, trigger: { type: 'voice', phrase: 'ঘুমাতে যাব', days: 127 },
      steps: [{ type: 'say', arg: 'শুভ রাত্রি! কাল আবার দেখা হবে।' }, { type: 'alarm_list', arg: '' },
        { type: 'play', arg: 'd-rhyme-night' }, { type: 'command', arg: 'night_light:on' }] },
  ];
}
if (!DEMO_COMPANION.settings.calendar) {
  DEMO_COMPANION.settings.calendar = { special_days: true, remember: [
    { id: 's1', date: '03-14', name: 'মা', kind: 'birthday' },
    { id: 's2', date: '11-20', name: 'বাবা', kind: 'birthday' },
  ] };
}
if (DEMO_COMPANION.today_special === undefined) DEMO_COMPANION.today_special = null;
if (!DEMO_COMPANION.library) {
  DEMO_COMPANION.library = [
    { id: 'l-own1', kind: 'music', title: 'বৃষ্টির শব্দ', audio_url: 'https://example.com/audio/rain.mp3', source: 'owner' },
    { id: 'd-rhyme-sun', kind: 'rhyme', title: 'রোদের ছড়া', source: 'default',
      text: 'জানালা দিয়ে রোদ এসেছে, সোনার মতো রং, বিছানা ছেড়ে উঠে পড়ো, বাজছে ঘড়ির টং।' },
    { id: 'd-rhyme-water', kind: 'rhyme', title: 'পানির ছড়া', source: 'default',
      text: 'ঢকঢক ঢকঢক এক গ্লাস পানি, খেলে পরে শরীর থাকে ভালো, জানি জানি।' },
    { id: 'd-rhyme-night', kind: 'rhyme', title: 'ঘুমের ছড়া', source: 'default',
      text: 'তারারা সব মিটমিট, চোখ দুটো বুজে আসে, বালিশটা নরম নরম, স্বপ্ন এসে পাশে বসে।' },
    { id: 'd-story-pencil', kind: 'story', title: 'টাইনিবট আর হারানো পেনসিল', source: 'default',
      text: 'একদিন টাইনিবটের বন্ধু মিতুর লাল পেনসিলটা হারিয়ে গেল। মিতুর খুব মন খারাপ।' },
    { id: 'd-story-sparrow', kind: 'story', title: 'চড়ুই আর কাঠবিড়ালি', source: 'default',
      text: 'একটা ছোট্ট চড়ুই আমগাছের ডালে বাসা বানাচ্ছিল। হঠাৎ আকাশ কালো করে বৃষ্টি এলো।' },
  ];
}

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
  if (p.library) {
    const ids = p.library.delete || [];
    v.library = v.library.filter((i) => !ids.includes(i.id));
    if (p.library.add) v.library = [{ id: `l${++seq}`, source: 'owner', ...p.library.add }, ...v.library];
  }
  if (p.settings && Array.isArray(p.settings.routines)) p.settings.routines = withIds(p.settings.routines, 'rt');
  if (p.settings && p.settings.calendar && Array.isArray(p.settings.calendar.remember)) {
    p.settings.calendar.remember = withIds(p.settings.calendar.remember, 's').sort((a, b) => a.date.localeCompare(b.date));
  }
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
  // "Run now" of a routine: the server runs it itself and answers `running`
  {
    method: 'POST',
    url: new DayOnly('/device/companion/[^/]+/commands$'),
    reply: (req) => (req.data && req.data.type === 'routine'
      ? { id: `c${++seq}`, type: 'routine', arg: req.data.arg, status: 'running' } : undefined),
  },
];
