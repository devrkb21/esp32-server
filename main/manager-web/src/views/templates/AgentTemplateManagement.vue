<template>
  <div class="tpl">
    <TbPageHeader :title="$t('templates.title')" :description="$t('templates.desc')">
      <template #actions>
        <TbButton variant="primary" icon="plus" @click="openAdd">{{ $t('templates.create') }}</TbButton>
      </template>
    </TbPageHeader>

    <div class="tpl__filters" role="search">
      <TbInput v-model="search" class="tpl__search" icon="search" clearable size="s" :maxlength="64"
        :placeholder="$t('templates.searchPlaceholder')" :aria-label="$t('templates.searchLabel')"
        :clear-label="$t('templates.clearSearch')" @update:model-value="queueSearch" @enter="runSearch" @clear="runSearch" />
      <p class="tpl__count tb-num" aria-live="polite">
        <template v-if="!loading && !failed">{{ $t('templates.total', { n: num(total) }) }}</template>
      </p>
    </div>

    <Transition name="tpl-bar">
      <div v-if="selected.length" class="tpl__bar" role="status">
        <span class="tpl__bar-count tb-num">{{ $t('templates.selected', { n: num(selected.length) }) }}</span>
        <TbButton size="s" variant="quiet" @click="toggleAll">
          {{ allSelected ? $t('templates.deselectAll') : $t('templates.selectAll') }}
        </TbButton>
        <TbButton size="s" variant="danger" icon="trash" class="tpl__bar-del" @click="batchDelete">
          {{ $t('templates.deleteSelected') }}
        </TbButton>
      </div>
    </Transition>

    <TbTable v-model:selected="selected" class="tpl__table" dense selectable row-key="id" :columns="columns" :rows="rows"
      :loading="loading" :caption="$t('templates.title')" :loading-text="$t('common.loading')"
      :select-all-label="$t('templates.selectAll')" :select-row-label="$t('templates.selectRow')"
      :row-class="(r) => (selected.includes(r.id) ? 'is-picked' : null)">
      <template #cell-no="{ index }">
        <span class="tpl__no tb-num">{{ num((page - 1) * pageSize + index + 1) }}</span>
      </template>
      <template #cell-agentName="{ row }">
        <button type="button" class="tpl__name" :aria-label="$t('templates.editOne', { name: row.agentName || '' })" @click="openEdit(row)">
          <span class="tpl__title">{{ row.agentName || $t('templates.newName') }}</span>
          <span class="tpl__prompt" :class="{ 'is-none': !row.systemPrompt }">{{ row.systemPrompt || $t('templates.noPrompt') }}</span>
        </button>
      </template>
      <template #cell-length="{ row }">
        <span class="tpl__len tb-num">{{ $t('templates.chars', { n: num((row.systemPrompt || '').length) }) }}</span>
      </template>
      <template #cell-actions="{ row }">
        <div class="tpl__acts">
          <TbButton size="s" variant="quiet" icon="edit" @click="openEdit(row)">{{ $t('common.edit') }}</TbButton>
          <TbButton size="s" variant="quiet" icon="trash" class="tpl__del"
            :aria-label="$t('templates.deleteOne', { name: row.agentName || '' })" @click="deleteOne(row)" />
        </div>
      </template>
      <template #empty>
        <TbEmpty v-if="failed" face="confused" :title="$t('templates.loadFailed')" :text="failText || $t('common.loadFailed')">
          <TbButton icon="refresh" @click="load">{{ $t('common.retry') }}</TbButton>
        </TbEmpty>
        <TbEmpty v-else-if="lastSearch" :title="$t('templates.noMatch', { q: lastSearch })" :text="$t('templates.noMatchText')">
          <TbButton icon="close" @click="clearSearch">{{ $t('templates.clearSearch') }}</TbButton>
        </TbEmpty>
        <TbEmpty v-else face="awake" :title="$t('templates.empty')" :text="$t('templates.emptyText')">
          <TbButton variant="primary" icon="plus" @click="openAdd">{{ $t('templates.create') }}</TbButton>
        </TbEmpty>
      </template>
    </TbTable>

    <TbPagination v-if="total > 0" class="tpl__pager" :page="page" :page-size="pageSize" :total="total" :sizes="[10, 20, 50, 100]"
      :total-text="$t('templates.total', { n: num(total) })" :size-suffix="$t('templates.perPage')"
      @update:page="goPage" @update:pageSize="setSize" />

    <TbSheet :open="sheetOpen" size="l" :title="form.id ? $t('templates.editTitle') : $t('templates.addTitle')"
      :close-label="$t('common.close')" @update:open="(v) => (v ? null : askClose())">
      <form id="tpl-form" class="tpl-form" novalidate @submit.prevent="save">
        <TbField :label="$t('templates.name')" for-id="tpl-name" required :hint="$t('templates.nameHint')" :error="errText('agentName')">
          <TbInput id="tpl-name" v-model="form.agentName" :maxlength="NAME_MAX" :invalid="!!errors.agentName"
            :placeholder="$t('templates.namePlaceholder')" @blur="check('agentName')" />
        </TbField>
        <TbField :label="$t('templates.prompt')" for-id="tpl-prompt" required :hint="promptHint" :error="errText('systemPrompt')">
          <TbTextarea id="tpl-prompt" v-model="form.systemPrompt" class="tpl-form__prompt" :class="{ 'is-near': near }" :rows="12"
            autosize show-count :maxlength="PROMPT_MAX" :invalid="!!errors.systemPrompt"
            :placeholder="$t('templates.promptPlaceholder')" @blur="check('systemPrompt')" />
        </TbField>
      </form>
      <template #footer>
        <TbButton v-if="form.id" variant="quiet" icon="external" class="tpl-form__full"
          :to="{ path: '/template-quick-config', query: { templateId: form.id } }">{{ $t('templates.openFull') }}</TbButton>
        <TbButton @click="askClose">{{ $t('common.cancel') }}</TbButton>
        <TbButton variant="primary" native-type="submit" form="tpl-form" :loading="saving">{{ $t('common.save') }}</TbButton>
      </template>
    </TbSheet>
  </div>
</template>

<script>
import agentApi from '@/apis/module/agent';
import { digits } from '@/kit/calendar';
import { NAME_MAX, PROMPT_MAX, PROMPT_NEAR, emptyForm, formFromTemplate, payloadOf, snapshot, validate } from './templateModel';

export default {
  name: 'AgentTemplateManagement',
  data() {
    return {
      NAME_MAX,
      PROMPT_MAX,
      list: [],
      loading: false,
      failed: false,
      failText: '',
      selected: [],
      search: '',
      lastSearch: '',
      page: 1,
      pageSize: 10,
      total: 0,
      sheetOpen: false,
      saving: false,
      form: emptyForm(),
      original: '',
      errors: {},
      timer: null,
      seq: 0,
    };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    rows() { return this.list; },
    columns() {
      return [
        { key: 'no', label: this.$t('templates.col.no'), width: '64px' },
        { key: 'agentName', label: this.$t('templates.col.name') },
        { key: 'length', label: this.$t('templates.col.length'), width: '120px', align: 'right' },
        { key: 'actions', label: this.$t('templates.col.actions'), width: '160px', align: 'right' },
      ];
    },
    allSelected() { return this.list.length > 0 && this.list.every((r) => this.selected.includes(r.id)); },
    promptLength() { return String(this.form.systemPrompt || '').length; },
    near() { return this.promptLength >= PROMPT_NEAR; },
    promptHint() {
      return this.near ? this.$t('templates.promptNear', { n: this.num(PROMPT_MAX - this.promptLength) }) : this.$t('templates.promptHint');
    },
    dirty() { return this.sheetOpen && snapshot(this.form) !== this.original; },
  },
  created() { this.load(); },
  beforeUnmount() { clearTimeout(this.timer); },
  beforeRouteLeave(to, from, next) {
    if (!this.dirty) { this.sheetOpen = false; next(); return; }
    this.$confirm(this.$t('templates.discard'), this.$t('templates.discardTitle'), {
      confirmText: this.$t('templates.discardOk'), cancelText: this.$t('templates.keepEditing'), danger: true,
    }).then(() => { this.sheetOpen = false; next(); }).catch(() => next(false));
  },
  methods: {
    num(n) { return digits(n, this.lang); },
    errText(k) { return this.errors[k] ? this.$t(this.errors[k]) : ''; },

    load() {
      const params = { page: this.page, limit: this.pageSize };
      if (this.search.trim()) params.agentName = this.search.trim();
      this.lastSearch = params.agentName || '';
      this.loading = true;
      this.failed = false;
      const seq = ++this.seq;
      agentApi.getAgentTemplatesPage(params, (res) => {
        if (seq !== this.seq) return; // a newer search answered first
        this.loading = false;
        this.selected = [];
        if (res && res.data && res.data.code === 0) {
          const d = res.data.data || {};
          this.list = Array.isArray(d.list) ? d.list : [];
          this.total = typeof d.total === 'number' ? d.total : 0;
          // the last page emptied by a delete: step back one page
          if (!this.list.length && this.total > 0 && this.page > 1) { this.page -= 1; this.load(); }
        } else {
          this.list = [];
          this.total = 0;
          this.failed = true;
          this.failText = res?.data?.msg || '';
          this.$message.error(res?.data?.msg || this.$t('templates.loadFailed'));
        }
      });
    },
    queueSearch() {
      clearTimeout(this.timer);
      this.timer = setTimeout(this.runSearch, 400);
    },
    runSearch() {
      clearTimeout(this.timer);
      if (this.search.trim() === this.lastSearch && this.page === 1 && !this.failed) return;
      this.page = 1;
      this.load();
    },
    clearSearch() { this.search = ''; this.runSearch(); },
    goPage(p) { this.page = p; this.load(); },
    setSize(s) { this.pageSize = s; this.page = 1; this.load(); },
    toggleAll() { this.selected = this.allSelected ? [] : this.list.map((r) => r.id); },

    openAdd() {
      this.form = emptyForm(this.$t('templates.newName'), 1);
      this.openSheet();
    },
    openEdit(row) {
      agentApi.getAgentTemplateById(row.id, (res) => {
        if (res && res.data && res.data.code === 0 && res.data.data) {
          this.form = formFromTemplate(res.data.data);
          this.openSheet();
        } else {
          this.$message.error(res?.data?.msg || this.$t('templates.notFound'));
        }
      });
    },
    openSheet() {
      this.errors = {};
      this.original = snapshot(this.form);
      this.sheetOpen = true;
    },
    askClose() {
      if (!this.dirty) { this.sheetOpen = false; return; }
      this.$confirm(this.$t('templates.discard'), this.$t('templates.discardTitle'), {
        confirmText: this.$t('templates.discardOk'), cancelText: this.$t('templates.keepEditing'), danger: true,
      }).then(() => { this.sheetOpen = false; }).catch(() => {});
    },
    check(k) {
      const e = validate(this.form);
      this.errors = { ...this.errors, [k]: e[k] };
    },
    save() {
      const e = validate(this.form);
      this.errors = e;
      if (Object.keys(e).length) {
        document.getElementById(e.agentName ? 'tpl-name' : 'tpl-prompt')?.focus();
        return;
      }
      const call = this.form.id ? agentApi.updateAgentTemplate : agentApi.addAgentTemplate;
      this.saving = true;
      call.call(agentApi, payloadOf(this.form), (res) => {
        this.saving = false;
        if (res && res.data && res.data.code === 0) {
          this.$message.success(this.$t('templates.saved'));
          this.original = snapshot(this.form);
          this.sheetOpen = false;
          this.load();
        } else {
          this.$message.error(res?.data?.msg || this.$t('templates.saveFailed'));
        }
      });
    },

    deleteOne(row) {
      this.$confirm(this.$t('templates.confirmDelete', { name: row.agentName || '' }), this.$t('templates.confirmDeleteTitle'), {
        confirmText: this.$t('common.delete'), cancelText: this.$t('common.cancel'), danger: true,
      }).then(() => {
        agentApi.deleteAgentTemplate(row.id, (res) => {
          if (res && res.data && res.data.code === 0) {
            this.$message.success(this.$t('templates.deleted'));
            this.load();
          } else {
            this.$message.error(res?.data?.msg || this.$t('templates.deleteFailed'));
          }
        });
      }).catch(() => {});
    },
    batchDelete() {
      const ids = [...this.selected];
      if (!ids.length) { this.$message.warning(this.$t('templates.selectFirst')); return; }
      const n = this.num(ids.length);
      this.$confirm(this.$t('templates.confirmBatch', { n }), this.$t('templates.confirmBatchTitle', { n }), {
        confirmText: this.$t('templates.deleteSelected'), cancelText: this.$t('common.cancel'), danger: true,
      }).then(() => {
        agentApi.batchDeleteAgentTemplate(ids, (res) => {
          if (res && res.data && res.data.code === 0) {
            this.$message.success(this.$t('templates.batchDeleted', { n }));
            this.load();
          } else {
            this.$message.error(res?.data?.msg || this.$t('templates.deleteFailed'));
          }
        });
      }).catch(() => {});
    },
  },
};
</script>

<style scoped>
.tpl__filters { display: flex; align-items: center; gap: var(--tb-s4); flex-wrap: wrap; padding: var(--tb-s4) 0 var(--tb-s3); }
.tpl__search { flex: 0 1 320px; min-width: 0; }
.tpl__count { margin-left: auto; color: var(--tb-ink-2); font-size: var(--tb-fs-13); }

.tpl__bar {
  display: flex; align-items: center; gap: var(--tb-s3); flex-wrap: wrap;
  padding: 6px 0 6px var(--tb-s3); margin-bottom: -1px;
  border-top: 1px solid var(--tb-rule-soft);
}
.tpl__bar-count { font-weight: 700; font-size: var(--tb-fs-14); }
.tpl__bar-del { margin-left: auto; }
.tpl-bar-enter-active { transition: opacity var(--tb-t-row) var(--tb-ease), transform var(--tb-t-row) var(--tb-ease); }
.tpl-bar-leave-active { transition: opacity var(--tb-t-fast) var(--tb-ease-in); }
.tpl-bar-enter-from { opacity: 0; transform: translateY(-4px); }
.tpl-bar-leave-to { opacity: 0; }

.tpl__no { color: var(--tb-ink-2); }
.tpl__name {
  display: grid; gap: 2px; width: 100%; min-width: 0; max-width: 64ch; padding: 2px 0; border: 0; background: none;
  text-align: left; color: inherit; font: inherit; cursor: pointer;
}
.tpl__title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tpl__prompt { color: var(--tb-ink-2); font-size: var(--tb-fs-13); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tpl__prompt.is-none { color: var(--tb-ink-3); font-style: normal; }
.tpl__name:focus-visible { outline: 2px solid var(--tb-focus); outline-offset: 2px; border-radius: 4px; }
@media (hover: hover) and (pointer: fine) {
  .tpl__name:hover .tpl__title { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
}
.tpl__len { color: var(--tb-ink-2); font-size: var(--tb-fs-13); white-space: nowrap; }
.tpl__acts { display: inline-flex; gap: 2px; justify-content: flex-end; }
.tpl__del { color: var(--tb-danger); }

/* the table keeps its name column from pushing the page wider */
.tpl__table :deep(table) { table-layout: fixed; }
.tpl__table :deep(td:not(.tb-table__sel)) { overflow: hidden; }
.tpl__table :deep(tr.is-picked) { background: var(--tb-paper-2); }

.tpl__pager { border-top: 1px solid var(--tb-rule); margin-top: -1px; }

.tpl-form { display: grid; gap: var(--tb-s5); }
.tpl-form__prompt :deep(textarea) { min-height: 240px; max-height: 52vh; }
.tpl-form__prompt.is-near :deep(.tb-textarea__count) { color: var(--tb-warn); font-weight: 600; }
.tpl-form__full { margin-right: auto; }

/* phones: each template is one ruled block, checkbox beside it, actions under it */
@media (max-width: 640px) {
  .tpl__search { flex: 1 1 100%; }
  .tpl__count { margin-left: 0; }
  .tpl__table :deep(table) { table-layout: auto; }
  .tpl__table :deep(tbody tr) { display: grid; grid-template-columns: 44px minmax(0, 1fr); align-items: start; padding: 10px 0; }
  .tpl__table :deep(tbody td) { grid-column: 2; display: block; padding: 2px 4px; }
  .tpl__table :deep(tbody td::before) { content: none; }
  .tpl__table :deep(tbody td.tb-table__sel) { grid-column: 1; grid-row: 1 / span 3; display: flex; justify-content: flex-start; align-items: flex-start; width: 44px; min-height: 44px; padding: 0; overflow: visible; }
  .tpl__table :deep(tbody td.tb-table__sel .tb-check) { min-width: 44px; min-height: 44px; align-items: flex-start; padding-top: 2px; }
  .tpl__table :deep(tbody td:nth-child(2)) { display: none; }
  .tpl__name { max-width: none; min-height: 44px; }
  .tpl__acts { margin-left: -10px; }
  .tpl__acts :deep(.tb-btn) { min-height: 44px; }
  .tpl__acts :deep(.tb-btn.is-icon-only) { width: 44px; }
  .tpl-form__full { flex-basis: 100%; order: 3; }
}
</style>
