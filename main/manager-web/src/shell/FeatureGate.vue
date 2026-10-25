<template>
  <div v-if="missing" class="tb-gate" role="status">
    <TbPageHeader :title="title" />
    <TbEmpty :title="$t('shell.notHere.title')" :text="$t('shell.notHere.text', { name: deviceName })">
      <TbButton variant="primary" icon="today" to="/today">{{ $t('shell.notHere.today') }}</TbButton>
    </TbEmpty>
  </div>
  <slot v-else />
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { missingFeature, robot } from './robot';
import { productName } from './products';

// The central route guard: a page whose feature (route meta.needs) the chosen robot's product
// lacks shows a calm "not on this device" state with a way back to Today, instead of the page
// calling an API the device cannot answer.
const route = useRoute();
const { t, locale } = useI18n({ useScope: 'global' });
const missing = computed(() => missingFeature(route));
const title = computed(() => (route.meta && route.meta.title ? t(route.meta.title) : ''));
const deviceName = computed(() => robot.name || productName(robot, locale.value) || t('nav.robotFallback'));
</script>

<style>
.tb-gate { padding-bottom: var(--tb-s8); }
.tb-gate .tb-empty { padding-top: var(--tb-s10); border-top: 1px solid var(--tb-rule); max-width: none; }
.tb-gate .tb-empty__text { max-width: 46ch; }
</style>
