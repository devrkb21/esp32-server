<template>
  <TbSection :title="$t('robot.sec.firmware')" :description="$t('robot.fw.desc')">
    <template #actions><TbSync v-bind="robot.syncOf('auto')" /></template>

    <div class="rb-fw">
      <div class="rb-fw__version">
        <p class="rb-fw__label">{{ $t('companion.firmware.installed') }}</p>
        <p class="rb-fw__big tb-num">{{ installed || $t('companion.firmware.unknown') }}</p>
        <TbTag v-if="badge" :ink="badge.ink" mark>{{ badge.text }}</TbTag>
      </div>

      <dl class="rb-fw__facts">
        <div v-if="latest">
          <dt>{{ $t('companion.firmware.latest') }}</dt>
          <dd class="tb-num">{{ latest.version }}</dd>
        </div>
        <div>
          <dt>{{ $t('companion.firmware.autoUpdate') }}</dt>
          <dd>
            <TbSwitch v-if="autoUpdate !== null" :model-value="autoUpdate" :disabled="robot.savingAuto || busy"
              :aria-label="$t('companion.firmware.autoUpdate')" @change="(v) => robot.setAutoUpdate(v)" />
            <TbButton v-else variant="quiet" size="s" :to="robot.agentId ? { path: '/device-management', query: { agentId: robot.agentId } } : '/robots'" icon-after="chevron-right">{{ $t('companion.firmware.autoUpdateLink') }}</TbButton>
          </dd>
        </div>
      </dl>

      <p class="rb-note">{{ autoUpdate === false ? $t('companion.firmware.autoUpdateOff') : $t('companion.firmware.autoUpdateHint') }}</p>

      <div v-if="note" class="rb-fw__note" :class="`is-${note.tone}`" :role="note.tone === 'danger' ? 'alert' : 'status'" aria-live="polite">
        <TbLoading v-if="busy" />
        <TbIcon v-else :name="note.icon" :size="18" />
        <span class="rb-fw__notetext">{{ note.text }}</span>
        <TbButton v-if="!busy" variant="quiet" size="s" @click="robot.dismissUpdate()">{{ $t('companion.firmware.dismiss') }}</TbButton>
      </div>
      <p v-else-if="!robot.online" class="rb-note">{{ $t('companion.firmware.offline') }}</p>

      <footer class="rb-foot rb-fw__foot">
        <TbButton variant="primary" icon="update" :loading="busy" :disabled="!canUpdate" @click="robot.confirmUpdate()">{{ $t('companion.firmware.updateNow') }}</TbButton>
      </footer>
    </div>
  </TbSection>
</template>

<script>
import { PHASE, currentFirmware, isUpdateBusy, latestFirmware, updateAvailable } from '@/utils/firmwareUpdate.mjs';

// Firmware: the installed and newest version, the Auto update switch (device list API) and
// "Update now" (companion command {type: 'update'}), then the wait until TinyBot is back.
export default {
  name: 'RobotFirmware',
  inject: ['robot'],
  computed: {
    device() { return this.robot.fwDevice; },
    state() { return this.robot.fwUpdate || { phase: PHASE.idle }; },
    installed() { return currentFirmware(this.robot.view, this.device && this.device.appVersion); },
    latest() { return this.robot.fwLatest ? latestFirmware(this.robot.fwLatest) : null; },
    autoUpdate() { return this.device ? Number(this.device.autoUpdate) === 1 : null; },
    available() { return this.latest ? updateAvailable(this.installed, this.latest.version) : null; },
    busy() { return isUpdateBusy(this.state); },
    canUpdate() { return !this.busy && this.robot.online && this.autoUpdate !== false; },
    badge() {
      if (this.busy) return { ink: 'routine', text: this.$t('companion.firmware.updatingBadge') };
      if (this.available === true) return { ink: 'warn', text: this.$t('companion.firmware.available') };
      if (this.available === false) return { ink: 'ok', text: this.$t('companion.firmware.upToDate') };
      return null;
    },
    note() {
      const s = this.state;
      switch (s.phase) {
        case PHASE.sending:
        case PHASE.sent:
        case PHASE.waiting:
          return { tone: 'info', icon: 'update', text: this.$t('companion.firmware.updating') };
        case PHASE.updated:
          return { tone: 'ok', icon: 'check', text: this.$t('companion.firmware.updated', { version: s.toVersion }) };
        case PHASE.current:
          return { tone: 'ok', icon: 'check', text: this.$t('companion.firmware.current') };
        case PHASE.timeout:
          return { tone: 'warn', icon: 'warning', text: this.$t('companion.firmware.timeout') };
        case PHASE.failed:
          return { tone: 'danger', icon: 'warning', text: (s.error && s.error.data && s.error.data.msg) || this.$t('companion.firmware.failed') };
        default:
          return null;
      }
    },
  },
  watch: {
    // read the version from the device list again once TinyBot is back
    'state.phase'(phase) { if (phase === PHASE.updated || phase === PHASE.current) this.robot.loadDevice(); },
  },
};
</script>

<style>
.rb-fw { display: grid; gap: var(--tb-s4); grid-template-columns: minmax(0, 1fr); }
.rb-fw__version { display: flex; align-items: baseline; gap: 6px var(--tb-s4); flex-wrap: wrap; }
.rb-fw__label { width: 100%; font-size: var(--tb-fs-14); font-weight: 600; color: var(--tb-ink-2); }
.rb-fw__big { font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-48); line-height: 1; letter-spacing: -.01em; overflow-wrap: anywhere; }
.rb-fw__facts { margin: 0; display: grid; border-top: 1px solid var(--tb-rule); }
.rb-fw__facts div { display: flex; align-items: center; justify-content: space-between; gap: var(--tb-s4); min-height: 52px; border-bottom: 1px solid var(--tb-rule-soft); }
.rb-fw__facts dt { font-weight: 600; font-size: var(--tb-fs-14); color: var(--tb-ink-2); }
.rb-fw__facts dd { margin: 0; font-weight: 600; }
.rb-fw__note { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 0; border-top: 2px solid var(--tb-ink-2); border-bottom: 1px solid var(--tb-rule-soft); font-size: var(--tb-fs-14); }
.rb-fw__note.is-ok { border-top-color: var(--tb-ok); }
.rb-fw__note.is-warn { border-top-color: var(--tb-warn); }
.rb-fw__note.is-danger { border-top-color: var(--tb-danger); color: var(--tb-danger); }
.rb-fw__notetext { flex: 1; min-width: 12ch; }
.rb-fw__foot { justify-content: flex-start; }
@media (min-width: 900px) {
  .rb-fw { grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); column-gap: var(--tb-s8); align-items: start; }
  .rb-fw__version { grid-row: span 2; }
  .rb-fw__note, .rb-fw > .rb-note, .rb-fw__foot { grid-column: 2; }
}
</style>
