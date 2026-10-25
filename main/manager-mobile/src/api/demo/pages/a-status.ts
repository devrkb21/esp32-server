import type { DemoHandler, DemoRequest } from '../index'
import { DEMO_COMPANION } from './zz-base'

// Connection states for the demo (owner: robot status, src/utils/robotConnection.mjs). Sorted
// first, so these two robots answer the same way on every screen; every other robot passes on.
// Same ids as manager-web's demo:
//   demo-device-4  on MQTT, but the companion server has no record of it: waiting_companion
//   demo-device-5  on MQTT and known, but its last sync is 25 minutes old: not_syncing
export const WAITING_ID = 'demo-device-4'
export const STALE_ID = 'demo-device-5'
const STALE_VIEW = {
  ...DEMO_COMPANION,
  id: '28:84:85:00:00:05',
  name: 'বসার ঘরের টাইনিবট',
  online: false,
  last_seen: Math.floor(Date.now() / 1000) - 25 * 60,
}

function idOf(path: string) {
  const m = path.match(/\/device\/companion\/([^/]+)/)
  return m ? decodeURIComponent(m[1]) : ''
}
// manager-api forwards xiaozhi-server's 404 as { code: 500, msg: 'device not found' }
const NOT_FOUND = { code: 500, msg: 'device not found', data: null }

const handlers: DemoHandler[] = [
  { method: 'GET', url: /\/device\/companion\/[^/]+$/, body: (req: DemoRequest) => {
    const id = idOf(req.path)
    if (id === WAITING_ID)
      return NOT_FOUND
    if (id === STALE_ID)
      return { code: 0, msg: 'ok', data: STALE_VIEW }
    return undefined
  } },
  ...['GET', 'POST', 'PUT'].map(method => ({
    method,
    url: /\/device\/companion\/[^/]+\/.+$/,
    body: (req: DemoRequest) => (idOf(req.path) === WAITING_ID ? NOT_FOUND : undefined),
  })),
]

export default handlers
