import assert from 'node:assert/strict'
import test from 'node:test'
import { differsFromProduction, otaUrlFromBase, PRODUCTION_OTA_URL, sameOtaUrl } from './otaUrl.mjs'

test('a LAN base gets /ota/ appended', () => {
  assert.equal(otaUrlFromBase('http://192.168.0.123:18002/xiaozhi'), 'http://192.168.0.123:18002/xiaozhi/ota/')
})

test('trailing slashes and spaces do not double up', () => {
  assert.equal(otaUrlFromBase('  http://192.168.0.123:18002/xiaozhi///  '), 'http://192.168.0.123:18002/xiaozhi/ota/')
})

test('the production base gives the firmware default', () => {
  assert.equal(otaUrlFromBase('https://esp.czbd.app/xiaozhi'), PRODUCTION_OTA_URL)
  assert.equal(otaUrlFromBase('https://esp.czbd.app/xiaozhi/'), PRODUCTION_OTA_URL)
})

test('a base without /xiaozhi just gets /ota/ on its own path', () => {
  assert.equal(otaUrlFromBase('http://10.0.0.5:8002'), 'http://10.0.0.5:8002/ota/')
  assert.equal(otaUrlFromBase('https://bot.example.com/api/'), 'https://bot.example.com/api/ota/')
})

test('a base that already ends in /ota is not doubled', () => {
  assert.equal(otaUrlFromBase('http://10.0.0.5:8002/xiaozhi/ota'), 'http://10.0.0.5:8002/xiaozhi/ota/')
})

test('query strings and fragments are dropped', () => {
  assert.equal(otaUrlFromBase('http://10.0.0.5:8002/xiaozhi?x=1#y'), 'http://10.0.0.5:8002/xiaozhi/ota/')
})

test('a relative base (dev proxy) resolves against the page origin, or gives nothing', () => {
  assert.equal(otaUrlFromBase('/xiaozhi', 'http://192.168.0.123:9000'), 'http://192.168.0.123:9000/xiaozhi/ota/')
  assert.equal(otaUrlFromBase('/xiaozhi'), '')
  assert.equal(otaUrlFromBase('xiaozhi', 'http://192.168.0.123:9000'), '')
})

test('empty, invalid, non-http and over-long bases give nothing', () => {
  assert.equal(otaUrlFromBase(''), '')
  assert.equal(otaUrlFromBase(undefined), '')
  assert.equal(otaUrlFromBase('http://'), '')
  assert.equal(otaUrlFromBase('ftp://host/xiaozhi'), '')
  assert.equal(otaUrlFromBase(`http://host/${'a'.repeat(260)}`), '')
})

test('production comparison ignores case and trailing slashes', () => {
  assert.ok(sameOtaUrl('HTTPS://esp.czbd.app/xiaozhi/ota', PRODUCTION_OTA_URL))
  assert.equal(differsFromProduction(PRODUCTION_OTA_URL), false)
  assert.equal(differsFromProduction('http://192.168.0.123:18002/xiaozhi/ota/'), true)
  assert.equal(differsFromProduction(''), false)
})
