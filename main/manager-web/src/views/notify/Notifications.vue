<template>
  <div class="nt">
    <TbPageHeader :title="$t('notify.title')" :description="$t('notify.lede')">
      <template #actions>
        <TbButton size="s" variant="quiet" icon="check" :disabled="!unread || markingAll" :loading="markingAll" @click="markAll">{{ $t('notify.markAll') }}</TbButton>
      </template>
    </TbPageHeader>

    <div class="nt__bar">
      <TbChoice v-model="filter" :options="[{ value: 'all', label: $t('notify.filterAll') }, { value: 'unread', label: unreadLabel }]"
        :aria-label="$t('notify.filterLabel')" @change="reload" />
    </div>

    <section class="nt__list" :aria-label="$t('notify.listLabel')" :aria-busy="loading ? 'true' : 'false'">
      <div v-if="loading && !list.length" class="nt__state"><TbLoading :label="$t('common.loading')" show-label /></div>
      <div v-else-if="failed && !list.length" class="nt__state" role="alert">
        <p>{{ $t('notify.loadFailed') }}</p>
        <TbButton size="s" icon="refresh" @click="reload">{{ $t('common.retry') }}</TbButton>
      </div>
      <TbEmpty v-else-if="!list.length && filter === 'unread'" :title="$t('notify.noUnreadTitle')" :text="$t('notify.noUnreadText')">
        <TbButton @click="filter = 'all'; reload()">{{ $t('notify.showAll') }}</TbButton>
      </TbEmpty>
      <TbEmpty v-else-if="!list.length" face="awake" :title="$t('notify.emptyTitle')" :text="$t('notify.emptyText')" />

      <template v-else>
        <div v-for="b in buckets" :key="b.key" class="nt__day">
          <h2 class="nt__dayhead">{{ $t(`notify.bucket.${b.key}`) }}</h2>
          <ul>
            <li v-for="n in b.items" :key="n.id">
              <button type="button" class="nt__row" :class="{ 'is-unread': !n.read }" :style="{ '--ink': `var(--tb-${inkOf(groupOf(n))})` }"
                @click="open(n)">
                <i class="nt__mark" aria-hidden="true"></i>
                <span class="nt__text">
                  <b>{{ textOf(n, lang).title }}</b>
                  <span v-if="textOf(n, lang).body">{{ textOf(n, lang).body }}</span>
                  <small><template v-if="n.robotName">{{ n.robotName }} · </template>{{ ago(n.createdAt) }}</small>
                </span>
                <span v-if="!n.read" class="nt__new">{{ $t('notify.new') }}</span>
                <TbIcon v-if="linkOf(n)" name="chevron-right" :size="16" />
              </button>
            </li>
          </ul>
        </div>
        <div v-if="list.length < total" class="nt__more">
          <TbButton size="s" :loading="loading" @click="more">{{ $t('notify.more') }}</TbButton>
        </div>
      </template>
    </section>

    <TbSection :title="$t('notify.settingsTitle')" :description="$t('notify.settingsLede')">
      <template #actions><TbSync v-bind="prefsSync" /></template>
      <div v-if="!form" class="nt__state"><TbLoading v-if="!prefsFailed" :label="$t('common.loading')" />
        <TbButton v-else size="s" icon="refresh" @click="loadPrefs">{{ $t('common.retry') }}</TbButton></div>
      <template v-else>
        <div v-for="g in GROUPS" :key="g" class="nt-set">
          <span class="nt-set__text"><span>{{ $t(`notify.group.${g}`) }}</span><small>{{ $t(`notify.groupLine.${g}`) }}</small></span>
          <TbSwitch v-model="form.types[g]" :aria-label="$t(`notify.group.${g}`)" />
        </div>
        <div class="nt-set">
          <span class="nt-set__text"><span>{{ $t('notify.offlineAfter') }}</span><small>{{ $t('notify.offlineAfterLine') }}</small></span>
          <TbSelect v-model="form.offlineMinutes" class="nt__min" :disabled="!form.types.offline" :aria-label="$t('notify.offlineAfter')"
            :options="OFFLINE_CHOICES.map((m) => ({ value: m, label: minutesText(m) }))" />
        </div>
        <div class="nt-set">
          <span class="nt-set__text"><span>{{ $t('notify.summaryPush') }}</span><small>{{ $t('notify.summaryPushLine') }}</small></span>
          <TbSwitch v-model="form.summaryPush" :disabled="!form.types.summary" :aria-label="$t('notify.summaryPush')" />
        </div>
        <footer class="nt-foot">
          <span v-if="prefsDirty" class="nt-foot__unsaved">{{ $t('common.unsaved') }}</span>
          <TbButton variant="primary" :disabled="!prefsDirty" :loading="savingPrefs" @click="savePrefs">{{ $t('common.save') }}</TbButton>
        </footer>
      </template>
    </TbSection>

    <TbSection :title="$t('notify.pushTitle')" :description="$t('notify.pushLede')">
      <p class="nt__push" role="status"><i :class="`is-${pushState}`" aria-hidden="true"></i>{{ $t(`notify.push.${pushState}`) }}</p>
      <div class="nt__pushact">
        <TbButton v-if="pushState === 'off' || pushState === 'blocked_soft'" icon="bell" :loading="pushBusy" @click="turnOn">{{ $t('notify.pushOn') }}</TbButton>
        <template v-if="pushState === 'on'">
          <TbButton icon="send" :loading="testing" @click="test">{{ $t('notify.pushTest') }}</TbButton>
          <TbButton variant="quiet" :loading="pushBusy" @click="turnOff">{{ $t('notify.pushOff') }}</TbButton>
        </template>
      </div>
      <p class="nt-note">{{ $t('notify.pushNote') }}</p>
    </TbSection>
  </div>
</template>

<script>
import Api from '@/apis/api';
import { digits } from '@/kit/calendar';
import { inbox } from '@/shell/inbox';
import { ageOf } from '@/utils/companion.mjs';
import { currentSubscription, disablePush, enablePush, permissionState, pushSupport, sendLanguage } from '@/utils/webPush';
import { GROUPS, OFFLINE_CHOICES, bucketed, groupOf, inkOf, linkOf, mergeList, prefsForm, textOf } from './notifyModel';

const PAGE = 20;

// Notifications (নোটিফিকেশন): what happened with the robots this account owns or shares, newest
// first; opening one marks it read. Below: which kinds should notify, and push to this browser.
export default {
  name: 'Notifications',
  data() {
    return {
      GROUPS, OFFLINE_CHOICES,
      list: [], total: 0, unread: 0, page: 1, filter: 'all', loading: false, failed: false, markingAll: false,
      form: null, baseline: '', prefsFailed: false, savingPrefs: false, prefsError: false,
      pushState: 'checking', pushBusy: false, testing: false, now: Date.now(),
    };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    buckets() { return bucketed(this.list, this.now); },
    unreadLabel() { return this.unread ? `${this.$t('notify.filterUnread')} (${digits(this.unread, this.lang)})` : this.$t('notify.filterUnread'); },
    prefsDirty() { return !!this.form && JSON.stringify(this.form) !== this.baseline; },
    prefsSync() {
      if (this.savingPrefs) return { state: 'pending', text: this.$t('common.sync.pending') };
      if (this.prefsError) return { state: 'error', text: this.$t('common.sync.error') };
      return { state: 'applied', text: this.$t('notify.savedWord') };
    },
  },
  watch: { lang(l) { sendLanguage(l); } },
  mounted() { this.reload(); this.loadPrefs(); this.checkPush(); },
  methods: {
    groupOf, inkOf, linkOf, textOf,
    ago(ms) {
      const a = ageOf(Math.floor((Number(ms) || 0) / 1000), this.now);
      if (a.unit === 'justNow' || a.unit === 'never') return this.$t('companion.justNow');
      if (a.unit === 'days' && a.value > 6) {
        return new Intl.DateTimeFormat(this.lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date(Number(ms)));
      }
      return this.$t(`companion.ago.${a.unit}`, { n: digits(a.value, this.lang) });
    },
    minutesText(m) { return m >= 60 ? this.$t('notify.hours', { n: digits(m / 60, this.lang) }) : this.$t('notify.minutes', { n: digits(m, this.lang) }); },
    fetch(page) {
      this.loading = true; this.failed = false;
      Api.notify.getList({ page, limit: PAGE, unread: this.filter === 'unread' }, (res) => {
        this.loading = false; this.now = Date.now();
        const d = (res && res.data && res.data.data) || {};
        this.list = page === 1 ? mergeList([], d.list) : mergeList(this.list, d.list);
        this.total = Number(d.total) || this.list.length;
        this.unread = Number(d.unread) || 0;
        inbox.unread = this.unread;
        this.page = page;
      }, () => { this.loading = false; this.failed = true; });
    },
    reload() { this.fetch(1); },
    more() { this.fetch(this.page + 1); },
    open(n) {
      if (!n.read) {
        n.read = true;
        this.unread = Math.max(0, this.unread - 1);
        inbox.unread = this.unread;
        Api.notify.markRead(n.id, () => {}, () => { n.read = false; this.unread += 1; inbox.unread = this.unread; });
      }
      const to = linkOf(n);
      if (to) this.$router.push(n.deviceId ? { path: to.split('?')[0], query: { ...Object.fromEntries(new URLSearchParams(to.split('?')[1] || '')), deviceId: n.deviceId } } : to);
    },
    markAll() {
      this.markingAll = true;
      Api.notify.markAllRead(() => {
        this.markingAll = false;
        this.list.forEach((n) => { n.read = true; });
        this.unread = 0; inbox.unread = 0;
        if (this.filter === 'unread') this.reload();
      }, () => { this.markingAll = false; this.$message.error(this.$t('notify.failed')); });
    },

    loadPrefs() {
      this.prefsFailed = false;
      Api.notify.getPrefs((res) => {
        this.form = prefsForm(res && res.data && res.data.data);
        this.baseline = JSON.stringify(this.form);
      }, () => { this.prefsFailed = true; });
    },
    savePrefs() {
      this.savingPrefs = true; this.prefsError = false;
      Api.notify.savePrefs({ ...this.form, types: { ...this.form.types } }, (res) => {
        this.savingPrefs = false;
        const data = res && res.data && res.data.data;
        if (data) this.form = prefsForm(data);
        this.baseline = JSON.stringify(this.form);
        this.$message.success(this.$t('notify.saved'));
      }, () => { this.savingPrefs = false; this.prefsError = true; this.$message.error(this.$t('notify.failed')); });
    },

    async checkPush() {
      const support = pushSupport();
      if (support !== 'ok') { this.pushState = support; return; }
      if (permissionState() === 'denied') { this.pushState = 'denied'; return; }
      this.pushState = (await currentSubscription()) ? 'on' : 'off';
    },
    async turnOn() {
      this.pushBusy = true;
      const r = await enablePush(this.lang);
      this.pushBusy = false;
      if (r.ok) { this.pushState = 'on'; this.$message.success(this.$t('notify.pushDone')); return; }
      if (r.reason === 'denied') this.pushState = 'denied';
      else if (r.reason === 'unsupported' || r.reason === 'insecure') this.pushState = r.reason;
      this.$message.error(this.$t(`notify.pushErr.${r.reason}`));
    },
    async turnOff() {
      this.pushBusy = true;
      await disablePush();
      this.pushBusy = false;
      this.pushState = 'off';
    },
    test() {
      this.testing = true;
      Api.notify.sendTest(() => {
        this.testing = false;
        this.$message.success(this.$t('notify.testSent'));
        setTimeout(this.reload, 800);
      }, () => { this.testing = false; this.$message.error(this.$t('notify.failed')); });
    },
  },
};
</script>

<style>
.nt { padding-bottom: var(--tb-s10); }
.nt__bar { padding: var(--tb-s4) 0 var(--tb-s2); }
.nt__state { padding: var(--tb-s8) 0; display: grid; justify-items: center; gap: var(--tb-s3); color: var(--tb-ink-2); }
.nt__list { padding-bottom: var(--tb-s4); }
.nt__day ul { list-style: none; margin: 0; padding: 0; }
.nt__dayhead { font-family: var(--tb-font-display); font-weight: 700; font-size: var(--tb-fs-16); padding: var(--tb-s4) 0 8px;
  border-bottom: 1px solid var(--tb-rule); }
.nt__row {
  --ink: var(--tb-ink-2);
  display: grid; grid-template-columns: 8px minmax(0, 1fr) auto auto; gap: 12px; align-items: start; width: 100%; padding: 12px 0;
  border: 0; border-bottom: 1px solid var(--tb-rule-soft); background: none; text-align: left; color: var(--tb-ink-2);
  transition: background-color var(--tb-t-hover) var(--tb-ease);
}
.nt__row:hover { background: var(--tb-paper-2); }
.nt__mark { width: 8px; height: 8px; margin-top: 8px; background: var(--ink); }
.nt__text { display: grid; gap: 2px; min-width: 0; }
.nt__text b { font-weight: 600; color: var(--tb-ink-2); overflow-wrap: anywhere; }
.nt__text span { font-size: var(--tb-fs-14); max-width: 70ch; overflow-wrap: anywhere; }
.nt__text small { font-size: var(--tb-fs-12); color: var(--tb-ink-3); }
.nt__row.is-unread b { font-weight: 700; color: var(--tb-ink); }
.nt__row.is-unread .nt__text span { color: var(--tb-ink); }
.nt__new { font-size: var(--tb-fs-12); font-weight: 700; color: var(--tb-ink); padding-top: 3px; }
.nt__row .tb-icon { margin-top: 4px; color: var(--tb-ink-3); }
.nt__more { display: grid; justify-items: center; padding: var(--tb-s4) 0; }
.nt__min { width: 160px; flex: none; }
.nt-set { display: flex; align-items: center; justify-content: space-between; gap: var(--tb-s4); min-height: 56px; padding: 6px 0;
  border-bottom: 1px solid var(--tb-rule-soft); }
.nt-set__text { display: grid; gap: 2px; min-width: 0; }
.nt-set__text small { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.nt-foot { display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex-wrap: wrap; padding-top: var(--tb-s3); }
.nt-foot__unsaved { font-size: var(--tb-fs-13); color: var(--tb-ink-2); margin-right: auto; }
.nt-note { font-size: var(--tb-fs-13); color: var(--tb-ink-2); max-width: 70ch; }
.nt__push { display: flex; align-items: flex-start; gap: 8px; padding: var(--tb-s2) 0; font-weight: 500; max-width: 70ch; }
.nt__push i { flex: none; margin-top: 7px; width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid var(--tb-ink-3); }
.nt__push i.is-on { background: var(--tb-ok); border-color: var(--tb-ok); }
.nt__push i.is-denied, .nt__push i.is-insecure { background: var(--tb-warn); border-color: var(--tb-warn); }
.nt__pushact { display: flex; gap: 8px; flex-wrap: wrap; padding: var(--tb-s2) 0; }
@media (max-width: 640px) { .nt__min { width: 130px; } }
</style>
