<template>
    <div class="nx-voiceprint">
        <HeaderBar />

        <main class="nx-page">
            <header class="nx-page-header">
                <div class="nx-page-header__text">
                    <button type="button" class="nx-back" @click="goBack">
                        <i class="el-icon-arrow-left" aria-hidden="true"></i>
                        {{ tx('voicePrint.backToAgents', 'Agents') }}
                    </button>
                    <h1 class="nx-title">{{ $t('voicePrint.pageTitle') }}</h1>
                    <p class="nx-page-header__desc">
                        {{ tx('voicePrint.pageDesc', 'TinyBot recognises who is talking from these voice samples.') }}
                    </p>
                </div>
                <div class="nx-page-header__actions">
                    <CustomButton icon="el-icon-plus" type="add" @click="showAddDialog">{{ $t('voicePrint.addSpeaker') }}</CustomButton>
                </div>
            </header>

            <section class="nx-card nx-card--flush vp-card" :aria-busy="loading ? 'true' : 'false'">
                <div v-if="allVoicePrints.length || loading" class="vp-row vp-row--head">
                    <span>{{ $t('voicePrint.name') }}</span>
                    <span class="vp-col-desc">{{ $t('voicePrint.description') }}</span>
                    <span class="vp-col-date">{{ $t('voicePrint.createTime') }}</span>
                    <span class="vp-col-actions"><span class="vp-sr">{{ $t('voicePrint.action') }}</span></span>
                </div>

                <div v-if="loading && !allVoicePrints.length">
                    <div v-for="n in 3" :key="'sk' + n" class="vp-row">
                        <span class="vp-name"><span class="nx-skeleton vp-sk-avatar"></span><span class="nx-skeleton vp-sk"></span></span>
                        <span class="vp-col-desc"><span class="nx-skeleton vp-sk vp-sk--wide"></span></span>
                        <span class="vp-col-date"><span class="nx-skeleton vp-sk"></span></span>
                    </div>
                </div>

                <div v-else-if="!allVoicePrints.length" class="nx-empty">
                    <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true"><i class="el-icon-microphone"></i></span>
                    <h2 class="nx-empty__title">{{ tx('voicePrint.emptyTitle', 'No speakers yet') }}</h2>
                    <p class="nx-empty__text">
                        {{ tx('voicePrint.emptyText', 'Talk to TinyBot first, then pick one of those recordings to teach it a family member’s voice.') }}
                    </p>
                    <CustomButton class="nx-empty__action" icon="el-icon-plus" type="add" @click="showAddDialog">
                        {{ $t('voicePrint.addSpeaker') }}
                    </CustomButton>
                </div>

                <ul v-else class="vp-list" role="list">
                    <li v-for="row in voicePrintList" :key="row.id" class="vp-row">
                        <span class="vp-name">
                            <span class="nx-avatar" aria-hidden="true">{{ initialOf(row.sourceName) }}</span>
                            <span class="nx-truncate vp-name__text" :title="row.sourceName">{{ row.sourceName || '–' }}</span>
                        </span>
                        <span class="vp-col-desc nx-truncate" :title="row.introduce">{{ row.introduce || '–' }}</span>
                        <span class="vp-col-date nx-num">{{ row.createDate || '–' }}</span>
                        <span class="vp-col-actions">
                            <el-tooltip :content="$t('voicePrint.edit')" placement="top" :open-delay="400">
                                <button type="button" class="nx-icon-btn" :aria-label="$t('voicePrint.edit') + ' ' + (row.sourceName || '')"
                                    @click="editVoicePrint(row)">
                                    <i class="el-icon-edit" aria-hidden="true"></i>
                                </button>
                            </el-tooltip>
                            <el-tooltip :content="$t('voicePrint.delete')" placement="top" :open-delay="400">
                                <button type="button" class="nx-icon-btn nx-icon-btn--danger"
                                    :aria-label="$t('voicePrint.delete') + ' ' + (row.sourceName || '')"
                                    @click="deleteVoicePrint(row.id, row.sourceName)">
                                    <i class="el-icon-delete" aria-hidden="true"></i>
                                </button>
                            </el-tooltip>
                        </span>
                    </li>
                </ul>

                <footer v-if="total > pageSizeOptions[0]" class="vp-footer">
                    <CustomPagination :total="total" :current-page="currentPage" :page-size="pageSize"
                        :page-size-options="pageSizeOptions" @size-change="handlePageSizeChange" @page-change="goToPage" />
                </footer>
            </section>
        </main>

        <voice-print-dialog :title="dialogTitle" :visible.sync="dialogVisible" :agentId="agentId" :form="paramForm"
            @submit="handleSubmit" @cancel="dialogVisible = false" />
        <VersionFooter />
    </div>
</template>

<script>
import Api from "@/apis/api";
import HeaderBar from "@/components/HeaderBar.vue";
import VersionFooter from "@/components/VersionFooter.vue";
import VoicePrintDialog from "@/components/VoicePrintDialog.vue";
import CustomButton from "@/components/CustomButton.vue";
import CustomPagination from "@/components/CustomPagination.vue";

export default {
    components: { HeaderBar, VoicePrintDialog, VersionFooter, CustomButton, CustomPagination },
    data() {
        return {
            voicePrintList: [],
            allVoicePrints: [],
            loading: false,
            dialogVisible: false,
            dialogTitle: this.$t('voicePrint.addSpeaker'),
            currentPage: 1,
            pageSize: 10,
            pageSizeOptions: [10, 20, 50, 100],
            total: 0,
            paramForm: {
                id: null,
                audioId: '',
                sourceName: '',
                introduce: ''
            },
            agentId: "1"
        };
    },
    mounted() {
        const agentId = this.$route.query.agentId;
        if (agentId) {
            this.agentId = agentId;
            this.fetchVoicePrints();
        }
    },
    methods: {
        // Pending i18n keys fall back to their English text until the lead merges them
        tx(key, fallback, params) {
            if (this.$te(key) || this.$te(key, 'en')) return this.$t(key, params);
            if (!params) return fallback;
            return fallback.replace(/\{(\w+)\}/g, (match, name) => (params[name] !== undefined ? params[name] : match));
        },
        initialOf(name) {
            const text = (name || '').trim();
            return text ? Array.from(text)[0].toUpperCase() : '?';
        },
        goBack() {
            this.$router.push('/home');
        },
        fetchVoicePrints() {
            this.loading = true;
            Api.agent.getAgentVoicePrintList(this.agentId,
                ({ data }) => {
                    this.loading = false;
                    if (data.code === 0) {
                        this.allVoicePrints = data.data || [];
                        this.total = this.allVoicePrints.length;
                        this.currentPage = 1;
                        this.updatePagedData();
                    } else {
                        this.$message.error({
                            message: data.msg || this.$t('voicePrint.fetchFailed'),
                            showClose: true
                        });
                    }
                }
            );
        },
        updatePagedData() {
            const start = (this.currentPage - 1) * this.pageSize;
            this.voicePrintList = this.allVoicePrints.slice(start, start + this.pageSize);
        },
        handlePageSizeChange(val) {
            this.pageSize = val;
            this.currentPage = 1;
            this.updatePagedData();
        },
        goToPage(page) {
            if (page !== this.currentPage) {
                this.currentPage = page;
                this.updatePagedData();
            }
        },
        showAddDialog() {
            this.dialogTitle = this.$t('voicePrint.addSpeaker');
            this.paramForm = {
                id: null,
                audioId: '',
                sourceName: '',
                introduce: ''
            };
            this.dialogVisible = true;
        },
        editVoicePrint(row) {
            this.dialogTitle = this.$t('voicePrint.editSpeaker');
            this.paramForm = { ...row };
            this.dialogVisible = true;
        },
        handleSubmit({ form, done }) {
            if (form.id) {
                Api.agent.updateAgentVoicePrint(form, ({ data }) => {
                    if (data.code === 0) {
                        this.$message.success({
                            message: this.$t('voicePrint.updateSuccess'),
                            showClose: true
                        });
                        this.dialogVisible = false;
                        this.fetchVoicePrints();
                    }
                    done && done();
                });
            } else {
                Api.agent.addAgentVoicePrint({
                    agentId: this.agentId,
                    audioId: form.audioId,
                    sourceName: form.sourceName,
                    introduce: form.introduce
                }, ({ data }) => {
                    if (data.code === 0) {
                        this.$message.success({
                            message: this.$t('voicePrint.addSuccess'),
                            showClose: true
                        });
                        this.dialogVisible = false;
                        this.fetchVoicePrints();
                    }
                    done && done();
                });
            }
        },
        deleteVoicePrint(id, name) {
            const message = name
                ? this.tx('voicePrint.confirmDeleteNamed', 'Delete the voiceprint of {name}? TinyBot will no longer recognise this voice.', { name })
                : this.$t('voicePrint.confirmDelete');
            this.$confirm(message, this.$t('voicePrint.warning'), {
                confirmButtonText: this.$t('voicePrint.delete'),
                cancelButtonText: this.$t('voicePrint.cancel'),
                confirmButtonClass: 'el-button--danger',
                type: 'warning',
                distinguishCancelAndClose: true
            }).then(() => {
                Api.agent.deleteAgentVoicePrint(id, ({ data }) => {
                    if (data.code === 0) {
                        this.$message.success({
                            message: this.$t('voicePrint.deleteSuccess'),
                            showClose: true
                        });
                        this.fetchVoicePrints();
                    } else {
                        this.$message.error({
                            message: data.msg || this.$t('voicePrint.deleteFailed'),
                            showClose: true
                        });
                    }
                });
            }).catch(action => {
                if (action === 'cancel') {
                    this.$message({
                        type: 'info',
                        message: this.$t('voicePrint.cancelDelete'),
                        duration: 1000
                    });
                } else {
                    this.$message({
                        type: 'info',
                        message: this.$t('voicePrint.closeOperation'),
                        duration: 1000
                    });
                }
            });
        }
    }
};
</script>

<style lang="scss" scoped>
.nx-voiceprint {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--nx-bg);

    > .nx-page {
        flex: 1 0 auto;
    }
}

.vp-sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
}

.vp-list {
    margin: 0;
    padding: 0;
    list-style: none;
}

.vp-row {
    display: grid;
    grid-template-columns: minmax(160px, 1.2fr) minmax(0, 2fr) 170px 88px;
    align-items: center;
    gap: var(--nx-space-4);
    min-height: 60px;
    padding: var(--nx-space-2) var(--nx-space-5);
    border-bottom: 1px solid var(--nx-border);
    font-size: var(--nx-text-callout);
    color: var(--nx-text-2);
    transition: background-color var(--nx-dur-1) var(--nx-ease);

    &:last-child {
        border-bottom: 0;
    }
    &:not(.vp-row--head):hover {
        background: var(--nx-surface-2);
    }

    &--head {
        min-height: 40px;
        padding-top: 0;
        padding-bottom: 0;
        background: var(--nx-surface-2);
        font-size: var(--nx-text-caption);
        font-weight: 600;
        letter-spacing: 0.01em;
    }
}

.vp-name {
    display: flex;
    align-items: center;
    gap: var(--nx-space-3);
    min-width: 0;

    &__text {
        color: var(--nx-text);
        font-size: var(--nx-text-body);
        font-weight: 600;
    }
}

.vp-col-date {
    font-size: var(--nx-text-footnote);
    white-space: nowrap;
}

.vp-col-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--nx-space-1);
}

.vp-sk {
    width: 60%;
    height: 12px;
    &--wide {
        width: 85%;
    }
}
.vp-sk-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    flex: none;
}

.vp-footer {
    display: flex;
    justify-content: flex-end;
    padding: var(--nx-space-3) var(--nx-space-5);
    border-top: 1px solid var(--nx-border);
    overflow-x: auto;
}

@media (max-width: 760px) {
    .vp-row {
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-areas:
            "name actions"
            "desc desc"
            "date date";
        row-gap: 2px;
        padding: var(--nx-space-3) var(--nx-space-4);
    }
    .vp-row--head {
        display: none;
    }
    .vp-name {
        grid-area: name;
    }
    .vp-col-desc {
        grid-area: desc;
        padding-left: calc(36px + var(--nx-space-3));
    }
    .vp-col-date {
        grid-area: date;
        padding-left: calc(36px + var(--nx-space-3));
        font-size: var(--nx-text-caption);
        color: var(--nx-text-3);
    }
    .vp-col-actions {
        grid-area: actions;
    }
}
</style>
