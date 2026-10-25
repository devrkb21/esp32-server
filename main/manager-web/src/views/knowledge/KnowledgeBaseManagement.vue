<template>
  <div class="kb-page">
    <!-- One knowledge base, opened from the list (?kb=<datasetId>) -->
    <KnowledgeBaseItem v-if="routeKbId && selectedKb" :key="selectedKb.datasetId" :kb="selectedKb"
      :status-saving="!!statusSaving[selectedKb.datasetId]" @back="clearSelection" @edit="editKnowledgeBase"
      @delete="deleteKnowledgeBase" @status="setStatus" />

    <div v-else-if="routeKbId && (loading || !loaded)" class="kb-page__wait"><TbLoading :label="$t('common.loading')" show-label /></div>

    <div v-else-if="routeKbId" class="kb-page__wait">
      <TbEmpty face="confused" :title="$t('kb.notFoundTitle')" :text="$t('kb.notFoundText')">
        <TbButton icon="chevron-left" @click="clearSelection">{{ $t('kb.back') }}</TbButton>
      </TbEmpty>
    </div>

    <!-- The list -->
    <template v-else>
      <TbPageHeader :title="$t('kb.title')" :description="$t('kb.desc')">
        <template #actions>
          <TbButton variant="primary" icon="plus" @click="showAddDialog">{{ $t('kb.add') }}</TbButton>
        </template>
      </TbPageHeader>

      <div class="kb-filter">
        <form class="kb-filter__search" role="search" @submit.prevent="handleSearchKb">
          <TbInput v-model="searchKbName" icon="search" clearable :placeholder="$t('kb.searchPlaceholder')"
            :aria-label="$t('kb.searchLabel')" :clear-label="$t('kb.clear')" @clear="handleSearchKb" />
          <TbButton native-type="submit">{{ $t('common.search') }}</TbButton>
        </form>
        <div v-if="selected.length" class="kb-filter__sel" role="status">
          <span class="tb-num">{{ $t('kb.selected', { n: num(selected.length) }) }}</span>
          <TbButton size="s" variant="quiet" @click="selected = []">{{ $t('kb.clearSelection') }}</TbButton>
          <TbButton size="s" variant="danger" icon="trash" @click="deleteSelected">{{ $t('kb.deleteSelected') }}</TbButton>
        </div>
      </div>

      <TbTable class="kb-list" dense selectable v-model:selected="selected" row-key="datasetId" :columns="columns"
        :rows="knowledgeBases" :loading="loading && !knowledgeBases.length" :loading-text="$t('common.loading')"
        :caption="$t('kb.title')" :select-all-label="$t('kb.selectAll')" :select-row-label="$t('kb.selectRow')"
        :row-class="rowClass" @row-click="selectKnowledgeBase">
        <template #cell-name="{ row }">
          <div class="kb-name">
            <button type="button" class="kb-name__open" @click.stop="selectKnowledgeBase(row)">{{ row.name }}</button>
            <span v-if="row.description" class="kb-name__desc">{{ row.description }}</span>
            <span v-if="row.errorMessage" class="kb-name__err"><TbIcon name="warning" :size="14" />{{ $t('kb.needsAttention') }}: {{ row.errorMessage }}</span>
          </div>
        </template>
        <template #cell-documentCount="{ row }"><span class="tb-num">{{ num(row.documentCount) }}</span></template>
        <template #cell-status="{ row }">
          <span class="kb-stop" @click.stop>
            <TbSwitch :model-value="row.status === 1" :loading="!!statusSaving[row.datasetId]"
              :aria-label="$t('kb.statusLabel', { name: row.name })" @update:model-value="setStatus(row, $event)">
              <span class="kb-state">{{ row.status === 1 ? $t('kb.enabled') : $t('kb.disabled') }}</span>
            </TbSwitch>
          </span>
        </template>
        <template #cell-updated="{ row }"><span class="tb-num kb-muted">{{ date(row.updatedAt || row.createdAt) }}</span></template>
        <template #cell-actions="{ row }">
          <span class="kb-acts" @click.stop>
            <TbButton size="s" variant="quiet" icon="edit" :aria-label="$t('kb.editName', { name: row.name })" @click="editKnowledgeBase(row)" />
            <TbButton size="s" variant="quiet" icon="trash" class="kb-del" :aria-label="$t('kb.deleteName', { name: row.name })" @click="deleteKnowledgeBase(row)" />
            <TbButton size="s" variant="quiet" icon-after="chevron-right" @click="selectKnowledgeBase(row)">{{ $t('kb.open') }}</TbButton>
          </span>
        </template>
        <template #empty>
          <TbEmpty v-if="failed" face="confused" :title="$t('kb.loadFailed')" :text="$t('common.loadFailed')">
            <TbButton icon="refresh" @click="fetchKnowledgeBases">{{ $t('common.retry') }}</TbButton>
          </TbEmpty>
          <TbEmpty v-else-if="searched" :title="$t('kb.noResultsTitle', { q: searched })" :text="$t('kb.noResultsText')">
            <TbButton @click="clearSearch">{{ $t('kb.clearSearch') }}</TbButton>
          </TbEmpty>
          <TbEmpty v-else face="awake" :title="$t('kb.emptyTitle')" :text="$t('kb.emptyText')">
            <TbButton variant="primary" icon="plus" @click="showAddDialog">{{ $t('kb.add') }}</TbButton>
          </TbEmpty>
        </template>
      </TbTable>

      <p v-if="failed && knowledgeBases.length" class="kb-fail" role="alert">
        {{ $t('kb.loadFailed') }}
        <TbButton size="s" variant="quiet" icon="refresh" @click="fetchKnowledgeBases">{{ $t('common.retry') }}</TbButton>
      </p>

      <TbPagination v-if="total > 0" v-model:page="page" v-model:page-size="pageSize" :total="total" :sizes="[10, 20, 50, 100]"
        :total-text="$t('kb.total', { n: num(total) })" :size-suffix="$t('kb.perPage')" :aria-label="$t('kb.pages')"
        :prev-label="$t('kb.prev')" :next-label="$t('kb.next')" :size-label="$t('kb.rowsPerPage')" @change="onPage" />
    </template>

    <KnowledgeBaseSheet v-model:open="dialogVisible" :value="knowledgeBaseForm" :saving="saving" @submit="handleSubmit" />
  </div>
</template>

<script>
import Api from '@/apis/api';
import { count, dateText, errorText, ok } from './kbModel';
import KnowledgeBaseItem from './KnowledgeBaseItem.vue';
import KnowledgeBaseSheet from './KnowledgeBaseSheet.vue';

// Knowledge base (back office): the list of knowledge bases, and one of them opened in place
// (?kb=<datasetId> in the URL, so Back returns to the list).
export default {
  name: 'KnowledgeBaseManagement',
  components: { KnowledgeBaseItem, KnowledgeBaseSheet },
  data() {
    return {
      knowledgeBases: [],
      selectedKb: null,
      selected: [],
      searchKbName: '',
      searched: '',
      loading: false,
      loaded: false,
      failed: false,
      page: 1,
      pageSize: 20,
      total: 0,
      statusSaving: {},
      dialogVisible: false,
      saving: false,
      knowledgeBaseForm: { id: null, datasetId: null, name: '', description: '', status: 1 },
    };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    routeKbId() { return (this.$route && this.$route.query && this.$route.query.kb) || ''; },
    columns() {
      return [
        { key: 'name', label: this.$t('kb.col.name') },
        { key: 'documentCount', label: this.$t('kb.col.docs'), align: 'right', width: '96px' },
        { key: 'status', label: this.$t('kb.col.status'), width: '132px' },
        { key: 'updated', label: this.$t('kb.col.updated'), width: '150px' },
        { key: 'actions', label: this.$t('kb.col.actions'), align: 'right', width: '176px' },
      ];
    },
  },
  watch: {
    routeKbId(id) {
      if (!id) { this.selectedKb = null; return; }
      if (!this.selectedKb || String(this.selectedKb.datasetId) !== String(id)) {
        const kb = this.knowledgeBases.find((item) => String(item.datasetId) === String(id));
        this.selectedKb = kb || null;
        if (!kb) this.fetchKnowledgeBases();
      }
    },
  },
  created() {
    this.fetchKnowledgeBases();
  },
  methods: {
    num(n) { return count(n, this.lang); },
    date(v) { return dateText(v, this.lang); },
    rowClass(row) { return { 'is-off': row.status !== 1, 'is-error': !!row.errorMessage }; },

    fetchKnowledgeBases() {
      this.loading = true;
      Api.knowledgeBase.getKnowledgeBaseList(
        { page: this.page, page_size: this.pageSize, name: this.searchKbName },
        (res) => {
          this.loading = false;
          this.loaded = true;
          if (ok(res)) {
            const pageData = res.data.data || {};
            this.failed = false;
            this.knowledgeBases = pageData.list || [];
            this.total = Number(pageData.total ?? this.knowledgeBases.length) || 0;
            this.searched = this.searchKbName.trim();
            const keep = new Set(this.knowledgeBases.map((kb) => kb.datasetId));
            this.selected = this.selected.filter((id) => keep.has(id));
            if (this.routeKbId) {
              const fromRoute = this.knowledgeBases.find((kb) => String(kb.datasetId) === String(this.routeKbId));
              if (fromRoute) this.selectedKb = fromRoute;
            }
          } else {
            this.failed = true;
            this.$message.error(errorText(res, this.$t('kb.loadFailed')));
          }
        },
        () => {
          this.loading = false;
          this.loaded = true;
          this.failed = true;
          this.$message.error(this.$t('kb.loadFailed'));
        },
      );
    },

    selectKnowledgeBase(kb) {
      this.selectedKb = kb;
      if (this.routeKbId !== String(kb.datasetId)) {
        this.$router.push({ query: { ...this.$route.query, kb: String(kb.datasetId) } }).catch(() => {});
      }
      window.scrollTo({ top: 0 });
    },

    clearSelection() {
      this.selectedKb = null;
      if (this.routeKbId) {
        const query = { ...this.$route.query };
        delete query.kb;
        this.$router.push({ query }).catch(() => {});
      }
    },

    handleSearchKb() {
      this.page = 1;
      this.fetchKnowledgeBases();
    },
    clearSearch() {
      this.searchKbName = '';
      this.handleSearchKb();
    },
    onPage() { this.fetchKnowledgeBases(); },

    showAddDialog() {
      this.knowledgeBaseForm = { id: null, datasetId: null, name: '', description: '', status: 1 };
      this.dialogVisible = true;
    },

    editKnowledgeBase(kb) {
      this.knowledgeBaseForm = {
        id: kb.id,
        datasetId: kb.datasetId,
        name: kb.name,
        description: kb.description || '',
        status: kb.status,
        ragModelId: kb.ragModelId,
      };
      this.dialogVisible = true;
    },

    // The legacy status update: id, datasetId, name, description and the new status.
    setStatus(kb, on) {
      const previous = kb.status;
      kb.status = on ? 1 : 0;
      if (this.selectedKb && this.selectedKb !== kb && this.selectedKb.datasetId === kb.datasetId) this.selectedKb.status = kb.status;
      const updateForm = { id: kb.id, datasetId: kb.datasetId, name: kb.name, description: kb.description, status: kb.status };
      this.statusSaving = { ...this.statusSaving, [kb.datasetId]: true };
      const done = () => { this.statusSaving = { ...this.statusSaving, [kb.datasetId]: false }; };
      Api.knowledgeBase.updateKnowledgeBase(kb.datasetId, updateForm, (res) => {
        done();
        if (res.data && res.data.code !== 0) {
          kb.status = previous;
          this.fetchKnowledgeBases();
          this.$message.error(errorText(res, this.$t('kb.updateFailed')));
        } else {
          this.$message.success(kb.status === 1 ? this.$t('kb.turnedOn', { name: kb.name }) : this.$t('kb.turnedOff', { name: kb.name }));
        }
      }, () => {
        done();
        kb.status = previous;
        this.fetchKnowledgeBases();
        this.$message.error(this.$t('kb.updateFailed'));
      });
    },

    deleteKnowledgeBase(kb) {
      this.$confirm(this.$t('kb.confirmDelete'), kb.name || this.$t('kb.deleteTitle'), {
        confirmText: this.$t('common.delete'), cancelText: this.$t('common.cancel'), danger: true,
      }).then(() => {
        Api.knowledgeBase.deleteKnowledgeBase(kb.datasetId, (res) => {
          if (ok(res)) {
            this.$message.success(this.$t('kb.deleted', { name: kb.name }));
            if (this.selectedKb && this.selectedKb.datasetId === kb.datasetId) this.clearSelection();
            this.selected = this.selected.filter((id) => id !== kb.datasetId);
            if (this.knowledgeBases.length === 1 && this.page > 1) this.page -= 1;
            this.fetchKnowledgeBases();
          } else {
            this.$message.error(errorText(res, this.$t('kb.deleteFailed')));
          }
        }, (err) => {
          this.$message.error((err && err.data && err.data.msg) || this.$t('kb.deleteFailed'));
        });
      }).catch(() => {});
    },

    deleteSelected() {
      const ids = [...this.selected];
      if (!ids.length) { this.$message.warning(this.$t('kb.selectFirst')); return; }
      this.$confirm(this.$t('kb.confirmDeleteMany', { n: this.num(ids.length) }), this.$t('kb.deleteSelected'), {
        confirmText: this.$t('common.delete'), cancelText: this.$t('common.cancel'), danger: true,
      }).then(() => {
        Api.knowledgeBase.deleteKnowledgeBases(ids, (res) => {
          if (ok(res)) {
            this.$message.success(this.$t('kb.deletedMany', { n: this.num(ids.length) }));
            this.selected = [];
            if (ids.length >= this.knowledgeBases.length && this.page > 1) this.page -= 1;
            this.fetchKnowledgeBases();
          } else {
            this.$message.error(errorText(res, this.$t('kb.deleteFailed')));
          }
        }, (err) => {
          this.$message.error((err && err.data && err.data.msg) || this.$t('kb.deleteFailed'));
        });
      }).catch(() => {});
    },

    handleSubmit(form) {
      this.saving = true;
      if (form.id) {
        Api.knowledgeBase.updateKnowledgeBase(form.datasetId, form, (res) => {
          this.saving = false;
          if (ok(res)) {
            this.dialogVisible = false;
            if (this.selectedKb && this.selectedKb.datasetId === form.datasetId) {
              Object.assign(this.selectedKb, { name: form.name, description: form.description, ragModelId: form.ragModelId });
            }
            this.fetchKnowledgeBases();
            this.$message.success(this.$t('kb.updated'));
          } else {
            this.$message.error(errorText(res, this.$t('kb.updateFailed')));
          }
        }, (err) => {
          this.saving = false;
          this.$message.error((err && err.data && err.data.msg) || this.$t('kb.updateFailed'));
        });
      } else {
        const createData = { name: form.name, description: form.description, status: form.status, ragModelId: form.ragModelId };
        Api.knowledgeBase.createKnowledgeBase(createData, (res) => {
          this.saving = false;
          if (ok(res)) {
            this.dialogVisible = false;
            this.fetchKnowledgeBases();
            this.$message.success(this.$t('kb.added'));
          } else {
            this.$message.error(errorText(res, this.$t('kb.addFailed')));
          }
        }, (err) => {
          this.saving = false;
          this.$message.error((err && err.data && err.data.msg) || this.$t('kb.addFailed'));
        });
      }
    },
  },
};
</script>

<style>
.kb-page__wait { padding: var(--tb-s12) 0; display: grid; place-items: center; }

.kb-filter { display: flex; align-items: center; justify-content: space-between; gap: var(--tb-s3) var(--tb-s4); flex-wrap: wrap; padding: var(--tb-s4) 0; }
.kb-filter__search { display: flex; gap: var(--tb-s2); flex: 1 1 320px; max-width: 460px; }
.kb-filter__search .tb-input { flex: 1; min-width: 0; }
.kb-filter__sel { display: flex; align-items: center; gap: var(--tb-s2); font-size: var(--tb-fs-14); font-weight: 600; }

.kb-list td { vertical-align: top; }
.kb-list tbody tr { cursor: pointer; }
.kb-list tbody tr.is-off .kb-name__open { color: var(--tb-ink-2); }
.kb-name { display: grid; gap: 2px; min-width: 0; }
.kb-name__open {
  justify-self: start; padding: 2px 0; border: 0; background: none; text-align: left;
  font: 700 var(--tb-fs-15)/1.35 var(--tb-font-text); color: var(--tb-ink); text-decoration: none;
  text-underline-offset: 3px;
}
.kb-name__open:hover { text-decoration: underline; }
.kb-name__open:focus-visible { outline: 2px solid var(--tb-focus); outline-offset: 2px; border-radius: 2px; }
.kb-name__desc {
  color: var(--tb-ink-2); font-size: var(--tb-fs-13); line-height: var(--tb-lh-text);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-width: 64ch;
}
.kb-name__err { display: inline-flex; align-items: flex-start; gap: 4px; color: var(--tb-danger); font-size: var(--tb-fs-13); font-weight: 600; }
.kb-name__err .tb-icon { flex: none; margin-top: 3px; }
.kb-muted { color: var(--tb-ink-2); white-space: nowrap; }
.kb-stop { display: inline-flex; }
.kb-list .tb-switch { min-height: 32px; gap: 8px; }
.kb-state { font-size: var(--tb-fs-13); font-weight: 600; }
.kb-acts { display: inline-flex; align-items: center; justify-content: flex-end; gap: 2px; }
@media (hover: hover) and (pointer: fine) { .kb-del:hover:not(:disabled) { color: var(--tb-danger); } }
.kb-fail { display: flex; align-items: center; gap: var(--tb-s2); color: var(--tb-danger); padding-top: var(--tb-s3); }

@media (max-width: 640px) {
  .kb-filter__search { max-width: none; }
  /* phones: checkbox beside the name, the other facts labelled underneath */
  .kb-list.tb-table tr { display: grid; grid-template-columns: 36px minmax(0, 1fr); column-gap: 8px; align-items: start; }
  .kb-list.tb-table td { grid-column: 2; align-items: center; }
  .kb-list.tb-table td.tb-table__sel { grid-column: 1; grid-row: 1; padding-top: 6px; }
  .kb-list.tb-table td:nth-child(2) { display: block; grid-row: 1; padding-bottom: 6px; }
  .kb-list.tb-table td:nth-child(2)::before, .kb-list.tb-table td:last-child::before { content: none; }
  .kb-list.tb-table td:last-child { display: block; padding-top: 4px; }
  .kb-acts { justify-content: flex-start; margin-left: -10px; }
  .kb-acts .tb-btn { --h: 44px; }
  .kb-list .tb-switch { min-height: var(--tb-target); }
}
</style>
