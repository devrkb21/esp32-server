import type { DemoHandler } from '../index'
import { onPage } from '../index'

// Fixtures of the account screens (owner: m-auth): public config, picture code, sign in, new
// account, SMS code, new password and the account shown on More. Synthetic sample data only.
// Every call another screen also makes is scoped to these screens with onPage().

const SCREENS = ['/pages/login/', '/pages/register/', '/pages/forgot-password/', '/pages/settings/']

function onAuthScreens(pattern: RegExp): DemoHandler['url'] {
  const parts = SCREENS.map(p => onPage(p, pattern))
  const r = new RegExp(pattern.source, pattern.flags)
  r.test = (path: string) => parts.some(p => p.test(path))
  return r
}

// A synthetic SM2 key pair made for the demo only (the private half is not kept anywhere), so the
// password encryption runs exactly as against a real server.
const DEMO_SM2_PUBLIC_KEY = '04863616a38d75bac3c694a63c205742927eb859f8ab936466bc16d67b16bf69ada6eb260aeb7ea5226b6f0cf6e40182836a0d084668f13de672495a42d43f31e1'

/** The demo's picture code: the server sends a PNG; the demo draws one so no request leaves the page. */
export function demoCaptchaSrc(seed: string) {
  const glyphs = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let h = 0
  for (const c of String(seed || 'demo')) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const code = Array.from({ length: 4 }, (_, i) => glyphs[(h >>> (i * 5)) % glyphs.length]).join('')
  const letters = code.split('').map((c, i) => `<text x="${14 + i * 24}" y="${27 + ((h >>> i) % 5)}" transform="rotate(${((h >>> (i * 3)) % 17) - 8} ${20 + i * 24} 20)">${c}</text>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 40"><rect width="112" height="40" fill="#F3F1EC"/><path d="M4 30 C30 8 70 36 108 12" stroke="#7A716A" fill="none"/><g font-family="sans-serif" font-size="22" font-weight="700" fill="#1B1714">${letters}</g></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const handlers: DemoHandler[] = [
  {
    method: 'GET',
    url: onAuthScreens(/\/user\/pub-config$/),
    reply: {
      name: 'TinyBot',
      version: '0.9.7',
      year: '',
      allowUserRegister: true,
      enableMobileRegister: true,
      mobileAreaList: [{ name: 'Bangladesh', key: '+880' }, { name: 'India', key: '+91' }, { name: 'United Kingdom', key: '+44' }],
      sm2PublicKey: DEMO_SM2_PUBLIC_KEY,
    },
  },
  { method: 'GET', url: '/user/captcha', reply: (req: any) => demoCaptchaSrc(req.query.uuid) },
  { method: 'POST', url: '/user/login', reply: { token: 'demo-token', expire: 315360000, clientHash: 'demo' } },
  { method: 'POST', url: '/user/smsVerification', reply: true },
  { method: 'POST', url: '/user/register', reply: true },
  { method: 'PUT', url: '/user/retrieve-password', reply: true },
  {
    method: 'GET',
    url: onAuthScreens(/\/user\/info$/),
    reply: { id: 1, username: 'demo', realName: 'Demo owner', email: '', mobile: '', status: 1, superAdmin: 0 },
  },
]

export default handlers
