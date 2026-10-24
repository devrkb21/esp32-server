<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { t } from '@/i18n'
import BleConfig from './components/ble-config.vue'
import UltrasonicConfig from './components/ultrasonic-config.vue'
import WifiConfig from './components/wifi-config.vue'
import WifiSelector from './components/wifi-selector.vue'

// Type definitions
interface WiFiNetwork {
  ssid: string
  rssi: number
  authmode: number
  channel: number
}

type ConfigType = 'wifi' | 'ble' | 'ultrasonic'

/** Translate with an English fallback for keys still waiting in src/i18n/_pending */
function tx(key: string, fallback: string) {
  const text = t(key)
  return text === key ? fallback : text
}

// Provisioning type
const configType = ref<ConfigType>('wifi')

// WiFi selector ref
const wifiSelectorRef = ref<InstanceType<typeof WifiSelector>>()

// Selected WiFi network info
const selectedWifiInfo = ref<{
  network: WiFiNetwork | null
  password: string
}>({
  network: null,
  password: '',
})

// Provisioning mode options (segmented control)
const configTypeOptions = computed(() => [
  {
    name: tx('deviceConfig.methodWifi', 'Wi‑Fi'),
    fullName: t('deviceConfig.wifiConfig'),
    hint: tx('deviceConfig.methodWifiHint', 'Your phone joins the robot’s hotspot and sends the network to it.'),
    value: 'wifi' as const,
  },
  // Bluetooth is not offered: TinyBot firmware has no BLE provisioning, and the ble-config
  // component speaks a plain-JSON protocol that ESP BluFi devices do not understand. Re-add it
  // once a robot ships a matching BLE service.
  {
    name: tx('deviceConfig.methodSound', 'Sound'),
    fullName: t('deviceConfig.ultrasonicConfig'),
    hint: tx('deviceConfig.methodSoundHintMic', 'Your phone plays a short tone the robot hears with its microphone. Turn the volume up.'),
    value: 'ultrasonic' as const,
  },
])

const currentOption = computed(() => configTypeOptions.value.find(item => item.value === configType.value) || configTypeOptions.value[0])

const hasNetwork = computed(() => !!(selectedWifiInfo.value.network && selectedWifiInfo.value.network.ssid))
const networkReady = computed(() => {
  const n = selectedWifiInfo.value.network
  if (!n || !n.ssid || !n.ssid.trim())
    return false
  return !(n.authmode > 0 && !selectedWifiInfo.value.password)
})

function selectConfigType(value: ConfigType) {
  configType.value = value
}

// WiFi network selection event
function onNetworkSelected(network: WiFiNetwork | null, password: string) {
  selectedWifiInfo.value = { network, password }
}

// ESP32 connection status change event
function onConnectionStatusChange(connected: boolean) {
  console.log('ESP32 connection status:', connected)
}
// Set navbar title after mount
onMounted(() => {
  uni.setNavigationBarTitle({
    title: t('deviceConfig.pageTitle'),
  })
})
</script>

<template>
  <view class="netcfg">
    <view class="nx-large-title netcfg__title">
      <view class="nx-large-title__title">
        {{ tx('deviceConfig.largeTitle', 'Network') }}
      </view>
      <view class="nx-large-title__subtitle">
        {{ tx('deviceConfig.subtitle', 'Connect your robot to Wi‑Fi in two steps.') }}
      </view>
    </view>

    <!-- Method -->
    <view class="nx-group">
      <view class="nx-group__header">
        {{ t('deviceConfig.configMethod') }}
      </view>
      <view class="nx-segmented" role="tablist">
        <view
          v-for="item in configTypeOptions"
          :key="item.value"
          class="nx-segmented__item"
          :class="{ 'is-active': configType === item.value }"
          role="tab"
          :aria-selected="configType === item.value"
          :aria-label="item.fullName"
          @click="selectConfigType(item.value)"
        >
          {{ item.name }}
        </view>
      </view>
      <view class="nx-group__footer">
        {{ currentOption.hint }}
      </view>
    </view>

    <!-- Step 1: network -->
    <view class="step" :class="{ 'is-done': networkReady }">
      <view class="step__head">
        <view class="nx-num step__num">
          <wd-icon v-if="networkReady" name="check" size="14px" />
          <text v-else>
            1
          </text>
        </view>
        <view class="step__title">
          {{ tx('deviceConfig.stepNetwork', 'Choose the Wi‑Fi network') }}
        </view>
      </view>
      <view class="step__body">
        <wifi-selector
          ref="wifiSelectorRef"
          @network-selected="onNetworkSelected"
          @connection-status="onConnectionStatusChange"
        />
      </view>
    </view>

    <!-- Step 2: send to the robot -->
    <view class="step" :class="{ 'is-idle': !hasNetwork }">
      <view class="step__head">
        <view class="step__num nx-num">
          2
        </view>
        <view class="step__title">
          {{ tx('deviceConfig.stepSend', 'Send it to the robot') }}
        </view>
      </view>

      <view v-if="hasNetwork" class="step__body">
        <!-- WiFi provisioning component -->
        <wifi-config
          v-if="configType === 'wifi'"
          :selected-network="selectedWifiInfo.network"
          :password="selectedWifiInfo.password"
        />

        <!-- BLE provisioning component -->
        <ble-config
          v-else-if="configType === 'ble'"
          :selected-network="selectedWifiInfo.network"
          :password="selectedWifiInfo.password"
        />

        <!-- Ultrasonic provisioning component -->
        <ultrasonic-config
          v-else-if="configType === 'ultrasonic'"
          :selected-network="selectedWifiInfo.network"
          :password="selectedWifiInfo.password"
        />
      </view>
      <view v-else class="step__placeholder">
        {{ tx('deviceConfig.stepSendIdle', 'Choose a network first.') }}
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.netcfg {
  min-height: 100vh;
  padding: calc(var(--status-bar-height, 0px) + var(--nx-space-4)) var(--nx-gutter)
    calc(var(--nx-space-7) + env(safe-area-inset-bottom));
  background: var(--nx-bg);
  box-sizing: border-box;
}

.netcfg__title {
  padding-top: var(--nx-space-3);
}

.step {
  margin-bottom: var(--nx-space-5);

  &__head {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
    padding: 0 var(--nx-space-2) var(--nx-space-2);
  }

  &__num {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 44rpx;
    height: 44rpx;
    border-radius: 50%;
    background: var(--nx-accent);
    color: var(--nx-on-accent);
    font-size: var(--nx-text-caption);
    font-weight: 700;
    transition: background-color var(--nx-dur-2) var(--nx-ease);
  }

  &__title {
    font-size: var(--nx-text-headline);
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--nx-text);
  }

  &.is-done &__num {
    background: var(--nx-success);
  }

  &.is-idle &__num {
    background: var(--nx-surface-3);
    color: var(--nx-text-3);
  }

  &.is-idle &__title {
    color: var(--nx-text-3);
  }

  &__placeholder {
    padding: var(--nx-space-4);
    border-radius: var(--nx-radius-lg);
    border: 2rpx dashed var(--nx-border-strong);
    font-size: var(--nx-text-callout);
    color: var(--nx-text-3);
    text-align: center;
  }
}
</style>

<route lang="jsonc" type="page">
{
  "style": {
    "navigationBarTitleText": "Device Configuration",
    "navigationStyle": "custom"
  }
}
</route>
