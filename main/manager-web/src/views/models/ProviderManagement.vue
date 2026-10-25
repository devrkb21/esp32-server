<template>
  <div class="provs">
    <TbPageHeader :title="$t('nav.providers')" :description="$t('providers.pageDesc')">
      <template #actions>
        <TbButton variant="primary" icon="plus" @click="showAddDialog">{{ $t('providers.add') }}</TbButton>
      </template>
    </TbPageHeader>

    <form class="provs__filter" role="search" @submit.prevent="handleSearch">
      <TbInput v-model="searchName" icon="search" clearable size="s" class="provs__search" :placeholder="$t('providers.searchPh')"
        :aria-label="$t('providers.search')" :clear-label="$t('models.clear')" @clear="handleSearch" />
      <TbSelect :model-value="searchModelType" size="s" class="provs__type" :options="typeFilterOptions"
        :aria-label="$t('providers.categoryFilter')" @change="handleSelectModelType" />
      <TbButton size="s" native-type="submit">{{ $t('common.search') }}</TbButton>
      <span v-if="!loading && !failed" class="provs__total tb-num">{{ $t('providers.count', { count: num(total) }) }}</span>
    </form>

    <Transition name="models-bulk">
      <div v-if="selected.length" class="provs__bulk" role="region" :aria-label="$t('models.bulkLabel')">
        <span class="tb-num">{{ $t('models.selected', { count: num(selected.length) }) }}</span>
        <TbButton size="s" variant="quiet" @click="handleSelectAll">{{ allRowsSelected ? $t('models.deselectAll') : $t('models.selectAll') }}</TbButton>
        <TbButton size="s" variant="danger" icon="trash" @click="deleteSelectedProviders">{{ $t('common.delete') }}</TbButton>
      </div>
    </Transition>

    <TbTable v-model:selected="selected" :columns="columns" :rows="providersList" row-key="id" dense selectable :loading="loading"
      :caption="$t('nav.providers')" :loading-text="$t('common.loading')" :select-all-label="$t('models.selectAll')"
      :select-row-label="$t('models.select')">
      <template #cell-name="{ row }">
        <div class="provs__name">
          <span class="provs__label">{{ row.name }}</span>
          <code class="provs__code">{{ row.providerCode }}</code>
        </div>
      </template>
      <template #cell-modelType="{ row }">
        <TbTag>{{ getModelTypeLabel(row.modelType) }}</TbTag>
      </template>
      <template #cell-fields="{ row }">
        <button type="button" class="provs__fields" :aria-label="$t('providers.viewFieldsOf', { name: row.name })" @click="showFields(row)">
          <span class="tb-num">{{ $t('providers.fieldCount', { count: num(row.fields.length) }) }}</span>
          <TbIcon v-if="row.fields.some((f) => looksSensitive(f.key))" name="lock" :size="14" :label="$t('providers.hasSecret')" />
          <TbIcon name="chevron-right" :size="16" />
        </button>
      </template>
      <template #cell-sort="{ value }">
        <span class="tb-num provs__muted">{{ num(value ?? 0) }}</span>
      </template>
      <template #cell-actions="{ row }">
        <div class="provs__acts">
          <TbButton size="s" variant="quiet" icon="edit" :aria-label="$t('providers.editOf', { name: row.name })" :title="$t('common.edit')" @click="editProvider(row)" />
          <TbButton size="s" variant="quiet" icon="trash" class="is-danger" :aria-label="$t('providers.deleteOf', { name: row.name })" :title="$t('common.delete')" @click="deleteProvider(row)" />
        </div>
      </template>
      <template #empty>
        <TbEmpty v-if="failed" face="confused" :title="$t('providers.loadFailed')" :text="$t('common.loadFailed')">
          <TbButton icon="refresh" @click="fetchProviders">{{ $t('common.retry') }}</TbButton>
        </TbEmpty>
        <TbEmpty v-else-if="filtered" :title="$t('providers.noMatch')" :text="$t('providers.noMatchText')">
          <TbButton @click="clearFilters">{{ $t('providers.clearFilters') }}</TbButton>
        </TbEmpty>
        <TbEmpty v-else face="sleepy" :title="$t('providers.emptyTitle')" :text="$t('providers.emptyText')">
          <TbButton variant="primary" icon="plus" @click="showAddDialog">{{ $t('providers.add') }}</TbButton>
        </TbEmpty>
      </template>
    </TbTable>

    <TbPagination v-if="total > 0" :page="currentPage" :page-size="pageSize" :total="total" :sizes="pageSizeOptions"
      :total-text="$t('providers.count', { count: num(total) })" :size-suffix="$t('models.perPage')" :aria-label="$t('models.pages')"
      :prev-label="$t('models.prevPage')" :next-label="$t('models.nextPage')" :size-label="$t('models.rowsPerPage')"
      @update:page="goToPage" @update:page-size="handlePageSizeChange" />

    <ProviderSheet v-model:open="dialogVisible" :title="dialogTitle" :provider="providerForm" :model-types="translatedModelTypes"
      @submit="handleSubmit" />

    <TbSheet v-model:open="fieldsOpen" :title="fieldsOf ? $t('providers.fieldsOf', { name: fieldsOf.name }) : ''" size="s"
      :close-label="$t('common.close')">
      <template v-if="fieldsOf">
        <ul v-if="fieldsOf.fields.length" class="provs__flist">
          <li v-for="f in fieldsOf.fields" :key="f.key">
            <span class="provs__flabel">{{ f.label || f.key }}</span>
            <code class="provs__fkey">{{ f.key }}</code>
            <span class="provs__ftype">{{ fieldTypeLabel(f.type) }}</span>
            <TbTag v-if="looksSensitive(f.key)" ink="warn"><TbIcon name="lock" :size="12" />{{ $t('providers.secret') }}</TbTag>
          </li>
        </ul>
        <TbEmpty v-else :title="$t('providers.form.noFields')" />
      </template>
      <template #footer>
        <TbButton variant="secondary" icon="edit" @click="editFromFields">{{ $t('providers.editFields') }}</TbButton>
      </template>
    </TbSheet>
  </div>
</template>

<script>
import Api from '@/apis/api';
import { digits } from '@/kit/calendar';
import ProviderSheet from './ProviderSheet.vue';
import { FIELD_TYPES, PROVIDER_TYPES, looksSensitive, parseFields } from './modelForm';

// Providers (back office): the services models connect through, and the fields each one asks
// for (keys, endpoints, voices). Search by name, filter by category, add, edit, delete.
export default {
  name: 'ProviderManagement',
  components: { ProviderSheet },
  data() {
    return {
      searchName: '',
      searchModelType: '',
      appliedName: '',
      appliedType: '',
      providersList: [],
      selected: [],
      currentPage: 1,
      pageSize: 10,
      pageSizeOptions: [10, 20, 50, 100],
      total: 0,
      loading: false,
      failed: false,
      dialogVisible: false,
      dialogTitle: '',
      providerForm: null,
      fieldsOpen: false,
      fieldsOf: null,
    };
  },
  computed: {
    translatedModelTypes() {
      return PROVIDER_TYPES.map((v) => ({ value: v, label: this.$t(`providers.type.${v}`) }));
    },
    typeFilterOptions() {
      return [{ value: '', label: this.$t('providers.allTypes') }, ...this.translatedModelTypes];
    },
    columns() {
      return [
        { key: 'name', label: this.$t('providers.col.name') },
        { key: 'modelType', label: this.$t('providers.col.category') },
        { key: 'fields', label: this.$t('providers.col.fields') },
        { key: 'sort', label: this.$t('providers.col.sort'), align: 'right', width: '64px' },
        { key: 'actions', label: this.$t('models.actions'), align: 'right', width: '104px' },
      ];
    },
    allRowsSelected() {
      return this.providersList.length > 0 && this.selected.length === this.providersList.length;
    },
    filtered() { return Boolean(this.appliedName || this.appliedType); },
  },
  created() {
    this.fetchProviders();
  },
  methods: {
    looksSensitive,
    num(n) { return digits(n, this.$i18n?.locale); },
    fetchProviders() {
      this.loading = true;
      this.failed = false;
      const params = { page: this.currentPage, limit: this.pageSize, name: this.searchName, modelType: this.searchModelType };
      Api.model.getModelProvidersPage(params, ({ data }) => {
        this.loading = false;
        if (data.code === 0) {
          this.providersList = (data.data?.list || []).map((item) => ({ ...item, fields: parseFields(item.fields) }));
          this.total = data.data?.total || 0;
          this.appliedName = params.name;
          this.appliedType = params.modelType;
          const ids = new Set(this.providersList.map((p) => p.id));
          this.selected = this.selected.filter((id) => ids.has(id));
        } else {
          this.providersList = [];
          this.total = 0;
          this.failed = true;
          this.$message.error(data.msg || this.$t('providers.loadFailed'));
        }
      });
    },
    handleSearch() {
      this.currentPage = 1;
      this.fetchProviders();
    },
    clearFilters() {
      this.searchName = '';
      this.searchModelType = '';
      this.handleSearch();
    },
    handleSelectModelType(value) {
      this.searchModelType = value;
      this.handleSearch();
    },
    handleSelectAll() {
      this.selected = this.allRowsSelected ? [] : this.providersList.map((p) => p.id);
    },
    handlePageSizeChange(size) {
      this.pageSize = size;
      this.currentPage = 1;
      this.fetchProviders();
    },
    goToPage(page) {
      if (page !== this.currentPage) {
        this.currentPage = page;
        this.fetchProviders();
      }
    },
    showAddDialog() {
      this.dialogTitle = this.$t('providers.add');
      this.providerForm = { id: null, modelType: this.searchModelType || '', providerCode: '', name: '', fields: [], sort: 0 };
      this.dialogVisible = true;
    },
    editProvider(row) {
      this.dialogTitle = this.$t('providers.editTitle', { name: row.name });
      this.providerForm = { ...row, fields: JSON.parse(JSON.stringify(row.fields)) };
      this.dialogVisible = true;
    },
    showFields(row) {
      this.fieldsOf = row;
      this.fieldsOpen = true;
    },
    editFromFields() {
      const row = this.fieldsOf;
      this.fieldsOpen = false;
      if (row) setTimeout(() => this.editProvider(row), 180);
    },
    fieldTypeLabel(t) {
      return FIELD_TYPES.includes(t) ? this.$t(`providers.fieldType.${t}`) : t;
    },
    getModelTypeLabel(type) {
      return PROVIDER_TYPES.includes(type) ? this.$t(`providers.type.${type}`) : type;
    },
    handleSubmit({ form, done }) {
      const call = form.id ? Api.model.updateModelProvider : Api.model.addModelProvider;
      call.call(Api.model, form, ({ data }) => {
        if (data.code === 0) {
          this.$message.success(form.id ? this.$t('providers.updated') : this.$t('providers.added'));
          this.dialogVisible = false;
          this.fetchProviders();
        } else {
          this.$message.error(data.msg || (form.id ? this.$t('providers.updateFailed') : this.$t('providers.addFailed')));
        }
        if (done) done();
      });
    },
    deleteSelectedProviders() {
      const rows = this.providersList.filter((p) => this.selected.includes(p.id));
      if (!rows.length) {
        this.$message.warning(this.$t('providers.selectFirst'));
        return;
      }
      this.deleteProvider(rows);
    },
    deleteProvider(row) {
      const providers = Array.isArray(row) ? row : [row];
      const n = providers.length;
      const title = n === 1 && providers[0].name ? providers[0].name : this.$t('providers.deleteTitle');
      this.$confirm(this.$t('providers.confirmDelete', { count: this.num(n) }), title, {
        confirmText: this.$t('common.delete'), cancelText: this.$t('common.cancel'), danger: true,
      }).then(() => {
        Api.model.deleteModelProviderByIds(providers.map((p) => p.id), ({ data }) => {
          if (data.code === 0) {
            this.$message.success(this.$t('providers.deleted', { count: this.num(n) }));
            this.selected = [];
            this.fetchProviders();
          } else {
            this.$message.error(data.msg || this.$t('providers.deleteFailed'));
          }
        });
      }).catch(() => {});
    },
  },
};
</script>

<style>
.provs { padding-bottom: var(--tb-s10); }
.provs__filter { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: var(--tb-s4) 0 var(--tb-s3); }
.provs__search { flex: 0 1 300px; min-width: 0; }
.provs__type { width: 220px; }
.provs__total { margin-left: auto; color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.provs__bulk { display: flex; align-items: center; gap: var(--tb-s2); flex-wrap: wrap; padding: 0 0 10px; font-size: var(--tb-fs-14); font-weight: 600; }
.provs__name { display: grid; gap: 1px; min-width: 0; }
.provs__label { font-weight: 600; overflow-wrap: anywhere; }
.provs__code, .provs__fkey { color: var(--tb-ink-3); font-size: var(--tb-fs-12); font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; overflow-wrap: anywhere; }
.provs__fields {
  display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 8px 0 0; border: 0; background: none;
  color: var(--tb-ink); font-size: var(--tb-fs-14); text-decoration: underline; text-decoration-color: var(--tb-rule-soft); text-underline-offset: 4px;
}
.provs__fields .tb-icon[role="img"] { color: var(--tb-warn); }
.provs__fields:hover { text-decoration-color: currentColor; }
.provs__muted { color: var(--tb-ink-2); }
.provs__acts { display: inline-flex; gap: 2px; justify-content: flex-end; }
.provs__acts .is-danger { color: var(--tb-danger); }
.provs__flist { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--tb-rule); }
.provs__flist li {
  display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 2px 10px; padding: 10px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.provs__flabel { font-weight: 600; }
.provs__ftype { grid-row: 1; grid-column: 2; color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.provs__flist .tb-tag { grid-column: 2; justify-self: end; }
@media (max-width: 640px) {
  .provs__search { flex: 1 1 100%; }
  .provs__type { flex: 1 1 auto; width: auto; }
  .provs__total { flex-basis: 100%; margin-left: 0; }
  .provs__acts { justify-content: flex-start; }
  .provs .tb-table .tb-btn--s { --h: 44px; }
  .provs .tb-table td > .tb-tag { justify-self: start; }
}
</style>
