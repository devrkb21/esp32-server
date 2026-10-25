import type { DemoHandler } from '../index'
import { onPage } from '../index'
import { DEMO_COMPANION } from './zz-base'

// Messages, chat history and chat detail (owner: m-messages). Synthetic sample data only:
// generic names, made-up lines. Every pattern is scoped to these screens with onPage().
const nowS = Math.floor(Date.now() / 1000)
const pad = (n: number) => String(n).padStart(2, '0')
function stamp(msAgo: number) {
  const d = new Date(Date.now() - msAgo)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const MESSAGES = [
  { id: 'm5', from: 'Ammu', text: 'আম্মুকে ফোন দিও', ask: false, ts: nowS - 300, status: 'pending' },
  { id: 'm4', from: 'Ammu', text: 'দুপুরে খেয়েছো?', ask: true, ts: nowS - 2 * 3600, status: 'delivered', delivered_ts: nowS - 2 * 3600 + 20, answer: 'yes', answer_ts: nowS - 2 * 3600 + 90 },
  { id: 'm3', from: '', text: 'আজ বিকেলে বৃষ্টি হতে পারে, ছাতা নিয়ে বের হয়ো।', ask: false, ts: nowS - 5 * 3600, status: 'delivered', delivered_ts: nowS - 5 * 3600 + 15, answer: 'seen' },
  { id: 'm2', from: 'Abbu', text: 'রাতে তাড়াতাড়ি ঘুমাতে যেও', ask: false, ts: nowS - 26 * 3600, status: 'delivered', delivered_ts: nowS - 26 * 3600 + 30 },
  { id: 'm1', from: 'Ammu', text: 'ওষুধ খেয়েছো?', ask: true, ts: nowS - 4 * 86400, status: 'delivered', delivered_ts: nowS - 4 * 86400 + 40, answer: 'no' },
]

const COMMANDS = [
  { id: 'c3', type: 'breathe', arg: '', ts: nowS - 600, status: 'pending' },
  { id: 'c2', type: 'game', arg: 'dice', ts: nowS - 3 * 3600, status: 'done', done_ts: nowS - 3 * 3600 + 10 },
  { id: 'c1', type: 'pomodoro', arg: '25', ts: nowS - 27 * 3600, status: 'done', done_ts: nowS - 27 * 3600 + 8 },
]

const TITLES = ['আবহাওয়ার খবর', 'সকালের শুভেচ্ছা', 'গল্পের আসর', '', 'দিনের হিসাব', 'নামাজের সময়', '', 'খেলার কথা', 'পড়াশোনা', 'রাতের গল্প', 'চায়ের আড্ডা', '', 'বাজারের তালিকা', 'গানের কথা']
const SESSIONS = TITLES.map((title, i) => ({
  sessionId: `demo-session-${String(i + 1).padStart(2, '0')}-${(i * 7919).toString(16).padStart(6, '0')}`,
  createdAt: stamp(i === 0 ? 40 * MIN : i === 1 ? 5 * HOUR : i * DAY + 3 * HOUR),
  chatCount: [6, 4, 12, 2, 8, 3, 5, 9, 7, 10, 4, 3, 6, 5][i],
  title,
}))

function lines() {
  return [
    { createdAt: stamp(42 * MIN), chatType: 1, content: JSON.stringify({ speaker: 'Rina', content: 'টাইনিবট, আজ আবহাওয়া কেমন?' }), audioId: 'demo-audio-1', macAddress: '28:84:85:00:00:01' },
    { createdAt: stamp(41 * MIN + 50000), chatType: 3, content: JSON.stringify([{ type: 'tool', text: 'get_weather(city="Dhaka")' }, { type: 'tool_result', text: '{\n  "city": "Dhaka",\n  "temp": 27,\n  "feels": 30,\n  "humidity": 70,\n  "rain_prob": 10,\n  "text": "partly cloudy"\n}' }]), audioId: null, macAddress: '28:84:85:00:00:01' },
    { createdAt: stamp(41 * MIN + 40000), chatType: 2, content: 'ঢাকায় এখন ২৭ ডিগ্রি, আকাশ আংশিক মেঘলা। বৃষ্টির সম্ভাবনা কম, তবে বাইরে গেলে পানি সঙ্গে রেখো।', audioId: 'demo-audio-2', macAddress: '28:84:85:00:00:01' },
    { createdAt: stamp(41 * MIN), chatType: 1, content: JSON.stringify({ speaker: '', content: 'ধন্যবাদ! বিকেলে কী করবে?' }), audioId: 'demo-audio-3', macAddress: '28:84:85:00:00:01' },
    { createdAt: stamp(40 * MIN + 50000), chatType: 2, content: 'বিকেলে চা খাব আর একটু ছবি আঁকব। তুমি চাইলে একটা গল্পও শোনাতে পারি।', audioId: 'demo-audio-4', macAddress: '28:84:85:00:00:01' },
    { createdAt: stamp(30 * MIN), chatType: 1, content: JSON.stringify({ speaker: 'Rina', content: 'পরে শুনব। এখন একটু কাজ করি।' }), audioId: 'demo-audio-5', macAddress: '28:84:85:00:00:01' },
    { createdAt: stamp(29 * MIN + 50000), chatType: 2, content: 'ঠিক আছে, মন দিয়ে কাজ করো। দরকার হলে ডেকো।', audioId: null, macAddress: '28:84:85:00:00:01' },
  ]
}

const SCREENS = ['/pages/messages/', '/pages/chat-history/', '/pages/agent/']
const scoped = (pattern: RegExp, h: Omit<DemoHandler, 'url'>): DemoHandler[] => SCREENS.map(p => ({ ...h, url: onPage(p, pattern) }))

const handlers: DemoHandler[] = [
  { method: 'GET', url: onPage('/pages/messages/', /\/device\/companion\/[^/]+$/), reply: { ...DEMO_COMPANION, messages: MESSAGES, commands: COMMANDS } },
  { method: 'GET', url: onPage('/pages/messages/', /\/device\/companion\/[^/]+\/messages$/), reply: { messages: MESSAGES } },
  { method: 'POST', url: onPage('/pages/messages/', /\/device\/companion\/[^/]+\/messages$/), reply: (req: any) => ({ id: `m-${Date.now()}`, ...req.data, ts: Math.floor(Date.now() / 1000), status: 'pending' }) },
  { method: 'POST', url: onPage('/pages/messages/', /\/device\/companion\/[^/]+\/commands$/), reply: (req: any) => ({ id: `c-${Date.now()}`, ...req.data, ts: Math.floor(Date.now() / 1000), status: 'pending' }) },
  ...scoped(/\/agent\/[^/]+\/sessions$/, {
    method: 'GET',
    reply: (req: any) => {
      const page = Number(req.query.page || 1)
      const limit = Number(req.query.limit || 10)
      return { total: SESSIONS.length, list: SESSIONS.slice((page - 1) * limit, page * limit) }
    },
  }),
  ...scoped(/\/agent\/[^/]+\/chat-history\/(?!user$|audio$)[^/]+$/, { method: 'GET', reply: () => lines() }),
  ...scoped(/\/agent\/audio\/[^/]+$/, { method: 'POST', reply: 'demo-download-id' }),
  ...scoped(/\/agent\/chat-history\/getDownloadUrl\/[^/]+\/[^/]+$/, { method: 'POST', reply: 'demo-download-uuid' }),
]

export default handlers
