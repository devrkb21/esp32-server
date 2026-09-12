// Bluetooth Low Energy (BLE) Fast Provisioning Utilities for ESP32

/**
 * @typedef {Object} BleDevice
 * @property {string} deviceId
 * @property {string} name
 * @property {string} [localName]
 * @property {number} RSSI
 * @property {ArrayBuffer} [advertisData]
 */

/**
 * @typedef {Object} ProvisionPayload
 * @property {string} ssid
 * @property {string} [password]
 * @property {boolean} [hidden]
 */

// Known ESP32 provisioning Service & Characteristic UUIDs
export const ESP_BLE_UUIDS = {
  // Standard Custom / BluFi GATT
  SERVICE_CUSTOM: '0000FFFF-0000-1000-8000-00805F9B34FB',
  WRITE_CHAR_CUSTOM: '0000FF01-0000-1000-8000-00805F9B34FB',
  NOTIFY_CHAR_CUSTOM: '0000FF02-0000-1000-8000-00805F9B34FB',

  // ESP-IDF Protocomm WiFi Provisioning
  SERVICE_PROTOCOMM: '021A9004-0382-4AEA-BFF4-6B3F1C5ADFB4',
  CHAR_PROV_DATA: 'FF51B30E-D7E2-4D93-8842-A7C4A57DFB07',
  CHAR_PROV_CONFIG: 'FF52B30E-D7E2-4D93-8842-A7C4A57DFB07',
}

export function stringToArrayBuffer(str) {
  const encoder = new TextEncoder()
  return encoder.encode(str).buffer
}

export function arrayBufferToString(buffer) {
  const decoder = new TextDecoder('utf-8')
  return decoder.decode(buffer)
}

/**
 * Open and initialize Bluetooth adapter on mobile
 * @returns {Promise<boolean>}
 */
export function openBluetoothAdapter() {
  return new Promise((resolve) => {
    if (typeof uni === 'undefined' || !uni.openBluetoothAdapter) {
      resolve(false)
      return
    }
    uni.openBluetoothAdapter({
      success: () => {
        console.log('Bluetooth adapter opened successfully')
        resolve(true)
      },
      fail: (err) => {
        console.warn('Failed to open Bluetooth adapter:', err)
        resolve(false)
      },
    })
  })
}

/**
 * Close Bluetooth adapter
 * @returns {Promise<void>}
 */
export function closeBluetoothAdapter() {
  return new Promise((resolve) => {
    if (typeof uni === 'undefined' || !uni.closeBluetoothAdapter) {
      resolve()
      return
    }
    uni.closeBluetoothAdapter({
      complete: () => resolve(),
    })
  })
}

/**
 * Start scanning for BLE devices
 * @param {(device: BleDevice) => void} onDeviceFound
 * @returns {Promise<boolean>}
 */
export function startBleDiscovery(onDeviceFound) {
  return new Promise((resolve) => {
    if (typeof uni === 'undefined' || !uni.startBluetoothDevicesDiscovery) {
      resolve(false)
      return
    }

    uni.onBluetoothDeviceFound((res) => {
      res.devices.forEach((dev) => {
        const name = dev.name || dev.localName || ''
        if (name || dev.deviceId) {
          onDeviceFound({
            deviceId: dev.deviceId,
            name: name || `ESP-${dev.deviceId.slice(-5)}`,
            localName: dev.localName,
            RSSI: dev.RSSI,
            advertisData: dev.advertisData,
          })
        }
      })
    })

    uni.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: false,
      success: () => {
        console.log('Started Bluetooth device discovery')
        resolve(true)
      },
      fail: (err) => {
        console.warn('Failed to start Bluetooth discovery:', err)
        resolve(false)
      },
    })
  })
}

/**
 * Stop scanning
 * @returns {Promise<void>}
 */
export function stopBleDiscovery() {
  return new Promise((resolve) => {
    if (typeof uni === 'undefined' || !uni.stopBluetoothDevicesDiscovery) {
      resolve()
      return
    }
    uni.stopBluetoothDevicesDiscovery({
      complete: () => resolve(),
    })
  })
}

/**
 * Connect to BLE device and discover provisioning service & characteristic
 * @param {string} deviceId
 * @returns {Promise<{ serviceId: string, writeCharId: string, notifyCharId?: string } | null>}
 */
export function connectBleDevice(deviceId) {
  return new Promise((resolve) => {
    if (typeof uni === 'undefined' || !uni.createBLEConnection) {
      resolve(null)
      return
    }

    uni.createBLEConnection({
      deviceId,
      timeout: 10000,
      success: () => {
        console.log(`Connected to BLE device ${deviceId}`)
        setTimeout(() => {
          uni.getBLEDeviceServices({
            deviceId,
            success: (servicesRes) => {
              const services = servicesRes.services || []
              console.log('Discovered BLE services:', services)

              let targetService = services.find(s =>
                s.uuid.toUpperCase().includes('FFFF')
                || s.uuid.toUpperCase().includes('021A9004')
                || s.isPrimary,
              ) || services[0]

              if (!targetService) {
                console.warn('No BLE services found')
                resolve(null)
                return
              }

              uni.getBLEDeviceCharacteristics({
                deviceId,
                serviceId: targetService.uuid,
                success: (charRes) => {
                  const chars = charRes.characteristics || []
                  console.log('Discovered characteristics:', chars)

                  const writeChar = chars.find(c => c.properties.write || c.properties.writeNoResponse) || chars[0]
                  const notifyChar = chars.find(c => c.properties.notify || c.properties.indicate)

                  if (!writeChar) {
                    console.warn('No writable characteristic found')
                    resolve(null)
                    return
                  }

                  resolve({
                    serviceId: targetService.uuid,
                    writeCharId: writeChar.uuid,
                    notifyCharId: notifyChar?.uuid,
                  })
                },
                fail: (err) => {
                  console.warn('Failed to get BLE characteristics:', err)
                  resolve(null)
                },
              })
            },
            fail: (err) => {
              console.warn('Failed to get BLE services:', err)
              resolve(null)
            },
          })
        }, 600)
      },
      fail: (err) => {
        console.warn(`Failed to connect to BLE device ${deviceId}:`, err)
        resolve(null)
      },
    })
  })
}

/**
 * Send WiFi credentials in chunked MTU packets over BLE
 * @param {string} deviceId
 * @param {string} serviceId
 * @param {string} characteristicId
 * @param {ProvisionPayload} payload
 * @returns {Promise<boolean>}
 */
export async function sendWifiCredentialsOverBle(
  deviceId,
  serviceId,
  characteristicId,
  payload,
) {
  if (typeof uni === 'undefined' || !uni.writeBLECharacteristicValue) {
    return false
  }

  const jsonStr = JSON.stringify({
    cmd: 'prov_wifi',
    ssid: payload.ssid,
    password: payload.password || '',
    hidden: Boolean(payload.hidden),
  })

  const fullBuffer = stringToArrayBuffer(jsonStr)
  const chunkSize = 20
  const totalChunks = Math.ceil(fullBuffer.byteLength / chunkSize)

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize, fullBuffer.byteLength)
    const chunk = fullBuffer.slice(start, end)

    const writeSuccess = await new Promise((resolve) => {
      uni.writeBLECharacteristicValue({
        deviceId,
        serviceId,
        characteristicId,
        value: chunk,
        success: () => resolve(true),
        fail: (err) => {
          console.warn(`BLE chunk ${i + 1}/${totalChunks} write failed:`, err)
          resolve(false)
        },
      })
    })

    if (!writeSuccess) {
      return false
    }

    await new Promise(r => setTimeout(r, 40))
  }

  return true
}

/**
 * Disconnect BLE device
 * @param {string} deviceId
 * @returns {Promise<void>}
 */
export function disconnectBleDevice(deviceId) {
  return new Promise((resolve) => {
    if (typeof uni === 'undefined' || !uni.closeBLEConnection) {
      resolve()
      return
    }
    uni.closeBLEConnection({
      deviceId,
      complete: () => resolve(),
    })
  })
}
