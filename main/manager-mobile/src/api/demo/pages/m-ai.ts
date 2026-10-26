import type { DemoHandler } from '../index'
import { DEMO_DEVICE } from './zz-base'

// AI wave fixtures (owner: ai). Synthetic data only.
// - GET|PUT /agent/{id}/kids  kids mode of the character
// - GET /usage/quota          the owner's daily LLM limit (character screen notice)
// The demo TinyBot gets the kids_mode product feature (the server's TinyBot product has it);
// its memory notes with `person` live in m-robot.ts.
const features = (DEMO_DEVICE as any).features as string[]
if (Array.isArray(features) && !features.includes('kids_mode'))
  (DEMO_DEVICE as any).features = [...features, 'kids_mode']

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

let kids = { enabled: true, age: 7, blockedTopics: ['ভূত', 'যুদ্ধ', 'horror movies'] }

const handlers: DemoHandler[] = [
  { method: 'GET', url: /\/agent\/[^/]+\/kids$/, reply: () => kids },
  {
    method: 'PUT',
    url: /\/agent\/[^/]+\/kids$/,
    reply: (req) => {
      const b = req.data || {}
      kids = {
        enabled: b.enabled === true,
        age: Math.min(12, Math.max(3, Number(b.age) || 7)),
        blockedTopics: Array.isArray(b.blockedTopics) ? b.blockedTopics.slice(0, 30) : [],
      }
      return kids
    },
  },
  { method: 'GET', url: '/usage/quota', reply: () => ({ date: today(), limit: 200, used: 148, remaining: 52, exceeded: false, blocked: 0 }) },
]
export default handlers
