// Demo fixtures of family sharing (owner: FAMILY). Synthetic sample people only. The demo account
// owns its robot (two people in its family, one invite waiting), has one robot shared with it,
// and one invitation to answer.
import { TINYBOT_FEATURES } from './products';

const now = Date.now();
const day = 86400000;

export const SHARED_ROBOT = {
  shareId: 'sh-in-1', deviceId: 'demo-shared-1', agentId: 'demo-agent-shared', agentName: 'Nanu', alias: 'নানুর টাইনিবট',
  macAddress: '28:84:85:00:00:07', board: 'tinybot', appVersion: '2.5.5', productKey: 'tinybot', productName: 'TinyBot',
  productNameBn: 'টাইনিবট', features: TINYBOT_FEATURES, lastConnectedAtTimestamp: now - 3 * 60000, role: 'member', ownerName: 'sample-owner',
};

let members = [
  { id: 'sh-1', userId: 2, name: 'family-member-1', role: 'co_owner', status: 'accepted', createdAt: now - 20 * day, respondedAt: now - 19 * day },
  { id: 'sh-2', userId: 3, name: '+8801700000000', role: 'member', status: 'accepted', createdAt: now - 9 * day, respondedAt: now - 9 * day },
  { id: 'sh-3', userId: 4, name: 'family-member-3', role: 'member', status: 'pending', createdAt: now - 2 * 3600000, respondedAt: null },
];
let invites = [
  { id: 'inv-1', deviceId: 'demo-shared-2', robotName: 'বড় মামার রোবট', productKey: 'tinybot', productName: 'TinyBot', productNameBn: 'টাইনিবট',
    ownerName: 'sample-uncle', role: 'member', createdAt: now - 5 * 3600000 },
];
let seq = 10;
const idOf = (path) => decodeURIComponent(path.split('/').pop());

export default [
  { method: 'GET', url: '/family/robots', reply: () => [SHARED_ROBOT] },
  {
    method: 'GET', url: /\/family\/device\/[^/]+$/,
    reply: (req) => (idOf(req.path) === SHARED_ROBOT.deviceId
      ? { role: 'member', canShare: false, ownerName: SHARED_ROBOT.ownerName, members: [
        { id: 'sh-in-1', userId: 1, name: 'demo', role: 'member', status: 'accepted', createdAt: now - 4 * day, respondedAt: now - 4 * day },
        { id: 'sh-in-2', userId: 5, name: 'sample-cousin', role: 'co_owner', status: 'accepted', createdAt: now - 30 * day, respondedAt: now - 29 * day },
      ] }
      : { role: 'owner', canShare: true, ownerName: 'demo', members }),
  },
  {
    method: 'POST', url: /\/family\/device\/[^/]+\/invite$/,
    body: (req) => {
      const target = String((req.data && req.data.target) || '').trim();
      if (/^nobody/i.test(target)) return { code: 10404, msg: 'No account with that username or number' };
      seq += 1;
      const row = { id: `sh-${seq}`, userId: seq, name: target, role: req.data.role || 'member', status: 'pending', createdAt: Date.now(), respondedAt: null };
      members = [...members, row];
      return { code: 0, msg: 'ok', data: row };
    },
  },
  {
    method: 'PUT', url: /\/family\/share\/[^/]+$/,
    reply: (req) => { members = members.map((m) => (m.id === idOf(req.path) ? { ...m, role: req.data.role } : m)); return true; },
  },
  { method: 'DELETE', url: /\/family\/share\/[^/]+$/, reply: (req) => { members = members.filter((m) => m.id !== idOf(req.path)); return true; } },
  { method: 'GET', url: '/family/invites', reply: () => invites },
  {
    method: 'POST', url: /\/family\/invites\/[^/]+\/(accept|decline)$/,
    reply: (req) => { const id = req.path.split('/').slice(-2)[0]; invites = invites.filter((i) => i.id !== id); return true; },
  },
];
