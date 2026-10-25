<template>
  <div class="kbi">
    <TbButton class="kbi__back" variant="quiet" size="s" icon="chevron-left" @click="$emit('back')">{{ $t('kb.back') }}</TbButton>

    <TbPageHeader :title="kb.name" :description="kb.description || ''">
      <template #actions>
        <TbSwitch :model-value="kb.status === 1" :loading="statusSaving" :aria-label="$t('kb.statusLabel', { name: kb.name })"
          @update:model-value="$emit('status', kb, $event)">
          <span class="kb-state">{{ kb.status === 1 ? $t('kb.enabled') : $t('kb.disabled') }}</span>
        </TbSwitch>
        <TbButton icon="edit" @click="$emit('edit', kb)">{{ $t('kb.edit') }}</TbButton>
        <TbButton variant="danger" icon="trash" @click="$emit('delete', kb)">{{ $t('kb.delete') }}</TbButton>
      </template>
    </TbPageHeader>

    <dl class="kbi__facts">
      <div><dt>{{ $t('kb.col.docs') }}</dt><dd class="tb-num">{{ num(total || kb.documentCount) }}</dd></div>
      <div v-if="kb.chunkCount != null"><dt>{{ $t('kb.chunksTotal') }}</dt><dd class="tb-num">{{ num(kb.chunkCount) }}</dd></div>
      <div v-if="kb.updatedAt || kb.createdAt"><dt>{{ $t('kb.col.updated') }}</dt><dd class="tb-num kbi__date">{{ date(kb.updatedAt || kb.createdAt) }}</dd></div>
    </dl>

    <p v-if="kb.errorMessage" class="kbi__alert" role="alert">
      <TbIcon name="warning" :size="18" />
      <span><b>{{ $t('kb.needsAttention') }}</b> {{ kb.errorMessage }}</span>
    </p>

    <div class="kbi__grid">
      <!-- Documents -->
      <TbSection class="kbi__docs" :title="$t('kb.docs.title')" :description="$t('kb.docs.desc')">
        <template #actions>
          <TbButton variant="primary" icon="upload" @click="openUpload">{{ $t('kb.docs.upload') }}</TbButton>
        </template>

        <form class="kbi__search" role="search" @submit.prevent="handleSearch">
          <TbInput v-model="searchDocName" icon="search" size="s" clearable :placeholder="$t('kb.docs.searchPh')"
            :aria-label="$t('kb.docs.search')" :clear-label="$t('kb.clear')" @clear="handleSearch" />
          <TbButton size="s" native-type="submit">{{ $t('common.search') }}</TbButton>
        </form>

        <TbTable class="kbi__table" dense row-key="id" :columns="docColumns" :rows="documents" :loading="docLoading && !documents.length"
          :loading-text="$t('common.loading')" :caption="$t('kb.docs.title')">
          <template #cell-name="{ row }">
            <div class="kbi-doc">
              <span class="kbi-doc__ext" aria-hidden="true">{{ ext(row.name) }}</span>
              <span class="kbi-doc__text">
                <span class="kbi-doc__name" :title="row.name">{{ row.name }}</span>
                <span class="kbi-doc__date tb-num">{{ date(row.createdAt) }}</span>
              </span>
            </div>
          </template>
          <template #cell-status="{ row }">
            <span class="kbi-status">
              <TbTag :ink="state(row).ink" mark>{{ $t(`kb.parse.${state(row).key}`) }}</TbTag>
              <span v-if="row.parseStatusCode === 1" class="kbi-status__pct tb-num">{{ num(progress(row)) }}%</span>
              <TbLoading v-if="row.parseStatusCode === 1 && polling[row.id]" :label="$t('kb.parse.processing')" />
            </span>
          </template>
          <template #cell-sliceCount="{ row }">
            <span class="tb-num">{{ row.sliceCount != null ? num(row.sliceCount) : '–' }}</span>
          </template>
          <template #cell-actions="{ row }">
            <span class="kbi-acts">
              <TbButton v-if="row.parseStatusCode === 3" size="s" variant="quiet" @click="openChunks(row)">{{ $t('kb.docs.viewChunks') }}</TbButton>
              <TbButton v-else size="s" variant="quiet" :disabled="row.parseStatusCode === 1" :loading="!!row.parsing" @click="handleParse(row)">
                {{ $t('kb.docs.parse') }}
              </TbButton>
              <TbButton size="s" variant="quiet" icon="trash" class="kb-del" :loading="!!deleteLoadingMap[row.id]"
                :aria-label="$t('kb.docs.deleteName', { name: row.name })" @click="handleDelete(row)" />
            </span>
          </template>
          <template #empty>
            <TbEmpty v-if="docFailed" face="confused" :title="$t('kb.docs.loadFailed')" :text="$t('common.loadFailed')">
              <TbButton icon="refresh" @click="fetchDocuments">{{ $t('common.retry') }}</TbButton>
            </TbEmpty>
            <TbEmpty v-else-if="docSearched" :title="$t('kb.docs.noResults', { q: docSearched })">
              <TbButton @click="clearSearch">{{ $t('kb.clearSearch') }}</TbButton>
            </TbEmpty>
            <TbEmpty v-else face="awake" :title="$t('kb.docs.emptyTitle')" :text="$t('kb.docs.emptyText')">
              <TbButton variant="primary" icon="upload" @click="openUpload">{{ $t('kb.docs.upload') }}</TbButton>
            </TbEmpty>
          </template>
        </TbTable>

        <TbPagination v-if="total > 0" v-model:page="currentPage" v-model:page-size="pageSize" :total="total" :sizes="pageSizeOptions"
          :total-text="$t('kb.docs.count', { n: num(total) })" :size-suffix="$t('kb.perPage')" :aria-label="$t('kb.pages')"
          :prev-label="$t('kb.prev')" :next-label="$t('kb.next')" :size-label="$t('kb.rowsPerPage')" @change="fetchDocuments" />
      </TbSection>

      <!-- Retrieval test -->
      <TbSection class="kbi__test" :title="$t('kb.test.title')" :description="$t('kb.test.desc')">
        <form class="kbi-test" @submit.prevent="runRetrievalTest">
          <TbField :label="$t('kb.test.question')" :hint="$t('kb.test.enterHint')" for-id="kb-test-question">
            <TbTextarea id="kb-test-question" ref="retrievalInput" v-model="question" :rows="3" autosize
              :placeholder="$t('kb.test.questionPh')" @keydown.enter.exact.prevent="runRetrievalTest" />
          </TbField>
          <TbButton native-type="submit" icon="search" :loading="retrievalTestLoading">{{ $t('kb.test.run') }}</TbButton>
        </form>

        <div class="kbi-results" aria-live="polite">
          <template v-if="retrievalTestResult">
            <p class="kbi-results__count tb-num">{{ chunks.length ? $t('kb.test.found', { n: num(chunks.length) }) : '' }}</p>
            <ol v-if="chunks.length" class="kbi-results__list">
              <li v-for="(chunk, index) in chunks" :key="index" class="kbi-hit">
                <div class="kbi-hit__head">
                  <span class="kbi-hit__score tb-num" :title="$t('kb.test.similarity')">
                    <span class="tb-visually-hidden">{{ $t('kb.test.similarity') }}: </span>{{ similarity(chunk.similarity) }}
                  </span>
                  <span class="kbi-hit__src" :title="source(chunk)">{{ source(chunk) || '–' }}</span>
                </div>
                <p class="kbi-hit__text">{{ chunk.content }}</p>
              </li>
            </ol>
            <p v-else class="kbi-results__idle">{{ $t('kb.test.none') }}</p>
          </template>
          <p v-else class="kbi-results__idle">{{ $t('kb.test.idle') }}</p>
        </div>
      </TbSection>
    </div>

    <!-- Upload -->
    <TbSheet v-model:open="uploadDialogVisible" :title="$t('kb.upload.title')" :close-on-scrim="!uploading" :close-on-esc="!uploading"
      :close-label="$t('common.close')" @close="handleUploadDialogClose">
      <TbUpload ref="uploadRef" multiple :accept="accept" :disabled="uploading" :text="$t('kb.upload.drop')" :hint="$t('kb.upload.hint')"
        @files="handleFiles" />
      <div v-if="selectedFilesList.length" class="kbi-files">
        <p class="kbi-files__head">{{ $t('kb.upload.chosen') }} <span class="tb-num">{{ num(selectedFilesList.length) }}</span></p>
        <ul>
          <li v-for="(file, index) in selectedFilesList" :key="index + file.name" class="kbi-file">
            <span class="kbi-doc__ext" aria-hidden="true">{{ ext(file.name) }}</span>
            <span class="kbi-file__name" :title="file.name">{{ file.name }}</span>
            <span class="kbi-file__size tb-num">{{ size(file.size) }}</span>
            <TbButton size="s" variant="quiet" icon="close" :disabled="uploading" :aria-label="$t('kb.upload.remove', { name: file.name })"
              @click="removeSelectedFile(index)" />
          </li>
        </ul>
      </div>
      <template #footer>
        <TbButton :disabled="uploading" @click="uploadDialogVisible = false">{{ $t('common.cancel') }}</TbButton>
        <TbButton variant="primary" icon="upload" :loading="uploading" @click="handleBatchUploadSubmit">
          {{ selectedFilesList.length ? $t('kb.upload.submitN', { n: num(selectedFilesList.length) }) : $t('kb.upload.submit') }}
        </TbButton>
      </template>
    </TbSheet>

    <!-- Chunks of one document -->
    <TbSheet v-model:open="sliceDialogVisible" size="l" :title="$t('kb.chunks.title', { name: currentDocumentName })" :close-label="$t('common.close')">
      <div v-if="sliceLoading && !sliceList.length" class="kbi-chunks__wait"><TbLoading :label="$t('common.loading')" show-label /></div>
      <ol v-else-if="sliceList.length" class="kbi-chunks" :class="{ 'is-loading': sliceLoading }">
        <li v-for="(slice, index) in sliceList" :key="index" class="kbi-chunk">
          <span class="kbi-chunk__n tb-num">{{ $t('kb.chunks.n', { n: num((sliceCurrentPage - 1) * slicePageSize + index + 1) }) }}</span>
          <p class="kbi-chunk__text">{{ slice.content }}</p>
        </li>
      </ol>
      <TbEmpty v-else-if="sliceFailed" :title="$t('kb.chunks.loadFailed')">
        <TbButton icon="refresh" @click="fetchSlices">{{ $t('common.retry') }}</TbButton>
      </TbEmpty>
      <TbEmpty v-else :title="$t('kb.chunks.empty')" />
      <TbPagination v-if="sliceTotal > 0" v-model:page="sliceCurrentPage" v-model:page-size="slicePageSize" :total="sliceTotal"
        :sizes="[10, 20, 50]" :total-text="$t('kb.chunks.count', { n: num(sliceTotal) })" :size-suffix="$t('kb.perPage')"
        :aria-label="$t('kb.pages')" :prev-label="$t('kb.prev')" :next-label="$t('kb.next')" :size-label="$t('kb.rowsPerPage')"
        @change="fetchSlices" />
    </TbSheet>
  </div>
</template>

<script>
import Api from '@/apis/api';
import {
  ACCEPT, chunkPage, chunkSource, count, dateText, errorText, fileExt, formatFileSize, formatSimilarity, isTooLarge,
  ok, parseState, progressPercent, retrievalChunks,
} from './kbModel';

// One knowledge base: its documents (upload, parse and its live status, chunks, delete) and the
// retrieval test. Edits, deletion and the on/off switch of the base itself go up to the list page.
export default {
  name: 'KnowledgeBaseItem',
  props: {
    kb: { type: Object, required: true },
    statusSaving: Boolean,
  },
  emits: ['back', 'edit', 'delete', 'status'],
  data() {
    return {
      accept: ACCEPT,
      documents: [],
      docLoading: false,
      docFailed: false,
      deleteLoadingMap: {},
      polling: {},
      searchDocName: '',
      docSearched: '',
      total: 0,
      currentPage: 1,
      pageSize: 10,
      pageSizeOptions: [10, 20, 50, 100],
      question: '',
      retrievalTestResult: null,
      retrievalTestLoading: false,
      uploadDialogVisible: false,
      selectedFilesList: [],
      uploading: false,
      sliceDialogVisible: false,
      currentDocumentId: '',
      currentDocumentName: '',
      sliceList: [],
      sliceLoading: false,
      sliceFailed: false,
      sliceCurrentPage: 1,
      slicePageSize: 10,
      sliceTotal: 0,
    };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    chunks() { return retrievalChunks(this.retrievalTestResult); },
    docColumns() {
      return [
        { key: 'name', label: this.$t('kb.docs.col.name') },
        { key: 'status', label: this.$t('kb.docs.col.status'), width: '168px' },
        { key: 'sliceCount', label: this.$t('kb.docs.col.chunks'), align: 'right', width: '84px' },
        { key: 'actions', label: this.$t('kb.col.actions'), align: 'right', width: '156px' },
      ];
    },
  },
  watch: {
    'kb.datasetId': {
      immediate: true,
      handler(id) {
        this.currentPage = 1;
        this.question = '';
        this.retrievalTestResult = null;
        if (id) this.fetchDocuments();
        else { this.documents = []; this.total = 0; }
      },
    },
  },
  beforeUnmount() {
    this.gone = true;
    (this.timers || []).forEach(clearTimeout);
  },
  methods: {
    num(n) { return count(n, this.lang); },
    date(v) { return dateText(v, this.lang); },
    size(b) { return formatFileSize(b, this.lang); },
    ext: fileExt,
    state(doc) { return parseState(doc.parseStatusCode); },
    progress: progressPercent,
    similarity(v) { return formatSimilarity(v, this.lang); },
    source: chunkSource,
    later(fn, ms) {
      if (this.gone) return;
      this.timers = this.timers || [];
      this.timers.push(setTimeout(fn, ms));
    },

    fetchDocuments() {
      if (!this.kb || !this.kb.datasetId) return;
      this.docLoading = true;
      const params = { page: this.currentPage, page_size: this.pageSize, name: this.searchDocName };
      Api.knowledgeBase.getDocumentList(this.kb.datasetId, params, ({ data }) => {
        this.docLoading = false;
        if (data && data.code === 0) {
          this.docFailed = false;
          this.documents = (data.data && data.data.list) || [];
          this.total = Number((data.data && data.data.total) || 0);
          this.docSearched = this.searchDocName.trim();
          this.fetchSliceCountsForDocuments();
        } else {
          this.$message.error((data && data.msg) || this.$t('kb.docs.loadFailed'));
          this.docFailed = true;
          this.documents = [];
          this.total = 0;
        }
      }, (err) => {
        this.docLoading = false;
        this.$message.error((err && err.data && (err.data.msg || err.msg)) || this.$t('kb.docs.loadFailed'));
        this.docFailed = true;
        this.documents = [];
        this.total = 0;
      });
    },

    handleSearch() {
      this.currentPage = 1;
      this.fetchDocuments();
    },
    clearSearch() {
      this.searchDocName = '';
      this.handleSearch();
    },

    handleDelete(doc) {
      this.$confirm(this.$t('kb.docs.confirmDelete'), doc.name || this.$t('kb.docs.deleteTitle'), {
        confirmText: this.$t('common.delete'), cancelText: this.$t('common.cancel'), danger: true,
      }).then(() => {
        this.deleteLoadingMap = { ...this.deleteLoadingMap, [doc.id]: true };
        Api.knowledgeBase.deleteDocument(this.kb.datasetId, doc.id, (res) => {
          this.deleteLoadingMap = { ...this.deleteLoadingMap, [doc.id]: false };
          if (ok(res)) {
            if (this.documents.length === 1 && this.currentPage > 1) this.currentPage -= 1;
            this.fetchDocuments();
            this.$message.success(this.$t('kb.docs.deleted', { name: doc.name }));
          } else {
            this.$message.error(errorText(res, this.$t('kb.docs.deleteFailed')));
          }
        }, (err) => {
          this.deleteLoadingMap = { ...this.deleteLoadingMap, [doc.id]: false };
          this.$message.error((err && err.data && err.data.msg) || this.$t('kb.docs.deleteFailed'));
        });
      }).catch(() => {});
    },

    handleParse(doc) {
      this.$confirm(this.$t('kb.docs.confirmParse'), doc.name || this.$t('kb.docs.parse'), {
        confirmText: this.$t('kb.docs.parse'), cancelText: this.$t('common.cancel'),
      }).then(() => {
        doc.parsing = true;
        doc.parseStatusCode = 1;
        Api.knowledgeBase.parseDocument(this.kb.datasetId, doc.id, ({ data }) => {
          doc.parsing = false;
          if (data && data.code === 0) {
            this.$message.success(this.$t('kb.docs.parseStarted', { name: doc.name }));
            this.startParsePolling(doc);
          } else {
            doc.parseStatusCode = 0;
            this.$message.error((data && data.msg) || this.$t('kb.docs.parseStartFailed'));
          }
        }, (err) => {
          doc.parsing = false;
          doc.parseStatusCode = 0;
          this.$message.error((err && err.data && err.data.msg) || this.$t('kb.docs.parseStartFailed'));
        });
      }).catch(() => {});
    },

    // The legacy polling: first look after 3 s, then every 5 s until the document leaves "running".
    startParsePolling(doc) {
      this.polling = { ...this.polling, [doc.id]: true };
      const stop = () => { this.polling = { ...this.polling, [doc.id]: false }; };
      const poll = () => {
        if (this.gone || !this.kb) return;
        Api.knowledgeBase.getDocumentList(this.kb.datasetId, { page: 1, page_size: 100, name: this.searchDocName }, ({ data }) => {
          if (this.gone) return;
          if (data && data.code === 0) {
            const list = (data.data && data.data.list) || [];
            const updated = list.find((d) => d.id === doc.id);
            if (updated) {
              doc.parseStatusCode = updated.parseStatusCode;
              if (updated.chunkNum != null) doc.chunkNum = updated.chunkNum;
              if (updated.totalChunkNum != null) doc.totalChunkNum = updated.totalChunkNum;
              if (updated.parseStatusCode !== 1) {
                doc.parsing = false;
                stop();
                if (updated.parseStatusCode === 3) {
                  this.$message.success(this.$t('kb.docs.parseDone', { name: doc.name }));
                  this.fetchSliceCountForSingleDocument(doc);
                } else if (updated.parseStatusCode === 4) {
                  this.$message.error(this.$t('kb.docs.parseFailed', { name: doc.name }));
                }
                return;
              }
            }
            this.later(poll, 5000);
          } else {
            stop();
          }
        }, () => this.later(poll, 5000));
      };
      this.later(poll, 3000);
    },

    fetchSliceCountsForDocuments() {
      this.documents.forEach((doc) => this.fetchSliceCountForSingleDocument(doc));
    },

    fetchSliceCountForSingleDocument(doc) {
      Api.knowledgeBase.listChunks(this.kb.datasetId, doc.id, { page: 1, page_size: 1 }, ({ data }) => {
        if (data && data.code === 0) doc.sliceCount = (data.data && data.data.total) || 0;
      }, () => {});
    },

    // Upload
    openUpload() {
      this.selectedFilesList = [];
      this.uploadDialogVisible = true;
    },
    handleUploadDialogClose() {
      this.$refs.uploadRef?.reset();
      this.selectedFilesList = [];
    },
    handleFiles(files) {
      files.forEach((file) => {
        if (isTooLarge(file.size)) {
          this.$message.error(this.$t('kb.upload.tooBig', { name: file.name }));
          return;
        }
        this.selectedFilesList.push({ name: file.name, size: file.size, raw: file });
      });
      // Clear the picker so the same file can be chosen again after removing it.
      this.$nextTick(() => this.$refs.uploadRef?.reset());
    },
    removeSelectedFile(index) {
      this.selectedFilesList.splice(index, 1);
    },
    handleBatchUploadSubmit() {
      if (this.uploading) return;
      if (this.selectedFilesList.length === 0) {
        this.$message.error(this.$t('kb.upload.pickFirst'));
        return;
      }
      this.uploading = true;
      const uploads = this.selectedFilesList.map((file) => new Promise((resolve) => {
        const formData = new FormData();
        formData.append('file', file.raw);
        Api.knowledgeBase.uploadDocument(this.kb.datasetId, formData, ({ data }) => {
          resolve(data && data.code === 0
            ? { success: true, fileName: file.name }
            : { success: false, fileName: file.name, error: (data && data.msg) || '' });
        }, (err) => {
          resolve({ success: false, fileName: file.name, error: (err && err.data && (err.data.msg || err.msg)) || '' });
        });
      }));
      Promise.all(uploads).then((results) => {
        this.uploading = false;
        const okCount = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success);
        if (okCount > 0) this.$message.success(this.$t('kb.upload.done', { n: this.num(okCount) }));
        if (failed.length > 0) {
          const first = failed[0];
          this.$message.error(failed.length === 1
            ? `${this.$t('kb.upload.failedOne', { name: first.fileName })}${first.error ? ` ${first.error}` : ''}`
            : this.$t('kb.upload.failedN', { n: this.num(failed.length) }));
          // Keep only the files that did not go up, so they can be tried again.
          this.selectedFilesList = this.selectedFilesList.filter((f) => failed.some((r) => r.fileName === f.name));
        }
        if (okCount > 0) {
          if (!failed.length) this.uploadDialogVisible = false;
          this.fetchDocuments();
        }
      });
    },

    // Retrieval test
    focusRetrievalTest() {
      this.$nextTick(() => this.$refs.retrievalInput && this.$refs.retrievalInput.focus());
    },
    runRetrievalTest() {
      if (this.retrievalTestLoading) return;
      if (!this.question.trim()) {
        this.$message.error(this.$t('kb.test.required'));
        this.focusRetrievalTest();
        return;
      }
      this.retrievalTestLoading = true;
      Api.knowledgeBase.retrievalTest(this.kb.datasetId, { question: this.question.trim() }, ({ data }) => {
        this.retrievalTestLoading = false;
        if (data && data.code === 0) this.retrievalTestResult = data.data || data;
        else this.$message.error((data && data.msg) || this.$t('kb.test.failed'));
      }, (err) => {
        this.retrievalTestLoading = false;
        this.$message.error((err && err.data && err.data.msg) || this.$t('kb.test.failed'));
      });
    },

    // Chunks
    openChunks(doc) {
      this.currentDocumentId = doc.id;
      this.currentDocumentName = doc.name;
      this.sliceList = [];
      this.sliceTotal = 0;
      this.sliceCurrentPage = 1;
      this.sliceDialogVisible = true;
      this.fetchSlices();
    },
    fetchSlices() {
      if (!this.kb || !this.currentDocumentId) return;
      this.sliceLoading = true;
      this.sliceFailed = false;
      const params = { page: this.sliceCurrentPage, page_size: this.slicePageSize };
      Api.knowledgeBase.listChunks(this.kb.datasetId, this.currentDocumentId, params, ({ data }) => {
        this.sliceLoading = false;
        if (data && data.code === 0) {
          const page = chunkPage(data.data);
          this.sliceList = page.list;
          this.sliceTotal = page.total;
        } else {
          this.$message.error((data && data.msg) || this.$t('kb.chunks.loadFailed'));
          this.sliceFailed = true;
          this.sliceList = [];
          this.sliceTotal = 0;
        }
      }, (err) => {
        this.sliceLoading = false;
        this.$message.error((err && err.data && (err.data.msg || err.msg)) || this.$t('kb.chunks.loadFailed'));
        this.sliceFailed = true;
        this.sliceList = [];
        this.sliceTotal = 0;
      });
    },
  },
};
</script>

<style>
.kbi { animation: kbi-in var(--tb-t-row) var(--tb-ease); }
@keyframes kbi-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.kbi__back { margin-top: var(--tb-s4); margin-left: -10px; }
.kbi .tb-pagehead { padding-top: var(--tb-s2); }
.kbi .tb-pagehead__title { overflow-wrap: anywhere; }
.kbi .tb-pagehead__actions { align-items: center; }
.kbi .tb-pagehead__actions .tb-switch { margin-right: var(--tb-s2); }

.kbi__facts { display: flex; flex-wrap: wrap; margin: 0; border-bottom: 1px solid var(--tb-rule); }
.kbi__facts > div { padding: var(--tb-s3) var(--tb-s6) var(--tb-s3) 0; margin-right: var(--tb-s6); border-right: 1px solid var(--tb-rule-soft); }
.kbi__facts > div:last-child { border-right: 0; }
.kbi__facts dt { font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.kbi__facts dd { margin: 2px 0 0; font: 800 var(--tb-fs-24)/1.1 var(--tb-font-display); }
.kbi__facts dd.kbi__date { font-size: var(--tb-fs-18); line-height: 1.35; padding-top: 3px; }

.kbi__alert { display: flex; gap: var(--tb-s2); align-items: flex-start; padding: var(--tb-s3) 0; color: var(--tb-danger); border-bottom: 1px solid var(--tb-rule-soft); }
.kbi__alert .tb-icon { flex: none; margin-top: 2px; }
.kbi__alert b { margin-right: 4px; }

.kbi__grid { display: grid; grid-template-columns: minmax(0, 1fr); column-gap: var(--tb-s8); }
@media (min-width: 1100px) {
  .kbi__grid { grid-template-columns: minmax(0, 1fr) 320px; align-items: start; }
  .kbi__test { position: sticky; top: var(--tb-s4); }
}

.kbi__search { display: flex; gap: var(--tb-s2); max-width: 420px; }
.kbi__search .tb-input { flex: 1; min-width: 0; }

.kbi-doc { display: flex; align-items: center; gap: var(--tb-s3); min-width: 0; }
.kbi-doc__ext {
  flex: none; display: inline-grid; place-items: center; width: 40px; height: 28px;
  border: 1px solid var(--tb-ink-2); border-radius: 4px; color: var(--tb-ink-2);
  font: 700 10px/1 var(--tb-font-text); letter-spacing: .04em;
}
.kbi-doc__text { display: grid; min-width: 0; }
.kbi-doc__name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kbi-doc__date { font-size: var(--tb-fs-12); color: var(--tb-ink-2); }
.kbi-status { display: inline-flex; align-items: center; gap: var(--tb-s2); flex-wrap: wrap; }
.kbi-status__pct { font-size: var(--tb-fs-13); font-weight: 600; color: var(--tb-message); }
.kbi-status .tb-loading { color: var(--tb-message); }
.kbi-status .tb-loading i { width: 8px; }
.kbi-acts { display: inline-flex; align-items: center; justify-content: flex-end; gap: 2px; }

.kbi-test { display: grid; gap: var(--tb-s3); justify-items: start; }
.kbi-test .tb-field { width: 100%; }
.kbi-results { border-top: var(--tb-rule-band) solid var(--tb-rule); padding-top: var(--tb-s2); }
.kbi-results__count { font-size: var(--tb-fs-13); color: var(--tb-ink-2); min-height: 0; }
.kbi-results__count:empty { display: none; }
.kbi-results__idle { color: var(--tb-ink-2); font-size: var(--tb-fs-14); padding: var(--tb-s3) 0; }
.kbi-results__list { list-style: none; margin: 0; padding: 0; }
.kbi-hit { padding: var(--tb-s3) 0; border-bottom: 1px solid var(--tb-rule-soft); display: grid; gap: 6px; }
.kbi-hit:last-child { border-bottom: 0; }
.kbi-hit__head { display: flex; align-items: baseline; gap: var(--tb-s3); min-width: 0; }
.kbi-hit__score { font: 800 var(--tb-fs-20)/1 var(--tb-font-display); color: var(--tb-ink); }
.kbi-hit:first-child .kbi-hit__score { color: var(--tb-action); }
.kbi-hit__src { font-size: var(--tb-fs-13); color: var(--tb-ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.kbi-hit__text { font-size: var(--tb-fs-14); line-height: var(--tb-lh-text); white-space: pre-wrap; overflow-wrap: anywhere; }

.kbi-files { border-top: var(--tb-rule-band) solid var(--tb-rule); }
.kbi-files__head { display: flex; gap: var(--tb-s2); font-weight: 600; font-size: var(--tb-fs-14); padding: var(--tb-s2) 0; border-bottom: 1px solid var(--tb-rule); }
.kbi-files ul { list-style: none; margin: 0; padding: 0; }
.kbi-file { display: flex; align-items: center; gap: var(--tb-s3); padding: 6px 0; border-bottom: 1px solid var(--tb-rule-soft); }
.kbi-file__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--tb-fs-14); }
.kbi-file__size { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }

.kbi-chunks__wait { display: grid; place-items: center; padding: var(--tb-s8) 0; }
.kbi-chunks { list-style: none; margin: 0; padding: 0; border-top: var(--tb-rule-band) solid var(--tb-rule); transition: opacity var(--tb-t-fast) var(--tb-ease); }
.kbi-chunks.is-loading { opacity: .45; }
.kbi-chunk { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: var(--tb-s4); padding: var(--tb-s3) 0; border-bottom: 1px solid var(--tb-rule-soft); }
.kbi-chunk__n { font-size: var(--tb-fs-13); font-weight: 700; color: var(--tb-ink-2); padding-top: 2px; }
.kbi-chunk__text { font-size: var(--tb-fs-14); line-height: var(--tb-lh-text); white-space: pre-wrap; overflow-wrap: anywhere; }

@media (max-width: 640px) {
  .kbi .tb-pagehead__actions { width: 100%; }
  .kbi__facts > div { padding-right: var(--tb-s4); margin-right: var(--tb-s4); }
  .kbi__search { max-width: none; }
  .kbi__table.tb-table td:first-child { display: block; padding-bottom: 6px; }
  .kbi__table.tb-table td:first-child::before { content: none; }
  .kbi-acts { justify-content: flex-start; flex-wrap: wrap; }
  .kbi-acts .tb-btn, .kbi-file .tb-btn { --h: 44px; }
  .kbi-test > .tb-btn { width: 100%; }
  .kbi-chunk { grid-template-columns: 1fr; gap: 4px; }
}
</style>
