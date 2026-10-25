<script setup lang="ts">
// Bluetooth setup: find the robot nearby, connect, write the Wi-Fi to it. Phone app only (a browser
// has no uni Bluetooth API). Emits `done` once the robot has the credentials, `back` to change them.
import type { BleDevice } from '../utils/bleProvisionUtils.mjs'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getCurrentLanguage, t } from '@/i18n'
import { digits } from '@/utils/calendar.mjs'
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

interface WiFiNetwork {
  ssid: string
  rssi: number
  authmode: number
  channel: number
  hidden?: boolean
}

interface Props {
  selectedNetwork: WiFiNetwork | null
  password: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'done', result: { ssid: string, unconfirmed: boolean }): void
  (e: 'back'): void
}>()

const scanning = ref(false)
const connecting = ref(false)
const sending = ref(false)
const bluetoothReady = ref(false)
const devices = ref<BleDevice[]>([])
const selectedDevice = ref<BleDevice | null>(null)
const step = ref<'scan' | 'connect' | 'done'>('scan')
const statusMessage = ref('')
const lang = computed(() => getCurrentLanguage())

const canProvision = computed(() => {
  if (!props.selectedNetwork || !props.selectedNetwork.ssid || !props.selectedNetwork.ssid.trim())
    return false
  if (props.selectedNetwork.authmode > 0 && !props.password)
    return false
  return true
})

async function initBle() {
  const ready = await openBluetoothAdapter()
  bluetoothReady.value = ready
  if (!ready) {
    statusMessage.value = t('msetup.ble.off')
    return
  }
  startScan()
}

let scanTimer: ReturnType<typeof setTimeout> | null = null

async function startScan() {
  if (scanning.value)
    return
  if (!bluetoothReady.value) {
    initBle()
    return
  }
  devices.value = []
  scanning.value = true
  statusMessage.value = ''

  const started = await startBleDiscovery((device: BleDevice) => {
    const index = devices.value.findIndex(d => d.deviceId === device.deviceId)
    if (index >= 0) {
      devices.value[index] = device
    }
    else {
      // ESP32 / provisioning devices first
      const name = (device.name || '').toLowerCase()
      if (name.includes('esp') || name.includes('xiaozhi') || name.includes('prov') || name.includes('tinybot'))
        devices.value.unshift(device)
      else
        devices.value.push(device)
    }
  })

  if (!started) {
    scanning.value = false
    statusMessage.value = t('msetup.ble.scanFailed')
  }

  // Stop by itself after 20 seconds
  if (scanTimer)
    clearTimeout(scanTimer)
  scanTimer = setTimeout(() => {
    if (scanning.value)
      stopScan()
  }, 20000)
}

async function stopScan() {
  scanning.value = false
  await stopBleDiscovery()
}

async function handleSelectAndProvision(device: BleDevice) {
  if (!canProvision.value) {
    toast.error(t('msetup.err.chooseNetwork'))
    return
  }
  selectedDevice.value = device
  await stopScan()

  connecting.value = true
  step.value = 'connect'
  statusMessage.value = ''

  try {
    const conn = await connectBleDevice(device.deviceId)
    if (!conn) {
      connecting.value = false
      step.value = 'scan'
      statusMessage.value = t('msetup.ble.failed')
      return
    }

    connecting.value = false
    sending.value = true
    const sent = await sendWifiCredentialsOverBle(device.deviceId, conn.serviceId, conn.writeCharId, {
      ssid: props.selectedNetwork!.ssid,
      password: props.password,
      hidden: Boolean(props.selectedNetwork?.hidden),
    })
    sending.value = false

    if (sent) {
      step.value = 'done'
      toast.success(t('msetup.done.toast'))
      setTimeout(async () => {
        await disconnectBleDevice(device.deviceId)
      }, 2000)
      emit('done', { ssid: props.selectedNetwork!.ssid, unconfirmed: false })
    }
    else {
      step.value = 'scan'
      statusMessage.value = t('msetup.ble.failed')
      await disconnectBleDevice(device.deviceId)
    }
  }
  catch (error) {
    console.error('BLE provisioning error:', error)
    connecting.value = false
    sending.value = false
    step.value = 'scan'
    statusMessage.value = t('msetup.ble.failed')
    if (device.deviceId)
      disconnectBleDevice(device.deviceId).catch(() => {})
  }
}

onMounted(() => {
  initBle()
})

onBeforeUnmount(async () => {
  if (scanTimer)
    clearTimeout(scanTimer)
  await stopScan()
  if (selectedDevice.value)
    await disconnectBleDevice(selectedDevice.value.deviceId).catch(() => {})
  await closeBluetoothAdapter().catch(() => {})
})
</script>

<template>
  <view class="setup-step">
    <view class="setup-step__body">
      <text class="setup-h">
        {{ t('msetup.ble.title') }}
      </text>
      <text class="setup-lead">
        {{ t('msetup.ble.text') }}
      </text>

      <view v-if="selectedNetwork" class="setup-table">
        <view class="setup-row">
          <text class="setup-key">
            {{ t('msetup.send.network') }}
          </text>
          <view class="setup-val">
            <text class="setup-ssid">
              {{ selectedNetwork.ssid }}
            </text>
            <tb-tag v-if="selectedNetwork.hidden">
              {{ t('msetup.net.hidden') }}
            </tb-tag>
          </view>
          <tb-button size="s" variant="quiet" icon="edit" :disabled="step === 'connect'" @click="emit('back')">
            {{ t('msetup.send.change') }}
          </tb-button>
        </view>
      </view>

      <view v-if="step === 'connect'" class="ble__busy" role="status">
        <tb-loading :label="connecting ? t('msetup.ble.connecting') : t('msetup.ble.sending')" />
        <text class="ble__dev">
          {{ selectedDevice?.name || t('msetup.ble.unnamed') }}
        </text>
      </view>

      <block v-else>
        <view class="ble__head">
          <text class="setup-label">
            {{ t('msetup.ble.nearby') }}
          </text>
          <tb-loading v-if="scanning" :label="t('msetup.ble.scanning')" />
        </view>
        <view v-if="devices.length" class="ble__list" role="list">
          <view v-for="dev in devices" :key="dev.deviceId" class="ble__item" role="listitem">
            <tb-icon name="bluetooth" :size="20" class="ble__icon" />
            <view class="ble__main">
              <text class="ble__name">
                {{ dev.name || t('msetup.ble.unnamed') }}
              </text>
              <text class="ble__sub tb-num">
                {{ t('msetup.ble.signal', { n: digits(dev.RSSI, lang) }) }}
              </text>
            </view>
            <tb-button size="s" variant="primary" icon="send" @click="handleSelectAndProvision(dev)">
              {{ t('msetup.ble.connect') }}
            </tb-button>
          </view>
        </view>
        <tb-empty
          v-else-if="!scanning" face="confused" :title="statusMessage || t('msetup.ble.none')"
          :text="bluetoothReady ? t('msetup.ble.noneText') : ''"
        />
        <view v-if="statusMessage && devices.length" class="setup-alert" role="alert">
          <tb-icon name="warning" :size="18" /><text>{{ statusMessage }}</text>
        </view>
      </block>
    </view>

    <view class="setup-foot">
      <tb-button v-if="scanning" size="l" block icon="stop" @click="stopScan">
        {{ t('msetup.ble.stop') }}
      </tb-button>
      <tb-button v-else variant="primary" size="l" block icon="search" :disabled="step === 'connect'" @click="startScan">
        {{ t('msetup.ble.scan') }}
      </tb-button>
    </view>
  </view>
</template>

<style lang="scss">
@import './setup-shared.scss';

.ble__busy {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 22px;
  padding: 16px 0;
  border-top: 1px solid var(--tb-rule);
  border-bottom: 1px solid var(--tb-rule);
}
.ble__dev {
  font-weight: 600;
  word-break: break-all;
}
.ble__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 22px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--tb-rule);
}
.ble__list {
  display: flex;
  flex-direction: column;
}
.ble__item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 60px;
  padding: 8px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.ble__icon {
  color: var(--tb-ink-2);
}
.ble__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ble__name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ble__sub {
  color: var(--tb-ink-2);
  font-size: 13px;
}
</style>
