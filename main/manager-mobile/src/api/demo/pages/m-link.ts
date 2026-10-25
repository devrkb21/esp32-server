// Demo fixtures for linking a robot by its code (pages/link): GET /device/link/{code} and
// POST /device/link, plus the account's characters while the link screen is open (several, so the
// character choice shows). Synthetic: 123456 is a TinyBot waiting to be linked, 654321 a generic
// Nobix device, 222222 a robot that is already linked, anything else an unknown or expired code.
import type { DemoRequest } from '../index'
import { onPage } from '../index'

const LINK = '/pages/link/'

const pending: Record<string, any> = {
  123456: { board: 'tinybot', macTail: '00A7', productKey: 'tinybot', productNameEn: 'TinyBot', productNameBn: 'টাইনিবট' },
  654321: { board: 'nobix-voice-box', macTail: '00B3', productKey: 'generic', productNameEn: 'Nobix device', productNameBn: 'নোবিক্স ডিভাইস' },
}

const agents = [
  { id: 'demo-agent-1', agentName: 'টাইনিবট', deviceCount: 2 },
  { id: 'demo-agent-2', agentName: 'পড়ার সাথী', deviceCount: 1 },
  { id: 'demo-agent-3', agentName: 'অফিসের সঙ্গী', deviceCount: 0 },
]

const fail = (code: number, msg: string) => ({ code, msg })

function lookup(code: string) {
  if (!/^\d{6}$/.test(code))
    return fail(10212, 'The link code must be 6 digits')
  if (code === '222222')
    return fail(10063, 'Device already activated')
  const p = pending[code]
  if (!p)
    return fail(10213, 'This link code is unknown or has expired. Restart the robot to get a new code')
  return { code: 0, msg: 'ok', data: { code, productIconUrl: null, valid: true, ...p } }
}

export default [
  { method: 'GET', url: onPage(LINK, /\/agent\/list$/), reply: agents },
  { method: 'GET', url: /\/device\/link\/[^/]+$/, body: (req: DemoRequest) => lookup(decodeURIComponent(req.path.split('/').pop() || '')) },
  {
    method: 'POST',
    url: /\/device\/link$/,
    body: (req: DemoRequest) => {
      const data = typeof req.data === 'string' ? JSON.parse(req.data || '{}') : (req.data || {})
      const found = lookup(String(data.code || ''))
      if (found.code !== 0)
        return found
      if (!data.agentId)
        return fail(10214, 'You have several characters. Choose which one this robot should use')
      return { code: 0, msg: 'ok', data: { deviceId: `demo-linked-${data.code}`, agentId: data.agentId, agentCreated: false } }
    },
  },
]
