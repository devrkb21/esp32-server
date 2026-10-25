<template>
  <i18n-t v-if="legalReady" :keypath="keypath" tag="p" class="auth-form__note" scope="global">
    <template #terms><a :href="url('user-agreement')" target="_blank" rel="noopener">{{ $t('auth.terms') }}<span class="tb-visually-hidden"> {{ $t('auth.newTab') }}</span></a></template>
    <template #privacy><a :href="url('privacy-policy')" target="_blank" rel="noopener">{{ $t('auth.privacy') }}<span class="tb-visually-hidden"> {{ $t('auth.newTab') }}</span></a></template>
  </i18n-t>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { LEGAL_READY, legalUrl } from './authKit';

// "By signing in you accept the terms and the privacy policy", with the two pages of public/.
// Renders nothing until LEGAL_READY: Nobix must publish its own Bangla and English terms first.
defineProps({ keypath: { type: String, required: true } });
const legalReady = LEGAL_READY;
const { locale } = useI18n({ useScope: 'global' });
const url = (page) => legalUrl(page, locale.value, import.meta.env.BASE_URL || '/');
</script>
