<template>
  <div class="nx-app">
    <HeaderBar />

    <main class="nx-page">
      <!-- ============================================================ List of knowledge bases -->
      <template v-if="!selectedKb">
        <header class="nx-page-header">
          <div class="nx-page-header__text">
            <h1 class="nx-title">{{ $t('knowledgeBaseManagement.title') }}</h1>
            <p class="nx-page-header__desc">
              {{ tx('knowledgeBaseManagement.pageDesc', 'Documents your robots can look up when they answer questions.') }}
            </p>
          </div>
          <div class="nx-page-header__actions">
            <el-input
              v-model="searchKbName"
              class="kb-search"
              prefix-icon="el-icon-search"
              :placeholder="$t('knowledgeBaseManagement.searchPlaceholder')"
              :aria-label="$t('knowledgeBaseManagement.search')"
              clearable
              @keyup.enter.native="handleSearchKb"
              @clear="handleSearchKb"
            />
            <CustomButton type="add" icon="el-icon-plus" @click="showAddDialog">
              {{ $t('knowledgeBaseManagement.addKnowledgeBase') }}
            </CustomButton>
          </div>
        </header>

        <!-- Loading skeleton -->
        <div v-if="loading && !knowledgeBases.length" class="nx-grid" aria-busy="true">
          <div v-for="n in 3" :key="'sk' + n" class="nx-card kb-card kb-card--skeleton">
            <div class="nx-row">
              <span class="nx-skeleton kb-sk-tile"></span>
              <span class="nx-spacer"></span>
              <span class="nx-skeleton kb-sk-badge"></span>
            </div>
            <span class="nx-skeleton kb-sk-title"></span>
            <span class="nx-skeleton kb-sk-line"></span>
            <span class="nx-skeleton kb-sk-line kb-sk-line--short"></span>
          </div>
        </div>

        <!-- Cards -->
        <div v-else-if="filteredKnowledgeBases.length" class="nx-grid" v-loading="loading">
          <article
            v-for="kb in filteredKnowledgeBases"
            :key="kb.datasetId"
            class="nx-card nx-card--interactive kb-card"
            :class="{ 'is-error': !!kb.errorMessage, 'is-disabled': kb.status !== 1 }"
            role="button"
            tabindex="0"
            :aria-label="kb.name"
            @click="selectKnowledgeBase(kb)"
            @keydown.enter.self.prevent="selectKnowledgeBase(kb)"
            @keydown.space.self.prevent="selectKnowledgeBase(kb)"
          >
            <div class="kb-card__top">
              <span class="nx-icon-tile kb-card__icon" :class="{ 'kb-card__icon--error': !!kb.errorMessage }">
                <ManualIcon />
              </span>
              <el-tooltip v-if="kb.errorMessage" :content="kb.errorMessage" placement="top" popper-class="kb-tip">
                <span class="nx-badge nx-badge--danger" tabindex="0" @click.stop>
                  <i class="el-icon-warning-outline" aria-hidden="true"></i>
                  {{ tx('knowledgeBaseManagement.needsAttention', 'Needs attention') }}
                </span>
              </el-tooltip>
              <span v-else-if="kb.status === 1" class="nx-badge nx-badge--success">
                <i class="el-icon-circle-check" aria-hidden="true"></i>
                {{ $t('knowledgeBaseManagement.enabled') }}
              </span>
              <span v-else class="nx-badge">
                <i class="el-icon-remove-outline" aria-hidden="true"></i>
                {{ $t('knowledgeBaseManagement.disabled') }}
              </span>
            </div>

            <h2 class="nx-headline nx-truncate kb-card__name" :title="kb.name">{{ kb.name }}</h2>
            <p class="kb-card__desc" :title="kb.description">{{ kb.description || '—' }}</p>

            <div class="kb-card__foot">
              <div class="kb-card__meta">
                <span class="nx-num">
                  <i class="el-icon-document" aria-hidden="true"></i>
                  {{ tx('knowledgeBaseManagement.docCount', '{count} documents', { count: formatCount(kb.documentCount) }) }}
                </span>
                <span v-if="kb.updatedAt || kb.createdAt" class="nx-num">
                  <i class="el-icon-time" aria-hidden="true"></i>
                  {{ formatDate(kb.updatedAt || kb.createdAt) }}
                </span>
              </div>
              <div class="kb-card__controls" @click.stop @keydown.stop>
                <el-switch
                  v-model="kb.status"
                  :active-value="1"
                  :inactive-value="0"
                  :aria-label="$t('knowledgeBaseManagement.status')"
                  @change="handleStatusChange(kb)"
                />
                <el-dropdown trigger="click" placement="bottom-end" @command="(cmd) => handleCardCommand(cmd, kb)">
                  <button type="button" class="nx-icon-btn" :aria-label="tx('knowledgeBaseManagement.moreActions', 'More actions')">
                    <i class="el-icon-more" aria-hidden="true"></i>
                  </button>
                  <el-dropdown-menu slot="dropdown">
                    <el-dropdown-item command="edit" icon="el-icon-edit">
                      {{ $t('knowledgeBaseManagement.edit') }}
                    </el-dropdown-item>
                    <el-dropdown-item command="delete" icon="el-icon-delete" class="kb-menu-danger">
                      {{ $t('knowledgeBaseManagement.delete') }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </el-dropdown>
              </div>
            </div>
          </article>
        </div>

        <!-- Empty -->
        <div v-else class="nx-card">
          <div class="nx-empty">
            <span class="nx-icon-tile nx-icon-tile--lg"><i class="el-icon-notebook-2" aria-hidden="true"></i></span>
            <h3 class="nx-empty__title">
              {{ searchKbName ? tx('knowledgeBaseManagement.noResultsTitle', 'No matching knowledge bases') : tx('knowledgeBaseManagement.emptyTitle', 'No knowledge bases yet') }}
            </h3>
            <p class="nx-empty__text">
              {{ searchKbName
                ? tx('knowledgeBaseManagement.noResultsText', 'Try a different name or clear the search.')
                : tx('knowledgeBaseManagement.emptyText', 'Create one, then upload documents your robots can learn from.') }}
            </p>
            <CustomButton class="nx-empty__action" type="add" icon="el-icon-plus" @click="showAddDialog">
              {{ $t('knowledgeBaseManagement.addKnowledgeBase') }}
            </CustomButton>
          </div>
        </div>
      </template>

      <!-- ============================================================ One knowledge base -->
      <template v-else>
        <button type="button" class="nx-back" @click="clearSelection">
          <i class="el-icon-arrow-left" aria-hidden="true"></i>
          {{ $t('knowledgeBaseManagement.title') }}
        </button>
        <header class="nx-page-header">
          <div class="nx-page-header__text">
            <div class="nx-row kb-detail-title">
              <span class="nx-icon-tile" :class="{ 'kb-card__icon--error': !!selectedKb.errorMessage }">
                <ManualIcon />
              </span>
              <h1 class="nx-title nx-truncate" :title="selectedKb.name">{{ selectedKb.name }}</h1>
              <el-tooltip v-if="selectedKb.errorMessage" :content="selectedKb.errorMessage" placement="bottom"
                popper-class="kb-tip">
                <span class="nx-badge nx-badge--danger" tabindex="0">
                  <i class="el-icon-warning-outline" aria-hidden="true"></i>
                  {{ tx('knowledgeBaseManagement.needsAttention', 'Needs attention') }}
                </span>
              </el-tooltip>
              <span v-else-if="selectedKb.status === 1" class="nx-badge nx-badge--success">
                {{ $t('knowledgeBaseManagement.enabled') }}
              </span>
              <span v-else class="nx-badge">{{ $t('knowledgeBaseManagement.disabled') }}</span>
            </div>
            <p v-if="selectedKb.description" class="nx-page-header__desc kb-detail-desc">{{ selectedKb.description }}</p>
          </div>
          <div class="nx-page-header__actions">
            <CustomButton icon="el-icon-edit" @click="editKnowledgeBase(selectedKb)">
              {{ $t('knowledgeBaseManagement.edit') }}
            </CustomButton>
            <el-tooltip :content="$t('knowledgeBaseManagement.delete')" placement="bottom">
              <button type="button" class="nx-icon-btn nx-icon-btn--danger kb-detail-delete"
                :aria-label="$t('knowledgeBaseManagement.delete')" @click="deleteKnowledgeBase(selectedKb)">
                <i class="el-icon-delete" aria-hidden="true"></i>
              </button>
            </el-tooltip>
          </div>
        </header>

        <div class="kb-detail">
          <KnowledgeBaseItem
            ref="knowledgeBaseItem"
            :kb="selectedKb"
            @upload="showUploadDialog"
            @retrieval-test="focusRetrievalTest"
            @view-slices="handleViewSlices"
            @refresh="refreshDocuments"
          />

          <!-- Retrieval test panel -->
          <aside class="nx-card kb-test" :aria-label="$t('knowledgeFileUpload.retrievalTest')">
            <div class="kb-test__head">
              <h2 class="nx-headline">{{ $t('knowledgeFileUpload.retrievalTest') }}</h2>
              <p class="nx-footnote">
                {{ tx('knowledgeBaseManagement.testDesc', 'Ask a question to see which passages your robot would find.') }}
              </p>
            </div>
            <form class="kb-test__form" @submit.prevent="runRetrievalTest">
              <label class="kb-test__label" for="kb-test-question">{{ $t('knowledgeFileUpload.testQuestion') }}</label>
              <el-input
                id="kb-test-question"
                ref="retrievalInput"
                v-model="retrievalTestForm.question"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 5 }"
                :placeholder="$t('knowledgeFileUpload.testQuestionPlaceholder')"
                @keydown.native.enter.exact.prevent="runRetrievalTest"
              />
              <CustomButton type="confirm" icon="el-icon-search" class="kb-test__run" :loading="retrievalTestLoading"
                @click="runRetrievalTest">
                {{ $t('knowledgeFileUpload.executeTest') }}
              </CustomButton>
            </form>

            <div class="kb-test__results" aria-live="polite">
              <template v-if="retrievalTestResult">
                <ol v-if="retrievalChunks.length" class="kb-results">
                  <li v-for="(chunk, index) in retrievalChunks" :key="index" class="kb-result">
                    <div class="kb-result__head">
                      <span class="nx-badge nx-badge--accent nx-num" :title="$t('knowledgeFileUpload.comprehensiveSimilarity')">
                        {{ formatSimilarity(chunk.similarity) }}
                      </span>
                      <span class="kb-result__source nx-truncate" :title="chunk.document_keyword">
                        <i class="el-icon-document" aria-hidden="true"></i>
                        {{ chunk.document_keyword || '—' }}
                      </span>
                    </div>
                    <div class="kb-result__bar" aria-hidden="true">
                      <span :style="{ transform: 'scaleX(' + clamp01(chunk.similarity) + ')' }"></span>
                    </div>
                    <p class="kb-result__text">{{ chunk.content }}</p>
                  </li>
                </ol>
                <div v-else class="kb-test__empty">
                  <i class="el-icon-search" aria-hidden="true"></i>
                  <span>{{ $t('knowledgeFileUpload.noRelatedSlices') }}</span>
                </div>
              </template>
              <div v-else class="kb-test__empty">
                <i class="el-icon-chat-line-square" aria-hidden="true"></i>
                <span>{{ tx('knowledgeBaseManagement.testIdle', 'Results appear here, best match first.') }}</span>
              </div>
            </div>
          </aside>
        </div>
      </template>

      <VersionFooter />
    </main>

    <!-- Knowledge Base Dialog -->
    <KnowledgeBaseDialog
      ref="knowledgeBaseDialog"
      :title="dialogTitle"
      :visible.sync="dialogVisible"
      :form="knowledgeBaseForm"
      @submit="handleSubmit"
      @cancel="dialogVisible = false"
    />

    <!-- Slice Dialog -->
    <CustomDialog
      :title="`${$t('knowledgeFileUpload.viewSlices')} · ${currentDocumentName}`"
      :visible.sync="sliceDialogVisible"
      width="880px"
      :footer="false"
    >
      <div class="kb-slices" v-loading="sliceLoading">
        <ol v-if="sliceList.length > 0" class="kb-slices__list">
          <li v-for="(slice, index) in sliceList" :key="index" class="kb-slice">
            <span class="nx-badge nx-num">
              {{ $t('knowledgeFileUpload.slice') }} {{ (sliceCurrentPage - 1) * slicePageSize + index + 1 }}
            </span>
            <div class="kb-slice__text">{{ slice.content }}</div>
          </li>
        </ol>
        <div v-else-if="!sliceLoading" class="nx-empty">
          <span class="nx-icon-tile nx-icon-tile--lg nx-icon-tile--neutral">
            <i class="el-icon-tickets" aria-hidden="true"></i>
          </span>
          <p class="nx-empty__text">{{ $t('knowledgeFileUpload.noSliceData') }}</p>
        </div>
      </div>
      <div v-if="sliceTotal > 0" class="kb-slices__pagination">
        <CustomPagination
          :total="parseInt(sliceTotal)"
          :current-page="sliceCurrentPage"
          :page-size="slicePageSize"
          :page-size-options="[10, 20, 50]"
          @size-change="handleSliceSizeChange"
          @page-change="handleSlicePageChange"
        />
      </div>
    </CustomDialog>

    <!-- Upload Dialog -->
    <CustomDialog
      :title="$t('knowledgeFileUpload.uploadDocument')"
      :visible.sync="uploadDialogVisible"
      width="640px"
      :close-on-click-modal="false"
      :confirmLoading="uploading"
      :cancel-text="$t('knowledgeFileUpload.cancel')"
      :confirm-text="selectedFilesList.length
        ? tx('knowledgeBaseManagement.uploadCount', 'Upload {count} files', { count: selectedFilesList.length })
        : $t('knowledgeFileUpload.uploadDocument')"
      @close="handleUploadDialogClose"
      @confirm="handleBatchUploadSubmit"
    >
      <el-upload
        ref="uploadRef"
        class="kb-dropzone"
        action="#"
        :auto-upload="false"
        :show-file-list="false"
        :on-change="handleFileChange"
        multiple
        accept=".doc,.docx,.pdf,.txt,.md,.mdx,.csv,.xls,.xlsx,.ppt,.pptx"
        drag
      >
        <span class="nx-icon-tile nx-icon-tile--lg"><i class="el-icon-upload2" aria-hidden="true"></i></span>
        <div class="kb-dropzone__title">{{ $t('knowledgeFileUpload.dragOrClick') }}</div>
        <div class="kb-dropzone__tip" slot="tip">{{ $t('knowledgeFileUpload.uploadTip') }}</div>
      </el-upload>

      <!-- Selected Files List -->
      <div v-if="selectedFilesList.length > 0" class="kb-files">
        <div class="kb-files__head">
          <span>{{ $t('knowledgeFileUpload.selectedFiles') }}</span>
          <span class="nx-badge nx-num">{{ selectedFilesList.length }}</span>
        </div>
        <ul class="kb-files__list">
          <li v-for="(file, index) in selectedFilesList" :key="index" class="kb-file">
            <span class="kb-file__ext">{{ fileExt(file.name) }}</span>
            <span class="kb-file__name nx-truncate" :title="file.name">{{ file.name }}</span>
            <span class="kb-file__size nx-num">{{ formatFileSize(file.size) }}</span>
            <button type="button" class="nx-icon-btn nx-icon-btn--danger kb-file__remove"
              :aria-label="tx('knowledgeBaseManagement.removeFile', 'Remove file')" @click="removeSelectedFile(index)">
              <i class="el-icon-close" aria-hidden="true"></i>
            </button>
          </li>
        </ul>
      </div>
    </CustomDialog>
  </div>
</template>

<script>
import Api from "@/apis/api";
import HeaderBar from "@/components/HeaderBar.vue";
import VersionFooter from "@/components/VersionFooter.vue";
import KnowledgeBaseDialog from "@/components/KnowledgeBaseDialog.vue";
import KnowledgeBaseItem from "./KnowledgeBaseItem.vue";
import ManualIcon from "@/components/ManualIcon.vue";
import CustomDialog from "@/components/CustomDialog.vue";
import CustomPagination from "@/components/CustomPagination.vue";
import CustomButton from "@/components/CustomButton.vue";

export default {
  components: { HeaderBar, VersionFooter, KnowledgeBaseDialog, KnowledgeBaseItem, ManualIcon, CustomDialog, CustomPagination, CustomButton },
  data() {
    return {
      knowledgeBases: [],
      selectedKb: null,
      searchKbName: '',
      loading: false,
      dialogVisible: false,
      dialogTitle: '',
      knowledgeBaseForm: {
        id: null,
        datasetId: null,
        name: '',
        description: '',
        status: 1
      },
      uploadDialogVisible: false,
      sliceDialogVisible: false,
      retrievalTestForm: {
        question: ''
      },
      retrievalTestResult: null,
      retrievalTestLoading: false,
      selectedFilesList: [],
      uploading: false,
      currentDocumentId: '',
      currentDocumentName: '',
      sliceList: [],
      sliceLoading: false,
      sliceCurrentPage: 1,
      slicePageSize: 10,
      sliceTotal: 0,
    };
  },
  computed: {
    filteredKnowledgeBases() {
      return this.knowledgeBases;
    },
    retrievalChunks() {
      return (this.retrievalTestResult && this.retrievalTestResult.chunks) || [];
    },
    routeKbId() {
      return (this.$route && this.$route.query && this.$route.query.kb) || '';
    },
  },
  watch: {
    // The open knowledge base lives in the URL (?kb=<datasetId>) so Back returns to the list
    routeKbId(id) {
      if (!id) {
        this.selectedKb = null;
        return;
      }
      if (!this.selectedKb || this.selectedKb.datasetId !== id) {
        const kb = this.knowledgeBases.find(item => String(item.datasetId) === String(id));
        if (kb) this.openKnowledgeBase(kb);
      }
    },
  },
  created() {
    this.fetchKnowledgeBases();
  },
  methods: {
    // $t with an English fallback for keys still waiting in i18n/_pending
    tx(key, fallback, params) {
      const value = this.$t(key, params);
      if (value !== key) return value;
      return String(fallback).replace(/\{(\w+)\}/g, (m, k) => (params && params[k] != null ? params[k] : m));
    },

    fetchKnowledgeBases() {
      this.loading = true;
      Api.knowledgeBase.getKnowledgeBaseList(
        { page: 1, page_size: 100, name: this.searchKbName },
        (res) => {
          this.loading = false;
          if (res.data && res.data.code === 0) {
            const pageData = res.data.data || {};
            this.knowledgeBases = pageData.list || [];
            if (this.selectedKb) {
              const updated = this.knowledgeBases.find(kb => kb.datasetId === this.selectedKb.datasetId);
              if (updated) this.selectedKb = updated;
            } else if (this.routeKbId) {
              const fromRoute = this.knowledgeBases.find(kb => String(kb.datasetId) === String(this.routeKbId));
              if (fromRoute) this.openKnowledgeBase(fromRoute);
            }
          } else {
            this.$message.error(res.data?.msg || this.$t('knowledgeBaseManagement.getListFailed'));
          }
        },
        () => {
          this.loading = false;
          this.$message.error(this.$t('knowledgeBaseManagement.getListFailed'));
        }
      );
    },

    selectKnowledgeBase(kb) {
      this.openKnowledgeBase(kb);
      if (this.routeKbId !== String(kb.datasetId)) {
        this.$router.push({ query: { ...this.$route.query, kb: String(kb.datasetId) } }).catch(() => {});
      }
    },

    openKnowledgeBase(kb) {
      if (!this.selectedKb || this.selectedKb.datasetId !== kb.datasetId) {
        this.retrievalTestForm.question = '';
        this.retrievalTestResult = null;
      }
      this.selectedKb = kb;
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

    refreshDocuments() {
      this.$refs.knowledgeBaseItem?.fetchDocuments();
    },

    handleSearchKb() {
      this.fetchKnowledgeBases();
    },

    handleCardCommand(command, kb) {
      if (command === 'edit') this.editKnowledgeBase(kb);
      if (command === 'delete') this.deleteKnowledgeBase(kb);
    },

    showAddDialog() {
      this.dialogTitle = this.$t('knowledgeBaseManagement.addKnowledgeBase');
      this.knowledgeBaseForm = {
        id: null,
        datasetId: null,
        name: '',
        description: '',
        status: 1
      };
      this.dialogVisible = true;
    },

    editKnowledgeBase(kb) {
      this.dialogTitle = this.$t('knowledgeBaseManagement.editKnowledgeBase');
      this.knowledgeBaseForm = {
        id: kb.id,
        datasetId: kb.datasetId,
        name: kb.name,
        description: kb.description || '',
        status: kb.status,
        ragModelId: kb.ragModelId
      };
      this.dialogVisible = true;
    },

    handleStatusChange(kb) {
      const updateForm = {
        id: kb.id,
        datasetId: kb.datasetId,
        name: kb.name,
        description: kb.description,
        status: kb.status
      };
      Api.knowledgeBase.updateKnowledgeBase(kb.datasetId, updateForm, (res) => {
        if (res.data && res.data.code !== 0) {
          this.fetchKnowledgeBases();
          this.$message.error(res.data?.msg || this.$t('knowledgeBaseManagement.updateFailed'));
        } else {
          this.$message.success(kb.status === 1 ? this.$t('knowledgeBaseManagement.enabled') : this.$t('knowledgeBaseManagement.disabled'));
          if (this.selectedKb && this.selectedKb.datasetId === kb.datasetId) {
            this.selectedKb = { ...kb };
          }
        }
      }, () => {
        this.fetchKnowledgeBases();
        this.$message.error(this.$t('knowledgeBaseManagement.updateFailed'));
      });
    },

    deleteKnowledgeBase(kb) {
      this.$confirm(
        this.$t("knowledgeBaseManagement.confirmBatchDelete", {count: 1}),
        kb.name || this.$t('message.warning'),
        {
          confirmButtonText: this.$t('knowledgeBaseManagement.delete'),
          cancelButtonText: this.$t('knowledgeBaseDialog.cancel'),
          confirmButtonClass: 'el-button--danger',
          type: 'warning'
        }
      ).then(() => {
        Api.knowledgeBase.deleteKnowledgeBase(kb.datasetId, (res) => {
          if (res.data && res.data.code === 0) {
            this.$message.success(this.$t('knowledgeBaseManagement.batchDeleteSuccess', { count: 1 }));
            if (this.selectedKb && this.selectedKb.datasetId === kb.datasetId) {
              this.clearSelection();
            }
            this.fetchKnowledgeBases();
          } else {
            this.$message.error(res.data?.msg || this.$t('knowledgeBaseManagement.deleteFailed'));
          }
        }, (err) => {
          this.$message.error(err?.data?.msg || this.$t('knowledgeBaseManagement.deleteFailed'));
        });
      }).catch(() => {});
    },

    showUploadDialog() {
      this.uploadDialogVisible = true;
    },

    handleSubmit(form) {
      if (form.id) {
        Api.knowledgeBase.updateKnowledgeBase(form.datasetId, form, (res) => {
          if (res.data && res.data.code === 0) {
            this.dialogVisible = false;
            this.fetchKnowledgeBases();
            this.$message.success(this.$t('knowledgeBaseManagement.updateSuccess'));
          } else {
            this.$message.error(res.data?.msg || this.$t('knowledgeBaseManagement.updateFailed'));
          }
        }, (err) => {
          this.$message.error(err?.data?.msg || this.$t('knowledgeBaseManagement.updateFailed'));
        });
      } else {
        const createData = {
          name: form.name,
          description: form.description,
          status: form.status,
          ragModelId: form.ragModelId
        };
        Api.knowledgeBase.createKnowledgeBase(createData, (res) => {
          if (res.data && res.data.code === 0) {
            this.dialogVisible = false;
            this.fetchKnowledgeBases();
            this.$message.success(this.$t('knowledgeBaseManagement.addSuccess'));
          } else {
            this.$message.error(res.data?.msg || this.$t('knowledgeBaseManagement.addFailed'));
          }
        }, (err) => {
          this.$message.error(err?.data?.msg || this.$t('knowledgeBaseManagement.addFailed'));
        });
      }
    },

    handleUploadDialogClose() {
      if (this.$refs.uploadRef) {
        this.$refs.uploadRef.clearFiles();
      }
      this.selectedFilesList = [];
    },

    handleFileChange(file) {
      if (!file || !file.raw) return;
       // File upload validation
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        this.$message.error(this.$t('knowledgeFileUpload.fileSizeExceeded'));
        return;
      }
      this.selectedFilesList.push({
        name: file.name,
        size: file.size,
        raw: file.raw
      });
    },

    removeSelectedFile(index) {
      this.selectedFilesList.splice(index, 1);
    },

    handleBatchUploadSubmit() {
      if (this.selectedFilesList.length === 0) {
        this.$message.error(this.$t('knowledgeFileUpload.fileRequired'));
        return;
      }

      this.uploading = true;

      const uploadPromises = this.selectedFilesList.map(file => {
        return new Promise((resolve, reject) => {
          const formData = new FormData();
          formData.append('file', file.raw);

          Api.knowledgeBase.uploadDocument(this.selectedKb.datasetId, formData,
            ({ data }) => {
              if (data && data.code === 0) {
                resolve({ success: true, fileName: file.name });
              } else {
                reject({ success: false, fileName: file.name, error: data?.msg || this.$t('knowledgeFileUpload.uploadFailed') });
              }
            },
            (err) => {
              if (err && err.data) {
                reject({ success: false, fileName: file.name, error: err.data.msg || err.msg || this.$t('knowledgeFileUpload.uploadFailed') });
              } else {
                reject({ success: false, fileName: file.name, error: this.$t('knowledgeFileUpload.uploadFailed') });
              }
              console.error('Failed to upload document:', err);
            }
          );
        });
      });

      Promise.all(uploadPromises.map(p => p.catch(e => e)))
        .then(results => {
          this.uploading = false;

          const successCount = results.filter(r => r.success).length;
          const failedCount = results.filter(r => !r.success).length;

          if (successCount > 0) {
            this.$message.success(this.$t('knowledgeFileUpload.uploadSuccess'));
          }

          if (failedCount > 0) {
            this.$message.error(this.$t('knowledgeFileUpload.uploadFailed'));
          }

          if (successCount > 0) {
            this.uploadDialogVisible = false;
            this.refreshDocuments();
          }
        })
        .catch(error => {
          this.uploading = false;
          this.$message.error(this.$t('knowledgeFileUpload.uploadFailed'));
          console.error(error);
        });
    },

    // The retrieval test is an inline panel now; the old "open dialog" event focuses it
    focusRetrievalTest() {
      this.$nextTick(() => {
        this.$refs.retrievalInput && this.$refs.retrievalInput.focus();
      });
    },

    showRetrievalTestDialog() {
      this.retrievalTestForm.question = '';
      this.retrievalTestResult = null;
      this.focusRetrievalTest();
    },

    runRetrievalTest() {
      if (this.retrievalTestLoading) return;
      if (!this.retrievalTestForm.question.trim()) {
        this.$message.error(this.$t('knowledgeFileUpload.testQuestionRequired'));
        return;
      }
      this.retrievalTestLoading = true;
      Api.knowledgeBase.retrievalTest(
        this.selectedKb.datasetId,
        { question: this.retrievalTestForm.question.trim() },
        ({ data }) => {
          this.retrievalTestLoading = false;
          if (data && data.code === 0) {
            this.retrievalTestResult = data.data || data;
          } else {
            this.$message.error(data?.msg || 'Retrieval test failed');
          }
        },
        (err) => {
          this.retrievalTestLoading = false;
          this.$message.error(err?.data?.msg || 'Retrieval test failed');
        }
      );
    },

    handleViewSlices(doc) {
      this.currentDocumentId = doc.id;
      this.currentDocumentName = doc.name;
      this.sliceDialogVisible = true;
      this.sliceCurrentPage = 1;
      this.fetchSlices();
    },

    fetchSlices() {
      if (!this.selectedKb || !this.currentDocumentId) return;
      this.sliceLoading = true;
      const params = {
        page: this.sliceCurrentPage,
        page_size: this.slicePageSize
      };
      Api.knowledgeBase.listChunks(
        this.selectedKb.datasetId,
        this.currentDocumentId,
        params,
        ({ data }) => {
          this.sliceLoading = false;
          if (data && data.code === 0) {
            const responseData = data.data;
            if (responseData && responseData.list) {
              this.sliceList = responseData.list;
              this.sliceTotal = responseData.total || responseData.list.length;
            } else if (responseData && responseData.chunks && Array.isArray(responseData.chunks)) {
              this.sliceList = responseData.chunks;
              this.sliceTotal = responseData.total || responseData.chunks.length;
            } else if (Array.isArray(responseData)) {
              this.sliceList = responseData;
              this.sliceTotal = responseData.length;
            } else {
              this.sliceList = [];
              this.sliceTotal = 0;
            }
          } else {
            this.$message.error(data?.msg || this.$t('knowledgeBaseManagement.getListFailed'));
            this.sliceList = [];
            this.sliceTotal = 0;
          }
        },
        (err) => {
          this.sliceLoading = false;
          if (err && err.data) {
            this.$message.error(err.data.msg || err.msg || this.$t('knowledgeBaseManagement.getListFailed'));
          } else {
            this.$message.error(this.$t('knowledgeBaseManagement.getListFailed'));
          }
          this.sliceList = [];
          this.sliceTotal = 0;
        }
      );
    },

    handleSliceSizeChange(val) {
      this.slicePageSize = val;
      this.sliceCurrentPage = 1;
      this.fetchSlices();
    },

    handleSlicePageChange(page) {
      this.sliceCurrentPage = page;
      this.fetchSlices();
    },

    getStatusClass(kb) {
      return kb.status === 1 ? 'active' : 'inactive';
    },

    getStatusText(kb) {
      return kb.status === 1 ? this.$t('knowledgeBaseManagement.enabled') : this.$t('knowledgeBaseManagement.disabled');
    },

    formatDate(dateString) {
      if (!dateString) return '';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },

    formatCount(value) {
      const n = Number(value) || 0;
      return n.toLocaleString();
    },

    formatSimilarity(value) {
      return (Number(value) || 0).toFixed(4);
    },

    clamp01(value) {
      return Math.min(1, Math.max(0, Number(value) || 0));
    },

    fileExt(name) {
      const parts = String(name || '').split('.');
      return parts.length > 1 ? parts.pop().slice(0, 4).toUpperCase() : 'FILE';
    },

    formatFileSize(bytes) {
      if (!bytes) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB'];
      let i = 0;
      let size = bytes;
      while (size >= 1024 && i < units.length - 1) {
        size /= 1024;
        i++;
      }
      return size.toFixed(1) + ' ' + units[i];
    },
  }
};
</script>

<style lang="scss" scoped>
.nx-app {
  min-height: 100vh;
  background: var(--nx-bg);
}

.kb-search {
  width: 280px;
}

// ---------------------------------------------------------------- cards
.kb-card {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-2);
  min-height: 196px;
  outline: none;

  &:focus-visible {
    box-shadow: var(--nx-focus-ring);
    border-color: var(--nx-accent);
  }

  &__top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--nx-space-3);
    margin-bottom: var(--nx-space-2);
  }
  &__name {
    min-width: 0;
  }
  &__desc {
    margin: 0;
    font-size: var(--nx-text-callout);
    line-height: 1.43;
    color: var(--nx-text-2);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
  }
  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--nx-space-3);
    margin-top: auto;
    padding-top: var(--nx-space-3);
    border-top: 1px solid var(--nx-border);
  }
  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--nx-space-1) var(--nx-space-3);
    min-width: 0;
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-3);

    i {
      margin-right: 2px;
    }
  }
  &__controls {
    display: flex;
    align-items: center;
    gap: var(--nx-space-1);
    flex: none;
  }

  &.is-disabled .kb-card__icon {
    background: var(--nx-surface-2);
    color: var(--nx-text-3);
  }
}

.kb-card__icon--error {
  background: var(--nx-danger-soft);
  color: var(--nx-danger);
}

.kb-card--skeleton {
  cursor: default;
}
.kb-sk-tile {
  width: 40px;
  height: 40px;
  border-radius: var(--nx-radius);
}
.kb-sk-badge {
  width: 72px;
  height: 22px;
  border-radius: var(--nx-radius-pill);
}
.kb-sk-title {
  width: 60%;
  height: 20px;
  margin-top: var(--nx-space-2);
}
.kb-sk-line {
  width: 100%;
  height: 14px;
  &--short {
    width: 40%;
  }
}

// ---------------------------------------------------------------- detail
.kb-detail-title {
  min-width: 0;
  gap: var(--nx-space-3);

  .nx-title {
    min-width: 0;
  }
  .nx-badge {
    flex: none;
  }
}

.kb-detail-desc {
  max-width: 72ch;
  overflow-wrap: anywhere;
}

.kb-detail-delete {
  border: 1px solid var(--nx-border);
}

.kb-detail {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: var(--nx-space-5);
  align-items: start;
}

.kb-test {
  position: sticky;
  top: calc(var(--nx-topbar-h) + var(--nx-space-4));
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-4);
  max-height: calc(100vh - var(--nx-topbar-h) - var(--nx-space-7));

  &__head {
    display: flex;
    flex-direction: column;
    gap: var(--nx-space-1);
    .nx-footnote {
      margin: 0;
    }
  }
  &__form {
    display: flex;
    flex-direction: column;
    gap: var(--nx-space-2);
  }
  &__label {
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }
  &__run {
    align-self: flex-end;
  }
  &__results {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    margin: 0 calc(-1 * var(--nx-space-2));
    padding: 0 var(--nx-space-2);
  }
  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--nx-space-2);
    padding: var(--nx-space-7) var(--nx-space-3);
    border: 1px dashed var(--nx-border-strong);
    border-radius: var(--nx-radius);
    text-align: center;
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-3);

    i {
      font-size: var(--nx-text-title);
    }
  }
}

.kb-results {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.kb-result {
  padding: var(--nx-space-3);
  border-radius: var(--nx-radius);
  background: var(--nx-surface-2);

  &__head {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
    min-width: 0;
  }
  &__source {
    min-width: 0;
    font-size: var(--nx-text-footnote);
    font-weight: 600;
    color: var(--nx-text);
  }
  &__bar {
    height: 3px;
    margin: var(--nx-space-2) 0;
    border-radius: var(--nx-radius-pill);
    background: var(--nx-surface-3);
    overflow: hidden;

    span {
      display: block;
      height: 100%;
      background: var(--nx-accent);
      transform-origin: left center;
    }
  }
  &__text {
    margin: 0;
    font-size: var(--nx-text-footnote);
    line-height: 1.5;
    color: var(--nx-text-2);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 8;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

// ---------------------------------------------------------------- slices dialog
.kb-slices {
  min-height: 160px;

  &__list {
    display: flex;
    flex-direction: column;
    gap: var(--nx-space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  &__pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--nx-space-4);
  }
}

.kb-slice {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--nx-space-2);
  padding: var(--nx-space-4);
  border-radius: var(--nx-radius);
  background: var(--nx-surface-2);

  &__text {
    font-size: var(--nx-text-callout);
    line-height: 1.6;
    color: var(--nx-text);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
}

// ---------------------------------------------------------------- upload dialog
.kb-dropzone {
  ::v-deep .el-upload {
    display: block;
    width: 100%;
  }
  ::v-deep .el-upload-dragger {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--nx-space-3);
    width: 100%;
    height: auto;
    min-height: 200px;
    padding: var(--nx-space-7) var(--nx-space-5);
    transition: border-color var(--nx-dur-2) var(--nx-ease), background-color var(--nx-dur-2) var(--nx-ease);
  }
  ::v-deep .el-upload-dragger.is-dragover {
    border-color: var(--nx-accent);
    background: var(--nx-accent-soft);
  }

  &__title {
    font-size: var(--nx-text-callout);
    font-weight: 500;
    color: var(--nx-text);
  }
  &__tip {
    margin-top: var(--nx-space-2);
    font-size: var(--nx-text-caption);
    line-height: 1.5;
    color: var(--nx-text-3);
  }
}

.kb-files {
  margin-top: var(--nx-space-4);

  &__head {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
    margin-bottom: var(--nx-space-2);
    font-size: var(--nx-text-footnote);
    font-weight: 600;
    color: var(--nx-text-2);
  }
  &__list {
    max-height: 240px;
    overflow-y: auto;
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--nx-border);
    border-radius: var(--nx-radius);
  }
}

.kb-file {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  min-height: 48px;
  padding: var(--nx-space-1) var(--nx-space-2) var(--nx-space-1) var(--nx-space-3);

  & + & {
    border-top: 1px solid var(--nx-border);
  }

  &__ext {
    flex: none;
    min-width: 40px;
    padding: 2px 6px;
    border-radius: var(--nx-radius-sm);
    background: var(--nx-surface-2);
    color: var(--nx-text-2);
    font-size: var(--nx-text-caption);
    font-weight: 600;
    text-align: center;
  }
  &__name {
    flex: 1 1 auto;
    font-size: var(--nx-text-callout);
    color: var(--nx-text);
  }
  &__size {
    flex: none;
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }
  &__remove {
    flex: none;
  }
}

// ---------------------------------------------------------------- narrow screens
@media (max-width: 1100px) {
  .kb-detail {
    grid-template-columns: minmax(0, 1fr);
  }
  .kb-test {
    position: static;
    max-height: none;
  }
}

@media (max-width: 640px) {
  .kb-search {
    flex: 1 1 200px;
    width: auto;
  }
  .nx-page-header__actions {
    width: 100%;
  }
}
</style>

<style lang="scss">
// Dropdown and tooltip poppers are appended to body (not scoped)
.el-dropdown-menu__item.kb-menu-danger {
  color: var(--nx-danger);
}
.el-tooltip__popper.kb-tip {
  max-width: 320px;
  line-height: 1.45;
}
</style>
