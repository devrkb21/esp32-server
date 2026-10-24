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
  <view v-if="dev">
    <view class="nx-group">
      <view class="nx-group__header">
        {{ t('companion.night.title') }}
      </view>
      <view class="nx-group__body">
        <view class="nx-row">
          <view class="nx-icon-tile night__icon">
            <wd-icon name="star-filled" size="16px" />
          </view>
          <view class="nx-row__main nx-row__title">
            {{ t('companion.night.enabled') }}
          </view>
          <wd-switch :model-value="!!night.enabled" size="24px" @change="({ value }) => setNight({ enabled: !!value })" />
        </view>
        <wd-datetime-picker
          v-model="start"
          type="time"
          :label="t('companion.night.start')"
          :cancel-button-text="t('common.cancel')"
          :confirm-button-text="t('common.confirm')"
          custom-class="cmp-picker"
          @confirm="({ value }) => onTime('start', value)"
        />
        <wd-datetime-picker
          v-model="end"
          type="time"
          :label="t('companion.night.end')"
          :cancel-button-text="t('common.cancel')"
          :confirm-button-text="t('common.confirm')"
          custom-class="cmp-picker"
          @confirm="({ value }) => onTime('end', value)"
        />
        <view v-for="item in nightToggles" :key="item.key" class="nx-row">
          <view class="nx-row__main nx-row__title">
            {{ t(item.label) }}
          </view>
          <wd-switch :model-value="!!night[item.key]" size="22px" @change="({ value }) => setNight({ [item.key]: !!value })" />
        </view>
      </view>
    </view>

    <view class="nx-group">
      <view class="nx-group__header">
        {{ t('companion.care.title') }}
      </view>
      <view class="nx-group__body">
        <view class="nx-row">
          <view class="nx-icon-tile night__icon">
            <wd-icon name="heart" size="16px" />
          </view>
          <view class="nx-row__main nx-row__title">
            {{ t('companion.care.enabled') }}
          </view>
          <wd-switch :model-value="!!care.enabled" size="24px" @change="({ value }) => setCareEnabled(!!value)" />
        </view>
        <view class="nx-row cmp-stepper-row">
          <view class="nx-row__main nx-row__title" :class="{ night__muted: !care.enabled }">
            {{ t('companion.care.lonelyAfter') }}
          </view>
          <wd-input-number v-model="lonely" :min="10" :max="1440" :step="10" input-width="60" :disabled="!care.enabled" @change="onLonely" />
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.night {
  &__icon {
    width: 56rpx;
    height: 56rpx;
    border-radius: var(--nx-radius-sm);
  }

  &__muted {
    color: var(--nx-text-3);
  }
}
</style>
