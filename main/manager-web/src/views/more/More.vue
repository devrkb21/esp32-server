<template>
  <div class="more">
    <TbPageHeader :title="$t('nav.more')" />
    <nav v-for="g in groups" :key="g.group" class="more__group more__group--nav" :aria-label="$t(g.group)">
      <h2 class="more__title">{{ $t(g.group) }}</h2>
      <RouterLink v-for="it in g.items" :key="it.to" :to="it.to" class="more__link" :style="it.ink ? { '--ink': `var(--tb-${it.ink})` } : null">
        <TbIcon :name="it.icon" /><span>{{ $t(it.label) }}</span>
        <b v-if="it.count && inbox[it.count]" class="more__count tb-num">{{ badgeText(inbox[it.count], (n) => digits(n, $i18n.locale)) }}</b>
        <TbIcon name="chevron-right" :size="16" />
      </RouterLink>
    </nav>
    <section class="more__group">
      <h2 class="more__title">{{ $t('nav.account') }}</h2>
      <RouterLink to="/account" class="more__link"><TbIcon name="user" /><span>{{ $t('nav.account') }}</span><TbIcon name="chevron-right" :size="16" /></RouterLink>
      <RouterLink to="/terms" class="more__link"><TbIcon name="book" /><span>{{ $t('legal.terms') }}</span><TbIcon name="chevron-right" :size="16" /></RouterLink>
      <RouterLink to="/privacy" class="more__link"><TbIcon name="lock" /><span>{{ $t('legal.privacy') }}</span><TbIcon name="chevron-right" :size="16" /></RouterLink>
      <button type="button" class="more__link" @click="toggleTheme"><TbIcon :name="dark ? 'sun' : 'moon'" /><span>{{ dark ? $t('nav.lightMode') : $t('nav.darkMode') }}</span></button>
      <div class="more__lang">
        <TbIcon name="language" /><span>{{ $t('nav.language') }}</span>
        <TbSelect size="s" :model-value="$i18n.locale" :options="LANGUAGES.map((l) => ({ value: l.code, label: l.label }))"
          :aria-label="$t('nav.language')" @change="changeLanguage" />
      </div>
      <button type="button" class="more__link is-danger" @click="$store.dispatch('logout')"><TbIcon name="logout" /><span>{{ $t('nav.logout') }}</span></button>
    </section>
    <TbMaker class="more__maker" :width="140" />
  </div>
</template>

<script>
import { visibleNav } from '@/shell/nav';
import { robotFeatures } from '@/shell/robot';
import { badgeText, inbox, refreshInbox } from '@/shell/inbox';
import { digits } from '@/kit/calendar';
import { LANGUAGES, changeLanguage } from '@/i18n';
import { applyTheme, getTheme } from '@/utils/theme';

// The phone's last tab: every place that is not one of the other tabs, plus account. On desktop
// the sidebar already lists the places, so only the account rows show.
export default {
  name: 'More',
  data() {
    return { LANGUAGES, dark: getTheme() === 'dark', inbox };
  },
  mounted() { refreshInbox(); },
  computed: {
    groups() {
      const admin = Boolean(this.$store.getters.getUserInfo?.superAdmin);
      const tabs = new Set(['/today', '/day', '/messages', '/look']);
      return visibleNav(admin, this.$store.getters.getPubConfig, robotFeatures())
        .map((g) => ({ ...g, items: g.items.filter((i) => !tabs.has(i.to)) }))
        .filter((g) => g.items.length);
    },
  },
  methods: {
    badgeText,
    digits,
    changeLanguage,
    toggleTheme() { this.dark = !this.dark; applyTheme(this.dark ? 'dark' : 'light'); },
  },
};
</script>

<style>
.more__group { padding: 18px 0 6px; }
.more__title { font-size: var(--tb-fs-14); color: var(--tb-ink-2); padding-bottom: 6px; border-bottom: 1px solid var(--tb-rule); }
.more__link, .more__lang {
  --ink: var(--tb-ink);
  display: flex; align-items: center; gap: 12px; width: 100%; min-height: 52px; padding: 0;
  border: 0; border-bottom: 1px solid var(--tb-rule-soft); background: none; text-align: left; text-decoration: none;
  font-weight: 600; font-size: var(--tb-fs-15); color: var(--tb-ink);
}
.more__link .tb-icon:first-child, .more__lang .tb-icon:first-child { color: var(--ink); }
.more__link span, .more__lang span { flex: 1; }
.more__lang .tb-select { width: 180px; }
.more__link.is-danger { color: var(--tb-danger); }
.more__count { min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; background: var(--tb-ink); color: var(--tb-paper);
  font: 700 var(--tb-fs-12)/22px var(--tb-font-text); text-align: center; }
.more__maker { padding: 32px 0 24px; }
@media (hover: hover) and (pointer: fine) { .more__link:hover { background: var(--tb-paper-2); } }
@media (min-width: 900px) { .more__group--nav { display: none; } }
</style>
