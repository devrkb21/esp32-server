// Family sharing on the phone: pure helpers (unit tested in familyModel.test.mjs). The server is
// the judge of every permission; these only decide what the screens offer.

/** Bangladeshi mobile number: 01XXXXXXXXX, 8801XXXXXXXXX or +8801XXXXXXXXX (spaces and dashes allowed). */
const BD_PHONE = /^(?:\+?880|0)1[3-9]\d{8}$/

/** The digits and a leading plus of a typed number, without spaces, dashes or brackets. */
export function compactPhone(text) {
  return String(text || '').trim().replace(/[\s\-().]/g, '')
}

/** Does the text look like a phone number (only digits, maybe a plus)? */
export function looksLikePhone(text) {
  return /^\+?\d{6,}$/.test(compactPhone(text))
}

/**
 * What the invite field holds: `{ ok, kind: 'phone'|'username', value, problem }`.
 * A phone is sent as +8801XXXXXXXXX; the server matches every Bangladeshi form.
 */
export function inviteTarget(text) {
  const raw = String(text || '').trim()
  if (!raw)
    return { ok: false, kind: '', value: '', problem: 'required' }
  if (looksLikePhone(raw)) {
    const p = compactPhone(raw)
    if (!BD_PHONE.test(p))
      return { ok: false, kind: 'phone', value: p, problem: 'phone' }
    const local = p.replace(/^\+?880/, '0')
    return { ok: true, kind: 'phone', value: `+88${local}`, problem: '' }
  }
  if (raw.length > 64 || /\s/.test(raw))
    return { ok: false, kind: 'username', value: raw, problem: 'username' }
  return { ok: true, kind: 'username', value: raw, problem: '' }
}

/** What a role may do (same table as the server's permission service). */
const CAN = {
  view: ['owner', 'co_owner', 'member'],
  use: ['owner', 'co_owner', 'member'],
  manage: ['owner', 'co_owner'],
  delete: ['owner'],
  share: ['owner'],
}
export function roleCan(role, action) {
  const r = role || 'owner'
  return (CAN[action] || []).includes(r)
}

/** Members of a robot split into accepted people and invites that wait. */
export function splitMembers(members) {
  const list = Array.isArray(members) ? members : []
  const byTime = (a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0)
  return {
    accepted: list.filter(m => m && m.status === 'accepted').sort(byTime),
    pending: list.filter(m => m && m.status === 'pending').sort(byTime),
  }
}

/** One shared robot (GET /family/robots) as a robot of the app's list. */
export function sharedRobot(s, product) {
  const d = s || {}
  return {
    deviceId: d.deviceId,
    agentId: d.agentId,
    agentName: d.agentName || '',
    name: d.alias || '',
    macAddress: d.macAddress || '',
    board: d.board || '',
    lastConnectedAt: d.lastConnectedAtTimestamp ?? null,
    ...(product || {}),
    role: d.role === 'co_owner' ? 'co_owner' : 'member',
    sharedBy: d.ownerName || '',
    shareId: d.shareId || '',
  }
}

/** Own robots first, then the shared ones the account does not already own. */
export function mergeRobots(own, shared) {
  const mine = (own || []).map(r => ({ ...r, role: r.role || 'owner' }))
  const ids = new Set(mine.map(r => r.deviceId))
  return mine.concat((shared || []).filter(r => r && r.deviceId && !ids.has(r.deviceId)))
}

/** The role on the robot an agent belongs to: 'owner' unless a shared robot runs it. */
export function roleOfAgent(list, agentId) {
  const hits = (list || []).filter(r => r && r.agentId === agentId)
  if (!hits.length || hits.some(r => !r.role || r.role === 'owner'))
    return 'owner'
  return hits.some(r => r.role === 'co_owner') ? 'co_owner' : 'member'
}

/** The hours the no-activity alert offers (0 = off). */
export const CARE_HOURS = [0, 2, 3, 4, 6, 8]

/** settings.care with every key the care alerts use (server defaults: hours 0, fall and medicine on). */
export function careSettings(raw) {
  const c = raw || {}
  const hours = Math.round(Number(c.no_activity_hours))
  return {
    enabled: c.enabled !== false,
    no_activity_hours: Number.isFinite(hours) ? Math.min(12, Math.max(0, hours)) : 0,
    fall_alert: c.fall_alert !== false,
    missed_medicine_alert: c.missed_medicine_alert !== false,
  }
}
