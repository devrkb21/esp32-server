<!-- Speed, pitch and volume of TinyBot's voice (owner: m-agent). Edits the speedPitch store;
     the character screen saves the changed fields with the rest. -->
<route lang="jsonc" type="page">
{
  "layout": "default",
  "style": {
    "navigationBarTitleText": "Voice tuning",
    "navigationStyle": "custom"
  }
}
</route>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { getCurrentLanguage, t } from '@/i18n'
import { useSpeedPitch } from '@/store'
import { digits } from '@/utils/calendar.mjs'
import { signed } from './agentModel.mjs'

defineOptions({
  name: 'SpeedPitch',
})

const speedPitchStore = useSpeedPitch()
const SPEED_PITCH_FIELDS = ['ttsVolume', 'ttsRate', 'ttsPitch'] as const
type Field = typeof SPEED_PITCH_FIELDS[number]

const localSettings = ref<Record<Field, number>>({
  ttsVolume: 0,
  ttsRate: 0,
  ttsPitch: 0,
})

const lang = computed(() => getCurrentLanguage())

const sliders = computed(() => [
  { key: 'ttsRate' as const, label: t('mAgent.tune.rate'), hint: t('mAgent.tune.rateHint') },
  { key: 'ttsPitch' as const, label: t('mAgent.tune.pitch'), hint: t('mAgent.tune.pitchHint') },
  { key: 'ttsVolume' as const, label: t('mAgent.tune.volume'), hint: t('mAgent.tune.volumeHint') },
])

const hasLocalChanges = computed(() => SPEED_PITCH_FIELDS.some(field => localSettings.value[field] !== speedPitchStore.speedPitch[field]))

function formatSigned(value: number) {
  return digits(signed(value), lang.value)
}

function setField(field: Field, value: any) {
  localSettings.value[field] = Math.max(-100, Math.min(100, Math.round(Number(value) || 0)))
}

function resetField(field: Field) {
  localSettings.value[field] = 0
}

function handleConfirm() {
  const changedFields = SPEED_PITCH_FIELDS.filter((field) => {
    return localSettings.value[field] !== speedPitchStore.speedPitch[field]
  })
  speedPitchStore.updateSpeedPitch({ ...localSettings.value }, { changedFields: [...changedFields] })
  goBack()
}

function goBack() {
  uni.navigateBack()
}

onMounted(() => {
  localSettings.value = {
    ttsVolume: speedPitchStore.speedPitch.ttsVolume,
    ttsRate: speedPitchStore.speedPitch.ttsRate,
    ttsPitch: speedPitchStore.speedPitch.ttsPitch,
  }
})
</script>

<template>
  <view class="tb-wrap tune">
    <tb-page-header :title="t('mAgent.tune.title')" :description="t('mAgent.tune.lead')" back />

    <view v-for="item in sliders" :key="item.key" class="tune-row">
      <view class="tune-row__head">
        <view class="tune-row__text">
          <text class="tune-row__label">
            {{ item.label }}
          </text>
          <text class="tune-row__hint">
            {{ item.hint }}
          </text>
        </view>
        <text class="tb-num tune-row__val" :class="{ 'is-zero': localSettings[item.key] === 0 }">
          {{ formatSigned(localSettings[item.key]) }}
        </text>
      </view>
      <slider
        class="tune-row__slider"
        :value="localSettings[item.key]"
        :min="-100"
        :max="100"
        :step="1"
        active-color="var(--tb-action)"
        background-color="var(--tb-rule-soft)"
        block-color="var(--tb-ink)"
        :block-size="24"
        :aria-label="item.label"
        @changing="(e: any) => setField(item.key, e.detail.value)"
        @change="(e: any) => setField(item.key, e.detail.value)"
      />
      <view class="tb-num tune-row__scale">
        <text>{{ formatSigned(-100) }}</text><text>{{ formatSigned(0) }}</text><text>{{ formatSigned(100) }}</text>
      </view>
      <view v-if="localSettings[item.key] !== 0" class="tune-row__reset">
        <tb-button size="s" variant="quiet" icon="refresh" @click="resetField(item.key)">
          {{ t('mAgent.tune.reset') }}
        </tb-button>
      </view>
    </view>

    <text class="tune__foot">
      {{ t('mAgent.tune.footer') }}
    </text>

    <view class="tune-bar">
      <tb-button variant="primary" size="l" block @click="handleConfirm">
        {{ hasLocalChanges ? t('mAgent.tune.keep') : t('mAgent.tune.done') }}
      </tb-button>
    </view>
  </view>
</template>

<style lang="scss">
.tune { padding-bottom: calc(96px + env(safe-area-inset-bottom)); }
.tune-row { display: flex; flex-direction: column; gap: 6px; padding: 18px 0; border-bottom: 1px solid var(--tb-rule); }
.tune-row__head { display: flex; align-items: flex-start; gap: 12px; }
.tune-row__text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.tune-row__label { font-family: var(--tb-font-display); font-weight: 700; font-size: 19px; }
.tune-row__hint { font-size: 13px; color: var(--tb-ink-2); }
.tune-row__val { font-family: var(--tb-font-display); font-weight: 800; font-size: 40px; line-height: 1; color: var(--tb-ink); }
.tune-row__val.is-zero { color: var(--tb-ink-3); }
.tune-row__slider { margin: 10px 4px 0; }
.tune-row__scale { display: flex; justify-content: space-between; font-size: 12px; color: var(--tb-ink-3); padding: 0 2px; }
.tune-row__reset { display: flex; }
.tune__foot { display: block; padding-top: 14px; font-size: 13px; color: var(--tb-ink-2); }
.tune-bar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 800; padding: 12px var(--tb-gutter) calc(12px + env(safe-area-inset-bottom));
  background: var(--tb-paper); border-top: 3px solid var(--tb-rule);
}
</style>
