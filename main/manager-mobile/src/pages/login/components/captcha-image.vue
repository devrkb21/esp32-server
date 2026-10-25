<script setup lang="ts">
import { ref, watch } from 'vue'
import { t } from '@/i18n'

// The server's picture code; a tap asks for a new one. When the picture does not load, says so.
const props = defineProps<{ src: string }>()
const emit = defineEmits<{ (e: 'refresh'): void }>()
const failed = ref(false)
watch(() => props.src, () => {
  failed.value = false
})
</script>

<template>
  <view class="af__captcha" role="button" :aria-label="t('mauth.captchaAlt')" hover-class="is-press" @click="emit('refresh')">
    <view v-if="failed" class="af__captcha-fail">
      <tb-icon name="refresh" :size="14" /><text>{{ t('mauth.captchaRetry') }}</text>
    </view>
    <image v-else-if="src" class="af__captcha-img" :src="src" mode="aspectFit" @error="failed = true" />
  </view>
</template>

<style lang="scss">
/* the server's picture code: tap for a new one */
.af__captcha {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 112px;
  height: 40px;
  overflow: hidden;
  border: 1px solid var(--tb-rule-soft);
  border-radius: var(--tb-radius-s);
  background: var(--tb-paper-2);
  color: var(--tb-ink-2);
}
.af__captcha.is-press {
  border-color: var(--tb-ink-3);
}
.af__captcha-img {
  width: 112px;
  height: 40px;
}
.af__captcha-fail {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
}
</style>
