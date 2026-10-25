import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterLinkStub, flushPromises, mount } from '@vue/test-utils';
import * as utils from '../src/utils/tinybotAssets.mjs';

// Ported from tests/legacy/themeGeneratorView.test.mjs: the same checks, run against the new page
// mounted with the kit and i18n, the API stubbed.
const api = vi.hoisted(() => ({
  device: { getAgentBindDevices: vi.fn(), callDeviceToolOnce: vi.fn() },
  ota: { uploadAssetsBin: vi.fn() },
  agent: { getAgentList: vi.fn() },
}));
vi.mock('@/apis/api', () => ({ default: api }));

const { default: kit } = await import('../src/kit/index.js');
const { default: i18n } = await import('../src/i18n/index.js');
const { default: ThemeGenerator } = await import('../src/views/theme/ThemeGenerator.vue');
const source = fs.readFileSync(path.resolve(process.cwd(), 'src/views/theme/ThemeGenerator.vue'), 'utf8');
const STATIC = path.resolve(process.cwd(), 'public/generator/static') + '/';

let calls;
function mountPage({ query = { deviceId: 'dev1', agentId: 'agent1' }, tools = {} } = {}) {
  calls = [];
  api.device.callDeviceToolOnce.mockImplementation((deviceId, name, args) => {
    calls.push([name, args]);
    const handler = tools[name];
    if (handler) return handler(args);
    return Promise.resolve({ code: 0, data: true });
  });
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const w = mount(ThemeGenerator, {
    global: {
      plugins: [kit, i18n],
      mocks: { $route: { query }, $message: message },
      stubs: { RouterLink: RouterLinkStub },
    },
    attachTo: document.body,
  });
  return { w, vm: w.vm, message };
}

function stubStaticFetch() {
  globalThis.fetch = vi.fn(async (url) => {
    const rel = String(url).split('generator/static/')[1];
    const data = fs.readFileSync(STATIC + rel);
    return { ok: true, status: 200, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) };
  });
}

// jsdom's Blob has no arrayBuffer()
function readBlob(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

beforeEach(() => {
  i18n.global.locale = 'en';
  // jsdom has no 2D canvas: the preview simply does not draw
  HTMLCanvasElement.prototype.getContext = () => null;
  api.device.getAgentBindDevices.mockReset();
  api.device.getAgentBindDevices.mockImplementation((agentId, cb) => cb({ data: { code: 0, data: [
    { id: 'dev1', alias: 'Desk bot', macAddress: 'aa:bb:cc:00:00:01', appVersion: '2.5.5', board: 'tinybot' },
  ] } }));
  api.agent.getAgentList.mockReset();
  api.agent.getAgentList.mockImplementation((cb) => cb({ data: { code: 0, data: [] } }));
  api.ota.uploadAssetsBin.mockReset();
  api.ota.uploadAssetsBin.mockImplementation(() => Promise.resolve('http://server/xiaozhi/otaMag/download/abc'));
});

afterEach(() => {
  vi.useRealTimers();
  delete globalThis.fetch;
  document.body.innerHTML = '';
});

describe('Wake word & theme page', () => {
  it('renders its sections and the wake word list', async () => {
    const { w } = mountPage();
    await flushPromises();
    expect(w.find('h1').text()).toBe('Wake word & theme');
    expect(w.findAll('h2').map((h) => h.text())).toEqual(expect.arrayContaining(['Robot', 'Wake word', 'Preview', 'Summary']));
    expect(w.findAll('input[name="theme-wake"]').length).toBeGreaterThan(10);
    expect(w.find('input[name="theme-wake"]:checked').element.value).toBe('wn9_hiesp');
    expect(w.text()).toContain('Desk bot');
    w.unmount();
  });

  it('filters phrases by language and search, with a filtered-empty state', async () => {
    const { w, vm } = mountPage();
    await flushPromises();
    vm.wakeLang = 'zh';
    await flushPromises();
    expect(w.text()).toContain('Ni hao Xiaozhi');
    expect(w.text()).not.toContain('Jarvis');
    vm.wakeQuery = 'jarv';
    await flushPromises();
    expect(w.findAll('input[name="theme-wake"]').map((i) => i.element.value)).toEqual(['wn9_jarvis_tts']);
    vm.wakeQuery = 'nothing like this';
    await flushPromises();
    expect(w.text()).toContain('No phrase matches "nothing like this"');
    w.unmount();
  });

  it('choosing a phrase updates the estimate', async () => {
    const { w, vm } = mountPage();
    await flushPromises();
    vm.wakeQuery = 'alexa';
    await flushPromises();
    await w.find('input[value="wn9_alexa"]').setValue(true);
    expect(vm.wakeWord).toBe('wn9_alexa');
    expect(w.text()).toContain('Wake word "Alexa"');
    w.unmount();
  });
});

describe('ThemeGenerator chat font', () => {
  // The chat font moved to the TinyBot look editor (settings.look.chat_font, built into the firmware)
  it('no longer offers a text font section', () => {
    expect(source).not.toMatch(/tg-font|themeGen\.font|name="tg-font"/);
    expect(source).not.toMatch(/TEXT_FONTS|BUILTIN_FONT|findFont|fonts\//);
    const { vm, w } = mountPage();
    expect(vm.font).toBeUndefined();
    expect(vm.fonts).toBeUndefined();
    w.unmount();
  });

  it('locales drop the old font strings', () => {
    for (const loc of ['en', 'bn']) {
      const text = fs.readFileSync(path.resolve(process.cwd(), `src/i18n/${loc}.js`), 'utf8');
      expect(text).not.toMatch(/'themeGen\.font\.|'themeGen\.summary\.font'/);
    }
  });
});

describe('ThemeGenerator state', () => {
  it('defaults to Hi ESP, sized under 1 MB', () => {
    const { vm, w } = mountPage();
    expect(vm.wakeWord).toBe('wn9_hiesp');
    expect(vm.estimate.parts.map((p) => p.name)).toEqual(['srmodels.bin', 'index.json']);
    expect(vm.tooLarge).toBe(false);
    w.unmount();
  });

  it('reads chip and screen from the robot tools', async () => {
    const { vm, w } = mountPage({
      tools: {
        'self.get_system_info': () => Promise.resolve({ code: 0, data: { chip_model_name: 'esp32s3', flash_size: 4194304, partition_table: [{ label: 'assets', size: 1048576 }] } }),
        'self.screen.get_info': () => Promise.resolve({ code: 0, data: '{"width":128,"height":64,"monochrome":true}' }),
      },
    });
    await vm.loadRobot();
    expect(vm.robotState).toBe('online');
    expect(vm.chipText).toContain('ESP32-S3');
    expect(vm.chipText).toContain('4 MB');
    expect(vm.screen).toEqual({ width: 128, height: 64, monochrome: true });
    expect(vm.tinybot).toBe(true);
    expect(vm.limit).toBe(1048576);
    await flushPromises();
    expect(w.text()).toContain('128×64 monochrome');
    expect(w.text()).toContain('2.5.5');
    w.unmount();
  });

  it('marks an unreachable robot offline and blocks online install', async () => {
    const { vm, w } = mountPage({ tools: { 'self.get_device_status': () => Promise.reject({ msg: 'offline' }) } });
    await vm.loadRobot();
    expect(vm.robotState).toBe('offline');
    expect(vm.canInstall).toBe(false);
    await flushPromises();
    expect(w.text()).toContain('TinyBot is not answering');
    w.unmount();
  });

  it('without a device it can still build but not install', async () => {
    const { vm, w } = mountPage({ query: {} });
    await flushPromises();
    expect(vm.canInstall).toBe(false);
    expect(vm.tooLarge).toBe(false);
    expect(w.text()).toContain('No robot selected');
    w.unmount();
  });

  it('downloads assets.bin without a robot', async () => {
    stubStaticFetch();
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { vm, w, message } = mountPage({ query: {} });
    await vm.download();
    expect(click).toHaveBeenCalled();
    click.mockRestore();
    expect(message.success).toHaveBeenCalled();
    expect(message.success.mock.calls[0][0]).toContain('assets.bin is ready');
    expect(vm.building).toBe(false);
    w.unmount();
  });
});

describe('ThemeGenerator install flow', () => {
  it('uploads, sets the URL, reboots, then waits for the robot', async () => {
    stubStaticFetch();
    let statusCalls = 0;
    const { vm, w } = mountPage({
      tools: {
        // online for the check, offline right after the reboot, then back
        'self.get_device_status': () => {
          statusCalls += 1;
          return statusCalls === 2 ? Promise.reject({ msg: 'rebooting' }) : Promise.resolve({ code: 0, data: {} });
        },
      },
    });
    await flushPromises();
    // the page checked the robot on load; count the install from here
    statusCalls = 0;
    calls.length = 0;
    vm.robotState = 'online';
    vi.useFakeTimers();
    const running = vm.install();
    await vi.advanceTimersByTimeAsync(30000);
    await running;
    vi.useRealTimers();

    expect(calls.map((c) => c[0])).toEqual([
      'self.get_device_status',
      'self.assets.set_download_url',
      'self.reboot',
      'self.get_device_status',
      'self.get_device_status',
    ]);
    expect(calls[1][1]).toEqual({ url: 'http://server/xiaozhi/otaMag/download/abc' });
    const blob = api.ota.uploadAssetsBin.mock.calls[0][0];
    const bytes = await readBlob(blob);
    const parsed = utils.parseAssets(bytes);
    expect(parsed.files.map((f) => f.name)).toEqual(['srmodels.bin', 'index.json']);
    expect(JSON.parse(new TextDecoder().decode(parsed.files[1].data))).not.toHaveProperty('text_font');
    expect(vm.steps.every((s) => s.status === 'done')).toBe(true);
    expect(vm.installDone).toBe(true);
    expect(vm.installing).toBe(false);
    await flushPromises();
    expect(w.text()).toContain('Done. TinyBot is back online. Try saying "Hi ESP".');
    w.unmount();
  });

  it('stops with a clear error when the upload fails', async () => {
    stubStaticFetch();
    const { vm, w } = mountPage();
    await flushPromises();
    calls.length = 0;
    api.ota.uploadAssetsBin.mockImplementation(() => Promise.reject({ msg: '' }));
    vm.robotState = 'online';
    await vm.install();
    const upload = vm.steps.find((s) => s.key === 'upload');
    expect(upload.status).toBe('error');
    expect(upload.error).toBe('Upload failed. Check your connection and try again.');
    expect(calls.map((c) => c[0])).toEqual(['self.get_device_status']);
    expect(vm.installing).toBe(false);
    await flushPromises();
    expect(w.text()).toContain('Upload failed. Check your connection and try again.');
    w.unmount();
  });

  it('reports an offline robot at the check step', async () => {
    stubStaticFetch();
    const { vm, w } = mountPage();
    await flushPromises();
    api.device.callDeviceToolOnce.mockImplementation(() => Promise.reject({ msg: '' }));
    vm.robotState = 'online';
    await vm.install();
    const check = vm.steps.find((s) => s.key === 'check');
    expect(check.status).toBe('error');
    expect(check.error).toBe('TinyBot is offline. Turn it on, check its Wi-Fi and try again.');
    expect(vm.robotState).toBe('offline');
    expect(api.ota.uploadAssetsBin).not.toHaveBeenCalled();
    w.unmount();
  });
});
