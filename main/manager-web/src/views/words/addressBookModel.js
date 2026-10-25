// Address book (robot-to-robot calls): pure helpers (unit tested in tests/words.test.mjs).
// Behaviour from the legacy AddressBookManagement page: robots come from every character's bound
// devices, online state from the MQTT gateway's status map, permissions are keyed by the
// target robot's MAC address and saved one changed contact at a time.
import { parseTimestamp } from '@/utils/deviceTime.mjs';

export const ALIAS_MAX = 64;

/** A robot of the list from a GET /device/bind/{agentId} entry (the legacy mapping). */
export function toRobot(device) {
  const alias = device.alias && String(device.alias).trim() ? device.alias : '';
  return {
    id: device.id,
    name: alias || device.id,
    alias: device.alias || '',
    type: device.board,
    deviceId: device.macAddress,
    online: false,
    status: 'unknown', // online | offline | unknown (no answer from the gateway yet)
    createDate: device.createDate,
    createDateTimestamp: device.createDateTimestamp,
    // the timestamp, as the legacy page read it; the older date string only when it is missing
    lastConnectedAt: device.lastConnectedAtTimestamp ?? (device.lastConnectedAt ? Date.parse(device.lastConnectedAt) || null : null),
  };
}

/** The gateway's client id of a robot: board@@@mac@@@mac with ":" as "_" (legacy rule). */
export function clientIdOf(robot) {
  const mac = robot.deviceId ? robot.deviceId.replace(/:/g, '_') : 'unknown';
  const group = robot.type ? robot.type.replace(/:/g, '_') : 'GID_default';
  return `${group}@@@${mac}@@@${mac}`;
}

/** The status map of POST /device/bind/{agentId} (`data` is a JSON string), or null. */
export function parseStatus(body) {
  if (!body || body.code !== 0) return null;
  try {
    const map = typeof body.data === 'string' ? JSON.parse(body.data) : body.data;
    return map && typeof map === 'object' ? map : null;
  } catch (e) {
    return null;
  }
}

/** Online from one status entry: isAlive wins; isAlive null with exists true counts as online. */
export function isOnline(info) {
  if (!info) return false;
  if (info.isAlive === true) return true;
  if (info.isAlive === false) return false;
  return info.isAlive === null && info.exists === true;
}

/** Applies a status map to the robots of one character (in place, as the legacy page did). */
export function applyStatus(robots, map) {
  for (const r of robots || []) {
    r.online = isOnline(map[clientIdOf(r)]);
    r.status = r.online ? 'online' : 'offline';
  }
}

/** Characters whose name, or one of whose robots' name or MAC, holds the query. */
export function filterAgents(agents, query) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return agents;
  return agents.filter((a) => String(a.agentName || '').toLowerCase().includes(q)
    || (a.devices || []).some((d) => String(d.name || '').toLowerCase().includes(q)
      || String(d.deviceId || '').toLowerCase().includes(q)));
}

/** Every robot except the selected one, once per MAC address: the possible contacts. */
export function contactsFor(agents, selectedId) {
  const seen = new Set();
  const out = [];
  for (const a of agents || []) {
    for (const d of a.devices || []) {
      const key = String(d.deviceId || d.id).toLowerCase();
      if (d.id === selectedId || seen.has(key)) continue;
      seen.add(key);
      out.push(d);
    }
  }
  return out;
}

/**
 * Reads GET /device/address-book/{mac}: the MACs of the contacts this robot may call (as the
 * contacts spell them) and each contact's address-book name, matched case-insensitively.
 */
export function readPermissions(list, contacts) {
  const byMac = new Map((list || []).map((p) => [String(p.targetMac || '').toLowerCase(), p]));
  const permitted = new Set((list || []).filter((p) => p.hasPermission).map((p) => String(p.targetMac || '').toLowerCase()));
  const selected = contacts.filter((c) => permitted.has(String(c.deviceId || '').toLowerCase())).map((c) => c.deviceId);
  const aliases = {};
  for (const c of contacts) {
    const entry = byMac.get(String(c.deviceId || '').toLowerCase());
    aliases[c.deviceId] = entry ? entry.alias || '' : '';
  }
  return { selected, aliases };
}

/** The contacts whose permission changed: [{ targetMac, hasPermission }]. */
export function permissionChanges(contacts, selected, original) {
  return contacts
    .filter((c) => selected.includes(c.deviceId) !== original.includes(c.deviceId))
    .map((c) => ({ targetMac: c.deviceId, hasPermission: selected.includes(c.deviceId) }));
}

/** "How long ago" in whole units: { key, n } for the i18n keys abook.ago.*. */
export function agoParts(timestamp, now = Date.now()) {
  const ts = parseTimestamp(timestamp);
  if (ts === null) return null;
  const seconds = Math.floor((now - ts) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  if (seconds < 60) return { key: 'justNow', n: 0 };
  if (minutes < 60) return { key: 'minutes', n: minutes };
  if (hours < 24) return { key: 'hours', n: hours };
  if (days < 30) return { key: 'days', n: days };
  if (months < 12) return { key: 'months', n: months };
  return { key: 'years', n: years };
}

/** The date a robot was added: its timestamp, else the legacy date string, as a Date or null. */
export function addedDate(robot) {
  if (!robot) return null;
  const ts = parseTimestamp(robot.createDateTimestamp);
  if (ts !== null) return new Date(ts);
  if (!robot.createDate) return null;
  const d = new Date(String(robot.createDate).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The first letter of a real name, for the robot's initial; '' for robots named by their id. */
export function initialOf(robot, alias) {
  const name = String(alias || (robot && robot.alias) || '').trim();
  return name ? Array.from(name)[0].toUpperCase() : '';
}
