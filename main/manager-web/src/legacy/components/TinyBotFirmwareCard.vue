<template>
  <article class="nx-card fw-card">
    <header class="nx-card__header">
      <h2 class="nx-headline">{{ $t('companion.firmware.title') }}</h2>
      <span v-if="badge" class="nx-badge" :class="badge.cls">{{ badge.text }}</span>
    </header>

    <dl class="nx-kv fw-kv">
      <dt>{{ $t('companion.firmware.installed') }}</dt>
      <dd class="nx-mono">{{ installed || $t('companion.firmware.unknown') }}</dd>
      <template v-if="latest">
        <dt>{{ $t('companion.firmware.latest') }}</dt>
        <dd class="nx-mono">{{ latest.version }}</dd>
      </template>
      <dt>{{ $t('companion.firmware.autoUpdate') }}</dt>
      <dd>
        <el-switch v-if="autoUpdate !== null" :value="autoUpdate" :disabled="savingAuto || busy"
          :aria-label="$t('companion.firmware.autoUpdate')" @change="setAutoUpdate" />
        <el-button v-else type="text" class="fw-link" @click="openDeviceList">
          {{ $t('companion.firmware.autoUpdateLink') }}
        </el-button>
      </dd>
    </dl>

    <p class="fw-help">
      {{ autoUpdate === false ? $t('companion.firmware.autoUpdateOff') : $t('companion.firmware.autoUpdateHint') }}
    </p>

    <!-- Progress and result of "Update now" -->
    <div v-if="note" class="fw-note" :class="'is-' + note.tone" :role="note.tone === 'danger' ? 'alert' : 'status'"
      aria-live="polite">
      <i :class="note.icon" aria-hidden="true"></i>
      <span class="fw-note__text">{{ note.text }}</span>
      <el-button v-if="!busy" type="text" size="small" @click="dismiss">{{ $t('companion.firmware.dismiss') }}</el-button>
    </div>
    <p v-else-if="!online" class="fw-help">{{ $t('companion.firmware.offline') }}</p>

    <footer class="nx-card__footer">
      <el-button type="primary" :loading="busy" :disabled="!canUpdate" @click="confirmUpdate">
        {{ $t('companion.firmware.updateNow') }}
      </el-button>
    </footer>
  </article>
</template>

<script>
import Api from '@/apis/api';
import {
  PHASE,
  currentFirmware,
  isUpdateBusy,
  latestFirmware,
  updateAvailable,
} from '@/utils/firmwareUpdate.mjs';

// "Firmware" card of the companion screens: installed / newest version, the Auto update switch
// and "Update now" (companion command {type: 'update'}), then waits until TinyBot is back.
export default {
  name: 'TinyBotFirmwareCard',
  props: {
    deviceId: { type: String, required: true },
    // agent the device belongs to (device list API); '' when unknown
    agentId: { type: String, default: '' },
    // latest companion view of the page (polled by the page)
    dev: { type: Object, default: null },
    // state of the page's update flow (createUpdateFlow): the page keeps it across tabs
    updateState: { type: Object, default: () => ({ phase: PHASE.idle }) },
  },
  // update: the user confirmed "Update now"; dismiss: close the result note;
  // app-version: the device list's firmware version (fallback when TinyBot did not report one)
  data() {
    return {
      device: null,
      latest: null,
      savingAuto: false,
    };
  },
  computed: {
    online() {
      return !!(this.dev && this.dev.online);
    },
    installed() {
      return currentFirmware(this.dev, this.device && this.device.appVersion);
    },
    // true / false from the device list; null when it could not be read
    autoUpdate() {
      return this.device ? this.device.autoUpdate === 1 : null;
    },
    available() {
      return this.latest ? updateAvailable(this.installed, this.latest.version) : null;
    },
    busy() {
      return isUpdateBusy(this.updateState);
    },
    canUpdate() {
      return !this.busy && this.online && this.autoUpdate !== false;
    },
    badge() {
      if (this.busy) return { cls: 'nx-badge--info', text: this.$t('companion.firmware.updatingBadge') };
      if (this.available === true) return { cls: 'nx-badge--warning', text: this.$t('companion.firmware.available') };
      if (this.available === false) return { cls: 'nx-badge--success', text: this.$t('companion.firmware.upToDate') };
      return null;
    },
    note() {
      const s = this.updateState || {};
      switch (s.phase) {
        case PHASE.sending:
        case PHASE.sent:
        case PHASE.waiting:
          return { tone: 'info', icon: 'el-icon-loading', text: this.$t('companion.firmware.updating') };
        case PHASE.updated:
          return { tone: 'success', icon: 'el-icon-circle-check', text: this.$t('companion.firmware.updated', { version: s.toVersion }) };
        case PHASE.current:
          return { tone: 'success', icon: 'el-icon-circle-check', text: this.$t('companion.firmware.current') };
        case PHASE.timeout:
          return { tone: 'warning', icon: 'el-icon-warning-outline', text: this.$t('companion.firmware.timeout') };
        case PHASE.failed:
          return {
            tone: 'danger',
            icon: 'el-icon-warning-outline',
            text: (s.error && s.error.data && s.error.data.msg) || this.$t('companion.firmware.failed'),
          };
        default:
          return null;
      }
    },
  },
  watch: {
    // reload the version from the device list once TinyBot is back
    'updateState.phase'(phase) {
      if (phase === PHASE.updated || phase === PHASE.current) this.loadDevice();
    },
  },
  created() {
    this.loadDevice();
    this.loadLatest();
  },
  methods: {
    loadDevice() {
      if (!this.agentId) return;
      Api.device.getAgentBindDevices(this.agentId, ({ data }) => {
        if (data && data.code === 0 && Array.isArray(data.data)) {
          this.device = data.data.find((d) => d.id === this.deviceId) || null;
          this.$emit('app-version', (this.device && this.device.appVersion) || '');
        }
      }, () => {});
    },
    // The OTA list is for super admins only: everyone else does not see the newest version
    loadLatest() {
      const user = this.$store.getters.getUserInfo || {};
      if (!user.superAdmin) return;
      Api.ota.getOtaList({ page: 1, limit: 100, orderField: 'update_date', order: 'desc' }, (res) => {
        const body = res && res.data;
        if (body && body.code === 0 && body.data) this.latest = latestFirmware(body.data.list);
      });
    },
    setAutoUpdate(on) {
      if (!this.device) return;
      const previous = this.device.autoUpdate;
      this.device.autoUpdate = on ? 1 : 0;
      this.savingAuto = true;
      Api.device.updateDeviceInfo(this.deviceId, { autoUpdate: on ? 1 : 0 }, ({ data }) => {
        this.savingAuto = false;
        if (data && data.code === 0) {
          this.$message.success(on ? this.$t('device.autoUpdateEnabled') : this.$t('device.autoUpdateDisabled'));
          return;
        }
        this.device.autoUpdate = previous;
        this.$message.error((data && data.msg) || this.$t('companion.requestFailed'));
      }, () => {
        this.savingAuto = false;
        this.device.autoUpdate = previous;
        this.$message.error(this.$t('companion.requestFailed'));
      });
    },
    openDeviceList() {
      if (this.agentId) {
        this.$router.push({ name: 'DeviceManagement', query: { agentId: this.agentId } });
      } else {
        this.$router.push('/home');
      }
    },
    confirmUpdate() {
      if (!this.canUpdate) return;
      this.$confirm(this.$t('companion.firmware.confirm'), this.$t('companion.firmware.confirmTitle'), {
        confirmButtonText: this.$t('companion.firmware.updateNow'),
        cancelButtonText: this.$t('button.cancel'),
        type: 'warning',
      }).then(() => {
        this.$emit('update');
      }).catch(() => {});
    },
    dismiss() {
      this.$emit('dismiss');
    },
  },
};
</script>

<style lang="scss" scoped>
.fw-card {
  display: flex;
  flex-direction: column;
}

.fw-kv {
  align-items: center;
}

.fw-link {
  padding: 0;
  white-space: normal;
  text-align: left;
}

.fw-help {
  margin: var(--nx-space-3) 0 0;
  font-size: var(--nx-text-footnote);
  color: var(--nx-text-2);
}

.fw-note {
  display: flex;
  align-items: center;
  gap: var(--nx-space-2);
  margin-top: var(--nx-space-3);
  padding: var(--nx-space-2) var(--nx-space-3);
  border-radius: var(--nx-radius);
  font-size: var(--nx-text-footnote);
  background: var(--nx-info-soft);
  color: var(--nx-info);

  &__text {
    flex: 1;
    min-width: 0;
    color: var(--nx-text);
  }

  &.is-success {
    background: var(--nx-success-soft);
    color: var(--nx-success);
  }

  &.is-warning {
    background: var(--nx-warning-soft);
    color: var(--nx-warning);
  }

  &.is-danger {
    background: var(--nx-danger-soft);
    color: var(--nx-danger);
  }
}
</style>
