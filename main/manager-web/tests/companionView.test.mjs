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

describe('companion page robot pages and commands', () => {
  it('hides a page optimistically and reverts when the save fails', () => {
    const { vm, Api } = makeVm(deviceView());
    expect(vm.pages.games).toBe(true);
    vm.setPage('games', false);
    expect(vm.pages.games).toBe(false);
    const [, patch, , fail] = Api.companion.updateCompanionConfig.mock.calls[0];
    expect(patch).toEqual({ settings: { pages: { games: false } } });
    fail({ data: { msg: 'nope' } });
    return Promise.resolve().then(() => {
      expect(vm.pages.games).toBe(true);
      expect(vm.$message.error).toHaveBeenCalled();
    });
  });

  it('never turns off the last page that is still on', () => {
    const pages = { clock: true, weather: false, prayer: false, focus: false, games: false,
      breathe: false, story: false, night: false, status: false, bond: false };
    const { vm, Api } = makeVm(deviceView({ settings: { ...deviceView().settings, pages } }));
    vm.setPage('clock', false);
    expect(Api.companion.updateCompanionConfig).not.toHaveBeenCalled();
  });

  it('sends the stop and night commands', () => {
    const { vm, Api } = makeVm(deviceView());
    vm.sendCommand('night', 'on', 'ok', 'night:on');
    expect(Api.companion.sendCompanionCommand.mock.calls[0].slice(0, 3)).toEqual(['dev1', 'night', 'on']);
    expect(vm.quickActions.some((a) => a.type === 'stop' && a.icon === 'el-icon-video-pause')).toBe(true);
  });
});

describe('companion page volume, display and night light', () => {
  it('shows the robot volume read-only when the app does not set it', () => {
    const { vm } = makeVm(deviceView({ stats: { volume: 45 } }));
    expect(vm.robotVolume).toBe(45);
    expect(vm.robotVolumeText).toBe('TinyBot now: 45%');
    expect(vm.forms.sound).toMatchObject({ controlVolume: false, volume: 45 });
  });

  it('uses the stored volume when the app sets it and names it in the saved toast', () => {
    const view = deviceView({ stats: { volume: 100 } });
    view.settings.volume = 50;
    const { vm, Api } = makeVm(view);
    expect(vm.forms.sound).toMatchObject({ controlVolume: true, volume: 50 });
    vm.forms.sound.volume = 80;
    vm.saveSection('sound');
    const [, patch, ok] = Api.companion.updateCompanionConfig.mock.calls[0];
    expect(patch).toEqual({ settings: { volume: 80, sounds: true } });
    const saved = deviceView({ stats: { volume: 80 } });
    saved.settings.volume = 80;
    ok({ data: { data: saved } });
    expect(vm.$message.success).toHaveBeenCalledWith('Volume set to 80%');
  });

  it('keeps the generic saved toast when only the sound effects change', () => {
    const { vm, Api } = makeVm(deviceView());
    vm.forms.sound.sounds = false;
    vm.saveSection('sound');
    Api.companion.updateCompanionConfig.mock.calls[0][2]({ data: { data: deviceView() } });
    expect(vm.$message.success).toHaveBeenCalledWith('companion.saved');
  });

  it('fills the display timeouts with defaults and saves them', () => {
    const { vm, Api } = makeVm(deviceView());
    expect(vm.forms.display).toEqual({ dim_after_min: 3, off_after_min: 20 });
    expect(vm.isDirty('display')).toBe(false);
    vm.pickMinutes('dim', 0);
    vm.pickMinutes('off', 60);
    expect(vm.isDirty('display')).toBe(true);
    vm.saveSection('display');
    expect(Api.companion.updateCompanionConfig.mock.calls[0][1])
      .toEqual({ settings: { display: { dim_after_min: 0, off_after_min: 60 } } });
  });

  it('reads saved display values and switches odd values to Custom', () => {
    const view = deviceView();
    view.settings.display = { dim_after_min: 7, off_after_min: 0 };
    const { vm } = makeVm(view);
    expect(vm.pickerChoice('dim')).toBe('custom');
    expect(vm.pickerChoice('off')).toBe(0);
    vm.pickMinutes('off', 'custom');
    expect(vm.pickerChoice('off')).toBe('custom');
    expect(vm.forms.display.off_after_min).toBe(0);
    vm.revertSection('display');
    expect(vm.pickerChoice('off')).toBe(0);
  });

  it('refuses display timeouts out of range or turning off before dimming', () => {
    const { vm, Api } = makeVm(deviceView());
    vm.forms.display.off_after_min = 601;
    vm.saveSection('display');
    vm.forms.display.off_after_min = 2;
    vm.saveSection('display');
    vm.forms.display.off_after_min = undefined;
    vm.saveSection('display');
    expect(Api.companion.updateCompanionConfig).not.toHaveBeenCalled();
    expect(vm.$message.warning).toHaveBeenCalledTimes(3);
  });

  it('saves the night light minutes with the night section', () => {
    const { vm, Api } = makeVm(deviceView());
    expect(vm.forms.night.light_minutes).toBe(0);
    expect(vm.pickerChoice('light')).toBe(0);
    vm.pickMinutes('light', 45);
    vm.saveSection('night');
    expect(Api.companion.updateCompanionConfig.mock.calls[0][1].settings.night).toMatchObject({ light: false, light_minutes: 45 });
  });

  it('refuses night light minutes above the limit', () => {
    const { vm, Api } = makeVm(deviceView());
    vm.forms.night.light_minutes = 700;
    vm.saveSection('night');
    expect(Api.companion.updateCompanionConfig).not.toHaveBeenCalled();
  });

  it('starts the Focus tile with the saved work minutes', () => {
    const { vm, Api } = makeVm(deviceView({ pomodoro: { work_min: 40, short_break_min: 5, long_break_min: 15, rounds: 4 } }));
    const focus = vm.quickActions.find((a) => a.focus);
    expect(focus.type).toBe('pomodoro');
    expect(vm.focusMinutes).toBe(40);
    vm.sendCommand(focus.type, vm.actionArg(focus), null, focus.type + focus.arg);
    expect(Api.companion.sendCompanionCommand.mock.calls[0].slice(0, 3)).toEqual(['dev1', 'pomodoro', '40']);
  });
});
