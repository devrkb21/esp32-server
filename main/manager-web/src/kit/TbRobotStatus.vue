<template>
  <span v-if="compact" class="tb-rstat is-compact" :class="[`is-${state}`, `ink-${ink}`]" :title="$t(keys.why)">
    <i class="tb-rstat__dot" aria-hidden="true"></i>{{ $t(keys.label) }}
  </span>
  <section v-else-if="!(hideOnline && state === 'online')" class="tb-rstat" :class="[`is-${state}`, `ink-${ink}`]"
    role="status" aria-live="polite" :aria-label="$t('status.title')">
    <div class="tb-rstat__head">
      <i class="tb-rstat__dot" aria-hidden="true"></i>
      <p class="tb-rstat__label">{{ $t(keys.label) }}</p>
      <p v-if="seenLine" class="tb-rstat__seen">{{ seenLine }}</p>
    </div>
    <p class="tb-rstat__why">{{ $t(keys.why) }}</p>
    <p v-if="state !== 'online'" class="tb-rstat__next">{{ $t(keys.next) }}</p>
    <p v-if="hint" class="tb-rstat__hint">{{ hint }}</p>
    <div v-if="state !== 'online' && state !== 'checking'" class="tb-rstat__foot">
      <TbButton size="s" icon="refresh" :loading="loading" @click="$emit('refresh')">{{ $t('status.refresh') }}</TbButton>
      <span v-if="polling" class="tb-rstat__auto">{{ $t('status.auto', { n: num(pollSeconds) }) }}</span>
    </div>
  </section>
</template>

<script>
import { digits } from './calendar';
import { shouldPoll, statusInk, statusKeys } from '@/shell/connection.mjs';
import TbButton from './TbButton.vue';

// The robot's connection, said the same way on every page (rules: src/shell/connection.mjs).
// `status` is { state, lastSeen, reason } from statusOf (src/shell/robotStatus.js).
// compact: the mark and the word (sidebar, rows, page headers). Otherwise a calm ruled panel: the
// word, what it means, when the robot was last seen, the next step and "check again". While the
// robot is joining the server it asks again by itself every `pollSeconds` (only while the page is
// visible, and once more when the page comes back) by emitting `refresh`.
export default {
  name: 'TbRobotStatus',
  components: { TbButton },
  props: {
    status: { type: Object, default: null },
    compact: Boolean,
    loading: Boolean,
    hideOnline: Boolean,
    hint: { type: String, default: '' },
    pollSeconds: { type: Number, default: 15 },
  },
  emits: ['refresh'],
  data() { return { timer: null }; },
  computed: {
    lang() { return (this.$i18n && this.$i18n.locale) || 'en'; },
    state() { return (this.status && this.status.state) || 'checking'; },
    keys() { return statusKeys(this.state, this.status && this.status.reason); },
    ink() { return statusInk(this.state); },
    polling() { return !this.compact && shouldPoll(this.state); },
    when() {
      // offline: the last time either server saw it; not syncing: its last sync with the companion server
      const st = this.status || {};
      const at = this.state === 'not_syncing' ? st.lastSync || st.lastSeen : st.lastSeen;
      if (!at) return '';
      const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
      if (s < 60) return this.$t('companion.justNow');
      if (s < 3600) return this.$t('companion.ago.minutes', { n: this.num(Math.floor(s / 60)) });
      if (s < 86400) return this.$t('companion.ago.hours', { n: this.num(Math.floor(s / 3600)) });
      return this.$t('companion.ago.days', { n: this.num(Math.floor(s / 86400)) });
    },
    seenLine() {
      if (!this.when) return '';
      if (this.state === 'offline') return this.$t('status.lastSeen', { when: this.when });
      if (this.state === 'not_syncing') return this.$t('status.lastSync', { when: this.when });
      return '';
    },
  },
  watch: { polling() { this.start(); } },
  mounted() {
    this.start();
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisible);
  },
  beforeUnmount() {
    this.stop();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisible);
  },
  methods: {
    num(n) { return digits(n, this.lang); },
    hidden() { return typeof document !== 'undefined' && document.hidden; },
    stop() { if (this.timer) clearInterval(this.timer); this.timer = null; },
    start() {
      this.stop();
      if (!this.polling) return;
      this.timer = setInterval(() => { if (!this.hidden() && !this.loading) this.$emit('refresh'); }, this.pollSeconds * 1000);
    },
    onVisible() { if (!this.hidden() && this.polling) this.$emit('refresh'); },
  },
};
</script>

<style>
.tb-rstat {
  --mark: var(--tb-ink-2);
  display: grid; gap: 6px; padding: var(--tb-s4) 0; border-top: 1px solid var(--tb-rule); border-bottom: 1px solid var(--tb-rule);
  max-width: 72ch;
}
.tb-rstat.ink-ok { --mark: var(--tb-ok); }
.tb-rstat.ink-warn { --mark: var(--tb-warn); }
.tb-rstat.ink-danger { --mark: var(--tb-danger); }
.tb-rstat__head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 12px; }
.tb-rstat__dot { flex: none; align-self: center; width: 10px; height: 10px; border-radius: 50%; background: var(--mark); }
.tb-rstat.is-offline .tb-rstat__dot, .tb-rstat.is-checking .tb-rstat__dot { background: transparent; border: 1.5px solid var(--tb-ink-3); }
.tb-rstat__label { font-family: var(--tb-font-display); font-weight: 700; font-size: var(--tb-fs-20); line-height: 1.3; }
.tb-rstat__seen { font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.tb-rstat__why { font-size: var(--tb-fs-15); }
.tb-rstat__next { font-size: var(--tb-fs-14); color: var(--tb-ink-2); }
.tb-rstat__hint { font-size: var(--tb-fs-13); color: var(--tb-ink-2); padding-top: 6px; border-top: 1px dashed var(--tb-rule-soft); }
.tb-rstat__foot { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 14px; padding-top: 6px; }
.tb-rstat__auto { font-size: var(--tb-fs-12); color: var(--tb-ink-2); }

.tb-rstat.is-compact {
  display: inline-flex; align-items: center; gap: 6px; padding: 0; border: 0; max-width: none;
  font-size: var(--tb-fs-13); font-weight: 600; color: var(--tb-ink); white-space: nowrap;
}
.tb-rstat.is-compact .tb-rstat__dot { width: 8px; height: 8px; }
.tb-rstat.is-compact.ink-ok { color: var(--tb-ok); }
.tb-rstat.is-compact.ink-ink-2 { color: var(--tb-ink-2); }
.tb-rstat.is-compact.ink-danger { color: var(--tb-danger); }
</style>
