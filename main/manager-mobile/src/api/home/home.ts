import { http } from '@/http/request/alova'

// Smart home (manager-api module `home`) and robot contacts (module `contacts`). Secrets (the
// Home Assistant token, the MQTT password) are only ever sent: the server answers with
// tokenSaved / passwordSaved and never sends a secret back.

export interface HomeIntegration {
  ha: { baseUrl: string, tokenSaved: boolean }
  mqtt: { host: string, port: number, username: string, passwordSaved: boolean, tls: boolean }
  deviceCount: number
}
export interface HomeDevice {
  id: string
  source: 'ha' | 'mqtt'
  entityId: string
  domain: 'light' | 'switch' | 'fan' | 'climate' | 'cover'
  name: string
  aliases: string[]
  topic: string
  payloadOn: string
  payloadOff: string
  enabled: boolean
}
export interface HomeResult {
  ok: boolean
  code: string
  message?: string
  version?: string
  found?: number
  added?: number
  devices?: HomeDevice[]
}
export interface RobotContact {
  id: string
  status: 'pending' | 'accepted' | 'declined'
  direction: 'in' | 'out'
  myDeviceId: string | null
  myDeviceName: string
  name: string
  aliases: string[]
  otherOwner: string
  otherUsername: string
  otherDeviceName: string
  theirName: string
  createdAt: number | null
}
export interface ContactTarget { key: string, name: string, aliases: string[], kind: 'own' | 'contact' }
export interface SendResult { ok: boolean, code: string, to?: string, later?: boolean }

const quiet = { meta: { toast: false }, cacheFor: { expire: 0 } } as any

export const getIntegration = () => http.Get<HomeIntegration>('/home/integration', quiet)
export const saveIntegration = (body: Record<string, any>) => http.Put<HomeIntegration>('/home/integration', body, quiet)
export const testIntegration = (target: 'ha' | 'mqtt') => http.Post<HomeResult>(`/home/integration/test?target=${target}`, {}, quiet)
export const importHa = () => http.Post<HomeResult>('/home/ha/import', {}, quiet)
export const listDevices = () => http.Get<HomeDevice[]>('/home/devices', quiet)
export const addDevice = (body: Record<string, any>) => http.Post<HomeDevice>('/home/devices', body, quiet)
export const updateDevice = (id: string, body: Record<string, any>) => http.Put<HomeDevice>(`/home/devices/${encodeURIComponent(id)}`, body, quiet)
export const deleteDevice = (id: string) => http.Delete<null>(`/home/devices/${encodeURIComponent(id)}`, {}, quiet)
export function actOnDevice(id: string, action: string, value?: number) {
  return http.Post<HomeResult>(`/home/devices/${encodeURIComponent(id)}/action`, value == null ? { action } : { action, value }, quiet)
}

export const getContacts = () => http.Get<{ robots: { deviceId: string, name: string }[], contacts: RobotContact[] }>('/contacts', quiet)
export const requestContact = (body: Record<string, any>) => http.Post<RobotContact>('/contacts', body, quiet)
export const acceptContact = (id: string, body: Record<string, any>) => http.Post<RobotContact>(`/contacts/${encodeURIComponent(id)}/accept`, body, quiet)
export const declineContact = (id: string) => http.Post<null>(`/contacts/${encodeURIComponent(id)}/decline`, {}, quiet)
export const renameContact = (id: string, body: Record<string, any>) => http.Put<RobotContact>(`/contacts/${encodeURIComponent(id)}`, body, quiet)
export const removeContact = (id: string) => http.Delete<null>(`/contacts/${encodeURIComponent(id)}`, {}, quiet)
export const contactTargets = (deviceId: string) => http.Get<ContactTarget[]>(`/contacts/targets?deviceId=${encodeURIComponent(deviceId)}`, quiet)
export const sendToRobot = (body: { fromDeviceId: string, target: string, text: string }) => http.Post<SendResult>('/contacts/send', body, quiet)
