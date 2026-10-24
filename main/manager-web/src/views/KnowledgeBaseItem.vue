<template>
  <section class="nx-card nx-card--flush kd" :aria-label="tx('knowledgeBaseManagement.documents', 'Documents')">
    <div class="kd__head">
      <div class="nx-row kd__title">
        <h2 class="nx-headline">{{ tx('knowledgeBaseManagement.documents', 'Documents') }}</h2>
        <span v-if="kb" class="nx-badge nx-num">{{ $t('knowledgeBaseManagement.totalDocuments', { total }) }}</span>
      </div>
      <div class="kd__actions">
        <el-input
          v-model="searchDocName"
          class="kd__search"
          size="small"
          prefix-icon="el-icon-search"
          :placeholder="$t('knowledgeFileUpload.documentNamePlaceholder')"
          :aria-label="$t('knowledgeBaseManagement.search')"
          clearable
          @keyup.enter.native="handleSearch"
          @clear="handleSearch"
        />
        <CustomButton type="add" size="small" icon="el-icon-upload2" @click="handleUpload">
          {{ $t('knowledgeFileUpload.uploadDocument') }}
        </CustomButton>
      </div>
    </div>

    <div class="kd__body" v-loading="docLoading" :element-loading-text="$t('knowledgeBaseManagement.loading')">
      <el-table v-show="documents.length || docLoading" :data="documents" row-key="id" class="kd-table">
        <el-table-column :label="$t('knowledgeFileUpload.documentName')" min-width="240">
          <template slot-scope="scope">
            <div class="kd-doc">
              <span class="kd-doc__ext" :class="'kd-doc__ext--' + fileKind(scope.row.name)">{{ fileExt(scope.row.name) }}</span>
              <div class="kd-doc__text">
                <span class="kd-doc__name nx-truncate" :title="scope.row.name">{{ scope.row.name }}</span>
                <span class="nx-caption nx-num">{{ formatDate(scope.row.createdAt) }}</span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column :label="$t('knowledgeFileUpload.status')" min-width="150">
          <template slot-scope="scope">
            <span class="nx-badge" :class="statusBadgeClass(scope.row)">
              <i :class="statusIcon(scope.row)" aria-hidden="true"></i>
              {{ getDocStatusText(scope.row) }}
              <span v-if="scope.row.parseStatusCode === 1" class="nx-num">· {{ getProgressText(scope.row) }}</span>
            </span>
          </template>
        </el-table-column>

        <el-table-column :label="$t('knowledgeFileUpload.sliceCount')" width="110" align="right">
          <template slot-scope="scope">
            <span class="nx-num kd-count">{{ scope.row.sliceCount != null ? formatCount(scope.row.sliceCount) : '—' }}</span>
          </template>
        </el-table-column>

        <el-table-column :label="$t('knowledgeFileUpload.operation')" width="190" align="right">
          <template slot-scope="scope">
            <div class="kd-actions">
              <el-button v-if="scope.row.parseStatusCode === 3" type="text" size="small"
                @click.stop="$emit('view-slices', scope.row)">
                {{ $t('knowledgeFileUpload.viewSlices') }}
              </el-button>
              <el-button v-else type="text" size="small" :disabled="scope.row.parseStatusCode === 1"
                :loading="scope.row.parsing" @click.stop="handleParse(scope.row)">
                {{ $t('knowledgeFileUpload.parse') }}
              </el-button>
              <el-tooltip :content="$t('knowledgeBaseManagement.delete')" placement="top" :open-delay="400">
                <el-button class="kd-delete" type="text" size="small" icon="el-icon-delete"
                  :aria-label="$t('knowledgeBaseManagement.delete')" :loading="deleteLoadingMap[scope.row.id]"
                  @click.stop="handleDelete(scope.row)"></el-button>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="documents.length === 0 && !docLoading" class="nx-empty">
        <span class="nx-icon-tile nx-icon-tile--lg"><i class="el-icon-document-add" aria-hidden="true"></i></span>
        <h3 class="nx-empty__title">
          {{ searchDocName ? $t('knowledgeBaseManagement.noData') : tx('knowledgeBaseManagement.docsEmptyTitle', 'No documents yet') }}
        </h3>
        <p v-if="!searchDocName" class="nx-empty__text">
          {{ tx('knowledgeBaseManagement.docsEmptyText', 'Upload PDFs, Word files, spreadsheets or text files to get started.') }}
        </p>
        <CustomButton class="nx-empty__action" type="add" icon="el-icon-upload2" @click="handleUpload">
          {{ $t('knowledgeFileUpload.uploadDocument') }}
        </CustomButton>
      </div>
    </div>

    <div v-if="total > 0" class="kd__foot">
      <CustomPagination
        :total="total"
        :current-page="currentPage"
        :page-size="pageSize"
        :page-size-options="pageSizeOptions"
        @page-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>
  </section>
</template>

<script>
import Api from "@/apis/api";
import CustomButton from "@/components/CustomButton.vue";
import CustomPagination from "@/components/CustomPagination.vue";

export default {
  name: 'LibraryItem',
  components: { CustomPagination, CustomButton },
  props: {
    kb: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      documents: [],
      docLoading: false,
      deleteLoadingMap: {},
      searchDocName: '',
      total: 0,
      currentPage: 1,
      pageSize: 10,
      pageSizeOptions: [10, 20, 50, 100],
    };
  },
  watch: {
    kb: {
      handler(newKb) {
        if (newKb && newKb.datasetId) {
          this.currentPage = 1;
          this.fetchDocuments();
        } else {
          this.documents = [];
          this.total = 0;
        }
      },
      immediate: true
    }
  },
  methods: {
    // $t with an English fallback for keys still waiting in i18n/_pending
    tx(key, fallback, params) {
      const value = this.$t(key, params);
      if (value !== key) return value;
      return String(fallback).replace(/\{(\w+)\}/g, (m, k) => (params && params[k] != null ? params[k] : m));
    },

    fetchDocuments() {
      if (!this.kb || !this.kb.datasetId) return;
      this.docLoading = true;
      const params = {
        page: this.currentPage,
        page_size: this.pageSize,
        name: this.searchDocName
      };
      Api.knowledgeBase.getDocumentList(
        this.kb.datasetId,
        params,
        ({ data }) => {
          this.docLoading = false;
          if (data && data.code === 0) {
            this.documents = data.data.list || [];
            this.total = data.data.total || 0;
            this.fetchSliceCountsForDocuments();
          } else {
            this.$message.error(data?.msg || 'Failed to get document list');
            this.documents = [];
            this.total = 0;
          }
        },
        (err) => {
          this.docLoading = false;
          if (err && err.data) {
            this.$message.error(err.data.msg || err.msg || 'Failed to get document list');
          } else {
            this.$message.error('Failed to get document list');
          }
          this.documents = [];
          this.total = 0;
        }
      );
    },

    handleSearch() {
      this.currentPage = 1;
      this.fetchDocuments();
    },

    handlePageChange(page) {
      this.currentPage = page;
      this.fetchDocuments();
    },

    handleSizeChange(size) {
      this.pageSize = size;
      this.currentPage = 1;
      this.fetchDocuments();
    },

    handleUpload() {
      this.$emit('upload');
    },

    handleRetrievalTest() {
      this.$emit('retrieval-test');
    },

    handleDelete(doc) {
      if (!this.kb) return;
      this.$confirm(
        this.$t('knowledgeFileUpload.confirmDelete'),
        doc.name || this.$t('message.warning'),
        {
          confirmButtonText: this.$t('knowledgeFileUpload.delete'),
          confirmButtonClass: 'el-button--danger',
          cancelButtonText: this.$t('knowledgeBaseDialog.cancel'),
          type: 'warning'
        }
      ).then(() => {
        this.$set(this.deleteLoadingMap, doc.id, true);
        Api.knowledgeBase.deleteDocument(this.kb.datasetId, doc.id, (res) => {
          this.$set(this.deleteLoadingMap, doc.id, false);
          if (res.data && res.data.code === 0) {
            if (this.documents.length === 1 && this.currentPage > 1) {
              this.currentPage--;
            }
            this.fetchDocuments();
            this.$message.success(this.$t('knowledgeFileUpload.deleteSuccess'));
          } else {
            this.$message.error(res.data?.msg || this.$t('knowledgeFileUpload.deleteFailed'));
          }
        }, (err) => {
          this.$set(this.deleteLoadingMap, doc.id, false);
          this.$message.error(err?.data?.msg ||this.$t('knowledgeFileUpload.deleteFailed'));
        });
      }).catch(() => {});
    },

    handleParse(doc) {
      this.$confirm(this.$t('knowledgeFileUpload.confirmParse'), this.$t('message.info'), {
        confirmButtonText: this.$t('knowledgeFileUpload.confirm'),
        cancelButtonText: this.$t('knowledgeFileUpload.cancel'),
        type: 'info'
      }).then(() => {
        this.$set(doc, 'parsing', true);
        doc.parseStatusCode = 1;
        Api.knowledgeBase.parseDocument(
          this.kb.datasetId,
          doc.id,
          ({ data }) => {
            if (data && data.code === 0) {
              this.$message.success(this.$t('knowledgeFileUpload.parsing'));
              this.$set(doc, 'parsing', false);
              this.startParsePolling(doc);
            } else {
              this.$set(doc, 'parsing', false);
              doc.parseStatusCode = 0;
              this.$message.error(data?.msg || this.$t('knowledgeFileUpload.parseFailed'));
            }
          },
          (err) => {
            this.$set(doc, 'parsing', false);
            doc.parseStatusCode = 0;
            this.$message.error(err?.data?.msg || this.$t('knowledgeFileUpload.parseFailed'));
          }
        );
      }).catch(() => {});
    },

    startParsePolling(doc) {
      const poll = () => {
        if (!this.kb) return;
        Api.knowledgeBase.getDocumentList(
          this.kb.datasetId,
          { page: 1, page_size: 100, name: this.searchDocName },
          ({ data }) => {
            if (data && data.code === 0) {
              const list = data.data.list || [];
              const updated = list.find(d => d.id === doc.id);
              if (updated) {
                this.$set(doc, 'parseStatusCode', updated.parseStatusCode);
                if (updated.parseStatusCode !== 1) {
                  this.$set(doc, 'parsing', false);
                  if (updated.parseStatusCode === 3) {
                    this.$message.success(`「${doc.name}」${this.$t('knowledgeFileUpload.parseSuccess')}`);
                    this.fetchSliceCountForSingleDocument(doc);
                  } else if (updated.parseStatusCode === 4) {
                    this.$message.error(`「${doc.name}」${this.$t('knowledgeFileUpload.parseFailed')}`);
                  }
                  return;
                }
              }
              setTimeout(poll, 5000);
            }
          },
          () => {
            setTimeout(poll, 5000);
          }
        );
      };
      setTimeout(poll, 3000);
    },

    fetchSliceCountsForDocuments() {
      if (!this.documents || this.documents.length === 0) return;
      this.documents.forEach(doc => {
        this.fetchSliceCountForSingleDocument(doc);
      });
    },

    fetchSliceCountForSingleDocument(doc) {
      const params = { page: 1, page_size: 1 };
      Api.knowledgeBase.listChunks(
        this.kb.datasetId,
        doc.id,
        params,
        ({ data }) => {
          if (data && data.code === 0) {
            this.$set(doc, 'sliceCount', data.data.total || 0);
          }
        },
        () => {}
      );
    },

    getProgressClass(doc) {
      const code = doc.parseStatusCode;
      if (code === 3) return 'complete';
      if (code === 1) return 'processing';
      return 'pending';
    },

    getProgressText(doc) {
      const code = doc.parseStatusCode;
      if (code === 3) return '100%';
      if (code === 1) {
        if (doc.chunkNum && doc.totalChunkNum) {
          return Math.round((doc.chunkNum / doc.totalChunkNum) * 100) + '%';
        }
        return '50%';
      }
      return '0%';
    },

    // Status badge: colour always paired with an icon and a word
    statusBadgeClass(doc) {
      const code = doc.parseStatusCode;
      if (code === 3) return 'nx-badge--success';
      if (code === 1) return 'nx-badge--info';
      if (code === 4) return 'nx-badge--danger';
      if (code === 2) return 'nx-badge--warning';
      return '';
    },

    statusIcon(doc) {
      const code = doc.parseStatusCode;
      if (code === 3) return 'el-icon-circle-check';
      if (code === 1) return 'el-icon-time';
      if (code === 4) return 'el-icon-warning-outline';
      if (code === 2) return 'el-icon-remove-outline';
      return 'el-icon-more-outline';
    },

    fileExt(fileName) {
      const parts = String(fileName || '').split('.');
      return parts.length > 1 ? parts.pop().slice(0, 4).toUpperCase() : 'FILE';
    },

    fileKind(fileName) {
      const ext = this.fileExt(fileName).toLowerCase();
      if (ext === 'pdf') return 'pdf';
      if (['doc', 'docx', 'md', 'mdx', 'txt', 'mark'].includes(ext)) return 'text';
      if (['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet';
      if (['ppt', 'pptx'].includes(ext)) return 'slides';
      return 'other';
    },

    formatCount(value) {
      return (Number(value) || 0).toLocaleString();
    },

    getDocStatusText(doc) {
      const code = doc.parseStatusCode;
      if (code === 3) return this.$t('knowledgeFileUpload.statusCompleted');
      if (code === 1) return this.$t('knowledgeFileUpload.statusProcessing');
      if (code === 0) return this.$t('knowledgeFileUpload.statusNotStarted');
      if (code === 4) return this.$t('knowledgeFileUpload.statusFailed');
      if (code === 2) return this.$t('knowledgeFileUpload.statusCancelled');
      return this.$t('knowledgeFileUpload.statusNotStarted');
    },

    formatDate(dateString) {
      if (!dateString) return '';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },
  }
};
</script>

<style lang="scss" scoped>
.kd {
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
  &__actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--nx-space-2);
  }
  &__search {
    width: 220px;
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

.kd-table {
  width: 100%;

  &::before {
    display: none;
  }
  ::v-deep th.el-table__cell:first-child .cell,
  ::v-deep td.el-table__cell:first-child .cell {
    padding-left: var(--nx-space-5);
  }
  ::v-deep th.el-table__cell:last-child .cell,
  ::v-deep td.el-table__cell:last-child .cell {
    padding-right: var(--nx-space-4);
  }
}

.kd-doc {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  min-width: 0;
  padding: var(--nx-space-1) 0;

  &__ext {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: var(--nx-radius);
    background: var(--nx-surface-2);
    color: var(--nx-text-2);
    font-size: var(--nx-text-caption);
    font-weight: 700;
    letter-spacing: 0.02em;

    &--pdf {
      background: var(--nx-danger-soft);
      color: var(--nx-danger);
    }
    &--text {
      background: var(--nx-info-soft);
      color: var(--nx-info);
    }
    &--sheet {
      background: var(--nx-success-soft);
      color: var(--nx-success);
    }
    &--slides {
      background: var(--nx-warning-soft);
      color: var(--nx-warning);
    }
  }
  &__text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  &__name {
    font-weight: 600;
    color: var(--nx-text);
  }
}

.kd-count {
  color: var(--nx-text-2);
}

.kd-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--nx-space-1);
  width: 100%;

  .el-button + .el-button {
    margin-left: 0;
  }
}

.kd-delete {
  width: 32px;
  color: var(--nx-text-2);

  &:hover,
  &:focus {
    color: var(--nx-danger);
  }
}

@media (max-width: 640px) {
  .kd__head {
    padding: var(--nx-space-3) var(--nx-space-4);
  }
  .kd__actions {
    width: 100%;
  }
  .kd__search {
    flex: 1 1 160px;
    width: auto;
  }
}
</style>
