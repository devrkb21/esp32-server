<template>
  <div class="params">
    <TbPageHeader :title="$t('system.params.title')" :description="$t('system.params.desc')">
      <template #actions>
        <TbButton icon="refresh" :loading="loading && !!allParams.length" :disabled="loading" @click="fetchParams">
          {{ $t('system.refresh') }}</TbButton>
        <TbButton variant="primary" icon="plus" @click="openAdd">{{ $t('system.params.add') }}</TbButton>
      </template>
    </TbPageHeader>

    <div class="sys-filter">
      <form class="sys-filter__search" role="search" @submit.prevent>
        <TbInput v-model="query" icon="search" clearable :placeholder="$t('system.params.searchPlaceholder')"
          :aria-label="$t('system.params.searchLabel')" :clear-label="$t('system.clearSearch')" :maxlength="120" />
      </form>
      <TbChoice v-if="allParams.length" class="params__groups" wrap :model-value="activeTop" :options="topOptions"
        :aria-label="$t('system.params.groupsLabel')" @update:model-value="selectTop" />
      <TbChoice v-if="subOptions.length" class="params__groups params__groups--sub" wrap :model-value="activeSub"
        :options="subOptions" :aria-label="$t('system.params.subgroupsLabel')" @update:model-value="selectSub" />
    </div>

    <div v-if="allParams.length" class="sys-bar" role="toolbar" :aria-label="$t('system.batchLabel')">
      <TbCheckbox :model-value="allSelected" :indeterminate="selectedRows.length > 0 && !allSelected" :disabled="!filtered.length"
        @update:model-value="toggleAll">{{ selectedRows.length ? $t('system.selected', { n: num(selectedRows.length) }) : $t('system.selectAll') }}</TbCheckbox>
      <span class="sys-bar__meta tb-num">{{ $t('system.params.total', { n: num(filtered.length) }) }}</span>
      <TbButton class="sys-bar__end" size="s" variant="danger" icon="trash" :disabled="!selectedRows.length || deleting"
        :loading="deleting" @click="deleteSelected">{{ $t('system.deleteSelected') }}</TbButton>
    </div>

    <div v-if="loading && !allParams.length" class="sys-state"><TbLoading :label="$t('system.params.loading')" show-label /></div>
    <TbEmpty v-else-if="failed && !allParams.length" face="confused" :title="$t('system.loadFailed')" :text="$t('system.loadFailedText')">
      <TbButton icon="refresh" @click="fetchParams">{{ $t('common.retry') }}</TbButton>
    </TbEmpty>
    <TbEmpty v-else-if="!allParams.length" face="sleepy" :title="$t('system.params.emptyTitle')" :text="$t('system.params.emptyText')">
      <TbButton variant="primary" icon="plus" @click="openAdd">{{ $t('system.params.add') }}</TbButton>
    </TbEmpty>
    <TbEmpty v-else-if="!sections.length" :title="$t('system.params.noMatch')" :text="$t('system.params.noMatchText')">
      <TbButton icon="close" @click="clearFilters">{{ $t('system.clearSearch') }}</TbButton>
    </TbEmpty>

    <p v-if="failed && allParams.length" class="sys-fail" role="alert">{{ $t('system.loadFailed') }}
      <TbButton size="s" variant="quiet" icon="refresh" @click="fetchParams">{{ $t('common.retry') }}</TbButton></p>

    <section v-for="s in sections" :key="s.key" class="params__group" :class="{ 'is-open': isOpen(s.key) }">
      <h2 class="params__ghead">
        <button type="button" class="params__gbtn" :aria-expanded="isOpen(s.key) ? 'true' : 'false'" @click="toggleSection(s.key)">
          <TbIcon name="chevron-right" :size="18" class="params__chev" />
          <span class="params__gname">{{ sectionLabel(s) }}</span>
          <span class="params__gcount tb-num">{{ num(s.items.length) }}</span>
        </button>
      </h2>
      <Transition name="params-open">
        <TbTable v-if="isOpen(s.key)" class="params__table sys-table" dense selectable row-key="paramCode" :columns="columns" :rows="s.items"
          :selected="selected" :row-class="rowClass" :caption="sectionLabel(s)" :select-all-label="$t('system.selectAllIn', { name: sectionLabel(s) })"
          :select-row-label="$t('system.selectRow')" @update:selected="setSectionSelection(s, $event)">
          <template #cell-paramCode="{ row }">
            <span class="params__code" :title="row.paramCode">{{ row.paramCode }}</span>
          </template>
          <template #cell-valueType="{ row }"><TbTag>{{ typeLabel(row.valueType) }}</TbTag></template>
          <template #cell-paramValue="{ row }">
            <span v-if="sensitive(row.paramCode)" class="params__value">
              <span class="params__val" :class="{ 'is-masked': !shown[row.paramCode] }"
                :title="shown[row.paramCode] ? String(row.paramValue ?? '') : null">
                {{ shown[row.paramCode] ? short(row.paramValue) : mask(row.paramValue) }}</span>
              <TbButton size="s" variant="quiet" :icon="shown[row.paramCode] ? 'eye-off' : 'eye'"
                :aria-label="$t(shown[row.paramCode] ? 'system.params.hideValue' : 'system.params.showValue', { code: row.paramCode })"
                :aria-pressed="shown[row.paramCode] ? 'true' : 'false'" @click="toggleShown(row)" />
              <TbButton size="s" variant="quiet" icon="copy" :aria-label="$t('system.params.copyValue', { code: row.paramCode })"
                @click="copy(row.paramValue)" />
            </span>
            <span v-else class="params__val" :title="String(row.paramValue ?? '')">{{ short(row.paramValue) || '–' }}</span>
          </template>
          <template #cell-remark="{ row }"><span class="params__remark" :title="row.remark || null">{{ row.remark || '–' }}</span></template>
          <template #cell-actions="{ row }">
            <span class="sys-acts">
              <TbButton size="s" variant="quiet" icon="edit" @click="openEdit(row)">{{ $t('common.edit') }}</TbButton>
              <TbButton size="s" variant="quiet" icon="trash" class="sys-del" :disabled="deleting" @click="deleteOne(row)">
                {{ $t('common.delete') }}</TbButton>
            </span>
          </template>
        </TbTable>
      </Transition>
    </section>

    <ParamSheet v-model:open="sheetOpen" :param="editing" :saving="saving" @submit="save" />
  </div>
</template>

<script>
import Api from '@/apis/api';
import { digits } from '@/kit/calendar';
import ParamSheet from './ParamSheet.vue';
import './system.css';
import {
  FETCH_LIMIT, buildSections, callWithTimeout, collectAll, defaultOpen, emptyParam, filterParams, isSensitive,
  maskValue, shortValue, subCounts, topCounts,
} from './systemModel';

// Parameters (back office, super admins; owner: web-system). Behaviour of the legacy
// ParamsManagement.vue and ParamDialog.vue: every page of params is fetched (500 a page), grouped
// by namespace, searched by code or remark, sensitive values masked with show and copy, add and
// edit in a sheet, delete one or many. API: admin.getParamsList, addParam, updateParam, deleteParam.
const TOP_LABEL = { all: 'system.params.group.all', server: 'system.params.group.server', plugins: 'system.params.group.plugins',
  log: 'system.params.group.log', session_state: 'system.params.group.session', general: 'system.params.group.general' };
const SUB_KNOWN = ['auth', 'connection', 'registry', 'resilience', 'metrics', 'tracing'];

export default {
  name: 'ParamsManagement',
  components: { ParamSheet },
  data() {
    return {
      allParams: [],
      query: '',
      activeTop: 'all',
      activeSub: 'all',
      openKeys: [],
      selected: [],
      shown: {},
      loading: false,
      failed: false,
      deleting: false,
      sheetOpen: false,
      editing: null,
      saving: false,
      seq: 0,
    };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    keyword() { return this.query.trim(); },
    columns() {
      return [
        { key: 'paramCode', label: this.$t('system.params.code'), width: '28%' },
        { key: 'valueType', label: this.$t('system.params.type'), width: '92px' },
        { key: 'paramValue', label: this.$t('system.params.value'), width: '30%' },
        { key: 'remark', label: this.$t('system.params.remark') },
        { key: 'actions', label: this.$t('system.actions'), align: 'right', width: '1%' },
      ];
    },
    topTabs() { return topCounts(this.allParams, this.keyword); },
    topOptions() {
      return this.topTabs.map((t) => ({ value: t.key, label: `${this.$t(TOP_LABEL[t.key])} ${this.num(t.count)}` }));
    },
    subOptions() {
      return subCounts(this.allParams, this.activeTop, this.keyword)
        .map((t) => ({ value: t.key, label: `${t.key === 'all' ? this.$t(TOP_LABEL.all) : this.subLabel(this.activeTop, t.key)} ${this.num(t.count)}` }));
    },
    filtered() {
      return filterParams(this.allParams, { top: this.activeTop, sub: this.activeSub, keyword: this.keyword });
    },
    sections() { return buildSections(this.filtered); },
    selectedRows() { return this.filtered.filter((p) => this.selected.includes(p.paramCode)); },
    allSelected() { return this.filtered.length > 0 && this.selectedRows.length === this.filtered.length; },
  },
  watch: {
    sections: {
      immediate: true,
      handler(list) { this.openKeys = defaultOpen(list.map((s) => s.key), this.openKeys); },
    },
    keyword() {
      // A new search starts from every sub-group, and leaves a group the search empties.
      this.activeSub = 'all';
      if (!this.topTabs.some((t) => t.key === this.activeTop)) this.activeTop = 'all';
    },
  },
  created() {
    this.fetchParams();
  },
  methods: {
    num(n) { return digits(n ?? '', this.lang); },
    sensitive: isSensitive,
    mask: maskValue,
    short: shortValue,
    typeLabel(t) { return this.$t(`system.params.types.${t || 'string'}`); },
    topLabel(top) { return this.$t(TOP_LABEL[top] || TOP_LABEL.general); },
    subLabel(top, sub) {
      if (sub === '_all') return this.topLabel(top);
      if (sub === '_root') return this.$t('system.params.sub.root');
      if (top === 'server' && SUB_KNOWN.includes(sub)) return this.$t(`system.params.sub.${sub}`);
      return sub;
    },
    sectionLabel(s) {
      if (this.activeTop !== 'all') return this.subLabel(s.top, s.sub);
      return s.sub === '_all' || s.sub === '_root' ? this.topLabel(s.top) : `${this.topLabel(s.top)} · ${this.subLabel(s.top, s.sub)}`;
    },
    isOpen(key) { return this.openKeys.includes(key); },
    toggleSection(key) {
      this.openKeys = this.isOpen(key) ? this.openKeys.filter((k) => k !== key) : [...this.openKeys, key];
    },
    rowClass(row) { return this.selected.includes(row.paramCode) ? 'is-picked' : null; },

    selectTop(key) {
      if (key === this.activeTop) return;
      this.activeTop = key;
      this.activeSub = 'all';
      this.selected = [];
    },
    selectSub(key) {
      if (key === this.activeSub) return;
      this.activeSub = key;
      this.selected = [];
    },
    clearFilters() {
      this.query = '';
      this.activeTop = 'all';
      this.activeSub = 'all';
    },
    setSectionSelection(section, ids) {
      const codes = section.items.map((p) => p.paramCode);
      this.selected = [...this.selected.filter((c) => !codes.includes(c)), ...ids.filter((c) => codes.includes(c))];
    },
    toggleAll(v) { this.selected = v ? this.filtered.map((p) => p.paramCode) : []; },
    toggleShown(row) { this.shown = { ...this.shown, [row.paramCode]: !this.shown[row.paramCode] }; },

    copy(value) {
      const text = value == null ? '' : String(value);
      if (!navigator.clipboard || !navigator.clipboard.writeText) { this.$message.error(this.$t('system.copyFailed')); return; }
      navigator.clipboard.writeText(text).then(
        () => this.$message.success(this.$t('system.copied')),
        () => this.$message.error(this.$t('system.copyFailed')),
      );
    },

    getPage(page) {
      return callWithTimeout((cb) => Api.admin.getParamsList({ page, limit: FETCH_LIMIT, paramCode: '' }, cb)).then((res) => {
        const data = res && res.data;
        if (data && data.code === 0) return data.data || {};
        throw new Error((data && data.msg) || this.$t('system.params.loadFailed'));
      });
    },
    async fetchParams() {
      const seq = ++this.seq;
      this.loading = true;
      this.failed = false;
      try {
        const list = await collectAll((p) => this.getPage(p));
        if (seq !== this.seq) return;
        this.allParams = list.map((p) => ({ ...p, valueType: p.valueType || 'string' }));
        const codes = this.allParams.map((p) => p.paramCode);
        this.selected = this.selected.filter((c) => codes.includes(c));
        if (!this.topTabs.some((t) => t.key === this.activeTop)) { this.activeTop = 'all'; this.activeSub = 'all'; }
      } catch (e) {
        if (seq !== this.seq) return;
        this.failed = true;
        if (e && e.message) this.$message.error(e.message);
      } finally {
        if (seq === this.seq) this.loading = false;
      }
    },

    openAdd() {
      this.editing = emptyParam();
      this.sheetOpen = true;
    },
    openEdit(row) {
      this.editing = { id: row.id, paramCode: row.paramCode, paramValue: row.paramValue, valueType: row.valueType || 'string', remark: row.remark };
      this.sheetOpen = true;
    },
    save(form) {
      const editing = !!form.id;
      const body = { id: form.id, paramCode: form.paramCode, paramValue: form.paramValue, valueType: form.valueType, remark: form.remark };
      this.saving = true;
      const done = ({ data }) => {
        this.saving = false;
        if (data && data.code === 0) {
          this.sheetOpen = false;
          this.$message.success(this.$t(editing ? 'system.params.updated' : 'system.params.added'));
          this.fetchParams();
        } else {
          this.$message.error((data && data.msg) || this.$t(editing ? 'system.params.updateFailed' : 'system.params.addFailed'));
        }
      };
      const fail = (res) => {
        this.saving = false;
        const data = res && res.data;
        this.$message.error((data && data.msg) || this.$t(editing ? 'system.params.updateFailed' : 'system.params.addFailed'));
      };
      if (editing) Api.admin.updateParam(body, done, fail);
      else Api.admin.addParam(body, done, fail);
    },

    deleteSelected() {
      if (!this.selectedRows.length) { this.$message.warning(this.$t('system.params.selectFirst')); return; }
      this.deleteParams(this.selectedRows.slice());
    },
    deleteOne(row) {
      if (!row.id) { this.$message.warning(this.$t('system.params.selectFirst')); return; }
      this.deleteParams([row]);
    },
    async deleteParams(rows) {
      const count = rows.length;
      const ids = rows.map((r) => r.id).filter((id) => id);
      if (!ids.length) { this.$message.error(this.$t('system.params.invalidId')); return; }
      const title = count === 1 && rows[0].paramCode ? this.$t('system.params.deleteOneTitle', { code: rows[0].paramCode })
        : this.$t('system.params.deleteManyTitle', { n: this.num(count) });
      try {
        await this.$confirm(this.$t('system.params.deleteText', { n: this.num(count) }), title, {
          confirmText: this.$t('common.delete'), cancelText: this.$t('common.cancel'), danger: true,
        });
      } catch (e) {
        this.$message.info(this.$t('system.deleteCancelled'));
        return;
      }
      this.deleting = true;
      const res = await callWithTimeout((cb) => Api.admin.deleteParam(ids, cb));
      this.deleting = false;
      if (!res) return; // the API layer has already reported the failure
      const { data } = res;
      if (data && data.code === 0) {
        const gone = rows.map((r) => r.paramCode);
        this.selected = this.selected.filter((c) => !gone.includes(c));
        this.$message.success(this.$t('system.params.deleted', { n: this.num(count) }));
        this.fetchParams();
      } else {
        this.$message.error((data && data.msg) || this.$t('system.deleteFailed'));
      }
    },
  },
};
</script>

<style>
.params { padding-bottom: var(--tb-s8); }
.params__groups .tb-choice__opt { font-variant-numeric: tabular-nums; }
.params__groups--sub { font-size: var(--tb-fs-14); }

.params__group { border-top: 1px solid var(--tb-rule); }
.params__group:last-of-type { border-bottom: 1px solid var(--tb-rule); }
.params__ghead { font-size: var(--tb-fs-16); }
.params__gbtn {
  display: flex; align-items: center; gap: var(--tb-s2); width: 100%; min-height: var(--tb-target); padding: var(--tb-s2) 0;
  border: 0; background: none; text-align: left; font: inherit; color: var(--tb-ink);
}
.params__chev { color: var(--tb-ink-2); transition: transform var(--tb-t-row) var(--tb-ease); }
.params__group.is-open .params__chev { transform: rotate(90deg); }
.params__gname { font-weight: 700; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.params__gcount { color: var(--tb-ink-2); font: 600 var(--tb-fs-13)/1 var(--tb-font-text); }
@media (hover: hover) and (pointer: fine) { .params__gbtn:hover .params__gname { text-decoration: underline; text-underline-offset: 4px; } }

.params__table { border-top-width: 1px; margin-bottom: var(--tb-s3); }
.params__table table { table-layout: fixed; }
.params__table td { overflow: hidden; }
.params__code { display: block; font-weight: 600; overflow-wrap: anywhere; line-height: 1.35; }
.params__value { display: flex; align-items: center; gap: 2px; min-width: 0; }
.params__val { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--tb-ink); }
.params__val.is-masked { color: var(--tb-ink-2); letter-spacing: .06em; }
.params__value .params__val { flex: 0 1 auto; }
.params__remark { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; color: var(--tb-ink-2); font-size: var(--tb-fs-13); }

.params-open-enter-active { transition: opacity var(--tb-t-row) var(--tb-ease), transform var(--tb-t-row) var(--tb-ease); }
.params-open-leave-active { transition: opacity var(--tb-t-fast) var(--tb-ease-in); }
.params-open-enter-from { opacity: 0; transform: translateY(-4px); }
.params-open-leave-to { opacity: 0; }

@media (max-width: 640px) {
  .params__table table { table-layout: auto; }
  .params__table tbody tr { position: relative; }
  .params__table td.tb-table__sel { position: absolute; top: 4px; right: 0; width: auto; padding: 0; }
  .params__table td.tb-table__sel .tb-check { min-height: var(--tb-target); min-width: var(--tb-target); justify-content: center; }
  .params__table tbody td:nth-child(2) { display: block; padding-right: 52px; }
  .params__table tbody td:nth-child(2)::before { content: none; }
  .params__table tbody td:last-child { display: block; }
  .params__table tbody td:last-child::before { content: none; }
  .params__value .tb-btn { min-width: var(--tb-target); min-height: var(--tb-target); }
  .params__table td > .tb-tag { justify-self: start; }
}
</style>
