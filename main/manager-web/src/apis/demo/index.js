// Demo mode (VUE_APP_DEMO=true, `npm run build:demo`): every API call is answered from fixture
// files, so each screen can be shown and captured without a backend. Real builds never load it.
//
// Each page keeps its fixtures in src/apis/demo/pages/<page>.js:
//   export default [
//     { method: 'GET', url: /\/agent\/list$/, reply: (req) => [...] },        // `data` of the reply
//     { method: 'POST', url: '/user/login', body: (req) => ({ code: 0, data }) }, // the whole body
//   ]
// `url` is a string (the path must end with it) or a RegExp tested on the path. The first match
// wins, in file name order; a handler whose body() or reply() returns undefined passes the call on
// to the next match. Fixtures carry synthetic sample data, never real people or numbers.

const files = import.meta.glob('./pages/*.js', { eager: true });
const handlers = Object.keys(files).sort().flatMap((k) => files[k].default || []);

export const DEMO = process.env.VUE_APP_DEMO === 'true';

function pathOf(url) {
  try { return new URL(url, 'http://demo.local').pathname; } catch (e) { return String(url || ''); }
}

export function demoReply({ url, method, data }) {
  const path = pathOf(url);
  const m = (method || 'GET').toUpperCase();
  const req = { url, path, method: m, data, query: Object.fromEntries(new URL(url, 'http://demo.local').searchParams) };
  for (const h of handlers) {
    if ((h.method || 'GET').toUpperCase() !== m) continue;
    if (!(h.url instanceof RegExp ? h.url.test(path) : path.endsWith(h.url))) continue;
    let body;
    if (h.body) body = h.body(req);
    else {
      const d = typeof h.reply === 'function' ? h.reply(req) : h.reply;
      if (d !== undefined) body = { code: 0, msg: 'ok', data: d };
    }
    if (body !== undefined) return { status: 200, data: body };
  }
  // An unknown call succeeds with no data, so screens show their empty state, never a crash.
  console.info('[demo] no fixture for', m, path);
  return { status: 200, data: { code: 0, msg: 'ok', data: null } };
}

export const DEMO_USER = { id: 1, username: 'demo', realName: 'Demo owner', superAdmin: 1, status: 1 };
export const DEMO_TOKEN = JSON.stringify({ token: 'demo-token', expire: 315360000, _localStoredAt: Date.now() });
