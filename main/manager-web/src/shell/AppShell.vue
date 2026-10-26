<template>
  <div class="tb-shell" :class="{ 'is-collapsed': collapsed }">
    <a class="tb-skip" href="#tb-main">{{ $t('nav.skip') }}</a>
    <aside class="tb-side">
      <div class="tb-side__brand">
        <img class="tb-side__mark" :src="markSrc" width="56" height="32" alt="" />
        <span class="tb-side__name">{{ $t('nav.brand') }}</span>
        <RouterLink to="/notifications" class="tb-bell" :aria-label="bellLabel">
          <TbIcon name="bell" :size="20" /><span v-if="bellCount" class="tb-bell__n tb-num" aria-hidden="true">{{ bellCount }}</span>
        </RouterLink>
      </div>
      <RouterLink v-if="robot.deviceId" to="/robots" class="tb-side__robot">
        <TbFace v-if="robot.features.includes('companion')" :width="96" :mood="sideMood" />
        <span v-else class="tb-side__device" aria-hidden="true"><TbIcon name="devices" :size="22" /></span>
        <span><b>{{ robot.name || $t('nav.robotFallback') }}</b><TbRobotStatus compact :status="sideStatus" /><small>{{ $t('nav.switchRobot') }}</small></span>
      </RouterLink>
      <nav class="tb-side__nav" :aria-label="$t('nav.label')">
        <template v-for="g in groups" :key="g.group">
          <p class="tb-side__group">{{ $t(g.group) }}</p>
          <RouterLink v-for="it in g.items" :key="it.to" :to="it.to" class="tb-side__link" :style="it.ink ? { '--ink': `var(--tb-${it.ink})` } : null">
            <TbIcon :name="it.icon" :size="19" /><span>{{ $t(it.label) }}</span>
            <span v-if="it.count && inbox[it.count]" class="tb-side__count tb-num">{{ badgeText(inbox[it.count], (n) => digits(n, lang)) }}</span>
          </RouterLink>
        </template>
      </nav>
      <div class="tb-side__foot">
        <TbMenu :items="accountItems" align="start" @select="onAccount">
          <template #trigger>
            <button type="button" class="tb-side__account" :aria-label="userName ? `${userName}, ${$t('nav.account')}` : $t('nav.account')">
              <TbIcon name="user" :size="18" /><span class="tb-side__user">{{ userName }}</span><TbIcon name="chevron-up" :size="16" />
            </button>
          </template>
        </TbMenu>
      </div>
    </aside>

    <!-- under 900px: the brand and the bell above the page (the sidebar is hidden) -->
    <header class="tb-top">
      <img class="tb-top__mark" :src="markSrc" width="42" height="24" alt="" />
      <span class="tb-top__name">{{ $t('nav.brand') }}</span>
      <RouterLink to="/notifications" class="tb-bell" :aria-label="bellLabel">
        <TbIcon name="bell" :size="22" /><span v-if="bellCount" class="tb-bell__n tb-num" aria-hidden="true">{{ bellCount }}</span>
      </RouterLink>
    </header>

    <main id="tb-main" class="tb-main" tabindex="-1">
      <FeatureGate><slot /></FeatureGate>
    </main>

    <nav class="tb-tabbar" :aria-label="$t('nav.label')">
      <RouterLink v-for="t in tabs" :key="t.to" :to="t.to" class="tb-tabbar__tab">
        <TbIcon :name="t.icon" :size="22" /><span>{{ $t(t.label) }}</span>
      </RouterLink>
    </nav>

    <TbSheet v-model:open="langOpen" :title="$t('nav.language')" size="s" :close-label="$t('common.close')">
      <TbChoice wrap :model-value="lang" :options="LANGUAGES.map((l) => ({ value: l.code, label: l.label }))"
        :aria-label="$t('nav.language')" @change="setLang" />
    </TbSheet>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';
import { visibleNav, visibleTabs } from './nav';
import { loadRobots, robot, robotFeatures } from './robot';
import { refreshRobotStatus, statusOf } from './robotStatus';
import FeatureGate from './FeatureGate.vue';
import { badgeText, inbox, refreshInbox } from './inbox';
import { digits } from '@/kit/calendar';
import { LANGUAGES, changeLanguage } from '@/i18n';
import { applyTheme, getTheme } from '@/utils/theme';
import { goToPage } from '@/utils';

// The app's own brand: the Nobix NX mark (official file, never recoloured) and the name Nobix.
const markSrc = `${import.meta.env.BASE_URL || '/'}brand/nobix-mark.png`;
const store = useStore();
const { t, locale } = useI18n({ useScope: 'global' });
const collapsed = ref(false);
const langOpen = ref(false);
const lang = computed(() => locale.value);
const isAdmin = computed(() => Boolean(store.getters.getUserInfo?.superAdmin));
// Places the chosen robot's product cannot use (a generic device has no Day or Look) are hidden.
const features = computed(() => robotFeatures());
const groups = computed(() => visibleNav(isAdmin.value, store.getters.getPubConfig, features.value));
const tabs = computed(() => visibleTabs(features.value));
// The chosen robot's connection, the same word every page shows (src/shell/robotStatus.js). Pages
// that poll the companion view keep it fresh; on its own the sidebar asks every 30 s.
const sideStatus = computed(() => statusOf(robot.deviceId));
const sideMood = computed(() => ({ online: 'awake', offline: 'offline', checking: 'awake' }[sideStatus.value.state] || 'confused'));
let statusTimer = null;
function checkStatus() { if (robot.deviceId && !document.hidden) refreshRobotStatus(robot.deviceId); }
// The bell: unread notifications (src/shell/inbox.js), refreshed with the status check
const bellCount = computed(() => badgeText(inbox.unread, (n) => digits(n, locale.value)));
const bellLabel = computed(() => (inbox.unread ? t('notify.bellUnread', { n: digits(inbox.unread, locale.value) }) : t('notify.title')));
let inboxTimer = null;
function checkInbox() { if (!document.hidden) refreshInbox(); }
onMounted(async () => {
  store.dispatch('fetchPubConfig');
  await loadRobots();
  checkStatus();
  statusTimer = setInterval(checkStatus, 30000);
  document.addEventListener('visibilitychange', checkStatus);
  checkInbox();
  inboxTimer = setInterval(checkInbox, 60000);
  document.addEventListener('visibilitychange', checkInbox);
});
onBeforeUnmount(() => {
  clearInterval(statusTimer); clearInterval(inboxTimer);
  document.removeEventListener('visibilitychange', checkStatus);
  document.removeEventListener('visibilitychange', checkInbox);
});
watch(() => robot.deviceId, checkStatus);
const userName = computed(() => store.getters.getUserInfo?.username || '');
const accountItems = computed(() => [
  { key: 'language', label: t('nav.language'), icon: 'language' },
  { key: 'theme', label: getTheme() === 'dark' ? t('nav.lightMode') : t('nav.darkMode'), icon: getTheme() === 'dark' ? 'sun' : 'moon' },
  { key: 'password', label: t('nav.changePassword'), icon: 'key' },
  { divider: true },
  { key: 'logout', label: t('nav.logout'), icon: 'logout', danger: true },
]);
function setLang(code) { changeLanguage(code); langOpen.value = false; }
function onAccount(key) {
  if (key === 'language') langOpen.value = true;
  if (key === 'theme') applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
  if (key === 'password') goToPage('/account');
  if (key === 'logout') store.dispatch('logout');
}
</script>

<style>
.tb-shell { min-height: 100vh; display: grid; grid-template-columns: var(--tb-sidebar) minmax(0, 1fr); }
.tb-skip { position: absolute; left: -999px; top: 8px; z-index: 2000; background: var(--tb-ink); color: var(--tb-paper); padding: 8px 12px; }
.tb-skip:focus { left: 8px; }

.tb-side {
  position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; gap: 10px;
  padding: 16px 12px 12px; border-right: 1px solid var(--tb-rule); background: var(--tb-paper); overflow: hidden;
}
.tb-side__brand { display: flex; align-items: center; gap: 10px; padding: 0 6px 12px; border-bottom: var(--tb-rule-band) solid var(--tb-rule); }
.tb-side__name { display: grid; font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-18); line-height: 1.1; }
.tb-side__mark { display: block; width: auto; height: 32px; flex: none; }
.tb-side__name small { font: 500 var(--tb-fs-12) var(--tb-font-text); color: var(--tb-ink-2); }
.tb-side__robot { display: flex; align-items: center; gap: 10px; padding: 8px 6px; border-bottom: 1px solid var(--tb-rule); text-decoration: none; }
.tb-side__robot > span:not(.tb-side__device) { display: grid; min-width: 0; }
.tb-side__device { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid var(--tb-rule); border-radius: 8px; color: var(--tb-ink-2); }
.tb-side__robot b { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tb-side__robot small { color: var(--tb-ink-2); font-size: var(--tb-fs-12); }
.tb-side__robot .tb-rstat.is-compact { display: flex; min-width: 0; margin: 2px 0; font-size: var(--tb-fs-12); white-space: normal; }
.tb-side__robot:hover b { text-decoration: underline; }
/* only the nav scrolls: the account, language, theme and logout foot stays in view */
.tb-side__nav { flex: 1; min-height: 0; overflow-y: auto; display: grid; gap: 1px; align-content: start; }
.tb-side__group { margin: 12px 0 4px; padding: 8px 8px 0; border-top: 1px solid var(--tb-rule); font-size: var(--tb-fs-12); font-weight: 700; color: var(--tb-ink-2); }
.tb-side__link {
  --ink: var(--tb-ink);
  position: relative; display: flex; align-items: center; gap: 10px; min-height: 38px; padding: 0 10px;
  border-radius: 8px; text-decoration: none; color: var(--tb-ink-2); font-weight: 600; font-size: var(--tb-fs-14);
  transition: background-color var(--tb-t-hover) var(--tb-ease), color var(--tb-t-hover) var(--tb-ease);
}
.tb-side__link:hover { background: var(--tb-paper-2); color: var(--tb-ink); }
.tb-side__link.router-link-active { color: var(--tb-ink); background: none; }
.tb-side__link.router-link-active::before { content: ""; position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px; background: var(--tb-orange); border-radius: 2px; }
.tb-side__link.router-link-active .tb-icon { color: var(--ink); }
.tb-side__count { margin-left: auto; min-width: 22px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--tb-ink);
  color: var(--tb-paper); font: 700 var(--tb-fs-12)/20px var(--tb-font-text); text-align: center; }
.tb-side__foot { margin-top: auto; padding-top: 10px; border-top: 1px solid var(--tb-rule); }
.tb-side__account { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 40px; padding: 0 8px; border: 0; border-radius: 8px; background: none; text-align: left; }
.tb-side__account:hover { background: var(--tb-paper-2); }
.tb-side__user { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }

.tb-main { min-width: 0; padding: 0 clamp(16px, 4vw, 48px) 64px; outline: none; }
.tb-main > * { max-width: var(--tb-content-max); margin-inline: auto; }

.tb-tabbar { display: none; }
.tb-top { display: none; }

/* the bell: unread notifications */
.tb-bell { position: relative; display: grid; place-items: center; width: 40px; height: 40px; margin-left: auto; flex: none;
  border-radius: 8px; color: var(--tb-ink); text-decoration: none; }
.tb-bell:hover { background: var(--tb-paper-2); }
.tb-bell.router-link-active { box-shadow: inset 0 -2px 0 var(--tb-orange); border-radius: 0; }
.tb-bell__n { position: absolute; top: 2px; right: 0; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 999px;
  background: var(--tb-ink); color: var(--tb-paper); font: 700 11px/18px var(--tb-font-text); text-align: center; }

@media (max-width: 899px) {
  .tb-shell { display: block; }
  .tb-side { display: none; }
  .tb-top { display: flex; align-items: center; gap: 8px; padding: calc(4px + env(safe-area-inset-top)) var(--tb-gutter) 4px;
    border-bottom: 1px solid var(--tb-rule); }
  .tb-top__mark { display: block; width: auto; height: 24px; }
  .tb-top__name { font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-16); }
  .tb-top .tb-bell { width: 44px; height: 44px; }
  .tb-main { padding: 0 var(--tb-gutter) calc(96px + env(safe-area-inset-bottom)); }
  .tb-tabbar {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr);
    padding: 6px 4px calc(8px + env(safe-area-inset-bottom)); background: var(--tb-paper); border-top: var(--tb-rule-band) solid var(--tb-rule);
  }
  .tb-tabbar__tab {
    display: grid; justify-items: center; gap: 2px; min-height: 52px; padding-top: 4px; text-decoration: none;
    color: var(--tb-ink-2); font-size: var(--tb-fs-12); font-weight: 600;
  }
  .tb-tabbar__tab.router-link-active { color: var(--tb-ink); }
  .tb-tabbar__tab.router-link-active span { box-shadow: inset 0 -2px 0 var(--tb-orange); }
}
</style>
