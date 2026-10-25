<script setup lang="ts">
// The Wi-Fi TinyBot should join. Hotspot setup: is the phone on TinyBot's hotspot, then pick from
// the networks the robot sees (or type a hidden one). Sound and Bluetooth setup (`canScan` false):
// nothing to scan, so the name is typed. Emits `network-selected` (network, password) on every change.
import type { PortalStatus } from '../utils/hotspotClient'
import { computed, onMounted, ref } from 'vue'
import { getCurrentLanguage, t } from '@/i18n'
import { digits } from '@/utils/calendar.mjs'
import { toast } from '@/utils/toast'
import { PORTAL_URL, probePortal, scanNetworks, ssidError, wifiPasswordError } from '../utils/hotspotClient'

interface WiFiNetwork {
  ssid: string
  rssi: number
  authmode: number
  channel: number
  hidden?: boolean
}

interface Props {
  autoConnect?: boolean // check the robot's hotspot (hotspot setup)
  canScan?: boolean // the robot's network list is available (hotspot setup)
  allowHidden?: boolean // offer "hidden Wi-Fi" when typing the name
}

const props = withDefaults(defineProps<Props>(), {
  autoConnect: true,
  canScan: true,
  allowHidden: true,
})

const emit = defineEmits<{
  'network-selected': [network: WiFiNetwork | null, password: string]
  'connection-status': [connected: boolean]
}>()

const lang = computed(() => getCurrentLanguage())
const num = (n: any) => digits(n, lang.value)

const isConnectedToESP32 = ref(false)
// ok: full API · opaque: reachable but the browser can't read answers (firmware without CORS)
// unreachable: not on the robot's hotspot · blocked: https page, the browser forbids the call
const portalStatus = ref<PortalStatus>('unreachable')
const checkingConnection = ref(false)
const checkedOnce = ref(false)
const scanning = ref(false)
const scanFailed = ref(false)
const wifiNetworks = ref<WiFiNetwork[]>([])
const selectedNetwork = ref<WiFiNetwork | null>(null)
const password = ref('')
const selectorExpanded = ref(false)

// Typed network: a hidden one in hotspot setup, or any network when there is nothing to scan
const isHiddenWifi = ref(false)
const hiddenSsid = ref('')
const isHiddenEncrypted = ref(true)
const manual = computed(() => isHiddenWifi.value || !props.canScan)

const statusHint = computed(() => (portalStatus.value === 'blocked' ? t('msetup.hot.blocked') : t('msetup.hot.howto')))
const hotState = computed(() => (checkingConnection.value || !checkedOnce.value ? 'pending' : isConnectedToESP32.value ? 'applied' : 'error'))
const hotText = computed(() => (hotState.value === 'pending' ? t('msetup.hot.checking') : isConnectedToESP32.value ? t('msetup.hot.ok') : t('msetup.hot.need')))

// Shown under the fields: a name too long, a password the robot will refuse
const inputError = computed(() => {
  const net = selectedNetwork.value
  if (!net || !net.ssid || !net.ssid.trim())
    return ''
  const nameErr = ssidError(net.ssid)
  if (nameErr)
    return nameErr
  return password.value ? wifiPasswordError(password.value, net.authmode > 0) : ''
})

/** TinyBot's own setup page: works in any browser once the phone is on its hotspot. */
function openRobotSetupPage() {
  // #ifdef H5
  window.open(PORTAL_URL, '_blank')
  // #endif
  // #ifndef H5
  uni.setClipboardData({ data: PORTAL_URL })
  toast.info(t('msetup.hot.copied'))
  // #endif
}

async function checkESP32Connection() {
  checkingConnection.value = true
  try {
    portalStatus.value = await probePortal()
  }
  finally {
    isConnectedToESP32.value = portalStatus.value === 'ok' || portalStatus.value === 'opaque'
    emit('connection-status', isConnectedToESP32.value)
    checkingConnection.value = false
    checkedOnce.value = true
  }
}

// The list the robot saw when it entered setup mode
async function scanWifi() {
  if (!isConnectedToESP32.value) {
    toast.error(statusHint.value)
    return
  }
  if (portalStatus.value === 'opaque') {
    // The robot answers but this browser may not read its network list: type the name instead
    toast.warning(t('msetup.hot.opaque'))
    onHiddenWifiToggle(true)
    return
  }
  scanning.value = true
  scanFailed.value = false
  try {
    wifiNetworks.value = await scanNetworks()
  }
  catch (error) {
    console.error('Wi-Fi scan failed:', error)
    scanFailed.value = true
    toast.error(t('msetup.net.scanFailed'))
  }
  finally {
    scanning.value = false
  }
}

async function showNetworkSelector() {
  await checkESP32Connection()
  if (!isConnectedToESP32.value) {
    toast.error(statusHint.value)
    return
  }
  if (portalStatus.value === 'opaque') {
    scanWifi()
    return
  }
  selectorExpanded.value = true
  if (wifiNetworks.value.length === 0)
    scanWifi()
}

function selectNetwork(network: WiFiNetwork) {
  selectedNetwork.value = network
  password.value = ''
  selectorExpanded.value = false
  emit('network-selected', network, '')
}

function onHiddenWifiToggle(val: boolean) {
  isHiddenWifi.value = val
  if (!props.canScan) {
    // The name is typed either way: only the "hidden" flag changes
    updateHiddenNetwork()
    return
  }
  if (val) {
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

function onHiddenSsidChange(v: string) {
  hiddenSsid.value = v
  updateHiddenNetwork()
}

function onHiddenEncryptionChange(val: boolean) {
  isHiddenEncrypted.value = val
  if (!val)
    password.value = ''
  updateHiddenNetwork()
}

// The typed network, passed up
function updateHiddenNetwork() {
  const trimmedSsid = hiddenSsid.value.trim()
  if (trimmedSsid) {
    const hiddenNet: WiFiNetwork = {
      ssid: trimmedSsid,
      rssi: -50,
      authmode: isHiddenEncrypted.value ? 4 : 0,
      channel: 0,
      hidden: isHiddenWifi.value,
    }
    selectedNetwork.value = hiddenNet
    emit('network-selected', hiddenNet, isHiddenEncrypted.value ? password.value : '')
  }
  else {
    selectedNetwork.value = null
    emit('network-selected', null, isHiddenEncrypted.value ? password.value : '')
  }
}

function switchToHiddenFromModal() {
  selectorExpanded.value = false
  onHiddenWifiToggle(true)
}

function onPasswordChange(v: string) {
  password.value = v
  emit('network-selected', selectedNetwork.value, v)
}

function getSelectedNetworkInfo() {
  return { network: selectedNetwork.value, password: password.value }
}

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

function getSignalStrength(rssi: number): string {
  if (rssi >= -50)
    return t('msetup.net.signal.strong')
  if (rssi >= -60)
    return t('msetup.net.signal.good')
  if (rssi >= -70)
    return t('msetup.net.signal.fair')
  return t('msetup.net.signal.weak')
}

/** 1-4 bars for the signal mark */
function getSignalLevel(rssi: number): number {
  if (rssi >= -50)
    return 4
  if (rssi >= -60)
    return 3
  if (rssi >= -70)
    return 2
  return 1
}

function networkLine(n: WiFiNetwork) {
  const parts = [getSignalStrength(n.rssi), `${num(n.rssi)} dBm`]
  if (n.channel)
    parts.push(t('msetup.net.channel', { n: num(n.channel) }))
  return parts.join(', ')
}

defineExpose({ checkESP32Connection, scanWifi, getSelectedNetworkInfo, reset })

onMounted(() => {
  if (props.autoConnect)
    checkESP32Connection()
})
</script>

<template>
  <view class="wsel">
    <!-- Is the phone on TinyBot's hotspot? -->
    <view v-if="autoConnect" class="wsel__hot">
      <view class="wsel__hotrow">
        <view class="wsel__hotmain">
          <text class="setup-label">
            {{ t('msetup.hot.title') }}
          </text>
          <tb-sync :state="hotState" :text="hotText" />
        </view>
        <tb-button size="s" icon="refresh" :loading="checkingConnection" @click="checkESP32Connection">
          {{ t('msetup.hot.check') }}
        </tb-button>
      </view>
      <text v-if="hotState === 'error'" class="wsel__help">
        {{ statusHint }}
      </text>
      <text v-else-if="hotState === 'applied' && portalStatus === 'opaque'" class="wsel__help">
        {{ t('msetup.hot.opaque') }}
      </text>
      <view v-if="portalStatus === 'blocked' || hotState === 'error'" class="wsel__link" role="link" @click="openRobotSetupPage">
        <tb-icon name="external" :size="16" /><text>{{ t('msetup.hot.openPage') }}</text>
      </view>
    </view>

    <!-- The network -->
    <view class="wsel__fields">
      <view v-if="!manual" class="wsel__field">
        <text class="setup-label">
          {{ t('msetup.net.network') }}
        </text>
        <view class="wsel__pick" role="button" :aria-label="t('msetup.net.network')" hover-class="is-press" @click="showNetworkSelector">
          <tb-icon name="wifi" :size="18" class="wsel__pickicon" />
          <text class="wsel__pickval" :class="{ 'is-ph': !selectedNetwork }">
            {{ selectedNetwork ? selectedNetwork.ssid : t('msetup.net.choose') }}
          </text>
          <tb-icon name="chevron-right" :size="18" />
        </view>
      </view>

      <view v-if="!manual && selectedNetwork && selectedNetwork.authmode > 0" class="wsel__field">
        <text class="setup-label">
          {{ t('msetup.net.password') }}
        </text>
        <tb-input
          :model-value="password" type="password" :maxlength="64" :invalid="!!inputError"
          :placeholder="t('msetup.net.passwordPh')" :aria-label="t('msetup.net.password')" @update:model-value="onPasswordChange"
        />
      </view>

      <template v-if="manual">
        <view class="wsel__field">
          <text class="setup-label">
            {{ t('msetup.net.name') }}
          </text>
          <tb-input
            :model-value="hiddenSsid" icon="wifi" clearable :maxlength="64" :placeholder="t('msetup.net.namePh')"
            :aria-label="t('msetup.net.name')" @update:model-value="onHiddenSsidChange"
          />
        </view>
        <view class="setup-toggle">
          <tb-switch :model-value="isHiddenEncrypted" :label="t('msetup.net.needsPassword')" @change="onHiddenEncryptionChange" />
        </view>
        <view v-if="isHiddenEncrypted" class="wsel__field">
          <text class="setup-label">
            {{ t('msetup.net.password') }}
          </text>
          <tb-input
            :model-value="password" type="password" :maxlength="64" :invalid="!!inputError"
            :placeholder="t('msetup.net.passwordPh')" :aria-label="t('msetup.net.password')" @update:model-value="onPasswordChange"
          />
        </view>
      </template>

      <view v-if="inputError" class="wsel__err" role="alert">
        <tb-icon name="warning" :size="16" /><text>{{ inputError }}</text>
      </view>

      <view v-if="canScan || allowHidden" class="setup-toggle">
        <tb-switch :model-value="isHiddenWifi" :label="t('msetup.net.hidden')" @change="onHiddenWifiToggle" />
        <text class="setup-toggle__sub">
          {{ t('msetup.net.hiddenText') }}
        </text>
      </view>
    </view>

    <!-- The networks TinyBot sees -->
    <tb-sheet v-model:open="selectorExpanded" :title="t('msetup.net.sheetTitle')">
      <view v-if="scanning && wifiNetworks.length === 0" class="wsel__state">
        <tb-loading :label="t('msetup.net.scanning')" />
      </view>
      <tb-empty
        v-else-if="wifiNetworks.length === 0" :title="scanFailed ? t('msetup.net.scanFailed') : t('msetup.net.none')"
        :text="scanFailed ? '' : t('msetup.net.noneText')"
      />
      <view v-else class="wsel__list" role="list">
        <view
          v-for="(network, index) in wifiNetworks" :key="`${network.ssid}-${index}`" class="wsel__net" role="listitem"
          hover-class="is-press" @click="selectNetwork(network)"
        >
          <view class="wsel-bars" :class="`is-${getSignalLevel(network.rssi)}`" role="img" :aria-label="getSignalStrength(network.rssi)">
            <view v-for="bar in 4" :key="bar" class="wsel-bars__bar" />
          </view>
          <view class="wsel__netmain">
            <text class="wsel__netname">
              {{ network.ssid }}
            </text>
            <text class="tb-num wsel__netsub">
              {{ networkLine(network) }}
            </text>
          </view>
          <tb-icon v-if="network.authmode > 0" name="lock" :size="16" class="wsel__lock" :label="t('msetup.net.locked')" />
          <tb-tag v-else>
            {{ t('msetup.net.open') }}
          </tb-tag>
          <tb-icon v-if="selectedNetwork && selectedNetwork.ssid === network.ssid" name="check" :size="20" class="wsel__check" />
        </view>
      </view>
      <template #footer>
        <tb-button icon="plus" @click="switchToHiddenFromModal">
          {{ t('msetup.net.typeName') }}
        </tb-button>
        <tb-button icon="refresh" :loading="scanning" @click="scanWifi">
          {{ t('msetup.net.scan') }}
        </tb-button>
      </template>
    </tb-sheet>
  </view>
</template>

<style lang="scss">
@import './setup-shared.scss';

.wsel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.wsel__hot {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0 14px;
  border-top: 1px solid var(--tb-rule);
  border-bottom: 1px solid var(--tb-rule);
}
.wsel__hotrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.wsel__hotmain {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.wsel__help {
  color: var(--tb-ink-2);
  font-size: 14px;
}
.wsel__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  color: var(--tb-action);
  font-weight: 600;
  font-size: 14px;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.wsel__fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.wsel__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.wsel__pick {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 0 12px;
  border: 1.5px solid var(--tb-ink);
  border-radius: var(--tb-radius-m);
  background: var(--tb-paper);
  transition: background-color var(--tb-t-hover) var(--tb-ease);
}
.wsel__pick.is-press {
  background: var(--tb-paper-2);
}
.wsel__pickicon {
  color: var(--tb-ink-2);
}
.wsel__pickval {
  flex: 1;
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wsel__pickval.is-ph {
  color: var(--tb-ink-3);
  font-weight: 400;
}
.wsel__err {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  color: var(--tb-danger);
  font-size: 14px;
}
.wsel__err > text {
  flex: 1;
  min-width: 0;
}
.wsel__state {
  padding: 20px 0;
}
.wsel__list {
  display: flex;
  flex-direction: column;
  margin: -16px 0;
}
.wsel__net {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 60px;
  padding: 8px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.wsel__net:last-child {
  border-bottom: 0;
}
.wsel__net.is-press {
  background: var(--tb-paper-2);
}
.wsel__netmain {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.wsel__netname {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wsel__netsub {
  color: var(--tb-ink-2);
  font-size: 13px;
}
.wsel__lock {
  color: var(--tb-ink-2);
}
.wsel__check {
  color: var(--tb-action);
}

/* signal strength: four rising bars, filled up to the level */
.wsel-bars {
  display: flex;
  flex: none;
  align-items: flex-end;
  gap: 2px;
  width: 20px;
  height: 16px;
}
.wsel-bars__bar {
  flex: 1;
  background: var(--tb-rule-soft);
}
.wsel-bars__bar:nth-child(1) {
  height: 25%;
}
.wsel-bars__bar:nth-child(2) {
  height: 50%;
}
.wsel-bars__bar:nth-child(3) {
  height: 75%;
}
.wsel-bars__bar:nth-child(4) {
  height: 100%;
}
.wsel-bars.is-2 .wsel-bars__bar:nth-child(-n + 2),
.wsel-bars.is-3 .wsel-bars__bar:nth-child(-n + 3),
.wsel-bars.is-4 .wsel-bars__bar:nth-child(-n + 4) {
  background: var(--tb-ink);
}
.wsel-bars.is-1 .wsel-bars__bar:nth-child(1) {
  background: var(--tb-warn);
}
</style>
