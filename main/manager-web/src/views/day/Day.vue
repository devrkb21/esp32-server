<template>
  <div class="day">
    <TbPageHeader :title="$t('nav.day')" :description="$t('day.lede')">
      <template v-if="view" #actions>
        <TbTag :ink="view.online ? 'ok' : 'ink-2'" mark>{{ view.online ? $t('common.online') : $t('common.offline') }}</TbTag>
      </template>
    </TbPageHeader>

    <div v-if="!deviceId" class="day__none">
      <TbEmpty face="confused" :title="$t('common.noRobot')" :text="$t('common.noRobotText')">
        <TbButton variant="primary" to="/robots" icon="robots">{{ $t('common.goRobots') }}</TbButton>
      </TbEmpty>
    </div>

    <div v-else-if="!view" class="day__state">
      <TbLoading v-if="loading || !loadError" :label="$t('common.loading')" show-label />
      <template v-else>
        <TbEmpty face="confused" :title="$t('common.loadFailed')" :text="loadError">
          <TbButton icon="refresh" @click="refresh(false)">{{ $t('common.retry') }}</TbButton>
        </TbEmpty>
      </template>
    </div>

    <template v-else>
      <p v-if="!view.online" class="day__offline" role="status">{{ $t('day.offlineNote') }}</p>

      <div class="day__top">
        <section class="day__almanac" aria-labelledby="day-today-h">
          <header class="day__almanachead">
            <h2 id="day-today-h">{{ $t('day.todayTitle') }}</h2>
            <span class="day__date">{{ dateText }}</span>
          </header>
          <TbDayTable :rows="rows" :lang="lang" :now-minutes="minute" :now-label="$t('common.now')"
            :caption="$t('day.todayTitle')" :empty-text="$t('day.todayEmpty')" clickable @select="(r) => openKey(r.key)" />
          <p v-if="loadError" class="day__fail" role="alert">{{ loadError }}
            <TbButton size="s" variant="quiet" icon="refresh" @click="refresh(false)">{{ $t('common.retry') }}</TbButton></p>
        </section>

        <aside class="day__nowbox" :aria-label="$t('day.nowLabel')">
          <DayScreen v-if="nowActivity" class="day__screen" :activity="nowActivity" :look="look"
            :alt="$t('day.screenAlt', { activity: $t(`day.activity.${nowActivity}`) })" />
          <TbFace v-else class="day__screen" :mood="view.online ? 'awake' : 'offline'" :alt="$t('day.screenIdle')" />
          <dl class="day__nowlist">
            <div><dt>{{ $t('common.now') }}</dt><dd>{{ nowActivity ? $t(`day.activity.${nowActivity}`) : $t('day.nothingNow') }}</dd></div>
            <div v-if="next"><dt>{{ $t('day.next') }}</dt><dd><span class="tb-num">{{ fmt(next.time) }}</span> {{ next.title }}</dd></div>
          </dl>
          <nav class="day__index" :aria-label="$t('day.tabsLabel')">
            <button v-for="it in index" :key="it.key" type="button" class="day__indexrow" :style="it.ink ? { '--ink': `var(--tb-${it.ink})` } : null"
              @click="goTab(it.key)">
              <TbIcon :name="it.icon" :size="18" />
              <span><b>{{ $t(`day.tab.${it.key}`) }}</b><small>{{ it.text }}</small></span>
              <TbIcon name="chevron-right" :size="16" />
            </button>
          </nav>
        </aside>
      </div>

      <div ref="tabs" class="day__tabs">
        <TbTabs v-model="tab" :items="tabItems" :aria-label="$t('day.tabsLabel')" />
      </div>
      <div class="day__panel" role="tabpanel" :aria-label="tabLabel">
        <!-- kept alive: unsaved edits of a panel survive switching tabs -->
        <KeepAlive><component :is="PANELS[tab]" ref="current" /></KeepAlive>
      </div>
    </template>
  </div>
</template>

<script>
import { markRaw } from 'vue';
import Api from '@/apis/api';
import { digits, timeText } from '@/kit/calendar';
import { deviceIdFrom, loadRobots } from '@/shell/robot';
import { ACTIVITIES, scheduledActivity, normalizeRoutine } from '@/utils/companion.mjs';
import { TABS, TAB_INK, dayTimeline, nextRow, tabOfKey } from './dayModel';
import DayScreen from './DayScreen.vue';
import DayAlarms from './DayAlarms.vue';
import DayReminders from './DayReminders.vue';
import DayPrayer from './DayPrayer.vue';
import DayRoutine from './DayRoutine.vue';
import DayFocus from './DayFocus.vue';
import DayNight from './DayNight.vue';

const REFRESH_MS = 10000;
const PANELS = { alarms: DayAlarms, reminders: DayReminders, prayer: DayPrayer, routine: DayRoutine, focus: DayFocus, night: DayNight };
const TAB_ICON = { alarms: 'alarm', reminders: 'reminder', prayer: 'prayer', routine: 'day', focus: 'focus', night: 'night' };

// Day: everything that has a time in TinyBot's day, for this robot. The day as an almanac
// table first, then one tab per area. The page is the controller its panels inject as `day`:
// the companion view, save (whole-list or partial config patches), commands and sync states.
export default {
  name: 'Day',
  components: { DayScreen },
  provide() { return { day: this }; },
  data() {
    return {
      PANELS: markRaw(PANELS),
      view: null,
      loading: false,
      inflight: false,
      loadError: '',
      tab: 'alarms',
      now: Date.now(),
      saving: {},     // area -> true while a save is open
      failed: {},     // area -> true after a failed save
      busy: '',       // command being sent
      timer: null,
      ticker: null,
    };
  },
  computed: {
    deviceId() { return deviceIdFrom(this.$route); },
    lang() { return this.$i18n.locale; },
    minute() { const d = new Date(this.now); return d.getHours() * 60 + d.getMinutes(); },
    look() { return (this.view && this.view.settings && this.view.settings.look) || null; },
    routine() { return normalizeRoutine(this.view && this.view.settings && this.view.settings.routine); },
    nowActivity() {
      const s = this.view && this.view.stats;
      if (s && ACTIVITIES.includes(s.activity)) return s.activity;
      return scheduledActivity(this.routine, this.minute);
    },
    rows() {
      return dayTimeline(this.view, new Date(this.now), (k, p) => this.$t(k, this.nums(p)), this.fmt, this.saving);
    },
    next() { return nextRow(this.rows, this.minute); },
    dateText() {
      const d = new Date(this.now);
      const loc = this.lang === 'bn' ? 'bn-BD' : String(this.lang || 'en').replace('_', '-');
      try { return new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }).format(d); } catch (e) { return ''; }
    },
    counts() {
      const v = this.view || {};
      return { alarms: (v.alarms || []).length, reminders: (v.reminders || []).length, routine: this.routine.items.length };
    },
    tabItems() {
      return TABS.map((key) => ({
        key, label: this.$t(`day.tab.${key}`), icon: TAB_ICON[key], ink: TAB_INK[key] || undefined,
        count: this.counts[key] !== undefined ? this.num(this.counts[key]) : undefined,
      }));
    },
    tabLabel() { return this.$t(`day.tab.${this.tab}`); },
    /** One line per area for the desktop index: what is set, in a few words. */
    index() {
      const v = this.view || {};
      const s = v.settings || {};
      const p = v.prayer || {};
      const pm = v.pomodoro || {};
      const night = s.night || {};
      const alarms = v.alarms || [];
      const off = this.$t('day.row.off');
      const text = {
        alarms: this.$t('day.index.alarms', { n: this.num(alarms.length), on: this.num(alarms.filter((a) => a.enabled).length) }),
        reminders: this.$t('day.index.reminders', { n: this.num((v.reminders || []).length) }),
        prayer: p.enabled ? (p.city || this.$t('day.row.willRemind')) : off,
        routine: this.routine.enabled ? this.$t('day.index.routine', { n: this.num(this.routine.items.length) }) : off,
        focus: this.$t('day.index.focus', { work: this.num(pm.work_min || 0), rounds: this.num(pm.rounds || 0) }),
        night: night.enabled ? this.$t('day.index.night', { from: this.fmt(night.start), to: this.fmt(night.end) }) : off,
      };
      return TABS.map((key) => ({ key, icon: TAB_ICON[key], ink: TAB_INK[key], text: text[key] }));
    },
  },
  watch: {
    deviceId() { this.view = null; this.refresh(false); },
    '$route.query.focus'(key) { if (key && this.view) this.openKey(key); },
  },
  mounted() {
    loadRobots();
    if (this.deviceId) this.refresh(false);
    this.timer = setInterval(() => { if (!document.hidden) this.refresh(true); }, REFRESH_MS);
    this.ticker = setInterval(() => { this.now = Date.now(); }, 30000);
    document.addEventListener('visibilitychange', this.onVisible);
  },
  beforeUnmount() {
    clearInterval(this.timer);
    clearInterval(this.ticker);
    document.removeEventListener('visibilitychange', this.onVisible);
  },
  methods: {
    num(n) { return digits(n, this.lang); },
    /** i18n params with their numbers in the reader's numerals. */
    nums(p) {
      const out = {};
      for (const [k, v] of Object.entries(p || {})) out[k] = typeof v === 'number' ? this.num(v) : v;
      return out;
    },
    /** "HH:MM" in the reader's numerals (12-hour figures in Bangla, like the wall calendar). */
    fmt(hhmm) { return timeText(hhmm, this.lang, this.lang === 'bn'); },
    onVisible() { if (!document.hidden && this.deviceId) { this.now = Date.now(); this.refresh(true); } },
    errorText(err) { return (err && err.data && err.data.msg) || this.$t('day.requestFailed'); },

    refresh(silent) {
      if (!this.deviceId || this.inflight) return;
      this.inflight = true;
      if (!silent) this.loading = true;
      const first = !this.view;
      Api.companion.getCompanion(this.deviceId, (res) => {
        this.inflight = false; this.loading = false; this.loadError = '';
        this.apply(res.data.data);
        if (first && this.$route.query.focus) this.openKey(this.$route.query.focus);
      }, (err) => {
        this.inflight = false; this.loading = false;
        // keep showing the last good data on a failed background refresh
        if (!silent || !this.view) this.loadError = this.errorText(err);
      });
    },
    apply(view) {
      if (!view || typeof view !== 'object') return;
      this.view = view;
      this.now = Date.now();
    },

    /**
     * PUT /config with a patch; the answer is the full view. `area` names whose sync state shows
     * it (alarms, reminders, prayer, routine, focus, night, care). Resolves with the new view.
     */
    save(patch, area, okText) {
      return new Promise((resolve, reject) => {
        this.saving = { ...this.saving, [area]: true };
        this.failed = { ...this.failed, [area]: false };
        Api.companion.updateCompanionConfig(this.deviceId, patch, (res) => {
          this.saving = { ...this.saving, [area]: false };
          this.apply(res.data.data);
          const online = !this.view || this.view.online !== false;
          this.$message.success(online ? (okText || this.$t('day.saved')) : this.$t('day.savedOffline'));
          resolve(this.view);
        }, (err) => {
          this.saving = { ...this.saving, [area]: false };
          this.failed = { ...this.failed, [area]: true };
          this.$message.error(this.errorText(err));
          reject(err);
        });
      });
    },
    /** Has the last change of an area reached TinyBot? { state, text } for TbSync. */
    syncOf(area) {
      if (this.saving[area]) return { state: 'pending', text: this.$t('common.sync.pending') };
      if (this.failed[area]) return { state: 'error', text: this.$t('common.sync.error') };
      if (this.view && this.view.online === false) return { state: 'pending', text: this.$t('day.sync.offline') };
      return { state: 'applied', text: this.$t('common.sync.applied') };
    },
    command(type, arg, okText, busyKey) {
      if (this.busy || !this.deviceId) return;
      this.busy = busyKey || type;
      Api.companion.sendCompanionCommand(this.deviceId, type, arg, () => {
        this.busy = '';
        const online = !this.view || this.view.online !== false;
        this.$message.success(online ? (okText || this.$t('day.sent')) : this.$t('day.sentOffline'));
      }, (err) => {
        this.busy = '';
        this.$message.error(this.errorText(err));
      });
    },

    /** 'auto' when the viewer asks for reduced motion: an explicit 'smooth' would override base.css. */
    scrollBehavior() {
      const reduce = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      return reduce ? 'auto' : 'smooth';
    },
    goTab(key) {
      this.tab = key;
      this.$nextTick(() => { const el = this.$refs.tabs; if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: this.scrollBehavior() }); });
    },
    /** Opens a row of the day (?focus=<key> or a tap on the table): its tab, scrolled and opened. */
    openKey(key) {
      const tab = tabOfKey(key);
      if (!tab) return;
      this.tab = tab;
      this.$nextTick(() => {
        const panel = this.$refs.current;
        const found = panel && panel.focusKey ? panel.focusKey(key) : false;
        if (!found && this.$refs.tabs && this.$refs.tabs.scrollIntoView) this.$refs.tabs.scrollIntoView({ block: 'start', behavior: this.scrollBehavior() });
      });
    },
    /** Scrolls a panel row into view and marks it for a moment. */
    reveal(el) {
      if (!el) return;
      if (el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: this.scrollBehavior() });
      el.classList.add('is-focus');
      setTimeout(() => el.classList.remove('is-focus'), 1600);
    },
  },
};
</script>

<style>
.day { padding-bottom: var(--tb-s10); }
.day__none, .day__state { padding: var(--tb-s10) 0; display: grid; justify-items: center; }
.day__offline { margin-top: var(--tb-s3); padding: 10px 0; border-bottom: 1px dashed var(--tb-rule-soft); color: var(--tb-ink-2); font-size: var(--tb-fs-14); }
.day__top { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0 var(--tb-s8); padding-top: var(--tb-s3); }
.day__almanac { order: 2; }
.day__almanachead { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 10px 0 8px; }
.day__almanachead h2 { font-size: var(--tb-fs-20); }
.day__date { font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.day__fail { display: flex; align-items: center; gap: 8px; color: var(--tb-danger); font-size: var(--tb-fs-14); padding-top: 8px; }
.day__nowbox { order: 1; display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 14px; align-items: center; padding: 10px 0 12px; border-bottom: 1px solid var(--tb-rule); }
.day__screen { width: 100%; }
.day__nowlist { margin: 0; display: grid; gap: 4px; min-width: 0; }
.day__nowlist div { display: flex; gap: 10px; align-items: baseline; min-width: 0; }
.day__nowlist dt { flex: none; width: 3.6em; font-size: var(--tb-fs-12); font-weight: 600; color: var(--tb-ink-2); }
.day__nowlist div:first-child dt { color: var(--tb-action); }
.day__nowlist dd { margin: 0; min-width: 0; font-weight: 600; overflow-wrap: anywhere; }
.day__tabs { margin-top: var(--tb-s8); scroll-margin-top: 64px; }
.day__panel { min-height: 240px; }
/* a row opened from Today or the table: marked for a moment */
.day .is-focus { background: color-mix(in srgb, var(--tb-orange) 12%, transparent); transition: background-color var(--tb-t-day) var(--tb-ease); }

.day__index { display: none; }
.day__indexrow {
  --ink: var(--tb-ink);
  display: flex; align-items: center; gap: 12px; width: 100%; min-height: 52px; padding: 6px 0;
  border: 0; border-bottom: 1px solid var(--tb-rule-soft); background: none; color: inherit; text-align: left;
  transition: background-color var(--tb-t-hover) var(--tb-ease);
}
.day__indexrow > .tb-icon:first-child { color: var(--ink); flex: none; }
.day__indexrow span { flex: 1; min-width: 0; display: grid; }
.day__indexrow b { font-weight: 600; }
.day__indexrow small { font-size: var(--tb-fs-12); color: var(--tb-ink-2); }
@media (hover: hover) and (pointer: fine) { .day__indexrow:hover { background: var(--tb-paper-2); } }
@media (min-width: 1000px) {
  .day__index { display: grid; margin-top: var(--tb-s5); border-top: var(--tb-rule-band) solid var(--tb-rule); }
  .day__nowbox { position: sticky; top: 16px; }
  .day__top { grid-template-columns: minmax(0, 1fr) 280px; align-items: start; }
  .day__almanac { order: 1; }
  .day__nowbox { order: 2; grid-template-columns: minmax(0, 1fr); align-items: start; gap: 12px; margin-top: 46px; padding-top: 0; border-bottom: 0; }
  .day__nowlist { padding-top: 10px; border-top: var(--tb-rule-band) solid var(--tb-rule); }
}
</style>
