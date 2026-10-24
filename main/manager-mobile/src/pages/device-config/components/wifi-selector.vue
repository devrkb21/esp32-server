<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useToast } from 'wot-design-uni/components/wd-toast'
import { t } from '@/i18n'

// Type definitions
interface WiFiNetwork {
  ssid: string
  rssi: number
  authmode: number
  channel: number
}

// Props
interface Props {
  autoConnect?: boolean // Auto check ESP32 connection
}

const props = withDefaults(defineProps<Props>(), {
  autoConnect: true,
})

// Emits
const emit = defineEmits<{
  'network-selected': [network: WiFiNetwork | null, password: string]
  'connection-status': [connected: boolean]
}>()

// Toast instance
const toast = useToast()

// Reactive data
const isConnectedToESP32 = ref(false)
const checkingConnection = ref(false)
const scanning = ref(false)
const wifiNetworks = ref<WiFiNetwork[]>([])
const selectedNetwork = ref<WiFiNetwork | null>(null)
const password = ref('')
const selectorExpanded = ref(false)

// Hidden WiFi state
const isHiddenWifi = ref(false)
const hiddenSsid = ref('')
const isHiddenEncrypted = ref(true)

// Computed properties
const networkDisplayText = computed(() => {
  if (isHiddenWifi.value) {
    return hiddenSsid.value.trim() || t('deviceConfig.hiddenWifi')
  }
  if (!selectedNetwork.value)
    return t('deviceConfig.selectWifiNetwork')
  return selectedNetwork.value.ssid
})

// Check ESP connection status
async function checkESP32Connection() {
  checkingConnection.value = true
  try {
    const response = await uni.request({
      url: 'http://192.168.4.1/scan',
      method: 'GET',
      timeout: 3000,
    })
    isConnectedToESP32.value = response.statusCode === 200
    emit('connection-status', isConnectedToESP32.value)
    console.log(`${t('deviceConfig.xiaozhi')} connection status:`, isConnectedToESP32.value)
  }
  catch (error) {
    isConnectedToESP32.value = false
    emit('connection-status', false)
    console.log('ESP connection check failed:', error)
  }
  finally {
    checkingConnection.value = false
  }
}

// Scan WiFi networks
async function scanWifi() {
  if (!isConnectedToESP32.value) {
    toast.error(t('deviceConfig.connectXiaozhiHotspot'))
    return
  }

  scanning.value = true
  console.log('Start scanning WiFi networks')

  try {
    const response = await uni.request({
      url: 'http://192.168.4.1/scan',
      method: 'GET',
      timeout: 10000,
    })

    console.log(`${t('deviceConfig.wifiScanResponse')}:`, response)

    if (response.statusCode === 200 && response.data) {
      const data = response.data as any
      if (data.success && Array.isArray(data.networks)) {
        wifiNetworks.value = data.networks
        console.log(`${t('deviceConfig.scanSuccess')}, found ${data.networks.length} ${t('deviceConfig.networks')}`)
      }
      else if (data.aps && Array.isArray(data.aps)) {
        // Compatible with { data: { support_5g, aps } } format
        wifiNetworks.value = data.aps.map((item: any) => ({
          ssid: item.ssid,
          rssi: item.rssi,
          authmode: item.authmode,
          channel: item.channel || 0,
        }))
        console.log(`${t('deviceConfig.scanSuccess')}, found ${data.aps.length} ${t('deviceConfig.networks')}`)
      }
      else if (Array.isArray(response.data)) {
        // Compatible with legacy format
        wifiNetworks.value = response.data.map((item: any) => ({
          ssid: item.ssid,
          rssi: item.rssi,
          authmode: item.authmode,
          channel: item.channel || 0,
        }))
      }
      else {
        throw new TypeError('Scan API returned abnormal format')
      }
    }
    else {
      throw new Error(`HTTP ${response.statusCode}`)
    }
  }
  catch (error) {
    console.error(`${t('deviceConfig.wifiScanFailed')}:`, error)
    toast.error(t('deviceConfig.scanFailedCheckConnection'))
  }
  finally {
    scanning.value = false
  }
}

// Show network selector
async function showNetworkSelector() {
  // Real-time detection of ESP connection status
  await checkESP32Connection()

  if (!isConnectedToESP32.value) {
    toast.error(t('deviceConfig.connectXiaozhiHotspot'))
    return
  }

  selectorExpanded.value = true

  // Auto scan if network list is empty
  if (wifiNetworks.value.length === 0) {
    scanWifi()
  }
}

// Select network
function selectNetwork(network: WiFiNetwork) {
  selectedNetwork.value = network
  password.value = ''
  selectorExpanded.value = false
  console.log('Selected network:', network.ssid)

  // Notify parent component
  emit('network-selected', network, '')
}

// Hidden WiFi toggle handler
function onHiddenWifiToggle(val: any) {
  const isChecked = typeof val === 'boolean' ? val : (val?.value ?? isHiddenWifi.value)
  isHiddenWifi.value = isChecked
  if (isChecked) {
    selectorExpanded.value = false
    selectedNetwork.value = null
    updateHiddenNetwork()
  }
  else {
    hiddenSsid.value = ''
    password.value = ''
    selectedNetwork.value = null
    emit('network-selected', null, '')
  }
}

// Hidden WiFi SSID input handler
function onHiddenSsidChange() {
  updateHiddenNetwork()
}

// Hidden WiFi encryption toggle handler
function onHiddenEncryptionChange(val: any) {
  const isEncrypted = typeof val === 'boolean' ? val : (val?.value ?? isHiddenEncrypted.value)
  isHiddenEncrypted.value = isEncrypted
  if (!isEncrypted) {
    password.value = ''
  }
  updateHiddenNetwork()
}

// Update hidden network info and notify parent
function updateHiddenNetwork() {
  const trimmedSsid = hiddenSsid.value.trim()
  if (trimmedSsid) {
    const hiddenNet: WiFiNetwork = {
      ssid: trimmedSsid,
      rssi: -50,
      authmode: isHiddenEncrypted.value ? 4 : 0,
      channel: 0,
    }
    selectedNetwork.value = hiddenNet
    emit('network-selected', hiddenNet, isHiddenEncrypted.value ? password.value : '')
  }
  else {
    selectedNetwork.value = null
    emit('network-selected', null, isHiddenEncrypted.value ? password.value : '')
  }
}

// Switch to hidden network mode from scan modal
function switchToHiddenFromModal() {
  selectorExpanded.value = false
  onHiddenWifiToggle(true)
}

// Notify parent component on password change
function onPasswordChange() {
  emit('network-selected', selectedNetwork.value, password.value)
}

// Get selected network and password
function getSelectedNetworkInfo() {
  return {
    network: selectedNetwork.value,
    password: password.value,
  }
}

// Reset selection
function reset() {
  isHiddenWifi.value = false
  hiddenSsid.value = ''
  isHiddenEncrypted.value = true
  selectedNetwork.value = null
  password.value = ''
  wifiNetworks.value = []
  selectorExpanded.value = false
  emit('network-selected', null, '')
}

// Get signal strength description
function getSignalStrength(rssi: number): string {
  if (rssi >= -50)
    return t('deviceConfig.signalStrong')
  if (rssi >= -60)
    return t('deviceConfig.signalGood')
  if (rssi >= -70)
    return t('deviceConfig.signalFair')
  return t('deviceConfig.signalWeak')
}

/** 1–4 bars for the signal icon */
function getSignalLevel(rssi: number): number {
  if (rssi >= -50)
    return 4
  if (rssi >= -60)
    return 3
  if (rssi >= -70)
    return 2
  return 1
}

/** Translate with an English fallback for keys still waiting in src/i18n/_pending */
function tx(key: string, fallback: string) {
  const text = t(key)
  return text === key ? fallback : text
}

// Expose method to parent
defineExpose({
  checkESP32Connection,
  scanWifi,
  getSelectedNetworkInfo,
  reset,
})

// Lifecycle
onMounted(() => {
  if (props.autoConnect) {
    checkESP32Connection()
  }
})
</script>

<template>
  <view class="wsel">
    <!-- Robot hotspot status -->
    <view v-if="props.autoConnect" class="nx-group wsel__group">
      <view class="nx-group__body">
        <view class="nx-row">
          <view class="nx-icon-tile wsel__status-icon" :class="isConnectedToESP32 ? 'is-ok' : 'is-warn'">
            <wd-icon :name="isConnectedToESP32 ? 'wifi' : 'wifi-error'" size="18px" />
          </view>
          <view class="nx-row__main">
            <view class="nx-row__title">
              {{ isConnectedToESP32 ? t('deviceConfig.connectedXiaozhiHotspot') : tx('deviceConfig.hotspotNeeded', 'Join the robot’s hotspot') }}
            </view>
            <view v-if="!isConnectedToESP32" class="nx-row__subtitle">
              {{ t('deviceConfig.connectXiaozhiHotspot') }}
            </view>
          </view>
          <view
            class="wsel__pill"
            role="button"
            :aria-label="isConnectedToESP32 ? t('deviceConfig.refreshStatus') : t('deviceConfig.reCheck')"
            @click="checkESP32Connection"
          >
            <wd-loading v-if="checkingConnection" size="14px" />
            <text v-else>
              {{ isConnectedToESP32 ? t('deviceConfig.refreshStatus') : t('deviceConfig.reCheck') }}
            </text>
          </view>
        </view>
      </view>
    </view>

    <view class="nx-group wsel__group">
      <view class="nx-group__body">
        <!-- Scanned network picker -->
        <view v-if="!isHiddenWifi" class="nx-row nx-row--tap" @click="showNetworkSelector">
          <view class="nx-row__main nx-row__title">
            {{ t('deviceConfig.wifiNetwork') }}
          </view>
          <view class="nx-truncate nx-row__value wsel__value" :class="{ 'is-placeholder': !selectedNetwork }">
            {{ networkDisplayText }}
          </view>
          <wd-icon name="arrow-right" size="16px" custom-class="nx-row__chevron" />
        </view>

        <!-- Password for a scanned, encrypted network -->
        <view v-if="!isHiddenWifi && selectedNetwork && selectedNetwork.authmode > 0" class="nx-row wsel__field">
          <view class="wsel__label">
            {{ t('deviceConfig.wifiPassword') }}
          </view>
          <wd-input
            v-model="password"
            :placeholder="t('deviceConfig.enterWifiPassword')"
            show-password
            clearable
            no-border
            custom-class="wsel__input"
            @input="onPasswordChange"
          />
        </view>

        <!-- Hidden network toggle -->
        <view class="nx-row">
          <view class="nx-row__main">
            <view class="nx-row__title">
              {{ t('deviceConfig.hiddenWifi') }}
            </view>
            <view class="nx-row__subtitle">
              {{ t('deviceConfig.hiddenWifiPrompt') }}
            </view>
          </view>
          <wd-switch v-model="isHiddenWifi" size="22px" @change="onHiddenWifiToggle" />
        </view>

        <!-- Hidden network inputs -->
        <template v-if="isHiddenWifi">
          <view class="nx-row wsel__field">
            <view class="wsel__label">
              {{ t('deviceConfig.hiddenWifiSsid') }}
            </view>
            <wd-input
              v-model="hiddenSsid"
              :placeholder="t('deviceConfig.enterHiddenWifiSsid')"
              clearable
              no-border
              custom-class="wsel__input"
              @input="onHiddenSsidChange"
            />
          </view>
          <view class="nx-row">
            <view class="nx-row__main nx-row__title">
              {{ t('deviceConfig.requiresPassword') }}
            </view>
            <wd-switch v-model="isHiddenEncrypted" size="22px" @change="onHiddenEncryptionChange" />
          </view>
          <view v-if="isHiddenEncrypted" class="nx-row wsel__field">
            <view class="wsel__label">
              {{ t('deviceConfig.wifiPassword') }}
            </view>
            <wd-input
              v-model="password"
              :placeholder="t('deviceConfig.enterWifiPassword')"
              show-password
              clearable
              no-border
              custom-class="wsel__input"
              @input="onPasswordChange"
            />
          </view>
        </template>
      </view>
    </view>

    <!-- Network list sheet -->
    <wd-popup
      v-model="selectorExpanded"
      position="bottom"
      safe-area-inset-bottom
      :z-index="1000"
      custom-class="wsel-sheet"
    >
      <view class="wsel-sheet__inner">
        <view class="wsel-sheet__handle" />
        <view class="wsel-sheet__header">
          <view class="wsel-sheet__title">
            {{ t('deviceConfig.selectWifiNetwork') }}
          </view>
          <view
            class="wsel__pill"
            role="button"
            :aria-label="t('deviceConfig.refreshScan')"
            @click="scanWifi"
          >
            <wd-loading v-if="scanning" size="14px" />
            <wd-icon v-else name="refresh" size="14px" />
            <text>{{ scanning ? t('deviceConfig.scanning') : t('deviceConfig.refreshScan') }}</text>
          </view>
          <view
            class="wsel-sheet__close"
            role="button"
            :aria-label="t('deviceConfig.cancel')"
            @click="selectorExpanded = false"
          >
            <wd-icon name="close" size="18px" />
          </view>
        </view>

        <scroll-view scroll-y class="wsel-sheet__list">
          <!-- Scanning skeleton -->
          <view v-if="scanning && wifiNetworks.length === 0" class="wsel-sheet__body">
            <view v-for="i in 4" :key="i" class="nx-row">
              <view class="nx-skeleton wsel__skeleton-icon" />
              <view class="nx-row__main">
                <view class="nx-skeleton wsel__skeleton-line" />
              </view>
            </view>
          </view>

          <view v-else-if="wifiNetworks.length === 0" class="nx-empty wsel-sheet__empty">
            <view class="nx-icon-tile nx-icon-tile--lg">
              <wd-icon name="wifi" size="28px" />
            </view>
            <view class="nx-empty__title">
              {{ t('deviceConfig.noWifiNetworks') }}
            </view>
            <view class="nx-empty__text">
              {{ t('deviceConfig.clickRefreshScan') }}
            </view>
          </view>

          <view v-else class="wsel-sheet__body">
            <view
              v-for="(network, index) in wifiNetworks"
              :key="`${network.ssid}-${index}`"
              class="nx-row nx-row--tap"
              @click="selectNetwork(network)"
            >
              <view
                class="wsel-bars"
                :class="`is-${getSignalLevel(network.rssi)}`"
                role="img"
                :aria-label="getSignalStrength(network.rssi)"
              >
                <view v-for="bar in 4" :key="bar" class="wsel-bars__bar" />
              </view>
              <view class="nx-row__main">
                <view class="nx-row__title nx-truncate" :title="network.ssid">
                  {{ network.ssid }}
                </view>
                <view class="nx-row__subtitle nx-num">
                  {{ getSignalStrength(network.rssi) }} · {{ network.rssi }} dBm{{ network.channel ? ` · ${t('deviceConfig.channel')} ${network.channel}` : '' }}
                </view>
              </view>
              <view v-if="network.authmode > 0" class="nx-badge" :aria-label="t('deviceConfig.encryptedNetwork')">
                <wd-icon name="lock-on" size="12px" />
              </view>
              <view v-else class="nx-badge">
                {{ tx('deviceConfig.open', 'Open') }}
              </view>
              <wd-icon
                v-if="selectedNetwork && selectedNetwork.ssid === network.ssid"
                name="check"
                size="18px"
                custom-class="wsel__check"
              />
            </view>
          </view>
        </scroll-view>

        <view class="wsel-sheet__body wsel-sheet__hidden">
          <view class="nx-row nx-row--tap" @click="switchToHiddenFromModal">
            <view class="nx-icon-tile nx-icon-tile--neutral wsel__status-icon">
              <wd-icon name="add" size="18px" />
            </view>
            <view class="nx-row__main nx-row__title">
              {{ t('deviceConfig.addHiddenNetwork') }}
            </view>
          </view>
        </view>
      </view>
    </wd-popup>
  </view>
</template>

<style lang="scss" scoped>
.wsel {
  width: 100%;

  &__group {
    margin-bottom: var(--nx-space-3);

    &:last-of-type {
      margin-bottom: 0;
    }
  }

  &__status-icon {
    width: 60rpx;
    height: 60rpx;
    border-radius: var(--nx-radius-sm);

    &.is-ok {
      background: var(--nx-success-soft);
      color: var(--nx-success);
    }

    &.is-warn {
      background: var(--nx-warning-soft);
      color: var(--nx-warning);
    }
  }

  &__pill {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8rpx;
    min-height: 60rpx;
    padding: 0 var(--nx-space-3);
    border-radius: var(--nx-radius-pill);
    background: var(--nx-surface-2);
    color: var(--nx-accent);
    font-size: var(--nx-text-footnote);
    font-weight: 600;
    transition: transform var(--nx-dur-1) var(--nx-ease);

    &:active {
      transform: scale(0.97);
    }
  }

  &__value {
    max-width: 55%;

    &.is-placeholder {
      color: var(--nx-text-3);
    }
  }

  &__field {
    flex-direction: column;
    align-items: stretch;
    gap: 4rpx;
  }

  &__label {
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }

  &__skeleton-icon {
    width: 40rpx;
    height: 32rpx;
  }

  &__skeleton-line {
    width: 55%;
    height: 28rpx;
  }
}

:deep(.wsel__input) {
  padding: 0;
  background: transparent;
}

:deep(.wsel__check) {
  flex: none;
  color: var(--nx-accent);
}

/* signal strength: four rising bars, filled up to the level */
.wsel-bars {
  display: flex;
  flex: none;
  align-items: flex-end;
  gap: 4rpx;
  width: 40rpx;
  height: 32rpx;

  &__bar {
    flex: 1;
    border-radius: 2rpx;
    background: var(--nx-surface-3);

    &:nth-child(1) {
      height: 25%;
    }

    &:nth-child(2) {
      height: 50%;
    }

    &:nth-child(3) {
      height: 75%;
    }

    &:nth-child(4) {
      height: 100%;
    }
  }

  &.is-2 &__bar:nth-child(-n + 2),
  &.is-3 &__bar:nth-child(-n + 3),
  &.is-4 &__bar:nth-child(-n + 4) {
    background: var(--nx-text);
  }

  &.is-1 &__bar:nth-child(1) {
    background: var(--nx-warning);
  }
}

:deep(.wsel-sheet) {
  border-radius: var(--nx-radius-xl) var(--nx-radius-xl) 0 0;
  background: var(--nx-bg);
  overflow: hidden;
}

.wsel-sheet {
  &__inner {
    display: flex;
    flex-direction: column;
    max-height: 80vh;
    padding: 0 var(--nx-gutter) var(--nx-space-4);
    box-sizing: border-box;
  }

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
    padding: var(--nx-space-2) 0 var(--nx-space-3);
  }

  &__title {
    flex: 1;
    min-width: 0;
    font-size: var(--nx-text-headline);
    font-weight: 600;
    color: var(--nx-text);
  }

  &__close {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    background: var(--nx-surface-3);
    color: var(--nx-text-2);
  }

  &__list {
    flex: 1;
    min-height: 0;
    max-height: 52vh;
  }

  &__body {
    overflow: hidden;
    border-radius: var(--nx-radius-lg);
    background: var(--nx-surface);
  }

  &__empty {
    padding: var(--nx-space-5) var(--nx-space-4);
  }

  &__hidden {
    flex: none;
    margin-top: var(--nx-space-3);
  }
}

@media (prefers-reduced-motion: reduce) {
  .wsel__pill {
    transition: none;
  }
}
</style>
