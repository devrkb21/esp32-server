// Linking a robot by its code or QR: the code parser, the sign-in redirect guard, the
// auto-link decision, and the link page's behaviour (guest, one character, several characters,
// expired code).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import {
  asciiDigits, codeFromText, linkCodeOf, linkErrorKind, linkPath, linkPlan, redirectQuery, safeRedirect,
} from '@/utils/linkCode';
import { cleanCode as robotsCleanCode } from '@/views/robots/robotsModel';
import { cleanCode as devicesCleanCode } from '@/views/devices/devicesModel';

describe('the link code', () => {
  it('takes digits, with spaces or dashes, at most six', () => {
    expect(codeFromText('123456')).toBe('123456');
    expect(codeFromText(' 123 456 ')).toBe('123456');
    expect(codeFromText('123-456')).toBe('123456');
    expect(codeFromText('12')).toBe('12');
    expect(codeFromText('1234567')).toBe('123456');
    expect(codeFromText('')).toBe('');
    expect(codeFromText(null)).toBe('');
  });
  it('reads Bangla (and full-width) digits', () => {
    expect(asciiDigits('০১২৩৪৫৬৭৮৯')).toBe('0123456789');
    expect(codeFromText('১২৩ ৪৫৬')).toBe('123456');
    expect(codeFromText('１２３４５６')).toBe('123456');
  });
  it('takes the code out of the robot\'s pasted link', () => {
    expect(codeFromText('https://esp.czbd.app/#/link?code=123456')).toBe('123456');
    expect(codeFromText('http://192.168.0.123:8001/#/link?code=654321&x=1')).toBe('654321');
    expect(codeFromText('  https://esp.czbd.app/#/link?code=১২৩৪৫৬ ')).toBe('123456');
    expect(codeFromText('/link?code=123456')).toBe('123456');
    expect(codeFromText('#/link?code=123456')).toBe('123456');
  });
  it('gives nothing for a link without a code (no digits from the host)', () => {
    expect(codeFromText('http://192.168.0.123:8001/#/link')).toBe('');
    expect(codeFromText('www.example.com/2024')).toBe('');
  });
  it('knows a complete code', () => {
    expect(linkCodeOf('123 456')).toBe('123456');
    expect(linkCodeOf('12345')).toBe('');
    expect(linkCodeOf('https://esp.czbd.app/#/link?code=123')).toBe('');
    expect(linkPath('123456')).toBe('/link?code=123456');
    expect(linkPath('')).toBe('/link');
  });
  it('is what both add-robot sheets use', () => {
    expect(robotsCleanCode('https://esp.czbd.app/#/link?code=123456')).toBe('123456');
    expect(devicesCleanCode('https://esp.czbd.app/#/link?code=123456')).toBe('123456');
    expect(robotsCleanCode('12a3 45-67')).toBe('123456');
  });
});

describe('the sign-in redirect', () => {
  it('keeps paths inside this app', () => {
    expect(safeRedirect('/link?code=123456')).toBe('/link?code=123456');
    expect(safeRedirect('#/today')).toBe('/today');
    expect(safeRedirect(['/robots', '/x'])).toBe('/robots');
  });
  it('refuses other sites, odd schemes and the sign-in pages', () => {
    for (const bad of ['//evil.example', 'https://evil.example', 'evil.example', '/\\evil.example', 'javascript:alert(1)',
      '/javascript:alert(1)', '/login', '/login?redirect=/x', '/register', '/retrieve-password', '/a b', '', null, 42]) {
      expect(safeRedirect(bad, 'FALLBACK')).toBe('FALLBACK');
    }
    expect(safeRedirect('/' + 'x'.repeat(600), '')).toBe('');
  });
  it('carries only a safe redirect between the sign-in pages', () => {
    expect(redirectQuery('/link?code=123456')).toEqual({ redirect: '/link?code=123456' });
    expect(redirectQuery('https://evil.example')).toEqual({});
    expect(redirectQuery(undefined)).toEqual({});
  });
});

describe('linking automatically', () => {
  it('links at once with no character or one, asks with several', () => {
    expect(linkPlan(0)).toBe('auto');
    expect(linkPlan(1)).toBe('auto');
    expect(linkPlan(2)).toBe('choose');
    expect(linkPlan(undefined)).toBe('auto');
  });
  it('names what went wrong from the server code', () => {
    expect(linkErrorKind(10212)).toBe('format');
    expect(linkErrorKind(10213)).toBe('expired');
    expect(linkErrorKind(10062)).toBe('expired');
    expect(linkErrorKind(10063)).toBe('taken');
    expect(linkErrorKind(10214)).toBe('choose');
    expect(linkErrorKind(500)).toBe('failed');
  });
});

// ---- the link page --------------------------------------------------------------------------
const api = vi.hoisted(() => ({
  agent: { getAgentList: vi.fn() },
  device: { getLinkInfo: vi.fn(), linkDevice: vi.fn(), getAgentBindDevices: vi.fn() },
  product: { getProductList: vi.fn() },
  user: { getPubConfig: (cb) => cb({ data: { code: 0, data: {} } }) },
}));
vi.mock('@/apis/api', () => ({ default: api, getServiceUrl: () => '' }));

const { default: i18n } = await import('@/i18n');
const { default: kit } = await import('@/kit');
const { default: store } = await import('@/store');
const { robot } = await import('@/shell/robot');
const { default: LinkRobot } = await import('@/views/link/LinkRobot.vue');

const INFO = { code: '123456', board: 'tinybot', productKey: 'tinybot', productNameEn: 'TinyBot', productNameBn: 'টাইনিবট', macTail: '00A7', valid: true };
const ok = (data) => ({ data: { code: 0, data } });
const err = (code) => ({ status: 200, data: { code, msg: 'server text' } });

function wire({ agents = [{ id: 'a1', agentName: 'TinyBot', deviceCount: 1 }], info = INFO, infoErr = 0, linkErr = 0 } = {}) {
  api.agent.getAgentList.mockImplementation((cb) => cb(ok(agents)));
  api.device.getLinkInfo.mockImplementation((code, cb, fail) => (infoErr ? fail(err(infoErr)) : cb(ok({ ...info, code }))));
  api.device.linkDevice.mockImplementation((body, cb, fail) => (linkErr ? fail(err(linkErr))
    : cb(ok({ deviceId: 'mac-1', agentId: body.agentId || 'a1', agentCreated: agents.length === 0 }))));
  api.device.getAgentBindDevices.mockImplementation((id, cb) => cb(ok([{ id: 'mac-1', macAddress: 'aa:bb:cc:dd:00:a7', board: 'tinybot' }])));
  api.product.getProductList.mockImplementation((cb) => cb(ok([])));
}

async function mountPage(path, { signedIn = true } = {}) {
  if (signedIn) localStorage.setItem('token', JSON.stringify({ token: 't', expire: 3600 }));
  const Blank = { template: '<div />' };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/link', component: LinkRobot }, { path: '/:p(.*)*', component: Blank }],
  });
  router.push(path);
  await router.isReady();
  const w = mount({ template: '<router-view />' }, { attachTo: document.body, global: { plugins: [router, store, i18n, kit] } });
  await flushPromises();
  return { w, router };
}

describe('the link page', () => {
  beforeEach(() => {
    i18n.global.locale = 'en';
    localStorage.clear();
    Object.assign(robot, { deviceId: '', agentId: '', name: '', list: [], loaded: false, loading: false });
    vi.clearAllMocks();
  });
  afterEach(() => { document.body.innerHTML = ''; });

  it('asks a signed-out owner to sign in and come back with the code', async () => {
    wire();
    const { w } = await mountPage('/link?code=123456', { signedIn: false });
    expect(api.device.getLinkInfo).not.toHaveBeenCalled();
    expect(w.text()).toContain('Sign in to link it');
    const signIn = w.findAll('a').find((a) => a.text().includes('Sign in to link it'));
    expect(decodeURIComponent(signIn.attributes('href'))).toContain('/login?redirect=/link?code=123456');
    expect(w.findAll('.lk-code__cell').map((c) => c.text()).join('')).toBe('123456');
  });

  it('links at once when the owner has one character, then opens Today with the robot chosen', async () => {
    wire();
    const { router } = await mountPage('/link?code=123456');
    await flushPromises();
    expect(api.device.getLinkInfo).toHaveBeenCalledWith('123456', expect.any(Function), expect.any(Function));
    expect(api.device.linkDevice).toHaveBeenCalledWith({ code: '123456' }, expect.any(Function), expect.any(Function));
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/today');
    expect(robot.deviceId).toBe('mac-1');
    expect(robot.agentId).toBe('a1');
  });

  it('links at once with no character (the server makes the first one)', async () => {
    wire({ agents: [] });
    await mountPage('/link?code=123456');
    await flushPromises();
    expect(api.device.linkDevice).toHaveBeenCalledWith({ code: '123456' }, expect.any(Function), expect.any(Function));
  });

  it('lets the owner pick a character when there are several', async () => {
    wire({ agents: [{ id: 'a1', agentName: 'TinyBot', deviceCount: 1 }, { id: 'a2', agentName: 'Study buddy', deviceCount: 0 }] });
    const { w, router } = await mountPage('/link?code=123456');
    expect(api.device.linkDevice).not.toHaveBeenCalled();
    expect(w.text()).toContain('Which character should it be?');
    expect(w.text()).toContain('TinyBot');
    await w.findAll('.lk-agent__radio')[1].setValue(true);
    await w.find('form.lk-step').trigger('submit');
    await flushPromises();
    expect(api.device.linkDevice).toHaveBeenCalledWith({ code: '123456', agentId: 'a2' }, expect.any(Function), expect.any(Function));
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/today');
  });

  it('explains an expired code and lets the owner type a new one', async () => {
    wire({ infoErr: 10213 });
    const { w } = await mountPage('/link?code=111111');
    expect(w.text()).toContain('This code no longer works');
    expect(api.device.linkDevice).not.toHaveBeenCalled();
    await w.findAll('button').find((b) => b.text().includes('Type the code')).trigger('click');
    expect(w.findAll('.lk-code__cell').map((c) => c.text()).join('')).toBe('');
    wire();
    const input = w.find('#lk-code');
    await input.setValue('https://esp.czbd.app/#/link?code=123456');
    await flushPromises();
    expect(api.device.getLinkInfo).toHaveBeenLastCalledWith('123456', expect.any(Function), expect.any(Function));
  });

  it('says so when the robot is already linked', async () => {
    wire({ infoErr: 10063 });
    const { w } = await mountPage('/link?code=222222');
    expect(w.text()).toContain('already linked');
    expect(w.findAll('a').some((a) => a.text().includes('See your robots'))).toBe(true);
  });

  it('starts with an empty code when the link has none', async () => {
    wire();
    const { w } = await mountPage('/link');
    expect(w.text()).toContain('Link a robot with its code');
    expect(api.device.getLinkInfo).not.toHaveBeenCalled();
  });
});
