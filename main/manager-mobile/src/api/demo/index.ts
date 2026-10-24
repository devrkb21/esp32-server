// Demo mode (VITE_DEMO=true, `pnpm build:h5 --mode demo`): every request is answered from
// fixtures, so each screen can be shown and captured without a backend. Real builds never use it.
//
// Each page keeps its fixtures in src/api/demo/pages/<page>.ts:
//   export default [
//     { method: 'GET', url: /\/agent\/list$/, reply: req => [...] },        // `data` of the reply
//     { method: 'POST', url: '/user/login', body: req => ({ code: 0, data }) }, // the whole body
//   ]
// `url` is a string (the path must end with it) or a RegExp tested on the path. First match wins,
// in file name order; zz-base.ts holds the shared fixtures. Synthetic sample data only.

export interface DemoRequest { url: string, path: string, method: string, data: any, query: Record<string, string> }
export interface DemoHandler {
  method?: string
  url: string | RegExp
  reply?: any | ((req: DemoRequest) => any)
  body?: (req: DemoRequest) => any
}

const files = import.meta.glob('./pages/*.ts', { eager: true }) as Record<string, { default: DemoHandler[] }>
const handlers: DemoHandler[] = Object.keys(files).sort().flatMap(k => files[k].default || [])

export const DEMO = import.meta.env.VITE_DEMO === 'true'
export const DEMO_TOKEN = JSON.stringify({ token: 'demo-token', expire: 315360000 })

function split(url: string) {
  try {
    const u = new URL(url, 'http://demo.local')
    return { path: u.pathname, query: Object.fromEntries(u.searchParams) as Record<string, string> }
  }
  catch {
    return { path: String(url || ''), query: {} }
  }
}

export function demoBody(url: string, method: string, data: any) {
  const { path, query } = split(url)
  const m = (method || 'GET').toUpperCase()
  const h = handlers.find(x => (x.method || 'GET').toUpperCase() === m
    && (x.url instanceof RegExp ? x.url.test(path) : path.endsWith(x.url)))
  const req: DemoRequest = { url, path, method: m, data, query }
  if (!h) {
    console.info('[demo] no fixture for', m, path)
    return { code: 0, msg: 'ok', data: null }
  }
  if (h.body)
    return h.body(req)
  return { code: 0, msg: 'ok', data: typeof h.reply === 'function' ? h.reply(req) : h.reply }
}

/** An alova request adapter that answers from the fixtures after a short, realistic delay. */
export function demoRequestAdapter(elements: any, method: any) {
  const body = demoBody(elements.url, method.type, elements.data)
  const response = new Promise(resolve => setTimeout(() => resolve({ statusCode: 200, data: body, header: {}, errMsg: 'ok' }), 120))
  return {
    response: () => response,
    headers: () => Promise.resolve({}),
    abort: () => {},
    onDownload: () => {},
    onUpload: () => {},
  }
}
