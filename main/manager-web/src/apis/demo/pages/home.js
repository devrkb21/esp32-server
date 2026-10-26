// Demo fixtures of the Smart home page and the robot messages part of Messages (owner: HOME).
// Synthetic sample data: a home with a few lights, a fan and an AC; family robots with generic names.
const integration = {
  ha: { baseUrl: 'http://192.168.0.50:8123', tokenSaved: true },
  mqtt: { host: '192.168.0.60', port: 1883, username: 'home', passwordSaved: true, tls: false },
};

const devices = [
  { id: '101', source: 'ha', entityId: 'light.living_room', domain: 'light', name: 'Living Room Light', aliases: ['বসার ঘরের লাইট', 'বসার ঘরের বাতি'], topic: '', payloadOn: '', payloadOff: '', enabled: true },
  { id: '102', source: 'ha', entityId: 'light.bedroom', domain: 'light', name: 'শোবার ঘরের লাইট', aliases: ['বেডরুমের বাতি'], topic: '', payloadOn: '', payloadOff: '', enabled: true },
  { id: '103', source: 'ha', entityId: 'fan.bedroom', domain: 'fan', name: 'Bedroom Fan', aliases: ['ফ্যান', 'পাখা'], topic: '', payloadOn: '', payloadOff: '', enabled: true },
  { id: '104', source: 'ha', entityId: 'climate.living_room_ac', domain: 'climate', name: 'AC', aliases: ['এসি'], topic: '', payloadOn: '', payloadOff: '', enabled: true },
  { id: '105', source: 'ha', entityId: 'cover.balcony', domain: 'cover', name: 'Balcony Curtain', aliases: ['বারান্দার পর্দা'], topic: '', payloadOn: '', payloadOff: '', enabled: true },
  { id: '106', source: 'mqtt', entityId: '', domain: 'switch', name: 'Kettle', aliases: ['কেটলি'], topic: 'home/kettle/set', payloadOn: 'ON', payloadOff: 'OFF', enabled: false },
];
const view = () => ({ ...integration, deviceCount: devices.length });

const robots = [{ deviceId: 'demo-device-1', name: 'টাইনিবট' }, { deviceId: 'demo-device-2', name: 'Kitchen' }];
const contacts = [
  { id: '501', status: 'pending', direction: 'in', myDeviceId: null, myDeviceName: '', name: '', aliases: [], otherOwner: 'Nanu', otherUsername: 'nanu', otherDeviceName: 'নানুর টাইনিবট', theirName: 'নাতির রোবট', createdAt: Date.now() - 3600e3 },
  { id: '502', status: 'accepted', direction: 'out', myDeviceId: 'demo-device-1', myDeviceName: 'টাইনিবট', name: 'বাবার রোবট', aliases: ['বাবা', 'Abbu'], otherOwner: 'Abbu', otherUsername: 'abbu', otherDeviceName: 'Office TinyBot', theirName: 'খোকার রোবট', createdAt: Date.now() - 9 * 86400e3 },
  { id: '503', status: 'pending', direction: 'out', myDeviceId: 'demo-device-1', myDeviceName: 'টাইনিবট', name: 'খালার রোবট', aliases: ['খালা'], otherOwner: 'Khala', otherUsername: 'khala', otherDeviceName: '', theirName: '', createdAt: Date.now() - 86400e3 },
];
const targets = [
  { key: 'd:demo-device-2', name: 'Kitchen', aliases: [], kind: 'own' },
  { key: 'c:502', name: 'বাবার রোবট', aliases: ['বাবা', 'Abbu'], kind: 'contact' },
];

export default [
  { method: 'GET', url: '/home/integration', reply: () => view() },
  {
    method: 'PUT', url: '/home/integration', reply: (req) => {
      const b = req.data || {};
      if (b.haBaseUrl !== undefined) integration.ha.baseUrl = b.haBaseUrl;
      if (b.haToken) integration.ha.tokenSaved = true;
      if (b.mqttHost !== undefined) Object.assign(integration.mqtt, { host: b.mqttHost, port: b.mqttPort, username: b.mqttUsername, tls: !!b.mqttTls });
      if (b.mqttPassword) integration.mqtt.passwordSaved = true;
      return view();
    },
  },
  { method: 'POST', url: /\/home\/integration\/test$/, reply: (req) => (req.query.target === 'mqtt' ? { ok: true, code: 'ok', message: 'MQTT broker answered' } : { ok: true, code: 'ok', message: 'Home Assistant answered', version: '2026.10.1' }) },
  { method: 'POST', url: '/home/ha/import', reply: () => ({ ok: true, code: 'ok', found: 5, added: 0, devices }) },
  { method: 'GET', url: '/home/devices', reply: () => devices },
  {
    method: 'POST', url: '/home/devices', reply: (req) => {
      const d = { id: String(200 + devices.length), source: 'mqtt', entityId: '', enabled: true, ...(req.data || {}) };
      devices.push(d);
      return d;
    },
  },
  {
    method: 'PUT', url: /\/home\/devices\/[^/]+$/, reply: (req) => {
      const id = req.path.split('/').pop();
      const d = devices.find((x) => x.id === id);
      if (d) Object.assign(d, req.data || {});
      return d;
    },
  },
  { method: 'DELETE', url: /\/home\/devices\/[^/]+$/, reply: () => null },
  { method: 'POST', url: /\/home\/devices\/[^/]+\/action$/, reply: (req) => ({ ok: true, code: 'ok', message: 'ok', action: (req.data || {}).action }) },

  { method: 'GET', url: '/contacts', reply: () => ({ robots, contacts }) },
  { method: 'GET', url: '/contacts/targets', reply: () => targets },
  { method: 'POST', url: '/contacts/send', reply: (req) => ({ ok: true, code: 'ok', to: (targets.find((t) => t.key === (req.data || {}).target) || {}).name || '', later: false }) },
  { method: 'POST', url: '/contacts', reply: (req) => ({ id: '599', status: 'pending', direction: 'out', ...(req.data || {}) }) },
  { method: 'POST', url: /\/contacts\/[^/]+\/(accept|decline)$/, reply: () => ({}) },
  { method: 'PUT', url: /\/contacts\/[^/]+$/, reply: () => ({}) },
  { method: 'DELETE', url: /\/contacts\/[^/]+$/, reply: () => null },
];
