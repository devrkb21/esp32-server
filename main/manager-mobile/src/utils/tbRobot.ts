import { reactive } from 'vue'
import { getAgentList } from '@/api/agent/agent'
import { getBindDevices } from '@/api/device/device'

/**
 * The robot the owner screens are about ("this robot"): chosen on the robots page, remembered,
 * and filled in automatically when the account has exactly one. Same model as manager-web
 * src/shell/robot.js.
 *   robot.deviceId  manager-api device id (what the companion API takes)
 *   robot.agentId   the agent (character) the robot runs
 */
const KEY = 'tb.robot'

export interface RobotEntry { deviceId: string, agentId: string, agentName: string, name: string, macAddress: string, lastConnectedAt?: string }

function saved(): Partial<RobotEntry> {
  try {
    return JSON.parse(uni.getStorageSync(KEY) || 'null') || {}
  }
  catch {
    return {}
  }
}

export const robot = reactive({
  deviceId: '',
  agentId: '',
  name: '',
  list: [] as RobotEntry[],
  loading: false,
  loaded: false,
  ...saved(),
})

export function selectRobot(r: Pick<RobotEntry, 'deviceId' | 'agentId' | 'name'>) {
  robot.deviceId = r.deviceId
  robot.agentId = r.agentId
  robot.name = r.name || ''
  uni.setStorageSync(KEY, JSON.stringify({ deviceId: r.deviceId, agentId: r.agentId, name: robot.name }))
}

export function clearRobot() {
  robot.deviceId = ''
  robot.agentId = ''
  robot.name = ''
  uni.removeStorageSync(KEY)
}

/** Load every robot of the account (agents, then their devices). */
export async function loadRobots(force = false) {
  if (robot.loading || (robot.loaded && !force))
    return robot.list
  robot.loading = true
  try {
    const agents = (await getAgentList()) || []
    const lists = await Promise.all(agents.map(async (a: any) => {
      const devs = ((await getBindDevices(a.id).catch(() => [])) || []) as any[]
      return devs.map(d => ({ deviceId: d.id, agentId: a.id, agentName: a.agentName, name: d.alias || '', macAddress: d.macAddress, lastConnectedAt: d.lastConnectedAt }))
    }))
    robot.list = lists.flat()
  }
  catch {
    robot.list = []
  }
  robot.loading = false
  robot.loaded = true
  if (!robot.list.find(r => r.deviceId === robot.deviceId) && robot.list.length)
    selectRobot(robot.list[0])
  if (!robot.list.length)
    clearRobot()
  return robot.list
}
