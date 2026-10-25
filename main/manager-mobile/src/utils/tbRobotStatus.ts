import { reactive } from 'vue'
import { getCompanion } from '@/api/companion/companion'
import { getDeviceOnlineStatus } from '@/api/device/device'
import { isOnline, parseStatus } from '@/pages/robots/robotsModel.mjs'
import { companionErrorKind, companionsToAsk, connectionOf, rawErrorText } from '@/utils/robotConnection.mjs'
import { allows } from '@/utils/tbProducts.mjs'
import { robot } from '@/utils/tbRobot'

/**
 * The robot's connection, one status per robot, shared by every screen (rules in
 * robotConnection.mjs). Screens that load the companion view report it here (noteCompanion), the
 * robots list and Today report the MQTT gateway map (noteMqttMap), and statusOf() combines them.
 */
type Companion = { ok: true, view: any } | { ok: false, kind: string }
interface Entry { mqtt?: boolean | null, companion?: Companion, mqttAt: number, companionAt: number }

export interface RobotStatus { state: string, lastSeen: number | null, lastSync?: number | null, reason: string }

export const robotStatuses = reactive<Record<string, Entry>>({})

function entry(deviceId: string): Entry {
  if (!robotStatuses[deviceId])
    robotStatuses[deviceId] = { mqttAt: 0, companionAt: 0 }
  return robotStatuses[deviceId]
}

function listed(deviceId: string) {
  return robot.list.find(r => r.deviceId === deviceId) || null
}

/**
 * Does this robot's product have the companion module? (unknown robots: yes, like TinyBot)
 * `features` (from productOf) answers for a robot the list may not hold yet.
 */
export function hasCompanion(deviceId: string, features?: string[] | null) {
  if (Array.isArray(features))
    return allows(features, 'companion')
  const r = listed(deviceId)
  if (r && Array.isArray(r.features))
    return allows(r.features, 'companion')
  if (deviceId === robot.deviceId && robot.features.length)
    return allows(robot.features, 'companion')
  return true
}

/** A companion view arrived (or failed with `err`). Returns the error kind ('' when it worked). */
export function noteCompanion(deviceId: string, view: any, err?: any): string {
  if (!deviceId)
    return ''
  const e = entry(deviceId)
  e.companionAt = Date.now()
  if (err === undefined && view && typeof view === 'object') {
    e.companion = { ok: true, view }
    return ''
  }
  const kind = companionErrorKind(err)
  // the raw server text is for the console only, never the screen
  console.warn(`[robot status] companion view of ${deviceId} failed (${kind}):`, rawErrorText(err) || err)
  // a failed background refresh does not undo a robot already known to the companion server,
  // except when the server says it has no record of it
  e.companion = { ok: false, kind }
  return kind
}

/** The gateway's word for one robot: true / false, null when the map is not available. */
export function noteMqtt(deviceId: string, online: boolean | null) {
  if (!deviceId)
    return
  const e = entry(deviceId)
  e.mqtt = online
  e.mqttAt = Date.now()
}

/** The gateway map of one character (POST /device/bind/{agentId}) for all its robots. */
export function noteMqttMap(agentId: string, map: any, devices?: any[]) {
  const list = devices || robot.list.filter(r => r.agentId === agentId)
  for (const d of list) {
    const id = d.deviceId || d.id
    noteMqtt(id, map ? isOnline(map, d) : null)
  }
}

/** Ask the gateway about a character's robots. */
export async function refreshMqtt(agentId: string, devices?: any[]) {
  if (!agentId)
    return
  try {
    noteMqttMap(agentId, parseStatus(await getDeviceOnlineStatus(agentId)), devices)
  }
  catch {
    noteMqttMap(agentId, null, devices)
  }
}

/** Load a robot's companion view (silently: errors never toast raw server text). */
export async function refreshCompanion(deviceId: string): Promise<{ view: any, kind: string }> {
  try {
    const view = await getCompanion(deviceId, true)
    noteCompanion(deviceId, view)
    return { view, kind: '' }
  }
  catch (err) {
    return { view: null, kind: noteCompanion(deviceId, null, err) }
  }
}

/** Both sides of one robot: the gateway map of its character and (with the module) its view. */
export async function refreshRobotStatus(deviceId: string) {
  const r = listed(deviceId)
  const agentId = (r && r.agentId) || (deviceId === robot.deviceId ? robot.agentId : '')
  await Promise.all([
    agentId ? refreshMqtt(agentId) : Promise.resolve(),
    hasCompanion(deviceId) ? refreshCompanion(deviceId) : Promise.resolve(),
  ])
}

/** When was the companion view of a robot last asked for (ms, 0 never)? */
export function companionAskedAt(deviceId: string) {
  return (robotStatuses[deviceId] && robotStatuses[deviceId].companionAt) || 0
}

/**
 * Ask the companion views a list screen needs for its statuses (rule: companionsToAsk in
 * robotConnection.mjs; call after noting the gateway map). `features` (from productOf) tells a
 * robot without the companion module. Returns the ids asked and a promise of their answers.
 */
export function checkCompanions(devs: Array<{ id: string, features?: string[] | null }>, now = Date.now()) {
  const ids: string[] = companionsToAsk((devs || []).map(d => ({
    id: d.id,
    hasCompanion: hasCompanion(d.id, d.features),
    mqtt: robotStatuses[d.id] ? robotStatuses[d.id].mqtt : undefined,
    askedAt: companionAskedAt(d.id),
  })), now)
  return { ids, done: Promise.all(ids.map(id => refreshCompanion(id))) }
}

/**
 * The combined status of one robot (see robotConnection.mjs for the rules). `item` gives the
 * product features and last connection of a robot the list may not hold yet.
 */
export function statusOf(deviceId: string, now = Date.now(), item?: { features?: string[] | null, lastConnectedAt?: any } | null): RobotStatus {
  const e = robotStatuses[deviceId] || ({} as Entry)
  const r = item || listed(deviceId)
  return connectionOf({
    hasCompanion: hasCompanion(deviceId, item ? item.features : undefined),
    mqtt: e.mqtt,
    companion: e.companion,
    lastConnectedAt: r ? r.lastConnectedAt : null,
    now,
  }) as RobotStatus
}
