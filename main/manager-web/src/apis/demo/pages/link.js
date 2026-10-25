// Demo fixtures for linking a robot by its code (GET /device/link/{code}, POST /device/link).
// Synthetic: 123456 is a TinyBot waiting to be linked, 654321 a generic Nobix device, 222222 a
// robot that is already linked, anything else an unknown or expired code.
import { PRODUCT_FIELDS } from './products.js';

const pending = {
  123456: { board: 'tinybot', macTail: '00A7', ...PRODUCT_FIELDS.tinybot },
  654321: { board: 'nobix-voice-box', macTail: '00B3', ...PRODUCT_FIELDS.generic },
};
const fail = (code, msg) => ({ code, msg });

function lookup(code) {
  if (!/^\d{6}$/.test(code)) return fail(10212, 'The link code must be 6 digits');
  if (code === '222222') return fail(10063, 'Device already activated');
  const p = pending[code];
  if (!p) return fail(10213, 'This link code is unknown or has expired. Restart the robot to get a new code');
  return {
    code: 0, msg: 'ok',
    data: {
      code, board: p.board, productKey: p.productKey, productNameEn: p.productName, productNameBn: p.productNameBn,
      productIconUrl: null, macTail: p.macTail, valid: true,
    },
  };
}

export default [
  { method: 'GET', url: /\/device\/link\/[^/]+$/, body: (req) => lookup(decodeURIComponent(req.path.split('/').pop())) },
  {
    method: 'POST', url: /\/device\/link$/,
    body: (req) => {
      const data = typeof req.data === 'string' ? JSON.parse(req.data || '{}') : (req.data || {});
      const found = lookup(String(data.code || ''));
      if (found.code !== 0) return found;
      if (!data.agentId) return fail(10214, 'You have several characters. Choose which one this robot should use');
      return { code: 0, msg: 'ok', data: { deviceId: `demo-linked-${data.code}`, agentId: data.agentId, agentCreated: false } };
    },
  },
];
