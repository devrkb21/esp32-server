import type { DemoHandler } from '../index'
import { onPage } from '../index'

// Voiceprints (owner: m-voiceprint): the people TinyBot knows by voice, the recent recordings to
// learn from, and the voice security policy. Synthetic sample data only: generic names, made-up
// lines. Scoped with onPage() to this screen and to the voiceprints part of the character page.
const pad = (n: number) => String(n).padStart(2, '0')
function stamp(daysAgo: number, h = 10, m = 15) {
  const d = new Date(Date.now() - daysAgo * 86400000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(h)}:${pad(m)}:00`
}

const RECENT = [
  { content: JSON.stringify({ speaker: 'Rina', content: 'টাইনিবট, আজ আবহাওয়া কেমন?' }), audioId: 'demo-vp-audio-01' },
  { content: 'আমাকে সকাল সাতটায় ডেকে দিও।', audioId: 'demo-vp-audio-02' },
  { content: JSON.stringify({ speaker: 'Ammu', content: 'দুপুরে ভাত খেয়েছো তো?' }), audioId: 'demo-vp-audio-03' },
  { content: 'একটা ছোট্ট গল্প শোনাও।', audioId: 'demo-vp-audio-04' },
  { content: JSON.stringify({ speaker: '', content: 'আজ অফিস থেকে ফিরতে দেরি হবে।' }), audioId: 'demo-vp-audio-05' },
  { content: 'বাতিটা একটু কমিয়ে দাও।', audioId: 'demo-vp-audio-06' },
  { content: 'কালকের নামাজের সময় বলো।', audioId: 'demo-vp-audio-07' },
  { content: JSON.stringify({ speaker: 'Abbu', content: 'চা খেতে খেতে খবর শুনব।' }), audioId: 'demo-vp-audio-08' },
]

let people = [
  { id: 'demo-vp-1', audioId: 'demo-vp-audio-03', sourceName: 'আম্মু', introduce: 'আমার মা, সকালে নামাজ পড়ে চা খান', createDate: stamp(21, 8, 40) },
  { id: 'demo-vp-2', audioId: 'demo-vp-audio-01', sourceName: 'Rina', introduce: 'ছোট বোন, ক্রিকেট আর আঁকা ভালোবাসে', createDate: stamp(9, 19, 5) },
  { id: 'demo-vp-3', audioId: 'demo-vp-audio-08', sourceName: 'আব্বু', introduce: '', createDate: stamp(2, 7, 20) },
]

let security = { confidenceThreshold: 0.7, requireVoiceMatchSmartHome: true, adminSpeakerOnly: true }

const SCREENS = ['/pages/voiceprint/', '/pages/agent/']
const scoped = (pattern: RegExp, h: Omit<DemoHandler, 'url'>): DemoHandler[] => SCREENS.map(p => ({ ...h, url: onPage(p, pattern) }))

const handlers: DemoHandler[] = [
  ...scoped(/\/agent\/voice-print\/security$/, { method: 'GET', reply: () => ({ ...security }) }),
  ...scoped(/\/agent\/voice-print\/security$/, {
    method: 'POST',
    reply: (req: any) => {
      security = { ...security, ...(req.data || {}) }
      return null
    },
  }),
  ...scoped(/\/agent\/voice-print\/list\/[^/]+$/, { method: 'GET', reply: () => people.map(p => ({ ...p })) }),
  ...scoped(/\/agent\/[^/]+\/chat-history\/user$/, { method: 'GET', reply: () => RECENT.map(r => ({ ...r })) }),
  ...scoped(/\/agent\/voice-print$/, {
    method: 'POST',
    reply: (req: any) => {
      const d = req.data || {}
      people = [...people, { id: `demo-vp-${Date.now()}`, audioId: d.audioId, sourceName: d.sourceName, introduce: d.introduce || '', createDate: stamp(0, new Date().getHours(), new Date().getMinutes()) }]
      return null
    },
  }),
  ...scoped(/\/agent\/voice-print$/, {
    method: 'PUT',
    reply: (req: any) => {
      const d = req.data || {}
      people = people.map(p => (p.id === d.id ? { ...p, ...d } : p))
      return null
    },
  }),
  ...scoped(/\/agent\/voice-print\/[^/]+$/, {
    method: 'DELETE',
    reply: (req: any) => {
      const id = req.path.split('/').pop()
      people = people.filter(p => p.id !== id)
      return null
    },
  }),
  // The play ticket of a recording (the character page's chat fixtures answer it there first).
  ...scoped(/\/agent\/audio\/[^/]+$/, { method: 'POST', reply: 'demo-download-id' }),
]

export default handlers
