import { reactive } from 'vue';
import Api from '@/apis/api';
import { allows, productOf } from './products';

// The robot the owner screens are about ("this robot"). Chosen on the robots page, remembered,
// and filled in automatically when the account has exactly one. A `?deviceId=` query wins.
//   robot.deviceId    manager-api device id (what the companion API takes)
//   robot.agentId     the agent (character) the robot runs
//   robot.productKey  the Nobix product it is ('tinybot', 'generic', ...)
//   robot.features    what that product can do; screens a product lacks are hidden
const KEY = 'tb.robot';

function saved() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null') || {};
    // A robot remembered before products existed is a TinyBot.
    return s.deviceId ? { ...s, ...productOf(s, []) } : s;
  } catch (e) { return {}; }
}

export const robot = reactive({
  deviceId: '',
  agentId: '',
  name: '',
  productKey: '',
  productName: '',
  productNameBn: '',
  features: [],
  list: [],      // [{ deviceId, agentId, agentName, name, macAddress, lastConnectedAt, productKey, features, ... }]
  loading: false,
  loaded: false,
  ...saved(),
});

// The product catalog (GET /product/list), loaded once after sign-in.
export const products = reactive({ list: [], loading: false, loaded: false });

export function selectRobot(r) {
  const same = r.deviceId === robot.deviceId;
  const known = robot.list.find((x) => x.deviceId === r.deviceId);
  let p;
  if (r.productKey || Array.isArray(r.features)) p = productOf(r, products.list);
  else if (known) p = productOf(known, products.list);
  else if (same && robot.productKey) p = productOf(robot, products.list);
  else p = productOf(r, products.list);
  robot.deviceId = r.deviceId;
  robot.agentId = r.agentId;
  robot.name = r.name || '';
  robot.productKey = p.productKey;
  robot.productName = p.productName;
  robot.productNameBn = p.productNameBn;
  robot.features = p.features;
  try {
    localStorage.setItem(KEY, JSON.stringify({
      deviceId: r.deviceId, agentId: r.agentId, name: robot.name, productKey: p.productKey,
      productName: p.productName, productNameBn: p.productNameBn, features: p.features,
    }));
  } catch (e) { /* private mode */ }
}

export function clearRobot() {
  robot.deviceId = ''; robot.agentId = ''; robot.name = '';
  robot.productKey = ''; robot.productName = ''; robot.productNameBn = ''; robot.features = [];
  try { localStorage.removeItem(KEY); } catch (e) { /* private mode */ }
}

function call(fn, ...args) {
  return new Promise((resolve) => fn(...args, (res) => resolve(res?.data?.data ?? null), () => resolve(null)));
}

/** Load the product catalog once (every later call returns the cached list). */
export async function loadProducts(force = false) {
  if (products.loading || (products.loaded && !force)) return products.list;
  const fn = Api.product && Api.product.getProductList;
  if (!fn) return products.list;
  products.loading = true;
  const list = await call(fn.bind(Api.product));
  products.list = Array.isArray(list) ? list : [];
  products.loading = false;
  products.loaded = true;
  return products.list;
}

/** One device list item as a robot of the account. */
export function robotFrom(agent, d, list = products.list) {
  return {
    deviceId: d.id, agentId: agent.id, agentName: agent.agentName, name: d.alias || '',
    macAddress: d.macAddress, board: d.board || '', lastConnectedAt: d.lastConnectedAtTimestamp ?? d.lastConnectedAt,
    ...productOf(d, list),
  };
}

/** Load every robot of the account (agents, then their devices). */
export async function loadRobots(force = false) {
  if (robot.loading || (robot.loaded && !force)) return robot.list;
  robot.loading = true;
  const [agents] = await Promise.all([call(Api.agent.getAgentList).then((a) => a || []), loadProducts()]);
  const lists = await Promise.all(agents.map(async (a) => {
    const devs = (await call(Api.device.getAgentBindDevices, a.id)) || [];
    return devs.map((d) => robotFrom(a, d));
  }));
  robot.list = lists.flat();
  robot.loading = false;
  robot.loaded = true;
  const still = robot.list.find((r) => r.deviceId === robot.deviceId);
  if (still) selectRobot(still);
  else if (robot.list.length) selectRobot(robot.list[0]);
  if (!robot.list.length) clearRobot();
  return robot.list;
}

/** The device id a page should use: the query first, then the chosen robot. */
export function deviceIdFrom(route) {
  return (route && route.query && route.query.deviceId) || robot.deviceId || '';
}

/**
 * What the robot a page is about can do: the `?deviceId=` robot when the list knows it, else the
 * chosen robot. `null` when no robot is chosen (then every screen shows, as before products).
 */
export function robotFeatures(deviceId) {
  const id = deviceId || robot.deviceId;
  if (!id) return null;
  const hit = robot.list.find((r) => r.deviceId === id);
  if (hit) return hit.features;
  if (id === robot.deviceId) return robot.features;
  return null;
}

/** Can the robot a page is about do `feature`? */
export function hasFeature(feature, deviceId) {
  return allows(robotFeatures(deviceId), feature);
}

/**
 * The feature a route needs that the robot it is about lacks ('' when the page can show).
 * Routes name their feature in `meta.needs` (src/router/index.js).
 */
export function missingFeature(route) {
  const need = route && route.meta && route.meta.needs;
  if (!need) return '';
  const id = route.query && route.query.deviceId;
  return hasFeature(need, id) ? '' : need;
}
