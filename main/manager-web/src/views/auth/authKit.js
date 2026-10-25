// Pure helpers shared by the sign-in pages (Login, Register, RetrievePassword) and Account.
// No Vue, no API: everything here is unit tested in tests/auth.test.mjs.
import smCrypto from 'sm-crypto';

const { sm2 } = smCrypto;

export class NoPublicKeyError extends Error {}

// The server expects SM2(captcha + password) with the public key from /user/pub-config, as hex
// with the "04" prefix of an uncompressed key (cipher mode 1), exactly as the old pages sent it.
export function encryptPassword(publicKey, captcha, password) {
  if (!publicKey) throw new NoPublicKeyError('no public key');
  const plain = `${captcha || ''}${password || ''}`;
  if (!plain) throw new Error('nothing to encrypt');
  return `04${sm2.doEncrypt(plain, publicKey, 1)}`;
}

// The area code a phone field starts on: Bangladesh when the server offers it, else the first.
export function defaultAreaCode(list) {
  const items = Array.isArray(list) ? list : [];
  if (items.some((i) => i && i.key === '+880')) return '+880';
  return (items[0] && items[0].key) || '+880';
}

// Options for the area select, code first so a narrow select still shows it.
export function areaOptions(list) {
  const items = Array.isArray(list) && list.length ? list : [{ key: '+880', name: 'Bangladesh' }];
  return items.map((i) => ({ value: i.key, label: i.name ? `${i.key} ${i.name}` : i.key }));
}

// The terms and privacy note stays hidden until Nobix publishes its own Bangla and English
// terms and privacy pages: the upstream pages (another service, another country) must never be
// shown to TinyBot owners. Flip to true once public/<page>-bn.html and <page>-en.html exist.
export const LEGAL_READY = false;

// Where the agreement and privacy pages will live in public/: "-bn" for Bangla, "-en" otherwise.
export function legalUrl(page, lang, base = '/') {
  const root = base.endsWith('/') ? base : `${base}/`;
  const bn = String(lang || '') === 'bn';
  return `${root}${page}-${bn ? 'bn' : 'en'}.html`;
}

// A server message about the picture code means the picture must be fetched again.
export function mentionsCaptcha(msg) {
  if (!msg) return false;
  const s = String(msg);
  return s.indexOf('图形验证码') > -1 || s.toLowerCase().indexOf('captcha') > -1;
}

// TinyBot wakes up as the form is filled: asleep while empty, waking once anything is typed,
// awake after a success, puzzled after an error (until the next keystroke).
export function faceMood({ filled = 0, outcome = '' } = {}) {
  if (outcome === 'ok') return 'happy';
  if (outcome === 'error') return 'confused';
  return filled > 0 ? 'awake' : 'sleepy';
}

// How many of the given values hold something.
export function filledCount(values) {
  return values.filter((v) => String(v ?? '').trim() !== '').length;
}

// The version line of the foot: year, name and version from the public config, never invented.
export function versionParts(cfg) {
  const c = cfg || {};
  const real = (v) => v !== undefined && v !== null && v !== '' && v !== 'null';
  return {
    year: real(c.year) ? String(c.year) : '',
    name: real(c.name) ? String(c.name) : '',
    version: real(c.version) ? String(c.version) : '',
    icp: real(c.beianIcpNum) ? String(c.beianIcpNum) : '',
    ga: real(c.beianGaNum) ? String(c.beianGaNum) : '',
  };
}
