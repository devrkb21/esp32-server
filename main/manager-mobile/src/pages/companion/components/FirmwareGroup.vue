<script lang="ts" setup>
import type { Device, OtaFirmware } from '@/api/device'
import { computed, onMounted, ref, watch } from 'vue'
import { useMessage } from 'wot-design-uni/components/wd-message-box'
import { getBindDevices, getOtaFirmwares, updateDeviceAutoUpdate } from '@/api/device'
import { t } from '@/i18n'
import { useUserStore } from '@/store'
import { toast } from '@/utils/toast'
import { currentFirmware, isUpdateBusy, latestFirmware, updateAvailable } from '../firmwareUpdate.mjs'
import { notifyError, useCompanion } from './context'

defineOptions({
  name: 'CompanionFirmwareGroup',
})

// Firmware: installed / newest version, the Auto update switch and "Update now"
// (companion command {type: 'update'}); the page runs the flow and waits until TinyBot is back.
const { dev, deviceId, agentId, firmware } = useCompanion()
const message = useMessage()
const userStore = useUserStore()

const device = ref<Device | null>(null)
const latest = ref<OtaFirmware | null>(null)
const savingAuto = ref(false)

const state = computed(() => firmware.state.value)
const online = computed(() => !!dev.value?.online)
const installed = computed<string>(() => currentFirmware(dev.value, device.value?.appVersion))
/** true / false from the device list; null when it could not be read */
const autoUpdate = computed<boolean | null>(() => device.value ? device.value.autoUpdate === 1 : null)
const available = computed<boolean | null>(() => latest.value ? updateAvailable(installed.value, latest.value.version) : null)
const busy = computed<boolean>(() => isUpdateBusy(state.value))
const canUpdate = computed(() => !busy.value && online.value && autoUpdate.value !== false)

const badge = computed(() => {
  if (busy.value)
    return { cls: 'nx-badge--accent', text: t('companion.firmware.updatingBadge') }
  if (available.value === true)
    return { cls: 'nx-badge--warning', text: t('companion.firmware.available') }
  if (available.value === false)
    return { cls: 'nx-badge--success', text: t('companion.firmware.upToDate') }
  return null
})

const note = computed(() => {
  const s = state.value
  switch (s.phase) {
    case 'sending':
    case 'sent':
    case 'waiting':
      return { tone: 'info', icon: 'refresh', text: t('companion.firmware.updating') }
    case 'updated':
      return { tone: 'success', icon: 'check-circle', text: t('companion.firmware.updated', { version: s.toVersion || '' }) }
    case 'current':
      return { tone: 'success', icon: 'check-circle', text: t('companion.firmware.current') }
    case 'timeout':
      return { tone: 'warning', icon: 'warning', text: t('companion.firmware.timeout') }
    case 'failed':
      return { tone: 'danger', icon: 'warning', text: t('companion.firmware.failed') }
    default:
      return null
  }
})

async function loadDevice() {
  if (!agentId.value)
    return
  try {
    const list = await getBindDevices(agentId.value)
    device.value = (list || []).find(d => d.id === deviceId.value) || null
    firmware.setAppVersion(device.value?.appVersion || '')
  }
  catch {
    // the card then links to the device list instead of showing the switch
  }
}

// The OTA list is for super admins only: everyone else does not see the newest version
async function loadLatest() {
  if (userStore.userInfo?.superAdmin !== 1)
    return
  try {
    const page = await getOtaFirmwares()
    latest.value = latestFirmware(page?.list || []) as OtaFirmware | null
  }
  catch {
    latest.value = null
  }
}

onMounted(() => {
  loadDevice()
  loadLatest()
})

// reload the version from the device list once TinyBot is back
watch(() => state.value.phase, (phase) => {
  if (phase === 'updated' || phase === 'current')
    loadDevice()
})

async function setAutoUpdate(on: boolean) {
  if (!device.value)
    return
  const previous = device.value.autoUpdate
  device.value.autoUpdate = on ? 1 : 0
  savingAuto.value = true
  try {
    await updateDeviceAutoUpdate(deviceId.value, on ? 1 : 0)
    toast.success(on ? t('device.otaAutoUpdateEnabled') : t('device.otaAutoUpdateDisabled'))
  }
  catch (error) {
    if (device.value)
      device.value.autoUpdate = previous
    notifyError(error)
  }
  finally {
    savingAuto.value = false
  }
}

function openDeviceList() {
  uni.navigateBack()
}

function confirmUpdate() {
  if (!canUpdate.value)
    return
  message.confirm({
    title: t('companion.firmware.confirmTitle'),
    msg: t('companion.firmware.confirm'),
    confirmButtonText: t('companion.firmware.updateNow'),
    cancelButtonText: t('common.cancel'),
  }).then(() => {
    firmware.start()
  }).catch(() => {
    // cancelled
  })
}
</script>

<template>
  <view v-if="dev" class="nx-group">
    <view class="nx-group__header fw__header">
      <text>{{ t('companion.firmware.title') }}</text>
      <text v-if="badge" class="nx-badge" :class="badge.cls">
        {{ badge.text }}
      </text>
    </view>
    <view class="nx-group__body">
      <view class="nx-row">
        <view class="nx-row__main nx-row__title">
          {{ t('companion.firmware.installed') }}
        </view>
        <view class="nx-row__value nx-mono">
          {{ installed || t('companion.firmware.unknown') }}
        </view>
      </view>
      <view v-if="latest" class="nx-row">
        <view class="nx-row__main nx-row__title">
          {{ t('companion.firmware.latest') }}
        </view>
        <view class="nx-row__value nx-mono">
          {{ latest.version }}
        </view>
      </view>
      <view v-if="autoUpdate !== null" class="nx-row">
        <view class="nx-row__main nx-row__title">
          {{ t('companion.firmware.autoUpdate') }}
        </view>
        <wd-switch
          :model-value="autoUpdate"
          size="24px"
          :disabled="savingAuto || busy"
          @change="({ value }) => setAutoUpdate(!!value)"
        />
      </view>
      <view v-else class="nx-row nx-row--tap" @click="openDeviceList">
        <view class="nx-row__main nx-row__title">
          {{ t('companion.firmware.autoUpdate') }}
        </view>
        <view class="nx-row__value fw__link">
          {{ t('companion.firmware.autoUpdateLink') }}
        </view>
      </view>
    </view>
    <view class="nx-group__footer">
      {{ autoUpdate === false ? t('companion.firmware.autoUpdateOff') : t('companion.firmware.autoUpdateHint') }}
    </view>

    <view v-if="note" class="fw__note" :class="`is-${note.tone}`" role="status" aria-live="polite">
      <wd-icon :name="note.icon" size="18px" :custom-class="busy ? 'fw__spin' : ''" />
      <view class="fw__note-text">
        {{ note.text }}
      </view>
      <view v-if="!busy" class="fw__dismiss" @click="firmware.reset()">
        {{ t('companion.firmware.dismiss') }}
      </view>
    </view>
    <view v-else-if="!online" class="nx-footnote fw__offline">
      {{ t('companion.firmware.offline') }}
    </view>

    <view class="fw__action">
      <wd-button block :loading="busy" :disabled="!canUpdate" @click="confirmUpdate">
        {{ t('companion.firmware.updateNow') }}
      </wd-button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.fw {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--nx-space-2);
  }

  &__link {
    color: var(--nx-accent);
  }

  &__note {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
    margin-top: var(--nx-space-3);
    padding: var(--nx-space-2) var(--nx-space-3);
    border-radius: var(--nx-radius);
    font-size: var(--nx-text-footnote);
    background: var(--nx-info-soft);
    color: var(--nx-info);

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

  &__note-text {
    flex: 1;
    min-width: 0;
    color: var(--nx-text);
  }

  &__dismiss {
    padding: 8rpx 12rpx;
    font-weight: 600;
  }

  &__offline {
    margin-top: var(--nx-space-3);
  }

  &__action {
    margin-top: var(--nx-space-3);
  }
}

:deep(.fw__spin) {
  animation: fw-spin 1s linear infinite;
}

@keyframes fw-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  :deep(.fw__spin) {
    animation: none;
  }
}
</style>
