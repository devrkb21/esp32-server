import type { DemoHandler } from '../index'

// Base fixtures every screen leans on (owner: foundation). Same data as manager-web zz-base.js. Sorted last, so a page's own fixture
// for the same call wins. Synthetic sample data: a demo account with one robot.
const now = new Date();
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const tomorrow = new Date(now.getTime() + 86400000);

export const DEMO_AGENT = { id: 'demo-agent-1', agentName: 'TinyBot', ttsModelName: 'EdgeTTS', llmModelName: 'Groq', deviceCount: 1, lastConnectedAt: now.toISOString() };
export const DEMO_DEVICE = { id: 'demo-device-1', alias: 'টাইনিবট', macAddress: '28:84:85:00:00:01', board: 'tinybot', appVersion: '2.5.5', lastConnectedAt: now.toISOString(), autoUpdate: 1 };

export const DEMO_COMPANION = {
  id: '28:84:85:00:00:01', name: 'টাইনিবট', online: true, last_seen: Math.floor(now.getTime() / 1000) - 20,
  created: Math.floor(now.getTime() / 1000) - 211 * 86400, rev: 42,
  stats: { fw: '2.5.5', uptime_s: 86400, volume: 60, activity: 'newspaper', state: 'idle', mood: 'happy', bond_score: 640, bond_level: 3, streak: 12 },
  settings: {
    volume: 60, sounds: true, owner_name: '',
    night: { enabled: true, start: '22:30', end: '06:30', dim: true, lullaby: true, light: false, light_minutes: 0 },
    routine: { enabled: true, items: [
      { start: '08:00', end: '08:15', activity: 'exercise' }, { start: '08:30', end: '09:00', activity: 'breakfast' },
      { start: '09:00', end: '09:20', activity: 'newspaper' }, { start: '13:00', end: '13:30', activity: 'lunch' },
      { start: '15:30', end: '16:00', activity: 'tea' }, { start: '19:00', end: '20:00', activity: 'tv' },
    ] },
    proactive: { enabled: true, morning_on: true, morning: '07:30', evening_on: true, evening: '19:30' },
    memory: { enabled: true },
    look: { shape: 'rounded', size: 100, spacing: 0, height: 0, eyes: 'pupil', mouth: 'smile', blush: false, blink: 'normal', energy: 'normal', hands: true, chat_font: 'pixel' },
    display: { dim_after_min: 3, off_after_min: 20 },
  },
  pomodoro: { work_min: 25, short_break_min: 5, long_break_min: 15, rounds: 4 },
  alarms: [
    { id: 'a1', time: '06:45', days: 62, label: 'Wake up', enabled: true, snooze_min: 5, say: '' },
    { id: 'a2', time: '21:00', days: 127, label: 'Lights low', enabled: false, snooze_min: 5, say: '' },
  ],
  reminders: [
    { id: 'r1', kind: 'medicine', label: 'Medicine', enabled: true, mode: 'time', time: '11:30', days: 127, say: 'ওষুধ খাওয়ার সময় হয়েছে' },
    { id: 'water', kind: 'water', label: 'Drink water', enabled: true, mode: 'interval', every_min: 90, from: '09:00', to: '21:00', days: 127, say: '' },
  ],
  prayer: { enabled: true, remind: true, city: 'Dhaka', lat: 23.81, lon: 90.41, days: [
    { date: iso(now), fajr: '04:46', sunrise: '06:05', dhuhr: '11:43', asr: '15:46', sunset: '17:25', maghrib: '17:25', isha: '18:40' },
    { date: iso(tomorrow), fajr: '04:47', sunrise: '06:05', dhuhr: '11:43', asr: '15:45', sunset: '17:24', maghrib: '17:24', isha: '18:39' },
  ] },
  weather: { ok: true, city: 'Dhaka', temp: 27, feels: 30, hi: 30, lo: 22, humidity: 70, rain_prob: 10, kind: 'cloudy', text: 'আংশিক মেঘলা', is_day: true },
  events: [], messages: [
    { id: 'm1', from: 'Demo owner', text: 'আম্মুকে ফোন দিও', status: 'pending', created: Math.floor(now.getTime() / 1000) - 300 },
  ], commands: [], memories: [],
};

const handlers: DemoHandler[] = [
  { method: 'GET', url: '/user/info', reply: { id: 1, username: 'demo', realName: 'Demo owner', superAdmin: 1 } },
  { method: 'GET', url: '/user/pub-config', reply: { version: '0.9.7', allowUserRegister: true, enableMobileRegister: false, sm2PublicKey: '' } },
  { method: 'GET', url: '/agent/list', reply: [DEMO_AGENT] },
  { method: 'GET', url: /\/device\/bind\/[^/]+$/, reply: [DEMO_DEVICE] },
  { method: 'GET', url: /\/device\/companion\/[^/]+$/, reply: DEMO_COMPANION },
  { method: 'GET', url: /\/device\/companion\/[^/]+\/messages$/, reply: DEMO_COMPANION.messages },
  { method: 'POST', url: /\/device\/companion\/[^/]+\/messages$/, reply: (req: any) => ({ id: 'm-new', ...req.data, status: 'pending' }) },
  { method: 'POST', url: /\/device\/companion\/[^/]+\/commands$/, reply: (req: any) => ({ id: 'c-new', ...req.data, status: 'pending' }) },
  { method: 'PUT', url: /\/device\/companion\/[^/]+\/config$/, reply: DEMO_COMPANION },
]

export default handlers
