<script lang="ts" setup>
import type { Device, FirmwareType } from '@/api/device'
import { computed, onMounted, ref } from 'vue'
import { useMessage } from 'wot-design-uni/components/wd-message-box'
import {
  bindDevice,
  bindDeviceManual,
  getBindDevices,
  getDeviceOnlineStatus,
  getFirmwareTypes,
  rebootDevice,
  setDeviceVolume,
  unbindDevice,
  updateDeviceAutoUpdate,
} from '@/api/device'
import { t } from '@/i18n'
import { toast } from '@/utils/toast'
import { parseDeviceLastConnectedAtTimestamp } from './deviceTimeUtils.mjs'

defineOptions({
  name: 'DeviceManage',
})

const props = withDefaults(defineProps<Props>(), {
  agentId: 'default',
})

// Receive props
interface Props {
  agentId?: string
}

/** Translate with an English fallback for keys still waiting in src/i18n/_pending */
function tx(key: string, fallback: string, params?: Record<string, string | number>) {
  const text = t(key, params)
  if (text !== key)
    return text
  return params ? fallback.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? '')) : fallback
}

// Device data
const deviceList = ref<Device[]>([])
const firmwareTypes = ref<FirmwareType[]>([])
const loading = ref(false)
const loadFailed = ref(false)

// Remote control & telemetry states
const deviceStatusMap = ref<Record<string, boolean>>({})
const deviceVolumes = ref<Record<string, number>>({})
const isRebooting = ref<Record<string, boolean>>({})
const isUpdatingVolume = ref<Record<string, boolean>>({})
const volumeTimers = ref<Record<string, any>>({})

// Device detail sheet
const activeDeviceId = ref('')
const activeDevice = computed(() => deviceList.value.find(d => d.id === activeDeviceId.value) || null)
const detailOpen = computed({
  get: () => !!activeDevice.value,
  set: (open: boolean) => {
    if (!open)
      activeDeviceId.value = ''
  },
})

// Add-robot sheet: choose a method, then bind with a code or add manually
const addSheetOpen = ref(false)
const addMode = ref<'choose' | 'code' | 'manual'>('choose')
const bindCode = ref('')
const bindCodeError = ref('')
const binding = ref(false)

const manualBindForm = ref({
  board: '',
  appVersion: '',
  macAddress: '',
})

// Form validation error message
const formErrors = ref({
  board: '',
  appVersion: '',
  macAddress: '',
})

// MAC address regex validation
const macRegex = /^(?:[0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/i
const codeRegex = /^\d{6}$/

const onlineCount = computed(() => deviceList.value.filter(d => deviceStatusMap.value[d.id]).length)
const firmwareColumns = computed(() => firmwareTypes.value.map(item => ({ value: item.key, label: item.name })))

function resetManualForm() {
  manualBindForm.value = {
    board: '',
    appVersion: '',
    macAddress: '',
  }
  formErrors.value = {
    board: '',
    appVersion: '',
    macAddress: '',
  }
}

function openAddSheet() {
  addMode.value = 'choose'
  addSheetOpen.value = true
}

function selectBindMode(key: 'code' | 'manual') {
  if (key === 'code') {
    bindCode.value = ''
    bindCodeError.value = ''
  }
  else {
    // Reset form and errors before showing the form
    resetManualForm()
  }
  addMode.value = key
}

// Message component
const message = useMessage()

// Use provided agent ID
const currentAgentId = computed(() => {
  return props.agentId
})

// Get device list
async function loadDeviceList() {
  try {
    // Check whether agent is currently selected
    if (!currentAgentId.value) {
      deviceList.value = []
      return
    }

    loading.value = true
    const response = await getBindDevices(currentAgentId.value)
    deviceList.value = response || []
    loadFailed.value = false
    deviceList.value.forEach((device) => {
      if (deviceVolumes.value[device.id] === undefined) {
        deviceVolumes.value[device.id] = 70
      }
    })
    fetchOnlineStatus()
  }
  catch (error) {
    console.error('Failed to get device list:', error)
    deviceList.value = []
    loadFailed.value = true
  }
  finally {
    loading.value = false
  }
}

// Fetch device online status from MQTT gateway
async function fetchOnlineStatus() {
  if (!currentAgentId.value)
    return
  try {
    const rawRes = await getDeviceOnlineStatus(currentAgentId.value)
    if (rawRes) {
      let statusMap: any = rawRes
      if (typeof rawRes === 'string') {
        try {
          statusMap = JSON.parse(rawRes)
        }
        catch {
          statusMap = null
        }
      }
      if (statusMap && typeof statusMap === 'object') {
        deviceList.value.forEach((device) => {
          const mac = device.macAddress ? device.macAddress.replace(/:/g, '_') : 'unknown'
          const groupId = device.board ? device.board.replace(/:/g, '_') : 'GID_default'
          const clientId = `${groupId}@@@${mac}@@@${mac}`
          const info = statusMap[clientId]
          if (info) {
            deviceStatusMap.value[device.id] = info.isAlive === true || (info.isAlive === null && info.exists === true)
          }
          else {
            deviceStatusMap.value[device.id] = false
          }
        })
      }
    }
  }
  catch (err) {
    console.error('Failed to fetch device online status:', err)
  }
}

// Confirm and execute device reboot
function confirmRebootDevice(device: Device) {
  message.confirm({
    title: t('device.rebootConfirmTitle'),
    msg: t('device.rebootConfirmMsg', { macAddress: device.macAddress }),
    confirmButtonText: t('device.reboot'),
    cancelButtonText: t('common.cancel'),
  }).then(async () => {
    try {
      isRebooting.value[device.id] = true
      await rebootDevice(device.id)
      toast.success(t('device.rebootSuccess'))
    }
    catch (err: any) {
      toast.error(err?.message || t('device.rebootFailed'))
    }
    finally {
      isRebooting.value[device.id] = false
    }
  }).catch(() => {
    // User cancelled
  })
}

// Adjust device volume with debounce
function onVolumeChange(device: Device, volume: number) {
  deviceVolumes.value[device.id] = volume
  if (volumeTimers.value[device.id]) {
    clearTimeout(volumeTimers.value[device.id])
  }
  volumeTimers.value[device.id] = setTimeout(async () => {
    try {
      isUpdatingVolume.value[device.id] = true
      await setDeviceVolume(device.id, volume)
      toast.success(t('device.volumeSetSuccess'))
    }
    catch (err: any) {
      toast.error(err?.message || t('device.volumeSetFailed'))
    }
    finally {
      isUpdatingVolume.value[device.id] = false
    }
  }, 400)
}

// Open the companion screens of a device
function openCompanion(device: Device) {
  activeDeviceId.value = ''
  // the page shows the robot name from the companion server once loaded; the alias is a placeholder
  const name = device.alias ? `&name=${encodeURIComponent(device.alias)}` : ''
  uni.navigateTo({
    url: `/pages/companion/index?deviceId=${encodeURIComponent(device.id)}${name}`,
  })
}

function openDetail(device: Device) {
  activeDeviceId.value = device.id
}

// Refresh method exposed to parent
async function refresh() {
  await loadDeviceList()
}

// Get device type name
function getDeviceTypeName(boardKey: string): string {
  const firmwareType = firmwareTypes.value.find(type => type.key === boardKey)
  return firmwareType?.name || boardKey
}

function deviceName(device: Device): string {
  return device.alias || getDeviceTypeName(device.board) || device.macAddress
}

function versionText(version?: string): string {
  if (!version)
    return ''
  return /^v/i.test(version) ? version : `v${version}`
}

/** "Online · v1.6.2 · 5 minutes ago" */
function deviceMeta(device: Device): string {
  return [
    deviceStatusMap.value[device.id] ? t('device.online') : t('device.offline'),
    versionText(device.appVersion),
    formatTime(device.lastConnectedAtTimestamp),
  ].filter(Boolean).join(' · ')
}

function volumeOf(device: Device): number {
  return deviceVolumes.value[device.id] !== undefined ? deviceVolumes.value[device.id] : 70
}

// Format time
function formatTime(timestamp: string | null) {
  const date = parseDeviceLastConnectedAtTimestamp(timestamp)
  if (!date)
    return t('device.neverConnected')
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000)
    return t('device.justNow')
  if (diff < 3600000)
    return t('device.minutesAgo', { minutes: Math.floor(diff / 60000) })
  if (diff < 86400000)
    return t('device.hoursAgo', { hours: Math.floor(diff / 3600000) })
  if (diff < 604800000)
    return t('device.daysAgo', { days: Math.floor(diff / 86400000) })

  return date.toLocaleDateString()
}

// Toggle OTA auto-update
async function toggleAutoUpdate(device: Device) {
  try {
    const newStatus = device.autoUpdate === 1 ? 0 : 1
    await updateDeviceAutoUpdate(device.id, newStatus)
    device.autoUpdate = newStatus
    toast.success(newStatus === 1 ? t('device.otaAutoUpdateEnabled') : t('device.otaAutoUpdateDisabled'))
  }
  catch (error: any) {
    console.error('Failed to update device OTA status:', error)
    toast.error(t('device.operationFailed'))
  }
}

// Unbind device
async function handleUnbindDevice(device: Device) {
  try {
    await unbindDevice(device.id)
    activeDeviceId.value = ''
    await loadDeviceList()
    toast.success(t('device.deviceUnbound'))
  }
  catch (error: any) {
    console.error('Failed to unbind device:', error)
    toast.error(t('device.unbindFailed'))
  }
}

// Confirm unbinding device
function confirmUnbindDevice(device: Device) {
  message.confirm({
    title: t('device.unbindDevice'),
    msg: t('device.confirmUnbindDevice', { macAddress: device.macAddress }),
    confirmButtonText: t('device.confirmUnbind'),
    cancelButtonText: t('device.cancel'),
  }).then(() => {
    handleUnbindDevice(device)
  }).catch(() => {
    // User cancelled
  })
}

// Bind new device
async function handleBindDevice(code: string): Promise<boolean> {
  try {
    if (!currentAgentId.value) {
      toast.error(t('device.pleaseSelectAgent'))
      return false
    }

    await bindDevice(currentAgentId.value, code.trim())
    await loadDeviceList()
    toast.success(t('device.deviceBindSuccess'))
    return true
  }
  catch (error: any) {
    console.error('Failed to bind device:', error)
    const errorMessage = error?.message || t('device.bindFailed')
    toast.error(errorMessage)
    return false
  }
}

function onCodeInput() {
  // digits only, at most 6
  const clean = String(bindCode.value || '').replace(/\D/g, '').slice(0, 6)
  if (clean !== bindCode.value)
    bindCode.value = clean
  bindCodeError.value = ''
}

// Bind with the 6-digit code the robot says
async function submitBindCode() {
  const code = String(bindCode.value || '').trim()
  if (!codeRegex.test(code)) {
    bindCodeError.value = t('device.enterDeviceCode')
    return
  }
  binding.value = true
  const ok = await handleBindDevice(code)
  binding.value = false
  if (ok)
    addSheetOpen.value = false
}

// Manually bind device
async function handleManualBind() {
  try {
    // Validate entire form first
    const isValid = validateForm()
    if (!isValid) {
      return
    }

    if (!currentAgentId.value) {
      toast.error(t('device.pleaseSelectAgent'))
      return
    }

    binding.value = true
    await bindDeviceManual({
      agentId: currentAgentId.value,
      board: manualBindForm.value.board,
      appVersion: manualBindForm.value.appVersion,
      macAddress: manualBindForm.value.macAddress,
    })
    await loadDeviceList()
    toast.success(t('manualAddDeviceDialog.addSuccess'))
    addSheetOpen.value = false
    // Reset form and errors
    resetManualForm()
  }
  catch (error: any) {
    const errorMessage = error?.message || t('manualAddDeviceDialog.addFailed')
    toast.error(errorMessage)
  }
  finally {
    binding.value = false
  }
}

// Validate single field
function validateField(field: string) {
  switch (field) {
    case 'board':
      if (!manualBindForm.value.board) {
        formErrors.value.board = t('manualAddDeviceDialog.deviceTypePlaceholder')
      }
      else {
        formErrors.value.board = ''
      }
      break
    case 'appVersion':
      if (!manualBindForm.value.appVersion) {
        formErrors.value.appVersion = t('manualAddDeviceDialog.firmwareVersionPlaceholder')
      }
      else {
        formErrors.value.appVersion = ''
      }
      break
    case 'macAddress':
      if (!manualBindForm.value.macAddress) {
        formErrors.value.macAddress = t('manualAddDeviceDialog.macAddressPlaceholder')
      }
      else if (!macRegex.test(manualBindForm.value.macAddress)) {
        formErrors.value.macAddress = t('manualAddDeviceDialog.invalidMacAddress')
      }
      else {
        formErrors.value.macAddress = ''
      }
      break
  }
}

// Clear field error message
function clearFieldError(field: string) {
  formErrors.value[field] = ''
}

// Handle picker change
function handlePickerChange() {
  clearFieldError('board')
}

// Validate entire form
function validateForm(): boolean {
  let isValid = true

  // Validate device type
  if (!manualBindForm.value.board) {
    formErrors.value.board = t('manualAddDeviceDialog.deviceTypePlaceholder')
    isValid = false
  }
  else {
    formErrors.value.board = ''
  }

  // Validate firmware version
  if (!manualBindForm.value.appVersion) {
    formErrors.value.appVersion = t('manualAddDeviceDialog.firmwareVersionPlaceholder')
    isValid = false
  }
  else {
    formErrors.value.appVersion = ''
  }

  // Validate MAC address
  if (!manualBindForm.value.macAddress) {
    formErrors.value.macAddress = t('manualAddDeviceDialog.macAddressPlaceholder')
    isValid = false
  }
  else if (!macRegex.test(manualBindForm.value.macAddress)) {
    formErrors.value.macAddress = t('manualAddDeviceDialog.invalidMacAddress')
    isValid = false
  }
  else {
    formErrors.value.macAddress = ''
  }

  return isValid
}

// Get device type list
async function loadFirmwareTypes() {
  try {
    const response = await getFirmwareTypes()
    firmwareTypes.value = response
  }
  catch (error) {
    console.error('Failed to get device type:', error)
  }
}

onMounted(async () => {
  // Agent simplified to default

  loadFirmwareTypes()
  loadDeviceList()
})

// Expose method to parent
defineExpose({
  refresh,
})
</script>

<template>
  <view class="devices">
    <!-- Large title -->
    <view class="devices__header">
      <view class="min-w-0 flex-1">
        <view class="devices__title">
          {{ tx('device.robotsTitle', 'Robots') }}
        </view>
        <view v-if="deviceList.length" class="nx-num devices__subtitle">
          {{ tx('device.robotsSummary', '{online} of {count} online', { count: deviceList.length, online: onlineCount }) }}
        </view>
      </view>
      <view
        v-if="deviceList.length"
        class="devices__add"
        role="button"
        :aria-label="tx('device.addRobot', 'Add robot')"
        @click="openAddSheet"
      >
        <wd-icon name="add" size="16px" />
        <text>{{ tx('device.add', 'Add') }}</text>
      </view>
    </view>

    <!-- Loading skeleton -->
    <view v-if="loading && deviceList.length === 0" class="nx-group">
      <view class="nx-group__body">
        <view v-for="i in 3" :key="i" class="nx-row">
          <view class="nx-skeleton devices__skeleton-dot" />
          <view class="nx-row__main">
            <view class="nx-skeleton devices__skeleton-line" />
            <view class="nx-skeleton devices__skeleton-line devices__skeleton-line--short" />
          </view>
        </view>
      </view>
    </view>

    <!-- Device list -->
    <view v-else-if="deviceList.length > 0" class="nx-group">
      <view class="nx-group__body">
        <wd-swipe-action v-for="device in deviceList" :key="device.id" custom-class="devices__swipe">
          <view class="nx-row nx-row--tap devices__row" @click="openDetail(device)">
            <view
              class="nx-dot devices__dot"
              :class="{ 'nx-dot--online': deviceStatusMap[device.id] }"
              :aria-label="deviceStatusMap[device.id] ? t('device.online') : t('device.offline')"
            />
            <view class="nx-row__main">
              <view class="nx-truncate nx-row__title devices__name" :title="deviceName(device)">
                {{ deviceName(device) }}
              </view>
              <view class="nx-mono nx-caption nx-break devices__mac">
                {{ device.macAddress }}
              </view>
              <view class="nx-truncate nx-num nx-row__subtitle">
                {{ deviceMeta(device) }}
              </view>
            </view>
            <view
              class="devices__more"
              role="button"
              :aria-label="tx('device.moreActions', 'More actions')"
              @click.stop="openDetail(device)"
            >
              <wd-icon name="ellipsis" size="20px" />
            </view>
          </view>

          <template #right>
            <view class="devices__swipe-actions">
              <view class="devices__swipe-btn devices__swipe-btn--accent" @click.stop="openCompanion(device)">
                <wd-icon name="heart" size="18px" />
                <text>{{ t('companion.open') }}</text>
              </view>
              <view class="devices__swipe-btn devices__swipe-btn--danger" @click.stop="confirmUnbindDevice(device)">
                <wd-icon name="delete" size="18px" />
                <text>{{ t('device.unbind') }}</text>
              </view>
            </view>
          </template>
        </wd-swipe-action>
      </view>
      <view class="nx-group__footer">
        {{ tx('device.swipeHint', 'Tap a robot for volume, updates and restart. Swipe left for more.') }}
      </view>
    </view>

    <!-- Error state -->
    <view v-else-if="loadFailed && !loading" class="nx-empty">
      <view class="nx-icon-tile nx-icon-tile--lg">
        <wd-icon name="wifi-error" size="28px" />
      </view>
      <view class="nx-empty__title">
        {{ tx('device.loadFailedTitle', 'Couldn’t load your robots') }}
      </view>
      <view class="nx-empty__text">
        {{ tx('device.loadFailedText', 'Check your connection and try again.') }}
      </view>
      <view class="nx-btn nx-btn--primary devices__empty-btn" @click="refresh">
        {{ tx('device.retry', 'Try again') }}
      </view>
    </view>

    <!-- Empty state -->
    <view v-else-if="!loading" class="nx-empty">
      <view class="nx-icon-tile nx-icon-tile--lg">
        <wd-icon name="mobile" size="28px" />
      </view>
      <view class="nx-empty__title">
        {{ tx('device.emptyTitle', 'No robots yet') }}
      </view>
      <view class="nx-empty__text">
        {{ tx('device.emptyText', 'Turn your robot on and connect it to Wi‑Fi in the Network tab. It then says a 6‑digit code — add the robot here with that code.') }}
      </view>
      <view class="nx-btn nx-btn--primary devices__empty-btn" @click="openAddSheet">
        <wd-icon name="add" size="16px" />
        {{ tx('device.addRobot', 'Add robot') }}
      </view>
    </view>

    <!-- Device detail sheet -->
    <wd-popup
      v-model="detailOpen"
      position="bottom"
      safe-area-inset-bottom
      :z-index="100"
      custom-class="nx-sheet"
    >
      <view v-if="activeDevice" class="sheet">
        <view class="sheet__handle" />
        <view class="sheet__header">
          <view class="min-w-0 flex-1">
            <view class="nx-truncate sheet__title">
              {{ deviceName(activeDevice) }}
            </view>
            <view class="nx-mono nx-caption nx-break">
              {{ activeDevice.macAddress }}
            </view>
          </view>
          <view class="nx-badge" :class="deviceStatusMap[activeDevice.id] ? 'nx-badge--success' : ''">
            <view class="nx-dot" :class="{ 'nx-dot--online': deviceStatusMap[activeDevice.id] }" />
            {{ deviceStatusMap[activeDevice.id] ? t('device.online') : t('device.offline') }}
          </view>
        </view>

        <view class="nx-group">
          <view class="nx-group__body sheet__inset">
            <view class="nx-row">
              <view class="nx-row__main nx-row__title">
                {{ t('device.deviceType') }}
              </view>
              <view class="nx-truncate nx-row__value">
                {{ getDeviceTypeName(activeDevice.board) || '–' }}
              </view>
            </view>
            <view class="nx-row">
              <view class="nx-row__main nx-row__title">
                {{ t('device.firmwareVersion') }}
              </view>
              <view class="nx-row__value nx-mono nx-truncate">
                {{ activeDevice.appVersion || '–' }}
              </view>
            </view>
            <view class="nx-row">
              <view class="nx-row__main nx-row__title">
                {{ t('device.lastConnection') }}
              </view>
              <view class="nx-row__value nx-num">
                {{ formatTime(activeDevice.lastConnectedAtTimestamp) }}
              </view>
            </view>
          </view>
        </view>

        <view class="nx-group">
          <view class="nx-group__body sheet__inset">
            <view class="nx-row devices__volume">
              <view class="devices__volume-head">
                <view class="nx-row__title">
                  {{ t('device.volume') }}
                </view>
                <view class="nx-row__value nx-num">
                  <wd-loading v-if="isUpdatingVolume[activeDevice.id]" size="14px" />
                  {{ volumeOf(activeDevice) }}%
                </view>
              </view>
              <wd-slider
                :model-value="volumeOf(activeDevice)"
                :min="0"
                :max="100"
                :step="5"
                hide-label
                hide-min-max
                @change="(val: any) => onVolumeChange(activeDevice!, typeof val === 'object' ? val.value : val)"
              />
            </view>
            <view class="nx-row">
              <view class="nx-row__main">
                <view class="nx-row__title">
                  {{ t('device.otaUpdate') }}
                </view>
              </view>
              <wd-switch
                :model-value="activeDevice.autoUpdate === 1"
                size="22px"
                @change="toggleAutoUpdate(activeDevice!)"
              />
            </view>
          </view>
        </view>

        <view class="nx-group">
          <view class="nx-group__body sheet__inset">
            <view class="nx-row nx-row--tap" @click="openCompanion(activeDevice!)">
              <view class="nx-icon-tile devices__row-icon">
                <wd-icon name="heart" size="18px" />
              </view>
              <view class="nx-row__main nx-row__title">
                {{ t('companion.open') }}
              </view>
              <wd-icon name="arrow-right" size="16px" custom-class="nx-row__chevron" />
            </view>
            <view class="nx-row nx-row--tap" @click="confirmRebootDevice(activeDevice!)">
              <view class="nx-icon-tile devices__row-icon nx-icon-tile--neutral">
                <wd-loading v-if="isRebooting[activeDevice.id]" size="16px" />
                <wd-icon v-else name="refresh" size="18px" />
              </view>
              <view class="nx-row__main nx-row__title">
                {{ t('device.reboot') }}
              </view>
            </view>
          </view>
        </view>

        <view class="nx-group sheet__last">
          <view class="nx-group__body sheet__inset">
            <view class="nx-row nx-row--tap" @click="confirmUnbindDevice(activeDevice!)">
              <view class="nx-row__main nx-row__title devices__danger">
                {{ t('device.unbindDevice') }}
              </view>
            </view>
          </view>
        </view>
      </view>
    </wd-popup>

    <!-- Add robot sheet -->
    <wd-popup
      v-model="addSheetOpen"
      position="bottom"
      safe-area-inset-bottom
      :close-on-click-modal="addMode === 'choose'"
      :z-index="100"
      custom-class="nx-sheet"
    >
      <view class="sheet">
        <view class="sheet__handle" />
        <view class="sheet__header">
          <view
            v-if="addMode !== 'choose'"
            class="sheet__icon-btn"
            role="button"
            :aria-label="tx('device.back', 'Back')"
            @click="addMode = 'choose'"
          >
            <wd-icon name="arrow-left" size="18px" />
          </view>
          <view class="sheet__title nx-truncate min-w-0 flex-1">
            {{ addMode === 'manual' ? t('manualAddDeviceDialog.title') : addMode === 'code' ? t('device.bindDevice') : tx('device.addRobot', 'Add robot') }}
          </view>
          <view
            class="sheet__icon-btn"
            role="button"
            :aria-label="t('common.cancel')"
            @click="addSheetOpen = false"
          >
            <wd-icon name="close" size="18px" />
          </view>
        </view>

        <!-- Step 1: choose a method -->
        <view v-if="addMode === 'choose'" class="nx-group sheet__last">
          <view class="nx-group__body sheet__inset">
            <view class="nx-row nx-row--tap" @click="selectBindMode('code')">
              <view class="nx-icon-tile">
                <wd-icon name="keyboard-collapse" size="20px" />
              </view>
              <view class="nx-row__main">
                <view class="nx-row__title">
                  {{ t('manualAddDeviceDialog.bindWithCode') }}
                </view>
                <view class="nx-row__subtitle">
                  {{ tx('device.bindWithCodeHint', 'The robot says a code after it joins Wi‑Fi. Recommended.') }}
                </view>
              </view>
              <wd-icon name="arrow-right" size="16px" custom-class="nx-row__chevron" />
            </view>
            <view class="nx-row nx-row--tap" @click="selectBindMode('manual')">
              <view class="nx-icon-tile nx-icon-tile--neutral">
                <wd-icon name="edit-outline" size="20px" />
              </view>
              <view class="nx-row__main">
                <view class="nx-row__title">
                  {{ t('manualAddDeviceDialog.title') }}
                </view>
                <view class="nx-row__subtitle">
                  {{ tx('device.manualAddHint', 'Enter the device type, firmware version and MAC address.') }}
                </view>
              </view>
              <wd-icon name="arrow-right" size="16px" custom-class="nx-row__chevron" />
            </view>
          </view>
        </view>

        <!-- Step 2a: 6-digit code -->
        <view v-else-if="addMode === 'code'" class="sheet__form">
          <view class="field">
            <view class="field__label">
              {{ tx('device.codeLabel', '6-digit code') }}
            </view>
            <wd-input
              v-model="bindCode"
              type="number"
              :maxlength="6"
              :placeholder="t('device.enterDeviceCode')"
              custom-class="field__input devices__code"
              @input="onCodeInput"
              @confirm="submitBindCode"
            />
            <view v-if="bindCodeError" class="field__error">
              {{ bindCodeError }}
            </view>
            <view v-else class="field__help">
              {{ tx('device.codeHelp', 'Six digits, spoken by the robot after it connects to Wi‑Fi.') }}
            </view>
          </view>
          <wd-button block size="large" :loading="binding" :disabled="bindCode.length !== 6" @click="submitBindCode">
            {{ t('device.bindNow') }}
          </wd-button>
        </view>

        <!-- Step 2b: manual add -->
        <view v-else class="sheet__form">
          <view class="field">
            <view class="field__label">
              {{ t('manualAddDeviceDialog.deviceType') }}
            </view>
            <wd-picker
              v-model="manualBindForm.board"
              :columns="firmwareColumns"
              :placeholder="t('manualAddDeviceDialog.deviceTypePlaceholder')"
              :cancel-button-text="t('common.cancel')"
              :confirm-button-text="t('common.confirm')"
              custom-class="field__picker"
              @confirm="handlePickerChange"
            />
            <view v-if="formErrors.board" class="field__error">
              {{ formErrors.board }}
            </view>
          </view>

          <view class="field">
            <view class="field__label">
              {{ t('manualAddDeviceDialog.firmwareVersion') }}
            </view>
            <wd-input
              v-model="manualBindForm.appVersion"
              :placeholder="t('manualAddDeviceDialog.firmwareVersionPlaceholder')"
              custom-class="field__input"
              @input="clearFieldError('appVersion')"
              @blur="validateField('appVersion')"
            />
            <view v-if="formErrors.appVersion" class="field__error">
              {{ formErrors.appVersion }}
            </view>
          </view>

          <view class="field">
            <view class="field__label">
              {{ t('manualAddDeviceDialog.macAddress') }}
            </view>
            <wd-input
              v-model="manualBindForm.macAddress"
              :placeholder="t('manualAddDeviceDialog.macAddressPlaceholder')"
              custom-class="field__input nx-mono"
              @input="validateField('macAddress')"
              @blur="validateField('macAddress')"
            />
            <view v-if="formErrors.macAddress" class="field__error">
              {{ formErrors.macAddress }}
            </view>
          </view>

          <wd-button block size="large" :loading="binding" @click="handleManualBind">
            {{ tx('device.addRobot', 'Add robot') }}
          </wd-button>
        </view>
      </view>
    </wd-popup>

    <!-- MessageBox component -->
    <wd-message-box />
  </view>
</template>

<style lang="scss" scoped>
.devices {
  position: relative;
  min-height: 100%;
  padding: 0 var(--nx-gutter) calc(var(--nx-space-7) + env(safe-area-inset-bottom));
  background: var(--nx-bg);
  box-sizing: border-box;

  &__header {
    display: flex;
    align-items: flex-end;
    gap: var(--nx-space-3);
    padding: var(--nx-space-2) 0 var(--nx-space-4);
  }

  &__title {
    font-size: var(--nx-text-display);
    font-weight: 700;
    letter-spacing: -0.022em;
    line-height: 1.15;
    color: var(--nx-text);
  }

  &__subtitle {
    margin-top: 8rpx;
    font-size: var(--nx-text-callout);
    color: var(--nx-text-2);
  }

  &__add {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8rpx;
    min-height: 64rpx;
    padding: 0 var(--nx-space-3);
    border-radius: var(--nx-radius-pill);
    background: var(--nx-accent-soft);
    color: var(--nx-accent);
    font-size: var(--nx-text-callout);
    font-weight: 600;
    transition: transform var(--nx-dur-1) var(--nx-ease);

    &:active {
      transform: scale(0.97);
    }
  }

  &__row {
    align-items: flex-start;
    background: var(--nx-surface);
  }

  &__dot {
    margin-top: 14rpx;
  }

  &__name {
    font-weight: 600;
  }

  &__mac {
    margin-top: 4rpx;
    color: var(--nx-text-3);
  }

  &__more {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: var(--nx-touch);
    height: var(--nx-touch);
    margin: calc(var(--nx-space-2) * -1) calc(var(--nx-space-3) * -1) 0 0;
    border-radius: 50%;
    color: var(--nx-text-3);

    &:active {
      background: var(--nx-surface-3);
    }
  }

  &__swipe-actions {
    display: flex;
    height: 100%;
  }

  &__swipe-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6rpx;
    min-width: 144rpx;
    height: 100%;
    padding: 0 var(--nx-space-3);
    box-sizing: border-box;
    font-size: var(--nx-text-caption);
    font-weight: 600;

    &--accent {
      background: var(--nx-accent-soft);
      color: var(--nx-accent);
    }

    &--danger {
      background: var(--nx-danger);
      color: var(--nx-on-accent);
    }
  }

  &__row-icon {
    width: 60rpx;
    height: 60rpx;
    border-radius: var(--nx-radius-sm);
  }

  &__danger {
    color: var(--nx-danger);
    text-align: center;
    font-weight: 500;
  }

  &__volume {
    flex-direction: column;
    align-items: stretch;
    gap: var(--nx-space-1);
  }

  &__volume-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__empty-btn {
    margin-top: var(--nx-space-3);
  }

  &__skeleton-dot {
    width: 16rpx;
    height: 16rpx;
    min-height: 16rpx;
    border-radius: 50%;
  }

  &__skeleton-line {
    width: 60%;
    height: 28rpx;

    &--short {
      width: 40%;
      margin-top: 12rpx;
      height: 22rpx;
    }
  }
}

:deep(.devices__swipe) {
  position: relative;
  background: var(--nx-surface);

  &:not(:last-child)::after {
    content: '';
    position: absolute;
    left: var(--nx-space-4);
    right: 0;
    bottom: 0;
    height: 1rpx;
    background: var(--nx-border);
  }
}

:deep(.devices__code .wd-input__inner) {
  font-family: var(--nx-font-mono);
  font-size: var(--nx-text-title);
  letter-spacing: 0.3em;
}

/* ---------- bottom sheet (shared look for this page) ---------- */
:deep(.nx-sheet) {
  border-radius: var(--nx-radius-xl) var(--nx-radius-xl) 0 0;
  background: var(--nx-bg);
  overflow: hidden;
}

.sheet {
  max-height: 85vh;
  overflow-y: auto;
  padding: 0 var(--nx-gutter) var(--nx-space-4);
  background: var(--nx-bg);
  box-sizing: border-box;

  &__handle {
    width: 72rpx;
    height: 10rpx;
    margin: var(--nx-space-2) auto var(--nx-space-1);
    border-radius: var(--nx-radius-pill);
    background: var(--nx-border-strong);
  }

  &__header {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
    padding: var(--nx-space-2) 0 var(--nx-space-4);
  }

  &__title {
    font-size: var(--nx-text-headline);
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--nx-text);
  }

  &__icon-btn {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    background: var(--nx-surface-3);
    color: var(--nx-text-2);

    &:active {
      transform: scale(0.94);
    }
  }

  &__inset {
    box-shadow: none;
  }

  &__last {
    margin-bottom: 0;
  }

  &__form {
    display: flex;
    flex-direction: column;
    gap: var(--nx-space-4);
    padding-bottom: var(--nx-space-2);
  }
}

.field {
  &__label {
    margin-bottom: var(--nx-space-1);
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }

  &__help {
    margin-top: var(--nx-space-1);
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }

  &__error {
    margin-top: var(--nx-space-1);
    font-size: var(--nx-text-caption);
    color: var(--nx-danger);
  }
}

:deep(.field__input),
:deep(.field__picker .wd-picker__field),
:deep(.field__picker .wd-cell) {
  min-height: var(--nx-touch);
  padding: 0 var(--nx-space-3);
  border-radius: var(--nx-radius);
  background: var(--nx-surface);
  box-sizing: border-box;
}

:deep(.field__input) {
  display: flex;
  align-items: center;

  &::after {
    display: none;
  }
}
</style>
