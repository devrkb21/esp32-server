import { reactive } from 'vue';
import Api from '@/apis/api';
import { products, robot } from './robot';
import { allows, productOf } from './products';
import { companionErrorKind, companionsToAsk, connectionOf, rawErrorText } from './connection.mjs';
import { isOnline, parseStatus } from '@/views/robots/robotsModel';
import { peopleText } from '@/utils/errorText.mjs';

// The robot's connection status, in one place for every page (rules in ./connection.mjs).
// Pages that load the companion view report what they got (noteCompanionView / noteCompanionError);
// the gateway's online map comes from refreshMqtt. statusOf(deviceId) combines them.
//   links[deviceId] = { mqtt, companion, mqttAt, companionAt }

export const links = reactive({});
const MQTT_MAX_AGE = 20000;
const COMPANION_MAX_AGE = 25000;

function entry(id) {
  if (!links[id]) links[id] = { mqtt: undefined, companion: undefined, mqttAt: 0, companionAt: 0 };
  return links[id];
}

/** The robot list entry of a device (or the chosen robot), for its product and last connection. */
function itemOf(id) {
  return robot.list.find((r) => r.deviceId === id) || (id === robot.deviceId ? robot : null);
}

/** Does the device's product have the companion module? Unknown devices count as TinyBots. */
export function hasCompanion(id, item) {
  const it = item || itemOf(id);
  return allows(it && Array.isArray(it.features) ? it.features : null, 'companion');
}

/** A companion view arrived: only what the status needs is kept. */
export function noteCompanionView(id, view) {
  if (!id || !view || typeof view !== 'object') return;
  const e = entry(id);
  e.companion = { ok: true, view: { last_seen: view.last_seen, online: view.online } };
  e.companionAt = Date.now();
}

/**
 * A companion call failed: records what it means and returns its kind (connection.mjs). The raw
 * server text goes to the console only.
 */
export function noteCompanionError(id, err) {
  const kind = companionErrorKind(err);
  if (typeof console !== 'undefined') console.warn(`TinyBot companion ${id}: ${kind}`, rawErrorText(err) || err);
  if (!id) return kind;
  const e = entry(id);
  e.companion = { ok: false, kind };
  e.companionAt = Date.now();
  return kind;
}

/** The gateway's answer for one device (true / false, or null when the map is not available). */
export function noteMqtt(id, value) {
  if (!id) return;
  const e = entry(id);
  e.mqtt = value === true ? true : value === false ? false : null;
  e.mqttAt = Date.now();
}

/** A whole online map (POST /device/bind/{agentId}) for a list of devices ({ deviceId | id, macAddress, board }). */
export function noteMqttMap(map, devices) {
  for (const d of devices || []) {
    const id = d.deviceId || d.id;
    noteMqtt(id, map ? isOnline(map, d) : null);
  }
}

/** The connection status of a device: { state, lastSeen, reason } (connection.mjs). */
export function statusOf(id, { item, now = Date.now() } = {}) {
  const it = item || itemOf(id);
  const e = (id && links[id]) || {};
  return connectionOf({
    hasCompanion: hasCompanion(id, it),
    mqtt: e.mqtt,
    companion: e.companion,
    lastConnectedAt: it ? it.lastConnectedAt : null,
    now,
  });
}

/** Ask the gateway for every device of an agent; resolves when noted. */
export function refreshMqtt(agentId, devices) {
  const list = devices || robot.list.filter((r) => r.agentId === agentId);
  if (!agentId || !Api.device || !Api.device.getDeviceStatus) return Promise.resolve();
  return new Promise((resolve) => {
    Api.device.getDeviceStatus(agentId, (res) => {
      const data = res && res.data;
      noteMqttMap(data && data.code === 0 ? parseStatus(data.data) : null, list);
      resolve();
    }, () => { noteMqttMap(null, list); resolve(); });
  });
}

/** Load the companion view of a device for its status; resolves to { view, kind }. */
export function refreshCompanion(id) {
  if (!id || !Api.companion) return Promise.resolve({ view: null, kind: '' });
  return new Promise((resolve) => {
    Api.companion.getCompanion(id, (res) => {
      const view = res && res.data ? res.data.data : null;
      noteCompanionView(id, view);
      resolve({ view, kind: '' });
    }, (err) => resolve({ view: null, kind: noteCompanionError(id, err) }));
  });
}

/**
 * Ask the companion views a list page needs for its statuses (rule: companionsToAsk in
 * connection.mjs; call after noting the gateway map). `devices` are raw device entries
 * ({ id | deviceId, macAddress, board }, with `features` when known). Returns the ids asked.
 */
export function checkCompanions(devices, { now = Date.now() } = {}) {
  const ids = companionsToAsk((devices || []).map((d) => {
    const id = d.deviceId || d.id;
    const e = (id && links[id]) || {};
    return {
      id,
      hasCompanion: hasCompanion(id, Array.isArray(d.features) ? d : productOf(d, products.list)),
      mqtt: e.mqtt,
      askedAt: e.companionAt || 0,
    };
  }), now);
  ids.forEach((id) => refreshCompanion(id));
  return ids;
}

/**
 * Bring a device's status up to date, skipping what is fresh enough (a page that polls the view
 * keeps it fresh). `force` asks both again.
 */
export function refreshRobotStatus(id, { force = false, companion = true } = {}) {
  if (!id) return Promise.resolve();
  const e = entry(id);
  const it = itemOf(id);
  const now = Date.now();
  const jobs = [];
  if (it && it.agentId && (force || now - e.mqttAt > MQTT_MAX_AGE)) jobs.push(refreshMqtt(it.agentId));
  if (companion && hasCompanion(id, it) && (force || now - e.companionAt > COMPANION_MAX_AGE)) jobs.push(refreshCompanion(id));
  return Promise.all(jobs);
}

/** The MQTT half only, when stale (pages that load the companion view themselves). */
export function ensureMqtt(id) {
  return refreshRobotStatus(id, { companion: false });
}

/**
 * The words of a failed companion call for a toast: the server's own message only when it is
 * one meant for people (a validation answer), never infrastructure text like "device not found".
 */
export function friendlyError(err, fallback) {
  const msg = rawErrorText(err);
  if (!msg) return fallback;
  const kind = companionErrorKind(err);
  if (kind === 'not_registered' || kind === 'no_companion') return fallback;
  return peopleText(msg) || fallback; // src/utils/errorText.mjs: never infrastructure or stack text
}

/** Forget every status (sign-out, tests). */
export function resetRobotStatus() {
  for (const k of Object.keys(links)) delete links[k];
}
