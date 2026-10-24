<route lang="jsonc" type="page">
{
  "layout": "default",
  "style": {
    "navigationBarTitleText": "Voice Settings",
    "navigationStyle": "custom"
  }
}
</route>

<script lang="ts" setup>
import { t } from '@/i18n'
import { useSpeedPitch } from '@/store'

defineOptions({
  name: 'SpeedPitch',
})

const speedPitchStore = useSpeedPitch()

// Safe area for the custom navigation bar
const safeTop = (uni.getSystemInfoSync().safeAreaInsets?.top) || 0
const SPEED_PITCH_FIELDS = ['ttsVolume', 'ttsRate', 'ttsPitch'] as const

const localSettings = ref({
  ttsVolume: 0,
  ttsRate: 0,
  ttsPitch: 0,
})

// Pending copy (src/i18n/_pending/mobile-home-agents.ts): English fallback until merged
function tx(key: string, fallback: string) {
  const value = t(key)
  return value === key ? fallback : value
}

const sliders = computed(() => [
  { key: 'ttsVolume' as const, label: t('agent.ttsVolume'), hint: t('agent.volumeHint') },
  { key: 'ttsRate' as const, label: t('agent.ttsRate'), hint: t('agent.speedHint') },
  { key: 'ttsPitch' as const, label: t('agent.ttsPitch'), hint: t('agent.pitchHint') },
])

const hasLocalChanges = computed(() => SPEED_PITCH_FIELDS.some(field => localSettings.value[field] !== speedPitchStore.speedPitch[field]))

function formatSigned(value: number) {
  return value > 0 ? `+${value}` : `${value}`
}

function resetField(field: typeof SPEED_PITCH_FIELDS[number]) {
  localSettings.value[field] = 0
}

function handleConfirm() {
  const changedFields = SPEED_PITCH_FIELDS.filter((field) => {
    return localSettings.value[field] !== speedPitchStore.speedPitch[field]
  })
  speedPitchStore.updateSpeedPitch(localSettings.value, { changedFields })
  goBack()
}

// Return to previous page and update config
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
  <view class="nx-subpage">
    <view class="nx-subpage__nav" :style="{ paddingTop: `${safeTop}px` }">
      <view class="nx-subpage__back" role="button" :aria-label="tx('agent.navBack', 'Back')" @click="goBack">
        <wd-icon name="arrow-left" size="20px" />
      </view>
      <text class="nx-subpage__nav-title nx-truncate">
        {{ t('agent.languageConfig') }}
      </text>
      <view class="nx-subpage__back" />
    </view>

    <scroll-view scroll-y class="nx-subpage__scroll">
      <view class="nx-subpage__content">
        <view class="nx-large-title">
          <view class="nx-large-title__title">
            {{ t('agent.languageConfig') }}
          </view>
          <view class="nx-large-title__subtitle">
            {{ tx('agent.voiceTuningSubtitle', 'Fine-tune how your agent sounds. 0 is the voice’s natural setting.') }}
          </view>
        </view>

        <view v-for="item in sliders" :key="item.key" class="nx-group">
          <view class="nx-group__body tune-card">
            <view class="tune-card__head">
              <text class="nx-row__title">
                {{ item.label }}
              </text>
              <view class="nx-num tune-card__value" :class="{ 'is-default': localSettings[item.key] === 0 }">
                {{ formatSigned(localSettings[item.key]) }}
              </view>
            </view>
            <wd-slider
              v-model="localSettings[item.key]"
              :min="-100"
              :max="100"
              :step="1"
              hide-min-max
              hide-label
              custom-class="tune-card__slider"
            />
            <view class="tune-card__foot">
              <text class="tune-card__hint">
                {{ item.hint }}
              </text>
              <text
                v-if="localSettings[item.key] !== 0"
                class="tune-card__reset"
                role="button"
                @click="resetField(item.key)"
              >
                {{ tx('agent.voiceTuningReset', 'Reset') }}
              </text>
            </view>
          </view>
        </view>

        <view class="nx-group__footer">
          {{ tx('agent.voiceTuningFooter', 'Changes apply after you save the agent.') }}
        </view>
      </view>
    </scroll-view>

    <view class="nx-action-bar">
      <wd-button type="primary" block size="large" custom-class="tune-save" @click="handleConfirm">
        {{ hasLocalChanges ? t('agent.save') : tx('agent.editorDone', 'Done') }}
      </wd-button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.nx-subpage {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--nx-bg);

  &__nav {
    display: flex;
    align-items: center;
    flex: none;
    gap: var(--nx-space-2);
    padding-left: var(--nx-gutter);
    padding-right: var(--nx-gutter);
    min-height: var(--nx-touch);
    background: var(--nx-bg);
  }
  &__back {
    display: flex;
    align-items: center;
    flex: none;
    width: var(--nx-touch);
    height: var(--nx-touch);
    color: var(--nx-accent);
    &:active {
      opacity: 0.6;
    }
  }
  &__nav-title {
    flex: 1;
    text-align: center;
    font-size: var(--nx-text-headline);
    font-weight: 600;
    color: var(--nx-text);
  }
  &__scroll {
    flex: 1;
    height: 0;
  }
  &__content {
    padding: 0 var(--nx-gutter) calc(220rpx + env(safe-area-inset-bottom));
  }
}

.tune-card {
  padding: var(--nx-space-4);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  &__value {
    min-width: 88rpx;
    padding: 4rpx var(--nx-space-2);
    border-radius: var(--nx-radius-pill);
    background: var(--nx-accent-soft);
    color: var(--nx-accent);
    font-size: var(--nx-text-callout);
    font-weight: 600;
    text-align: center;
    &.is-default {
      background: var(--nx-surface-2);
      color: var(--nx-text-2);
    }
  }
  &__foot {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--nx-space-3);
  }
  &__hint {
    flex: 1;
    font-size: var(--nx-text-caption);
    line-height: 1.5;
    color: var(--nx-text-3);
  }
  &__reset {
    flex: none;
    color: var(--nx-accent);
    font-size: var(--nx-text-footnote);
    font-weight: 600;
  }
}

:deep(.tune-card__slider) {
  --wot-slider-axie-bg: var(--nx-surface-3);
  --wot-slider-line-color: var(--nx-accent);
  --wot-slider-handle-bg: var(--nx-surface);
  margin: var(--nx-space-3) 0 var(--nx-space-2);
}

:deep(.tune-save) {
  border-radius: var(--nx-radius);
}
</style>
