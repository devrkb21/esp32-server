<template>
  <i18n-t v-if="legalReady" :keypath="keypath" tag="p" class="auth-form__note" scope="global">
    <template #terms><a :href="url('terms')" target="_blank" rel="noopener">{{ $t('auth.terms') }}<span class="tb-visually-hidden"> {{ $t('auth.newTab') }}</span></a></template>
    <template #privacy><a :href="url('privacy')" target="_blank" rel="noopener">{{ $t('auth.privacy') }}<span class="tb-visually-hidden"> {{ $t('auth.newTab') }}</span></a></template>
  </i18n-t>
</template>

<script setup>
import { LEGAL_READY, legalUrl } from './authKit';

// "By signing in you accept the terms and the privacy policy", linking Nobix's /terms and
// /privacy pages (opened in a new tab so a half-filled form is not lost).
defineProps({ keypath: { type: String, required: true } });
const legalReady = LEGAL_READY;
const url = (page) => legalUrl(page);
</script>
