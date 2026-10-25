import type { DemoHandler, DemoRequest } from '../index'
import { onPage } from '../index'
import { PRODUCT_FIELDS } from './m-products'
import { DEMO_AGENT, DEMO_DEVICE, DEMO_GENERIC_DEVICE, DEMO_STALE_DEVICE, DEMO_WAITING_DEVICE, demoStatusMap } from './zz-base'

// Robots and the device list of one character (owner: m-robots). Synthetic sample data: the base
// account's robot plus a second robot on the same character and an empty second character. Every
// pattern is scoped to these two screens with onPage(), and writes change this small in-memory set.
const now = Date.now()
const ROBOTS = '/pages/robots/'
const DEVICES = '/pages/device/'

const agents: any[] = [
  { ...DEMO_AGENT, ttsVoiceName: 'bn-BD-NabanitaNeural', deviceCount: 2, lastConnectedAt: new Date(now - 60 * 1000).toISOString(), tags: [{ id: 'demo-tag-1', tagName: 'বাড়ি' }] },
  { id: 'demo-agent-2', agentName: 'গল্পের সাথী', ttsModelName: 'EdgeTTS', ttsVoiceName: '', llmModelName: 'Groq', deviceCount: 0, lastConnectedAt: null, tags: [] },
]
const devices: Record<string, any[]> = {
  'demo-agent-1': [
    { ...DEMO_DEVICE, agentId: 'demo-agent-1', lastConnectedAtTimestamp: String(now - 60 * 1000), createDate: '' },
    { id: 'demo-device-2', alias: 'অফিসের টাইনিবট', macAddress: '28:84:85:00:00:02', board: 'tinybot', appVersion: '2.5.3', agentId: 'demo-agent-1', lastConnectedAtTimestamp: String(now - 2 * 86400000 - 3 * 3600000), autoUpdate: 0, createDate: '', ...PRODUCT_FIELDS.tinybot },
    { ...DEMO_GENERIC_DEVICE, agentId: 'demo-agent-1', lastConnectedAtTimestamp: String(now - 26 * 3600000), createDate: '' },
    { ...DEMO_WAITING_DEVICE, agentId: 'demo-agent-1', lastConnectedAtTimestamp: String(now - 30 * 1000), createDate: '' },
    { ...DEMO_STALE_DEVICE, agentId: 'demo-agent-1', lastConnectedAtTimestamp: String(now - 25 * 60000), createDate: '' },
  ],
  'demo-agent-2': [],
}
const FIRMWARE_TYPES = [{ key: 'tinybot', name: 'TinyBot (ESP32-S3)' }]
let seq = 6

function idFrom(path: string, re: RegExp) {
  const m = path.match(re)
  return m ? decodeURIComponent(m[1]) : ''
}
function both(re: RegExp) {
  return [onPage(ROBOTS, re), onPage(DEVICES, re)]
}
function statusMap(agentId: string) {
  return demoStatusMap(devices[agentId] || [])
}
function findDevice(id: string) {
  for (const list of Object.values(devices)) {
    const d = list.find(x => x.id === id)
    if (d)
      return d
  }
  return null
}

const handlers: DemoHandler[] = [
  ...both(/\/agent\/list$/).map(url => ({ method: 'GET', url, reply: () => agents.map(a => ({ ...a, deviceCount: (devices[a.id] || []).length })) })),
  ...both(/\/device\/bind\/([^/]+)$/).map(url => ({ method: 'GET', url, reply: (req: DemoRequest) => devices[idFrom(req.path, /\/device\/bind\/([^/]+)$/)] || [] })),
  // online map (a JSON string, as the gateway sends it)
  ...both(/\/device\/bind\/([^/]+)$/).map(url => ({ method: 'POST', url, reply: (req: DemoRequest) => statusMap(idFrom(req.path, /\/device\/bind\/([^/]+)$/)) })),
  // bind with the spoken code
  ...both(/\/device\/bind\/([^/]+)\/(\d+)$/).map(url => ({
    method: 'POST',
    url,
    body: (req: DemoRequest) => {
      const agentId = idFrom(req.path, /\/device\/bind\/([^/]+)\/\d+$/)
      if (!devices[agentId])
        return { code: 10041, msg: 'Character not found', data: null }
      const n = seq++
      devices[agentId].push({ id: `demo-device-${n}`, alias: '', macAddress: `28:84:85:00:00:${String(n).padStart(2, '0')}`, board: 'tinybot', appVersion: '2.5.5', agentId, lastConnectedAtTimestamp: String(Date.now()), autoUpdate: 1, createDate: '' })
      return { code: 0, msg: 'ok', data: null }
    },
  })),
  ...both(/\/device\/manual-add$/).map(url => ({
    method: 'POST',
    url,
    reply: (req: DemoRequest) => {
      const { agentId, board, appVersion, macAddress } = req.data || {}
      if (devices[agentId])
        devices[agentId].push({ id: `demo-device-${seq++}`, alias: '', macAddress, board, appVersion, agentId, lastConnectedAtTimestamp: null, autoUpdate: 0, createDate: '' })
      return null
    },
  })),
  ...both(/\/admin\/dict\/data\/type\/FIRMWARE_TYPE$/).map(url => ({ method: 'GET', url, reply: FIRMWARE_TYPES })),
  { method: 'POST', url: onPage(ROBOTS, /\/agent$/), reply: (req: DemoRequest) => {
    const id = `demo-agent-${seq++}`
    agents.push({ id, agentName: req.data?.agentName || '', ttsModelName: '', ttsVoiceName: '', llmModelName: '', deviceCount: 0, lastConnectedAt: null, tags: [] })
    devices[id] = []
    return id
  } },
  { method: 'DELETE', url: onPage(ROBOTS, /\/agent\/([^/]+)$/), reply: (req: DemoRequest) => {
    const id = idFrom(req.path, /\/agent\/([^/]+)$/)
    const i = agents.findIndex(a => a.id === id)
    if (i >= 0)
      agents.splice(i, 1)
    delete devices[id]
    return null
  } },
  { method: 'PUT', url: onPage(DEVICES, /\/device\/update\/([^/]+)$/), reply: (req: DemoRequest) => {
    const d = findDevice(idFrom(req.path, /\/device\/update\/([^/]+)$/))
    if (d)
      Object.assign(d, req.data || {})
    return null
  } },
  { method: 'POST', url: onPage(DEVICES, /\/device\/unbind$/), reply: (req: DemoRequest) => {
    for (const list of Object.values(devices)) {
      const i = list.findIndex(x => x.id === req.data?.deviceId)
      if (i >= 0)
        list.splice(i, 1)
    }
    return null
  } },
  { method: 'POST', url: onPage(DEVICES, /\/device\/command\/[^/]+\/reboot$/), reply: null },
  { method: 'POST', url: onPage(DEVICES, /\/device\/command\/([^/]+)\/volume$/), reply: (req: DemoRequest) => {
    const d = findDevice(idFrom(req.path, /\/device\/command\/([^/]+)\/volume$/))
    // the server answers an offline robot with just the number
    return d && d.id !== 'demo-device-1' ? Number(req.data?.volume) : { ok: true }
  } },
]

export default handlers
