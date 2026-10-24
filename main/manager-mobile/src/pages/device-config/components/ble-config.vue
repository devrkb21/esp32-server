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

/** Translate with an English fallback for keys still waiting in src/i18n/_pending */
function tx(key: string, fallback: string) {
  const text = t(key)
  return text === key ? fallback : text
}

// Progress: find the robot -> connect and send -> done
const stages = computed(() => [
  { key: 'scan', label: tx('deviceConfig.bleStageFind', 'Find robot') },
  { key: 'connect', label: tx('deviceConfig.bleStageSend', 'Send Wi‑Fi') },
  { key: 'done', label: tx('deviceConfig.bleStageDone', 'Done') },
])
const stageIndex = computed(() => stages.value.findIndex(s => s.key === step.value))

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
  <view class="ble">
    <!-- Progress -->
    <view class="ble__stages" role="list">
      <view
        v-for="(s, i) in stages"
        :key="s.key"
        class="ble__stage"
        :class="{ 'is-done': i < stageIndex || step === 'done', 'is-current': i === stageIndex }"
        role="listitem"
      >
        <view class="ble__stage-bar" />
        <text class="ble__stage-label">
          {{ s.label }}
        </text>
      </view>
    </view>

    <view class="nx-group ble__group">
      <view class="nx-group__body">
        <!-- Header with scan action -->
        <view class="nx-row">
          <view class="nx-icon-tile ble__icon">
            <wd-icon name="link" size="18px" />
          </view>
          <view class="nx-row__main">
            <view class="nx-row__title ble__strong">
              {{ t('deviceConfig.bleConfig') }}
            </view>
            <view class="nx-row__subtitle">
              {{ t('deviceConfig.bleGuide') }}
            </view>
          </view>
          <view
            v-if="step === 'scan'"
            class="ble__pill"
            :class="{ 'is-stop': scanning }"
            role="button"
            @click="scanning ? stopScan() : startScan()"
          >
            {{ scanning ? t('deviceConfig.bleStopScan') : tx('deviceConfig.bleScanShort', 'Scan') }}
          </view>
        </view>

        <!-- Target Wi-Fi -->
        <view v-if="selectedNetwork" class="nx-row">
          <view class="nx-icon-tile ble__icon nx-icon-tile--neutral">
            <wd-icon name="wifi" size="18px" />
          </view>
          <view class="nx-row__main">
            <view class="nx-row__title nx-truncate" :title="selectedNetwork.ssid">
              {{ selectedNetwork.ssid }}
            </view>
          </view>
          <view v-if="selectedNetwork.hidden" class="nx-badge">
            {{ t('deviceConfig.hiddenWifi') }}
          </view>
          <view class="nx-badge">
            <wd-icon v-if="password" name="lock-on" size="12px" />
            {{ password ? '••••••' : t('deviceConfig.openNetwork') }}
          </view>
        </view>
      </view>
      <view v-if="statusMessage && step === 'scan'" class="nx-group__footer" role="status">
        {{ statusMessage }}
      </view>
    </view>

    <!-- Step 1: scan and pick a robot -->
    <view v-if="step === 'scan'">
      <view v-if="scanning && devices.length === 0" class="nx-group ble__group">
        <view class="nx-group__header ble__scanning">
          <wd-loading size="14px" />
          <text>{{ t('deviceConfig.bleScanning') }}</text>
        </view>
        <view class="nx-group__body">
          <view v-for="i in 3" :key="i" class="nx-row">
            <view class="nx-skeleton ble__skeleton-icon" />
            <view class="nx-row__main">
              <view class="nx-skeleton ble__skeleton-line" />
              <view class="nx-skeleton ble__skeleton-line ble__skeleton-line--short" />
            </view>
          </view>
        </view>
      </view>

      <view v-else-if="devices.length > 0" class="nx-group ble__group">
        <view class="nx-group__header ble__scanning">
          <wd-loading v-if="scanning" size="14px" />
          <text>{{ tx('deviceConfig.bleNearby', 'Nearby robots') }}</text>
        </view>
        <view class="nx-group__body">
          <view
            v-for="dev in devices"
            :key="dev.deviceId"
            class="nx-row nx-row--tap"
            @click="handleSelectAndProvision(dev)"
          >
            <view class="nx-icon-tile ble__icon">
              <wd-icon name="mobile" size="18px" />
            </view>
            <view class="nx-row__main">
              <view class="nx-row__title nx-truncate ble__strong" :title="dev.name">
                {{ dev.name || dev.deviceId }}
              </view>
              <view class="nx-caption nx-mono nx-break">
                {{ dev.deviceId }} · RSSI {{ dev.RSSI }}
              </view>
            </view>
            <view class="ble__pill ble__pill--solid">
              {{ tx('deviceConfig.connect', 'Connect') }}
            </view>
          </view>
        </view>
      </view>

      <view v-else-if="!scanning" class="nx-empty ble__empty">
        <view class="nx-icon-tile nx-icon-tile--lg">
          <wd-icon name="link" size="28px" />
        </view>
        <view class="nx-empty__text">
          {{ t('deviceConfig.bleNoDevices') }}
        </view>
        <view class="nx-btn nx-btn--primary ble__empty-btn" @click="startScan">
          {{ t('deviceConfig.bleScanDevices') }}
        </view>
      </view>
    </view>

    <!-- Step 2: connecting and sending -->
    <view v-else-if="step === 'connect'" class="nx-card ble__state" role="status">
      <wd-loading size="32px" />
      <view class="nx-headline ble__state-title">
        {{ connecting ? t('deviceConfig.bleConnecting') : t('deviceConfig.bleSending') }}
      </view>
      <view class="nx-caption nx-mono nx-break">
        {{ selectedDevice?.name }} ({{ selectedDevice?.deviceId }})
      </view>
    </view>

    <!-- Step 3: done -->
    <view v-else-if="step === 'done'" class="nx-card ble__state" role="status">
      <view class="ble__success">
        <wd-icon name="check" size="28px" />
      </view>
      <view class="nx-headline ble__state-title">
        {{ t('deviceConfig.configSuccess') }}
      </view>
      <view class="nx-footnote ble__state-text">
        {{ t('deviceConfig.bleSuccess') }}
      </view>
      <view class="nx-btn nx-btn--primary ble__empty-btn" @click="resetAndScan">
        {{ tx('deviceConfig.done', 'Done') }}
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.ble {
  &__stages {
    display: flex;
    gap: var(--nx-space-1);
    margin-bottom: var(--nx-space-4);
  }

  &__stage {
    flex: 1;
    min-width: 0;
  }

  &__stage-bar {
    height: 8rpx;
    border-radius: var(--nx-radius-pill);
    background: var(--nx-surface-3);
    transition: background-color var(--nx-dur-2) var(--nx-ease);
  }

  &__stage-label {
    display: block;
    margin-top: var(--nx-space-1);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: var(--nx-text-caption);
    font-weight: 500;
    color: var(--nx-text-3);
  }

  &__stage.is-current &__stage-bar {
    background: var(--nx-accent);
  }

  &__stage.is-current &__stage-label {
    color: var(--nx-text);
  }

  &__stage.is-done &__stage-bar {
    background: var(--nx-success);
  }

  &__stage.is-done &__stage-label {
    color: var(--nx-text-2);
  }

  &__group {
    margin-bottom: var(--nx-space-4);

    &:last-child {
      margin-bottom: 0;
    }
  }

  &__icon {
    width: 60rpx;
    height: 60rpx;
    border-radius: var(--nx-radius-sm);
  }

  &__strong {
    font-weight: 600;
  }

  &__pill {
    display: flex;
    flex: none;
    align-items: center;
    min-height: 60rpx;
    padding: 0 var(--nx-space-3);
    border-radius: var(--nx-radius-pill);
    background: var(--nx-accent-soft);
    color: var(--nx-accent);
    font-size: var(--nx-text-footnote);
    font-weight: 600;
    transition: transform var(--nx-dur-1) var(--nx-ease);

    &:active {
      transform: scale(0.97);
    }

    &.is-stop {
      background: var(--nx-danger-soft);
      color: var(--nx-danger);
    }

    &--solid {
      background: var(--nx-accent);
      color: var(--nx-on-accent);
    }
  }

  &__scanning {
    display: flex;
    align-items: center;
    gap: var(--nx-space-1);
  }

  &__empty {
    padding: var(--nx-space-5) var(--nx-space-4);
  }

  &__empty-btn {
    margin-top: var(--nx-space-3);
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--nx-space-2);
    padding: var(--nx-space-6) var(--nx-space-4);
    text-align: center;
  }

  &__state-title {
    margin-top: var(--nx-space-2);
  }

  &__state-text {
    max-width: 520rpx;
  }

  &__success {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 96rpx;
    height: 96rpx;
    border-radius: 50%;
    background: var(--nx-success-soft);
    color: var(--nx-success);
  }

  &__skeleton-icon {
    width: 60rpx;
    height: 60rpx;
  }

  &__skeleton-line {
    width: 55%;
    height: 28rpx;

    &--short {
      width: 35%;
      height: 22rpx;
      margin-top: 12rpx;
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .ble__stage-bar,
  .ble__pill {
    transition: none;
  }
}
</style>
