import Vue from 'vue';
import fs from 'node:fs';
import path from 'node:path';
import { compile, parseComponent } from 'vue-template-compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import source from '../src/views/ThemeGenerator.vue?raw';
import * as utils from '../src/utils/tinybotAssets.mjs';

// Same approach as companionView.test.mjs: run the real component script with its imports
// replaced (utils injected, API stubbed).
const sfc = parseComponent(source);
const script = sfc.script.content
  .replace(/^import[\s\S]*?from\s+'[^']+';$/gm, '')
  .replace('export default', 'return');
const prelude = `const { ${Object.keys(utils).join(', ')} } = utils;`;
const STATIC = path.resolve(process.cwd(), 'public/generator/static') + '/';

function makeVm({ query = { deviceId: 'dev1', agentId: 'agent1' }, tools = {} } = {}) {
  const calls = [];
  const Api = {
    device: {
      getAgentBindDevices: vi.fn(),
      callDeviceToolOnce: vi.fn((deviceId, name, args) => {
        calls.push([name, args]);
        const handler = tools[name];
        if (handler) return handler(args);
        return Promise.resolve({ code: 0, data: true });
      }),
    },
    ota: { uploadAssetsBin: vi.fn(() => Promise.resolve('http://server/xiaozhi/otaMag/download/abc')) },
  };
  const component = new Function('Api', 'HeaderBar', 'VersionFooter', 'TinyBotLook', 'utils', prelude + script)(Api, {}, {}, {}, utils);
  const vm = new Vue({
    ...component,
    mixins: [{
      beforeCreate() {
        this.$route = { query };
        this.$t = (key) => key;
        this.$te = () => false;
        this.$message = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
      },
    }],
  });
  return { vm, Api, calls };
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

afterEach(() => {
  vi.useRealTimers();
  delete globalThis.fetch;
});

describe('ThemeGenerator template', () => {
  it('compiles without errors', () => {
    const { errors } = compile(sfc.template.content);
    expect(errors).toEqual([]);
  });
});

describe('ThemeGenerator state', () => {
  it('defaults to Hi ESP and the built-in font, sized under 1 MB', () => {
    const { vm } = makeVm();
    expect(vm.wakeWord).toBe('wn9_hiesp');
    expect(vm.font).toBe('builtin');
    expect(vm.estimate.parts.map((p) => p.name)).toEqual(['srmodels.bin', 'index.json']);
    expect(vm.tooLarge).toBe(false);
  });

  it('reads chip and screen from the robot tools', async () => {
    const { vm } = makeVm({
      tools: {
        'self.get_system_info': () => Promise.resolve({ code: 0, data: { chip_model_name: 'esp32s3', flash_size: 4194304, partition_table: [{ label: 'assets', size: 1048576 }] } }),
        'self.screen.get_info': () => Promise.resolve({ code: 0, data: '{"width":128,"height":64,"monochrome":true}' }),
      },
    });
    await vm.loadRobot();
    expect(vm.robotState).toBe('online');
    expect(vm.chipText).toContain('ESP32-S3');
    expect(vm.screen).toEqual({ width: 128, height: 64, monochrome: true });
    expect(vm.tinybot).toBe(true);
    expect(vm.limit).toBe(1048576);
  });

  it('marks an unreachable robot offline and blocks online install', async () => {
    const { vm } = makeVm({ tools: { 'self.get_device_status': () => Promise.reject({ msg: 'offline' }) } });
    await vm.loadRobot();
    expect(vm.robotState).toBe('offline');
    expect(vm.canInstall).toBe(false);
  });

  it('without a device it can still build but not install', () => {
    const { vm } = makeVm({ query: {} });
    expect(vm.canInstall).toBe(false);
    expect(vm.tooLarge).toBe(false);
  });
});

describe('ThemeGenerator install flow', () => {
  it('uploads, sets the URL, reboots, then waits for the robot', async () => {
    stubStaticFetch();
    let statusCalls = 0;
    const { vm, Api, calls } = makeVm({
      tools: {
        // online for the check, offline right after the reboot, then back
        'self.get_device_status': () => {
          statusCalls += 1;
          return statusCalls === 2 ? Promise.reject({ msg: 'rebooting' }) : Promise.resolve({ code: 0, data: {} });
        },
      },
    });
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
    const blob = Api.ota.uploadAssetsBin.mock.calls[0][0];
    const bytes = await readBlob(blob);
    const parsed = utils.parseAssets(bytes);
    expect(parsed.files.map((f) => f.name)).toEqual(['srmodels.bin', 'index.json']);
    expect(vm.steps.every((s) => s.status === 'done')).toBe(true);
    expect(vm.installDone).toBe(true);
    expect(vm.installing).toBe(false);
  });

  it('stops with a clear error when the upload fails', async () => {
    stubStaticFetch();
    const { vm, Api, calls } = makeVm();
    Api.ota.uploadAssetsBin.mockImplementation(() => Promise.reject({ msg: '' }));
    vm.robotState = 'online';
    await vm.install();
    const upload = vm.steps.find((s) => s.key === 'upload');
    expect(upload.status).toBe('error');
    expect(upload.error).toBe('Upload failed. Check your connection and try again.');
    expect(calls.map((c) => c[0])).toEqual(['self.get_device_status']);
    expect(vm.installing).toBe(false);
  });
});
