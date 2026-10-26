<template>
  <aside v-if="view" class="ch-quota" :class="{ 'is-over': view.exceeded }" :aria-label="$t('quota.title')" role="status">
    <p class="ch-quota__num tb-num" aria-hidden="true">{{ num(view.used) }}<span>/{{ num(view.limit) }}</span></p>
    <div class="ch-quota__text">
      <b>{{ $t('quota.title') }}</b>
      <p v-if="view.exceeded">{{ $t('quota.exceeded') }}
        <span v-if="view.blocked">{{ $t('quota.blocked', { n: num(view.blocked) }) }}</span></p>
      <p v-else>{{ $t('quota.used', { used: num(view.used), limit: num(view.limit) }) }} {{ $t('quota.left', { n: num(view.left) }) }}</p>
      <small>{{ $t('quota.reset') }}</small>
    </div>
    <span class="ch-quota__bar" aria-hidden="true"><i :style="{ width: `${view.pct}%` }"></i></span>
  </aside>
</template>

<script>
import aiApi from '@/apis/module/ai';
import { digits } from '@/kit/calendar';
import { quotaView } from './kidsModel';

// The owner's daily LLM limit (GET /usage/quota): shown only when a limit is set. When it is
// used up the robot says a polite Bangla line instead of answering; this says why.
export default {
  name: 'QuotaNote',
  data() { return { quota: null }; },
  computed: { view() { return quotaView(this.quota); } },
  created() {
    try {
      aiApi.getQuota(({ data }) => {
        if (data && data.code === 0) this.quota = data.data;
      }, () => {});
    } catch (e) {
      // no quota to show: the page works without it
    }
  },
  methods: { num(n) { return digits(n, this.$i18n.locale); } },
};
</script>

<style>
.ch-quota { display: grid; grid-template-columns: auto 1fr; gap: 4px var(--tb-s4); align-items: center; padding: var(--tb-s4) 0;
  border-bottom: 1px solid var(--tb-rule); }
.ch-quota__num { font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-32); line-height: var(--tb-lh-tight); }
.ch-quota__num span { font-size: var(--tb-fs-18); color: var(--tb-ink-3); font-weight: 600; }
.ch-quota__text { display: grid; gap: 2px; min-width: 0; font-size: var(--tb-fs-14); }
.ch-quota__text small { color: var(--tb-ink-3); font-size: var(--tb-fs-12); }
.ch-quota__bar { grid-column: 1 / -1; display: block; height: 3px; background: var(--tb-rule-soft); }
.ch-quota__bar i { display: block; height: 100%; background: var(--tb-orange); transition: width var(--tb-t-row) var(--tb-ease); }
.ch-quota.is-over .ch-quota__num { color: var(--tb-alarm); }
.ch-quota.is-over .ch-quota__bar i { background: var(--tb-alarm); }
</style>
