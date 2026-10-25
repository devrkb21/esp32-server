<template>
  <div class="tb-page vc">
    <TbPageHeader :title="$t('nav.voiceClone')" :description="$t('voices.clone.desc')" />

    <div class="vc-filter" role="search">
      <TbInput v-model="searchName" class="vc-filter__search" icon="search" clearable size="s"
        :placeholder="$t('voices.searchPlaceholder')" :aria-label="$t('common.search')" :clear-label="$t('voices.clear')"
        @enter="handleSearch" @clear="handleSearch" />
      <TbButton size="s" icon="search" class="vc-filter__go" @click="handleSearch">{{ $t('common.search') }}</TbButton>
      <p class="vc-filter__count tb-num" aria-live="polite">
        <span v-if="trainingCount" class="vc-filter__live">{{ $t('voices.clone.trainingNow', { n: num(trainingCount) }) }}</span>
        {{ $t('voices.clone.count', { n: num(total) }) }}
      </p>
      <TbButton size="s" variant="quiet" icon="refresh" :aria-label="$t('voices.refresh')" :loading="loading && !!rows.length" @click="fetchList()" />
    </div>

    <TbTable class="vc-table" :columns="columns" :rows="failed ? [] : rows" row-key="id" dense
      :loading="loading && !rows.length" :caption="$t('nav.voiceClone')" :loading-text="$t('common.loading')"
      :row-class="(r) => (playingId === r.id ? 'is-playing' : null)">
      <template #cell-name="{ row }">
        <div class="vc-voice">
          <TbButton size="s" :variant="playingId === row.id ? 'primary' : 'secondary'" class="vc-play"
            :icon="playingId === row.id ? 'stop' : 'play'" :disabled="!row.hasVoice"
            :aria-label="playingId === row.id ? $t('voices.stopSample', { name: rowName(row) }) : $t('voices.playSample', { name: rowName(row) })"
            @click.stop="handlePlay(row)" />
          <form v-if="editingId === row.id" class="vc-rename" @submit.prevent="saveName(row)">
            <TbInput ref="nameInput" v-model="draftName" size="s" :maxlength="64" :aria-label="$t('voices.col.name')"
              @keydown.esc.prevent="cancelEdit" />
            <TbButton size="s" variant="quiet" icon="check" native-type="submit" :aria-label="$t('common.save')" />
            <TbButton size="s" variant="quiet" icon="close" :aria-label="$t('common.cancel')" @click="cancelEdit" />
          </form>
          <span v-else class="vc-voice__name">
            <b :title="row.name">{{ row.name || $t('voices.unnamed') }}</b>
            <TbButton size="s" variant="quiet" icon="edit" class="vc-voice__edit" :aria-label="$t('voices.clone.renameNamed', { name: rowName(row) })"
              @click.stop="startEdit(row)" />
          </span>
        </div>
      </template>
      <template #cell-trainStatus="{ row }">
        <span class="vc-state">
          <TbTag :ink="ink(row)" mark>{{ $t(stateKey(row)) }}</TbTag>
          <small v-if="state(row) === 'failed' && row.trainError" class="vc-state__err">{{ $t('voices.clone.failedWith', { error: row.trainError }) }}</small>
          <small v-else-if="state(row) === 'upload'" class="vc-state__hint">{{ $t('voices.clone.hintUpload') }}</small>
          <small v-else-if="state(row) === 'waiting'" class="vc-state__hint">{{ $t('voices.clone.hintWaiting') }}</small>
        </span>
      </template>
      <template #cell-voiceId="{ value }"><code class="vc-id" :title="value">{{ value || dash }}</code></template>
      <template #cell-languages="{ value }"><span class="vc-cut" :title="langs(value)">{{ langs(value) || dash }}</span></template>
      <template #cell-createDate="{ value }"><time class="vc-date tb-num">{{ when(value) || dash }}</time></template>
      <template #cell-actions="{ row }">
        <span class="vc-acts">
          <TbButton size="s" icon="upload" @click.stop="openUpload(row)">{{ row.hasVoice ? $t('voices.clone.replaceSample') : $t('voices.clone.uploadSample') }}</TbButton>
          <TbButton v-if="row.hasVoice" size="s" :variant="state(row) === 'waiting' ? 'primary' : 'secondary'" icon="copy"
            :loading="cloningId === row.id" @click.stop="handleClone(row)">{{ $t('voices.clone.clone') }}</TbButton>
        </span>
      </template>
      <template #empty>
        <TbEmpty v-if="failed" face="confused" :title="$t('common.loadFailed')">
          <TbButton icon="refresh" @click="fetchList()">{{ $t('common.retry') }}</TbButton>
        </TbEmpty>
        <TbEmpty v-else-if="appliedName" :title="$t('voices.noMatch')" :text="$t('voices.noMatchText')">
          <TbButton variant="quiet" @click="searchName = ''; handleSearch()">{{ $t('voices.clearSearch') }}</TbButton>
        </TbEmpty>
        <TbEmpty v-else face="sleepy" :title="$t('voices.clone.emptyTitle')" :text="$t('voices.clone.emptyText')" />
      </template>
    </TbTable>

    <TbPagination v-if="total > 0" :page="currentPage" :page-size="pageSize" :total="total" :sizes="pageSizeOptions"
      :total-text="$t('voices.clone.count', { n: num(total) })" :size-suffix="$t('voices.perPage')"
      :aria-label="$t('voices.pages')" :prev-label="$t('voices.prevPage')" :next-label="$t('voices.nextPage')"
      :size-label="$t('voices.rowsPerPage')" @change="onPage" />

    <VoiceCloneSheet v-model:open="uploadOpen" :voice="current" @success="fetchList()" />
  </div>
</template>

<script>
import Api from '@/apis/api';
import { digits } from '@/kit/calendar';
import VoiceCloneSheet from './VoiceCloneSheet.vue';
import { STATE_INK, STATE_KEY, dateText, languagesText, trainState } from './voiceModel';

// While a voice is training the list refreshes itself quietly, so its state stays honest.
const TRAINING_POLL_MS = 15000;

export default {
  name: 'VoiceCloneManagement',
  components: { VoiceCloneSheet },
  data() {
    return {
      searchName: '',
      appliedName: '',
      loading: false,
      failed: false,
      rows: [],
      currentPage: 1,
      pageSize: 10,
      pageSizeOptions: [10, 20, 50, 100],
      total: 0,
      uploadOpen: false,
      current: {},
      cloningId: null,
      editingId: null,
      draftName: '',
      submittingName: false,
      currentAudio: null,
      playingId: null,
      poll: null,
      dash: '–',
    };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    trainingCount() { return this.rows.filter((r) => trainState(r) === 'training').length; },
    columns() {
      return [
        { key: 'name', label: this.$t('voices.col.voice') },
        { key: 'trainStatus', label: this.$t('voices.col.state') },
        { key: 'voiceId', label: this.$t('voices.col.voiceId') },
        { key: 'languages', label: this.$t('voices.col.languages') },
        { key: 'createDate', label: this.$t('voices.col.created') },
        { key: 'actions', label: this.$t('voices.col.actions'), align: 'right' },
      ];
    },
  },
  watch: {
    trainingCount(n) {
      clearInterval(this.poll);
      this.poll = n ? setInterval(() => { if (!document.hidden && !this.editingId) this.fetchList(true); }, TRAINING_POLL_MS) : null;
    },
  },
  created() {
    this.fetchList();
  },
  beforeUnmount() {
    clearInterval(this.poll);
    this.stopAudio();
  },
  methods: {
    num(n) { return digits(n ?? 0, this.lang); },
    when(v) { return dateText(v, this.lang); },
    langs(v) { return languagesText(v, this.$t); },
    state: trainState,
    ink(row) { return STATE_INK[trainState(row)]; },
    stateKey(row) { return STATE_KEY[trainState(row)]; },
    rowName(row) { return row.name || row.voiceId || ''; },

    fetchList(quiet = false) {
      if (!quiet) this.loading = true;
      this.failed = false;
      const params = {
        page: this.currentPage,
        limit: this.pageSize,
        name: this.searchName || '',
        orderField: 'create_date',
        order: 'desc',
      };
      this.appliedName = params.name;
      Api.voiceClone.getVoiceCloneList(params, (res) => {
        this.loading = false;
        const body = res.data;
        if (body.code === 0) {
          this.rows = (body.data && body.data.list) || [];
          this.total = (body.data && body.data.total) || 0;
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

    // Rename in place
    startEdit(row) {
      this.editingId = row.id;
      this.draftName = row.name || '';
      this.$nextTick(() => {
        const input = Array.isArray(this.$refs.nameInput) ? this.$refs.nameInput[0] : this.$refs.nameInput;
        if (input) { input.focus(); input.select(); }
      });
    },
    cancelEdit() {
      this.editingId = null;
      this.draftName = '';
    },
    saveName(row) {
      if (this.submittingName) return;
      const name = this.draftName.trim();
      this.editingId = null;
      if (name === (row.name || '')) return;
      const previous = row.name;
      row.name = name;
      this.submittingName = true;
      Api.voiceClone.updateName({ id: row.id, name }, (res) => {
        this.submittingName = false;
        const body = res.data;
        if (body.code === 0) {
          this.$message.success(this.$t('voices.clone.renamed'));
        } else {
          row.name = previous;
          this.$message.error(body.msg || this.$t('voices.clone.renameFailed'));
          this.fetchList(true);
        }
      });
    },

    // Clone
    handleClone(row) {
      if (this.cloningId) return;
      this.cloningId = row.id;
      const done = () => { this.cloningId = null; this.fetchList(true); };
      try {
        Api.voiceClone.cloneAudio({ cloneId: row.id }, (res) => {
          try {
            const body = res.data;
            if (body.code === 0) this.$message.success(this.$t('voices.clone.cloneStarted'));
            else this.$message.error(body.msg || this.$t('voices.clone.cloneFailed'));
          } catch (e) {
            this.$message.error(this.$t('voices.clone.cloneFailed'));
          } finally {
            done();
          }
        }, (res) => {
          const msg = res && res.data && res.data.msg;
          this.$message.error(msg || this.$t('voices.clone.cloneFailed'));
          done();
        });
      } catch (e) {
        this.$message.error(this.$t('voices.clone.apiError'));
        done();
      }
    },

    openUpload(row) {
      this.stopAudio();
      this.current = row;
      this.uploadOpen = true;
    },

    // Listen to the uploaded sample
    handlePlay(row) {
      if (!row.hasVoice) return;
      if (this.playingId === row.id && this.currentAudio) {
        this.stopAudio();
        return;
      }
      this.stopAudio();
      this.playingId = row.id;
      Api.voiceClone.getAudioId(row.id, (res) => {
        const body = res.data;
        if (this.playingId !== row.id) return;
        if (body.code === 0) {
          const audio = new Audio(Api.voiceClone.getPlayVoiceUrl(body.data));
          this.currentAudio = audio;
          const end = () => { if (this.currentAudio === audio) { this.playingId = null; this.currentAudio = null; } };
          audio.addEventListener('ended', end);
          audio.addEventListener('error', end);
          const p = audio.play();
          if (p && p.catch) p.catch(() => { if (this.currentAudio === audio) this.$message.error(this.$t('voices.playFailed')); end(); });
        } else {
          this.playingId = null;
          this.$message.error(body.msg || this.$t('voices.clone.noAudio'));
        }
      });
    },
    stopAudio() {
      if (this.currentAudio) {
        this.currentAudio.pause();
        try { this.currentAudio.currentTime = 0; } catch (e) { /* not loaded */ }
        this.currentAudio = null;
      }
      this.playingId = null;
    },
  },
};
</script>

<style>
.vc { padding-bottom: var(--tb-s8); }
.vc-filter { display: flex; align-items: center; gap: var(--tb-s2); flex-wrap: wrap; padding: var(--tb-s4) 0 var(--tb-s3); }
.vc-filter__search { flex: 0 1 340px; min-width: 0; }
.vc-filter__count { margin-left: auto; color: var(--tb-ink-2); font-size: var(--tb-fs-13); display: inline-flex; gap: 10px; flex-wrap: wrap; }
.vc-filter__live { color: var(--tb-message); font-weight: 600; }

.vc-table td { overflow-wrap: anywhere; }
.vc-table tr.is-playing td:first-child { box-shadow: inset 3px 0 0 var(--tb-orange); }
.vc-voice { display: flex; align-items: center; gap: 10px; min-width: 200px; }
.vc-play { flex: none; }
.vc-voice__name { display: inline-flex; align-items: center; gap: 2px; min-width: 0; }
.vc-voice__name b { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
.vc-voice__edit { opacity: .6; transition: opacity var(--tb-t-hover) var(--tb-ease); }
.vc-voice__edit:hover, .vc-voice__edit:focus-visible { opacity: 1; }
.vc-rename { display: flex; align-items: center; gap: 2px; flex: 1; min-width: 0; }
.vc-rename .tb-input { flex: 1; min-width: 120px; }
.vc-state { display: grid; justify-items: start; gap: 4px; }
.vc-state__err { max-width: 260px; color: var(--tb-danger); font-size: var(--tb-fs-12); line-height: 1.45; }
.vc-state__hint { max-width: 200px; color: var(--tb-ink-2); font-size: var(--tb-fs-12); line-height: 1.45; }
.vc-id { font: var(--tb-fs-13)/1.4 var(--tb-font-text); color: var(--tb-ink-2); display: block; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vc-cut { display: block; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vc-date { color: var(--tb-ink-2); white-space: nowrap; font-size: var(--tb-fs-13); }
.vc-acts { display: inline-flex; gap: 6px; justify-content: flex-end; flex-wrap: nowrap; }

@media (max-width: 640px) {
  .vc-filter__search { flex: 1 1 100%; }
  .vc-filter__go { display: none; }
  .vc-filter__count { flex: 1 1 0; min-width: 0; margin-left: 0; }
  .vc-voice { min-width: 0; }
  .vc-voice__name b, .vc-id, .vc-cut { max-width: none; white-space: normal; }
  .vc-table tr.is-playing td:first-child { box-shadow: none; }
  .vc-acts { justify-content: flex-start; flex-wrap: wrap; }
  .vc-acts .tb-btn, .vc-play, .vc-voice__edit { --h: 44px; }
}
</style>
