import Vue from 'vue';
import { compile, parseComponent } from 'vue-template-compiler';
import { describe, expect, it, vi } from 'vitest';
import source from '../src/components/TinyBotLook.vue?raw';
import * as face from '../src/utils/faceLook.mjs';

// Same approach as themeGeneratorView.test.mjs: run the real component script with its imports
// replaced (face module injected, API stubbed).
const sfc = parseComponent(source);
const script = sfc.script.content
  .replace(/^import[\s\S]*?from\s+'[^']+';$/gm, '')
  .replace('export default', 'return');
const prelude = `const { ${Object.keys(face).join(', ')} } = face;`;

function view(look, online = true) {
  return { id: 'dev1', online, settings: { look } };
}

function makeVm({ deviceId = 'dev1', get, put } = {}) {
  const Api = {
    companion: {
      getCompanion: vi.fn(get || ((id, ok) => ok({ data: { code: 0, data: view({ mouth: 'smile' }) } }))),
      updateCompanionConfig: vi.fn(put || ((id, patch, ok) => ok({ data: { code: 0, data: view(patch.settings.look) } }))),
    },
  };
  const component = new Function('Api', 'face', 'TinyBotLiveScreen', prelude + script)(Api, face, {});
  const vm = new Vue({
    ...component,
    propsData: { deviceId },
    mixins: [{
      beforeCreate() {
        this.$t = (key) => key;
        this.$message = { success: vi.fn(), error: vi.fn() };
      },
    }],
  });
  return { vm, Api };
}

describe('TinyBotLook template', () => {
  it('compiles without errors', () => {
    expect(compile(sfc.template.content).errors).toEqual([]);
  });
});

describe('TinyBotLook state', () => {
  it('loads the saved look, filling missing keys with the original face', () => {
    const { vm } = makeVm();
    vm.load();
    expect(vm.form).toEqual({ ...face.defaultLook(), mouth: 'smile' });
    expect(vm.dirty).toBe(false);
    expect(vm.canSave).toBe(false);
    expect(vm.online).toBe(true);
  });

  it('enables save only when changed and sends the whole look as a partial settings patch', async () => {
    const { vm, Api } = makeVm();
    vm.load();
    vm.form.size = 120;
    vm.form.blush = true;
    expect(vm.dirty).toBe(true);
    expect(vm.canSave).toBe(true);
    await expect(vm.save()).resolves.toBe(true);
    const [id, patch] = Api.companion.updateCompanionConfig.mock.calls[0];
    expect(id).toBe('dev1');
    expect(patch).toEqual({ settings: { look: { ...face.defaultLook(), mouth: 'smile', size: 120, blush: true } } });
    expect(vm.dirty).toBe(false);
    expect(vm.$message.success).toHaveBeenCalledWith('look.saved');
  });

  it('keeps the edits (still unsaved) when saving fails', async () => {
    const { vm } = makeVm({ put: (id, patch, ok, fail) => fail({ data: { msg: 'nope' } }) });
    vm.load();
    vm.form.eyes = 'pupil';
    await expect(vm.save()).resolves.toBe(false);
    expect(vm.form.eyes).toBe('pupil');
    expect(vm.dirty).toBe(true);
    expect(vm.$message.error).toHaveBeenCalledWith('nope');
  });

  it('reset goes back to the original face, still to be saved', () => {
    const { vm } = makeVm();
    vm.load();
    vm.reset();
    expect(vm.form).toEqual(face.defaultLook());
    expect(vm.isDefault).toBe(true);
    expect(vm.dirty).toBe(true);
  });

  it('without a robot it previews but cannot save', () => {
    const { vm, Api } = makeVm({ deviceId: '' });
    vm.load();
    vm.form.mouth = 'cat';
    expect(Api.companion.getCompanion).not.toHaveBeenCalled();
    expect(vm.canSave).toBe(false);
  });

  it('shows a load error and blocks saving', () => {
    const { vm } = makeVm({ get: (id, ok, fail) => fail({}) });
    vm.load();
    vm.form.mouth = 'cat';
    expect(vm.loadError).toBe('look.loadFailed');
    expect(vm.canSave).toBe(false);
  });
});

describe('TinyBotLook chat font', () => {
  it('shows one sample tile per firmware font', () => {
    const tpl = sfc.template.content;
    expect(tpl).toMatch(/v-for="f in chatFonts"/);
    expect(tpl).toMatch(/look\.fontLabel/);
    expect(tpl).toMatch(/look\.fontApprox/);
    const { vm } = makeVm();
    expect(vm.chatFonts.map((f) => f.id)).toEqual(['pixel', 'pixel_large', 'clean_small', 'clean', 'clean_large']);
    expect(vm.fontSample).toBe("Hello! I'm TinyBot");
  });

  it('saves the chosen font with the rest of the look', async () => {
    const { vm, Api } = makeVm();
    vm.load();
    expect(vm.form.chat_font).toBe('pixel');
    vm.form.chat_font = 'clean';
    expect(vm.dirty).toBe(true);
    await expect(vm.save()).resolves.toBe(true);
    const [, patch] = Api.companion.updateCompanionConfig.mock.calls[0];
    expect(patch).toEqual({ settings: { look: { ...face.defaultLook(), mouth: 'smile', chat_font: 'clean' } } });
    expect(vm.form.chat_font).toBe('clean');
    expect(vm.dirty).toBe(false);
  });

  it('loads a saved font and resets it to pixel', () => {
    const { vm } = makeVm({ get: (id, ok) => ok({ data: { code: 0, data: view({ chat_font: 'pixel_large' }) } }) });
    vm.load();
    expect(vm.form.chat_font).toBe('pixel_large');
    expect(vm.isDefault).toBe(false);
    vm.reset();
    expect(vm.form.chat_font).toBe('pixel');
    expect(vm.isDefault).toBe(true);
  });
});
