<template>
  <div class="tb-page vr">
    <TbPageHeader :title="$t('nav.voiceResources')" :description="$t('voices.res.desc')">
      <template #actions>
        <TbButton variant="primary" icon="plus" @click="openAdd">{{ $t('voices.res.add') }}</TbButton>
      </template>
    </TbPageHeader>

    <div class="vr-filter" role="search">
      <TbInput v-model="searchName" class="vr-filter__search" icon="search" clearable size="s"
        :placeholder="$t('voices.searchPlaceholder')" :aria-label="$t('common.search')" :clear-label="$t('voices.clear')"
        @enter="handleSearch" @clear="handleSearch" />
      <TbButton size="s" icon="search" @click="handleSearch">{{ $t('common.search') }}</TbButton>
      <p class="vr-filter__count tb-num" aria-live="polite">{{ $t('voices.res.count', { n: num(total) }) }}</p>
    </div>

    <Transition name="vr-bulk">
      <div v-if="selected.length" class="vr-bulk" role="region" :aria-label="$t('voices.selection')">
        <span class="tb-num">{{ $t('voices.selected', { n: num(selected.length) }) }}</span>
        <TbButton size="s" variant="quiet" @click="selected = []">{{ $t('voices.clearSelection') }}</TbButton>
        <TbButton size="s" variant="danger" icon="trash" @click="deleteSelected">{{ $t('common.delete') }}</TbButton>
      </div>
    </Transition>

    <TbTable v-model:selected="selected" class="vr-table" :columns="columns" :rows="failed ? [] : rows" row-key="id" dense selectable
      :loading="loading && !rows.length" :caption="$t('nav.voiceResources')" :loading-text="$t('common.loading')"
      :select-all-label="$t('voices.selectAll')" :select-row-label="$t('voices.selectRow')"
      :row-class="(r) => (isPlaying(r) ? 'is-playing' : null)">
      <template #cell-name="{ row }">
        <span class="vr-name">
          <b class="vr-name__text" :title="row.name">{{ row.name || $t('voices.unnamed') }}</b>
          <code class="vr-name__id" :title="row.voiceId">{{ row.voiceId }}</code>
        </span>
      </template>
      <template #cell-userName="{ value }"><span class="vr-cut" :title="value">{{ value || dash }}</span></template>
      <template #cell-modelName="{ value }"><span class="vr-cut" :title="value">{{ value || dash }}</span></template>
      <template #cell-languages="{ value }"><span class="vr-cut" :title="value">{{ value || dash }}</span></template>
      <template #cell-trainStatus="{ row }">
        <span class="vr-state">
          <TbTag :ink="ink(row)" mark>{{ $t(stateKey(row)) }}</TbTag>
          <small v-if="state(row) === 'failed' && row.trainError" class="vr-state__err" :title="row.trainError">{{ row.trainError }}</small>
        </span>
      </template>
      <template #cell-createDate="{ value }"><time class="vr-date tb-num">{{ when(value) || dash }}</time></template>
      <template #cell-actions="{ row }">
        <span class="vr-acts">
          <TbButton size="s" variant="quiet" :icon="isPlaying(row) ? 'pause' : 'play'"
            :aria-label="isPlaying(row) ? $t('voices.pauseSample', { name: rowName(row) }) : $t('voices.playSample', { name: rowName(row) })"
            :aria-pressed="isPlaying(row) ? 'true' : 'false'" @click.stop="toggleAudio(row)" />
          <TbButton size="s" variant="quiet" icon="trash" class="vr-del" :aria-label="$t('voices.deleteNamed', { name: rowName(row) })"
            @click.stop="deleteVoices([row])" />
        </span>
      </template>
      <template #empty>
        <TbEmpty v-if="failed" face="confused" :title="$t('common.loadFailed')">
          <TbButton icon="refresh" @click="fetchList">{{ $t('common.retry') }}</TbButton>
        </TbEmpty>
        <TbEmpty v-else-if="appliedName" :title="$t('voices.noMatch')" :text="$t('voices.noMatchText')">
          <TbButton variant="quiet" @click="searchName = ''; handleSearch()">{{ $t('voices.clearSearch') }}</TbButton>
        </TbEmpty>
        <TbEmpty v-else face="sleepy" :title="$t('voices.res.emptyTitle')" :text="$t('voices.res.emptyText')">
          <TbButton icon="plus" @click="openAdd">{{ $t('voices.res.add') }}</TbButton>
        </TbEmpty>
      </template>
    </TbTable>

    <TbPagination v-if="total > 0" :page="currentPage" :page-size="pageSize" :total="total" :sizes="pageSizeOptions"
      :total-text="$t('voices.res.count', { n: num(total) })" :size-suffix="$t('voices.perPage')"
      :aria-label="$t('voices.pages')" :prev-label="$t('voices.prevPage')" :next-label="$t('voices.nextPage')"
      :size-label="$t('voices.rowsPerPage')" @change="onPage" />

    <VoiceResourceSheet v-model:open="addOpen" :saving="saving" @submit="handleSubmit" />
  </div>
</template>

<script>
import Api from '@/apis/api';
import { digits } from '@/kit/calendar';
import VoiceResourceSheet from './VoiceResourceSheet.vue';
import { STATE_INK, STATE_KEY, dateText, sampleUrl, trainState } from './voiceModel';

export default {
  name: 'VoiceResourceManagement',
  components: { VoiceResourceSheet },
  data() {
    return {
      searchName: '',
      appliedName: '',
      loading: false,
      failed: false,
      rows: [],
      selected: [],
      currentPage: 1,
      pageSize: 10,
      pageSizeOptions: [10, 20, 50, 100],
      total: 0,
      addOpen: false,
      saving: false,
      playingId: null,
      isPaused: false,
      currentAudio: null,
      dash: '–',
    };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    columns() {
      return [
        { key: 'name', label: this.$t('voices.col.voice') },
        { key: 'userName', label: this.$t('voices.col.owner') },
        { key: 'modelName', label: this.$t('voices.col.platform') },
        { key: 'languages', label: this.$t('voices.col.languages') },
        { key: 'trainStatus', label: this.$t('voices.col.state') },
        { key: 'createDate', label: this.$t('voices.col.created') },
        { key: 'actions', label: this.$t('voices.col.actions'), align: 'right', width: '96px' },
      ];
    },
  },
  created() {
    this.fetchList();
  },
  beforeUnmount() {
    this.stopAudio();
  },
  methods: {
    num(n) { return digits(n ?? 0, this.lang); },
    when(v) { return dateText(v, this.lang); },
    state: trainState,
    ink(row) { return STATE_INK[trainState(row)]; },
    stateKey(row) { return STATE_KEY[trainState(row)]; },
    rowName(row) { return row.name || row.voiceId || ''; },

    fetchList() {
      this.loading = true;
      this.failed = false;
      const params = {
        page: this.currentPage,
        limit: this.pageSize,
        name: this.searchName || '',
        orderField: 'create_date',
        order: 'desc',
      };
      this.appliedName = params.name;
      Api.voiceResource.getVoiceResourceList(params, (res) => {
        this.loading = false;
        const body = res.data;
        if (body.code === 0) {
          this.rows = (body.data && body.data.list) || [];
          this.total = (body.data && body.data.total) || 0;
          this.selected = [];
        } else {
          this.rows = [];
          this.total = 0;
          this.failed = true;
          this.$message.error(body.msg || this.$t('common.loadFailed'));
        }
      });
    },
    handleSearch() {
      this.currentPage = 1;
      this.fetchList();
    },
    onPage({ page, pageSize }) {
      if (pageSize !== this.pageSize) {
        this.pageSize = pageSize;
        this.currentPage = 1;
      } else if (page === this.currentPage) return;
      else this.currentPage = page;
      this.fetchList();
    },

    openAdd() {
      this.addOpen = true;
    },
    handleSubmit(form) {
      this.saving = true;
      Api.voiceResource.saveVoiceResource(form, (res) => {
        this.saving = false;
        const body = res.data;
        if (body.code === 0) {
          this.$message.success(this.$t('voices.res.added'));
          this.addOpen = false;
          this.fetchList();
        } else {
          this.$message.error(body.msg || this.$t('voices.res.addFailed'));
        }
      });
    },

    deleteSelected() {
      const items = this.rows.filter((r) => this.selected.includes(r.id));
      if (!items.length) {
        this.$message.warning(this.$t('voices.selectFirst'));
        return;
      }
      this.deleteVoices(items);
    },
    deleteVoices(items) {
      if (!items.length) {
        this.$message.warning(this.$t('voices.selectFirst'));
        return;
      }
      const count = items.length;
      const title = count === 1 && items[0].name ? items[0].name : this.$t('voices.deleteTitle');
      this.$confirm(this.$t(count === 1 ? 'voices.res.confirmDeleteOne' : 'voices.res.confirmDelete', { n: this.num(count) }), title, {
        confirmText: this.$t('common.delete'),
        cancelText: this.$t('common.cancel'),
        danger: true,
      }).then(() => {
        const ids = items.map((i) => i.id);
        if (ids.some((id) => !id)) {
          this.$message.error(this.$t('voices.deleteFailed'));
          return;
        }
        Api.voiceResource.deleteVoiceResource(ids, (res) => {
          const body = res.data;
          if (body.code === 0) {
            this.$message.success(this.$t(count === 1 ? 'voices.res.deletedOne' : 'voices.res.deleted', { n: this.num(count) }));
            if (ids.includes(this.playingId)) this.stopAudio();
            this.fetchList();
          } else {
            this.$message.error(body.msg || this.$t('voices.deleteFailed'));
          }
        });
      }).catch(() => {
        this.$message({ type: 'info', message: this.$t('voices.cancelled'), duration: 1200 });
      });
    },

    isPlaying(row) {
      return this.playingId === (row.id || row.voiceId) && !this.isPaused;
    },
    toggleAudio(row) {
      const rowId = row.id || row.voiceId;
      if (this.playingId === rowId && this.currentAudio) {
        if (this.isPaused) {
          this.currentAudio.play();
          this.isPaused = false;
        } else {
          this.currentAudio.pause();
          this.isPaused = true;
        }
        return;
      }
      this.stopAudio();
      this.playingId = rowId;
      this.isPaused = false;
      const audio = new Audio(sampleUrl(row));
      this.currentAudio = audio;
      audio.onended = () => { this.playingId = null; this.isPaused = false; };
      audio.onerror = () => {
        if (this.currentAudio !== audio) return;
        this.$message.warning(this.$t('voices.noSample'));
        this.playingId = null;
      };
      const p = audio.play();
      if (p && p.catch) p.catch(() => { if (this.currentAudio === audio) this.playingId = null; });
    },
    stopAudio() {
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }
      this.playingId = null;
      this.isPaused = false;
    },
  },
};
</script>

<style>
.vr { padding-bottom: var(--tb-s8); }
.vr-filter { display: flex; align-items: center; gap: var(--tb-s2); flex-wrap: wrap; padding: var(--tb-s4) 0 var(--tb-s3); }
.vr-filter__search { flex: 0 1 340px; min-width: 0; }
.vr-filter__count { margin-left: auto; color: var(--tb-ink-2); font-size: var(--tb-fs-13); }

.vr-bulk {
  display: flex; align-items: center; gap: var(--tb-s3); flex-wrap: wrap;
  padding: 6px 0 10px; font-size: var(--tb-fs-14); font-weight: 600;
}
.vr-bulk > span { margin-right: auto; }
.vr-bulk-enter-active { transition: opacity var(--tb-t-row) var(--tb-ease), transform var(--tb-t-row) var(--tb-ease); }
.vr-bulk-leave-active { transition: opacity var(--tb-t-fast) var(--tb-ease-in); }
.vr-bulk-enter-from { opacity: 0; transform: translateY(-4px); }
.vr-bulk-leave-to { opacity: 0; }

.vr-table td { overflow-wrap: anywhere; }
.vr-table tr.is-playing td:first-child { box-shadow: inset 3px 0 0 var(--tb-orange); }
.vr-name { display: grid; gap: 1px; min-width: 0; max-width: 260px; }
.vr-name__text { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vr-name__id { font: var(--tb-fs-12)/1.4 var(--tb-font-text); color: var(--tb-ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vr-cut { display: block; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vr-state { display: grid; justify-items: start; gap: 4px; }
.vr-state__err { max-width: 220px; color: var(--tb-danger); font-size: var(--tb-fs-12); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vr-date { color: var(--tb-ink-2); white-space: nowrap; font-size: var(--tb-fs-13); }
.vr-acts { display: inline-flex; gap: 2px; justify-content: flex-end; }
.vr-del { color: var(--tb-danger); }

@media (max-width: 640px) {
  .vr-filter__search { flex: 1 1 100%; }
  .vr-filter > .tb-btn { display: none; }
  .vr-filter__count { margin-left: 0; }
  .vr-name, .vr-cut, .vr-state__err { max-width: none; }
  .vr-name__text, .vr-name__id, .vr-cut, .vr-state__err { white-space: normal; }
  .vr-table tr.is-playing td:first-child { box-shadow: none; }
  .vr-acts { justify-content: flex-start; }
  .vr-acts .tb-btn { --h: 44px; }
}
</style>
