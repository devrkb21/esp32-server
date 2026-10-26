// Family sharing rules the screens share (pure: unit tested in tests/family.test.mjs). The server
// (manager-api module `family`) is the judge; these only decide what the app offers.

export const ROLES = ['member', 'co_owner'];

/** Bangladeshi mobile: 01XXXXXXXXX, 8801XXXXXXXXX or +8801XXXXXXXXX (spaces and dashes allowed). */
export function bdPhone(input) {
  const raw = String(input || '').trim().replace(/[\s-]/g, '');
  const m = raw.match(/^(?:\+?880|0)(1[3-9]\d{8})$/);
  return m ? `+880${m[1]}` : '';
}

/**
 * What the invite field holds: { kind: 'phone' | 'username' | '', value, problem }.
 * Digits that look like a phone number but are not a valid Bangladeshi mobile are a problem
 * ('phone'); an empty field is 'required'; anything else is sent as a username.
 */
export function inviteTarget(input) {
  const raw = String(input || '').trim();
  if (!raw) return { kind: '', value: '', problem: 'required' };
  const phone = bdPhone(raw);
  if (phone) return { kind: 'phone', value: phone, problem: '' };
  if (/^[+\d\s-]+$/.test(raw) && raw.replace(/\D/g, '').length >= 3) return { kind: 'phone', value: raw, problem: 'phone' };
  if (raw.length > 64) return { kind: 'username', value: raw, problem: 'long' };
  return { kind: 'username', value: raw, problem: '' };
}

/** What a role may do in the app. */
export function can(role, action) {
  const r = role || 'owner';
  switch (action) {
    case 'share': return r === 'owner';
    case 'unbind': return r === 'owner';
    case 'character': return r === 'owner' || r === 'co_owner';
    case 'manage': return r === 'owner' || r === 'co_owner';
    case 'leave': return r === 'member' || r === 'co_owner';
    default: return r === 'owner' || r === 'co_owner' || r === 'member';
  }
}

/** The family list in the order the page shows it: accepted people first, then invites, newest first in each. */
export function sortMembers(members) {
  return (Array.isArray(members) ? members : []).slice().sort((a, b) => {
    const pa = a.status === 'pending' ? 1 : 0;
    const pb = b.status === 'pending' ? 1 : 0;
    if (pa !== pb) return pa - pb;
    return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
  });
}

/** One GET /family/robots item as a robot of the shell's list. */
export function sharedRobot(item) {
  const s = item || {};
  return {
    deviceId: s.deviceId, agentId: s.agentId, agentName: s.agentName || '', name: s.alias || '',
    macAddress: s.macAddress || '', board: s.board || '', lastConnectedAt: s.lastConnectedAtTimestamp ?? null,
    role: ROLES.includes(s.role) ? s.role : 'member', sharedBy: s.ownerName || '', shareId: s.shareId,
  };
}

/** Own robots (role owner) followed by shared ones the list does not have yet. */
export function mergeRobots(own, shared) {
  const mine = (own || []).map((r) => ({ role: 'owner', sharedBy: '', ...r }));
  const ids = new Set(mine.map((r) => r.deviceId));
  return [...mine, ...(shared || []).filter((r) => r && r.deviceId && !ids.has(r.deviceId))];
}
