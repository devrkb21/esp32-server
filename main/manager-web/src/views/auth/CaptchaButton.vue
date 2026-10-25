<template>
  <button type="button" class="captcha-btn" :class="{ 'is-text': state !== 'ready' }"
    :aria-label="$t('auth.captchaRefresh')" :title="$t('auth.captchaRefresh')" :aria-busy="state === 'loading' ? 'true' : null"
    @click="$emit('refresh')">
    <img v-if="state === 'ready' && url" :src="url" :alt="$t('auth.captchaAlt')" width="112" height="40" />
    <span v-else-if="state === 'loading'">{{ $t('auth.captchaLoading') }}</span>
    <span v-else><TbIcon name="refresh" :size="14" />{{ $t('auth.captchaRetry') }}</span>
  </button>
</template>

<script setup>
// The server's picture code; a tap fetches a new one. Loading and failed states say so in words.
defineProps({
  url: { type: String, default: '' },
  state: { type: String, default: 'loading' },
});
defineEmits(['refresh']);
</script>
