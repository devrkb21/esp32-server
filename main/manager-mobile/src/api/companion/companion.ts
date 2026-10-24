import type {
  CommandBody,
  CompanionCommand,
  CompanionConfigPatch,
  CompanionDevice,
  CompanionEvent,
  CompanionMessage,
  GeocodeResult,
  SendMessageBody,
} from './types'
import { http } from '@/http/request/alova'

/**
 * Get the companion view of a device (config, stats, events, messages, commands)
 * @param deviceId Device ID
 * @param silent Do not toast errors (background polling)
 */
export function getCompanion(deviceId: string, silent = false) {
  return http.Get<CompanionDevice>(`/device/companion/${deviceId}`, {
    meta: {
      ignoreAuth: false,
      toast: !silent,
    },
    cacheFor: {
      expire: 0,
    },
  })
}

/**
 * Partially update the companion config
 * (alarms and reminders replace the whole list; other sections are merged)
 * @param deviceId Device ID
 * @param patch Changed config sections
 */
export function updateCompanionConfig(deviceId: string, patch: CompanionConfigPatch) {
  return http.Put<CompanionDevice>(`/device/companion/${deviceId}/config`, patch)
}

/**
 * Get messages sent to the robot (newest first)
 * @param deviceId Device ID
 */
export function getCompanionMessages(deviceId: string) {
  return http.Get<{ messages: CompanionMessage[] }>(`/device/companion/${deviceId}/messages`, {
    cacheFor: {
      expire: 0,
    },
  })
}

/**
 * Send a message for the robot to speak
 * @param deviceId Device ID
 * @param body Sender, text and whether a yes/no answer is wanted
 */
export function sendCompanionMessage(deviceId: string, body: SendMessageBody) {
  return http.Post<CompanionMessage>(`/device/companion/${deviceId}/messages`, body)
}

/**
 * Queue a command for the robot
 * @param deviceId Device ID
 * @param body Command type and argument
 */
export function sendCompanionCommand(deviceId: string, body: CommandBody) {
  return http.Post<CompanionCommand>(`/device/companion/${deviceId}/commands`, {
    type: body.type,
    arg: body.arg ?? '',
  })
}

/**
 * Get recent robot events (newest first)
 * @param deviceId Device ID
 * @param limit Number of events (1-200)
 */
export function getCompanionEvents(deviceId: string, limit = 50) {
  return http.Get<{ events: CompanionEvent[] }>(`/device/companion/${deviceId}/events`, {
    params: { limit },
    cacheFor: {
      expire: 0,
    },
  })
}

/**
 * City search for prayer times and weather
 * @param q City name
 */
export function geocodeCity(q: string) {
  return http.Get<{ results: GeocodeResult[] }>('/device/companion/geocode', {
    params: { q },
    timeout: 15000,
    cacheFor: {
      expire: 0,
    },
  })
}
