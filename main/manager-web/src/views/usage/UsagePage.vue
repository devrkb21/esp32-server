<template>
  <div class="us">
    <TbPageHeader :title="$t('nav.usage')" :description="$t('usage.lead')">
      <template #actions>
        <TbButton icon="refresh" :loading="loading && !!summary" :disabled="loading" @click="fetch">{{ $t('usage.refresh') }}</TbButton>
      </template>
    </TbPageHeader>

    <div class="us__filter">
      <TbChoice v-model="days" :options="rangeOptions" :aria-label="$t('usage.range')" @change="fetch" />
      <span v-if="summary" class="us__span tb-num">{{ $t('usage.span', { from: dayLabel(summary.from), to: dayLabel(summary.to) }) }}</span>
    </div>

    <div v-if="loading && !summary" class="us__state"><TbLoading :label="$t('common.loading')" show-label /></div>
    <div v-else-if="failed && !summary" class="us__state">
      <TbEmpty face="confused" :title="$t('usage.loadFailed')" :text="$t('common.loadFailed')">
        <TbButton icon="refresh" @click="fetch">{{ $t('common.retry') }}</TbButton>
      </TbEmpty>
    </div>

    <template v-else-if="summary">
      <p v-if="failed" class="us__fail" role="alert">{{ $t('common.loadFailed') }}
        <TbButton size="s" variant="quiet" icon="refresh" @click="fetch">{{ $t('common.retry') }}</TbButton></p>

      <!-- The range in big numbers -->
      <dl class="us-totals" :aria-label="$t('usage.totals')">
        <div class="us-totals__cell">
          <dt>{{ $t('usage.t.requests') }}</dt>
          <dd class="tb-num">{{ compact(totals.llmRequests) }}</dd>
        </div>
        <div class="us-totals__cell">
          <dt>{{ $t('usage.t.tokens') }}</dt>
          <dd class="tb-num">{{ compact(totals.tokens) }}</dd>
        </div>
        <div class="us-totals__cell">
          <dt>{{ $t('usage.t.asr') }}</dt>
          <dd class="tb-num">{{ minutes(totals.asrSeconds) }}</dd>
        </div>
        <div class="us-totals__cell">
          <dt>{{ $t('usage.t.tts') }}</dt>
          <dd class="tb-num">{{ compact(totals.ttsChars) }}</dd>
        </div>
        <div class="us-totals__cell is-cost">
          <dt>{{ $t('usage.t.cost') }}</dt>
          <dd class="tb-num">{{ money(totals.cost) || $t('usage.noPrice') }}</dd>
        </div>
      </dl>

      <ul class="us-facts">
        <li>
          <TbIcon name="params" :size="18" />
          <span v-if="summary.dailyLimit > 0">{{ $t('usage.limitOn', { n: count(summary.dailyLimit) }) }}</span>
          <span v-else>{{ $t('usage.limitOff') }}</span>
          <span v-if="totals.quotaBlocked" class="us-facts__warn tb-num">{{ $t('usage.blocked', { n: count(totals.quotaBlocked) }) }}</span>
        </li>
        <li v-if="!summary.priced">
          <TbIcon name="info" :size="18" />
          <span>{{ $t('usage.pricesHint') }}</span>
        </li>
        <li class="us-facts__act">
          <TbButton size="s" variant="quiet" icon="params" to="/params-management">{{ $t('usage.editParams') }}</TbButton>
        </li>
      </ul>

      <TbEmpty v-if="!hasUsage(summary)" face="sleepy" :title="$t('usage.emptyTitle')" :text="$t('usage.emptyText')" />

      <template v-else>
        <TbSection :title="$t('usage.days.title')" :description="$t('usage.days.desc')">
          <TbTable dense row-key="date" :columns="dayColumns" :rows="summary.days" :caption="$t('usage.days.title')">
            <template #cell-date="{ row }"><span class="tb-num">{{ dayLabel(row.date) }}</span></template>
            <template #cell-llmRequests="{ row }">
              <span class="us-bar">
                <i class="us-bar__fill" :style="{ width: `${barPct(row.llmRequests, maxRequests)}%` }" aria-hidden="true"></i>
                <span class="tb-num">{{ count(row.llmRequests) }}</span>
              </span>
            </template>
          </TbTable>
        </TbSection>

        <TbSection :title="$t('usage.models.title')" :description="$t('usage.models.desc')">
          <TbTable dense :columns="modelColumns" :rows="summary.models" :caption="$t('usage.models.title')"
            :empty-text="$t('usage.none')">
            <template #cell-modelName="{ row }">
              <span class="us-name"><b>{{ row.modelName }}</b><small>{{ row.modelId }}</small></span>
            </template>
            <template #cell-modelType="{ row }"><TbTag>{{ row.modelType }}</TbTag></template>
            <template #cell-work="{ row }"><span class="tb-num">{{ workText(row) }}</span></template>
          </TbTable>
        </TbSection>

        <TbSection :title="$t('usage.users.title')" :description="$t('usage.users.desc')">
          <TbTable dense :columns="userColumns" :rows="summary.users" :caption="$t('usage.users.title')"
            :empty-text="$t('usage.none')">
            <template #cell-username="{ row }">
              <span class="us-name"><b>{{ row.username || $t('usage.noOwner') }}</b></span>
            </template>
          </TbTable>
        </TbSection>

        <TbSection :title="$t('usage.robots.title')" :description="$t('usage.robots.desc')">
          <TbTable dense row-key="macAddress" :columns="robotColumns" :rows="summary.robots" :caption="$t('usage.robots.title')"
            :empty-text="$t('usage.none')">
            <template #cell-robot="{ row, index }">
              <span class="us-rank"><span class="us-rank__n tb-num" aria-hidden="true">{{ count(index + 1) }}</span>
                <span class="us-name"><b>{{ robotName(row) }}</b><small v-if="row.alias">{{ row.macAddress }}</small></span></span>
            </template>
          </TbTable>
        </TbSection>
      </template>
    </template>
  </div>
</template>

<script>
import aiApi from '@/apis/module/ai';
import {
  RANGES, barPct, compact, count, dayText, hasUsage, maxOf, minutes, money, rangeFor, robotName,
} from './usageModel';

// Usage and cost (back office, super admins): what the robots used in a day range: LLM requests
// and tokens, seconds of speech recognition, characters of speech synthesis, by day, model, owner
// and robot, with a cost estimate from the optional prices per 1K tokens (sys params). The daily
// limit per owner and the prices are edited on the params page.
// API: ai.getUsageSummary({ from, to }).
export default {
  name: 'UsagePage',
  data() {
    return { days: 7, summary: null, loading: false, failed: false, seq: 0 };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    totals() { return (this.summary && this.summary.totals) || {}; },
    currency() { return (this.summary && this.summary.currency) || ''; },
    maxRequests() { return maxOf(this.summary && this.summary.days, 'llmRequests'); },
    rangeOptions() {
      return RANGES.map((n) => ({ value: n, label: this.$t('usage.lastDays', { n: count(n, this.lang) }) }));
    },
    dayColumns() {
      return [
        { key: 'date', label: this.$t('usage.col.day'), width: '150px' },
        { key: 'llmRequests', label: this.$t('usage.col.requests'), full: true },
        { key: 'tokens', label: this.$t('usage.col.tokens'), align: 'right', format: (v) => this.count(v) },
        { key: 'asrSeconds', label: this.$t('usage.col.asr'), align: 'right', format: (v) => this.minutes(v) },
        { key: 'ttsChars', label: this.$t('usage.col.tts'), align: 'right', format: (v) => this.count(v) },
        { key: 'cost', label: this.$t('usage.col.cost'), align: 'right', format: (v) => this.money(v) || '–' },
      ];
    },
    modelColumns() {
      return [
        { key: 'modelName', label: this.$t('usage.col.model'), full: true },
        { key: 'modelType', label: this.$t('usage.col.type'), width: '80px' },
        { key: 'work', label: this.$t('usage.col.work'), align: 'right' },
        { key: 'tokens', label: this.$t('usage.col.tokens'), align: 'right', format: (v) => this.count(v) },
        { key: 'pricePer1k', label: this.$t('usage.col.price'), align: 'right', format: (v) => this.money(v) || '–' },
        { key: 'cost', label: this.$t('usage.col.cost'), align: 'right', format: (v) => this.money(v) || '–' },
      ];
    },
    userColumns() {
      return [
        { key: 'username', label: this.$t('usage.col.owner'), full: true },
        { key: 'robots', label: this.$t('usage.col.robots'), align: 'right', format: (v) => this.count(v) },
        { key: 'llmRequests', label: this.$t('usage.col.requests'), align: 'right', format: (v) => this.count(v) },
        { key: 'tokens', label: this.$t('usage.col.tokens'), align: 'right', format: (v) => this.count(v) },
        { key: 'quotaBlocked', label: this.$t('usage.col.blocked'), align: 'right', format: (v) => this.count(v) },
        { key: 'cost', label: this.$t('usage.col.cost'), align: 'right', format: (v) => this.money(v) || '–' },
      ];
    },
    robotColumns() {
      return [
        { key: 'robot', label: this.$t('usage.col.robot'), full: true },
        { key: 'username', label: this.$t('usage.col.owner'), format: (v) => v || this.$t('usage.noOwner') },
        { key: 'llmRequests', label: this.$t('usage.col.requests'), align: 'right', format: (v) => this.count(v) },
        { key: 'tokens', label: this.$t('usage.col.tokens'), align: 'right', format: (v) => this.count(v) },
        { key: 'asrSeconds', label: this.$t('usage.col.asr'), align: 'right', format: (v) => this.minutes(v) },
        { key: 'ttsChars', label: this.$t('usage.col.tts'), align: 'right', format: (v) => this.count(v) },
        { key: 'cost', label: this.$t('usage.col.cost'), align: 'right', format: (v) => this.money(v) || '–' },
      ];
    },
  },
  created() { this.fetch(); },
  methods: {
    hasUsage,
    barPct,
    robotName,
    count(n) { return count(n, this.lang); },
    compact(n) { return compact(n, this.lang); },
    minutes(s) { return minutes(s, this.lang); },
    money(v) { return money(v, this.currency, this.lang); },
    dayLabel(d) { return dayText(d, this.lang); },
    workText(row) {
      if (row.modelType === 'ASR') return this.$t('usage.work.asr', { n: this.minutes(row.asrSeconds) });
      if (row.modelType === 'TTS') return this.$t('usage.work.tts', { n: this.count(row.ttsChars) });
      return this.$t('usage.work.llm', { n: this.count(row.llmRequests) });
    },
    fetch() {
      const seq = ++this.seq;
      this.loading = true;
      this.failed = false;
      aiApi.getUsageSummary(rangeFor(this.days), ({ data }) => {
        if (seq !== this.seq) return;
        this.loading = false;
        if (data && data.code === 0 && data.data) this.summary = data.data;
        else this.failed = true;
      }, (res) => {
        if (seq !== this.seq) return;
        this.loading = false;
        this.failed = true;
        const msg = res && res.data && res.data.msg;
        if (msg) this.$message.error(msg);
      });
    },
  },
};
</script>

<style>
.us__filter { display: flex; align-items: center; gap: var(--tb-s3) var(--tb-s4); flex-wrap: wrap; padding: var(--tb-s4) 0; border-bottom: 1px solid var(--tb-rule-soft); }
.us__span { color: var(--tb-ink-2); font-size: var(--tb-fs-14); }
.us__state { padding: var(--tb-s10) 0; display: grid; justify-items: center; }
.us__fail { display: flex; align-items: center; gap: 8px; color: var(--tb-danger); padding-top: var(--tb-s3); }

.us-totals { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); margin: 0; border-bottom: 1px solid var(--tb-rule); }
.us-totals__cell { display: grid; gap: 2px; align-content: start; padding: var(--tb-s5) var(--tb-s4) var(--tb-s4); border-left: 1px solid var(--tb-rule-soft); min-width: 0; }
.us-totals__cell:first-child { border-left: 0; padding-left: 0; }
.us-totals dt { font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.us-totals dd { margin: 0; font-family: var(--tb-font-display); font-weight: 800; font-size: clamp(var(--tb-fs-24), 3.4vw, var(--tb-fs-48));
  line-height: var(--tb-lh-tight); letter-spacing: -.02em; overflow-wrap: anywhere; }
.us-totals__cell.is-cost dd { color: var(--tb-action); }

.us-facts { list-style: none; margin: 0; padding: var(--tb-s3) 0; display: flex; flex-wrap: wrap; align-items: center; gap: var(--tb-s2) var(--tb-s5);
  font-size: var(--tb-fs-14); color: var(--tb-ink-2); border-bottom: 1px solid var(--tb-rule-soft); }
.us-facts li { display: inline-flex; align-items: center; gap: 8px; }
.us-facts__warn { color: var(--tb-alarm); font-weight: 600; }
.us-facts__act { margin-left: auto; }

.us-bar { display: flex; align-items: center; gap: 10px; min-width: 0; }
.us-bar__fill { display: block; height: 8px; background: var(--tb-orange); flex: 0 0 auto; max-width: calc(100% - 64px);
  transition: width var(--tb-t-row) var(--tb-ease); }
.us-name { display: grid; gap: 2px; min-width: 0; }
.us-name b { font-weight: 600; overflow-wrap: anywhere; }
.us-name small { color: var(--tb-ink-3); font-size: var(--tb-fs-12); overflow-wrap: anywhere; }
.us-rank { display: grid; grid-template-columns: 28px 1fr; align-items: baseline; min-width: 0; }
.us-rank__n { font-family: var(--tb-font-display); font-weight: 800; color: var(--tb-ink-3); }

@media (max-width: 900px) {
  .us-totals { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .us-totals__cell { border-left: 0; padding-left: 0; border-top: 1px solid var(--tb-rule-soft); }
  .us-totals__cell:nth-child(-n+2) { border-top: 0; }
  .us-totals__cell:nth-child(even) { padding-left: var(--tb-s4); border-left: 1px solid var(--tb-rule-soft); }
  .us-totals__cell.is-cost { grid-column: 1 / -1; border-left: 0; padding-left: 0; }
  .us-facts__act { margin-left: 0; }
}
</style>
