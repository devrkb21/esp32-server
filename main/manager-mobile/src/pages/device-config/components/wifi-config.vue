<script setup lang="ts">
import { computed, ref } from 'vue'
import { t } from '@/i18n'
import { toast } from '@/utils/toast'

// Type definitions
interface WiFiNetwork {
  ssid: string
  rssi: number
  authmode: number
  channel: number
}

// Props
interface Props {
  selectedNetwork: WiFiNetwork | null
  password: string
}

const props = defineProps<Props>()

// Reactive data
const configuring = ref(false)

// Computed properties
const canSubmit = computed(() => {
  if (!props.selectedNetwork || !props.selectedNetwork.ssid || !props.selectedNetwork.ssid.trim())
    return false
  if (props.selectedNetwork.authmode > 0 && !props.password)
    return false
  return true
})

// Instructions shown under the button
const steps = computed(() => [
  t('deviceConfig.phoneConnectXiaozhiHotspot'),
  t('deviceConfig.selectTargetWifiNetwork'),
  t('deviceConfig.enterWifiPasswordIfNeeded'),
  t('deviceConfig.clickStartConfigAndWait'),
])

// ESP32 connection check
async function checkESP32Connection() {
  try {
    const response = await uni.request({
      url: 'http://192.168.4.1/scan',
      method: 'GET',
      timeout: 3000,
    })
    return response.statusCode === 200
  }
  catch (error) {
    console.log(`${t('deviceConfig.esp32ConnectionCheckFailed')}:`, error)
    return false
  }
}

// Submit provisioning
async function submitConfig() {
  if (!props.selectedNetwork)
    return

  // Check ESP32 connection
  const connected = await checkESP32Connection()
  if (!connected) {
    toast.error(t('deviceConfig.connectXiaozhiHotspot'))
    return
  }

  configuring.value = true
  console.log(`${t('deviceConfig.startWifiConfig')}:`, props.selectedNetwork.ssid)

  try {
    const response = await uni.request({
      url: 'http://192.168.4.1/submit',
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
      },
      data: {
        ssid: props.selectedNetwork.ssid,
        password: props.selectedNetwork.authmode > 0 ? props.password : '',
      },
      timeout: 15000,
    })

    console.log('WiFi provisioning response:', response)

    if (response.statusCode === 200 && (response.data as any)?.success) {
      toast.success(`${t('deviceConfig.configSuccess')}！${t('deviceConfig.deviceWillConnectTo')} ${props.selectedNetwork.ssid}，${t('deviceConfig.deviceWillRestart')}。${t('deviceConfig.pleaseDisconnectXiaozhiHotspot')}`)
      // Device exits provisioning mode
      setTimeout(() => {
        uni.request({
          url: 'http://192.168.4.1/exit',
          method: 'POST',
          timeout: 15000,
        })
      }, 1500)
    }
    else {
      const errorMsg = (response.data as any)?.error || t('deviceConfig.configFailed')
      toast.error(errorMsg)
    }
  }
  catch (error) {
    console.error(`${t('deviceConfig.wifiConfigFailed')}:`, error)
    toast.error(`${t('deviceConfig.configFailed')}，${t('deviceConfig.pleaseCheckNetworkConnection')}`)
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

    <!-- Provisioning button -->
    <view class="prov__action">
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
