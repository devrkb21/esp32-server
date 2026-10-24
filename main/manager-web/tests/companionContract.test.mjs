import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

const [apiSource, apiIndexSource, routerSource, deviceViewSource, companionViewSource] = await Promise.all([
  read('../src/apis/module/companion.js'),
  read('../src/apis/api.js'),
  read('../src/router/index.js'),
  read('../src/views/DeviceManagement.vue'),
  read('../src/views/CompanionManagement.vue'),
]);

test('companion API module uses the manager-api /device/companion routes', () => {
  assert.match(apiSource, /\$\{getServiceUrl\(\)\}\/device\/companion\$\{path\}/);
  for (const [method, suffix] of [
    ['PUT', "'/config'"],
    ['GET', "'/messages'"],
    ['POST', "'/messages'"],
    ['POST', "'/commands'"],
  ]) {
    assert.match(apiSource, new RegExp(`companionRequest\\('${method}', devicePath\\(deviceId, ${suffix}\\)`));
  }
  assert.match(apiSource, /\/events\?\$\{query\}/);
  assert.match(apiSource, /`\/geocode\?\$\{params\}`/);
});

test('companion module is registered and routed', () => {
  assert.match(apiIndexSource, /import companion from '\.\/module\/companion\.js'/);
  assert.match(apiIndexSource, /^\s*companion\s*$/m);
  assert.match(routerSource, /name: 'CompanionManagement'/);
  assert.match(routerSource, /import\('\.\.\/views\/CompanionManagement\.vue'\)/);
});

test('device list opens the companion page with the manager-api device id', () => {
  assert.match(deviceViewSource, /@click="openCompanion\(scope\.row\)"/);
  assert.match(deviceViewSource, /name: 'CompanionManagement',\s*query: \{\s*deviceId: row\.device_id,/);
  assert.match(companionViewSource, /deviceId: this\.\$route\.query\.deviceId/);
});

test('companion page polls every 10 s and stops when it is left', () => {
  assert.match(companionViewSource, /const REFRESH_MS = 10000;/);
  assert.match(companionViewSource, /beforeDestroy\(\) \{[\s\S]*clearInterval\(this\.pollTimer\)/);
});
