<template>
  <div class="words">
    <TbPageHeader :title="$t('nav.replacementWords')" :description="$t('words.desc')">
      <template #actions>
        <TbButton variant="primary" icon="plus" @click="openAdd">{{ $t('words.add') }}</TbButton>
      </template>
    </TbPageHeader>

    <div class="words__bar">
      <form class="words__search" role="search" @submit.prevent="search">
        <TbInput v-model="query" icon="search" clearable :placeholder="$t('words.searchPlaceholder')"
          :aria-label="$t('words.searchLabel')" :clear-label="$t('words.clearSearch')" />
      </form>
      <div class="words__batch">
        <TbCheckbox class="words__all" :model-value="allSelected" :indeterminate="selectedHere.length > 0 && !allSelected"
          :disabled="!visibleRows.length" :label="$t('words.selectAll')" @update:model-value="selectAll" />
        <span v-if="selectedHere.length" class="words__count tb-num">{{ $t('words.selected', { n: num(selectedHere.length) }) }}</span>
        <TbButton size="s" variant="danger" icon="trash" :disabled="!selectedHere.length" @click="removeSelected">
          {{ $t('words.deleteSelected') }}
        </TbButton>
      </div>
    </div>

    <TbTable class="words__table" dense selectable row-key="id" v-model:selected="selected" :columns="columns" :rows="visibleRows"
      :loading="loading" :caption="$t('nav.replacementWords')" :loading-text="$t('common.loading')"
      :select-all-label="$t('words.selectAll')" :select-row-label="$t('words.selectRow')">
      <template #cell-fileName="{ row }">
        <span class="words__name" :title="row.fileName || null">{{ row.fileName || '–' }}</span>
      </template>
      <template #cell-wordCount="{ row }">
        <b class="words__num tb-num">{{ num(row.wordCount || 0) }}</b>
      </template>
      <template #cell-content="{ row }">
        <span v-if="pairsOf(row).length" class="words__pairs" :title="titleOf(row)">
          <span v-for="(p, i) in pairsOf(row).slice(0, 3)" :key="i" class="words__pair">
            <span>{{ p.original }}</span><TbIcon name="chevron-right" :size="12" /><span>{{ p.replacement }}</span>
          </span>
          <small v-if="pairsOf(row).length > 3" class="words__moreof tb-num">{{ $t('words.morePairs', { n: num(pairsOf(row).length - 3) }) }}</small>
        </span>
        <span v-else class="words__dim">–</span>
      </template>
      <template #cell-updatedAt="{ row }">
        <span class="words__date">
          <time :datetime="row.updatedAt || null">{{ when(row.updatedAt) || '–' }}</time>
          <small v-if="row.createdAt">{{ $t('words.addedOn', { date: when(row.createdAt) }) }}</small>
        </span>
      </template>
      <template #cell-actions="{ row }">
        <span class="words__acts">
          <TbButton size="s" variant="quiet" icon="edit" @click.stop="openEdit(row)">{{ $t('words.edit') }}</TbButton>
          <TbButton size="s" variant="quiet" icon="download" @click.stop="download(row)">{{ $t('words.download') }}</TbButton>
          <TbButton size="s" variant="quiet" icon="trash" class="words__del" @click.stop="remove(row)">{{ $t('words.delete') }}</TbButton>
        </span>
      </template>
      <template #empty>
        <TbEmpty v-if="failed" face="confused" :title="$t('words.loadFailed')" :text="failMsg">
          <TbButton icon="refresh" @click="fetchList">{{ $t('common.retry') }}</TbButton>
        </TbEmpty>
        <TbEmpty v-else-if="query.trim() && rows.length" :title="$t('words.emptySearchTitle')" :text="$t('words.emptySearchText')">
          <TbButton @click="query = ''">{{ $t('words.clearSearch') }}</TbButton>
        </TbEmpty>
        <TbEmpty v-else face="sleepy" :title="$t('words.emptyTitle')" :text="$t('words.emptyText')">
          <TbButton variant="primary" icon="plus" @click="openAdd">{{ $t('words.add') }}</TbButton>
        </TbEmpty>
      </template>
    </TbTable>

    <TbPagination v-if="total > 0" v-model:page="page" v-model:page-size="pageSize" :total="total" :sizes="pageSizes"
      :total-text="$t('words.total', { n: num(total) })" :size-suffix="$t('words.perPage')" :aria-label="$t('words.pages')"
      :prev-label="$t('words.prev')" :next-label="$t('words.next')" :size-label="$t('words.pageSize')" @change="onPage" />

    <ReplacementWordSheet v-model:open="sheetOpen" :form="form" :saving="saving" @submit="save" />
  </div>
</template>

<script>
import Api from '@/apis/api';
import { digits } from '@/kit/calendar';
import ReplacementWordSheet from './ReplacementWordSheet.vue';
import { PAGE_SIZES, contentLines, dateTimeText, filterFiles, isErrorBody, splitPair } from './wordsModel';

// Replacement words, back office: files of "original|replacement" pairs that correct how the
// robot's speech recognition writes names and words. Legacy behaviour kept: pages of
// 10/20/50/100 from the server, file-name search over the page on screen, select and delete in
// bulk (selection kept across pages), edit and add in a sheet, download as a .txt file.
export default {
  name: 'ReplacementWordManagement',
  components: { ReplacementWordSheet },
  data() {
    return {
      query: '',
      rows: [],
      total: 0,
      page: 1,
      pageSize: 10,
      pageSizes: PAGE_SIZES,
      loading: false,
      failed: false,
      failMsg: '',
      selected: [],
      sheetOpen: false,
      form: { id: undefined, fileName: '', content: '' },
      saving: false,
    };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    columns() {
      return [
        { key: 'fileName', label: this.$t('words.col.fileName') },
        { key: 'wordCount', label: this.$t('words.col.count'), align: 'right' },
        { key: 'content', label: this.$t('words.col.content') },
        { key: 'updatedAt', label: this.$t('words.col.updated') },
        { key: 'actions', label: this.$t('words.col.actions'), align: 'right' },
      ];
    },
    visibleRows() { return filterFiles(this.rows, this.query); },
    selectedHere() { return this.visibleRows.filter((r) => this.selected.includes(r.id)); },
    allSelected() { return this.visibleRows.length > 0 && this.selectedHere.length === this.visibleRows.length; },
  },
  created() { this.fetchList(); },
  methods: {
    num(v) { return digits(v, this.lang); },
    when(v) { return dateTimeText(v, this.lang); },
    pairsOf(row) { return contentLines(row.content).map(splitPair); },
    titleOf(row) {
      const lines = contentLines(row.content);
      const head = lines.slice(0, 20).map((l) => { const p = splitPair(l); return `${p.original} → ${p.replacement}`; });
      return lines.length > 20 ? `${head.join('\n')}\n…` : head.join('\n');
    },

    fetchList() {
      this.loading = true;
      this.failed = false;
      Api.correctWord.getFileList({ page: this.page, pageSize: this.pageSize }, (res) => {
        this.loading = false;
        const body = (res && res.data) || {};
        if (body.code === 0) {
          this.rows = (body.data && body.data.list) || [];
          this.total = (body.data && body.data.total) || 0;
        } else {
          this.rows = [];
          this.failed = true;
          this.failMsg = body.msg || '';
          this.$message.error(body.msg || this.$t('words.loadFailed'));
        }
      });
    },
    search() {
      if (this.page !== 1) {
        this.page = 1;
        this.fetchList();
      }
    },
    onPage({ page, pageSize }) {
      if (pageSize !== this.pageSize) {
        this.pageSize = pageSize;
        this.page = 1;
      } else {
        this.page = page;
      }
      this.fetchList();
    },
    selectAll(on) {
      const ids = this.visibleRows.map((r) => r.id);
      this.selected = on ? [...new Set([...this.selected, ...ids])] : this.selected.filter((id) => !ids.includes(id));
    },

    openAdd() {
      this.form = { id: undefined, fileName: '', content: '' };
      this.sheetOpen = true;
    },
    openEdit(row) {
      this.form = { id: row.id, fileName: row.fileName, content: row.content || '' };
      this.sheetOpen = true;
    },
    save(data) {
      this.saving = true;
      const done = (okKey, failKey) => (res) => {
        const body = (res && res.data) || {};
        this.saving = false;
        if (body.code === 0) {
          this.$message.success(this.$t(okKey));
          this.sheetOpen = false;
          this.fetchList();
        } else {
          this.$message.error(body.msg || this.$t(failKey));
        }
      };
      if (data.id) Api.correctWord.updateFile(data, done('words.saved', 'words.saveFailed'));
      else Api.correctWord.addFile(data, done('words.added', 'words.addFailed'));
    },

    download(row) {
      Api.correctWord.downloadFile(row.id, (res) => {
        const data = res && res.data;
        if (isErrorBody(data)) {
          this.$message.error(data.msg || this.$t('words.downloadFailed'));
          return;
        }
        const url = window.URL.createObjectURL(new Blob([data]));
        const link = document.createElement('a');
        link.href = url;
        link.download = `${row.fileName}.txt`;
        link.click();
        window.URL.revokeObjectURL(url);
      });
    },

    removeSelected() {
      const ids = this.selectedHere.map((r) => r.id);
      if (!ids.length) return;
      this.$confirm(this.$t('words.confirmMany', { n: this.num(ids.length) }), this.$t('words.deleteManyTitle'),
        { confirmText: this.$t('words.delete'), cancelText: this.$t('common.cancel'), danger: true })
        .then(() => {
          Api.correctWord.batchDeleteFile(ids, (res) => {
            const body = (res && res.data) || {};
            if (body.code === 0) {
              this.$message.success(this.$t('words.deleted'));
              this.selected = this.selected.filter((id) => !ids.includes(id));
              if (ids.length === this.rows.length && this.page > 1) this.page -= 1;
              this.fetchList();
            } else {
              this.$message.error(body.msg || this.$t('words.deleteFailed'));
            }
          });
        })
        .catch(() => {});
    },
    remove(row) {
      this.$confirm(this.$t('words.confirmOne'), row.fileName || this.$t('words.deleteTitle'),
        { confirmText: this.$t('words.delete'), cancelText: this.$t('common.cancel'), danger: true })
        .then(() => {
          Api.correctWord.deleteFile(row.id, (res) => {
            const body = (res && res.data) || {};
            if (body.code === 0) {
              this.$message.success(this.$t('words.deleted'));
              this.selected = this.selected.filter((id) => id !== row.id);
              if (this.rows.length === 1 && this.page > 1) this.page -= 1;
              this.fetchList();
            } else {
              this.$message.error(body.msg || this.$t('words.deleteFailed'));
            }
          });
        })
        .catch(() => {});
    },
  },
};
</script>

<style>
.words { padding-bottom: var(--tb-s8); }
.words__bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 0 12px; }
.words__search { flex: 1 1 320px; max-width: 420px; min-width: 0; }
.words__batch { display: flex; align-items: center; gap: 12px; }
.words__all { display: none; }
.words__count { font-size: var(--tb-fs-13); color: var(--tb-ink-2); }

.words__table td { vertical-align: top; }
.words__name { display: block; font-weight: 600; max-width: 26ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.words__num { font-family: var(--tb-font-display); font-weight: 700; }
.words__pairs { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 14px; max-width: 46ch; }
.words__pair { display: inline-flex; align-items: center; gap: 4px; min-width: 0; }
.words__pair > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 14ch; }
.words__pair .tb-icon { flex: none; color: var(--tb-orange); }
.words__moreof { font-size: var(--tb-fs-12); color: var(--tb-ink-3); }
.words__dim { color: var(--tb-ink-3); }
.words__date { display: grid; gap: 2px; }
.words__date time { white-space: nowrap; }
.words__date small { font-size: var(--tb-fs-12); color: var(--tb-ink-3); white-space: nowrap; }
.words__acts { display: inline-flex; gap: 2px; justify-content: flex-end; flex-wrap: nowrap; }
.words__del { color: var(--tb-danger); }

@media (max-width: 640px) {
  .words__search { flex-basis: 100%; max-width: none; }
  .words__batch { width: 100%; }
  .words__all { display: inline-flex; min-height: var(--tb-target); margin-right: auto; }
  .words__name { white-space: normal; overflow-wrap: anywhere; max-width: none; }
  .words__pairs { max-width: none; }
  .words__pair > span { max-width: 18ch; }
  .words__date time, .words__date small { white-space: normal; }
  .words__acts { flex-wrap: wrap; justify-content: flex-start; margin-left: -10px; }
  .words__acts .tb-btn, .words__batch .tb-btn { min-height: var(--tb-target); }
}
</style>
