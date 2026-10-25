// web-auth: the sign-in helpers and the Login page's behaviour (validation, SM2, token, redirect).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import smCrypto from 'sm-crypto';
import {
  areaOptions, defaultAreaCode, encryptPassword, faceMood, filledCount, LEGAL_READY, legalUrl, mentionsCaptcha, NoPublicKeyError, versionParts,
} from '../src/views/auth/authKit.js';
import { fullMobile, validateMobile } from '../src/utils/index.js';

const { sm2 } = smCrypto;
const keys = sm2.generateKeyPairHex();

describe('authKit', () => {
  it('encrypts captcha + password with SM2, 04-prefixed, as the server expects', () => {
    const c = encryptPassword(keys.publicKey, 'AB12', 'secret');
    expect(c.startsWith('04')).toBe(true);
    expect(sm2.doDecrypt(c.slice(2), keys.privateKey, 1)).toBe('AB12secret');
  });
  it('refuses to encrypt without a public key', () => {
    expect(() => encryptPassword('', 'a', 'b')).toThrow(NoPublicKeyError);
  });
  it('starts phone fields on Bangladesh when offered, else the first area', () => {
    expect(defaultAreaCode([{ key: '+91' }, { key: '+880' }])).toBe('+880');
    expect(defaultAreaCode([{ key: '+44' }])).toBe('+44');
    expect(defaultAreaCode(undefined)).toBe('+880');
    expect(areaOptions([{ key: '+91', name: 'India' }])).toEqual([{ value: '+91', label: '+91 India' }]);
  });
  it('falls back to Bangladesh alone when the server lists no areas', () => {
    expect(areaOptions(undefined)).toEqual([{ value: '+880', label: '+880 Bangladesh' }]);
  });
  it('links Nobix legal pages by router path', () => {
    expect(legalUrl('terms')).toBe('#/terms');
    expect(legalUrl('privacy')).toBe('#/privacy');
    expect(legalUrl('user-agreement')).toBe('#/terms');
    expect(legalUrl('privacy-policy')).toBe('#/privacy');
  });
  it('shows the legal note now that Nobix publishes its own terms', () => {
    expect(LEGAL_READY).toBe(true);
  });
  it('spots server messages about the picture code', () => {
    expect(mentionsCaptcha('Invalid captcha')).toBe(true);
    expect(mentionsCaptcha('图形验证码错误')).toBe(true);
    expect(mentionsCaptcha('Wrong password')).toBe(false);
    expect(mentionsCaptcha(undefined)).toBe(false);
  });
  it('wakes TinyBot as the form fills', () => {
    expect(faceMood({ filled: 0 })).toBe('sleepy');
    expect(faceMood({ filled: 2 })).toBe('awake');
    expect(faceMood({ filled: 2, outcome: 'ok' })).toBe('happy');
    expect(faceMood({ filled: 0, outcome: 'error' })).toBe('confused');
    expect(filledCount(['a', ' ', '', null, 'b'])).toBe(2);
  });
  it('reads the foot from the public config and never shows filing numbers', () => {
    expect(versionParts({ version: '1.2', name: 'X', year: 2026, beianIcpNum: 'ICP-1', beianGaNum: 'GA-2' }))
      .toEqual({ year: '2026', name: 'X', version: '1.2' });
    expect(versionParts({ version: 'null' })).toEqual({ year: '', name: '', version: '' });
  });
});

describe('Bangladeshi mobile numbers', () => {
  it('accepts a +880 mobile with or without the local 0, or typed in full', () => {
    expect(validateMobile('1712345678', '+880')).toBe(true);
    expect(validateMobile('01712345678', '+880')).toBe(true);
    expect(validateMobile('+8801712345678', '+880')).toBe(true);
    expect(validateMobile('017 1234 5678', '+880')).toBe(true);
    expect(validateMobile('০১৭১২৩৪৫৬৭৮', '+880')).toBe(true);
    expect(validateMobile('01312345678', '+880')).toBe(true);
    expect(validateMobile('01912345678', '+880')).toBe(true);
  });
  it('refuses short, long and non-mobile +880 numbers', () => {
    expect(validateMobile('017', '+880')).toBe(false);
    expect(validateMobile('0171234567', '+880')).toBe(false);
    expect(validateMobile('017123456789', '+880')).toBe(false);
    expect(validateMobile('01212345678', '+880')).toBe(false);
    expect(validateMobile('0221234567', '+880')).toBe(false);
    expect(validateMobile('13812345678', '+880')).toBe(false);
    expect(validateMobile('', '+880')).toBe(false);
  });
  it('only checks the length for other country codes', () => {
    expect(validateMobile('7911123456', '+44')).toBe(true);
    expect(validateMobile('1234', '+44')).toBe(false);
    expect(validateMobile('1234567890123456', '+91')).toBe(false);
  });
  it('sends +880 numbers without the local 0', () => {
    expect(fullMobile('+880', '01712345678')).toBe('+8801712345678');
    expect(fullMobile('+880', '1712345678')).toBe('+8801712345678');
    expect(fullMobile('+880', '+8801712345678')).toBe('+8801712345678');
    expect(fullMobile('+880', '017-1234-5678')).toBe('+8801712345678');
    expect(fullMobile('+44', '07911 123456')).toBe('+4407911123456');
  });
});

// ---- Login page --------------------------------------------------------------------------
const api = vi.hoisted(() => ({ pub: {}, calls: [], loginReply: null }));
vi.mock('@/apis/api', () => ({
  default: {
    user: {
      getCaptcha: (uuid, cb) => { api.calls.push(['captcha', uuid]); cb({ status: 200, data: new Blob(['gif'], { type: 'image/gif' }) }); },
      getPubConfig: (cb) => cb({ data: { code: 0, data: api.pub } }),
      login: (data, ok, fail) => { api.calls.push(['login', data]); api.loginReply(ok, fail); },
      getUserInfo: (cb) => cb({ data: { code: 0, data: { username: 'sample-owner', superAdmin: 0 } } }),
    },
  },
}));

async function mountLogin(start = '/login') {
  const { createRouter, createMemoryHistory } = await import('vue-router');
  const Login = (await import('../src/views/auth/Login.vue')).default;
  const store = (await import('../src/store/index.js')).default;
  const i18n = (await import('../src/i18n/index.js')).default;
  const kit = (await import('../src/kit/index.js')).default;
  const Blank = { template: '<div />' };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/login', component: Login }, { path: '/today', component: Blank }, { path: '/register', component: Blank },
      { path: '/retrieve-password', component: Blank }, { path: '/link', component: Blank }],
  });
  router.push(start);
  await router.isReady();
  i18n.global.locale = 'en';
  const w = mount(Login, { global: { plugins: [router, store, i18n, kit] }, attachTo: document.body });
  await flushPromises();
  return { w, router, store };
}

describe('Login', { timeout: 60000 }, () => {
  beforeEach(() => {

    localStorage.clear();
    api.calls = [];
    api.pub = { allowUserRegister: true, enableMobileRegister: false, sm2PublicKey: keys.publicKey, mobileAreaList: [{ key: '+880', name: 'Bangladesh' }] };
    api.loginReply = (ok) => ok({ data: { code: 0, data: { token: 't-1', expire: 3600 } } });
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:captcha');
    globalThis.URL.revokeObjectURL = vi.fn();
    if (!globalThis.requestAnimationFrame) globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
  });
  afterEach(() => { document.body.innerHTML = ''; });

  it('shows the field errors and sends nothing when the form is empty', async () => {
    const { w } = await mountLogin();
    await w.find('form').trigger('submit');
    const text = w.text();
    expect(text).toContain('Enter your username');
    expect(text).toContain('Enter your password');
    expect(text).toContain('Type the picture code');
    expect(api.calls.some(([k]) => k === 'login')).toBe(false);
  });

  it('shows the terms and privacy note linking Nobix pages', async () => {
    const { w } = await mountLogin();
    expect(w.find('.auth-form__note').exists()).toBe(true);
    expect(w.find('a[href="#/terms"]').exists()).toBe(true);
    expect(w.find('a[href="#/privacy"]').exists()).toBe(true);
    expect(w.find('a[href$=".html"]').exists()).toBe(false);
  });

  it('signs in with the SM2 password, keeps the token and user, and opens Today', async () => {
    const { w, router, store } = await mountLogin();
    await w.find('#login-username').setValue('sample-owner');
    await w.find('#login-password').setValue('pass-123');
    await w.find('#login-captcha').setValue('Q7');
    await w.find('form').trigger('submit');
    await flushPromises();
    const [, sent] = api.calls.find(([k]) => k === 'login');
    const lastCaptcha = api.calls.filter(([k]) => k === 'captcha').pop()[1];
    expect(sent.username).toBe('sample-owner');
    expect(sent.captchaId).toBe(lastCaptcha);
    expect(sm2.doDecrypt(sent.password.slice(2), keys.privateKey, 1)).toBe('Q7pass-123');
    expect(JSON.parse(localStorage.getItem('token')).token).toBe('t-1');
    expect(store.getters.getUserInfo.username).toBe('sample-owner');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/today');
  });

  it('goes back to the robot link page after signing in from it, never to another site', async () => {
    const { w, router } = await mountLogin('/login?redirect=' + encodeURIComponent('/link?code=123456'));
    expect(w.text()).toContain('Sign in and the robot is linked');
    await w.find('#login-username').setValue('sample-owner');
    await w.find('#login-password').setValue('pass-123');
    await w.find('#login-captcha').setValue('Q7');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/link?code=123456');
  });

  it('ignores a redirect that leaves the app', async () => {
    const { w, router } = await mountLogin('/login?redirect=' + encodeURIComponent('//evil.example/x'));
    await w.find('#login-username').setValue('sample-owner');
    await w.find('#login-password').setValue('pass-123');
    await w.find('#login-captcha').setValue('Q7');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/today');
  });

  it('shows the server message and fetches a new picture code after a refusal', async () => {
    api.loginReply = (ok, fail) => fail({ data: { code: 10001, msg: 'Wrong password' } });
    const { w } = await mountLogin();
    const before = api.calls.filter(([k]) => k === 'captcha').length;
    await w.find('#login-username').setValue('sample-owner');
    await w.find('#login-password').setValue('nope');
    await w.find('#login-captcha').setValue('Q7');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(w.text()).toContain('Wrong password');
    expect(api.calls.filter(([k]) => k === 'captcha').length).toBe(before + 1);
  });

  it('signs in by mobile when the server allows it, with the area code in front', async () => {
    api.pub.enableMobileRegister = true;
    const { w } = await mountLogin();
    expect(w.find('#login-mobile').exists()).toBe(true);
    expect(w.text()).toContain('Forgot your password?');
    await w.find('#login-mobile').setValue('1712345678');
    await w.find('#login-password').setValue('pass-123');
    await w.find('#login-captcha').setValue('Q7');
    await w.find('form').trigger('submit');
    await flushPromises();
    const [, sent] = api.calls.find(([k]) => k === 'login');
    expect(sent.username).toBe('+8801712345678');
  });

  it('accepts the local 01XXXXXXXXX form and sends it as +880 without the 0', async () => {
    api.pub.enableMobileRegister = true;
    const { w } = await mountLogin();
    await w.find('#login-mobile').setValue('01712345678');
    await w.find('#login-password').setValue('pass-123');
    await w.find('#login-captcha').setValue('Q7');
    await w.find('form').trigger('submit');
    await flushPromises();
    const [, sent] = api.calls.find(([k]) => k === 'login');
    expect(sent.username).toBe('+8801712345678');
  });

  it('refuses a number that is not a Bangladeshi mobile', async () => {
    api.pub.enableMobileRegister = true;
    const { w } = await mountLogin();
    await w.find('#login-mobile').setValue('13812345678');
    await w.find('#login-password').setValue('pass-123');
    await w.find('#login-captcha').setValue('Q7');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(w.text()).toContain('Enter a valid mobile number');
    expect(api.calls.some(([k]) => k === 'login')).toBe(false);
  });
});
