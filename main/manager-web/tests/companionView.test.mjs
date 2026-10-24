import Vue from 'vue';
import { parseComponent } from 'vue-template-compiler';
import { describe, expect, it, vi } from 'vitest';
import source from '../src/views/CompanionManagement.vue?raw';
import * as utils from '../src/utils/companion.mjs';

// No Vue SFC plugin in the unit-test runner: load the real component script with its imports
// replaced (utils injected, API stubbed), keeping Vue's reactivity.
const script = parseComponent(source).script.content
  .replace(/^import[\s\S]*?from\s+'[^']+';$/gm, '')
  .replace('export default', 'return');
const prelude = `const { ${Object.keys(utils).join(', ')} } = utils;`;

function makeVm(view) {
  const Api = {
    companion: {
      getCompanion: vi.fn(),
      updateCompanionConfig: vi.fn(),
      sendCompanionCommand: vi.fn(),
      sendCompanionMessage: vi.fn(),
      getCompanionMessages: vi.fn(),
      getCompanionEvents: vi.fn(),
      geocodeCity: vi.fn(),
    },
  };
  const component = new Function('Api', 'HeaderBar', 'VersionFooter', 'utils', prelude + script)(Api, {}, {}, utils);
  const vm = new Vue({
    ...component,
    mixins: [{
      beforeCreate() {
        this.$route = { query: { deviceId: 'dev1', agentId: 'agent1' } };
        this.$t = (key) => key;
        this.$te = () => false;
        this.$message = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
      },
    }],
  });
  vm.applyDevice(view);
  return { vm, Api };
}

function deviceView(overrides = {}) {
  return {
    id: 'aa:bb:cc:dd:ee:ff',
    name: 'TinyBot',
    online: true,
    last_seen: 0,
    stats: { volume: 60 },
    settings: {
      volume: null, sounds: true, owner_name: '',
      night: { enabled: true, start: '21:30', end: '06:30', dim: true, lullaby: true, light: false },
      care: { enabled: true, lonely_after_min: 180 },
    },
    pomodoro: { work_min: 25, short_break_min: 5, long_break_min: 15, rounds: 4 },
    alarms: [{ id: 'a1', time: '06:30', days: 62, label: 'Wake up', enabled: true, snooze_min: 5, say: '', say_audio: null }],
    reminders: [],
    prayer: { enabled: false, days: [] },
    weather: { ok: false },
    events: [],
    messages: [],
    commands: [],
    ...overrides,
  };
}

describe('companion page forms', () => {
  it('fills the forms from the server and derives the volume mode', () => {
    const { vm } = makeVm(deviceView());
    expect(vm.forms.pomodoro.work_min).toBe(25);
    expect(vm.forms.sound).toEqual({ controlVolume: false, volume: 60, sounds: true });
    expect(vm.isDirty('pomodoro')).toBe(false);
  });

  it('keeps unsaved edits when the background refresh brings new data', () => {
    const { vm } = makeVm(deviceView());
    vm.forms.pomodoro.work_min = 50;
    vm.applyDevice(deviceView({ pomodoro: { work_min: 30, short_break_min: 5, long_break_min: 15, rounds: 4 }, name: 'Bot2' }));
    expect(vm.forms.pomodoro.work_min).toBe(50);
    expect(vm.isDirty('pomodoro')).toBe(true);
    expect(vm.forms.robot.name).toBe('Bot2');
  });

  it('saves a section as a partial config update', () => {
    const { vm, Api } = makeVm(deviceView());
    vm.forms.sound.controlVolume = true;
    vm.forms.sound.volume = 80;
    vm.saveSection('sound');
    const [deviceId, patch] = Api.companion.updateCompanionConfig.mock.calls[0];
    expect(deviceId).toBe('dev1');
    expect(patch).toEqual({ settings: { volume: 80, sounds: true } });
  });

  it('sends the whole alarm list without server-only fields when adding an alarm', () => {
    const { vm, Api } = makeVm(deviceView());
    vm.openAlarm(null);
    vm.alarmDialog.form.time = '07:15';
    vm.saveAlarm();
    const patch = Api.companion.updateCompanionConfig.mock.calls[0][1];
    expect(patch.alarms).toHaveLength(2);
    expect(patch.alarms[0]).toEqual({ id: 'a1', time: '06:30', days: 62, label: 'Wake up', enabled: true, snooze_min: 5, say: '' });
    expect(patch.alarms[1]).toMatchObject({ time: '07:15', days: 127 });
    expect(patch.alarms[1]).not.toHaveProperty('id');
  });

  it('refuses to save an alarm without a time', () => {
    const { vm, Api } = makeVm(deviceView());
    vm.openAlarm(null);
    vm.alarmDialog.form.time = null;
    vm.saveAlarm();
    expect(Api.companion.updateCompanionConfig).not.toHaveBeenCalled();
    expect(vm.$message.warning).toHaveBeenCalled();
  });
});
