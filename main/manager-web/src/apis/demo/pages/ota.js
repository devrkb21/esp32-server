// Demo fixtures of the Firmware (OTA) page (owner: web-ota). Synthetic builds, kept in memory so
// upload, edit and delete work in the demo. Type labels follow the FIRMWARE_TYPE dictionary of
// manager-api (changelog 202504301341.sql and 202610240100.sql for tinybot).
const day = 86400000;
const at = (daysAgo, h = 10) => {
  const d = new Date(Date.now() - daysAgo * day);
  d.setHours(h, 20, 0, 0);
  return d.toISOString();
};

const TYPES = [
  { name: 'TinyBot (ESP32-S3 SuperMini)', key: 'tinybot' },
  { name: 'Breadboard New Wiring (WiFi)', key: 'bread-compact-wifi' },
  { name: 'Breadboard New Wiring (WiFi)+LCD', key: 'bread-compact-wifi-lcd' },
  { name: 'ESP BOX 3', key: 'esp-box-3' },
  { name: 'ESP BOX', key: 'esp-box' },
];

let seq = 10;
const builds = [
  { id: 'fw-7', firmwareName: 'tinybot-2.5.5', type: 'tinybot', version: '2.5.5', size: 2187264, remark: 'Release build', firmwarePath: 'demo/tinybot-2.5.5.bin', createDate: at(3), updateDate: at(3) },
  { id: 'fw-6', firmwareName: 'tinybot-2.5.4', type: 'tinybot', version: '2.5.4', size: 2179072, remark: 'Previous release, kept for rollback', firmwarePath: 'demo/tinybot-2.5.4.bin', createDate: at(19), updateDate: at(12, 16) },
  { id: 'fw-5', firmwareName: 'esp-box-3-1.6.2', type: 'esp-box-3', version: '1.6.2', size: 3342336, remark: 'Bench test unit', firmwarePath: 'demo/esp-box-3-1.6.2.bin', createDate: at(26), updateDate: at(26) },
  { id: 'fw-4', firmwareName: 'tinybot-2.5.3', type: 'tinybot', version: '2.5.3', size: 2170880, remark: '', firmwarePath: 'demo/tinybot-2.5.3.bin', createDate: at(41), updateDate: at(41) },
  { id: 'fw-3', firmwareName: 'bread-compact-wifi-1.6.0', type: 'bread-compact-wifi', version: '1.6.0', size: 1966080, remark: 'Breadboard prototype', firmwarePath: 'demo/bread-1.6.0.bin', createDate: at(58), updateDate: at(58) },
];

const ok = (data) => ({ code: 0, msg: 'ok', data });
const pick = (req, k) => (req.query && req.query[k] !== undefined ? req.query[k] : req.data && req.data[k]);

export default [
  { method: 'GET', url: /\/admin\/dict\/data\/type\/FIRMWARE_TYPE$/, reply: TYPES },
  {
    method: 'GET', url: /\/otaMag$/, reply: (req) => {
      const page = Number(pick(req, 'page')) || 1;
      const limit = Number(pick(req, 'limit')) || 10;
      const q = String(pick(req, 'firmwareName') || '').toLowerCase();
      const list = builds
        .filter((b) => !q || b.firmwareName.toLowerCase().includes(q))
        .sort((a, b) => new Date(b.createDate) - new Date(a.createDate));
      return { total: list.length, list: list.slice((page - 1) * limit, page * limit) };
    },
  },
  { method: 'GET', url: /\/otaMag\/getDownloadUrl\/[^/]+$/, reply: () => `demo-${Date.now().toString(36)}` },
  { method: 'POST', url: /\/otaMag\/upload$/, reply: () => `demo/upload-${Date.now().toString(36)}.bin` },
  {
    method: 'POST', url: /\/otaMag$/, body: (req) => {
      const now = new Date().toISOString();
      builds.unshift({ ...req.data, id: `fw-${++seq}`, createDate: now, updateDate: now });
      return ok(null);
    },
  },
  {
    method: 'PUT', url: /\/otaMag\/[^/]+$/, body: (req) => {
      const id = decodeURIComponent(req.path.split('/').pop());
      const b = builds.find((x) => x.id === id);
      if (b) Object.assign(b, req.data, { id, type: b.type, updateDate: new Date().toISOString() });
      return ok(null);
    },
  },
  {
    method: 'DELETE', url: /\/otaMag\/[^/]+$/, body: (req) => {
      const ids = decodeURIComponent(req.path.split('/').pop()).split(',');
      for (const id of ids) {
        const i = builds.findIndex((x) => x.id === id);
        if (i >= 0) builds.splice(i, 1);
      }
      return ok(null);
    },
  },
];
