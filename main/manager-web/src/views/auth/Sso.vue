<template>
  <AuthFrame :title="$t(failed ? 'auth.sso.failTitle' : 'auth.sso.title')" :lead="$t(failed ? 'auth.sso.failLead' : 'auth.sso.lead')"
    :mood="failed ? 'confused' : 'awake'" :pulse="!failed">
    <div v-if="failed" class="sso__actions">
      <a v-if="shopUrl" class="sso__link" :href="shopUrl">{{ $t('auth.sso.backToShop') }}</a>
      <router-link class="sso__link" :to="{ name: 'login' }">{{ $t('auth.sso.signIn') }}</router-link>
    </div>
  </AuthFrame>
</template>

<script setup>
// Arriving from the TinyBot shop already signed in there: #/sso?code=<one-time code>&redirect=/robots.
// The code (60 s, single use) is swapped for this dashboard's normal token at /shop-bridge/redeem; the
// token itself never travels in a URL. See esp32-server/UPSTREAM.md, "The shop bridge".
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { safeRedirect } from '@/utils/linkCode';
import Api, { getServiceUrl } from '@/apis/api';
import store from '@/store';
import AuthFrame from './AuthFrame.vue';

const route = useRoute();
const router = useRouter();
const failed = ref(false);
const shopUrl = process.env.VUE_APP_SHOP_URL || '';

async function redeem(code) {
  const res = await fetch(`${getServiceUrl()}/shop-bridge/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.code !== 0 || !body.data || !body.data.token) throw new Error('redeem failed');
  return body.data;
}

onMounted(async () => {
  const code = typeof route.query.code === 'string' ? route.query.code : '';
  const next = safeRedirect(route.query.redirect, '/today');
  // drop the code from the address bar and history right away
  router.replace({ name: 'Sso' });
  if (!code) { failed.value = true; return; }
  try {
    const token = await redeem(code);
    store.commit('setToken', JSON.stringify(token));
    Api.user.getUserInfo(({ data: info }) => {
      if (info && info.code === 0) {
        store.commit('setUserInfo', info.data);
        router.replace(next);
      } else {
        failed.value = true;
      }
    });
  } catch (e) {
    failed.value = true;
  }
});
</script>

<style scoped>
.sso__actions { display: flex; flex-wrap: wrap; gap: 12px; }
.sso__link { color: var(--tb-ink); font-weight: 600; text-decoration: underline; min-height: 44px; display: inline-flex; align-items: center; }
</style>
