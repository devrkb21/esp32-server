<script setup lang="ts">
import { computed, ref } from 'vue'
import { t } from '@/i18n'
import { toast } from '@/utils/toast'
import { exitPortal, probePortal, ssidError, submitCredentials, wifiPasswordError } from '../utils/hotspotClient'
import PairPattern from './pair-pattern.vue'

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

// Reactive data
const configuring = ref(false)
// Outcome of the last attempt: shown as a card under the button
const result = ref<'' | 'success' | 'unconfirmed' | 'failed'>('')
const resultMessage = ref('')
// Pairing: match the pattern on the robot's face before it accepts Wi-Fi (null = not done yet)
const pairing = ref(false)
const pairToken = ref<string | null>(null)

// What is wrong with the input before we even try (wrong password length, name too long)
const inputError = computed(() => {
  const net = props.selectedNetwork
  if (!net || !net.ssid || !net.ssid.trim())
    return ''
  return ssidError(net.ssid) || wifiPasswordError(props.password, net.authmode > 0)
})

// Computed properties
const canSubmit = computed(() => {
  if (!props.selectedNetwork || !props.selectedNetwork.ssid || !props.selectedNetwork.ssid.trim())
    return false
  if (props.selectedNetwork.authmode > 0 && !props.password)
    return false
  return !inputError.value
})

// Instructions shown under the button
const steps = computed(() => [
  t('deviceConfig.phoneConnectXiaozhiHotspot'),
  t('deviceConfig.selectTargetWifiNetwork'),
  t('deviceConfig.enterWifiPasswordIfNeeded'),
  t('deviceConfig.clickStartConfigAndWait'),
])

/** Translate with an English fallback until the key is in every locale */
function tx(key: string, fallback: string) {
  const text = t(key)
  return text === key ? fallback : text
}

function onPaired(token: string) {
  pairToken.value = token
  pairing.value = false
  submitConfig()
}

// Submit provisioning
async function submitConfig() {
  const net = props.selectedNetwork
  if (!net || !canSubmit.value)
    return
  result.value = ''

  const status = await probePortal()
  if (status === 'blocked' || status === 'unreachable') {
    result.value = 'failed'
    resultMessage.value = status === 'blocked'
      ? tx('deviceConfig.httpsBlocked', 'This page is secure (https) and can’t talk to the robot. Use “Open robot setup page” instead.')
      : t('deviceConfig.connectXiaozhiHotspot')
    toast.error(resultMessage.value)
    return
  }

  if (pairToken.value === null) {
    pairing.value = true
    return
  }

  configuring.value = true
  try {
    const res = await submitCredentials(net.ssid, net.authmode > 0 ? props.password : '', Boolean(net.hidden), pairToken.value)
    if (res.pairRequired) {
      // The robot restarted setup (or this is its first answer): match the new pattern
      pairToken.value = null
      pairing.value = true
      return
    }
    if (res.ok) {
      result.value = res.unconfirmed ? 'unconfirmed' : 'success'
      resultMessage.value = res.unconfirmed
        ? tx('deviceConfig.sentUnconfirmed', 'Sent. Watch the robot: it shows the Wi-Fi name and restarts when it joins.')
        : `${t('deviceConfig.configSuccess')}! ${t('deviceConfig.deviceWillConnectTo')} ${net.ssid}. ${t('deviceConfig.pleaseDisconnectXiaozhiHotspot')}`
      toast.success(t('deviceConfig.configSuccess'))
      // Let the robot finish its reply, then take it out of setup mode
      setTimeout(() => exitPortal(), 1500)
    }
    else {
      result.value = 'failed'
      resultMessage.value = res.error || t('deviceConfig.configFailed')
      toast.error(resultMessage.value)
    }
  }
  finally {
    configuring.value = false
  }
}
</script>

<template>
  <view class="prov">
    <!-- Selected network -->
    <view v-if="props.selectedNetwork" class="nx-group prov__group">
      <view class="nx-group__body">
        <view class="nx-row">
          <view class="nx-icon-tile prov__icon">
            <wd-icon name="wifi" size="18px" />
          </view>
          <view class="nx-row__main">
            <view class="nx-caption">
              {{ t('deviceConfig.selectedNetwork') }}
            </view>
            <view class="nx-row__title nx-truncate prov__ssid" :title="props.selectedNetwork.ssid">
              {{ props.selectedNetwork.ssid }}
            </view>
            <view class="nx-row__subtitle nx-num">
              {{ t('deviceConfig.signal') }} {{ props.selectedNetwork.rssi }} dBm · {{ props.selectedNetwork.authmode === 0 ? t('deviceConfig.openNetwork') : t('deviceConfig.encryptedNetwork') }}
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- Pairing step, then the provisioning button -->
    <view v-if="pairing" class="prov__action">
      <pair-pattern @paired="onPaired" />
    </view>
    <view v-else class="prov__action">
      <wd-button
        type="primary"
        size="large"
        block
        :loading="configuring"
        :disabled="!canSubmit"
        @click="submitConfig"
      >
        {{ configuring ? t('deviceConfig.configuring') : t('deviceConfig.startWifiConfigButton') }}
      </wd-button>
    </view>

    <view v-if="inputError" class="prov__notice prov__notice--warn" role="alert">
      {{ inputError }}
    </view>
    <view v-else-if="result" class="prov__notice" :class="`prov__notice--${result}`" role="status">
      {{ resultMessage }}
    </view>

    <!-- Instructions -->
    <view class="nx-group prov__group">
      <view class="nx-group__header">
        {{ t('deviceConfig.wifiConfigInstructions') }}
      </view>
      <view class="nx-group__body">
        <view
          v-for="(item, index) in steps"
          :key="index"
          class="nx-row prov__step"
        >
          <view class="nx-num prov__step-num">
            {{ index + 1 }}
          </view>
          <view class="nx-row__main prov__step-text">
            {{ item }}
          </view>
        </view>
      </view>
      <view class="nx-group__footer">
        {{ t('deviceConfig.afterConfigSuccessDeviceWillRestart') }}
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.prov {
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

  &__ssid {
    font-weight: 600;
  }

  &__action {
    margin-bottom: var(--nx-space-5);
  }

  &__notice {
    margin: calc(var(--nx-space-3) * -1) 0 var(--nx-space-5);
    padding: var(--nx-space-3) var(--nx-space-4);
    border-radius: var(--nx-radius);
    font-size: var(--nx-text-callout);
    line-height: 1.45;
    background: var(--nx-surface-2);
    color: var(--nx-text-2);
    &--success {
      background: var(--nx-success-soft);
      color: var(--nx-success);
    }
    &--unconfirmed,
    &--warn {
      background: var(--nx-warning-soft);
      color: var(--nx-warning);
    }
    &--failed {
      background: var(--nx-danger-soft);
      color: var(--nx-danger);
    }
  }

  &__step {
    align-items: flex-start;
    min-height: 0;
    padding-top: var(--nx-space-2);
    padding-bottom: var(--nx-space-2);
  }

  &__step-num {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 40rpx;
    height: 40rpx;
    margin-top: 2rpx;
    border-radius: 50%;
    background: var(--nx-surface-2);
    color: var(--nx-text-2);
    font-size: var(--nx-text-caption);
    font-weight: 600;
  }

  &__step-text {
    font-size: var(--nx-text-callout);
    line-height: 1.45;
    color: var(--nx-text-2);
  }
}
</style>
