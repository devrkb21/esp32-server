import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

const NOW = new Date().toISOString();
const GENERIC = ['chat', 'character', 'voiceprint', 'chat_history', 'firmware'];
const PRODUCTS = [
  { productKey: 'tinybot', nameEn: 'TinyBot', nameBn: 'টাইনিবট', features: ['chat', 'character', 'voiceprint', 'companion', 'day', 'look', 'messages', 'commands'], sort: 1 },
  { productKey: 'generic', nameEn: 'Nobix device', nameBn: 'নোবিক্স ডিভাইস', features: GENERIC, sort: 99 },
];

const api = vi.hoisted(() => ({
  agent: { getAgentList: vi.fn(), searchAgent: vi.fn(), addAgent: vi.fn(), deleteAgent: vi.fn() },
  device: { getAgentBindDevices: vi.fn(), getDeviceStatus: vi.fn(), bindDevice: vi.fn(), manualAddDevice: vi.fn() },
  dict: { getDictDataByType: vi.fn() },
  product: { getProductList: vi.fn(), getProductPage: vi.fn(), addProduct: vi.fn(), updateProduct: vi.fn(), deleteProducts: vi.fn() },
}));
vi.mock('@/apis/api', () => ({ default: api, getServiceUrl: () => '' }));
vi.mock('@/utils/featureManager', () => ({
  default: { waitForInitialization: async () => true, getConfig: () => ({ voiceprintRecognition: true }) },
}));

const { default: i18n } = await import('@/i18n');
const { default: kit } = await import('@/kit');
const { robot, products, selectRobot, missingFeature, hasFeature } = await import('@/shell/robot');
const { productOf, allows, productName, KNOWN_FEATURES } = await import('@/shell/products');
const { NAV, visibleNav, visibleTabs } = await import('@/shell/nav');
const { routes } = await import('@/router/index.js');
const model = await import('@/views/products/productsModel');
const { default: FeatureGate } = await import('@/shell/FeatureGate.vue');
const { default: ProductSheet } = await import('@/views/products/ProductSheet.vue');
const { default: ProductManagement } = await import('@/views/products/ProductManagement.vue');
const { default: Robots } = await import('@/views/robots/Robots.vue');
const { default: strings } = await import('@/i18n/pages/products.js');

function resetRobot() {
  localStorage.clear();
  Object.assign(robot, { deviceId: '', agentId: '', name: '', productKey: '', productName: '', productNameBn: '', features: [], list: [], loaded: false, loading: false });
  Object.assign(products, { list: [], loaded: false, loading: false });
}
const paths = (groups) => groups.flatMap((g) => g.items.map((i) => i.to));

describe('product strings', () => {
  it('has every key in both Bangla and English, without the em dash', () => {
    expect(Object.keys(strings.bn).sort()).toEqual(Object.keys(strings.en).sort());
    for (const v of [...Object.values(strings.bn), ...Object.values(strings.en)]) {
      expect(v).not.toMatch(/—/);
      expect(v.trim()).not.toBe('');
    }
    for (const f of KNOWN_FEATURES) expect(strings.bn[`products.feature.${f}`]).toBeTruthy();
    expect(strings.bn['shell.notHere.title']).toBe('এই ডিভাইসে এই সুবিধা নেই');
    expect(strings.en['shell.notHere.title']).toBe('This device does not have this feature');
  });
});

describe('product of a device', () => {
  it('reads the device item first, then the product list, then falls back to TinyBot', () => {
    expect(productOf({ productKey: 'generic', productName: 'Nobix device', productNameBn: 'নোবিক্স ডিভাইস', features: GENERIC }, []))
      .toEqual({ productKey: 'generic', productName: 'Nobix device', productNameBn: 'নোবিক্স ডিভাইস', features: GENERIC });
    expect(productOf({ productKey: 'generic' }, PRODUCTS).features).toEqual(GENERIC);
    expect(productOf({ productKey: 'generic' }, PRODUCTS).productNameBn).toBe('নোবিক্স ডিভাইস');
    const old = productOf({ id: 'd1' }, []);
    expect(old.productKey).toBe('tinybot');
    expect(old.features).toContain('companion');
    expect(old.features).toContain('day');
    expect(productOf({}, PRODUCTS).features).toEqual(PRODUCTS[0].features);
    expect(productOf({ productKey: 'mystery' }, []).features).toEqual([]);
  });
  it('allows everything when no robot is chosen, and names the product by language', () => {
    expect(allows(null, 'day')).toBe(true);
    expect(allows(GENERIC, 'day')).toBe(false);
    expect(allows(GENERIC, 'chat')).toBe(true);
    expect(allows(GENERIC, undefined)).toBe(true);
    const p = productOf({ productKey: 'generic' }, PRODUCTS);
    expect(productName(p, 'bn')).toBe('নোবিক্স ডিভাইস');
    expect(productName(p, 'en')).toBe('Nobix device');
  });
});

describe('navigation by features', () => {
  it('marks the robot pages with the feature they need', () => {
    const needs = Object.fromEntries(NAV.flatMap((g) => g.items).filter((i) => i.needs).map((i) => [i.to, i.needs]));
    expect(needs).toEqual({ '/day': 'day', '/messages': 'messages', '/look': 'look', '/robot': 'companion',
      '/role-config': 'character', '/voice-print': 'voiceprint' });
  });
  it('shows everything with no robot, and hides what a generic device lacks', () => {
    const all = paths(visibleNav(false, {}, null));
    expect(all).toEqual(expect.arrayContaining(['/today', '/day', '/messages', '/look', '/robot', '/role-config', '/voice-print', '/robots']));
    const generic = paths(visibleNav(false, {}, GENERIC));
    expect(generic).toEqual(expect.arrayContaining(['/today', '/role-config', '/voice-print', '/robots']));
    for (const p of ['/day', '/messages', '/look', '/robot']) expect(generic).not.toContain(p);
    const tiny = paths(visibleNav(false, {}, productOf({}, []).features));
    expect(tiny).toEqual(all);
  });
  it('filters the phone tab bar, keeping Today and More', () => {
    expect(visibleTabs(null).map((t) => t.to)).toEqual(['/today', '/day', '/messages', '/look', '/more']);
    expect(visibleTabs(GENERIC).map((t) => t.to)).toEqual(['/today', '/more']);
  });
  it('lists Products in the back office for super admins only', () => {
    expect(paths(visibleNav(true, {}, null))).toContain('/product-management');
    expect(paths(visibleNav(false, {}, null))).not.toContain('/product-management');
    const route = routes.find((r) => r.path === '/product-management');
    expect(route.meta).toMatchObject({ admin: true, title: 'nav.products' });
  });
});

describe('route guard', () => {
  beforeEach(() => { resetRobot(); i18n.global.locale = 'en'; });

  async function gate(path) {
    const Page = { template: '<p class="the-page">page</p>' };
    const router = createRouter({ history: createMemoryHistory(), routes: routes.filter((r) => r.component).map((r) => ({ ...r, component: Page })) });
    router.push(path);
    await router.isReady();
    const w = mount({ components: { FeatureGate }, template: '<FeatureGate><RouterView /></FeatureGate>' },
      { global: { plugins: [i18n, kit, router] } });
    await flushPromises();
    return { w, router };
  }

  it('routes name the feature they need', () => {
    const need = Object.fromEntries(routes.filter((r) => r.meta && r.meta.needs).map((r) => [r.path, r.meta.needs]));
    expect(need).toEqual({ '/day': 'day', '/messages': 'messages', '/look': 'look', '/robot': 'companion',
      '/role-config': 'character', '/voice-print': 'voiceprint' });
  });

  it('shows a calm empty state with a way to Today when the robot lacks the feature', async () => {
    selectRobot({ deviceId: 'd9', agentId: 'a1', name: 'Study desk', productKey: 'generic', features: GENERIC });
    expect(hasFeature('day')).toBe(false);
    expect(missingFeature({ meta: { needs: 'day' }, query: {} })).toBe('day');
    const { w } = await gate('/day');
    expect(w.find('.the-page').exists()).toBe(false);
    expect(w.text()).toContain('This device does not have this feature');
    expect(w.text()).toContain('Study desk');
    expect(w.find('.tb-empty__act .tb-btn--primary').text()).toBe('Go to Today');
  });

  it('shows the page when the robot has the feature, or when no robot is chosen', async () => {
    let r = await gate('/day');
    expect(r.w.find('.the-page').exists()).toBe(true);
    selectRobot({ deviceId: 'd1', agentId: 'a1', name: 'Desk' }); // no product fields: a TinyBot
    expect(robot.productKey).toBe('tinybot');
    r = await gate('/look');
    expect(r.w.find('.the-page').exists()).toBe(true);
    selectRobot({ deviceId: 'd9', agentId: 'a1', productKey: 'generic', features: GENERIC });
    r = await gate('/role-config');
    expect(r.w.find('.the-page').exists()).toBe(true);
    r = await gate('/today');
    expect(r.w.find('.the-page').exists()).toBe(true);
  });

  it('keeps the product when a page re-selects the same robot without product fields', () => {
    selectRobot({ deviceId: 'd9', agentId: 'a1', productKey: 'generic', features: GENERIC });
    selectRobot({ deviceId: 'd9', agentId: 'a1', name: 'Renamed' });
    expect(robot.productKey).toBe('generic');
    expect(JSON.parse(localStorage.getItem('tb.robot')).features).toEqual(GENERIC);
  });
});

describe('product sheet', () => {
  it('validates like the server', () => {
    const good = { ...model.emptyProduct(), productKey: 'speaker_2', nameEn: 'Speaker', boardTypes: 'spk-*, spk2' };
    expect(model.isValid(model.validate(good))).toBe(true);
    expect(model.validate({ ...good, productKey: '' }).productKey).toBe('required');
    expect(model.validate({ ...good, productKey: '2abc' }).productKey).toBe('format');
    expect(model.validate({ ...good, productKey: 'A' }).productKey).toBe('format');
    expect(model.validate({ ...good, nameEn: ' ' }).nameEn).toBe('required');
    expect(model.validate({ ...good, boardTypes: '' }).boardTypes).toBe('required');
    expect(model.validate({ ...good, boardTypes: 'ok, -bad' }).boardTypes).toBe('format');
    expect(model.validate({ ...good, boardTypes: '*' }).boardTypes).toBe('');
    expect(model.validate({ ...good, boardTypes: 'a*b' }).boardTypes).toBe('format');
    expect(model.validate({ ...good, extraFeatures: 'radio, Night' }).features).toBe('');
    expect(model.validate({ ...good, extraFeatures: 'radio, night-1' }).features).toBe('format');
    expect(model.validate({ ...good, iconUrl: 'ftp:x' }).iconUrl).toBe('format');
    expect(model.validate({ ...good, sort: 1.5 }).sort).toBe('format');
  });

  it('builds the payload: no id on create, the id on update, known and extra features merged', () => {
    const form = { ...model.emptyProduct(), productKey: ' speaker ', nameEn: ' Speaker ', nameBn: '', boardTypes: 'Spk-*, spk-*,spk2',
      features: ['chat', 'firmware'], extraFeatures: 'radio, chat', sort: '', status: false };
    expect(model.toPayload(form)).toEqual({ productKey: 'speaker', nameEn: 'Speaker', nameBn: null, description: null, iconUrl: null,
      boardTypes: 'spk-*,spk2', features: ['chat', 'firmware', 'radio'], sort: 0, status: 0 });
    const vo = { id: 7, productKey: 'tinybot', nameEn: 'TinyBot', nameBn: 'টাইনিবট', boardTypes: 'tinybot,tinybot-*', features: ['chat', 'night_light'], sort: 1, status: 1 };
    const back = model.toForm(vo);
    expect(back.features).toEqual(['chat']);
    expect(back.extraFeatures).toBe('night_light');
    expect(model.toPayload(back)).toMatchObject({ id: 7, productKey: 'tinybot', features: ['chat', 'night_light'], status: 1 });
    expect(model.isProtected({ productKey: 'generic' })).toBe(true);
    expect(model.isProtected({ productKey: 'tinybot' })).toBe(false);
  });

  async function sheet(props = {}) {
    i18n.global.locale = 'en';
    const w = mount(ProductSheet, { props: { open: true, ...props }, global: { plugins: [i18n, kit], stubs: { teleport: true } } });
    await flushPromises();
    return w;
  }

  it('shows field errors and sends nothing until the form is right', async () => {
    const w = await sheet();
    await w.find('form').trigger('submit');
    expect(w.emitted('submit')).toBeUndefined();
    expect(w.text()).toContain('Enter a key');
    expect(w.text()).toContain('Enter the English name');
    expect(w.text()).toContain('Enter at least one board type');
    await w.find('#pm-key').setValue('nobix_lamp');
    await w.find('#pm-name-en').setValue('Nobix lamp');
    await w.find('#pm-boards').setValue('lamp-*');
    const boxes = w.findAll('.pm-feats input[type="checkbox"]');
    expect(boxes).toHaveLength(KNOWN_FEATURES.length);
    await boxes[0].setValue(true);
    await w.find('form').trigger('submit');
    expect(w.emitted('submit')[0][0]).toEqual({ productKey: 'nobix_lamp', nameEn: 'Nobix lamp', nameBn: null, description: null, iconUrl: null,
      boardTypes: 'lamp-*', features: ['chat'], sort: 0, status: 1 });
  });

  it('locks the key of an existing product and shows the server message on its field', async () => {
    const w = await sheet({ product: { id: 2, productKey: 'generic', nameEn: 'Nobix device', boardTypes: '*', features: GENERIC, sort: 99, status: 1 },
      serverError: 'Board types are invalid', serverField: 'boardTypes' });
    expect(w.find('#pm-key').attributes('disabled')).toBeDefined();
    expect(w.text()).toContain('Board types are invalid');
    await w.find('form').trigger('submit');
    expect(w.emitted('submit')[0][0]).toMatchObject({ id: 2, productKey: 'generic', features: GENERIC });
  });
});

describe('Products page', () => {
  const PAGE = [
    { id: 1, productKey: 'tinybot', nameEn: 'TinyBot', nameBn: 'টাইনিবট', boardTypes: 'tinybot,tinybot-*', features: PRODUCTS[0].features, sort: 1, status: 1 },
    { id: 2, productKey: 'generic', nameEn: 'Nobix device', nameBn: 'নোবিক্স ডিভাইস', boardTypes: '*', features: GENERIC, sort: 99, status: 1 },
  ];
  beforeEach(() => {
    resetRobot();
    vi.clearAllMocks();
    i18n.global.locale = 'en';
    api.product.getProductPage.mockImplementation((params, cb) => cb({ data: { code: 0, data: { total: PAGE.length, list: PAGE } } }));
    api.product.getProductList.mockImplementation((cb) => cb({ data: { code: 0, data: PRODUCTS } }));
  });

  async function page() {
    const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
    const confirm = vi.fn(() => Promise.resolve('confirm'));
    const w = mount(ProductManagement, { global: { plugins: [i18n, kit], mocks: { $message: message, $confirm: confirm }, stubs: { teleport: true } } });
    await flushPromises();
    return { w, message, confirm };
  }

  it('lists products with names, key, boards, feature count and status; generic cannot be deleted', async () => {
    const { w } = await page();
    expect(api.product.getProductPage).toHaveBeenCalledWith({ page: 1, limit: 10, keywords: '' }, expect.any(Function), expect.any(Function));
    const text = w.text();
    expect(text).toContain('টাইনিবট');
    expect(text).toContain('tinybot, tinybot-*');
    expect(text).toContain('5 features');
    const rows = w.findAll('tbody tr');
    const del = (row) => row.findAll('button').find((b) => b.text().includes('Delete'));
    expect(del(rows[1]).attributes('disabled')).toBeDefined();
    expect(del(rows[0]).attributes('disabled')).toBeUndefined();
  });

  it('shows the server message when a save is refused', async () => {
    api.product.addProduct.mockImplementation((body, cb, fail) => fail({ data: { code: 10207, msg: 'Product key already exists' } }));
    const { w, message } = await page();
    await w.findAll('button').find((b) => b.text().includes('New product')).trigger('click');
    await flushPromises();
    await w.find('#pm-key').setValue('tinybot');
    await w.find('#pm-name-en').setValue('Again');
    await w.find('#pm-boards').setValue('x-*');
    await w.find('#product-sheet-form').trigger('submit');
    await flushPromises();
    expect(api.product.addProduct).toHaveBeenCalled();
    expect(message.error).toHaveBeenCalledWith('Product key already exists');
    expect(w.find('.pm-sheet__server').text()).toBe('Product key already exists');
  });

  it('deletes after a danger confirm', async () => {
    api.product.deleteProducts.mockImplementation((ids, cb) => cb({ data: { code: 0 } }));
    const { w, confirm } = await page();
    await w.findAll('tbody tr')[0].findAll('button').find((b) => b.text().includes('Delete')).trigger('click');
    await flushPromises();
    expect(confirm.mock.calls[0][2]).toMatchObject({ danger: true });
    expect(api.product.deleteProducts).toHaveBeenCalledWith([1], expect.any(Function), expect.any(Function));
  });
});

describe('My robots: product tag', () => {
  const AGENTS = [{ id: 'a1', agentName: 'TinyBot', deviceCount: 2, lastConnectedAt: NOW }];
  function wire(devices) {
    api.agent.getAgentList.mockImplementation((cb) => cb({ data: { code: 0, data: AGENTS } }));
    api.device.getAgentBindDevices.mockImplementation((id, cb) => cb({ data: { code: 0, data: devices } }));
    api.device.getDeviceStatus.mockImplementation((id, cb) => cb({ data: { code: 0, data: '{}' } }));
    api.product.getProductList.mockImplementation((cb) => cb({ data: { code: 0, data: PRODUCTS } }));
  }
  async function mountPage() {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }] });
    router.push('/robots');
    await router.isReady();
    const w = mount(Robots, { attachTo: document.body, global: { plugins: [i18n, kit, router] } });
    await flushPromises();
    return w;
  }
  beforeEach(() => { resetRobot(); vi.clearAllMocks(); i18n.global.locale = 'en'; });
  afterEach(() => { document.body.innerHTML = ''; });

  it('tags each robot with its product, without product headings when there is one product', async () => {
    wire([{ id: 'd1', alias: 'Desk', macAddress: '28:84:85:00:00:01', board: 'tinybot', lastConnectedAt: NOW }]);
    const w = await mountPage();
    expect(w.find('.rb-row__product').text()).toBe('TinyBot');
    expect(w.find('.rb-row--product').exists()).toBe(false);
    expect(robot.productKey).toBe('tinybot');
  });

  it('groups by product (Bangla names in Bangla) when more than one product is present', async () => {
    wire([
      { id: 'd2', alias: 'Study', macAddress: '28:84:85:00:00:02', board: 'box', lastConnectedAt: NOW, productKey: 'generic', productName: 'Nobix device', productNameBn: 'নোবিক্স ডিভাইস', features: GENERIC },
      { id: 'd1', alias: 'Desk', macAddress: '28:84:85:00:00:01', board: 'tinybot', lastConnectedAt: NOW, productKey: 'tinybot', productName: 'TinyBot', productNameBn: 'টাইনিবট' },
    ]);
    i18n.global.locale = 'bn';
    const w = await mountPage();
    const heads = w.findAll('.rb-row--product').map((h) => h.text());
    expect(heads).toEqual(['টাইনিবট', 'নোবিক্স ডিভাইস']);
    expect(w.findAll('.rb-row__product').map((t) => t.text())).toEqual(['টাইনিবট', 'নোবিক্স ডিভাইস']);
    // a generic device has no TinyBot face
    expect(w.findAll('.rb-row__device')).toHaveLength(1);
  });
});
