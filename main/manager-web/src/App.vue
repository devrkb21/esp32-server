<template>
  <RouterView v-slot="{ Component, route }">
    <component :is="Component" v-if="route.meta.bare" :key="route.name" />
    <AppShell v-else>
      <component :is="Component" :key="route.name" />
    </AppShell>
  </RouterView>
  <TbToastHost :close-label="$t('common.close')" />
  <TbConfirmHost :confirm-text="$t('common.ok')" :cancel-text="$t('common.cancel')" />
</template>

<script setup>
import { watch } from 'vue';
import { useRoute } from 'vue-router';
import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';
import AppShell from './shell/AppShell.vue';

const store = useStore();
const route = useRoute();
const { t, locale } = useI18n({ useScope: 'global' });

try {
  store.commit('setUserInfo', JSON.parse(localStorage.getItem('userInfo') || '{}'));
  store.commit('setPubConfig', JSON.parse(localStorage.getItem('pubConfig') || '{}'));
} catch (e) { /* private mode or bad data */ }

// Tab title: "<page> · Nobix" (the app's name; TinyBot is one product inside it)
watch([() => route.meta.title, locale], () => {
  const brand = 'Nobix';
  document.title = route.meta.title ? `${t(route.meta.title)} · ${brand}` : brand;
}, { immediate: true });
</script>
