<template>
  <i18n-t :keypath="keypath" tag="p" class="auth-form__note" scope="global">
    <template #terms><a :href="url('user-agreement')" target="_blank" rel="noopener">{{ $t('auth.terms') }}<span class="tb-visually-hidden"> {{ $t('auth.newTab') }}</span></a></template>
    <template #privacy><a :href="url('privacy-policy')" target="_blank" rel="noopener">{{ $t('auth.privacy') }}<span class="tb-visually-hidden"> {{ $t('auth.newTab') }}</span></a></template>
  </i18n-t>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { legalUrl } from './authKit';

// "By signing in you accept the terms and the privacy policy", with the two pages of public/
// (Chinese originals, "-en" for every other language, as before).
defineProps({ keypath: { type: String, required: true } });
const { locale } = useI18n({ useScope: 'global' });
const url = (page) => legalUrl(page, locale.value, import.meta.env.BASE_URL || '/');
</script>
