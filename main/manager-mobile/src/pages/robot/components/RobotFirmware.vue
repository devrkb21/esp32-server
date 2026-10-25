<script lang="ts" setup>
import { computed } from 'vue'
import { t } from '@/i18n'
import { tbConfirm } from '@/utils/tbConfirm'
import { currentFirmware, isUpdateBusy, updateAvailable } from '../../companion/firmwareUpdate.mjs'
import { useRobot } from './context'

// Firmware: the installed and newest version, the Auto update switch (device list API) and
// "Update now" (companion command {type: 'update'}); the screen runs the flow and waits until
// TinyBot is back (../../companion/firmwareUpdate.mjs).
defineOptions({ name: 'RobotFirmware' })

const r = useRobot()
const fw = r.firmware
const state = computed(() => fw.state.value)
const device = computed(() => fw.device.value)
const latest = computed(() => fw.latest.value)
const installed = computed<string>(() => currentFirmware(r.view.value, device.value?.appVersion))
/** true / false from the device list; null when it could not be read */
const autoUpdate = computed<boolean | null>(() => (device.value ? Number(device.value.autoUpdate) === 1 : null))
const available = computed<boolean | null>(() => (latest.value ? updateAvailable(installed.value, latest.value.version) : null))
const busy = computed<boolean>(() => isUpdateBusy(state.value))
const canUpdate = computed(() => !busy.value && r.online.value && autoUpdate.value !== false)

const badge = computed(() => {
  if (busy.value)
    return { ink: 'routine', text: t('mrobot.fw.updatingBadge') }
  if (available.value === true)
    return { ink: 'warn', text: t('mrobot.fw.available') }
  if (available.value === false)
    return { ink: 'ok', text: t('mrobot.fw.upToDate') }
  return null
})

const note = computed(() => {
  const s = state.value
  switch (s.phase) {
    case 'sending':
    case 'sent':
    case 'waiting':
      return { tone: 'info', icon: 'update', text: t('mrobot.fw.updating') }
    case 'updated':
      return { tone: 'ok', icon: 'check', text: t('mrobot.fw.updated', { version: s.toVersion || '' }) }
    case 'current':
      return { tone: 'ok', icon: 'check', text: t('mrobot.fw.current') }
    case 'timeout':
      return { tone: 'warn', icon: 'warning', text: t('mrobot.fw.timeout') }
    case 'failed':
      return { tone: 'danger', icon: 'warning', text: t('mrobot.fw.failed') }
    default:
      return null
  }
})

async function confirmUpdate() {
  if (!canUpdate.value)
    return
  const ok = await tbConfirm({
    title: t('companion.firmware.confirmTitle'),
    message: t('mrobot.fw.confirm'),
    confirmText: t('companion.firmware.updateNow'),
  })
  if (ok)
    fw.start()
}
function goRobots() {
  uni.navigateTo({ url: '/pages/robots/index' })
}
</script>

<template>
  <tb-section :title="t('mrobot.sec.firmware')" :description="t('mrobot.fw.desc')">
    <template #actions>
      <tb-sync v-bind="r.syncOf('auto')" />
    </template>

    <view class="rbf">
      <view class="rbf__version">
        <text class="rbf__label">
          {{ t('companion.firmware.installed') }}
        </text>
        <view class="rbf__line">
          <text class="rbf__big tb-num">
            {{ installed || t('companion.firmware.unknown') }}
          </text>
          <tb-tag v-if="badge" :ink="badge.ink" mark>
            {{ badge.text }}
          </tb-tag>
        </view>
      </view>

      <view class="rbf__facts">
        <view v-if="latest" class="rb-row">
          <text class="rb-row__text">
            {{ t('companion.firmware.latest') }}
          </text>
          <text class="tb-num rbf__value">
            {{ latest.version }}
          </text>
        </view>
        <view v-if="autoUpdate !== null" class="rb-row">
          <text class="rb-row__text">
            {{ t('companion.firmware.autoUpdate') }}
          </text>
          <tb-switch :model-value="autoUpdate" :disabled="fw.savingAuto.value || busy" @change="fw.setAutoUpdate" />
        </view>
        <view v-else class="rb-row rbf__link" role="link" hover-class="is-press" @click="goRobots">
          <text class="rb-row__text">
            {{ t('companion.firmware.autoUpdate') }}
          </text>
          <view class="rb-row__ctl rbf__linktext">
            <text>{{ t('mrobot.fw.autoLink') }}</text>
            <tb-icon name="chevron-right" :size="16" />
          </view>
        </view>
      </view>

      <text class="rb-note">
        {{ autoUpdate === false ? t('companion.firmware.autoUpdateOff') : t('companion.firmware.autoUpdateHint') }}
      </text>

      <view v-if="note" class="rbf__note" :class="`is-${note.tone}`" :role="note.tone === 'danger' ? 'alert' : 'status'" aria-live="polite">
        <tb-loading v-if="busy" />
        <tb-icon v-else :name="note.icon" :size="18" />
        <text class="rbf__notetext">
          {{ note.text }}
        </text>
        <tb-button v-if="!busy" variant="quiet" size="s" @click="fw.reset()">
          {{ t('companion.firmware.dismiss') }}
        </tb-button>
      </view>
      <text v-else-if="!r.online.value" class="rb-note">
        {{ t('companion.firmware.offline') }}
      </text>

      <tb-button variant="primary" size="l" block icon="update" :loading="busy" :disabled="!canUpdate" @click="confirmUpdate">
        {{ t('companion.firmware.updateNow') }}
      </tb-button>
    </view>
  </tb-section>
</template>

<style lang="scss">
@import './robot.scss';

.rbf {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rbf__version {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rbf__label {
  font-size: 14px;
  font-weight: 600;
  color: var(--tb-ink-2);
}
.rbf__line {
  display: flex;
  align-items: center;
  gap: 8px 14px;
  flex-wrap: wrap;
}
.rbf__big {
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 48px;
  line-height: 1;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}
.rbf__facts {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--tb-rule);
}
.rbf__value {
  font-weight: 600;
}
.rbf__link.is-press {
  background: var(--tb-paper-2);
}
.rbf__linktext {
  font-size: 14px;
  font-weight: 600;
  color: var(--tb-ink);
  gap: 4px;
}
.rbf__note {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 0;
  border-top: 2px solid var(--tb-ink-2);
  border-bottom: 1px solid var(--tb-rule-soft);
  font-size: 14px;
}
.rbf__note.is-ok {
  border-top-color: var(--tb-ok);
}
.rbf__note.is-warn {
  border-top-color: var(--tb-warn);
}
.rbf__note.is-danger {
  border-top-color: var(--tb-danger);
  color: var(--tb-danger);
}
.rbf__notetext {
  flex: 1;
  min-width: 12ch;
}
</style>
