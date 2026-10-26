import { reactive } from 'vue'
import { getAgentList } from '@/api/agent/agent'
import { getBindDevices } from '@/api/device/device'
import { getSharedRobots } from '@/api/family/family'
import { mergeRobots, sharedRobot } from '@/utils/familyModel.mjs'
import { getProductList } from '@/api/product/product'
import { allows, productOf } from '@/utils/tbProducts.mjs'

/**
 * The robot the owner screens are about ("this robot"): chosen on the robots page, remembered,
 * and filled in automatically when the account has exactly one. Same model as manager-web
 * src/shell/robot.js.
 *   robot.deviceId    manager-api device id (what the companion API takes)
 *   robot.agentId     the agent (character) the robot runs
 *   robot.productKey  the Nobix product it is ('tinybot', 'generic', ...)
 *   robot.features    what that product can do; places a product lacks are hidden
 */
const KEY = 'tb.robot'

export interface ProductFacts { productKey: string, productName: string, productNameBn: string, features: string[] }
export interface RobotEntry extends Partial<ProductFacts> {
  deviceId: string
  agentId: string
  agentName: string
  name: string
  macAddress: string
  board?: string
  lastConnectedAt?: string
  /** 'owner' for the account's own robots; shared robots carry the role they were given */
  role?: 'owner' | 'co_owner' | 'member'
  /** the owner's name, for a robot shared with this account */
  sharedBy?: string
  /** the share id (leave a shared robot with DELETE /family/share/{id}) */
  shareId?: string
}

function saved(): Partial<RobotEntry> {
  try {
    const s = JSON.parse(uni.getStorageSync(KEY) || 'null') || {}
    // A robot remembered before products existed is a TinyBot.
    return s.deviceId ? { ...s, ...productOf(s, []) } : s
  }
  catch {
    return {}
  }
}

export const robot = reactive({
  deviceId: '',
  agentId: '',
  name: '',
  productKey: '',
  productName: '',
  productNameBn: '',
  features: [] as string[],
  list: [] as RobotEntry[],
  loading: false,
  loaded: false,
  ...saved(),
})

/** The product catalog (GET /product/list), loaded once after sign-in. */
export const products = reactive({ list: [] as any[], loading: false, loaded: false })

export async function loadProducts(force = false) {
  if (products.loading || (products.loaded && !force))
    return products.list
  products.loading = true
  try {
    const list = await getProductList()
    products.list = Array.isArray(list) ? list : []
  }
  catch {
    products.list = []
  }
  products.loading = false
  products.loaded = true
  return products.list
}

type Pick3 = Pick<RobotEntry, 'deviceId' | 'agentId' | 'name'> & Partial<ProductFacts>

export function selectRobot(r: Pick3) {
  const known = robot.list.find(x => x.deviceId === r.deviceId)
  let p: ProductFacts
  if (r.productKey || Array.isArray(r.features))
    p = productOf(r, products.list)
  else if (known)
    p = productOf(known, products.list)
  else if (r.deviceId === robot.deviceId && robot.productKey)
    p = productOf(robot, products.list)
  else p = productOf(r, products.list)
  robot.deviceId = r.deviceId
  robot.agentId = r.agentId
  robot.name = r.name || ''
  robot.productKey = p.productKey
  robot.productName = p.productName
  robot.productNameBn = p.productNameBn
  robot.features = p.features
  uni.setStorageSync(KEY, JSON.stringify({
    deviceId: r.deviceId,
    agentId: r.agentId,
    name: robot.name,
    productKey: p.productKey,
    productName: p.productName,
    productNameBn: p.productNameBn,
    features: p.features,
  }))
}

export function clearRobot() {
  robot.deviceId = ''
  robot.agentId = ''
  robot.name = ''
  robot.productKey = ''
  robot.productName = ''
  robot.productNameBn = ''
  robot.features = []
  uni.removeStorageSync(KEY)
}

/** One device list item as a robot of the account. */
export function robotFrom(a: any, d: any): RobotEntry {
  return {
    deviceId: d.id,
    agentId: a.id,
    agentName: a.agentName,
    name: d.alias || '',
    macAddress: d.macAddress,
    board: d.board || '',
    lastConnectedAt: d.lastConnectedAtTimestamp ?? d.lastConnectedAt,
    ...productOf(d, products.list),
  }
}

/** Robots other accounts shared with this one (GET /family/robots); none when it fails. */
export async function loadShared(): Promise<RobotEntry[]> {
  try {
    const list = ((await getSharedRobots()) || []) as any[]
    return list.map(s => sharedRobot(s, productOf({ ...s }, products.list)) as RobotEntry)
  }
  catch {
    return []
  }
}

/** My role on the chosen robot (or on `deviceId`): 'owner' unless it was shared with me. */
export function robotRole(deviceId?: string): 'owner' | 'co_owner' | 'member' {
  const id = deviceId || robot.deviceId
  const hit = robot.list.find(r => r.deviceId === id)
  return (hit && hit.role) || 'owner'
}

/** Load every robot of the account (agents, then their devices), then the shared ones. */
export async function loadRobots(force = false) {
  if (robot.loading || (robot.loaded && !force))
    return robot.list
  robot.loading = true
  try {
    const [agents] = await Promise.all([getAgentList().then(a => a || []), loadProducts()])
    const [lists, shared] = await Promise.all([
      Promise.all((agents as any[]).map(async (a: any) => {
        const devs = ((await getBindDevices(a.id).catch(() => [])) || []) as any[]
        return devs.map(d => robotFrom(a, d))
      })),
      loadShared(),
    ])
    robot.list = mergeRobots(lists.flat(), shared) as RobotEntry[]
  }
  catch {
    robot.list = []
  }
  robot.loading = false
  robot.loaded = true
  const still = robot.list.find(r => r.deviceId === robot.deviceId)
  if (still)
    selectRobot(still as Pick3)
  else if (robot.list.length)
    selectRobot(robot.list[0] as Pick3)
  if (!robot.list.length)
    clearRobot()
  return robot.list
}

/** What the chosen robot can do; `null` when no robot is chosen (then every place shows). */
export function robotFeatures(): string[] | null {
  if (!robot.deviceId)
    return null
  const hit = robot.list.find(r => r.deviceId === robot.deviceId)
  return (hit && hit.features) || robot.features
}

/** Can the chosen robot do `feature`? */
export function hasFeature(feature: string) {
  return allows(robotFeatures(), feature)
}
