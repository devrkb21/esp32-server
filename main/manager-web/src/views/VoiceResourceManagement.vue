<template>
    <div class="nx-app">
        <HeaderBar />

        <main class="nx-page">
            <header class="nx-page-header">
                <div class="nx-page-header__text">
                    <h1 class="nx-title">{{ $t('voiceResource.title') }}</h1>
                    <p class="nx-page-header__desc">
                        {{ tx('voiceResource.pageDesc', 'Voice slots on each TTS platform and the accounts they belong to.') }}
                    </p>
                </div>
                <div class="nx-page-header__actions">
                    <el-input v-model="searchName" class="vr-search" prefix-icon="el-icon-search"
                        :placeholder="$t('voiceClone.searchPlaceholder')" :aria-label="$t('voiceClone.search')"
                        clearable @keyup.enter.native="handleSearch" @clear="handleSearch" />
                    <CustomButton icon="el-icon-plus" type="add" @click="showAddDialog">
                        {{ $t('voiceClone.addVoiceClone') }}
                    </CustomButton>
                </div>
            </header>

            <section class="nx-card nx-card--flush vr-card" :aria-label="$t('voiceResource.title')">
                <div class="vr-card__head">
                    <div class="nx-row vr-card__title">
                        <h2 class="nx-headline">{{ $t('voiceResource.title') }}</h2>
                        <span class="nx-badge nx-num">{{ formatCount(total) }}</span>
                    </div>
                    <transition name="nx-fade">
                        <div v-if="selectedCount" class="nx-row vr-card__bulk">
                            <span class="nx-footnote nx-num">
                                {{ tx('voiceResource.selected', '{count} selected', { count: selectedCount }) }}
                            </span>
                            <CustomButton size="small" type="delete" icon="el-icon-delete"
                                @click="deleteSelectedVoiceClones">{{ $t('voiceClone.delete') }}</CustomButton>
                        </div>
                    </transition>
                </div>

                <div class="vr-card__body" v-loading="loading" :element-loading-text="$t('common.loading')">
                    <el-table v-show="voiceCloneList.length || loading" ref="voiceTable" :data="voiceCloneList"
                        class="vr-table">
                        <el-table-column width="52" align="center">
                            <template slot="header">
                                <el-checkbox :value="isAllSelected" :indeterminate="isIndeterminate"
                                    :aria-label="isAllSelected ? $t('voiceClone.deselectAll') : $t('voiceClone.selectAll')"
                                    @change="handleSelectAll" />
                            </template>
                            <template slot-scope="scope">
                                <el-checkbox :value="scope.row.selected" :aria-label="scope.row.name || scope.row.voiceId"
                                    @change="toggleRow(scope.row)" />
                            </template>
                        </el-table-column>

                        <el-table-column :label="$t('voiceClone.name')" min-width="220">
                            <template slot-scope="scope">
                                <div class="vr-name">
                                    <span class="vr-name__text nx-truncate" :title="scope.row.name">{{ scope.row.name || '—' }}</span>
                                    <span class="nx-caption nx-mono nx-truncate" :title="scope.row.voiceId">{{ scope.row.voiceId }}</span>
                                </div>
                            </template>
                        </el-table-column>

                        <el-table-column :label="$t('voiceClone.userId')" min-width="140">
                            <template slot-scope="scope">
                                <span class="nx-truncate vr-cell" :title="scope.row.userName">{{ scope.row.userName || '—' }}</span>
                            </template>
                        </el-table-column>

                        <el-table-column :label="$t('voiceClone.platformName')" min-width="150">
                            <template slot-scope="scope">
                                <span class="nx-truncate vr-cell" :title="scope.row.modelName">{{ scope.row.modelName || '—' }}</span>
                            </template>
                        </el-table-column>

                        <el-table-column :label="$t('voiceClone.languages')" min-width="120">
                            <template slot-scope="scope">
                                <span class="nx-truncate vr-cell" :title="scope.row.languages">{{ scope.row.languages || '—' }}</span>
                            </template>
                        </el-table-column>

                        <el-table-column :label="$t('voiceClone.trainStatus')" min-width="160">
                            <template slot-scope="scope">
                                <el-tooltip :content="scope.row.trainError" placement="top"
                                    :disabled="!(scope.row.trainStatus === 3 && scope.row.trainError)">
                                    <span class="nx-badge" :class="statusBadgeClass(scope.row)">
                                        <i :class="statusIcon(scope.row)" aria-hidden="true"></i>
                                        {{ getTrainStatusText(scope.row) }}
                                    </span>
                                </el-tooltip>
                            </template>
                        </el-table-column>

                        <el-table-column :label="$t('voiceClone.createdAt')" min-width="170">
                            <template slot-scope="scope">
                                <span class="nx-num vr-date">{{ formatDate(scope.row.createDate) }}</span>
                            </template>
                        </el-table-column>

                        <el-table-column :label="$t('voiceClone.action')" width="112" align="right">
                            <template slot-scope="scope">
                                <div class="vr-actions">
                                    <el-tooltip
                                        :content="isRowPlaying(scope.row) ? $t('voiceClone.pause') : tx('voiceResource.audition', 'Play sample')"
                                        placement="top" :open-delay="300">
                                        <button type="button" class="nx-icon-btn vr-play"
                                            :class="{ 'is-playing': isRowPlaying(scope.row) }"
                                            :aria-label="isRowPlaying(scope.row) ? $t('voiceClone.pause') : tx('voiceResource.audition', 'Play sample')"
                                            @click="toggleAudio(scope.row)">
                                            <i :class="isRowPlaying(scope.row) ? 'el-icon-video-pause' : 'el-icon-video-play'"
                                                aria-hidden="true"></i>
                                        </button>
                                    </el-tooltip>
                                    <el-tooltip :content="$t('voiceClone.delete')" placement="top" :open-delay="300">
                                        <button type="button" class="nx-icon-btn nx-icon-btn--danger"
                                            :aria-label="$t('voiceClone.delete')" @click="deleteVoiceClone(scope.row)">
                                            <i class="el-icon-delete" aria-hidden="true"></i>
                                        </button>
                                    </el-tooltip>
                                </div>
                            </template>
                        </el-table-column>
                    </el-table>

                    <div v-if="!loading && !voiceCloneList.length" class="nx-empty">
                        <span class="nx-icon-tile nx-icon-tile--lg"><i class="el-icon-headset" aria-hidden="true"></i></span>
                        <h3 class="nx-empty__title">
                            {{ searchName ? tx('voiceResource.noResultsTitle', 'No matching voices') : tx('voiceResource.emptyTitle', 'No voice resources yet') }}
                        </h3>
                        <p class="nx-empty__text">
                            {{ searchName
                                ? tx('voiceResource.noResultsText', 'Try a different name or voice ID.')
                                : tx('voiceResource.emptyText', 'Add a voice resource to assign it to an account.') }}
                        </p>
                        <CustomButton class="nx-empty__action" icon="el-icon-plus" type="add" @click="showAddDialog">
                            {{ $t('voiceClone.addVoiceClone') }}
                        </CustomButton>
                    </div>
                </div>

                <div v-if="total > 0" class="vr-card__foot">
                    <CustomPagination :total="total" :current-page="currentPage" :page-size="pageSize"
                        :page-size-options="pageSizeOptions" @size-change="handlePageSizeChange"
                        @page-change="goToPage" />
                </div>
            </section>

            <VersionFooter />
        </main>

        <!-- Add Voice Resource Dialog -->
        <voice-clone-dialog :title="$t('voiceClone.addVoiceClone')" :visible.sync="dialogVisible" :form="voiceCloneForm"
            @submit="handleSubmit" @cancel="dialogVisible = false" />
    </div>
</template>

<script>
import Api from "@/apis/api";
import HeaderBar from "@/components/HeaderBar.vue";
import VersionFooter from "@/components/VersionFooter.vue";
import VoiceCloneDialog from "@/components/VoiceResourceDialog.vue";
import CustomButton from "@/components/CustomButton.vue";
import CustomPagination from "@/components/CustomPagination.vue";
import { formatDate } from "@/utils/format";

export default {
    components: { HeaderBar, VoiceCloneDialog, VersionFooter, CustomButton, CustomPagination },
    data() {
        return {
            searchName: "",
            loading: false,
            voiceCloneList: [],
            currentPage: 1,
            pageSize: 10,
            pageSizeOptions: [10, 20, 50, 100],
            total: 0,
            dialogVisible: false,
            isAllSelected: false,
            voiceCloneForm: {
                modelId: "",
                voiceIds: [],
                userId: null,
                languages: ""
            },
            tableColumns: [],
            playingVoiceId: null,
            isPaused: false,
            currentAudio: null
        };
    },
    computed: {
        selectedCount() {
            return this.voiceCloneList.filter(row => row.selected).length;
        },
        isIndeterminate() {
            return this.selectedCount > 0 && this.selectedCount < this.voiceCloneList.length;
        }
    },
    created() {
        this.initTableColumns();
        this.fetchVoiceCloneList();
    },
    methods: {
        // $t with an English fallback for keys still waiting in i18n/_pending
        tx(key, fallback, params) {
            const value = this.$t(key, params);
            if (value !== key) return value;
            return String(fallback).replace(/\{(\w+)\}/g, (m, k) => (params && params[k] != null ? params[k] : m));
        },
        formatCount(value) {
            return (Number(value) || 0).toLocaleString();
        },
        toggleRow(row) {
            this.$set(row, 'selected', !row.selected);
            this.isAllSelected = this.voiceCloneList.length > 0 && this.voiceCloneList.every(item => item.selected);
        },
        isRowPlaying(row) {
            return this.playingVoiceId === (row.id || row.voiceId) && !this.isPaused;
        },
        // Status badge tone: colour always paired with an icon and a word
        statusBadgeClass(row) {
            if (!row.hasVoice) return '';
            switch (row.trainStatus) {
                case 0:
                    return 'nx-badge--warning';
                case 1:
                    return 'nx-badge--info';
                case 2:
                    return 'nx-badge--success';
                case 3:
                    return 'nx-badge--danger';
                default:
                    return '';
            }
        },
        statusIcon(row) {
            if (!row.hasVoice) return 'el-icon-upload2';
            switch (row.trainStatus) {
                case 0:
                    return 'el-icon-time';
                case 1:
                    return 'el-icon-refresh';
                case 2:
                    return 'el-icon-circle-check';
                case 3:
                    return 'el-icon-warning-outline';
                default:
                    return 'el-icon-more-outline';
            }
        },
        initTableColumns() {
            this.tableColumns = [
                { prop: 'voiceId', label: this.$t('voiceClone.voiceId'), align: 'center' },
                { prop: 'name', label: this.$t('voiceClone.name'), align: 'center' },
                { prop: 'userName', label: this.$t('voiceClone.userId'), align: 'center' },
                { prop: 'modelName', label: this.$t('voiceClone.platformName'), align: 'center' },
                { prop: 'languages', label: this.$t('voiceClone.languages'), align: 'center' },
                { prop: 'trainStatus', label: this.$t('voiceClone.trainStatus'), align: 'center' },
                { prop: 'createdAt', label: this.$t('voiceClone.createdAt'), align: 'center' }
            ];
        },
        handlePageSizeChange(val) {
            this.pageSize = val;
            this.currentPage = 1;
            this.fetchVoiceCloneList();
        },
        fetchVoiceCloneList() {
            this.loading = true;
            const params = {
                page: this.currentPage,
                limit: this.pageSize,
                name: this.searchName || "",
                orderField: "create_date",
                order: "desc"
            };
            Api.voiceResource.getVoiceResourceList(params, (res) => {
                this.loading = false;
                res = res.data
                if (res.code === 0) {
                    this.voiceCloneList = res.data.list.map(item => ({
                        ...item,
                        selected: false
                    }));
                    this.total = res.data.total || 0;
                    this.isAllSelected = false;
                } else {
                    this.voiceCloneList = [];
                    this.total = 0;
                    this.$message.error({
                        message: res?.data?.msg || this.$t('voiceClone.deleteFailed'),
                        showClose: true
                    });
                }
            });
        },
        handleSearch() {
            this.currentPage = 1;
            this.fetchVoiceCloneList();
        },
        handleSelectAll() {
            this.isAllSelected = !this.isAllSelected;
            this.voiceCloneList.forEach(row => {
                row.selected = this.isAllSelected;
            });
        },
        showAddDialog() {
            this.voiceCloneForm = {
                modelId: "",
                voiceIds: [],
                userId: null,
                languages: ""
            };
            this.$nextTick(() => {
                if (this.$refs.voiceCloneForm) {
                    this.$refs.voiceCloneForm.clearValidate();
                }
            });
            this.dialogVisible = true;
        },
        handleSubmit(formData) {
            Api.voiceResource.saveVoiceResource(formData, (res) => {
                res = res.data;
                if (res.code === 0) {
                    this.$message.success({
                        message: this.$t('voiceClone.addSuccess'),
                        showClose: true
                    });
                    this.dialogVisible = false;
                    this.fetchVoiceCloneList();
                } else {
                    this.$message.error({
                        message: res.msg || this.$t('voiceClone.addFailed'),
                        showClose: true
                    });
                }
            });
        },
        deleteSelectedVoiceClones() {
            const selectedRows = this.voiceCloneList.filter(row => row.selected);
            if (selectedRows.length === 0) {
                this.$message.warning({
                    message: this.$t('voiceClone.selectFirst'),
                    showClose: true
                });
                return;
            }
            this.deleteVoiceClone(selectedRows);
        },
        deleteVoiceClone(row) {
            const items = Array.isArray(row) ? row : [row];

            if (Array.isArray(row) && row.length === 0) {
                this.$message.warning({
                    message: this.$t('voiceClone.selectFirst'),
                    showClose: true
                });
                return;
            }

            const itemCount = items.length;
            const confirmTitle = itemCount === 1 && items[0].name ? items[0].name : this.$t('voiceClone.warning');
            this.$confirm(this.$t('voiceClone.confirmDelete', { count: itemCount }), confirmTitle, {
                confirmButtonText: this.$t('voiceClone.delete'),
                confirmButtonClass: 'el-button--danger',
                cancelButtonText: this.$t('voiceClone.cancel'),
                type: 'warning',
                distinguishCancelAndClose: true
            }).then(() => {
                const ids = items.map(item => item.id);
                if (ids.some(id => !id)) {
                    this.$message.error({
                        message: this.$t('voiceClone.deleteFailed'),
                        showClose: true
                    });
                    return;
                }

                Api.voiceResource.deleteVoiceResource(ids, (res) => {
                    res = res.data;
                    if (res.code === 0) {
                        this.$message.success({
                            message: this.$t('voiceClone.deleteSuccess', { count: itemCount }),
                            showClose: true
                        });
                        this.fetchVoiceCloneList();
                    } else {
                        this.$message.error({
                            message: res.msg || this.$t('voiceClone.deleteFailed'),
                            showClose: true
                        });
                    }
                });
            }).catch(action => {
                if (action === 'cancel') {
                    this.$message({
                        type: 'info',
                        message: this.$t('voiceClone.operationCancelled'),
                        duration: 1000
                    });
                } else {
                    this.$message({
                        type: 'info',
                        message: this.$t('voiceClone.operationClosed'),
                        duration: 1000
                    });
                }
            });
        },
        goToPage(page) {
            if (page !== this.currentPage) {
                this.currentPage = page;
                this.fetchVoiceCloneList();
            }
        },
        formatDate,
        getTrainStatusText(row) {
            if (!row.hasVoice) {
                return this.$t('voiceClone.waitingUpload');
            }
            switch (row.trainStatus) {
                case 0:
                    return this.$t('voiceClone.waitingTraining');
                case 1:
                    return this.$t('voiceClone.training');
                case 2:
                    return this.$t('voiceClone.trainSuccess');
                case 3:
                    return this.$t('voiceClone.trainFailed');
                default:
                    return '';
            }
        },
        toggleAudio(row) {
            const rowId = row.id || row.voiceId;
            if (this.playingVoiceId === rowId && this.currentAudio) {
                if (this.isPaused) {
                    this.currentAudio.play();
                    this.isPaused = false;
                } else {
                    this.currentAudio.pause();
                    this.isPaused = true;
                }
                return;
            }
            if (this.currentAudio) {
                this.currentAudio.pause();
                this.currentAudio = null;
            }
            this.playingVoiceId = rowId;
            this.isPaused = false;

            let audioUrl = row.voiceDemo || row.voice_demo;
            if (!audioUrl) {
                const voiceKey = row.ttsVoice || row.voiceId || rowId;
                audioUrl = `/voice-demos/${voiceKey}.mp3`;
            }
            this.currentAudio = new Audio(audioUrl);
            this.currentAudio.onended = () => {
                this.playingVoiceId = null;
                this.isPaused = false;
            };
            this.currentAudio.onerror = () => {
                this.$message.warning(this.$t('roleConfig.noPreviewAudio') || 'Audio preview not available');
                this.playingVoiceId = null;
            };
            this.currentAudio.play().catch(() => {
                this.playingVoiceId = null;
            });
        }
    },
    beforeDestroy() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
    }
};
</script>

<style lang="scss" scoped>
.nx-app {
    min-height: 100vh;
    background: var(--nx-bg);
}

.vr-search {
    width: 280px;
}

.vr-card {
    display: flex;
    flex-direction: column;
    min-width: 0;

    &__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--nx-space-3);
        min-height: 64px;
        padding: var(--nx-space-3) var(--nx-space-5);
        border-bottom: 1px solid var(--nx-border);
    }
    &__title {
        min-width: 0;
    }
    &__bulk {
        gap: var(--nx-space-2);
    }
    &__body {
        min-height: 240px;
    }
    &__foot {
        display: flex;
        justify-content: flex-end;
        padding: var(--nx-space-3) var(--nx-space-5);
        border-top: 1px solid var(--nx-border);
    }
}

.vr-table {
    width: 100%;

    &::before {
        display: none;
    }
    ::v-deep th.el-table__cell:first-child .cell,
    ::v-deep td.el-table__cell:first-child .cell {
        padding-left: var(--nx-space-4);
    }
    ::v-deep th.el-table__cell:last-child .cell,
    ::v-deep td.el-table__cell:last-child .cell {
        padding-right: var(--nx-space-4);
    }
}

.vr-name {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    padding: var(--nx-space-1) 0;

    &__text {
        font-weight: 600;
        color: var(--nx-text);
    }
}

.vr-cell {
    display: block;
}

.vr-date {
    color: var(--nx-text-2);
    white-space: nowrap;
}

.vr-actions {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 2px;
    width: 100%;
}

.vr-play.is-playing {
    background: var(--nx-accent-soft);
    color: var(--nx-accent);
}

@media (max-width: 640px) {
    .vr-search {
        flex: 1 1 200px;
        width: auto;
    }
    .nx-page-header__actions {
        width: 100%;
    }
    .vr-card__head {
        padding: var(--nx-space-3) var(--nx-space-4);
    }
}
</style>
