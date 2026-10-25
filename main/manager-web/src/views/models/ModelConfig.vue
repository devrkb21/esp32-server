<template>
  <div class="models">
    <TbPageHeader :title="$t('nav.models')" :description="$t('models.pageDesc')">
      <template #actions>
        <TbButton variant="primary" icon="plus" @click="addModel">{{ $t('models.add') }}</TbButton>
      </template>
    </TbPageHeader>

    <TbTabs v-model="activeTab" :items="tabs" :aria-label="$t('models.types')" class="models__tabs" @change="handleMenuSelect" />

    <div class="models__head">
      <div class="models__title">
        <h2>{{ $t(`models.type.${activeTab}`) }}</h2>
        <span v-if="!loading && !failed" class="models__total tb-num">{{ $t('models.count', { count: num(total) }) }}</span>
      </div>
      <form class="models__filter" role="search" @submit.prevent="handleSearch">
        <TbInput v-model="search" icon="search" clearable size="s" class="models__search"
          :placeholder="$t('models.searchPh')" :aria-label="$t('models.search')" :clear-label="$t('models.clear')" @clear="handleSearch" />
        <TbButton size="s" native-type="submit">{{ $t('common.search') }}</TbButton>
      </form>
    </div>

    <Transition name="models-bulk">
      <div v-if="selected.length" class="models__bulk" role="region" :aria-label="$t('models.bulkLabel')">
        <span class="tb-num">{{ $t('models.selected', { count: num(selected.length) }) }}</span>
        <TbButton size="s" variant="quiet" @click="selectAll">{{ isAllSelected ? $t('models.deselectAll') : $t('models.selectAll') }}</TbButton>
        <TbButton size="s" variant="danger" icon="trash" @click="batchDelete">{{ $t('common.delete') }}</TbButton>
      </div>
    </Transition>

    <TbTable v-model:selected="selected" :columns="columns" :rows="modelList" row-key="id" dense selectable :loading="loading"
      :row-class="(r) => (r.isDefault === 1 ? 'is-default' : null)" :caption="$t(`models.type.${activeTab}`)"
      :loading-text="$t('common.loading')" :select-all-label="$t('models.selectAll')" :select-row-label="$t('models.select')"
      class="models__table">
      <template #cell-modelName="{ row }">
        <div class="models__name">
          <span class="models__label">{{ row.modelName || '–' }}</span>
          <TbTag v-if="row.isDefault === 1" variant="solid" class="models__default">{{ $t('models.default') }}</TbTag>
          <code class="models__id">{{ row.id }}</code>
        </div>
      </template>
      <template #cell-provider="{ row }">
        <span class="models__provider">{{ row.configJson?.type || $t('models.unknown') }}</span>
      </template>
      <template #cell-isEnabled="{ row }">
        <span v-if="row.isDefault === 1 && row.isEnabled === 1" class="models__lock" :title="$t('models.defaultLocked')">
          <TbSwitch :model-value="true" disabled :aria-label="$t('models.enabledOf', { name: row.modelName || row.id })" />
          <span class="tb-visually-hidden">{{ $t('models.defaultLocked') }}</span>
        </span>
        <TbSwitch v-else :model-value="row.isEnabled === 1" :loading="busy === `en-${row.id}`"
          :aria-label="$t('models.enabledOf', { name: row.modelName || row.id })" @update:model-value="handleStatusChange(row, $event)" />
      </template>
      <template #cell-sort="{ value }">
        <span class="tb-num models__muted">{{ value === undefined || value === null ? '–' : num(value) }}</span>
      </template>
      <template #cell-voices="{ row }">
        <TbButton size="s" variant="secondary" icon="voice" @click="openTtsDialog(row)">{{ $t('models.voicesBtn') }}</TbButton>
      </template>
      <template #cell-actions="{ row }">
        <div class="models__acts">
          <TbButton v-if="row.isDefault !== 1" size="s" variant="quiet" :loading="busy === `def-${row.id}`" @click="handleDefaultChange(row)">
            {{ $t('models.setDefault') }}
          </TbButton>
          <TbButton size="s" variant="quiet" icon="edit" :aria-label="$t('models.editOf', { name: row.modelName || row.id })" :title="$t('common.edit')" @click="editModel(row)" />
          <TbButton size="s" variant="quiet" icon="copy" :aria-label="$t('models.duplicateOf', { name: row.modelName || row.id })" :title="$t('models.duplicate')" @click="duplicateModel(row)" />
          <TbButton size="s" variant="quiet" icon="trash" class="is-danger" :aria-label="$t('models.deleteOf', { name: row.modelName || row.id })" :title="$t('common.delete')" @click="deleteModel(row)" />
        </div>
      </template>
      <template #empty>
        <TbEmpty v-if="failed" face="confused" :title="$t('models.loadFailed')" :text="$t('common.loadFailed')">
          <TbButton icon="refresh" @click="loadData">{{ $t('common.retry') }}</TbButton>
        </TbEmpty>
        <TbEmpty v-else-if="searched" :title="$t('models.noMatch')" :text="$t('models.noMatchText')">
          <TbButton @click="clearSearch">{{ $t('models.clearSearch') }}</TbButton>
        </TbEmpty>
        <TbEmpty v-else face="sleepy" :title="$t('models.emptyTitle')" :text="$t('models.emptyText')">
          <TbButton variant="primary" icon="plus" @click="addModel">{{ $t('models.add') }}</TbButton>
        </TbEmpty>
      </template>
    </TbTable>

    <TbPagination v-if="total > 0" :page="currentPage" :page-size="pageSize" :total="total" :sizes="pageSizeOptions"
      :total-text="$t('models.count', { count: num(total) })" :size-suffix="$t('models.perPage')" :aria-label="$t('models.pages')"
      :prev-label="$t('models.prevPage')" :next-label="$t('models.nextPage')" :size-label="$t('models.rowsPerPage')"
      @update:page="handlePageChange" @update:page-size="handlePageSizeChange" />

    <ModelSheet v-model:open="editDialogVisible" :mode="editMode" :model-type="activeTab" :model="editModelData" @save="handleModelSave" />
    <ModelSheet v-model:open="addDialogVisible" mode="add" :model-type="activeTab" @confirm="handleAddConfirm" />
    <TtsVoicesSheet v-model:open="ttsDialogVisible" :model="selectedModelConfig" />
  </div>
</template>

<script>
import Api from '@/apis/api';
import { digits } from '@/kit/calendar';
import ModelSheet from './ModelSheet.vue';
import TtsVoicesSheet from './TtsVoicesSheet.vue';
import { MODEL_TYPES } from './modelForm';

// Models (back office): the AI services robots use, one tab per kind. List, search, enable,
// set the default, add, edit, duplicate, delete; TTS models also manage their voices.
export default {
  name: 'ModelConfig',
  components: { ModelSheet, TtsVoicesSheet },
  data() {
    return {
      activeTab: 'llm',
      search: '',
      searched: '',
      modelList: [],
      total: 0,
      currentPage: 1,
      pageSize: 10,
      pageSizeOptions: [10, 20, 50, 100],
      selected: [],
      loading: false,
      failed: false,
      busy: '',
      addDialogVisible: false,
      editDialogVisible: false,
      editMode: 'edit',
      editModelData: {},
      ttsDialogVisible: false,
      selectedModelConfig: null,
    };
  },
  computed: {
    tabs() {
      return MODEL_TYPES.map((t) => ({ key: t.key, label: this.$t(`models.tab.${t.key}`) }));
    },
    columns() {
      const c = [
        { key: 'modelName', label: this.$t('models.col.name') },
        { key: 'provider', label: this.$t('models.col.provider') },
        { key: 'isEnabled', label: this.$t('models.col.enabled'), width: '96px' },
        { key: 'sort', label: this.$t('models.col.sort'), width: '64px', align: 'right' },
      ];
      if (this.activeTab === 'tts') c.push({ key: 'voices', label: this.$t('models.col.voices'), width: '120px' });
      c.push({ key: 'actions', label: this.$t('models.actions'), align: 'right', width: '232px' });
      return c;
    },
    isAllSelected() {
      return this.modelList.length > 0 && this.selected.length === this.modelList.length;
    },
  },
  created() {
    const q = this.$route?.query?.type;
    if (q && MODEL_TYPES.some((t) => t.key === q)) this.activeTab = q;
    this.loadData();
  },
  methods: {
    num(n) { return digits(n, this.$i18n?.locale); },
    handleMenuSelect(key) {
      this.currentPage = 1;
      this.pageSize = 10;
      this.selected = [];
      if (this.$route && this.$router && this.$route.query?.type !== key) {
        this.$router.replace({ query: { ...this.$route.query, type: key } }).catch(() => {});
      }
      this.loadData();
    },
    handleSearch() {
      this.currentPage = 1;
      this.loadData();
    },
    clearSearch() {
      this.search = '';
      this.handleSearch();
    },
    handlePageChange(page) {
      this.currentPage = page;
      this.loadData();
    },
    handlePageSizeChange(size) {
      this.pageSize = size;
      this.currentPage = 1;
      this.loadData();
    },
    loadData() {
      this.loading = true;
      this.failed = false;
      const type = this.activeTab;
      const params = { modelType: type, modelName: this.search, page: this.currentPage, limit: this.pageSize };
      Api.model.getModelList(params, ({ data }) => {
        if (type !== this.activeTab) return;
        this.loading = false;
        if (data.code === 0) {
          this.modelList = data.data?.list || [];
          this.total = data.data?.total || 0;
          this.searched = params.modelName;
          const ids = new Set(this.modelList.map((m) => m.id));
          this.selected = this.selected.filter((id) => ids.has(id));
        } else {
          this.modelList = [];
          this.total = 0;
          this.failed = true;
          this.$message.error(data.msg || this.$t('models.loadFailed'));
        }
      });
    },
    selectAll() {
      this.selected = this.isAllSelected ? [] : this.modelList.map((m) => m.id);
    },
    addModel() { this.addDialogVisible = true; },
    editModel(model) {
      this.editModelData = JSON.parse(JSON.stringify(model));
      this.editMode = 'edit';
      this.editDialogVisible = true;
    },
    duplicateModel(model) {
      this.editModelData = { ...JSON.parse(JSON.stringify(model)), duplicateMode: true };
      this.editMode = 'duplicate';
      this.editDialogVisible = true;
    },
    openTtsDialog(row) {
      this.selectedModelConfig = row;
      this.ttsDialogVisible = true;
    },
    deleteModel(model) {
      this.$confirm(this.$t('models.confirmDelete'), model.modelName || this.$t('models.deleteTitle'), {
        confirmText: this.$t('common.delete'), cancelText: this.$t('common.cancel'), danger: true,
      }).then(() => {
        Api.model.deleteModel(model.id, ({ data }) => {
          if (data.code === 0) {
            this.$message.success(this.$t('models.deleted'));
            this.loadData();
          } else {
            this.$message.error(data.msg || this.$t('models.deleteFailed'));
          }
        });
      }).catch(() => {});
    },
    batchDelete() {
      const picked = this.modelList.filter((m) => this.selected.includes(m.id));
      if (!picked.length) {
        this.$message.warning(this.$t('models.selectFirst'));
        return;
      }
      this.$confirm(this.$t('models.confirmBatchDelete', { count: this.num(picked.length) }), this.$t('models.deleteTitle'), {
        confirmText: this.$t('common.delete'), cancelText: this.$t('common.cancel'), danger: true,
      }).then(() => {
        const calls = picked.map((m) => new Promise((resolve) => {
          Api.model.deleteModel(m.id, ({ data }) => resolve(data.code === 0));
        }));
        Promise.all(calls).then((results) => {
          if (results.every(Boolean)) this.$message.success(this.$t('models.batchDeleted'));
          else this.$message.error(this.$t('models.partialDeleteFailed'));
          this.selected = [];
          this.loadData();
        });
      }).catch(() => {});
    },
    // Enable / disable, shown at once and rolled back if the server says no.
    handleStatusChange(model, on) {
      const newStatus = on ? 1 : 0;
      const original = model.isEnabled;
      model.isEnabled = newStatus;
      this.busy = `en-${model.id}`;
      Api.model.updateModelStatus(model.id, newStatus, ({ data }) => {
        this.busy = '';
        if (data.code === 0) {
          this.$message.success(newStatus === 1 ? this.$t('models.enabledOk') : this.$t('models.disabledOk'));
          this.loadData();
        } else {
          model.isEnabled = original;
          this.$message.error(data.msg || this.$t('models.operationFailed'));
        }
      });
    },
    handleDefaultChange(model) {
      this.busy = `def-${model.id}`;
      Api.model.setDefaultModel(model.id, ({ data }) => {
        this.busy = '';
        if (data.code === 0) {
          this.$message.success(this.$t('models.defaultSet'));
          this.loadData();
        } else if (data.msg) {
          this.$message.error(data.msg);
        }
      });
    },
    handleAddConfirm(newModel) {
      const params = {
        modelType: this.activeTab,
        provideCode: newModel.provideCode,
        formData: { ...newModel, isDefault: newModel.isDefault ? 1 : 0, isEnabled: newModel.isEnabled ? 1 : 0, configJson: newModel.configJson },
      };
      Api.model.addModel(params, ({ data }) => {
        if (data.code === 0) {
          this.$message.success(this.$t('models.added'));
          this.loadData();
        } else {
          this.$message.error(data.msg || this.$t('models.addFailed'));
        }
      });
    },
    handleModelSave({ provideCode, formData, done }) {
      const modelType = this.activeTab;
      if (this.editModelData.duplicateMode) {
        const copy = { ...formData, id: '' };
        Api.model.addModel({ modelType, provideCode, formData: copy }, ({ data }) => {
          if (data.code === 0) {
            this.$message.success(this.$t('models.duplicated'));
            this.loadData();
            this.editDialogVisible = false;
          } else {
            this.$message.error(data.msg || this.$t('models.duplicateFailed'));
          }
          if (done) done();
        });
      } else {
        Api.model.updateModel({ modelType, provideCode, id: formData.id, formData }, ({ data }) => {
          if (data.code === 0) {
            this.$message.success(this.$t('models.saved'));
            this.loadData();
            this.editDialogVisible = false;
          } else {
            this.$message.error(data.msg || this.$t('models.saveFailed'));
          }
          if (done) done();
        });
      }
    },
  },
};
</script>

<style>
.models { padding-bottom: var(--tb-s10); }
.models__tabs { margin-top: var(--tb-s4); }
.models__head {
  display: flex; align-items: center; justify-content: space-between; gap: var(--tb-s3); flex-wrap: wrap;
  padding: var(--tb-s4) 0 var(--tb-s3);
}
.models__title { display: flex; align-items: baseline; gap: var(--tb-s3); flex-wrap: wrap; min-width: 0; }
.models__title h2 { font-size: var(--tb-fs-20); }
.models__total { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.models__filter { display: flex; gap: 8px; align-items: center; flex: 0 1 380px; }
.models__search { flex: 1; min-width: 0; }
.models__bulk {
  display: flex; align-items: center; gap: var(--tb-s2); flex-wrap: wrap; padding: 6px 0 10px;
  font-size: var(--tb-fs-14); font-weight: 600;
}
.models-bulk-enter-active, .models-bulk-leave-active { transition: opacity var(--tb-t-fast) var(--tb-ease), transform var(--tb-t-fast) var(--tb-ease); }
.models-bulk-enter-from, .models-bulk-leave-to { opacity: 0; transform: translateY(-4px); }

.models__name { display: flex; align-items: center; flex-wrap: wrap; gap: 2px 8px; min-width: 0; }
.models__label { font-weight: 600; overflow-wrap: anywhere; }
.tb-tag.models__default { --ink: var(--tb-action); height: 20px; padding: 0 7px; }
.models__id {
  flex-basis: 100%; color: var(--tb-ink-3); font-size: var(--tb-fs-12);
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; overflow-wrap: anywhere;
}
.models__provider { font-size: var(--tb-fs-13); color: var(--tb-ink-2); overflow-wrap: anywhere; }
.models__muted { color: var(--tb-ink-2); }
.models__lock { display: inline-flex; cursor: help; }
.models__acts { display: inline-flex; align-items: center; justify-content: flex-end; gap: 2px; flex-wrap: wrap; }
.models__acts .is-danger { color: var(--tb-danger); }

@media (max-width: 640px) {
  .models__filter { flex: 1 1 100%; }
  .models__acts { justify-content: flex-start; }
  .models__table .tb-btn--s { --h: 44px; }
  .models__name { justify-content: flex-start; }
}
</style>
