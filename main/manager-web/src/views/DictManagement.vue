<template>
  <div class="nx-admin">
    <HeaderBar />
    <main class="nx-page nx-page--wide">
      <header class="nx-page-header">
        <div class="nx-page-header__text">
          <h1 class="nx-title">{{ $t('dictManagement.pageTitle') }}</h1>
          <p class="nx-page-header__desc">{{ tt('dictManagement.pageDesc', 'Lists of choices used across the console, like firmware boards and model types.') }}</p>
        </div>
        <div class="nx-page-header__actions">
          <el-input v-model="search" class="admin-search" prefix-icon="el-icon-search" clearable
            :placeholder="$t('dictManagement.searchPlaceholder')" :aria-label="$t('dictManagement.search')"
            @keyup.enter.native="handleSearch" @clear="handleSearch" />
          <CustomButton icon="el-icon-plus" @click="showAddDictTypeDialog">{{ $t('dictManagement.addDictType') }}</CustomButton>
        </div>
      </header>

      <div class="dict-layout">
        <!-- Left: dictionary types -->
        <aside class="nx-card nx-card--flush type-pane" :aria-label="$t('dictManagement.dictTypeCategory')">
          <div class="type-pane__head">
            <h2 class="nx-headline">{{ $t('dictManagement.dictTypeCategory') }}</h2>
            <span class="nx-badge nx-num">{{ dictTypeList.length }}</span>
            <span class="nx-spacer"></span>
            <el-tooltip :content="$t('dictManagement.addDictType')" placement="top">
              <button type="button" class="nx-icon-btn" :aria-label="$t('dictManagement.addDictType')" @click="showAddDictTypeDialog">
                <i class="el-icon-plus" aria-hidden="true"></i>
              </button>
            </el-tooltip>
            <el-tooltip :content="$t('dictManagement.batchDeleteDictType')" placement="top">
              <button type="button" class="nx-icon-btn nx-icon-btn--danger" :aria-label="$t('dictManagement.batchDeleteDictType')"
                :disabled="!checkedDictTypesIds.length" @click="batchDeleteDictType">
                <i class="el-icon-delete" aria-hidden="true"></i>
              </button>
            </el-tooltip>
          </div>

          <div v-if="dictTypeList.length" class="type-pane__all">
            <el-checkbox :indeterminate="isIndeterminate" :value="checkedDictTypesIds.length > 0 && checkedDictTypesIds.length === dictTypeList.length"
              @change="handleCheckAllChange">
              {{ checkedDictTypesIds.length ? tt('dictManagement.selectedCount', '{count} selected', { count: checkedDictTypesIds.length }) : $t('common.selectAll') }}
            </el-checkbox>
          </div>

          <div class="type-pane__list" v-loading="dictTypeLoading">
            <el-checkbox-group v-if="dictTypeList.length" v-model="checkedDictTypesIds" @change="handleDictTypeSelectionChange">
              <div v-for="item in dictTypeList" :key="item.id" class="type-item"
                :class="{ 'is-active': selectedDictType && selectedDictType.id === item.id }">
                <el-checkbox :label="item.dictName" class="type-item__check" :aria-label="item.dictName"></el-checkbox>
                <button type="button" class="type-item__main" :aria-current="selectedDictType && selectedDictType.id === item.id ? 'true' : null"
                  @click="handleDictTypeRowClick(item)">
                  <span class="type-item__name nx-truncate" :title="item.dictName">{{ item.dictName }}</span>
                  <span class="type-item__code nx-mono nx-truncate" :title="item.dictType">{{ item.dictType }}</span>
                </button>
                <button type="button" class="nx-icon-btn type-item__edit" :aria-label="$t('dictManagement.editDictType')"
                  @click.stop="editDictType(item)">
                  <i class="el-icon-edit" aria-hidden="true"></i>
                </button>
              </div>
            </el-checkbox-group>
            <div v-else-if="!dictTypeLoading" class="nx-empty nx-empty--compact">
              <p class="nx-empty__title">{{ tt('dictManagement.emptyTypesTitle', 'No dictionary types') }}</p>
              <p class="nx-empty__text">{{ tt('dictManagement.emptyTypesText', 'Create a type, then add its values.') }}</p>
              <CustomButton class="nx-empty__action" type="add" icon="el-icon-plus" @click="showAddDictTypeDialog">
                {{ $t('dictManagement.addDictType') }}
              </CustomButton>
            </div>
          </div>
        </aside>

        <!-- Right: values of the selected type -->
        <section class="nx-card nx-card--flush data-pane">
          <div class="data-pane__head">
            <div class="data-pane__title">
              <h2 class="nx-headline nx-truncate" :title="selectedDictType ? selectedDictType.dictName : ''">
                {{ selectedDictType ? selectedDictType.dictName : $t('dictManagement.dictTypeName') }}
              </h2>
              <span v-if="selectedDictType" class="nx-caption nx-mono nx-truncate">{{ selectedDictType.dictType }}</span>
            </div>
            <CustomButton type="add" icon="el-icon-plus" size="small" :disabled="!selectedDictType" @click="showAddDictDataDialog">
              {{ $t('dictManagement.addDictData') }}
            </CustomButton>
          </div>

          <div class="table-card__toolbar">
            <el-checkbox :value="allRowsSelected" :indeterminate="selectedCount > 0 && !allRowsSelected"
              :disabled="!dictDataList.length" @change="selectAllDictData">
              {{ selectedCount ? tt('dictManagement.selectedCount', '{count} selected', { count: selectedCount }) : $t('dictManagement.selectAll') }}
            </el-checkbox>
            <span class="nx-spacer"></span>
            <CustomButton size="small" type="delete" icon="el-icon-delete" :disabled="!selectedCount" @click="batchDeleteDictData">
              {{ $t('dictManagement.batchDeleteDictData') }}
            </CustomButton>
          </div>

          <div v-if="!selectedDictType && !dictTypeLoading" class="nx-empty">
            <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true"><i class="el-icon-notebook-2"></i></span>
            <p class="nx-empty__title">{{ tt('dictManagement.chooseTypeTitle', 'Choose a dictionary type') }}</p>
            <p class="nx-empty__text">{{ tt('dictManagement.chooseTypeText', 'Its values appear here.') }}</p>
          </div>
          <div v-else-if="!dictDataLoading && !dictDataList.length && selectedDictType" class="nx-empty">
            <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true"><i class="el-icon-notebook-2"></i></span>
            <template v-if="search">
              <p class="nx-empty__title">{{ tt('dictManagement.emptySearchTitle', 'No values match your search') }}</p>
              <p class="nx-empty__text">{{ tt('dictManagement.emptySearchText', 'Try another label or clear the search.') }}</p>
              <CustomButton class="nx-empty__action" @click="clearSearch">{{ tt('dictManagement.clearSearch', 'Clear search') }}</CustomButton>
            </template>
            <template v-else>
              <p class="nx-empty__title">{{ tt('dictManagement.emptyDataTitle', 'No values yet') }}</p>
              <p class="nx-empty__text">{{ tt('dictManagement.emptyDataText', 'Add the first value for this type.') }}</p>
              <CustomButton class="nx-empty__action" type="add" icon="el-icon-plus" @click="showAddDictDataDialog">
                {{ $t('dictManagement.addDictData') }}
              </CustomButton>
            </template>
          </div>
          <div v-else class="table-card__body" :style="{ '--rows': dictDataList.length }">
            <CustomTable :data="dictDataList" :columns="tableColumns" :loading="dictDataLoading" :show-selection="true"
              :show-operations="true" :operations-label="$t('dictManagement.operation')" :operations-width="150" :total="total"
              :current-page="currentPage" :page-size="pageSize" :page-size-options="pageSizeOptions"
              @size-change="handlePageSizeChange" @page-change="goToPage">
              <template slot="selection" slot-scope="scope">
                <el-checkbox v-model="scope.row.selected" :aria-label="scope.row.dictLabel"></el-checkbox>
              </template>
              <template slot="dictLabel" slot-scope="scope">
                <span class="data-label">{{ scope.row.dictLabel }}</span>
              </template>
              <template slot="dictValue" slot-scope="scope">
                <span class="nx-mono">{{ scope.row.dictValue }}</span>
              </template>
              <template slot="sort" slot-scope="scope">
                <span class="nx-num nx-muted">{{ scope.row.sort }}</span>
              </template>
              <template slot="operations" slot-scope="scope">
                <div class="row-actions">
                  <el-button type="text" size="mini" @click="editDictData(scope.row)">{{ $t('dictManagement.edit') }}</el-button>
                  <el-button type="text" size="mini" class="row-action--danger" @click="deleteDictData(scope.row)">
                    {{ $t('dictManagement.delete') }}
                  </el-button>
                </div>
              </template>
            </CustomTable>
          </div>
        </section>
      </div>
    </main>

    <!-- Dictionary type edit dialog component -->
    <DictTypeDialog ref="dictTypeDialog" :visible.sync="dictTypeDialogVisible" :title="dictTypeDialogTitle"
      :dictTypeData="dictTypeForm" @save="saveDictType" />

    <!-- Dictionary data edit dialog component -->
    <DictDataDialog ref="dictDataDialog" :visible.sync="dictDataDialogVisible" :title="dictDataDialogTitle"
      :dictData="dictDataForm" :dictTypeId="selectedDictType?.id" @save="saveDictData" />
    <VersionFooter />
  </div>
</template>

<script>
import dictApi from '@/apis/module/dict'
import DictDataDialog from '@/components/DictDataDialog.vue'
import DictTypeDialog from '@/components/DictTypeDialog.vue'
import HeaderBar from '@/components/HeaderBar.vue'
import VersionFooter from '@/components/VersionFooter.vue'
import CustomButton from '@/components/CustomButton.vue'
import CustomTable from '@/components/CustomTable.vue'
export default {
  name: 'DictManagement',
  components: {
    HeaderBar,
    DictTypeDialog,
    DictDataDialog,
    VersionFooter,
    CustomButton,
    CustomTable
  },
  data() {
    return {
      // Dictionary type related
      dictTypeList: [],
      dictTypeLoading: false,
      selectedDictType: null,
      selectedDictTypes: [],
      dictTypeDialogVisible: false,
      dictTypeDialogTitle: 'Add Dictionary Type',
      dictTypeForm: {
        id: null,
        dictName: '',
        dictType: ''
      },

      // Dictionary data related
      dictDataList: [],
      dictDataLoading: false,
      isAllDictDataSelected: false,
      dictDataDialogVisible: false,
      dictDataDialogTitle: 'Add Dictionary Data',
      dictDataForm: {
        id: null,
        dictTypeId: null,
        dictLabel: '',
        dictValue: '',
        sort: 0
      },
      search: '',
      pageSizeOptions: [10, 20, 50, 100],
      currentPage: 1,
      pageSize: 10,
      total: 0,
      tableColumns: [],
      isIndeterminate: false,
      checkAll: false,
      checkedDictTypesIds: []
    }
  },
  computed: {
    selectedCount() {
      return this.dictDataList.filter(row => row.selected).length
    },
    allRowsSelected() {
      return this.dictDataList.length > 0 && this.selectedCount === this.dictDataList.length
    }
  },
  created() {
    this.initTableColumns()
    this.loadDictTypeList()
  },
  methods: {
    // $t with an English fallback for keys that are still pending in src/i18n/_pending/web-system.js
    tt(key, fallback, params) {
      if (this.$te(key) || this.$te(key, 'en')) return this.$t(key, params)
      return String(fallback).replace(/\{(\w+)\}/g, (m, k) => (params && params[k] != null ? params[k] : m))
    },
    clearSearch() {
      this.search = ''
      this.handleSearch()
    },
    handleCheckAllChange(val) {
      // Decide select-all or unselect-all based on current state
      const isAllSelected = this.checkedDictTypesIds.length === this.dictTypeList.length;
      if (isAllSelected) {
        // Already all selected, unselect all
        this.checkedDictTypesIds = [];
        this.checkAll = false;
        this.selectedDictTypes = [];
      } else {
        // Not all selected, perform select all
        this.checkedDictTypesIds = this.dictTypeList.map(item => item.dictName);
        this.checkAll = true;
        this.selectedDictTypes = [...this.dictTypeList];
      }
      // Reset indeterminate state
      this.isIndeterminate = false;
    },
    handleDictTypeSelectionChange(checkedIds) {
      // Update selected dictionary type list
      this.selectedDictTypes = this.dictTypeList.filter(item => checkedIds.includes(item.dictName));
      // Partial selection state
      this.checkAll = checkedIds.length > 0;
      this.isIndeterminate = checkedIds.length > 0 && checkedIds.length < this.dictTypeList.length;
    },
    initTableColumns() {
      this.tableColumns = [
        { prop: 'dictLabel', label: this.$t('dictManagement.dictLabel'), align: 'left', minWidth: 180 },
        { prop: 'dictValue', label: this.$t('dictManagement.dictValue'), align: 'left', minWidth: 180 },
        { prop: 'sort', label: this.$t('dictManagement.sort'), align: 'right', width: 90 }
      ]
    },
    // Dictionary type related methods
    loadDictTypeList() {
      this.dictTypeLoading = true
      dictApi.getDictTypeList({
        page: 1,
        limit: 100,
        dictName: this.search
      }, ({ data }) => {
        if (data.code === 0) {
          this.dictTypeList = data.data.list
          // Drop checks for types that no longer exist
          const names = this.dictTypeList.map(item => item.dictName)
          this.checkedDictTypesIds = this.checkedDictTypesIds.filter(name => names.includes(name))
          this.handleDictTypeSelectionChange(this.checkedDictTypesIds)
          if (this.dictTypeList.length > 0) {
            this.selectedDictType = this.dictTypeList[0]
            this.loadDictDataList(this.dictTypeList[0].id)
          } else {
            this.selectedDictType = null
            this.dictDataList = []
            this.total = 0
          }
        }
        this.dictTypeLoading = false
      })
    },
    handleDictTypeRowClick(row) {
      this.selectedDictType = row
      this.loadDictDataList(row.id)
    },
    showAddDictTypeDialog() {
      this.dictTypeDialogTitle = this.$t('dictManagement.addDictType')
      this.dictTypeForm = {
        id: null,
        dictName: '',
        dictType: ''
      }
      this.dictTypeDialogVisible = true
    },
    editDictType(row) {
      this.dictTypeDialogTitle = this.$t('dictManagement.editDictType')
      this.dictTypeForm = { ...row }
      this.dictTypeDialogVisible = true
    },
    saveDictType(formData) {
      const api = formData.id ? dictApi.updateDictType : dictApi.addDictType
      api(formData, ({ data }) => {
        if (data.code === 0) {
          this.$message.success(this.$t('dictManagement.saveSuccess'))
          this.dictTypeDialogVisible = false
          this.loadDictTypeList()
        } else {
          this.$message.error(data.msg || this.$t('user.operationFailed'))
          this.$refs.dictTypeDialog && this.$refs.dictTypeDialog.resetSaving()
        }
      })
    },
    batchDeleteDictType() {
      if (this.selectedDictTypes.length === 0) {
        this.$message.warning(this.$t('dictManagement.selectDictTypeToDelete'))
        return
      }

      this.$confirm(this.$t('dictManagement.confirmDeleteDictType'), this.$t('dictManagement.confirm'), {
        confirmButtonText: this.$t('dictManagement.delete'),
        cancelButtonText: this.$t('dictManagement.cancel'),
        confirmButtonClass: 'el-button--danger',
        type: 'warning'
      }).then(() => {
        const ids = this.selectedDictTypes.map(item => item.id)
        dictApi.deleteDictType(ids, ({ data }) => {
          if (data.code === 0) {
            this.$message.success(this.$t('dictManagement.deleteSuccess'))
            this.loadDictTypeList()
          }
        })
      })
    },

    // Dictionary data related methods
    loadDictDataList(dictTypeId) {
      if (!dictTypeId) return
      this.dictDataLoading = true
      dictApi.getDictDataList({
        dictTypeId,
        page: this.currentPage,
        limit: this.pageSize,
        dictLabel: this.search,
        dictValue: ''
      }, ({ data }) => {
        if (data.code === 0) {
          this.dictDataList = data.data.list.map(item => ({
            ...item,
            selected: false
          }))
          this.total = data.data.total
          this.isAllDictDataSelected = false
        } else {
          this.$message.error(data.msg || this.$t('dictManagement.getDictDataFailed'))
        }
        this.dictDataLoading = false
      })
    },
    selectAllDictData() {
      this.isAllDictDataSelected = !this.allRowsSelected
      this.dictDataList.forEach(row => {
        row.selected = this.isAllDictDataSelected
      })
    },
    showAddDictDataDialog() {
      if (!this.selectedDictType) {
        this.$message.warning(this.$t('dictManagement.selectDictTypeFirst'))
        return
      }
      this.dictDataDialogTitle = this.$t('dictManagement.addDictData')
      this.dictDataForm = {
        id: null,
        dictTypeId: this.selectedDictType.id,
        dictLabel: '',
        dictValue: '',
        sort: 0
      }
      this.dictDataDialogVisible = true
    },
    editDictData(row) {
      this.dictDataDialogTitle = this.$t('dictManagement.editDictData')
      this.dictDataForm = { ...row }
      this.dictDataDialogVisible = true
    },
    saveDictData(formData) {
      const api = formData.id ? dictApi.updateDictData : dictApi.addDictData
      api(formData, ({ data }) => {
        if (data.code === 0) {
          this.$message.success(this.$t('dictManagement.saveSuccess'))
          this.dictDataDialogVisible = false
          this.loadDictDataList(formData.dictTypeId)
        } else {
          this.$message.error(data.msg || this.$t('user.operationFailed'))
          this.$refs.dictDataDialog && this.$refs.dictDataDialog.resetSaving()
        }
      })
    },
    deleteDictData(row) {
      this.$confirm(this.$t('dictManagement.confirmDeleteDictData'), this.$t('dictManagement.confirm'), {
        confirmButtonText: this.$t('dictManagement.delete'),
        cancelButtonText: this.$t('dictManagement.cancel'),
        confirmButtonClass: 'el-button--danger',
        type: 'warning'
      }).then(() => {
        dictApi.deleteDictData([row.id], ({ data }) => {
          if (data.code === 0) {
            this.$message.success(this.$t('dictManagement.deleteSuccess'))
            this.loadDictDataList(row.dictTypeId)
          }
        })
      })
    },
    batchDeleteDictData() {
      const selectedRows = this.dictDataList.filter(row => row.selected)
      if (selectedRows.length === 0) {
        this.$message.warning(this.$t('dictManagement.selectDictDataToDelete'))
        return
      }

      this.$confirm(this.$t('dictManagement.confirmBatchDeleteDictData', { count: selectedRows.length }), this.$t('dictManagement.confirm'), {
        confirmButtonText: this.$t('dictManagement.delete'),
        cancelButtonText: this.$t('dictManagement.cancel'),
        confirmButtonClass: 'el-button--danger',
        type: 'warning'
      }).then(() => {
        const ids = selectedRows.map(item => item.id)
        dictApi.deleteDictData(ids, ({ data }) => {
          if (data.code === 0) {
            this.$message.success(this.$t('dictManagement.deleteSuccess'))
            this.loadDictDataList(this.selectedDictType.id)
          }
        })
      })
    },
    handleSearch() {
      if (!this.selectedDictType) {
        this.$message.warning(this.$t('dictManagement.selectDictTypeFirst'))
        return
      }
      this.currentPage = 1
      this.loadDictDataList(this.selectedDictType.id)
    },
    handlePageSizeChange(val) {
      this.pageSize = val
      this.currentPage = 1
      this.loadDictDataList(this.selectedDictType?.id)
    },
    goToPage(page) {
      if (page !== this.currentPage) {
        this.currentPage = page
        this.loadDictDataList(this.selectedDictType?.id)
      }
    }
  }
}
</script>

<style lang="scss" scoped>
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

// Two panes on wide screens, stacked on narrow ones
.dict-layout {
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  gap: var(--nx-space-5);
  align-items: start;
  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr);
  }
}

// ---------------------------------------------------------------- types pane
.type-pane {
  display: flex;
  flex-direction: column;
  @media (min-width: 1101px) {
    position: sticky;
    top: calc(var(--nx-topbar-h) + var(--nx-space-4));
    max-height: calc(100vh - var(--nx-topbar-h) - var(--nx-space-8));
  }
  &__head {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
    min-height: 56px;
    padding: var(--nx-space-2) var(--nx-space-3) var(--nx-space-2) var(--nx-space-5);
    border-bottom: 1px solid var(--nx-border);
    .nx-icon-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      background: transparent;
    }
  }
  &__all {
    padding: var(--nx-space-2) var(--nx-space-5);
    border-bottom: 1px solid var(--nx-border);
    ::v-deep .el-checkbox__label {
      font-size: var(--nx-text-footnote);
      color: var(--nx-text-2);
      font-variant-numeric: tabular-nums;
    }
  }
  &__list {
    flex: 1 1 auto;
    min-height: 120px;
    max-height: 520px;
    overflow-y: auto;
    padding: var(--nx-space-2);
    @media (min-width: 1101px) {
      max-height: none;
    }
    .el-checkbox-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
  }
}
.type-item {
  display: flex;
  align-items: center;
  gap: var(--nx-space-1);
  padding-left: var(--nx-space-3);
  border-radius: var(--nx-radius);
  transition: background-color var(--nx-dur-1) var(--nx-ease);
  &:hover {
    background: var(--nx-surface-2);
  }
  &.is-active {
    background: var(--nx-accent-soft);
    .type-item__name {
      color: var(--nx-accent);
      font-weight: 600;
    }
  }
  &__check {
    margin-right: 0;
    ::v-deep .el-checkbox__label {
      display: none;
    }
  }
  &__main {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    flex: 1;
    min-width: 0;
    padding: var(--nx-space-2);
    border: 0;
    background: transparent;
    font: inherit;
    text-align: left;
    cursor: pointer;
    border-radius: var(--nx-radius-sm);
  }
  &__name {
    max-width: 100%;
    font-size: var(--nx-text-callout);
    color: var(--nx-text);
  }
  &__code {
    max-width: 100%;
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }
  &__edit {
    width: 32px;
    height: 32px;
    font-size: var(--nx-text-callout);
    opacity: 0;
    transition: opacity var(--nx-dur-1) var(--nx-ease);
  }
  &:hover &__edit,
  &.is-active &__edit,
  &__edit:focus-visible {
    opacity: 1;
  }
  @media (hover: none) {
    &__edit {
      opacity: 1;
    }
  }
}
.nx-empty--compact {
  padding: var(--nx-space-7) var(--nx-space-4);
}

// ---------------------------------------------------------------- data pane
.data-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  &__head {
    display: flex;
    align-items: center;
    gap: var(--nx-space-3);
    min-height: 64px;
    padding: var(--nx-space-3) var(--nx-space-5);
    border-bottom: 1px solid var(--nx-border);
  }
  &__title {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }
}
.data-label {
  font-weight: 600;
  color: var(--nx-text);
}
.table-card {
  &__toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--nx-space-2);
    min-height: 52px;
    padding: var(--nx-space-2) var(--nx-space-5);
    border-bottom: 1px solid var(--nx-border);
    ::v-deep .el-checkbox__label {
      font-size: var(--nx-text-footnote);
      color: var(--nx-text-2);
      font-variant-numeric: tabular-nums;
    }
  }
  // Height follows the row count, capped to the viewport; the table body scrolls inside
  &__body {
    height: clamp(280px, calc(var(--rows, 0) * 49px + 100px), max(440px, calc(100vh - 360px)));
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
</style>
