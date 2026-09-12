<script setup lang="ts">
import type { BleDevice } from '../utils/bleProvisionUtils.mjs'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { t } from '@/i18n'
import { toast } from '@/utils/toast'
import {
  closeBluetoothAdapter,
  connectBleDevice,
  disconnectBleDevice,
  openBluetoothAdapter,
  sendWifiCredentialsOverBle,
  startBleDiscovery,
  stopBleDiscovery,
} from '../utils/bleProvisionUtils.mjs'

// Type definitions
interface WiFiNetwork {
  ssid: string
  rssi: number
  authmode: number
  channel: number
  hidden?: boolean
}

// Props
interface Props {
  selectedNetwork: WiFiNetwork | null
  password: string
}

const props = defineProps<Props>()

// Reactive states
const scanning = ref(false)
const connecting = ref(false)
const sending = ref(false)
const bluetoothReady = ref(false)
const devices = ref<BleDevice[]>([])
const selectedDevice = ref<BleDevice | null>(null)
const step = ref<'scan' | 'connect' | 'done'>('scan')
const statusMessage = ref('')

const canProvision = computed(() => {
  if (!props.selectedNetwork || !props.selectedNetwork.ssid || !props.selectedNetwork.ssid.trim()) {
    return false
  }
  if (props.selectedNetwork.authmode > 0 && !props.password) {
    return false
  }
  return true
})

// Initialize Bluetooth
async function initBle() {
  const ready = await openBluetoothAdapter()
  bluetoothReady.value = ready
  if (!ready) {
    statusMessage.value = t('deviceConfig.bleNotAvailable') || 'Please enable Bluetooth to use fast provisioning'
    return
  }
  startScan()
}

// Start Device Scan
async function startScan() {
  if (scanning.value) {
    return
  }

  devices.value = []
  scanning.value = true
  statusMessage.value = t('deviceConfig.bleScanning') || 'Scanning for nearby ESP32 devices...'

  const started = await startBleDiscovery((device) => {
    // Check if device already in list
    const index = devices.value.findIndex(d => d.deviceId === device.deviceId)
    if (index >= 0) {
      devices.value[index] = device
    }
    else {
      // Prioritize ESP32 / Xiaozhi devices
      const isEsp = device.name.toLowerCase().includes('esp')
        || device.name.toLowerCase().includes('xiaozhi')
        || device.name.toLowerCase().includes('prov')
      if (isEsp) {
        devices.value.unshift(device)
      }
      else {
        devices.value.push(device)
      }
    }
  })

  if (!started) {
    scanning.value = false
    statusMessage.value = t('deviceConfig.bleFailed') || 'Failed to start Bluetooth scan'
  }

  // Auto stop scanning after 20 seconds
  setTimeout(() => {
    if (scanning.value) {
      stopScan()
    }
  }, 20000)
}

// Stop Scanning
async function stopScan() {
  scanning.value = false
  await stopBleDiscovery()
  if (devices.value.length === 0) {
    statusMessage.value = t('deviceConfig.bleNoDevices') || 'No ESP32 Bluetooth devices found. Ensure device is in pairing mode.'
  }
  else {
    statusMessage.value = ''
  }
}

// Select device and provision WiFi
async function handleSelectAndProvision(device: BleDevice) {
  if (!canProvision.value) {
    toast.error(t('deviceConfig.selectWifiNetwork') || 'Please select a WiFi network and enter password')
    return
  }

  selectedDevice.value = device
  await stopScan()

  connecting.value = true
  step.value = 'connect'
  statusMessage.value = t('deviceConfig.bleConnecting') || 'Connecting to ESP32...'

  try {
    const conn = await connectBleDevice(device.deviceId)
    if (!conn) {
      connecting.value = false
      step.value = 'scan'
      toast.error(t('deviceConfig.bleFailed') || 'Failed to connect via Bluetooth')
      statusMessage.value = t('deviceConfig.bleFailed') || 'Connection failed. Please retry.'
      return
    }

    connecting.value = false
    sending.value = true
    statusMessage.value = t('deviceConfig.bleSending') || 'Sending WiFi configuration...'

    const sent = await sendWifiCredentialsOverBle(device.deviceId, conn.serviceId, conn.writeCharId, {
      ssid: props.selectedNetwork!.ssid,
      password: props.password,
      hidden: Boolean(props.selectedNetwork?.hidden),
    })

    sending.value = false

    if (sent) {
      step.value = 'done'
      statusMessage.value = t('deviceConfig.bleSuccess') || 'WiFi credentials sent successfully via Bluetooth!'
      toast.success(t('deviceConfig.bleSuccess') || 'WiFi configured successfully!')

      // Disconnect after 2 seconds
      setTimeout(async () => {
        await disconnectBleDevice(device.deviceId)
      }, 2000)
    }
    else {
      step.value = 'scan'
      toast.error(t('deviceConfig.bleFailed') || 'Failed to send credentials over Bluetooth')
      statusMessage.value = t('deviceConfig.bleFailed') || 'Provisioning failed. Please retry.'
      await disconnectBleDevice(device.deviceId)
    }
  }
  catch (error) {
    console.error('BLE provisioning error:', error)
    connecting.value = false
    sending.value = false
    step.value = 'scan'
    toast.error(t('deviceConfig.bleFailed') || 'BLE Provisioning failed')
    statusMessage.value = t('deviceConfig.bleFailed') || 'Error occurred during provisioning'
    if (device.deviceId) {
      disconnectBleDevice(device.deviceId).catch(() => {})
    }
  }
}

// Reset and scan again
function resetAndScan() {
  step.value = 'scan'
  selectedDevice.value = null
  statusMessage.value = ''
  startScan()
}

onMounted(() => {
  initBle()
})

onBeforeUnmount(async () => {
  await stopScan()
  if (selectedDevice.value) {
    await disconnectBleDevice(selectedDevice.value.deviceId).catch(() => {})
  }
  await closeBluetoothAdapter().catch(() => {})
})
</script>

<template>
  <view class="mb-[24rpx] border border-[#eeeeee] rounded-[20rpx] bg-[#fbfbfb] p-[24rpx]" style="box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);">
    <!-- Header with Action -->
    <view class="mb-[20rpx] flex items-center justify-between">
      <view class="flex items-center space-x-[12rpx]">
        <wd-icon name="chart-bubble" size="20px" custom-class="text-[#336cff]" />
        <text class="text-[28rpx] text-[#232338] font-bold">
          {{ t('deviceConfig.bleConfig') }}
        </text>
      </view>
      <view
        v-if="step === 'scan'"
        class="cursor-pointer rounded-[14rpx] px-[20rpx] py-[8rpx] text-[24rpx] font-medium transition-all"
        :class="scanning ? 'bg-[rgba(255,107,107,0.1)] text-[#ff6b6b]' : 'bg-[rgba(51,108,255,0.1)] text-[#336cff] active:bg-[#336cff] active:text-white'"
        @click="scanning ? stopScan() : startScan()"
      >
        {{ scanning ? (t('deviceConfig.bleStopScan') || 'Stop') : (t('deviceConfig.bleScanDevices') || 'Scan') }}
      </view>
    </view>

    <!-- Guide info -->
    <view class="mb-[20rpx] rounded-[12rpx] bg-[#f5f7fb] p-[16rpx]">
      <text class="text-[24rpx] text-[#65686f] leading-[34rpx]">
        💡 {{ t('deviceConfig.bleGuide') || 'Connect to ESP32 without leaving mobile data. Make sure Bluetooth is on and device is near.' }}
      </text>
    </view>

    <!-- Selected Target WiFi Preview -->
    <view v-if="selectedNetwork" class="mb-[24rpx] flex items-center justify-between rounded-[12rpx] border border-[#eeeeee] bg-white p-[18rpx]">
      <view class="flex items-center space-x-[12rpx]">
        <wd-icon name="wifi" size="18px" custom-class="text-[#336cff]" />
        <view>
          <text class="text-[26rpx] text-[#232338] font-semibold">
            {{ selectedNetwork.ssid }}
          </text>
          <text v-if="selectedNetwork.hidden" class="ml-[10rpx] rounded bg-[#eef3ff] px-[8rpx] py-[2rpx] text-[20rpx] text-[#336cff]">
            {{ t('deviceConfig.hiddenWifi') || 'Hidden' }}
          </text>
        </view>
      </view>
      <text class="text-[24rpx] text-[#9d9ea3]">
        {{ password ? '••••••••' : (t('deviceConfig.noPassword') || 'Open') }}
      </text>
    </view>

    <!-- Status Message Display -->
    <view v-if="statusMessage" class="mb-[20rpx] text-center">
      <text class="text-[24rpx] font-medium" :class="step === 'done' ? 'text-[#07c160]' : 'text-[#65686f]'">
        {{ statusMessage }}
      </text>
    </view>

    <!-- Step 1: Scan & Device Selection -->
    <view v-if="step === 'scan'">
      <!-- Loading Indicator -->
      <view v-if="scanning && devices.length === 0" class="flex flex-col items-center justify-center py-[40rpx]">
        <wd-loading size="28px" color="#336cff" />
        <text class="mt-[16rpx] text-[26rpx] text-[#9d9ea3]">
          {{ t('deviceConfig.bleScanning') }}
        </text>
      </view>

      <!-- Found Devices List -->
      <view v-else-if="devices.length > 0" class="space-y-[14rpx]">
        <view
          v-for="dev in devices"
          :key="dev.deviceId"
          class="flex cursor-pointer items-center justify-between rounded-[14rpx] border border-[#eeeeee] bg-white p-[22rpx] transition-all active:border-[#336cff] active:bg-[#eef3ff]"
          @click="handleSelectAndProvision(dev)"
        >
          <view class="flex items-center space-x-[16rpx]">
            <view class="flex h-[44rpx] w-[44rpx] items-center justify-center rounded-full bg-[rgba(51,108,255,0.1)] text-[#336cff]">
              <wd-icon name="chart-bubble" size="16px" />
            </view>
            <view>
              <text class="text-[28rpx] text-[#232338] font-bold">
                {{ dev.name }}
              </text>
              <text class="mt-[2rpx] block text-[22rpx] text-[#9d9ea3]">
                {{ dev.deviceId }}
              </text>
            </view>
          </view>
          <view class="flex items-center space-x-[12rpx]">
            <text class="text-[22rpx] text-[#9d9ea3]">
              RSSI {{ dev.RSSI }}
            </text>
            <view class="rounded-[10rpx] bg-[#336cff] px-[20rpx] py-[8rpx] text-[24rpx] text-white font-medium">
              {{ t('deviceConfig.connect') || 'Connect' }}
            </view>
          </view>
        </view>
      </view>

      <!-- Empty State -->
      <view v-else-if="!scanning" class="py-[30rpx] text-center">
        <text class="block text-[26rpx] text-[#9d9ea3]">
          {{ t('deviceConfig.bleNoDevices') }}
        </text>
        <view
          class="mt-[20rpx] inline-block cursor-pointer rounded-[20rpx] bg-[#336cff] px-[32rpx] py-[14rpx] text-[26rpx] text-white font-semibold shadow-sm active:opacity-90"
          @click="startScan"
        >
          {{ t('deviceConfig.bleScanDevices') }}
        </view>
      </view>
    </view>

    <!-- Step 2: Connecting & Sending Credentials -->
    <view v-else-if="step === 'connect'" class="flex flex-col items-center justify-center py-[50rpx]">
      <wd-loading size="36px" color="#336cff" />
      <text class="mt-[24rpx] text-[30rpx] text-[#232338] font-bold">
        {{ connecting ? t('deviceConfig.bleConnecting') : t('deviceConfig.bleSending') }}
      </text>
      <text class="mt-[8rpx] text-[24rpx] text-[#9d9ea3]">
        {{ selectedDevice?.name }} ({{ selectedDevice?.deviceId }})
      </text>
    </view>

    <!-- Step 3: Success -->
    <view v-else-if="step === 'done'" class="flex flex-col items-center justify-center py-[40rpx]">
      <view class="flex h-[64rpx] w-[64rpx] items-center justify-center rounded-full bg-[rgba(7,193,96,0.1)] text-[#07c160]">
        <wd-icon name="check" size="24px" />
      </view>
      <text class="mt-[20rpx] text-[30rpx] text-[#232338] font-bold">
        {{ t('deviceConfig.configSuccess') }}!
      </text>
      <text class="mt-[8rpx] text-center text-[24rpx] text-[#65686f]">
        {{ t('deviceConfig.bleSuccess') }}
      </text>
      <view
        class="mt-[30rpx] cursor-pointer rounded-[20rpx] bg-[#336cff] px-[36rpx] py-[16rpx] text-[26rpx] text-white font-semibold active:opacity-90"
        @click="resetAndScan"
      >
        {{ t('common.done') || 'Done' }}
      </view>
    </view>
  </view>
</template>
