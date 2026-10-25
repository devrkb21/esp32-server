// Look page (src/views/look/Look.vue): ported from tests/legacy/tinybotLookView.test.mjs, which
// covered the old TinyBotLook dialog. Same behaviour: load the saved look (missing keys = the
// original face), save the whole look as one partial settings patch, keep edits on failure,
// reset, preview without a robot, block saving on a load error, the chat font tiles.
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as face from '../src/utils/faceLook.mjs';

const hoisted = vi.hoisted(() => ({
  Api: { companion: {}, device: {} },
  robot: null,
}));

vi.mock('@/apis/api', () => ({ default: hoisted.Api }));
vi.mock('@/shell/robot', async () => {
  const { reactive: r } = await import('vue');
  hoisted.robot = r({ deviceId: '', loaded: true, list: [] });
  return {
    robot: hoisted.robot,
    loadRobots: () => Promise.resolve([]),
    selectRobot: () => {},
    deviceIdFrom: (route) => (route && route.query && route.query.deviceId) || hoisted.robot.deviceId || '',
  };
});

const { default: kit } = await import('../src/kit/index.js');
const { default: Look } = await import('../src/views/look/Look.vue');

function view(look, online = true) {
  return { id: 'dev1', online, settings: { look } };
}

async function mountLook({ deviceId = 'dev1', get, put, tool } = {}) {
  hoisted.Api.companion.getCompanion = vi.fn(get || ((id, ok) => ok({ data: { code: 0, data: view({ mouth: 'smile' }) } })));
  hoisted.Api.companion.updateCompanionConfig = vi.fn(put || ((id, patch, ok) => ok({ data: { code: 0, data: view(patch.settings.look) } })));
  hoisted.Api.device.callDeviceToolOnce = vi.fn(tool || (() => new Promise(() => {})));
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { render: () => null } }] });
  await router.push(deviceId ? `/look?deviceId=${deviceId}` : '/look');
  await router.isReady();
  const message = { success: vi.fn(), error: vi.fn() };
  const wrapper = mount(Look, {
    global: {
      plugins: [router, kit],
      mocks: { $t: (key) => key, $message: message, $i18n: { locale: 'en' } },
    },
  });
  await flushPromises();
  return { wrapper, vm: wrapper.vm, Api: hoisted.Api, message };
}

beforeEach(() => {
  // jsdom draws nothing: the preview simply skips painting
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('Look state', () => {
  it('loads the saved look, filling missing keys with the original face', async () => {
    const { vm, Api } = await mountLook();
    expect(Api.companion.getCompanion).toHaveBeenCalledWith('dev1', expect.any(Function), expect.any(Function));
    expect(vm.form).toEqual({ ...face.defaultLook(), mouth: 'smile' });
    expect(vm.dirty).toBe(false);
    expect(vm.canSave).toBe(false);
    expect(vm.online).toBe(true);
    expect(vm.sync.state).toBe('applied');
  });

  it('enables save only when changed and sends the whole look as a partial settings patch', async () => {
    const { vm, Api, message } = await mountLook();
    vm.form.size = 120;
    vm.form.blush = true;
    expect(vm.dirty).toBe(true);
    expect(vm.canSave).toBe(true);
    expect(vm.sync.state).toBe('pending');
    await expect(vm.save()).resolves.toBe(true);
    const [id, patch] = Api.companion.updateCompanionConfig.mock.calls[0];
    expect(id).toBe('dev1');
    expect(patch).toEqual({ settings: { look: { ...face.defaultLook(), mouth: 'smile', size: 120, blush: true } } });
    expect(vm.dirty).toBe(false);
    expect(message.success).toHaveBeenCalledWith('lookPage.saved');
  });

  it('keeps the edits (still unsaved) when saving fails', async () => {
    const { vm, message } = await mountLook({ put: (id, patch, ok, fail) => fail({ data: { msg: 'nope' } }) });
    vm.form.eyes = 'pupil';
    await expect(vm.save()).resolves.toBe(false);
    expect(vm.form.eyes).toBe('pupil');
    expect(vm.dirty).toBe(true);
    expect(message.error).toHaveBeenCalledWith('nope');
  });

  it('reset goes back to the original face, still to be saved', async () => {
    const { vm } = await mountLook();
    vm.reset();
    expect(vm.form).toEqual(face.defaultLook());
    expect(vm.isDefault).toBe(true);
    expect(vm.dirty).toBe(true);
  });

  it('without a robot it previews but cannot save', async () => {
    const { vm, Api, wrapper } = await mountLook({ deviceId: '' });
    vm.form.mouth = 'cat';
    expect(Api.companion.getCompanion).not.toHaveBeenCalled();
    expect(vm.canSave).toBe(false);
    expect(vm.sync.state).toBe('off');
    expect(wrapper.text()).toContain('lookPage.noRobot');
  });

  it('shows a load error and blocks saving', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { vm, wrapper } = await mountLook({ get: (id, ok, fail) => fail({}) });
    vm.form.mouth = 'cat';
    expect(vm.loadError).toBe('lookPage.loadFailed');
    expect(vm.canSave).toBe(false);
    expect(vm.sync.state).toBe('error');
    expect(wrapper.find('[role="alert"]').text()).toContain('lookPage.loadFailed');
    warn.mockRestore();
  });

  it('an offline robot keeps its saved look pending and offers no live screen', async () => {
    const { vm } = await mountLook({ get: (id, ok) => ok({ data: { code: 0, data: view({}, false) } }) });
    expect(vm.online).toBe(false);
    expect(vm.sync.state).toBe('pending');
    expect(vm.viewOptions.find((o) => o.value === 'live').disabled).toBe(true);
  });
});

describe('Look controls', () => {
  it('offers every option and range of the firmware look', async () => {
    const { vm, wrapper } = await mountLook();
    for (const key of ['shape', 'eyes', 'mouth', 'blink', 'energy']) {
      expect(vm.opts(key).map((o) => o.value)).toEqual(face.LOOK_CHOICES[key]);
    }
    const sliders = wrapper.findAll('input[type="range"]');
    expect(sliders.map((s) => [Number(s.attributes('min')), Number(s.attributes('max'))]))
      .toEqual([face.LOOK_RANGES.size, face.LOOK_RANGES.spacing, face.LOOK_RANGES.height]);
    expect(sliders[0].attributes('step')).toBe('5');
    expect(wrapper.findAll('[role="switch"]').length).toBe(2); // blush, hands
    expect(vm.moodOptions.map((o) => o.value)).toEqual(face.MOODS);
  });

  it('the save bar rides over the editor only while there is something to save', async () => {
    const { vm, wrapper } = await mountLook();
    expect(wrapper.find('.look__savebar').classes()).toContain('is-idle');
    expect(wrapper.find('.look').classes()).not.toContain('is-dirty');
    vm.form.blush = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.look__savebar').classes()).not.toContain('is-idle');
    expect(wrapper.find('.look').classes()).toContain('is-dirty');
  });

  it('a pill click changes the look at once', async () => {
    const { vm, wrapper } = await mountLook();
    const cat = wrapper.findAll('button[role="radio"]').find((b) => b.text() === 'lookPage.mouth.cat');
    await cat.trigger('click');
    expect(vm.form.mouth).toBe('cat');
    expect(vm.dirty).toBe(true);
  });

  it('shows signed spacing and height values', async () => {
    const { vm } = await mountLook();
    expect(vm.signed(3)).toBe('+3');
    expect(vm.signed(0)).toBe('0');
    expect(vm.signed(-4)).toBe('−4');
  });
});

describe('Look chat font', () => {
  it('shows one sample tile per firmware font', async () => {
    const { vm, wrapper } = await mountLook();
    expect(vm.chatFonts.map((f) => f.id)).toEqual(['pixel', 'pixel_large', 'clean_small', 'clean', 'clean_large']);
    expect(vm.fontSample).toBe("Hello! I'm TinyBot");
    expect(wrapper.findAll('.look__font').length).toBe(5);
    expect(wrapper.text()).toContain('lookPage.fontApprox');
  });

  it('saves the chosen font with the rest of the look', async () => {
    const { vm, Api, wrapper } = await mountLook();
    expect(vm.form.chat_font).toBe('pixel');
    await wrapper.findAll('.look__font')[3].trigger('click');
    expect(vm.form.chat_font).toBe('clean');
    expect(vm.dirty).toBe(true);
    await expect(vm.save()).resolves.toBe(true);
    const [, patch] = Api.companion.updateCompanionConfig.mock.calls[0];
    expect(patch).toEqual({ settings: { look: { ...face.defaultLook(), mouth: 'smile', chat_font: 'clean' } } });
    expect(vm.form.chat_font).toBe('clean');
    expect(vm.dirty).toBe(false);
  });

  it('loads a saved font and resets it to pixel', async () => {
    const { vm } = await mountLook({ get: (id, ok) => ok({ data: { code: 0, data: view({ chat_font: 'pixel_large' }) } }) });
    expect(vm.form.chat_font).toBe('pixel_large');
    expect(vm.isDefault).toBe(false);
    vm.reset();
    expect(vm.form.chat_font).toBe('pixel');
    expect(vm.isDefault).toBe(true);
  });
});

describe('Look live screen', () => {
  it('asks the robot for its screen only after "Live from TinyBot" is chosen', async () => {
    const { vm, Api, wrapper } = await mountLook();
    expect(Api.device.callDeviceToolOnce).not.toHaveBeenCalled();
    vm.view = 'live';
    await flushPromises();
    expect(Api.device.callDeviceToolOnce).toHaveBeenCalledWith('dev1', 'self.screen.preview', { quality: 90 });
    expect(wrapper.findComponent({ name: 'LookLive' }).exists()).toBe(true);
    vm.view = 'preview';
    await flushPromises();
    expect(wrapper.findComponent({ name: 'LookLive' }).exists()).toBe(false);
  });

  it('shows the frame the robot returns', async () => {
    const jpeg = 'QUJDREVGR0g=';
    const { vm, wrapper } = await mountLook({ tool: () => Promise.resolve({ code: 0, data: { width: 128, height: 64, jpeg } }) });
    vm.view = 'live';
    await flushPromises();
    const img = wrapper.find('.look-live img');
    expect(img.exists()).toBe(true);
    expect(img.attributes('src')).toBe(`data:image/jpeg;base64,${jpeg}`);
    wrapper.unmount();
  });
});

