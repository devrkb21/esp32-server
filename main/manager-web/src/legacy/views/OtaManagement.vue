<template>
    <div class="nx-admin">
        <HeaderBar />
        <main class="nx-page">
            <header class="nx-page-header">
                <div class="nx-page-header__text">
                    <h1 class="nx-title">{{ $t('otaManagement.firmwareManagement') }}</h1>
                    <p class="nx-page-header__desc">{{ tt('otaManagement.pageDesc', 'Firmware builds robots download when they check for updates.') }}</p>
                </div>
                <div class="nx-page-header__actions">
                    <el-input v-model="searchName" class="admin-search" prefix-icon="el-icon-search" clearable
                        :placeholder="$t('otaManagement.searchPlaceholder')" :aria-label="$t('otaManagement.search')"
                        @keyup.enter.native="handleSearch" @clear="handleSearch" />
                    <CustomButton type="add" icon="el-icon-upload2" @click="showAddDialog">
                        {{ $t('otaManagement.addFirmware') }}
                    </CustomButton>
                </div>
            </header>

            <section class="nx-card nx-card--flush table-card">
                <div class="table-card__toolbar">
                    <el-checkbox :value="allRowsSelected" :indeterminate="selectedCount > 0 && !allRowsSelected"
                        :disabled="!firmwareList.length" @change="handleSelectAll">
                        {{ selectedCount ? tt('otaManagement.selectedCount', '{count} selected', { count: selectedCount }) : $t('otaManagement.selectAll') }}
                    </el-checkbox>
                    <span class="nx-spacer"></span>
                    <CustomButton size="small" type="delete" icon="el-icon-delete" :disabled="!selectedCount"
                        @click="deleteSelectedParams">
                        {{ $t('otaManagement.delete') }}
                    </CustomButton>
                </div>

                <div v-if="!loading && !paramsList.length" class="nx-empty">
                    <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true"><i class="el-icon-cpu"></i></span>
                    <template v-if="searchName">
                        <p class="nx-empty__title">{{ tt('otaManagement.emptySearchTitle', 'No firmware matches your search') }}</p>
                        <p class="nx-empty__text">{{ tt('otaManagement.emptySearchText', 'Try another name or clear the search.') }}</p>
                        <CustomButton class="nx-empty__action" @click="clearSearch">{{ tt('otaManagement.clearSearch', 'Clear search') }}</CustomButton>
                    </template>
                    <template v-else>
                        <p class="nx-empty__title">{{ tt('otaManagement.emptyTitle', 'No firmware yet') }}</p>
                        <p class="nx-empty__text">{{ tt('otaManagement.emptyText', 'Upload a .bin build so robots can update over the air.') }}</p>
                        <CustomButton class="nx-empty__action" type="add" icon="el-icon-upload2" @click="showAddDialog">
                            {{ $t('otaManagement.addFirmware') }}
                        </CustomButton>
                    </template>
                </div>

                <div v-else class="table-card__body" :style="{ '--rows': paramsList.length }">
                    <CustomTable ref="paramsTable" :data="paramsList" :columns="tableColumns" :loading="loading"
                        :show-selection="true" :show-operations="true" :operations-label="$t('otaManagement.action')"
                        :operations-width="220" :total="total" :current-page="currentPage" :page-size="pageSize"
                        :page-size-options="pageSizeOptions" @size-change="handlePageSizeChange" @page-change="goToPage">
                        <template slot="selection" slot-scope="scope">
                            <el-checkbox v-model="scope.row.selected" :aria-label="scope.row.firmwareName"></el-checkbox>
                        </template>
                        <template slot="firmwareName" slot-scope="scope">
                            <div class="fw-cell">
                                <span class="nx-icon-tile nx-icon-tile--neutral fw-cell__icon" aria-hidden="true"><i class="el-icon-cpu"></i></span>
                                <div class="fw-cell__text">
                                    <div class="fw-cell__name nx-truncate" :title="scope.row.firmwareName">{{ scope.row.firmwareName }}</div>
                                    <div v-if="scope.row.remark" class="nx-caption nx-truncate" :title="scope.row.remark">{{ scope.row.remark }}</div>
                                </div>
                            </div>
                        </template>
                        <template slot="type" slot-scope="scope">
                            <span class="nx-badge nx-badge--info nx-truncate" :title="getFirmwareTypeName(scope.row.type)">
                                {{ getFirmwareTypeName(scope.row.type) || '—' }}
                            </span>
                        </template>
                        <template slot="version" slot-scope="scope">
                            <span class="nx-mono">{{ scope.row.version || '—' }}</span>
                        </template>
                        <template slot="size" slot-scope="scope">
                            <span class="nx-num">{{ formatFileSize(scope.row.size) }}</span>
                        </template>
                        <template slot="createDate" slot-scope="scope">
                            <span class="nx-num nx-muted">{{ formatDate(scope.row.createDate) || '—' }}</span>
                        </template>
                        <template slot="updateDate" slot-scope="scope">
                            <span class="nx-num nx-muted">{{ formatDate(scope.row.updateDate) || '—' }}</span>
                        </template>
                        <template slot="operations" slot-scope="scope">
                            <div class="row-actions">
                                <el-button size="mini" type="text" @click="downloadFirmware(scope.row)">{{ $t('otaManagement.download') }}</el-button>
                                <el-button size="mini" type="text" @click="editParam(scope.row)">{{ $t('otaManagement.edit') }}</el-button>
                                <el-button size="mini" type="text" class="row-action--danger" @click="deleteParam(scope.row)">
                                    {{ $t('otaManagement.delete') }}
                                </el-button>
                            </div>
                        </template>
                    </CustomTable>
                </div>
            </section>
        </main>

        <!-- Add/Edit Firmware Dialog -->
        <firmware-dialog ref="firmwareDialog" :title="dialogTitle" :visible.sync="dialogVisible" :form="firmwareForm"
            :firmware-types="firmwareTypes" @submit="handleSubmit" @cancel="dialogVisible = false" />
        <VersionFooter />
    </div>
</template>

<script>
import Api from "@/apis/api";
import FirmwareDialog from "@/components/FirmwareDialog.vue";
import HeaderBar from "@/components/HeaderBar.vue";
import VersionFooter from "@/components/VersionFooter.vue";
import CustomButton from "@/components/CustomButton.vue";
import CustomTable from "@/components/CustomTable.vue";
import { formatDate, formatFileSize } from "@/utils/format";

export default {
    components: { HeaderBar, FirmwareDialog, VersionFooter, CustomButton, CustomTable },
    data() {
        return {
            searchName: "",
            loading: false,
            paramsList: [],
            firmwareList: [],
            currentPage: 1,
            pageSize: 10,
            pageSizeOptions: [10, 20, 50, 100],
            total: 0,
            dialogVisible: false,
            dialogTitle: "Add Firmware",
            isAllSelected: false,
            firmwareForm: {
                id: null,
                firmwareName: "",
                type: "",
                version: "",
                size: 0,
                remark: "",
                firmwarePath: ""
            },
            firmwareTypes: [],
            tableColumns: []
        };
    },
    computed: {
        selectedCount() {
            return this.firmwareList.filter(row => row.selected).length;
        },
        allRowsSelected() {
            return this.firmwareList.length > 0 && this.selectedCount === this.firmwareList.length;
        }
    },
    created() {
        this.initTableColumns();
        this.fetchFirmwareList();
        this.getFirmwareTypes();
    },
    methods: {
        // $t with an English fallback for keys that are still pending in src/i18n/_pending/web-system.js
        tt(key, fallback, params) {
            if (this.$te(key) || this.$te(key, 'en')) return this.$t(key, params);
            return String(fallback).replace(/\{(\w+)\}/g, (m, k) => (params && params[k] != null ? params[k] : m));
        },
        initTableColumns() {
            this.tableColumns = [
                { prop: 'firmwareName', label: this.$t('otaManagement.firmwareName'), align: 'left', minWidth: 240, showOverflowTooltip: false },
                { prop: 'type', label: this.$t('otaManagement.firmwareType'), align: 'left', minWidth: 150, showOverflowTooltip: false },
                { prop: 'version', label: this.$t('otaManagement.version'), align: 'left', width: 110 },
                { prop: 'size', label: this.$t('otaManagement.fileSize'), align: 'right', width: 110 },
                { prop: 'createDate', label: this.$t('otaManagement.createTime'), align: 'left', minWidth: 170 },
                { prop: 'updateDate', label: this.$t('otaManagement.updateTime'), align: 'left', minWidth: 170 }
            ];
        },
        handlePageSizeChange(val) {
            this.pageSize = val;
            this.currentPage = 1;
            this.fetchFirmwareList();
        },
        fetchFirmwareList() {
            this.loading = true;
            const params = {
                page: this.currentPage,
                limit: this.pageSize,
                firmwareName: this.searchName || "",
                orderField: "create_date",
                order: "desc"
            };
            Api.ota.getOtaList(params, (res) => {
                this.loading = false;
                res = res.data
                if (res.code === 0) {
                    this.firmwareList = res.data.list.map(item => ({
                        ...item,
                        selected: false
                    }));
                    this.paramsList = this.firmwareList;
                    this.total = res.data.total || 0;
                    this.isAllSelected = false;
                } else {
                    this.firmwareList = [];
                    this.paramsList = [];
                    this.total = 0;
                    this.$message.error({
                        message: res?.data?.msg || this.$t('otaManagement.fetchFirmwareListFailed'),
                        showClose: true
                    });
                }
            });
        },
        handleSearch() {
            this.currentPage = 1;
            this.fetchFirmwareList();
        },
        clearSearch() {
            this.searchName = "";
            this.handleSearch();
        },
        handleSelectAll() {
            this.isAllSelected = !this.allRowsSelected;
            this.firmwareList.forEach(row => {
                row.selected = this.isAllSelected;
            });
        },
        showAddDialog() {
            this.dialogTitle = this.$t('otaManagement.addFirmware');
            this.firmwareForm = {
                id: null,
                firmwareName: "",
                type: "",
                version: "",
                size: 0,
                remark: "",
                firmwarePath: ""
            };
            this.dialogVisible = true;
        },
        editParam(row) {
            this.dialogTitle = this.$t('otaManagement.editFirmware');
            this.firmwareForm = { ...row };
            this.dialogVisible = true;
        },
        handleSubmit(form) {
            if (form.id) {
                Api.ota.updateOta(form.id, form, (res) => {
                    res = res.data;
                    if (res.code === 0) {
                        this.$message.success({
                            message: this.$t('otaManagement.updateSuccess'),
                            showClose: true
                        });
                        this.dialogVisible = false;
                        this.fetchFirmwareList();
                    } else {
                        this.$message.error({
                            message: res.msg || this.$t('otaManagement.updateFailed'),
                            showClose: true
                        });
                    }
                    this.$refs.firmwareDialog?.resetSaving();
                });
            } else {
                Api.ota.saveOta(form, (res) => {
                    res = res.data;
                    if (res.code === 0) {
                        this.$message.success({
                            message: this.$t('otaManagement.addSuccess'),
                            showClose: true
                        });
                        this.dialogVisible = false;
                        this.fetchFirmwareList();
                    } else {
                        this.$message.error({
                            message: res.msg || this.$t('otaManagement.addFailed'),
                            showClose: true
                        });
                    }
                    this.$refs.firmwareDialog?.resetSaving();
                });
            }
        },
        deleteSelectedParams() {
            const selectedRows = this.firmwareList.filter(row => row.selected);
            if (selectedRows.length === 0) {
                this.$message.warning({
                    message: this.$t('otaManagement.selectFirmwareFirst'),
                    showClose: true
                });
                return;
            }
            this.deleteParam(selectedRows);
        },
        deleteParam(row) {
            const params = Array.isArray(row) ? row : [row];

            if (Array.isArray(row) && row.length === 0) {
                this.$message.warning({
                    message: this.$t('otaManagement.selectFirmwareFirst'),
                    showClose: true
                });
                return;
            }

            const paramCount = params.length;
            const title = paramCount === 1 && params[0].firmwareName ? params[0].firmwareName : this.$t('common.warning');
            this.$confirm(this.$t('otaManagement.confirmBatchDelete', { paramCount }), title, {
                confirmButtonText: this.$t('otaManagement.delete'),
                cancelButtonText: this.$t('common.cancel'),
                confirmButtonClass: 'el-button--danger',
                type: 'warning',
                distinguishCancelAndClose: true
            }).then(() => {
                const ids = params.map(param => param.id);
                if (ids.some(id => !id)) {
                    this.$message.error({
                        message: this.$t('otaManagement.invalidFirmwareId'),
                        showClose: true
                    });
                    return;
                }

                Api.ota.deleteOta(ids, (res) => {
                    res = res.data;
                    if (res.code === 0) {
                        this.$message.success({
                            message: this.$t('otaManagement.batchDeleteSuccess', { paramCount }),
                            showClose: true
                        });
                        this.fetchFirmwareList();
                    } else {
                        this.$message.error({
                            message: res.msg || this.$t('otaManagement.deleteFailed'),
                            showClose: true
                        });
                    }
                });
            }).catch(action => {
                if (action === 'cancel') {
                    this.$message({
                        type: 'info',
                        message: this.$t('otaManagement.operationCancelled'),
                        duration: 1000
                    });
                } else {
                    this.$message({
                        type: 'info',
                        message: this.$t('otaManagement.operationClosed'),
                        duration: 1000
                    });
                }
            });
        },
        goToPage(page) {
            if (page !== this.currentPage) {
                this.currentPage = page;
                this.fetchFirmwareList();
            }
        },
        downloadFirmware(firmware) {
            if (!firmware || !firmware.id) {
                this.$message.error(this.$t('otaManagement.incompleteFirmwareInfo'));
                return;
            }
            Api.ota.getDownloadUrl(firmware.id, (res) => {
                if (res.data.code === 0) {
                    const uuid = res.data.data;
                    const baseUrl = process.env.VUE_APP_API_BASE_URL || '';
                    window.open(`${window.location.origin}${baseUrl}/otaMag/download/${uuid}`);
                } else {
                    this.$message.error(this.$t('otaManagement.getDownloadUrlFailed'));
                }
            });
        },
        formatDate,
        formatFileSize,
        async getFirmwareTypes() {
            try {
                const res = await Api.dict.getDictDataByType('FIRMWARE_TYPE')
                this.firmwareTypes = res.data
            } catch (error) {
                console.error('Failed to get firmware type:', error)
                this.$message.error(error.message || this.$t('otaManagement.getFirmwareTypesFailed'))
            }
        },
        getFirmwareTypeName(type) {
            const firmwareType = (this.firmwareTypes || []).find(item => item.key === type)
            return firmwareType ? firmwareType.name : type
        },
    },
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

.fw-cell {
    display: flex;
    align-items: center;
    gap: var(--nx-space-3);
    min-width: 0;
    &__icon {
        width: 36px;
        height: 36px;
        font-size: var(--nx-text-headline);
    }
    &__text {
        min-width: 0;
        flex: 1;
    }
    &__name {
        font-weight: 600;
        color: var(--nx-text);
    }
}
.nx-badge.nx-truncate {
    display: inline-block;
    max-width: 100%;
    line-height: 22px;
    vertical-align: middle;
}
</style>
