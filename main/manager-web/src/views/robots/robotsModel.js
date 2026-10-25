// My robots: pure helpers (unit tested in tests/robots.test.mjs). Every rule here comes from the
// legacy page and dialogs (home.vue, DeviceItem.vue, AddDeviceDialog.vue, ManualAddDeviceDialog.vue,
// DeviceManagement.vue, MacAddressMask.vue), kept as they were.

/** Search: a full MAC (aa:bb:cc:dd:ee:ff) searches by MAC, anything else by name (home.vue). */
export function searchTypeOf(value) {
  return /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(String(value || '').trim()) ? 'mac' : 'name';
}

/** The 6-digit bind code: digits only, at most six (AddDeviceDialog.vue). */
export function cleanCode(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 6);
}
export function isValidCode(value) {
  return /^\d{6}$/.test(String(value || ''));
}

/** Manual add: MAC with ':' or '-' separators (ManualAddDeviceDialog.vue). */
export function macError(value) {
  if (!value) return 'required';
  if (!/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(value)) return 'invalid';
  return '';
}

/** The manual-add form's errors by field ('' when the field is fine). */
export function manualErrors(form) {
  return {
    macAddress: macError((form.macAddress || '').trim()),
    board: form.board ? '' : 'required',
    appVersion: String(form.appVersion || '').trim() ? '' : 'required',
  };
}

/** A MAC shown with its middle bytes hidden until hover or focus (MacAddressMask.vue). */
export function maskMac(mac) {
  const s = String(mac || '');
  if (!/^(?:[0-9A-Z]{2}[:-]){5}[0-9A-Z]{2}$/i.test(s)) return { valid: false, text: s };
  const sep = s.indexOf('-') !== -1 ? '-' : ':';
  const seg = s.split(/[:-]/);
  return {
    valid: true,
    text: s,
    prefix: seg.slice(0, 2).join(sep),
    middle: sep + seg.slice(2, 4).join(sep) + sep,
    suffix: seg.slice(4).join(sep),
  };
}

/** Milliseconds from a timestamp (seconds or ms), an ISO string or 'YYYY-MM-DD HH:mm:ss'. */
export function parseTime(value) {
  if (value === null || value === undefined || value === '') return NaN;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const n = Number(value);
    return n < 1e12 ? n * 1000 : n;
  }
  const s = String(value);
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return t;
  return Date.parse(s.replace(' ', 'T'));
}

/**
 * How long ago (DeviceItem.vue): never, just now (<= 1 min), minutes (< 1 h), hours and
 * minutes (< 24 h), else the date itself.
 */
export function lastSeen(value, now = Date.now()) {
  const t = parseTime(value);
  if (Number.isNaN(t)) return { kind: 'never' };
  const minutes = Math.max(0, Math.floor((now - t) / 60000));
  if (minutes <= 1) return { kind: 'just', at: t };
  if (minutes < 60) return { kind: 'minutes', minutes, at: t };
  if (minutes < 24 * 60) return { kind: 'hours', hours: Math.floor(minutes / 60), minutes: minutes % 60, at: t };
  return { kind: 'date', at: t };
}

/**
 * Online status from POST /device/bind/{agentId}: `data` is a JSON string mapping MQTT client ids
 * to { isAlive, exists }. Returns null when the status service is not available.
 */
export function parseStatus(data) {
  if (data && typeof data === 'object') return data;
  try {
    const map = JSON.parse(data);
    return map && typeof map === 'object' ? map : null;
  } catch (e) {
    return null;
  }
}

/** Is this device online in the status map (DeviceManagement.vue updateDeviceStatusFromResponse). */
export function isOnline(statusMap, device) {
  if (!statusMap || !device) return false;
  const mac = device.macAddress ? device.macAddress.replace(/:/g, '_') : 'unknown';
  const group = device.board ? device.board.replace(/:/g, '_') : 'GID_default';
  const info = statusMap[`${group}@@@${mac}@@@${mac}`];
  if (!info) return false;
  if (info.isAlive === true) return true;
  if (info.isAlive === false) return false;
  return info.isAlive === null && info.exists === true;
}

/** One robot row from an agent and one of its bound devices. */
export function toRobot(agent, d) {
  return {
    deviceId: d.id,
    agentId: agent.id,
    agentName: agent.agentName || '',
    name: d.alias || '',
    macAddress: d.macAddress || '',
    board: d.board || '',
    appVersion: d.appVersion || '',
    lastConnectedAt: d.lastConnectedAtTimestamp ?? d.lastConnectedAt ?? null,
  };
}

/** Delete confirmation: the typed name must match exactly (home.vue). */
export function nameMatches(typed, name) {
  return !!name && typed === name;
}

/** Search history: newest first, no duplicates, at most `max` (home.vue). */
export function pushHistory(list, keyword, max = 5) {
  const k = String(keyword || '').trim();
  if (!k || list.includes(k)) return list.slice();
  return [k, ...list].slice(0, max);
}
