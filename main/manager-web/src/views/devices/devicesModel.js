// The robots of one character (pure helpers: unit tested in tests/devicesModel.test.mjs).
// Field rules come from the old DeviceManagement page and the manager-api device list.
import {
  compareTimestamps, formatCreateDate, hasTimestampValue, parseLegacyDate, parseTimestamp,
} from '@/utils/deviceTime.mjs';
import { codeFromText } from '@/utils/linkCode';

export const ALIAS_MAX = 64;
export const PAGE_SIZES = [10, 20, 50, 100];
export const CODE_RE = /^\d{6}$/;
export const MAC_RE = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

/** One row of the table from a GET /device/bind/{agentId} entry, sorted later by bind time. */
export function toRow(device, formatDate) {
  const rawBindTime = hasTimestampValue(device.createDateTimestamp)
    ? parseTimestamp(device.createDateTimestamp)
    : parseLegacyDate(device.createDate);
  const lastSeen = hasTimestampValue(device.lastConnectedAtTimestamp)
    ? parseTimestamp(device.lastConnectedAtTimestamp)
    : parseLegacyDate(device.lastConnectedAt);
  return {
    device_id: device.id,
    model: device.board || '',
    firmwareVersion: device.appVersion || '',
    macAddress: device.macAddress || '',
    bindTime: formatCreateDate(device.createDateTimestamp, device.createDate, formatDate),
    lastConnectedRaw: lastSeen,
    alias: device.alias || '',
    originalAlias: device.alias || '',
    autoUpdate: device.autoUpdate === 1,
    volume: device.volume === undefined ? null : device.volume,
    rawBindTime,
  };
}

export function toRows(list, formatDate) {
  return (Array.isArray(list) ? list : [])
    .map((d) => toRow(d, formatDate))
    .sort((a, b) => compareTimestamps(a.rawBindTime, b.rawBindTime));
}

/** The MQTT client id the gateway reports a robot under: board@@@mac@@@mac (":" as "_"). */
export function mqttClientId(row) {
  const mac = row.macAddress ? row.macAddress.replace(/:/g, '_') : 'unknown';
  const group = row.model ? row.model.replace(/:/g, '_') : 'GID_default';
  return `${group}@@@${mac}@@@${mac}`;
}

/**
 * The status map of POST /device/bind/{agentId}: `data` is a JSON string. Returns the parsed map,
 * or null when the MQTT service is not there (then the page says the state is unknown).
 */
export function parseStatusMap(body) {
  if (!body || body.code !== 0) return null;
  try {
    const map = typeof body.data === 'string' ? JSON.parse(body.data) : body.data;
    return map && typeof map === 'object' ? map : null;
  } catch (e) {
    return null;
  }
}

/** 'online' or 'offline' for one row from the status map (isAlive wins; null + exists = online). */
export function onlineFrom(map, row) {
  const info = map && map[mqttClientId(row)];
  if (!info) return 'offline';
  if (info.isAlive === true) return 'online';
  if (info.isAlive === false) return 'offline';
  return info.isAlive === null && info.exists === true ? 'online' : 'offline';
}

/** Rows whose name, board or MAC address contains the query (case-insensitive). */
export function filterRows(rows, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => [r.alias, r.model, r.macAddress].some((v) => v && v.toLowerCase().includes(q)));
}

export function pageOf(rows, page, size) {
  const start = (page - 1) * size;
  return rows.slice(start, start + size);
}

/** Firmware 2.0.0 and later can take a generated look (wake word and theme). */
export function canGenerateLook(version) {
  return Number(String(version || '').replace(/\./g, '')) >= 200;
}

/** A MAC address split for the masked view: {ok, head, middle, tail}. */
export function macParts(mac) {
  const value = String(mac || '');
  if (!/^(?:[0-9A-Z]{2}[:-]){5}[0-9A-Z]{2}$/i.test(value)) return { ok: false, head: value, middle: '', tail: '' };
  const sep = value.includes('-') ? '-' : ':';
  const seg = value.split(/[:-]/);
  return { ok: true, head: seg.slice(0, 2).join(sep), middle: sep + seg.slice(2, 4).join(sep) + sep, tail: seg.slice(4).join(sep) };
}

/**
 * Keep digits only, at most six (the code TinyBot shows); Bangla digits become 0-9, and the
 * robot's whole link (its QR URL, `.../#/link?code=123456`) gives its code.
 */
export function cleanCode(value) {
  return codeFromText(value);
}

/** The alias to save, or why not: {ok, text, reason: 'tooLong' | 'same'}. */
export function aliasChange(row, value) {
  const text = String(value || '').trim();
  if (text.length > ALIAS_MAX) return { ok: false, text, reason: 'tooLong' };
  if (text === row.originalAlias) return { ok: false, text, reason: 'same' };
  return { ok: true, text };
}

/** Problems of the add-by-MAC form, as i18n keys per field (empty object when valid). */
export function manualProblems(form) {
  const out = {};
  if (!form.macAddress) out.macAddress = 'manual.requiredMac';
  else if (!MAC_RE.test(form.macAddress)) out.macAddress = 'manual.invalidMac';
  if (!form.board) out.board = 'manual.requiredBoard';
  if (!String(form.appVersion || '').trim()) out.appVersion = 'manual.requiredVersion';
  return out;
}
