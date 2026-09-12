import type { Device, FirmwareType } from './types'
import { http } from '@/http/request/alova'

/**
 * Get device type list
 */
export function getFirmwareTypes() {
  return http.Get<FirmwareType[]>('/admin/dict/data/type/FIRMWARE_TYPE')
}

/**
 * Get bound devices list
 * @param agentId Agent ID
 */
export function getBindDevices(agentId: string) {
  return http.Get<Device[]>(`/device/bind/${agentId}`, {
    meta: {
      ignoreAuth: false,
      toast: false,
    },
    cacheFor: {
      expire: 0,
    },
  })
}

/**
 * Add device
 * @param agentId Agent ID
 * @param code Verification code
 */
export function bindDevice(agentId: string, code: string) {
  return http.Post(`/device/bind/${agentId}/${code}`, null)
}

/**
 * Manually add device
 * @param agentId Agent ID
 * @param board Device type
 * @param appVersion Firmware version
 * @param macAddress MAC address
 */
export function bindDeviceManual(data: {
  agentId: string
  board: string
  appVersion: string
  macAddress: string
}) {
  return http.Post('/device/manual-add', data)
}

/**
 * Set device OTA auto-update switch
 * @param deviceId Device ID (MAC address)
 * @param autoUpdate Auto-update 0|1
 */
export function updateDeviceAutoUpdate(deviceId: string, autoUpdate: number) {
  return http.Put(`/device/update/${deviceId}`, {
    autoUpdate,
  })
}

/**
 * Unbind device
 * @param deviceId Device ID (MAC address)
 */
export function unbindDevice(deviceId: string) {
  return http.Post('/device/unbind', {
    deviceId,
  })
}

/**
 * Get online status of devices for an agent
 * @param agentId Agent ID
 */
export function getDeviceOnlineStatus(agentId: string) {
  return http.Post<string>(`/device/bind/${agentId}`, {}, {
    meta: {
      ignoreAuth: false,
      toast: false,
    },
    cacheFor: {
      expire: 0,
    },
  })
}

/**
 * Call device tool (MCP command via MQTT)
 * @param deviceId Device ID
 * @param name Tool name (e.g. reboot, set_volume, self.get_device_status)
 * @param args Tool arguments
 */
export function callDeviceTool(deviceId: string, name: string, args: Record<string, any> = {}) {
  return http.Post(`/device/tools/call/${deviceId}`, {
    name,
    arguments: args,
  })
}

/**
 * Send reboot command to device
 * @param deviceId Device ID
 */
export function rebootDevice(deviceId: string) {
  return http.Post(`/device/command/${deviceId}/reboot`, {})
}

/**
 * Adjust device volume (0-100)
 * @param deviceId Device ID
 * @param volume Volume level (0-100)
 */
export function setDeviceVolume(deviceId: string, volume: number) {
  return http.Post(`/device/command/${deviceId}/volume`, {
    volume,
  })
}
