// Demo fixtures of the sign-in pages and Account (owner: web-auth). Synthetic: the picture code is
// drawn here, every submit succeeds, and the SM2 key below is a throwaway key made for the demo
// (its private half was never kept), so the pages encrypt exactly as they do against the server.
const DEMO_SM2_PUBLIC_KEY = '04f1b59f9c92f5d7495bdf76016a3fcf7f2053471d162f704c1b5cb58be004a2b625a090e436850c0bd3661e286b4475f7cdedeb84f25333a213144a4d9046ae52';

const CODES = ['7K4P', 'M3QX', 'R8TW', 'B5HN', 'X2LD'];

function captchaImage() {
  const code = CODES[Math.floor(Math.random() * CODES.length)];
  const letters = code.split('').map((ch, i) => {
    const y = 28 + ((i % 2) ? -3 : 3);
    const r = (i % 2) ? 8 : -6;
    return `<text x="${16 + i * 22}" y="${y}" transform="rotate(${r} ${16 + i * 22} ${y})">${ch}</text>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="40" viewBox="0 0 112 40">`
    + '<rect width="112" height="40" fill="#ffffff"/>'
    + '<path d="M4 30 C30 8, 60 36, 108 12" stroke="#9a9089" stroke-width="1.2" fill="none"/>'
    + `<g font-family="Verdana, sans-serif" font-size="20" font-weight="700" fill="#2b2420">${letters}</g></svg>`;
  return typeof Blob === 'undefined' ? svg : new Blob([svg], { type: 'image/svg+xml' });
}

export default [
  { method: 'GET', url: '/user/captcha', body: () => captchaImage() },
  {
    method: 'GET',
    url: '/user/pub-config',
    reply: {
      version: '0.9.7',
      name: 'TinyBot',
      year: String(new Date().getFullYear()),
      allowUserRegister: true,
      enableMobileRegister: true,
      sm2PublicKey: DEMO_SM2_PUBLIC_KEY,
      systemWebMenu: JSON.stringify({ features: { mcpAccessPoint: { enabled: true }, vad: { enabled: true }, asr: { enabled: true }, knowledgeBase: { enabled: true }, voiceClone: { enabled: true }, addressBook: { enabled: true } } }),
      beianIcpNum: 'null',
      beianGaNum: 'null',
      mobileAreaList: [
        { name: 'Bangladesh', key: '+880' },
        { name: 'India', key: '+91' },
        { name: 'United Kingdom', key: '+44' },
        { name: 'United States', key: '+1' },
        { name: 'Saudi Arabia', key: '+966' },
        { name: 'UAE', key: '+971' },
      ],
    },
  },
  { method: 'POST', url: '/user/login', reply: () => ({ token: 'demo-token', expire: 315360000 }) },
  { method: 'POST', url: '/user/register', reply: null },
  { method: 'POST', url: '/user/smsVerification', reply: null },
  { method: 'PUT', url: '/user/retrieve-password', reply: null },
  { method: 'PUT', url: '/user/change-password', reply: null },
];
