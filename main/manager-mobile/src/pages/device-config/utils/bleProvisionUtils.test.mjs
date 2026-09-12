import test from 'node:test'
import assert from 'node:assert/strict'
import { ESP_BLE_UUIDS, arrayBufferToString, stringToArrayBuffer } from './bleProvisionUtils.mjs'

test('BLE UUIDs match ESP32 GATT and Protocomm specifications', () => {
  assert.equal(ESP_BLE_UUIDS.SERVICE_CUSTOM, '0000FFFF-0000-1000-8000-00805F9B34FB')
  assert.equal(ESP_BLE_UUIDS.WRITE_CHAR_CUSTOM, '0000FF01-0000-1000-8000-00805F9B34FB')
  assert.equal(ESP_BLE_UUIDS.SERVICE_PROTOCOMM, '021A9004-0382-4AEA-BFF4-6B3F1C5ADFB4')
  assert.equal(ESP_BLE_UUIDS.CHAR_PROV_DATA, 'FF51B30E-D7E2-4D93-8842-A7C4A57DFB07')
})

test('ArrayBuffer and string conversions roundtrip accurately', () => {
  const sample = JSON.stringify({
    cmd: 'prov_wifi',
    ssid: 'TestNetwork_2.4G',
    password: 'SuperSecretPassword123!',
    hidden: true
  })

  const buffer = stringToArrayBuffer(sample)
  const decoded = arrayBufferToString(buffer)

  assert.equal(decoded, sample)
  const parsed = JSON.parse(decoded)
  assert.equal(parsed.ssid, 'TestNetwork_2.4G')
  assert.equal(parsed.password, 'SuperSecretPassword123!')
  assert.equal(parsed.hidden, true)
})
