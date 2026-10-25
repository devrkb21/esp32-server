<script setup lang="ts">
import { computed } from 'vue'
import { getCurrentLanguage, t } from '@/i18n'
import { useConfigStore } from '@/store'
import { digits } from '@/utils/calendar.mjs'

// The frame of the account screens: one calm column. The Nobix mark and name on the top rule,
// TinyBot's face window waking up beside the title as the form fills, the form, the version.
const props = withDefaults(defineProps<{ title: string, lead?: string, mood?: string, pulse?: boolean, back?: boolean }>(), {
  lead: '',
  mood: 'sleepy',
  pulse: false,
  back: false,
})
const emit = defineEmits<{ (e: 'back'): void }>()
const configStore = useConfigStore()
const version = computed(() => {
  const v = configStore.config?.version
  return v && v !== 'null' ? t('mauth.version', { v: digits(v, getCurrentLanguage()) }) : ''
})
const moodText = computed(() => t(`mauth.mood.${props.mood}`))
</script>

<template>
  <view class="auth">
    <view class="auth__col">
      <view class="auth__top">
        <view v-if="back" class="auth__back" role="button" :aria-label="t('mauth.backToLogin')" @click="emit('back')">
          <tb-icon name="chevron-left" :size="22" />
        </view>
        <view class="auth__brand">
          <image class="auth__mark" src="/static/logo.svg" mode="aspectFit" aria-hidden="true" />
          <view class="auth__brandtext">
            <text class="auth__name">
              {{ t('nav.brand') }}
            </text>
            <text class="auth__by">
              {{ t('nav.by') }}
            </text>
          </view>
        </view>
        <view v-if="$slots.tools" class="auth__tools">
          <slot name="tools" />
        </view>
      </view>

      <view class="auth__head">
        <view class="auth__bot">
          <tb-face :mood="mood" :pulse="pulse" :alt="t('mauth.faceAlt')" />
          <text class="auth__mood" aria-live="polite">
            {{ moodText }}
          </text>
        </view>
        <view class="auth__titles">
          <text class="auth__title" role="heading" aria-level="1">
            {{ title }}
          </text>
          <text v-if="lead" class="auth__lead">
            {{ lead }}
          </text>
        </view>
      </view>

      <view class="auth__form">
        <slot />
      </view>

      <view class="auth__foot">
        <slot name="foot" />
        <text v-if="version" class="tb-num auth__version">
          {{ version }}
        </text>
      </view>
    </view>
  </view>
</template>

<style lang="scss">
.auth {
  min-height: 100vh;
}
.auth__col {
  width: 100%;
  max-width: 460px;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: env(safe-area-inset-top) var(--tb-gutter) calc(16px + env(safe-area-inset-bottom));
}
.auth__top {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 60px;
  padding: 8px 0;
  border-bottom: 3px solid var(--tb-rule);
}
.auth__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin-left: -10px;
  flex: none;
}
.auth__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.auth__mark {
  width: 32px;
  height: 32px;
  flex: none;
}
.auth__brandtext {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  min-width: 0;
}
.auth__name {
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 18px;
}
.auth__by {
  font-size: 12px;
  color: var(--tb-ink-2);
}
.auth__tools {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: none;
}

.auth__head {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 22px 0 18px;
}
.auth__bot {
  width: 112px;
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.auth__mood {
  font-size: 12px;
  color: var(--tb-ink-2);
  line-height: 1.3;
}
.auth__titles {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.auth__title {
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 26px;
  line-height: 1.15;
}
.auth__lead {
  font-size: 14px;
  color: var(--tb-ink-2);
}

.auth__form {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.auth__foot {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 14px;
  margin-top: 20px;
  border-top: 1px solid var(--tb-rule-soft);
}
.auth__version {
  font-size: 12px;
  color: var(--tb-ink-2);
}

@media (max-width: 359px) {
  .auth__bot {
    width: 92px;
  }
  .auth__head {
    gap: 12px;
  }
  .auth__title {
    font-size: 23px;
  }
}
@media (min-width: 768px) {
  .auth__col {
    padding-top: 24px;
  }
  .auth__head {
    padding: 36px 0 24px;
  }
  .auth__bot {
    width: 140px;
  }
  .auth__title {
    font-size: 30px;
  }
}
</style>
