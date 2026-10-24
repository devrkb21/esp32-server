import { reactive } from 'vue';
import Api from '@/apis/api';

// The robot the owner screens are about ("this robot"). Chosen on the robots page, remembered,
// and filled in automatically when the account has exactly one. A `?deviceId=` query wins.
//   robot.deviceId  manager-api device id (what the companion API takes)
//   robot.agentId   the agent (character) the robot runs
const KEY = 'tb.robot';

function saved() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; }
}

export const robot = reactive({
  deviceId: '',
  agentId: '',
  name: '',
  list: [],      // [{ deviceId, agentId, agentName, name, macAddress, lastConnectedAt }]
  loading: false,
  loaded: false,
  ...saved(),
});

export function selectRobot(r) {
  robot.deviceId = r.deviceId;
  robot.agentId = r.agentId;
  robot.name = r.name || '';
  try { localStorage.setItem(KEY, JSON.stringify({ deviceId: r.deviceId, agentId: r.agentId, name: robot.name })); } catch (e) { /* private mode */ }
}

export function clearRobot() {
  robot.deviceId = ''; robot.agentId = ''; robot.name = '';
  try { localStorage.removeItem(KEY); } catch (e) { /* private mode */ }
}

function call(fn, ...args) {
  return new Promise((resolve) => fn(...args, (res) => resolve(res?.data?.data ?? null), () => resolve(null)));
}

/** Load every robot of the account (agents, then their devices). */
export async function loadRobots(force = false) {
  if (robot.loading || (robot.loaded && !force)) return robot.list;
  robot.loading = true;
  const agents = (await call(Api.agent.getAgentList)) || [];
  const lists = await Promise.all(agents.map(async (a) => {
    const devs = (await call(Api.device.getAgentBindDevices, a.id)) || [];
    return devs.map((d) => ({
      deviceId: d.id, agentId: a.id, agentName: a.agentName, name: d.alias || '',
      macAddress: d.macAddress, lastConnectedAt: d.lastConnectedAt,
    }));
  }));
  robot.list = lists.flat();
  robot.loading = false;
  robot.loaded = true;
  const still = robot.list.find((r) => r.deviceId === robot.deviceId);
  if (!still && robot.list.length) selectRobot(robot.list[0]);
  if (!robot.list.length) clearRobot();
  return robot.list;
}

/** The device id a page should use: the query first, then the chosen robot. */
export function deviceIdFrom(route) {
  return (route && route.query && route.query.deviceId) || robot.deviceId || '';
}
