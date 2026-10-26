import type { DemoHandler, DemoRequest } from '../index'
import { PRODUCT_FIELDS } from './m-products'
import { DEMO_COMPANION } from './zz-base'

// Family sharing fixtures (owner: FAMILY). Synthetic sample data: the demo robot is shared with
// two people and has one invite waiting; one robot of another account is shared with the demo
// account; one invitation waits for the demo account. Every path is the family module's own, so
// nothing here is scoped; writes change this small in-memory set.
const now = Date.now()
const day = 86400000

export const SHARED_DEVICE_ID = 'demo-device-9'
export const SHARED_AGENT_ID = 'demo-agent-9'
const SHARED = {
  shareId: 'share-9',
  deviceId: SHARED_DEVICE_ID,
  agentId: SHARED_AGENT_ID,
  agentName: 'নানুর সাথী',
  alias: 'নানুর টাইনিবট',
  macAddress: '28:84:85:00:00:09',
  board: 'tinybot',
  appVersion: '2.5.5',
  ...PRODUCT_FIELDS.tinybot,
  lastConnectedAtTimestamp: now - 3 * 60000,
  role: 'member',
  ownerName: 'rina_demo',
}

const members: Record<string, any[]> = {
  'demo-device-1': [
    { id: 'share-1', userId: '21', name: 'abir_demo', role: 'co_owner', status: 'accepted', createdAt: now - 40 * day, respondedAt: now - 39 * day },
    { id: 'share-2', userId: '22', name: '+8801700000000', role: 'member', status: 'accepted', createdAt: now - 12 * day, respondedAt: now - 12 * day },
    { id: 'share-3', userId: '23', name: 'mitu_demo', role: 'member', status: 'pending', createdAt: now - 2 * 3600000, respondedAt: null },
  ],
}
let invites: any[] = [
  { id: 'invite-1', deviceId: 'demo-device-8', robotName: 'মামার টাইনিবট', ...PRODUCT_FIELDS.tinybot, ownerName: 'samir_demo', role: 'co_owner', createdAt: now - 5 * 3600000 },
]
let shared: any[] = [SHARED]
let seq = 10

function idFrom(path: string, re: RegExp) {
  const m = path.match(re)
  return m ? decodeURIComponent(m[1]) : ''
}
function findShare(id: string) {
  for (const [deviceId, list] of Object.entries(members)) {
    const m = list.find(x => x.id === id)
    if (m)
      return { deviceId, list, m }
  }
  return null
}

const handlers: DemoHandler[] = [
  { method: 'GET', url: '/family/robots', reply: () => shared },
  {
    method: 'GET',
    url: /\/family\/device\/[^/]+$/,
    reply: (req: DemoRequest) => {
      const id = idFrom(req.path, /\/family\/device\/([^/]+)$/)
      const mine = shared.find(s => s.deviceId === id)
      if (mine) {
        return {
          role: mine.role,
          canShare: false,
          ownerName: mine.ownerName,
          members: [{ id: 'share-9', userId: '1', name: 'demo', role: mine.role, status: 'accepted', createdAt: now - 20 * day, respondedAt: now - 20 * day }],
        }
      }
      return { role: 'owner', canShare: true, ownerName: 'demo', members: members[id] || [] }
    },
  },
  {
    method: 'POST',
    url: /\/family\/device\/[^/]+\/invite$/,
    body: (req: DemoRequest) => {
      const id = idFrom(req.path, /\/family\/device\/([^/]+)\/invite$/)
      const target = String(req.data?.target || '').trim()
      if (/^nobody/i.test(target))
        return { code: 10180, msg: 'User not found', data: null }
      const row = { id: `share-${++seq}`, userId: String(100 + seq), name: target, role: req.data?.role === 'co_owner' ? 'co_owner' : 'member', status: 'pending', createdAt: Date.now(), respondedAt: null }
      members[id] = [...(members[id] || []), row]
      return { code: 0, msg: 'ok', data: row }
    },
  },
  {
    method: 'PUT',
    url: /\/family\/share\/[^/]+$/,
    reply: (req: DemoRequest) => {
      const hit = findShare(idFrom(req.path, /\/family\/share\/([^/]+)$/))
      if (hit)
        hit.m.role = req.data?.role === 'co_owner' ? 'co_owner' : 'member'
      return true
    },
  },
  {
    method: 'DELETE',
    url: /\/family\/share\/[^/]+$/,
    reply: (req: DemoRequest) => {
      const id = idFrom(req.path, /\/family\/share\/([^/]+)$/)
      shared = shared.filter(s => s.shareId !== id)
      const hit = findShare(id)
      if (hit)
        members[hit.deviceId] = hit.list.filter(x => x.id !== id)
      return true
    },
  },
  { method: 'GET', url: '/family/invites', reply: () => invites },
  {
    method: 'POST',
    url: /\/family\/invites\/[^/]+\/(accept|decline)$/,
    reply: (req: DemoRequest) => {
      const id = idFrom(req.path, /\/family\/invites\/([^/]+)\//)
      const inv = invites.find(i => i.id === id)
      invites = invites.filter(i => i.id !== id)
      if (inv && req.path.endsWith('/accept')) {
        shared = [...shared, { ...SHARED, shareId: `share-${++seq}`, deviceId: inv.deviceId, agentId: 'demo-agent-8', agentName: 'মামার সাথী', alias: inv.robotName, macAddress: '28:84:85:00:00:08', role: inv.role, ownerName: inv.ownerName, lastConnectedAtTimestamp: Date.now() - 2 * day }]
      }
      return true
    },
  },
  // The shared robot's character, its online state on the gateway and its companion view
  { method: 'POST', url: new RegExp(`/device/bind/${SHARED_AGENT_ID}$`), reply: () => JSON.stringify({ 'tinybot@@@28_84_85_00_00_09@@@28_84_85_00_00_09': { isAlive: true, exists: true } }) },
  { method: 'GET', url: new RegExp(`/device/bind/${SHARED_AGENT_ID}$`), reply: () => [{ id: SHARED_DEVICE_ID, alias: SHARED.alias, macAddress: SHARED.macAddress, board: 'tinybot', appVersion: '2.5.5', lastConnectedAtTimestamp: String(now - 3 * 60000), autoUpdate: 1, ...PRODUCT_FIELDS.tinybot }] },
  { method: 'GET', url: new RegExp(`/device/companion/${SHARED_DEVICE_ID}$`), reply: () => ({ ...DEMO_COMPANION, id: SHARED.macAddress, name: SHARED.alias }) },
]

export default handlers
