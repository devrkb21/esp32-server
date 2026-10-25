<script setup lang="ts">
// Hotspot setup, last step: check the phone is still on TinyBot's hotspot, match the pattern on its
// face (pair-pattern), then send the Wi-Fi. The robot tries to join before it answers, so a wrong
// password comes back as an error here, with a retry. Emits `done` on success, `back` to change.
import { computed, ref } from 'vue'
import { t } from '@/i18n'
import { toast } from '@/utils/toast'
import { exitPortal, probePortal, ssidError, submitCredentials, wifiPasswordError } from '../utils/hotspotClient'
import PairPattern from './pair-pattern.vue'

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
  startPairing?: boolean // demo build: open on the pattern step
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'done', result: { ssid: string, unconfirmed: boolean }): void
  (e: 'back'): void
}>()

const configuring = ref(false)
const failed = ref(false)
const resultMessage = ref('')
// Pairing: match the pattern on the robot's face before it accepts Wi-Fi (null = not done yet)
const pairing = ref(Boolean(props.startPairing))
const pairToken = ref<string | null>(null)

// What is wrong with the input before we even try (wrong password length, name too long)
const inputError = computed(() => {
  const net = props.selectedNetwork
  if (!net || !net.ssid || !net.ssid.trim())
    return ''
  return ssidError(net.ssid) || wifiPasswordError(props.password, net.authmode > 0)
})

const canSubmit = computed(() => {
  if (!props.selectedNetwork || !props.selectedNetwork.ssid || !props.selectedNetwork.ssid.trim())
    return false
  if (props.selectedNetwork.authmode > 0 && !props.password)
    return false
  return !inputError.value
})

function onPaired(token: string) {
  pairToken.value = token
  pairing.value = false
  submitConfig()
}

function cancelPairing() {
  pairing.value = false
}

async function submitConfig() {
  const net = props.selectedNetwork
  if (!net || !canSubmit.value)
    return
  failed.value = false
  resultMessage.value = ''

  configuring.value = true
  const status = await probePortal()
  if (status === 'blocked' || status === 'unreachable') {
    configuring.value = false
    failed.value = true
    resultMessage.value = status === 'blocked' ? t('msetup.hot.blocked') : t('msetup.err.notOnHotspot')
    return
  }

  if (pairToken.value === null) {
    configuring.value = false
    pairing.value = true
    return
  }

  try {
    const res = await submitCredentials(net.ssid, net.authmode > 0 ? props.password : '', Boolean(net.hidden), pairToken.value)
    if (res.pairRequired) {
      // The robot restarted setup (or this is its first answer): match the new pattern
      pairToken.value = null
      pairing.value = true
      return
    }
    if (res.ok) {
      toast.success(t('msetup.done.toast'))
      // Let the robot finish its reply, then take it out of setup mode
      setTimeout(() => exitPortal(), 1500)
      emit('done', { ssid: net.ssid, unconfirmed: Boolean(res.unconfirmed) })
    }
    else {
      failed.value = true
      resultMessage.value = res.error || t('msetup.err.failed')
    }
  }
  finally {
    configuring.value = false
  }
}
</script>

<template>
  <view class="setup-step">
    <block v-if="pairing">
      <view class="setup-step__body">
        <pair-pattern @paired="onPaired" />
      </view>
      <view class="setup-foot">
        <tb-button block @click="cancelPairing">
          {{ t('msetup.pair.cancel') }}
        </tb-button>
      </view>
    </block>

    <block v-else>
      <view class="setup-step__body">
        <text class="setup-h">
          {{ t('msetup.send.title') }}
        </text>
        <text class="setup-lead">
          {{ t('msetup.send.text') }}
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
          </view>
          <view class="setup-row">
            <text class="setup-key">
              {{ t('msetup.send.password') }}
            </text>
            <view class="setup-val">
              <text>{{ selectedNetwork.authmode > 0 ? t('msetup.send.passwordSet') : t('msetup.send.noPassword') }}</text>
            </view>
            <tb-button size="s" variant="quiet" icon="edit" :disabled="configuring" @click="emit('back')">
              {{ t('msetup.send.change') }}
            </tb-button>
          </view>
        </view>

        <view v-if="inputError" class="setup-alert" role="alert">
          <tb-icon name="warning" :size="18" /><text>{{ inputError }}</text>
        </view>

        <view v-if="configuring" class="prov__busy" role="status">
          <tb-face mood="awake" :width="112" />
          <view class="prov__busytext">
            <tb-loading />
            <text>{{ t('msetup.send.sending') }}</text>
          </view>
        </view>

        <view v-else-if="failed" class="prov__fail" role="alert">
          <text class="prov__failtitle">
            {{ t('msetup.send.failed') }}
          </text>
          <text>{{ resultMessage }}</text>
        </view>

        <view v-else class="setup-lines">
          <text class="setup-label">
            {{ t('msetup.send.after') }}
          </text>
          <text class="setup-line">
            {{ t('msetup.send.after1') }}
          </text>
          <text class="setup-line">
            {{ t('msetup.send.after2') }}
          </text>
          <text class="setup-line">
            {{ t('msetup.send.after3') }}
          </text>
        </view>
      </view>

      <view class="setup-foot">
        <tb-button
          variant="primary" size="l" block :icon="failed ? 'refresh' : 'send'" :loading="configuring" :disabled="!canSubmit"
          @click="submitConfig"
        >
          {{ failed ? t('common.retry') : t('msetup.send.button') }}
        </tb-button>
      </view>
    </block>
  </view>
</template>

<style lang="scss">
@import './setup-shared.scss';

.prov__busy {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 22px;
}
.prov__busytext {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--tb-ink-2);
  font-size: 14px;
}
.prov__fail {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 22px;
  padding: 12px 0;
  border-top: 3px solid var(--tb-danger);
  color: var(--tb-ink);
  font-size: 15px;
}
.prov__failtitle {
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 19px;
  color: var(--tb-danger);
}
</style>
