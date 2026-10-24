<script lang="ts" setup>
import type { CareSettings, NightSettings } from '@/api/companion'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { t } from '@/i18n'
import { clampInt, isHHMM } from '../companionUtils.mjs'
import { useCompanion } from './context'

defineOptions({
  name: 'CompanionNightCarePanel',
})

const { dev, save } = useCompanion()

const night = computed<Partial<NightSettings>>(() => dev.value?.settings?.night || {})
const care = computed<Partial<CareSettings>>(() => dev.value?.settings?.care || {})

const nightToggles: { key: 'enabled' | 'dim' | 'lullaby' | 'light', label: string }[] = [
  { key: 'dim', label: 'companion.night.dim' },
  { key: 'lullaby', label: 'companion.night.lullaby' },
  { key: 'light', label: 'companion.night.light' },
]

// time pickers need a model; keep local copies that follow the server
const start = ref('21:30')
const end = ref('06:30')
watch(night, (n) => {
  if (n.start)
    start.value = n.start
  if (n.end)
    end.value = n.end
}, { immediate: true })

async function setNight(patch: Partial<NightSettings>) {
  if (dev.value)
    Object.assign(dev.value.settings.night, patch) // optimistic; replaced by the server response
  await save({ settings: { night: patch } })
}

function onTime(key: 'start' | 'end', value: unknown) {
  if (isHHMM(value) && value !== night.value[key])
    setNight({ [key]: value })
}

async function setCareEnabled(enabled: boolean) {
  if (dev.value)
    dev.value.settings.care.enabled = enabled
  await save({ settings: { care: { enabled } } })
}

const lonely = ref(180)
let lonelyEditing = false
watch(() => care.value.lonely_after_min, (v) => {
  if (v !== undefined && !lonelyEditing)
    lonely.value = v
}, { immediate: true })

let lonelyTimer: ReturnType<typeof setTimeout> | undefined
function onLonely() {
  lonelyEditing = true
  clearTimeout(lonelyTimer)
  lonelyTimer = setTimeout(async () => {
    const value = clampInt(lonely.value, 10, 1440, 180)
    await save({ settings: { care: { lonely_after_min: value } } })
    lonelyEditing = false
  }, 700)
}
onBeforeUnmount(() => clearTimeout(lonelyTimer))
</script>

<template>
  <view v-if="dev" class="flex flex-col gap-[20rpx]">
    <view class="rounded-[20rpx] bg-white px-[28rpx] py-[20rpx] shadow-[0_2rpx_12rpx_rgba(0,0,0,0.04)]">
      <text class="mb-[8rpx] block text-[30rpx] text-[#232338] font-semibold">
        🌙 {{ t('companion.night.title') }}
      </text>
      <view class="flex items-center justify-between py-[18rpx]">
        <text class="text-[28rpx] text-[#232338]">
          {{ t('companion.night.enabled') }}
        </text>
        <wd-switch :model-value="!!night.enabled" size="20" @change="({ value }) => setNight({ enabled: !!value })" />
      </view>
      <wd-datetime-picker
        v-model="start"
        type="time"
        :label="t('companion.night.start')"
        :cancel-button-text="t('common.cancel')"
        :confirm-button-text="t('common.confirm')"
        @confirm="({ value }) => onTime('start', value)"
      />
      <wd-datetime-picker
        v-model="end"
        type="time"
        :label="t('companion.night.end')"
        :cancel-button-text="t('common.cancel')"
        :confirm-button-text="t('common.confirm')"
        @confirm="({ value }) => onTime('end', value)"
      />
      <view v-for="item in nightToggles" :key="item.key" class="flex items-center justify-between py-[18rpx]">
        <text class="text-[28rpx] text-[#232338]">
          {{ t(item.label) }}
        </text>
        <wd-switch :model-value="!!night[item.key]" size="20" @change="({ value }) => setNight({ [item.key]: !!value })" />
      </view>
    </view>

    <view class="rounded-[20rpx] bg-white px-[28rpx] py-[20rpx] shadow-[0_2rpx_12rpx_rgba(0,0,0,0.04)]">
      <text class="mb-[8rpx] block text-[30rpx] text-[#232338] font-semibold">
        💛 {{ t('companion.care.title') }}
      </text>
      <view class="flex items-center justify-between gap-[20rpx] py-[18rpx]">
        <text class="flex-1 text-[28rpx] text-[#232338]">
          {{ t('companion.care.enabled') }}
        </text>
        <wd-switch :model-value="!!care.enabled" size="20" @change="({ value }) => setCareEnabled(!!value)" />
      </view>
      <view class="flex items-center justify-between gap-[20rpx] py-[18rpx]">
        <text class="flex-1 text-[28rpx] text-[#232338]">
          {{ t('companion.care.lonelyAfter') }}
        </text>
        <wd-input-number v-model="lonely" :min="10" :max="1440" :step="10" input-width="60" :disabled="!care.enabled" @change="onLonely" />
      </view>
    </view>
  </view>
</template>
