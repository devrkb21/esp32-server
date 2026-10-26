<template>
  <div class="sm">
    <TbPageHeader :title="$t('summary.title')" :description="$t('summary.lede')">
      <template v-if="deviceId" #actions>
        <TbButton size="s" variant="quiet" icon="refresh" :loading="building" @click="buildToday">{{ $t('summary.buildNow') }}</TbButton>
      </template>
    </TbPageHeader>

    <div v-if="!deviceId" class="sm__state">
      <TbEmpty face="confused" :title="$t('common.noRobot')" :text="$t('common.noRobotText')">
        <TbButton variant="primary" to="/robots" icon="robots">{{ $t('common.goRobots') }}</TbButton>
      </TbEmpty>
    </div>
    <div v-else-if="!rows && !failed" class="sm__state"><TbLoading :label="$t('common.loading')" show-label /></div>
    <div v-else-if="!rows" class="sm__state" role="alert">
      <p>{{ $t('summary.loadFailed') }}</p>
      <TbButton size="s" icon="refresh" @click="load">{{ $t('common.retry') }}</TbButton>
    </div>
    <TbEmpty v-else-if="!rows.length" face="sleepy" :title="$t('summary.emptyTitle')" :text="$t('summary.emptyText')">
      <TbButton variant="primary" icon="refresh" :loading="building" @click="buildToday">{{ $t('summary.buildNow') }}</TbButton>
    </TbEmpty>

    <template v-else>
      <TbSection :title="latestTitle">
        <template #actions>
          <TbTag v-if="!latest.final" ink="ink-2">{{ $t('summary.notFinal') }}</TbTag>
        </template>
        <p class="sm__text">{{ summaryText(latest, lang) }}</p>
        <dl class="sm__stats">
          <div><dt>{{ $t('summary.talk') }}</dt><dd class="tb-num">{{ n(latest.talkCount) }}</dd></div>
          <div><dt>{{ $t('summary.focus') }}</dt><dd class="tb-num">{{ n(latest.focusMinutes) }}<small>{{ $t('summary.min') }}</small></dd></div>
          <div><dt>{{ $t('summary.reminders') }}</dt><dd class="tb-num">{{ n(latest.remindersDone) }}<small>/ {{ n((num(latest.remindersDone) || 0) + (num(latest.remindersMissed) || 0)) }}</small></dd></div>
          <div><dt>{{ $t('summary.memories') }}</dt><dd class="tb-num">{{ n(latest.newMemories) }}</dd></div>
        </dl>
      </TbSection>

      <TbSection :title="$t('summary.bondTitle')" :description="$t('summary.bondLede')">
        <SummaryChart kind="line" ink="ink" :points="bondPoints" :lang="lang" :label="$t('summary.bondChart')"
          :hint="$t('summary.chartHint')" :no-data="$t('summary.noData')" :caption="bondCaption" />
      </TbSection>

      <TbSection :title="$t('summary.focusTitle')" :description="$t('summary.focusLede')">
        <SummaryChart kind="bar" ink="focus" :points="focusPoints" :lang="lang" :label="$t('summary.focusChart')"
          :hint="$t('summary.chartHint')" :no-data="$t('summary.noData')" :caption="focusCaption"
          :format="(v) => $t('summary.minutes', { n: n(v) })" />
      </TbSection>

      <TbSection :title="$t('summary.daysTitle')" :description="$t('summary.daysLede', { n: n(rows.length) })">
        <ul class="sm__days">
          <li v-for="r in rows" :key="r.day" class="sm__day">
            <div class="sm__dayhead">
              <b>{{ dayText(r.day) }}</b>
              <TbTag v-if="moodKey(r.mood)">{{ $t(`summary.mood.${moodKey(r.mood)}`) }}</TbTag>
            </div>
            <p class="sm__facts">
              <span>{{ $t('summary.fact.talk', { n: n(r.talkCount) }) }}</span>
              <span>{{ $t('summary.fact.focus', { n: n(r.focusMinutes) }) }}</span>
              <span v-if="num(r.gamesPlayed)">{{ $t('summary.fact.games', { n: n(r.gamesPlayed) }) }}</span>
              <span>{{ $t('summary.fact.reminders', { done: n(r.remindersDone), missed: n(r.remindersMissed) }) }}</span>
              <span v-if="num(r.newMemories)">{{ $t('summary.fact.memories', { n: n(r.newMemories) }) }}</span>
              <span v-if="num(r.bondScore) !== null">{{ $t('summary.fact.bond', { n: n(r.bondScore) }) }}</span>
            </p>
          </li>
        </ul>
      </TbSection>
    </template>
  </div>
</template>

<script>
import Api from '@/apis/api';
import { digits } from '@/kit/calendar';
import { deviceIdFrom, loadRobots } from '@/shell/robot';
import SummaryChart from './SummaryChart.vue';
import { cleanRows, dayAxis, isoDay, moodKey, num, summaryText, totals } from './summaryModel';

// Daily summary (দিনের সারাংশ): the server writes a short Bangla summary of each day at night
// (talk, focus minutes, games, reminders, new memories, mood and bond). Here: the newest day, the
// bond line and the focus bars of the last 30 days, and every day as a ruled row.
export default {
  name: 'Summary',
  components: { SummaryChart },
  data() { return { rows: null, loading: false, failed: false, building: false }; },
  computed: {
    deviceId() { return deviceIdFrom(this.$route); },
    lang() { return this.$i18n.locale; },
    latest() { return (this.rows && this.rows[0]) || null; },
    latestTitle() {
      if (!this.latest) return '';
      return this.latest.day === isoDay(new Date()) ? this.$t('summary.today') : this.dayText(this.latest.day);
    },
    axis() { return dayAxis(this.rows || [], new Date(), 30); },
    bondPoints() { return this.axis.map((a) => ({ day: a.day, date: a.date, value: a.row ? num(a.row.bondScore) : null })); },
    focusPoints() { return this.axis.map((a) => ({ day: a.day, date: a.date, value: a.row ? num(a.row.focusMinutes) : null })); },
    sum() { return totals(this.rows || []); },
    bondCaption() {
      const vals = this.bondPoints.filter((p) => p.value !== null);
      if (!vals.length) return this.$t('summary.noData');
      return this.$t('summary.bondCaption', { from: this.n(vals[0].value), to: this.n(vals[vals.length - 1].value) });
    },
    focusCaption() { return this.$t('summary.focusCaption', { n: this.n(this.sum.focus), days: this.n(this.sum.days) }); },
  },
  watch: { deviceId() { this.rows = null; this.load(); } },
  mounted() { loadRobots(); this.load(); },
  methods: {
    num, moodKey, summaryText,
    n(v) { return digits(num(v) === null ? 0 : num(v), this.lang); },
    dayText(day) {
      const [y, m, d] = String(day).split('-').map(Number);
      return new Intl.DateTimeFormat(this.lang === 'bn' ? 'bn-BD' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(y, m - 1, d));
    },
    load() {
      if (!this.deviceId) return;
      this.loading = true; this.failed = false;
      Api.summary.getSummaries(this.deviceId, 30, (res) => {
        this.loading = false;
        this.rows = cleanRows(res && res.data && res.data.data, 30);
      }, () => { this.loading = false; this.failed = true; });
    },
    buildToday() {
      this.building = true;
      Api.summary.buildToday(this.deviceId, (res) => {
        this.building = false;
        const row = res && res.data && res.data.data;
        if (row && row.day) this.rows = cleanRows([row, ...(this.rows || [])], 30);
        this.$message.success(this.$t('summary.built'));
      }, () => { this.building = false; this.$message.error(this.$t('summary.buildFailed')); });
    },
  },
};
</script>

<style>
.sm { padding-bottom: var(--tb-s10); }
.sm__state { padding: var(--tb-s10) 0; display: grid; justify-items: center; gap: var(--tb-s3); color: var(--tb-ink-2); }
.sm__text { font-size: var(--tb-fs-16); max-width: 70ch; line-height: 1.55; }
.sm__stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: var(--tb-s4) 0 0; border-top: 1px solid var(--tb-rule); }
.sm__stats div { padding: 10px 12px 4px 0; border-right: 1px solid var(--tb-rule-soft); }
.sm__stats div + div { padding-left: 12px; }
.sm__stats div:last-child { border-right: 0; }
.sm__stats dt { font-size: var(--tb-fs-13); color: var(--tb-ink-2); font-weight: 600; }
.sm__stats dd { margin: 2px 0 0; font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-32); line-height: 1.1; }
.sm__stats dd small { font: 600 var(--tb-fs-13) var(--tb-font-text); color: var(--tb-ink-2); margin-left: 4px; }
.sm__days { list-style: none; margin: 0; padding: 0; }
.sm__day { padding: 12px 0; border-bottom: 1px solid var(--tb-rule-soft); display: grid; gap: 4px; }
.sm__dayhead { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.sm__dayhead b { font-family: var(--tb-font-display); font-weight: 700; }
.sm__facts { display: flex; flex-wrap: wrap; gap: 2px 14px; font-size: var(--tb-fs-14); color: var(--tb-ink-2); }
.sm__daytext { font-size: var(--tb-fs-14); max-width: 70ch; }
@media (max-width: 640px) {
  .sm__stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sm__stats div:nth-child(2) { border-right: 0; }
  .sm__stats div:nth-child(3) { padding-left: 0; }
  .sm__stats div:nth-child(n + 3) { border-top: 1px solid var(--tb-rule-soft); }
}
</style>
