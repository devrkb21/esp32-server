<template>
  <div class="nx-admin">
    <HeaderBar />
    <main class="nx-page">
      <header class="nx-page-header">
        <div class="nx-page-header__text">
          <h1 class="nx-title">{{ $t('replacementWordManagement.pageTitle') }}</h1>
          <p class="nx-page-header__desc">{{ tt('replacementWordManagement.pageDesc', 'Word lists that fix how speech is heard, one original|replacement pair per line.') }}</p>
        </div>
        <div class="nx-page-header__actions">
          <el-input v-model="searchKeyword" class="admin-search" prefix-icon="el-icon-search" clearable
            :placeholder="$t('replacementWordManagement.searchPlaceholder')"
            :aria-label="$t('replacementWordManagement.search')" @keyup.enter.native="handleSearch" />
          <CustomButton type="add" icon="el-icon-plus" @click="handleAdd">
            {{ $t('replacementWordManagement.addFile') }}
          </CustomButton>
        </div>
      </header>

      <section class="nx-card nx-card--flush table-card">
        <div class="table-card__toolbar">
          <el-checkbox :value="allSelected" :indeterminate="selectedCount > 0 && !allSelected"
            :disabled="!filteredParamsList.length" @change="handleSelectAll">
            {{ selectedCount ? tt('replacementWordManagement.selectedCount', '{count} selected', { count: selectedCount }) : $t('user.selectAll') }}
          </el-checkbox>
          <span class="nx-spacer"></span>
          <CustomButton size="small" type="delete" icon="el-icon-delete" :disabled="!selectedCount" @click="handleBatchDelete">
            {{ $t('replacementWordManagement.batchDelete') }}
          </CustomButton>
        </div>

        <div v-if="!loading && !filteredParamsList.length" class="nx-empty">
          <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true"><i class="el-icon-document"></i></span>
          <template v-if="searchKeyword && paramsList.length">
            <p class="nx-empty__title">{{ tt('replacementWordManagement.emptySearchTitle', 'No files match your search') }}</p>
            <p class="nx-empty__text">{{ tt('replacementWordManagement.emptySearchText', 'Try another file name or clear the search.') }}</p>
            <CustomButton class="nx-empty__action" @click="searchKeyword = ''">{{ tt('replacementWordManagement.clearSearch', 'Clear search') }}</CustomButton>
          </template>
          <template v-else>
            <p class="nx-empty__title">{{ tt('replacementWordManagement.emptyTitle', 'No replacement files yet') }}</p>
            <p class="nx-empty__text">{{ tt('replacementWordManagement.emptyText', 'Add a file to correct names and words the robot often mishears.') }}</p>
            <CustomButton class="nx-empty__action" type="add" icon="el-icon-plus" @click="handleAdd">
              {{ $t('replacementWordManagement.addFile') }}
            </CustomButton>
          </template>
        </div>

        <div v-else class="table-card__body" :style="{ '--rows': filteredParamsList.length }">
          <CustomTable
            ref="paramsTable"
            :data="filteredParamsList"
            :columns="tableColumns"
            :loading="loading"
            :show-selection="true"
            :show-operations="true"
            :operations-label="$t('replacementWordManagement.operation')"
            :operations-width="220"
            :total="total"
            :current-page="currentPage"
            :page-size="pageSize"
            :page-size-options="pageSizeOptions"
            @size-change="handlePageSizeChange"
            @page-change="goToPage"
          >
            <template slot="selection" slot-scope="scope">
              <el-checkbox v-model="scope.row.selected" :aria-label="scope.row.fileName"
                @change="handleCheckboxChange(scope.row)"></el-checkbox>
            </template>
            <template slot="fileName" slot-scope="scope">
              <div class="file-cell">
                <span class="nx-icon-tile nx-icon-tile--neutral file-cell__icon" aria-hidden="true"><i class="el-icon-document"></i></span>
                <span class="file-cell__name nx-truncate" :title="scope.row.fileName">{{ scope.row.fileName }}</span>
              </div>
            </template>
            <template slot="wordCount" slot-scope="scope">
              <span class="nx-num">{{ scope.row.wordCount || 0 }}</span>
            </template>
            <template slot="content" slot-scope="scope">
              <el-tooltip placement="top-start" effect="light" popper-class="replace-word-tooltip"
                :disabled="!scope.row.content || !scope.row.content.length">
                <div slot="content" class="replace-word-content">
                  <span v-for="(item, index) in scope.row.content" :key="index" class="nx-badge nx-mono replace-word-pair">{{ item }}</span>
                </div>
                <span class="content-text nx-truncate nx-mono">{{ formatContent(scope.row.content) || '—' }}</span>
              </el-tooltip>
            </template>
            <template slot="createdAt" slot-scope="scope">
              <span class="nx-num nx-muted">{{ scope.row.createdAt || '—' }}</span>
            </template>
            <template slot="updatedAt" slot-scope="scope">
              <span class="nx-num nx-muted">{{ scope.row.updatedAt || '—' }}</span>
            </template>
            <template slot="operations" slot-scope="scope">
              <div class="row-actions">
                <el-button size="mini" type="text" @click="handleEdit(scope.row)">{{ $t('replacementWordManagement.edit') }}</el-button>
                <el-button size="mini" type="text" @click="handleDownload(scope.row)">{{ $t('replacementWordManagement.download') }}</el-button>
                <el-button size="mini" type="text" class="row-action--danger" @click="handleDelete(scope.row)">
                  {{ $t('replacementWordManagement.delete') }}
                </el-button>
              </div>
            </template>
          </CustomTable>
        </div>
      </section>
    </main>

    <ReplacementWordDialog
      ref="paramDialog"
      :title="dialogTitle"
      :visible.sync="dialogVisible"
      :form="dialogForm"
      @submit="handleSubmit"
      @cancel="dialogVisible = false"
    />
    <VersionFooter />
  </div>
</template>

<script>
import Api from "@/apis/api";
import HeaderBar from "@/components/HeaderBar.vue";
import VersionFooter from "@/components/VersionFooter.vue";
import ReplacementWordDialog from "@/components/ReplacementWordDialog.vue";
import CustomButton from "@/components/CustomButton.vue";
import CustomTable from "@/components/CustomTable.vue";

export default {
  components: { HeaderBar, VersionFooter, ReplacementWordDialog, CustomButton, CustomTable },
  data() {
    return {
      searchKeyword: "",
      paramsList: [],
      selectedRows: new Set(),
      currentPage: 1,
      loading: false,
      pageSize: 10,
      pageSizeOptions: [10, 20, 50, 100],
      total: 0,
      dialogVisible: false,
      dialogTitle: '',
      dialogForm: {},
      tableColumns: []
    };
  },
  computed: {
    filteredParamsList() {
      if (!this.searchKeyword) {
        return this.paramsList;
      }
      const keyword = this.searchKeyword.toLowerCase();
      return this.paramsList.filter(row =>
        (row.fileName || '').toLowerCase().includes(keyword)
      );
    },

    hasAnySelected() {
      return this.selectedRows.size > 0;
    },

    selectedCount() {
      return this.filteredParamsList.filter(row => row.selected).length;
    },

    allSelected() {
      if (this.filteredParamsList.length === 0) {
        return false;
      }
      return this.filteredParamsList.every(row => this.selectedRows.has(row.id));
    }
  },
  created() {
    this.initTableColumns();
    this.fetchFileList();
  },
  mounted() {
    this.dialogTitle = this.$t('replacementWordManagement.addFile');
  },
  methods: {
    // $t with an English fallback for keys that are still pending in src/i18n/_pending/web-system.js
    tt(key, fallback, params) {
      if (this.$te(key) || this.$te(key, 'en')) return this.$t(key, params);
      return String(fallback).replace(/\{(\w+)\}/g, (m, k) => (params && params[k] != null ? params[k] : m));
    },

    initTableColumns() {
      this.tableColumns = [
        { prop: 'fileName', label: this.$t('replacementWordManagement.fileName'), align: 'left', minWidth: 200, showOverflowTooltip: false },
        { prop: 'wordCount', label: this.$t('replacementWordManagement.replacementWordCount'), align: 'right', width: 120 },
        { prop: 'content', label: this.$t('replacementWordManagement.replacementWordContent'), align: 'left', minWidth: 220, slot: 'content', showOverflowTooltip: false },
        { prop: 'updatedAt', label: this.$t('replacementWordManagement.updateTime'), align: 'left', minWidth: 170 },
        { prop: 'createdAt', label: this.$t('replacementWordManagement.createTime'), align: 'left', minWidth: 170 }
      ];
    },

    formatContent(content) {
      if (!content) return '';
      if (Array.isArray(content)) {
        return content.join(', ');
      }
      return content;
    },

    handleSearch() {
      this.currentPage = 1;
    },

    handlePageSizeChange(val) {
      this.pageSize = val;
      this.currentPage = 1;
      this.fetchFileList();
    },

    goToPage(page) {
      if (page !== this.currentPage) {
        this.currentPage = page;
        this.fetchFileList();
      }
    },

    handleCheckboxChange(row) {
      const newSet = new Set(this.selectedRows);
      if (row.selected) {
        newSet.add(row.id);
      } else {
        newSet.delete(row.id);
      }
      this.selectedRows = newSet;
    },

    handleSelectAll() {
      if (this.allSelected) {
        this.filteredParamsList.forEach(row => {
          this.$set(row, 'selected', false);
        });
        this.selectedRows = new Set();
      } else {
        this.filteredParamsList.forEach(row => {
          this.$set(row, 'selected', true);
        });
        this.selectedRows = new Set(this.filteredParamsList.map(row => row.id));
      }
    },

    handleBatchDelete() {
      const ids = Array.from(this.filteredParamsList)
        .filter(row => row.selected)
        .map(row => row.id);

      if (ids.length === 0) {
        return;
      }

      this.$confirm(
        this.$t('replacementWordManagement.confirmBatchDelete', { count: ids.length }),
        this.$t('replacementWordManagement.batchDeleteHint'),
        {
          confirmButtonText: this.$t('replacementWordManagement.delete'),
          cancelButtonText: this.$t('common.cancel'),
          confirmButtonClass: 'el-button--danger',
          type: 'warning'
        }
      ).then(() => {
        Api.correctWord.batchDeleteFile(ids, ({ data }) => {
          if (data.code === 0) {
            this.$message.success(this.$t('common.deleteSuccess'));

            const newSet = new Set(this.selectedRows);
            ids.forEach(id => {
              newSet.delete(id);
            });
            this.selectedRows = newSet;

            this.fetchFileList();
          } else {
            this.$message.error(data.msg || this.$t('common.deleteFailure'));
          }
        });
      }).catch(() => {});
    },

    fetchFileList() {
      this.loading = true;
      Api.correctWord.getFileList({
        page: this.currentPage,
        pageSize: this.pageSize
      }, ({ data }) => {
        this.loading = false;
        if (data.code === 0) {
          this.paramsList = (data.data.list || []).map(row => ({
            ...row,
            selected: this.selectedRows.has(row.id)
          }));

          this.total = data.data.total || 0;
        } else {
          this.$message.error({
            message: data.msg || this.$t('replacementWordManagement.getListFailed'),
            showClose: true
          });
        }
      });
    },

    handleAdd() {
      this.dialogForm = {
        id: undefined,
        fileName: '',
        content: ''
      };
      this.dialogTitle = this.$t('replacementWordManagement.addFile');
      this.dialogVisible = true;
    },

    handleEdit(row) {
      this.dialogForm = {
        id: row.id,
        fileName: row.fileName,
        content: row.content || ''
      };
      this.dialogTitle = this.$t('replacementWordManagement.edit');
      this.dialogVisible = true;
    },

    handleDownload(row) {
      Api.correctWord.downloadFile(row.id, (res) => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.download = `${row.fileName}.txt`;
        link.click();
        window.URL.revokeObjectURL(url);
      });
    },

    handleDelete(row) {
      this.$confirm(
        this.$t('replacementWordManagement.confirmDelete'),
        this.$t('replacementWordManagement.deleteHint'),
        {
          confirmButtonText: this.$t('replacementWordManagement.delete'),
          cancelButtonText: this.$t('common.cancel'),
          confirmButtonClass: 'el-button--danger',
          type: 'warning'
        }
      ).then(() => {
        Api.correctWord.deleteFile(row.id, ({ data }) => {
          if (data.code === 0) {
            this.$message.success(this.$t('common.deleteSuccess'));
            const newSet = new Set(this.selectedRows);
            newSet.delete(row.id);
            this.selectedRows = newSet;
            this.fetchFileList();
          } else {
            this.$message.error(data.msg || this.$t('common.deleteFailure'));
          }
        });
      }).catch(() => {});
    },

    handleSubmit(formData) {
      if (formData.id) {
        Api.correctWord.updateFile(formData, ({ data }) => {
          if (data.code === 0) {
            this.$message.success(this.$t('replacementWordManagement.saveSuccess'));
            this.dialogVisible = false;
            this.fetchFileList();
          } else {
            this.$message.error(data.msg || this.$t('replacementWordManagement.saveFailed'));
          }
          if (this.$refs.paramDialog) {
            this.$refs.paramDialog.resetSaving();
          }
        });
      } else {
        Api.correctWord.addFile(formData, ({ data }) => {
          if (data.code === 0) {
            this.$message.success(this.$t('common.addSuccess'));
            this.dialogVisible = false;
            this.fetchFileList();
          } else {
            this.$message.error(data.msg || this.$t('replacementWordManagement.addFailed'));
          }
          if (this.$refs.paramDialog) {
            this.$refs.paramDialog.resetSaving();
          }
        });
      }
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

.file-cell {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  min-width: 0;
  &__icon {
    width: 32px;
    height: 32px;
    border-radius: var(--nx-radius-sm);
    font-size: var(--nx-text-callout);
  }
  &__name {
    flex: 1;
    font-weight: 600;
    color: var(--nx-text);
  }
}
.content-text {
  display: block;
  max-width: 100%;
  color: var(--nx-text-2);
}
</style>

<style lang="scss">
// Tooltip is appended to <body>, so this block is not scoped
.replace-word-tooltip.el-tooltip__popper.is-light {
  padding: var(--nx-space-3);
}
.replace-word-content {
  display: flex;
  flex-wrap: wrap;
  gap: var(--nx-space-1);
  max-width: 400px;
  max-height: 60vh;
  overflow-y: auto;
  .replace-word-pair {
    height: auto;
    padding: 4px 8px;
    border-radius: var(--nx-radius-sm);
    font-weight: 500;
    color: var(--nx-text);
    white-space: normal;
    overflow-wrap: anywhere;
  }
}
</style>
