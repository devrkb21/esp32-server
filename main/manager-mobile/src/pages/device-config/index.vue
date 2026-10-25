<!-- Robot setup: put TinyBot on the home Wi-Fi, one step per view (owner: m-setup) -->
<route lang="jsonc" type="page">
{
  "layout": "default",
  "style": {
    "navigationBarTitleText": "Nobix",
    "navigationStyle": "custom"
  }
}
</route>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { DEMO } from '@/api/demo'
import { getCurrentLanguage, t } from '@/i18n'
import { digits } from '@/utils/calendar.mjs'
import BleConfig from './components/ble-config.vue'
import UltrasonicConfig from './components/ultrasonic-config.vue'
import WifiConfig from './components/wifi-config.vue'
import WifiSelector from './components/wifi-selector.vue'
import { isWeb, ssidError, wifiPasswordError } from './utils/hotspotClient'

interface WiFiNetwork {
  ssid: string
  rssi: number
  authmode: number
  channel: number
  hidden?: boolean
}

type ConfigType = 'wifi' | 'ble' | 'ultrasonic'
type Step = 'method' | 'network' | 'send' | 'done'

// TinyBot firmware has no BLE provisioning yet, and ble-config speaks a plain-JSON protocol that ESP
// BluFi devices do not understand. Flip this once a robot ships a matching BLE service.
const BLE_FIRMWARE_READY = false

const STEPS: Step[] = ['method', 'network', 'send', 'done']
const lang = computed(() => getCurrentLanguage())
const num = (n: number) => digits(n, lang.value)

const step = ref<Step>('method')
const configType = ref<ConfigType>('wifi')
const wifiSelectorRef = ref<InstanceType<typeof WifiSelector>>()
const selectedWifiInfo = ref<{ network: WiFiNetwork | null, password: string }>({ network: null, password: '' })
const result = ref<{ ssid: string, unconfirmed: boolean }>({ ssid: '', unconfirmed: false })
const demoPair = ref(false)

const web = isWeb()
const bleNote = computed(() => (web ? t('msetup.method.bleWeb') : BLE_FIRMWARE_READY ? '' : t('msetup.method.bleFirmware')))

const methods = computed(() => [
  { value: 'wifi' as const, icon: 'wifi', title: t('msetup.method.hotspot'), text: t('msetup.method.hotspotText'), note: '', tag: '', disabled: false },
  { value: 'ultrasonic' as const, icon: 'volume', title: t('msetup.method.sound'), text: t('msetup.method.soundText'), note: '', tag: '', disabled: false },
  {
    value: 'ble' as const,
    icon: 'bluetooth',
    title: t('msetup.method.ble'),
    text: t('msetup.method.bleText'),
    note: bleNote.value,
    tag: web ? t('msetup.method.appOnly') : (BLE_FIRMWARE_READY ? '' : t('msetup.method.notYet')),
    disabled: Boolean(bleNote.value),
  },
])

const stepIndex = computed(() => STEPS.indexOf(step.value))
// The rule carries only the count; screen readers hear the full sentence (step name included)
const progressCount = computed(() => `${num(stepIndex.value + 1)}/${num(STEPS.length)}`)
const progressText = computed(() => t('msetup.progress', {
  n: num(stepIndex.value + 1),
  total: num(STEPS.length),
  name: t(`msetup.step.${step.value}`),
}))

const networkReady = computed(() => {
  const n = selectedWifiInfo.value.network
  if (!n || !n.ssid || !n.ssid.trim())
    return false
  if (n.authmode > 0 && !selectedWifiInfo.value.password)
    return false
  return !(ssidError(n.ssid) || wifiPasswordError(selectedWifiInfo.value.password, n.authmode > 0))
})

function selectConfigType(m: { value: ConfigType, disabled: boolean }) {
  if (m.disabled)
    return
  if (m.value !== configType.value) {
    // Hotspot setup scans; the others type the name: start the network step clean
    wifiSelectorRef.value?.reset()
    selectedWifiInfo.value = { network: null, password: '' }
  }
  configType.value = m.value
}

function onNetworkSelected(network: WiFiNetwork | null, password: string) {
  selectedWifiInfo.value = { network, password }
}

function go(next: Step) {
  step.value = next
  uni.pageScrollTo({ scrollTop: 0, duration: 0 })
}

function onDone(r: { ssid: string, unconfirmed: boolean }) {
  result.value = r
  go('done')
}

function goToday() {
  uni.switchTab({ url: '/pages/index/index' })
}

function again() {
  wifiSelectorRef.value?.reset()
  selectedWifiInfo.value = { network: null, password: '' }
  result.value = { ssid: '', unconfirmed: false }
  go('method')
}

// Demo build only: open a later step directly (?step=network|send|done&method=wifi|ultrasonic)
onLoad((q: any) => {
  if (!DEMO || !q)
    return
  if (q.method && ['wifi', 'ultrasonic'].includes(q.method))
    configType.value = q.method
  demoPair.value = q.pair === '1'
  if (q.step && STEPS.includes(q.step)) {
    if (q.step !== 'method' && q.step !== 'network')
      selectedWifiInfo.value = { network: { ssid: 'Home WiFi', rssi: -48, authmode: 3, channel: 6 }, password: 'demo-password' }
    if (q.step === 'done')
      result.value = { ssid: 'Home WiFi', unconfirmed: false }
    step.value = q.step
  }
})
</script>

<template>
  <view class="setup tb-wrap">
    <tb-page-header :title="t('msetup.title')" back />

    <view
      class="setup__progress" role="progressbar" :aria-valuemin="1" :aria-valuemax="STEPS.length" :aria-valuenow="stepIndex + 1"
      :aria-valuetext="progressText" :aria-label="progressText"
    >
      <view class="setup__bars" aria-hidden="true">
        <view v-for="(s, i) in STEPS" :key="s" class="setup__bar" :class="{ 'is-done': i < stepIndex, 'is-now': i === stepIndex }" />
      </view>
      <text class="setup__steptext" aria-hidden="true">
        {{ progressCount }}
      </text>
    </view>

    <!-- How -->
    <view v-show="step === 'method'" class="setup-step">
      <view class="setup-step__body">
        <text class="setup-h">
          {{ t('msetup.method.title') }}
        </text>
        <text class="setup-lead">
          {{ t('msetup.method.text') }}
        </text>
        <view class="setup-ways" role="radiogroup" :aria-label="t('msetup.method.title')">
          <view
            v-for="m in methods" :key="m.value" class="setup-way" role="radio"
            :class="{ 'is-on': configType === m.value, 'is-off': m.disabled }"
            :aria-checked="configType === m.value ? 'true' : 'false'" :aria-disabled="m.disabled ? 'true' : 'false'"
            @click="selectConfigType(m)"
          >
            <view class="setup-way__radio">
              <tb-icon v-if="configType === m.value" name="check" :size="14" />
            </view>
            <view class="setup-way__main">
              <view class="setup-way__head">
                <tb-icon :name="m.icon" :size="18" />
                <text class="setup-way__title">
                  {{ m.title }}
                </text>
                <tb-tag v-if="m.tag">
                  {{ m.tag }}
                </tb-tag>
              </view>
              <text class="setup-way__text">
                {{ m.text }}
              </text>
              <text v-if="m.note" class="setup-way__note">
                {{ m.note }}
              </text>
            </view>
          </view>
        </view>
      </view>
      <view class="setup-foot">
        <tb-button variant="primary" size="l" block @click="go('network')">
          {{ t('msetup.next') }}
        </tb-button>
      </view>
    </view>

    <!-- Which Wi-Fi: kept mounted so the choice survives going back and forth -->
    <view v-show="step === 'network'" class="setup-step">
      <view class="setup-step__body">
        <text class="setup-h">
          {{ t('msetup.net.title') }}
        </text>
        <text class="setup-lead">
          {{ configType === 'wifi' ? t('msetup.net.text') : t('msetup.net.typeText') }}
        </text>
        <view class="setup-net">
          <wifi-selector
            :key="configType" ref="wifiSelectorRef" :auto-connect="configType === 'wifi'" :can-scan="configType === 'wifi'"
            :allow-hidden="configType !== 'ultrasonic'" @network-selected="onNetworkSelected"
          />
        </view>
      </view>
      <view class="setup-foot setup-foot--pair">
        <tb-button size="l" icon="chevron-left" @click="go('method')">
          {{ t('msetup.back') }}
        </tb-button>
        <tb-button variant="primary" size="l" :disabled="!networkReady" @click="go('send')">
          {{ t('msetup.next') }}
        </tb-button>
      </view>
    </view>

    <!-- Send it -->
    <block v-if="step === 'send'">
      <wifi-config
        v-if="configType === 'wifi'" :selected-network="selectedWifiInfo.network" :password="selectedWifiInfo.password"
        :start-pairing="demoPair" @done="onDone" @back="go('network')"
      />
      <ble-config
        v-else-if="configType === 'ble'" :selected-network="selectedWifiInfo.network" :password="selectedWifiInfo.password"
        @done="onDone" @back="go('network')"
      />
      <ultrasonic-config
        v-else :selected-network="selectedWifiInfo.network" :password="selectedWifiInfo.password"
        @done="onDone" @back="go('network')"
      />
    </block>

    <!-- Done -->
    <view v-if="step === 'done'" class="setup-step">
      <view class="setup-step__body setup-done" role="status">
        <tb-face mood="happy" :width="180" :alt="t('msetup.done.title')" />
        <text class="setup-done__title">
          {{ result.unconfirmed ? t('msetup.done.sentTitle') : t('msetup.done.title') }}
        </text>
        <text class="setup-lead">
          {{ result.unconfirmed ? t('msetup.done.sentText') : t('msetup.done.text', { ssid: result.ssid }) }}
        </text>
        <text v-if="configType === 'wifi'" class="setup-done__note">
          {{ t('msetup.done.phoneBack') }}
        </text>
      </view>
      <view class="setup-foot">
        <tb-button variant="primary" size="l" block icon="today" @click="goToday">
          {{ t('msetup.done.today') }}
        </tb-button>
        <tb-button block icon="plus" @click="again">
          {{ t('msetup.done.again') }}
        </tb-button>
      </view>
    </view>
  </view>
</template>

<style lang="scss">
@import './components/setup-shared.scss';

.setup {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.setup__progress {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0 0;
}
.setup__bars {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 4px;
}
.setup__bar {
  flex: 1;
  height: 3px;
  background: var(--tb-rule-soft);
  transition: background-color var(--tb-t-row) var(--tb-ease);
}
.setup__bar.is-done {
  background: var(--tb-ink);
}
.setup__bar.is-now {
  background: var(--tb-orange);
}
.setup__steptext {
  flex: none;
  color: var(--tb-ink-2);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* the ways to send */
.setup-ways {
  margin-top: 16px;
  border-top: 1px solid var(--tb-rule);
}
.setup-way {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
  transition: background-color var(--tb-t-hover) var(--tb-ease);
}
.setup-way__radio {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-top: 1px;
  border: 1.5px solid var(--tb-ink);
  border-radius: 50%;
  color: var(--tb-paper);
  transition: background-color var(--tb-t-fast) var(--tb-ease);
}
.setup-way.is-on .setup-way__radio {
  background: var(--tb-ink);
}
.setup-way.is-off {
  cursor: default;
}
.setup-way.is-off .setup-way__radio {
  border-color: var(--tb-ink-3);
}
.setup-way.is-off .setup-way__head,
.setup-way.is-off .setup-way__text {
  color: var(--tb-ink-3);
}
.setup-way__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.setup-way__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.setup-way__title {
  font-weight: 700;
  font-size: 16px;
}
.setup-way__text {
  color: var(--tb-ink-2);
  font-size: 14px;
}
.setup-way__note {
  color: var(--tb-ink);
  font-size: 13px;
  font-weight: 600;
}
.setup-net {
  margin-top: 18px;
}

/* done */
.setup-done {
  align-items: flex-start;
  gap: 6px;
  padding-top: 28px;
}
.setup-done .tb-face {
  margin-bottom: 14px;
}
.setup-done__title {
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 30px;
  line-height: 1.15;
}
.setup-done__note {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--tb-rule-soft);
  font-size: 14px;
}
</style>
