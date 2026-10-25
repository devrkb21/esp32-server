import type { DemoHandler, DemoRequest } from '../index'
import { onPage } from '../index'

// Robot setup (pages/device-config, owner: m-setup). The setup hotspot's portal (192.168.4.1:
// /scan, /pair, /submit, /exit) answered with synthetic data, so the demo build walks the whole
// flow. hotspotClient.ts sends these paths here in the demo build only. Pattern 0 is the one
// "on TinyBot's face"; a wrong pick gets a new challenge, as the firmware does.
const SETUP = '/pages/device-config/'

const HEART = ['............', '.XXX....XXX.', 'XXXXX..XXXXX', 'XXXXXXXXXXXX', 'XXXXXXXXXXXX', 'XXXXXXXXXXXX', '.XXXXXXXXXX.', '..XXXXXXXX..', '...XXXXXX...', '....XXXX....', '.....XX.....', '............']
const HOUSE = ['.....XX.....', '....XXXX....', '...XXXXXX...', '..XXXXXXXX..', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', '.XX......XX.', '.XX.XX...XX.', '.XX.XX...XX.', '.XX.XX...XX.', '.XXXXX...XX.', '.XXXXXXXXXX.']
const MOON = ['....XXXX....', '..XXXX......', '.XXXX.......', '.XXX........', 'XXXX........', 'XXXX........', 'XXXX........', 'XXXX........', '.XXX........', '.XXXX.......', '..XXXX......', '....XXXX....']
const PLUS = ['............', '....XXXX....', '....XXXX....', '....XXXX....', 'XXXXXXXXXXXX', 'XXXXXXXXXXXX', 'XXXXXXXXXXXX', 'XXXXXXXXXXXX', '....XXXX....', '....XXXX....', '....XXXX....', '............']
const SHAPES = [{ name: 'heart', rows: HEART }, { name: 'house', rows: HOUSE }, { name: 'moon', rows: MOON }, { name: 'plus', rows: PLUS }]

let attempts = 3
let turn = 0

/** Four options in an order that changes with every challenge; id 0 is always the right one. */
function challenge() {
  const order = [0, 1, 2, 3].map(i => (i + turn) % 4)
  return { required: true, success: false, attempts_left: attempts, locked_ms: 0, options: order.map(i => ({ id: i, ...SHAPES[i] })) }
}

const handlers: DemoHandler[] = [
  {
    method: 'GET',
    url: onPage(SETUP, /^\/scan$/),
    body: () => ({
      aps: [
        { ssid: 'Home WiFi', rssi: -48, authmode: 3, channel: 6 },
        { ssid: 'Home WiFi 5G', rssi: -55, authmode: 3, channel: 36 },
        { ssid: 'Flat 4B', rssi: -63, authmode: 4, channel: 11 },
        { ssid: 'Guest WiFi', rssi: -71, authmode: 0, channel: 1 },
        { ssid: 'Home WiFi', rssi: -80, authmode: 3, channel: 6 },
        { ssid: 'DIRECT-printer', rssi: -86, authmode: 3, channel: 1 },
      ],
    }),
  },
  { method: 'GET', url: onPage(SETUP, /^\/pair$/), body: () => challenge() },
  {
    method: 'POST',
    url: onPage(SETUP, /^\/pair$/),
    body: (req: DemoRequest) => {
      if (req.data && req.data.id === 0) {
        attempts = 3
        return { required: true, success: true, pair_token: 'demo-pair-token' }
      }
      attempts = Math.max(0, attempts - 1)
      turn++
      if (attempts === 0) {
        attempts = 3
        return { required: true, success: false, attempts_left: 0, locked_ms: 15000, options: [] }
      }
      return challenge()
    },
  },
  {
    method: 'POST',
    url: onPage(SETUP, /^\/submit$/),
    body: (req: DemoRequest) => (req.data && req.data.pair_token ? { success: true } : { success: false, pair_required: true }),
  },
  { method: 'POST', url: onPage(SETUP, /^\/exit$/), body: () => ({ success: true }) },
]

export default handlers
