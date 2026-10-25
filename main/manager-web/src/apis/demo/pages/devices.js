// Demo fixtures of the Devices page (owner: web-devices). Synthetic sample robots of the demo
// character: one online (the base robot), one updating its firmware, one offline.
import { DEMO_AGENT, DEMO_COMPANION, DEMO_DEVICE } from './zz-base.js';

const now = Date.now();
const DAY = 86400000;

const devices = [
  { ...DEMO_DEVICE, createDateTimestamp: now - 211 * DAY, lastConnectedAtTimestamp: now - 2 * 3600000 },
  { id: 'demo-device-2', alias: 'Desk robot', macAddress: '28:84:85:00:00:02', board: 'tinybot', appVersion: '2.5.1',
    autoUpdate: 1, createDateTimestamp: now - 64 * DAY, lastConnectedAtTimestamp: now - 25 * 60000 },
  { id: 'demo-device-3', alias: '', macAddress: '28:84:85:00:00:03', board: 'tinybot', appVersion: '1.9.0',
    autoUpdate: 0, createDateTimestamp: now - 9 * DAY, lastConnectedAtTimestamp: now - 3 * DAY },
];

const clientId = (d) => `${d.board}@@@${d.macAddress.replace(/:/g, '_')}@@@${d.macAddress.replace(/:/g, '_')}`;
const status = {
  [clientId(devices[0])]: { isAlive: true, exists: true },
  [clientId(devices[1])]: { isAlive: true, exists: true },
  [clientId(devices[2])]: { isAlive: false, exists: true },
};

const ok = (data = null) => ({ code: 0, msg: 'success', data });

export default [
  { method: 'GET', url: new RegExp(`/device/bind/${DEMO_AGENT.id}$`), reply: devices },
  // Online status from the MQTT gateway: `data` is a JSON string
  { method: 'POST', url: new RegExp(`/device/bind/${DEMO_AGENT.id}$`), reply: JSON.stringify(status) },
  { method: 'POST', url: /\/device\/bind\/[^/]+\/\d{6}$/, body: () => ok() },
  { method: 'GET', url: /\/device\/companion\/demo-device-2$/,
    reply: { ...DEMO_COMPANION, id: devices[1].macAddress, name: 'Desk robot', settings: { ...DEMO_COMPANION.settings, volume: 40, night: { ...DEMO_COMPANION.settings.night, enabled: false } }, stats: { ...DEMO_COMPANION.stats, fw: '2.5.1', volume: 40, state: 'ota_update' } } },
  { method: 'GET', url: /\/device\/companion\/demo-device-3$/,
    reply: { ...DEMO_COMPANION, id: devices[2].macAddress, name: '', online: false, last_seen: Math.floor((now - 3 * DAY) / 1000), stats: { ...DEMO_COMPANION.stats, fw: '1.9.0', volume: 70 } } },
  { method: 'GET', url: '/admin/dict/data/type/FIRMWARE_TYPE', reply: [{ key: 'tinybot', name: 'TinyBot' }] },
  { method: 'PUT', url: /\/device\/update\/[^/]+$/, body: () => ok() },
  { method: 'POST', url: '/device/unbind', body: () => ok() },
  { method: 'POST', url: '/device/manual-add', body: () => ok() },
  { method: 'POST', url: /\/device\/command\/[^/]+\/reboot$/, body: () => ok() },
  { method: 'POST', url: /\/device\/command\/[^/]+\/volume$/, body: () => ok() },
];
