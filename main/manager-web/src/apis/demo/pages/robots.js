// Demo fixtures for My robots (owner: web-robots). Synthetic sample data: a demo account with two
// characters and three robots (one online). Changes made in the demo (add, bind, delete) live
// until the page is reloaded.
import { PRODUCT_FIELDS } from './products.js';

const now = Date.now();
const ago = (min) => new Date(now - min * 60000).toISOString();

const agents = [
  { id: 'demo-agent-1', agentName: 'TinyBot', llmModelName: 'Groq', ttsModelName: 'EdgeTTS', ttsVoiceName: 'Nabanita',
    memModelId: 'Memory_mem_local_short', deviceCount: 2, lastConnectedAt: ago(0) },
  { id: 'demo-agent-2', agentName: 'পড়ার সাথী', llmModelName: 'Groq', ttsModelName: 'EdgeTTS', ttsVoiceName: 'Pradeep',
    memModelId: 'Memory_nomem', deviceCount: 1, lastConnectedAt: ago(60 * 26) },
  { id: 'demo-agent-3', agentName: 'অফিসের সঙ্গী', llmModelName: '', ttsModelName: '', ttsVoiceName: '',
    memModelId: 'Memory_nomem', deviceCount: 0, lastConnectedAt: null },
];

const devices = {
  'demo-agent-1': [
    { id: 'demo-device-1', alias: 'টাইনিবট', macAddress: '28:84:85:00:00:01', board: 'tinybot', appVersion: '2.5.5',
      lastConnectedAt: ago(0), autoUpdate: 1, ...PRODUCT_FIELDS.tinybot },
    { id: 'demo-device-2', alias: 'শোবার ঘর', macAddress: '28:84:85:00:00:02', board: 'tinybot', appVersion: '2.5.5',
      lastConnectedAt: ago(47), autoUpdate: 1, ...PRODUCT_FIELDS.tinybot },
  ],
  'demo-agent-2': [
    // A generic Nobix device (not a TinyBot): the product tag and the feature filtering show.
    { id: 'demo-device-3', alias: 'পড়ার টেবিল', macAddress: '28:84:85:00:00:03', board: 'nobix-voice-box', appVersion: '2.4.0',
      lastConnectedAt: ago(60 * 26), autoUpdate: 0, ...PRODUCT_FIELDS.generic },
  ],
  'demo-agent-3': [],
};

const statusKey = (d) => `${d.board}@@@${d.macAddress.replace(/:/g, '_')}@@@${d.macAddress.replace(/:/g, '_')}`;
const ONLINE = new Set(['demo-device-1']);

function agentIdOf(path) {
  const m = path.match(/\/device\/bind\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

function withCounts(list) {
  return list.map((a) => ({ ...a, deviceCount: (devices[a.id] || []).length }));
}

let next = 6;

export default [
  {
    method: 'GET', url: /\/agent\/list$/,
    reply: (req) => {
      const q = (req.query.keyword || '').trim().toLowerCase();
      if (!q) return withCounts(agents);
      if (req.query.searchType === 'mac') {
        return withCounts(agents.filter((a) => (devices[a.id] || []).some((d) => d.macAddress.toLowerCase() === q)));
      }
      return withCounts(agents.filter((a) => a.agentName.toLowerCase().includes(q)));
    },
  },
  { method: 'POST', url: /\/agent$/, reply: (req) => {
    const id = `demo-agent-${next++}`;
    agents.push({ id, agentName: (req.data && req.data.agentName) || 'TinyBot', llmModelName: '', ttsModelName: '', ttsVoiceName: '',
      memModelId: 'Memory_nomem', deviceCount: 0, lastConnectedAt: null });
    devices[id] = [];
    return id;
  } },
  { method: 'DELETE', url: /\/agent\/[^/]+$/, reply: (req) => {
    const id = decodeURIComponent(req.path.split('/').pop());
    const i = agents.findIndex((a) => a.id === id);
    if (i >= 0) agents.splice(i, 1);
    delete devices[id];
    return null;
  } },
  { method: 'GET', url: /\/device\/bind\/[^/]+$/, reply: (req) => devices[agentIdOf(req.path)] || [] },
  {
    method: 'POST', url: /\/device\/bind\/[^/]+$/,
    reply: (req) => {
      const map = {};
      for (const d of devices[agentIdOf(req.path)] || []) {
        map[statusKey(d)] = { isAlive: ONLINE.has(d.id), exists: true };
      }
      return JSON.stringify(map);
    },
  },
  {
    method: 'POST', url: /\/device\/bind\/[^/]+\/\d{6}$/,
    body: (req) => {
      const parts = req.path.split('/');
      const code = parts.pop();
      const id = decodeURIComponent(parts.pop());
      if (code === '000000') return { code: 10041, msg: 'This code has expired. Restart the robot to hear a new one.' };
      const n = next++;
      (devices[id] = devices[id] || []).push({ id: `demo-device-${n}`, alias: '', macAddress: `28:84:85:00:00:${String(n).padStart(2, '0')}`,
        board: 'tinybot', appVersion: '2.5.5', lastConnectedAt: null, autoUpdate: 1 });
      return { code: 0, msg: 'ok', data: null };
    },
  },
  {
    method: 'POST', url: '/device/manual-add',
    reply: (req) => {
      const p = req.data || {};
      (devices[p.agentId] = devices[p.agentId] || []).push({ id: `demo-device-${next++}`, alias: '', macAddress: p.macAddress,
        board: p.board, appVersion: p.appVersion, lastConnectedAt: null, autoUpdate: 1 });
      return null;
    },
  },
  {
    method: 'GET', url: '/admin/dict/data/type/FIRMWARE_TYPE',
    reply: [{ key: 'tinybot', name: 'TinyBot (ESP32-S3)' }, { key: 'esp32-s3-devkit', name: 'ESP32-S3 DevKit' }],
  },
];
