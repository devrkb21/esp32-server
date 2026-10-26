import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';

vi.mock('@/apis/module/home', () => ({
  default: {
    getIntegration: vi.fn(), saveIntegration: vi.fn(), testIntegration: vi.fn(), importHa: vi.fn(), listDevices: vi.fn(),
    addDevice: vi.fn(), updateDevice: vi.fn(), deleteDevice: vi.fn(), act: vi.fn(),
    getContacts: vi.fn(), requestContact: vi.fn(), acceptContact: vi.fn(), declineContact: vi.fn(), renameContact: vi.fn(),
    removeContact: vi.fn(), contactTargets: vi.fn(), sendToRobot: vi.fn(),
  },
}));

import homeApi from '@/apis/module/home';
import kit from '@/kit';
import homeStrings from '@/i18n/pages/home.js';
import rmsgStrings from '@/i18n/pages/robotmsg.js';
import shell from '@/i18n/pages/shell.js';
import en from '@/i18n/en.js';
import { NAV } from '@/shell/nav.js';
import { routes } from '@/router/index.js';
import SmartHome from '@/views/home/SmartHome.vue';
import RobotMessages from '@/views/home/RobotMessages.vue';
import {
  aliasesFromText, deviceBody, deviceProblems, editState, integrationBody, integrationProblems, needsSecretAgain, readIntegration,
  resultKey, sortDevices, testActions,
} from '@/views/home/homeModel.js';
import { groupContacts, requestErrorKey, requestProblems, sendProblems, sendResultKey, targetOptions } from '@/views/home/robotMessagesModel.js';

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.real-token';
const VIEW = {
  ha: { baseUrl: 'http://192.168.0.50:8123', tokenSaved: true },
  mqtt: { host: '192.168.0.60', port: 1883, username: 'home', passwordSaved: false, tls: false },
  deviceCount: 2,
};
const DEVICES = [
  { id: '1', source: 'ha', entityId: 'light.living_room', domain: 'light', name: 'Living Room Light', aliases: ['বসার ঘরের বাতি'], enabled: true },
  { id: '2', source: 'mqtt', entityId: '', domain: 'cover', name: 'Curtain', aliases: [], topic: 'home/curtain/set', payloadOn: 'OPEN', payloadOff: 'CLOSE', enabled: false },
];

function i18n() {
  return createI18n({ legacy: true, locale: 'en', fallbackLocale: 'en', messages: { en: { ...en, ...shell.en, ...homeStrings.en, ...rmsgStrings.en } } });
}
function mountIt(Comp, props) {
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const confirm = vi.fn(() => Promise.resolve('confirm'));
  const w = mount(Comp, {
    props, attachTo: document.body,
    global: { plugins: [i18n(), kit], mocks: { $message: message, $confirm: confirm }, stubs: { teleport: true, RouterLink: true } },
  });
  return { w, message };
}

beforeEach(() => {
  vi.clearAllMocks();
  homeApi.getIntegration.mockResolvedValue(JSON.parse(JSON.stringify(VIEW)));
  homeApi.listDevices.mockResolvedValue(JSON.parse(JSON.stringify(DEVICES)));
  homeApi.saveIntegration.mockImplementation(async (b) => ({ ...VIEW, ha: { baseUrl: b.haBaseUrl || VIEW.ha.baseUrl, tokenSaved: true } }));
  homeApi.testIntegration.mockResolvedValue({ ok: true, code: 'ok', version: '2026.10.1' });
  homeApi.act.mockResolvedValue({ ok: true, code: 'ok' });
});

describe('strings', () => {
  for (const [name, pages] of [['home', homeStrings], ['robotmsg', rmsgStrings]]) {
    it(`${name}: every key in Bangla and English, Bangla first, no em dash`, () => {
      expect(Object.keys(pages)[0]).toBe('bn');
      expect(Object.keys(pages.bn).sort()).toEqual(Object.keys(pages.en).sort());
      for (const v of [...Object.values(pages.bn), ...Object.values(pages.en)]) {
        expect(v).not.toMatch(/—/);
        expect(v.trim()).not.toBe('');
      }
    });
  }
  it('smart home is in the nav and has a route', () => {
    expect(NAV.flatMap((g) => g.items).some((i) => i.to === '/smart-home' && i.label === 'nav.smartHome')).toBe(true);
    expect(routes.some((r) => r.path === '/smart-home')).toBe(true);
    expect(homeStrings.bn['nav.smartHome']).toBe('স্মার্ট হোম');
  });
});

describe('homeModel', () => {
  it('never puts a secret on the form and sends one only when typed', () => {
    const s = readIntegration(VIEW);
    expect(s.form.haToken).toBe('');
    expect(s.saved).toEqual({ token: true, password: false });
    expect(integrationBody(s.form, 'ha')).toEqual({ haBaseUrl: 'http://192.168.0.50:8123' });
    expect(integrationBody({ ...s.form, haToken: ` ${TOKEN} ` }, 'ha')).toEqual({ haBaseUrl: 'http://192.168.0.50:8123', haToken: TOKEN });
    expect(integrationBody(s.form, 'mqtt')).toEqual({ mqttHost: '192.168.0.60', mqttPort: 1883, mqttUsername: 'home', mqttTls: false });
  });
  it('checks the fields', () => {
    expect(integrationProblems({ haBaseUrl: 'ha.local', haToken: '' }, 'ha', { token: false }))
      .toEqual({ haBaseUrl: 'home.err.url', haToken: 'home.err.tokenRequired' });
    expect(integrationProblems({ haBaseUrl: 'http://ha.local:8123', haToken: '' }, 'ha', { token: true })).toEqual({});
    expect(integrationProblems({ mqttHost: 'bad host', mqttPort: '99999' }, 'mqtt')).toEqual({ mqttHost: 'home.err.host', mqttPort: 'home.err.port' });
    expect(needsSecretAgain({ data: { msg: 'token_required: enter the access token again' } })).toBe('haToken');
  });
  it('reads aliases from Bangla text', () => {
    expect(aliasesFromText('বসার ঘরের বাতি, living room ,\nLIVING ROOM।ড্রয়িং রুমের লাইট')).toEqual(['বসার ঘরের বাতি', 'living room', 'ড্রয়িং রুমের লাইট']);
    const e = editState(DEVICES[1]);
    expect(deviceProblems({ ...e, topic: 'home/#' }, true)).toEqual({ topic: 'home.err.topicWildcard' });
    expect(deviceBody({ ...e, aliasText: 'পর্দা' }, true)).toEqual({
      name: 'Curtain', aliases: ['পর্দা'], enabled: false, domain: 'cover', topic: 'home/curtain/set', payloadOn: 'OPEN', payloadOff: 'CLOSE',
    });
  });
  it('test buttons, result keys and order', () => {
    expect(testActions('cover').map((a) => a.action)).toEqual(['open', 'close']);
    expect(testActions('fan').map((a) => a.action)).toEqual(['on', 'off']);
    expect(resultKey('unreachable')).toBe('home.result.unreachable');
    expect(resultKey('weird')).toBe('home.result.error');
    expect(sortDevices([{ id: 'a', enabled: false }, { id: 'b', enabled: true }]).map((d) => d.id)).toEqual(['b', 'a']);
  });
});

describe('SmartHome page', () => {
  it('shows saved, never the token, and lists devices with aliases', async () => {
    const { w } = mountIt(SmartHome);
    await flushPromises();
    expect(w.html()).not.toContain(TOKEN);
    expect(w.find('[data-saved="token"]').exists()).toBe(true);
    expect(w.find('[data-saved="password"]').exists()).toBe(false);
    const rows = w.findAll('.home-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('বসার ঘরের বাতি');
    expect(rows[1].text()).toContain('Off for voice');
  });

  it('saves a new token once and clears it from the form', async () => {
    const { w, message } = mountIt(SmartHome);
    await flushPromises();
    await w.find('#home-ha-token').setValue(TOKEN);
    await w.find('form[data-part="ha"]').trigger('submit');
    await flushPromises();
    expect(homeApi.saveIntegration).toHaveBeenCalledWith({ haBaseUrl: 'http://192.168.0.50:8123', haToken: TOKEN });
    expect(w.find('#home-ha-token').element.value).toBe('');
    expect(message.success).toHaveBeenCalled();
  });

  it('tests the connection and says the result', async () => {
    const { w } = mountIt(SmartHome);
    await flushPromises();
    const btn = w.findAll('form[data-part="ha"] button').find((b) => b.text() === 'Test connection');
    await btn.trigger('click');
    await flushPromises();
    expect(homeApi.testIntegration).toHaveBeenCalledWith('ha');
    expect(w.find('[data-test="ha-result"]').text()).toBe('Connected, Home Assistant 2026.10.1');
    homeApi.testIntegration.mockResolvedValue({ ok: false, code: 'unreachable' });
    await btn.trigger('click');
    await flushPromises();
    expect(w.find('[data-test="ha-result"]').text()).toContain('did not answer');
  });

  it('switches a device from its test buttons', async () => {
    const { w, message } = mountIt(SmartHome);
    await flushPromises();
    await w.find('[data-device="1"] [data-act="off"]').trigger('click');
    await flushPromises();
    expect(homeApi.act).toHaveBeenCalledWith('1', 'off');
    expect(message.success).toHaveBeenCalledWith('Living Room Light: done');
    homeApi.act.mockResolvedValue({ ok: false, code: 'unreachable' });
    await w.find('[data-device="2"] [data-act="open"]').trigger('click');
    await flushPromises();
    expect(message.error.mock.calls[0][0]).toContain('Curtain:');
  });
});

describe('robot messages', () => {
  const contacts = [
    { id: '1', status: 'pending', direction: 'in', otherOwner: 'Nanu', otherDeviceName: 'Nanu bot', theirName: 'Khoka', name: '', aliases: [] },
    { id: '2', status: 'accepted', direction: 'out', name: 'Baba robot', aliases: ['Baba'], otherOwner: 'Abbu', myDeviceName: 'Desk' },
    { id: '3', status: 'pending', direction: 'out', name: 'Khala', aliases: [], otherOwner: 'Khala', myDeviceName: 'Desk' },
    { id: '4', status: 'declined', direction: 'out', name: 'Mama', aliases: [] },
  ];

  it('model', () => {
    const g = groupContacts(contacts);
    expect([g.incoming.length, g.accepted.length, g.outgoing.length, g.declined.length]).toEqual([1, 1, 1, 1]);
    expect(requestProblems({ deviceId: '', username: ' ', name: '', aliasText: '' }))
      .toEqual({ deviceId: 'rmsg.err.robot', username: 'rmsg.err.username', name: 'rmsg.err.nameRequired' });
    expect(sendProblems({ target: 'c:2', text: 'x'.repeat(301) })).toEqual({ text: 'rmsg.err.textLong' });
    expect(sendResultKey({ ok: true, later: true })).toBe('rmsg.send.later');
    expect(sendResultKey({ ok: false, code: 'weird' })).toBe('rmsg.send.err.unreachable');
    expect(requestErrorKey({ data: { msg: 'user_not_found: no account' } })).toBe('rmsg.err.user_not_found');
    expect(targetOptions([{ key: 'c:2', name: 'B', kind: 'contact' }, { key: 'd:x', name: 'Z', kind: 'own' }]).map((o) => o.value)).toEqual(['d:x', 'c:2']);
  });

  it('sends a message to another robot', async () => {
    homeApi.getContacts.mockResolvedValue({ robots: [{ deviceId: 'dev-1', name: 'Desk' }], contacts });
    homeApi.contactTargets.mockResolvedValue([{ key: 'c:2', name: 'Baba robot', aliases: [], kind: 'contact' }]);
    homeApi.sendToRobot.mockResolvedValue({ ok: true, code: 'ok', to: 'Baba robot', later: true });
    const { w, message } = mountIt(RobotMessages, { deviceId: 'dev-1' });
    await flushPromises();
    expect(homeApi.contactTargets).toHaveBeenCalledWith('dev-1');
    expect(w.findAll('.rmsg-row')).toHaveLength(3); // the incoming request, the contact, the asked one
    await w.find('#rmsg-text').setValue('  I am coming ');
    await w.find('.rmsg-compose').trigger('submit');
    await flushPromises();
    expect(homeApi.sendToRobot).toHaveBeenCalledWith({ fromDeviceId: 'dev-1', target: 'c:2', text: 'I am coming' });
    expect(message.success).toHaveBeenCalledWith('Baba robot is in night mode and will speak it in the morning');
  });

  it('says when there is nobody to message yet', async () => {
    homeApi.getContacts.mockResolvedValue({ robots: [], contacts: [] });
    homeApi.contactTargets.mockResolvedValue([]);
    const { w } = mountIt(RobotMessages, { deviceId: 'dev-1' });
    await flushPromises();
    expect(w.find('[data-test="no-targets"]').exists()).toBe(true);
  });
});
