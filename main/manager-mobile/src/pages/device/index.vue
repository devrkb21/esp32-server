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

const actions = [
  { key: 'code', name: t('manualAddDeviceDialog.bindWithCode') },
  { key: 'manual', name: t('manualAddDeviceDialog.title') },
]

// Receive props
interface Props {
  agentId?: string
}

// Get distance from screen boundary to safe area
let safeAreaInsets: any
let systemInfo: any

// #ifdef MP-WEIXIN
systemInfo = uni.getWindowInfo()
safeAreaInsets = systemInfo.safeArea
  ? {
      top: systemInfo.safeArea.top,
      right: systemInfo.windowWidth - systemInfo.safeArea.right,
      bottom: systemInfo.windowHeight - systemInfo.safeArea.bottom,
      left: systemInfo.safeArea.left,
    }
  : null
// #endif

// #ifndef MP-WEIXIN
systemInfo = uni.getSystemInfoSync()
safeAreaInsets = systemInfo.safeAreaInsets
// #endif

// Device data
const deviceList = ref<Device[]>([])
const firmwareTypes = ref<FirmwareType[]>([])
const loading = ref(false)
const isBindDevice = ref(false)

// Remote control & telemetry states
const deviceStatusMap = ref<Record<string, boolean>>({})
const deviceVolumes = ref<Record<string, number>>({})
const isRebooting = ref<Record<string, boolean>>({})
const isUpdatingVolume = ref<Record<string, boolean>>({})
const volumeTimers = ref<Record<string, any>>({})

// Manual bind dialog
const isManualBindDialog = ref(false)
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

function selectBindMode(row) {
  if (row.item.key === 'code') {
    openBindDialog()
  }
  else if (row.item.key === 'manual') {
    // Reset form and errors before opening dialog
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
    isManualBindDialog.value = true
  }
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

// Refresh method exposed to parent
async function refresh() {
  await loadDeviceList()
}

// Get device type name
function getDeviceTypeName(boardKey: string): string {
  const firmwareType = firmwareTypes.value.find(type => type.key === boardKey)
  return firmwareType?.name || boardKey
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
async function handleBindDevice(code: string) {
  try {
    if (!currentAgentId.value) {
      toast.error(t('device.pleaseSelectAgent'))
      return
    }

    await bindDevice(currentAgentId.value, code.trim())
    await loadDeviceList()
    toast.success(t('device.deviceBindSuccess'))
  }
  catch (error: any) {
    console.error('Failed to bind device:', error)
    const errorMessage = error?.message || t('device.bindFailed')
    toast.error(errorMessage)
  }
}

// Open bind device dialog
function openBindDialog() {
  message
    .prompt({
      title: t('device.bindDevice'),
      inputPlaceholder: t('device.enterDeviceCode'),
      inputValue: '',
      inputPattern: /^\d{6}$/,
      confirmButtonText: t('device.bindNow'),
      cancelButtonText: t('device.cancel'),
    })
    .then(async (result: any) => {
      if (result.value && String(result.value).trim()) {
        await handleBindDevice(String(result.value).trim())
      }
    })
    .catch(() => {
      // User cancelled operation
    })
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

    await bindDeviceManual({
      agentId: currentAgentId.value,
      board: manualBindForm.value.board,
      appVersion: manualBindForm.value.appVersion,
      macAddress: manualBindForm.value.macAddress,
    })
    await loadDeviceList()
    toast.success(t('manualAddDeviceDialog.addSuccess'))
    isManualBindDialog.value = false
    // Reset form and errors
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
  catch (error: any) {
    const errorMessage = error?.message || t('manualAddDeviceDialog.addFailed')
    toast.error(errorMessage)
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
  <view class="device-container" style="background: #f5f7fb; min-height: 100%;">
    <!-- Loading state -->
    <view v-if="loading && deviceList.length === 0" class="loading-container">
      <wd-loading color="#336cff" />
      <text class="loading-text">
        {{ t('device.loading') }}
      </text>
    </view>

    <!-- Device list -->
    <view v-else-if="deviceList.length > 0" class="device-list">
      <!-- Device card list -->
      <view class="box-border flex flex-col gap-[24rpx] p-[20rpx]">
        <view v-for="device in deviceList" :key="device.id">
          <wd-swipe-action>
            <view class="cursor-pointer bg-[#fbfbfb] p-[32rpx] transition-all duration-200 active:bg-[#f8f9fa]">
              <view class="flex items-start justify-between">
                <view class="flex-1">
                  <!-- Header: Device Name & Online Status Badge -->
                  <view class="mb-[16rpx] flex items-center justify-between">
                    <text class="max-w-[60%] break-all text-[32rpx] text-[#232338] font-semibold">
                      {{ getDeviceTypeName(device.board) }}
                    </text>
                    <view
                      class="flex items-center gap-[10rpx] rounded-[24rpx] px-[16rpx] py-[6rpx]"
                      :class="deviceStatusMap[device.id] ? 'bg-[#e6f7ff] border-[1rpx] border-[#91d5ff]' : 'bg-[#f5f5f5] border-[1rpx] border-[#d9d9d9]'"
                    >
                      <view
                        class="h-[14rpx] w-[14rpx] rounded-full"
                        :class="deviceStatusMap[device.id] ? 'bg-[#52c41a]' : 'bg-[#bfbfbf]'"
                      />
                      <text
                        class="text-[22rpx] font-medium"
                        :class="deviceStatusMap[device.id] ? 'text-[#1890ff]' : 'text-[#8c8c8c]'"
                      >
                        {{ deviceStatusMap[device.id] ? t('device.online') : t('device.offline') }}
                      </text>
                    </view>
                  </view>

                  <!-- Device Info -->
                  <view class="mb-[20rpx]">
                    <text class="mb-[12rpx] block text-[28rpx] text-[#65686f] leading-[1.4]">
                      {{ t('device.macAddress') }}：{{ device.macAddress }}
                    </text>
                    <text class="mb-[12rpx] block text-[28rpx] text-[#65686f] leading-[1.4]">
                      {{ t('device.firmwareVersion') }}：{{ device.appVersion }}
                    </text>
                    <text class="block text-[28rpx] text-[#65686f] leading-[1.4]">
                      {{ t('device.lastConnection') }}：{{ formatTime(device.lastConnectedAtTimestamp) }}
                    </text>
                  </view>

                  <!-- Volume Slider -->
                  <view class="mb-[16rpx] rounded-[12rpx] border-[1rpx] border-[#eeeeee] bg-[#f5f7fb] p-[16rpx_20rpx]">
                    <view class="mb-[8rpx] flex items-center justify-between">
                      <view class="flex items-center gap-[10rpx]">
                        <wd-icon name="sound" size="16" color="#336cff" />
                        <text class="text-[26rpx] text-[#232338] font-medium">
                          {{ t('device.volume') }}
                        </text>
                      </view>
                      <text class="text-[24rpx] text-[#336cff] font-semibold">
                        {{ deviceVolumes[device.id] !== undefined ? deviceVolumes[device.id] : 70 }}%
                      </text>
                    </view>
                    <wd-slider
                      :model-value="deviceVolumes[device.id] !== undefined ? deviceVolumes[device.id] : 70"
                      :min="0"
                      :max="100"
                      :step="5"
                      :show-value="false"
                      custom-class="device-volume-slider"
                      @change="(val: any) => onVolumeChange(device, typeof val === 'object' ? val.value : val)"
                    />
                  </view>

                  <!-- Actions: OTA Switch & Reboot Button -->
                  <view class="flex items-center justify-between gap-[16rpx]">
                    <view class="flex flex-1 items-center justify-between rounded-[12rpx] border-[1rpx] border-[#eeeeee] bg-[#f5f7fb] p-[14rpx_20rpx]">
                      <text class="text-[26rpx] text-[#232338] font-medium">
                        {{ t('device.otaUpdate') }}
                      </text>
                      <wd-switch
                        :model-value="device.autoUpdate === 1"
                        size="20"
                        @change="toggleAutoUpdate(device)"
                      />
                    </view>
                    <wd-button
                      size="small"
                      type="warning"
                      plain
                      class="!h-[68rpx] !rounded-[12rpx]"
                      :loading="isRebooting[device.id]"
                      @click.stop="confirmRebootDevice(device)"
                    >
                      <wd-icon name="refresh" size="14" class="mr-[6rpx]" />
                      {{ t('device.reboot') }}
                    </wd-button>
                  </view>
                </view>
              </view>
            </view>

            <template #right>
              <view class="h-full flex">
                <view
                  class="h-full min-w-[120rpx] flex items-center justify-center bg-[#ff4d4f] p-x-[32rpx] text-[28rpx] text-white font-medium"
                  @click.stop="confirmUnbindDevice(device)"
                >
                  <wd-icon name="delete" />
                  <text>{{ t('device.unbind') }}</text>
                </view>
              </view>
            </template>
          </wd-swipe-action>
        </view>
      </view>
    </view>

    <!-- Empty state -->
    <view v-else-if="!loading" class="empty-container">
      <view class="flex flex-col items-center justify-center p-[100rpx_40rpx] text-center">
        <wd-icon name="phone" custom-class="text-[120rpx] text-[#d9d9d9] mb-[32rpx]" />
        <text class="mb-[16rpx] text-[32rpx] text-[#666666] font-medium">
          {{ t('device.noDevice') }}
        </text>
        <text class="text-[26rpx] text-[#999999] leading-[1.5]">
          {{ t('device.clickToBindFirstDevice') }}
        </text>
      </view>
    </view>

    <!-- FAB bind device button -->
    <wd-fab type="primary" size="small" icon="add" :draggable="true" :expandable="false" @click="isBindDevice = true" />

    <!-- MessageBox component -->
    <wd-message-box />
    <wd-action-sheet v-model="isBindDevice" :actions="actions" @close="isBindDevice = false" @select="selectBindMode" />

    <!-- Manual bind device dialog -->
    <wd-popup v-model="isManualBindDialog" position="bottom" :close-on-click-modal="false" custom-style="border-radius: 24rpx 24rpx 0 0;">
      <view class="manual-bind-dialog">
        <view class="dialog-header">
          <text class="dialog-title">
            {{ t('manualAddDeviceDialog.title') }}
          </text>
          <wd-icon name="close" size="20" @click="isManualBindDialog = false" />
        </view>

        <view class="dialog-content">
          <view class="form-item">
            <text class="form-label">
              {{ t('manualAddDeviceDialog.deviceType') }}
              <text class="required">
                *
              </text>
            </text>
            <wd-picker
              v-model="manualBindForm.board"
              class="custom-wd-picker"
              :columns="firmwareTypes.map(item => ({ value: item.key, label: item.name }))"
              :placeholder="t('manualAddDeviceDialog.deviceTypePlaceholder')"
              :cancel-button-text="t('common.cancel')"
              :confirm-button-text="t('common.confirm')"
              @confirm="handlePickerChange"
            />
            <text v-if="formErrors.board" class="error-text">
              {{ formErrors.board }}
            </text>
          </view>

          <view class="form-item">
            <text class="form-label">
              {{ t('manualAddDeviceDialog.firmwareVersion') }}
              <text class="required">
                *
              </text>
            </text>
            <wd-input
              v-model="manualBindForm.appVersion"
              :placeholder="t('manualAddDeviceDialog.firmwareVersionPlaceholder')"
              @input="clearFieldError('appVersion')"
              @blur="validateField('appVersion')"
            />
            <text v-if="formErrors.appVersion" class="error-text">
              {{ formErrors.appVersion }}
            </text>
          </view>

          <view class="form-item">
            <text class="form-label">
              {{ t('manualAddDeviceDialog.macAddress') }}
              <text class="required">
                *
              </text>
            </text>
            <wd-input
              v-model="manualBindForm.macAddress"
              :placeholder="t('manualAddDeviceDialog.macAddressPlaceholder')"
              @input="validateField('macAddress')"
              @blur="validateField('macAddress')"
            />
            <text v-if="formErrors.macAddress" class="error-text">
              {{ formErrors.macAddress }}
            </text>
          </view>
        </view>

        <view class="dialog-footer">
          <wd-button block type="primary" @click="handleManualBind">
            {{ t('manualAddDeviceDialog.confirm') }}
          </wd-button>
        </view>
      </view>
    </wd-popup>
  </view>
</template>

<style scoped>
.device-container {
  position: relative;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100rpx 40rpx;
}

.loading-text {
  margin-top: 20rpx;
  font-size: 28rpx;
  color: #666666;
}

:deep(.wd-swipe-action) {
  border-radius: 20rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
  border: 1rpx solid #eeeeee;
}
::v-deep .wd-action-sheet__popup,
::v-deep .wd-popup {
  z-index: 100 !important;
}
.custom-wd-picker ::v-deep .wd-picker__cell {
  padding-left: 0 !important;
}

:deep(.wd-icon) {
  font-size: 32rpx;
}

.manual-bind-dialog {
  padding: 32rpx;
  background: #ffffff;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32rpx;
}

.dialog-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #232338;
}

.dialog-content {
  margin-bottom: 32rpx;
}

.form-item {
  margin-bottom: 24rpx;
}

.form-label {
  display: block;
  font-size: 28rpx;
  color: #65686f;
  margin-bottom: 12rpx;
}

.required {
  color: #ff4d4f;
  margin-left: 4rpx;
}

.error-text {
  display: block;
  font-size: 24rpx;
  color: #ff4d4f;
  margin-top: 8rpx;
}

.dialog-footer {
  padding-top: 16rpx;
}
</style>
