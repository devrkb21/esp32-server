<template>
  <div class="nx-admin">
    <HeaderBar />
    <main class="nx-page">
      <header class="nx-page-header">
        <div class="nx-page-header__text">
          <h1 class="nx-title">{{ $t('header.providerManagement') }}</h1>
          <p class="nx-page-header__desc">{{ tt('providerManagement.pageDesc', 'Model providers and the fields each one needs, like keys and endpoints.') }}</p>
        </div>
        <div class="nx-page-header__actions">
          <el-input v-model="searchName" class="admin-search" prefix-icon="el-icon-search" clearable
            :placeholder="$t('providerManagement.searchPlaceholder')" :aria-label="$t('common.search')"
            @keyup.enter.native="handleSearch" @clear="handleSearch" />
          <el-select :value="searchModelType" class="type-filter" :aria-label="$t('providerManagement.categoryFilter')"
            @change="handleSelectModelType">
            <el-option value="" :label="$t('common.all')" />
            <el-option v-for="item in translatedModelTypes" :key="item.value" :value="item.value" :label="item.label" />
          </el-select>
          <CustomButton type="add" icon="el-icon-plus" @click="showAddDialog">{{ $t('common.addProvider') }}</CustomButton>
        </div>
      </header>

      <section class="nx-card nx-card--flush table-card">
        <div class="table-card__toolbar">
          <el-checkbox :value="allRowsSelected" :indeterminate="selectedCount > 0 && !allRowsSelected"
            :disabled="!providersList.length" @change="handleSelectAll">
            {{ selectedCount ? tt('providerManagement.selectedCount', '{count} selected', { count: selectedCount }) : $t('common.selectAll') }}
          </el-checkbox>
          <span class="nx-spacer"></span>
          <CustomButton size="small" type="delete" icon="el-icon-delete" :disabled="!selectedCount"
            @click="deleteSelectedProviders">
            {{ $t('common.delete') }}
          </CustomButton>
        </div>

        <div v-if="!loading && !providersList.length" class="nx-empty">
          <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true"><i class="el-icon-connection"></i></span>
          <template v-if="searchName || searchModelType">
            <p class="nx-empty__title">{{ tt('providerManagement.emptySearchTitle', 'No providers match these filters') }}</p>
            <p class="nx-empty__text">{{ tt('providerManagement.emptySearchText', 'Try another name or category.') }}</p>
            <CustomButton class="nx-empty__action" @click="clearFilters">{{ tt('providerManagement.clearFilters', 'Clear filters') }}</CustomButton>
          </template>
          <template v-else>
            <p class="nx-empty__title">{{ tt('providerManagement.emptyTitle', 'No providers yet') }}</p>
            <p class="nx-empty__text">{{ tt('providerManagement.emptyText', 'Add a provider to describe how models connect.') }}</p>
            <CustomButton class="nx-empty__action" type="add" icon="el-icon-plus" @click="showAddDialog">
              {{ $t('common.addProvider') }}
            </CustomButton>
          </template>
        </div>

        <div v-else class="table-card__body" :style="{ '--rows': filteredProvidersList.length }">
          <CustomTable
            ref="providersTable"
            :data="filteredProvidersList"
            :columns="tableColumns"
            :loading="loading"
            :show-selection="true"
            :show-operations="true"
            :operations-label="$t('common.action')"
            :operations-width="160"
            :total="total"
            :current-page="currentPage"
            :page-size="pageSize"
            :page-size-options="pageSizeOptions"
            @size-change="handlePageSizeChange"
            @page-change="goToPage"
          >
            <template slot="selection" slot-scope="scope">
              <el-checkbox v-model="scope.row.selected" :aria-label="scope.row.name"></el-checkbox>
            </template>
            <template slot="name" slot-scope="scope">
              <div class="provider-cell">
                <div class="provider-cell__name nx-truncate" :title="scope.row.name">{{ scope.row.name }}</div>
                <div class="nx-caption nx-mono nx-truncate" :title="scope.row.providerCode">{{ scope.row.providerCode }}</div>
              </div>
            </template>
            <template slot="modelType" slot-scope="scope">
              <span class="nx-badge" :class="modelTypeBadge(scope.row.modelType)">{{ getModelTypeLabel(scope.row.modelType) }}</span>
            </template>
            <template slot="fields" slot-scope="scope">
              <el-popover placement="bottom-start" width="360" trigger="click" popper-class="provider-fields-popover">
                <div class="fields-pop">
                  <p class="fields-pop__title">{{ $t('providerManagement.fieldConfig') }}</p>
                  <div v-for="field in scope.row.fields" :key="field.key" class="fields-pop__row">
                    <span class="fields-pop__label nx-truncate" :title="field.key">{{ field.label }}</span>
                    <span class="fields-pop__type nx-mono">{{ field.type }}</span>
                    <span v-if="isSensitiveField(field.key)" class="nx-badge nx-badge--warning">
                      <i class="el-icon-lock" aria-hidden="true"></i>{{ $t('common.sensitive') }}
                    </span>
                  </div>
                  <p v-if="!scope.row.fields || !scope.row.fields.length" class="fields-pop__empty">—</p>
                </div>
                <el-button slot="reference" size="mini" type="text" class="fields-btn">
                  <span class="nx-num">{{ (scope.row.fields || []).length }}</span>
                  {{ $t('providerManagement.viewFields') }}
                </el-button>
              </el-popover>
            </template>
            <template slot="sort" slot-scope="scope">
              <span class="nx-num nx-muted">{{ scope.row.sort }}</span>
            </template>
            <template slot="operations" slot-scope="scope">
              <div class="row-actions">
                <el-button size="mini" type="text" @click="editProvider(scope.row)">{{ $t('common.edit') }}</el-button>
                <el-button size="mini" type="text" class="row-action--danger" @click="deleteProvider(scope.row)">{{ $t('common.delete') }}</el-button>
              </div>
            </template>
          </CustomTable>
        </div>
      </section>
    </main>

    <!-- Add/Edit Provider Dialog -->
    <provider-dialog :title="dialogTitle" :visible.sync="dialogVisible" :form="providerForm" :model-types="modelTypes"
      @submit="handleSubmit" @cancel="dialogVisible = false" />

    <VersionFooter />
  </div>
</template>

<script>
import Api from "@/apis/api";
import HeaderBar from "@/components/HeaderBar.vue";
import ProviderDialog from "@/components/ProviderDialog.vue";
import VersionFooter from "@/components/VersionFooter.vue";
import CustomButton from "@/components/CustomButton.vue";
import CustomTable from "@/components/CustomTable.vue";

export default {
  components: { HeaderBar, ProviderDialog, VersionFooter, CustomButton, CustomTable },
  data() {
    return {
      searchName: "",
      searchModelType: "",
      providersList: [],
      modelTypes: [
        { value: "ASR", labelKey: 'providerManagement.modelType.ASR' },
        { value: "TTS", labelKey: 'providerManagement.modelType.TTS' },
        { value: "LLM", labelKey: 'providerManagement.modelType.LLM' },
        { value: "VLLM", labelKey: 'providerManagement.modelType.VLLM' },
        { value: "Intent", labelKey: 'providerManagement.modelType.Intent' },
        { value: "Memory", labelKey: 'providerManagement.modelType.Memory' },
        { value: "VAD", labelKey: 'providerManagement.modelType.VAD' },
        { value: "Plugin", labelKey: 'providerManagement.modelType.Plugin' },
        { value: "RAG", labelKey: 'providerManagement.modelType.RAG' }
      ],
      currentPage: 1,
      loading: false,
      pageSize: 10,
      pageSizeOptions: [10, 20, 50, 100],
      total: 0,
      dialogVisible: false,
      dialogTitle: "Add Provider",
      isAllSelected: false,
      DropdownVisible: false,
      sensitive_keys: ["api_key", "personal_access_token", "access_token", "token", "secret", "access_key_secret", "secret_key"],
      providerForm: {
        id: null,
        modelType: "",
        providerCode: "",
        name: "",
        fields: [],
        sort: 0
      },
      tableColumns: []
    };
  },
  created() {
    this.initTableColumns();
    this.fetchProviders();
  },
  computed: {
    translatedModelTypes() {
      return this.modelTypes.map(type => ({
        value: type.value,
        label: this.$t(type.labelKey)
      }));
    },
    selectedModelTypeLabel() {
      if (!this.searchModelType) return `（${this.$t('providerManagement.all')}）`;
      const selectedType = this.modelTypes.find(item => item.value === this.searchModelType);
      return selectedType ? `（${this.$t(selectedType.labelKey)}）` : "";
    },
    filteredProvidersList() {
      return this.providersList;
    },
    selectedCount() {
      return this.providersList.filter(row => row.selected).length;
    },
    allRowsSelected() {
      return this.providersList.length > 0 && this.selectedCount === this.providersList.length;
    }
  },
  methods: {
    // $t with an English fallback for keys that are still pending in src/i18n/_pending/web-system.js
    tt(key, fallback, params) {
      if (this.$te(key) || this.$te(key, 'en')) return this.$t(key, params);
      return String(fallback).replace(/\{(\w+)\}/g, (m, k) => (params && params[k] != null ? params[k] : m));
    },
    initTableColumns() {
      this.tableColumns = [
        { prop: 'name', label: this.$t('common.name'), align: 'left', minWidth: 220, showOverflowTooltip: false },
        { prop: 'modelType', label: this.$t('providerManagement.category'), align: 'left', minWidth: 180, showOverflowTooltip: false },
        { prop: 'fields', label: this.$t('providerManagement.fieldConfig'), align: 'left', minWidth: 160, showOverflowTooltip: false },
        { prop: 'sort', label: this.$t('common.sort'), align: 'right', width: 80 }
      ];
    },
    fetchProviders() {
      this.loading = true;

      Api.model.getModelProvidersPage(
        {
          page: this.currentPage,
          limit: this.pageSize,
          name: this.searchName,
          modelType: this.searchModelType
        },
        ({ data }) => {
          this.loading = false;
          if (data.code === 0) {
            this.providersList = data.data.list.map(item => {
              let fields = [];
              try {
                fields = JSON.parse(item.fields) || [];
              } catch (e) {
                fields = [];
              }
              return {
                ...item,
                selected: false,
                fields
              };
            });
            this.total = data.data.total;
            this.isAllSelected = false;
          } else {
            this.$message.error({
              message: data.msg || 'Failed to get parameter list'
            });
          }
        }
      );
    },
    handleSearch() {
      this.currentPage = 1;
      this.fetchProviders();
    },
    clearFilters() {
      this.searchName = "";
      this.searchModelType = "";
      this.handleSearch();
    },
    handleSelectModelType(value) {
      this.searchModelType = value;
      this.handleSearch();
    },
    handleSelectAll() {
      this.isAllSelected = !this.allRowsSelected;
      this.providersList.forEach(row => {
        row.selected = this.isAllSelected;
      });
    },
    showAddDialog() {
      this.dialogTitle = this.$t('common.addProvider');
      this.providerForm = {
        id: null,
        modelType: "",
        providerCode: "",
        name: "",
        fields: [],
        sort: 0
      };
      this.dialogVisible = true;
    },
    editProvider(row) {
      this.dialogTitle = this.$t('common.editProvider');
      this.providerForm = {
        ...row,
        fields: JSON.parse(JSON.stringify(row.fields))
      };
      this.dialogVisible = true;
    },
    handleSubmit({ form, done }) {
      if (form.id) {
        Api.model.updateModelProvider(form, ({ data }) => {
          if (data.code === 0) {
            this.fetchProviders();
            this.$message.success({
              message: this.$t('common.updateSuccess'),
              showClose: true
            });
            this.dialogVisible = false;
          } else {
            this.$message.error({
              message: data.msg || this.$t('common.updateFailure'),
              showClose: true
            });
          }
          done && done();
        });
      } else {
        Api.model.addModelProvider(form, ({ data }) => {
          if (data.code === 0) {
            this.fetchProviders();
            this.$message.success({
              message: this.$t('common.addSuccess'),
              showClose: true
            });
            this.total += 1;
            this.dialogVisible = false;
          } else {
            this.$message.error({
              message: data.msg || this.$t('common.addFailure'),
              showClose: true
            });
          }
          done && done();
        });
      }
    },
    deleteSelectedProviders() {
      const selectedRows = this.providersList.filter(row => row.selected);
      if (selectedRows.length === 0) {
        this.$message.warning({
          message: this.$t('providerManagement.selectToDelete'),
          showClose: true
        });
        return;
      }
      this.deleteProvider(selectedRows);
    },
    deleteProvider(row) {
      const providers = Array.isArray(row) ? row : [row];
      const providerCount = providers.length;
      const title = providerCount === 1 && providers[0].name ? providers[0].name : this.$t('common.warning');

      this.$confirm(this.$t('providerManagement.confirmDelete', { count: providerCount }), title, {
        confirmButtonText: this.$t('common.delete'),
        cancelButtonText: this.$t('common.cancel'),
        confirmButtonClass: 'el-button--danger',
        type: 'warning',
      }).then(() => {
        const ids = providers.map(provider => provider.id);
        Api.model.deleteModelProviderByIds(ids, ({ data }) => {
          if (data.code === 0) {
            this.isAllSelected = false;
            this.fetchProviders();
            this.$message.success({
              message: this.$t('common.deleteSuccess'),
              showClose: true
            });
          } else {
            this.$message.error({
              message: data.msg || this.$t('common.deleteFailure'),
              showClose: true
            });
          }
        });
      }).catch(() => {
        this.$message({
          type: 'info',
          message: this.$t('common.deleteCancelled'),
          showClose: true,
          duration: 1000
        });
      });
    },
    getModelTypeTag(type) {
      const typeMap = {
        'ASR': 'success',
        'TTS': 'warning',
        'LLM': 'danger',
        'Intent': 'info',
        'Memory': '',
        'VAD': 'primary',
        'RAG': 'warning'
      };
      return typeMap[type] || '';
    },
    // Category badges stay calm: language/vision models in info, everything else neutral
    modelTypeBadge(type) {
      return ['LLM', 'VLLM'].includes(type) ? 'nx-badge--info' : '';
    },
    getModelTypeLabel(type) {
      const typeItem = this.modelTypes.find(item => item.value === type);
      return typeItem ? this.$t(typeItem.labelKey) : type;
    },
    isSensitiveField(fieldKey) {
      if (typeof fieldKey !== 'string') return false;
      return this.sensitive_keys.some(key =>
        fieldKey.toLowerCase().includes(key.toLowerCase())
      );
    },
    handlePageSizeChange(val) {
      this.pageSize = val;
      this.currentPage = 1;
      this.fetchProviders();
    },
    goToPage(page) {
      if (page !== this.currentPage) {
        this.currentPage = page;
        this.fetchProviders();
      }
    },
    handleDropdownVisibleChange(visible) {
      this.DropdownVisible = visible;
    }
  }
};
</script>

<style lang="scss" scoped>
// Admin page family: page header + one table card (shared look across the "More" pages)
.nx-admin {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  > .nx-page {
    flex: 1 0 auto;
  }
}
.admin-search {
  width: 260px;
  max-width: 100%;
}
.type-filter {
  width: 200px;
  max-width: 100%;
}
.table-card {
  display: flex;
  flex-direction: column;
  &__toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--nx-space-2);
    min-height: 56px;
    padding: var(--nx-space-3) var(--nx-space-5);
    border-bottom: 1px solid var(--nx-border);
    ::v-deep .el-checkbox__label {
      font-size: var(--nx-text-footnote);
      color: var(--nx-text-2);
      font-variant-numeric: tabular-nums;
    }
  }
  // Height follows the row count, capped to the viewport; the table body scrolls inside
  &__body {
    height: clamp(280px, calc(var(--rows, 0) * 61px + 100px), max(440px, calc(100vh - 300px)));
    ::v-deep .custom-table-wrapper {
      height: 100%;
    }
    ::v-deep .table-container {
      border: 0;
      border-radius: 0;
      box-shadow: none;
    }
    ::v-deep .table-footer {
      height: 48px;
      padding: 0 var(--nx-space-5);
      border-top: 1px solid var(--nx-border);
      flex-wrap: nowrap;
      overflow-x: auto;
    }
    ::v-deep th.el-table__cell:last-child .cell,
    ::v-deep td.el-table__cell:last-child .cell {
      text-align: right;
    }
  }
}
.row-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 2px;
  .el-button + .el-button {
    margin-left: 0;
  }
}
.row-action--danger.el-button--text {
  color: var(--nx-danger);
  &:hover,
  &:focus {
    color: var(--nx-danger);
    background: var(--nx-danger-soft);
  }
}

.provider-cell {
  min-width: 0;
  &__name {
    font-weight: 600;
    color: var(--nx-text);
  }
}
.fields-btn {
  margin-left: -8px;
  .nx-num {
    margin-right: 2px;
  }
}
</style>

<style lang="scss">
// Popover is appended to <body>, so this block is not scoped
.provider-fields-popover {
  padding: var(--nx-space-3) var(--nx-space-4);
  .fields-pop {
    max-height: 50vh;
    overflow-y: auto;
    &__title {
      margin: 0 0 var(--nx-space-2);
      font-size: var(--nx-text-caption);
      font-weight: 600;
      color: var(--nx-text-2);
    }
    &__row {
      display: flex;
      align-items: center;
      gap: var(--nx-space-2);
      min-height: 36px;
      border-top: 1px solid var(--nx-border);
    }
    &__label {
      flex: 1;
      font-size: var(--nx-text-callout);
      color: var(--nx-text);
    }
    &__type {
      color: var(--nx-text-3);
      font-size: var(--nx-text-caption);
    }
    &__empty {
      margin: 0;
      color: var(--nx-text-3);
    }
  }
}
</style>
